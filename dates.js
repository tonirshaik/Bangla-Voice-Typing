/* বাংলা ভয়েস টাইপিং — আজকের তারিখ ও সময় (popup-এর ওপরের কার্ড)
 * বাংলা (বাংলাদেশের সংশোধিত পঞ্জিকা) · English (দিন-মাস-বছর) · আরবি/হিজরি (উম্মুল কুরা, বাংলা অক্ষরে) · ২৪-ঘণ্টার ঘড়ি + ১২-ঘণ্টার ঘড়ি (AM/PM) + GMT অফসেট + ISO 8601 তারিখ */
(() => {
  'use strict';

  const BN_D = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  const toBnDigits = (s) => String(s).replace(/[0-9]/g, (d) => BN_D[+d]);

  const BN_MONTHS = ['বৈশাখ', 'জ্যৈষ্ঠ', 'আষাঢ়', 'শ্রাবণ', 'ভাদ্র', 'আশ্বিন', 'কার্তিক', 'অগ্রহায়ণ', 'পৌষ', 'মাঘ', 'ফাল্গুন', 'চৈত্র'];
  const BN_DAYS = ['রবিবার', 'সোমবার', 'মঙ্গলবার', 'বুধবার', 'বৃহস্পতিবার', 'শুক্রবার', 'শনিবার'];
  // হিজরি মাসের নাম (বাংলায় প্রচলিত বানান), ক্রম ১–১২
  const HIJRI_MONTHS = ['মুহাররম', 'সফর', 'রবিউল আউয়াল', 'রবিউস সানি', 'জমাদিউল আউয়াল', 'জমাদিউস সানি', 'রজব', 'শাবান', 'রমজান', 'শাওয়াল', 'জিলকদ', 'জিলহজ'];
  const EN_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const EN_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  const isLeap = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  const DAY = 86400000;

  // বাংলাদেশের সংশোধিত পঞ্জিকা: ১ বৈশাখ = ১৪ এপ্রিল; বৈশাখ–আশ্বিন ৩১, কার্তিক–চৈত্র ৩০, ফাল্গুন ২৯ (লিপ ইয়ারে ৩০)
  function monthLens(startYear) {
    return [31, 31, 31, 31, 31, 31, 30, 30, 30, 30, isLeap(startYear + 1) ? 30 : 29, 30];
  }

  function gregToBangla(y, m, d) {
    const t = Date.UTC(y, m - 1, d);
    const startY = t >= Date.UTC(y, 3, 14) ? y : y - 1;
    let off = Math.round((t - Date.UTC(startY, 3, 14)) / DAY);
    const lens = monthLens(startY);
    let mi = 0;
    while (off >= lens[mi]) { off -= lens[mi]; mi++; }
    return { year: startY - 593, month: mi, day: off + 1, weekday: new Date(t).getUTCDay() };
  }

  const pad = (n) => String(n).padStart(2, '0');

  function banglaText(date) {
    const b = gregToBangla(date.getFullYear(), date.getMonth() + 1, date.getDate());
    return `${toBnDigits(b.day)} ${BN_MONTHS[b.month]} ${toBnDigits(b.year)}, ${BN_DAYS[b.weekday]}`;
  }

  function englishText(date) {
    return `${EN_DAYS[date.getDay()]}, ${date.getDate()} ${EN_MONTHS[date.getMonth()]} ${date.getFullYear()}`;
  }

  // আরবি (হিজরি) তারিখ: হিসাব ব্রাউজারের Intl থেকে (উম্মুল কুরা পঞ্জিকা), কিন্তু লেখা বাংলা অক্ষরে।
  // আরবি অক্ষর/অঙ্ক এড়াতে দিন-মাস-বছর সংখ্যায় নিয়ে মাসের নাম ও অঙ্ক বাংলায় বসানো হয়।
  // কিছু দেশে ১ দিনের তফাত হতে পারে।
  function arabicText(date) {
    try {
      const parts = new Intl.DateTimeFormat('en-US-u-ca-islamic-umalqura', { day: 'numeric', month: 'numeric', year: 'numeric' }).formatToParts(date);
      const get = (t) => parseInt((parts.find((p) => p.type === t) || {}).value, 10);
      const day = get('day'), month = get('month'), year = get('year');
      if (!day || !month || !year || !HIJRI_MONTHS[month - 1]) return '';
      return `${toBnDigits(day)} ${HIJRI_MONTHS[month - 1]} ${toBnDigits(year)} হিজরি`;
    } catch (e) {
      return '';
    }
  }

  const isoDate = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const clock = (date) => `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;

  // ১২-ঘণ্টার ঘড়ি: "05:43:51 PM" (মধ্যরাত = 12:xx AM, দুপুর = 12:xx PM)
  function clock12(date) {
    const h = date.getHours();
    return `${pad(h % 12 || 12)}:${pad(date.getMinutes())}:${pad(date.getSeconds())} ${h < 12 ? 'AM' : 'PM'}`;
  }

  // "GMT+6" বা "GMT+5:30" — ডিভাইসের টাইমজোন অনুযায়ী
  function gmtOffset(date) {
    const off = -date.getTimezoneOffset();
    if (off === 0) return 'GMT';
    const a = Math.abs(off);
    const h = Math.floor(a / 60), m = a % 60;
    return `GMT${off < 0 ? '-' : '+'}${h}${m ? ':' + pad(m) : ''}`;
  }

  // ------------------------------------------------------------ Node টেস্টের জন্য
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { gregToBangla, banglaText, englishText, arabicText, isoDate, clock, clock12, gmtOffset, toBnDigits };
    return;
  }

  // ------------------------------------------------------------ popup UI
  const el = (id) => document.getElementById(id);
  let lastDay = '';

  function tick() {
    const now = new Date();
    el('dtTime').textContent = clock(now);
    el('dtTime12').textContent = clock12(now);
    const day = isoDate(now);
    if (day !== lastDay) { // তারিখ শুধু দিন বদলালে নতুন করে আঁকা হয়
      lastDay = day;
      el('dtBn').textContent = banglaText(now);
      el('dtEn').textContent = englishText(now);
      el('dtAr').textContent = arabicText(now);
      el('dtMeta').textContent = `${gmtOffset(now)} · ${day}`;
    }
  }
  tick();
  setInterval(tick, 1000);
})();
