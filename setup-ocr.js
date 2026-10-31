/* Image translation setup: downloads Tesseract.js and the Bangla/English language data into ocr/.
 * Run once (needs Node 18+ and internet) from the extension folder:
 *     node setup-ocr.js
 */
const fs = require('fs');
const path = require('path');

const JS = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/';
const CORE = 'https://cdn.jsdelivr.net/npm/tesseract.js-core@5/';
const LANG = 'https://github.com/tesseract-ocr/tessdata_fast/raw/main/';

const FILES = [
  [JS + 'tesseract.min.js', 'ocr/tesseract.min.js'],
  [JS + 'worker.min.js', 'ocr/worker.min.js'],
  [CORE + 'tesseract-core-lstm.wasm.js', 'ocr/tesseract-core-lstm.wasm.js'],
  [CORE + 'tesseract-core-simd-lstm.wasm.js', 'ocr/tesseract-core-simd-lstm.wasm.js'],
  [LANG + 'ben.traineddata', 'ocr/lang/ben.traineddata'],
  [LANG + 'eng.traineddata', 'ocr/lang/eng.traineddata'],
];

(async () => {
  let failed = 0;
  for (const [url, rel] of FILES) {
    const dest = path.join(__dirname, rel);
    if (fs.existsSync(dest) && fs.statSync(dest).size > 1000) {
      console.log('exists    ', rel);
      continue;
    }
    try {
      const res = await fetch(url, { redirect: 'follow' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const buf = Buffer.from(await res.arrayBuffer());
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, buf);
      console.log('downloaded', rel, '(' + Math.round(buf.length / 1024) + ' KB)');
    } catch (e) {
      failed++;
      console.log('FAILED    ', rel, '-', e.message, '\n          ', url);
    }
  }
  console.log(failed ? '\n' + failed + ' file(s) failed. Open the links above in your browser and put the files into the ocr/ folder yourself.' : '\nAll files are in place. Reload the extension from chrome://extensions.');
})();
