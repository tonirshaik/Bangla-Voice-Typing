// বাংলা ভয়েস টাইপিং — ব্যাকগ্রাউন্ড (শর্টকাট ধরা + ছবির লেখা পড়ার কাজে স্ক্রিনশট নেওয়া)

// --- স্ক্রিনশট হিস্ট্রির ডাটাবেস (এখানে ভেতরে বসানো, তাই আলাদা ফাইল নেই) ---
/* বাংলা ভয়েস টাইপিং — স্ক্রিনশট হিস্ট্রির ডাটাবেস (IndexedDB)
 * এক্সটেনশনের নিজের ডাটাবেসে জমা হয়, তাই যেকোনো সাইট থেকে একই হিস্ট্রি দেখা যায়।
 * ব্যাকগ্রাউন্ড সার্ভিস ওয়ার্কার importScripts দিয়ে এটা লোড করে। কিছুই কোথাও পাঠানো হয় না। */
const ShotDB = (() => {
  'use strict';

  const NAME = 'bvt-shots';
  const STORE = 'shots';
  let dbp = null;

  function open() {
    if (!dbp) {
      dbp = new Promise((res, rej) => {
        const r = indexedDB.open(NAME, 1);
        r.onupgradeneeded = () => {
          const s = r.result.createObjectStore(STORE, { keyPath: 'id' });
          s.createIndex('ts', 'ts');
        };
        r.onsuccess = () => res(r.result);
        r.onerror = () => { dbp = null; rej(r.error); };
      });
    }
    return dbp;
  }

  const reqP = (r) => new Promise((res, rej) => {
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });

  async function store(mode) {
    const db = await open();
    return db.transaction(STORE, mode).objectStore(STORE);
  }

  // data: URL ↔ Blob
  async function dataUrlToBlob(dataUrl) {
    const r = await fetch(dataUrl);
    return r.blob();
  }
  async function blobToDataUrl(blob) {
    const buf = new Uint8Array(await blob.arrayBuffer());
    let s = '';
    for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
    return 'data:' + (blob.type || 'image/png') + ';base64,' + btoa(s);
  }

  // নতুন স্ক্রিনশট জমানো। rec = { id, ts, w, h, kind, host, title, png (dataURL), thumb (dataURL) }
  async function add(rec) {
    const png = await dataUrlToBlob(rec.png);
    const s = await store('readwrite');
    await reqP(s.put({
      id: rec.id,
      ts: rec.ts,
      w: rec.w,
      h: rec.h,
      kind: rec.kind || 'area',
      host: rec.host || '',
      title: rec.title || '',
      png, // মার্ক ছাড়া মূল ছবি, যাতে পরে আবার মার্ক বদলানো যায়
      thumb: rec.thumb || '',
      shapes: [],
      numCount: 1,
    }));
  }

  // মার্ক (shapes) আর থাম্বনেইল হালনাগাদ
  async function update(id, patch) {
    const db = await open();
    return new Promise((res, rej) => {
      const t = db.transaction(STORE, 'readwrite');
      const s = t.objectStore(STORE);
      const g = s.get(id);
      let found = false;
      g.onsuccess = () => {
        if (!g.result) return;
        found = true;
        const next = { ...g.result };
        if (Array.isArray(patch.shapes)) next.shapes = patch.shapes;
        if (patch.numCount) next.numCount = patch.numCount;
        if (patch.thumb) next.thumb = patch.thumb;
        s.put(next);
      };
      t.oncomplete = () => res(found);
      t.onerror = () => rej(t.error);
      t.onabort = () => rej(t.error);
    });
  }

  // তালিকা (নতুন আগে), ভারী ছবি ছাড়া
  async function list() {
    const s = await store('readonly');
    const all = await reqP(s.getAll());
    all.sort((a, b) => b.ts - a.ts);
    return all.map((r) => ({
      id: r.id,
      ts: r.ts,
      w: r.w,
      h: r.h,
      kind: r.kind,
      host: r.host,
      title: r.title,
      thumb: r.thumb,
      marks: (r.shapes || []).length,
      size: r.png ? r.png.size : 0,
    }));
  }

  // একটি স্ক্রিনশট পুরো ছবিসহ
  async function get(id) {
    const s = await store('readonly');
    const r = await reqP(s.get(id));
    if (!r) return null;
    return {
      id: r.id,
      w: r.w,
      h: r.h,
      kind: r.kind,
      png: await blobToDataUrl(r.png),
      shapes: r.shapes || [],
      numCount: r.numCount || 1,
    };
  }

  async function remove(id) {
    const s = await store('readwrite');
    await reqP(s.delete(id));
  }

  async function clear() {
    const s = await store('readwrite');
    await reqP(s.clear());
  }

  // সবচেয়ে পুরোনোগুলো মুছে সর্বোচ্চ max-টা রাখা
  async function prune(max) {
    if (!max || max < 1) return 0;
    const items = await list(); // নতুন আগে
    const extra = items.slice(max);
    for (const it of extra) await remove(it.id);
    return extra.length;
  }

  return { add, update, list, get, remove, clear, prune };
})();

