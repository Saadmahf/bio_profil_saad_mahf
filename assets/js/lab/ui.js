/* =====================================================================
   LAB UI — reusable canvas/SVG components:
   Scope, Spectrum, Arch (interactive architecture), Car, Motor, loop helper
   ===================================================================== */
window.UI = (function () {
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const NS = 'http://www.w3.org/2000/svg';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const themeCbs = [];
  function onTheme(cb) { themeCbs.push(cb); }
  document.addEventListener('themechange', () => themeCbs.forEach(f => f()));
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => themeCbs.forEach(f => f()));
  function el(tag, attrs, parent) { const n = document.createElementNS(NS, tag); for (const k in attrs) n.setAttribute(k, attrs[k]); if (parent) parent.appendChild(n); return n; }
  function h(tag, attrs, html) { const n = document.createElement(tag); if (attrs) for (const k in attrs) { if (k === 'class') n.className = attrs[k]; else n.setAttribute(k, attrs[k]); } if (html != null) n.innerHTML = html; return n; }
  const fmt = (v, d = 1) => (v == null || !isFinite(v)) ? '—' : (+v).toFixed(d);
  const fmtF = f => f >= 1000 ? (f / 1000).toFixed(f >= 10000 ? 0 : 1) + ' k' : f.toFixed(0) + ' ';

  /* canvas with device-pixel-ratio handling */
  function canvas(host, hpx) {
    const c = document.createElement('canvas'); c.style.width = '100%'; c.style.height = hpx + 'px'; c.style.display = 'block';
    host.appendChild(c); const ctx = c.getContext('2d');
    function fit() { const r = c.getBoundingClientRect(), d = Math.min(2, devicePixelRatio || 1); const w = Math.max(10, r.width); c.width = w * d; c.height = hpx * d; ctx.setTransform(d, 0, 0, d, 0, 0); return { w, h: hpx }; }
    return { c, ctx, fit };
  }

  /* visible-only animation loop */
  function loop(host, fn) {
    let vis = true, last = performance.now(), running = true;
    if ('IntersectionObserver' in window) new IntersectionObserver(es => es.forEach(e => vis = e.isIntersecting), { rootMargin: '120px' }).observe(host);
    function f(now) { const dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = now; if (vis && running) fn(dt, now); requestAnimationFrame(f); }
    requestAnimationFrame(f);
    return { pause() { running = false; }, play() { running = true; last = performance.now(); }, get running() { return running; } };
  }

  /* ---------------- Scope ----------------
     lanes: [{name, h (rel), chans:[{key,label,color,unit,digital}]}] */
  function Scope(host, o) {
    host.classList.add('scope');
    const head = h('div', { class: 'scope-h' });
    const chips = h('div', { class: 'scope-chips' });
    const ctl = h('div', { class: 'scope-ctl' },
      `<button type="button" class="iconbtn" data-a="pause" aria-label="Pause">❚❚</button>
       <button type="button" class="iconbtn" data-a="out" aria-label="Zoom out">−</button>
       <button type="button" class="iconbtn" data-a="in" aria-label="Zoom in">+</button>
       <button type="button" class="iconbtn" data-a="reset" aria-label="Reset view">↺</button>`);
    head.append(chips, ctl); host.appendChild(head);
    const cv = canvas(host, o.height || 260);
    const foot = h('div', { class: 'scope-f mono' }); host.appendChild(foot);
    const st = { paused: false, zoom: 1, off: 0, hidden: new Set(o.hidden || []), data: null };
    o.lanes.forEach(L => L.chans.forEach(ch => {
      const b = h('button', { type: 'button', class: 'chipbtn', 'aria-pressed': !st.hidden.has(ch.key) }, `<i></i>${ch.label}`);
      b.querySelector('i').dataset.c = ch.color;
      b.onclick = () => { st.hidden.has(ch.key) ? st.hidden.delete(ch.key) : st.hidden.add(ch.key); b.setAttribute('aria-pressed', !st.hidden.has(ch.key)); draw(); };
      chips.appendChild(b);
    }));
    function paintChips() { chips.querySelectorAll('i').forEach(i => i.style.background = css(i.dataset.c)); }
    ctl.onclick = e => {
      const a = e.target.closest('button')?.dataset.a; if (!a) return;
      if (a === 'pause') { st.paused = !st.paused; e.target.textContent = st.paused ? '▶' : '❚❚'; }
      if (a === 'in') st.zoom = Math.min(64, st.zoom * 2);
      if (a === 'out') st.zoom = Math.max(1, st.zoom / 2);
      if (a === 'reset') { st.zoom = 1; st.off = 0; }
      draw();
    };
    // drag to pan when zoomed
    let drag = null;
    cv.c.addEventListener('pointerdown', e => { drag = { x: e.clientX, off: st.off }; cv.c.setPointerCapture(e.pointerId); });
    cv.c.addEventListener('pointermove', e => { if (!drag) return; const w = cv.c.getBoundingClientRect().width; st.off = Math.max(0, Math.min(1 - 1 / st.zoom, drag.off - (e.clientX - drag.x) / w / st.zoom)); draw(); });
    cv.c.addEventListener('pointerup', () => drag = null);
    function draw() {
      if (!st.data) return;
      const { w, h: H } = cv.fit(), ctx = cv.ctx; ctx.clearRect(0, 0, w, H);
      const { t, s } = st.data, N = t.length;
      const i0 = Math.floor(st.off * N), i1 = Math.min(N, i0 + Math.ceil(N / st.zoom));
      const L = o.lanes.filter(l => l.chans.some(c => !st.hidden.has(c.key)));
      const tot = L.reduce((a, l) => a + (l.h || 1), 0); let y0 = 4;
      const ml = 46, mr = 8, pw = w - ml - mr;
      ctx.font = '10px ' + css('--f-mono'); ctx.lineWidth = 1;
      L.forEach(lane => {
        const lh = (H - 22) * (lane.h || 1) / tot;
        const ch = lane.chans.filter(c => !st.hidden.has(c.key) && s[c.key]);
        let mn = Infinity, mx = -Infinity;
        ch.forEach(c => { const a = s[c.key]; for (let i = i0; i < i1; i++) { if (a[i] < mn) mn = a[i]; if (a[i] > mx) mx = a[i]; } });
        if (lane.min != null) mn = Math.min(mn, lane.min); if (lane.max != null) mx = Math.max(mx, lane.max);
        if (lane.sym) { const m = Math.max(Math.abs(mn), Math.abs(mx)); mn = -m; mx = m; }
        if (!(mx > mn)) { mx = mn + 1; mn -= 1; }
        const pad = (mx - mn) * 0.08; mn -= pad; mx += pad;
        const Y = v => y0 + lh - 4 - (v - mn) / (mx - mn) * (lh - 8);
        ctx.strokeStyle = css('--line'); ctx.beginPath(); ctx.moveTo(ml, y0 + lh - 1); ctx.lineTo(w - mr, y0 + lh - 1); ctx.stroke();
        if (mn < 0 && mx > 0) { ctx.strokeStyle = css('--grid'); ctx.beginPath(); ctx.moveTo(ml, Y(0)); ctx.lineTo(w - mr, Y(0)); ctx.stroke(); }
        ctx.fillStyle = css('--muted'); ctx.textAlign = 'right';
        ctx.fillText(fmtNum(mx - pad), ml - 5, y0 + 10); ctx.fillText(fmtNum(mn + pad), ml - 5, y0 + lh - 6);
        ctx.textAlign = 'left'; ctx.fillText(lane.name, ml + 4, y0 + 10);
        ch.forEach((c, ci) => {
          const a = s[c.key]; ctx.strokeStyle = css(c.color); ctx.lineWidth = c.width || 1.3; ctx.beginPath();
          const span = i1 - i0;
          if (span <= pw * 2) { for (let i = i0; i < i1; i++) { const x = ml + (i - i0) / (span - 1) * pw; i === i0 ? ctx.moveTo(x, Y(a[i])) : ctx.lineTo(x, Y(a[i])); } }
          else { for (let px = 0; px < pw; px++) { const j0 = i0 + Math.floor(px / pw * span), j1 = i0 + Math.floor((px + 1) / pw * span); let lo = Infinity, hi = -Infinity; for (let j = j0; j < Math.max(j1, j0 + 1); j++) { const v = a[j]; if (v < lo) lo = v; if (v > hi) hi = v; } const x = ml + px; if (px === 0) ctx.moveTo(x, Y(a[j0])); ctx.lineTo(x, Y(lo)); ctx.lineTo(x, Y(hi)); } }
          ctx.stroke();
        });
        y0 += lh;
      });
      // time axis
      const tspan = t[i1 - 1] - t[i0];
      ctx.fillStyle = css('--muted'); ctx.textAlign = 'left'; ctx.fillText(fmtT(t[i0]), ml, H - 6); ctx.textAlign = 'right'; ctx.fillText(fmtT(t[i1 - 1]), w - mr, H - 6);
      ctx.textAlign = 'center'; ctx.fillText('window ' + fmtT(tspan) + (st.zoom > 1 ? '  ·  drag to pan' : ''), ml + pw / 2, H - 6);
    }
    function fmtNum(v) { const a = Math.abs(v); return a >= 1000 ? (v / 1000).toFixed(1) + 'k' : a >= 100 ? v.toFixed(0) : a >= 10 ? v.toFixed(1) : v.toFixed(2); }
    function fmtT(s) { return s >= 1 ? s.toFixed(2) + ' s' : s >= 1e-3 ? (s * 1e3).toFixed(s >= 0.01 ? 1 : 2) + ' ms' : (s * 1e6).toFixed(0) + ' µs'; }
    paintChips(); onTheme(() => { paintChips(); draw(); }); addEventListener('resize', draw);
    return {
      set(t, s, footer) { if (st.paused) return; st.data = { t, s }; if (footer != null) foot.innerHTML = footer; draw(); },
      get paused() { return st.paused; }, draw
    };
  }

  /* ---------------- Spectrum ---------------- */
  function Spectrum(host, o) {
    o = o || {};
    host.classList.add('scope');
    const head = h('div', { class: 'scope-h' });
    const sel = h('div', { class: 'seg', role: 'group', 'aria-label': 'Frequency span' });
    (o.spans || [2000, 20000, 50000, 200000]).forEach((f, k) => { const b = h('button', { type: 'button', 'aria-pressed': k === (o.spanIdx ?? 2) }, (f >= 1000 ? f / 1000 + ' kHz' : f + ' Hz')); b.onclick = () => { st.fmax = f; sel.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b)); draw(); }; sel.appendChild(b); });
    const logb = h('button', { type: 'button', class: 'iconbtn', 'aria-pressed': 'false' }, 'log');
    logb.onclick = () => { st.log = !st.log; logb.setAttribute('aria-pressed', st.log); draw(); };
    head.append(h('span', { class: 'mono muted', style: 'font-size:.72rem' }, o.title || 'FFT · amplitude'), h('div', { style: 'display:flex;gap:6px;align-items:center' }), sel);
    head.lastChild.previousSibling.appendChild(logb); host.appendChild(head);
    const cv = canvas(host, o.height || 200);
    const st = { fmax: (o.spans || [2000, 20000, 50000, 200000])[o.spanIdx ?? 2], log: false, sp: null, extra: {} };
    function draw() {
      if (!st.sp) return; const { w, h: H } = cv.fit(), ctx = cv.ctx; ctx.clearRect(0, 0, w, H);
      const { f, A } = st.sp, ml = 46, mr = 8, pw = w - ml - mr, ph = H - 30;
      let kmax = 1; while (kmax < f.length && f[kmax] <= st.fmax) kmax++;
      let amax = 1e-9; for (let k = 1; k < kmax; k++) amax = Math.max(amax, A[k]);
      if (st.extra.threshold) amax = Math.max(amax, st.extra.threshold * 1.15);
      const lmin = Math.log10(amax) - 4;
      const Y = a => st.log ? 6 + ph - (Math.max(lmin, Math.log10(Math.max(a, 1e-12))) - lmin) / (Math.log10(amax) - lmin) * ph : 6 + ph - a / amax * ph;
      const X = fr => ml + fr / st.fmax * pw;
      ctx.font = '10px ' + css('--f-mono');
      ctx.strokeStyle = css('--line'); ctx.beginPath(); ctx.moveTo(ml, 6 + ph); ctx.lineTo(w - mr, 6 + ph); ctx.stroke();
      ctx.fillStyle = css('--muted'); ctx.textAlign = 'center';
      for (let q = 0; q <= 4; q++) ctx.fillText(fmtF(st.fmax * q / 4) + 'Hz', ml + pw * q / 4, H - 8);
      ctx.textAlign = 'right'; ctx.fillText(amax.toPrecision(2), ml - 5, 14); ctx.fillText(st.log ? (10 ** lmin).toExponential(0) : '0', ml - 5, 6 + ph);
      (st.extra.markers || []).forEach(m => { if (m.f > st.fmax) return; ctx.strokeStyle = css(m.color || '--violet'); ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(X(m.f), 6); ctx.lineTo(X(m.f), 6 + ph); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = css(m.color || '--violet'); ctx.textAlign = 'left'; ctx.fillText(m.label, X(m.f) + 3, 16); });
      if (st.extra.threshold) { ctx.strokeStyle = css('--bad'); ctx.setLineDash([6, 4]); ctx.beginPath(); ctx.moveTo(ml, Y(st.extra.threshold)); ctx.lineTo(w - mr, Y(st.extra.threshold)); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = css('--bad'); ctx.textAlign = 'right'; ctx.fillText(st.extra.thLabel || 'illustrative limit', w - mr, Y(st.extra.threshold) - 4); }
      // bars as envelope per pixel
      ctx.strokeStyle = css(o.color || '--hv'); ctx.lineWidth = 1.2; ctx.beginPath();
      for (let px = 0; px < pw; px++) { const k0 = Math.max(1, Math.floor(px / pw * kmax)), k1 = Math.max(k0 + 1, Math.floor((px + 1) / pw * kmax)); let a = 0; for (let k = k0; k < k1 && k < A.length; k++) a = Math.max(a, A[k]); ctx.moveTo(ml + px + .5, 6 + ph); ctx.lineTo(ml + px + .5, Y(a)); }
      ctx.stroke();
      (st.extra.peaks || []).filter(p => p.f <= st.fmax).slice(0, 4).forEach((p, i) => { ctx.fillStyle = css('--ink'); ctx.textAlign = 'center'; ctx.fillText(fmtF(p.f) + 'Hz', X(p.f), Math.max(12, Y(p.a) - 6 - (i % 2) * 11)); });
    }
    onTheme(draw); addEventListener('resize', draw);
    return { set(sp, extra) { st.sp = sp; st.extra = extra || {}; draw(); }, draw };
  }

  /* ---------------- Interactive architecture diagram ----------------
     spec: {w,h, nodes:[{id,x,y,w,h,t,s,kind}], edges:[{id,d,type,label,lx,ly}], info:{id:html}} */
  const EDGE = {
    hv:   { color: '--hv',     w: 3.2, dash: '',        flow: '6 10' },
    lv:   { color: '--sig',    w: 1.6, dash: '5 4',     flow: '3 9' },
    can:  { color: '--violet', w: 2.2, dash: '1 4 8 4', flow: '2 10' },
    mech: { color: '--muted',  w: 4,   dash: '',        flow: '10 8' },
    sig:  { color: '--ink',    w: 1.4, dash: '',        flow: '3 9' },
    th:   { color: '--warn',   w: 2.6, dash: '',        flow: '6 8' }
  };
  function Arch(host, spec, panel) {
    host.classList.add('arch');
    const svg = el('svg', { viewBox: `0 0 ${spec.w} ${spec.h}`, class: 'chart archsvg', role: 'img', 'aria-label': spec.title || 'architecture' });
    host.appendChild(svg);
    const R = { n: {}, e: {} }; let sel = null;
    function build() {
      svg.innerHTML = '';
      const defs = el('defs', {}, svg);
      Object.keys(EDGE).forEach(k => { const m = el('marker', { id: 'ah-' + k + spec.uid, viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto-start-reverse' }, defs); el('path', { d: 'M0 0L10 5L0 10z', fill: css(EDGE[k].color) }, m); });
      (spec.groups || []).forEach(g => { el('rect', { x: g.x, y: g.y, width: g.w, height: g.h, rx: 12, fill: 'none', stroke: css('--line'), 'stroke-dasharray': '5 5' }, svg); const t = el('text', { x: g.x + 10, y: g.y + 16 }, svg); t.textContent = g.t; t.style.font = '600 10px ' + css('--f-mono'); t.style.fill = css('--muted'); });
      spec.edges.forEach(e => {
        const S = EDGE[e.type];
        const base = el('path', { d: e.d, fill: 'none', stroke: css(S.color), 'stroke-width': S.w, 'stroke-dasharray': S.dash, opacity: .45, 'marker-end': e.arrow === false ? '' : `url(#ah-${e.type}${spec.uid})`, 'stroke-linejoin': 'round' }, svg);
        const fl = el('path', { d: e.d, fill: 'none', stroke: css(S.color), 'stroke-width': S.w, 'stroke-dasharray': S.flow, class: 'flowx', opacity: 0, 'stroke-linecap': 'round' }, svg);
        let lab = null; if (e.label) { lab = el('text', { x: e.lx, y: e.ly, 'text-anchor': e.anchor || 'middle' }, svg); lab.textContent = e.label; lab.style.font = '500 10px ' + css('--f-mono'); lab.style.fill = css(S.color === '--ink' ? '--muted' : S.color); }
        R.e[e.id] = { base, fl, lab, e, rate: R.e[e.id]?.rate || 0 };
      });
      spec.nodes.forEach(n => {
        const g = el('g', { tabindex: 0, role: 'button', 'aria-label': n.t, class: 'anode' }, svg);
        const fill = n.kind === 'hv' ? css('--hv-soft') : n.kind === 'ctrl' ? css('--sig-soft') : n.kind === 'can' ? 'color-mix(in srgb,' + css('--violet') + ' 18%,' + css('--surface') + ')' : css('--surface');
        const stroke = n.kind === 'hv' ? css('--hv') : n.kind === 'ctrl' ? css('--sig') : n.kind === 'can' ? css('--violet') : css('--ink');
        const r = el('rect', { x: n.x, y: n.y, width: n.w, height: n.h, rx: 8, fill, stroke, 'stroke-width': 1.3 }, g);
        const t = el('text', { x: n.x + n.w / 2, y: n.y + (n.s ? n.h / 2 - 2 : n.h / 2 + 4), 'text-anchor': 'middle' }, g); t.textContent = n.t; t.style.font = '600 ' + (n.fs || 11.5) + 'px ' + css('--f-mono'); t.style.fill = css('--ink');
        let s = null; if (n.s != null) { s = el('text', { x: n.x + n.w / 2, y: n.y + n.h / 2 + 12, 'text-anchor': 'middle' }, g); s.textContent = n.s; s.style.font = '500 9.5px ' + css('--f-mono'); s.style.fill = css('--muted'); }
        const pick = () => { select(n.id); spec.onPick && spec.onPick(n.id); };
        g.addEventListener('click', pick); g.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); pick(); } });
        R.n[n.id] = { g, r, t, s, n, fill, stroke };
      });
      if (spec.legend !== false) {
        const types = [...new Set(spec.edges.map(e => e.type))]; let x = 8;
        const names = { hv: 'HV power', lv: 'LV signal', can: 'CAN', mech: 'mechanical', sig: 'control signal', th: 'thermal / fluid' };
        types.forEach(k => { const S = EDGE[k]; el('line', { x1: x, x2: x + 22, y1: spec.h - 8, y2: spec.h - 8, stroke: css(S.color), 'stroke-width': S.w, 'stroke-dasharray': S.dash }, svg); const t = el('text', { x: x + 27, y: spec.h - 4 }, svg); t.textContent = names[k]; t.style.font = '10px ' + css('--f-mono'); t.style.fill = css('--muted'); x += 34 + names[k].length * 6.4; });
      }
      Object.values(R.e).forEach(o => applyRate(o));
      if (sel) select(sel);
    }
    function applyRate(o) {
      const r = o.rate; o.fl.setAttribute('opacity', Math.abs(r) > 0.02 ? Math.min(1, .35 + Math.abs(r)) : 0);
      const dur = Math.max(0.25, 2.2 - 1.9 * Math.min(1, Math.abs(r)));
      o.fl.style.animationDuration = dur + 's'; o.fl.style.animationDirection = r < 0 ? 'reverse' : 'normal';
      if (reduce) o.fl.style.animation = 'none';
    }
    function select(id) {
      sel = id;
      Object.values(R.n).forEach(o => { o.r.setAttribute('stroke-width', o.n.id === id ? 3 : 1.3); });
      if (panel && spec.info) {
        const inf = spec.info[id]; if (!inf) return;
        panel.innerHTML = `<p class="eyebrow" style="margin-bottom:6px">${R.n[id].n.t}</p>${typeof inf === 'function' ? inf() : inf}`;
      }
    }
    build(); onTheme(build);
    return {
      flow(id, rate) { const o = R.e[id]; if (!o) return; if (Math.abs((o.rate || 0) - rate) < 0.03 && Math.sign(o.rate || 0) === Math.sign(rate)) return; o.rate = rate; applyRate(o); },
      val(id, text) { const o = R.n[id]; if (o && o.s && o.s.textContent !== text) o.s.textContent = text; },
      label(id, text) { const o = R.e[id]; if (o && o.lab && o.lab.textContent !== text) o.lab.textContent = text; },
      hi(id, on, color) { const o = R.n[id]; if (!o) return; o.r.setAttribute('fill', on ? (color ? css(color) : css('--hv')) : o.fill); o.t.style.fill = on ? '#fff' : css('--ink'); if (o.s) o.s.style.fill = on ? '#fff' : css('--muted'); },
      highlight(ids) { Object.values(R.n).forEach(o => o.g.style.opacity = !ids || ids.includes(o.n.id) ? 1 : .28); Object.values(R.e).forEach(o => o.base.style.opacity = !ids || (!o.e.on || o.e.on.some(i => ids.includes(i))) ? .45 : .1); },
      select, rebuild: build
    };
  }

  /* ---------------- Car scene ---------------- */
  function Car(host, o) {
    o = o || {};
    const cv = canvas(host, o.height || 170); let st = { v: 0, x: 0, P: 0, brake: 0, wheel: 0, label: '' };
    function draw() {
      const { w, h: H } = cv.fit(), ctx = cv.ctx; ctx.clearRect(0, 0, w, H);
      const ground = H - 26;
      // sky band & distance markers
      ctx.fillStyle = css('--sunk'); ctx.fillRect(0, ground, w, 26);
      ctx.strokeStyle = css('--muted'); ctx.lineWidth = 2; ctx.setLineDash([22, 18]); ctx.lineDashOffset = (st.x * 30) % 40; ctx.beginPath(); ctx.moveTo(0, ground + 13); ctx.lineTo(w, ground + 13); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = css('--muted'); ctx.font = '10px ' + css('--f-mono');
      const m50 = 50, pxm = 30; const first = Math.floor((st.x - w / 2 / pxm) / m50) * m50;
      for (let d = first; d < st.x + w / pxm; d += m50) { const X = w * 0.42 + (d - st.x) * pxm; if (X < -40 || X > w + 40) continue; ctx.fillRect(X, ground - 18, 2, 18); ctx.fillText(d + ' m', X + 4, ground - 8); }
      // car body
      const cx = w * 0.42, L = Math.min(260, w * 0.5), bh = 34, by = ground - 22 - bh;
      ctx.fillStyle = css('--surface'); ctx.strokeStyle = css('--ink'); ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(cx - L / 2, by + bh); ctx.lineTo(cx - L / 2, by + 10); ctx.quadraticCurveTo(cx - L / 2 + 6, by, cx - L / 2 + 30, by);
      ctx.lineTo(cx - L * 0.22, by); ctx.lineTo(cx - L * 0.1, by - 26); ctx.lineTo(cx + L * 0.18, by - 26); ctx.lineTo(cx + L * 0.32, by); ctx.lineTo(cx + L / 2 - 14, by + 4); ctx.quadraticCurveTo(cx + L / 2, by + 10, cx + L / 2, by + bh); ctx.closePath(); ctx.fill(); ctx.stroke();
      // windows
      ctx.fillStyle = css('--sig-soft'); ctx.beginPath(); ctx.moveTo(cx - L * 0.19, by - 2); ctx.lineTo(cx - L * 0.09, by - 22); ctx.lineTo(cx + 0.03 * L, by - 22); ctx.lineTo(cx + 0.03 * L, by - 2); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(cx + 0.06 * L, by - 2); ctx.lineTo(cx + 0.06 * L, by - 22); ctx.lineTo(cx + L * 0.17, by - 22); ctx.lineTo(cx + L * 0.28, by - 2); ctx.closePath(); ctx.fill();
      // battery pack (floor), inverter + motor (front)
      const bx = cx - L * 0.28, bw = L * 0.48;
      ctx.fillStyle = css('--hv-soft'); ctx.strokeStyle = css('--hv'); ctx.fillRect(bx, by + bh - 12, bw, 9); ctx.strokeRect(bx, by + bh - 12, bw, 9);
      ctx.fillStyle = css('--hv'); ctx.font = '600 8px ' + css('--f-mono'); ctx.fillText('HV BATTERY', bx + 4, by + bh - 4.5);
      const mx = cx + L * 0.36, my = by + bh - 14;
      ctx.fillStyle = css('--surface'); ctx.strokeStyle = css('--ink'); ctx.beginPath(); ctx.arc(mx, my, 8, 0, 7); ctx.fill(); ctx.stroke();
      ctx.save(); ctx.translate(mx, my); ctx.rotate(st.wheel * 9); ctx.strokeStyle = css('--hv'); ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(6, 0); ctx.stroke(); ctx.restore();
      // power flow arrow battery <-> motor
      const p = st.P; if (Math.abs(p) > 500) {
        ctx.strokeStyle = css(p > 0 ? '--hv' : '--ok'); ctx.lineWidth = 2 + Math.min(4, Math.abs(p) / 25000); ctx.setLineDash([6, 6]);
        ctx.lineDashOffset = -(performance.now() / 30) * Math.sign(p); ctx.beginPath(); ctx.moveTo(bx + bw, by + bh - 8); ctx.lineTo(mx - 9, my); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = css(p > 0 ? '--hv' : '--ok'); ctx.font = '600 10px ' + css('--f-mono'); ctx.fillText((p > 0 ? 'traction ' : 'regen ') + (Math.abs(p) / 1000).toFixed(1) + ' kW', bx + bw - 30, by - 34);
      }
      // wheels
      [cx - L * 0.3, cx + L * 0.3].forEach(wx => {
        ctx.fillStyle = css('--ink'); ctx.beginPath(); ctx.arc(wx, ground - 15, 15, 0, 7); ctx.fill();
        ctx.strokeStyle = css('--surface'); ctx.lineWidth = 2;
        for (let k = 0; k < 5; k++) { const a = st.wheel + k * 2 * Math.PI / 5; ctx.beginPath(); ctx.moveTo(wx, ground - 15); ctx.lineTo(wx + 10 * Math.cos(a), ground - 15 + 10 * Math.sin(a)); ctx.stroke(); }
      });
      // brake light
      if (st.brake) { ctx.fillStyle = css('--bad'); ctx.fillRect(cx - L / 2 - 2, by + 8, 5, 10); }
      // speed lines
      if (st.v > 3) { ctx.strokeStyle = css('--line'); ctx.lineWidth = 1.5; for (let k = 0; k < 3; k++) { const yy = by + 4 + k * 10, len = Math.min(70, st.v * 1.4); ctx.beginPath(); ctx.moveTo(cx - L / 2 - 10, yy); ctx.lineTo(cx - L / 2 - 10 - len, yy); ctx.stroke(); } }
      ctx.fillStyle = css('--ink'); ctx.font = '700 22px ' + css('--f-display'); ctx.textAlign = 'right'; ctx.fillText((st.v * 3.6).toFixed(0) + ' km/h', w - 12, 30); ctx.textAlign = 'left';
      ctx.font = '500 11px ' + css('--f-mono'); ctx.fillStyle = css('--muted'); ctx.fillText(st.label || '', 12, 20);
    }
    onTheme(draw); addEventListener('resize', draw);
    return { update(s) { st.wheel += (s.v - (st.vPrev ?? s.v)) * 0 + (s.v / 0.31) * (s.dt || 0.016); st.vPrev = s.v; Object.assign(st, s); draw(); } };
  }

  /* ---------------- IPMSM cross-section with dq frame ---------------- */
  function Motor(host, o) {
    o = o || {};
    const cv = canvas(host, o.height || 280); let st = { th: 0, id: 0, iq: 0, vd: 0, vq: 0, Imax: 450 };
    function draw() {
      const { w, h: H } = cv.fit(), ctx = cv.ctx; ctx.clearRect(0, 0, w, H);
      const cx = Math.min(w, H * 1.3) / 2 + 4, cy = H / 2, R = Math.min(H / 2 - 12, w / 2 - 12);
      // stator
      ctx.lineWidth = 1.2;
      ctx.fillStyle = css('--sunk'); ctx.strokeStyle = css('--line'); ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.arc(cx, cy, R * 0.66, 0, 7, true); ctx.fill('evenodd'); ctx.stroke();
      for (let k = 0; k < 24; k++) { const a = k * Math.PI / 12; ctx.strokeStyle = css('--line'); ctx.beginPath(); ctx.moveTo(cx + R * 0.66 * Math.cos(a), cy - R * 0.66 * Math.sin(a)); ctx.lineTo(cx + R * 0.82 * Math.cos(a), cy - R * 0.82 * Math.sin(a)); ctx.stroke(); }
      // phase axes a b c
      ['a', 'b', 'c'].forEach((p, k) => { const a = k * 2 * Math.PI / 3; ctx.strokeStyle = css(['--hv', '--sig', '--violet'][k]); ctx.setLineDash([2, 4]); ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + R * Math.cos(a), cy - R * Math.sin(a)); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = css(['--hv', '--sig', '--violet'][k]); ctx.font = '600 11px ' + css('--f-mono'); ctx.fillText(p, cx + (R + 4) * Math.cos(a) - 3, cy - (R + 4) * Math.sin(a) + 4); });
      // rotor (2-pole equivalent) with V-shaped interior magnets
      const th = st.th, rr = R * 0.6;
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(-th);
      ctx.fillStyle = css('--surface'); ctx.strokeStyle = css('--ink'); ctx.beginPath(); ctx.arc(0, 0, rr, 0, 7); ctx.fill(); ctx.stroke();
      [[0, '--hv', 'N'], [Math.PI, '--sig', 'S']].forEach(([a, c, lab]) => {
        ctx.save(); ctx.rotate(-a); ctx.fillStyle = css(c);
        ctx.save(); ctx.translate(rr * 0.55, -rr * 0.28); ctx.rotate(0.6); ctx.fillRect(-rr * 0.32, -4, rr * 0.64, 8); ctx.restore();
        ctx.save(); ctx.translate(rr * 0.55, rr * 0.28); ctx.rotate(-0.6); ctx.fillRect(-rr * 0.32, -4, rr * 0.64, 8); ctx.restore();
        ctx.fillStyle = css('--ink'); ctx.font = '700 11px ' + css('--f-mono'); ctx.fillText(lab, rr * 0.72, 4); ctx.restore();
      });
      ctx.fillStyle = css('--ink'); ctx.beginPath(); ctx.arc(0, 0, 5, 0, 7); ctx.fill();
      ctx.restore();
      // d/q axes (electrical)
      const axis = (a, c, lab) => { ctx.strokeStyle = css(c); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(cx - R * 0.95 * Math.cos(a), cy + R * 0.95 * Math.sin(a)); ctx.lineTo(cx + R * 0.95 * Math.cos(a), cy - R * 0.95 * Math.sin(a)); ctx.stroke(); ctx.fillStyle = css(c); ctx.font = '700 12px ' + css('--f-mono'); ctx.fillText(lab, cx + R * 0.98 * Math.cos(a) + 2, cy - R * 0.98 * Math.sin(a)); };
      axis(th, '--ink', 'd'); axis(th + Math.PI / 2, '--muted', 'q');
      // current vector is = id·d + iq·q
      const sc = R * 0.9 / st.Imax; const ia = th + Math.atan2(st.iq, st.id), im = Math.hypot(st.id, st.iq) * sc;
      const arrow = (ang, len, c, wdt, lab) => { if (len < 2) return; const x = cx + len * Math.cos(ang), y = cy - len * Math.sin(ang); ctx.strokeStyle = css(c); ctx.fillStyle = css(c); ctx.lineWidth = wdt; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(x, y); ctx.stroke(); ctx.beginPath(); ctx.arc(x, y, wdt + 1.5, 0, 7); ctx.fill(); if (lab) { ctx.font = '600 11px ' + css('--f-mono'); ctx.fillText(lab, x + 6, y - 6); } };
      // components
      ctx.setLineDash([4, 3]);
      arrow(th, st.id * sc, '--sig', 2, ''); arrow(th + Math.PI / 2, st.iq * sc, '--hv', 2, '');
      ctx.setLineDash([]);
      arrow(ia, im, '--violet', 3.2, 'iₛ');
      // legend
      const lx = Math.min(w - 150, cx + R + 22);
      if (lx > cx + R) {
        ctx.font = '11px ' + css('--f-mono'); let y = 22;
        [['--violet', 'stator current iₛ'], ['--hv', 'i_q  torque'], ['--sig', 'i_d  flux'], ['--ink', 'd axis (magnet)']].forEach(([c, t]) => { ctx.fillStyle = css(c); ctx.fillRect(lx, y - 8, 12, 3); ctx.fillStyle = css('--muted'); ctx.fillText(t, lx + 18, y - 4); y += 18; });
        ctx.fillStyle = css('--ink'); ctx.font = '600 12px ' + css('--f-mono');
        ctx.fillText('i_d = ' + st.id.toFixed(0) + ' A', lx, y + 10); ctx.fillText('i_q = ' + st.iq.toFixed(0) + ' A', lx, y + 28);
        ctx.fillText('θₑ = ' + (((th % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI) * 180 / Math.PI).toFixed(0) + '°', lx, y + 46);
        ctx.font = '10px ' + css('--f-mono'); ctx.fillStyle = css('--muted'); ctx.fillText('2-pole equivalent view', lx, H - 10);
      }
    }
    onTheme(draw); addEventListener('resize', draw);
    return { update(s) { Object.assign(st, s); draw(); } };
  }


  /* ---------------- Rolling time chart (strip recorder) ---------------- */
  function Roll(host, o) {
    const cv = canvas(host, o.height || 200); const span = o.span || 60; const buf = [];
    const lg = h('div', { class: 'legend' }); host.appendChild(lg);
    function paintLg() { lg.innerHTML = o.lanes.flatMap(l => l.s).map(s => `<span><i style="background:${css(s.color)}"></i>${s.label}</span>`).join(''); }
    function draw() {
      const { w, h: H } = cv.fit(), ctx = cv.ctx; ctx.clearRect(0, 0, w, H); if (!buf.length) return;
      const t1 = buf[buf.length - 1].t, t0 = t1 - span, ml = 46, pw = w - ml - 8; const tot = o.lanes.reduce((a, l) => a + (l.h || 1), 0); let y0 = 4;
      ctx.font = '10px ' + css('--f-mono');
      o.lanes.forEach(L => {
        const lh = (H - 20) * (L.h || 1) / tot; let mn = L.min ?? Infinity, mx = L.max ?? -Infinity;
        if (L.min == null || L.max == null) buf.forEach(b => L.s.forEach(s => { const v = b[s.key]; if (v < mn) mn = v; if (v > mx) mx = v; }));
        if (!(mx > mn)) { mx = mn + 1; mn -= 1; } const pad = (mx - mn) * .1; mn -= pad; mx += pad;
        const Y = v => y0 + lh - 4 - (v - mn) / (mx - mn) * (lh - 8), X = t => ml + (t - t0) / span * pw;
        ctx.strokeStyle = css('--line'); ctx.beginPath(); ctx.moveTo(ml, y0 + lh - 1); ctx.lineTo(w - 8, y0 + lh - 1); ctx.stroke();
        if (mn < 0 && mx > 0) { ctx.strokeStyle = css('--grid'); ctx.beginPath(); ctx.moveTo(ml, Y(0)); ctx.lineTo(w - 8, Y(0)); ctx.stroke(); }
        ctx.fillStyle = css('--muted'); ctx.textAlign = 'right'; ctx.fillText((mx - pad).toFixed(L.dp ?? 0), ml - 5, y0 + 10); ctx.fillText((mn + pad).toFixed(L.dp ?? 0), ml - 5, y0 + lh - 5); ctx.textAlign = 'left'; ctx.fillText(L.name, ml + 4, y0 + 10);
        L.s.forEach(s => { ctx.strokeStyle = css(s.color); ctx.lineWidth = s.w || 1.6; ctx.setLineDash(s.dash ? [5, 4] : []); ctx.beginPath(); let first = true; buf.forEach(b => { if (b.t < t0) return; const x = X(b.t), y = Y(b[s.key]); first ? ctx.moveTo(x, y) : ctx.lineTo(x, y); first = false; }); ctx.stroke(); ctx.setLineDash([]); });
        y0 += lh;
      });
      ctx.fillStyle = css('--muted'); ctx.textAlign = 'right'; ctx.fillText('now', w - 8, H - 4); ctx.textAlign = 'left'; ctx.fillText('−' + span + ' s', ml, H - 4);
    }
    paintLg(); onTheme(() => { paintLg(); draw(); }); addEventListener('resize', draw);
    let last = -1;
    return { push(t, vals) { if (t - last < (o.dt || 0.1)) return; last = t; buf.push(Object.assign({ t }, vals)); while (buf.length && buf[0].t < t - span - 1) buf.shift(); draw(); }, clear() { buf.length = 0; last = -1; } };
  }

  /* collapsible equations */
  function eqPanel(title, html) { return `<details class="eq"><summary>${title}</summary><div class="eqb">${html}</div></details>`; }

  return { css, el, h, fmt, canvas, loop, Scope, Spectrum, Arch, Car, Motor, Roll, eqPanel, onTheme, reduce };
})();
