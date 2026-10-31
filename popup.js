// Always show the installed version next to the title (read from manifest.json)
try { document.getElementById('ver').textContent = 'v' + chrome.runtime.getManifest().version; } catch (e) {}

const DEFAULTS = {
  lang: 'bn-BD', showButton: true, commands: true, dictionary: '',
  selTranslate: true, selMode: 'icon', targetLang: 'bn', phonetic: false, smartPredictive: true, nextWord: true, inlinePreview: true, voiceRerank: true,
};
let selMode = 'icon';
const MODE_HINT = {
  icon: 'When you select text, a 🌐 icon floats beside it. Click the icon to see the translation.',
  instant: 'The translation card appears as soon as you select text.',
};
function paintMode() {
  $('modeIcon').classList.toggle('active', selMode === 'icon');
  $('modeInstant').classList.toggle('active', selMode === 'instant');
  $('modeHint').textContent = MODE_HINT[selMode];
}
const $ = (id) => document.getElementById(id);

function note(text) {
  const el = $('note');
  el.textContent = text;
  el.hidden = !text;
}

function setToggleLabel(listening) {
  $('toggle').textContent = listening ? 'Stop' : 'Start on this tab';
  $('toggle').classList.toggle('on', listening);
}

chrome.storage.sync.get(DEFAULTS, (s) => {
  $('lang').value = s.lang;
  $('showButton').checked = !!s.showButton;
  $('commands').checked = !!s.commands;
  $('phonetic').checked = !!s.phonetic;
  $('smartPredictive').checked = s.smartPredictive !== false;
  $('nextWord').checked = s.nextWord !== false;
  $('inlinePreview').checked = s.inlinePreview !== false;
  $('voiceRerank').checked = s.voiceRerank !== false;
  $('dictionary').value = s.dictionary || '';
  $('selTranslate').checked = !!s.selTranslate;
  $('targetLang').value = s.targetLang;
  selMode = s.selMode === 'instant' ? 'instant' : 'icon';
  paintMode();
});

function save() {
  chrome.storage.sync.set(
    {
      lang: $('lang').value,
      showButton: $('showButton').checked,
      commands: $('commands').checked,
      phonetic: $('phonetic').checked,
      smartPredictive: $('smartPredictive').checked,
      nextWord: $('nextWord').checked,
      inlinePreview: $('inlinePreview').checked,
      voiceRerank: $('voiceRerank').checked,
      dictionary: $('dictionary').value,
      selTranslate: $('selTranslate').checked,
      selMode,
      targetLang: $('targetLang').value,
    },
    () => {
      if (chrome.runtime.lastError) note('Could not save: the word-correction list is too large (keep it within about 2500 characters).');
      else note('');
    }
  );
}

['lang', 'showButton', 'commands', 'phonetic', 'smartPredictive', 'nextWord', 'inlinePreview', 'voiceRerank', 'selTranslate', 'targetLang'].forEach((id) => $(id).addEventListener('change', save));

for (const b of [$('modeIcon'), $('modeInstant')]) {
  b.addEventListener('click', () => {
    selMode = b.dataset.mode;
    paintMode();
    save();
  });
}

let saveTimer = 0;
$('dictionary').addEventListener('input', () => {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(save, 400);
});

async function activeTabId() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab && tab.id != null ? tab.id : null;
}

(async () => {
  const id = await activeTabId();
  if (id == null) return;
  try {
    const res = await chrome.tabs.sendMessage(id, { type: 'status' });
    if (res) setToggleLabel(!!res.listening);
  } catch (_) {
    // এই পাতায় স্ক্রিপ্ট চলছে না
  }
})();

$('toggle').addEventListener('click', async () => {
  const id = await activeTabId();
  if (id == null) return;
  try {
    await chrome.tabs.sendMessage(id, { type: 'toggle' });
    window.close();
  } catch (_) {
    note('Cannot run on this page. Open a regular website; if the page was open before the extension was installed, reload it once.');
  }
});

async function sendShotMessage(type) {
  const id = await activeTabId();
  if (id == null) return;
  try {
    await chrome.tabs.sendMessage(id, { type });
    window.close();
  } catch (_) {
    note('Cannot run on this page. Open a regular website; if the page was open before the extension was installed, reload it once.');
  }
}
$('shot').addEventListener('click', () => sendShotMessage('screenshot'));
$('shotFull').addEventListener('click', () => sendShotMessage('screenshot-full'));
$('shotHist').addEventListener('click', () => sendShotMessage('screenshot-history'));