// --- background ---

const DEFAULTS = { lang: 'bn-BD', showButton: true, commands: true, dictionary: '', phonetic: false };

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  if (reason !== 'install') return;
  const current = await chrome.storage.sync.get(null);
  await chrome.storage.sync.set({ ...DEFAULTS, ...current });
});

// শর্টকাট → ভাষা
const COMMAND_LANG = { 'voice-bangla': 'bn-BD', 'voice-english': 'en-US' };

chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'screen-record') { startRegionRecord(); return; }
  const isVoice = command in COMMAND_LANG;
  if (!isVoice && command !== 'translate-selection' && command !== 'translate-image' && command !== 'screenshot') return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || tab.id == null) return;
  let message;
  if (command === 'translate-selection') message = { type: 'translate' };
  else if (command === 'translate-image') message = { type: 'image-translate' };
  else if (command === 'screenshot') message = { type: 'screenshot' };
  else message = { type: 'start', lang: COMMAND_LANG[command] };
  try {
    await chrome.tabs.sendMessage(tab.id, message);
  } catch (_) {
    // chrome:// পাতা বা এক্সটেনশন বসানোর আগে খোলা পাতা — রিলোড দিলে কাজ করবে
  }
});

// ------------------------------------------------------ ছবির লেখা পড়া (OCR)
// স্ক্রিনশট এখানে তোলা হয়; লেখা পড়ার ভারী কাজ offscreen.html-এ (Tesseract.js) চলে।

const OFFSCREEN_URL = 'offscreen.html';
let creating = null;

async function ensureOffscreen() {
  const url = chrome.runtime.getURL(OFFSCREEN_URL);
  const all = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] });
  if (all.some((c) => c.documentUrl === url)) return;
  if (all.length) await chrome.offscreen.closeDocument(); // offscreen পেজ একসাথে একটাই
  if (!creating) {
    creating = chrome.offscreen
      .createDocument({
        url: OFFSCREEN_URL,
        reasons: ['WORKERS'],
        justification: 'Run a web worker to read text from images (OCR)',
      })
      .finally(() => { creating = null; });
  }
  await creating;
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || msg.type !== 'bvt-ocr' || !sender.tab) return false;
  // লেখা পড়তে কিছু সময় লাগতে পারে; এর মধ্যে যাতে সার্ভিস ওয়ার্কার ঘুমিয়ে না পড়ে
  const keep = setInterval(() => chrome.runtime.getPlatformInfo(), 20000);
  (async () => {
    let dataUrl;
    try {
      dataUrl = await chrome.tabs.captureVisibleTab(sender.tab.windowId, { format: 'png' });
    } catch (_) {
      return { error: 'capture' };
    }
    // স্ক্রিনশট হয়ে গেছে, পাতা আবার নিজের UI দেখাতে পারবে
    chrome.tabs.sendMessage(sender.tab.id, { type: 'image-captured' }, { frameId: 0 }).catch(() => {});
    try {
      await ensureOffscreen();
      const res = await chrome.runtime.sendMessage({
        target: 'bvt-offscreen',
        type: 'ocr',
        dataUrl,
        rect: msg.rect,
        vw: msg.vw,
      });
      return res || { error: 'fail' };
    } catch (_) {
      return { error: 'fail' };
    }
  })()
    .then(sendResponse)
    .finally(() => clearInterval(keep));
  return true;
});

// ------------------------------------------------------ স্ক্রিনশট (Alt + S)
// পাতা নিজের UI লুকিয়ে বার্তা পাঠায়; এখানে শুধু PNG (লসলেস, ডিভাইসের আসল পিক্সেল) তোলা হয়।
// কাটা, মার্কিং আর সেভ হয় পাতার ভেতরের এডিটর কার্ডে (screenshot.js)।

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || msg.type !== 'bvt-shot-capture' || !sender.tab) return false;
  chrome.tabs
    .captureVisibleTab(sender.tab.windowId, { format: 'png' })
    .then((dataUrl) => sendResponse({ dataUrl }))
    .catch((e) => sendResponse({ error: 'capture', detail: String((e && e.message) || e) }));
  return true;
});

// ------------------------------------------------ স্ক্রিনশট থেকে লেখা কপি
// স্ক্রিনশট কার্ডের "Text" বাটন: কাটা ছবিটাই সরাসরি OCR-এ যায় (আলাদা স্ক্রিনশট লাগে না)।

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || msg.type !== 'bvt-shot-ocr' || !sender.tab || !msg.dataUrl) return false;
  const keep = setInterval(() => chrome.runtime.getPlatformInfo(), 20000);
  (async () => {
    try {
      await ensureOffscreen();
      const w = Math.max(1, msg.w | 0);
      const h = Math.max(1, msg.h | 0);
      const res = await chrome.runtime.sendMessage({
        target: 'bvt-offscreen',
        type: 'ocr',
        dataUrl: msg.dataUrl,
        rect: { x: 0, y: 0, w, h },
        vw: w,
        psm: w * h > 600000 ? '3' : '6',
      });
      return res || { error: 'fail' };
    } catch (_) {
      return { error: 'fail' };
    }
  })()
    .then(sendResponse)
    .finally(() => clearInterval(keep));
  return true;
});

