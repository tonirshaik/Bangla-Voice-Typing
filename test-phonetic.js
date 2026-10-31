#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ROOT = process.cwd();
const cases = JSON.parse(fs.readFileSync(path.join(__dirname, 'phonetic-cases.json'), 'utf8'));
const rawCases = JSON.parse(fs.readFileSync(path.join(__dirname, 'phonetic-transliteration-cases.json'), 'utf8'));
const englishCases = JSON.parse(fs.readFileSync(path.join(__dirname, 'english-word-cases.json'), 'utf8'));
const dictPath = path.join(ROOT, 'phonetic-dict.js');
const enginePath = path.join(ROOT, 'phonetic-lib.js');
function fail(message) { console.error(`\nERROR: ${message}`); process.exit(2); }
if (!fs.existsSync(dictPath)) fail('phonetic-dict.js পাওয়া যায়নি। Extension-এর মূল ফোল্ডার থেকে কমান্ড চালাও।');
if (!fs.existsSync(enginePath)) fail('phonetic-lib.js পাওয়া যায়নি। Extension-এর মূল ফোল্ডারে আসল ফাইলটি রাখো।');
const sandbox = { console, module: { exports: {} }, exports: {}, globalThis: null };
sandbox.globalThis = sandbox; vm.createContext(sandbox);
for (const file of [dictPath, enginePath]) vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox, { filename: file, timeout: 5000 });
const P = sandbox.BVTPhonetic || sandbox.module.exports;
if (!P || typeof P.defaultFor !== 'function' || typeof P.transliterate !== 'function') fail('BVTPhonetic.defaultFor() ও BVTPhonetic.transliterate() API পাওয়া যায়নি।');
const dict = sandbox.BVTPhoneticDict;
const norm = value => String(value).normalize('NFC');
let failed = 0, converterPassed = 0, rawPassed = 0, dictPassed = 0, englishPassed = 0;
for (const item of cases) {
  let actual;
  try { actual = P.defaultFor(item.roman); }
  catch (error) { failed++; console.error(`CONVERTER FAIL ${item.roman}: error: ${error.message}`); continue; }
  if (norm(actual) !== norm(item.expected)) { failed++; console.error(`CONVERTER FAIL ${item.roman}: expected [${item.expected}], got [${actual}]`); }
  else converterPassed++;
  const value = dict && dict[item.roman];
  if (!value || norm(value[0]) !== norm(item.expected)) { failed++; console.error(`DICT FAIL ${item.roman}: expected [${item.expected}], got [${value ? value[0] : 'MISSING'}]`); }
  else dictPassed++;
}
for (const item of rawCases) {
  let actual;
  try { actual = P.transliterate(item.roman); }
  catch (error) { failed++; console.error(`RULE FAIL ${item.roman}: error: ${error.message}`); continue; }
  if (norm(actual) !== norm(item.expected)) { failed++; console.error(`RULE FAIL ${item.roman}: expected [${item.expected}], got [${actual}]`); }
  else rawPassed++;
}
for (const item of englishCases) {
  let actual;
  try { actual = P.defaultFor(item.roman); }
  catch (error) { failed++; console.error(`ENGLISH FAIL ${item.roman}: error: ${error.message}`); continue; }
  if (norm(actual) !== norm(item.expected)) { failed++; console.error(`ENGLISH FAIL ${item.roman}: expected [${item.expected}], got [${actual}]`); }
  else englishPassed++;
}
const mixedCases = [
  { input: 'ami meeting e jabo', expected: 'আমি meeting এ যাবো' },
  { input: 'amar project update dao', expected: 'আমার project update দাও' },
  { input: 'ki meeting ache', expected: 'কি meeting আছে' },
  { input: 'na, project ta open koro', expected: 'না, project তা open করো' },
  { input: 'ami Facebook e jabo', expected: 'আমি ফেসবুক এ যাবো' },
  { input: 'Sylhet theke Chattogram jabo', expected: 'সিলেট থেকে চট্টগ্রাম যাবো' },
  { input: 'bKash e taka dao', expected: 'বিকাশ এ টাকা দাও' }
];
let mixedPassed = 0;
for (const item of mixedCases) {
  let actual;
  try { actual = P.convertText(item.input); }
  catch (error) { failed++; console.error(`MIXED FAIL ${item.input}: error: ${error.message}`); continue; }
  if (norm(actual) !== norm(item.expected)) { failed++; console.error(`MIXED FAIL ${item.input}: expected [${item.expected}], got [${actual}]`); }
  else mixedPassed++;
}

