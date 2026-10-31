/* বাংলা ভয়েস টাইপিং — বাংলা বানান যাচাইয়ের মূল অংশ (DOM-এর কিছু নেই; Node দিয়ে টেস্ট করা যায়)
 * bn-words.js-এর শব্দতালিকা (root.BVTBnFreq) দিয়ে ঠিক করে কোন শব্দ তালিকায় নেই।
 * ভুল ধরা কমাতে (ঠিক শব্দে দাগ না পড়তে): বিভক্তি/বচন/ক্রিয়ার সাধারণ প্রত্যয় ছেঁটে মূল শব্দ খোঁজা হয়,
 * আর দুটো চেনা শব্দ জুড়ে তৈরি যুক্তশব্দও (বইমেলা) ঠিক ধরা হয়।
 * ব্যবহার: BVTSpell.findMisspelled(text) → [{ start, end, word }]
 *          BVTSpell.suggest(word, 6) → ['সুন্দর', …] (ভুল শব্দের কাছাকাছি চেনা শব্দ)
 *          BVTSpell.addKnown([…]) / setKnown(গ্রুপ, […]) — নিজের শব্দ (ফোনেটিক কাস্টম শব্দ, অভিধান ইত্যাদি) ঠিক বলে ধরাতে */
(function (root) {
  'use strict';

  const MIN_STEM_FREQ = 5; // প্রত্যয় ছাঁটার পর মূল শব্দের ফ্রিকোয়েন্সি কমপক্ষে এতটা হতে হবে (তালিকার ৩-এর ছিটেফোঁটা ধরা হবে না)
  const MIN_PART_FREQ = 15; // যুক্তশব্দের প্রতিটা অংশের জন্য
  const MAX_DEPTH = 3; // কয়টা প্রত্যয় পরপর ছাঁটা যাবে (ছেলে+দের+কে+ও)
  const MAX_WORD_LEN = 40; // এর চেয়ে লম্বা হলে যাচাই করি না

  // বাংলা অক্ষরের টানা অংশ (ZWNJ/ZWJ সহ)। ০-৯ অঙ্ক আর চিহ্ন পরে আলাদা করে বাদ দিই।
  const RUN = /[\u0980-\u09FF\u200c\u200d]+/g;
  const HAS_DIGIT_OR_SYMBOL = /[\u09e6-\u09ef\u09f2-\u09fe]/;
  const LATIN_NEIGHBOR = /[A-Za-z0-9_@#\/\\]/;
  const VOWEL_END = /[\u0985-\u0994\u09be-\u09cc\u09d7]$/; // স্বরবর্ণ বা কারে শেষ (হসন্ত ্ বাদ)

  // শব্দের শেষে জোড়া প্রত্যয়: [প্রত্যয়, শর্ত] — শর্ত 'a' সব জায়গায়, 'c' ব্যঞ্জনে শেষ হওয়া মূলের পর, 'v' স্বরে শেষ হওয়া মূলের পর
  const SUFFIX_DEFS = [
    // বচন ও নির্দেশক
    ['গুলো', 'a'], ['গুলি', 'a'], ['গুলোর', 'a'], ['গুলোকে', 'a'], ['টা', 'a'], ['টি', 'a'], ['টুকু', 'a'], ['খানা', 'a'], ['খানি', 'a'],
    ['জন', 'a'], ['গণ', 'a'], ['বৃন্দ', 'a'], ['রা', 'v'], ['েরা', 'c'], ['দের', 'a'], ['দেরকে', 'a'],
    // কারক
    ['কে', 'a'], ['র', 'v'], ['ের', 'c'], ['য়ের', 'v'], ['তে', 'v'], ['য়', 'v'], ['ে', 'c'], ['য়ে', 'v'], ['েতে', 'c'],
    // ক্লিটিক
    ['ও', 'a'], ['ই', 'a'], ['তো', 'a'], ['ো', 'c'],
    // ক্রিয়া (মূল ধাতু ব্যঞ্জনে শেষ: কর, বল, দেখ)
    ['ছি', 'c'], ['ছ', 'c'], ['ছে', 'c'], ['ছেন', 'c'], ['ছিস', 'c'], ['ছিল', 'c'], ['ছিলাম', 'c'], ['ছিলে', 'c'], ['ছিলেন', 'c'], ['ছিলো', 'c'], ['ছো', 'c'],
    ['লাম', 'c'], ['লে', 'c'], ['লেন', 'c'], ['লি', 'c'], ['ল', 'c'], ['লো', 'c'],
    ['ব', 'c'], ['বে', 'c'], ['বেন', 'c'], ['বি', 'c'], ['বো', 'c'],
    ['তাম', 'c'], ['তেন', 'c'], ['তিস', 'c'], ['ত', 'c'], ['তে', 'c'],
    ['ুক', 'c'], ['ুন', 'c'], ['েন', 'c'], ['ি', 'c'], ['িস', 'c'], ['ে', 'c'],
    // ক্রিয়া (মূল ধাতু স্বরে শেষ: যা, খা, দে)
    ['চ্ছি', 'v'], ['চ্ছ', 'v'], ['চ্ছে', 'v'], ['চ্ছেন', 'v'], ['চ্ছিস', 'v'], ['চ্ছিল', 'v'], ['চ্ছিলাম', 'v'], ['চ্ছিলেন', 'v'],
    ['ব', 'v'], ['বে', 'v'], ['বেন', 'v'], ['বি', 'v'], ['বো', 'v'], ['লাম', 'v'], ['লে', 'v'], ['লেন', 'v'], ['ই', 'v'],
    // শব্দ গড়ার প্রত্যয় (সভাপতি+ত্বে, ভদ্র+তা, অর্থ+হীন)
    ['ত্ব', 'a'], ['ত্বে', 'a'], ['ত্বের', 'a'], ['ত্বকে', 'a'], ['তা', 'a'], ['তার', 'a'], ['তায়', 'a'], ['তাকে', 'a'], ['তাই', 'a'],
    ['বাদ', 'a'], ['বাদী', 'a'], ['হীন', 'a'], ['পূর্ণ', 'a'], ['ময়', 'a'], ['কারী', 'a'], ['শীল', 'a'], ['ভাবে', 'a'], ['মূলক', 'a'],
    // ক্রিয়াবাচক
    ['নো', 'a'], ['ানো', 'c'], ['ানোর', 'c'], ['নোর', 'a'], ['বার', 'a'], ['ার', 'c'], ['া', 'c'], ['ায়', 'c'], ['ার', 'a'],
  ];
  const SUFFIXES = SUFFIX_DEFS.slice().sort((a, b) => b[0].length - a[0].length);

  // ---------------------------------------------------------------- শব্দভান্ডার

  let words = null; // Map: স্বাভাবিক রূপ → ফ্রিকোয়েন্সি
  const groups = Object.create(null); // নিজের জুড়ে দেওয়া শব্দ: গ্রুপের নাম → Set (নিজের কাস্টম শব্দ, ব্যবহারকারীর অভিধান, এই সেশনে এড়ানো শব্দ)
  const origOf = new Map(); // স্বাভাবিক রূপ → তালিকায় যেভাবে লেখা (সাজেশনে মূল রূপ ফেরাতে)
  const inExtra = (w) => { for (const g in groups) if (groups[g].has(w)) return true; return false; };

  function norm(w) {
    return String(w).normalize('NFC').replace(/[\u200c\u200d]/g, '');
  }

  function load() {
    if (words) return words;
    words = new Map();
    let F = root.BVTBnFreq;
    if (!F && typeof require === 'function') {
      try { F = require('./bn-words.js'); } catch (_) { F = null; }
    }
    if (F) {
      for (const k of Object.keys(F)) {
        const n = norm(k);
        if (n !== k && !origOf.has(n)) origOf.set(n, k);
        words.set(n, Math.max(words.get(n) || 0, F[k] || 1));
      }
    }
    // হাতে-লেখা প্রচলিত শব্দের তালিকা (phonetic-dict.js): রোমান → [বাংলা, …]
    const D = root.BVTPhoneticDict;
    if (D) {
      for (const k of Object.keys(D)) {
        for (const bn of D[k]) {
          const n = norm(bn);
          if (n !== bn && !origOf.has(n)) origOf.set(n, bn);
          words.set(n, Math.max(words.get(n) || 0, 1000));
        }
      }
    }
    return words;
  }

  // এই সেশনে জুড়ে দেওয়া শব্দ (যেমন "এড়িয়ে যাও")
  function addKnown(list) {
    const g = groups.misc || (groups.misc = new Set());
    for (const w of list || []) {
      const n = norm(w);
      if (n) g.add(n);
    }
    cache.clear();
  }

  // একটা গ্রুপের শব্দ পুরোটা বদলে দেয় (আগের গুলো মুছে); স্টোরেজ বদলালে এটা ডাকা হয়
  function setKnown(group, list) {
    const set = new Set();
    for (const w of list || []) {
      const n = norm(w);
      if (n) set.add(n);
    }
    groups[group] = set;
    cache.clear();
  }

  function ready() {
    return load().size > 0;
  }

  const freqOf = (w) => (load().get(w) || 0);
  const knownAny = (w) => inExtra(w) || load().has(w);

  // ---------------------------------------------------------------- যাচাই

  function stemOk(w, depth) {
    if (depth > 0) {
      if (inExtra(w) || freqOf(w) >= MIN_STEM_FREQ) return true;
    } else if (knownAny(w)) return true;
    if (depth >= MAX_DEPTH) return false;
    for (const [suf, cond] of SUFFIXES) {
      if (w.length <= suf.length + 1) continue; // মূল শব্দ অন্তত ২ অক্ষর
      if (!w.endsWith(suf)) continue;
      const stem = w.slice(0, -suf.length);
      const stemVowel = VOWEL_END.test(stem);
      if (cond === 'c' && stemVowel) continue;
      if (cond === 'v' && !stemVowel) continue;
      if (stem.length < 2) continue;
      // এক অক্ষরের প্রত্যয়ে মূল শব্দ অন্তত ৩ অক্ষর না হলে ধরি না (ছিটকে আসা মিল ঠেকাতে)
      if (suf.length === 1 && stem.length < 3) continue;
      if (stemOk(stem, depth + 1)) return true;
    }
    return false;
  }

  // দুটো শব্দ জোড়া: বা-দিকের অংশ চেনা শব্দ, ডান-দিকের অংশ প্রত্যয়সহ চেনা
  function compoundOk(w) {
    if (w.length < 5) return false;
    for (let i = 2; i <= w.length - 2; i++) {
      const left = w.slice(0, i);
      if (VOWEL_END.test(left) === false && /\u09cd$/.test(left)) continue; // হসন্তে শেষ অংশ ভাঙা যুক্তবর্ণ
      if (freqOf(left) < MIN_PART_FREQ && !inExtra(left)) continue;
      const right = w.slice(i);
      if (/^[\u09be-\u09cd\u0981-\u0983]/.test(right)) continue; // কার/হসন্ত দিয়ে শুরু হওয়া অংশ হয় না
      if (right.length >= 2 && (freqOf(right) >= MIN_PART_FREQ || inExtra(right) || stemOk(right, 1))) return true;
    }
    return false;
  }

  const cache = new Map();
  const CACHE_MAX = 20000;

  // একটা শব্দ ঠিক বানানের কি না
  function isKnown(word) {
    const w = norm(word);
    if (!w || w.length > MAX_WORD_LEN) return true;
    if (cache.has(w)) return cache.get(w);
    const ok = knownAny(w) || stemOk(w, 0) || compoundOk(w);
    if (cache.size >= CACHE_MAX) cache.clear();
    cache.set(w, ok);
    return ok;
  }

  // শব্দ হিসেবে যাচাইয়ের যোগ্য কি না (অঙ্ক, চিহ্ন, এক অক্ষর, ইংরেজির সঙ্গে লাগা শব্দ বাদ)
  function checkable(text, start, end) {
    const tok = text.slice(start, end);
    if (HAS_DIGIT_OR_SYMBOL.test(tok)) return false;
    const letters = tok.replace(/[\u200c\u200d]/g, '');
    if (letters.length < 2) return false; // এক অক্ষরের শব্দ (যেমন ও, এ) যাচাই করি না
    if (!/[\u0995-\u09b9\u09dc-\u09df\u0985-\u0994\u09ce]/.test(letters)) return false; // একটাও অক্ষর নেই
    const prev = start > 0 ? text[start - 1] : '';
    const next = end < text.length ? text[end] : '';
    if (prev && LATIN_NEIGHBOR.test(prev)) return false;
    if (next && LATIN_NEIGHBOR.test(next)) return false;
    if (/^[\u09be-\u09cd\u0981-\u0983\u09d7]/.test(letters)) return false; // কার দিয়ে শুরু = আগের লেখার ছেঁড়া অংশ
    return true;
  }

  // লেখা থেকে ভুল বানানের জায়গা: [{ start, end, word }]; skipRange = [from, to] দিলে ওই জায়গা ছুঁয়ে থাকা শব্দ বাদ
  function findMisspelled(text, skipRange) {
    const out = [];
    if (!text || !ready()) return out;
    RUN.lastIndex = 0;
    let m;
    while ((m = RUN.exec(text))) {
      const start = m.index;
      const end = start + m[0].length;
      if (skipRange && skipRange[0] <= end && skipRange[1] >= start) continue;
      if (!checkable(text, start, end)) continue;
      const word = m[0];
      if (!isKnown(word)) out.push({ start, end, word });
    }
    return out;
  }

  // ---------------------------------------------------------------- সাজেশন

  const MIN_SUGGEST_FREQ = 15; // তালিকার ছিটেফোঁটা (ভুল) শব্দ সাজেশনে আনি না

  // দুই শব্দের দূরত্ব (বদল, বাদ, যোগ, পাশাপাশি অদলবদল = ১); max ছাড়ালে max+1 ফেরত
  function editDistance(a, b, max) {
    const n = a.length;
    const m = b.length;
    if (Math.abs(n - m) > max) return max + 1;
    let prev2 = null;
    let prev = new Array(m + 1);
    for (let j = 0; j <= m; j++) prev[j] = j;
    for (let i = 1; i <= n; i++) {
      const cur = new Array(m + 1);
      cur[0] = i;
      let rowMin = cur[0];
      for (let j = 1; j <= m; j++) {
        const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
        let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
        if (prev2 && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
        cur[j] = v;
        if (v < rowMin) rowMin = v;
      }
      if (rowMin > max) return max + 1;
      prev2 = prev;
      prev = cur;
    }
    return prev[m];
  }

  // ভুল শব্দের কাছাকাছি চেনা শব্দ: আগে কম দূরত্ব, তারপর বেশি ব্যবহার হওয়া (সর্বোচ্চ max টা)
  function suggestRanked(word, max) {
    const w = norm(word);
    const limit = Math.max(1, max || 6);
    if (!w || !ready()) return [];
    const lim = w.length <= 3 ? 1 : 2;
    const found = [];
    for (const [k, f] of load()) {
      if (f < MIN_SUGGEST_FREQ || k === w) continue;
      if (Math.abs(k.length - w.length) > lim) continue;
      const d = editDistance(w, k, lim);
      if (d <= lim) found.push({ w: origOf.get(k) || k, d, f });
    }
    found.sort((x, y) => x.d - y.d || y.f - x.f);
    return found.slice(0, limit); // [{ w, d (দূরত্ব), f (ব্যবহারের হার) }]
  }

  function suggest(word, max) {
    return suggestRanked(word, max).map((x) => x.w);
  }

  const api = { findMisspelled, isKnown, addKnown, setKnown, suggest, suggestRanked, ready, norm };
  root.BVTSpell = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