// স্ক্রিন রেকর্ডার আলাদা ছোট উইন্ডোতে খোলে (পপআপ বন্ধ হলেও রেকর্ডিং চলে)
$('rec').addEventListener('click', async () => {
  // mark an area on the page, then record only that area (falls back to the screen picker)
  const id = await activeTabId();
  try {
    if (id == null) throw new Error('no tab');
    await chrome.tabs.sendMessage(id, { type: 'record-region' }, { frameId: 0 });
  } catch (_) {
    chrome.runtime.sendMessage({ type: 'bvt-open-recorder' });
  }
  window.close();
});

// বাংলা বানান যাচাই: ভুল শব্দের নিচে দাগ (ডিফল্ট চালু; spellcheck.js এই সেটিং পড়ে)
chrome.storage.local.get({ spellBn: true }, (s) => { $('spellBn').checked = s.spellBn !== false; });
$('spellBn').addEventListener('change', () => chrome.storage.local.set({ spellBn: $('spellBn').checked }));
$('spellReset').addEventListener('click', () => {
  chrome.storage.local.set({ spellUserWords: [] });
  const b = $('spellReset');
  const old = b.textContent;
  b.textContent = 'Cleared ✓';
  setTimeout(() => { b.textContent = old; }, 1500);
});

// স্ক্রিনশট হিস্ট্রির সেটিং (এই কম্পিউটারেই থাকে)
chrome.storage.local.get({ shotHistory: true, shotHistoryMax: 50 }, (s) => {
  $('histOn').checked = s.shotHistory !== false;
  $('histMax').value = String(s.shotHistoryMax);
  if ($('histMax').value !== String(s.shotHistoryMax)) $('histMax').value = '50';
  $('histMaxRow').hidden = !$('histOn').checked;
});
function saveHist() {
  $('histMaxRow').hidden = !$('histOn').checked;
  chrome.storage.local.set({ shotHistory: $('histOn').checked, shotHistoryMax: +$('histMax').value });
}
$('histOn').addEventListener('change', saveHist);
$('histMax').addEventListener('change', saveHist);

$('imgTools').addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('imagetools.html') });
  window.close();
});

$('resetLearned').addEventListener('click', () => {
  const b = $('resetLearned');
  chrome.storage.local.remove(['phoneticLearned', 'phoneticChoiceStats', 'phoneticContextStats', 'phoneticNgrams'], () => {
    b.textContent = 'Done ✓';
    setTimeout(() => { b.textContent = 'Forget my chosen spellings'; }, 1500);
  });
});

// ------------------------------------------------------------ টেক্সট এক্সপান্ডার

let expSnips = {};
let expNoteTimer = 0;

function expSay(text, bad) {
  const el = $('expNote');
  el.textContent = text || '';
  el.className = 'hint' + (text ? (bad ? ' err' : ' ok') : '');
  clearTimeout(expNoteTimer);
  if (text) expNoteTimer = setTimeout(() => { el.textContent = ''; el.className = 'hint'; }, 3500);
}

function expSave(done) {
  chrome.storage.local.set({ expSnippets: expSnips }, () => {
    if (chrome.runtime.lastError) expSay('Could not save the snippets.', true);
    else if (done) done();
  });
}

function expRender() {
  const box = $('expList');
  box.textContent = '';
  const keys = Object.keys(expSnips).sort((a, b) => a.localeCompare(b));
  if (!keys.length) {
    const p = document.createElement('p');
    p.className = 'hint';
    p.textContent = 'No short codes yet. Add your first one above.';
    box.appendChild(p);
    return;
  }
  for (const k of keys) {
    const row = document.createElement('div');
    row.className = 'exprow';
    const t = document.createElement('b');
    t.textContent = k;
    const v = document.createElement('span');
    v.textContent = expSnips[k].replace(/\s+/g, ' ');
    v.title = expSnips[k];
    const ed = document.createElement('button');
    ed.type = 'button';
    ed.textContent = '✎';
    ed.title = 'Edit';
    ed.addEventListener('click', () => {
      $('expTrigger').value = k;
      $('expText').value = expSnips[k];
      $('expText').focus();
    });
    const del = document.createElement('button');
    del.type = 'button';
    del.textContent = '✕';
    del.title = 'Delete';
    del.addEventListener('click', () => {
      delete expSnips[k];
      expSave(expRender);
    });
    row.append(t, v, ed, del);
    box.appendChild(row);
  }
}

function expValid(trigger) {
  if (trigger.length < 2 || trigger.length > 40) return 'The short code must be 2 to 40 characters.';
  if (/\s/.test(trigger)) return 'The short code cannot contain spaces.';
  return '';
}

chrome.storage.local.get({ expEnabled: true, expMode: 'key', expSnippets: {} }, (s) => {
  $('expEnabled').checked = s.expEnabled !== false;
  $('expMode').value = s.expMode === 'instant' ? 'instant' : 'key';
  expSnips = s.expSnippets && typeof s.expSnippets === 'object' ? s.expSnippets : {};
  expRender();
});

