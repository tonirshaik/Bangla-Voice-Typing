/* বাংলা ভয়েস টাইপিং — খোঁজা ও বদলানোর মূল অংশ (DOM-এর কিছু নেই; Node দিয়ে টেস্ট করা যায়)
 * যা বাংলার জন্য আলাদা করে সামলানো হয়:
 *  • ZWJ/ZWNJ (অদৃশ্য অক্ষর) উপেক্ষা: একই দেখতে দুটো শব্দ আলাদা ধরা পড়ে না।
 *  • ড় ঢ় য় এর দুই রূপ (এক অক্ষর বা ড + ় ) একই ধরা হয়।
 *  • ০-৯ আর 0-9 সমান ধরা হয় (Regex বাদে)।
 *  • "পুরো শব্দ": কার, ফলা, হসন্ত শব্দের অংশ ধরা হয় (JavaScript-এর \b বাংলায় ভুল করে)।
 * ব্যবহার: BVTFind.findAll(text, query, opts) → { matches: [{ start, end, groups? }], error, capped }
 *          BVTFind.replaceAll(text, query, replacement, opts) → { text, count, error }
 *          BVTFind.replacementFor(text, match, replacement, opts) → বদলানোর লেখা
 * opts: matchCase, wholeWord, regex, fold (ডিফল্ট true), preserveCase, range [শুরু, শেষ], expand (ফোনেটিক: লেখা → [বিকল্প…]) */
