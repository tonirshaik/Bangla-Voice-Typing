#!/usr/bin/env node
/* বাংলা শব্দভান্ডার (ফ্রিকোয়েন্সিসহ) থেকে bn-words.js বানায়।
 *
 * ব্যবহার:
 *   node build-wordlist.js [--max 50000] [--min 3] [-o bn-words.js] ফাইল1 [ফাইল2 …]
 *
 * ইনপুট দুই রকম হতে পারে (ফাইল ধরে ধরে নিজে থেকে চেনে):
 *   • ফ্রিকোয়েন্সি তালিকা: প্রতি লাইনে "শব্দ সংখ্যা" (যেমন hermitdave/FrequencyWords-এর bn_50k.txt)
 *   • সাধারণ বাংলা লেখা (উইকিপিডিয়া/ওপেন কর্পাস থেকে বের করা টেক্সট): শব্দ গুনে নেয়
 * একাধিক ফাইল দিলে সংখ্যা যোগ হয়ে যায়।
 *
 * আউটপুট: bn-words.js — root.BVTBnFreq = { শব্দ: ফ্রিকোয়েন্সি }, phonetic-lib.js এটা নিজে ব্যবহার করে। */
'use strict';
const fs = require('fs');

const args = process.argv.slice(2);
let max = 50000;
let min = 3;
let out = 'bn-words.js';
const files = [];
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--max') max = Number(args[++i]);
  else if (a === '--min') min = Number(args[++i]);
  else if (a === '-o') out = args[++i];
  else files.push(a);
}
if (!files.length) {
  console.error('ব্যবহার: node build-wordlist.js [--max N] [--min N] [-o ফাইল] ইনপুট…');
  process.exit(1);
}

// শুধু বাংলা অক্ষরের শব্দ; NFC করলে ড়/ঢ়/য় ভেঙে (ড+়) হয় — phonetic-lib-এর আউটপুটের সঙ্গে মেলানোর জন্য
const BN_RUN = /[ঀ-৿]+/g;
const NOT_WORD = /[০-৯৲-৻৽-৿]/; // সংখ্যা, মুদ্রা ইত্যাদি
const norm = (s) => s.normalize('NFC').replace(/[​-‍﻿]/g, '');
// শব্দ শুরু হতে পারে না এমন চিহ্ন (কার, হসন্ত) — ভাঙা টুকরো বাদ দিতে
const BAD_START = /^[়া-্ৗঁ-ঃ]/;

const counts = new Map();
const bump = (w, n) => {
  if (!w || w.length > 25 || BAD_START.test(w) || NOT_WORD.test(w)) return;
  if (/্$/.test(w)) return; // হসন্ত দিয়ে শেষ — অসম্পূর্ণ
  counts.set(w, (counts.get(w) || 0) + n);
};

for (const f of files) {
  const text = fs.readFileSync(f, 'utf8');
  const lines = text.split(/\r?\n/);
  let freqLines = 0;
  let sample = 0;
  for (const l of lines.slice(0, 200)) { if (l.trim()) { sample++; if (/^\S+\s+\d+\s*$/.test(l)) freqLines++; } }
  const isFreqList = sample > 0 && freqLines / sample > 0.8;
  if (isFreqList) {
    for (const l of lines) {
      const m = /^(\S+)\s+(\d+)\s*$/.exec(l);
      if (!m) continue;
      const n = Number(m[2]);
      const runs = norm(m[1]).match(BN_RUN);
      if (runs && runs.length === 1 && runs[0] === norm(m[1])) bump(runs[0], n);
    }
  } else {
    for (const l of lines) {
      const runs = norm(l).match(BN_RUN);
      if (runs) for (const w of runs) bump(w, 1);
    }
  }
  console.error(`${f}: ${isFreqList ? 'ফ্রিকোয়েন্সি তালিকা' : 'সাধারণ লেখা'}`);
}

const list = [...counts.entries()]
  .filter(([, n]) => n >= min)
  .sort((a, b) => b[1] - a[1])
  .slice(0, max);

const body = list.map(([w, n]) => w + ' ' + n).join('\n');
const js =
  '/* বাংলা ভয়েস টাইপিং — বড় শব্দভান্ডার (ফ্রিকোয়েন্সিসহ), build-wordlist.js দিয়ে বানানো। হাতে বদলাবেন না।\n' +
  ' * ' + list.length + 'টা শব্দ। বিকল্প বানানের তালিকা সাজাতে phonetic-lib.js এটা ব্যবহার করে। */\n' +
  '(function (root) {\n' +
  "  'use strict';\n" +
  '  const RAW = `\n' + body + '\n`;\n' +
  '  const F = Object.create(null);\n' +
  "  for (const line of RAW.split('\\n')) {\n" +
  "    const i = line.lastIndexOf(' ');\n" +
  '    if (i > 0) F[line.slice(0, i)] = Number(line.slice(i + 1));\n' +
  '  }\n' +
  '  root.BVTBnFreq = F;\n' +
  "  if (typeof module === 'object' && module.exports) module.exports = F;\n" +
  "})(typeof globalThis !== 'undefined' ? globalThis : this);\n";

fs.writeFileSync(out, js);
console.error(`লেখা হলো: ${out} (${list.length} শব্দ, ${(Buffer.byteLength(js) / 1024).toFixed(0)} KB)`);
