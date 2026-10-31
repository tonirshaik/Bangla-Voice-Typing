#!/usr/bin/env node
/* বাংলা লেখা থেকে দুই-তিন শব্দের জোড়া (bigram/trigram) গুনে bn-ngrams.js বানায়।
 * পরের শব্দের পরামর্শ আর "আগের শব্দ দেখে সঠিক বানান উপরে আনা" — দুটোই এটা ব্যবহার করে।
 *
 * ব্যবহার:
 *   node build-ngrams.js [--min-bi 1] [--min-tri 1] [--top 20] [--max-bi 6000] [--max-tri 8000]
 *                        [--vocab bn-words.js] [-o bn-ngrams.js] ফাইল1 [ফাইল2 …]
 *
 * ইনপুট: সাধারণ বাংলা লেখা (প্রতি লাইনে এক বা একাধিক বাক্য)। বাক্যের সীমা: । ? ! . আর নতুন লাইন —
 * জোড়া কখনো বাক্য পেরিয়ে তৈরি হয় না। একাধিক ফাইল দিলে সংখ্যা যোগ হয়।
 *   • ছোট হাতে-লেখা তালিকা (ngram-seed.txt): --min-bi 1 --min-tri 1 (ডিফল্ট)
 *   • বড় কর্পাস (উইকিপিডিয়া/সংবাদ): --min-bi 3 --min-tri 2 দিলে আজেবাজে জোড়া বাদ যায়
 * --vocab দিলে যে শব্দ ওই তালিকায় নেই (বানান ভুল/টুকরো) সেগুলোর জোড়া বাদ যায় এবং বাদ পড়া শব্দ দেখায়।
 *
 * আউটপুট: bn-ngrams.js — root.BVTBnNgrams = { bi: { আগের: { পরের: সংখ্যা } }, tri: { 'আগের২ আগের১': { পরের: সংখ্যা } } } */
'use strict';
const fs = require('fs');

const args = process.argv.slice(2);
let minBi = 1, minTri = 1, top = 20, maxBi = 6000, maxTri = 8000;
let out = 'bn-ngrams.js';
let vocabFile = '';
const files = [];
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--min-bi') minBi = Number(args[++i]);
  else if (a === '--min-tri') minTri = Number(args[++i]);
  else if (a === '--top') top = Number(args[++i]);
  else if (a === '--max-bi') maxBi = Number(args[++i]);
  else if (a === '--max-tri') maxTri = Number(args[++i]);
  else if (a === '--vocab') vocabFile = args[++i];
  else if (a === '-o') out = args[++i];
  else files.push(a);
}
if (!files.length) {
  console.error('ব্যবহার: node build-ngrams.js [--min-bi N] [--min-tri N] [--top N] [--vocab bn-words.js] [-o ফাইল] ইনপুট…');
  process.exit(1);
}

// build-wordlist.js-এর মতোই: NFC (ড়/ঢ়/য় ভাঙা রূপে), শুধু বাংলা হরফের শব্দ
const BN_WORD = /^[ঀ-৿]+$/;
const NOT_WORD = /[০-৯৲-৻৽-৿]/;
const norm = (s) => s.normalize('NFC').replace(/[​-‍﻿]/g, '');
const BAD_START = /^[়া-্ৗঁ-ঃ]/;
const okWord = (w) => w && w.length <= 25 && BN_WORD.test(w) && !BAD_START.test(w) && !NOT_WORD.test(w) && !/্$/.test(w);

let vocab = null;
if (vocabFile) {
  vocab = require(require('path').resolve(vocabFile));
  console.error(`শব্দভান্ডার: ${Object.keys(vocab).length} শব্দ (${vocabFile})`);
}

const bi = new Map(); // 'a\tb' → n
const tri = new Map(); // 'a b\tc' → n
const missing = new Map();
const bump = (m, k) => m.set(k, (m.get(k) || 0) + 1);

for (const f of files) {
  const text = fs.readFileSync(f, 'utf8');
  let sentences = 0;
  for (const sentence of norm(text).split(/[।?!.\n\r]+/)) {
    // শব্দ আলাদা করা: ফাঁকা জায়গা বা বাংলা ছাড়া যেকোনো চিহ্ন (কমা সহ) — শব্দের ধারা ভাঙে
    const runs = sentence.split(/[^ঀ-৿]+/).filter(Boolean);
    // খারাপ/অজানা শব্দ (null) জোড়ার ধারা ভাঙে, যাতে তার দুই পাশের শব্দ জোড়া না লাগে
    const clean = runs.map((w) => {
      if (!okWord(w)) return null;
      if (vocab && !(w in vocab)) { missing.set(w, (missing.get(w) || 0) + 1); return null; }
      return w;
    });
    let seg = [];
    const flush = () => {
      for (let i = 1; i < seg.length; i++) {
        bump(bi, seg[i - 1] + '\t' + seg[i]);
        if (i >= 2) bump(tri, seg[i - 2] + ' ' + seg[i - 1] + '\t' + seg[i]);
      }
      seg = [];
    };
    for (const w of clean) { if (w === null) flush(); else seg.push(w); }
    flush();
    sentences++;
  }
  console.error(`${f}: ${sentences} বাক্য/লাইন`);
}