(function (root) {
  'use strict';

  const MAX_MATCHES = 3000;
  const BN_DIGIT_0 = 0x09e6; // ০
  const NUKTA = '\u09bc';
  const DECOMPOSE = { '\u09dc': '\u09a1' + NUKTA, '\u09dd': '\u09a2' + NUKTA, '\u09df': '\u09af' + NUKTA };

  // শব্দের অংশ: অক্ষর, কার/হসন্ত (Mark), অঙ্ক, আন্ডারস্কোর
  const WB_U = '[\\p{L}\\p{M}\\p{N}_]';
  const WB_FALLBACK = '[A-Za-z0-9_\\u00C0-\\u024F\\u0980-\\u09FF]';

  // লেখাকে "তুলনার রূপে" আনে। map[i] = i-তম নতুন অক্ষর মূল লেখার কত নম্বর থেকে এসেছে (শেষে text.length)
  function foldText(text) {
    const t = String(text == null ? '' : text);
    let s = '';
    const map = [];
    for (let i = 0; i < t.length; i++) {
      const ch = t[i];
      if (ch === '\u200c' || ch === '\u200d') continue;
      const code = ch.charCodeAt(0);
      let out = ch;
      if (code >= BN_DIGIT_0 && code <= BN_DIGIT_0 + 9) out = String(code - BN_DIGIT_0);
      else if (DECOMPOSE[ch]) out = DECOMPOSE[ch];
      for (let k = 0; k < out.length; k++) {
        s += out[k];
        map.push(i);
      }
    }
    map.push(t.length);
    return { s, map };
  }

  const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\\/-]/g, '\\$&');

  function compile(source, matchCase, wholeWord) {
    const flags = 'g' + (matchCase ? '' : 'i');
    try {
      const src = wholeWord ? `(?<!${WB_U})(?:${source})(?!${WB_U})` : source;
      return new RegExp(src, flags + 'u');
    } catch (_) {
      // কিছু Regex (যেমন \- ) u-ফ্ল্যাগে ভুল, u ছাড়া আবার চেষ্টা
      const src = wholeWord ? `(?<!${WB_FALLBACK})(?:${source})(?!${WB_FALLBACK})` : source;
      return new RegExp(src, flags); // ভুল হলে এখানেই throw করবে
    }
  }

  // এক খোঁজার শব্দে সব মিল; hay = foldText-এর ফল বা সরাসরি লেখা
  function scan(hay, re, text, range, out, cap) {
    let m;
    re.lastIndex = 0;
    while ((m = re.exec(hay.s)) !== null) {
      const len = m[0].length;
      if (!len) {
        re.lastIndex = m.index + 1;
        continue;
      }
      let start = m.index;
      let end = m.index + len;
      if (hay.map) {
        start = hay.map[start];
        end = hay.map[end - 1] + 1;
      }
      if (range) {
        if (end > range[1]) break;
        if (start < range[0]) continue;
      }
      out.push({ start, end, groups: Array.from(m) });
      if (out.length >= cap) return true;
    }
    return false;
  }

  function findAll(text, query, opts) {
    const o = opts || {};
    const t = String(text == null ? '' : text);
    const q = String(query == null ? '' : query);
    const result = { matches: [], error: null, capped: false };
    if (!q) return result;

    const useFold = !o.regex && o.fold !== false;
    const hay = useFold ? foldText(t) : { s: t, map: null };
    const range = Array.isArray(o.range) ? o.range : null;

    let queries = [q];
    if (!o.regex && typeof o.expand === 'function') {
      try {
        for (const x of o.expand(q) || []) if (x && !queries.includes(x)) queries.push(x);
      } catch (_) {}
    }

    const found = [];
    for (const one of queries) {
      const fq = useFold ? foldText(one).s : one;
      if (!fq) continue;
      let re;
      try {
        re = compile(o.regex ? fq : escapeRe(fq), !!o.matchCase, !!o.wholeWord);
      } catch (e) {
        result.error = 'Invalid regular expression';
        return result;
      }
      if (scan(hay, re, t, range, found, MAX_MATCHES)) {
        result.capped = true;
        break;
      }
    }

    // ফোনেটিক বিকল্পে একই জায়গা দুবার এলে একটাই রাখি (আগে শুরু হওয়া, তারপর লম্বা)
    found.sort((a, b) => a.start - b.start || b.end - a.end);
    let lastEnd = -1;
    for (const m of found) {
      if (m.start < lastEnd) continue;
      result.matches.push(m);
      lastEnd = m.end;
    }
    if (!o.regex) for (const m of result.matches) delete m.groups; // শুধু Regex-এ $1 লাগে
    return result;
  }

  // বদলানোর লেখা: Regex মোডে $1 $& $<নাম> আর \n \t \\ চলে
  function expandTemplate(rep, groups, regexMode) {
    if (!regexMode) return rep;
    return rep.replace(/\\([nt\\])|\$(\$|&|\d{1,2}|<[^>]*>)/g, (all, esc, dol) => {
      if (esc) return esc === 'n' ? '\n' : esc === 't' ? '\t' : '\\';
      if (dol === '$') return '$';
      if (dol === '&') return groups ? groups[0] : '';
      if (dol[0] === '<') return '';
      const n = parseInt(dol, 10);
      if (groups && n >= 1 && n < groups.length) return groups[n] == null ? '' : groups[n];
      if (dol.length === 2) {
        const n1 = parseInt(dol[0], 10);
        if (groups && n1 >= 1 && n1 < groups.length) return (groups[n1] == null ? '' : groups[n1]) + dol[1];
      }
      return all;
    });
  }

  // ছোট/বড় হাতের ধরন বজায় রাখা: RONI → RAHAT, Roni → Rahat, roni → rahat (বাংলায় কিছু বদলায় না)
  function caseLike(matched, rep) {
    if (!rep) return rep;
    const cased = Array.from(matched).filter((c) => c.toLowerCase() !== c.toUpperCase());
    if (!cased.length) return rep;
    const allUpper = cased.every((c) => c === c.toUpperCase());
    const allLower = cased.every((c) => c === c.toLowerCase());
    if (allUpper && cased.length > 1) return rep.toUpperCase();
    if (allLower) return rep.toLowerCase();
    if (cased[0] === cased[0].toUpperCase() && cased.slice(1).every((c) => c === c.toLowerCase())) {
      return rep.charAt(0).toUpperCase() + rep.slice(1);
    }
    return rep;
  }

  function replacementFor(text, match, rep, opts) {
    const o = opts || {};
    let out = expandTemplate(String(rep == null ? '' : rep), match.groups, !!o.regex);
    if (o.preserveCase) out = caseLike(String(text).slice(match.start, match.end), out);
    return out;
  }

  // matches-এর সব জায়গায় বদলে নতুন লেখা বানায়
  function applyReplacements(text, matches, rep, opts) {
    const t = String(text);
    let out = '';
    let pos = 0;
    for (const m of matches) {
      out += t.slice(pos, m.start) + replacementFor(t, m, rep, opts);
      pos = m.end;
    }
    return { text: out + t.slice(pos), count: matches.length };
  }

  function replaceAll(text, query, rep, opts) {
    const r = findAll(text, query, opts);
    if (r.error) return { text: String(text), count: 0, error: r.error };
    const a = applyReplacements(text, r.matches, rep, opts);
    return { text: a.text, count: a.count, error: null };
  }

  const api = { findAll, replaceAll, replacementFor, applyReplacements, foldText, caseLike, expandTemplate, MAX_MATCHES };
  root.BVTFind = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
