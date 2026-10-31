/* বাংলা ভয়েস টাইপিং — বাংলা বানান যাচাই (ভুল বানানের নিচে ঢেউ-খেলানো লাল দাগ)
 * bn-words.js-এর শব্দতালিকা দিয়ে (spell-lib.js) যে শব্দ তালিকায় নেই, ফোকাসে থাকা টেক্সট বক্সে তার নিচে দাগ দেয়।
 *  • textarea / input: বাক্সের ওপরে একই মাপের স্বচ্ছ "আয়না" বসিয়ে শুধু দাগ আঁকা হয় (বাক্সের লেখায় হাত পড়ে না)
 *  • contenteditable (চ্যাট, রিচ এডিটর): CSS Custom Highlight API
 * যে শব্দ লেখা চলছে (কার্সর যার গায়ে), তাতে দাগ দেয় না; পাতা/বাক্সে spellcheck="false" থাকলে বাদ।
 * দাগ দেওয়া শব্দে ডান-ক্লিক করলে মেনু আসে: সাজেশন বাছলে শব্দটা বদলে যায়, "এড়িয়ে যাও", "অভিধানে যোগ করো"।
 * সেটিং chrome.storage.local-এর `spellBn` (ডিফল্ট চালু), নিজের অভিধান `spellUserWords`;
 * ফোনেটিক কাস্টম শব্দ আর শেখা শব্দ ঠিক বলে ধরা হয়। */
