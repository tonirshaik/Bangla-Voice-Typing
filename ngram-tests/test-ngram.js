#!/usr/bin/env node
/* bn-ngrams.js + phonetic-lib.js-এর bigram/trigram অংশের টেস্ট। চালাতে (এক্সটেনশনের মূল ফোল্ডার থেকে):
 *   node ngram-tests/test-ngram.js */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ROOT = process.cwd();
const sandbox = { console, module: { exports: {} }, exports: {}, globalThis: null };
sandbox.globalThis = sandbox; vm.createContext(sandbox);
for (const f of ['phonetic-dict.js', 'bn-words.js', 'bn-ngrams.js', 'phonetic-lib.js']) {
  const file = path.join(ROOT, f);
  if (!fs.existsSync(file)) { console.error(`ERROR: ${f} পাওয়া যায়নি — Extension-এর মূল ফোল্ডার থেকে চালাও।`); process.exit(2); }
  vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox, { filename: file, timeout: 5000 });
}
const P = sandbox.BVTPhonetic;
const NG = sandbox.BVTBnNgrams;
const F = sandbox.BVTBnFreq;
let pass = 0, fail = 0;
const check = (name, ok, detail) => { if (ok) pass++; else { fail++; console.error(`FAIL ${name}${detail ? ': ' + detail : ''}`); } };

check('bn-ngrams.js লোড হয়েছে', !!(NG && NG.bi && NG.tri && Object.keys(NG.bi).length > 100));
check('hasNgrams()', P.hasNgrams() === true);

// ১. পরের শব্দের পরামর্শ
const afterAmi = P.predictNext(['আমি'], 20);
check('আমি → যাচ্ছি', afterAmi.includes('যাচ্ছি'), afterAmi.join(' '));
check('আমি → ভালো', afterAmi.includes('ভালো'), afterAmi.join(' '));
check('কেমন → আছো/আছেন', ['আছো', 'আছেন'].every((x) => P.predictNext(['কেমন'], 5).includes(x)));
check('সর্বোচ্চ সংখ্যা মানে', P.predictNext(['আমি'], 3).length === 3);
check('অজানা শব্দের পর খালি', P.predictNext(['ঠঠঠঠঠ'], 5).length === 0);
check('কনটেক্সট ছাড়া খালি', P.predictNext([], 5).length === 0);

// ২. trigram, bigram-এর আগে
check('trigram আগে: আজ আমি → যাব', P.predictNext(['আজ', 'আমি'], 1)[0] === 'যাব', P.predictNext(['আজ', 'আমি'], 3).join(' '));
check('trigram না মিললে bigram-এ নামে', P.predictNext(['ঠঠঠ', 'আমি'], 8).includes('যাচ্ছি'));

// ৩. বানান সাজানো
const top = (w, ctx) => P.suggest(w, 8, 5, ctx)[0];
check('তুমি ki → কি', top('ki', ['তুমি']) === 'কি', P.suggest('ki', 8, 5, ['তুমি']).join(' '));
check('তোমার নাম ki → কী', top('ki', ['তোমার', 'নাম']) === 'কী', P.suggest('ki', 8, 5, ['তোমার', 'নাম']).join(' '));
check('আমি + আংশিক ja → যাচ্ছি আসে', P.suggest('ja', 8, 5, ['আমি']).includes('যাচ্ছি'));
check('কনটেক্সট ছাড়া আগের মতোই', JSON.stringify(P.suggest('tomar', 8, 5)) === JSON.stringify(P.suggest('tomar', 8, 5, [])));
check('অজানা কনটেক্সটে আগের মতোই', JSON.stringify(P.suggest('tomar', 8, 5)) === JSON.stringify(P.suggest('tomar', 8, 5, ['ঠঠঠ'])));
check('rerank: প্রমাণ না থাকা শব্দের ক্রম অক্ষত', JSON.stringify(P.rerank(['ক', 'খ', 'গ'], ['আমি'])) === JSON.stringify(['ক', 'খ', 'গ']));
check('rerank: কনটেক্সটে দেখা শব্দ আগে', P.rerank(['ক', 'যাচ্ছি', 'খ'], ['আমি'])[0] === 'যাচ্ছি');

// ৪. ব্যবহারকারীর শেখা জোড়া
const before = P.predictNext(['আমি'], 1)[0];
P.setUserNgrams({ bi: { 'আমি': { 'ঘুমাচ্ছি': 6 } }, tri: {} });
check('বহু বার বাছা শব্দ উপরে ওঠে', P.predictNext(['আমি'], 1)[0] === 'ঘুমাচ্ছি');
P.setUserNgrams({ bi: { 'আমি': { 'ঘুমাচ্ছি': 1 } }, tri: {} });
check('১ বার বাছায় বই-এর শীর্ষ শব্দ পুরোপুরি হারিয়ে যায় না', P.predictNext(['আমি'], 5).includes(before));
P.setUserNgrams({ bi: { 'আমি': { 'ঘুমাচ্ছি': 'abc', 'যাব': -3 } }, tri: null });
check('ভাঙা ডেটায় এরর হয় না', Array.isArray(P.predictNext(['আমি'], 5)));
P.setUserNgrams(null);
check('রিসেটের পর আগের অবস্থা', P.predictNext(['আমি'], 1)[0] === before);

// ৫. ডেটার মান: সব শব্দ শব্দভান্ডারে আছে, সংখ্যা ধনাত্মক
let unknown = 0, badCount = 0;
for (const tbl of [NG.bi, NG.tri]) {
  for (const ctx of Object.keys(tbl)) {
    for (const w of ctx.split(' ').concat(Object.keys(tbl[ctx]))) if (!(w in F)) unknown++;
    for (const w of Object.keys(tbl[ctx])) if (!(tbl[ctx][w] > 0)) badCount++;
  }
}
check('bn-ngrams.js-এর সব শব্দ bn-words.js-এ আছে', unknown === 0, unknown + 'টা নেই');
check('সব সংখ্যা ধনাত্মক', badCount === 0);

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
