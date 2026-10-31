/* বাংলা ভয়েস টাইপিং — English Proofreader (Fix) AI টুল।
 * এখানে DOM-এর কোনো কাজ নেই।
 *
 * মনে রাখার কথা:
 * Fix কেবল English-এ চলে; অন্য ভাষায় ভুল ধরার ভান করা হয় না। */
(function (root) {
  'use strict';

  const NAMES = { proofreader: 'Proofreader' };
  const DIRECT = { proofreader: ['en'] };

  const api = (kind) => root[NAMES[kind]] || null;
  const baseLang = (c) => String(c || '').split('-')[0].toLowerCase();

  // 'missing' (API নেই) | 'unavailable' | 'downloadable' | 'downloading' | 'available'
  async function availability(kind, opts) {
    const A = api(kind);
    if (!A || typeof A.availability !== 'function') return 'missing';
    try {
      return await A.availability(opts);
    } catch (_) {
      return 'unavailable';
    }
  }

  async function status() {
    const out = {};
    for (const k of Object.keys(NAMES)) {
      // ভাষা না দিলে Chrome ওয়ার্নিং দেয়, তাই এখানেও ভাষা পাঠানো হয়
      out[k] = await availability(k, { expectedInputLanguages: ['en'] });
    }
    return out;
  }

  // Proofreader কেবল ইংরেজি সমর্থন করে।
  function plan(kind, lang) {
    const l = baseLang(lang);
    if (DIRECT[kind].includes(l)) return { direct: true, work: l };
    if (kind === 'proofreader') return { unsupported: true };
    return { direct: false, work: 'en' };
  }

  // ------------------------------------------------------------ সাধারণ কাজ

  const checker = (o) => () => {
    if (o && o.alive && !o.alive()) throw new Error('cancelled');
  };

  async function make(kind, options, onProgress) {
    const A = api(kind);
    if (!A) throw new Error('no-api');
    const opts = { ...options };
    if (onProgress) {
      opts.monitor = (m) => m.addEventListener('downloadprogress', (e) => onProgress(Math.round(e.loaded * 100)));
    }
    return A.create(opts);
  }

  const done = (inst) => { try { if (inst && inst.destroy) inst.destroy(); } catch (_) {} };

  // সেশন আবার ব্যবহার: প্রতিবার create()+destroy() করলে প্রতি ক্লিকে মডেল নতুন করে মেমরিতে তোলা হয় (এটাই ধীর হওয়ার প্রধান কারণ)।
  // তাই একই অপশনের সেশন কিছুক্ষণ ধরে রাখা হয় (IDLE_MS পর কেউ না চালালে বন্ধ হয়, মেমরি ছেড়ে দিতে)।
  // Proofreader প্রতিটি কলের লেখা আলাদাভাবে যাচাই করে।
  const IDLE_MS = 120000;
  const POOL = new Map();

  async function acquire(kind, options, onProgress) {
    const key = kind + ':' + JSON.stringify(options);
    let e = POOL.get(key);
    if (!e) {
      e = { busy: 0, timer: 0, p: null };
      const mine = e;
      e.p = make(kind, options, onProgress).catch((err) => { // ব্যর্থ সেশন ধরে রাখা হয় না
        if (POOL.get(key) === mine) POOL.delete(key);
        throw err;
      });
      POOL.set(key, e);
    }
    e.busy++;
    clearTimeout(e.timer);
    const entry = e;
    const release = () => {
      entry.busy--;
      if (entry.busy > 0) return;
      entry.timer = setTimeout(() => {
        if (POOL.get(key) === entry) POOL.delete(key);
        entry.p.then(done, () => {});
      }, IDLE_MS);
      if (entry.timer && entry.timer.unref) entry.timer.unref(); // Node টেস্ট যেন আটকে না থাকে
    };
    try {
      return { inst: await e.p, release };
    } catch (err) {
      entry.busy--;
      throw err;
    }
  }

  // তালিকার চিহ্ন (*, -) বদলে • বসায়
  const tidy = (s) => String(s == null ? '' : s).replace(/^[ \t]*[*\-•][ \t]+/gm, '• ').trim();

  async function ensure(kind, work) {
    const av = await availability(kind, { expectedInputLanguages: [work], outputLanguage: work });
    if (av === 'missing') throw new Error('no-api');
    if (av === 'unavailable') throw new Error('unavailable');
  }

  // ---------------------------------------------------- বানান ও ব্যাকরণ

  // corrections-এর অবস্থান ধরে [{text, changed, title}] বানায়; মেলাতে না পারলে null
  function buildParts(original, corrections, corrected) {
    if (!Array.isArray(corrections) || !corrections.length) return null;
    const list = corrections
      .filter((c) => c && Number.isInteger(c.startIndex) && Number.isInteger(c.endIndex) && c.endIndex >= c.startIndex)
      .sort((a, b) => a.startIndex - b.startIndex);
    if (!list.length) return null;
    const parts = [];
    let pos = 0;
    let rebuilt = '';
    for (const c of list) {
      if (c.startIndex < pos || c.endIndex > original.length) return null; // গোলমেলে অবস্থান
      if (c.startIndex > pos) {
        const same = original.slice(pos, c.startIndex);
        parts.push({ text: same, changed: false });
        rebuilt += same;
      }
      const to = c.correction == null ? '' : String(c.correction);
      const was = original.slice(c.startIndex, c.endIndex);
      if (to) parts.push({ text: to, from: was, changed: true, title: c.explanation ? was + ' → ' + to + '\n' + c.explanation : was + ' → ' + to });
      rebuilt += to;
      pos = c.endIndex;
    }
    if (pos < original.length) {
      const tail = original.slice(pos);
      parts.push({ text: tail, changed: false });
      rebuilt += tail;
    }
    return rebuilt === corrected ? parts : null;
  }

  async function proofread(text, o) {
    const check = checker(o);
    const pl = plan('proofreader', o.lang);
    if (pl.unsupported) throw new Error('lang-unsupported');
    // Local Chrome Proofreader only; no Gemini/API-key dependency.
    await ensure('proofreader', 'en');
    let hp;
    try {
      hp = await acquire(
        'proofreader',
        {
          expectedInputLanguages: ['en'],
          includeCorrectionTypes: true,
          includeCorrectionExplanations: true,
          correctionExplanationLanguage: 'en',
        },
        o.onProgress
      );
    } catch (e) {
      // পুরনো সংস্করণ বাড়তি অপশন না চিনলে শুধু ভাষা দিয়ে আবার
      if (e && (e.name === 'TypeError' || e.name === 'NotSupportedError')) {
        hp = await acquire('proofreader', { expectedInputLanguages: ['en'] }, o.onProgress);
      } else {
        throw e;
      }
    }
    const p = hp.inst;
    try {
      check();
      const res = await p.proofread(text);
      check();
      const corrected = String(res.correctedInput != null ? res.correctedInput : res.corrected != null ? res.corrected : text);
      const list = Array.isArray(res.corrections) ? res.corrections : [];
      return { text: corrected, parts: buildParts(text, list, corrected), count: list.length };
    } finally {
      hp.release();
    }
  }

  // পপআপ থেকে মডেল আগেভাগে নামানোর জন্য (ক্লিকের ভেতর থেকে ডাকতে হবে)
  async function prepare(kind, onProgress) {
    const opts = { expectedInputLanguages: ['en'] };
    const inst = await make(kind, opts, onProgress);
    done(inst);
  }

  const AI = { status, availability, plan, buildParts, tidy, proofread, prepare };
  root.BVT_AI = AI;
  if (typeof module === 'object' && module.exports) module.exports = AI;
})(typeof globalThis !== 'undefined' ? globalThis : this);