// ---- ব্যঞ্জন-কাঠামো মেলানো সাজেশন (রেফ/যুক্তাক্ষর): Extension-এর আসল অবস্থার মতো bn-words.js-সহ আলাদা sandbox-এ।
// নিয়ম: (১) সঠিক শব্দ প্রথম ৪টার মধ্যে; (২) প্রথম সাজেশন আগের মতোই থাকে (Space-এ যা বসে তা বদলায় না);
// (৩) হাতে-লেখা তালিকার শব্দের পুরো সাজেশন-তালিকা কাঠামো-মেলা শব্দ ছাড়া আগের মতোই।
const skeletonCases = JSON.parse(fs.readFileSync(path.join(__dirname, 'skeleton-cases.json'), 'utf8'));
const wordsPath = path.join(ROOT, 'bn-words.js');
let skeletonPassed = 0, firstKeptPassed = 0, firstKeptTotal = 0, skeletonTotal = 0, SKELETON_RAN = false;
if (fs.existsSync(wordsPath)) {
  SKELETON_RAN = true;
  const sb2 = { console, module: { exports: {} }, exports: {}, globalThis: null };
  sb2.globalThis = sb2; vm.createContext(sb2);
  for (const file of [dictPath, wordsPath, enginePath]) vm.runInContext(fs.readFileSync(file, 'utf8'), sb2, { filename: file, timeout: 20000 });
  const P2 = sb2.BVTPhonetic;
  const MAX_POS = 3; // শূন্য থেকে গোনা: প্রথম ৪টার মধ্যে
  for (const item of skeletonCases) {
    skeletonTotal++;
    let list;
    try { list = P2.suggest(item.roman, 8, 5).map(norm); }
    catch (error) { failed++; console.error(`SKELETON FAIL ${item.roman}: error: ${error.message}`); continue; }
    const pos = list.indexOf(norm(item.expected));
    if (pos < 0 || pos > MAX_POS) { failed++; console.error(`SKELETON FAIL ${item.roman}: [${item.expected}] প্রথম ${MAX_POS + 1}টায় নেই (অবস্থান ${pos}); তালিকা: ${list.slice(0, 6).join(' | ')}`); }
    else skeletonPassed++;
    // প্রথম সাজেশন বদলায়নি তো? কাঠামো-যোগ ছাড়া তালিকার প্রথমটার সঙ্গে মেলাই (candidates-এর প্রথমটা বা completions)
    firstKeptTotal++;
    const before = P2.candidates(item.roman, 8).map(norm);
    const comp = P2.completions(item.roman, 5).map(norm);
    if (list[0] === before[0] || (before.length === 0 && list[0] === comp[0])) firstKeptPassed++;
    else { failed++; console.error(`FIRST-CHANGED FAIL ${item.roman}: প্রথম সাজেশন বদলে গেছে: [${list[0]}] (আগে [${before[0]}])`); }
  }
  // হাতে-লেখা তালিকার শব্দে প্রথম সাজেশন সবসময় তালিকার প্রধান রূপ হতে হবে
  for (const item of cases) {
    firstKeptTotal++;
    const got = norm(P2.suggest(item.roman, 8, 5)[0]);
    if (got === norm(item.expected)) firstKeptPassed++;
    else { failed++; console.error(`DICT-FIRST FAIL ${item.roman}: expected [${item.expected}], got [${got}]`); }
  }
}
console.log(`\nPhonetic regression: ${cases.length} dictionary/converter cases + ${rawCases.length} raw-rule cases + ${englishCases.length} English/Bangla-priority cases + ${mixedCases.length} mixed-text cases`);
console.log(`Converter: ${converterPassed}/${cases.length} passed`);
console.log(`Dictionary: ${dictPassed}/${cases.length} passed`);
console.log(`Raw transliteration rules: ${rawPassed}/${rawCases.length} passed`);
console.log(`English/Bangla-priority cases: ${englishPassed}/${englishCases.length} passed`);
console.log(`Mixed text cases: ${mixedPassed}/${mixedCases.length} passed`);
if (SKELETON_RAN) { console.log(`Skeleton (রেফ/যুক্তাক্ষর) cases: ${skeletonPassed}/${skeletonTotal} passed`); console.log(`First-suggestion-unchanged checks: ${firstKeptPassed}/${firstKeptTotal} passed`); }
else console.log('Skeleton cases: bn-words.js না পাওয়ায় বাদ।');
if (failed) { console.error(`\nFAILED: ${failed} checks. উপরের FAIL-গুলো দেখে ঠিক করে আবার চালাও।`); process.exitCode = 1; }
else console.log('PASS: সব regression case ঠিক আছে।');
