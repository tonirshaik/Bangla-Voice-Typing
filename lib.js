/* বাংলা ভয়েস টাইপিং — টেক্সট প্রসেসিং
 * এখানে DOM-এর কোনো কাজ নেই, তাই Node দিয়ে আলাদাভাবে টেস্ট করা যায়। */
(function (root) {
  'use strict';

  const nfc = (s) => String(s == null ? '' : s).normalize('NFC');
  const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // [বলার শব্দ/বাক্যাংশ, যা বসবে, ধরন]
  // after = আগের শব্দের গায়ে লেগে বসে, both = দুই পাশের ফাঁকা মুছে যায়, line = নতুন লাইন
  const COMMAND_TABLE = [
    [['দাঁড়ি', 'দাড়ি', 'পূর্ণচ্ছেদ', 'পূর্ণ ছেদ'], '।', 'after'],
    [['কমা'], ',', 'after'],
    [['প্রশ্নবোধক চিহ্ন', 'প্রশ্ন চিহ্ন', 'প্রশ্নবোধক'], '?', 'after'],
    [['বিস্ময়সূচক চিহ্ন', 'বিস্ময় চিহ্ন', 'বিস্ময়বোধক চিহ্ন', 'আশ্চর্য চিহ্ন'], '!', 'after'],
    [['সেমিকোলন'], ';', 'after'],
    [['কোলন'], ':', 'after'],
    [['হাইফেন', 'ড্যাশ'], '-', 'both'],
    [['নতুন অনুচ্ছেদ', 'নতুন প্যারা', 'নিউ প্যারা'], '\n\n', 'line'],
    [['নতুন লাইন', 'নিউ লাইন', 'নিউলাইন'], '\n', 'line'],
  ];

  // ইংরেজি (en-US) মোডের কমান্ড
  const EN_TABLE = [
    [['period', 'full stop'], '.', 'after'],
    [['comma'], ',', 'after'],
    [['question mark'], '?', 'after'],
    [['exclamation mark', 'exclamation point'], '!', 'after'],
    [['semicolon'], ';', 'after'],
    [['colon'], ':', 'after'],
    [['hyphen', 'dash'], '-', 'both'],
    [['new paragraph'], '\n\n', 'line'],
    [['new line', 'newline'], '\n', 'line'],
  ];

  // লম্বা বাক্যাংশ আগে মেলানো হবে
  const buildPhrases = (table) => {
    const list = [];
    for (const [words, out, kind] of table) {
      for (const w of words) list.push({ phrase: nfc(w), out, kind });
    }
    return list.sort((a, b) => b.phrase.length - a.phrase.length);
  };
  const PHRASES = { bn: buildPhrases(COMMAND_TABLE), en: buildPhrases(EN_TABLE) };

  function applyCommands(text, lang) {
    const list = /^en/i.test(lang || '') ? PHRASES.en : PHRASES.bn;
    let t = ' ' + nfc(text) + ' ';
    for (const { phrase, out, kind } of list) {
      const p = escapeRe(phrase);
      const re =
        kind === 'both'
          ? new RegExp('\\s+' + p + '(?=\\s)\\s*', 'gi')
          : new RegExp('\\s+' + p + '(?=\\s)', 'gi');
      t = t.replace(re, () => out);
    }
    t = t.replace(/[ \t]*\n[ \t]*/g, '\n').replace(/[ \t]{2,}/g, ' ');
    return t.replace(/^[ \t]+|[ \t]+$/g, '');
  }

  // "ভুল = সঠিক" লাইনগুলো থেকে তালিকা বানায়। # দিয়ে শুরু হলে মন্তব্য।
  function parseDictionary(str) {
    const out = [];
    for (const line of nfc(str).split(/\r?\n/)) {
      if (/^\s*#/.test(line)) continue;
      const m = line.match(/^\s*(.+?)\s*(?:=>|→|->|=)\s*(.*?)\s*$/);
      if (!m || !m[1]) continue;
      out.push([m[1], m[2]]);
    }
    out.sort((a, b) => b[0].length - a[0].length);
    return out;
  }

  const BOUNDARY = '[\\s।,?!;:"\'()\\-]';

  // শুধু পুরো শব্দ বদলায় (শব্দের ভেতরের অংশ নয়)
  function applyDictionary(text, entries) {
    let t = nfc(text);
    for (const [from, to] of entries) {
      const re = new RegExp('(^|' + BOUNDARY + ')' + escapeRe(from) + '(?=$|' + BOUNDARY + ')', 'g');
      t = t.replace(re, (m, pre) => pre + to);
    }
    return t;
  }

  function process(text, opts) {
    const o = opts || {};
    const entries = Array.isArray(o.dictionary) ? o.dictionary : parseDictionary(o.dictionary || '');
    let t = applyDictionary(text, entries);
    if (o.commands === false) {
      t = t.replace(/[ \t]{2,}/g, ' ').replace(/^[ \t]+|[ \t]+$/g, '');
    } else {
      t = applyCommands(t, o.lang);
    }
    return t;
  }

  // কার্সরের ঠিক আগের অক্ষর দেখে দরকার হলে শুরুতে একটা স্পেস বসায়
  function withLeadingSpace(prevChar, text) {
    if (!text) return text;
    if (!prevChar) return text;
    if (/\s/.test(prevChar)) return text;
    if (/[(\[{\-]/.test(prevChar)) return text;
    if (/^[\s।,?!;:.]/.test(text)) return text;
    return ' ' + text;
  }

  // ------------------------------------------------- বিকল্প ফলাফল থেকে বাছাই

  // স্পিচ ইঞ্জিন একাধিক বিকল্প দিলে, শব্দ সংশোধনের তালিকার শব্দ (ভুল বা সঠিক, যেকোনো পাশ)
  // সবচেয়ে বেশি মেলে এমনটি বেছে নেয়। সমান হলে ইঞ্জিনের প্রথম পছন্দই থাকে।
  // মেলানো হয় শব্দের অংশ ধরেও (মিটিং ~ মিটিংয়ে), যাতে বিভক্তি লাগা সঠিক রূপ ভুল করে বাদ না পড়ে।
  // alts: [{ transcript, confidence }] বা স্ট্রিংয়ের তালিকা, ইঞ্জিনের পছন্দের ক্রমে।
  function pickByDictionary(alts, entries) {
    const list = (alts || [])
      .map((a) => (typeof a === 'string' ? { transcript: a } : a))
      .filter((a) => a && a.transcript);
    if (!list.length) return '';
    const first = list[0];
    if (list.length === 1 || !entries || !entries.length) return first.transcript;

    const score = (t) => {
      let n = 0;
      for (const [from, to] of entries) {
        for (const w of [from, to]) {
          if (w && t.includes(nfc(w).toLowerCase())) { n++; break; }
        }
      }
      return n;
    };
    const topConf = first.confidence > 0 ? first.confidence : 0;
    let best = first;
    let bestScore = score(nfc(first.transcript).toLowerCase());
    for (let i = 1; i < list.length; i++) {
      const a = list[i];
      const ratio = a.transcript.length / Math.max(1, first.transcript.length);
      if (ratio < 0.6 || ratio > 1.6) continue; // প্রথমটার সঙ্গে অনেক অমিল হলে বাদ
      if (topConf && a.confidence > 0 && a.confidence < topConf * 0.5) continue; // ইঞ্জিন খুব কম নিশ্চিত
      const sc = score(nfc(a.transcript).toLowerCase());
      if (sc > bestScore) { best = a; bestScore = sc; }
    }
    return best.transcript;
  }

  // ------------------------------------------------- n-best পুনর্বিন্যাস (বাংলা ভয়েসের জন্য)
  // প্রতিটি বিকল্পকে এই যোগফলে স্কোর করা হয়:
  //   ইঞ্জিনের confidence + শব্দের ফ্রিকোয়েন্সি (BVTBnFreq) + bigram/trigram সম্ভাবনা (BVTBnNgrams)
  //   + শব্দ সংশোধনের তালিকার মিল − অভিধানে নেই এমন বাংলা শব্দের জরিমানা।
  // আগের নিরাপত্তা শর্ত অক্ষত: দৈর্ঘ্যের অনুপাত (ratio) আর confidence-এর অর্ধেকের নিচে হলে বিকল্প বাদ।
  // এর ওপর একটা ছোট margin: ইঞ্জিনের প্রথম পছন্দ তখনই বদলায় যখন অন্য বিকল্প স্পষ্টভাবে এগিয়ে।
  // BVTBnFreq/BVTBnNgrams পরে লোড হওয়া স্ক্রিপ্টে থাকে, তাই প্রতিবার ডাকার সময় পড়া হয় (লোডের সময় নয়)।
  const W = { engine: 0.6, freq: 0.5, ngram: 0.8, dict: 1.0, oov: 0.6, margin: 0.08, rank: 0.03 };
  const BN_TOKEN = /^[\u0980-\u09FF]+$/;
  const TOKEN_SPLIT = /[\s।,?!;:"'()\-.]+/;
  const NG_BACKOFF = 0.4;
  const FREQ_SCALE = 11; // ln(১+ফ্রিকোয়েন্সি) ÷ এই সংখ্যা, সর্বোচ্চ ১ (bn-words.js-এর সবচেয়ে বড় ফ্রিকোয়েন্সি ৬২৪৯৮, ln ≈ ১১)
  // বিভক্তি/প্রত্যয় — অভিধানে মূল শব্দ থাকলে রূপটাকে অজানা ধরা হবে না
  const SUFFIXES = ['গুলোকে', 'গুলোর', 'গুলো', 'দেরকে', 'দের', 'েরা', 'ের', 'কে', 'তে', 'রা', 'টা', 'টি', 'য়', 'র', 'ে', 'ও'];

  let freqSeen = null;
  let freqOk = false;
  function freqTable(o) {
    let f = o.freq || root.BVTBnFreq;
    if (!f && typeof require === 'function' && typeof module === 'object') {
      try { f = require('./bn-words.js'); } catch (_) { f = null; }
    }
    if (f !== freqSeen) {
      freqSeen = f;
      freqOk = false;
      if (f) for (const k in f) { freqOk = true; break; }
    }
    return freqOk ? f : null;
  }
  function ngramTable(o) {
    let g = o.ngrams || root.BVTBnNgrams;
    if (!g && typeof require === 'function' && typeof module === 'object') {
      try { g = require('./bn-ngrams.js'); } catch (_) { g = null; }
    }
    return g && g.bi && g.tri ? g : null;
  }

  const rowTotals = new WeakMap();
  function rowProb(row, w) {
    if (!row || !(row[w] > 0)) return 0;
    let t = rowTotals.get(row);
    if (t == null) { t = 0; for (const k in row) t += row[k]; rowTotals.set(row, t); }
    return t > 0 ? row[w] / t : 0;
  }

  // শব্দের ফ্রিকোয়েন্সি; সরাসরি না পেলে বিভক্তি ছেঁটে মূল শব্দের (আধা ভরসায়)
  function freqOf(F, w) {
    if (F[w] > 0) return F[w];
    for (const suf of SUFFIXES) {
      if (w.length > suf.length + 1 && w.endsWith(suf)) {
        const f = F[w.slice(0, -suf.length)];
        if (f > 0) return f * 0.5;
      }
    }
    return 0;
  }

  // আগের ≤২ বাংলা শব্দ (c) দেখে w-এর সম্ভাবনা: তিন-শব্দ মিললে সেটা, নইলে ০.৪ × দুই-শব্দ
  function ngramProb(N, c, w) {
    if (c.length >= 2) {
      const p3 = rowProb(N.tri[c[c.length - 2] + ' ' + c[c.length - 1]], w);
      if (p3 > 0) return p3;
    }
    return NG_BACKOFF * rowProb(N.bi[c[c.length - 1]], w);
  }

  function dictHits(t, entries) {
    let n = 0;
    for (const [from, to] of entries || []) {
      for (const w of [from, to]) {
        if (w && t.includes(nfc(w).toLowerCase())) { n++; break; }
      }
    }
    return n;
  }

  // একটা বিকল্পের স্কোর (অংশগুলোসহ — যাচাইয়ের সুবিধার জন্য)
  function scoreOne(a, rank, topConf, entries, o, F, N, ctx) {
    const text = nfc(a.transcript);
    const toks = text.split(TOKEN_SPLIT).filter(Boolean);
    const conf = a.confidence > 0 ? a.confidence : topConf * 0.5;
    let freqSum = 0, bn = 0, oov = 0, ngSum = 0, ngN = 0;
    let prev = ctx.slice(-2);
    for (const t of toks) {
      if (!BN_TOKEN.test(t)) { prev = []; continue; } // ইংরেজি/সংখ্যা এলে কনটেক্সট ছিঁড়ে যায়
      bn++;
      if (F) {
        const f = freqOf(F, t);
        if (f > 0) freqSum += Math.min(1, Math.log1p(f) / FREQ_SCALE); else oov++;
      }
      if (N && prev.length) {
        ngSum += Math.sqrt(Math.min(1, ngramProb(N, prev, t)));
        ngN++;
      }
      prev = prev.concat(t).slice(-2);
    }
    const parts = {
      engine: W.engine * conf - W.rank * rank,
      freq: F && bn ? W.freq * (freqSum / bn) : 0,
      ngram: ngN ? W.ngram * (ngSum / ngN) : 0,
      dict: W.dict * Math.min(3, dictHits(text.toLowerCase(), entries)),
      oov: F && bn ? -W.oov * (oov / bn) : 0,
    };
    parts.total = parts.engine + parts.freq + parts.ngram + parts.dict + parts.oov;
    return parts;
  }

  const normAlts = (alts) => (alts || [])
    .map((a) => (typeof a === 'string' ? { transcript: a } : a))
    .filter((a) => a && a.transcript);

  // opts: { rerank (false হলে আগের শুধু-তালিকা নিয়ম), ctx: [আগের ≤২ বাংলা শব্দ], freq, ngrams (টেস্টের জন্য) }
  function scoreAlts(alts, entries, opts) {
    const o = opts || {};
    const list = normAlts(alts);
    const F = freqTable(o);
    const N = ngramTable(o);
    const ctx = (Array.isArray(o.ctx) ? o.ctx : []).map(nfc).filter((x) => BN_TOKEN.test(x));
    const topConf = list[0] && list[0].confidence > 0 ? list[0].confidence : 0;
    return list.map((a, i) => ({ transcript: a.transcript, ...scoreOne(a, i, topConf, entries, o, F, N, ctx) }));
  }

  function pickBest(alts, entries, opts) {
    const o = opts || {};
    if (o.rerank === false) return pickByDictionary(alts, entries);
    const list = normAlts(alts);
    if (!list.length) return '';
    const first = list[0];
    if (list.length === 1) return first.transcript;
    if (!list.some((a) => /[\u0980-\u09FF]/.test(a.transcript))) return pickByDictionary(alts, entries); // বাংলা নেই (ইংরেজি ইত্যাদি)
    const scores = scoreAlts(list, entries, o);
    const topConf = first.confidence > 0 ? first.confidence : 0;
    let best = 0;
    for (let i = 1; i < list.length; i++) {
      const a = list[i];
      const ratio = a.transcript.length / Math.max(1, first.transcript.length);
      if (ratio < 0.6 || ratio > 1.6) continue; // প্রথমটার সঙ্গে অনেক অমিল হলে বাদ
      if (topConf && a.confidence > 0 && a.confidence < topConf * 0.5) continue; // ইঞ্জিন খুব কম নিশ্চিত
      if (scores[i].total > scores[best].total + W.margin) best = i;
    }
    return list[best].transcript;
  }

  // ------------------------------------------------------------ অনুবাদের পথ

  // সরাসরি জোড়া (source → target) থাকলে সেটাই; না থাকলে English হয়ে দুই ধাপে।
  // availability(s, t) → 'available' | 'downloadable' | 'downloading' | 'unavailable'
  // ফেরত: [[s, t], ...] অথবা পথ না থাকলে null
  async function planRoute(source, target, availability) {
    if (!source || !target || source === target) return null;
    const ok = async (s, t) => {
      try { return (await availability(s, t)) !== 'unavailable'; } catch (_) { return false; }
    };
    if (await ok(source, target)) return [[source, target]];
    if (source !== 'en' && target !== 'en' && (await ok(source, 'en')) && (await ok('en', target))) {
      return [[source, 'en'], ['en', target]];
    }
    return null;
  }

  // ------------------------------------------------------------ ভাষা চেনা

  // লিপি দেখে মোটামুটি ভাষা চেনা। Language Detector না থাকলে বা ব্যর্থ হলে ফলব্যাক
  const SCRIPTS = [
    ['bn', /[\u0980-\u09FF]/g],
    ['hi', /[\u0900-\u097F]/g],
    ['ar', /[\u0600-\u06FF]/g],
    ['ru', /[\u0400-\u04FF]/g],
    ['th', /[\u0E00-\u0E7F]/g],
    ['ta', /[\u0B80-\u0BFF]/g],
    ['te', /[\u0C00-\u0C7F]/g],
    ['ko', /[\uAC00-\uD7AF]/g],
    ['ja', /[\u3040-\u30FF]/g],
    ['zh', /[\u4E00-\u9FFF]/g],
    ['en', /[A-Za-z]/g],
  ];

  function guessLang(text) {
    const t = String(text == null ? '' : text);
    const n = {};
    for (const [code, re] of SCRIPTS) n[code] = (t.match(re) || []).length;
    if (n.ja) { n.ja += n.zh; n.zh = 0; } // জাপানি লেখায় কাঞ্জিও থাকে
    let best = null;
    let max = 0;
    for (const [code] of SCRIPTS) {
      if (n[code] > max) { best = code; max = n[code]; }
    }
    return best;
  }

  const baseLang = (c) => String(c || '').split('-')[0].toLowerCase();

  // Chrome-এর Language Detector API দিয়ে ভাষা চেনে; না পেলে লিপি দেখে অনুমান করে।
  // opts.download: মডেল না নামানো থাকলে এখনই নামাবে কি না (ডিফল্ট না — তখন ফলব্যাক চলে)
  // opts.minConfidence: এর কম নিশ্চিত হলে ফলব্যাক (ডিফল্ট ০.৫)
  let detectorP = null;
  async function detectLang(text, opts) {
    const o = opts || {};
    const sample = String(text == null ? '' : text).trim().slice(0, 500);
    const fallback = guessLang(sample) || 'en';
    const API = root.LanguageDetector;
    if (!API || !sample) return fallback;
    try {
      if (!detectorP) {
        detectorP = (async () => {
          if (!o.download && (await API.availability()) !== 'available') return null;
          return API.create();
        })();
      }
      const d = await detectorP;
      if (!d) { detectorP = null; return fallback; } // পরের বার আবার দেখবে (মডেল নেমে যেতে পারে)
      const top = (await d.detect(sample))[0];
      const min = o.minConfidence == null ? 0.5 : o.minConfidence;
      if (top && top.detectedLanguage && top.detectedLanguage !== 'und' && top.confidence >= min) {
        return baseLang(top.detectedLanguage);
      }
    } catch (_) {
      detectorP = null;
    }
    return fallback;
  }

  root.BVT = { process, applyCommands, applyDictionary, parseDictionary, withLeadingSpace, guessLang, detectLang, pickBest, scoreAlts, planRoute };
  if (typeof module === 'object' && module.exports) module.exports = root.BVT;
})(typeof globalThis !== 'undefined' ? globalThis : this);