// { কনটেক্সট: { পরের: n } } — প্রতি কনটেক্সটে সবচেয়ে বেশি `top`টা পরের শব্দ রাখি
function pack(map, min, maxCtx) {
  const byCtx = new Map();
  for (const [k, n] of map) {
    if (n < min) continue;
    const i = k.indexOf('\t');
    const ctx = k.slice(0, i), next = k.slice(i + 1);
    if (!byCtx.has(ctx)) byCtx.set(ctx, []);
    byCtx.get(ctx).push([next, n]);
  }
  const rows = [...byCtx.entries()].map(([ctx, arr]) => {
    arr.sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
    const kept = arr.slice(0, top);
    return [ctx, kept, arr.reduce((s, x) => s + x[1], 0)];
  });
  rows.sort((a, b) => b[2] - a[2] || (a[0] < b[0] ? -1 : 1));
  const obj = {};
  for (const [ctx, kept] of rows.slice(0, maxCtx)) {
    obj[ctx] = {};
    for (const [w, n] of kept) obj[ctx][w] = n;
  }
  return obj;
}

const biObj = pack(bi, minBi, maxBi);
const triObj = pack(tri, minTri, maxTri);
const count = (o) => Object.values(o).reduce((s, v) => s + Object.keys(v).length, 0);

// এক লাইনে এক কনটেক্সট: "কনটেক্সট|পরের:n,পরের:n" — ছোট ও ডিফ করা সহজ
const lines = (o) => Object.entries(o).map(([c, v]) => c + '|' + Object.entries(v).map(([w, n]) => w + ':' + n).join(',')).join('\n');

const js =
  '/* বাংলা ভয়েস টাইপিং — দুই-তিন শব্দের জোড়া (bigram/trigram), build-ngrams.js দিয়ে বানানো। হাতে বদলাবেন না।\n' +
  ' * bigram: ' + Object.keys(biObj).length + ' কনটেক্সট / ' + count(biObj) + ' জোড়া; trigram: ' + Object.keys(triObj).length + ' কনটেক্সট / ' + count(triObj) + ' জোড়া।\n' +
  ' * phonetic-lib.js এটা দিয়ে পরের শব্দের পরামর্শ দেয় এবং আগের শব্দ দেখে বানানের তালিকা সাজায়। */\n' +
  '(function (root) {\n' +
  "  'use strict';\n" +
  '  const parse = (raw) => {\n' +
  '    const o = Object.create(null);\n' +
  "    for (const line of raw.split('\\n')) {\n" +
  "      const i = line.lastIndexOf('|');\n" +
  '      if (i <= 0) continue;\n' +
  '      const m = Object.create(null);\n' +
  "      for (const p of line.slice(i + 1).split(',')) {\n" +
  "        const j = p.lastIndexOf(':');\n" +
  '        if (j > 0) m[p.slice(0, j)] = Number(p.slice(j + 1));\n' +
  '      }\n' +
  '      o[line.slice(0, i)] = m;\n' +
  '    }\n' +
  '    return o;\n' +
  '  };\n' +
  '  const BI = `\n' + lines(biObj) + '\n`;\n' +
  '  const TRI = `\n' + lines(triObj) + '\n`;\n' +
  '  root.BVTBnNgrams = { bi: parse(BI), tri: parse(TRI) };\n' +
  "  if (typeof module === 'object' && module.exports) module.exports = root.BVTBnNgrams;\n" +
  "})(typeof globalThis !== 'undefined' ? globalThis : this);\n";

fs.writeFileSync(out, js);
console.error(`লেখা হলো: ${out} (bigram ${count(biObj)}, trigram ${count(triObj)}, ${(Buffer.byteLength(js) / 1024).toFixed(0)} KB)`);
if (vocab && missing.size) {
  const list = [...missing.entries()].sort((a, b) => b[1] - a[1]);
  console.error(`শব্দভান্ডারে নেই (${list.length}টা, এগুলোর জোড়া বাদ): ` + list.slice(0, 60).map(([w, n]) => w + (n > 1 ? '×' + n : '')).join(' '));
}
