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
  { input: 'na, project ta open koro', expected: 'না, project তা open করো' }
];
let mixedPassed = 0;
for (const item of mixedCases) {
  let actual;
  try { actual = P.convertText(item.input); }
  catch (error) { failed++; console.error(`MIXED FAIL ${item.input}: error: ${error.message}`); continue; }
  if (norm(actual) !== norm(item.expected)) { failed++; console.error(`MIXED FAIL ${item.input}: expected [${item.expected}], got [${actual}]`); }
  else mixedPassed++;
}
console.log(`\nPhonetic regression: ${cases.length} dictionary/converter cases + ${rawCases.length} raw-rule cases + ${englishCases.length} English/Bangla-priority cases + ${mixedCases.length} mixed-text cases`);
console.log(`Converter: ${converterPassed}/${cases.length} passed`);
console.log(`Dictionary: ${dictPassed}/${cases.length} passed`);
console.log(`Raw transliteration rules: ${rawPassed}/${rawCases.length} passed`);
console.log(`English/Bangla-priority cases: ${englishPassed}/${englishCases.length} passed`);
console.log(`Mixed text cases: ${mixedPassed}/${mixedCases.length} passed`);
if (failed) { console.error(`\nFAILED: ${failed} checks. উপরের FAIL-গুলো দেখে ঠিক করে আবার চালাও।`); process.exitCode = 1; }
else console.log('PASS: সব regression case ঠিক আছে।');
