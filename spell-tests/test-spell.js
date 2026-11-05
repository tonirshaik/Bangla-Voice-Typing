/* spell-lib.js-এর টেস্ট: node spell-tests/test-spell.js */
'use strict';
globalThis.BVTBnFreq = require('../bn-words.js');
globalThis.BVTPhoneticDict = require('../phonetic-dict.js');
const S = require('../spell-lib.js');

let fail = 0;
const ok = (cond, msg) => { if (!cond) { fail++; console.log('✗', msg); } };
const flagged = (t, skip) => S.findMisspelled(t, skip).map((x) => x.word);

// ঠিক বাক্যে দাগ পড়বে না (প্রত্যয়সহ রূপ আর যুক্তশব্দ মিলিয়ে)
const good = [
  'আমি আজকে বাজারে গিয়েছিলাম।',
  'ছেলেদেরকেও সাথে নিয়ে গিয়েছি।',
  'তুমি কি আমাকে ভালোবাসো?',
  'সে বইমেলায় গিয়েছিল এবং অনেকগুলো বই কিনেছে।',
  'বাংলাদেশের মানুষ খুব পরিশ্রমী।',
  'মায়ের হাতের রান্না খুব ভালো লাগে।',
  'করছিলাম যাচ্ছি খাচ্ছে দেখেছিলেন বলবেন',
  'শিক্ষার্থীরা বিশ্ববিদ্যালয়ে ভর্তি হচ্ছে।',
];
for (const t of good) ok(flagged(t).length === 0, 'ঠিক বাক্যে দাগ পড়েছে: ' + t + ' → ' + flagged(t).join(','));

// ভুল বানানে দাগ পড়বে
for (const w of ['সূন্দর', 'তুমী', 'বিশবিদ্যালয়', 'কম্পিউটর', 'ভাল্লো']) ok(flagged('আমি ' + w + ' আছি').includes(w), 'ভুল ধরা পড়েনি: ' + w);

// যা যাচাই হয় না
ok(flagged('abc সূন্দরabc').length === 0, 'ইংরেজির সঙ্গে লাগা শব্দ বাদ যায়নি');
ok(flagged('১২৩ সূন্দর১').length === 0, 'অঙ্ক লাগা শব্দ বাদ যায়নি');
ok(flagged('ও এ ক').length === 0, 'এক অক্ষরের শব্দ বাদ যায়নি');
ok(flagged('hello world 123').length === 0, 'ইংরেজি লেখায় দাগ পড়েছে');
ok(flagged('').length === 0 && flagged(null).length === 0, 'খালি লেখায় দাগ পড়েছে');

// ZWJ/ZWNJ আর নুক্তার দুই রূপ একই ধরা হবে
ok(S.isKnown('বাড়ি') === S.isKnown('বা\u09dcি'.replace('\u09dc', '\u09a1\u09bc')), 'ড় এর দুই রূপ আলাদা ধরা হয়েছে');
ok(S.isKnown('আমি\u200c') === true, 'ZWNJ-সহ চেনা শব্দ ধরা পড়েনি');

// কার্সর যে শব্দের গায়ে, সেটা বাদ
const t = 'আমি সূন্দর';
ok(flagged(t, [t.length, t.length]).length === 0, 'কার্সরের শব্দে দাগ পড়েছে');
ok(flagged(t + ' ', [t.length + 1, t.length + 1]).length === 1, 'কার্সর সরে গেলে দাগ পড়েনি');

// নিজের শব্দ যোগ করলে ঠিক হয়ে যায়
ok(flagged('সূন্দর').length === 1, 'আগেই চেনা হয়ে গেছে');
S.addKnown(['সূন্দর']);
ok(flagged('সূন্দর').length === 0, 'addKnown কাজ করেনি');

// শুরু-শেষ অবস্থান ঠিক আছে
const r = S.findMisspelled('এই তুমী ভালো', null);
ok(r.length === 1 && 'এই তুমী ভালো'.slice(r[0].start, r[0].end) === 'তুমী', 'অবস্থান ঠিক নয়');

// সাজেশন
ok(S.suggest('সূন্দর', 6).includes('সুন্দর'), 'সূন্দর-এর সাজেশনে সুন্দর নেই');
ok(S.suggest('বিশবিদ্যালয়', 6).includes('বিশ্ববিদ্যালয়'), 'বিশবিদ্যালয়-এর সাজেশনে বিশ্ববিদ্যালয় নেই');
ok(S.suggest('আমাজ', 6).includes('আমার'), 'আমাজ-এর সাজেশনে আমার নেই');
ok(S.suggest('', 6).length === 0, 'খালি শব্দে সাজেশন এসেছে');

// গ্রুপ বদলালে আগের শব্দ মুছে যায়
S.setKnown('user', ['ঝঞ্ঝাটিয়া']);
ok(flagged('ঝঞ্ঝাটিয়া').length === 0, 'setKnown কাজ করেনি');
S.setKnown('user', []);
ok(flagged('ঝঞ্ঝাটিয়া').length === 1, 'setKnown পুরোনো শব্দ মোছেনি');

console.log(fail ? fail + 'টা টেস্ট ফেল' : 'সব টেস্ট পাস ✓');
process.exit(fail ? 1 : 0);
