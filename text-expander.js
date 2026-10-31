/* বাংলা ভয়েস টাইপিং — টেক্সট এক্সপান্ডার
 * ছোট কোড (যেমন ;thx) লিখে Space / Tab / Enter দিলে পুরো লেখা বসে যায়। পপআপে কোড আর লেখা ঠিক করা যায়।
 * লেখায় {date} {time} {day} বসানো যায়, আর {cursor} দিলে বসার পর কার্সর ওখানে থাকে।
 * সেটিং chrome.storage.local-এ: expEnabled, expMode ('key' | 'instant'), expSnippets { কোড: লেখা } */
(() => {
  'use strict';
  if (window.__bvtExpander) return;
  window.__bvtExpander = true;

  const TEXT_TYPES = ['text', 'search', 'url', 'tel'];
  const WS = /[\s\u00a0]/;
  const MAX_BEFORE = 80; // কার্সরের আগের এতটুকু অংশই দেখি

  let enabled = true;
  let mode = 'key';
  let snippets = {};
  let triggers = []; // বড় কোড আগে, যাতে instant মোডে লম্বা কোড আগে মেলে
  let busy = false;

  function applySettings(s) {
    enabled = s.expEnabled !== false;
    mode = s.expMode === 'instant' ? 'instant' : 'key';
    const raw = s.expSnippets && typeof s.expSnippets === 'object' ? s.expSnippets : {};
    snippets = {};
    for (const [k, v] of Object.entries(raw)) {
      if (typeof k === 'string' && typeof v === 'string' && k && v) snippets[k] = v;
    }
    triggers = Object.keys(snippets).sort((a, b) => b.length - a.length);
  }

  try {
    chrome.storage.local.get({ expEnabled: true, expMode: 'key', expSnippets: {} }, (s) => applySettings(s || {}));
    chrome.storage.onChanged.addListener((ch, area) => {
      if (area !== 'local' || !(ch.expEnabled || ch.expMode || ch.expSnippets)) return;
      chrome.storage.local.get({ expEnabled: true, expMode: 'key', expSnippets: {} }, (s) => applySettings(s || {}));
    });
  } catch (_) {
    // এক্সটেনশন রিলোড হলে পাতা রিলোড করলেই ঠিক হবে
  }

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

  // কার্সরের আগের লেখা + সেই অংশের শেষ n অক্ষর বেছে নেওয়ার ফাংশন
  function context(el) {
    if (isField(el)) {
      if (el.selectionStart == null || el.selectionStart !== el.selectionEnd) return null;
      const pos = el.selectionStart;
      return {
        before: el.value.slice(Math.max(0, pos - MAX_BEFORE), pos),
        select(n) { el.setSelectionRange(pos - n, pos); },
      };
    }
    const sel = getSelection();
    if (!sel || !sel.rangeCount || !sel.isCollapsed) return null;
    const node = sel.anchorNode;
    if (!node || node.nodeType !== 3 || !el.contains(node)) return null;
    const pos = sel.anchorOffset;
    return {
      before: node.data.slice(Math.max(0, pos - MAX_BEFORE), pos),
      select(n) {
        const r = document.createRange();
        r.setStart(node, pos - n);
        r.setEnd(node, pos);
        sel.removeAllRanges();
        sel.addRange(r);
      },
    };
  }

  function put(el, text) {
    if (isField(el)) {
      if (document.execCommand('insertText', false, text)) return;
      const s = el.selectionStart;
      const e = el.selectionEnd;
      el.setRangeText(text, s, e, 'end');
      el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
      return;
    }
    // রিচ এডিটরে নতুন লাইন Shift+Enter-এর মতো (চ্যাটে মেসেজ পাঠিয়ে দেয় না)
    const lines = text.split('\n');
    lines.forEach((ln, i) => {
      if (i) document.execCommand('insertLineBreak');
      if (ln) document.execCommand('insertText', false, ln);
    });
  }

  function moveBack(el, n) {
    if (n <= 0) return;
    try {
      if (isField(el)) {
        const p = Math.max(0, el.selectionStart - n);
        el.setSelectionRange(p, p);
      } else {
        const sel = getSelection();
        for (let i = 0; i < n; i++) sel.modify('move', 'backward', 'character');
      }
    } catch (_) {}
  }

  // ---------------------------------------------------------------- বসানো

  function fill(raw) {
    const d = new Date();
    let text = raw.replace(/\{(date|time|day|cursor)\}/gi, (m, name) => {
      switch (name.toLowerCase()) {
        case 'date': return d.toLocaleDateString('en-GB'); // 17/10/2026
        case 'time': return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        case 'day': return d.toLocaleDateString('en-US', { weekday: 'long' });
        default: return '\u0001';
      }
    });
    let back = 0;
    const i = text.indexOf('\u0001');
    if (i >= 0) {
      const after = text.slice(i + 1).replace(/\u0001/g, '');
      text = text.slice(0, i) + after;
      back = after.length;
    }
    return { text, back };
  }

  function expand(el, c, trig, tail) {
    const { text, back } = fill(snippets[trig]);
    busy = true;
    try {
      c.select(trig.length);
      put(el, text + (back ? '' : tail));
      moveBack(el, back);
    } finally {
      busy = false;
    }
  }

  // কার্সরের ঠিক আগের শব্দ (ফাঁক পর্যন্ত) যদি কোনো কোড হয়
  function exactTrigger(before) {
    const m = before.match(/[^\s\u00a0]+$/);
    return m && Object.prototype.hasOwnProperty.call(snippets, m[0]) ? m[0] : null;
  }

  // instant মোড: কার্সরের আগের লেখা কোনো কোড দিয়ে শেষ হলে (আর আগে ফাঁক বা শুরু থাকলে)
  function suffixTrigger(before) {
    for (const t of triggers) {
      if (!before.endsWith(t)) continue;
      const prev = before.length > t.length ? before[before.length - t.length - 1] : '';
      if (!prev || WS.test(prev)) return t;
    }
    return null;
  }

  // ---------------------------------------------------------------- ইভেন্ট

  function onKeyDown(e) {
    if (!enabled || mode !== 'key' || !triggers.length || !e.isTrusted || e.isComposing) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key;
    let tail;
    if (k === ' ') tail = ' ';
    else if ((k === 'Enter' || k === 'Tab') && !e.shiftKey) tail = '';
    else return;
    const el = editable(e.target);
    if (!el) return;
    const c = context(el);
    if (!c) return;
    const trig = exactTrigger(c.before);
    if (!trig) return;
    e.preventDefault();
    e.stopImmediatePropagation(); // ফোনেটিক টাইপিং বা পাতার নিজের কী-হ্যান্ডলারে যেন না যায়
    expand(el, c, trig, tail);
  }

  function onInput(e) {
    if (!enabled || mode !== 'instant' || busy || !triggers.length || !e.isTrusted) return;
    if (e.inputType !== 'insertText' || e.isComposing) return;
    const el = editable(e.target);
    if (!el) return;
    const c = context(el);
    if (!c) return;
    const trig = suffixTrigger(c.before);
    if (trig) expand(el, c, trig, '');
  }

  window.addEventListener('keydown', onKeyDown, true); // window-এর ক্যাপচার: ফোনেটিক টাইপিংয়ের (document) আগে চলে
  window.addEventListener('input', onInput, true);
})();
