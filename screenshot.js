/* বাংলা ভয়েস টাইপিং — স্ক্রিনশট + মার্কিং (Alt + S)
 * Alt+S চাপুন (বা পপআপের 📸 বাটন) → মাউস টেনে এলাকা বাছুন (Enter = পুরো স্ক্রিন) →
 * স্ক্রিনশট কার্ড খুলবে → কলম, হাইলাইটার, তীর, বক্স, গোল, লেখা, নম্বর, ব্লার দিয়ে মার্ক করুন →
 * Copy বা Save (PNG)। ছবি ডিভাইসের আসল পিক্সেলে (HD) তোলা হয়, চাইলে 2× / 3× সেভ করা যায়। */
(() => {
  'use strict';

  if (window.top !== window) return;
  if (window.__bvtShotLoaded) return;
  window.__bvtShotLoaded = true;

  const MIN_BOX = 8;
  const MAX_PIXELS = 100e6; // এক্সপোর্ট ছবির সর্বোচ্চ পিক্সেল (ক্যানভাস সীমা এড়াতে)
  const FONT = '"Noto Sans Bengali","Siyam Rupali","Nirmala UI","Hind Siliguri",system-ui,sans-serif';
  const COLORS = ['#ea4335', '#fbbc04', '#34a853', '#1a73e8', '#a142f4', '#ffffff', '#202124'];

  const MSG = {
    hint: 'Drag to select an area · Enter = visible screen · Esc = cancel',
    capture: 'Could not capture the screen. Reload the page once and press Alt+S again (does not work on chrome:// pages or the Web Store)',
    copied: 'Copied ✓',
    copyFail: 'Could not copy (needs an https page)',
    saved: 'Saved ✓',
  };

  const TOOLS = [
    ['pen', '✏️', 'Pen (P)'],
    ['hl', '🖍️', 'Highlighter (H)'],
    ['arrow', '↗', 'Arrow (A)'],
    ['rect', '▭', 'Box (R)'],
    ['ellipse', '◯', 'Circle (O)'],
    ['text', 'T', 'Text (T)'],
    ['num', '①', 'Number (N)'],
    ['blur', '▦', 'Blur / hide (B)'],
  ];
  const KEYS = { p: 'pen', h: 'hl', a: 'arrow', r: 'rect', o: 'ellipse', t: 'text', n: 'num', b: 'blur' };

  // ---------------------------------------------------------------- UI

  const CSS = `
    * { box-sizing: border-box; }
    .overlay, .ed { font-family: ${FONT}; font-size: 14px; line-height: 1.5; color: #fff; }
    .overlay { position: fixed; inset: 0; display: none; cursor: crosshair; pointer-events: auto;
      background: rgba(0,0,0,.3); touch-action: none; user-select: none; }
    .hint { position: absolute; top: 14px; left: 50%; transform: translateX(-50%); padding: 8px 14px;
      border-radius: 10px; background: #202124; box-shadow: 0 4px 16px rgba(0,0,0,.35); pointer-events: none;
      max-width: calc(100vw - 24px); text-align: center; }
    .box { position: absolute; display: none; border: 2px solid #1a73e8; background: rgba(26,115,232,.15);
      pointer-events: none; }
    .size { position: absolute; display: none; padding: 2px 8px; border-radius: 6px; background: #1a73e8;
      font-size: 12px; pointer-events: none; }

    .ed { position: fixed; inset: 0; display: none; pointer-events: auto; background: rgba(0,0,0,.6);
      align-items: center; justify-content: center; }
    .card { display: flex; flex-direction: column; width: min(1100px, calc(100vw - 24px));
      max-height: calc(100vh - 24px); background: #202124; border-radius: 14px; overflow: hidden;
      box-shadow: 0 10px 40px rgba(0,0,0,.5); }
    .bar { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; padding: 8px 10px; background: #2d2e30; }
    .grp { display: flex; align-items: center; gap: 4px; padding-right: 8px; margin-right: 2px;
      border-right: 1px solid #4a4c50; }
    .grp:last-child { border-right: none; margin-right: 0; padding-right: 0; }
    .grow { flex: 1; }
    button { font: inherit; cursor: pointer; }
    .tb { min-width: 34px; height: 34px; padding: 0 8px; border: 1px solid transparent; border-radius: 8px;
      background: transparent; color: #e8eaed; font-size: 16px; }
    .tb:hover { background: rgba(255,255,255,.12); }
    .tb.on { background: #1a73e8; color: #fff; }
    .tb:disabled { opacity: .35; cursor: default; }
    .sw { width: 22px; height: 22px; border-radius: 50%; border: 2px solid transparent; padding: 0;
      box-shadow: 0 0 0 1px rgba(255,255,255,.35) inset; }
    .sw.on { border-color: #fff; transform: scale(1.15); }
    input[type=range] { width: 90px; accent-color: #1a73e8; }
    select { height: 32px; border-radius: 8px; border: 1px solid #5f6368; background: #2d2e30; color: #e8eaed;
      font: inherit; font-size: 13px; padding: 0 6px; }
    .act { height: 34px; padding: 0 14px; border-radius: 8px; border: 1px solid #5f6368; background: transparent;
      color: #e8eaed; font-size: 13.5px; }
    .act:hover { background: rgba(255,255,255,.1); }
    .act.pri { background: #1a73e8; border-color: #1a73e8; color: #fff; font-weight: 600; }
    .act.pri:hover { background: #1765cc; }
    .stage { position: relative; flex: 1; min-height: 120px; overflow: auto; padding: 12px; display: flex;
      background: #111214; }
    .wrap { position: relative; margin: auto; line-height: 0; }
    canvas { display: block; max-width: 100%; touch-action: none; cursor: crosshair;
      box-shadow: 0 2px 14px rgba(0,0,0,.6); background: #fff; }
    .txt { position: absolute; min-width: 60px; padding: 0 2px; margin: 0; border: 1px dashed #1a73e8;
      background: rgba(255,255,255,.08); outline: none; font-family: ${FONT}; line-height: 1.2; z-index: 3; }
    .ocr { display: none; padding: 8px 10px 10px; background: #2d2e30; border-top: 1px solid #4a4c50; }
    .ocr .oh { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; font-size: 12.5px; color: #bdc1c6; }
    .ocr textarea { display: block; width: 100%; height: 130px; resize: vertical; padding: 8px; border-radius: 8px;
      border: 1px solid #5f6368; background: #111214; color: #e8eaed; font-family: ${FONT}; font-size: 14px;
      line-height: 1.5; outline: none; }
    .ocr textarea:focus { border-color: #1a73e8; }
    .status { padding: 6px 12px; font-size: 12.5px; color: #9aa0a6; background: #2d2e30; min-height: 30px; }

    .pickbar { position: absolute; top: 58px; left: 50%; transform: translateX(-50%); display: flex; gap: 8px;
      pointer-events: auto; cursor: default; }
    .pickbar .act { background: #202124; box-shadow: 0 4px 16px rgba(0,0,0,.35); }
    .prog { position: fixed; left: 50%; bottom: 22px; transform: translateX(-50%); display: none; align-items: center;
      gap: 10px; padding: 8px 8px 8px 16px; border-radius: 12px; background: #202124; color: #fff;
      font-family: ${FONT}; font-size: 14px; box-shadow: 0 6px 24px rgba(0,0,0,.45); pointer-events: auto; }

    .hist { position: fixed; inset: 0; display: none; align-items: center; justify-content: center;
      background: rgba(0,0,0,.6); pointer-events: auto; font-family: ${FONT}; font-size: 14px; line-height: 1.5; color: #fff; }
    .hcard { display: flex; flex-direction: column; width: min(1000px, calc(100vw - 24px));
      max-height: calc(100vh - 24px); background: #202124; border-radius: 14px; overflow: hidden;
      box-shadow: 0 10px 40px rgba(0,0,0,.5); }
    .hhead { display: flex; align-items: center; gap: 10px; padding: 10px 12px; background: #2d2e30; }
    .ht { font-weight: 600; font-size: 15px; }
    .hs { color: #9aa0a6; font-size: 12.5px; }
    .hgrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 10px; padding: 12px;
      overflow: auto; }
    .hitem { position: relative; border-radius: 10px; background: #2d2e30; overflow: hidden; border: 1px solid #3c4043;
      cursor: pointer; }
    .hitem:hover { border-color: #1a73e8; }
    .hitem canvas { display: block; width: 100%; height: auto; aspect-ratio: 380 / 240; max-width: none; cursor: pointer;
      box-shadow: none; background: #111214; }
    .hmeta { padding: 6px 8px 8px; font-size: 12px; color: #bdc1c6; line-height: 1.4; overflow: hidden;
      text-overflow: ellipsis; white-space: nowrap; }
    .hmeta b { color: #fff; font-weight: 600; font-size: 12.5px; }
    .hdel { position: absolute; top: 6px; right: 6px; width: 26px; height: 26px; border-radius: 50%; border: none;
      background: rgba(0,0,0,.65); color: #fff; font-size: 13px; padding: 0; }
    .hdel:hover { background: #d93025; }
    .hbadge { position: absolute; top: 6px; left: 6px; padding: 1px 7px; border-radius: 6px; background: rgba(0,0,0,.65);
      font-size: 11px; }
    .hempty { grid-column: 1 / -1; padding: 40px 16px; text-align: center; color: #9aa0a6; }
  `;

  const mk = (tag, cls) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    return e;
  };
  const btn = (cls, text, title) => {
    const b = mk('button', cls);
    b.type = 'button';
    b.textContent = text;
    if (title) b.title = title;
    b.addEventListener('mousedown', (e) => e.preventDefault());
    return b;
  };

  const host = document.createElement('bvt-screenshot');
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

  // --- এলাকা বাছার ওভারলে
  const overlay = mk('div', 'overlay');
  const hintEl = mk('div', 'hint');
  hintEl.textContent = MSG.hint;
  const box = mk('div', 'box');
  const sizeEl = mk('div', 'size');
  const pickBar = mk('div', 'pickbar');
  const pickFull = btn('act', '📜 Full page (F)', 'Capture the whole scrolling page');
  const pickHist = btn('act', '🕘 History (H)', 'Open saved screenshots');
  pickBar.append(pickFull, pickHist);
  pickBar.addEventListener('pointerdown', (e) => e.stopPropagation());
  overlay.append(hintEl, pickBar, box, sizeEl);

  // --- এডিটর কার্ড
  const ed = mk('div', 'ed');
  const card = mk('div', 'card');
  const bar = mk('div', 'bar');

  const toolBtns = {};
  const gTools = mk('div', 'grp');
  for (const [id, label, title] of TOOLS) {
    const b = btn('tb', label, title);
    b.addEventListener('click', () => setTool(id));
    toolBtns[id] = b;
    gTools.appendChild(b);
  }

  const gColor = mk('div', 'grp');
  const swatches = COLORS.map((c) => {
    const b = btn('sw', '', c);
    b.style.background = c;
    b.addEventListener('click', () => setColor(c));
    gColor.appendChild(b);
    return b;
  });

  const gSize = mk('div', 'grp');
  const sizeRange = mk('input');
  sizeRange.type = 'range';
  sizeRange.min = '1';
  sizeRange.max = '10';
  sizeRange.value = '4';
  sizeRange.title = 'Thickness / size';
  gSize.appendChild(sizeRange);

  const gHist = mk('div', 'grp');
  const undoBtn = btn('tb', '↶', 'Undo (Ctrl+Z)');
  const redoBtn = btn('tb', '↷', 'Redo (Ctrl+Shift+Z)');
  const clearBtn = btn('tb', '🗑️', 'Remove all marks');
  gHist.append(undoBtn, redoBtn, clearBtn);

  const gOut = mk('div', 'grp');
  const scaleSel = mk('select');
  scaleSel.title = 'Quality of the saved image';
  for (const [v, t] of [['1', 'HD · original'], ['2', 'HD · 2×'], ['3', 'HD · 3×']]) {
    const o = mk('option');
    o.value = v;
    o.textContent = t;
    scaleSel.appendChild(o);
  }
  gOut.appendChild(scaleSel);

  const gAct = mk('div', 'grp');
  const retakeBtn = btn('act', '↻ Retake', 'Select the area again');
  const textBtn = btn('act', '📝 Text', 'Read the text in this picture so you can copy it');
  const copyBtn = btn('act', 'Copy', 'Copy image (Ctrl+C)');
  const saveBtn = btn('act pri', 'Save PNG', 'Download (Ctrl+S)');
  const closeBtn = btn('tb', '✕', 'Close (Esc)');
  const histBtn = btn('act', '🕘 History', 'Saved screenshots (H)');
  const fullBtn = btn('act', '📜 Full page', 'Capture the whole scrolling page (F)');
  gAct.append(histBtn, fullBtn, retakeBtn, textBtn, copyBtn, saveBtn);

  const grow = mk('div', 'grow');
  bar.append(gTools, gColor, gSize, gHist, gOut, grow, gAct, closeBtn);

  const stage = mk('div', 'stage');
  const wrap = mk('div', 'wrap');
  const canvas = mk('canvas');
  wrap.appendChild(canvas);
  stage.appendChild(wrap);
  const status = mk('div', 'status');

  const ocrBox = mk('div', 'ocr');
  const ocrHead = mk('div', 'oh');
  const ocrLbl = mk('span');
  ocrLbl.textContent = 'Text found in the picture (you can edit it before copying)';
  const ocrCopy = btn('act', 'Copy text');
  const ocrHide = btn('tb', '✕', 'Hide');
  ocrHead.append(ocrLbl, mk('div', 'grow'), ocrCopy, ocrHide);
  const ocrArea = mk('textarea');
  ocrArea.setAttribute('dir', 'auto');
  ocrArea.spellcheck = false;
  ocrBox.append(ocrHead, ocrArea);

  card.append(bar, stage, ocrBox, status);
  ed.appendChild(card);
  // --- পুরো পাতা তোলার সময় অগ্রগতি
  const prog = mk('div', 'prog');
  const progTxt = mk('span');
  const progCancel = btn('act', 'Cancel', 'Stop (Esc)');
  prog.append(progTxt, progCancel);

  // --- স্ক্রিনশট হিস্ট্রি প্যানেল
  const hist = mk('div', 'hist');
  const hcard = mk('div', 'hcard');
  const hhead = mk('div', 'hhead');
  const hTitle = mk('span', 'ht');
  hTitle.textContent = '🕘 Screenshot history';
  const hStat = mk('span', 'hs');
  const hClear = btn('act', 'Clear all', 'Delete every saved screenshot');
  const hClose = btn('tb', '✕', 'Close (Esc)');
  hhead.append(hTitle, hStat, mk('div', 'grow'), hClear, hClose);
  const hGrid = mk('div', 'hgrid');
  hcard.append(hhead, hGrid);
  hist.appendChild(hcard);

  shadow.append(overlay, ed, prog, hist);
  (document.body || document.documentElement).appendChild(host);

  // --------------------------------------------------------- অবস্থা

  let picking = false;
  let drag = null;
  let editing = false;
  let base = null; // কাটা মূল ছবি (ডিভাইস পিক্সেলে)
  let shapes = [];
  let redo = [];
  let tool = 'arrow';
  let color = COLORS[0];
  let size = 4;
  let draft = null;
  let textEl = null;
  let numCount = 1;
  let hidden = [];
  let busy = false;
  let ocrRun = 0;
  let ocrBusy = false;
  let shotKind = 'area';
  let fullRun = false;
  let fullCancel = false;
  let histOpen = false;
  let histOn = true; // হিস্ট্রি চালু কি না (পপআপের সেটিং)
  let curId = null; // বর্তমান ছবির হিস্ট্রি আইডি
  let lastSig = '';
  let hTimer = 0;
  let hQueue = Promise.resolve();

  const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), Math.max(lo, hi));
  const say = (t) => { status.textContent = t || ''; };

  try {
    chrome.storage.local.get({ shotScale: '1' }, (s) => { if (s && s.shotScale) scaleSel.value = String(s.shotScale); });
  } catch (_) {}
  scaleSel.addEventListener('change', () => {
    try { chrome.storage.local.set({ shotScale: scaleSel.value }); } catch (_) {}
  });
  try {
    chrome.storage.local.get({ shotHistory: true }, (s) => { histOn = !s || s.shotHistory !== false; });
    chrome.storage.onChanged.addListener((c, area) => {
      if (area === 'local' && c.shotHistory) histOn = c.shotHistory.newValue !== false;
    });
  } catch (_) {}

  // ------------------------------------------ স্ক্রিনশটের জন্য UI লুকানো

  function hideForCapture() {
    host.style.setProperty('display', 'none', 'important');
    hidden = [];
    for (const el of document.querySelectorAll('bvt-voice-typing, bvt-select-translate, bvt-image-translate')) {
      hidden.push([el, el.style.getPropertyValue('visibility'), el.style.getPropertyPriority('visibility')]);
      el.style.setProperty('visibility', 'hidden', 'important');
    }
  }
  function restoreUI() {
    showHost();
    for (const [el, v, p] of hidden) {
      if (v) el.style.setProperty('visibility', v, p);
      else el.style.removeProperty('visibility');
    }
    hidden = [];
  }
  const frames = () =>
    new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(res, 80))));

  // ----------------------------------------------- এলাকা বাছা

  function startPicking() {
    closeEditor();
    picking = true;
    drag = null;
    box.style.display = 'none';
    sizeEl.style.display = 'none';
    overlay.style.display = 'block';
  }
  function stopPicking() {
    picking = false;
    drag = null;
    overlay.style.display = 'none';
    box.style.display = 'none';
    sizeEl.style.display = 'none';
  }
  function drawBox(x0, y0, x1, y1) {
    const l = Math.min(x0, x1);
    const t = Math.min(y0, y1);
    const w = Math.abs(x1 - x0);
    const h = Math.abs(y1 - y0);
    box.style.cssText = `display:block;left:${l}px;top:${t}px;width:${w}px;height:${h}px`;
    sizeEl.textContent = Math.round(w) + ' × ' + Math.round(h);
    sizeEl.style.cssText = `display:block;left:${l}px;top:${Math.max(0, t - 26)}px`;
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
      box.style.display = 'none';
      sizeEl.style.display = 'none';
      return;
    }
    stopPicking();
    capture({ left: x0, top: y0, right: x1, bottom: y1 });
  });

  // ----------------------------------------------- স্ক্রিনশট নেওয়া (HD)

  const loadImg = (src) =>
    new Promise((res, rej) => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = () => rej(new Error('img'));
      im.src = src;
    });

  async function capture(r, kind) {
    if (busy) return;
    busy = true;
    hideForCapture();
    await frames();
    let res;
    try {
      res = await chrome.runtime.sendMessage({ type: 'bvt-shot-capture' });
    } catch (_) {
      res = { error: 'capture' };
    }
    restoreUI();
    if (!res || res.error || !res.dataUrl) {
      busy = false;
      alert(MSG.capture + (res && res.detail ? '\n\n[' + res.detail + ']' : ''));
      return;
    }
    try {
      const img = await loadImg(res.dataUrl);
      // ক্যাপচার ছবি = ভিউপোর্ট × (DPR × জুম); তাই আসল পিক্সেলের অনুপাত বের করে কাটি
      const sx = img.naturalWidth / window.innerWidth;
      const sy = img.naturalHeight / window.innerHeight;
      const x = Math.round(r.left * sx);
      const y = Math.round(r.top * sy);
      const w = Math.max(1, Math.min(img.naturalWidth - x, Math.round((r.right - r.left) * sx)));
      const h = Math.max(1, Math.min(img.naturalHeight - y, Math.round((r.bottom - r.top) * sy)));
      base = mk('canvas');
      base.width = w;
      base.height = h;
      base.getContext('2d').drawImage(img, x, y, w, h, 0, 0, w, h);
      shotKind = kind || 'area';
      openEditor();
      histAdd(shotKind);
    } catch (_) {
      alert(MSG.capture);
    }
    busy = false;
  }

  // ----------------------------------------------- এডিটর

  function openEditor(restore) {
    shapes = restore ? restore.shapes : [];
    redo = [];
    draft = null;
    numCount = restore ? restore.numCount : 1;
    canvas.width = base.width;
    canvas.height = base.height;
    // স্ক্রিনে ছোট করে দেখানো হয়, কিন্তু ভেতরের ক্যানভাস পুরো রেজোলিউশনে থাকে
    canvas.style.width = Math.min(base.width / (window.devicePixelRatio || 1), window.innerWidth - 80) + 'px';
    canvas.style.height = 'auto';
    ocrRun++;
    ocrBusy = false;
    textBtn.disabled = false;
    ocrBox.style.display = 'none';
    ocrArea.value = '';
    editing = true;
    ed.style.display = 'flex';
    setTool(tool);
    setColor(color);
    paint();
    say(`${base.width} × ${base.height}px · Save করলে এই মাপেই (বা বেছে নেওয়া 2×/3×) PNG হবে`);
  }

  function closeEditor() {
    commitText();
    flushHist();
    clearTimeout(hTimer);
    ocrRun++;
    ocrBusy = false;
    textBtn.disabled = false;
    ocrBox.style.display = 'none';
    editing = false;
    ed.style.display = 'none';
    base = null;
    curId = null;
    shapes = [];
    redo = [];
    draft = null;
  }

  function setTool(t) {
    commitText();
    tool = t;
    for (const [id, b] of Object.entries(toolBtns)) b.classList.toggle('on', id === t);
    canvas.style.cursor = t === 'text' ? 'text' : 'crosshair';
  }
  function setColor(c) {
    color = c;
    swatches.forEach((s, i) => s.classList.toggle('on', COLORS[i] === c));
    if (textEl) textEl.style.color = c;
  }
  sizeRange.addEventListener('input', () => { size = +sizeRange.value; });
  size = +sizeRange.value;

  function syncHist() {
    undoBtn.disabled = !shapes.length;
    redoBtn.disabled = !redo.length;
    clearBtn.disabled = !shapes.length;
    markDirty();
  }

  // মার্কের মাপ ছবির মাপের সঙ্গে মানানসই (ডিভাইস পিক্সেলে)
  const unit = () => Math.max(1, Math.max(base.width, base.height) / 900);
  const lw = (s) => Math.max(1.5, s.size * unit() * 1.1);

  // ---- আঁকা (k = এক্সপোর্ট স্কেল)
  function drawShape(ctx, s, k) {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = s.color;
    ctx.fillStyle = s.color;
    const w = lw(s) * k;

    if (s.t === 'pen' || s.t === 'hl') {
      if (s.t === 'hl') {
        ctx.globalAlpha = 0.38;
        ctx.lineWidth = w * 4.5;
        ctx.lineCap = 'butt';
      } else {
        ctx.lineWidth = w;
      }
      ctx.beginPath();
      s.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x * k, y * k) : ctx.moveTo(x * k, y * k)));
      if (s.pts.length === 1) ctx.lineTo(s.pts[0][0] * k + 0.01, s.pts[0][1] * k);
      ctx.stroke();
    } else if (s.t === 'arrow') {
      const [x0, y0, x1, y1] = [s.x0 * k, s.y0 * k, s.x1 * k, s.y1 * k];
      const ang = Math.atan2(y1 - y0, x1 - x0);
      const head = Math.max(12 * k * unit(), w * 4);
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1 - Math.cos(ang) * head * 0.6, y1 - Math.sin(ang) * head * 0.6);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x1 - head * Math.cos(ang - 0.42), y1 - head * Math.sin(ang - 0.42));
      ctx.lineTo(x1 - head * Math.cos(ang + 0.42), y1 - head * Math.sin(ang + 0.42));
      ctx.closePath();
      ctx.fill();
    } else if (s.t === 'rect') {
      ctx.lineWidth = w;
      ctx.lineJoin = 'miter';
      ctx.strokeRect(Math.min(s.x0, s.x1) * k, Math.min(s.y0, s.y1) * k, Math.abs(s.x1 - s.x0) * k, Math.abs(s.y1 - s.y0) * k);
    } else if (s.t === 'ellipse') {
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.ellipse(((s.x0 + s.x1) / 2) * k, ((s.y0 + s.y1) / 2) * k, (Math.abs(s.x1 - s.x0) / 2) * k, (Math.abs(s.y1 - s.y0) / 2) * k, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (s.t === 'text') {
      const fs = s.fs * k;
      ctx.font = `600 ${fs}px ${FONT}`;
      ctx.textBaseline = 'top';
      const lines = s.text.split('\n');
      lines.forEach((ln, i) => {
        // পাতলা বর্ডার, যাতে যেকোনো ব্যাকগ্রাউন্ডে পড়া যায়
        ctx.lineWidth = Math.max(2, fs / 9);
        ctx.strokeStyle = s.color === '#ffffff' ? 'rgba(0,0,0,.65)' : 'rgba(255,255,255,.85)';
        ctx.strokeText(ln, s.x * k, s.y * k + i * fs * 1.2);
        ctx.fillText(ln, s.x * k, s.y * k + i * fs * 1.2);
      });
    } else if (s.t === 'num') {
      const rad = Math.max(11, 7 + s.size * 2.2) * unit() * k;
      ctx.beginPath();
      ctx.arc(s.x * k, s.y * k, rad, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = Math.max(1.5, rad / 9);
      ctx.strokeStyle = '#fff';
      ctx.stroke();
      ctx.fillStyle = s.color === '#ffffff' || s.color === '#fbbc04' ? '#202124' : '#fff';
      ctx.font = `700 ${rad * 1.15}px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(s.n), s.x * k, s.y * k + rad * 0.05);
    } else if (s.t === 'blur') {
      const x = Math.round(Math.min(s.x0, s.x1));
      const y = Math.round(Math.min(s.y0, s.y1));
      const w2 = Math.round(Math.abs(s.x1 - s.x0));
      const h2 = Math.round(Math.abs(s.y1 - s.y0));
      if (w2 > 1 && h2 > 1) {
        const bs = Math.max(6, Math.round(10 * unit()));
        const tw = Math.max(1, Math.round(w2 / bs));
        const th = Math.max(1, Math.round(h2 / bs));
        const tmp = mk('canvas');
        tmp.width = tw;
        tmp.height = th;
        const tctx = tmp.getContext('2d');
        tctx.imageSmoothingEnabled = true;
        tctx.drawImage(base, x, y, w2, h2, 0, 0, tw, th);
        ctx.imageSmoothingEnabled = false; // মোজাইক
        ctx.drawImage(tmp, 0, 0, tw, th, x * k, y * k, w2 * k, h2 * k);
      }
    }
    ctx.restore();
  }

  function render(ctx, k, withDraft) {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(base, 0, 0, base.width * k, base.height * k);
    for (const s of shapes) drawShape(ctx, s, k);
    if (withDraft && draft) drawShape(ctx, draft, k);
  }

  function paint() {
    if (!base) return;
    render(canvas.getContext('2d'), 1, true);
    syncHist();
  }

  // ---- মাউস → ক্যানভাস স্থানাঙ্ক
  function pos(e) {
    const r = canvas.getBoundingClientRect();
    return [
      clamp(((e.clientX - r.left) / r.width) * canvas.width, 0, canvas.width),
      clamp(((e.clientY - r.top) / r.height) * canvas.height, 0, canvas.height),
    ];
  }

  // ---- লেখা (text tool)
  function openText(x, y) {
    commitText();
    const r = canvas.getBoundingClientRect();
    const fs = Math.round((12 + size * 4) * unit());
    const disp = (fs * r.width) / canvas.width;
    textEl = mk('textarea', 'txt');
    textEl.rows = 1;
    textEl.spellcheck = false;
    textEl.style.cssText = `left:${(x / canvas.width) * r.width}px;top:${(y / canvas.height) * r.height}px;font-size:${disp}px;color:${color};font-weight:600;resize:none;overflow:hidden;`;
    textEl.dataset.x = x;
    textEl.dataset.y = y;
    textEl.dataset.fs = fs;
    textEl.dataset.color = color;
    textEl.addEventListener('input', () => {
      textEl.style.height = 'auto';
      textEl.style.height = textEl.scrollHeight + 'px';
      textEl.style.width = Math.max(60, textEl.scrollWidth) + 'px';
    });
    textEl.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Escape') { e.preventDefault(); textEl.remove(); textEl = null; }
      else if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitText(); }
    });
    wrap.appendChild(textEl);
    setTimeout(() => textEl && textEl.focus(), 0);
  }
  function commitText() {
    if (!textEl) return;
    const el = textEl;
    textEl = null;
    const text = el.value.replace(/\s+$/g, '');
    el.remove();
    if (!text) return;
    shapes.push({ t: 'text', text, x: +el.dataset.x, y: +el.dataset.y, fs: +el.dataset.fs, color: el.dataset.color });
    redo = [];
    paint();
  }

  // ---- আঁকার ইভেন্ট
  canvas.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const [x, y] = pos(e);
    if (tool === 'text') {
      if (textEl) { commitText(); return; }
      openText(x, y);
      return;
    }
    commitText();
    try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
    if (tool === 'num') {
      shapes.push({ t: 'num', x, y, n: numCount++, color, size });
      redo = [];
      paint();
      return;
    }
    if (tool === 'pen' || tool === 'hl') draft = { t: tool, pts: [[x, y]], color, size };
    else draft = { t: tool, x0: x, y0: y, x1: x, y1: y, color, size };
    paint();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!draft) return;
    const [x, y] = pos(e);
    if (draft.pts) {
      const last = draft.pts[draft.pts.length - 1];
      if (Math.hypot(x - last[0], y - last[1]) > 0.8) draft.pts.push([x, y]);
    } else if (e.shiftKey && (draft.t === 'rect' || draft.t === 'ellipse')) {
      const d = Math.max(Math.abs(x - draft.x0), Math.abs(y - draft.y0));
      draft.x1 = draft.x0 + Math.sign(x - draft.x0 || 1) * d;
      draft.y1 = draft.y0 + Math.sign(y - draft.y0 || 1) * d;
    } else {
      draft.x1 = x;
      draft.y1 = y;
    }
    paint();
  });
  const endDraw = (e) => {
    if (!draft) return;
    try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}
    const d = draft;
    draft = null;
    const tiny = d.pts ? false : Math.hypot(d.x1 - d.x0, d.y1 - d.y0) < 3;
    if (!tiny) {
      shapes.push(d);
      redo = [];
    }
    paint();
  };
  canvas.addEventListener('pointerup', endDraw);
  canvas.addEventListener('pointercancel', endDraw);

  // ---- আনডু / রিডু
  function undo() {
    commitText();
    if (!shapes.length) return;
    const s = shapes.pop();
    redo.push(s);
    if (s.t === 'num') numCount = Math.max(1, s.n);
    paint();
  }
  function redoIt() {
    if (!redo.length) return;
    const s = redo.pop();
    shapes.push(s);
    if (s.t === 'num') numCount = s.n + 1;
    paint();
  }
  undoBtn.addEventListener('click', undo);
  redoBtn.addEventListener('click', redoIt);
  clearBtn.addEventListener('click', () => {
    commitText();
    shapes = [];
    redo = [];
    numCount = 1;
    paint();
  });

  // ---------------------------------------------- Copy / Save (HD এক্সপোর্ট)

  function exportCanvas() {
    commitText();
    let k = +scaleSel.value || 1;
    const px = base.width * base.height;
    if (px * k * k > MAX_PIXELS) k = Math.max(1, Math.floor(Math.sqrt(MAX_PIXELS / px) * 100) / 100);
    const c = mk('canvas');
    c.width = Math.round(base.width * k);
    c.height = Math.round(base.height * k);
    render(c.getContext('2d'), k, false);
    return c;
  }
  const toBlob = (c) => new Promise((res) => c.toBlob(res, 'image/png'));

  async function doCopy() {
    if (!base) return;
    flushHist();
    try {
      const blob = await toBlob(exportCanvas());
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      flash(copyBtn, MSG.copied, 'Copy');
    } catch (_) {
      flash(copyBtn, MSG.copyFail, 'Copy');
    }
  }
  async function doSave() {
    if (!base) return;
    flushHist();
    const c = exportCanvas();
    const blob = await toBlob(c);
    if (!blob) return;
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    const name = `screenshot-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}.png`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.style.display = 'none';
    document.documentElement.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    flash(saveBtn, MSG.saved, 'Save PNG');
    say(`${name} · ${c.width} × ${c.height}px`);
  }
  function flash(b, t, back) {
    b.textContent = t;
    setTimeout(() => { b.textContent = back; }, 1600);
  }

  // ---------------------------------------------- ছবি থেকে লেখা কপি (OCR)

  const OCR_ERR = {
    setup: 'The image-reading files are not installed. See "Preparing image translation" in the README (run node setup-ocr.js), then reload the extension',
    empty: 'No text was found in this picture. Retake a smaller area right over the text and try again',
    fail: 'Could not read text from the picture, please try again',
  };

  async function doOcr() {
    if (!base || ocrBusy) return;
    commitText();
    const my = ++ocrRun;
    ocrBusy = true;
    textBtn.disabled = true;
    ocrBox.style.display = 'none';
    say('Reading text from the picture… (the first time takes a bit longer)');
    let res;
    try {
      // মার্ক ছাড়া মূল ছবি পাঠাই, যাতে আঁকা দাগ পড়ায় বাধা না দেয়
      res = await chrome.runtime.sendMessage({ type: 'bvt-shot-ocr', dataUrl: base.toDataURL('image/png'), w: base.width, h: base.height });
    } catch (_) {
      res = { error: 'fail' };
    }
    if (my !== ocrRun) return; // এর মধ্যে এডিটর বন্ধ বা নতুন ছবি
    ocrBusy = false;
    textBtn.disabled = false;
    if (!res || res.error) {
      say((OCR_ERR[res && res.error] || OCR_ERR.fail) + (res && res.detail ? ' (' + res.detail + ')' : ''));
      return;
    }
    const text = String(res.text || '')
      .normalize('NFC')
      .replace(/\r/g, '')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    if (!/\p{L}|\p{N}/u.test(text)) {
      say(OCR_ERR.empty);
      return;
    }
    ocrArea.value = text;
    ocrBox.style.display = 'block';
    say('Text read from the picture · mistakes come from OCR limits, so check before using');
    ocrArea.focus();
    ocrArea.select();
  }

  async function copyOcr() {
    const t = ocrArea.value;
    if (!t) return;
    try {
      await navigator.clipboard.writeText(t);
    } catch (_) {
      try { ocrArea.select(); document.execCommand('copy'); } catch (__) { flash(ocrCopy, MSG.copyFail, 'Copy text'); return; }
    }
    flash(ocrCopy, MSG.copied, 'Copy text');
  }

  textBtn.addEventListener('click', doOcr);
  ocrCopy.addEventListener('click', copyOcr);
  ocrHide.addEventListener('click', () => { ocrBox.style.display = 'none'; });
  ocrArea.addEventListener('keydown', (e) => e.stopPropagation());

  copyBtn.addEventListener('click', doCopy);
  saveBtn.addEventListener('click', doSave);
  closeBtn.addEventListener('click', closeEditor);
  retakeBtn.addEventListener('click', () => startPicking());

  // ------------------------------------------- ছবি ডিকোড (পাতার CSP এড়িয়ে)

  async function bmpFromDataUrl(u) {
    const comma = u.indexOf(',');
    const mime = u.slice(5, u.indexOf(';')) || 'image/png';
    const bin = atob(u.slice(comma + 1));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return createImageBitmap(new Blob([bytes], { type: mime }));
  }

  const send = (m) => {
    try {
      return chrome.runtime.sendMessage(m).catch(() => null);
    } catch (_) {
      return Promise.resolve(null);
    }
  };
  const queue = (fn) => { hQueue = hQueue.then(fn).catch(() => {}); };
  const fmtMB = (b) => (b >= 1e9 ? (b / 1e9).toFixed(2) + ' GB' : (b / 1e6).toFixed(1) + ' MB');

  // ------------------------------------------- হিস্ট্রিতে জমানো (ব্রাউজারের ভেতরে)

  // থাম্বনেইল: মার্কসহ, চওড়া ৩২০px, বেশি লম্বা হলে ওপরের অংশ
  function makeThumb() {
    const k = Math.min(1, 320 / base.width);
    const c = mk('canvas');
    c.width = Math.max(1, Math.round(base.width * k));
    c.height = Math.max(1, Math.min(240, Math.round(base.height * k)));
    render(c.getContext('2d'), k, false);
    return c.toDataURL('image/jpeg', 0.72);
  }

  function histAdd(kind) {
    curId = null;
    lastSig = '';
    if (!histOn || !base) return;
    const id = 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    curId = id;
    lastSig = JSON.stringify([[], 1]);
    setTimeout(() => {
      if (!base || curId !== id) return;
      const rec = {
        id,
        ts: Date.now(),
        w: base.width,
        h: base.height,
        kind,
        host: location.hostname,
        title: (document.title || '').slice(0, 120),
        png: base.toDataURL('image/png'),
        thumb: makeThumb(),
      };
      queue(async () => {
        const res = await send({ type: 'bvt-hist-add', rec });
        if (!res || !res.ok) {
          if (curId === id) curId = null;
          say('Could not keep this one in history' + (res && res.error ? ' (' + res.error + ')' : '') + ' · you can still copy or save it');
        }
      });
    }, 0);
  }

  // মার্ক বদলালে (থেমে ১.২ সেকেন্ড পর), বন্ধ করলে, Copy/Save করলে হিস্ট্রির মার্ক হালনাগাদ
  function markDirty() {
    if (!curId) return;
    clearTimeout(hTimer);
    hTimer = setTimeout(flushHist, 1200);
  }
  function flushHist() {
    clearTimeout(hTimer);
    if (!curId || !base) return;
    const sig = JSON.stringify([shapes, numCount]);
    if (sig === lastSig) return;
    lastSig = sig;
    const msg = { type: 'bvt-hist-update', id: curId, shapes: JSON.parse(JSON.stringify(shapes)), numCount, thumb: makeThumb() };
    queue(() => send(msg));
  }

  // ------------------------------------------- হিস্ট্রি প্যানেল

  function histEmpty(text) {
    const d = mk('div', 'hempty');
    d.textContent = text;
    return d;
  }

  function closeHistory() {
    histOpen = false;
    hist.style.display = 'none';
    hGrid.textContent = '';
  }

  async function openHistory() {
    if (busy || fullRun) return;
    if (picking) stopPicking();
    commitText();
    flushHist();
    histOpen = true;
    hist.style.display = 'flex';
    hStat.textContent = 'Loading…';
    hGrid.textContent = '';
    hClear.disabled = true;
    await hQueue; // আগের জমানো শেষ হোক, যাতে সবচেয়ে নতুনটাও তালিকায় আসে
    const res = await send({ type: 'bvt-hist-list' });
    if (!histOpen) return;
    renderHistory(res && res.ok ? res.items : null);
  }

  async function paintThumb(canvas2, dataUrl) {
    try {
      const bmp = await bmpFromDataUrl(dataUrl);
      const ctx = canvas2.getContext('2d');
      ctx.fillStyle = '#111214';
      ctx.fillRect(0, 0, canvas2.width, canvas2.height);
      const k = canvas2.width / bmp.width;
      ctx.drawImage(bmp, 0, 0, canvas2.width, Math.round(bmp.height * k));
    } catch (_) {}
  }

  function renderHistory(items) {
    hGrid.textContent = '';
    if (!items) {
      hStat.textContent = '';
      hGrid.appendChild(histEmpty('Could not read the history. Reload this page and try again.'));
      return;
    }
    hClear.disabled = !items.length;
    hStat.textContent = items.length ? `${items.length} saved · ${fmtMB(items.reduce((a, i) => a + (i.size || 0), 0))}` : '';
    if (!items.length) {
      hGrid.appendChild(histEmpty(histOn
        ? 'No screenshots saved yet. Take one (Alt + S) and it will appear here.'
        : 'History is turned off. Turn on "Keep screenshot history" in the extension popup.'));
      return;
    }
    for (const it of items) {
      const card2 = mk('div', 'hitem');
      card2.title = 'Open and mark up';
      const cv = mk('canvas');
      cv.width = 380;
      cv.height = 240;
      paintThumb(cv, it.thumb);
      const meta = mk('div', 'hmeta');
      const when = mk('b');
      when.textContent = new Date(it.ts).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
      meta.append(when, document.createElement('br'), document.createTextNode(`${it.w} × ${it.h}${it.host ? ' · ' + it.host : ''}`));
      card2.append(cv, meta);
      const tags = [];
      if (it.kind === 'full') tags.push('📜 Full page');
      if (it.marks) tags.push('✏️ ' + it.marks);
      if (tags.length) {
        const bd = mk('span', 'hbadge');
        bd.textContent = tags.join(' · ');
        card2.appendChild(bd);
      }
      const del = btn('hdel', '✕', 'Delete this screenshot');
      del.addEventListener('click', async (e) => {
        e.stopPropagation();
        await send({ type: 'bvt-hist-delete', id: it.id });
        if (it.id === curId) curId = null;
        const r2 = await send({ type: 'bvt-hist-list' });
        if (histOpen) renderHistory(r2 && r2.ok ? r2.items : null);
      });
      card2.appendChild(del);
      card2.addEventListener('click', () => openRec(it.id));
      hGrid.appendChild(card2);
    }
  }

  // হিস্ট্রি থেকে একটা ছবি আবার এডিটরে খোলা (মার্কসহ, আবার বদলানো যায়)
  async function openRec(id) {
    hStat.textContent = 'Opening…';
    const res = await send({ type: 'bvt-hist-get', id });
    if (!res || !res.ok || !res.rec) {
      hStat.textContent = 'Could not open that screenshot.';
      return;
    }
    const rec = res.rec;
    let bmp;
    try {
      bmp = await bmpFromDataUrl(rec.png);
    } catch (_) {
      hStat.textContent = 'Could not open that screenshot.';
      return;
    }
    closeHistory();
    closeEditor();
    base = mk('canvas');
    base.width = bmp.width;
    base.height = bmp.height;
    base.getContext('2d').drawImage(bmp, 0, 0);
    shotKind = rec.kind || 'area';
    curId = rec.id;
    const restored = { shapes: rec.shapes || [], numCount: rec.numCount || 1 };
    lastSig = JSON.stringify([restored.shapes, restored.numCount]);
    openEditor(restored);
    say(`${base.width} × ${base.height}px · opened from history${restored.shapes.length ? ' with ' + restored.shapes.length + ' mark(s)' : ''}`);
  }

  hClose.addEventListener('click', closeHistory);
  hist.addEventListener('mousedown', (e) => e.stopPropagation());
  hClear.addEventListener('click', async () => {
    if (!confirm('Delete ALL saved screenshots from this browser?')) return;
    await send({ type: 'bvt-hist-clear' });
    curId = null;
    renderHistory([]);
  });
  histBtn.addEventListener('click', openHistory);
  pickHist.addEventListener('click', openHistory);

  // ------------------------------------------- পুরো স্ক্রল-করা পাতার স্ক্রিনশট
  // পাতা ধাপে ধাপে স্ক্রল করে প্রতি ধাপে দেখা অংশের ছবি তোলা হয়, তারপর জোড়া লাগিয়ে একটাই লম্বা ছবি।
  // প্রথম ধাপের পর ফিক্সড/স্টিকি হেডার-ফুটার লুকানো হয়, যাতে প্রতি ধাপে একই হেডার না আসে।

  const FULL_GAP = 600; // captureVisibleTab-এর সীমা: সেকেন্ডে প্রায় ২টি
  const FULL_MAX_PX = 32000; // ক্যানভাসের নিরাপদ সর্বোচ্চ উচ্চতা (ডিভাইস পিক্সেল)
  const FULL_MAX_AREA = 250e6; // ক্যানভাসের সর্বোচ্চ এলাকা (পিক্সেল)
  const FULL_MAX_FRAMES = 90;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function findScroller() {
    const root = document.scrollingElement || document.documentElement;
    if (root.scrollHeight > window.innerHeight + 4) return { el: root, isRoot: true };
    // পাতা নিজে স্ক্রল না হলে (অ্যাপ-ধরনের সাইট) সবচেয়ে বড় ভেতরের স্ক্রল-অংশ খুঁজি
    let best = null;
    let bestArea = 0;
    for (const el of document.querySelectorAll('body *')) {
      if (el.scrollHeight <= el.clientHeight + 4) continue;
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w < 200 || h < 200) continue;
      const oy = getComputedStyle(el).overflowY;
      if (oy !== 'auto' && oy !== 'scroll' && oy !== 'overlay') continue;
      const r = el.getBoundingClientRect();
      if (r.top < -2 || r.bottom > window.innerHeight + 2) continue;
      if (w * h > bestArea) {
        best = el;
        bestArea = w * h;
      }
    }
    return best ? { el: best, isRoot: false } : { el: root, isRoot: true };
  }

  function hideFixed(scrollEl) {
    const list = [];
    for (const el of document.querySelectorAll('body *')) {
      if (el.localName.startsWith('bvt-')) continue; // নিজেদের UI আগেই লুকানো
      if (el === scrollEl || el.contains(scrollEl)) continue; // স্ক্রল-অংশ বা তার মোড়ক লুকানো যাবে না
      const pos = getComputedStyle(el).position;
      if (pos !== 'fixed' && pos !== 'sticky') continue;
      list.push([el, el.style.getPropertyValue('visibility'), el.style.getPropertyPriority('visibility')]);
      el.style.setProperty('visibility', 'hidden', 'important');
    }
    return list;
  }

  async function fullPage() {
    if (busy || fullRun) return;
    stopPicking();
    closeHistory();
    closeEditor();
    busy = true;
    fullRun = true;
    fullCancel = false;

    const sc = findScroller();
    const el = sc.el;
    const getTop = () => (sc.isRoot ? window.scrollY : el.scrollTop);
    const setTop = (y) => { if (sc.isRoot) window.scrollTo(window.scrollX, y); else el.scrollTop = y; };
    const origTop = getTop();

    const st = document.createElement('style');
    st.textContent = '*{scroll-behavior:auto !important;scrollbar-width:none !important}*::-webkit-scrollbar{display:none !important}';
    document.documentElement.appendChild(st);

    let fixedHidden = [];
    let out = null;
    let outW = 0;
    let sx = 1;
    let sy = 1;
    let lastCap = 0;
    let truncated = false;
    let finished = false;

    const finishUp = () => {
      setTop(origTop);
      st.remove();
      for (const [e, v, p] of fixedHidden) {
        if (v) e.style.setProperty('visibility', v, p);
        else e.style.removeProperty('visibility');
      }
      prog.style.display = 'none';
      fullRun = false;
      busy = false;
    };

    // একটি ধাপের ছবি (নিজেদের UI লুকিয়ে); সীমা ছাড়ালে একবার আবার চেষ্টা
    const grab = async () => {
      for (let attempt = 0; attempt < 2; attempt++) {
        const wait = FULL_GAP - (Date.now() - lastCap);
        if (wait > 0) await sleep(wait);
        hideForCapture();
        await frames();
        let res;
        try {
          res = await chrome.runtime.sendMessage({ type: 'bvt-shot-capture' });
        } catch (_) {
          res = null;
        }
        lastCap = Date.now();
        restoreUI();
        if (res && res.dataUrl) return bmpFromDataUrl(res.dataUrl);
        await sleep(900);
      }
      return null;
    };

    try {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      let region;
      if (sc.isRoot) region = { l: 0, t: 0, w: vw, h: vh };
      else region = { l: el.getBoundingClientRect().left + el.clientLeft, t: el.getBoundingClientRect().top + el.clientTop, w: el.clientWidth, h: el.clientHeight };
      const viewH = region.h;

      setTop(0);
      progTxt.textContent = 'Capturing the full page… · Esc to cancel';
      prog.style.display = 'flex';
      await sleep(300);

      let total = el.scrollHeight;
      let maxTotal = Infinity;
      let y = 0;
      let n = 0;
      let prevTop = -1;

      for (;;) {
        n++;
        setTop(y);
        await sleep(n === 1 ? 60 : 280); // নতুন লোড হওয়া ছবি/লেখা আসার সময়
        if (fullCancel) break;
        const actual = getTop();
        if (n > 1 && actual <= prevTop) break; // আর স্ক্রল হচ্ছে না
        prevTop = actual;

        const frame = await grab();
        if (!frame) throw new Error('capture');
        if (fullCancel) break;

        if (!out) {
          sx = frame.width / vw;
          sy = frame.height / vh;
          outW = Math.max(1, Math.round(region.w * sx));
          maxTotal = Math.floor(Math.min(FULL_MAX_PX, FULL_MAX_AREA / outW) / sy);
        }
        // লেজি-লোডে পাতা লম্বা হলে মোট উচ্চতা বাড়ে
        total = Math.max(total, el.scrollHeight);
        if (total > maxTotal) { total = maxTotal; truncated = true; }
        const needH = Math.max(1, Math.round(total * sy));
        if (!out) {
          out = mk('canvas');
          out.width = outW;
          out.height = needH;
        } else if (needH > out.height) {
          const bigger = mk('canvas');
          bigger.width = out.width;
          bigger.height = needH;
          bigger.getContext('2d').drawImage(out, 0, 0);
          out = bigger;
        }

        const rx = Math.max(0, Math.round(region.l * sx));
        const ry = Math.max(0, Math.round(region.t * sy));
        const cw = Math.min(frame.width - rx, outW);
        const ch = Math.min(frame.height - ry, Math.round(region.h * sy));
        out.getContext('2d').drawImage(frame, rx, ry, cw, ch, 0, Math.round(actual * sy), cw, ch);
        if (frame.close) frame.close();

        if (n === 1) fixedHidden = hideFixed(el); // প্রথম ধাপের পর ফিক্সড/স্টিকি লুকাই

        const bottom = actual + viewH;
        progTxt.textContent = `Capturing the full page… ${Math.min(99, Math.round((bottom / total) * 100))}% · Esc to cancel`;
        if (bottom >= total - 1) break;
        if (n >= FULL_MAX_FRAMES) { truncated = true; break; }
        y = Math.min(bottom, Math.max(0, total - viewH));
      }

      finished = !fullCancel && !!out;
      if (finished) {
        const finalH = Math.min(out.height, Math.max(1, Math.round(total * sy)));
        if (finalH < out.height) {
          const c = mk('canvas');
          c.width = out.width;
          c.height = finalH;
          c.getContext('2d').drawImage(out, 0, 0);
          out = c;
        }
      }
    } catch (_) {
      finishUp();
      alert(MSG.capture);
      return;
    }

    finishUp();
    if (!finished) return;
    base = out;
    shotKind = 'full';
    openEditor();
    histAdd('full');
    say(`${base.width} × ${base.height}px · full page${truncated ? ' (the page is very long, so only the first part was captured)' : ''}`);
  }

  pickFull.addEventListener('click', fullPage);
  fullBtn.addEventListener('click', fullPage);
  progCancel.addEventListener('click', () => { fullCancel = true; });

  // ----------------------------------------------- কীবোর্ড

  window.addEventListener(
    'keydown',
    (e) => {
      if (fullRun) { // পুরো পাতা তোলার সময় Esc = বাতিল
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          fullCancel = true;
        }
        return;
      }
      if (histOpen) {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          closeHistory();
        }
        return;
      }
      if (picking) {
        const pk = e.key.toLowerCase();
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          stopPicking();
        } else if (e.key === 'Enter') {
          e.preventDefault();
          e.stopPropagation();
          stopPicking();
          capture({ left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight });
        } else if (pk === 'f' && !e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault();
          e.stopPropagation();
          fullPage();
        } else if (pk === 'h' && !e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault();
          e.stopPropagation();
          openHistory();
        }
        return;
      }
      if (!editing) return;
      if (textEl) return; // লেখার সময় নিজের কীবোর্ড হ্যান্ডলার কাজ করে
      if (shadow.activeElement === ocrArea) { // OCR লেখার বক্সে টাইপ/কপি স্বাভাবিক থাকে; Esc দিলে শুধু বক্স থেকে বেরোয়
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          ocrArea.blur();
        }
        return;
      }
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      let handled = true;
      if (e.key === 'Escape') closeEditor();
      else if (mod && k === 'z' && !e.shiftKey) undo();
      else if (mod && (k === 'y' || (k === 'z' && e.shiftKey))) redoIt();
      else if (mod && k === 's') doSave();
      else if (mod && k === 'c') doCopy();
      else if (!mod && !e.altKey && KEYS[k]) setTool(KEYS[k]);
      else handled = false;
      if (handled) {
        e.preventDefault();
        e.stopPropagation();
      }
    },
    true
  );

  // কার্ডের বাইরে (কালো অংশে) ক্লিক করলে কিছু হবে না — ভুলে মার্ক হারানো ঠেকাতে
  ed.addEventListener('mousedown', (e) => e.stopPropagation());

  // ------------------------------------------------------ মেসেজ

  const toggle = () => {
    if (fullRun) fullCancel = true;
    else if (histOpen) closeHistory();
    else if (picking) stopPicking();
    else if (editing) closeEditor();
    else startPicking();
  };

  // Chrome-এর শর্টকাট সীমা ৪টি, তাই Alt+S পাতার ভেতরেই ধরা হয় (Alt+B-র মতো)
  window.addEventListener(
    'keydown',
    (e) => {
      if (e.isTrusted && e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && e.code === 'KeyS') {
        e.preventDefault();
        e.stopPropagation();
        toggle();
      }
    },
    true
  );

  try {
    chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
      if (!msg) return;
      if (msg.type === 'screenshot') {
        toggle();
        sendResponse({ ok: true });
      } else if (msg.type === 'screenshot-full') {
        fullPage();
        sendResponse({ ok: true });
      } else if (msg.type === 'screenshot-history') {
        openHistory();
        sendResponse({ ok: true });
      }
    });
  } catch (_) {
    // এক্সটেনশন রিলোড হলে পাতা রিলোড করলেই ঠিক হবে
  }
})();
