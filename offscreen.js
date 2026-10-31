/* বাংলা ভয়েস টাইপিং — ছবির লেখা পড়া (OCR)
 * ব্যাকগ্রাউন্ড থেকে স্ক্রিনশট আসে → বাছা অংশ কেটে → Tesseract.js দিয়ে বাংলা + English লেখা পড়ে।
 * সব কাজ কম্পিউটারেই হয়, ছবি কোথাও পাঠানো হয় না। */
(() => {
  'use strict';

  const TARGET = 'bvt-offscreen';
  const LANGS = 'ben+eng';
  const INIT_TIMEOUT = 60000;

  let workerP = null;
  let lastPsm = '6'; // বর্তমান পেজ-সেগমেন্টেশন মোড (শুরুতে SINGLE_BLOCK)

  function getWorker() {
    if (!workerP) {
      workerP = (async () => {
        if (typeof Tesseract === 'undefined') throw new Error('ocr/tesseract.min.js did not load');
        let onWorkerError;
        const failed = new Promise((_, rej) => { onWorkerError = rej; });
        failed.catch(() => {});
        const create = Tesseract.createWorker(LANGS, 1, {
          workerPath: chrome.runtime.getURL('ocr/worker.min.js'),
          corePath: chrome.runtime.getURL('ocr'),
          langPath: chrome.runtime.getURL('ocr/lang'),
          gzip: false, // ben.traineddata / eng.traineddata সাধারণ (আনজিপ করা) ফাইল
          workerBlobURL: false, // এক্সটেনশনের নিজের ফাইল থেকেই ওয়ার্কার চলবে
          cacheMethod: 'none',
          logger: (m) => console.log('[OCR]', m.status, m.progress),
          errorHandler: (e) => {
            console.error('[OCR error]', e);
            onWorkerError(new Error(String((e && e.message) || e)));
          },
        });
        create.catch(() => {});
        const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('The engine took longer than ' + INIT_TIMEOUT / 1000 + ' seconds to start')), INIT_TIMEOUT));
        const w = await Promise.race([create, failed, timeout]);
        await w.setParameters({
          tessedit_pageseg_mode: (Tesseract.PSM && Tesseract.PSM.SINGLE_BLOCK) || '6',
          preserve_interword_spaces: '1',
        });
        lastPsm = '6';
        return w;
      })();
      workerP.catch((e) => { console.error('[OCR init]', e); workerP = null; });
    }
    return workerP;
  }

  // বাছা অংশ কেটে, ছোট হলে বড় করে, গাঢ় ব্যাকগ্রাউন্ড হলে উল্টে, চারপাশে সাদা ফাঁক দিয়ে OCR-এর উপযোগী করা
  async function prepare(dataUrl, rect, vw) {
    const bin = atob(dataUrl.slice(dataUrl.indexOf(',') + 1));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const img = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
    img.naturalWidth = img.width;
    img.naturalHeight = img.height;
    const k = img.naturalWidth / Math.max(1, vw);
    const sx = Math.max(0, Math.round(rect.x * k));
    const sy = Math.max(0, Math.round(rect.y * k));
    const sw = Math.max(1, Math.min(img.naturalWidth - sx, Math.round(rect.w * k)));
    const sh = Math.max(1, Math.min(img.naturalHeight - sy, Math.round(rect.h * k)));

    const scale = Math.min(3, Math.max(1, 1400 / Math.max(sw, sh)));
    const w = Math.round(sw * scale);
    const h = Math.round(sh * scale);
    const pad = 24;

    const canvas = document.createElement('canvas');
    canvas.width = w + pad * 2;
    canvas.height = h + pad * 2;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, sx, sy, sw, sh, pad, pad, w, h);

    const data = ctx.getImageData(pad, pad, w, h);
    const px = data.data;
    let sum = 0;
    for (let i = 0; i < px.length; i += 4) sum += 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
    const mean = sum / (px.length / 4);
    if (mean < 110) {
      for (let i = 0; i < px.length; i += 4) {
        px[i] = 255 - px[i];
        px[i + 1] = 255 - px[i + 1];
        px[i + 2] = 255 - px[i + 2];
      }
      ctx.putImageData(data, pad, pad);
    }
    return canvas.toDataURL('image/png');
  }

  async function run(msg) {
    console.log('[OCR] request received');
    let image;
    try {
      image = await prepare(msg.dataUrl, msg.rect, msg.vw);
    } catch (e) {
      console.error('[OCR prepare]', e);
      return { error: 'fail', detail: String((e && e.message) || e) };
    }
    console.log('[OCR] image ready, starting engine');
    let worker;
    try {
      worker = await getWorker();
    } catch (e) {
      return { error: 'setup', detail: String((e && e.message) || e) };
    }
    // স্ক্রিনশটের বড় ছবিতে অটো লেআউট (৩), ছোট বাছা অংশে ব্লক (৬)
    const want = String(msg.psm || '6');
    if (want !== lastPsm) {
      try {
        await worker.setParameters({ tessedit_pageseg_mode: want });
        lastPsm = want;
      } catch (_) {}
    }
    console.log('[OCR] engine ready, reading text');
    try {
      const { data } = await worker.recognize(image);
      const text = (data && data.text ? data.text : '').trim();
      return text ? { text } : { error: 'empty' };
    } catch (e) {
      console.error('[OCR recognize]', e);
      return { error: 'fail', detail: String((e && e.message) || e) };
    }
  }

  console.log('[OCR] offscreen v2 ready');

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg || msg.target !== TARGET || msg.type !== 'ocr') return false;
    run(msg).then(sendResponse);
    return true;
  });
})();
