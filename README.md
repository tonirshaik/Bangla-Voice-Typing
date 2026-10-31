# Bangla Voice Typing (Chrome extension)

Speak, and Bangla text is typed into the text field of any website. It uses Chrome's built-in Web Speech API (`bn-BD`), so it is free and needs no API key. Don't want to speak? Turn on **phonetic typing** (**Alt + B**) and type `tumi kemon acho` on an English keyboard to get `তুমি কেমন আছো`. Select text and press **Alt + C** to translate Bangla ↔ English (free, using Chrome's on-device translation). Press **Alt + V** and drag a box over text inside an image to read it and see the translation. Chrome's AI tools can optionally **fix English spelling and grammar**. Summary and Tone tools are not included in this build.

## Installation

1. Unzip the archive (the folder that contains `manifest.json` is the extension folder).
2. Open `chrome://extensions` in Chrome.
3. Turn on **Developer mode** (top right).
4. Click **Load unpacked** and choose the folder. If it is already installed, press the reload button on the extension card.
5. Reload any tabs that were already open.

## Usage

1. Click inside a text field on a website (an input, textarea, or editor).
2. Click the blue mic button at the bottom right, or press one of the shortcuts below.
3. The first time, Chrome asks for microphone permission. Choose **Allow**. The permission is remembered per site.
4. When the button turns red, start speaking. Click it again or press the same shortcut to stop. If you say nothing for 10 seconds, it stops by itself.

You can drag the mic button anywhere on the page. To hide it, open the extension popup and turn it off; the shortcuts keep working.

## Shortcuts

| Shortcut | Action |
|---|---|
| Alt + X | Toggle Bangla (`bn-BD`) voice typing |
| Alt + Z | Toggle English (`en-US`) voice typing |
| Alt + B | Turn phonetic Bangla typing (type `tumi` → `তুমি`) on or off (works inside the page; not in Chrome's shortcut list) |
| Alt + C | Translate selected text, Bangla ↔ English |
| Alt + V | Translate text inside an image, Bangla ↔ English (drag a box) |
| Ctrl + K | Command palette: search every feature and open tab, then run it |
| Ctrl + F / Alt + A | Inside a text box that has text: find / find and replace words in that box (see *Find and Replace in text boxes*) |
| Alt + S | Screenshot: select an area (or press **F** for the whole scrolling page), mark it up, copy or save in HD |

While one language is running, pressing the other language's shortcut switches the language; pressing the same shortcut stops it. A language switched by shortcut applies only to that session and does not change the popup setting. While listening, the bubble beside the mic button shows the current language as `[Bangla]` or `[English]`.

## Phonetic typing (Alt + B)

For keyboards that only have English letters. Type Bangla words in English letters and press **Space** (or Enter, Tab, or a punctuation mark): the word turns into Bangla. While you type, a list of spellings appears next to the field. The first is used by default; press **↓ / ↑** to pick another one (up to 10, for example `tomar` → তমার, **তোমার**, টমার…, and `eccha` → এচ্ছা, **ইচ্ছা**…; the list scrolls), then press Space or Enter. You can also click an item. The last item is your original English letters. **Esc** closes the list.

```
tumi kemon acho        →  তুমি কেমন আছো
ami valo achi          →  আমি ভালো আছি
bangladesh             →  বাংলাদেশ
```

Turn it on with **Alt + B** (a small message appears at the bottom of the page) or with the checkbox in the popup. The setting is remembered. Turn it off again when you want to type English.

- Press **Backspace** right after a word was converted to get your English letters back (for a name or an English word in the middle of a Bangla sentence).
- **It remembers your choice.** If you pick, say, the 7th spelling for a word, the next time you type that same word your choice is first in the list. Picking your original English letters is remembered too. Pick the usual spelling again to undo it, or press **Forget my chosen spellings** in the popup to clear everything. The choices are saved only in this browser (not synced).
- **Built-in word list.** Common words are in `phonetic-dict.js`, so the right spelling comes first even when the letter rules would get it wrong: `jonno` → **জন্য** (not জন্ন), `tomar` → **তোমার**, `kothay` → **কোথায়**, `dhonnobad` → **ধন্যবাদ**. If a word has two accepted spellings (`valo`), both are listed, the usual one first. The letter-rule spelling and the other variants follow after them, and your own remembered choice still goes above everything. To add a word, add one line to `phonetic-dict.js`: `roman bangla [other-bangla…]` (the roman text must match exactly, including capital letters), then reload the extension.
- **Large word list (frequency-ranked).** `bn-words.js` holds about 34,000 common Bangla words with how often they are used. The extension makes the usual 10 spellings for what you typed, and the ones that are real words move up, the most common first, so `proshno` → **প্রশ্ন**, `sundor` → **সুন্দর**, `poribar` → **পরিবার** without adding them to `phonetic-dict.js`. A word that is not in the list still gets the letter-rule spelling first. The order is: `phonetic-dict.js` → real words close to what you typed → letter-rule spelling → other real words → other variants. To rebuild or enlarge the list: `node build-wordlist.js --max 50000 --min 3 -o bn-words.js file1 [file2 …]`. Each input is either a frequency list (`word count` per line) or plain Bangla text (e.g. text extracted from Wikipedia); counts are added together. If `bn-words.js` is deleted or empty, everything works as before.
- **Next-word suggestions and word-pair (bigram/trigram) ranking.** `bn-ngrams.js` holds how often a word follows one or two other words. (1) Right after a Bangla word and a space, a small list shows the likely next words (`আমি ` → **আসছি, তোমাকে, যাচ্ছি, যাব…**). Press **↓** to choose (↑ goes back), **Tab** or **Enter** inserts the chosen word (Tab with nothing chosen inserts the first one), **Esc** hides the list, or click a word. After it is inserted the next suggestions appear, so you can chain a whole sentence. (2) While you type a word, the previous one or two Bangla words move the right spelling up: `ki` after `তুমি` → **কি**, but after `তোমার নাম` → **কী**; `ja` after `আমি` also offers **যাচ্ছি**. A three-word match is used first, then a two-word match (counted at 0.4). Words you pick yourself are learned in this browser (not synced): one pick only nudges, a few picks make it the first choice. Your own remembered spelling choice and words saved as custom words still go above everything. Sentences end at `।`, `?`, `!`, `.` and a new line, and an English word in between stops the context. Turn it off with **Next-word suggestions** in the popup (the word-pair ranking has its own switch, **AI Smart Predictive Typing**). Nothing is sent anywhere. The shipped file is built from the short hand-written sentence list `ngram-seed.txt`; for much better predictions rebuild it from a big Bangla text: `node build-ngrams.js --min-bi 3 --min-tri 2 --vocab bn-words.js -o bn-ngrams.js ngram-seed.txt corpus.txt` (inputs are plain text; counts are added; words not in `bn-words.js` are dropped). **Forget my chosen spellings** also clears what was learned.
- A full stop right after a word becomes `।`.
- It works in inputs, textareas and editors (including editors inside iframes). It does not work in password fields. Words after `@`, `/`, `_` or `#`, and `http`/`www`, are left alone, so emails and links stay English.
- Voice typing and phonetic typing can be used together; they do not affect each other.
- Digits stay as they are.

### Conjuncts and reph in suggestions

The letter rules only join a fixed list of pairs and never add a reph on their own, so `nirbachon` used to give `নিরবাছন` and the right word was not in the first eight suggestions. Now the consonant skeleton of what you typed (vowels, hasanta and reph position ignored; similar sounds such as ন/ণ and শ/ষ/স treated as one) is matched against the 34,000-word list. The best matches are placed right after the first suggestion, so `nirbachon` shows `নিরবাছন`, then `নির্বাচন`. The first suggestion (what Space inserts) never changes, and words in `phonetic-dict.js` are untouched. The index is built the first time you type an unknown word (about 0.15 s) and then cached. Tests are in `phonetic-regression-tests/skeleton-cases.json`.

### Names, brands and common words

`phonetic-dict.js` now also has all 8 divisions and 64 districts (with common spellings such as `chattogram` / `chittagong` / `ctg`), well-known Dhaka areas, countries, popular brands and apps (`Facebook` → ফেসবুক, `bKash` → বিকাশ, `Pathao` → পাঠাও, `Sylhet` → সিলেট, `Chattogram` → চট্টগ্রাম) and about 150 everyday words (food, colours, weather, family, health, festivals). Capitalised input such as `Facebook` or `Dhaka` is matched too. To add your own, put one line per word in the dictionary file: `roman বাংলা [other বাংলা …]`, then run `node phonetic-regression-tests/test-phonetic.js`.

### How letters map

Small and capital letters are different, as in Avro:

| Type | Get | Type | Get | Type | Get |
|---|---|---|---|---|---|
| `k` `kh` `g` `gh` | ক খ গ ঘ | `t` `th` `d` `dh` | ত থ দ ধ | `T` `Th` `D` `Dh` | ট ঠ ড ঢ |
| `n` / `N` | ন / ণ | `s` / `S` / `Sh` | স / শ / ষ | `sh` | শ |
| `ch` / `chh` | ছ | `c` | চ | `j` `jh` | জ ঝ |
| `r` / `R` / `Rh` | র / ড় / ঢ় | `y` / `z` | য় / য | `w` | ও (ব-ফলা after a letter) |
| `ng` | ং | `Ng` / `NG` | ঙ / ঞ | `^` | ঁ |
| `kkh` | ক্ষ | `GG` | জ্ঞ | `p` `ph` `f` `b` `bh` `v` `m` `l` `h` | প ফ ফ ব ভ ভ ম ল হ |

Vowels: `a` আ/া, `i` ই/ি, `u` উ/ু, `e` এ/ে, `o` অ, `O` ও/ো, `oi` ঐ/ৈ, `ou` ঔ/ৌ, `aa` আ/া, `ii`/`ee`/`I` ঈ/ী, `uu`/`U` ঊ/ূ, `oo` উ/ু, `rri` ঋ/ৃ.

Things to know:

- A **final `o`** after a single letter gives ো (`valo` → ভালো, `acho` → আছো, `bolo` → বলো). A `o` in the middle of a word is silent (`kemon` → কেমন, `bondhu` → বন্ধু). After joined letters a final `o` is silent too (`bondho` → বন্ধ, `sotyo` → সত্য). Use capital `O` when you need ো in the middle (`tOmar` → তোমার).
- `ch` gives ছ (so `acho` → আছো). For চ type `c` (`cinta` → চিন্তা).
- Common joined letters are made automatically: `sundor` → সুন্দর, `shanti` → শান্তি, `prem` → প্রেম, `mantro`-style র-ফলা after most letters, `dhonyobad` → ধন্যবাদ (য-ফলা), `bishwas` → বিশ্বাস (ব-ফলা). Other letters are *not* joined, so `korbo` → করবো and `korchi` → করছি.
- To force a reph or join, type `rr`: `korrmo` → কর্ম. To stop two letters joining, put a backtick between them.
- Capital letters at the start of a word that are not in the table (for example `Ami`, `Bangladesh`) are read as small letters, but `T`, `D`, `N`, `S`, `R`, `O`, `I`, `U` keep their special meaning (`Dhaka` → ঢাকা).

## Bangla spell check

Misspelled Bangla words get a wavy red line while you type, in any text box (`<textarea>`, one-line inputs and rich editors such as chat boxes). It uses the word list in `bn-words.js`: a word that is not in the list (even after taking off common endings like **-দের, -কে, -ছি, -লাম** or splitting it into two known words) is underlined.

- The word you are still typing (the cursor is on it) is not underlined until you move on.
- Password boxes, code editors and fields with `spellcheck="false"` are skipped, and so are words mixed with English letters, numbers and one-letter words.
- Words you chose or saved as custom words in phonetic typing count as correct.
- **Right-click an underlined word** to fix it: pick one of the suggestions (the closest known words, most used first) and the word is replaced. **এড়িয়ে যাও** hides the line until the page is reloaded; **অভিধানে যোগ করো** saves the word for good. The popup has a button to forget the words you added.
- Turn it off or on in the popup: **Typing and voice → Bangla spell check**.
- It is only as good as the list: rare words and names that are not in `bn-words.js` can be underlined although they are right (use the right-click menu for those), and a few common typos that happen to be in the list are not. To teach it more words, add them from the right-click menu or rebuild the list with `build-wordlist.js`.

## Translate (Alt + C)

1. Select Bangla or English text inside a text field.
2. Press **Alt + C**. Bangla becomes English; English (or any other language) becomes Bangla. The text is replaced in place and stays selected.
3. Press **Alt + C** again to get the original text back exactly.

Before first use, click the extension icon and press **Prepare translation models**. Once a model is downloaded it works offline, and your text never leaves your computer.

- Needs desktop Chrome 138 or newer, and the site must use `https`.
- The source language is detected with Chrome's Language Detector, so mixed Bangla/English text is handled by the main language. If the model is missing (or the detector is unsure), the script's letters are counted instead.
- Selecting text in any language other than Bangla or English and pressing Alt + C translates it to Bangla (that language's model must be downloaded once).
- If there is no direct model for a language pair (for example French → Bangla), it translates in two steps through English. This downloads two models, and quality may drop a little because of the middle step. The select-to-translate card shows the path, for example `French → English → Bangla`.
- If you edit the selected text, "restore the original" no longer works and a fresh translation is done.
- In chat-box style editors, multi-paragraph text is not left selected after translation. Press Ctrl + Z to undo.

## Today's date and time

The top of the popup shows a small card with a 24-hour clock and a 12-hour (AM/PM) clock beside it, the GMT offset of your device and the ISO 8601 date, followed by today's date in three calendars: **Bangla** (Bangladesh revised calendar, 1 Boishakh = 14 April), **English** (day month year) and **Arabic** (Hijri, Umm al-Qura — the date is computed from the Hijri calendar, but the month name and digits are written in Bangla script, e.g. `৯ জমাদিউল আউয়াল ১৪৪৮ হিজরি`). The Hijri date can differ by a day in some countries. The logic is in `dates.js` and is tested with `node date-tests/test-dates.js`.

## Image tools

Click **Image tools** in the popup (or press **Ctrl + K** and type "image"). Add pictures by dropping them, pasting (Ctrl + V) or choosing files, then pick a tool:

- **Compress**: smaller files at a quality you choose, or aiming for a size in KB (JPG / WebP); optional limit on the longest side.
- **Resize**: by percent, exact width/height, or fit inside a box.
- **Convert**: JPG, PNG and WebP in any direction; see-through parts get a background colour when saving as JPG.
- **To PDF**: all pictures in the order shown, A4 / Letter / same size as the picture, with margins.

Everything is done inside the browser with a canvas. Nothing is uploaded, and the page does not use any extension-only feature, so it also works when opened in any browser. WebP saving needs a browser that supports it (Chrome, Edge, Firefox; the option turns itself off elsewhere). Several results can be downloaded as one .zip.

## Text expander

Type a short code and press **Space**, **Tab** or **Enter**, and the full text appears. Open the popup, then **⚡ Text expander**, type a code such as `;thx` and the full text, and press **Add / update**.

- Start codes with a symbol such as `;` so normal words never expand.
- In the text you can use `{date}` (17/10/2026), `{time}`, `{day}` (Saturday) and `{cursor}` (where the cursor stays after expanding). Several lines are fine.
- The mode box lets you expand **instantly** when the last letter of the code is typed instead. With instant mode, do not use a code that is the start of another code.
- It works in text boxes, text areas and rich editors (Gmail, chats). New lines in rich editors are soft line breaks, so a chat message is not sent by mistake. **Ctrl + Z** undoes an expansion. Password fields are never touched.
- It runs before phonetic typing, so a code like `;thx` is not turned into Bangla.
- **Export** / **Import** save and load your codes as a JSON file. The codes stay on this computer (not synced).

## Find and Replace in text boxes (Ctrl + F / Alt + A)

Click inside any text box that already has some text, then press **Ctrl + F** to find or **Alt + A** to find and replace. A small panel (like the one in VS Code) opens next to the box and every match is highlighted. On a Mac use **Cmd + F** to find, and **Option + A** for replace. The panel also has Undo / Redo buttons next to Replace / All.

- **Enter** / **Shift + Enter** go to the next / previous match. In the Replace box, **Enter** replaces the current match and **Ctrl + Alt + Enter** replaces all. **Esc** closes the panel and puts the cursor back in your box (on the current match).
- Buttons in the Find box: **Aa** match case, **ab** whole word, **.\*** regular expression, **বা** phonetic search. With regular expressions, `$1`, `$&`, `\n` and `\t` work in the Replace box. **AB** (Replace box) keeps the letter case: `Roni` becomes `Rahat`, `RONI` becomes `RAHAT`.
- **Bangla aware:** whole word treats kar, fola and hasanta as part of the word (JavaScript's own `\b` does not). Invisible ZWJ/ZWNJ are ignored, `ড়` `ঢ়` `য়` match in both of their forms, and `123` finds `১২৩` (and the reverse; not in regular-expression mode).
- **Phonetic:** with **বা** on in the Find box, typing `roni` also finds রনি. With **বা** on in the Replace box, typing `rahat` inserts রাহাত (a preview line shows the Bangla). Capital letters matter, as in phonetic typing: `R` is ড়, `T` is ট. Use lower case for ordinary names.
- If you select a word before opening the panel, it is put in the Find box. If you select several lines, it searches only inside your selection (the **≡** button turns this on or off).
- It works in text boxes, text areas and rich editors (Gmail, Facebook, chats), also inside iframes. In a text box or text area **Ctrl + Z** undoes a "replace all" in one step. In a rich editor, one **Ctrl + Z** per paragraph that had matches (the browser records each edit separately). Formatting such as bold and the paragraph structure is kept.
- It does not take over the keys when it would not help: an **empty** box, a **password** box, and boxes with their own Find (Google Docs, VS Code on the web, Monaco/CodeMirror/Ace editors) keep Chrome's or the site's own Ctrl + F / Alt + A. Clicking outside any box also keeps Chrome's own search. While the Find box is focused, pressing **Ctrl + F** again closes the panel and opens Chrome's own page search.
- Also in the command palette: **Find & Replace in text box** (runs it for the box you were typing in) and a switch to turn the feature on or off. The switch is also in the popup, under **Typing and voice**. The buttons you turned on (Aa, ab, …) are remembered.
- You can copy, cut and paste in both boxes with **Ctrl + C / X / V** (and **Ctrl + A**). Some sites block copy and paste for the whole page; the two boxes still work there (a pasted line break becomes a space). If a site even blocks the keyboard keys, **Ctrl + V** may ask Chrome's permission to read the clipboard once. The right-click menu can still be blocked by such sites.
- Nothing is sent anywhere; all searching happens inside the page.

## Command palette (Ctrl + K)

One search box for everything, so you do not have to remember shortcuts. It also gets around Chrome's limit of 4 extension shortcuts, because every feature can be reached from here.

1. Press **Ctrl + K** on a page (**Cmd + K** on Mac), or click **⌨️ Command palette** in the popup.
2. Type a few letters and press **Enter**. Use **↑ / ↓** (or Tab) to choose, **Esc** to close. English and Bangla words both work: `scr`, `full`, `record`, `রেকর্ড`, `অনুবাদ`.
3. Type **>** first to search only features, or **@** first to search only open tabs.

What you can run:

- **Features**: Bangla / English voice typing, translate selected text, translate image text, summarize this page, screenshot, full-page screenshot, screenshot history, screen recording.
- **Settings with an On / Off badge**: phonetic typing, voice commands, floating mic button, translate on select, text expander. Choosing one flips it.
- **Open tabs**: search by title or address across all windows and jump to the tab. The most recently used tabs come first.
- **Tab actions**: new tab, new window, duplicate, reload, pin, mute, move to a new window, close this tab.
- **Recent**: the features you used last are listed first when the box is empty.

The palette gives the page its text selection and cursor back before it runs a feature, so "Translate selected text" and voice typing work on what you had selected or focused.

Good to know:

- Ctrl + K is also used by some sites (Slack, GitHub, Notion) for their own search. In popup you can change the key to **Ctrl + Shift + K** or **Alt + K**, or turn it off and use the popup button. In rich editors such as Gmail's compose box, Ctrl + K keeps its link-inserting job.
- Like the other page features, it does not run on `chrome://` pages, the Chrome Web Store or the new-tab page. Open the popup or use a normal website tab there. It needs a reload of pages that were already open before the extension was updated.
- It reads the titles and addresses of your open tabs only to show them in the list. Nothing is stored or sent anywhere. This is why the extension now asks for the **tabs** permission.
- You can also set your own Chrome shortcut for "Open the command palette" at `chrome://extensions/shortcuts`.

## Screenshot and mark up (Alt + S)

Take a sharp screenshot of any part of a page and draw on it before you save it.

1. Press **Alt + S** (or click **📸 Screenshot & mark up** in the popup). The page dims slightly.
2. Drag a box over the area you want. Press **Enter** to take the whole screen. `Esc` cancels.
3. The screenshot card opens. Pick a tool and mark the picture:
   - ✏️ pen (**P**) · 🖍️ highlighter (**H**) · ↗ arrow (**A**) · ▭ box (**R**) · ◯ circle (**O**) · T text (**T**, Bangla works) · ① numbered steps (**N**) · ▦ blur / hide private details (**B**)
   - Hold **Shift** while drawing a box or circle for a perfect square or circle.
   - Pick a colour and thickness; **Ctrl + Z** undo, **Ctrl + Shift + Z** redo.
4. **Copy** (Ctrl + C) puts the picture on the clipboard. **Save PNG** (Ctrl + S) downloads it.

**HD quality:** the picture is taken as a lossless PNG at your screen's real pixel resolution (a 2× / Retina screen gives a 2× picture). The quality box next to the buttons can save at 2× or 3× so the marks and text stay crisp; it does not invent detail that was not on the screen. Very large pictures are limited automatically to about 100 megapixels.

**Copy text from the picture:** click **📝 Text** in the screenshot card. The text in the picture (Bangla and English) is read on your computer, nothing is sent anywhere, and shown in a box where you can fix mistakes and press **Copy text**. Your marks are not included, so drawings do not disturb the reading. For best results retake a smaller area right over the text. The first reading is slower because the engine has to start. It uses the same image-reading files as Alt + V (see "Preparing image translation").

Pressing **Enter** (or dragging a box) captures what is visible on the screen. For the whole scrolling page see "Full-page screenshot" below. The screenshot does not work on `chrome://` pages or the Chrome Web Store. Alt + S is caught by the page itself (Chrome allows only 4 default extension shortcuts), so it works on normal websites. The `Fn` key cannot be used because browsers cannot see it. You can also set your own key for "Take a screenshot" at `chrome://extensions/shortcuts`.

## Full-page screenshot (whole scrolling page)

Take one tall picture of a page that is longer than the screen.

1. Press **Alt + S**, then press **F** (or click **📜 Full page**). You can also use **📜 Full-page screenshot** in the popup, or **📜 Full page** inside the screenshot card.
2. The page scrolls by itself, screen by screen, and the pieces are joined into one picture. A small bar shows the progress; press **Esc** or **Cancel** to stop. Do not scroll or click the page while it works.
3. The picture opens in the same card, so you can mark it up, copy it, save it, or read its text with **📝 Text**.

Good to know:

- Chrome allows only about 2 captures per second, so a long page takes a few seconds.
- After the first screen, fixed and sticky parts (top bars, cookie banners, chat bubbles) are hidden so they do not repeat in every piece. The top bar is still shown once, at the top.
- Pages whose own content scrolls inside a box (many web apps) are handled too: the biggest scrolling box is captured.
- Very long pages are cut at about 32,000 pixels tall (or about 250 megapixels) because the browser cannot make bigger pictures. The card tells you when this happens.
- Pages that load more content as you scroll are captured as far as they load while scrolling (up to 90 screens).

## Screenshot history

Every screenshot is kept inside the browser, so you can open it again later to mark it up or copy it.

- Open it with **🕘 History** (in the Alt + S screen, in the screenshot card, or in the popup).
- Click a picture to open it in the editor **with its marks still editable**. Copy, Save PNG and 📝 Text work as usual.
- Your marks are saved automatically while you draw, and the small preview shows them. The original picture is kept without marks, so you can remove or change marks any time.
- **✕** on a picture deletes it. **Clear all** deletes everything.
- In the popup, **Keep screenshot history** turns it on or off, and you choose how many to keep (20, 50, 100 or 200). Older ones are deleted automatically.
- It is stored in the extension's own browser storage on this computer. It is not synced and nothing is uploaded. Removing the extension or clearing its data deletes it. Full-page pictures are large (several MB each), so lower the number if disk space matters.

## Screen recording (WebM)

Record a tab, a window or the whole screen as a WebM video, with sound if you want.

1. Click **🎥 Record screen / tab** in the popup. A small recorder window opens (it stays open even if the popup closes). You can also set a key for "Open the screen recorder" at `chrome://extensions/shortcuts`.
2. Choose what to include:
   - **Record tab / system sound**: the sound of the shared tab (or the whole system when you share the screen on Windows/ChromeOS).
   - **Record my microphone**: your voice. The first time, Chrome asks for microphone permission. Tab sound and microphone are mixed into one track.
   - **Quality**: Standard (720p), HD (1080p) or Maximum (your screen's real size).
3. Click **Start recording** and choose a **Tab**, **Window** or **Entire screen** in Chrome's picker. Tick "Share tab audio" there if you want the sound.
4. Use **Pause / Resume** and **Stop & save**. Chrome's own "Stop sharing" bar also stops it. The file is saved as `recording-YYYYMMDD-HHMMSS.webm` in your Downloads folder (you can turn off automatic saving and use **Download WebM** instead), and a preview plays in the window.

Good to know:

- Share a **Tab** for the cleanest video. If you share the whole screen, minimize the recorder window first or it will be in the video.
- The video is kept in memory until you stop, so very long recordings use a lot of memory (about 20 to 60 MB per minute depending on quality). Keep the recorder window open while recording.
- WebM files play in Chrome, Edge, Firefox and VLC. Some editors do not show the video length and seeking can be limited because the browser does not write the length into the file; converting once with a tool such as HandBrake or ffmpeg fixes that.

## Translate image text (Alt + V)

Text inside an image cannot be selected, so the extension first reads the text from the image (OCR) and then translates it.

1. Press **Alt + V**. The page dims slightly.
2. Drag a box over the text in the image. Press `Esc` (or Alt + V again) to cancel.
3. A card appears next to the box. English becomes Bangla, Bangla becomes English (other languages become Bangla).
4. The card has **Copy**, **Copy original**, and **Show original** buttons. Showing the original text lets you check that the OCR read it correctly.

### Preparing image translation (one time only)

The OCR engine (Tesseract.js) and the Bangla/English language data live inside the extension, so your images are never sent anywhere. The files are separate and must be downloaded once (needs Node 18+ and internet):

```
cd your-extension-folder
node setup-ocr.js
```

Then reload the extension in `chrome://extensions`. If some file fails to download, the script prints its link; open it in your browser and put the file into the `ocr/` folder (language files go into `ocr/lang/`). Required files: `tesseract.min.js`, `worker.min.js`, the four `tesseract-core*.wasm.js` files, `ben.traineddata`, and `eng.traineddata`.

- Works well on clean printed text (screenshots, posters, banners). Blurry, curved, or very decorative Bangla fonts may produce mistakes. English is more accurate.
- Only Bangla and English can be read. Other scripts will not be read correctly.
- The first read takes longer because the engine starts up; later reads are faster.
- Light text on a dark background is inverted automatically before reading.
- Only the part of the page currently visible can be selected. Translation needs Chrome 138+ and the translation models, as above.
- It does not work on `chrome://` pages, the Chrome Web Store, or Chrome's PDF viewer.

## Translate on select

Select any text on a page with the mouse to see its translation. In the popup's "Translate on select" section choose one of two modes:

| Mode | What happens |
|---|---|
| **On icon click** | A 🌐 icon floats beside the selection. Click it to open the translation card |
| **Instantly** | The translation card opens as soon as you select text |

- The source language is detected automatically. You choose the target language in the popup (default Bangla). If the text is already in that language, it is translated to English or Bangla instead.
- The card has a **Copy** button. For text inside a text field there is also an **Insert into text** button.
- Close the card by clicking outside, pressing `Esc`, or pressing ×. Untick the box in the popup to turn the whole feature off.
- If the model for a language pair has not been downloaded, it downloads the first time (the card shows the percentage). If it fails, press "Try again" on the card.
- Up to about 3000 characters are translated at once. It does not work in password fields. It works only on regular Chrome pages.
- Alt + C translates inside text fields (Bangla ↔ English, other languages → Bangla); select-to-translate works for all languages.

## English Fix

- **Fix** checks English spelling and grammar. If a Gemini API key is configured, it tries the online advanced editor first; otherwise, or if the online request fails, it falls back to Chrome's local Proofreader when available.
- Summary and Tone features and their AI logic have been removed from this build.

## Voice commands

Say these in Bangla mode:

| Say | Types |
|---|---|
| দাঁড়ি (dari) | । |
| কমা (koma) | , |
| প্রশ্নবোধক চিহ্ন | ? |
| বিস্ময়সূচক চিহ্ন | ! |
| কোলন / সেমিকোলন | : / ; |
| হাইফেন / ড্যাশ | - |
| নতুন লাইন | Enter |
| নতুন অনুচ্ছেদ | blank line between paragraphs |

English mode (Alt + Z) uses English commands: `period`, `comma`, `question mark`, `exclamation mark`, `colon`, `semicolon`, `hyphen`, `new line`, `new paragraph`. For example, saying "hello comma how are you question mark" types `hello, how are you?`.

Command words become symbols even in normal sentences (for example "time period"). If that bothers you, turn off voice commands in the popup.

## Custom word corrections

Write words that are often misheard into the popup list, one per line, as `wrong = correct`:

```
মিটিং = meeting
গিটহাব = GitHub
# lines starting with # are comments
```

Only whole words are replaced, not parts of words. The list syncs with your Chrome account (up to about 2500 characters). These corrections apply to voice typing only, not to phonetic typing.

## Tips for better accuracy

- The speech engine returns several possible readings for each phrase. If you have a correction list, the extension picks the reading that matches the most words from the list (either side, and partial matches count, for example মিটিং ~ মিটিংয়ে). With an empty list, the engine's first choice is used. So add words that are often wrong.
- Use a good microphone and speak in a quiet place.
- Speak clearly with small pauses. Very fast speech or whispering increases mistakes.
- English words in the middle of a Bangla sentence can be misheard. The correction list helps here.
- Accuracy depends on Google's speech engine. The extension cannot guarantee 100% accuracy.

## Limitations

- Works only in Google Chrome (and Chromium-based browsers that have Google's speech service enabled).
- Voice typing needs internet, because speech recognition happens on Google's servers. Phonetic typing works offline.
- The site must use `https` for the microphone (on `http` sites other than `localhost`, microphone permission is not granted).
- May not work in custom editors such as Google Docs (which does not use a normal text field). Find and Replace (Ctrl + F / Alt + A) deliberately leaves Google Docs and code editors alone.
- Find and Replace needs the cursor inside a text box that has text, and it highlights only matches inside that one box, not the whole page.
- Voice typing may not work in text fields inside other frames (iframes); phonetic typing does.
- Intentionally does not work in password fields.
- The extension does not run on `chrome://` pages or the Chrome Web Store.

## Troubleshooting

| Problem | Fix |
|---|---|
| The button is not visible | Reload the page; check that "Show the floating mic button on pages" is on in the popup |
| "Microphone permission is denied" | Click the icon on the left of the address bar, set Microphone to Allow, then reload the page |
| Nothing is typed | Click in the text field so the cursor is there, then start the mic; check Chrome's system microphone setting |
| Alt + X / Z / C / V do not work | Open `chrome://extensions/shortcuts` and set them yourself (after a reload, new shortcuts may not be assigned automatically) |
| Alt + B does nothing | Reload the page once. Alt + B works only on regular web pages (not `chrome://` pages); it is handled inside the page, so it is not listed in Chrome's shortcut settings and cannot be changed there. The popup checkbox always works |
| Phonetic typing does nothing | Tick "Phonetic typing" in the popup (or press Alt + B), then reload the page once. It does not work in password fields or on `chrome://` pages |
| A word became Bangla but I wanted English | Press Backspace right after it, or turn phonetic typing off with Alt + B |
| Alt + C says the model is not downloaded | Open the popup, press "Prepare translation models", and keep the popup open until 100% |
| Alt + C says the translation API is missing | Update Chrome (138+) and try on an https page |
| The card has no Fix tab | Chrome's Proofreader API may not be available. Check Chrome version and AI feature availability. Summary and Tone are intentionally removed in this build. |

| Alt + V says the image-reading files are not installed | Run `node setup-ocr.js`, then reload the extension |
| Alt + V says it could not capture the image | Reload the page and press Alt + V again (does not work on `chrome://` pages or the Web Store) |
| It listens to the wrong language | Choose `Bangla (Bangladesh)` in the popup |

## Files

- `manifest.json`: the extension declaration
- `content.js`: mic button, voice recognition, text insertion, Alt + C translate
- `phonetic-dict.js`: built-in list of common words and their correct spellings (shown first in the suggestion list)
- `bn-words.js`: big frequency-ranked Bangla word list (made by `build-wordlist.js`)
- `build-wordlist.js`: script that builds `bn-words.js` from a frequency list or Bangla text
- `bn-ngrams.js`: word-pair (bigram/trigram) counts for next-word suggestions (made by `build-ngrams.js` from `ngram-seed.txt` and any text you add)
- `build-ngrams.js`, `ngram-seed.txt`: builder script and the hand-written seed sentences
- `ngram-tests/test-ngram.js`: Node tests for the word-pair logic (`node ngram-tests/test-ngram.js`)
- `phonetic-lib.js`: the phonetic letter-mapping engine (no DOM, can be tested with Node)
- `phonetic-typing.js`: phonetic typing in the page: spelling suggestion list, conversion on Space, Backspace to undo
- `spell-lib.js`: Bangla spell check engine: finds words that are not in `bn-words.js` (no DOM, can be tested with Node)
- `spellcheck.js`: draws the wavy red lines in text boxes and rich editors (setting `spellBn`)
- `spell-tests/test-spell.js`: Node tests for `spell-lib.js` (`node spell-tests/test-spell.js`)
- `selection-translate.js`: translate on select (icon and card with Translate / Fix tabs)
- `ai-tools.js`: English Proofreader and optional online Advanced Fix
- `ai-tests/test-ai.js`: Node tests for `ai-tools.js` (`node ai-tests/test-ai.js`)
- `image-translate.js`: image text translation (Alt + V): box selection and translation card
- `palette.js`: command palette (Ctrl + K): search box for features, settings, tab actions and open tabs
- `screenshot.js`: screenshot (Alt + S): area selection, full-page capture, markup editor card, HD copy/save, text reading (📝 Text), history panel
- `recorder.html`, `recorder.css`, `recorder.js`: screen recorder (WebM, optional microphone)
- `text-expander.js`: text expander: short codes to full text in any text box
- `find-lib.js`: Find and Replace engine: Bangla-aware matching, whole word, regular expressions, case keeping (no DOM, can be tested with Node)
- `find-replace.js`: the Ctrl + F / Alt + A panel in text boxes and rich editors, match highlighting, replacing (setting `frEnabled`)
- `find-tests/test-find.js`: Node tests for `find-lib.js` (`node find-tests/test-find.js`)
- `imagetools.html`, `imagetools.js`, `imagetools.css`, `image-lib.js`: Image tools page (compress, resize, convert, PDF); the logic in `image-lib.js` is tested with `node image-tests/test-image.js` (needs Python with Pillow and pypdf, and qpdf)
- `offscreen.html`, `offscreen.js`: reading text from images (Tesseract.js, OCR)
- `setup-ocr.js`: script that downloads the OCR files
- `ocr/`: OCR engine and Bangla/English language data (filled by `setup-ocr.js`)
- `lib.js`: text processing for commands and word corrections, and language detection (Language Detector + fallback)
- `background.js`: Alt + X / Z / C / V shortcuts, taking the screenshot for images, screenshot history storage, opening the recorder window, listing/switching tabs and running tab actions for the command palette
- `popup.html`, `popup.css`, `popup.js`: the settings popup and the button that prepares translation models

## Privacy

Your voice goes through Chrome to Google's speech service. Translation, local spelling and grammar fixes, image reading and phonetic typing happen on your own computer. If you configure Gemini for Advanced Fix, selected English text is sent to Google's AI service. The extension itself does not store any audio or text, and sends nothing to third-party servers. Only your settings, word-correction list and screenshot history (if you keep it on) are saved in the browser. Screen recordings are saved only as a file in your Downloads folder when you stop.
