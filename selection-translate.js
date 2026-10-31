/* বাংলা ভয়েস টাইপিং — সিলেক্ট করে অনুবাদ ও English Fix।
 * পাতার লেখা সিলেক্ট করলে আইকন ভাসে অথবা সঙ্গে সঙ্গে অনুবাদ কার্ড দেখায়।
 * Translate ও Fix টুল এখানে চালানো হয়। */
(() => {
  'use strict';

  if (window.top !== window) return;
  if (window.__bvtSelLoaded) return;
  window.__bvtSelLoaded = true;

  const DEFAULTS = { selTranslate: true, selMode: 'icon', targetLang: 'bn' };
  let settings = { ...DEFAULTS };
  const MAX_CHARS = 3000;
  const AI = globalThis.BVT_AI || null;

  const MSG = {
    translating: 'Translating…',
    downloading: 'Downloading the translation model…',
    aiDownloading: 'Downloading the AI model…',
    noApi: 'The translation API is not available on this page. Chrome 138 or newer and an https page are required',
    pair: 'This language pair is not supported in your Chrome',
    needClick: 'Downloading the model needs a click. Press "Try again" below',
    fail: 'Translation failed, please try again',
    copy: 'Copy',
    copied: 'Copied ✓',
    copyFail: 'Could not copy',
    paste: 'Insert into text',
    retry: 'Try again',
    close: 'Close',
    cut: 'Only the first 3000 characters were translated',
    working: 'Working…',
    checking: 'Checking the language…',
    preparing: 'Preparing the on-device model…',
    timeout: 'This is taking too long. The Chrome on-device model may not be ready. Press "Try again"; if it keeps failing, open chrome://on-device-internals to check the model status',
    bnNote: 'Bangla check uses the built-in word list. Please review the highlighted words yourself',
    bnFixed: (n, u) => (n + u === 0 ? 'No mistakes found ✓' : n + ' fixed' + (u ? ', ' + u + ' highlighted, click to choose a suggestion' : '') + ' (click a fixed word to change or undo it)'),
    partial: 'Only the first part of a long text was used',
    viaEn: 'Done through English (this tool does not read Bangla directly), so the wording may change a little',
    aiUnavailable: 'This tool is not available for this language or on this device',
    fixLang: 'Spelling and grammar check works for English text only. Chrome has no Bangla checker yet',
    tooLong: 'The text is too long for the on-device model',
    corrections: (n) => (n === 0 ? 'No mistakes found ✓' : n + (n === 1 ? ' correction' : ' corrections') + ' (click a highlight to undo it)'),
  };

  const TAB_DEFS = [['tr', '🌐 Translate'], ['fix', '✔ Fix']];
  const HAS = { tr: true, fix: true }; // Bangla Fix needs no Chrome API; English Fix reports it itself

  // ---------------------------------------------------------------- UI

  const CSS = `
    * { box-sizing: border-box; }
    .icon, .card { position: fixed; pointer-events: auto; display: none;
      font-family: "Noto Sans Bengali","Siyam Rupali","Nirmala UI","Hind Siliguri",system-ui,sans-serif;
      font-size: 14px; line-height: 1.55; color: #fff; }
    .icon { width: 32px; height: 32px; margin: 0; padding: 0; border: none; border-radius: 50%;
      background: #1a73e8; box-shadow: 0 3px 12px rgba(0,0,0,.35); cursor: pointer;
      font-size: 16px; line-height: 32px; text-align: center; }
    .icon:hover { background: #1765cc; transform: scale(1.08); }
    .card { width: 320px; max-width: calc(100vw - 16px); background: #202124; border-radius: 12px;
      box-shadow: 0 6px 24px rgba(0,0,0,.4); overflow: hidden; }
    .head { display: flex; align-items: center; justify-content: space-between; gap: 8px;
      padding: 8px 8px 6px 12px; background: #2d2e30; font-size: 12.5px; color: #bdc1c6; }
    .x { border: none; background: none; color: inherit; font-size: 18px; line-height: 1; cursor: pointer;
      padding: 2px 6px; border-radius: 6px; }
    .x:hover { background: rgba(255,255,255,.12); color: #fff; }
    .tabs { display: flex; flex-wrap: wrap; gap: 4px; padding: 6px 8px 0; background: #2d2e30; }
    .tab { border: none; border-radius: 8px 8px 0 0; background: transparent; color: #bdc1c6; font: inherit;
      font-size: 12.5px; padding: 4px 9px; cursor: pointer; }
    .tab:hover { background: rgba(255,255,255,.08); color: #fff; }
    .tab.on { background: #202124; color: #fff; }
    .tab[hidden], .chips[hidden] { display: none; }
    .chips { display: flex; flex-wrap: wrap; gap: 6px; padding: 8px 10px 0; }
    .chip { border: 1px solid #5f6368; border-radius: 999px; background: transparent; color: #e8eaed; font: inherit;
      font-size: 12px; padding: 2px 10px; cursor: pointer; }
    .chip:hover { background: rgba(255,255,255,.1); }
    .chip.on { border-color: #8ab4f8; background: rgba(138,180,248,.18); color: #8ab4f8; }
    mark { background: rgba(138,180,248,.28); color: #fff; border-radius: 3px; padding: 0 2px; }
    mark.tg { cursor: pointer; }
    mark.tg:hover { background: rgba(138,180,248,.5); }
    mark.off { background: rgba(242,139,130,.18); color: #f28b82; text-decoration: line-through; }
    .body { max-height: 220px; overflow: auto; padding: 10px 12px; white-space: pre-wrap;
      word-break: break-word; user-select: text; }
    .body.dim { color: #9aa0a6; }
    .body.err { color: #f28b82; }
    .note { padding: 0 12px 6px; font-size: 12px; color: #9aa0a6; }
    .foot { display: flex; gap: 6px; padding: 0 10px 10px; }
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

  const host = document.createElement('bvt-select-translate');
  for (const [k, v] of Object.entries({
    position: 'fixed', top: '0', left: '0', width: '0', height: '0', margin: '0', padding: '0',
    border: 'none', background: 'none', display: 'block', 'z-index': '2147483646',
    'pointer-events': 'none', opacity: '1', visibility: 'visible',
  })) host.style.setProperty(k, v, 'important');

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

  const icon = mk('button', 'icon');
  icon.type = 'button';
  icon.title = 'Translate';
  icon.setAttribute('aria-label', 'Translate');
  icon.textContent = '🌐';

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
  const foot = mk('div', 'foot');
  const copyBtn = mk('button');
  copyBtn.type = 'button';
  copyBtn.textContent = MSG.copy;
  const pasteBtn = mk('button');
  pasteBtn.type = 'button';
  pasteBtn.textContent = MSG.paste;
  const retryBtn = mk('button');
  retryBtn.type = 'button';
  retryBtn.textContent = MSG.retry;
  foot.append(copyBtn, pasteBtn, retryBtn);
  const tabs = mk('div', 'tabs');
  const tabEls = {};
  for (const [id, label] of TAB_DEFS) {
    const b = mk('button', 'tab');
    b.type = 'button';
    b.textContent = label;
    b.dataset.mode = id;
    b.hidden = !HAS[id];
    tabEls[id] = b;
    tabs.appendChild(b);
  }
  // অনুবাদ ছাড়া আর কোনো টুল চালু না থাকলে ট্যাব সারি দেখানোর দরকার নেই
  tabs.style.display = TAB_DEFS.some(([id]) => id !== 'tr' && HAS[id]) ? 'flex' : 'none';
  const chips = mk('div', 'chips');
  chips.hidden = true;
  card.append(head, tabs, chips, body, noteEl, foot);

  shadow.append(icon, card);
  (document.body || document.documentElement).appendChild(host);

  // --------------------------------------------------------- অবস্থা

  let cur = null; // { text, rect, edit, truncated, page }
  let mode = 'tr'; // tr | fix
  let token = 0;
  let result = '';
  let timer = 0;

  const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), Math.max(lo, hi));

  function hideIcon() { icon.style.display = 'none'; }
  function hideCard() { card.style.display = 'none'; }
  function hideAll() {
    token++; // চলমান অনুবাদের ফল ফেলে দেওয়া
    cur = null;
    hideIcon();
    hideCard();
  }

  function showIcon() {
    const r = cur.rect;
    icon.style.left = clamp(r.right + 4, 4, window.innerWidth - 36) + 'px';
    icon.style.top = clamp(r.bottom + 6, 4, window.innerHeight - 36) + 'px';
    icon.style.display = 'block';
  }

  function placeCard() {
    const r = cur.rect;
    card.style.left = clamp(r.left, 8, window.innerWidth - 328) + 'px';
    const below = window.innerHeight - r.bottom;
    const above = r.top;
    if (below < 200 && above > below) {
      card.style.top = 'auto';
      card.style.bottom = Math.max(8, window.innerHeight - r.top + 10) + 'px';
    } else {
      card.style.bottom = 'auto';
      card.style.top = Math.min(r.bottom + 10, Math.max(8, window.innerHeight - 80)) + 'px';
    }
    card.style.display = 'block';
  }

  function paintBar() {
    for (const [id, el] of Object.entries(tabEls)) el.classList.toggle('on', id === mode);
    chips.hidden = true;
    chips.textContent = '';
  }

  function setCard({ label, text, kind, note, ready, retry, parts }) {
    lbl.textContent = label || '';
    body.textContent = '';
    if (parts) {
      // বদলানো অংশ হাইলাইট; ক্লিকে সংশোধন বাতিল/বহাল। innerHTML নয়, তাই পাতার লেখা কখনো কোড হিসেবে চলে না
      const shown = (p) => (p.alts && p.pick >= 0 ? p.alts[p.pick] : typeof p.from === 'string' ? p.from : p.text);
      const draw = () => {
        body.textContent = '';
        for (const p of parts) {
          if (!p.changed) { body.appendChild(document.createTextNode(p.text)); continue; }
          if (!p.alts && typeof p.from === 'string' && p.from !== p.text) { p.alts = [p.text]; p.pick = 0; }
          const m = mk('mark');
          const toggle = !!(p.alts && p.alts.length);
          m.textContent = toggle ? shown(p) : p.text;
          if (p.title) m.title = p.title + (toggle ? '\n(click to change)' : '');
          if (toggle) {
            m.classList.add('tg');
            if (p.pick < 0) m.classList.add('off');
            m.addEventListener('click', () => { p.pick = p.pick + 1 >= p.alts.length ? -1 : p.pick + 1; draw(); });
          }
          body.appendChild(m);
        }
        result = parts.map((p) => (p.changed ? shown(p) : p.text)).join('');
      };
      draw();
    } else {
      body.textContent = text || '';
    }
    body.className = 'body' + (kind ? ' ' + kind : '');
    noteEl.textContent = note || '';
    noteEl.style.display = note ? 'block' : 'none';
    copyBtn.hidden = !ready;
    copyBtn.textContent = MSG.copy;
    pasteBtn.hidden = !(ready && cur && cur.edit && mode !== 'sum');
    retryBtn.hidden = !retry;
  }

  // ------------------------------------------------- সিলেকশন পড়া

  const TEXT_TYPES = new Set(['text', 'search', 'url', 'tel', 'email']);

  function deepActive() {
    let a = document.activeElement;
    while (a && a.shadowRoot && a.shadowRoot.activeElement) a = a.shadowRoot.activeElement;
    return a;
  }

  function readSelection(pt) {
    const a = deepActive();
    if (a instanceof HTMLInputElement && !TEXT_TYPES.has(a.type)) return null; // পাসওয়ার্ড ইত্যাদি বাদ
    if (a instanceof HTMLTextAreaElement || a instanceof HTMLInputElement) {
      const s = a.selectionStart;
      const e = a.selectionEnd;
      if (s == null || s === e) return null;
      const er = a.getBoundingClientRect();
      const rect = pt
        ? { left: pt.x, right: pt.x, top: pt.y, bottom: pt.y }
        : { left: er.left, right: er.left, top: er.bottom, bottom: er.bottom };
      return { text: a.value.slice(s, e), rect, edit: { kind: 'control', el: a, start: s, end: e } };
    }
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) return null;
    const rg = sel.getRangeAt(0);
    const rects = rg.getClientRects();
    const rect = rects.length ? rects[rects.length - 1] : rg.getBoundingClientRect();
    if (!rect || (!rect.width && !rect.height)) return null;
    const anc = rg.commonAncestorContainer;
    let el = anc.nodeType === Node.ELEMENT_NODE ? anc : anc.parentElement;
    let edit = null;
    if (el && el.isContentEditable) {
      while (el.parentElement && el.parentElement.isContentEditable) el = el.parentElement;
      edit = { kind: 'range', root: el, range: rg.cloneRange() };
    }
    return { text: sel.toString(), rect, edit };
  }

  function handle(pt) {
    if (!settings.selTranslate) return hideAll();
    const info = readSelection(pt);
    const keepPage = cur && cur.page; // পুরো পাতার সারাংশ কার্ড ক্লিকে বন্ধ হয় না
    if (!info || !/\p{L}/u.test(info.text)) return keepPage ? undefined : hideAll();
    let text = info.text.trim();
    if (!text) return keepPage ? undefined : hideAll();
    const truncated = text.length > MAX_CHARS;
    if (truncated) text = text.slice(0, MAX_CHARS);
    if (cur && cur.text === text && card.style.display === 'block') return; // একই লেখা, কার্ড খোলা আছে
    token++;
    mode = 'tr';
    cur = { text, rect: info.rect, edit: info.edit, truncated };
    hideCard();
    hideIcon();
    if (settings.selMode === 'instant') openCard('tr');
    else showIcon();
  }

  const isOwn = (e) => e.target === host || (e.target && e.target.tagName === 'BVT-VOICE-TYPING');

  document.addEventListener(
    'mouseup',
    (e) => {
      if (isOwn(e)) return;
      const pt = { x: e.clientX, y: e.clientY };
      clearTimeout(timer);
      timer = setTimeout(() => handle(pt), 30);
    },
    true
  );
  document.addEventListener(
    'keyup',
    (e) => {
      if (isOwn(e)) return;
      if (e.shiftKey || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a')) {
        clearTimeout(timer);
        timer = setTimeout(() => handle(null), 30);
      }
    },
    true
  );
  document.addEventListener('mousedown', (e) => { if (!isOwn(e) && !(cur && cur.page)) hideAll(); }, true);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hideAll(); }, true);
  window.addEventListener('scroll', () => { if (icon.style.display === 'block') hideAll(); }, true);

  // ------------------------------------------------------ অনুবাদ

  let namer = null;
  try { namer = new Intl.DisplayNames(['en'], { type: 'language' }); } catch (_) {}
  const langName = (c) => {
    try { return (namer && namer.of(c)) || c; } catch (_) { return c; }
  };

  // ভাষা চেনার লজিক lib.js-এ (Language Detector, না পেলে লিপি দেখে অনুমান)
  // মডেল না নামলে detectLang ঝুলে থাকতে পারে, তাই সময় পার হলে লিপি দেখে অনুমান
  const guessNow = (text) => (globalThis.BVT.guessLang && globalThis.BVT.guessLang(text)) || 'en';
  const detect = (text, wait) =>
    Promise.race([
      globalThis.BVT.detectLang(text, { download: true }).catch(() => guessNow(text)),
      new Promise((res) => setTimeout(() => res(guessNow(text)), wait || 2500)),
    ]);

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

  const routes = new Map(); // "fr>bn" → [["fr","en"],["en","bn"]]
  async function getRoute(source, target) {
    const key = source + '>' + target;
    if (routes.has(key)) return routes.get(key);
    const route = await globalThis.BVT.planRoute(source, target, (s, t) =>
      window.Translator.availability({ sourceLanguage: s, targetLanguage: t })
    );
    if (route) routes.set(key, route);
    return route;
  }

  async function translateText(t, text) {
    const out = [];
    for (const line of text.split('\n')) {
      const m = line.match(/^(\s*)([\s\S]*?)(\s*)$/);
      out.push(m[2] ? m[1] + (await t.translate(m[2])) + m[3] : line);
    }
    return out.join('\n');
  }

  async function runTranslate(my) {
    const text = cur.text;
    setCard({ label: '🌐', text: MSG.translating, kind: 'dim' });
    try {
      if (!('Translator' in window)) throw new Error('no-api');
      const source = await detect(text);
      let target = settings.targetLang;
      if (source === target) target = target === 'en' ? 'bn' : 'en'; // একই ভাষা হলে বিকল্প
      const route = await getRoute(source, target); // সরাসরি জোড়া না থাকলে English হয়ে
      if (!route) throw new Error('pair-unavailable');
      const label = [source, ...route.map((h) => h[1])].map(langName).join(' → ');
      if (my !== token) return;
      setCard({ label, text: MSG.translating, kind: 'dim' });
      let out = text;
      for (const [s, d] of route) {
        const t = await getTranslator(s, d, (p) => {
          if (my === token) setCard({ label, text: MSG.downloading + ' ' + p + '%', kind: 'dim' });
        });
        out = await translateText(t, out);
        if (my !== token) return;
      }
      result = out;
      setCard({ label, text: out, note: cur.truncated ? MSG.cut : '', ready: true });
    } catch (err) {
      if (my !== token) return;
      const name = err && err.name;
      let msg = MSG.fail;
      let retry = true;
      if (err && err.message === 'no-api') { msg = MSG.noApi; retry = false; }
      else if (err && err.message === 'pair-unavailable') { msg = MSG.pair; retry = false; }
      else if (name === 'NotSupportedError') { msg = MSG.pair; retry = false; }
      else if (name === 'NotAllowedError') msg = MSG.needClick;
      setCard({ label: '🌐', text: msg, kind: 'err', retry });
    }
  }

  const AI_LABEL = { fix: '✔ Spelling & grammar' };

  // সময়-প্রহরী: progress না এলে ms পরে থামায়; progress এলে ঘড়ি আবার শুরু
  function guard(ms) {
    const g = { dead: false, id: 0, p: null, bump: null, stop: null };
    let rej;
    g.p = new Promise((_, r) => { rej = r; });
    g.bump = () => {
      clearTimeout(g.id);
      g.id = setTimeout(() => { g.dead = true; rej(new Error('timeout')); }, ms);
    };
    g.stop = () => clearTimeout(g.id);
    g.bump();
    return g;
  }

  // বাংলা বানান: spell-lib.js-এর শব্দতালিকা দিয়ে ভুল ধরে প্রথম সাজেশন বসায়
  async function fixBangla(text, my, g, say) {
    const S = globalThis.BVTSpell;
    if (!S || !S.ready()) throw new Error('lang-unsupported');
    say(MSG.working);
    const bad = S.findMisspelled(text).slice(0, 40);
    const parts = [];
    let pos = 0;
    let fixed = 0;
    let unknown = 0;
    const nosug = [];
    for (let k = 0; k < bad.length; k++) {
      const b = bad[k];
      if (b.start > pos) parts.push({ text: text.slice(pos, b.start), changed: false });
      const rk = S.suggestRanked ? S.suggestRanked(b.word, 5) : S.suggest(b.word, 5).map((w) => ({ w, d: 1, f: 1 }));
      const sg = rk.map((x) => x.w);
      // এক অক্ষরের তফাতের মধ্যে সবচেয়ে প্রচলিত শব্দটা বসে (ফোনের অটোকারেক্টের মতো); দূরের শব্দ হলে স্পষ্টভাবে এগিয়ে থাকতে হবে
      const top = rk[0];
      const nxt = rk[1];
      const apply = top && (top.d <= 1 || !nxt || top.d < nxt.d || top.f >= nxt.f * 4);
      if (sg.length) {
        parts.push({ text: apply ? top.w : b.word, from: b.word, alts: sg, pick: apply ? 0 : -1, changed: true, title: b.word + ' → ' + sg.join(' / ') });
        if (apply) fixed++; else unknown++;
      } else {
        parts.push({ text: b.word, changed: true, title: b.word + ' — not in the word list, no suggestion' });
        unknown++;
        nosug.push(b.word);
      }
      pos = b.end;
      if (k % 4 === 3) { // পাতা জমে না যাওয়ার জন্য মাঝে মাঝে ছাড়া
        await new Promise((r) => setTimeout(r, 0));
        if (my !== token || g.dead) throw new Error('cancelled');
      }
    }
    if (pos < text.length) parts.push({ text: text.slice(pos), changed: false });
    return { text: parts.map((p) => p.text).join(''), parts, note: MSG.bnFixed(fixed, unknown) + (nosug.length ? '. No suggestion found for: ' + nosug.join(', ') : '') };
  }

  async function runAi(my) {
    const text = cur.text;
    const label = AI_LABEL.fix;
    const say = (t) => { if (my === token) setCard({ label, text: t, kind: 'dim' }); };
    const g = guard(45000);
    say(MSG.checking);
    const run = async () => {
      const detectedLang = await detect(text, 400); // Fix-এ দেরি নয়: ৪০০ms-এ না এলে লিপি দেখে অনুমান
      if (my !== token || g.dead) return null;
      const alive = () => my === token && !g.dead;
      const onProgress = (p) => {
        g.bump();
        say(p < 100 ? MSG.aiDownloading + ' ' + p + '%' : MSG.working);
      };
      if (detectedLang === 'bn') {
        const r = await fixBangla(text, my, g, say);
        return { lang: detectedLang, text: r.text, parts: r.parts, notes: [r.note] };
      }
      say(MSG.preparing);
      g.bump();
      const r = await AI.proofread(text, { lang: detectedLang, alive, onProgress });
      const out = r.text;
      const parts = r.parts;
      const notes = [MSG.corrections(r.count)];
      if (r.truncated || cur.truncated) notes.push(MSG.partial);
      return { lang: detectedLang, text: out, parts, notes };
    };
    try {
      if (!AI) throw new Error('no-api');
      const job = run();
      job.catch(() => {});
      const r = await Promise.race([job, g.p]);
      if (!r || my !== token) return;
      result = r.text;
      setCard({ label: label + ' · ' + langName(r.lang), text: r.text, parts: r.parts, note: r.notes.join('. '), ready: true });
    } catch (err) {
      if (my !== token) return;
      const m = err && err.message;
      const name = err && err.name;
      let msg = MSG.fail;
      let retry = true;
      if (g.dead || m === 'timeout') msg = MSG.timeout;
      else if (m === 'cancelled') return;
      else if (m === 'no-api') { msg = MSG.noApi; retry = false; }
      else if (m === 'unavailable') { msg = MSG.aiUnavailable; retry = false; }
      else if (m === 'lang-unsupported') { msg = MSG.fixLang; retry = false; }
      else if (name === 'NotAllowedError') msg = MSG.needClick;
      else if (name === 'QuotaExceededError') { msg = MSG.tooLong; retry = false; }
      setCard({ label, text: msg, kind: 'err', retry });
    } finally {
      g.stop();
    }
  }

  function startRun() {
    if (!cur) return;
    result = '';
    const my = token;
    paintBar();
    setCard({ label: mode === 'tr' ? '🌐' : AI_LABEL[mode], text: mode === 'tr' ? MSG.translating : MSG.working, kind: 'dim' });
    placeCard();
    if (mode === 'tr') runTranslate(my);
    else runAi(my);
  }

  function openCard(m) {
    if (!cur) return;
    if (m) mode = m;
    hideIcon();
    startRun();
  }

  // ------------------------------------------------------ বাটনের কাজ

  // বাটনে ক্লিকে লেখার ফোকাস/সিলেকশন না হারাতে
  for (const el of [icon, xBtn, copyBtn, pasteBtn, retryBtn]) {
    el.addEventListener('mousedown', (e) => e.preventDefault());
  }

  icon.addEventListener('click', () => openCard('tr'));
  xBtn.addEventListener('click', () => hideAll());
  retryBtn.addEventListener('click', () => {
    if (!cur) return;
    token++;
    startRun();
  });

  // ট্যাব ও চিপে ক্লিকেও সিলেকশন না হারাতে
  card.addEventListener('mousedown', (e) => {
    if (e.target && e.target.closest && e.target.closest('button')) e.preventDefault();
  });
  tabs.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('.tab');
    if (!b || !cur || b.dataset.mode === mode) return;
    mode = b.dataset.mode;
    token++;
    startRun();
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

  pasteBtn.addEventListener('click', () => {
    const e = cur && cur.edit;
    if (!e || !result) return;
    try {
      if (e.kind === 'control') {
        const text = e.el instanceof HTMLInputElement ? result.replace(/\s*\n+\s*/g, ' ') : result;
        e.el.focus({ preventScroll: true });
        e.el.setSelectionRange(e.start, e.end);
        if (!document.execCommand('insertText', false, text)) {
          e.el.setRangeText(text, e.start, e.end, 'end');
          e.el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
        }
      } else {
        e.root.focus({ preventScroll: true });
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(e.range);
        const lines = result.split('\n');
        lines.forEach((line, i) => {
          if (i > 0) document.execCommand('insertParagraph');
          if (line) document.execCommand('insertText', false, line);
        });
      }
    } catch (_) {}
    hideAll();
  });

  // ------------------------------------------------------ সেটিংস

  try {
    chrome.storage.sync.get(DEFAULTS, (s) => {
      settings = { ...DEFAULTS, ...s };
    });
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'sync') return;
      for (const k of Object.keys(changes)) {
        if (k in DEFAULTS) settings[k] = changes[k].newValue;
      }
      if (!settings.selTranslate && !(cur && cur.page)) hideAll();
    });
  } catch (_) {
    // এক্সটেনশন রিলোড হলে পাতা রিলোড করলেই ঠিক হবে
  }
})();
