/* বাংলা ভয়েস টাইপিং — কন্টেন্ট স্ক্রিপ্ট
 * Chrome-এর Web Speech API দিয়ে কথা শুনে ফোকাস করা লেখার ঘরে বাংলা টেক্সট বসায়।
 * Alt+C দিয়ে সিলেক্ট করা লেখা বাংলা ↔ English অনুবাদ করে। */
(() => {
  'use strict';

  if (window.__bvtLoaded) return;
  window.__bvtLoaded = true;

  const BVT = globalThis.BVT;
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

  const DEFAULTS = { lang: 'bn-BD', showButton: true, commands: true, dictionary: '', voiceRerank: true };
  let settings = { ...DEFAULTS };
  let sessionLang = null; // Alt+X / Alt+Z দিয়ে শুরু করলে শুধু এই সেশনের ভাষা
  const activeLang = () => sessionLang || settings.lang;
  const langLabel = (l) => (/^bn/i.test(l) ? 'Bangla' : 'English');

  const MSG = {
    listening: 'Listening… speak now',
    listeningHidden: 'Listening… press the shortcut again to stop',
    noTarget: 'Click a text field first, then turn on the mic',
    unsupported: 'Voice recognition is not available in this browser. Use Google Chrome',
    denied:
      'Microphone permission is denied. Click the icon on the left of the address bar and set Microphone to "Allow" (the site must use https)',
    noMic: 'No microphone found. Check that a mic is connected',
    network: 'No internet connection, so voice typing cannot run',
    lang: 'This language is not supported. Pick a different language from the popup',
    generic: 'Voice typing ran into a problem',
    idle: 'Nothing was heard for 10 seconds, so voice typing was turned off',
    loop: 'Voice typing keeps stopping, so it was halted',
    noTranslator: 'The translation API is not available on this page. Chrome 138 or newer and an https page are required',
    noSelection: 'First select some Bangla or English text inside a text field, then press Alt+C',
    noLetters: 'The selected text has no letters',
    translating: 'Translating…',
    translatingVia: 'Translating… (in two steps, via English)',
    downloading: 'Downloading the translation model…',
    needModel:
      'The translation model has not been downloaded yet. Click the extension icon, press "Prepare translation models", then try again',
    pairUnavailable: 'This language pair is not supported in your Chrome',
    translateFail: 'Translation failed, please try again',
    selChanged: 'The selection changed during translation. Select the text again and retry',
    toEn: 'Converted to English (press Alt+C again to get the Bangla back)',
    toBn: 'Converted to Bangla (press Alt+C again to get the English back)',
    toBnOther: 'Converted to Bangla (press Alt+C again to restore the original)',
  };

  // ---------------------------------------------------------------- UI

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const MIC_PATH =
    'M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z';

  const CSS = `
    .wrap { position: relative; width: 52px; height: 52px; pointer-events: none;
      font-family: "Noto Sans Bengali","Siyam Rupali","Nirmala UI","Hind Siliguri",system-ui,sans-serif;
      font-size: 14px; line-height: 1.5; color: #fff; }
    .bubble { position: absolute; right: 0; bottom: 62px; width: max-content; max-width: 280px; min-width: 120px;
      padding: 8px 12px; border-radius: 12px; background: #202124; color: #fff;
      box-shadow: 0 4px 16px rgba(0,0,0,.3); word-break: break-word; pointer-events: none; }
    .wrap.below .bubble { bottom: auto; top: 62px; }
    .wrap.left .bubble { right: auto; left: 0; }
    .bubble.hidden { display: none; }
    .bubble.error { background: #b3261e; }
    .interim { opacity: .75; }
    .interim:not(:empty) { margin-top: 4px; }
    .mic { position: absolute; inset: 0; width: 52px; height: 52px; margin: 0; padding: 0; border: none;
      border-radius: 50%; background: #1a73e8; color: #fff; cursor: grab; display: grid; place-items: center;
      box-shadow: 0 4px 14px rgba(0,0,0,.35); transition: background .15s, transform .15s;
      pointer-events: auto; touch-action: none; }
    .mic:hover { transform: scale(1.06); }
    .mic.dragging { cursor: grabbing; transform: none; }
    .mic.hiddenBtn { display: none; }
    .mic svg { width: 26px; height: 26px; fill: currentColor; pointer-events: none; }
    .mic.on { background: #d93025; animation: pulse 1.4s infinite; }
    @keyframes pulse {
      0% { box-shadow: 0 0 0 0 rgba(217,48,37,.55); }
      70% { box-shadow: 0 0 0 16px rgba(217,48,37,0); }
      100% { box-shadow: 0 0 0 0 rgba(217,48,37,0); }
    }
  `;

  const mk = (tag, cls) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    return e;
  };

  const host = document.createElement('bvt-voice-typing');
  const force = (el, props) => {
    for (const [k, v] of Object.entries(props)) el.style.setProperty(k, v, 'important');
  };
  force(host, {
    position: 'fixed', right: '20px', bottom: '20px', width: '52px', height: '52px',
    margin: '0', padding: '0', border: 'none', background: 'none', display: 'block',
    'z-index': '2147483647', 'pointer-events': 'none', opacity: '1', visibility: 'visible',
  });

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

  const wrap = mk('div', 'wrap');
  const bubble = mk('div', 'bubble hidden');
  const statusEl = mk('div', 'status');
  const interimEl = mk('div', 'interim');
  bubble.append(statusEl, interimEl);

  const btn = mk('button', 'mic');
  btn.type = 'button';
  btn.title = 'Bangla Voice Typing';
  btn.setAttribute('aria-label', 'Bangla Voice Typing');
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', MIC_PATH);
  svg.appendChild(path);
  btn.appendChild(svg);

  wrap.append(bubble, btn);
  shadow.appendChild(wrap);
  (document.body || document.documentElement).appendChild(host);

  let bubbleTimer = 0;

  function updatePlacement() {
    const r = host.getBoundingClientRect();
    wrap.classList.toggle('below', r.top < 150);
    wrap.classList.toggle('left', r.left < 300);
  }

  function setBubble(opts) {
    const o = opts || {};
    clearTimeout(bubbleTimer);
    if (!o.text && !o.interim) {
      bubble.classList.add('hidden');
      return;
    }
    statusEl.textContent = o.text || '';
    interimEl.textContent = o.interim || '';
    bubble.classList.toggle('error', !!o.error);
    bubble.classList.remove('hidden');
    updatePlacement();
    if (o.autoHide) bubbleTimer = setTimeout(() => bubble.classList.add('hidden'), o.autoHide);
  }

  function listeningText() {
    const base = settings.showButton ? MSG.listening : MSG.listeningHidden;
    return base + ' [' + langLabel(activeLang()) + ']';
  }

  function setUI(on) {
    btn.classList.toggle('on', on);
  }

  // টেনে সরানো (ডান ও নিচ থেকে দূরত্ব ধরে রাখা হয়)
  let drag = null;

  function setPos(right, bottom) {
    const maxR = Math.max(0, window.innerWidth - 52);
    const maxB = Math.max(0, window.innerHeight - 52);
    force(host, {
      right: Math.min(Math.max(0, right), maxR) + 'px',
      bottom: Math.min(Math.max(0, bottom), maxB) + 'px',
    });
    updatePlacement();
  }

  btn.addEventListener('mousedown', (e) => e.preventDefault()); // লেখার ঘরের ফোকাস না হারাতে
  btn.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    const r = host.getBoundingClientRect();
    drag = {
      sx: e.clientX, sy: e.clientY,
      right: window.innerWidth - r.right, bottom: window.innerHeight - r.bottom,
      moved: false,
    };
    try { btn.setPointerCapture(e.pointerId); } catch (_) {}
  });
  btn.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.sx;
    const dy = e.clientY - drag.sy;
    if (!drag.moved && Math.hypot(dx, dy) < 5) return;
    if (!drag.moved) {
      drag.moved = true;
      btn.classList.add('dragging');
    }
    setPos(drag.right - dx, drag.bottom - dy);
  });
  btn.addEventListener('pointerup', (e) => {
    if (!drag) return;
    const moved = drag.moved;
    drag = null;
    btn.classList.remove('dragging');
    try { btn.releasePointerCapture(e.pointerId); } catch (_) {}
    if (moved) savePos();
    else toggle();
  });

  function savePos() {
    try {
      const r = host.getBoundingClientRect();
      chrome.storage.local.set({ bvtPos: { right: window.innerWidth - r.right, bottom: window.innerHeight - r.bottom } });
    } catch (_) {}
  }

  window.addEventListener('resize', () => {
    const r = host.getBoundingClientRect();
    setPos(window.innerWidth - r.right, window.innerHeight - r.bottom);
  });

  // ------------------------------------------------------ লেখার ঘর খোঁজা

  const TEXT_TYPES = new Set(['text', 'search', 'url', 'tel', 'email']);
  let lastTarget = null;

  function editableFrom(node) {
    if (!(node instanceof Element)) return null;
    if (node instanceof HTMLTextAreaElement) return node.disabled || node.readOnly ? null : node;
    if (node instanceof HTMLInputElement) {
      if (!TEXT_TYPES.has(node.type) || node.disabled || node.readOnly) return null;
      return node;
    }
    if (node.isContentEditable) {
      let n = node;
      while (n.parentElement && n.parentElement.isContentEditable) n = n.parentElement;
      return n;
    }
    return null;
  }

  function deepActive() {
    let a = document.activeElement;
    while (a && a.shadowRoot && a.shadowRoot.activeElement) a = a.shadowRoot.activeElement;
    return a;
  }

  function currentTarget() {
    const active = editableFrom(deepActive());
    if (active) return active;
    return lastTarget && lastTarget.isConnected ? lastTarget : null;
  }

  document.addEventListener(
    'focusin',
    (e) => {
      const el = editableFrom(e.composedPath()[0]);
      if (el) lastTarget = el;
    },
    true
  );

  // ----------------------------------------------------- টেক্সট বসানো

  const isTextControl = (el) => el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;

  function prevChar(el) {
    try {
      if (isTextControl(el)) {
        const s = el.selectionStart;
        if (s == null || s <= 0) return '';
        return el.value[s - 1] || '';
      }
      const sel = window.getSelection();
      if (!sel || !sel.rangeCount) return '';
      const rg = sel.getRangeAt(0);
      if (!el.contains(rg.startContainer)) return '';
      if (rg.startContainer.nodeType === Node.TEXT_NODE && rg.startOffset > 0) {
        return rg.startContainer.data[rg.startOffset - 1];
      }
      const r2 = document.createRange();
      r2.selectNodeContents(el);
      r2.setEnd(rg.startContainer, rg.startOffset);
      const t = r2.toString();
      return t ? t[t.length - 1] : '';
    } catch (_) {
      return '';
    }
  }

  function fallbackInsert(el, text) {
    if (isTextControl(el)) {
      try {
        const start = el.selectionStart == null ? el.value.length : el.selectionStart;
        const end = el.selectionEnd == null ? el.value.length : el.selectionEnd;
        el.setRangeText(text, start, end, 'end'); // React-এর ক্ষেত্রেও কাজ করে
      } catch (_) {
        el.value += text;
      }
    } else {
      const sel = window.getSelection();
      if (!sel || !sel.rangeCount) return;
      const rg = sel.getRangeAt(0);
      rg.deleteContents();
      const node = document.createTextNode(text);
      rg.insertNode(node);
      rg.setStartAfter(node);
      rg.collapse(true);
      sel.removeAllRanges();
      sel.addRange(rg);
    }
    el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
  }

  function insertText(el, raw) {
    if (!raw || !el.isConnected) return;
    const active = deepActive();
    if (active !== el && !(active && el.contains(active))) el.focus({ preventScroll: true });

    let text = BVT.withLeadingSpace(prevChar(el), raw);
    if (el instanceof HTMLInputElement) text = text.replace(/\s*\n+\s*/g, ' '); // এক লাইনের ঘরে নতুন লাইন চলে না
    if (!text) return;

    if (isTextControl(el)) {
      if (!document.execCommand('insertText', false, text)) fallbackInsert(el, text);
      return;
    }

    // contenteditable: প্রতিটি নতুন লাইন Enter চাপার মতো
    const lines = text.split('\n');
    let ok = true;
    lines.forEach((line, i) => {
      if (i > 0) ok = document.execCommand('insertParagraph') && ok;
      if (line) ok = document.execCommand('insertText', false, line) && ok;
    });
    if (!ok && lines.length === 1) fallbackInsert(el, text);
  }

  function onFinal(raw) {
    const text = BVT.process(raw, {
      commands: settings.commands,
      dictionary: settings.dictionary,
      lang: activeLang(),
    });
    if (!text) return;
    const target = currentTarget();
    if (!target) {
      setBubble({ text: MSG.noTarget, error: true, autoHide: 3500 });
      return;
    }
    insertText(target, text);
  }

  // ------------------------------------------------ ভয়েস রিকগনিশন

  let rec = null;
  let wantListening = false;
  let restartLog = [];
  let lastActivity = 0;

  // কোনো কথা না বললে ১০ সেকেন্ড পরে নিজে থেকে বন্ধ
  const IDLE_MS = 10000;
  let idleTimer = 0;

  function clearIdle() {
    clearTimeout(idleTimer);
    idleTimer = 0;
  }

  function resetIdle() {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      idleTimer = 0;
      if (!wantListening) return;
      wantListening = false;
      const r = rec;
      rec = null;
      if (r) {
        try { r.abort(); } catch (_) {}
      }
      setUI(false);
      setBubble({ text: MSG.idle, autoHide: 5000 });
    }, IDLE_MS);
  }

  function fail(message) {
    clearIdle();
    wantListening = false;
    const r = rec;
    rec = null;
    if (r) {
      try { r.abort(); } catch (_) {}
    }
    setUI(false);
    setBubble({ text: message, error: true, autoHide: 8000 });
  }

  // শব্দ সংশোধনের তালিকা বদলালে তবেই আবার পার্স করা হয়
  let dictCache = { src: null, entries: [] };
  function dictEntries() {
    if (dictCache.src !== settings.dictionary) {
      dictCache = { src: settings.dictionary, entries: BVT.parseDictionary(settings.dictionary || '') };
    }
    return dictCache.entries;
  }

  // ইঞ্জিনের দেওয়া বিকল্পগুলো থেকে তালিকার সঙ্গে সবচেয়ে মেলেটি বাছা
  // আগের বসানো লেখার শেষ ≤২ বাংলা শব্দ: পরের বিকল্প বাছাইয়ে bigram/trigram কনটেক্সট (৮ সেকেন্ডের বেশি পুরনো হলে বাদ)
  let voiceCtx = { words: [], t: 0 };
  function tailWords(text) {
    const seg = String(text).split(/[।?!.\n]/).pop();
    const out = [];
    const toks = seg.split(/[\s,;:"'()\-]+/).filter(Boolean);
    for (let i = toks.length - 1; i >= 0 && out.length < 2; i--) {
      if (!/^[\u0980-\u09FF]+$/.test(toks[i])) break;
      out.unshift(toks[i].normalize('NFC'));
    }
    return out;
  }

  function pickAlt(res) {
    const alts = [];
    for (let k = 0; k < res.length; k++) alts.push({ transcript: res[k].transcript, confidence: res[k].confidence });
    const rerank = settings.voiceRerank !== false && /^bn/i.test(activeLang());
    const ctx = rerank && Date.now() - voiceCtx.t < 8000 ? voiceCtx.words : [];
    const text = BVT.pickBest(alts, dictEntries(), { rerank, ctx });
    voiceCtx = { words: tailWords(text), t: Date.now() };
    return text;
  }

  function spawnRecognition() {
    const r = new SR();
    r.lang = activeLang();
    r.continuous = true;
    r.interimResults = true;
    r.maxAlternatives = 5;

    r.onresult = (e) => {
      lastActivity = Date.now();
      resetIdle();
      let finalText = '';
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) finalText += pickAlt(res);
        else interim += res[0].transcript;
      }
      if (finalText) onFinal(finalText);
      if (wantListening) setBubble({ text: listeningText(), interim });
    };

    r.onerror = (e) => {
      if (rec !== r) return;
      switch (e.error) {
        case 'no-speech':
        case 'aborted':
          return; // onend নিজে থেকে আবার চালু করবে
        case 'not-allowed':
        case 'service-not-allowed':
          return fail(MSG.denied);
        case 'audio-capture':
          return fail(MSG.noMic);
        case 'network':
          return fail(MSG.network);
        case 'language-not-supported':
          return fail(MSG.lang);
        default:
          return fail(MSG.generic + ' (' + e.error + ')');
      }
    };

    r.onend = () => {
      if (rec !== r) return; // পুরনো ইনস্ট্যান্স
      rec = null;
      if (!wantListening) {
        clearIdle();
        setUI(false);
        return;
      }
      const now = Date.now();
      if (now - lastActivity > 90000) {
        clearIdle();
        wantListening = false;
        setUI(false);
        setBubble({ text: MSG.idle, autoHide: 5000 });
        return;
      }
      restartLog = restartLog.filter((t) => now - t < 3000);
      restartLog.push(now);
      if (restartLog.length > 5) {
        clearIdle();
        wantListening = false;
        setUI(false);
        setBubble({ text: MSG.loop, error: true, autoHide: 6000 });
        return;
      }
      setTimeout(() => {
        if (wantListening && !rec) spawnRecognition();
      }, 200);
    };

    rec = r;
    try {
      r.start();
    } catch (err) {
      rec = null;
      if (!(err && err.name === 'InvalidStateError')) fail(MSG.generic);
    }
  }

  function startListening(lang) {
    if (!SR) {
      setBubble({ text: MSG.unsupported, error: true, autoHide: 6000 });
      return;
    }
    if (!currentTarget()) {
      setBubble({ text: MSG.noTarget, error: true, autoHide: 3500 });
      return;
    }
    sessionLang = lang || null;
    wantListening = true;
    restartLog = [];
    lastActivity = Date.now();
    resetIdle();
    setUI(true);
    setBubble({ text: listeningText() });
    spawnRecognition();
  }

  function stopListening() {
    clearIdle();
    wantListening = false;
    const r = rec;
    if (r) {
      try { r.stop(); } catch (_) {}
    }
    setUI(false);
    setBubble({});
  }

  function restartRecognition() {
    const old = rec;
    rec = null;
    if (old) {
      try { old.abort(); } catch (_) {}
    }
    spawnRecognition();
  }

  // lang দিলে (Alt+X / Alt+Z): বন্ধ থাকলে ওই ভাষায় শুরু, একই ভাষায় চালু থাকলে বন্ধ, অন্য ভাষায় চালু থাকলে ভাষা বদল
  function toggle(lang) {
    if (!wantListening) {
      startListening(lang);
    } else if (lang && lang !== activeLang()) {
      sessionLang = lang;
      restartRecognition();
      setBubble({ text: listeningText() });
    } else {
      stopListening();
    }
  }

  window.addEventListener('pagehide', () => {
    if (wantListening) stopListening();
  });

  // ------------------------------------------------------ অনুবাদ (Alt+C)
  // সিলেক্ট করা লেখা বাংলা হলে English, অন্য যেকোনো ভাষা হলে বাংলা হয় (ভাষা চেনে Language Detector দিয়ে)। একই লেখায় আবার চাপলে আগের রূপ ফিরে আসে।
  // Chrome-এর বিল্ট-ইন Translator API ব্যবহার হয় (ফ্রি, অন-ডিভাইস)।

  const norm = (s) => String(s).normalize('NFC').trim();

  const translators = new Map(); // "bn>en" → Translator
  const swapMap = new Map(); // লেখা → তার বিপরীত রূপ (আগের/পরের)
  let translating = false;

  function remember(a, b) {
    for (const [k, v] of [[a, b], [b, a]]) {
      swapMap.delete(k);
      swapMap.set(k, v);
    }
    while (swapMap.size > 60) swapMap.delete(swapMap.keys().next().value);
  }

  function getEditableSelection() {
    const el = editableFrom(deepActive());
    if (!el) return null;
    if (isTextControl(el)) {
      const s = el.selectionStart;
      const e = el.selectionEnd;
      if (s == null || s === e) return null;
      return { el, text: el.value.slice(s, e) };
    }
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount || sel.isCollapsed) return null;
    if (!el.contains(sel.getRangeAt(0).commonAncestorContainer)) return null;
    return { el, text: sel.toString() };
  }

  async function getTranslator(source, target) {
    const key = source + '>' + target;
    if (translators.has(key)) return translators.get(key);
    const opts = { sourceLanguage: source, targetLanguage: target };
    const availability = await window.Translator.availability(opts);
    if (availability === 'unavailable') throw new Error('pair-unavailable');
    const t = await window.Translator.create({
      ...opts,
      monitor(m) {
        m.addEventListener('downloadprogress', (e) => {
          setBubble({ text: MSG.downloading + ' ' + Math.round(e.loaded * 100) + '%' });
        });
      },
    });
    translators.set(key, t);
    return t;
  }

  // লাইন ধরে অনুবাদ করা হয়, যাতে নতুন লাইন ঠিক থাকে
  async function translateLines(t, text) {
    const out = [];
    for (const line of text.split('\n')) {
      const m = line.match(/^(\s*)([\s\S]*?)(\s*)$/);
      out.push(m[2] ? m[1] + (await t.translate(m[2])) + m[3] : line);
    }
    return out.join('\n');
  }

  const routes = new Map(); // "fr>bn" → [["fr","en"],["en","bn"]]
  async function getRoute(source, target) {
    const key = source + '>' + target;
    if (routes.has(key)) return routes.get(key);
    const route = await BVT.planRoute(source, target, (s, t) =>
      window.Translator.availability({ sourceLanguage: s, targetLanguage: t })
    );
    if (route) routes.set(key, route);
    return route;
  }

  // সরাসরি জোড়া না থাকলে English হয়ে ঘুরে অনুবাদ করে
  async function translateText(text, source, target) {
    const route = await getRoute(source, target);
    if (!route) throw new Error('pair-unavailable');
    if (route.length > 1) setBubble({ text: MSG.translatingVia });
    let out = text;
    for (const [s, t] of route) out = await translateLines(await getTranslator(s, t), out);
    return out;
  }

  function replaceSelected(info, text) {
    const el = info.el;
    if (isTextControl(el)) {
      if (el instanceof HTMLInputElement) text = text.replace(/\s*\n+\s*/g, ' ');
      const start = el.selectionStart;
      const end = el.selectionEnd;
      if (!document.execCommand('insertText', false, text)) {
        el.setRangeText(text, start, end, 'end');
        el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
      }
      try { el.setSelectionRange(start, start + text.length); } catch (_) {} // আবার Alt+C চাপার জন্য সিলেক্ট থাকবে
      return;
    }
    const lines = text.split('\n');
    lines.forEach((line, i) => {
      if (i > 0) document.execCommand('insertParagraph');
      if (line) document.execCommand('insertText', false, line);
    });
    if (lines.length === 1) {
      try {
        const sel = window.getSelection();
        const rg = sel.getRangeAt(0);
        const n = rg.endContainer;
        if (n.nodeType === Node.TEXT_NODE && rg.endOffset >= text.length) {
          const r2 = document.createRange();
          r2.setStart(n, rg.endOffset - text.length);
          r2.setEnd(n, rg.endOffset);
          sel.removeAllRanges();
          sel.addRange(r2);
        }
      } catch (_) {}
    }
  }

  function translateError(err) {
    const name = err && err.name;
    if (err && err.message === 'pair-unavailable') return MSG.pairUnavailable;
    if (name === 'NotAllowedError') return MSG.needModel;
    if (name === 'NotSupportedError') return MSG.pairUnavailable;
    return MSG.translateFail;
  }

  async function translateSelection() {
    if (translating) return;
    if (!('Translator' in window)) {
      setBubble({ text: MSG.noTranslator, error: true, autoHide: 7000 });
      return;
    }
    const info = getEditableSelection();
    const core = info ? norm(info.text) : '';
    if (!core) {
      setBubble({ text: MSG.noSelection, error: true, autoHide: 4500 });
      return;
    }
    if (!/\p{L}/u.test(core)) {
      setBubble({ text: MSG.noLetters, error: true, autoHide: 4500 });
      return;
    }
    const lead = info.text.match(/^\s*/)[0];
    const trail = info.text.match(/\s*$/)[0];

    let result = swapMap.get(core);
    let source = 'en';
    translating = true;
    try {
      source = await BVT.detectLang(core); // বাংলা → English, বাকি সব → বাংলা
      if (result == null) {
        setBubble({ text: MSG.translating });
        result = norm(await translateText(core, source, source === 'bn' ? 'en' : 'bn'));
        if (!result) {
          setBubble({ text: MSG.translateFail, error: true, autoHide: 4500 });
          return;
        }
        remember(core, result);
      }
    } catch (err) {
      setBubble({ text: translateError(err), error: true, autoHide: 8000 });
      return;
    } finally {
      translating = false;
    }

    const now = getEditableSelection();
    if (!now || now.el !== info.el || now.text !== info.text) {
      setBubble({ text: MSG.selChanged, error: true, autoHide: 5000 });
      return;
    }
    replaceSelected(now, lead + result + trail);
    setBubble({ text: source === 'bn' ? MSG.toEn : source === 'en' ? MSG.toBn : MSG.toBnOther, autoHide: 2500 });
  }

  // ------------------------------------------------------ সেটিংস ও মেসেজ

  function applySettings() {
    btn.classList.toggle('hiddenBtn', !settings.showButton);
    if (wantListening && rec && rec.lang !== activeLang()) restartRecognition();
  }

  try {
    chrome.storage.sync.get(DEFAULTS, (s) => {
      settings = { ...DEFAULTS, ...s };
      applySettings();
    });
    chrome.storage.local.get('bvtPos', (s) => {
      if (s && s.bvtPos) setPos(s.bvtPos.right, s.bvtPos.bottom);
    });
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'sync') return;
      for (const k of Object.keys(changes)) {
        if (k in DEFAULTS) settings[k] = changes[k].newValue;
      }
      applySettings();
    });
    chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
      if (msg && msg.type === 'toggle') {
        if ((window.top !== window && !editableFrom(deepActive())) || (window.top === window && document.activeElement instanceof HTMLIFrameElement)) return;
        toggle();
        sendResponse({ listening: wantListening });
      } else if (msg && msg.type === 'start') {
        if ((window.top !== window && !editableFrom(deepActive())) || (window.top === window && document.activeElement instanceof HTMLIFrameElement)) return;
        toggle(/^(bn|en)-[A-Z]{2}$/.test(msg.lang) ? msg.lang : undefined);
        sendResponse({ listening: wantListening });
      } else if (msg && msg.type === 'translate') {
        if ((window.top !== window && !editableFrom(deepActive())) || (window.top === window && document.activeElement instanceof HTMLIFrameElement)) return;
        translateSelection();
        sendResponse({ ok: true });
      } else if (msg && msg.type === 'status') {
        sendResponse({ listening: wantListening, supported: !!SR });
      }
    });
  } catch (_) {
    // এক্সটেনশন রিলোড হলে পুরনো স্ক্রিপ্টে chrome অবজেক্ট বাতিল হয়ে যায়; পাতা রিলোড করলেই ঠিক হবে
  }

  updatePlacement();
})();
