/* Bangla Voice Typing: mark an area of the page, then record only that area.
 * Shows a screenshot-style overlay (drag, move, resize). The chosen box is
 * sent to the background script; recorder.js crops the tab video to it. */
(() => {
  'use strict';
  if (window.__bvtRecordRegion) return;
  window.__bvtRecordRegion = true;

  const MIN = 40;
  let host = null;
  let teardown = null;

  const css = `
    :host{all:initial}
    *{box-sizing:border-box}
    .layer{position:fixed;inset:0;cursor:crosshair;user-select:none;-webkit-user-select:none;
      font:13px/1.4 "Segoe UI",system-ui,"Noto Sans Bengali","Nirmala UI",sans-serif;color:#E9EDF9}
    .dim{position:absolute;inset:0;background:rgba(6,9,18,.55)}
    .hint{position:absolute;left:50%;top:18px;transform:translateX(-50%);padding:9px 14px;border-radius:12px;
      background:#121729;border:1px solid #232A44;box-shadow:0 10px 30px -10px rgba(0,0,0,.6);white-space:nowrap}
    .hint b{color:#7C93FF}
    .sel{position:absolute;display:none;border:2px solid #7C93FF;border-radius:2px;cursor:move;
      box-shadow:0 0 0 100vmax rgba(6,9,18,.55)}
    .size{position:absolute;left:-2px;top:-26px;padding:2px 8px;border-radius:7px;background:#7C93FF;color:#0A0E1A;
      font-weight:700;font-size:11.5px;white-space:nowrap}
    .h{position:absolute;width:12px;height:12px;margin:-6px 0 0 -6px;border-radius:50%;background:#7C93FF;border:2px solid #0A0E1A}
    .bar{position:absolute;display:none;gap:6px;padding:6px;border-radius:14px;background:#121729;border:1px solid #232A44;
      box-shadow:0 14px 34px -12px rgba(0,0,0,.7);cursor:default;white-space:nowrap}
    .bar button{font:inherit;font-weight:600;padding:8px 12px;border-radius:10px;border:1px solid #232A44;background:#1B2240;
      color:#E9EDF9;cursor:pointer}
    .bar button:hover{border-color:#7C93FF}
    .bar button.go{background:#FF6B6B;border-color:#FF6B6B;color:#fff}
    .bar button.ghost{background:transparent;color:#8992B3}
    .bar button:focus-visible{outline:2px solid #7C93FF;outline-offset:2px}
  `;

  const HANDLES = {
    nw: [0, 0, 'nwse-resize'], n: [50, 0, 'ns-resize'], ne: [100, 0, 'nesw-resize'], e: [100, 50, 'ew-resize'],
    se: [100, 100, 'nwse-resize'], s: [50, 100, 'ns-resize'], sw: [0, 100, 'nesw-resize'], w: [0, 50, 'ew-resize'],
  };

  function open() {
    host = document.createElement('bvt-record-region');
    host.style.cssText = 'all:initial;position:fixed;inset:0;z-index:2147483647;';
    const root = host.attachShadow({ mode: 'closed' });
    root.innerHTML =
      '<style>' + css + '</style>' +
      '<div class="layer"><div class="dim"></div>' +
      '<div class="hint">Drag to mark the area to record. <b>Enter</b> starts, <b>Esc</b> cancels.</div>' +
      '<div class="sel"><div class="size"></div>' +
      Object.keys(HANDLES).map((k) => '<div class="h" data-h="' + k + '" style="left:' + HANDLES[k][0] + '%;top:' + HANDLES[k][1] + '%;cursor:' + HANDLES[k][2] + '"></div>').join('') +
      '</div>' +
      '<div class="bar"><button class="go" data-a="region" type="button">● Record this area</button>' +
      '<button data-a="tab" type="button">Whole tab</button>' +
      '<button data-a="other" type="button">Screen or window…</button>' +
      '<button class="ghost" data-a="cancel" type="button">Cancel</button></div></div>';

    const layer = root.querySelector('.layer');
    const dim = root.querySelector('.dim');
    const hint = root.querySelector('.hint');
    const sel = root.querySelector('.sel');
    const size = root.querySelector('.size');
    const bar = root.querySelector('.bar');

    let rect = null;
    let drag = null;
    const vw = () => window.innerWidth;
    const vh = () => window.innerHeight;
    const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

    function paint() {
      const has = rect && rect.w > 0 && rect.h > 0;
      dim.style.display = has ? 'none' : 'block';
      hint.style.display = has ? 'none' : 'block';
      sel.style.display = has ? 'block' : 'none';
      if (!has) { bar.style.display = 'none'; return; }
      sel.style.left = rect.x + 'px';
      sel.style.top = rect.y + 'px';
      sel.style.width = rect.w + 'px';
      sel.style.height = rect.h + 'px';
      size.textContent = Math.round(rect.w) + ' × ' + Math.round(rect.h);
      size.style.top = rect.y < 30 ? 'auto' : '-26px';
      size.style.bottom = rect.y < 30 ? '-26px' : 'auto';
      const ready = !drag && rect.w >= MIN && rect.h >= MIN;
      bar.style.display = ready ? 'flex' : 'none';
      if (ready) {
        const bw = bar.offsetWidth;
        const bh = bar.offsetHeight;
        let top = rect.y + rect.h + 12;
        if (top + bh > vh() - 8) top = rect.y - bh - 12 - 22;
        if (top < 8) top = clamp(rect.y + rect.h - bh - 12, 8, vh() - bh - 8);
        bar.style.top = top + 'px';
        bar.style.left = clamp(rect.x + rect.w / 2 - bw / 2, 8, vw() - bw - 8) + 'px';
      }
    }

    layer.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || e.target.closest('.bar')) return;
      e.preventDefault();
      layer.setPointerCapture(e.pointerId);
      const hd = e.target.dataset && e.target.dataset.h;
      const inside = rect && e.clientX >= rect.x && e.clientX <= rect.x + rect.w && e.clientY >= rect.y && e.clientY <= rect.y + rect.h;
      if (hd) drag = { mode: hd, sx: e.clientX, sy: e.clientY, o: { ...rect } };
      else if (inside) drag = { mode: 'move', sx: e.clientX, sy: e.clientY, o: { ...rect } };
      else {
        drag = { mode: 'new', sx: clamp(e.clientX, 0, vw()), sy: clamp(e.clientY, 0, vh()) };
        rect = { x: drag.sx, y: drag.sy, w: 0, h: 0 };
      }
      paint();
    });

    layer.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.sx;
      const dy = e.clientY - drag.sy;
      if (drag.mode === 'new') {
        const x2 = clamp(e.clientX, 0, vw());
        const y2 = clamp(e.clientY, 0, vh());
        rect = { x: Math.min(drag.sx, x2), y: Math.min(drag.sy, y2), w: Math.abs(x2 - drag.sx), h: Math.abs(y2 - drag.sy) };
      } else if (drag.mode === 'move') {
        rect = { ...drag.o, x: clamp(drag.o.x + dx, 0, vw() - drag.o.w), y: clamp(drag.o.y + dy, 0, vh() - drag.o.h) };
      } else {
        let l = drag.o.x, t = drag.o.y, r = drag.o.x + drag.o.w, b = drag.o.y + drag.o.h;
        if (drag.mode.includes('w')) l = clamp(drag.o.x + dx, 0, r - MIN);
        if (drag.mode.includes('e')) r = clamp(drag.o.x + drag.o.w + dx, l + MIN, vw());
        if (drag.mode.includes('n')) t = clamp(drag.o.y + dy, 0, b - MIN);
        if (drag.mode.includes('s')) b = clamp(drag.o.y + drag.o.h + dy, t + MIN, vh());
        rect = { x: l, y: t, w: r - l, h: b - t };
      }
      paint();
    });

    const endDrag = () => {
      if (!drag) return;
      const was = drag.mode;
      drag = null;
      if (was === 'new' && rect && (rect.w < MIN || rect.h < MIN)) rect = null;
      paint();
    };
    layer.addEventListener('pointerup', endDrag);
    layer.addEventListener('pointercancel', endDrag);

    const even = (n) => Math.max(0, Math.round(n / 2) * 2);
    function go(action) {
      if (action === 'cancel') return close();
      if (action === 'other') { close(); chrome.runtime.sendMessage({ type: 'bvt-open-recorder' }).catch(() => {}); return; }
      let r;
      if (action === 'tab') r = { x: 0, y: 0, w: vw(), h: vh() };
      else if (rect && rect.w >= MIN && rect.h >= MIN) r = { x: even(rect.x), y: even(rect.y), w: even(rect.w), h: even(rect.h) };
      else return;
      const payload = { type: 'bvt-record-region-go', rect: r, vw: vw(), vh: vh(), dpr: window.devicePixelRatio || 1 };
      close();
      // wait two frames so the overlay is gone before capture begins
      requestAnimationFrame(() => requestAnimationFrame(() => {
        chrome.runtime.sendMessage(payload).catch(() => {});
      }));
    }

    bar.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (b) go(b.dataset.a);
    });

    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
      else if (e.key === 'Enter' && rect) { e.preventDefault(); e.stopPropagation(); go('region'); }
    };
    window.addEventListener('keydown', onKey, true);
    const onResize = () => { rect = null; paint(); };
    window.addEventListener('resize', onResize);
    teardown = () => {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('resize', onResize);
    };

    (document.documentElement || document.body).appendChild(host);
    paint();
    const first = bar.querySelector('button');
    if (first) first.tabIndex = 0;
  }

  function close() {
    if (teardown) teardown();
    teardown = null;
    if (host) host.remove();
    host = null;
  }

  try {
    chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
      if (msg && msg.type === 'record-region') {
        if (host) close();
        else open();
        sendResponse({ ok: true });
      }
    });
  } catch (_) {
    // extension reloaded: reload the page once
  }
})();
