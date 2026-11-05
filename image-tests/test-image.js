/* image-lib.js-এর টেস্ট: node image-tests/test-image.js */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const L = require('../image-lib.js');
let fail = 0, total = 0;
const eq = (a, b, msg) => { total++; if (JSON.stringify(a) !== JSON.stringify(b)) { fail++; console.log('✗', msg, 'পেয়েছি', JSON.stringify(a), 'চেয়েছি', JSON.stringify(b)); } };

// ফরম্যাট
eq(L.formatOfMime('image/jpeg'), 'jpg', 'jpeg mime');
eq(L.formatOfFile({ type: '', name: 'A.JPEG' }), 'jpg', 'নাম থেকে jpeg');
eq(L.formatOfFile({ type: '', name: 'x.webp' }), 'webp', 'নাম থেকে webp');
eq(L.formatOfFile({ type: 'image/gif', name: 'x.gif' }), null, 'gif সমর্থিত নয়');
eq(L.formatBytes(0), '0 B', 'বাইট ০');
eq(L.formatBytes(1536), '1.5 KB', 'KB');
eq(L.formatBytes(5 * 1048576), '5.00 MB', 'MB');
eq(L.savedLabel(1000, 580), '−42%', 'কমেছে');
eq(L.savedLabel(1000, 1080), '+8%', 'বেড়েছে');

// মাপ
eq(L.fitSize(4000, 3000, { mode: 'percent', percent: 50 }), { w: 2000, h: 1500 }, 'শতাংশ');
eq(L.fitSize(4000, 3000, { mode: 'percent', percent: 0 }), { error: 'percent' }, 'শূন্য শতাংশ');
eq(L.fitSize(4000, 3000, { mode: 'maxSide', max: 1000 }), { w: 1000, h: 750 }, 'maxSide ছোট');
eq(L.fitSize(800, 600, { mode: 'maxSide', max: 1000 }), { w: 800, h: 600 }, 'maxSide ছোট ছবি বাড়ে না');
eq(L.fitSize(800, 600, { mode: 'maxSide', max: 0 }), { w: 800, h: 600 }, 'maxSide বন্ধ');
eq(L.fitSize(4000, 3000, { mode: 'exact', width: 1000, keepRatio: true }), { w: 1000, h: 750 }, 'শুধু প্রস্থ');
eq(L.fitSize(4000, 3000, { mode: 'exact', height: 600, keepRatio: true }), { w: 800, h: 600 }, 'শুধু উচ্চতা');
eq(L.fitSize(4000, 3000, { mode: 'exact', width: 1000, height: 1000, keepRatio: true }), { w: 1000, h: 750 }, 'বাক্সে ঢোকে');
eq(L.fitSize(4000, 3000, { mode: 'exact', width: 1000, height: 1000, keepRatio: false }), { w: 1000, h: 1000 }, 'অনুপাত ছাড়া');
eq(L.fitSize(4000, 3000, { mode: 'exact', width: 1000, keepRatio: false }), { w: 1000, h: 3000 }, 'অনুপাত ছাড়া, উচ্চতা অপরিবর্তিত');
eq(L.fitSize(400, 300, { mode: 'exact', width: 800, keepRatio: true }), { w: 800, h: 600 }, 'exact বাড়ানো যায়');
eq(L.fitSize(400, 300, { mode: 'fit', width: 800, height: 800 }), { w: 400, h: 300 }, 'fit বাড়ায় না');
eq(L.fitSize(4000, 3000, { mode: 'fit', width: 800, height: 800 }), { w: 800, h: 600 }, 'fit কমায়');
eq(L.fitSize(4000, 3000, { mode: 'exact' }), { error: 'empty' }, 'কিছু দেওয়া হয়নি');
eq(L.fitSize(0, 3000, { mode: 'percent', percent: 50 }), { error: 'size' }, 'ভুল মূল মাপ');
eq(L.fitSize(1000, 10, { mode: 'percent', percent: 1 }).h, 1, 'কখনো ০ হয় না');
eq(L.fitSize(1000, 1000, { mode: 'percent', percent: 5000 }), { w: 16384, h: 16384 }, 'সীমা ১৬৩৮৪');

// নাম
eq(L.outName('C:\\pics\\ছবি 1.PNG', 'jpg', '-small'), 'ছবি 1-small.jpg', 'নাম বদল');
eq(L.outName('a:b?.jpg', 'png'), 'a_b_.png', 'অচল চিহ্ন');
eq(L.outName('', 'png'), 'image.png', 'খালি নাম');
const used = new Set();
eq([L.uniqueName('a.jpg', used), L.uniqueName('A.jpg', used), L.uniqueName('a.jpg', used)], ['a.jpg', 'A (2).jpg', 'a (3).jpg'], 'একই নাম');

