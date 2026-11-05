/* find-lib.js-এর টেস্ট: node find-tests/test-find.js */
'use strict';
globalThis.BVTBnFreq = require('../bn-words.js');
globalThis.BVTPhoneticDict = require('../phonetic-dict.js');
const P = require('../phonetic-lib.js');
const F = require('../find-lib.js');

let fail = 0;
let total = 0;
const ok = (cond, msg) => { total++; if (!cond) { fail++; console.log('✗', msg); } };
const eq = (a, b, msg) => ok(JSON.stringify(a) === JSON.stringify(b), `${msg}: পেয়েছি ${JSON.stringify(a)}, চেয়েছি ${JSON.stringify(b)}`);
const spans = (t, q, o) => F.findAll(t, q, o).matches.map((m) => [m.start, m.end]);

// ---- মূল উদাহরণ: রনি → রাহাত
const para = 'রনি আজ স্কুলে গিয়েছে। রনি বলল, "আমি ভালো আছি।" সবাই রনির সঙ্গে খেলল। রনি!';
eq(F.findAll(para, 'রনি').matches.length, 4, '"রনি" ৪ জায়গায় (রনির-ও ধরে)');
const r1 = F.replaceAll(para, 'রনি', 'রাহাত');
eq(r1.count, 4, 'সব বদলানো গণনা');
// রনির-এর ভেতরের রনি-ও বদলায় (সাধারণ খোঁজা অক্ষর ধরে); শুধু আলাদা শব্দ চাইলে "পুরো শব্দ" দেখুন নিচে
const r1w = F.replaceAll(para, 'রনি', 'রাহাত', { wholeWord: true });
ok(r1w.count === 3 && r1w.text.includes('রনির সঙ্গে'), 'পুরো শব্দে বদলালে রনির অক্ষত: ' + r1w.text);
ok(!r1.text.includes('রনি') && r1.text.startsWith('রাহাত আজ') && r1.text.includes('রাহাতর সঙ্গে'), 'বদলানো লেখা ঠিক: ' + r1.text);

// ---- পুরো শব্দ: বাংলার কার/ফলা শব্দের অংশ
eq(F.findAll(para, 'রনি', { wholeWord: true }).matches.length, 3, 'পুরো শব্দ: রনির বাদ');
eq(F.findAll('আমি আমিন আমির', 'আমি', { wholeWord: true }).matches.length, 1, 'আমি/আমিন/আমির');
eq(F.findAll('কর করি করা', 'কর', { wholeWord: true }).matches.length, 1, 'কর বনাম করি, করা (কার শব্দের অংশ)');
eq(F.findAll('a cat concat cat.', 'cat', { wholeWord: true }).matches.length, 2, 'ইংরেজি পুরো শব্দ');
eq(F.findAll('হাঁস, হাঁস।', 'হাঁস', { wholeWord: true }).matches.length, 2, 'যতিচিহ্ন শব্দসীমা');

// ---- ছোট/বড় হাতের মিল
eq(F.findAll('Roni roni RONI', 'roni').matches.length, 3, 'ডিফল্ট: বড়/ছোট সমান');
eq(F.findAll('Roni roni RONI', 'roni', { matchCase: true }).matches.length, 1, 'Match case');

// ---- অদৃশ্য অক্ষর (ZWJ/ZWNJ)
const withZwnj = 'রাষ্ট্র\u200cীয় আর র\u200dযাব';
eq(F.findAll(withZwnj, 'রাষ্ট্রীয়').matches.length, 1, 'ZWNJ-সহ লেখা, ছাড়া খোঁজা');
eq(F.findAll('রাষ্ট্রীয়', 'রাষ্ট্র\u200cীয়').matches.length, 1, 'ZWNJ ছাড়া লেখা, সহ খোঁজা');
const z = F.findAll(withZwnj, 'রাষ্ট্রীয়').matches[0];
eq(withZwnj.slice(z.start, z.end), 'রাষ্ট্র\u200cীয়', 'ZWNJ-সহ পুরো অংশ নির্বাচিত');

// ---- ড় ঢ় য়: দুই রূপ
const dr1 = 'বা\u09dcি'; // precomposed ড়
const dr2 = 'বা\u09a1\u09bcি'; // ড + ়
eq(F.findAll(dr1 + ' ' + dr2, dr1).matches.length, 2, 'ড় (এক অক্ষর) খুঁজলে দুই রূপই');
eq(F.findAll(dr1 + ' ' + dr2, dr2).matches.length, 2, 'ড় (দুই অক্ষর) খুঁজলে দুই রূপই');
const yy = F.replaceAll('ব\u09dfস আর ব\u09af\u09bcস', 'ব\u09dfস', 'বয়স');
eq(yy.count, 2, 'য় দুই রূপ বদলানো');

// ---- অঙ্ক
eq(F.findAll('১২৩ আর 123', '123').matches.length, 2, '123 খুঁজলে ১২৩-ও');
eq(F.findAll('১২৩ আর 123', '১২৩').matches.length, 2, '১২৩ খুঁজলে 123-ও');
eq(F.findAll('১২৩ আর 123', '123', { fold: false }).matches.length, 1, 'fold বন্ধ করলে আলাদা');