$('expEnabled').addEventListener('change', () => chrome.storage.local.set({ expEnabled: $('expEnabled').checked }));

chrome.storage.local.get({ frEnabled: true }, (s) => { $('frEnabled').checked = s.frEnabled !== false; });
$('frEnabled').addEventListener('change', () => chrome.storage.local.set({ frEnabled: $('frEnabled').checked }));
$('expMode').addEventListener('change', () => chrome.storage.local.set({ expMode: $('expMode').value }));

$('expAdd').addEventListener('click', () => {
  const trigger = $('expTrigger').value.trim();
  const text = $('expText').value.replace(/\r/g, '');
  const bad = expValid(trigger);
  if (bad) return expSay(bad, true);
  if (!text.trim()) return expSay('Write the full text for this code.', true);
  expSnips[trigger] = text;
  expSave(() => {
    $('expTrigger').value = '';
    $('expText').value = '';
    expRender();
    expSay('Saved ✓');
  });
});

$('expExport').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify({ bvtSnippets: 1, snippets: expSnips }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'bangla-voice-typing-snippets.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
});

$('expImport').addEventListener('click', () => $('expFile').click());
$('expFile').addEventListener('change', async () => {
  const f = $('expFile').files[0];
  $('expFile').value = '';
  if (!f) return;
  try {
    const data = JSON.parse(await f.text());
    const src = data && data.snippets && typeof data.snippets === 'object' ? data.snippets : data;
    let n = 0;
    for (const [k, v] of Object.entries(src || {})) {
      if (typeof v === 'string' && v.trim() && !expValid(k)) {
        expSnips[k] = v;
        n++;
      }
    }
    if (!n) return expSay('No valid short codes found in that file.', true);
    expSave(() => { expRender(); expSay(n + ' short code' + (n > 1 ? 's' : '') + ' imported ✓'); });
  } catch (_) {
    expSay('That file could not be read.', true);
  }
});

$('shortcuts').addEventListener('click', (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
});

// ------------------------------------------------------------ অনুবাদ মডেল

const PAIRS = [
  { sourceLanguage: 'bn', targetLanguage: 'en', label: 'Bangla → English' },
  { sourceLanguage: 'en', targetLanguage: 'bn', label: 'English → Bangla' },
];
const toBn = (n) => String(n);

function hint(text, kind) {
  const el = $('modelHint');
  el.textContent = text;
  el.className = 'hint' + (kind ? ' ' + kind : '');
}

async function checkModels() {
  if (!('Translator' in self)) {
    hint('This Chrome has no translation API. Chrome 138 or newer is required.', 'err');
    return;
  }
  try {
    const states = await Promise.all(
      PAIRS.map((p) => Translator.availability({ sourceLanguage: p.sourceLanguage, targetLanguage: p.targetLanguage }))
    );
    // ভাষা শনাক্তকরণের মডেল ঐচ্ছিক: না থাকলে লিপি দেখে অনুমান চলে, তবে মিশ্র লেখায় নির্ভুলতা কমে
    let detectorState = 'unavailable';
    if ('LanguageDetector' in self) {
      try { detectorState = await LanguageDetector.availability(); } catch (_) {}
    }
    const detectorPending = detectorState === 'downloadable' || detectorState === 'downloading';
    if (states.includes('unavailable')) {
      hint('This language pair is not supported in your Chrome.', 'err');
    } else if (states.every((s) => s === 'available') && detectorPending) {
      hint('The language-detection model is not downloaded yet (it improves accuracy on mixed-language text).');
      $('prepare').hidden = false;
    } else if (states.every((s) => s === 'available')) {
      hint('✓ Translation ready. Select text and press Alt+C.', 'ok');
    } else {
      hint('Before first use, the models must be downloaded once (internet required).');
      $('prepare').hidden = false;
    }
  } catch (_) {
    hint('Could not check the model status.', 'err');
  }
}

$('prepare').addEventListener('click', async () => {
  const b = $('prepare');
  b.disabled = true;
  try {
    for (const p of PAIRS) {
      await Translator.create({
        sourceLanguage: p.sourceLanguage,
        targetLanguage: p.targetLanguage,
        monitor(m) {
          m.addEventListener('downloadprogress', (e) => {
            hint(p.label + ' model downloading… ' + toBn(Math.round(e.loaded * 100)) + '%');
          });
        },
      });
    }
    if ('LanguageDetector' in self) {
      try {
        await LanguageDetector.create({
          monitor(m) {
            m.addEventListener('downloadprogress', (e) => {
              hint('Language-detection model downloading… ' + toBn(Math.round(e.loaded * 100)) + '%');
            });
          },
        });
      } catch (_) {
        // ঐচ্ছিক মডেল: না নামলেও অনুবাদ চলবে
      }
    }
    b.hidden = true;
    hint('✓ Translation ready. Select text and press Alt+C.', 'ok');
  } catch (_) {
    hint('Could not download the models. Check your internet and disk space, then try again. Keep the popup open.', 'err');
  } finally {
    b.disabled = false;
  }
});

