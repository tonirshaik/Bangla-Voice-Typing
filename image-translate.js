/* বাংলা ভয়েস টাইপিং — ছবির লেখা অনুবাদ (Alt + V)
 * Alt+V চাপুন → ছবির লেখার ওপর মাউস টেনে বক্স আঁকুন → লেখা পড়া (OCR) হয় → অনুবাদ কার্ডে দেখায়।
 * English হলে বাংলা, বাংলা হলে English (অন্য ভাষা হলে বাংলা)। অনুবাদ Chrome-এর অন-ডিভাইস Translator দিয়ে। */
(() => {
  'use strict';

  if (window.top !== window) return;
  if (window.__bvtImgLoaded) return;
  window.__bvtImgLoaded = true;

  const MAX_CHARS = 3000;
  const MIN_BOX = 12;

  const MSG = {
    hint: 'Drag a box over the text in the image · Cancel: Esc',
    reading: 'Reading text from the image… (the first time takes a bit longer)',
    translating: 'Translating…',
    downloading: 'Downloading the translation model…',
    capture: 'Could not capture the image. Reload the page once and press Alt+V again',
    setup: 'The image-reading files are not installed. See "Preparing image translation" in the README (run node setup-ocr.js), then reload the extension',
    empty: 'No text was found in the selected area. Draw the box right over the text and try again',
    readFail: 'Could not read text from the image, please try again',
    noApi: 'The translation API is not available on this page. Chrome 138 or newer and an https page are required. The text read from the image is shown below',
    pair: 'This language pair is not supported in your Chrome',
    needClick: 'Downloading the model needs a click. Press "Try again" below',
    fail: 'Translation failed, please try again',
    copy: 'Copy',
    copyOrig: 'Copy original',
    copied: 'Copied ✓',
    copyFail: 'Could not copy',
    retry: 'Try again',
    close: 'Close',
    showOrig: 'Show original',
    hideOrig: 'Hide original',
    origLabel: 'Text read from the image (mistakes come from OCR limits)',
    cut: 'Only the first 3000 characters were translated',
  };

  // ---------------------------------------------------------------- UI

  const CSS = `
    * { box-sizing: border-box; }
    .overlay, .card { font-family: "Noto Sans Bengali","Siyam Rupali","Nirmala UI","Hind Siliguri",system-ui,sans-serif;
      font-size: 14px; line-height: 1.55; color: #fff; }
    .overlay { position: fixed; inset: 0; display: none; cursor: crosshair; pointer-events: auto;
      background: rgba(0,0,0,.28); touch-action: none; user-select: none; }
    .hint { position: absolute; top: 14px; left: 50%; transform: translateX(-50%); padding: 8px 14px;
      border-radius: 10px; background: #202124; box-shadow: 0 4px 16px rgba(0,0,0,.35); pointer-events: none;
      max-width: calc(100vw - 24px); text-align: center; }
    .box { position: absolute; display: none; border: 2px solid #1a73e8; background: rgba(26,115,232,.18);
      pointer-events: none; }
    .card { position: fixed; display: none; pointer-events: auto; width: 340px; max-width: calc(100vw - 16px);
      background: #202124; border-radius: 12px; box-shadow: 0 6px 24px rgba(0,0,0,.4); overflow: hidden; }
    .head { display: flex; align-items: center; justify-content: space-between; gap: 8px;
      padding: 8px 8px 6px 12px; background: #2d2e30; font-size: 12.5px; color: #bdc1c6; }
    .x { border: none; background: none; color: inherit; font-size: 18px; line-height: 1; cursor: pointer;
      padding: 2px 6px; border-radius: 6px; }
    .x:hover { background: rgba(255,255,255,.12); color: #fff; }
    .body { max-height: 240px; overflow: auto; padding: 10px 12px; white-space: pre-wrap;
      word-break: break-word; user-select: text; }
    .body.dim { color: #9aa0a6; }
    .body.err { color: #f28b82; }
    .note { padding: 0 12px 6px; font-size: 12px; color: #9aa0a6; }
    .orig { display: none; margin: 0 12px 8px; padding: 8px 10px; border-radius: 8px; background: #2d2e30;
      color: #bdc1c6; font-size: 13px; max-height: 130px; overflow: auto; white-space: pre-wrap;
      word-break: break-word; user-select: text; }
    .orig .ol { display: block; margin-bottom: 4px; font-size: 11.5px; color: #9aa0a6; }
    .foot { display: flex; flex-wrap: wrap; gap: 6px; padding: 0 10px 10px; }
    .foot button { border: 1px solid #5f6368; border-radius: 8px; background: transparent; color: #e8eaed;
      font: inherit; font-size: 13px; padding: 4px 12px; cursor: pointer; }
    .foot button:hover { background: rgba(255,255,255,.1); }
    .foot button[hidden] { display: none; }
  `;

  const mk = (tag, cls) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    return e;
  };

  const host = document.createElement('bvt-image-translate');
  const showHost = () => host.style.setProperty('display', 'block', 'important');
  for (const [k, v] of Object.entries({
    position: 'fixed', top: '0', left: '0', width: '0', height: '0', margin: '0', padding: '0',
    border: 'none', background: 'none', 'z-index': '2147483647', 'pointer-events': 'none',
    opacity: '1', visibility: 'visible',
  })) host.style.setProperty(k, v, 'important');
  showHost();

  const shadow = host.attachShadow({ mode: 'closed' });
  try {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(CSS);
    shadow.adoptedStyleSheets = [sheet];
  } catch (_) {
    const st = document.createElement('style');
    st.textContent = CSS;
    shadow.appendChild(st);
  }

  const overlay = mk('div', 'overlay');
  const hintEl = mk('div', 'hint');
  hintEl.textContent = MSG.hint;
  const box = mk('div', 'box');
  overlay.append(hintEl, box);

  const card = mk('div', 'card');
  const head = mk('div', 'head');
  const lbl = mk('span', 'lbl');
  const xBtn = mk('button', 'x');
  xBtn.type = 'button';
  xBtn.title = MSG.close;
  xBtn.textContent = '×';
  head.append(lbl, xBtn);
  const body = mk('div', 'body');
  body.setAttribute('dir', 'auto');
  const noteEl = mk('div', 'note');
  const origEl = mk('div', 'orig');
  origEl.setAttribute('dir', 'auto');
  const origLbl = mk('span', 'ol');
  origLbl.textContent = MSG.origLabel;
  const origText = mk('span');
  origEl.append(origLbl, origText);
  const foot = mk('div', 'foot');
  const copyBtn = mk('button');
  copyBtn.type = 'button';
  copyBtn.textContent = MSG.copy;
  const origCopyBtn = mk('button');
  origCopyBtn.type = 'button';
  origCopyBtn.textContent = MSG.copyOrig;
  const origBtn = mk('button');
  origBtn.type = 'button';
  origBtn.textContent = MSG.showOrig;
  const retryBtn = mk('button');
  retryBtn.type = 'button';
  retryBtn.textContent = MSG.retry;
  foot.append(copyBtn, origCopyBtn, origBtn, retryBtn);
  card.append(head, body, noteEl, origEl, foot);

  shadow.append(overlay, card);
  (document.body || document.documentElement).appendChild(host);

  // --------------------------------------------------------- অবস্থা

  let runId = 0; // নতুন কাজ শুরু বা বন্ধ করলে পুরনো কাজের ফল ফেলে দিতে
  let picking = false;
  let drag = null;
  let cur = null; // { rect }
  let ocrText = '';
  let result = '';
  let truncated = false;
  let micPrev = null;

  const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), Math.max(lo, hi));

  function hideCard() { card.style.display = 'none'; }

  function closeAll() {
    runId++;
    stopPicking();
    hideCard();
    restoreUI();
    cur = null;
  }

  function placeCard() {
    const r = cur.rect;
    card.style.left = clamp(r.left, 8, window.innerWidth - 348) + 'px';
    const below = window.innerHeight - r.bottom;
    const above = r.top;
    if (below < 240 && above > below) {
      card.style.top = 'auto';
      card.style.bottom = Math.max(8, window.innerHeight - r.top + 10) + 'px';
    } else {
      card.style.bottom = 'auto';
      card.style.top = Math.min(r.bottom + 10, Math.max(8, window.innerHeight - 80)) + 'px';
    }
    card.style.display = 'block';
  }

  function setCard({ label, text, kind, note, ready, retry, orig }) {
    lbl.textContent = label || '';
    body.textContent = text || '';
    body.className = 'body' + (kind ? ' ' + kind : '');
    noteEl.textContent = note || '';
    noteEl.style.display = note ? 'block' : 'none';
    copyBtn.hidden = !ready;
    copyBtn.textContent = MSG.copy;
    retryBtn.hidden = !retry;
    origText.textContent = ocrText;
    origBtn.hidden = !ocrText;
    origCopyBtn.hidden = !ocrText;
    origCopyBtn.textContent = MSG.copyOrig;
    if (orig === true) origEl.style.display = ocrText ? 'block' : 'none';
    origBtn.textContent = origEl.style.display === 'block' ? MSG.hideOrig : MSG.showOrig;
  }

  // ------------------------------------------- স্ক্রিনশটের জন্য UI লুকানো

  function hideForCapture() {
    host.style.setProperty('display', 'none', 'important');
    const mic = document.querySelector('bvt-voice-typing');
    if (mic) {
      micPrev = mic;
      mic.style.setProperty('visibility', 'hidden', 'important');
    }
  }

  function restoreUI() {
    showHost();
    if (micPrev) {
      micPrev.style.setProperty('visibility', 'visible', 'important');
      micPrev = null;
    }
  }

  const frames = () =>
    new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(res, 60))));

  // ----------------------------------------------- বক্স টেনে বাছা

  function startPicking() {
    runId++;
    hideCard();
    cur = null;
    picking = true;
    drag = null;
    box.style.display = 'none';
    overlay.style.display = 'block';
  }

  function stopPicking() {
    picking = false;
    drag = null;
    overlay.style.display = 'none';
    box.style.display = 'none';
  }

  function drawBox(x0, y0, x1, y1) {
    const l = Math.min(x0, x1);
    const t = Math.min(y0, y1);
    box.style.left = l + 'px';
    box.style.top = t + 'px';
    box.style.width = Math.abs(x1 - x0) + 'px';
    box.style.height = Math.abs(y1 - y0) + 'px';
    box.style.display = 'block';
  }

  overlay.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    drag = { x: e.clientX, y: e.clientY };
    drawBox(e.clientX, e.clientY, e.clientX, e.clientY);
    try { overlay.setPointerCapture(e.pointerId); } catch (_) {}
  });
  overlay.addEventListener('pointermove', (e) => {
    if (drag) drawBox(drag.x, drag.y, e.clientX, e.clientY);
  });
  overlay.addEventListener('pointerup', (e) => {
    if (!drag) return;
    const x0 = clamp(Math.min(drag.x, e.clientX), 0, window.innerWidth);
    const y0 = clamp(Math.min(drag.y, e.clientY), 0, window.innerHeight);
    const x1 = clamp(Math.max(drag.x, e.clientX), 0, window.innerWidth);
    const y1 = clamp(Math.max(drag.y, e.clientY), 0, window.innerHeight);
    drag = null;
    try { overlay.releasePointerCapture(e.pointerId); } catch (_) {}
    if (x1 - x0 < MIN_BOX || y1 - y0 < MIN_BOX) {
      box.style.display = 'none'; // খুব ছোট বক্স: আবার টানার সুযোগ
      return;
    }
    stopPicking();
    run({ left: x0, top: y0, right: x1, bottom: y1 });
  });

  window.addEventListener(
    'keydown',
    (e) => {
      if (e.key !== 'Escape') return;
      if (picking) {
        e.preventDefault();
        e.stopPropagation();
        closeAll();
      } else if (card.style.display === 'block') {
        closeAll();
      }
    },
    true
  );
  document.addEventListener(
    'mousedown',
    (e) => {
      if (e.target === host) return; // নিজের কার্ড বা ওভারলে
      if (card.style.display === 'block') closeAll();
    },
    true
  );

  // ------------------------------------------------ লেখা পড়া + অনুবাদ

  // OCR-এর লাইন-ভাঙা লেখাকে অনুচ্ছেদ ধরে জোড়া দেওয়া (বাক্যের মাঝের লাইন-ভাঙা অনুবাদ বিগড়ে দেয়)
  function tidy(raw) {
    let t = String(raw || '').normalize('NFC').replace(/\r/g, '');
    const bn = (t.match(/[\u0980-\u09FF]/g) || []).length;
    const en = (t.match(/[A-Za-z]/g) || []).length;
    // ইংরেজি লেখায় OCR-এর বানানো ছিটেফোঁটা বাংলা অক্ষর বাদ
    if (en > 0 && bn > 0 && bn / (bn + en) < 0.1) t = t.replace(/[\u0980-\u09FF]/g, '');
    return t
      .split(/\n{2,}/)
      .map((p) => p.replace(/\s*\n\s*/g, ' ').replace(/[ \t]{2,}/g, ' ').trim())
      .filter(Boolean)
      .join('\n\n');
  }

  async function run(r) {
    const my = ++runId;
    cur = { rect: { left: r.left, top: r.top, right: r.right, bottom: r.bottom } };
    ocrText = '';
    result = '';
    truncated = false;
    origEl.style.display = 'none';

    hideForCapture();
    await frames();
    if (my !== runId) return restoreUI();

    let res;
    try {
      res = await chrome.runtime.sendMessage({
        type: 'bvt-ocr',
        rect: { x: r.left, y: r.top, w: r.right - r.left, h: r.bottom - r.top },
        vw: window.innerWidth,
      });
    } catch (_) {
      res = { error: 'fail' };
    }
    restoreUI();
    if (my !== runId) return;

    if (!res || res.error) {
      const code = res && res.error;
      const msg = code === 'capture' ? MSG.capture : code === 'setup' ? MSG.setup : code === 'empty' ? MSG.empty : MSG.readFail;
      setCard({ label: '🖼️', text: msg + (res && res.detail ? '\n\n(' + res.detail + ')' : ''), kind: 'err' });
      placeCard();
      return;
    }

    let text = tidy(res.text);
    if (!/[\p{L}\p{N}]/u.test(text)) {
      setCard({ label: '🖼️', text: MSG.empty, kind: 'err' });
      placeCard();
      return;
    }
    if (text.length > MAX_CHARS) {
      text = text.slice(0, MAX_CHARS);
      truncated = true;
    }
    ocrText = text;
    if (!/\p{L}/u.test(text)) { // only numbers/symbols: no translation, just show it for copying
      result = text;
      setCard({ label: '🖼️ 123', text, note: truncated ? MSG.cut : '', ready: true });
      placeCard();
      return;
    }
    translate(my);
  }

  // "image-captured" পেলে (স্ক্রিনশট হয়ে গেলে) লোডিং কার্ড দেখানো
  function showReading() {
    if (!cur) return;
    restoreUI();
    setCard({ label: '🖼️', text: MSG.reading, kind: 'dim' });
    placeCard();
  }

  let namer = null;
  try { namer = new Intl.DisplayNames(['en'], { type: 'language' }); } catch (_) {}
  const langName = (c) => {
    try { return (namer && namer.of(c)) || c; } catch (_) { return c; }
  };

  const translators = new Map();
  async function getTranslator(source, target, onProgress) {
    const key = source + '>' + target;
    if (translators.has(key)) return translators.get(key);
    const opts = { sourceLanguage: source, targetLanguage: target };
    const av = await window.Translator.availability(opts);
    if (av === 'unavailable') throw new Error('pair-unavailable');
    const t = await window.Translator.create({
      ...opts,
      monitor(m) {
        m.addEventListener('downloadprogress', (e) => onProgress(Math.round(e.loaded * 100)));
      },
    });
    translators.set(key, t);
    return t;
  }

  const routes = new Map();
  async function getRoute(source, target) {
    const key = source + '>' + target;
    if (routes.has(key)) return routes.get(key);
    const route = await globalThis.BVT.planRoute(source, target, (s, t) =>
      window.Translator.availability({ sourceLanguage: s, targetLanguage: t })
    );
    if (route) routes.set(key, route);
    return route;
  }

  async function translateLines(t, text) {
    const out = [];
    for (const line of text.split('\n')) {
      const m = line.match(/^(\s*)([\s\S]*?)(\s*)$/);
      out.push(m[2] ? m[1] + (await t.translate(m[2])) + m[3] : line);
    }
    return out.join('\n');
  }

  async function translate(my) {
    setCard({ label: '🌐', text: MSG.translating, kind: 'dim' });
    if (card.style.display !== 'block') placeCard();
    try {
      if (!('Translator' in window)) throw new Error('no-api');
      const source = await globalThis.BVT.detectLang(ocrText, { download: true });
      const target = source === 'bn' ? 'en' : 'bn'; // বাংলা → English, বাকি সব → বাংলা
      const route = await getRoute(source, target);
      if (!route) throw new Error('pair-unavailable');
      const label = '🖼️ ' + [source, ...route.map((h) => h[1])].map(langName).join(' → ');
      if (my !== runId) return;
      setCard({ label, text: MSG.translating, kind: 'dim' });
      let out = ocrText;
      for (const [s, d] of route) {
        const t = await getTranslator(s, d, (p) => {
          if (my === runId) setCard({ label, text: MSG.downloading + ' ' + p + '%', kind: 'dim' });
        });
        out = await translateLines(t, out);
        if (my !== runId) return;
      }
      result = out;
      setCard({ label, text: out, note: truncated ? MSG.cut : '', ready: true });
    } catch (err) {
      if (my !== runId) return;
      const name = err && err.name;
      let msg = MSG.fail;
      let retry = true;
      let showOrig = false;
      if (err && err.message === 'no-api') { msg = MSG.noApi; retry = false; showOrig = true; }
      else if (err && err.message === 'pair-unavailable') { msg = MSG.pair; retry = false; showOrig = true; }
      else if (name === 'NotSupportedError') { msg = MSG.pair; retry = false; showOrig = true; }
      else if (name === 'NotAllowedError') msg = MSG.needClick;
      setCard({ label: '🖼️', text: msg, kind: 'err', retry, orig: showOrig ? true : undefined });
    }
  }

  // ------------------------------------------------------ বাটনের কাজ

  for (const el of [xBtn, copyBtn, origCopyBtn, origBtn, retryBtn]) {
    el.addEventListener('mousedown', (e) => e.preventDefault());
  }

  xBtn.addEventListener('click', () => closeAll());

  retryBtn.addEventListener('click', () => {
    if (!ocrText) return;
    translate(++runId);
  });

  origBtn.addEventListener('click', () => {
    const open = origEl.style.display === 'block';
    origEl.style.display = open ? 'none' : 'block';
    origBtn.textContent = open ? MSG.showOrig : MSG.hideOrig;
  });

  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(result);
      copyBtn.textContent = MSG.copied;
    } catch (_) {
      copyBtn.textContent = MSG.copyFail;
    }
    setTimeout(() => { copyBtn.textContent = MSG.copy; }, 1500);
  });

  origCopyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(ocrText);
      origCopyBtn.textContent = MSG.copied;
    } catch (_) {
      origCopyBtn.textContent = MSG.copyFail;
    }
    setTimeout(() => { origCopyBtn.textContent = MSG.copyOrig; }, 1500);
  });

  // ------------------------------------------------------ মেসেজ

  try {
    chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
      if (!msg) return;
      if (msg.type === 'image-translate') {
        if (picking) closeAll();
        else startPicking();
        sendResponse({ ok: true });
      } else if (msg.type === 'image-captured') {
        showReading();
      }
    });
  } catch (_) {
    // এক্সটেনশন রিলোড হলে পাতা রিলোড করলেই ঠিক হবে
  }
})();
