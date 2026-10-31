/* বাংলা ভয়েস টাইপিং — স্ক্রিন রেকর্ডার
 * ট্যাব / উইন্ডো / পুরো স্ক্রিন WebM ভিডিওতে রেকর্ড করে; চাইলে ট্যাব-সিস্টেমের শব্দ আর মাইক একসঙ্গে মিশিয়ে।
 * সবকিছু কম্পিউটারেই হয়, কোথাও কিছু পাঠানো হয় না। */
(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);

  const QUALITY = {
    std: { bps: 2500000, w: 1280, h: 720 },
    hd: { bps: 5000000, w: 1920, h: 1080 },
    max: { bps: 8000000, w: 0, h: 0 }, // স্ক্রিনের আসল মাপ
  };

  let recorder = null;
  let chunks = [];
  let bytes = 0;
  let streams = [];
  let actx = null;
  let tick = null;
  let startedAt = 0;
  let pausedAt = 0;
  let pausedTotal = 0;
  let recording = false;
  let blob = null;
  let url = null;
  let fileName = '';

  const show = (id) => {
    for (const s of ['setup', 'live', 'done']) $(s).hidden = s !== id;
  };
  function note(text, info) {
    const el = $('note');
    el.textContent = text || '';
    el.hidden = !text;
    el.classList.toggle('info', !!info);
  }
  const pad = (n) => String(n).padStart(2, '0');
  const fmtTime = (ms) => {
    const t = Math.floor(ms / 1000);
    const h = Math.floor(t / 3600);
    const m = Math.floor((t % 3600) / 60);
    return (h ? pad(h) + ':' : '') + pad(m) + ':' + pad(t % 60);
  };
  const fmtSize = (b) => (b >= 1e9 ? (b / 1e9).toFixed(2) + ' GB' : (b / 1e6).toFixed(1) + ' MB');

  // ---- সেটিং মনে রাখা
  try {
    chrome.storage.local.get({ recSys: true, recMic: false, recQuality: 'hd', recAuto: true }, (s) => {
      $('sys').checked = !!s.recSys;
      $('mic').checked = !!s.recMic;
      $('quality').value = QUALITY[s.recQuality] ? s.recQuality : 'hd';
      $('auto').checked = !!s.recAuto;
    });
  } catch (_) {}
  const saveOpts = () => {
    try {
      chrome.storage.local.set({
        recSys: $('sys').checked,
        recMic: $('mic').checked,
        recQuality: $('quality').value,
        recAuto: $('auto').checked,
      });
    } catch (_) {}
  };
  for (const id of ['sys', 'mic', 'quality', 'auto']) $(id).addEventListener('change', saveOpts);

  // ---- রেকর্ডিং শুরু
  async function start() {
    note('');
    const q = QUALITY[$('quality').value] || QUALITY.hd;
    const wantSys = $('sys').checked;
    const wantMic = $('mic').checked;

    const video = { frameRate: { ideal: 30 } };
    if (q.w) {
      video.width = { ideal: q.w };
      video.height = { ideal: q.h };
    }

    let display;
    try {
      display = await navigator.mediaDevices.getDisplayMedia({
        video,
        audio: wantSys,
        systemAudio: 'include',
        selfBrowserSurface: 'exclude',
        surfaceSwitching: 'include',
      });
    } catch (e) {
      note(e && e.name === 'NotAllowedError'
        ? 'Sharing was cancelled or blocked. Click Start and choose a tab, window or screen.'
        : 'Could not start screen capture: ' + ((e && e.message) || e));
      return;
    }
    streams = [display];

    let mic = null;
    let warn = '';
    if (wantMic) {
      try {
        mic = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });
        streams.push(mic);
      } catch (_) {
        warn = 'The microphone is blocked or missing, so only the screen is recorded. Allow the microphone for this extension and try again.';
      }
    }
    if (wantSys && !display.getAudioTracks().length) {
      warn = (warn ? warn + ' ' : '') + 'No tab/system sound was shared. Choose "Tab" (and keep "Share tab audio" ticked) to include it.';
    }

    // শব্দ মেশানো: ট্যাব/সিস্টেমের শব্দ + মাইক → একটাই অডিও ট্র্যাক
    const tracks = [...display.getVideoTracks()];
    const sources = [display, mic].filter((s) => s && s.getAudioTracks().length);
    if (sources.length) {
      actx = new AudioContext();
      const dest = actx.createMediaStreamDestination();
      for (const s of sources) actx.createMediaStreamSource(new MediaStream(s.getAudioTracks())).connect(dest);
      tracks.push(...dest.stream.getAudioTracks());
    }
    const out = new MediaStream(tracks);

    beginRecording(out, q, display.getVideoTracks()[0], warn);
  }

  function beginRecording(out, q, endTrack, warn) {
    const mime = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find((m) => MediaRecorder.isTypeSupported(m));
    try {
      recorder = new MediaRecorder(out, {
        mimeType: mime,
        videoBitsPerSecond: q.bps,
        audioBitsPerSecond: 128000,
      });
    } catch (e) {
      cleanup();
      note('This browser could not start recording: ' + ((e && e.message) || e));
      return;
    }

    chunks = [];
    bytes = 0;
    pausedTotal = 0;
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size) {
        chunks.push(e.data);
        bytes += e.data.size;
      }
    };
    recorder.onstop = finish;
    recorder.onerror = () => note('Recording stopped because of an error.');
    // Chrome-এর "Stop sharing" চাপলে
    endTrack.addEventListener('ended', stop);

    recorder.start(1000);
    recording = true;
    startedAt = Date.now();
    $('pause').textContent = '⏸ Pause';
    $('live').classList.remove('paused');
    show('live');
    note(warn, true);
    clearInterval(tick);
    tick = setInterval(paintTimer, 250);
    paintTimer();
  }

  // ---- Area recording: record only the part of a tab that was marked on the page
  let regionStop = null;
  const even = (n) => Math.max(0, Math.round(n / 2) * 2);

  function regionFail(msg) {
    cleanup();
    show('setup');
    let t = msg ? String(msg) : 'Could not start area recording.';
    if (/activeTab|invoked|not been invoked/i.test(t)) {
      t = 'Chrome only allows this when recording is started from the extension icon (or its shortcut). Click the Record button in the popup on the page you want to record.';
    }
    note(t + ' You can still use "Start recording" below to share a tab, window or screen.');
  }

  async function startRegion() {
    note('');
    if (recording) { note('A recording is already running. Stop it first.', true); return; }
    if (blob) again();
    let s = { recSys: true, recMic: false, recQuality: 'hd' };
    try { s = await chrome.storage.local.get(s); } catch (_) {}
    const wantSys = !!s.recSys;
    const wantMic = !!s.recMic;

    let job = null;
    try { job = await chrome.runtime.sendMessage({ type: 'bvt-region-stream' }); } catch (_) {}
    if (!job || !job.ok) { regionFail(job && job.error); return; }

    const fw = Math.max(2, Math.round(job.vw * job.dpr));
    const fh = Math.max(2, Math.round(job.vh * job.dpr));
    const cons = {
      video: { mandatory: { chromeMediaSource: 'tab', chromeMediaSourceId: job.streamId, minWidth: fw, maxWidth: fw, minHeight: fh, maxHeight: fh, maxFrameRate: 30 } },
    };
    if (wantSys) cons.audio = { mandatory: { chromeMediaSource: 'tab', chromeMediaSourceId: job.streamId } };
    let tab;
    try {
      tab = await navigator.mediaDevices.getUserMedia(cons);
    } catch (e) {
      regionFail('Could not capture the tab: ' + ((e && (e.message || e.name)) || e));
      return;
    }
    streams = [tab];

    const vt = tab.getVideoTracks()[0];
    const st = vt.getSettings();
    const calc = (w, h) => {
      const sx = w / job.vw;
      const sy = h / job.vh;
      let x = even(job.rect.x * sx);
      let y = even(job.rect.y * sy);
      let cw = even(job.rect.w * sx);
      let ch = even(job.rect.h * sy);
      x = Math.min(x, Math.max(0, w - 2));
      y = Math.min(y, Math.max(0, h - 2));
      cw = Math.max(2, Math.min(cw, w - x));
      ch = Math.max(2, Math.min(ch, h - y));
      return { x, y, w: cw - (cw % 2), h: ch - (ch % 2) };
    };
    const c0 = calc(st.width || fw, st.height || fh);

    // crop the tab video to the marked box
    let outTrack;
    if (window.MediaStreamTrackProcessor && window.MediaStreamTrackGenerator && window.VideoFrame) {
      const gen = new MediaStreamTrackGenerator({ kind: 'video' });
      const writer = gen.writable.getWriter();
      const reader = new MediaStreamTrackProcessor({ track: vt }).readable.getReader();
      let alive = true;
      (async () => {
        try {
          while (alive) {
            const { value: f, done } = await reader.read();
            if (done || !f) break;
            try {
              const c = calc(f.codedWidth, f.codedHeight);
              await writer.write(new VideoFrame(f, { visibleRect: { x: c.x, y: c.y, width: c.w, height: c.h }, timestamp: f.timestamp }));
            } catch (_) {
              // skip a bad frame
            } finally {
              f.close();
            }
          }
        } catch (_) {}
      })();
      regionStop = () => {
        alive = false;
        try { reader.cancel(); } catch (_) {}
        try { gen.stop(); } catch (_) {}
      };
      outTrack = gen;
    } else {
      // older Chrome: draw the box onto a canvas
      const v = document.createElement('video');
      v.muted = true;
      v.srcObject = new MediaStream([vt]);
      try { await v.play(); } catch (_) {}
      const cv = document.createElement('canvas');
      cv.width = c0.w;
      cv.height = c0.h;
      const ctx = cv.getContext('2d');
      const timer = setInterval(() => {
        if (!v.videoWidth) return;
        const c = calc(v.videoWidth, v.videoHeight);
        ctx.drawImage(v, c.x, c.y, c.w, c.h, 0, 0, cv.width, cv.height);
      }, 33);
      regionStop = () => { clearInterval(timer); v.srcObject = null; };
      outTrack = cv.captureStream(30).getVideoTracks()[0];
    }

    let mic = null;
    let warn = 'Recording the marked area (' + c0.w + '\u00d7' + c0.h + ').';
    if (wantMic) {
      try {
        mic = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });
        streams.push(mic);
      } catch (_) {
        warn += ' The microphone is blocked or missing, so it is not recorded.';
      }
    }

    const tracks = [outTrack];
    const sources = [tab, mic].filter((x) => x && x.getAudioTracks().length);
    if (sources.length) {
      actx = new AudioContext();
      const dest = actx.createMediaStreamDestination();
      for (const x of sources) {
        const node = actx.createMediaStreamSource(new MediaStream(x.getAudioTracks()));
        node.connect(dest);
        if (x === tab) node.connect(actx.destination); // keep the tab audible while it is captured
      }
      tracks.push(...dest.stream.getAudioTracks());
      try { await actx.resume(); } catch (_) {}
      if (actx.state !== 'running') {
        warn += ' Click inside this window once to switch the sound on.';
        document.addEventListener('click', () => { if (actx) actx.resume().catch(() => {}); }, { once: true });
      }
    }

    const fac = s.recQuality === 'std' ? 0.5 : s.recQuality === 'max' ? 1.6 : 1;
    const bps = Math.round(Math.max(1200000, Math.min(16000000, c0.w * c0.h * 30 * 0.09 * fac)));
    beginRecording(new MediaStream(tracks), { bps }, vt, warn);
    const hint = document.querySelector('#live .hint');
    if (hint) hint.textContent = 'Recording the marked area of your tab. Keep this window open (you can minimize it). Press Stop & save when you are done.';
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg && msg.type === 'bvt-region-job-ready') startRegion();
  });

  function paintTimer() {
    const now = recorder && recorder.state === 'paused' ? pausedAt : Date.now();
    $('time').textContent = fmtTime(now - startedAt - pausedTotal);
    $('size').textContent = fmtSize(bytes);
  }

  function togglePause() {
    if (!recorder) return;
    if (recorder.state === 'recording') {
      recorder.pause();
      pausedAt = Date.now();
      $('pause').textContent = '▶ Resume';
      $('live').classList.add('paused');
    } else if (recorder.state === 'paused') {
      recorder.resume();
      pausedTotal += Date.now() - pausedAt;
      $('pause').textContent = '⏸ Pause';
      $('live').classList.remove('paused');
    }
  }

  function stop() {
    if (recorder && recorder.state !== 'inactive') recorder.stop();
  }

  function cleanup() {
    if (regionStop) {
      try { regionStop(); } catch (_) {}
      regionStop = null;
    }
    for (const s of streams) for (const t of s.getTracks()) t.stop();
    streams = [];
    if (actx) {
      actx.close().catch(() => {});
      actx = null;
    }
  }

  // ---- শেষ: ফাইল বানানো, প্রিভিউ, সেভ
  function finish() {
    recording = false;
    clearInterval(tick);
    const ms = (recorder && recorder.state === 'paused' ? pausedAt : Date.now()) - startedAt - pausedTotal;
    cleanup();
    recorder = null;
    if (!chunks.length) {
      show('setup');
      note('Nothing was recorded.');
      return;
    }
    blob = new Blob(chunks, { type: 'video/webm' });
    chunks = [];
    if (url) URL.revokeObjectURL(url);
    url = URL.createObjectURL(blob);

    const d = new Date();
    fileName = `recording-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}.webm`;

    const v = $('preview');
    v.src = url;
    // MediaRecorder-এর ফাইলে মোট সময় লেখা থাকে না; একবার শেষে ঘুরিয়ে আনলে প্রিভিউতে সিক করা যায়
    v.onloadedmetadata = () => {
      if (v.duration === Infinity) {
        v.currentTime = 1e101;
        v.ontimeupdate = () => {
          v.ontimeupdate = null;
          v.currentTime = 0;
        };
      }
    };
    $('fileInfo').textContent = `${fileName} · ${fmtTime(ms)} · ${fmtSize(blob.size)}`;
    show('done');
    note('');
    try { if (new URLSearchParams(location.search).get('region') === '1') window.resizeTo(520, 700); } catch (_) {}
    if ($('auto').checked) download();
  }

  function download() {
    if (!blob) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function again() {
    const v = $('preview');
    v.pause();
    v.removeAttribute('src');
    v.load();
    if (url) URL.revokeObjectURL(url);
    url = null;
    blob = null;
    show('setup');
    note('');
  }

  $('start').addEventListener('click', start);
  if (new URLSearchParams(location.search).get('region') === '1') startRegion();
  $('pause').addEventListener('click', togglePause);
  $('stop').addEventListener('click', stop);
  $('download').addEventListener('click', download);
  $('again').addEventListener('click', again);

  // রেকর্ডিং চলার সময় ভুলে উইন্ডো বন্ধ করলে সতর্ক করা
  window.addEventListener('beforeunload', (e) => {
    if (recording) {
      e.preventDefault();
      e.returnValue = '';
    }
  });
})();
