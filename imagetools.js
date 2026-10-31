/* বাংলা ভয়েস টাইপিং — ছবি টুলস পাতা (imagetools.html)
 * ছবি ছোট করা (compress), মাপ বদল, JPG/PNG/WebP কনভার্ট, ছবি থেকে PDF।
 * সবকিছু ব্রাউজারের ভেতরে (canvas) হয়; কোনো ছবি কোথাও যায় না। chrome.* API লাগে না, তাই যেকোনো ব্রাউজারে চলে।
 * হিসাব ও ফাইল বানানো image-lib.js-এ। */
(() => {
  'use strict';
  const L = window.BVTImage;
  const $ = (id) => document.getElementById(id);
  const F = L.FORMATS;
  const PDF_MAX_SIDE = 4200; // PDF-এ খুব বড় ছবি এর বেশি রাখা হয় না (A4-এ ৩০০ ডিপিআই ≈ ৩৫০০)

  const items = [];
  let nextId = 1;
  let tab = 'compress';
  let results = [];
  let busy = false;
  let webpOk = true;

  // ---------------------------------------------------------------- ছোট সাহায্যকারী

  const say = (msg, kind) => { const s = $('status'); s.textContent = msg || ''; s.className = 'status' + (kind ? ' ' + kind : ''); };
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const num = (id) => { const v = parseFloat($(id).value); return Number.isFinite(v) ? v : 0; };

  async function decode(file) {
    if (window.createImageBitmap) {
      try {
        const b = await createImageBitmap(file); // EXIF ঘোরানো ছবি ঠিক দিকে আসে
        return { src: b, w: b.width, h: b.height, close: () => { if (b.close) b.close(); } };
      } catch (_) { /* নিচে Image দিয়ে চেষ্টা */ }
    }
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      await new Promise((ok, no) => { img.onload = ok; img.onerror = () => no(new Error('decode')); img.src = url; });
      return { src: img, w: img.naturalWidth, h: img.naturalHeight, close: () => URL.revokeObjectURL(url) };
    } catch (e) { URL.revokeObjectURL(url); throw e; }
  }

  const mkCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

  // w×h মাপে আঁকে। অনেক ছোট করতে হলে আধা-আধা করে নামে, তাতে ছবি ঝকঝকে থাকে। bg দিলে আগে ওই রঙ ঢালে
  function render(dec, w, h, bg) {
    let cur = dec.src, cw = dec.w, ch = dec.h;
    const temps = [];
    while (cw >= w * 2 && ch >= h * 2) {
      const nw = Math.max(w, Math.floor(cw / 2)), nh = Math.max(h, Math.floor(ch / 2));
      const t = mkCanvas(nw, nh);
      const tc = t.getContext('2d');
      tc.imageSmoothingEnabled = true; tc.imageSmoothingQuality = 'high';
      tc.drawImage(cur, 0, 0, nw, nh);
      temps.push(t);
      cur = t; cw = nw; ch = nh;
    }
    const c = mkCanvas(w, h);
    const ctx = c.getContext('2d');
    if (bg) { ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h); }
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(cur, 0, 0, w, h);
    for (const t of temps) { t.width = 0; t.height = 0; }
    return c;
  }

  function encode(canvas, fmt, q) {
    const mime = F[fmt].mime;
    return new Promise((ok, no) => {
      canvas.toBlob((b) => (b && b.type === mime ? ok(b) : no(new Error('encode-' + fmt))), mime, F[fmt].lossy ? q : undefined);
    });
  }

  async function detectWebp() {
    try {
      const b = await new Promise((ok) => mkCanvas(2, 2).toBlob(ok, 'image/webp', 0.8));
      webpOk = !!b && b.type === 'image/webp';
    } catch (_) { webpOk = false; }
    if (!webpOk) {
      document.querySelectorAll('option[data-needs="webp"]').forEach((o) => { o.disabled = true; });
      $('webpNote').hidden = false;
    }
  }

  // ---------------------------------------------------------------- ছবির তালিকা

  async function addFiles(files) {
    const list = Array.from(files || []);
    if (!list.length) return;
    let bad = 0, added = 0;
    say('Reading pictures…');
    for (let f of list) {
      const fmt = L.formatOfFile(f);
      if (!fmt) { bad++; continue; }
      try {
        const d = await decode(f);
        const item = { id: nextId++, file: f, name: f.name || 'image.' + F[fmt].ext, fmt, w: d.w, h: d.h, url: URL.createObjectURL(f) };
        d.close();
        items.push(item);
        added++;
      } catch (_) { bad++; }
    }
    drawList();
    say(bad ? `${bad} file${bad > 1 ? 's' : ''} skipped: only JPG, PNG and WebP pictures that open normally can be used.` : added ? '' : '', bad ? 'err' : '');
    if (added && !bad) say(`${added} picture${added > 1 ? 's' : ''} added.`, 'ok');
  }

  function drawList() {
    const ul = $('list');
    ul.textContent = '';
    items.forEach((it, i) => {
      const li = el('li');
      const img = el('img'); img.src = it.url; img.alt = ''; img.loading = 'lazy';
      const mid = el('div');
      mid.appendChild(el('div', 'nm', it.name));
      mid.appendChild(el('div', 'meta', `${it.w} × ${it.h} px · ${L.formatBytes(it.file.size)} · ${F[it.fmt].label}`));
      const act = el('div', 'act');
      const mk = (txt, title, fn, dis) => { const b = el('button', 'tb', txt); b.type = 'button'; b.title = title; b.disabled = !!dis; b.addEventListener('click', fn); return b; };
      act.appendChild(mk('↑', 'Move up', () => move(i, -1), i === 0));
      act.appendChild(mk('↓', 'Move down', () => move(i, 1), i === items.length - 1));
      act.appendChild(mk('Remove', 'Remove this picture', () => remove(it.id)));
      li.append(img, mid, act);
      ul.appendChild(li);
    });
    $('count').textContent = String(items.length);
    $('listCard').hidden = !items.length;
    $('tools').hidden = !items.length;
    $('drop').style.padding = items.length ? '16px' : '';
  }

  function move(i, d) {
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    [items[i], items[j]] = [items[j], items[i]];
    drawList();
  }
  function remove(id) {
    const i = items.findIndex((x) => x.id === id);
    if (i < 0) return;
    URL.revokeObjectURL(items[i].url);
    items.splice(i, 1);
    drawList();
  }
  function clearAll() {
    items.forEach((x) => URL.revokeObjectURL(x.url));
    items.length = 0;
    drawList();
    clearResults();
    say('');
  }

  // ---------------------------------------------------------------- ট্যাব ও অপশন

  const RUN_LABEL = { compress: 'Compress', resize: 'Resize', convert: 'Convert', pdf: 'Make PDF' };

  function setTab(t) {
    tab = t;
    document.querySelectorAll('.tabs [role=tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === t)));
    for (const k of Object.keys(RUN_LABEL)) $('p-' + k).hidden = k !== t;
    $('run').textContent = RUN_LABEL[t];
  }

  function syncOptions() {
    $('cQVal').textContent = $('cQ').value;
    $('rQVal').textContent = $('rQ').value;
    $('vQVal').textContent = $('vQ').value;
    $('fQVal').textContent = $('fQ').value;
    const tgt = $('cMode').value === 'target';
    $('cQWrap').hidden = tgt;
    $('cTWrap').hidden = !tgt;
    const rm = $('rMode').value;
    $('rPWrap').hidden = rm !== 'percent';
    $('rWWrap').hidden = $('rHWrap').hidden = rm === 'percent';
    $('rKWrap').hidden = rm !== 'exact';
    $('vQWrap').hidden = $('vFmt').value === 'png';
    $('vBgWrap').hidden = $('vFmt').value !== 'jpg';
    $('fOWrap').hidden = $('fSize').value === 'fit';
  }

  // ---------------------------------------------------------------- কাজ

  // এক ছবির ফল। o: { fmt, w, h, q, bg }
  async function makeOne(it, dec, o) {
    const w = o.w || dec.w, h = o.h || dec.h;
    const bg = o.fmt === 'jpg' ? o.bg || '#ffffff' : null;
    const canvas = render(dec, w, h, bg);
    try {
      let blob, note = '';
      if (o.targetKB && F[o.fmt].lossy) {
        const cache = new Map();
        const r = await L.searchQuality(async (q) => {
          const b = await encode(canvas, o.fmt, q);
          cache.set(q, b);
          return b.size;
        }, o.targetKB * 1024);
        blob = cache.get(r.quality);
        if (!r.ok) note = `Can't reach ${o.targetKB} KB: this is the smallest it gets at this size. Try a smaller "Longest side".`;
      } else {
        blob = await encode(canvas, o.fmt, o.q);
      }
      return { blob, w, h, note };
    } finally {
      canvas.width = 0; canvas.height = 0;
    }
  }

  function planFor() {
    const get = (id) => $(id).value;
    if (tab === 'compress') {
      const targetMode = get('cMode') === 'target';
      if (targetMode && !(num('cT') > 0)) return { error: 'Type a file size in KB.' };
      if (targetMode && get('cFmt') === 'same' && items.some((i) => i.fmt === 'png')) {
        return { error: 'PNG can\'t be squeezed to a file size. Choose JPG or WebP in “Save as”.' };
      }
      return {
        suffix: '-compressed',
        opts: (it, dec) => {
          const fmt = get('cFmt') === 'same' ? it.fmt : get('cFmt');
          const s = L.fitSize(dec.w, dec.h, { mode: 'maxSide', max: +get('cMax') });
          return { fmt, w: s.w, h: s.h, q: num('cQ') / 100, targetKB: targetMode ? num('cT') : 0, keepIfBigger: true };
        },
      };
    }
    if (tab === 'resize') {
      const mode = get('rMode');
      if (mode === 'percent' && !(num('rP') > 0)) return { error: 'Type a percent, for example 50.' };
      if (mode !== 'percent' && !(num('rW') > 0) && !(num('rH') > 0)) return { error: 'Type a width or a height.' };
      return {
        suffix: '-resized',
        opts: (it, dec) => {
          const s = L.fitSize(dec.w, dec.h, { mode, percent: num('rP'), width: num('rW'), height: num('rH'), keepRatio: $('rK').checked });
          return { fmt: get('rFmt') === 'same' ? it.fmt : get('rFmt'), w: s.w, h: s.h, q: num('rQ') / 100 };
        },
      };
    }
    // convert
    return {
      suffix: '',
      opts: (it) => ({ fmt: get('vFmt'), q: num('vQ') / 100, bg: $('vBg').value }),
      convert: true,
    };
  }

  async function runImages() {
    const plan = planFor();
    if (plan.error) { say(plan.error, 'err'); return; }
    const used = new Set();
    const out = [];
    let doneBefore = 0, doneAfter = 0;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      $('prog').value = i / items.length;
      say(`Working… ${i + 1} of ${items.length}`);
      let dec;
      try {
        dec = await decode(it.file);
        const o = plan.opts(it, dec);
        if (o.error) throw new Error(o.error);
        const r = await makeOne(it, dec, o);
        let { blob, note } = r;
        let name = L.outName(it.name, F[o.fmt].ext, plan.suffix || (plan.convert && o.fmt === it.fmt ? '-converted' : ''));
        // ছোট না হলে মূল ফাইলই রাখা (শুধু কমপ্রেস, একই ফরম্যাট, একই মাপ)
        if (o.keepIfBigger && o.fmt === it.fmt && r.w === dec.w && r.h === dec.h && blob.size >= it.file.size) {
          blob = it.file;
          name = it.name;
          note = 'Already as small as it gets: your original is kept. ' + (it.fmt === 'png' ? 'Choose JPG or WebP, or make it smaller, to shrink it.' : 'Lower the quality or the size to shrink it.');
        }
        name = L.uniqueName(name, used);
        out.push({ name, blob, url: URL.createObjectURL(blob), w: r.w, h: r.h, before: it.file.size, after: blob.size, note });
        doneBefore += it.file.size; doneAfter += blob.size;
      } catch (e) {
        out.push({ name: it.name, error: e && /encode-/.test(e.message) ? 'This browser can\'t save that format.' : e && e.message && !/decode/.test(e.message) ? e.message : 'Could not process this picture.' });
      } finally {
        if (dec) dec.close();
      }
    }
    results = out;
    const ok = out.filter((r) => !r.error).length;
    return ok ? `Done · ${ok} picture${ok > 1 ? 's' : ''}, ${L.formatBytes(doneBefore)} → ${L.formatBytes(doneAfter)} (${L.savedLabel(doneBefore, doneAfter)})` : null;
  }

  async function runPdf() {
    const pages = [];
    const q = num('fQ') / 100;
    const errors = [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      $('prog').value = i / items.length;
      say(`Adding picture ${i + 1} of ${items.length}…`);
      let dec;
      try {
        dec = await decode(it.file);
        const s = L.fitSize(dec.w, dec.h, { mode: 'maxSide', max: PDF_MAX_SIDE });
        const canvas = render(dec, s.w, s.h, '#ffffff');
        const blob = await encode(canvas, 'jpg', q);
        canvas.width = 0; canvas.height = 0;
        pages.push({ jpeg: new Uint8Array(await blob.arrayBuffer()) });
      } catch (_) { errors.push(it.name); } finally { if (dec) dec.close(); }
    }
    if (!pages.length) { results = [{ name: 'PDF', error: 'Could not read any picture.' }]; return null; }
    const bytes = L.buildPdf(pages, { size: $('fSize').value, orientation: $('fOri').value, margin: $('fMar').value });
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const name = items.length === 1 ? L.outName(items[0].name, 'pdf') : 'pictures.pdf';
    const total = items.reduce((a, b) => a + b.file.size, 0);
    results = [{ name, blob, url: URL.createObjectURL(blob), pdfPages: pages.length, before: total, after: blob.size, note: errors.length ? `Skipped (could not read): ${errors.join(', ')}` : '' }];
    return `Done · PDF with ${pages.length} page${pages.length > 1 ? 's' : ''}, ${L.formatBytes(blob.size)}`;
  }

  async function run() {
    if (busy || !items.length) return;
    busy = true;
    clearResults();
    $('run').disabled = true;
    $('prog').hidden = false; $('prog').value = 0;
    let msg = null;
    try {
      msg = tab === 'pdf' ? await runPdf() : await runImages();
    } catch (e) {
      say('Something went wrong: ' + (e && e.message ? e.message : e), 'err');
      results = [];
    }
    $('prog').hidden = true;
    $('run').disabled = false;
    busy = false;
    drawResults();
    if (msg) say(msg, 'ok');
    else if (results.length) say('Nothing could be made. See the messages below.', 'err');
  }

  // ---------------------------------------------------------------- ফল

  function clearResults() {
    results.forEach((r) => { if (r.url) URL.revokeObjectURL(r.url); });
    results = [];
    $('outCard').hidden = true;
    $('out').textContent = '';
  }

  function drawResults() {
    const ul = $('out');
    ul.textContent = '';
    for (const r of results) {
      const li = el('li');
      if (r.error) {
        li.appendChild(el('div'));
        const mid = el('div');
        mid.appendChild(el('div', 'nm', r.name));
        mid.appendChild(el('div', 'meta bad', r.error));
        li.appendChild(mid);
        ul.appendChild(li);
        continue;
      }
      if (r.pdfPages) {
        const ic = el('div', 'nm', 'PDF'); ic.style.cssText = 'width:56px;height:56px;border-radius:9px;background:var(--ic);color:var(--ac);display:grid;place-items:center;font-weight:800';
        li.appendChild(ic);
      } else {
        const img = el('img'); img.src = r.url; img.alt = '';
        li.appendChild(img);
      }
      const mid = el('div');
      mid.appendChild(el('div', 'nm', r.name));
      const meta = el('div', 'meta');
      const dim = r.pdfPages ? `${r.pdfPages} page${r.pdfPages > 1 ? 's' : ''}` : `${r.w} × ${r.h} px`;
      meta.append(dim + ' · ' + L.formatBytes(r.before) + ' → ');
      meta.appendChild(el('b', null, L.formatBytes(r.after)));
      if (!r.pdfPages) meta.append(' ');
      if (!r.pdfPages) meta.appendChild(el('span', r.after < r.before ? 'good' : '', '(' + L.savedLabel(r.before, r.after) + ')'));
      mid.appendChild(meta);
      if (r.note) mid.appendChild(el('div', 'meta', r.note));
      const act = el('div', 'act');
      const a = el('a', 'tb', 'Download');
      a.href = r.url; a.download = r.name;
      act.appendChild(a);
      li.append(mid, act);
      ul.appendChild(li);
    }
    const good = results.filter((r) => !r.error);
    $('sum').textContent = String(good.length);
    $('zip').hidden = good.length < 2 || !!good[0].pdfPages;
    $('outCard').hidden = !results.length;
    if (results.length) $('outCard').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  async function downloadZip() {
    const good = results.filter((r) => !r.error);
    if (!good.length) return;
    $('zip').disabled = true;
    try {
      const files = [];
      for (const r of good) files.push({ name: r.name, data: new Uint8Array(await r.blob.arrayBuffer()) });
      const blob = new Blob([L.makeZip(files)], { type: 'application/zip' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'pictures.zip';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    } finally { $('zip').disabled = false; }
  }

  // ---------------------------------------------------------------- ইভেন্ট

  const pick = () => $('file').click();
  $('drop').addEventListener('click', pick);
  $('drop').addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
  $('addMore').addEventListener('click', pick);
  $('clearAll').addEventListener('click', clearAll);
  $('file').addEventListener('change', async (e) => { await addFiles(e.target.files); e.target.value = ''; });

  let dragDepth = 0;
  window.addEventListener('dragenter', (e) => { e.preventDefault(); dragDepth++; $('drop').classList.add('over'); });
  window.addEventListener('dragleave', () => { if (--dragDepth <= 0) { dragDepth = 0; $('drop').classList.remove('over'); } });
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', (e) => {
    e.preventDefault();
    dragDepth = 0; $('drop').classList.remove('over');
    if (e.dataTransfer && e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  });
  window.addEventListener('paste', (e) => {
    const fs = [];
    for (const it of (e.clipboardData && e.clipboardData.items) || []) {
      const f = it.kind === 'file' ? it.getAsFile() : null;
      if (f && /^image\//.test(f.type)) fs.push(f);
    }
    if (!fs.length) return;
    e.preventDefault();
    addFiles(fs.map((f, i) => new File([f], `pasted-${Date.now() % 100000}-${i + 1}.${(L.formatOfMime(f.type) && F[L.formatOfMime(f.type)].ext) || 'png'}`, { type: f.type })));
  });

  document.querySelectorAll('.tabs [role=tab]').forEach((b) => b.addEventListener('click', () => setTab(b.dataset.tab)));
  document.querySelectorAll('#tools select, #tools input').forEach((x) => x.addEventListener('input', syncOptions));
  $('run').addEventListener('click', run);
  $('zip').addEventListener('click', downloadZip);

  setTab('compress');
  syncOptions();
  detectWebp();
})();
