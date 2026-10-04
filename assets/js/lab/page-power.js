document.addEventListener('DOMContentLoaded', () => {
  const U = UI, css = U.css, $ = s => document.querySelector(s), TAU = Math.PI * 2, P = MOD.paintLanes;

  /* ================= BUCK ================= */
  U.Arch($('#buckarch'), {
    uid: 'bk', w: 1120, h: 230, info: {
      vin: '<p>Input rail 6–24 V (bench supply or 12 V vehicle network).</p>', mcu: '<p>RP2040: PWM generation, ADC sampling of V<sub>out</sub> and I<sub>out</sub>, PI voltage loop in C, set-point over CAN.</p>',
      drv: '<p>Gate drive for the high-side MOSFET; a second cascaded MOSFET separates control and power stages.</p>', sw: '<p>Power MOSFET + freewheeling diode (next step: synchronous low-side MOSFET).</p>',
      lc: '<p>LC output filter: L sets the current ripple, C (with its ESR) the voltage ripple.</p>', load: '<p>Load under test.</p>', can: '<p>CAN interface: the bench controller commands the output voltage.</p>'
    },
    nodes: [{ id: 'vin', x: 10, y: 60, w: 100, h: 56, t: 'V_in', s: '6–24 V', kind: 'hv' }, { id: 'sw', x: 330, y: 60, w: 130, h: 56, t: 'MOSFET + diode', s: 'switch node', kind: 'hv' },
      { id: 'lc', x: 520, y: 60, w: 130, h: 56, t: 'L-C filter', s: '' , kind: 'hv' }, { id: 'load', x: 710, y: 60, w: 110, h: 56, t: 'Load', s: '' },
      { id: 'drv', x: 330, y: 160, w: 130, h: 50, t: 'Gate driver', s: '' }, { id: 'mcu', x: 520, y: 160, w: 160, h: 50, t: 'RP2040', s: 'PWM · ADC · PI', kind: 'ctrl' }, { id: 'can', x: 900, y: 160, w: 110, h: 50, t: 'CAN', s: 'set-point', kind: 'can' }],
    edges: [{ id: 'a', type: 'hv', d: 'M110 88 H328' }, { id: 'b', type: 'hv', d: 'M460 88 H518', label: 'v_sw', lx: 489, ly: 80 }, { id: 'c', type: 'hv', d: 'M650 88 H708', label: 'V_out', lx: 679, ly: 80 },
      { id: 'd', type: 'lv', d: 'M520 185 H462', label: 'PWM', lx: 491, ly: 178 }, { id: 'e', type: 'lv', d: 'M395 160 V118' }, { id: 'f', type: 'lv', d: 'M765 116 V185 H682', label: 'V, I sense', lx: 720, ly: 178 }, { id: 'g', type: 'can', d: 'M898 185 H860 V200 H682' }]
  }, $('#buckinfo'));
  const B = { vin: 12, vref: 5, rl: 2.5, L: 47e-6, f: 100e3, C: 220e-6, esr: 0.02, step: false };
  [['vin', 'vin', v => v + ' V', v => B.vin = v], ['vref', 'vref', v => (+v).toFixed(1) + ' V', v => B.vref = v], ['rl', 'rl', v => v + ' Ω', v => B.rl = v], ['l', 'l', v => v + ' µH', v => B.L = v * 1e-6], ['f', 'f', v => v + ' kHz', v => B.f = v * 1e3]]
    .forEach(([id, o, fmt, set]) => $('#' + id).oninput = e => { set(+e.target.value); $(`[data-o=${o}]`).textContent = fmt(e.target.value); buck(); });
  $('#bstep').onclick = () => { B.step = !B.step; $('#bstep').setAttribute('aria-pressed', B.step); buck(); };
  const bw = U.canvas($('#buckwave'), 230), bl = U.canvas($('#buckloop'), 230);
  function buck() {
    const Vo = Math.min(B.vref, B.vin * 0.95), Io = Vo / B.rl, M = Vo / B.vin, K = 2 * B.L * B.f / B.rl;
    let D = M, ccm = true; const dI = (B.vin - Vo) * D / (B.L * B.f);
    if (Io < dI / 2) { ccm = false; D = Math.sqrt(4 * K / ((2 / M - 1) ** 2 - 1)); }
    const N = 400, g = new Float32Array(N), iL = new Float32Array(N), vo = new Float32Array(N); let ipk;
    if (ccm) { const imin = Io - dI / 2; for (let n = 0; n < N; n++) { const s = n / N; g[n] = s < D ? 1 : 0; iL[n] = s < D ? imin + dI * s / D : imin + dI - dI * (s - D) / (1 - D); } ipk = Io + dI / 2; }
    else { const ip = (B.vin - Vo) * D / (B.L * B.f), D2 = ip * B.L * B.f / Vo; for (let n = 0; n < N; n++) { const s = n / N; g[n] = s < D ? 1 : 0; iL[n] = s < D ? ip * s / D : s < D + D2 ? ip * (1 - (s - D) / D2) : 0; } ipk = ip; }
    let q = 0; for (let n = 0; n < N; n++) { q += (iL[n] - Io) / (N * B.f) / B.C; vo[n] = q; } const vm = vo.reduce((a, b) => a + b, 0) / N; for (let n = 0; n < N; n++) vo[n] = Vo + (vo[n] - vm) * 1e3 + (iL[n] - Io) * B.esr * 1e3;
    const st = { min: Math.min(...vo), max: Math.max(...vo) };
    P(bw, [{ name: 'gate', h: .5, min: -.2, max: 1.2, tr: [{ y: g, c: '--violet' }] }, { name: 'i_L [A]', h: 1, min: ccm ? Math.min(...iL) - dI * .4 : -.2, max: ipk + (ccm ? dI * .4 : ipk * .15), hl: [Io], tr: [{ y: iL, c: '--hv', w: 2 }] }, { name: 'V_out ripple [mV]', h: 1, min: (st.min - Vo) * 1.3, max: (st.max - Vo) * 1.3, tr: [{ y: vo.map(v => v - Vo), c: '--sig', w: 2 }] }]);
    // closed loop (averaged model)
    const T = 3e-3, h = 2e-7, steps = T / h, M2 = 600, out = { v: new Float32Array(M2), i: new Float32Array(M2), d: new Float32Array(M2), r: new Float32Array(M2) };
    let i = 0, v = 0, integ = 0, Dc = 0; const kp = 0.04, ki = 120;
    for (let k = 0; k < steps; k++) {
      const t = k * h, R = B.step && t > 1.5e-3 ? B.rl / 2 : B.rl, ref = Math.min(B.vref, t / 0.4e-3 * B.vref);
      if (k % Math.round(1 / B.f / h) === 0) { const e = ref - v; integ += e / B.f; Dc = Math.min(0.95, Math.max(0, kp * e + ki * integ)); }
      i += h * (Dc * B.vin - v - 0.05 * i) / B.L; if (i < 0) i = 0; v += h * (i - v / R) / B.C;
      const j = Math.floor(k / steps * M2); out.v[j] = v; out.i[j] = i; out.d[j] = Dc; out.r[j] = ref;
    }
    P(bl, [{ name: 'V_out [V]', h: 1.2, min: 0, max: B.vref * 1.4, tr: [{ y: out.r, c: '--muted', w: 1 }, { y: out.v, c: '--sig', w: 2 }] }, { name: 'i_L avg [A]', h: .8, min: 0, max: Math.max(...out.i) * 1.15, tr: [{ y: out.i, c: '--hv', w: 1.6 }] }, { name: 'duty', h: .6, min: 0, max: 1, tr: [{ y: out.d, c: '--violet', w: 1.4 }] }]);
    $('#buckdash').innerHTML = `<div><span>duty D</span><b>${D.toFixed(3)}</b></div><div><span>mode</span><b>${ccm ? 'CCM' : 'DCM'}</b></div><div><span>ΔI<sub>L</sub></span><b>${(ccm ? dI : ipk).toFixed(2)}</b><small>A</small></div><div><span>ΔV<sub>out</sub></span><b>${(st.max - st.min).toFixed(1)}</b><small>mV</small></div><div><span>I<sub>out</sub></span><b>${Io.toFixed(2)}</b><small>A</small></div><div><span>P<sub>out</sub></span><b>${(Vo * Io).toFixed(1)}</b><small>W</small></div>`;
  }
  buck(); U.onTheme(buck); addEventListener('resize', buck);

  /* ================= RECTIFIER ================= */
  const R = { stage: 1, D: 0.6 }; const rw = U.canvas($('#rectwave'), 300);
  document.querySelectorAll('[data-st]').forEach(b => b.onclick = () => { R.stage = +b.dataset.st; document.querySelectorAll('[data-st]').forEach(x => x.setAttribute('aria-pressed', x === b)); $('#ddl').hidden = R.stage !== 3; rect(); });
  $('#dd').oninput = e => { R.D = +e.target.value; $('[data-o=d]').textContent = R.D.toFixed(2); rect(); };
  function rect() {
    const N = 1200, Vm = 325, f = 50, va = new Float32Array(N), vb = new Float32Array(N), vc = new Float32Array(N), vd = new Float32Array(N), id = new Float32Array(N), vo = new Float32Array(N);
    for (let n = 0; n < N; n++) { const th = TAU * 2 * n / N; va[n] = Vm * Math.sin(th); vb[n] = Vm * Math.sin(th - TAU / 3); vc[n] = Vm * Math.sin(th + TAU / 3); vd[n] = Math.max(va[n], vb[n], vc[n]) - Math.min(va[n], vb[n], vc[n]); }
    const dt = 2 / f / N; let i = 0;
    for (let p = 0; p < 3; p++) for (let n = 0; n < N; n++) { if (R.stage === 1) i = vd[n] / 50; else { i += dt * (vd[n] - 5 * i - 450) / 20e-3; if (i < 0) i = 0; } if (p === 2) id[n] = i; }
    const vavg = vd.reduce((a, b) => a + b, 0) / N, Vbb = R.D / (1 - R.D) * vavg;
    let vo_ = 0; for (let n = 0; n < N; n++) { vo_ += (Vbb - vo_) * 0.01; vo[n] = vo_; }
    const lanes = [{ name: 'v_phase [V]', h: 1, min: -360, max: 360, tr: [{ y: va, c: '--hv', w: 1.2 }, { y: vb, c: '--sig', w: 1.2 }, { y: vc, c: '--violet', w: 1.2 }] }, { name: 'v_dc [V]', h: 1, min: 400, max: 580, hl: [vavg], tr: [{ y: vd, c: '--ink', w: 2 }] }, { name: R.stage === 1 ? 'i_R [A]' : 'i_RLE [A]', h: .8, min: 0, max: Math.max(...id) * 1.2 + 1, tr: [{ y: id, c: '--hv', w: 1.6 }] }];
    if (R.stage === 3) lanes.push({ name: '|V_o| buck-boost', h: .8, min: 0, max: Math.max(Vbb, vavg) * 1.2, hl: [vavg], tr: [{ y: vo, c: '--sig', w: 2 }] });
    P(rw, lanes);
    $('#rectdash').innerHTML = `<div><span>V<sub>dc</sub> avg</span><b>${vavg.toFixed(0)}</b><small>V</small></div><div><span>3√3·V<sub>m</sub>/π</span><b>${(3 * Math.sqrt(3) * Vm / Math.PI).toFixed(0)}</b><small>V</small></div><div><span>ripple</span><b>${(Math.max(...vd) - Math.min(...vd)).toFixed(0)}</b><small>V pp</small></div><div><span>ripple freq.</span><b>300</b><small>Hz</small></div>${R.stage === 3 ? `<div><span>|V<sub>o</sub>|</span><b>${Vbb.toFixed(0)}</b><small>V · ${R.D > .5 ? 'boost' : 'buck'}</small></div>` : `<div><span>load</span><b>${R.stage === 1 ? 'R 50 Ω' : 'R 5 Ω, L 20 mH, E 450 V'}</b></div>`}`;
    // diode bridge drawing
    const s = $('#rectckt'); s.innerHTML = ''; const e = (t, a) => U.el(t, a, s), c = css('--ink');
    const txt = (x, y, t, col) => { const n = e('text', { x, y }); n.textContent = t; n.style.font = '10.5px ' + css('--f-mono'); n.style.fill = col || css('--muted'); };
    ['a', 'b', 'c'].forEach((p, k) => { const y = 60 + k * 40; e('circle', { cx: 24, cy: y, r: 10, fill: 'none', stroke: css(['--hv', '--sig', '--violet'][k]) }); txt(20, y + 4, p, css(['--hv', '--sig', '--violet'][k])); e('line', { x1: 34, x2: 80 + k * 50, y1: y, y2: y, stroke: c }); e('line', { x1: 80 + k * 50, x2: 80 + k * 50, y1: 30, y2: 170, stroke: c });
      [[30, 'up'], [150, 'dn']].forEach(([yy]) => { e('path', { d: `M${74 + k * 50} ${yy + 8} L${86 + k * 50} ${yy + 8} L${80 + k * 50} ${yy - 2} Z`, fill: css('--surface'), stroke: c }); e('line', { x1: 74 + k * 50, x2: 86 + k * 50, y1: yy - 2, y2: yy - 2, stroke: c }); }); });
    e('line', { x1: 80, x2: 300, y1: 24, y2: 24, stroke: css('--hv'), 'stroke-width': 2 }); e('line', { x1: 80, x2: 300, y1: 176, y2: 176, stroke: c, 'stroke-width': 2 });
    if (R.stage === 1) { e('rect', { x: 290, y: 80, width: 20, height: 40, fill: 'none', stroke: c }); txt(316, 104, 'R'); }
    else { e('rect', { x: 290, y: 40, width: 20, height: 26, fill: 'none', stroke: c }); txt(316, 58, 'R'); e('path', { d: 'M300 66 q10 6 0 12 q10 6 0 12 q10 6 0 12', fill: 'none', stroke: c }); txt(316, 90, 'L'); e('circle', { cx: 300, cy: 130, r: 12, fill: 'none', stroke: c }); txt(316, 134, R.stage === 2 ? 'E' : 'buck-boost → V_o'); }
    e('path', { d: 'M300 24 V40 M300 102 V118 M300 142 V176', fill: 'none', stroke: c });
  }
  rect(); U.onTheme(rect); addEventListener('resize', rect);

  /* ================= VSI ================= */
  const vw = U.canvas($('#vsiwave'), 260), vh = U.canvas($('#vsiharm'), 260); let vmode = '180';
  document.querySelectorAll('[data-v]').forEach(b => b.onclick = () => { vmode = b.dataset.v; document.querySelectorAll('[data-v]').forEach(x => x.setAttribute('aria-pressed', x === b)); vsi(); });
  function vsi() {
    const N = 2400, Vdc = 400, vab = new Float32Array(N), van = new Float32Array(N), ia = new Float32Array(N);
    for (let n = 0; n < N; n++) { const th = TAU * n / N; let s; if (vmode === '180') s = [0, -TAU / 3, TAU / 3].map(p => Math.sin(th + p) >= 0 ? 1 : 0); else { const car = Math.abs(((n / N * 21 + .25) % 1) * 2 - 1) * 2 - 1; s = [0, -TAU / 3, TAU / 3].map(p => 0.9 * Math.sin(th + p) > car ? 1 : 0); } vab[n] = (s[0] - s[1]) * Vdc; van[n] = (2 * s[0] - s[1] - s[2]) / 3 * Vdc; }
    let i = 0; const dt = 1 / N; for (let p = 0; p < 3; p++) for (let n = 0; n < N; n++) { i += dt * (van[n] - 4 * i) / (6 / TAU); if (p === 2) ia[n] = i; }
    P(vw, [{ name: 'v_ab [V]', h: 1, min: -450, max: 450, tr: [{ y: vab, c: '--ink', w: 1.2 }] }, { name: 'v_an [V]', h: .9, min: -300, max: 300, tr: [{ y: van, c: '--hv', w: 1.4 }] }, { name: 'i_a (RL)', h: 1, min: -Math.max(...ia) * 1.2, max: Math.max(...ia) * 1.2, tr: [{ y: ia, c: '--sig', w: 2 }] }]);
    const dft = k => { let re = 0, im = 0; for (let n = 0; n < N; n++) { re += vab[n] * Math.cos(TAU * k * n / N); im -= vab[n] * Math.sin(TAU * k * n / N); } return 2 * Math.hypot(re, im) / N; };
    const a1 = dft(1), H = []; for (let k = 2; k <= 49; k++) H.push([k, dft(k) / a1 * 100]);
    const { w, h } = vh.fit(), ctx = vh.ctx; ctx.clearRect(0, 0, w, h); const ml = 40, pw = w - ml - 10, ph = h - 40, bw = pw / 48;
    ctx.font = '10px ' + css('--f-mono'); ctx.fillStyle = css('--muted'); ctx.textAlign = 'right'; ctx.fillText('25 %', ml - 4, 14); ctx.fillText('0', ml - 4, 10 + ph);
    H.forEach(([k, v]) => { ctx.fillStyle = css(v > 1 ? (k < 15 ? '--hv' : '--sig') : '--line'); const bh = Math.min(ph, v / 25 * ph); ctx.fillRect(ml + (k - 2) * bw + 1, 10 + ph - bh, bw - 2, bh); if (v > 3) { ctx.fillStyle = css('--ink'); ctx.textAlign = 'center'; ctx.fillText(k, ml + (k - 2) * bw + bw / 2, 10 + ph - bh - 4); } });
    ctx.fillStyle = css('--muted'); ctx.textAlign = 'left'; ctx.fillText('harmonic order 2 … 49', ml, h - 8);
    let thd = Math.sqrt(H.reduce((a, [k, v]) => a + v * v, 0)); ctx.textAlign = 'right'; ctx.fillStyle = css('--ink'); ctx.font = '600 12px ' + css('--f-mono'); ctx.fillText(`V₁ = ${a1.toFixed(0)} V · THD(≤49) = ${thd.toFixed(0)} %`, w - 10, 20);
  }
  vsi(); U.onTheme(vsi); addEventListener('resize', vsi);

  /* ================= BMS PCB ================= */
  U.Arch($('#pcbarch'), {
    uid: 'bp', w: 760, h: 330, info: {
      cells: '<p>Two Li-ion cells in series (bench prototype).</p>', div: '<p>Per-cell resistive dividers into the ADC.</p>', shunt: '<p>Shunt resistor with an op-amp amplifier for pack current.</p>', ntc: '<p>Temperature sensing.</p>',
      mcu: '<p>Arduino Nano: reads V, I, T, decides charge / discharge / balancing, drives the LCD.</p>', chg: '<p>MOSFET charge switch.</p>', dch: '<p>MOSFET discharge switch.</p>', bal: '<p>Bypass balancing: MOSFET + resistor per cell, enabled for the cell with the higher state of charge.</p>', lcd: '<p>LCD readout of cell voltages.</p>'
    },
    nodes: [{ id: 'cells', x: 10, y: 120, w: 110, h: 70, t: 'Cells 2S', s: 'Li-ion', kind: 'hv' }, { id: 'div', x: 180, y: 30, w: 120, h: 46, t: 'V dividers', s: 'per cell' }, { id: 'shunt', x: 180, y: 130, w: 120, h: 46, t: 'Shunt + op-amp', s: 'current' },
      { id: 'ntc', x: 180, y: 230, w: 120, h: 46, t: 'Temperature', s: '' }, { id: 'mcu', x: 360, y: 110, w: 140, h: 90, t: 'Arduino Nano', s: 'ADC · logic', kind: 'ctrl' }, { id: 'chg', x: 570, y: 30, w: 170, h: 46, t: 'Charge MOSFET', s: '', kind: 'hv' },
      { id: 'dch', x: 570, y: 110, w: 170, h: 46, t: 'Discharge MOSFET', s: '', kind: 'hv' }, { id: 'bal', x: 570, y: 190, w: 170, h: 46, t: 'Balancing ×2', s: 'MOSFET + R', kind: 'hv' }, { id: 'lcd', x: 570, y: 270, w: 170, h: 40, t: 'LCD', s: '' }],
    edges: [{ id: 'a', type: 'lv', d: 'M120 140 H150 V53 H178' }, { id: 'b', type: 'hv', d: 'M120 155 H178' }, { id: 'c', type: 'lv', d: 'M120 170 H150 V253 H178' }, { id: 'd', type: 'lv', d: 'M300 53 H330 V135 H358' }, { id: 'e', type: 'lv', d: 'M300 153 H358' }, { id: 'f', type: 'lv', d: 'M300 253 H330 V175 H358' },
      { id: 'g', type: 'sig', d: 'M500 130 H535 V53 H568' }, { id: 'h', type: 'sig', d: 'M500 145 H535 V133 H568' }, { id: 'i', type: 'sig', d: 'M500 165 H535 V213 H568' }, { id: 'j', type: 'sig', d: 'M500 185 H520 V290 H568' }]
  }, $('#pcbinfo'));

  /* ================= ADAS ================= */
  const AD = U.Arch($('#adasarch'), {
    uid: 'ad', w: 1120, h: 300, info: {
      cam: '<p>Camera on the vehicle prototype.</p>', pre: '<p>Frame capture and pre-processing (resizing, colour-space conversion, regions of interest) with OpenCV.</p>',
      sign: '<p>Traffic-sign detection and recognition.</p>', light: '<p>Traffic-light detection and state (red / amber / green).</p>', veh: '<p>Vehicle and pedestrian detection.</p>', lane: '<p>Lane detection to keep the prototype in its lane.</p>',
      dec: '<p>Decision logic: combines detections into a driving decision (stop, slow down, steer, warn) in real time.</p>', act: '<p>Prototype motor and steering control, plus driver alert.</p>', rpi: '<p>Raspberry Pi running the Python pipeline.</p>'
    },
    nodes: [{ id: 'cam', x: 10, y: 120, w: 110, h: 56, t: 'Camera', s: '' }, { id: 'pre', x: 170, y: 120, w: 140, h: 56, t: 'Pre-processing', s: 'OpenCV', kind: 'ctrl' },
      { id: 'sign', x: 370, y: 20, w: 170, h: 46, t: 'Traffic signs', s: '' }, { id: 'light', x: 370, y: 90, w: 170, h: 46, t: 'Traffic lights', s: '' }, { id: 'veh', x: 370, y: 160, w: 170, h: 46, t: 'Vehicles · pedestrians', s: '' }, { id: 'lane', x: 370, y: 230, w: 170, h: 46, t: 'Lane detection', s: '' },
      { id: 'dec', x: 610, y: 120, w: 150, h: 56, t: 'Decision', s: 'real time', kind: 'ctrl' }, { id: 'act', x: 820, y: 120, w: 150, h: 56, t: 'Actuation · alert', s: '', kind: 'hv' }, { id: 'rpi', x: 1000, y: 120, w: 110, h: 56, t: 'Raspberry Pi', s: 'Python' }],
    edges: [{ id: 'a', type: 'lv', d: 'M120 148 H168', label: 'frames', lx: 144, ly: 140 }, ...['sign', 'light', 'veh', 'lane'].map((k, i) => ({ id: 'p' + i, type: 'sig', d: `M310 148 H340 V${43 + i * 70} H368` })), ...['sign', 'light', 'veh', 'lane'].map((k, i) => ({ id: 'q' + i, type: 'sig', d: `M540 ${43 + i * 70} H580 V148 H608` })), { id: 'b', type: 'sig', d: 'M760 148 H818' }]
  }, $('#adasinfo'));
  ['a', 'p0', 'p1', 'p2', 'p3', 'q0', 'q1', 'q2', 'q3', 'b'].forEach(k => AD.flow(k, .5));
});