// ---- Regex
eq(spans('a1 b22 c333', '\\d+', { regex: true }), [[1, 2], [4, 6], [8, 11]], 'Regex অঙ্ক');
eq(F.findAll('abc', '(', { regex: true }).error, 'Invalid regular expression', 'ভুল Regex-এ error');
eq(F.findAll('abc', '(').error, null, 'সাধারণ মোডে ( ঠিক আছে'); // শুধু বন্ধনী লেখা
eq(F.findAll('a.c abc', 'a.c').matches.length, 1, 'সাধারণ মোডে . আক্ষরিক');
eq(F.findAll('abc', 'x*', { regex: true }).matches.length, 0, 'খালি মিল বাদ, ঝুলে যায় না');
const rg = F.replaceAll('2026-10-18', '(\\d+)-(\\d+)-(\\d+)', '$3/$2/$1', { regex: true });
eq(rg.text, '18/10/2026', 'Regex ক্যাপচার $1 $2 $3');
eq(F.replaceAll('a,b', ',', '\\n', { regex: true }).text, 'a\nb', 'Regex মোডে \\n নতুন লাইন');
eq(F.replaceAll('a,b', ',', '\\n').text, 'a\\nb', 'সাধারণ মোডে \\n আক্ষরিক');
eq(F.replaceAll('cost', 'cost', '$&$&', { regex: true }).text, 'costcost', '$& পুরো মিল');
eq(F.findAll('foo.bar', '\\.', { regex: true }).matches.length, 1, '\\. u-ফ্ল্যাগে ঠিক');
eq(F.findAll('a-b', '\\-', { regex: true }).matches.length, 1, '\\- (u ছাড়া ফেরত)');

// ---- বিশেষ অক্ষর আক্ষরিক
eq(F.findAll('1+1=2 (a) [b] $5 ^ | \\ ?', '1+1').matches.length, 1, '+ আক্ষরিক');
eq(F.findAll('1+1=2 (a) [b] $5 ^ | \\ ?', '$5').matches.length, 1, '$ আক্ষরিক');
eq(F.findAll('x \\ y', '\\').matches.length, 1, 'ব্যাকস্ল্যাশ আক্ষরিক');
eq(F.replaceAll('ক $ খ', '$', '$&').text, 'ক $& খ', 'সাধারণ মোডে $& আক্ষরিক');

// ---- বদলানোর বিশেষ ঘটনা
eq(F.replaceAll('aaa', 'a', 'aa').text, 'aaaaaa', 'বদলানো লেখায় খোঁজার শব্দ থাকলে লুপ নেই');
eq(F.replaceAll('রনি রনি', 'রনি', '').text, ' ', 'খালি দিয়ে বদলানো (মোছা)');
eq(F.replaceAll('abc', 'x', 'y').count, 0, 'মিল নেই → ০');
eq(F.replaceAll('', 'x', 'y').text, '', 'খালি লেখা');
eq(F.replaceAll('abc', '', 'y').count, 0, 'খালি খোঁজা → কিছু বদলায় না');
eq(F.replaceAll('রনি', 'রনি', 'রাহাত\nআলী').text, 'রাহাত\nআলী', 'নতুন লাইনসহ বদলানো');

// ---- AB: ছোট/বড় হাতের ধরন বজায় রাখা
const pc = (t, q, r) => F.replaceAll(t, q, r, { preserveCase: true }).text;
eq(pc('Roni RONI roni', 'roni', 'rahat'), 'Rahat RAHAT rahat', 'preserveCase');
eq(pc('রনি', 'রনি', 'rahat'), 'rahat', 'বাংলা মিলে preserveCase কিছু বদলায় না');
eq(pc('A', 'a', 'xyz'), 'Xyz', 'একটা বড় অক্ষর → Capitalize');

// ---- সিলেকশনের ভেতরে খোঁজা
const scoped = 'রনি রনি রনি রনি';
eq(spans(scoped, 'রনি', { range: [4, 11] }), [[4, 7], [8, 11]], 'range-এর ভেতরের মিল শুধু');
eq(F.findAll(scoped, 'রনি', { range: [5, 11] }).matches.length, 1, 'range-এ আধা মিল বাদ');

// ---- ফোনেটিক খোঁজা
const exp = (q) => P.candidates(q, 3);
const ph = F.findAll('আমি তুমি আমরা তুমি', 'tumi', { expand: exp });
eq(ph.matches.length, 2, 'ফোনেটিক: tumi → তুমি');
const ph2 = F.findAll('Roni and tumi', 'tumi', { expand: exp });
eq(ph2.matches.length, 1, 'ফোনেটিক: ইংরেজি লেখার মধ্যে tumi → তুমি');
const ph3 = F.findAll('tumi এবং তুমি', 'tumi', { expand: exp });
eq(ph3.matches.length, 2, 'ফোনেটিক: সরাসরি tumi আর তুমি দুটোই');
eq(F.findAll('তুমি', 'tumi', { expand: exp, regex: true }).matches.length, 0, 'Regex মোডে ফোনেটিক বন্ধ');

// ---- সংখ্যা সীমা আর গতি
const big = 'ক '.repeat(10000);
const bg = F.findAll(big, 'ক');
ok(bg.capped && bg.matches.length === F.MAX_MATCHES, 'সীমা ছাড়ালে capped');
const t0 = Date.now();
F.replaceAll('রনি '.repeat(50000), 'রনি', 'রাহাত');
ok(Date.now() - t0 < 1500, 'বড় লেখায় গতি ঠিক আছে: ' + (Date.now() - t0) + 'ms');

// ---- ইমোজি/সারোগেট
eq(F.findAll('a😀b😀', '😀').matches.length, 2, 'ইমোজি খোঁজা');
eq(F.replaceAll('a😀b', '😀', ':)').text, 'a:)b', 'ইমোজি বদলানো');

console.log(fail ? `\n${fail}/${total} ব্যর্থ` : `\nসব ${total}টি টেস্ট পাশ ✓`);
process.exit(fail ? 1 : 0);
