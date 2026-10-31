/* বাংলা ভয়েস টাইপিং — ফোনেটিক টাইপিং
 * দুই-তিন শব্দের জোড়া (bigram/trigram) দিয়ে: (১) আগের শব্দ দেখে বানানের তালিকা সাজানো, (২) বাংলা শব্দ + স্পেসের পরে পরের শব্দের পরামর্শ।
 * ইংরেজি কিবোর্ডে tumi লিখে স্পেস দিলে তুমি হয়ে যায়। লেখার সময় বিকল্প বানানের তালিকা দেখায় (↑ ↓ দিয়ে বাছা, Space/Enter-এ বসে)।
 * চালু/বন্ধ: পপআপের টিক বা Alt+B (পাতার ভেতরেই ধরা হয়; সেটিং `phonetic`)।
 * ইনলাইন প্রিভিউ: লেখা শব্দের ঠিক ওপরে একটা ছোট ভাসমান বাংলা প্রিভিউ — Space চাপলে যে বানান বসবে সেটাই (↑ ↓ দিলে সাথে সাথে বদলায়)। সেটিং `inlinePreview` (ডিফল্ট চালু)। */
(() => {
  'use strict';
  if (window.__bvtPhonetic) return;
  window.__bvtPhonetic = true;
  const P = globalThis.BVTPhonetic;
  if (!P) return;

  const WORD_CH = /[A-Za-z`^]/;
  const BOUNDARY_PUNCT = /^[,.?!;:"'()\[\]{}\-]$/;
  const SKIP_WORD = /^(https?|ftp|www)$/i;
  const SKIP_PREV = /[@\/\\_#]/; // ইমেইল, পাথ, হ্যাশট্যাগের অংশ হলে বদলাবে না
  const TEXT_TYPES = ['text', 'search', 'url', 'tel'];
  const FONT = '"Noto Sans Bengali","Siyam Rupali","Nirmala UI","Hind Siliguri",system-ui,sans-serif';

  let enabled = false;
  let smartPredictive = true; // contextual/personalized ranking can be disabled independently
  let nextWordOn = true; // পরের শব্দের পরামর্শ-তালিকা (আলাদা সেটিং)
  let inlineOn = true; // লেখা শব্দের ওপরে লাইভ বাংলা প্রিভিউ (সেটিং `inlinePreview`)
  let conv = null; // সর্বশেষ বদলের তথ্য: Backspace দিলে ইংরেজি ফিরিয়ে আনতে
  let cands = []; // বর্তমান শব্দের বিকল্প; সবশেষটা মূল ইংরেজি লেখা
  let sel = 0; // তালিকার কোনটা বাছা আছে
  let candWord = ''; // যে শব্দের জন্য তালিকা
  let candContext = '';
  let mode = ''; // তালিকায় কী দেখানো হচ্ছে: 'cand' = বানানের বিকল্প, 'pred' = পরের শব্দের পরামর্শ
  let predList = [];
  let predSel = -1; // -১ = কিছু বাছা হয়নি (↓ দিলে শুরু)
  let predKey = '';
  let predDismissed = '';
  let lastCommittedWord = '';
  let lastCommittedEl = null;
  let dismissed = ''; // Esc দিয়ে বন্ধ করা শব্দ
  const BN_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];

  // আগে বেছে নেওয়া বানান: { ইংরেজি লেখা: বাংলা } — পরের বার ওই শব্দ লিখলে সেটা সবার আগে আসে
  let learned = {};
  let choiceStats = {}; // { roman: { chosenOutput: count } }
  let contextStats = {}; // { previousRoman\troman: { chosenOutput: count } }
  let customWords = {}; // user-defined roman -> Bangla
  let userNgrams = { bi: {}, tri: {} }; // নিজের লেখা থেকে শেখা জোড়া: bi[আগের][পরের], tri['আগের২ আগের১'][পরের]
  let learnTimer = 0;

  function loadLearned() {
    try {
      chrome.storage.local.get({ phoneticLearned: {}, phoneticChoiceStats: {}, phoneticContextStats: {}, phoneticCustomWords: {}, phoneticNgrams: {} }, (s) => {
        learned = (s && s.phoneticLearned) || {};
        choiceStats = (s && s.phoneticChoiceStats) || {};
        contextStats = (s && s.phoneticContextStats) || {};
        customWords = (s && s.phoneticCustomWords) || {};
        setNgrams(s && s.phoneticNgrams);
        candWord = '';
        candContext = '';
      });
    } catch (_) {}
  }

  function saveLearningSoon() {
    clearTimeout(learnTimer);
    learnTimer = setTimeout(() => {
      try {
        chrome.storage.local.set({
          phoneticLearned: learned,
          phoneticChoiceStats: choiceStats,
          phoneticContextStats: contextStats,
          phoneticCustomWords: customWords,
          phoneticNgrams: userNgrams
        });
      } catch (_) {}
    }, 250);
  }

  // import করা/পুরনো ডেটা যেন ভুল ফরম্যাটে লাইব্রেরি ভাঙতে না পারে
  function setNgrams(raw) {
    const clean = (tbl) => {
      const out = {};
      if (!tbl || typeof tbl !== 'object') return out;
      for (const ctx of Object.keys(tbl)) {
        const row = tbl[ctx];
        if (!row || typeof row !== 'object') continue;
        const r = {};
        for (const w of Object.keys(row)) if (Number.isFinite(row[w]) && row[w] > 0) r[w] = row[w];
        if (Object.keys(r).length) out[ctx] = r;
      }
      return out;
    };
    userNgrams = { bi: clean(raw && raw.bi), tri: clean(raw && raw.tri) };
    if (P.setUserNgrams) P.setUserNgrams(userNgrams);
  }

  const NG_ROW_MAX = 20;
  const NG_BI_MAX = 4000;
  const NG_TRI_MAX = 6000;
  function bumpNgram(tbl, ctx, word, cap) {
    if (!tbl[ctx]) {
      tbl[ctx] = {};
      if (Object.keys(tbl).length > cap) delete tbl[Object.keys(tbl)[0]]; // সবচেয়ে পুরনো কনটেক্সট বাদ
    }
    const row = tbl[ctx];
    row[word] = (row[word] || 0) + 1;
    const keys = Object.keys(row);
    if (keys.length > NG_ROW_MAX) {
      let low = keys[0];
      for (const k of keys) if (row[k] < row[low]) low = k;
      if (low !== word) delete row[low];
    }
  }

  // কনটেক্সটে (আগের ১-২টা বাংলা শব্দ) এই শব্দ বসানো হলো — মনে রাখি, পরের বার আগে আসবে
  function learnNgram(ctx, bn) {
    const word = String(bn || '').normalize('NFC');
    if (!/^[\u0980-\u09FF]+$/.test(word) || !ctx || !ctx.length) return;
    const c = ctx.slice(-2);
    bumpNgram(userNgrams.bi, c[c.length - 1], word, NG_BI_MAX);
    if (c.length >= 2) bumpNgram(userNgrams.tri, c[0] + ' ' + c[1], word, NG_TRI_MAX);
    if (P.setUserNgrams) P.setUserNgrams(userNgrams);
    saveLearningSoon();
  }

  // টেক্সটের শেষ দিক থেকে বর্তমান বাক্যের শেষ ২টা বাংলা শব্দ (ইংরেজি শব্দ বা বাক্যশেষ চিহ্নে থেমে যায়)
  function banglaCtx(before) {
    const seg = String(before).split(/[।?!.\n\r]/).pop();
    const toks = seg.split(/\s+/).filter(Boolean);
    const out = [];
    for (let i = toks.length - 1; i >= 0 && out.length < 2; i--) {
      const t = toks[i].replace(/^[,;:"'()\[\]{}\-]+|[,;:"'()\[\]{}\-]+$/g, '');
      if (!/^[\u0980-\u09FF]+$/.test(t)) break;
      out.unshift(t.normalize('NFC'));
    }
    return out;
  }

  function learn(word, bn, prevWord, ctx) {
    if (!word || !bn) return;
    if (ctx && bn !== word) learnNgram(ctx, bn);
    const key = word.toLowerCase();
    if (!choiceStats[key]) choiceStats[key] = {};
    choiceStats[key][bn] = (choiceStats[key][bn] || 0) + 1;
    // Context-specific counts only apply when a preceding Roman word exists.
    if (prevWord) {
      const pair = prevWord.toLowerCase() + '\t' + key;
      if (!contextStats[pair]) contextStats[pair] = {};
      contextStats[pair][bn] = (contextStats[pair][bn] || 0) + 1;
    }
    // Keep a legacy last-choice record for compatibility/export, but ranking uses counts.
    const standard = (P.defaultFor || P.transliterate)(word);
    if (bn === standard) delete learned[word];
    else learned[word] = bn;
    if (Object.keys(choiceStats).length > 5000) delete choiceStats[Object.keys(choiceStats)[0]];
    if (Object.keys(contextStats).length > 10000) delete contextStats[Object.keys(contextStats)[0]];
    saveLearningSoon();
  }

  function listFor(word, prevWord = '', ctx = []) {
    const lower = String(word).toLowerCase();
    const ctxKey = prevWord + '\u0001' + (smartPredictive ? ctx.join(' ') : '');
    if (word !== candWord || ctxKey !== candContext) {
      candWord = word;
      candContext = ctxKey;
      const custom = customWords[lower];
      const base = P.suggest ? P.suggest(word, 8, 5, smartPredictive ? ctx : null) : P.candidates(word, 10); // আংশিক লেখার সাজেশনসহ
      let list = base.slice();
      if (custom) list = [custom, ...list.filter((x) => x !== custom)];
      else if (smartPredictive) {
        // Smart prediction ranks suggestions using repeated choices and previous-word context.
        // This is local personalization; no text is sent to a remote AI service.
        const global = choiceStats[lower] || {};
        const pair = prevWord ? contextStats[prevWord.toLowerCase() + '\t' + lower] || {} : {};
        const count = (x) => global[x] || 0;
        const contextCount = (x) => pair[x] || 0;
        list.sort((a, b) => {
          const ca = contextCount(a), cb = contextCount(b);
          const ga = count(a), gb = count(b);
          const ra = ca >= 2 ? ca : 0, rb = cb >= 2 ? cb : 0;
          if (ra !== rb) return rb - ra;
          const gRa = ga >= 2 ? ga : 0, gRb = gb >= 2 ? gb : 0;
          return gRb - gRa;
        });
        // Migrate a previous learned choice only if no counted history exists for that word.
        const legacy = learned[word] || learned[lower];
        if (legacy && !Object.keys(global).length && list.includes(legacy)) list = [legacy, ...list.filter((x) => x !== legacy)];
      }
      cands = list.length ? [...list.slice(0, 14), word] : []; // শেষে মূল ইংরেজি
      // custom word should also be available even if normal transliteration has no candidates
      if (custom && !cands.includes(custom)) cands.unshift(custom);
      sel = 0;
    }
    return cands;
  }
  const popupOpen = () => !!host && host.style.display !== 'none';
  const candOpen = () => popupOpen() && mode === 'cand';
  const predOpen = () => popupOpen() && mode === 'pred' && predList.length > 0;

  // ---------------------------------------------------------------- লেখার জায়গা

  const isField = (el) => el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement;

  function editable(el) {
    if (!el || el.nodeType !== 1) return null;
    if (el instanceof HTMLTextAreaElement) return el.disabled || el.readOnly ? null : el;
    if (el instanceof HTMLInputElement) {
      return !el.disabled && !el.readOnly && TEXT_TYPES.includes(el.type) ? el : null; // password বাদ
    }
    return el.isContentEditable ? el : null;
  }

  function insert(el, text) {
    if (document.execCommand('insertText', false, text)) return;
    if (isField(el)) {
      const s = el.selectionStart;
      const e = el.selectionEnd;
      el.setRangeText(text, s, e, 'end');
      el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
      return;
    }
    const sel = getSelection();
    if (sel && sel.rangeCount) {
      const r = sel.getRangeAt(0);
      r.deleteContents();
      const t = document.createTextNode(text);
      r.insertNode(t);
      r.setStartAfter(t);
      r.collapse(true);
      sel.removeAllRanges();
      sel.addRange(r);
      el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
    }
  }

  // কার্সরের ঠিক আগের ইংরেজি শব্দ (না থাকলে null) + সেটা বদলানোর ফাংশন
  function wordBefore(el) {
    if (isField(el)) {
      if (el.selectionStart !== el.selectionEnd || el.selectionStart == null) return null;
      const pos = el.selectionStart;
      const v = el.value;
      let s = pos;
      while (s > 0 && WORD_CH.test(v[s - 1])) s--;
      if (s === pos) return null;
      if (s > 0 && SKIP_PREV.test(v[s - 1])) return null;
      const before = v.slice(0, s);
      const prev = before.match(/([A-Za-z`^]+)[\s,.?!;:]*$/);
      return {
        text: v.slice(s, pos),
        ctx: banglaCtx(before),
        prevWord: prev ? prev[1] : (lastCommittedEl === el && /[\u0980-\u09FF][\s,.?!;:]*$/.test(before) ? lastCommittedWord : ''),
        apply(str) { el.setSelectionRange(s, pos); insert(el, str); },
      };
    }
    const sel = getSelection();
    if (!sel || !sel.rangeCount || !sel.isCollapsed) return null;
    const node = sel.anchorNode;
    if (!node || node.nodeType !== 3 || !el.contains(node)) return null;
    const v = node.data;
    const pos = sel.anchorOffset;
    let s = pos;
    while (s > 0 && WORD_CH.test(v[s - 1])) s--;
    if (s === pos) return null;
    if (s > 0 && SKIP_PREV.test(v[s - 1])) return null;
    const before = v.slice(0, s);
    const prev = before.match(/([A-Za-z`^]+)[\s,.?!;:]*$/);
    return {
      text: v.slice(s, pos),
      ctx: banglaCtx(before),
      prevWord: prev ? prev[1] : (lastCommittedEl === el && /[\u0980-\u09FF][\s,.?!;:]*$/.test(before) ? lastCommittedWord : ''),
      apply(str) {
        const r = document.createRange();
        r.setStart(node, s);
        r.setEnd(node, pos);
        sel.removeAllRanges();
        sel.addRange(r);
        insert(el, str);
      },
    };
  }

  // কার্সরের ঠিক আগে "বাংলা শব্দ + একটা স্পেস" থাকলে আগের ১-২টা বাংলা শব্দ (পরের শব্দের পরামর্শের কনটেক্সট); না থাকলে null
  function spaceContext(el) {
    let before;
    if (isField(el)) {
      if (el.selectionStart !== el.selectionEnd || el.selectionStart == null) return null;
      before = el.value.slice(0, el.selectionStart);
    } else {
      const sel = getSelection();
      if (!sel || !sel.rangeCount || !sel.isCollapsed) return null;
      const node = sel.anchorNode;
      if (!node || node.nodeType !== 3 || !el.contains(node)) return null;
      before = node.data.slice(0, sel.anchorOffset);
    }
    if (!/[\u0980-\u09FF][ \u00a0]$/.test(before)) return null;
    const ctx = banglaCtx(before);
    return ctx.length ? ctx : null;
  }

  // বদলের ঠিক পরে Backspace দিলে ইংরেজি লেখা ফিরে আসে
  function tryRevert(el, e) {
    if (!conv || conv.el !== el) return false;
    const seq = conv.bn + conv.tail;
    const len = seq.length;
    const norm = (x) => x.replace(/\u00a0/g, ' ');
    if (isField(el)) {
      if (el.selectionStart !== el.selectionEnd) return false;
      const pos = el.selectionStart;
      if (pos < len || norm(el.value.slice(pos - len, pos)) !== seq) return false;
      e.preventDefault();
      el.setSelectionRange(pos - len, pos);
      insert(el, conv.orig + conv.origTail);
    } else {
      const sel = getSelection();
      if (!sel || !sel.rangeCount || !sel.isCollapsed) return false;
      const node = sel.anchorNode;
      if (!node || node.nodeType !== 3 || !el.contains(node)) return false;
      const pos = sel.anchorOffset;
      if (pos < len || norm(node.data.slice(pos - len, pos)) !== seq) return false;
      e.preventDefault();
      const r = document.createRange();
      r.setStart(node, pos - len);
      r.setEnd(node, pos);
      sel.removeAllRanges();
      sel.addRange(r);
      insert(el, conv.orig + conv.origTail);
    }
    conv = null;
    return true;
  }

  // ---------------------------------------------------------------- কী-প্রেস

  function onKeyDown(e) {
    if (e.isTrusted && e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && e.code === 'KeyB') {
      // Alt+B: চালু/বন্ধ (Chrome-এর commands সীমা ৪টা, তাই পাতার ভেতরেই ধরা হয়)
      e.preventDefault();
      try { chrome.storage.sync.set({ phonetic: !enabled }); } catch (_) {}
      return;
    }
    if (!enabled || !e.isTrusted || e.isComposing) return;
    const k = e.key;
    if (k === 'Shift' || k === 'Control' || k === 'Alt' || k === 'Meta' || k === 'CapsLock') return;
    const el = editable(e.target);
    if (!el) return;
    if (e.ctrlKey || e.metaKey || e.altKey) { conv = null; return; }
    if (k === 'Backspace') {
      if (!tryRevert(el, e)) conv = null;
      return;
    }
    if (predOpen()) {
      if (k === 'ArrowDown') {
        e.preventDefault();
        e.stopImmediatePropagation();
        predSel = (predSel + 1) % predList.length;
        renderList();
        return;
      }
      if (k === 'ArrowUp' && predSel >= 0) { // কিছু বাছা না থাকলে ↑ কার্সর সরাতে দেয়
        e.preventDefault();
        e.stopImmediatePropagation();
        predSel -= 1;
        renderList();
        return;
      }
      if (k === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        predDismissed = predKey;
        hidePreview();
        return;
      }
      if (k === 'Tab' || (k === 'Enter' && predSel >= 0)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        acceptPrediction(el, predSel >= 0 ? predSel : 0);
        return;
      }
    }
    if (k.length === 1 && WORD_CH.test(k)) { conv = null; return; } // শব্দ জমছে

    if (candOpen() && cands.length) {
      if (/^[1-9]$/.test(k) && Number(k) <= cands.length) {
        e.preventDefault();
        e.stopImmediatePropagation();
        pick(Number(k) - 1);
        return;
      }
      if (k === 'ArrowDown' || k === 'ArrowUp') {
        e.preventDefault();
        e.stopImmediatePropagation();
        sel = (sel + (k === 'ArrowDown' ? 1 : cands.length - 1)) % cands.length;
        renderList();
        return;
      }
      if (k === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        dismissed = candWord;
        hidePreview();
        return;
      }
    }

    let tail;
    if (k === ' ') tail = ' ';
    else if (k === 'Enter' || k === 'Tab') tail = '';
    else if (BOUNDARY_PUNCT.test(k)) tail = k;
    else { conv = null; return; } // সংখ্যা, তীরচিহ্ন ইত্যাদি

    const w = wordBefore(el);
    if (!w || SKIP_WORD.test(w.text)) { conv = null; return; }
    const list = listFor(w.text, w.prevWord, w.ctx);
    const bn = list.length ? list[Math.min(sel, list.length - 1)] : '';
    if (!bn) { conv = null; hidePreview(); return; }
    if (bn === w.text) { // মূল ইংরেজি বাছা: যেমন আছে তেমন, আর মনে রাখা
      if (sel > 0 || learned[w.text] === w.text) learn(w.text, bn, w.prevWord);
      conv = null; candWord = ''; hidePreview(); return;
    }
    learn(w.text, bn, w.prevWord, w.ctx);

    if (k === '.') {
      // শব্দের পরের ফুলস্টপ → দাঁড়ি
      e.preventDefault();
      w.apply(bn + '।');
      conv = { el, bn, orig: w.text, tail: '।', origTail: '.' };
      lastCommittedWord = w.text; lastCommittedEl = el;
      candWord = ''; candContext = '';
      hidePreview();
      return;
    }
    w.apply(bn);
    conv = tail ? { el, bn, orig: w.text, tail, origTail: tail } : null;
    lastCommittedWord = w.text; lastCommittedEl = el;
    candWord = ''; candContext = '';
    hidePreview();
  }

  // ---------------------------------------------------------------- ইনলাইন প্রিভিউ (শব্দের ওপরে ভাসমান)

  let ghost = null;
  let ghostBox = null;

  function ensureGhost() {
    if (ghost) return;
    ghost = document.createElement('div');
    ghost.style.cssText = 'all:initial;position:fixed;z-index:2147483647;display:none;pointer-events:none;';
    const root = ghost.attachShadow({ mode: 'closed' });
    root.innerHTML =
      '<style>' +
      '.g{font:17px/1.3 ' + FONT + ';padding:1px 8px;border-radius:6px;background:#fff;color:#1a0dab;' +
      'border:1px solid #dadce0;box-shadow:0 1px 6px rgba(0,0,0,.25);white-space:nowrap;user-select:none;' +
      'text-decoration:underline;text-underline-offset:3px}' +
      '@media (prefers-color-scheme:dark){.g{background:#2d2e30;color:#8ab4f8;border-color:#5f6368}}' +
      '</style><div class="g"></div>';
    ghostBox = root.querySelector('.g');
    document.documentElement.appendChild(ghost);
  }

  function hideGhost() {
    if (ghost) ghost.style.display = 'none';
  }

  // তীর চেপে বাছাই বদলালে প্রিভিউর লেখাও সাথে সাথে বদলায়
  function paintGhost() {
    if (!ghost || !ghostBox || mode !== 'cand' || ghost.style.display === 'none') return;
    ghostBox.textContent = cands[sel] || '';
  }

  // input/textarea-তে কার্সর কোথায় তা সরাসরি জানার উপায় নেই; তাই একই স্টাইলের একটা লুকানো আয়না দিয়ে মাপা হয়
  function fieldCaretRect(el, idx) {
    const cs = getComputedStyle(el);
    const d = document.createElement('div');
    const st = d.style;
    const props = ['boxSizing', 'width', 'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'fontVariant', 'letterSpacing', 'wordSpacing',
      'textTransform', 'textIndent', 'lineHeight', 'tabSize', 'direction',
      'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
      'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
      'borderTopStyle', 'borderRightStyle', 'borderBottomStyle', 'borderLeftStyle'];
    for (const p of props) st[p] = cs[p];
    const multi = el instanceof HTMLTextAreaElement;
    st.position = 'fixed'; st.top = '0'; st.left = '0'; st.visibility = 'hidden'; st.overflow = 'hidden'; st.height = 'auto';
    st.whiteSpace = multi ? 'pre-wrap' : 'pre';
    st.wordWrap = multi ? 'break-word' : 'normal';
    d.textContent = el.value.slice(0, idx);
    const m = document.createElement('span');
    m.textContent = '\u200b';
    d.appendChild(m);
    document.documentElement.appendChild(d);
    const er = el.getBoundingClientRect();
    const left = er.left + el.clientLeft + m.offsetLeft - el.scrollLeft;
    const top = er.top + el.clientTop + m.offsetTop - el.scrollTop;
    const height = m.offsetHeight;
    d.remove();
    if (top < er.top - 4 || top > er.bottom) return null; // কার্সর ফিল্ডের দেখা অংশের বাইরে
    return { left, top, bottom: top + height };
  }

  // এখন লেখা ইংরেজি শব্দটার বক্স (শুরুর দিক); না পেলে null
  function wordRect(el) {
    const len = candWord.length;
    if (!len) return null;
    if (isField(el)) {
      const pos = el.selectionStart;
      if (pos == null || pos < len) return null;
      return fieldCaretRect(el, pos - len);
    }
    const s = getSelection();
    if (!s || !s.rangeCount || !s.isCollapsed) return null;
    const node = s.anchorNode;
    const off = s.anchorOffset;
    if (!node || node.nodeType !== 3 || off < len) return null;
    const r = document.createRange();
    r.setStart(node, off - len);
    r.setEnd(node, off);
    const rects = r.getClientRects();
    return rects.length && rects[0].height > 0 ? rects[0] : null;
  }

  function showGhost(el) {
    if (!inlineOn || !cands.length) { hideGhost(); return; }
    const r = wordRect(el);
    if (!r) { hideGhost(); return; }
    ensureGhost();
    ghostBox.textContent = cands[sel] || '';
    ghost.style.visibility = 'hidden';
    ghost.style.display = 'block';
    const b = ghostBox.getBoundingClientRect();
    const top = r.top - b.height - 4;
    if (top < 4) { hideGhost(); return; } // ওপরে জায়গা নেই: প্রিভিউ না দেখানোই ভালো (নিচে তো তালিকা আছে)
    ghost.style.top = top + 'px';
    ghost.style.left = Math.min(Math.max(4, r.left), Math.max(4, innerWidth - b.width - 4)) + 'px';
    ghost.style.visibility = 'visible';
  }

  // ---------------------------------------------------------------- বিকল্পের তালিকা

  let host = null;
  let listEl = null;

  function ensurePreview() {
    if (host) return;
    host = document.createElement('div');
    host.style.cssText = 'all:initial;position:fixed;z-index:2147483647;display:none;';
    const root = host.attachShadow({ mode: 'closed' });
    root.innerHTML =
      '<style>' +
      '.l{font:16px/1.3 ' + FONT + ';min-width:96px;padding:4px;border-radius:8px;background:#fff;color:#202124;' +
      'border:1px solid #dadce0;box-shadow:0 2px 10px rgba(0,0,0,.3);user-select:none;max-height:300px;overflow-y:auto}' +
      '.i{display:flex;gap:8px;padding:4px 10px;border-radius:5px;cursor:pointer;white-space:nowrap}' +
      '.i b{font-weight:400;color:#5f6368}' +
      '.i.s{background:#e8eaed}' +
      '.i.o{color:#5f6368}' +
      '.h{padding:2px 10px 4px;font-size:12px;color:#5f6368;white-space:nowrap}' +
      '@media (prefers-color-scheme:dark){.l{background:#2d2e30;color:#e8eaed;border-color:#5f6368}' +
      '.i b,.i.o{color:#9aa0a6}.i.s{background:#44474a}}' +
      '</style><div class="l"></div>';
    listEl = root.querySelector('.l');
    // তালিকায় ক্লিক করলে ইনপুট থেকে ফোকাস সরবে না
    listEl.addEventListener('mousedown', (e) => e.preventDefault());
    listEl.addEventListener('click', (e) => {
      const it = e.target.closest ? e.target.closest('.i') : null;
      if (!it) return;
      pick(Number(it.dataset.n));
    });
    document.documentElement.appendChild(host);
  }

  function renderList() {
    listEl.textContent = '';
    const pred = mode === 'pred';
    const items = pred ? predList : cands;
    const cur = pred ? predSel : sel;
    if (pred) {
      const hd = document.createElement('div');
      hd.className = 'h';
      hd.textContent = 'পরের শব্দ · ↓ বাছুন · Tab বসান';
      listEl.appendChild(hd);
    }
    items.forEach((c, n) => {
      const it = document.createElement('div');
      it.className = 'i' + (n === cur ? ' s' : '') + (!pred && c === candWord ? ' o' : '');
      it.dataset.n = String(n);
      if (!pred) {
        const num = document.createElement('b');
        num.textContent = String(n + 1).replace(/[0-9]/g, (d) => BN_DIGITS[d] || '০') + '.';
        it.appendChild(num);
      }
      const txt = document.createElement('span');
      txt.textContent = c;
      it.appendChild(txt);
      listEl.appendChild(it);
    });
    const curEl = listEl.querySelector('.s');
    if (curEl && curEl.scrollIntoView) curEl.scrollIntoView({ block: 'nearest' });
    paintGhost();
  }

  // স্পেসের পর পরের শব্দের পরামর্শ: বাছা শব্দ + স্পেস বসে, তারপর পরের পরামর্শ আসে
  function acceptPrediction(el, n) {
    const word = predList[n];
    if (!word) return;
    const ctx = spaceContext(el) || [];
    predKey = ''; predSel = -1; predDismissed = '';
    conv = null;
    candWord = ''; candContext = '';
    lastCommittedWord = ''; lastCommittedEl = null; // রোমান আগের-শব্দ আর নেই; জোড়া শেখা বাংলা শব্দ দিয়ে
    hidePreview();
    learnNgram(ctx, word);
    insert(el, word + ' '); // input ইভেন্টে আবার updatePreview চলে, তাই পরের পরামর্শ নিজে থেকে আসে
  }

  function updatePrediction(el) {
    if (!nextWordOn || !P.predictNext) { hidePreview(); return; }
    const ctx = spaceContext(el);
    if (!ctx) { hidePreview(); return; }
    const key = ctx.join(' ');
    if (predDismissed && key !== predDismissed) predDismissed = '';
    if (key === predDismissed) { hidePreview(); return; }
    if (key !== predKey || !predList.length) {
      predKey = key;
      predList = P.predictNext(ctx, 6);
      predSel = -1;
    }
    if (!predList.length) { hidePreview(); return; }
    showPreview(el, 'pred');
  }

  // মাউস ক্লিকে বাছা
  function pick(n) {
    const el = editable(document.activeElement);
    if (!el) return;
    if (mode === 'pred') { acceptPrediction(el, n); return; }
    const w = wordBefore(el);
    if (!w) return;
    const list = listFor(w.text, w.prevWord, w.ctx);
    const bn = list[n];
    if (bn) learn(w.text, bn, w.prevWord, w.ctx);
    if (bn && bn !== w.text) w.apply(bn);
    if (bn) { lastCommittedWord = w.text; lastCommittedEl = el; }
    conv = null;
    candWord = ''; candContext = '';
    hidePreview();
  }

  function hidePreview() {
    if (host) host.style.display = 'none';
    hideGhost();
    if (mode === 'pred') predKey = ''; // পরের বার আবার ঠিকমতো শুরু
    mode = '';
  }

  function anchorRect(el) {
    if (!isField(el)) {
      const s = getSelection();
      if (s && s.rangeCount) {
        const rects = s.getRangeAt(0).getClientRects();
        if (rects.length && rects[0].height > 0) return rects[0];
      }
    }
    return el.getBoundingClientRect();
  }

  function showPreview(el, m) {
    ensurePreview();
    mode = m || 'cand';
    renderList();
    host.style.visibility = 'hidden';
    host.style.display = 'block';
    const h = listEl.getBoundingClientRect().height || 200;
    const r = anchorRect(el);
    let top = r.bottom + 6;
    if (top + h > innerHeight - 4) top = Math.max(4, r.top - h - 6);
    const left = Math.min(Math.max(4, r.left), Math.max(4, innerWidth - 180));
    host.style.top = top + 'px';
    host.style.left = left + 'px';
    host.style.visibility = 'visible';
    if (mode === 'cand') showGhost(el); else hideGhost();
  }

  function updatePreview() {
    if (!enabled) { hidePreview(); return; }
    const el = editable(document.activeElement);
    if (!el) { hidePreview(); return; }
    const w = wordBefore(el);
    if (!w) { updatePrediction(el); return; } // লেখা শব্দ নেই: স্পেসের পরে হলে পরের শব্দের পরামর্শ
    if (SKIP_WORD.test(w.text)) { hidePreview(); return; }
    if (w.text === dismissed) { hidePreview(); return; }
    dismissed = '';
    if (!listFor(w.text, w.prevWord, w.ctx).length) { hidePreview(); return; }
    // তীর/শিফট চাপলে (keyup) বাছাই যেন না বদলায় — শুধু তালিকা ঠিক জায়গায় দেখানো
    showPreview(el);
  }

  // ---------------------------------------------------------------- চালু/বন্ধের বার্তা

  let toastHost = null;
  let toastBox = null;
  let toastTimer = 0;

  function toast(text) {
    if (window !== window.top) return;
    if (!toastHost) {
      toastHost = document.createElement('div');
      toastHost.style.cssText = 'all:initial;position:fixed;z-index:2147483647;left:50%;bottom:28px;transform:translateX(-50%);pointer-events:none;display:none;';
      const root = toastHost.attachShadow({ mode: 'closed' });
      root.innerHTML =
        '<style>.t{font:600 14px/1.4 ' + FONT + ';padding:8px 16px;border-radius:999px;background:#202124;color:#fff;' +
        'box-shadow:0 2px 10px rgba(0,0,0,.4)}</style><div class="t"></div>';
      toastBox = root.querySelector('.t');
      document.documentElement.appendChild(toastHost);
    }
    toastBox.textContent = text;
    toastHost.style.display = 'block';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastHost.style.display = 'none'; }, 1800);
  }

  // ---------------------------------------------------------------- শুরু

  document.addEventListener('keydown', onKeyDown, true);
  for (const ev of ['input', 'keyup', 'click', 'focusin']) document.addEventListener(ev, updatePreview, true);
  document.addEventListener('focusout', hidePreview, true);
  addEventListener('scroll', hidePreview, true);
  addEventListener('resize', hidePreview);

  loadLearned();
  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local') {
        if (changes.phoneticLearned) learned = changes.phoneticLearned.newValue || {};
        if (changes.phoneticChoiceStats) choiceStats = changes.phoneticChoiceStats.newValue || {};
        if (changes.phoneticContextStats) contextStats = changes.phoneticContextStats.newValue || {};
        if (changes.phoneticCustomWords) customWords = changes.phoneticCustomWords.newValue || {};
        if (changes.phoneticNgrams) setNgrams(changes.phoneticNgrams.newValue);
        candWord = '';
        candContext = '';
      }
    });
    chrome.storage.sync.get({ phonetic: false, smartPredictive: true, nextWord: true, inlinePreview: true }, (s) => {
      enabled = !!(s && s.phonetic);
      inlineOn = !s || s.inlinePreview !== false;
      smartPredictive = !s || s.smartPredictive !== false;
      nextWordOn = !s || s.nextWord !== false;
    });
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'sync') return;
      if (changes.smartPredictive) {
        smartPredictive = changes.smartPredictive.newValue !== false;
        candWord = '';
        candContext = '';
        hidePreview();
      }
      if (changes.inlinePreview) {
        inlineOn = changes.inlinePreview.newValue !== false;
        hidePreview();
      }
      if (changes.nextWord) {
        nextWordOn = changes.nextWord.newValue !== false;
        hidePreview();
      }
      if (!changes.phonetic) return;
      enabled = !!changes.phonetic.newValue;
      conv = null;
      hidePreview();
      if (document.hasFocus()) {
        toast(enabled ? 'ফোনেটিক বাংলা টাইপিং: চালু ✓' : 'ফোনেটিক বাংলা টাইপিং: বন্ধ');
      }
    });
  } catch (_) {
    // এক্সটেনশন রিলোডের পর পুরনো পাতায় এটা কাজ করবে না — পাতা রিলোড দিলে ঠিক হবে
  }
})();