// ------------------------------------------------ স্ক্রিন রেকর্ডিং
// রেকর্ডার একটি আলাদা ছোট উইন্ডোতে (recorder.html) চলে, তাই পপআপ বন্ধ হলেও রেকর্ডিং থামে না।

async function openRecorder(opts = {}) {
  const base = chrome.runtime.getURL('recorder.html');
  try {
    const tabs = await chrome.tabs.query({ url: base + '*' });
    if (tabs.length) {
      await chrome.windows.update(tabs[0].windowId, { focused: true });
      await chrome.tabs.update(tabs[0].id, { active: true });
      if (opts.region) chrome.runtime.sendMessage({ type: 'bvt-region-job-ready' }).catch(() => {});
      return;
    }
  } catch (_) {}
  const create = { url: opts.region ? base + '?region=1' : base, type: 'popup', width: 500, height: 680 };
  if (opts.region) {
    // small window in the corner of the browser; the tab is captured, so it never appears in the video
    create.width = 380;
    create.height = 340;
    try {
      const w = await chrome.windows.get(opts.windowId);
      if (w && w.left != null) {
        create.left = Math.max(0, w.left + w.width - create.width - 16);
        create.top = Math.max(0, w.top + w.height - create.height - 16);
      }
    } catch (_) {}
  }
  await chrome.windows.create(create);
}

// Mark an area on the page first (record-region.js), then record only that area.
// Falls back to the normal recorder (tab / window / screen picker) on pages we cannot run on.
async function startRegionRecord(tabArg) {
  try {
    let tab = tabArg;
    if (!tab || tab.id == null) [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (!tab || tab.id == null) throw new Error('no tab');
    await chrome.tabs.sendMessage(tab.id, { type: 'record-region' }, { frameId: 0 });
  } catch (_) {
    await openRecorder();
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || sender.id !== chrome.runtime.id) return false;
  if (msg.type === 'bvt-record-region-go' && sender.tab) {
    (async () => {
      await chrome.storage.session.set({
        bvtRegionJob: { tabId: sender.tab.id, rect: msg.rect, vw: msg.vw, vh: msg.vh, dpr: msg.dpr },
      });
      await openRecorder({ region: true, windowId: sender.tab.windowId });
      sendResponse({ ok: true });
    })().catch((e) => sendResponse({ ok: false, error: String((e && e.message) || e) }));
    return true;
  }
  if (msg.type === 'bvt-region-stream') {
    (async () => {
      const { bvtRegionJob: job } = await chrome.storage.session.get('bvtRegionJob');
      if (!job) return sendResponse({ ok: false, error: 'No area was marked.' });
      // asked for at the last moment: stream ids expire after a few seconds
      const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: job.tabId });
      sendResponse({ ok: true, streamId, ...job });
    })().catch((e) => sendResponse({ ok: false, error: String((e && e.message) || e) }));
    return true;
  }
  return false;
});

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (!msg || msg.type !== 'bvt-open-recorder' || sender.id !== chrome.runtime.id) return false;
  openRecorder();
  return false;
});

// ------------------------------------------------ স্ক্রিনশট হিস্ট্রি
// ছবি + মার্ক এক্সটেনশনের IndexedDB-তে জমা থাকে (ShotDB, উপরে)। পাতার স্ক্রিপ্ট এখানে বার্তা পাঠায়।

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || typeof msg.type !== 'string' || !msg.type.startsWith('bvt-hist-')) return false;
  if (sender.id !== chrome.runtime.id) return false;
  (async () => {
    switch (msg.type) {
      case 'bvt-hist-add': {
        await ShotDB.add(msg.rec);
        const { shotHistoryMax } = await chrome.storage.local.get({ shotHistoryMax: 50 });
        await ShotDB.prune(+shotHistoryMax || 50);
        return { ok: true };
      }
      case 'bvt-hist-update':
        return { ok: await ShotDB.update(msg.id, msg) };
      case 'bvt-hist-list':
        return { ok: true, items: await ShotDB.list() };
      case 'bvt-hist-get': {
        const rec = await ShotDB.get(msg.id);
        return rec ? { ok: true, rec } : { error: 'missing' };
      }
      case 'bvt-hist-delete':
        await ShotDB.remove(msg.id);
        return { ok: true };
      case 'bvt-hist-clear':
        await ShotDB.clear();
        return { ok: true };
      default:
        return { error: 'unknown' };
    }
  })()
    .then(sendResponse)
    .catch((e) => sendResponse({ error: String((e && e.message) || e) }));
  return true;
});