checkModels();

// ------------------------------------------------------------ Phonetic learning tools
const LEARNING_KEYS = ['phoneticLearned', 'phoneticChoiceStats', 'phoneticContextStats', 'phoneticCustomWords', 'phoneticNgrams'];
function learningNote(text, error = false) {
  const el = $('learningNote');
  if (!el) return;
  el.textContent = text;
  el.className = 'hint' + (error ? ' err' : ' ok');
}
function parseCustomWords(text) {
  const result = {};
  const lines = String(text || '').split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const ix = line.indexOf('=');
    if (ix < 1) continue;
    const roman = line.slice(0, ix).trim().toLowerCase();
    const bangla = line.slice(ix + 1).trim();
    if (/^[a-z`^]+$/.test(roman) && bangla) result[roman] = bangla;
  }
  return result;
}
function formatCustomWords(words) {
  return Object.keys(words || {}).sort().map((key) => `${key} = ${words[key]}`).join('\n');
}
function loadLearningTools() {
  chrome.storage.local.get({ phoneticCustomWords: {} }, (s) => {
    $('customWords').value = formatCustomWords(s.phoneticCustomWords || {});
  });
}
function saveCustomWords() {
  const words = parseCustomWords($('customWords').value);
  const lines = $('customWords').value.split(/\r?\n/).filter((line) => line.trim() && !line.trim().startsWith('#'));
  const parsedLines = Object.keys(words).length;
  if (parsedLines < lines.length) {
    learningNote('কিছু লাইন বাদ গেছে। সঠিক ফরম্যাট: roman = বাংলা; Roman-এ শুধু a-z, ` বা ^ ব্যবহার করো।', true);
  }
  chrome.storage.local.set({ phoneticCustomWords: words }, () => {
    if (chrome.runtime.lastError) learningNote('Custom words save করা যায়নি: ' + chrome.runtime.lastError.message, true);
    else learningNote(`${Object.keys(words).length}টি custom word সংরক্ষণ হয়েছে।`);
  });
}
if ($('customWords')) {
  loadLearningTools();
  $('addCustomWord').addEventListener('click', () => {
    const roman = $('customRoman').value.trim().toLowerCase();
    const bangla = $('customBangla').value.trim();
    if (!/^[a-z`^]+$/.test(roman) || !bangla) {
      learningNote('Roman শব্দে শুধু ইংরেজি a-z, ` বা ^ এবং বাংলা ফল লিখো।', true);
      return;
    }
    const words = parseCustomWords($('customWords').value);
    words[roman] = bangla;
    $('customWords').value = formatCustomWords(words);
    saveCustomWords();
    $('customRoman').value = '';
    $('customBangla').value = '';
  });
  $('saveCustomWords').addEventListener('click', saveCustomWords);
  $('exportLearning').addEventListener('click', () => {
    chrome.storage.local.get(LEARNING_KEYS, (data) => {
      const payload = { format: 'bvt-phonetic-learning-v1', exportedAt: new Date().toISOString() };
      for (const key of LEARNING_KEYS) payload[key] = data[key] || {};
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'bangla-voice-typing-learned-data.json';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      learningNote('Learned data export করা হয়েছে।');
    });
  });
  $('importLearningButton').addEventListener('click', () => $('importLearningFile').click());
  $('importLearningFile').addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try {
      const payload = JSON.parse(await file.text());
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('JSON object নয়');
      const data = {};
      for (const key of LEARNING_KEYS) {
        const value = payload[key];
        if (value !== undefined) {
          if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${key} ফরম্যাট সঠিক নয়`);
          data[key] = value;
        }
      }
      if (!Object.keys(data).length) throw new Error('ফাইলে কোনো পরিচিত learned-data নেই');
      chrome.storage.local.set(data, () => {
        if (chrome.runtime.lastError) learningNote('Import ব্যর্থ: ' + chrome.runtime.lastError.message, true);
        else {
          if (data.phoneticCustomWords) $('customWords').value = formatCustomWords(data.phoneticCustomWords);
          learningNote('Learned data import হয়েছে।');
        }
      });
    } catch (err) {
      learningNote('Import করা যায়নি: ' + err.message, true);
    } finally {
      e.target.value = '';
    }
  });
}
