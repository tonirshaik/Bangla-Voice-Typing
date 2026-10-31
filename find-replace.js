/* বাংলা ভয়েস টাইপিং — যেকোনো লেখার বক্সে খোঁজা ও বদলানো (Ctrl+F / Alt+A)
 * লেখার বক্সে (textarea, input, Gmail/Facebook-এর মতো রিচ এডিটর) কার্সর রেখে Ctrl+F চাপলে খোঁজার প্যানেল,
 * Alt+A চাপলে খোঁজা + বদলানোর প্যানেল আসে। সব মিল একসাথে রঙিন হয়, এক ক্লিকে সব বদলানো যায়।
 * বক্স খালি থাকলে বা বক্সের বাইরে থাকলে Chrome-এর নিজের Ctrl+F আগের মতোই চলে।
 * সেটিং chrome.storage.local-এ: frEnabled (চালু/বন্ধ), frOpts (Aa, পুরো শব্দ, Regex, ফোনেটিক ইত্যাদির অবস্থা)
 * মূল খোঁজার কাজ find-lib.js-এ (BVTFind)। */
(() => {
  'use strict';
  if (window.__bvtFind) return;
  window.__bvtFind = true;
  const L = window.BVTFind;
  if (!L) return;

  const FONT = '"Noto Sans Bengali","Siyam Rupali","Nirmala UI","Hind Siliguri",system-ui,sans-serif';
  const TEXT_TYPES = ['text', 'search', 'url', 'tel']; // password, email, number বাদ
  const OWN_FIND_HOST = /(^|\.)(docs\.google\.com|vscode\.dev|github\.dev|stackblitz\.com|codesandbox\.io)$/;
  const OWN_FIND_SELECTOR = '.monaco-editor,.cm-editor,.CodeMirror,.ace_editor'; // যাদের নিজের Find আছে
  const BLOCK = new Set(['DIV', 'P', 'LI', 'UL', 'OL', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE', 'PRE', 'TABLE', 'TR', 'TD', 'TH', 'SECTION', 'ARTICLE', 'HEADER', 'FOOTER']);
  const MAX_RICH_REPLACE = 600; // রিচ এডিটরে এক এক করে বদলাতে হয়, তাই সীমা

  // ---------------------------------------------------------------- সেটিং

  let enabled = true;
  const opts = { matchCase: false, wholeWord: false, regex: false, phonetic: false, preserveCase: false, phoneticReplace: false };
  try {
    chrome.storage.local.get({ frEnabled: true, frOpts: {} }, (s) => {
      enabled = !s || s.frEnabled !== false;
      if (s && s.frOpts && typeof s.frOpts === 'object') for (const k of Object.keys(opts)) if (typeof s.frOpts[k] === 'boolean') opts[k] = s.frOpts[k];
      syncToggles();
    });
    chrome.storage.onChanged.addListener((ch, area) => {
      if (area === 'local' && ch.frEnabled) {
        enabled = ch.frEnabled.newValue !== false;
        if (!enabled && open) closePanel(false);
      }
    });
  } catch (_) {
    // এক্সটেনশন রিলোড হলে পাতা রিলোড করলেই ঠিক হবে
  }
  const saveOpts = () => { try { chrome.storage.local.set({ frOpts: { ...opts } }); } catch (_) {} };

  // ---------------------------------------------------------------- UI (Shadow DOM, বন্ধ)

  const CSS = `
    * { box-sizing: border-box; }
    .panel { position: fixed; display: none; pointer-events: auto; width: min(452px, calc(100vw - 16px)); padding: 6px 8px 6px 4px;
      font-family: ${FONT}; font-size: 13px; line-height: 1.4; color: #EEF2FF; background: rgba(14,20,40,.9); border: 1px solid rgba(255,255,255,.14);
      border-radius: 16px; box-shadow: 0 14px 40px -8px rgba(0,0,0,.65), 0 0 0 1px rgba(94,234,212,.06); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); }
    .wrap { display: flex; gap: 4px; align-items: stretch; }
    .chev { flex: none; width: 18px; border: none; background: transparent; color: #ccc; cursor: pointer; border-radius: 4px; padding: 0; font-size: 12px; }
    .chev:hover { background: rgba(255,255,255,.1); }
    .chev span { display: inline-block; transition: transform .12s; }
    .rep .chev span { transform: rotate(90deg); }
    .rows { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
    .row { display: flex; align-items: center; gap: 4px; }
    .rrow { display: none; }
    .rep .rrow { display: flex; }
    .box { position: relative; flex: 1; min-width: 0; display: flex; align-items: center; background: rgba(255,255,255,.07); border: 1px solid transparent; border-radius: 10px; }
    .box:focus-within { border-color: #5EEAD4; box-shadow: 0 0 0 3px rgba(94,234,212,.15); }
    .box.bad { border-color: #FF6B7A; }
    .box input { flex: 1; min-width: 0; height: 26px; padding: 3px 6px; border: none; outline: none; background: transparent; color: #EEF2FF; font: inherit; user-select: text; -webkit-user-select: text; }
    .box input::placeholder { color: #7482A8; }
    .tg { flex: none; width: 22px; height: 22px; padding: 0; display: flex; align-items: center; justify-content: center; border: 1px solid transparent;
      border-radius: 8px; background: transparent; color: #C7D0EA; cursor: pointer; font: 12px/1 ${FONT}; }
    .box .tg { margin-right: 2px; }
    .tg:hover { background: rgba(255,255,255,.12); }
    .tg.on { background: rgba(94,234,212,.2); border-color: #5EEAD4; color: #fff; }
    .tg:disabled { opacity: .35; cursor: default; background: transparent; }
    .tg.u span { text-decoration: underline; }
    .cnt { flex: none; min-width: 66px; padding: 0 2px; font-size: 12px; white-space: nowrap; }
    .cnt.bad { color: #FF8A8A; }
    .btn { flex: none; height: 24px; padding: 0 8px; border: 1px solid transparent; border-radius: 8px; background: rgba(255,255,255,.09); color: #EEF2FF; cursor: pointer; font: 12px/1 ${FONT}; }
    .btn:hover { background: rgba(94,234,212,.22); }
    .btn:disabled { opacity: .4; cursor: default; }
    .pv { display: none; padding: 0 28px 0 2px; font-size: 12px; color: #5EEAD4; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .rep .pv.show { display: block; }
    .toast { position: fixed; left: 50%; bottom: 28px; transform: translateX(-50%); display: none; padding: 9px 16px; border-radius: 10px;
      background: #202124; color: #fff; font-family: ${FONT}; font-size: 14px; box-shadow: 0 6px 24px rgba(0,0,0,.45); pointer-events: none; }
    .ov { position: fixed; display: none; overflow: hidden; pointer-events: none; }
    .hl { position: absolute; background: rgba(255,214,10,.5); border-radius: 2px; pointer-events: none; }
    .hl.cur { background: rgba(255,140,0,.78); box-shadow: 0 0 0 1px rgba(255,140,0,.9); }
    .ovin { position: relative; color: transparent; -webkit-text-fill-color: transparent; background: transparent; }
    .ovin .line { position: relative; white-space: pre; }
    .ovin mark { color: transparent; -webkit-text-fill-color: transparent; background: rgba(255,214,10,.5); border-radius: 2px; }
    .ovin mark.cur { background: rgba(255,140,0,.8); box-shadow: 0 0 0 1px rgba(255,140,0,.9); }
  `;

  const mk = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };

  const host = document.createElement('bvt-findreplace');
  for (const [k, v] of Object.entries({
    position: 'fixed', top: '0', left: '0', width: '0', height: '0', margin: '0', padding: '0', border: 'none', background: 'none',
    'z-index': '2147483647', 'pointer-events': 'none', opacity: '1', visibility: 'visible', display: 'block',
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

  const tgBtn = (label, title, cls) => {
    const b = mk('button', 'tg' + (cls ? ' ' + cls : ''));
    b.type = 'button';
    b.title = title;
    b.appendChild(mk('span', '', label));
    b.addEventListener('mousedown', (e) => e.preventDefault()); // ফোকাস ইনপুটেই থাকে
    return b;
  };
  const textBtn = (label, title) => {
    const b = mk('button', 'btn', label);
    b.type = 'button';
    b.title = title;
    b.addEventListener('mousedown', (e) => e.preventDefault());
    return b;
  };
  // আইকন বাটন (SVG) — Undo / Redo
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const iconBtn = (paths, title) => {
    const b = mk('button', 'tg');
    b.type = 'button';
    b.title = title;
    b.setAttribute('aria-label', title);
    const svg = document.createElementNS(SVG_NS, 'svg');
    for (const [k, v] of Object.entries({ viewBox: '0 0 24 24', width: '15', height: '15', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' })) svg.setAttribute(k, v);
    for (const d of paths) {
      const pa = document.createElementNS(SVG_NS, 'path');
      pa.setAttribute('d', d);
      svg.appendChild(pa);
    }
    b.appendChild(svg);
    b.addEventListener('mousedown', (e) => e.preventDefault());
    return b;
  };
  const mkInput = (placeholder, label) => {
    const i = mk('input');
    i.type = 'text';
    i.placeholder = placeholder;
    i.setAttribute('aria-label', label);
    i.spellcheck = false;
    i.autocomplete = 'off';
    i.autocapitalize = 'off';
    return i;
  };

  const panel = mk('div', 'panel');
  panel.setAttribute('role', 'search');
  const chev = mk('button', 'chev');
  chev.type = 'button';
  chev.title = 'Show or hide Replace (Alt+A) · বদলানোর ঘর';
  chev.appendChild(mk('span', '', '›'));
  chev.addEventListener('mousedown', (e) => e.preventDefault());

  const fi = mkInput('Find', 'Find');
  const bCase = tgBtn('Aa', 'Match case · বড়/ছোট হাতের অক্ষর মেলানো');
  const bWord = tgBtn('ab', 'Whole word · পুরো শব্দ (বাংলার কার/ফলাসহ ঠিকভাবে)', 'u');
  const bRegex = tgBtn('.*', 'Regular expression');
  const bPho = tgBtn('বা', 'Phonetic search · roni লিখলে রনি-ও খোঁজে (ছোট হাতের অক্ষরে লিখুন)');
  const box1 = mk('div', 'box');
  box1.append(fi, bCase, bWord, bRegex, bPho);
  const cnt = mk('span', 'cnt');
  const bPrev = tgBtn('↑', 'Previous match · আগেরটা (Shift+Enter)');
  const bNext = tgBtn('↓', 'Next match · পরেরটা (Enter)');
  const bScope = tgBtn('≡', 'Find in selection · শুধু নির্বাচিত অংশে খোঁজা');
  const bClose = tgBtn('✕', 'Close · বন্ধ (Esc)');
  const row1 = mk('div', 'row');
  row1.append(box1, cnt, bPrev, bNext, bScope, bClose);

  const ri = mkInput('Replace', 'Replace');
  const bKeep = tgBtn('AB', 'Preserve case · Roni → Rahat, RONI → RAHAT');
  const bPhoR = tgBtn('বা', 'Type Bangla phonetically · rahat লিখলে রাহাত বসবে (R বড় হাতের মানে ড়)');
  const box2 = mk('div', 'box');
  box2.append(ri, bKeep, bPhoR);
  const bOne = textBtn('Replace', 'Replace this match (Enter) · এটা বদলান');
  const bAll = textBtn('All', 'Replace all (Ctrl+Alt+Enter) · সব বদলান');
  const bUndo = iconBtn(['M9 14 4 9l5-5', 'M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5v0a5.5 5.5 0 0 1-5.5 5.5H11'], 'Undo (Ctrl+Z) · লেখার বক্সের শেষ বদল ফিরিয়ে নিন');
  const bRedo = iconBtn(['m15 14 5-5-5-5', 'M20 9H9.5A5.5 5.5 0 0 0 4 14.5v0A5.5 5.5 0 0 0 9.5 20H13'], 'Redo (Ctrl+Y) · ফিরিয়ে নেওয়া বদল আবার করুন');
  const row2 = mk('div', 'row rrow');
  row2.append(box2, bOne, bAll, bUndo, bRedo);
  const pv = mk('div', 'pv');

  const rows = mk('div', 'rows');
  rows.append(row1, row2, pv);
  const wrap = mk('div', 'wrap');
  wrap.append(chev, rows);
  panel.appendChild(wrap);

  const ov = mk('div', 'ov');
  const ovIn = mk('div', 'ovin');
  ov.appendChild(ovIn);
  const richClip = mk('div', 'ov');
  const toastEl = mk('div', 'toast');
  shadow.append(ov, richClip, panel, toastEl);

  let toastTimer = 0;
  function toast(text) {
    mount();
    toastEl.textContent = text;
    toastEl.style.display = 'block';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastEl.style.display = 'none'; }, 2200);
  }
  function mount() {
    if (!host.isConnected) (document.body || document.documentElement).appendChild(host);
  }

  // ---------------------------------------------------------------- লেখার জায়গা চেনা

  const isField = (el) => el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement;

  function editableOf(t) {
    if (!t || t.nodeType !== 1 || t === host) return null;
    if (t instanceof HTMLTextAreaElement) return t.disabled || t.readOnly ? null : t;
    if (t instanceof HTMLInputElement) return !t.disabled && !t.readOnly && TEXT_TYPES.includes(t.type) ? t : null;
    if (t.isContentEditable) {
      let r = t;
      while (r.parentElement && r.parentElement.isContentEditable) r = r.parentElement;
      return r;
    }
    return null;
  }

  function hasOwnFind(el) {
    try {
      return OWN_FIND_HOST.test(location.hostname) || !!el.closest(OWN_FIND_SELECTOR);
    } catch (_) {
      return false;
    }
  }

  const isEmptyBox = (el) => (isField(el) ? el.value === '' : (el.textContent || '').trim() === '');

  function deepActive() {
    let a = document.activeElement;
    while (a && a.shadowRoot && a.shadowRoot.activeElement) a = a.shadowRoot.activeElement;
    return a;
  }

  let lastEditable = null;
  document.addEventListener('focusin', (e) => {
    const el = editableOf((e.composedPath && e.composedPath()[0]) || e.target);
    if (el) lastEditable = el;
  }, true);

  // ---------------------------------------------------------------- রিচ এডিটর: লেখার নোড মানচিত্র

  function blockOf(n, root) {
    let p = n.parentNode;
    while (p && p !== root) {
      if (p.nodeType === 1 && BLOCK.has(p.tagName)) return p;
      p = p.parentNode;
    }
    return root;
  }

  // সব লেখার নোড জুড়ে একটা লেখা; ব্লক/BR-এর মাঝে একটা ভার্চুয়াল '\n'
  function flatten(root) {
    const nodes = [];
    let s = '';
    let lastBlock = null;
    let br = false;
    const tw = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    let n;
    while ((n = tw.nextNode())) {
      if (n.nodeType === 1) {
        if (n.tagName === 'BR') br = true;
        continue;
      }
      const d = n.data;
      if (!d) continue;
      const blk = blockOf(n, root);
      if (s && !s.endsWith('\n') && (br || blk !== lastBlock)) s += '\n';
      br = false;
      lastBlock = blk;
      nodes.push({ node: n, start: s.length });
      s += d;
    }
    return { s, nodes };
  }

  function pointFor(nodes, pos, isEnd) {
    if (!nodes.length) return null;
    let lo = 0;
    let hi = nodes.length - 1;
    let ans = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (nodes[mid].start <= pos) { ans = mid; lo = mid + 1; } else hi = mid - 1;
    }
    if (ans < 0) return { node: nodes[0].node, offset: 0 };
    const e = nodes[ans];
    const len = e.node.data.length;
    const rel = pos - e.start;
    if (rel < len) return { node: e.node, offset: rel };
    if (rel === len && (isEnd || ans + 1 >= nodes.length)) return { node: e.node, offset: len };
    if (isEnd) return { node: e.node, offset: len };
    const nx = nodes[ans + 1];
    return nx ? { node: nx.node, offset: 0 } : { node: e.node, offset: len };
  }

  function rangeFromFlat(flat, a, b) {
    const p1 = pointFor(flat.nodes, a, false);
    const p2 = pointFor(flat.nodes, b, true);
    if (!p1 || !p2) return null;
    const r = document.createRange();
    try {
      r.setStart(p1.node, p1.offset);
      r.setEnd(p2.node, p2.offset);
    } catch (_) {
      return null;
    }
    return r;
  }

  function pointToOffset(flat, node, off) {
    if (node.nodeType === 3) {
      const e = flat.nodes.find((x) => x.node === node);
      return e ? e.start + off : flat.s.length;
    }
    const r = document.createRange();
    try { r.setStart(node, off); r.collapse(true); } catch (_) { return flat.s.length; }
    for (const e of flat.nodes) {
      try { if (r.comparePoint(e.node, 0) >= 0) return e.start; } catch (_) {}
    }
    return flat.s.length;
  }

  // ---------------------------------------------------------------- বসানো (Ctrl+Z চলে)

  function insertInField(el, text) {
    if (text === '' ? document.execCommand('delete') : document.execCommand('insertText', false, text)) return;
    const s = el.selectionStart;
    const e = el.selectionEnd;
    el.setRangeText(text, s, e, 'end');
    el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: text === '' ? 'deleteContentBackward' : 'insertText', data: text || null }));
  }

  function insertInRich(text) {
    if (text === '') { document.execCommand('delete'); return; }
    text.split('\n').forEach((ln, i) => {
      if (i) document.execCommand('insertLineBreak');
      if (ln) document.execCommand('insertText', false, ln);
    });
  }

  // ---------------------------------------------------------------- টার্গেট: textarea/input

  function fieldTarget(el) {
    return {
      kind: 'field',
      el,
      text: () => el.value,
      sel: () => [el.selectionStart || 0, el.selectionEnd || 0],
      focus() { el.focus({ preventScroll: true }); },
      select(m) { try { el.setSelectionRange(m.start, m.end); } catch (_) {} },
      save() { return { s: el.selectionStart, e: el.selectionEnd }; },
      restore(sv) { try { if (sv && sv.s != null) el.setSelectionRange(sv.s, sv.e); } catch (_) {} },
      replaceOne(m, text) {
        this.focus();
        this.select(m);
        insertInField(el, text);
      },
      // একটাই ঢোকানো, তাই একবার Ctrl+Z-তে সব ফিরে আসে
      replaceAll(ms, oldText, rep, o) {
        const first = ms[0].start;
        const last = ms[ms.length - 1].end;
        const newFull = L.applyReplacements(oldText, ms, rep, o).text;
        const piece = newFull.slice(first, newFull.length - (oldText.length - last));
        this.focus();
        this.select({ start: first, end: last });
        insertInField(el, piece);
        return piece.length - (last - first);
      },
      reveal(i) {
        const mk1 = ovMarks[i];
        if (!mk1) return;
        const top = mk1.offsetTop;
        const h = mk1.offsetHeight || 16;
        if (top < el.scrollTop || top + h > el.scrollTop + el.clientHeight) el.scrollTop = Math.max(0, top - el.clientHeight / 3);
        const left = mk1.offsetLeft;
        const w = mk1.offsetWidth || 8;
        if (left < el.scrollLeft || left + w > el.scrollLeft + el.clientWidth) el.scrollLeft = Math.max(0, left - el.clientWidth / 3);
      },
    };
  }

  // ---------------------------------------------------------------- টার্গেট: রিচ এডিটর (contenteditable)

  function richTarget(root) {
    let flat = null;
    const t = {
      kind: 'rich',
      el: root,
      text() { flat = flatten(root); return flat.s; },
      sel() {
        const s = getSelection();
        if (!s || !s.rangeCount) return [0, 0];
        const rg = s.getRangeAt(0);
        if (!root.contains(rg.startContainer) || !root.contains(rg.endContainer)) return [0, 0];
        const f = flatten(root);
        return [pointToOffset(f, rg.startContainer, rg.startOffset), pointToOffset(f, rg.endContainer, rg.endOffset)];
      },
      focus() { root.focus({ preventScroll: true }); },
      rangeFor(m) { return flat ? rangeFromFlat(flat, m.start, m.end) : null; },
      select(m) {
        const r = flat ? rangeFromFlat(flatten(root), m.start, m.end) : null;
        const s = getSelection();
        if (r && s) { s.removeAllRanges(); s.addRange(r); }
      },
      save() {
        const s = getSelection();
        const out = [];
        for (let i = 0; s && i < s.rangeCount; i++) out.push(s.getRangeAt(i).cloneRange());
        return out;
      },
      restore(sv) {
        const s = getSelection();
        if (!s || !sv || !sv.length) return;
        s.removeAllRanges();
        sv.forEach((r) => s.addRange(r));
      },
      replaceOne(m, text) {
        this.focus();
        const f = flatten(root);
        const r = rangeFromFlat(f, m.start, m.end);
        if (!r) return;
        const s = getSelection();
        s.removeAllRanges();
        s.addRange(r);
        insertInRich(text);
      },
      // ব্লক ও বোল্ড ইত্যাদি যেন না মিশে যায়, তাই পেছন থেকে বদলাই। একই লেখার-নোডের পরপর মিলগুলো এক ধাপে
      // (তাই সাধারণ এক অনুচ্ছেদের লেখায় একবার Ctrl+Z-তেই সব ফেরে; আলাদা অনুচ্ছেদে অনুচ্ছেদ-পিছু একবার)
      replaceAll(ms, oldText, rep, o) {
        this.focus();
        const s = getSelection();
        const flat0 = flatten(root);
        const runs = [];
        for (const m of ms) {
          const a = pointFor(flat0.nodes, m.start, false);
          const b = pointFor(flat0.nodes, m.end, true);
          const node = a && b && a.node === b.node ? a.node : null;
          const prev = runs[runs.length - 1];
          if (node && prev && prev.node === node) prev.items.push(m);
          else runs.push({ node, items: [m] });
        }
        let delta = 0;
        for (let k = runs.length - 1; k >= 0; k--) {
          const items = runs[k].items;
          const first = items[0];
          const last = items[items.length - 1];
          const r = rangeFromFlat(flatten(root), first.start, last.end);
          if (!r) continue;
          let text;
          if (items.length === 1) {
            text = L.replacementFor(oldText, first, rep, o);
          } else {
            const shifted = items.map((m) => ({ ...m, start: m.start - first.start, end: m.end - first.start }));
            text = L.applyReplacements(oldText.slice(first.start, last.end), shifted, rep, o).text;
          }
          s.removeAllRanges();
          s.addRange(r);
          insertInRich(text);
          delta += text.length - (last.end - first.start);
        }
        return delta;
      },
      reveal(i) {
        const r = t.rangeFor(matches[i]);
        const n = r && r.startContainer;
        const el = n && (n.nodeType === 1 ? n : n.parentElement);
        if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      },
    };
    return t;
  }

  // ---------------------------------------------------------------- রঙ করা: রিচ এডিটরে (Range-এর আয়তক্ষেত্র এঁকে)
  // CSS Highlight API এক্সটেনশনের আলাদা JS-জগতে পাওয়া যায় না, তাই প্রতিটা মিলের জায়গা মেপে ছায়া-স্তরে আঁকি।

  let richBoxes = [];
  let richDirty = false;

  function clearRich() {
    richClip.textContent = '';
    richClip.style.display = 'none';
    richBoxes = [];
  }

  // এডিটরের যতটুকু সত্যি দেখা যায় (স্ক্রল-করা বাবা-বাক্স আর পর্দার ভেতরে)
  function visibleBox(el) {
    const r = el.getBoundingClientRect();
    let l = Math.max(0, r.left);
    let t = Math.max(0, r.top);
    let rt = Math.min(innerWidth, r.right);
    let b = Math.min(innerHeight, r.bottom);
    for (let p = el.parentElement; p && p !== document.documentElement && p !== document.body; p = p.parentElement) {
      const cs = getComputedStyle(p);
      if (cs.overflowX === 'visible' && cs.overflowY === 'visible') continue;
      const pr = p.getBoundingClientRect();
      l = Math.max(l, pr.left);
      t = Math.max(t, pr.top);
      rt = Math.min(rt, pr.right);
      b = Math.min(b, pr.bottom);
    }
    return { left: l, top: t, width: rt - l, height: b - t };
  }

  function paintRich() {
    clearRich();
    if (!tgt || tgt.kind !== 'rich' || !matches.length) return;
    const c = visibleBox(tgt.el);
    if (c.width <= 0 || c.height <= 0) return;
    richClip.style.display = 'block';
    richClip.style.left = c.left + 'px';
    richClip.style.top = c.top + 'px';
    richClip.style.width = c.width + 'px';
    richClip.style.height = c.height + 'px';
    const frag = document.createDocumentFragment();
    const limit = Math.min(matches.length, 1500);
    for (let i = 0; i < limit; i++) {
      const r = tgt.rangeFor(matches[i]);
      if (!r) continue;
      const boxes = [];
      for (const q of r.getClientRects()) {
        if (q.width <= 0 || q.height <= 0) continue;
        if (q.bottom < c.top || q.top > c.top + c.height || q.right < c.left || q.left > c.left + c.width) continue;
        const d = mk('div', i === idx ? 'hl cur' : 'hl');
        d.style.left = q.left - c.left + 'px';
        d.style.top = q.top - c.top + 'px';
        d.style.width = q.width + 'px';
        d.style.height = q.height + 'px';
        frag.appendChild(d);
        boxes.push(d);
      }
      richBoxes[i] = boxes;
    }
    richClip.appendChild(frag);
  }

  // পাতা বা বাবা-বাক্স স্ক্রল/রিসাইজ হলে আবার আঁকতে হবে
  const markDirty = () => { if (open && tgt && tgt.kind === 'rich') richDirty = true; };
  window.addEventListener('scroll', markDirty, true);
  window.addEventListener('resize', markDirty);

  // ---------------------------------------------------------------- রঙ করা: textarea/input-এ ছায়া-স্তর

  let ovMarks = [];
  let ovGeo = '';
  function buildOverlay() {
    const el = tgt.el;
    ovIn.textContent = '';
    ovMarks = [];
    ovGeo = '';
    const text = lastText;
    const line = el instanceof HTMLInputElement ? mk('div', 'line') : null;
    const into = line || ovIn;
    let pos = 0;
    matches.forEach((m, i) => {
      if (m.start > pos) into.appendChild(document.createTextNode(text.slice(pos, m.start)));
      const mark = mk('mark', i === idx ? 'cur' : '', text.slice(m.start, m.end));
      into.appendChild(mark);
      ovMarks[i] = mark;
      pos = m.end;
    });
    into.appendChild(document.createTextNode(text.slice(pos) + (text.endsWith('\n') ? '\u200b' : '')));
    if (line) ovIn.appendChild(line);
    syncOverlay();
  }

  function paintCurrent() {
    ovMarks.forEach((m, i) => { if (m) m.className = i === idx ? 'cur' : ''; });
    richBoxes.forEach((bs, i) => { if (bs) for (const d of bs) d.className = i === idx ? 'hl cur' : 'hl'; });
  }

  const COPY = ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'fontVariant', 'fontStretch', 'letterSpacing', 'wordSpacing', 'lineHeight', 'textTransform',
    'textIndent', 'textAlign', 'tabSize', 'direction', 'textRendering', 'fontKerning', 'wordBreak', 'overflowWrap', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'];

  function syncOverlay() {
    if (!tgt || tgt.kind !== 'field') { ov.style.display = 'none'; return; }
    const el = tgt.el;
    const r = el.getBoundingClientRect();
    const visible = r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
    if (!visible) { ov.style.display = 'none'; return; }
    const geo = [r.left, r.top, el.clientWidth, el.clientHeight, el.scrollLeft, el.scrollTop, el.clientLeft, el.clientTop].join(',');
    ov.style.display = 'block';
    if (geo === ovGeo) return;
    ovGeo = geo;
    const cs = getComputedStyle(el);
    ov.style.left = r.left + el.clientLeft + 'px';
    ov.style.top = r.top + el.clientTop + 'px';
    ov.style.width = el.clientWidth + 'px';
    ov.style.height = el.clientHeight + 'px';
    for (const p of COPY) ovIn.style[p] = cs[p];
    const wsp = cs.whiteSpace;
    const noWrap = el instanceof HTMLInputElement || wsp === 'pre' || wsp === 'nowrap';
    ovIn.style.boxSizing = 'border-box';
    ovIn.style.whiteSpace = noWrap ? 'pre' : wsp;
    ovIn.style.minWidth = el.clientWidth + 'px';
    ovIn.style.width = noWrap ? 'max-content' : el.clientWidth + 'px';
    if (el instanceof HTMLInputElement) {
      ovIn.style.display = 'flex';
      ovIn.style.alignItems = 'center';
      ovIn.style.height = el.clientHeight + 'px';
    } else {
      ovIn.style.display = 'block';
      ovIn.style.height = 'auto';
    }
    ovIn.style.transform = `translate(${-el.scrollLeft}px,${-el.scrollTop}px)`;
  }

  // ---------------------------------------------------------------- অবস্থা

  let open = false;
  let tgt = null;
  let matches = [];
  let idx = -1;
  let anchor = 0;
  let lastText = '';
  let scopeRange = null;
  let scopeOn = false;
  let error = null;
  let capped = false;
  let saved = null;
  let rafId = 0;
  let mo = null;
  let moDirty = false;
  let moTimer = 0;
  let statusMsg = '';
  let statusTimer = 0;
  let panelGeo = '';

  const P = () => window.BVTPhonetic;
  const phoneticExpand = (q) => {
    const p = P();
    const w = q.trim();
    if (!p || !/^[A-Za-z`^ ]+$/.test(w)) return [];
    try { return [p.convertText(w), ...p.candidates(w, 3)]; } catch (_) { return []; }
  };
  const replacementText = () => {
    const p = P();
    if (opts.phoneticReplace && p) { try { return p.convertText(ri.value); } catch (_) {} }
    return ri.value;
  };

  function syncToggles() {
    const set = (b, on) => b.classList.toggle('on', !!on);
    set(bCase, opts.matchCase);
    set(bWord, opts.wholeWord);
    set(bRegex, opts.regex);
    set(bPho, opts.phonetic && !opts.regex);
    set(bKeep, opts.preserveCase);
    set(bPhoR, opts.phoneticReplace);
    bPho.disabled = !P() || opts.regex;
    bPhoR.disabled = !P();
    set(bScope, scopeOn);
    bScope.disabled = !scopeRange;
    renderPreview();
  }

  function renderPreview() {
    const show = opts.phoneticReplace && ri.value && /[A-Za-z]/.test(ri.value);
    pv.classList.toggle('show', !!show);
    pv.textContent = show ? '→ ' + replacementText() : '';
  }

  function clearStatus() {
    statusMsg = '';
    clearTimeout(statusTimer);
  }

  function status(msg) {
    statusMsg = msg;
    clearTimeout(statusTimer);
    statusTimer = setTimeout(() => { statusMsg = ''; renderCount(); }, 2400);
    renderCount();
  }

  function renderCount() {
    const bad = !!fi.value && (!matches.length || !!error);
    box1.classList.toggle('bad', bad);
    cnt.classList.toggle('bad', bad && !statusMsg);
    if (statusMsg) cnt.textContent = statusMsg;
    else if (error) cnt.textContent = error;
    else if (!fi.value) cnt.textContent = '';
    else if (!matches.length) cnt.textContent = 'No results';
    else cnt.textContent = `${idx + 1} of ${matches.length}${capped ? '+' : ''}`;
    const none = !matches.length;
    bPrev.disabled = bNext.disabled = none;
    bOne.disabled = bAll.disabled = none;
  }

  function currentOpts() {
    return {
      matchCase: opts.matchCase,
      wholeWord: opts.wholeWord,
      regex: opts.regex,
      preserveCase: opts.preserveCase,
      range: scopeOn && scopeRange ? scopeRange : null,
      expand: opts.phonetic && !opts.regex ? phoneticExpand : null,
    };
  }

  // keep = আগের নম্বর ধরে রাখি (বাইরে থেকে লেখা বদলালে); নইলে কার্সরের পরের প্রথম মিল
  function refresh(keep, reveal) {
    if (!open || !tgt) return;
    if (!tgt.el.isConnected) { closePanel(false); return; }
    const text = tgt.text();
    lastText = text;
    const r = L.findAll(text, fi.value, currentOpts());
    matches = r.matches;
    error = r.error;
    capped = r.capped;
    if (!matches.length) idx = -1;
    else if (keep && idx >= 0) idx = Math.min(idx, matches.length - 1);
    else {
      idx = matches.findIndex((m) => m.start >= anchor);
      if (idx < 0) idx = 0;
    }
    render(reveal);
  }

  function render(reveal) {
    renderCount();
    if (tgt.kind === 'field') {
      buildOverlay();
    } else {
      ov.style.display = 'none';
      paintRich();
    }
    if (reveal && idx >= 0) tgt.reveal(idx);
    if (reveal && idx >= 0 && tgt.kind === 'field') syncOverlay();
  }

  function go(dir) {
    if (!matches.length) return;
    idx = (idx + dir + matches.length) % matches.length;
    anchor = matches[idx].start;
    clearStatus();
    renderCount();
    paintCurrent();
    tgt.reveal(idx);
    if (tgt.kind === 'field') syncOverlay();
    else richDirty = true;
  }

  // ---------------------------------------------------------------- বদলানো

  function afterAction(refocus) {
    try { if (refocus && refocus.isConnected !== false) refocus.focus(); } catch (_) {}
  }

  function replaceOne() {
    if (!tgt || idx < 0) return;
    const back = shadow.activeElement;
    const text = tgt.text();
    if (text !== lastText) { refresh(true, true); return; } // লেখা এর মধ্যে বদলে গেছে
    const m = matches[idx];
    const rep = L.replacementFor(text, m, replacementText(), currentOpts());
    tgt.replaceOne(m, rep);
    if (scopeOn && scopeRange) scopeRange[1] += rep.length - (m.end - m.start);
    anchor = m.start + rep.length;
    refresh(false, true);
    afterAction(back);
  }

  function replaceAllMatches() {
    if (!tgt || !matches.length) return;
    const back = shadow.activeElement;
    const text = tgt.text();
    if (text !== lastText) { refresh(true, true); return; }
    if (tgt.kind === 'rich' && matches.length > MAX_RICH_REPLACE) {
      status(`Too many (${matches.length}) for this editor`);
      return;
    }
    const n = matches.length;
    const first = matches[0].start;
    const delta = tgt.replaceAll(matches, text, replacementText(), currentOpts());
    if (scopeOn && scopeRange) scopeRange[1] += delta;
    anchor = first;
    refresh(false, true);
    status(capped || matches.length ? `Replaced ${n} · ${matches.length} left` : `Replaced ${n}`);
    afterAction(back);
  }

  // ---------------------------------------------------------------- Undo / Redo (লেখার বক্সের ইতিহাসে)
  // বদলানো সবই execCommand দিয়ে হয়, তাই ব্রাউজারের নিজের Undo/Redo-তে ওঠে; এখানে সেটাই চালাই।

  function undoRedo(cmd) {
    if (!tgt) return;
    const back = shadow.activeElement;
    const before = tgt.text();
    tgt.focus();
    let ok = false;
    try { ok = document.execCommand(cmd); } catch (_) {}
    const after = tgt.text();
    if (!ok || after === before) {
      status(cmd === 'undo' ? 'Nothing to undo' : 'Nothing to redo');
      afterAction(back);
      return;
    }
    if (scopeOn && scopeRange) scopeRange[1] = Math.max(scopeRange[0], scopeRange[1] + after.length - before.length);
    anchor = tgt.sel()[0];
    refresh(false, true);
    status(cmd === 'undo' ? 'Undone' : 'Redone');
    afterAction(back);
  }

  // ---------------------------------------------------------------- খোলা / বন্ধ

  function setReplace(on) {
    panel.classList.toggle('rep', !!on);
    panelGeo = '';
  }

  function placePanel() {
    if (!tgt) return;
    const r = tgt.el.getBoundingClientRect();
    const pw = panel.offsetWidth;
    const ph = panel.offsetHeight;
    const key = [r.left, r.top, r.right, innerWidth, innerHeight, pw, ph].join(',');
    if (key === panelGeo) return;
    panelGeo = key;
    const left = Math.max(8, Math.min(r.right - pw, innerWidth - pw - 8));
    let top = r.top - ph - 6;
    if (top < 8) top = Math.max(8, Math.min(r.top + 6, innerHeight - ph - 8));
    panel.style.left = left + 'px';
    panel.style.top = top + 'px';
  }

  function loop() {
    if (!open) return;
    if (!tgt.el.isConnected) { closePanel(false); return; }
    placePanel();
    if (tgt.kind === 'field') {
      syncOverlay();
      if (tgt.el.value !== lastText) refresh(true, false);
    } else {
      if (moDirty && !moTimer) moTimer = setTimeout(() => { moTimer = 0; moDirty = false; refresh(true, false); }, 120);
      if (richDirty) { richDirty = false; paintRich(); }
    }
    rafId = requestAnimationFrame(loop);
  }

  function openPanel(el, mode) {
    mount();
    if (open && tgt && tgt.el === el) {
      if (mode === 'replace') setReplace(true);
      prefillFromSelection(false);
      fi.focus();
      fi.select();
      return;
    }
    if (open) closePanel(false);
    tgt = el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement ? fieldTarget(el) : richTarget(el);
    open = true;
    saved = tgt.save();
    scopeRange = null;
    scopeOn = false;
    prefillFromSelection(true);
    if (mode === 'replace') setReplace(true);
    else if (!panel.classList.contains('rep')) setReplace(false);
    panel.style.display = 'block';
    panelGeo = '';
    try { el.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (_) {}
    syncToggles();
    placePanel();
    if (tgt.kind === 'rich') {
      mo = new MutationObserver(() => { moDirty = true; });
      mo.observe(el, { childList: true, characterData: true, subtree: true });
    }
    refresh(false, true);
    fi.focus();
    fi.select();
    rafId = requestAnimationFrame(loop);
  }

  // নির্বাচিত লেখা: এক লাইনের ছোট হলে খোঁজার ঘরে; লম্বা/একাধিক লাইন হলে "নির্বাচিতের ভেতরে খোঁজা"
  function prefillFromSelection(fresh) {
    const [s, e] = tgt.sel();
    anchor = s;
    if (e <= s) return;
    const picked = tgt.text().slice(s, e);
    if (/\n/.test(picked) || picked.length > 120) {
      if (fresh) { scopeRange = [s, e]; scopeOn = true; }
    } else {
      fi.value = picked;
      anchor = s;
    }
  }

  function closePanel(restore) {
    if (!open) return;
    open = false;
    cancelAnimationFrame(rafId);
    clearTimeout(moTimer);
    moTimer = 0;
    moDirty = false;
    if (mo) { mo.disconnect(); mo = null; }
    panel.style.display = 'none';
    ov.style.display = 'none';
    ovIn.textContent = '';
    clearRich();
    const t = tgt;
    const m = idx >= 0 ? matches[idx] : null;
    const sv = saved;
    tgt = null;
    matches = [];
    idx = -1;
    if (restore && t && t.el.isConnected) {
      t.focus();
      if (m) t.select(m); else t.restore(sv);
    }
  }

  // ---------------------------------------------------------------- ইভেন্ট: প্যানেলের ভেতরে

  fi.addEventListener('input', () => {
    clearStatus();
    anchor = tgt && idx >= 0 && matches[idx] ? Math.min(anchor, matches[idx].start) : anchor;
    refresh(false, true);
  });
  ri.addEventListener('input', renderPreview);

  const toggleOpt = (key, btn) => {
    btn.addEventListener('click', () => {
      clearStatus();
      opts[key] = !opts[key];
      if (key === 'regex' && opts.regex) opts.phonetic = false;
      saveOpts();
      syncToggles();
      refresh(false, true);
    });
  };
  toggleOpt('matchCase', bCase);
  toggleOpt('wholeWord', bWord);
  toggleOpt('regex', bRegex);
  toggleOpt('phonetic', bPho);
  toggleOpt('preserveCase', bKeep);
  toggleOpt('phoneticReplace', bPhoR);

  bPrev.addEventListener('click', () => go(-1));
  bNext.addEventListener('click', () => go(1));
  bClose.addEventListener('click', () => closePanel(true));
  bOne.addEventListener('click', replaceOne);
  bAll.addEventListener('click', replaceAllMatches);
  bUndo.addEventListener('click', () => undoRedo('undo'));
  bRedo.addEventListener('click', () => undoRedo('redo'));
  chev.addEventListener('click', () => {
    setReplace(!panel.classList.contains('rep'));
    (panel.classList.contains('rep') ? ri : fi).focus();
  });
  bScope.addEventListener('click', () => {
    if (!scopeRange) { status('Select text first'); return; }
    clearStatus();
    scopeOn = !scopeOn;
    syncToggles();
    refresh(false, true);
  });

  // ---------------------------------------------------------------- কপি / কাট / পেস্ট (দুই ঘরেই)
  // কিছু সাইট পাতাজুড়ে copy/cut/paste (বা Ctrl+C/V/X/A) আটকে রাখে। পেজের হ্যান্ডলার আমাদের ঘরের আগে চলে,
  // তাই এখানে দেখি আটকানো হয়েছে কি না; হয়ে থাকলে নিজেরাই কপি/কাট/পেস্ট করি। আটকানো না হলে ব্রাউজারের নিজেরটাই চলে।

  const oneLine = (t) => String(t == null ? '' : t).replace(/\s*[\r\n]+\s*/g, ' ');

  function insertIntoInput(inp, text) {
    inp.focus();
    if (text === '' ? document.execCommand('delete') : document.execCommand('insertText', false, text)) return;
    const a = inp.selectionStart;
    const b = inp.selectionEnd;
    inp.setRangeText(text, a, b, 'end');
    inp.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: text === '' ? 'deleteContentBackward' : 'insertText', data: text || null }));
  }

  function wireClipboard(inp) {
    inp.addEventListener('paste', (e) => {
      if (!e.defaultPrevented) return; // সাধারণ অবস্থা: ব্রাউজারের পেস্ট
      const t = e.clipboardData && e.clipboardData.getData('text/plain');
      // ঘটনার ভেতরে না করে একটু পরে বসাই, নইলে Ctrl+Z-এর ইতিহাসে ঠিকমতো ওঠে না
      if (t) setTimeout(() => insertIntoInput(inp, oneLine(t)), 0);
    });
    const copyOrCut = (cut) => (e) => {
      if (!e.defaultPrevented) return;
      const a = inp.selectionStart;
      const b = inp.selectionEnd;
      if (a === b) return;
      try { e.clipboardData.setData('text/plain', inp.value.slice(a, b)); } catch (_) {}
      if (cut) setTimeout(() => insertIntoInput(inp, ''), 0);
    };
    inp.addEventListener('copy', copyOrCut(false));
    inp.addEventListener('cut', copyOrCut(true));
  }
  wireClipboard(fi);
  wireClipboard(ri);

  // পেজ যদি কীবোর্ডের Ctrl+C/V/X/A নিজেই আটকে দেয় (তখন ব্রাউজার copy/paste ঘটনাই ঘটায় না)
  function clipboardKey(e) {
    if (!e.defaultPrevented || e.altKey) return false;
    const inp = shadow.activeElement;
    if (inp !== fi && inp !== ri) return false;
    let k = '';
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && /^[acvx]$/i.test(e.key)) k = e.key.toLowerCase();
    else if (e.key === 'Insert' && e.shiftKey && !e.ctrlKey) k = 'v';
    else if (e.key === 'Insert' && e.ctrlKey && !e.shiftKey) k = 'c';
    else if (e.key === 'Delete' && e.shiftKey && !e.ctrlKey) k = 'x';
    if (!k) return false;
    e.preventDefault();
    if (k === 'a') inp.select();
    else if (k === 'c') document.execCommand('copy');
    else if (k === 'x') document.execCommand('cut');
    else {
      // শেষ ভরসা: Chrome এখানে একবার অনুমতি চাইতে পারে
      navigator.clipboard.readText().then((t) => insertIntoInput(inp, oneLine(t))).catch(() => status('Paste is blocked on this site'));
    }
    return true;
  }

  // প্যানেলের কী পাতার কাছে যেতে দিই না (Gmail-এর j/k ইত্যাদি যেন না চলে)
  for (const ev of ['keyup', 'keypress']) panel.addEventListener(ev, (e) => e.stopPropagation());
  panel.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (clipboardKey(e)) return;
    const k = e.key;
    if (k === 'Escape') {
      e.preventDefault();
      closePanel(true);
    } else if (k === 'Enter' && !e.isComposing) {
      if (e.target === ri) {
        e.preventDefault();
        if (e.ctrlKey || e.metaKey) replaceAllMatches(); else replaceOne();
      } else if (e.target === fi) {
        e.preventDefault();
        go(e.shiftKey ? -1 : 1);
      }
    } else if (k === 'F3') {
      e.preventDefault();
      go(e.shiftKey ? -1 : 1);
    }
  });
  panel.addEventListener('mousedown', (e) => e.stopPropagation());

  // ---------------------------------------------------------------- ইভেন্ট: পাতায় Ctrl+F / Alt+A

  window.addEventListener('keydown', (e) => {
    if (!enabled || !e.isTrusted || e.isComposing) return;

    if (open && e.key === 'Escape' && !e.ctrlKey && !e.altKey && !e.metaKey && tgt && e.target === tgt.el && e.target !== host) {
      e.preventDefault();
      e.stopImmediatePropagation();
      closePanel(true);
      return;
    }

    const isF = e.code === 'KeyF' && !e.altKey && !e.shiftKey && (e.ctrlKey || e.metaKey);
    // বদলানোর শর্টকাট: Alt+A (Mac-এ Option+A; e.code ধরি, তাই 'å' টাইপ হওয়া সমস্যা নয়)
    const isH = e.code === 'KeyA' && e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey;
    if (!isF && !isH) return;

    // প্যানেলের ভেতরে থাকলে
    if (e.target === host) {
      if (isF) {
        if (shadow.activeElement === fi) {
          // খোঁজার ঘরে থেকেই আবার Ctrl+F: প্যানেল বন্ধ করে Chrome-এর নিজের সার্চ খুলতে দিই
          closePanel(true);
          return;
        }
        e.preventDefault();
        e.stopImmediatePropagation();
        fi.focus();
        fi.select();
      } else {
        e.preventDefault();
        e.stopImmediatePropagation();
        setReplace(true);
        ri.focus();
        ri.select();
      }
      return;
    }

    const el = editableOf((e.composedPath && e.composedPath()[0]) || e.target);
    if (!el || hasOwnFind(el) || isEmptyBox(el)) return; // Chrome-এর নিজের চলুক
    e.preventDefault();
    e.stopImmediatePropagation();
    openPanel(el, isH ? 'replace' : 'find');
  }, true);

  // ---------------------------------------------------------------- কমান্ড প্যালেট (Ctrl+K) থেকে

  try {
    chrome.runtime.onMessage.addListener((msg, _s, sendResponse) => {
      if (!msg || msg.type !== 'find-replace') return;
      if (window.top !== window) return;
      if (!enabled) {
        toast('Find & Replace is off — turn it on in the extension popup');
      } else {
        const a = deepActive();
        const el = editableOf(a) || (lastEditable && lastEditable.isConnected ? lastEditable : null);
        if (!el || hasOwnFind(el)) toast('Click inside a text box first, then run Find & Replace');
        else if (isEmptyBox(el)) toast('This box is empty — type something first');
        else openPanel(el, 'replace');
      }
      sendResponse({ ok: true });
    });
  } catch (_) {
    // এক্সটেনশন রিলোড হলে পাতা রিলোড করলেই ঠিক হবে
  }
})();
