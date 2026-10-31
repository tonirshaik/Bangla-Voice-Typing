/* বাংলা ভয়েস টাইপিং — ফোনেটিক টাইপিং (ইংরেজি হরফে লিখলে বাংলা)
 * এখানে DOM-এর কোনো কাজ নেই, তাই Node দিয়ে আলাদাভাবে টেস্ট করা যায়।
 * নিয়ম অনেকটা Avro-র মতো, তবে daily chat-এর জন্য কিছু বদল আছে (README দেখুন)। */
(function (root) {
  'use strict';

  const HASANTA = '\u09CD';
  const NUKTA = '\u09BC';

  // [লেখা, বাংলা] — ছোট হাতের ও বড় হাতের হরফ আলাদা (T = ট, t = ত)
  const CONS = [
    ['kkh', 'ক্ষ'], ['GG', 'জ্ঞ'],
    ['chh', 'ছ'], ['ch', 'ছ'], ['kh', 'খ'], ['gh', 'ঘ'], ['Ng', 'ঙ'], ['NG', 'ঞ'],
    ['jh', 'ঝ'], ['Th', 'ঠ'], ['Dh', 'ঢ'], ['th', 'থ'], ['dh', 'ধ'], ['ph', 'ফ'], ['bh', 'ভ'],
    ['sh', 'শ'], ['Sh', 'ষ'], ['Rh', '\u09A2' + NUKTA],
    ['k', 'ক'], ['g', 'গ'], ['c', 'চ'], ['j', 'জ'], ['T', 'ট'], ['D', 'ড'], ['N', 'ণ'],
    ['t', 'ত'], ['d', 'দ'], ['n', 'ন'], ['p', 'প'], ['f', 'ফ'], ['b', 'ব'], ['v', 'ভ'],
    ['m', 'ম'], ['z', 'য'], ['y', '\u09AF' + NUKTA], ['r', 'র'], ['l', 'ল'], ['S', 'শ'], ['s', 'স'],
    ['h', 'হ'], ['R', '\u09A1' + NUKTA], ['x', 'ক্স'], ['q', 'ক'],
  ];

  // [লেখা, স্বতন্ত্র রূপ, কার]
  const VOW = [
    ['rri', 'ঋ', 'ৃ'], ['oi', 'ঐ', 'ৈ'], ['ou', 'ঔ', 'ৌ'],
    ['aa', 'আ', 'া'], ['ii', 'ঈ', 'ী'], ['ee', 'ঈ', 'ী'], ['uu', 'ঊ', 'ূ'], ['oo', 'উ', 'ু'],
    ['a', 'আ', 'া'], ['i', 'ই', 'ি'], ['u', 'উ', 'ু'], ['e', 'এ', 'ে'], ['o', 'অ', ''],
    ['O', 'ও', 'ো'], ['I', 'ঈ', 'ী'], ['U', 'ঊ', 'ূ'],
  ];

  const TOKENS = [];
  for (const [k, b] of CONS) TOKENS.push({ k, t: 'c', b });
  for (const [k, ind, kar] of VOW) TOKENS.push({ k, t: 'v', ind, kar });
  TOKENS.push({ k: 'rr', t: 'rr', b: 'র' }); // জোর করে যুক্তাক্ষর/রেফ: korrmo → কর্ম
  TOKENS.push({ k: 'ng', t: 'ng' }, { k: 'w', t: 'w' });
  TOKENS.sort((a, b) => b.k.length - a.k.length); // লম্বা মিল আগে
  const LOWER_TOKENS = TOKENS.filter((x) => x.k === x.k.toLowerCase());

  // কোন দুই বর্ণ নিজে থেকে যুক্ত হবে। বাকিগুলো যুক্ত হয় না (korbo → করবো, korchi → করছি)।
  const JOIN_PAIRS = new Set(
    ('কক কত গগ গধ চচ চছ চঞ জজ জঝ টট ডড ণড ণট ণঠ ণণ ণঢ তত তথ তন তম দদ দধ দব দম দভ ' +
      'নত নথ নদ নধ নন নট নড নম পপ পত পট পস পল ফল বব বদ বজ বধ বল বভ মম মপ মব মভ মফ ' +
      'লল লপ লট লড শচ শন ষট ষঠ ষণ ষক ষপ ষম সত সথ সট সক সখ সপ সফ সন সম হম হন হণ হল ' +
      'ঞচ ঞজ ঞছ ঞঝ').split(' ')
  );
  // র-ফলা (ক্র, প্র, ত্র…) যে বর্ণের পরে বসে
  const R_OK = new Set('কখগঘচজটডতথদধপফবভশষসহ'.split(''));

  const lastBase = (b) => {
    const c = b[b.length - 1];
    return c === NUKTA ? b[b.length - 2] : c;
  };

  function shouldJoin(prevB, key, b) {
    if (key === 'y' || key === 'z') return true; // য-ফলা
    if (prevB === '\u0999') return true; // ঙ্ক, ঙ্গ
    if (b === 'র') return R_OK.has(prevB);
    if (b.length !== 1) return false;
    return JOIN_PAIRS.has(prevB + b);
  }

  // একটি শব্দ (শুধু a-z, `, ^) → বাংলা
  function transliterate(word) {
    const s = String(word == null ? '' : word);
    const lower = s.toLowerCase();
    const n = s.length;
    let out = '';
    let prevC = false; // শেষে একটা ব্যঞ্জনবর্ণ আছে (স্বরচিহ্ন ছাড়া)
    let lastB = '';
    let joinedLast = false; // শেষ ব্যঞ্জন আগেরটার সঙ্গে যুক্ত
    let force = false; // পরের ব্যঞ্জন জোর করে যুক্ত হবে
    let i = 0;
    while (i < n) {
      const ch = s[i];
      if (ch === '`') { prevC = false; joinedLast = false; force = false; i++; continue; }
      if (ch === '^') { out += '\u0981'; prevC = false; joinedLast = false; force = false; i++; continue; }

      let tok = null;
      for (const t of TOKENS) if (s.startsWith(t.k, i)) { tok = t; break; }
      if (!tok) for (const t of LOWER_TOKENS) if (lower.startsWith(t.k, i)) { tok = t; break; }
      if (!tok) { out += ch; prevC = false; joinedLast = false; force = false; i++; continue; }
      const next = i + tok.k.length;

      if (tok.t === 'c' || tok.t === 'rr') {
        const b = tok.b;
        const join = prevC && (force || shouldJoin(lastB, tok.k, b));
        if (join && (tok.k === 'y' || tok.k === 'z')) {
          out += HASANTA + '\u09AF';
          lastB = '\u09AF';
        } else {
          out += (join ? HASANTA : '') + b;
          lastB = lastBase(b);
        }
        joinedLast = join;
        prevC = true;
        force = tok.t === 'rr';
      } else if (tok.t === 'ng') {
        if (/[kg]/i.test(s[next] || '')) {
          out += '\u0999'; // ঙ (পরে ক/গ আসছে)
          prevC = true; lastB = '\u0999';
        } else {
          out += '\u0982'; // ং
          prevC = false;
        }
        joinedLast = false; force = false;
      } else if (tok.t === 'w') {
        if (prevC) { out += HASANTA + '\u09AC'; lastB = '\u09AC'; joinedLast = true; }
        else { out += '\u0993'; prevC = false; joinedLast = false; }
        force = false;
      } else {
        if (tok.k === 'o') {
          const atEnd = next >= n;
          if (prevC) {
            // শব্দের শেষে একক ব্যঞ্জনের পর o → ো (ভালো, আছো); যুক্তাক্ষরের পর নয় (বন্ধ, সত্য)
            if (atEnd && !joinedLast) out += '\u09CB';
          } else {
            out += i === 0 && !atEnd ? '\u0985' : '\u0993';
          }
        } else {
          out += prevC ? tok.kar : tok.ind;
        }
        prevC = false; joinedLast = false; force = false;
      }
      i = next;
    }
    return out;
  }

  // ---------------------------------------------------- বিল্ট-ইন শব্দতালিকা

  // phonetic-dict.js আগে লোড হলে root.BVTPhoneticDict থাকে; Node-এ require দিয়ে আনা হয়।
  // নিয়ম দিয়ে ভুল বানান হয় এমন শব্দ (jonno → জন্ন) এখানে থেকে ঠিক রূপে আসে।
  let dictCache = null;
  function dict() {
    if (dictCache) return dictCache;
    let d = root.BVTPhoneticDict;
    if (!d && typeof require === 'function') {
      try { d = require('./phonetic-dict.js'); } catch (_) { d = null; }
    }
    if (d) dictCache = d; // না পেলে ক্যাশ করা হয় না, পরে আবার চেষ্টা করবে
    return d || null;
  }

  // তালিকায় থাকলে বাংলা রূপগুলোর অ্যারে (প্রথমটা প্রধান), না থাকলে null
  function lookup(word) {
    const d = dict();
    const v = d ? d[word] : null;
    return v && v.length ? v : null;
  }

  // ছোট, সতর্ক ইংরেজি allowlist: মিশ্র লেখায় সাধারণ English শব্দ যেন অকারণে বাংলায় না বদলে যায়।
  // Dictionary match সবসময় আগে—ami/ki/na-র মতো বাংলা-অগ্রাধিকার শব্দ English list-এ নেই।
  // তালিকাটি ইচ্ছাকৃতভাবে curated; অজানা শব্দগুলো আগের phonetic নিয়মেই চলবে।
  const ENGLISH_WORDS = new Set((
    'meeting project computer office file update thanks hello please english website browser extension ' +
    'code test regression script terminal keyboard typing backspace phone laptop internet account password ' +
    'login email message video audio image translate search setting settings option mode feature install ' +
    'download upload save open close start stop working work today tomorrow yesterday morning evening night ' +
    'good morning afternoon sorry problem issue help support team company manager client customer service ' +
    'document folder file name button click screen window tab page link website mobile desktop android chrome ' +
    'javascript python node command commandline error warning success failed pass fail result output input ' +
    'text word sentence language bangla bengali english number date time calendar plan task note report ' +
    'project meeting call zoom google microsoft github vscode extension terminal folder backup restore copy paste ' +
    'delete remove add edit change create build run check test testing version latest online offline free premium ' +
    'profile account payment order product price shipping delivery return refund support contact address phone number ' +
    'photo picture video music movie download upload attach file format pdf image screenshot settings privacy security ' +
    'password username login logout sign in sign out verify verification code link button option select choose ' +
    'welcome congratulations available ready busy important urgent correct wrong simple easy fast slow new old ' +
    'thanks thank sorry welcome okay ok yes no maybe please really exactly example sample demo official public ' +
    'design premium professional quality update updated version issue fixed feature mode default english words'
  ).split(/\s+/).filter((word) => word.length >= 4));

  // শব্দের সাধারণ রূপ: বাংলা dictionary-কে অগ্রাধিকার, তারপর পরিচিত English, তারপর phonetic নিয়ম।
  function defaultFor(word) {
    const w = String(word == null ? '' : word);
    const v = lookup(w) || (w !== w.toLowerCase() ? lookup(w.toLowerCase()) : null);
    if (v) return v[0];
    if (ENGLISH_WORDS.has(w.toLowerCase())) return w; // মূল capitalization অক্ষত রাখে
    if (freqs()) { const c = candidates(w, 1); if (c.length) return c[0]; }
    return transliterate(w);
  }

  // বাক্যের ভেতর থেকে ইংরেজি শব্দগুলো বাংলা করে (সংখ্যা/চিহ্ন যেমন আছে তেমন)
  function convertText(text) {
    return String(text == null ? '' : text).replace(/[A-Za-z`^]+/g, (w) => defaultFor(w));
  }


  // ---------------------------------------------------- বিকল্প বানান (সাজেশন)

  // একই ইংরেজি লেখার অন্য সম্ভাব্য বানান পেতে লেখার অংশ বদলানোর নিয়ম (আগেরগুলো বেশি দরকারি)
  const SUBS = [
    ['o', 'O'], ['t', 'T'], ['d', 'D'], ['n', 'N'], ['s', 'S'], ['r', 'R'], ['i', 'I'], ['u', 'U'],
    ['e', 'i'], ['ch', 'c'], ['c', 'ch'], ['sh', 's'], ['s', 'sh'], ['th', 'Th'], ['dh', 'Dh'],
    ['i', 'e'], ['u', 'o'], ['o', 'u'], ['j', 'z'], ['z', 'j'], ['b', 'v'], ['v', 'b'], ['f', 'ph'],
    ['i', 'ii'], ['u', 'uu'],
    ['k', 'kh'], ['g', 'gh'], ['t', 'th'], ['d', 'dh'], ['p', 'ph'], ['b', 'bh'],
    ['kh', 'k'], ['gh', 'g'], ['th', 't'], ['dh', 'd'], ['ph', 'p'], ['bh', 'b'],
    ['ng', 'Ng'], ['n', 'ng'],
  ];

  function oneEdit(w) {
    const res = [];
    for (const [a, b] of SUBS) {
      let idx = w.indexOf(a);
      while (idx !== -1) {
        res.push(w.slice(0, idx) + b + w.slice(idx + a.length));
        idx = w.indexOf(a, idx + 1);
      }
    }
    if (/[^o]o$/.test(w)) res.push(w.slice(0, -1)); // শেষের o বাদ (ভালো ↔ ভাল)
    return res;
  }

  // ---------------------------------------------------- বড় শব্দভান্ডার (ফ্রিকোয়েন্সিসহ)

  // bn-words.js আগে লোড হলে root.BVTBnFreq = { বাংলা শব্দ: ফ্রিকোয়েন্সি } থাকে।
  // না থাকলে বা খালি হলে আগের মতোই চলে। বানাতে: node build-wordlist.js corpus.txt
  let freqCache = null;
  function freqs() {
    if (freqCache) return freqCache;
    let f = root.BVTBnFreq;
    if (!f && typeof require === 'function') {
      try { f = require('./bn-words.js'); } catch (_) { f = null; }
    }
    if (f && Object.keys(f).length) freqCache = f;
    return freqCache;
  }

  const POOL_MAX = 800;

  // শব্দভান্ডার থাকলে ক্রম: হাতে-লেখা তালিকা → (১ বদলের মধ্যে) সত্যিকারের শব্দ, ফ্রিকোয়েন্সি অনুযায়ী
  // → নিয়মের রূপ → ২ বদলের সত্যিকারের শব্দ → বাকি বিকল্প।
  function rankedCandidates(w, limit, main, F) {
    const known = lookup(w);
    const head = known ? known.slice() : [];
    const seen = new Set(head);
    const pool = [];
    const add = (bn, lvl) => {
      if (bn && !seen.has(bn) && pool.length < POOL_MAX) { seen.add(bn); pool.push({ bn, lvl }); }
    };
    add(main, 0);
    const L1 = oneEdit(w);
    for (const v of L1) add(transliterate(v), 1);
    if (w.length <= 10) {
      for (const v of L1) {
        for (const u of oneEdit(v)) add(transliterate(u), 2);
        if (pool.length >= POOL_MAX) break;
      }
    }
    const byFreq = (a, b) => (F[b.bn] || 0) - (F[a.bn] || 0);
    const real = pool.filter((p) => F[p.bn] > 0);
    const close = real.filter((p) => p.lvl <= 1).sort(byFreq);
    const far = real.filter((p) => p.lvl === 2).sort(byFreq);
    const out = head.slice();
    const push = (bn) => { if (!out.includes(bn)) out.push(bn); };
    close.forEach((p) => push(p.bn));
    push(main);
    far.forEach((p) => push(p.bn));
    pool.forEach((p) => push(p.bn));
    return out.slice(0, limit);
  }

  // ফেরত: আগে তালিকার রূপ (থাকলে), তারপর নিয়মে বানানো রূপ, তারপর অন্য বিকল্প (সর্বোচ্চ max টা)।
  // মূল ইংরেজি লেখা এখানে নেই।
  function candidates(word, max) {
    const w = String(word == null ? '' : word);
    const limit = max || 10;
    const main = transliterate(w);
    if (!main) return [];
    const F = freqs();
    if (F) return rankedCandidates(w, limit, main, F);
    const known = lookup(w);
    const out = known ? known.slice() : [];
    if (!out.includes(main)) out.push(main);
    const seen = new Set(out);
    if (out.length >= limit) return out.slice(0, limit);
    const take = (list) => {
      for (const v of list) {
        const bn = transliterate(v);
        if (bn && !seen.has(bn)) {
          seen.add(bn);
          out.push(bn);
          if (out.length >= limit) return true;
        }
      }
      return false;
    };
    const L1 = oneEdit(w);
    if (take(L1) || w.length > 12) return out;
    for (const v of L1) if (take(oneEdit(v))) break;
    return out;
  }

  // ---------------------------------------------------- আংশিক লেখা থেকে সাজেশন (autocomplete)

  // `dhonno` লেখা অবস্থাতেই ধন্যবাদ দেখানো: পুরো শব্দ শেষ হওয়ার অপেক্ষা নেই।
  // দুই জায়গা থেকে খোঁজে: (১) হাতে-লেখা তালিকার ইংরেজি-লেখা, যেগুলো এই অংশ দিয়ে শুরু;
  // (২) বড় শব্দভান্ডার, যেগুলো অংশটার বাংলা রূপ (আর ১ বদলের রূপ) দিয়ে শুরু, ফ্রিকোয়েন্সি অনুযায়ী।
  const COMPLETE_MIN = 3; // এর কম অক্ষরে সাজেশন আসে না (খুব বেশি আজেবাজে মিল হয়)
  const SCAN_MAX = 6000; // একটা অংশের জন্য সর্বোচ্চ এতটা শব্দ দেখা হবে

  let sortedCache = null;
  let sortedFor = null;
  let dictKeysCache = null;
  let dictKeysFor = null;
  // Predictive-result cache: একই prefix বারবার টাইপ/ব্যাকস্পেস করলে দ্রুত ফল দেয়।
  const completionCache = new Map();
  const COMPLETION_CACHE_MAX = 300;
  function sortedWords(F) {
    if (sortedFor !== F) { sortedFor = F; sortedCache = Object.keys(F).sort(); }
    return sortedCache;
  }
  function lowerBound(arr, x) {
    let lo = 0;
    let hi = arr.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (arr[mid] < x) lo = mid + 1; else hi = mid;
    }
    return lo;
  }
  // pre দিয়ে শুরু হওয়া (pre-এর চেয়ে লম্বা) শব্দ, ফ্রিকোয়েন্সির ক্রমে
  function wordsStartingWith(F, pre) {
    const arr = sortedWords(F);
    const hits = [];
    let scanned = 0;
    for (let i = lowerBound(arr, pre); i < arr.length && arr[i].startsWith(pre) && scanned < SCAN_MAX; i++, scanned++) {
      if (arr[i].length > pre.length) hits.push(arr[i]);
    }
    return hits.sort((a, b) => (F[b] || 0) - (F[a] || 0));
  }

  function completions(word, max) {
    const w = String(word == null ? '' : word);
    const limit = max || 5;
    if (w.length < COMPLETE_MIN || !/^[A-Za-z]+$/.test(w)) return [];
    const cacheKey = w.toLowerCase() + ':' + limit;
    if (completionCache.has(cacheKey)) return completionCache.get(cacheKey).slice();
    const out = [];
    const seen = new Set();
    const push = (bn) => { if (bn && !seen.has(bn)) { seen.add(bn); out.push(bn); } };

    // (১) হাতে-লেখা তালিকা: ছোট কী আগে (কাছের শব্দ)
    const d = dict();
    if (d) {
      // Cache sorted dictionary keys and use binary search instead of scanning the full dictionary.
      if (dictKeysFor !== d) { dictKeysFor = d; dictKeysCache = Object.keys(d).sort(); }
      const keys = dictKeysCache;
      const matchingKeys = [];
      for (let i = lowerBound(keys, w); i < keys.length && keys[i].startsWith(w); i++) {
        if (keys[i].length > w.length) matchingKeys.push(keys[i]);
      }
      // Preserve the previous UX: shorter Roman completions first for curated entries.
      matchingKeys.sort((a, b) => a.length - b.length || a.localeCompare(b));
      for (const k of matchingKeys) push(d[k][0]);
      if (out.length >= limit) {
        const result = out.slice(0, limit);
        completionCache.set(cacheKey, result);
        if (completionCache.size > COMPLETION_CACHE_MAX) completionCache.delete(completionCache.keys().next().value);
        return result.slice();
      }
    }

    // (২) শব্দভান্ডার
    const F = freqs();
    if (!F) {
      completionCache.set(cacheKey, out.slice());
      if (completionCache.size > COMPLETION_CACHE_MAX) completionCache.delete(completionCache.keys().next().value);
      return out;
    }
    const lvl = new Map(); // বাংলা অংশ → স্তর (০ = ঠিক যা লেখা, ১ = ১ বদল)
    [w, ...oneEdit(w)].forEach((v, i) => {
      // শেষের o কখনো ো (valo), কখনো নীরব (korbo-র আগে kor + o) — দুটোই ধরা হয়
      for (const s of /[^o]o$/.test(v) ? [v, v.slice(0, -1)] : [v]) {
        const p = transliterate(s);
        if (p && p.length >= 2 && !lvl.has(p)) lvl.set(p, i === 0 ? 0 : 1);
      }
    });
    for (const level of [0, 1]) {
      const hits = new Map();
      for (const [p, l] of lvl) {
        if (l !== level) continue;
        for (const x of wordsStartingWith(F, p)) hits.set(x, F[x] || 0);
      }
      [...hits.entries()].sort((a, b) => b[1] - a[1]).forEach(([x]) => { if (out.length < limit) push(x); });
      if (out.length >= limit) break;
    }
    completionCache.set(cacheKey, out.slice());
    if (completionCache.size > COMPLETION_CACHE_MAX) completionCache.delete(completionCache.keys().next().value);
    return out;
  }

  // ---------------------------------------------------- দুই-তিন শব্দের জোড়া (n-gram): আগের শব্দ দেখে সাজানো
  // bn-ngrams.js আগে লোড হলে root.BVTBnNgrams = { bi, tri } থাকে (বানাতে: node build-ngrams.js ngram-seed.txt)।
  // এর সাথে ব্যবহারকারীর নিজের লেখা থেকে শেখা জোড়াও (setUserNgrams) যোগ হয়; কম উদাহরণে তার ভরসা কম থাকে।
  // সব স্থানীয় (on-device) — কোনো লেখা বাইরে যায় না।
  let ngCache = null;
  function ngrams() {
    if (ngCache) return ngCache;
    let g = root.BVTBnNgrams;
    if (!g && typeof require === 'function') {
      try { g = require('./bn-ngrams.js'); } catch (_) { g = null; }
    }
    if (g && g.bi && g.tri) ngCache = g;
    return ngCache;
  }

  const NG_BACKOFF = 0.4;
  const NG_USER_SMOOTH = 4; // নিজের লেখার কনটেক্সটে যত কম উদাহরণ, তত কম ভরসা: ১ বার বাছলে ≈০.২, ৫ বার ≈০.৫৫
  let userNg = { bi: {}, tri: {} };
  function setUserNgrams(u) {
    userNg = { bi: (u && u.bi) || {}, tri: (u && u.tri) || {} };
  }

  // কনটেক্সট (আগের বাংলা শব্দ, সর্বোচ্চ ২টা) → NFC, ফাঁকা বাদ
  const ctxWords = (ctx) => (Array.isArray(ctx) ? ctx : [])
    .map((x) => String(x == null ? '' : x).normalize('NFC')).filter(Boolean).slice(-2);

  const sumOf = (row) => { let t = 0; if (row) for (const k in row) t += row[k]; return t; };

  // একটা কনটেক্সটের সারি: বই (ফ্রিকোয়েন্সি থেকে সম্ভাবনা) + ব্যবহারকারীর শেখা (ছোট সংখ্যায় কম ভরসা)
  function makeRow(weight, book, user) {
    return { weight, book, user, bookTotal: sumOf(book), userTotal: sumOf(user) };
  }
  const rowScore = (r, w) => {
    let v = 0;
    if (r.book && r.bookTotal > 0 && r.book[w] > 0) v += r.book[w] / r.bookTotal;
    if (r.user && r.userTotal > 0 && r.user[w] > 0) v += r.user[w] / (r.userTotal + NG_USER_SMOOTH);
    return v;
  };

  // ফেরত: (বাংলা শব্দ) → স্কোর (০ = কনটেক্সটে এই শব্দ দেখা যায়নি), অথবা প্রমাণ না থাকলে null
  // তিন শব্দের জোড়া মিললে সেটাই; না মিললে ০.৪ × দুই শব্দের জোড়ার স্কোর (stupid backoff)
  function scorer(ctx) {
    const c = ctxWords(ctx);
    if (!c.length) return null;
    const N = ngrams();
    const p1 = c[c.length - 1];
    const rows = [];
    if (c.length >= 2) {
      const key = c[0] + ' ' + p1;
      rows.push(makeRow(1, N && N.tri[key], userNg.tri[key]));
    }
    rows.push(makeRow(NG_BACKOFF, N && N.bi[p1], userNg.bi[p1]));
    const live = rows.filter((r) => r.bookTotal > 0 || r.userTotal > 0);
    if (!live.length) return null;
    const fn = (w) => {
      for (const r of live) {
        const v = rowScore(r, w);
        if (v > 0) return r.weight * v;
      }
      return 0;
    };
    fn.rows = live;
    return fn;
  }

  // আগের শব্দ দেখে পরের সম্ভাব্য শব্দ, সবচেয়ে সম্ভাব্য আগে। ctx = ['আমি'] বা ['আজ', 'আমি']
  function predictNext(ctx, max) {
    const sc = scorer(ctx);
    if (!sc) return [];
    const pool = new Set();
    for (const r of sc.rows) {
      for (const k in r.book || {}) pool.add(k);
      for (const k in r.user || {}) pool.add(k);
    }
    return [...pool]
      .map((w) => ({ w, s: sc(w) }))
      .sort((a, b) => b.s - a.s || (a.w < b.w ? -1 : 1))
      .slice(0, max || 5)
      .map((o) => o.w);
  }

  // তালিকা সাজানো: কনটেক্সটে দেখা যাওয়া বানান আগে (স্কোর অনুযায়ী), বাকিগুলোর আগের ক্রম অক্ষত
  function rerank(list, ctx) {
    const sc = scorer(ctx);
    if (!sc) return list.slice();
    const rows = list.map((x, i) => ({ x, i, s: sc(x) }));
    if (!rows.some((o) => o.s > 0)) return list.slice();
    rows.sort((a, b) => (b.s > 0) - (a.s > 0) || b.s - a.s || a.i - b.i);
    return rows.map((o) => o.x);
  }

  // আংশিক লেখা (ja) + কনটেক্সট (আমি) → কনটেক্সটে দেখা শব্দ, যেগুলো ওই লেখার বাংলা রূপ (বা ১ বদলের রূপ) দিয়ে শুরু
  function contextCompletions(word, ctx, max) {
    const w = String(word == null ? '' : word);
    if (!/^[A-Za-z]+$/.test(w)) return [];
    const guesses = predictNext(ctx, 60);
    if (!guesses.length) return [];
    const prefixes = new Set();
    [w, ...oneEdit(w)].forEach((v) => {
      for (const t of /[^o]o$/.test(v) ? [v, v.slice(0, -1)] : [v]) {
        const p = transliterate(t);
        if (p) prefixes.add(p);
      }
    });
    const hits = guesses.filter((g) => { for (const p of prefixes) if (g.startsWith(p)) return true; return false; });
    return hits.slice(0, max || 5);
  }

  // ---------------------------------------------------- ব্যঞ্জন-কাঠামো মিলিয়ে সাজেশন (রেফ ও যুক্তাক্ষর)
  // নিয়ম-ইঞ্জিন শুধু নির্দিষ্ট জোড়া যুক্ত করে আর রেফ নিজে বসায় না, তাই nirbachon → নির্বাচন, sarkar → সরকার,
  // kosto → কষ্ট প্রথম ৮টায় আসত না। এখানে টাইপ করা লেখা আর শব্দভান্ডারের প্রতিটা শব্দকে শুধু ব্যঞ্জনের
  // ক্রমে (স্বর, হসন্ত আর রেফ/ফলার জায়গা বাদ দিয়ে) নামিয়ে মেলানো হয়। সমউচ্চারণের বর্ণ এক ধরা হয়
  // (ন/ণ, শ/ষ/স, ত/ট, দ/ড, জ/য …)। মিলে যাওয়া শব্দগুলো বাংলা রূপের কাছাকাছি-ভাব ও ফ্রিকোয়েন্সি দিয়ে সাজানো হয়।
  // এগুলো suggest()-এ প্রথম সাজেশনের ঠিক পরে বসে; প্রথম সাজেশন (Space-এ যা বসে) কখনো বদলায় না।
  const SK_HAS = '\u09CD';
  const SK_CLASS = {};
  [['k', 'ক'], ['K', 'খ'], ['g', 'গ'], ['G', 'ঘ'], ['X', 'ঙং'], ['c', 'চ'], ['C', 'ছ'], ['j', 'জযয'], ['J', 'ঝ'],
    ['n', 'নণঞ'], ['t', 'তটৎ'], ['T', 'থঠ'], ['d', 'দড'], ['D', 'ধঢ'], ['p', 'প'], ['P', 'ফ'], ['b', 'ব'],
    ['B', 'ভ'], ['m', 'ম'], ['r', 'র'], ['l', 'ল'], ['s', 'সশষ'], ['h', 'হ']]
    .forEach(([cls, chars]) => { for (const ch of chars) SK_CLASS[ch] = cls; });
  const skIsCons = (ch) => (ch >= '\u0995' && ch <= '\u09B9') || ch === '\u09CE' || ch === '\u0982';

  // বাংলা শব্দ → [সব ব্যঞ্জন, ব-ফলা/য-ফলা বাদে]। যেমন স্বাধীন → ['sbDn', 'sDn']
  function skWordKeys(word) {
    const s = String(word).normalize('NFC');
    let full = '';
    let red = '';
    let afterHas = false;
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (ch === SK_HAS) { afterHas = true; continue; }
      if (!skIsCons(ch)) { afterHas = false; continue; }
      let cls = SK_CLASS[ch];
      if (s[i + 1] === NUKTA) { if (ch === '\u09A1' || ch === '\u09A2') cls = 'r'; i++; }
      afterHas = afterHas && !!cls;
      if (!cls) continue;
      full += cls;
      if (!(afterHas && (ch === '\u09AC' || ch === '\u09AF'))) red += cls;
      afterHas = false;
    }
    return [full, red];
  }

  // ইংরেজি লেখার টোকেন (লম্বা আগে) আর তাদের ব্যঞ্জন-শ্রেণি
  const SK_TOKENS = ['chh', 'kkh', 'Th', 'Dh', 'Sh', 'Rh', 'Ng', 'NG', 'ng', 'GG', 'rri', 'rr', 'ch', 'kh', 'gh', 'jh', 'th',
    'dh', 'ph', 'bh', 'sh', 'oi', 'ou', 'aa', 'ii', 'ee', 'uu', 'oo', 'k', 'g', 'c', 'j', 'T', 'D', 'N', 't', 'd', 'n', 'p',
    'f', 'b', 'v', 'm', 'z', 'y', 'r', 'l', 'S', 's', 'h', 'R', 'x', 'q', 'w', 'a', 'i', 'u', 'e', 'o', 'O', 'I', 'U'];
  const SK_ROMAN = {
    k: 'k', kh: 'K', g: 'g', gh: 'G', c: 'c', ch: 'c', chh: 'C', j: 'j', jh: 'J', T: 't', Th: 'T', D: 'd', Dh: 'D', N: 'n',
    t: 't', th: 'T', d: 'd', dh: 'D', n: 'n', p: 'p', ph: 'P', f: 'P', b: 'b', bh: 'B', v: 'B', m: 'm', z: 'j', y: 'j',
    r: 'r', l: 'l', s: 's', sh: 's', S: 's', Sh: 's', h: 'h', R: 'r', x: 'ks', q: 'k', Ng: 'X', NG: 'n', rr: 'r', Rh: 'r',
  };
  const skIsVowel = (t) => /^[aeiouOIU]/.test(t);

  // টাইপ করা লেখা → সম্ভাব্য কাঠামো (একাধিক: "ri" ৃ হতে পারে, kh ক্ষ হতে পারে, ng ঙ্গ হতে পারে …)
  function skTypedKeys(w) {
    const toks = [];
    const lw = w.toLowerCase();
    for (let i = 0; i < w.length;) {
      let hit = SK_TOKENS.find((t) => w.startsWith(t, i)) || SK_TOKENS.find((t) => lw.startsWith(t, i));
      if (!hit) { i++; continue; }
      toks.push(hit);
      i += hit.length;
    }
    let variants = [[]];
    const push = (alts) => {
      const out = [];
      for (const v of variants) for (const a of alts) out.push(v.concat([a]));
      variants = out.slice(0, 24);
    };
    for (let k = 0; k < toks.length; k++) {
      const t = toks[k];
      const prev = toks[k - 1];
      const next = toks[k + 1];
      if (skIsVowel(t)) continue;
      if (t === 'kkh') push(['ks']);
      else if (t === 'GG') push(['jn']);
      else if (t === 'kh') push(['K', 'ks']);
      else if (t === 'ng') push(next && !skIsVowel(next) ? ['X'] : ['X', 'Xg']);
      else if (t === 'w') { if (prev && !skIsVowel(prev)) push(['b', '']); }
      else if (t === 'r' || t === 'rr') push(prev && !skIsVowel(prev) && next === 'i' ? ['r', ''] : ['r']);
      else if (t === 'g' && next === 'y') push(['g', 'jn']);
      else if (SK_ROMAN[t]) push([SK_ROMAN[t]]);
    }
    return [...new Set(variants.map((v) => v.join('')))];
  }

  // দূরত্ব মাপার জন্য সমউচ্চারণ এক করা রূপ
  const SK_FOLD = {};
  [['ন', 'নণঞ'], ['স', 'সশষ'], ['জ', 'জয'], ['ত', 'তটৎ'], ['থ', 'থঠ'], ['দ', 'দড'], ['ধ', 'ধঢ'], ['ং', 'ঙং'],
    ['ি', 'িী'], ['ু', 'ুূ'], ['ই', 'ইঈ'], ['উ', 'উঊ'], ['ো', 'োও']]
    .forEach(([to, chars]) => { for (const ch of chars) SK_FOLD[ch] = to; });
  function skFold(s) {
    const t = String(s).normalize('NFC').replace(/ৃ/g, 'রি').replace(/[ঁঃ\u09CD]/g, '')
      .replace(/ড\u09BC|ঢ\u09BC/g, 'র').replace(/য\u09BC/g, 'জ').replace(/অ/g, '');
    let o = '';
    for (const ch of t) o += SK_FOLD[ch] || ch;
    return o;
  }
  function skDistance(a, b) {
    const m = a.length;
    const n = b.length;
    if (!m) return n;
    if (!n) return m;
    let prev = Array.from({ length: n + 1 }, (_, i) => i);
    for (let i = 1; i <= m; i++) {
      const cur = [i];
      for (let j = 1; j <= n; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
      prev = cur;
    }
    return prev[n];
  }

  // শব্দভান্ডারের ইনডেক্স: কাঠামো → শব্দের তালিকা। প্রথমবার দরকারে বানানো হয় (≈১৫০ms), এরপর ক্যাশ।
  let skIndex = null;
  let skIndexFor = null;
  function skBuild(F) {
    if (skIndex && skIndexFor === F) return skIndex;
    const full = new Map();
    const red = new Map();
    const put = (m, k, w) => {
      if (k.length < 2) return;
      const a = m.get(k);
      if (a) a.push(w); else m.set(k, [w]);
    };
    for (const w of Object.keys(F)) {
      if (!(F[w] > 0)) continue;
      const [a, b] = skWordKeys(w);
      put(full, a, w);
      if (b !== a) put(red, b, w);
    }
    skIndex = { full, red };
    skIndexFor = F;
    skCache.clear();
    return skIndex;
  }
  const skCache = new Map();
  const SK_CACHE_MAX = 300;
  const SK_TIER_COST = 0.5; // ব/য-ফলা বাদ দিয়ে মেলালে সামান্য জরিমানা
  const SK_LAMBDA = 1.5; // এক অক্ষর তফাত ≈ ফ্রিকোয়েন্সির ১.৫ ঘাত (১০^১.৫ গুণ) কম গুরুত্ব

  // টাইপ করা লেখার সঙ্গে ব্যঞ্জন-কাঠামো মেলা শব্দ, সবচেয়ে সম্ভাব্য আগে (সর্বোচ্চ max টা)
  function skeletonMatches(word, max) {
    const w = String(word == null ? '' : word);
    const F = freqs();
    if (!F || !/^[A-Za-z]{3,}$/.test(w)) return [];
    const ck = w + ':' + (max || 6);
    if (skCache.has(ck) && skIndexFor === F) return skCache.get(ck).slice();
    const idx = skBuild(F);
    const main = skFold(transliterate(w));
    const hits = new Map();
    for (const k of skTypedKeys(w)) {
      if (k.length < 2) continue;
      for (const [m, tier] of [[idx.full, 0], [idx.red, 1]]) {
        for (const c of m.get(k) || []) {
          const d = skDistance(main, skFold(c)) + tier * SK_TIER_COST;
          const sc = d * SK_LAMBDA - Math.log10(F[c] + 1);
          const old = hits.get(c);
          if (!old || sc < old) hits.set(c, sc);
        }
      }
    }
    const out = [...hits.entries()].sort((a, b) => a[1] - b[1]).slice(0, max || 6).map((e) => e[0]);
    skCache.set(ck, out.slice());
    if (skCache.size > SK_CACHE_MAX) skCache.delete(skCache.keys().next().value);
    return out;
  }

  // list-এর প্রথম সাজেশন যেমন আছে তেমন থাকে; তার ঠিক পরে সর্বোচ্চ ৩টা কাঠামো-মেলা শব্দ বসে।
  // হাতে-লেখা তালিকায় শব্দটা থাকলে (ami, jonno …) কিছুই বদলায় না। ইঞ্জিন নিজেই একমত হলে (প্রথমটাই সেরা মিল) কিছু যোগ হয় না।
  const SK_INSERT = 3;
  function withSkeleton(w, list, ctx) {
    if (!list.length || lookup(w)) return list;
    let hits = skeletonMatches(w, 6);
    if (!hits.length || hits[0] === list[0]) return list;
    hits = hits.filter((x) => x !== list[0]);
    if (ctx && ctx.length && scorer(ctx)) hits = rerank(hits, ctx);
    hits = hits.slice(0, SK_INSERT);
    return [list[0], ...hits, ...list.slice(1).filter((x) => !hits.includes(x))];
  }

  // তালিকা: সাধারণ বিকল্প + আংশিক-লেখার সাজেশন.
  // প্রথম বিকল্পটা আসল শব্দ হলে (Space দিলে যেটা বসে) সাজেশন সবার শেষে যায়, যাতে বসা শব্দ না বদলায়;
  // প্রথমটা আসল শব্দ না হলে (dhonno → ধন্ন) সাজেশন তার ঠিক পরেই আসে।
  // ctx (ঐচ্ছিক) = আগের বাংলা শব্দ (সর্বোচ্চ ২টা): থাকলে সেই কনটেক্সটে যে বানান দেখা যায় সেটা উপরে আসে।
  function suggest(word, maxBase, maxComp, ctx) {
    const w = String(word == null ? '' : word);
    let base = candidates(w, maxBase || 8);
    let comp = completions(w, maxComp || 5).filter((x) => !base.includes(x));
    if (ctx && ctx.length && scorer(ctx)) {
      base = rerank(base, ctx);
      const extra = contextCompletions(w, ctx, maxComp || 5);
      const merged = extra.concat(comp.filter((x) => !extra.includes(x))).filter((x) => !base.includes(x));
      comp = rerank(merged, ctx).slice(0, maxComp || 5);
    }
    let list;
    if (!comp.length) list = base;
    else if (!base.length) list = comp;
    else {
      const F = freqs();
      const real = !!lookup(w) || !!(F && F[base[0]] > 0);
      list = real ? base.concat(comp) : [base[0], ...comp, ...base.slice(1)];
    }
    return withSkeleton(w, list, ctx); // রেফ/যুক্তাক্ষরের সঠিক শব্দ প্রথমটার পরেই
  }

  root.BVTPhonetic = { transliterate, defaultFor, convertText, candidates, completions, suggest, skeletonMatches, predictNext, rerank, setUserNgrams, hasNgrams: () => !!ngrams() };
  if (typeof module === 'object' && module.exports) module.exports = root.BVTPhonetic;
})(typeof globalThis !== 'undefined' ? globalThis : this);