(() => {
  'use strict';
  if (window.__bvtSpell) return;
  window.__bvtSpell = true;
  const S = globalThis.BVTSpell;
  if (!S) return;

  const TEXT_TYPES = ['text', 'search'];
  const MAX_CHARS = 30000; // এর বেশি লম্বা লেখায় যাচাই করি না (পাতা ধীর হবে)
  const DELAY = 220; // লেখা থামার এত ms পরে যাচাই
  const LINE = '#d93025';
  const FONT = '"Noto Sans Bengali","Siyam Rupali","Nirmala UI","Hind Siliguri",system-ui,sans-serif';
  const HL_NAME = 'bvt-spell';
  const BLOCK = new Set(['P', 'DIV', 'LI', 'UL', 'OL', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE', 'PRE', 'TD', 'TH', 'TR', 'SECTION', 'ARTICLE', 'BR']);
  const BN_ANY = /[\u0995-\u09b9\u0985-\u0994]/;
  const CODE_EDITOR = '.monaco-editor, .cm-editor, .CodeMirror, .ace_editor, [data-lexical-code], pre, code';
  const COPY = [
    'boxSizing', 'direction', 'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'fontStretch', 'fontVariant', 'fontKerning',
    'fontFeatureSettings', 'fontVariationSettings', 'textRendering', 'letterSpacing', 'wordSpacing', 'lineHeight', 'textIndent',
    'textTransform', 'textAlign', 'tabSize', 'whiteSpace', 'wordBreak', 'overflowWrap', 'paddingTop', 'paddingRight', 'paddingBottom',
    'paddingLeft', 'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
  ];

  let enabled = true;
  let target = null; // এখন যে বাক্সে দাগ দিচ্ছি
  let timer = 0;
  let host = null; // আয়না রাখার ফিক্সড স্তর
  let mirror = null;
  let inner = null;
  let styleEl = null;
  let posTimer = 0;
  let lastRect = '';
  const hasHighlight = typeof CSS !== 'undefined' && CSS.highlights && typeof Highlight !== 'undefined';

  // ---------------------------------------------------------------- সেটিং আর নিজের শব্দ

  function addOwnWords(s) {
    const list = [];
    for (const v of Object.values((s && s.phoneticCustomWords) || {})) if (typeof v === 'string') list.push(v);
    for (const v of Object.values((s && s.phoneticLearned) || {})) if (typeof v === 'string') list.push(v);
    S.setKnown('own', list);
    S.setKnown('user', (s && Array.isArray(s.spellUserWords)) ? s.spellUserWords : []);
  }

  function loadSettings() {
    try {
      chrome.storage.local.get({ spellBn: true, phoneticCustomWords: {}, phoneticLearned: {}, spellUserWords: [] }, (s) => {
        enabled = !s || s.spellBn !== false;
        addOwnWords(s);
        if (!enabled) clear();
        else if (target) schedule(0);
      });
    } catch (_) {
      // এক্সটেনশন রিলোড হলে পাতা রিলোড করলেই ঠিক হবে
    }
  }
  loadSettings();
  try {
    chrome.storage.onChanged.addListener((ch, area) => {
      if (area === 'local' && (ch.spellBn || ch.phoneticCustomWords || ch.phoneticLearned || ch.spellUserWords)) loadSettings();
    });
  } catch (_) {}

  // ---------------------------------------------------------------- লেখার জায়গা

  const isField = (el) => el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement;

  function editable(el) {
    if (!el || el.nodeType !== 1) return null;
    if (el instanceof HTMLTextAreaElement) return el.disabled || el.readOnly || el.spellcheck === false ? null : el;
    if (el instanceof HTMLInputElement) {
      return !el.disabled && !el.readOnly && el.spellcheck !== false && TEXT_TYPES.includes(el.type) ? el : null; // password বাদ
    }
    if (!el.isContentEditable || el.spellcheck === false) return null;
    if (el.closest && el.closest(CODE_EDITOR)) return null;
    // contenteditable-এর ভেতরের ফোকাস হলে সবচেয়ে ওপরের এডিটর ধরি
    let top = el;
    while (top.parentElement && top.parentElement.isContentEditable) top = top.parentElement;
    return top;
  }

  function deepActive() {
    let a = document.activeElement;
    while (a && a.shadowRoot && a.shadowRoot.activeElement) a = a.shadowRoot.activeElement;
    return a;
  }

  // ---------------------------------------------------------------- দাগ আঁকা: textarea / input

  function ensureHost() {
    if (host && host.isConnected) return;
    host = document.createElement('div');
    host.setAttribute('data-bvt-spell', '');
    host.style.cssText = 'all:initial;position:fixed;left:0;top:0;width:0;height:0;overflow:visible;pointer-events:none;z-index:2147483646;';
    const root = host.attachShadow({ mode: 'closed' });
    mirror = document.createElement('div');
    inner = document.createElement('div');
    mirror.appendChild(inner);
    const st = document.createElement('style');
    st.textContent = '.w{color:transparent;text-decoration:underline wavy ' + LINE + ';text-decoration-skip-ink:none;text-underline-offset:2px;}';
    root.append(st, mirror);
    (document.documentElement || document.body).appendChild(host);
  }

  let fieldBad = []; // আয়নায় যে ভুল শব্দগুলো আঁকা (span-এর ক্রমে)
  let richPairs = []; // contenteditable-এ [{ bad, range }]

  function hideMirror() {
    fieldBad = [];
    if (mirror) mirror.style.display = 'none';
  }

  // ভুল শব্দগুলো <span class=w> দিয়ে মুড়ে আয়নার লেখা তৈরি (innerHTML ছাড়া, তাই CSP/Trusted Types-এ আটকায় না)
  function fillMirror(text, bad) {
    inner.textContent = '';
    let pos = 0;
    for (const b of bad) {
      if (b.start > pos) inner.appendChild(document.createTextNode(text.slice(pos, b.start)));
      const sp = document.createElement('span');
      sp.className = 'w';
      sp.textContent = text.slice(b.start, b.end);
      inner.appendChild(sp);
      pos = b.end;
    }
    if (pos < text.length) inner.appendChild(document.createTextNode(text.slice(pos)));
  }

  function placeMirror(el) {
    if (!mirror || !el || !el.isConnected) return;
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4 || r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) {
      mirror.style.display = 'none';
      return;
    }
    const cs = getComputedStyle(el);
    const ms = mirror.style;
    ms.cssText = 'position:absolute;margin:0;overflow:hidden;border-style:solid;border-color:transparent;background:none;color:transparent;';
    for (const p of COPY) ms[p] = cs[p];
    ms.left = r.left + 'px';
    ms.top = r.top + 'px';
    ms.width = r.width + 'px';
    ms.height = r.height + 'px';
    ms.boxSizing = 'border-box';
    if (el instanceof HTMLTextAreaElement) {
      // স্ক্রলবারের জায়গা ছেড়ে দিই, যাতে লাইন ভাঙা একই জায়গায় হয়
      const bar = el.offsetWidth - el.clientWidth - parseFloat(cs.borderLeftWidth) - parseFloat(cs.borderRightWidth);
      if (bar > 0) ms.paddingRight = parseFloat(cs.paddingRight) + bar + 'px';
      ms.whiteSpace = 'pre-wrap';
      ms.display = 'block';
      inner.style.cssText = 'transform:translateY(' + -el.scrollTop + 'px);';
    } else {
      // input: এক লাইন, লেখা মাঝ বরাবর, ডানে-বাঁয়ে স্ক্রল বাক্সের সঙ্গে মেলানো
      ms.whiteSpace = 'pre';
      ms.display = 'flex';
      ms.alignItems = 'center';
      ms.justifyContent = cs.textAlign === 'center' ? 'center' : cs.textAlign === 'right' || cs.textAlign === 'end' ? 'flex-end' : 'flex-start';
      inner.style.cssText = 'white-space:pre;transform:translateX(' + -el.scrollLeft + 'px);';
    }
    lastRect = r.left + ',' + r.top + ',' + r.width + ',' + r.height + ',' + el.scrollTop + ',' + el.scrollLeft;
  }

  function paintField(el) {
    const text = el.value;
    if (!text || text.length > MAX_CHARS || !BN_ANY.test(text)) return hideMirror();
    let skip = null;
    if (el.selectionStart != null && el.selectionStart === el.selectionEnd) {
      skip = [el.selectionStart, el.selectionStart]; // কার্সর যে শব্দের গায়ে, সেটা এখনো লেখা হচ্ছে
    }
    const bad = S.findMisspelled(text, skip);
    if (!bad.length) return hideMirror();
    ensureHost();
    fillMirror(text, bad);
    fieldBad = bad;
    placeMirror(el);
  }

  // ---------------------------------------------------------------- দাগ আঁকা: contenteditable

  function ensureStyle() {
    if (styleEl && styleEl.isConnected) return;
    styleEl = document.createElement('style');
    styleEl.textContent = '::highlight(' + HL_NAME + '){text-decoration:underline wavy ' + LINE + ';text-decoration-skip-ink:none;}';
    (document.head || document.documentElement).appendChild(styleEl);
  }

  // এডিটরের লেখা এক স্ট্রিংয়ে জুড়ে (ব্লক/BR-এর মাঝে \n), কোন অংশ কোন টেক্সট নোডে তার তালিকাসহ
  function collect(el) {
    const parts = [];
    let text = '';
    let boundary = false;
    let lastBlock = null;
    const blockOf = (n) => {
      for (let e = n.parentElement; e && e !== el.parentElement; e = e.parentElement) if (BLOCK.has(e.tagName) || e === el) return e;
      return el;
    };
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    let n;
    while ((n = walker.nextNode())) {
      if (n.nodeType === 1) {
        if (BLOCK.has(n.tagName)) boundary = true;
        continue;
      }
      const data = n.data;
      if (!data) continue;
      const b = blockOf(n);
      if (boundary || (lastBlock && b !== lastBlock)) text += '\n';
      boundary = false;
      lastBlock = b;
      parts.push({ node: n, start: text.length });
      text += data;
      if (text.length > MAX_CHARS) return null;
    }
    return { text, parts };
  }

  function locate(parts, idx, atEnd) {
    // idx অবস্থানটা কোন টেক্সট নোডের কত নম্বর অক্ষর
    let lo = 0;
    let hi = parts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (parts[mid].start <= idx) lo = mid;
      else hi = mid - 1;
    }
    let p = parts[lo];
    let off = idx - p.start;
    if (atEnd && off === 0 && lo > 0) { // শেষ প্রান্তে আগের নোডের শেষে বসাই
      p = parts[lo - 1];
      off = p.node.data.length;
    }
    return { node: p.node, off: Math.min(off, p.node.data.length) };
  }

  function caretIndex(el, parts) {
    const sel = getSelection();
    if (!sel || !sel.rangeCount || !sel.isCollapsed || !sel.anchorNode || !el.contains(sel.anchorNode)) return null;
    if (sel.anchorNode.nodeType !== 3) return null;
    for (const p of parts) if (p.node === sel.anchorNode) return p.start + sel.anchorOffset;
    return null;
  }

  function paintRich(el) {
    if (!hasHighlight) return;
    const got = collect(el);
    if (!got || !got.text || !BN_ANY.test(got.text)) return clearRich();
    const c = caretIndex(el, got.parts);
    const bad = S.findMisspelled(got.text, c == null ? null : [c, c]);
    if (!bad.length) return clearRich();
    ensureStyle();
    const ranges = [];
    const pairs = [];
    for (const b of bad) {
      try {
        const a = locate(got.parts, b.start, false);
        const z = locate(got.parts, b.end, true);
        const r = document.createRange();
        r.setStart(a.node, a.off);
        r.setEnd(z.node, z.off);
        ranges.push(r);
        pairs.push({ bad: b, range: r });
      } catch (_) {}
    }
    CSS.highlights.set(HL_NAME, new Highlight(...ranges));
    richPairs = pairs;
  }

  function clearRich() {
    richPairs = [];
    if (hasHighlight) CSS.highlights.delete(HL_NAME);
  }

  // ---------------------------------------------------------------- সাজেশন মেনু (দাগ দেওয়া শব্দে ডান-ক্লিক)

  let menuHost = null;
  let menuBox = null;

  function ensureMenu() {
    if (menuHost && menuHost.isConnected) return;
    menuHost = document.createElement('div');
    menuHost.setAttribute('data-bvt-spell-menu', '');
    menuHost.style.cssText = 'all:initial;position:fixed;left:0;top:0;width:0;height:0;overflow:visible;z-index:2147483647;display:none;';
    const root = menuHost.attachShadow({ mode: 'closed' });
    const st = document.createElement('style');
    st.textContent =
      '.box{position:fixed;min-width:150px;max-width:260px;background:#fff;color:#202124;border:1px solid #dadce0;border-radius:8px;' +
      'box-shadow:0 4px 18px rgba(0,0,0,.25);padding:4px;font:15px/1.4 ' + FONT + ';pointer-events:auto;}' +
      'button{display:block;width:100%;text-align:left;border:0;background:none;color:inherit;font:inherit;padding:6px 10px;border-radius:5px;cursor:pointer;}' +
      'button:hover{background:#e8f0fe;}.h{padding:4px 10px;color:' + LINE + ';font-weight:600;font-size:13px;}' +
      '.n{padding:6px 10px;color:#70757a;}.a{color:#5f6368;font-size:13px;}.sep{height:1px;background:#e0e0e0;margin:4px 0;}' +
      '@media (prefers-color-scheme:dark){.box{background:#2b2c2f;color:#e8eaed;border-color:#5f6368;}button:hover{background:#3c4043;}' +
      '.a,.n{color:#9aa0a6;}.sep{background:#4a4c50;}}';
    menuBox = document.createElement('div');
    menuBox.className = 'box';
    menuBox.addEventListener('mousedown', (e) => e.preventDefault()); // বাক্সের ফোকাস/কার্সর যেন না সরে
    root.append(st, menuBox);
    (document.documentElement || document.body).appendChild(menuHost);
  }

  function closeMenu() {
    if (menuHost) menuHost.style.display = 'none';
  }

  const menuOpen = () => !!menuHost && menuHost.style.display !== 'none';

  // (x, y) বিন্দুটা কোন ভুল শব্দের দাগের ওপর — শব্দ ভেঙে দুই লাইনে গেলে যে অংশে ক্লিক সেটার মাপ ফেরে
  function wordAt(x, y) {
    const inside = (rs) => {
      for (const r of rs) if (x >= r.left - 1 && x <= r.right + 1 && y >= r.top - 1 && y <= r.bottom + 1) return r;
      return null;
    };
    if (isField(target)) {
      if (!mirror || mirror.style.display === 'none') return null;
      const spans = inner.querySelectorAll('.w');
      for (let i = 0; i < spans.length && i < fieldBad.length; i++) {
        const r = inside(spans[i].getClientRects());
        if (r) return { bad: fieldBad[i], rect: r, range: null };
      }
      return null;
    }
    for (const p of richPairs) {
      const r = inside(p.range.getClientRects());
      if (r) return { bad: p.bad, rect: r, range: p.range };
    }
    return null;
  }

  function replaceWord(hit, rep) {
    const el = target;
    if (!el) return;
    const b = hit.bad;
    if (isField(el)) {
      if (el.value.slice(b.start, b.end) !== b.word) return schedule(0); // লেখা এর মধ্যে বদলে গেছে
      el.focus();
      el.setSelectionRange(b.start, b.end);
      if (!document.execCommand('insertText', false, rep)) {
        el.setRangeText(rep, b.start, b.end, 'end');
        el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: rep }));
      }
    } else {
      const r = hit.range;
      if (!r || r.toString() !== b.word) return schedule(0);
      el.focus();
      const sel = getSelection();
      sel.removeAllRanges();
      sel.addRange(r);
      document.execCommand('insertText', false, rep);
    }
    schedule(60);
  }

  function addToDictionary(word) {
    S.addKnown([word]);
    try {
      chrome.storage.local.get({ spellUserWords: [] }, (s) => {
        const list = Array.isArray(s.spellUserWords) ? s.spellUserWords : [];
        const n = S.norm(word);
        if (!list.some((w) => S.norm(w) === n)) list.push(word);
        if (list.length > 3000) list.splice(0, list.length - 3000);
        chrome.storage.local.set({ spellUserWords: list });
      });
    } catch (_) {}
    schedule(0);
  }

  function openMenu(hit) {
    ensureMenu();
    const word = hit.bad.word;
    menuBox.textContent = '';
    const row = (cls, text) => {
      const d = document.createElement('div');
      d.className = cls;
      d.textContent = text;
      menuBox.appendChild(d);
    };
    const item = (cls, text, fn) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = cls;
      b.textContent = text;
      b.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        closeMenu();
        fn();
      });
      menuBox.appendChild(b);
    };
    row('h', word);
    const list = S.suggest(word, 6);
    if (list.length) for (const w of list) item('s', w, () => replaceWord(hit, w));
    else row('n', 'কোনো সাজেশন নেই');
    row('sep', '');
    item('a', 'এড়িয়ে যাও', () => { S.addKnown([word]); schedule(0); });
    item('a', 'অভিধানে যোগ করো', () => addToDictionary(word));
    menuHost.style.display = 'block';
    const bw = menuBox.offsetWidth;
    const bh = menuBox.offsetHeight;
    const left = Math.min(Math.max(4, hit.rect.left), Math.max(4, innerWidth - bw - 4));
    let top = hit.rect.bottom + 4;
    if (top + bh > innerHeight - 4) top = Math.max(4, hit.rect.top - bh - 4);
    menuBox.style.left = left + 'px';
    menuBox.style.top = top + 'px';
  }

  // ---------------------------------------------------------------- চালানো

  function clear() {
    clearTimeout(timer);
    closeMenu();
    hideMirror();
    clearRich();
  }

  function run() {
    if (!enabled || !target || !target.isConnected) return clear();
    try {
      if (isField(target)) { clearRich(); paintField(target); } else { hideMirror(); paintRich(target); }
    } catch (_) {
      clear();
    }
  }

  function schedule(ms) {
    clearTimeout(timer);
    timer = setTimeout(run, ms == null ? DELAY : ms);
  }

  // বাক্সের জায়গা/স্ক্রল বদলালে আয়না সরিয়ে আনি (ঘন ঘন, কিন্তু হালকা)
  function sync() {
    if (!target || !isField(target) || !mirror || mirror.style.display === 'none') return;
    const r = target.getBoundingClientRect();
    const sig = r.left + ',' + r.top + ',' + r.width + ',' + r.height + ',' + target.scrollTop + ',' + target.scrollLeft;
    if (sig !== lastRect) placeMirror(target);
  }

  function setTarget(el) {
    const t = editable(el);
    if (t === target) return;
    clear();
    target = t;
    clearInterval(posTimer);
    if (target) {
      posTimer = setInterval(sync, 250);
      schedule(0);
    }
  }

  document.addEventListener('focusin', (e) => {
    const path = e.composedPath ? e.composedPath()[0] : e.target;
    setTarget(path instanceof Element ? path : deepActive());
  }, true);
  document.addEventListener('focusout', () => {
    setTimeout(() => { if (!editable(deepActive())) setTarget(null); }, 0);
  }, true);
  document.addEventListener('input', (e) => {
    if (!target) return;
    const t = e.composedPath ? e.composedPath()[0] : e.target;
    if (t === target || (t instanceof Node && target.contains(t))) schedule();
  }, true);
  document.addEventListener('selectionchange', () => {
    if (target && !isField(target)) schedule(); // রিচ এডিটরে কার্সর সরলে "লেখা চলা শব্দ" বদলায়
  });
  document.addEventListener('keyup', (e) => {
    if (target && isField(target) && /^(Arrow|Home|End|Page)/.test(e.key)) schedule(); // কার্সর সরলে
  }, true);
  document.addEventListener('click', () => {
    if (target && isField(target)) schedule(80);
  }, true);
  document.addEventListener('contextmenu', (e) => {
    if (!enabled || !target || !e.isTrusted) return;
    const t = e.composedPath ? e.composedPath()[0] : e.target;
    if (!(t === target || (t instanceof Node && target.contains(t)))) return closeMenu();
    const hit = wordAt(e.clientX, e.clientY);
    if (!hit) return closeMenu();
    e.preventDefault();
    e.stopPropagation();
    openMenu(hit);
  }, true);
  document.addEventListener('mousedown', (e) => {
    if (menuOpen() && e.target !== menuHost) closeMenu();
  }, true);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && menuOpen()) { closeMenu(); e.stopPropagation(); }
  }, true);
  document.addEventListener('scroll', () => { closeMenu(); sync(); }, true);
  addEventListener('resize', () => { closeMenu(); sync(); });

  const first = editable(deepActive());
  if (first) setTarget(first);
})();
