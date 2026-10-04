document.addEventListener('DOMContentLoaded', () => {
  const U = UI, css = U.css, $ = s => document.querySelector(s), G = window.THG;
  /* ---------- model (parameters of the original study) ---------- */
  const a1 = 552.5871, a2 = 92.0978, b1 = 0.2856, b2 = 0.0952, e1 = 41444, e2 = 1473.6, k0 = 0.93, w = 6.2832, xi = 0.7;
  const f = (x, u) => [e1 * x[1] - a1 * x[0] * x[1] - b1 * x[0] + b1 * x[3], x[2], -w * w * x[1] - 2 * xi * w * x[2] + k0 * w * w * u[0],
    e2 * x[4] - a2 * x[3] * x[4] + b2 * x[0] - b2 * x[3], x[5], -w * w * x[4] - 2 * xi * w * x[5] + k0 * w * w * u[1]];
  const Z = { lo: -1e-3, hi: 2e-3 };   // premise domain for z1 = x2, z2 = x5 (covers simulated trajectories)
  const Az = (z1, z2) => [[-(a1 * z1 + b1), e1, 0, b1, 0, 0], [0, 0, 1, 0, 0, 0], [0, -w * w, -2 * xi * w, 0, 0, 0], [b2, 0, 0, -(a2 * z2 + b2), e2, 0], [0, 0, 0, 0, 0, 1], [0, 0, 0, 0, -w * w, -2 * xi * w]];
  const LOCAL = [[Z.lo, Z.lo], [Z.hi, Z.lo], [Z.lo, Z.hi], [Z.hi, Z.hi]].map(([p, q]) => Az(p, q));
  const mu = z => { const c = Math.min(Z.hi, Math.max(Z.lo, z)); const m0 = (Z.hi - c) / (Z.hi - Z.lo); return [m0, 1 - m0]; };
  const weights = x => { const [p0, p1] = mu(x[1]), [q0, q1] = mu(x[4]); return [p0 * q0, p1 * q0, p0 * q1, p1 * q1]; };
  const fTS = (x, u) => { const m = weights(x), d = [0, 0, 0, 0, 0, 0]; for (let i = 0; i < 4; i++) for (let r = 0; r < 6; r++) { let s = 0; for (let c = 0; c < 6; c++) s += LOCAL[i][r][c] * x[c]; d[r] += m[i] * s; } d[2] += k0 * w * w * u[0]; d[5] += k0 * w * w * u[1]; return d; };
  const add = (x, k, h) => x.map((v, i) => v + h * k[i]);
  const rk4 = (F, x, u, h) => { const k1 = F(x, u), k2 = F(add(x, k1, h / 2), u), k3 = F(add(x, k2, h / 2), u), k4 = F(add(x, k3, h), u); return x.map((v, i) => v + h / 6 * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i])); };
  const S = { r: [60, 45], speed: 1 };
  let x, xh, xt, t, u;
  function reset() { x = G.xe.slice(); xt = G.xe.slice(); xh = G.xe.slice(); xh[1] += 3e-4; xh[2] = 2e-3; t = 0; u = G.ue.slice(); }
  reset();
  function step(h) {
    const re = [60, 40];
    u = [0, 1].map(i => G.ue[i] - G.K[i].reduce((s, k, j) => s + k * (xh[j] - G.xe[j]), 0) + G.N[i][0] * (S.r[0] - re[0]) + G.N[i][1] * (S.r[1] - re[1]));
    const y = [x[0], x[3]], yh = [xh[0], xh[3]];
    const dxh = G.A.map((row, i) => row.reduce((s, a, j) => s + a * (xh[j] - G.xe[j]), 0) + (i === 2 ? k0 * w * w * (u[0] - G.ue[0]) : 0) + (i === 5 ? k0 * w * w * (u[1] - G.ue[1]) : 0) + G.L[i][0] * (y[0] - yh[0]) + G.L[i][1] * (y[1] - yh[1]));
    x = rk4(f, x, u, h); xt = rk4(fTS, xt, u, h); xh = xh.map((v, i) => v + h * dxh[i]); t += h;
  }
  /* ---------- controls ---------- */
  $('#r1').oninput = e => { S.r[0] = +e.target.value; $('[data-o=r1]').textContent = S.r[0].toFixed(1) + ' °C'; };
  $('#r2').oninput = e => { S.r[1] = +e.target.value; $('[data-o=r2]').textContent = S.r[1].toFixed(1) + ' °C'; };
  $('#sp').oninput = e => { S.speed = +e.target.value; $('[data-o=sp]').textContent = '×' + S.speed; };
  $('#kick').onclick = () => { xh[1] += 4e-4; xh[4] -= 4e-4; xh[2] += 3e-3; xh[0] += 1.5; };
  $('#rst').onclick = () => { reset(); [roll, oroll, troll].forEach(r => r.clear()); };

  /* ---------- exchanger animation ---------- */
  const hx = U.canvas($('#hx'), 230); const parts = { hot: Array.from({ length: 40 }, (_, i) => i / 40), cold: Array.from({ length: 50 }, (_, i) => i / 50) };
  const hex2rgb = h => { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); const n = parseInt(h, 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  const tcol = T => { const c0 = hex2rgb(css('--sig')), c1 = hex2rgb(css('--hv')); const k = Math.min(1, Math.max(0, (T - 16) / (75 - 16))); return `rgb(${c0.map((v, i) => Math.round(v + (c1[i] - v) * k)).join(',')})`; };
  function drawHX(dt) {
    const { w: W, h: H } = hx.fit(), ctx = hx.ctx; ctx.clearRect(0, 0, W, H);
    const x0 = 90, x1 = W - 90, sh = [70, 170], tb = [102, 138];
    // temperature profiles along the exchanger (log-mean-like interpolation between inlets and outlets)
    const Th = s => 75 + (x[0] - 75) * s, Tc = s => x[3] + (16 - x[3]) * s; // s: 0 left → 1 right
    for (let px = x0; px < x1; px += 3) { const s = (px - x0) / (x1 - x0); ctx.fillStyle = tcol(Tc(s)); ctx.fillRect(px, sh[0], 3, tb[0] - sh[0]); ctx.fillRect(px, tb[1], 3, sh[1] - tb[1]); ctx.fillStyle = tcol(Th(s)); ctx.fillRect(px, tb[0], 3, tb[1] - tb[0]); }
    ctx.strokeStyle = css('--ink'); ctx.lineWidth = 2; ctx.strokeRect(x0, sh[0], x1 - x0, sh[1] - sh[0]); ctx.lineWidth = 1.4; ctx.strokeRect(x0, tb[0], x1 - x0, tb[1] - tb[0]);
    // flow particles
    const vh = Math.max(0, x[1]) / 1e-3 * 0.25, vc = Math.max(0, x[4]) / 1e-3 * 0.25;
    parts.hot = parts.hot.map(p => (p + vh * dt) % 1); parts.cold = parts.cold.map(p => (p + vc * dt) % 1);
    ctx.fillStyle = css('--surface'); parts.hot.forEach((p, i) => { ctx.beginPath(); ctx.arc(x0 + p * (x1 - x0), 120 + ((i % 3) - 1) * 9, 2.2, 0, 7); ctx.fill(); });
    parts.cold.forEach((p, i) => { const X = x1 - p * (x1 - x0), Y = i % 2 ? 86 + (i % 3) * 4 : 154 - (i % 3) * 4; ctx.beginPath(); ctx.arc(X, Y, 2, 0, 7); ctx.fill(); });
    // pipes, valves, labels
    ctx.font = '600 11px ' + css('--f-mono'); ctx.fillStyle = css('--ink'); ctx.textAlign = 'center';
    const valve = (cx, cy, open, lab) => { ctx.strokeStyle = css('--ink'); ctx.fillStyle = css('--surface'); ctx.beginPath(); ctx.moveTo(cx - 14, cy - 10); ctx.lineTo(cx + 14, cy + 10); ctx.lineTo(cx + 14, cy - 10); ctx.lineTo(cx - 14, cy + 10); ctx.closePath(); ctx.fill(); ctx.stroke(); const o = Math.max(0, Math.min(1, open / 1.6e-3)); ctx.fillStyle = css('--hv'); ctx.fillRect(cx - 14, cy + 16, 28 * o, 4); ctx.strokeRect(cx - 14, cy + 16, 28, 4); ctx.fillStyle = css('--muted'); ctx.font = '10px ' + css('--f-mono'); ctx.fillText(lab, cx, cy - 16); };
    ctx.strokeStyle = tcol(75); ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(10, 120); ctx.lineTo(x0, 120); ctx.stroke(); ctx.strokeStyle = tcol(x[0]); ctx.beginPath(); ctx.moveTo(x1, 120); ctx.lineTo(W - 10, 120); ctx.stroke();
    ctx.strokeStyle = tcol(16); ctx.beginPath(); ctx.moveTo(W - 60, 40); ctx.lineTo(W - 60, sh[0]); ctx.stroke(); ctx.strokeStyle = tcol(x[3]); ctx.beginPath(); ctx.moveTo(60, sh[1]); ctx.lineTo(60, H - 20); ctx.stroke();
    valve(48, 120, x[1], 'hot valve x₂'); valve(W - 60, 34, x[4], 'cold valve x₅');
    ctx.font = '600 12px ' + css('--f-mono'); ctx.fillStyle = css('--ink');
    ctx.textAlign = 'right'; ctx.fillText('T₂ = ' + x[0].toFixed(2) + ' °C →', W - 8, 104); ctx.textAlign = 'left'; ctx.fillText('← T₄ = ' + x[3].toFixed(2) + ' °C', 70, H - 26);
    ctx.fillStyle = css('--muted'); ctx.font = '10px ' + css('--f-mono'); ctx.fillText('hot in 75 °C', 8, 146); ctx.textAlign = 'right'; ctx.fillText('cold in 16 °C', W - 70, 56);
    ctx.textAlign = 'center'; ctx.fillText('shell: cold water ←', (x0 + x1) / 2, sh[0] - 6); ctx.fillText('tube: hot water →', (x0 + x1) / 2, sh[1] + 14);
    $('#hx-stat').textContent = `t = ${t.toFixed(1)} s`;
  }

  /* ---------- charts ---------- */
  const roll = U.Roll($('#roll'), { height: 230, span: 15, dt: 0.05, lanes: [
    { name: 'temperature °C', h: 1.3, dp: 1, s: [{ key: 'T2', label: 'T₂', color: '--hv' }, { key: 'r1', label: 'T₂ ref', color: '--hv', dash: 1, w: 1 }, { key: 'T4', label: 'T₄', color: '--sig' }, { key: 'r2', label: 'T₄ ref', color: '--sig', dash: 1, w: 1 }] },
    { name: 'valve current mA', h: 1, dp: 2, s: [{ key: 'u1', label: 'u₁ hot', color: '--violet' }, { key: 'u2', label: 'u₂ cold', color: '--ink' }] }] });
  const oroll = U.Roll($('#obsroll'), { height: 260, span: 15, dt: 0.05, lanes: [
    { name: 'x₂ hot valve ×10³', dp: 2, s: [{ key: 'x2', label: 'x₂ real', color: '--hv', w: 2.4 }, { key: 'h2', label: 'x̂₂ estimated', color: '--ink', dash: 1 }] },
    { name: 'x₅ cold valve ×10³', dp: 2, s: [{ key: 'x5', label: 'x₅ real', color: '--sig', w: 2.4 }, { key: 'h5', label: 'x̂₅ estimated', color: '--ink', dash: 1 }] },
    { name: '|e| = ‖x − x̂‖ (scaled)', dp: 2, s: [{ key: 'e', label: 'estimation error', color: '--violet' }] }] });
  const troll = U.Roll($('#tsroll'), { height: 150, span: 15, dt: 0.05, lanes: [{ name: 'T₂ °C', dp: 2, s: [{ key: 'nl', label: 'nonlinear', color: '--hv', w: 3.5 }, { key: 'ts', label: 'Takagi–Sugeno', color: '--ink', dash: 1 }] }] });

  /* ---------- loop architecture ---------- */
  const LA = U.Arch($('#larch'), {
    uid: 'th', w: 1120, h: 290, info: {
      ref: '<p>References T₂*, T₄*. The pre-compensator N = [C(−A+BK)⁻¹B]⁻¹ makes the closed-loop static gain 1 for the linear model.</p>',
      K: '<p>State feedback u = −K x̂ + N r, K placed for closed-loop poles {−1, −2, −3, −4, −5, −6}. Implemented in deviation from the equilibrium (x̄, ū).</p>',
      v1: '<p>Hot valve: 2nd-order actuator, ω = 2π rad/s, ξ = 0.7, gain k₀ = 0.93. States x₂ (position) and x₃ (velocity).</p>',
      v2: '<p>Cold valve: same dynamics, states x₅, x₆.</p>',
      hx: '<p>Exchanger: ẋ₁ = e₁x₂ − a₁x₁x₂ − b₁x₁ + b₁x₄, ẋ₄ = e₂x₅ − a₂x₄x₅ + b₂x₁ − b₂x₄ (bilinear terms x₁x₂, x₄x₅).</p>',
      sens: '<p>Only the two outlet temperatures are measured: y = C x = [x₁, x₄].</p>',
      obs: '<p>Luenberger observer: dx̂/dt = A x̂ + B u + L (y − C x̂), poles {−3, −6, −9, −12, −15, −18}. Reconstructs x₂, x₃, x₅, x₆.</p>'
    },
    nodes: [
      { id: 'ref', x: 10, y: 100, w: 110, h: 60, t: 'r = [T₂*, T₄*]', s: '', kind: 'ctrl' }, { id: 'K', x: 170, y: 100, w: 150, h: 60, t: 'u = −K x̂ + N r', s: '', kind: 'ctrl' },
      { id: 'v1', x: 380, y: 40, w: 130, h: 54, t: 'Hot valve', s: 'x₂, x₃', kind: 'hv' }, { id: 'v2', x: 380, y: 166, w: 130, h: 54, t: 'Cold valve', s: 'x₅, x₆' },
      { id: 'hx', x: 570, y: 90, w: 160, h: 80, t: 'Exchanger', s: 'nonlinear', kind: 'hv' }, { id: 'sens', x: 790, y: 100, w: 130, h: 60, t: 'Sensors', s: 'T₂, T₄' },
      { id: 'obs', x: 470, y: 236, w: 200, h: 46, t: 'Luenberger observer', s: 'x̂ (6 states)', kind: 'ctrl' }],
    edges: [
      { id: 'e1', type: 'sig', d: 'M120 130 H168' }, { id: 'e2', type: 'sig', d: 'M320 120 H350 V67 H378', label: 'u₁', lx: 356, ly: 60 }, { id: 'e3', type: 'sig', d: 'M320 140 H350 V193 H378', label: 'u₂', lx: 356, ly: 210 },
      { id: 'e4', type: 'th', d: 'M510 67 H540 V115 H568', label: 'hot flow', lx: 520, ly: 58 }, { id: 'e5', type: 'th', d: 'M510 193 H540 V145 H568', label: 'cold flow', lx: 520, ly: 212 },
      { id: 'e6', type: 'th', d: 'M730 130 H788' }, { id: 'e7', type: 'lv', d: 'M855 160 V259 H672', label: 'y = [T₂, T₄]', lx: 760, ly: 252 },
      { id: 'e8', type: 'lv', d: 'M470 259 H245 V162', label: 'x̂', lx: 360, ly: 252 }, { id: 'e9', type: 'sig', d: 'M335 140 V200 H500 V234', label: 'u', lx: 420, ly: 196, arrow: true }]
  }, $('#linfo'));
  ['e1', 'e2', 'e3', 'e4', 'e5', 'e6', 'e7', 'e8', 'e9'].forEach(k => LA.flow(k, 0.5));
  const mat = (M, d) => M.map(r => '[ ' + r.map(v => (Math.abs(v) < 1e-12 ? 0 : v).toPrecision(d || 4).padStart(10)).join(' ') + ' ]').join('<br>');
  $('#eq1').innerHTML = U.eqPanel('Engineering equations · model, linearisation, gains', `
    <span class="r">ẋ₁ = e₁x₂ − a₁x₁x₂ − b₁x₁ + b₁x₄          ẋ₄ = e₂x₅ − a₂x₄x₅ + b₂x₁ − b₂x₄</span>
    <span class="r">ẋ₂ = x₃, ẋ₃ = −ω²x₂ − 2ξωx₃ + k₀ω²u₁      ẋ₅ = x₆, ẋ₆ = −ω²x₅ − 2ξωx₆ + k₀ω²u₂</span>
    <span class="r">a₁ = 552.59, a₂ = 92.10, b₁ = 0.2856, b₂ = 0.0952, e₁ = 41 444, e₂ = 1 473.6, k₀ = 0.93, ω = 2π, ξ = 0.7</span>
    <span class="r">Equilibrium (60 °C, 40 °C): x̄₂ = ${G.xe[1].toExponential(3)}, x̄₅ = ${G.xe[4].toExponential(3)}, ū = [${G.ue.map(v => v.toExponential(3)).join(', ')}] A</span>
    <span class="r">Open-loop eigenvalues: −0.124, −0.717, −4.40 ± 4.49j (×2) → stable</span>
    <span class="r">A =</span><span class="r">${mat(G.A)}</span>
    <span class="r">K =</span><span class="r">${mat(G.K, 3)}</span>
    <span class="r">L =</span><span class="r">${mat(G.L, 3)}</span>
    <span class="r">rank 𝒞 = 6, rank 𝒪 = 6 → controllable and observable</span>`);
  $('#eq2').innerHTML = U.eqPanel('Engineering equations · Takagi–Sugeno', `
    <span class="r">z₁ = x₂, z₂ = x₅ ∈ [${Z.lo.toExponential(0)}, ${Z.hi.toExponential(0)}]</span>
    <span class="r">μ₂₀ = (z₁,max − z₁)/(z₁,max − z₁,min),  μ₂₁ = 1 − μ₂₀   (same for z₂ → μ₅₀, μ₅₁)</span>
    <span class="r">m₁ = μ₂₀μ₅₀,  m₂ = μ₂₁μ₅₀,  m₃ = μ₂₀μ₅₁,  m₄ = μ₂₁μ₅₁,   Σ mᵢ = 1</span>
    <span class="r">ẋ = Σᵢ mᵢ(z) Aᵢ x + B u,   Aᵢ = A(z) at the corners of the premise domain</span>
    <span class="r">A(z): a₁₁ = −(a₁z₁ + b₁), a₁₂ = e₁, a₄₄ = −(a₂z₂ + b₂), a₄₅ = e₂  → exact inside the domain</span>`);

  /* ---------- T–S views ---------- */
  const tp = U.canvas($('#tsplane'), 300), tb = U.canvas($('#tsbars'), 150); const trail = [];
  function drawTS() {
    let { w: W, h: H } = tp.fit(), ctx = tp.ctx; ctx.clearRect(0, 0, W, H);
    const m = 40, S = Math.min(W - 2 * m, H - 2 * m), ox = (W - S) / 2, oy = (H - S) / 2;
    const X = z => ox + (z - Z.lo) / (Z.hi - Z.lo) * S, Y = z => oy + S - (z - Z.lo) / (Z.hi - Z.lo) * S;
    const wts = weights(x);
    ctx.strokeStyle = css('--ink'); ctx.strokeRect(ox, oy, S, S);
    [[Z.lo, Z.lo], [Z.hi, Z.lo], [Z.lo, Z.hi], [Z.hi, Z.hi]].forEach(([a, b], i) => { ctx.fillStyle = css(['--sig', '--hv', '--violet', '--warn'][i]); ctx.beginPath(); ctx.arc(X(a), Y(b), 8 + 22 * wts[i], 0, 7); ctx.globalAlpha = .3; ctx.fill(); ctx.globalAlpha = 1; ctx.beginPath(); ctx.arc(X(a), Y(b), 5, 0, 7); ctx.fill(); ctx.fillStyle = css('--ink'); ctx.font = '600 11px ' + css('--f-mono'); ctx.textAlign = 'center'; ctx.fillText('A' + (i + 1), X(a) + (a === Z.lo ? -16 : 16), Y(b) + (b === Z.lo ? 18 : -10)); });
    trail.push([x[1], x[4]]); if (trail.length > 400) trail.shift();
    ctx.strokeStyle = css('--muted'); ctx.lineWidth = 1.2; ctx.beginPath(); trail.forEach((p, i) => i ? ctx.lineTo(X(p[0]), Y(p[1])) : ctx.moveTo(X(p[0]), Y(p[1]))); ctx.stroke();
    ctx.fillStyle = css('--ink'); ctx.beginPath(); ctx.arc(X(Math.min(Z.hi, Math.max(Z.lo, x[1]))), Y(Math.min(Z.hi, Math.max(Z.lo, x[4]))), 5, 0, 7); ctx.fill();
    ctx.fillStyle = css('--muted'); ctx.font = '10px ' + css('--f-mono'); ctx.textAlign = 'center'; ctx.fillText('z₁ = x₂ (hot valve)', ox + S / 2, oy + S + 30); ctx.save(); ctx.translate(ox - 26, oy + S / 2); ctx.rotate(-Math.PI / 2); ctx.fillText('z₂ = x₅ (cold valve)', 0, 0); ctx.restore();
    ({ w: W, h: H } = tb.fit()); ctx = tb.ctx; ctx.clearRect(0, 0, W, H);
    wts.forEach((v, i) => { const y = 10 + i * 34; ctx.fillStyle = css('--sunk'); ctx.fillRect(60, y, W - 120, 22); ctx.fillStyle = css(['--sig', '--hv', '--violet', '--warn'][i]); ctx.fillRect(60, y, (W - 120) * v, 22); ctx.fillStyle = css('--ink'); ctx.font = '600 11px ' + css('--f-mono'); ctx.textAlign = 'left'; ctx.fillText('m' + (i + 1), 20, y + 15); ctx.textAlign = 'right'; ctx.fillText(v.toFixed(3), W - 10, y + 15); });
    $('#msum').textContent = 'm₁ + m₂ + m₃ + m₄ = ' + wts.reduce((a, b) => a + b, 0).toFixed(3);
  }

  /* ---------- vehicle thermal application ---------- */
  const VT = U.Arch($('#vth'), {
    uid: 'vt', w: 1120, h: 260, info: {},
    nodes: [
      { id: 'ecu', x: 460, y: 10, w: 200, h: 50, t: 'Thermal mgmt ECU', s: 'MIMO control', kind: 'ctrl' },
      { id: 'bat', x: 10, y: 120, w: 140, h: 60, t: 'HV battery', s: 'cold plate', kind: 'hv' }, { id: 'pump', x: 200, y: 120, w: 110, h: 60, t: 'Coolant pump', s: '' },
      { id: 'chil', x: 360, y: 120, w: 140, h: 60, t: 'Chiller', s: 'heat exchanger', kind: 'hv' }, { id: 'valve', x: 550, y: 120, w: 120, h: 60, t: '3-way valves', s: 'actuators' },
      { id: 'ptc', x: 720, y: 120, w: 120, h: 60, t: 'Coolant heater', s: 'HV PTC' }, { id: 'rad', x: 890, y: 120, w: 120, h: 60, t: 'Radiator', s: '' },
      { id: 'comp', x: 360, y: 210, w: 140, h: 40, t: 'e-Compressor', s: '' }, { id: 'cab', x: 720, y: 210, w: 160, h: 40, t: 'Cabin HVAC', s: '' }],
    edges: [
      { id: 'w1', type: 'th', d: 'M150 150 H198' }, { id: 'w2', type: 'th', d: 'M310 150 H358' }, { id: 'w3', type: 'th', d: 'M500 150 H548' }, { id: 'w4', type: 'th', d: 'M670 150 H718' }, { id: 'w5', type: 'th', d: 'M840 150 H888' },
      { id: 'w6', type: 'th', d: 'M950 180 V200 H80 V182', label: 'coolant return', lx: 520, ly: 196 }, { id: 'r1', type: 'th', d: 'M430 208 V182', label: 'refrigerant', lx: 436, ly: 200, anchor: 'start' },
      { id: 's1', type: 'lv', d: 'M610 60 V118', label: 'valve cmd', lx: 616, ly: 95, anchor: 'start' }, { id: 's2', type: 'lv', d: 'M480 60 V90 H80 V118', label: 'T sensors', lx: 250, ly: 84 }, { id: 's3', type: 'lv', d: 'M640 60 V90 H780 V118' }]
  });
  ['w1', 'w2', 'w3', 'w4', 'w5', 'w6', 'r1', 's1', 's2', 's3'].forEach(k => VT.flow(k, .5));
  const WH = [['Battery', 'Battery temperature window', ['bat', 'pump', 'chil', 'valve', 'ecu', 'comp'], 'Two coupled loops (coolant and refrigerant) with valve actuators: the same MIMO structure as the exchanger — two outlet temperatures controlled by two valves with second-order dynamics.'],
    ['Cabin', 'HVAC / cabin comfort', ['cab', 'ptc', 'comp', 'ecu'], 'Heater and A/C compete for the same HV energy; a model-based multivariable controller avoids loops fighting each other.'],
    ['Powertrain', 'Inverter & motor cooling', ['rad', 'pump', 'valve', 'ecu'], 'Coolant flow split between radiator and components; nonlinear flow × temperature terms are exactly the bilinear terms x₁x₂, x₄x₅ handled by the T–S model.'],
    ['Estimation', 'Observers for unmeasured states', ['ecu', 'valve'], 'Valve positions and internal temperatures are often not measured: an observer reconstructs them from the available sensors, as in section 02.']];
  const wh = $('#where'); wh.innerHTML = WH.map((x, i) => `<button type="button" data-i="${i}" aria-pressed="false"><b>${x[0]}</b>${x[1]}</button>`).join('') + '<div class="infopanel" id="whi" style="grid-column:1/-1">Select an application to highlight the components it uses.</div>';
  wh.querySelectorAll('button').forEach(b => b.onclick = () => { const on = b.getAttribute('aria-pressed') !== 'true'; wh.querySelectorAll('button').forEach(z => z.setAttribute('aria-pressed', false)); b.setAttribute('aria-pressed', on); const it = WH[+b.dataset.i]; VT.highlight(on ? it[2] : null); $('#whi').innerHTML = on ? it[3] : 'Select an application.'; });

  /* ---------- loop ---------- */
  const xsEl = $('#xs');
  U.loop($('#hx'), dt => {
    const n = Math.round(dt * S.speed / 0.01); for (let i = 0; i < Math.max(1, n); i++) step(0.01);
    drawHX(dt * S.speed);
    roll.push(t, { T2: x[0], T4: x[3], r1: S.r[0], r2: S.r[1], u1: u[0] * 1e3, u2: u[1] * 1e3 });
    const e = Math.sqrt(((x[0] - xh[0]) / 2) ** 2 + ((x[3] - xh[3]) / 2) ** 2 + ((x[1] - xh[1]) * 1e3) ** 2 + ((x[4] - xh[4]) * 1e3) ** 2 + ((x[2] - xh[2]) * 1e2) ** 2 + ((x[5] - xh[5]) * 1e2) ** 2);
    oroll.push(t, { x2: x[1] * 1e3, h2: xh[1] * 1e3, x5: x[4] * 1e3, h5: xh[4] * 1e3, e });
    troll.push(t, { nl: x[0], ts: xt[0] });
    drawTS();
    const lab = ['T₂ (meas.)', 'X_vc (est.)', 'Ẋ_vc (est.)', 'T₄ (meas.)', 'X_vf (est.)', 'Ẋ_vf (est.)'];
    xsEl.innerHTML = x.map((v, i) => `<div><span>x${i + 1} ${lab[i]}</span><b style="font-size:.95rem">${i === 0 || i === 3 ? v.toFixed(2) : (xh[i] * 1e3).toFixed(3)}</b><small>${i === 0 || i === 3 ? '°C' : '×10⁻³'}</small></div>`).join('');
    LA.val('K', 'u = [' + u.map(v => (v * 1e3).toFixed(2)).join(', ') + '] mA'); LA.val('hx', 'T₂ ' + x[0].toFixed(1) + ' · T₄ ' + x[3].toFixed(1) + ' °C'); LA.val('ref', S.r.map(v => v.toFixed(0)).join(' / ') + ' °C');
  });
});