// কোয়ালিটি খোঁজা: আকার = 1000 × q ধরে
(async () => {
  let calls = 0;
  let r = await L.searchQuality(async (q) => { calls++; return 1000 * q; }, 500);
  eq(r.ok && r.size <= 500 && r.size > 480, true, 'লক্ষ্যের কাছাকাছি ' + JSON.stringify(r));
  eq(calls <= 10, true, 'কম চেষ্টায়');
  r = await L.searchQuality(async (q) => 1000 * q, 5000);
  eq(r, { quality: 0.95, size: 950, ok: true }, 'সবচেয়ে ভালোটাই লক্ষ্যের ভেতরে');
  r = await L.searchQuality(async (q) => 1000 * q, 10);
  eq(r.ok, false, 'অসম্ভব লক্ষ্য');
  eq(r.quality, 0.05, 'অসম্ভব হলে সবচেয়ে ছোটটা');

  // ZIP ও PDF: পাইথন দিয়ে যাচাই
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'imgtest-'));
  const zip = L.makeZip([
    { name: 'এক.txt', data: Uint8Array.from(Buffer.from('hello')) },
    { name: 'two.bin', data: Uint8Array.from([0, 1, 2, 255, 254]) },
  ], new Date(2026, 9, 19, 12, 0, 0));
  fs.writeFileSync(path.join(tmp, 't.zip'), zip);
  eq(L.crc32(Uint8Array.from(Buffer.from('123456789'))), 0xcbf43926, 'CRC32 জানা মান');
  try {
    const out = execFileSync('python3', ['-I', '-c', 'import zipfile,sys;z=zipfile.ZipFile(sys.argv[1]);print(z.testzip());print("|".join(z.namelist()));print(z.read(z.namelist()[0]).decode())', path.join(tmp, 't.zip')]).toString().split('\n');
    eq(out.slice(0, 3), ['None', 'এক.txt|two.bin', 'hello'], 'ZIP পাইথনে খোলে');
  } catch (e) { fail++; total++; console.log('✗ ZIP যাচাই ব্যর্থ', e.message); }

  // PDF: Pillow দিয়ে আসল JPEG বানিয়ে
  const jpgs = path.join(tmp, 'j');
  fs.mkdirSync(jpgs);
  try {
    execFileSync('python3', ['-I', '-c', `
import sys
from PIL import Image
d=sys.argv[1]
Image.new('RGB',(300,200),(200,40,40)).save(d+'/a.jpg',quality=90)
Image.new('RGB',(120,400),(40,40,200)).save(d+'/b.jpg',quality=90)
Image.new('L',(50,50),128).save(d+'/c.jpg')
`, jpgs]);
    const read = (n) => Uint8Array.from(fs.readFileSync(path.join(jpgs, n)));
    eq(L.jpegInfo(read('a.jpg')), { h: 200, w: 300, comps: 3 }, 'jpegInfo RGB');
    eq(L.jpegInfo(read('c.jpg')).comps, 1, 'jpegInfo ধূসর');
    eq(L.jpegInfo(Uint8Array.from([1, 2, 3, 4, 5])), null, 'jpegInfo ভুল ফাইল');
    const pages = ['a.jpg', 'b.jpg', 'c.jpg'].map((n) => ({ jpeg: read(n) }));
    for (const [name, o, sizes] of [
      ['fit', { size: 'fit' }, [[225, 150], [90, 300], [37.5, 37.5]]],
      ['a4', { size: 'a4', orientation: 'auto', margin: 'small' }, [[841.89, 595.28], [595.28, 841.89], [595.28, 841.89]]],
      ['letter', { size: 'letter', orientation: 'portrait', margin: 'none', title: 'টেস্ট (x)' }, [[612, 792], [612, 792], [612, 792]]],
    ]) {
      const pdf = L.buildPdf(pages, o);
      const f = path.join(tmp, name + '.pdf');
      fs.writeFileSync(f, pdf);
      const py = execFileSync('python3', ['-I', '-c', `
import sys,json
from pypdf import PdfReader
r=PdfReader(sys.argv[1])
print(json.dumps([[round(float(p.mediabox.width),2),round(float(p.mediabox.height),2)] for p in r.pages]))
print(json.dumps([p.images[0].image.size for p in r.pages]))
`, f]).toString().split('\n');
      eq(JSON.parse(py[0]), sizes, name + ' পাতার মাপ');
      eq(JSON.parse(py[1]), [[300, 200], [120, 400], [50, 50]], name + ' ছবির মাপ ঠিক');
      try { execFileSync('qpdf', ['--check', f], { stdio: 'pipe' }); eq(1, 1, name); } catch (e) { fail++; total++; console.log('✗ qpdf', name, String(e.stdout)); }
    }
    // লেআউট
    const lay = L.pageLayout(300, 200, { size: 'a4', orientation: 'auto', margin: 'medium' });
    eq([Math.round(lay.pw), lay.x > 36 - 1e-6 || lay.w <= lay.pw - 72 + 1e-6], [842, true], 'a4 মার্জিনের ভেতরে');
    eq(L.pageLayout(100000, 100, { size: 'fit' }).pw <= 14400, true, 'পাতা ২০০ ইঞ্চির বেশি নয়');
    let threw = false;
    try { L.buildPdf([{ jpeg: Uint8Array.from([1, 2, 3, 4]) }], {}); } catch (_) { threw = true; }
    eq(threw, true, 'JPEG নয় এমন ফাইলে ত্রুটি');
  } catch (e) { fail++; total++; console.log('✗ PDF যাচাই ব্যর্থ', e.message); }

  console.log(fail ? `${fail}/${total} ব্যর্থ` : `সব ${total}টি টেস্ট পাশ`);
  process.exit(fail ? 1 : 0);
})();
