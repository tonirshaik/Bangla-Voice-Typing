// node date-tests/test-dates.js
const assert = require('assert');
const d = require('../dates.js');

const bn = (y, m, day) => d.banglaText(new Date(y, m - 1, day));
assert.strictEqual(bn(2026, 4, 14), '১ বৈশাখ ১৪৩৩, মঙ্গলবার');
assert.strictEqual(bn(2026, 4, 13), '৩০ চৈত্র ১৪৩২, সোমবার');
assert.strictEqual(bn(2026, 2, 21), '৮ ফাল্গুন ১৪৩২, শনিবার');
assert.strictEqual(bn(2026, 10, 20), '৪ কার্তিক ১৪৩৩, মঙ্গলবার');

assert.strictEqual(d.englishText(new Date(2026, 9, 20)), 'Tuesday, 20 October 2026');
assert.strictEqual(d.isoDate(new Date(2026, 0, 5)), '2026-01-05');
assert.strictEqual(d.clock(new Date(2026, 0, 5, 7, 3, 9)), '07:03:09');

const t12 = (h, mi, se) => d.clock12(new Date(2026, 0, 5, h, mi, se));
assert.strictEqual(t12(0, 5, 9), '12:05:09 AM');   // মধ্যরাত
assert.strictEqual(t12(7, 3, 9), '07:03:09 AM');
assert.strictEqual(t12(12, 0, 0), '12:00:00 PM');  // দুপুর
assert.strictEqual(t12(17, 43, 51), '05:43:51 PM');
assert.strictEqual(t12(23, 59, 59), '11:59:59 PM');

const ar = d.arabicText(new Date(2026, 9, 20));
assert.strictEqual(ar, '৯ জমাদিউল আউয়াল ১৪৪৮ হিজরি');
assert.ok(!/[\u0600-\u06FF]/.test(ar), 'no Arabic-script characters expected, got ' + ar);
console.log('dates ok ·', bn(2026, 10, 20), '·', d.englishText(new Date(2026, 9, 20)), '·', ar, '·', d.gmtOffset(new Date()));
