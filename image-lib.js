/* বাংলা ভয়েস টাইপিং — ছবি টুলসের মূল কাজ (মাপ হিসাব, ফরম্যাট, ফাইলের নাম, ZIP, PDF)।
 * imagetools.html এটা ব্যবহার করে। এখানে DOM বা canvas-এর কোনো কাজ নেই, তাই Node দিয়ে আলাদাভাবে
 * টেস্ট করা যায় (image-tests/test-image.js)। ছবি পড়া ও আঁকার কাজ imagetools.js-এ, ব্রাউজারের ভেতরেই —
 * কোনো ছবি কোথাও আপলোড হয় না। কোনো বাইরের লাইব্রেরি লাগে না। */
(function (root) {
  'use strict';

  const MAX_SIDE = 16384; // ব্রাউজারের canvas-এর সাধারণ সীমা

  const FORMATS = {
    jpg: { mime: 'image/jpeg', ext: 'jpg', label: 'JPG', lossy: true },
    png: { mime: 'image/png', ext: 'png', label: 'PNG', lossy: false },
    webp: { mime: 'image/webp', ext: 'webp', label: 'WebP', lossy: true },
  };

  function formatOfMime(m) {
    m = String(m || '').toLowerCase();
    if (m === 'image/jpeg' || m === 'image/jpg' || m === 'image/pjpeg') return 'jpg';
    if (m === 'image/png') return 'png';
    if (m === 'image/webp') return 'webp';
    return null;
  }

  // MIME না থাকলে ফাইলের নামের শেষ অংশ দেখে
  function formatOfFile(f) {
    const byMime = formatOfMime(f && f.type);
    if (byMime) return byMime;
    const m = /\.([a-z0-9]+)$/i.exec((f && f.name) || '');
    const e = m ? m[1].toLowerCase() : '';
    if (e === 'jpg' || e === 'jpeg' || e === 'jfif') return 'jpg';
    if (e === 'png') return 'png';
    if (e === 'webp') return 'webp';
    return null;
  }

  function formatBytes(n) {
    n = Math.max(0, +n || 0);
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(n < 10240 ? 1 : 0) + ' KB';
    return (n / 1048576).toFixed(n < 10485760 ? 2 : 1) + ' MB';
  }

  // কত শতাংশ ছোট হলো ("−42%"); বড় হলে "+8%"
  function savedLabel(before, after) {
    if (!before) return '';
    const p = Math.round(((after - before) / before) * 100);
    if (p === 0) return '0%';
    return (p < 0 ? '−' : '+') + Math.abs(p) + '%';
  }

  // ---------------------------------------------------------------- মাপ

  const clampSide = (n) => Math.max(1, Math.min(MAX_SIDE, Math.round(n)));
  const pos = (n) => (Number.isFinite(+n) && +n > 0 ? +n : 0);

  /* w, h = মূল মাপ। opt.mode:
   *  'percent' {percent}                     — শতাংশে (যেমন 50)
   *  'exact'   {width, height, keepRatio}    — ঠিক এই মাপ; keepRatio হলে একটা দিলেই চলে, দুটো দিলে বাক্সের ভেতরে ঢোকে
   *  'fit'     {width, height}               — এই বাক্সের ভেতরে (বড় হলে ছোট, ছোট হলে ছোটই থাকে)
   *  'maxSide' {max}                         — লম্বা দিক সর্বোচ্চ এত; ছোট ছবি বাড়ানো হয় না (0 = কিছু না)
   * ফেরত: { w, h } অথবা { error } */
  function fitSize(w, h, opt) {
    w = pos(w); h = pos(h);
    if (!w || !h) return { error: 'size' };
    opt = opt || {};
    if (opt.mode === 'percent') {
      const p = pos(opt.percent);
      if (!p) return { error: 'percent' };
      return { w: clampSide(w * p / 100), h: clampSide(h * p / 100) };
    }
    if (opt.mode === 'maxSide') {
      const m = pos(opt.max);
      if (!m || Math.max(w, h) <= m) return { w: clampSide(w), h: clampSide(h) };
      const k = m / Math.max(w, h);
      return { w: clampSide(w * k), h: clampSide(h * k) };
    }
    const bw = pos(opt.width), bh = pos(opt.height);
    if (!bw && !bh) return { error: 'empty' };
    if (opt.mode === 'fit' || (opt.mode === 'exact' && opt.keepRatio !== false)) {
      let k;
      if (bw && bh) k = Math.min(bw / w, bh / h);
      else k = bw ? bw / w : bh / h;
      if (opt.mode === 'fit' && k > 1) k = 1;
      return { w: clampSide(w * k), h: clampSide(h * k) };
    }
    // exact, অনুপাত ছাড়া: যে দিক খালি, মূল মাপ
    return { w: clampSide(bw || w), h: clampSide(bh || h) };
  }

  // ---------------------------------------------------------------- ফাইলের নাম

  function baseName(name) {
    return String(name || 'image').replace(/^.*[\\/]/, '').replace(/\.[^.]*$/, '').replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').trim() || 'image';
  }

  function outName(name, ext, suffix) {
    return baseName(name) + (suffix || '') + '.' + ext;
  }

  // একই নাম দুবার এলে (2), (3)… যোগ করে। used = Set
  function uniqueName(name, used) {
    if (!used.has(name.toLowerCase())) { used.add(name.toLowerCase()); return name; }
    const m = /^(.*?)(\.[^.]*)?$/.exec(name);
    for (let i = 2; ; i++) {
      const n = m[1] + ' (' + i + ')' + (m[2] || '');
      if (!used.has(n.toLowerCase())) { used.add(n.toLowerCase()); return n; }
    }
  }

  // ---------------------------------------------------------------- লক্ষ্য সাইজে কোয়ালিটি খোঁজা

  /* encode(q) → Promise<সংখ্যা: ওই কোয়ালিটিতে ফাইলের বাইট>। লক্ষ্যের ভেতরে সবচেয়ে ভালো কোয়ালিটি খোঁজে।
   * ফেরত: { quality, size, ok } — সবচেয়ে কম কোয়ালিটিতেও লক্ষ্যের বেশি হলে ok:false (তখনো সবচেয়ে ছোটটা দেওয়া হয়) */
  async function searchQuality(encode, target, o) {
    o = o || {};
    let lo = o.min != null ? o.min : 0.05;
    let hi = o.max != null ? o.max : 0.95;
    const steps = o.steps || 7;
    const top = await encode(hi);
    if (top <= target) return { quality: hi, size: top, ok: true };
    const bottom = await encode(lo);
    if (bottom > target) return { quality: lo, size: bottom, ok: false };
    let best = { quality: lo, size: bottom, ok: true };
    for (let i = 0; i < steps; i++) {
      const mid = (lo + hi) / 2;
      const s = await encode(mid);
      if (s <= target) { best = { quality: mid, size: s, ok: true }; lo = mid; } else hi = mid;
    }
    return best;
  }

  // ---------------------------------------------------------------- ZIP (সংকোচন ছাড়া, "store")

  const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();

  function crc32(bytes) {
    let c = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }

  function utf8(s) {
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(s);
    return Uint8Array.from(Buffer.from(s, 'utf8'));
  }

  function concat(parts) {
    let n = 0;
    for (const p of parts) n += p.length;
    const out = new Uint8Array(n);
    let o = 0;
    for (const p of parts) { out.set(p, o); o += p.length; }
    return out;
  }

  // files: [{ name, data: Uint8Array }] → Uint8Array (.zip)
  function makeZip(files, when) {
    const d = when instanceof Date ? when : new Date();
    const dosTime = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
    const dosDate = (Math.max(0, d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    const local = [];
    const central = [];
    let offset = 0;
    for (const f of files) {
      const name = utf8(f.name);
      const data = f.data;
      const crc = crc32(data);
      const lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true);
      lh.setUint16(4, 20, true);
      lh.setUint16(6, 0x0800, true); // UTF-8 নাম
      lh.setUint16(8, 0, true);
      lh.setUint16(10, dosTime, true);
      lh.setUint16(12, dosDate, true);
      lh.setUint32(14, crc, true);
      lh.setUint32(18, data.length, true);
      lh.setUint32(22, data.length, true);
      lh.setUint16(26, name.length, true);
      lh.setUint16(28, 0, true);
      const lhb = new Uint8Array(lh.buffer);
      local.push(lhb, name, data);
      const ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true);
      ch.setUint16(4, 20, true);
      ch.setUint16(6, 20, true);
      ch.setUint16(8, 0x0800, true);
      ch.setUint16(10, 0, true);
      ch.setUint16(12, dosTime, true);
      ch.setUint16(14, dosDate, true);
      ch.setUint32(16, crc, true);
      ch.setUint32(20, data.length, true);
      ch.setUint32(24, data.length, true);
      ch.setUint16(28, name.length, true);
      ch.setUint32(42, offset, true);
      central.push(new Uint8Array(ch.buffer), name);
      offset += 30 + name.length + data.length;
    }
    const cd = concat(central);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true);
    end.setUint16(8, files.length, true);
    end.setUint16(10, files.length, true);
    end.setUint32(12, cd.length, true);
    end.setUint32(16, offset, true);
    return concat([...local, cd, new Uint8Array(end.buffer)]);
  }

  // ---------------------------------------------------------------- PDF

  // JPEG-এর SOF অংশ থেকে মাপ ও রঙের চ্যানেল সংখ্যা। ভুল ফাইল হলে null
  function jpegInfo(b) {
    if (!b || b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null;
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) { i++; continue; }
      const m = b[i + 1];
      if (m === 0xff) { i++; continue; }
      if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) { i += 2; continue; }
      const len = (b[i + 2] << 8) | b[i + 3];
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
        return { h: (b[i + 5] << 8) | b[i + 6], w: (b[i + 7] << 8) | b[i + 8], comps: b[i + 9] };
      }
      i += 2 + len;
    }
    return null;
  }

  const PAGE_SIZES = { a4: [595.28, 841.89], letter: [612, 792] };
  const MARGINS = { none: 0, small: 18, medium: 36 }; // pt
  const MAX_PAGE = 14400; // PDF-এর সীমা (200 ইঞ্চি)

  const num = (n) => String(Math.round(n * 100) / 100);

  /* এক পাতার সাজ। size: 'fit' (ছবির মাপেই পাতা) | 'a4' | 'letter'; orientation: 'auto' | 'portrait' | 'landscape'
   * ফেরত: পাতার মাপ pw, ph এবং ছবির বসার জায়গা x, y, w, h (PDF-এর নিচে-বাঁ কোণ থেকে, pt) */
  function pageLayout(iw, ih, o) {
    o = o || {};
    const m = MARGINS[o.margin] != null ? MARGINS[o.margin] : 0;
    let pw, ph;
    if (o.size === 'a4' || o.size === 'letter') {
      [pw, ph] = PAGE_SIZES[o.size];
      const land = o.orientation === 'landscape' || (o.orientation !== 'portrait' && iw > ih);
      if (land) [pw, ph] = [ph, pw];
    } else {
      // ছবির মাপেই পাতা (৯৬ ডিপিআই ধরে), মার্জিনসহ
      let w = iw * 0.75, h = ih * 0.75;
      const k = Math.min(1, (MAX_PAGE - 2 * m) / Math.max(w, h));
      w *= k; h *= k;
      return { pw: w + 2 * m, ph: h + 2 * m, x: m, y: m, w, h };
    }
    const bw = Math.max(1, pw - 2 * m), bh = Math.max(1, ph - 2 * m);
    const k = Math.min(bw / iw, bh / ih);
    const w = iw * k, h = ih * k;
    return { pw, ph, x: (pw - w) / 2, y: (ph - h) / 2, w, h };
  }

  /* pages: [{ jpeg: Uint8Array }] (JPEG ছাড়া অন্য কিছু নয়) , opts: { size, orientation, margin, title }
   * ফেরত: Uint8Array (.pdf) — ছবি JPEG হিসেবেই বসে, তাই কোয়ালিটি নষ্ট হয় না */
  function buildPdf(pages, opts) {
    if (!pages || !pages.length) throw new Error('no pages');
    const parts = [];
    const offsets = [];
    let size = 0;
    const push = (x) => {
      const u = typeof x === 'string' ? Uint8Array.from(x, (c) => c.charCodeAt(0) & 0xff) : x;
      parts.push(u);
      size += u.length;
    };
    const obj = (n, body) => { offsets[n] = size; push(n + ' 0 obj\n' + body + '\nendobj\n'); };
    const nObj = 2 + pages.length * 3;

    push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
    obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
    const kids = pages.map((_, i) => (3 + i * 3) + ' 0 R').join(' ');
    obj(2, '<< /Type /Pages /Kids [' + kids + '] /Count ' + pages.length + ' >>');

    pages.forEach((p, i) => {
      const info = jpegInfo(p.jpeg);
      if (!info) throw new Error('page ' + (i + 1) + ' is not a JPEG');
      const L = pageLayout(info.w, info.h, opts);
      const base = 3 + i * 3;
      const cs = info.comps === 1 ? '/DeviceGray' : info.comps === 4 ? '/DeviceCMYK' : '/DeviceRGB';
      const decode = info.comps === 4 ? ' /Decode [1 0 1 0 1 0 1 0]' : ''; // Adobe CMYK JPEG উল্টো থাকে
      obj(base, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + num(L.pw) + ' ' + num(L.ph) + '] /Resources << /XObject << /Im0 ' + (base + 2) + ' 0 R >> >> /Contents ' + (base + 1) + ' 0 R >>');
      const content = 'q ' + num(L.w) + ' 0 0 ' + num(L.h) + ' ' + num(L.x) + ' ' + num(L.y) + ' cm /Im0 Do Q';
      obj(base + 1, '<< /Length ' + content.length + ' >>\nstream\n' + content + '\nendstream');
      offsets[base + 2] = size;
      push((base + 2) + ' 0 obj\n<< /Type /XObject /Subtype /Image /Width ' + info.w + ' /Height ' + info.h + ' /ColorSpace ' + cs + decode + ' /BitsPerComponent 8 /Filter /DCTDecode /Length ' + p.jpeg.length + ' >>\nstream\n');
      push(p.jpeg);
      push('\nendstream\nendobj\n');
    });

    const title = opts && opts.title ? String(opts.title).replace(/[^\x20-\x7e]/g, '').replace(/[()\\]/g, '') : '';
    obj(nObj + 1, '<< /Producer (Bangla Voice Typing)' + (title ? ' /Title (' + title + ')' : '') + ' >>');

    const xref = size;
    let x = 'xref\n0 ' + (nObj + 2) + '\n0000000000 65535 f \n';
    for (let n = 1; n <= nObj + 1; n++) x += String(offsets[n]).padStart(10, '0') + ' 00000 n \n';
    push(x + 'trailer\n<< /Size ' + (nObj + 2) + ' /Root 1 0 R /Info ' + (nObj + 1) + ' 0 R >>\nstartxref\n' + xref + '\n%%EOF\n');
    return concat(parts);
  }

  const api = {
    MAX_SIDE, FORMATS, formatOfMime, formatOfFile, formatBytes, savedLabel,
    fitSize, baseName, outName, uniqueName, searchQuality,
    crc32, makeZip, jpegInfo, pageLayout, buildPdf,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BVTImage = api;
})(typeof self !== 'undefined' ? self : globalThis);
