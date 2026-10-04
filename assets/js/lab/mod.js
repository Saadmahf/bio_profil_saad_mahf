/* =====================================================================
   MODULATION LABS — SPWM, SVPWM, Six-step (each with its own visual)
   ===================================================================== */
window.MOD = (function () {
  const { css, h, canvas, loop, onTheme } = UI, E = window.EV, TAU = Math.PI * 2, S3 = Math.sqrt(3);
  const tri = x => { x -= Math.floor(x); return x < .5 ? 2 * x : 2 - 2 * x; };

  /* generic stacked-lane painter with a moving cursor */
  function paintLanes(cv, lanes, cursor, x0 = 0, x1 = 1) {
    const { w, h: H } = cv.fit(), ctx = cv.ctx; ctx.clearRect(0, 0, w, H);
    ctx.font = '10px ' + css('--f-mono');
    const ml = Math.max(48, ...lanes.map(l => ctx.measureText(l.name).width + 12)), mr = 8, pw = w - ml - mr, tot = lanes.reduce((a, l) => a + (l.h || 1), 0); let y = 4;
    lanes.forEach(L => {
      const lh = (H - 10) * (L.h || 1) / tot, mn = L.min, mx = L.max;
      const Y = v => y + lh - 5 - (v - mn) / (mx - mn) * (lh - 10);
      ctx.strokeStyle = css('--line'); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(ml, y + lh - 1); ctx.lineTo(w - mr, y + lh - 1); ctx.stroke();
      if (mn < 0 && mx > 0) { ctx.strokeStyle = css('--grid'); ctx.beginPath(); ctx.moveTo(ml, Y(0)); ctx.lineTo(w - mr, Y(0)); ctx.stroke(); }
      (L.hl || []).forEach(v => { ctx.strokeStyle = css('--muted'); ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.moveTo(ml, Y(v)); ctx.lineTo(w - mr, Y(v)); ctx.stroke(); ctx.setLineDash([]); });
      ctx.fillStyle = css('--muted'); ctx.textAlign = 'right'; ctx.fillText(L.name, ml - 6, y + lh / 2 + 3); ctx.textAlign = 'left';
      L.tr.forEach(tr => {
        const a = tr.y, n = a.length; ctx.strokeStyle = css(tr.c); ctx.lineWidth = tr.w || 1.4; ctx.globalAlpha = tr.a || 1; ctx.beginPath();
        const i0 = Math.floor(x0 * n), i1 = Math.ceil(x1 * n);
        for (let i = i0; i < i1; i++) { const X = ml + (i - i0) / (i1 - i0 - 1) * pw; i === i0 ? ctx.moveTo(X, Y(a[i])) : ctx.lineTo(X, Y(a[i])); }
        ctx.stroke(); ctx.globalAlpha = 1;
      });
      y += lh;
    });
    if (cursor != null) { const X = ml + (cursor - x0) / (x1 - x0) * pw; ctx.strokeStyle = css('--hv'); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(X, 2); ctx.lineTo(X, H - 2); ctx.stroke(); }
  }
  function dft1(x, k) { let re = 0, im = 0; const N = x.length; for (let n = 0; n < N; n++) { re += x[n] * Math.cos(TAU * k * n / N); im -= x[n] * Math.sin(TAU * k * n / N); } return 2 * Math.hypot(re, im) / N; }
  function thdOf(x) { let a1 = dft1(x, 1), hs = 0; for (let k = 2; k < 60; k++) hs += dft1(x, k) ** 2; return Math.sqrt(hs) / a1; }

  /* ---------------- SPWM ---------------- */
  function SPWM(host) {
    host.innerHTML = `
      <div class="lab-ctl row" style="display:flex;gap:14px;flex-wrap:wrap;align-items:end;margin-bottom:10px">
        <label class="lablbl" style="min-width:200px;flex:1"><span>modulation index m<sub>a</sub> = <b class="m" style="color:var(--ink)">0.80</b></span><input type="range" style="width:100%" min="0" max="1.6" step="0.01" value="0.8" aria-label="SPWM modulation index"></label>
        <label class="lablbl"><span>carrier ratio f<sub>sw</sub>/f<sub>e</sub></span><select aria-label="Carrier ratio"><option>9</option><option selected>15</option><option>21</option><option>45</option></select></label>
        <button class="iconbtn" type="button" data-p>❚❚ Pause</button>
      </div>
      <div class="split">
        <div class="lanes"></div>
        <div style="display:grid;gap:10px;align-content:start">
          <div class="inv"></div>
          <div class="dash k"></div>
          <div class="note warnbox" style="font-size:.84rem"></div>
        </div>
      </div>`;
    const cv = canvas(host.querySelector('.lanes'), 380), inv = Inverter(host.querySelector('.inv'));
    const rng = host.querySelector('input'), selm = host.querySelector('select'), K = host.querySelector('.k'), note = host.querySelector('.warnbox');
    let m = 0.8, mf = 15, cur = 0, run = true; const N = 1800, Vdc = 360;
    let D;
    function compute() {
      const ra = new Float32Array(N), rb = new Float32Array(N), rc = new Float32Array(N), car = new Float32Array(N), sa = new Float32Array(N), sb = new Float32Array(N), sc = new Float32Array(N), vab = new Float32Array(N), van = new Float32Array(N), ia = new Float32Array(N);
      for (let n = 0; n < N; n++) {
        const th = TAU * n / N, c = 2 * tri(n / N * mf + .25) - 1;
        ra[n] = m * Math.sin(th); rb[n] = m * Math.sin(th - TAU / 3); rc[n] = m * Math.sin(th + TAU / 3); car[n] = c;
        sa[n] = ra[n] > c ? 1 : 0; sb[n] = rb[n] > c ? 1 : 0; sc[n] = rc[n] > c ? 1 : 0;
        vab[n] = (sa[n] - sb[n]) * Vdc; van[n] = (2 * sa[n] - sb[n] - sc[n]) / 3 * Vdc;
      }
      // RL load current (R = 0.5 Ω, ωL = 2 Ω at f_e), periodic steady state by two passes
      const R = 0.5, L = 2 / TAU, dt = 1 / N; let i = 0;
      for (let p = 0; p < 3; p++) for (let n = 0; n < N; n++) { i += dt * (van[n] - R * i) / L; if (p === 2) ia[n] = i; }
      const v1 = dft1(van, 1);
      D = { ra, rb, rc, car, sa, sb, sc, vab, van, ia, v1, thd: thdOf(vab), ithd: thdOf(ia), imax: Math.max(...ia.map(Math.abs)) };
      K.innerHTML = `<div><span>V<sub>dc</sub></span><b>${Vdc}</b><small>V</small></div><div><span>V<sub>an,1</sub> peak</span><b>${D.v1.toFixed(0)}</b><small>V</small></div><div><span>ideal m·V<sub>dc</sub>/2</span><b>${(m * Vdc / 2).toFixed(0)}</b><small>V</small></div><div><span>THD v<sub>ab</sub></span><b>${(D.thd * 100).toFixed(0)}</b><small>%</small></div><div><span>THD i<sub>a</sub></span><b>${(D.ithd * 100).toFixed(1)}</b><small>%</small></div><div><span>f<sub>sw</sub> @ 50 Hz</span><b>${mf * 50}</b><small>Hz</small></div>`;
      note.innerHTML = m <= 1 ? 'Linear region: fundamental = m·V<sub>dc</sub>/2. The maximum linear phase peak is V<sub>dc</sub>/2 = 180 V, i.e. 78.5 % of the six-step fundamental.'
        : `<b>Overmodulation</b> (m &gt; 1): the reference exceeds the carrier, pulses are dropped and the fundamental stops growing linearly (${D.v1.toFixed(0)} V instead of ${(m * Vdc / 2).toFixed(0)} V). Low-order 5th/7th harmonics appear in the current.`;
      draw();
    }
    function draw() {
      if (!D) return;
      paintLanes(cv, [
        { name: 'refs/carrier', h: 1.6, min: -1.7, max: 1.7, hl: [1, -1], tr: [{ y: D.car, c: '--muted', w: 1 }, { y: D.ra, c: '--hv', w: 2 }, { y: D.rb, c: '--sig', w: 1.6 }, { y: D.rc, c: '--violet', w: 1.6 }] },
        { name: 'S_a', h: .45, min: -.2, max: 1.2, tr: [{ y: D.sa, c: '--hv' }] },
        { name: 'S_b', h: .45, min: -.2, max: 1.2, tr: [{ y: D.sb, c: '--sig' }] },
        { name: 'S_c', h: .45, min: -.2, max: 1.2, tr: [{ y: D.sc, c: '--violet' }] },
        { name: 'v_ab [V]', h: 1, min: -400, max: 400, tr: [{ y: D.vab, c: '--ink', w: 1 }] },
        { name: 'i_a (RL)', h: 1, min: -D.imax * 1.2, max: D.imax * 1.2, tr: [{ y: D.ia, c: '--hv', w: 2 }] }
      ], cur);
      const n = Math.floor(cur * N) % N;
      inv.set([D.sa[n], D.sb[n], D.sc[n]], 'carrier ' + (D.car[n] >= 0 ? '↑' : '↓') + '  ref_a ' + D.ra[n].toFixed(2));
    }
    rng.oninput = () => { m = +rng.value; host.querySelector('.m').textContent = m.toFixed(2); compute(); };
    selm.onchange = () => { mf = +selm.value; compute(); };
    host.querySelector('[data-p]').onclick = e => { run = !run; e.target.textContent = run ? '❚❚ Pause' : '▶ Play'; };
    compute(); onTheme(draw); addEventListener('resize', draw);
    loop(host, dt => { if (!run) return; cur = (cur + dt * 0.12) % 1; draw(); });
    return { setM(v) { rng.value = v; rng.oninput(); } };
  }

  /* small inverter switch-state widget (SVG) */
  function Inverter(host) {
    host.innerHTML = `<svg class="chart" viewBox="0 0 230 150" aria-label="Inverter switch states"></svg><div class="mono muted" style="font-size:.72rem;text-align:center"></div>`;
    const svg = host.querySelector('svg'), cap = host.querySelector('div'); let R = [], last = [0, 0, 0];
    function build() {
      svg.innerHTML = ''; const e = (t, a) => UI.el(t, a, svg);
      e('line', { x1: 20, x2: 220, y1: 12, y2: 12, stroke: css('--hv'), 'stroke-width': 2 }); e('line', { x1: 20, x2: 220, y1: 138, y2: 138, stroke: css('--ink'), 'stroke-width': 2 });
      const t1 = e('text', { x: 2, y: 16 }); t1.textContent = '+'; t1.style.fill = css('--hv'); const t2 = e('text', { x: 2, y: 142 }); t2.textContent = '−';
      R = ['a', 'b', 'c'].map((p, i) => {
        const x = 60 + i * 60; e('line', { x1: x, x2: x, y1: 12, y2: 138, stroke: css('--line'), 'stroke-width': 2 });
        const up = e('rect', { x: x - 12, y: 26, width: 24, height: 32, rx: 4 }), dn = e('rect', { x: x - 12, y: 92, width: 24, height: 32, rx: 4 });
        const nd = e('circle', { cx: x, cy: 75, r: 5 }); e('line', { x1: x + 5, x2: x + 26, y1: 75, y2: 75, stroke: css('--muted') });
        const t = e('text', { x: x + 14, y: 70 }); t.textContent = p; t.style.font = '600 11px ' + css('--f-mono');
        return { up, dn, nd };
      });
      set(last);
    }
    function set(s, txt) {
      last = s; const hv = css('--hv'), sf = css('--surface'), ink = css('--ink');
      R.forEach((r, i) => { r.up.setAttribute('fill', s[i] ? hv : sf); r.up.setAttribute('stroke', ink); r.dn.setAttribute('fill', s[i] ? sf : ink); r.dn.setAttribute('stroke', ink); r.nd.setAttribute('fill', s[i] ? hv : ink); });
      if (txt != null) cap.textContent = `state ${s.join('')}  ·  ${txt}`;
    }
    build(); onTheme(build);
    return { set };
  }

  /* ---------------- SVPWM ---------------- */
  function SVPWM(host) {
    host.innerHTML = `
      <div style="display:flex;gap:14px;flex-wrap:wrap;align-items:end;margin-bottom:10px">
        <label class="lablbl" style="min-width:200px;flex:1"><span>|V*| / (V<sub>dc</sub>/√3) = <b class="m" style="color:var(--ink)">0.70</b></span><input type="range" min="0" max="1.15" step="0.01" value="0.7" aria-label="SVPWM reference magnitude"></label>
        <span class="seg" role="group" aria-label="Operating presets"><button type="button" data-v="0.3">Low</button><button type="button" data-v="0.7" aria-pressed="true">Normal</button><button type="button" data-v="0.95">High</button><button type="button" data-v="1.12">Deep overmod</button></span>
        <button class="iconbtn" type="button" data-p>❚❚ Pause</button>
      </div>
      <div class="grid2">
        <div class="hex"></div>
        <div style="display:grid;gap:10px;align-content:start"><div class="seq"></div><div class="dash k"></div></div>
      </div>
      <div class="wav" style="margin-top:10px"></div>
      <div class="note warnbox" style="font-size:.84rem;margin-top:10px"></div>`;
    const cvH = canvas(host.querySelector('.hex'), 330), cvS = canvas(host.querySelector('.seq'), 200), cvW = canvas(host.querySelector('.wav'), 200);
    const rng = host.querySelector('input'), K = host.querySelector('.k'), note = host.querySelector('.warnbox');
    let m = 0.7, th = 0.3, run = true; const Vdc = 360, fsw = 10000, Ts = 1 / fsw, Vlin = Vdc / S3;
    const states = ['100', '110', '010', '011', '001', '101'];
    function calc(theta, mm) {
      const Vr = mm * Vlin; let sec = Math.floor(((theta % TAU) + TAU) % TAU / (Math.PI / 3)); const a = ((theta % TAU) + TAU) % TAU - sec * Math.PI / 3;
      let T1 = S3 * Ts * Vr / Vdc * Math.sin(Math.PI / 3 - a), T2 = S3 * Ts * Vr / Vdc * Math.sin(a), T0 = Ts - T1 - T2, om = false;
      if (T0 < 0) { om = true; const s = T1 + T2; T1 = T1 / s * Ts; T2 = T2 / s * Ts; T0 = 0; }  // clamp to hexagon (minimum phase error)
      return { sec, a, T1, T2, T0, om, Vr };
    }
    function drawHex() {
      const { w, h: H } = cvH.fit(), ctx = cvH.ctx; ctx.clearRect(0, 0, w, H);
      const cx = w / 2, cy = H / 2, R = Math.min(w, H) / 2 - 30, k = R / (2 * Vdc / 3);
      const P = i => [cx + R * Math.cos(i * Math.PI / 3), cy - R * Math.sin(i * Math.PI / 3)];
      const c = calc(th, m);
      // sector fill
      ctx.fillStyle = css('--hv-soft'); ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(...P(c.sec)); ctx.lineTo(...P(c.sec + 1)); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = css('--ink'); ctx.lineWidth = 1.3; ctx.beginPath(); for (let i = 0; i <= 6; i++) { const p = P(i); i ? ctx.lineTo(...p) : ctx.moveTo(...p); } ctx.stroke();
      ctx.setLineDash([4, 4]); ctx.strokeStyle = css('--sig'); ctx.beginPath(); ctx.arc(cx, cy, Vlin * k, 0, 7); ctx.stroke();
      ctx.strokeStyle = css('--muted'); ctx.beginPath(); ctx.arc(cx, cy, Vdc / 2 * k, 0, 7); ctx.stroke(); ctx.setLineDash([]);
      ctx.font = '600 10px ' + css('--f-mono');
      for (let i = 0; i < 6; i++) { const [x, y] = P(i); ctx.fillStyle = css(i === c.sec || i === (c.sec + 1) % 6 ? '--hv' : '--surface'); ctx.strokeStyle = css('--ink'); ctx.beginPath(); ctx.arc(x, y, 5, 0, 7); ctx.fill(); ctx.stroke(); ctx.fillStyle = css('--ink'); ctx.textAlign = 'center'; ctx.fillText('V' + (i + 1) + ' ' + states[i], cx + (R + 18) * Math.cos(i * Math.PI / 3), cy - (R + 14) * Math.sin(i * Math.PI / 3) + 4); }
      ctx.fillText('V0 000 / V7 111', cx, cy + 16);
      ctx.fillStyle = css('--sig'); ctx.textAlign = 'left'; ctx.fillText('SVPWM linear limit Vdc/√3', 6, H - 20); ctx.fillStyle = css('--muted'); ctx.fillText('SPWM limit Vdc/2', 6, H - 6);
      // decomposition T1/Ts·Vk + T2/Ts·Vk+1
      const v1 = P(c.sec), v2 = P(c.sec + 1);
      const a1x = cx + (v1[0] - cx) * c.T1 / Ts, a1y = cy + (v1[1] - cy) * c.T1 / Ts;
      const ex = a1x + (v2[0] - cx) * c.T2 / Ts, ey = a1y + (v2[1] - cy) * c.T2 / Ts;
      ctx.strokeStyle = css('--sig'); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(a1x, a1y); ctx.lineTo(ex, ey); ctx.stroke();
      // reference
      const rx = cx + c.Vr * k * Math.cos(th), ry = cy - c.Vr * k * Math.sin(th);
      ctx.strokeStyle = css('--muted'); ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(rx, ry); ctx.stroke(); ctx.setLineDash([]);
      ctx.strokeStyle = css('--hv'); ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(ex, ey); ctx.stroke(); ctx.fillStyle = css('--hv'); ctx.beginPath(); ctx.arc(ex, ey, 4, 0, 7); ctx.fill();
      ctx.fillStyle = css('--ink'); ctx.font = '600 11px ' + css('--f-mono'); ctx.textAlign = 'left'; ctx.fillText('V*', ex + 6, ey - 6); ctx.fillText('sector ' + (c.sec + 1), 6, 16);
      return c;
    }
    function drawSeq(c) {
      const { w, h: H } = cvS.fit(), ctx = cvS.ctx; ctx.clearRect(0, 0, w, H);
      const ml = 34, pw = w - ml - 8;
      const sA = states[c.sec], sB = states[(c.sec + 1) % 6];
      // 7-segment symmetric sequence: V0 Vk Vk+1 V7 Vk+1 Vk V0
      const seg = [['000', c.T0 / 4], [sA, c.T1 / 2], [sB, c.T2 / 2], ['111', c.T0 / 2], [sB, c.T2 / 2], [sA, c.T1 / 2], ['000', c.T0 / 4]];
      ctx.font = '10px ' + css('--f-mono');
      ['S_a', 'S_b', 'S_c'].forEach((n, ph) => {
        const y = 14 + ph * 44; ctx.fillStyle = css('--muted'); ctx.textAlign = 'right'; ctx.fillText(n, ml - 4, y + 17);
        let x = ml; ctx.strokeStyle = css(['--hv', '--sig', '--violet'][ph]); ctx.lineWidth = 2; ctx.beginPath();
        seg.forEach(([s, d], i) => { const lv = s[ph] === '1'; const xx = x + d / Ts * pw; const yy = lv ? y + 2 : y + 24; if (i === 0) ctx.moveTo(x, yy); else ctx.lineTo(x, yy); ctx.lineTo(xx, yy); x = xx; });
        ctx.stroke();
      });
      let x = ml; ctx.textAlign = 'center'; ctx.fillStyle = css('--ink');
      seg.forEach(([s, d]) => { const xx = x + d / Ts * pw; ctx.strokeStyle = css('--line'); ctx.beginPath(); ctx.moveTo(x, 10); ctx.lineTo(x, 148); ctx.stroke(); if (d / Ts * pw > 22) ctx.fillText(s === '000' ? 'V0' : s === '111' ? 'V7' : 'V' + (states.indexOf(s) + 1), (x + xx) / 2, 160); x = xx; });
      ctx.fillStyle = css('--muted'); ctx.textAlign = 'center'; ctx.fillText('one switching period Tₛ = ' + (Ts * 1e6).toFixed(0) + ' µs (symmetric 7-segment sequence)', ml + pw / 2, H - 6);
    }
    let wav;
    function computeWave() {
      const N = 720, ref = new Float32Array(N), sat = new Float32Array(N), sin = new Float32Array(N), avg = new Float32Array(N);
      for (let n = 0; n < N; n++) {
        const t = TAU * n / N, c = calc(t, m);
        const va = c.Vr * Math.cos(t), vb = c.Vr * Math.cos(t - TAU / 3), vc = c.Vr * Math.cos(t + TAU / 3);
        const z = -(Math.max(va, vb, vc) + Math.min(va, vb, vc)) / 2;
        sin[n] = va; ref[n] = va + z; sat[n] = Math.max(-Vdc / 2, Math.min(Vdc / 2, va + z));
        // averaged phase voltage from clamped dwell times (what the motor sees per Ts)
        const pa = Math.max(-Vdc / 2, Math.min(Vdc / 2, va + z)), pb = Math.max(-Vdc / 2, Math.min(Vdc / 2, vb + z)), pc = Math.max(-Vdc / 2, Math.min(Vdc / 2, vc + z));
        avg[n] = pa - (pa + pb + pc) / 3;
      }
      wav = { ref, sat, sin, avg, v1: dft1(avg, 1), thd: thdOf(avg) };
    }
    function draw() {
      const c = drawHex(); drawSeq(c);
      paintLanes(cvW, [{ name: 'phase a [V]', min: -Vdc / 1.6, max: Vdc / 1.6, hl: [Vdc / 2, -Vdc / 2], tr: [{ y: wav.sin, c: '--muted', w: 1 }, { y: wav.sat, c: '--sig', w: 1.6 }, { y: wav.avg, c: '--hv', w: 2.2 }] }], ((th % TAU) + TAU) % TAU / TAU);
      K.innerHTML = `<div><span>V<sub>dc</sub></span><b>${Vdc}</b><small>V</small></div><div><span>|V*|</span><b>${c.Vr.toFixed(0)}</b><small>V</small></div><div><span>sector</span><b>${c.sec + 1}</b></div><div><span>T1</span><b>${(c.T1 * 1e6).toFixed(1)}</b><small>µs</small></div><div><span>T2</span><b>${(c.T2 * 1e6).toFixed(1)}</b><small>µs</small></div><div><span>T0</span><b>${(c.T0 * 1e6).toFixed(1)}</b><small>µs</small></div><div><span>f<sub>sw</sub></span><b>10</b><small>kHz</small></div><div><span>V<sub>1</sub> applied</span><b>${wav.v1.toFixed(0)}</b><small>V</small></div>`;
      note.innerHTML = m <= 1 ? `Linear SVPWM: the min-max zero-sequence injection (teal saddle) keeps every leg inside ±V<sub>dc</sub>/2 while the line-to-line fundamental reaches V<sub>dc</sub>/√3 = ${Vlin.toFixed(0)} V, <b>15.5 % above SPWM</b> (${(Vdc / 2).toFixed(0)} V). Orange = per-period average phase voltage; grey = sinusoidal reference.`
        : `<b>Overmodulation</b>: the reference leaves the hexagon, T0 → 0 and the vector is clamped to the hexagon edge. The averaged phase voltage (orange) flattens; fundamental ${wav.v1.toFixed(0)} V for a ${c.Vr.toFixed(0)} V request, THD ${(wav.thd * 100).toFixed(1)} %. At the limit this becomes six-step (2V<sub>dc</sub>/π = ${(2 * Vdc / Math.PI).toFixed(0)} V).`;
    }
    rng.oninput = () => { m = +rng.value; host.querySelector('.m').textContent = m.toFixed(2); host.querySelectorAll('[data-v]').forEach(b => b.setAttribute('aria-pressed', +b.dataset.v === m)); computeWave(); draw(); };
    host.querySelectorAll('[data-v]').forEach(b => b.onclick = () => { rng.value = b.dataset.v; rng.oninput(); });
    host.querySelector('[data-p]').onclick = e => { run = !run; e.target.textContent = run ? '❚❚ Pause' : '▶ Play'; };
    computeWave(); draw(); onTheme(draw); addEventListener('resize', draw);
    loop(host, dt => { if (!run) return; th += dt * 0.7; draw(); });
    return {};
  }

  /* ---------------- Six-step ---------------- */
  function SixStep(host) {
    host.innerHTML = `
      <div style="display:flex;gap:14px;flex-wrap:wrap;align-items:end;margin-bottom:10px">
        <label class="lablbl" style="min-width:200px;flex:1"><span>motor speed <b class="sp" style="color:var(--ink)">7000 rpm</b> · T* = 100 Nm · V<sub>dc</sub> = 360 V</span><input type="range" min="4500" max="12000" step="100" value="7000" aria-label="Six-step speed"></label>
        <button class="iconbtn" type="button" data-p>❚❚ Pause</button>
      </div>
      <div class="split"><div class="lanes"></div>
        <div style="display:grid;gap:10px;align-content:start"><div class="tbl"></div><div class="rot"></div><div class="dash k"></div></div></div>`;
    const cv = canvas(host.querySelector('.lanes'), 400), rot = UI.Motor(host.querySelector('.rot'), { height: 170 });
    const tbl = host.querySelector('.tbl'), K = host.querySelector('.k'); let rpm = 7000, run = true, cur = 0, W;
    const Vdc = 360, states = ['100', '110', '010', '011', '001', '101'];
    function compute() {
      const we = E.rpm2we(rpm); const vlim = 2 * Vdc / Math.PI;
      const op = E.operate(100, we, vlim, 'fixed'); op.we = we;
      W = E.synth(op, 'six', Vdc, 10000, { N: 4096, Tmax: 1.0001 * E.TAU / we }); W.op = op;
      const st = E.stats(W.Te);
      K.innerHTML = `<div><span>|V| fixed</span><b>${vlim.toFixed(0)}</b><small>V</small></div><div><span>T<sub>e</sub> avg</span><b>${st.mean.toFixed(0)}</b><small>Nm</small></div><div><span>torque ripple</span><b>${st.pp.toFixed(0)}</b><small>Nm pp</small></div><div><span>i<sub>d</sub></span><b>${op.id.toFixed(0)}</b><small>A</small></div><div><span>i<sub>q</sub></span><b>${op.iq.toFixed(0)}</b><small>A</small></div><div><span>f<sub>e</sub></span><b>${W.fe.toFixed(0)}</b><small>Hz</small></div>`;
    }
    function draw() {
      if (!W) return; const n = Math.floor(cur * W.N) % W.N;
      const imax = Math.max(...W.ia.map(Math.abs)) * 1.15, st = E.stats(W.Te);
      paintLanes(cv, [
        { name: 'S_a S_b S_c', h: .9, min: -.3, max: 3.6, tr: [{ y: W.Sa.map(v => v + 2.4), c: '--hv' }, { y: W.Sb.map(v => v + 1.2), c: '--sig' }, { y: W.Sc, c: '--violet' }] },
        { name: 'v_an [V]', h: 1, min: -260, max: 260, hl: [Vdc * 2 / 3, Vdc / 3, -Vdc / 3, -Vdc * 2 / 3], tr: [{ y: W.van, c: '--hv', w: 1.8 }] },
        { name: 'v_ab [V]', h: 1, min: -400, max: 400, tr: [{ y: W.vab, c: '--ink', w: 1.6 }] },
        { name: 'i_abc [A]', h: 1.2, min: -imax, max: imax, tr: [{ y: W.ia, c: '--hv', w: 1.6 }, { y: W.ib, c: '--sig', w: 1.2 }, { y: W.ic, c: '--violet', w: 1.2 }] },
        { name: 'T_e [Nm]', h: .9, min: st.min - 10, max: st.max + 10, tr: [{ y: W.Te, c: '--ink', w: 1.4 }] }
      ], cur);
      const s = '' + W.Sa[n] + W.Sb[n] + W.Sc[n], k = states.indexOf(s);
      tbl.innerHTML = `<table class="cmp" style="font-size:.8rem"><thead><tr><th>step</th><th>S<sub>a</sub>S<sub>b</sub>S<sub>c</sub></th><th>θₑ window</th><th>v<sub>an</sub></th></tr></thead><tbody>${states.map((x, i) => `<tr ${i === k ? 'aria-current="true"' : ''}><td>${i + 1}</td><td class="mono">${x}</td><td class="mono">${(i * 60 - 30 + 360) % 360}°…${(i * 60 + 30) % 360}°</td><td class="mono">${['+2/3', '+1/3', '−1/3', '−2/3', '−1/3', '+1/3'][i]} V<sub>dc</sub></td></tr>`).join('')}</tbody></table>`;
      const th = W.we * W.t[n];
      rot.update({ th, id: W.op.id, iq: W.op.iq });
    }
    host.querySelector('input').oninput = e => { rpm = +e.target.value; host.querySelector('.sp').textContent = rpm + ' rpm'; compute(); draw(); };
    host.querySelector('[data-p]').onclick = e => { run = !run; e.target.textContent = run ? '❚❚ Pause' : '▶ Play'; };
    compute(); draw(); onTheme(draw); addEventListener('resize', draw);
    loop(host, dt => { if (!run) return; cur = (cur + dt * 0.1) % 1; draw(); });
  }
  return { SPWM, SVPWM, SixStep, Inverter, paintLanes };
})();
