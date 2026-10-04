/* =====================================================================
   HOME — chapter navigation, hero composition, about visuals, journey,
   career diagrams, project filter, live lab, result reports.
   ===================================================================== */
document.addEventListener('DOMContentLoaded', () => {
  const E = EV, U = UI, css = U.css, $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const NS = 'http://www.w3.org/2000/svg';
  const el = (t, a, p) => U.el(t, a, p);
  const txt = (p, x, y, s, st, anchor) => { const t = el('text', { x, y, 'text-anchor': anchor || 'start' }, p); t.textContent = s; if (st) t.setAttribute('style', st); return t; };

  /* ================= navigation: active chapter, progress, mobile sheet ================= */
  const chapters = $$('section[data-ch]'), links = $$('.chap-links a'), now = $('#nowchap'), prog = $('#navprog');
  const sheet = $('#sheet'), mb = $('#menubtn');
  sheet.innerHTML = chapters.map(s => `<a href="#${s.id}"><b>${s.dataset.ch}</b>${s.dataset.name}</a>`).join('');
  mb.onclick = () => { const o = sheet.hidden; sheet.hidden = !o; mb.setAttribute('aria-expanded', o); };
  sheet.onclick = e => { if (e.target.closest('a')) { sheet.hidden = true; mb.setAttribute('aria-expanded', false); } };
  function spy() {
    const y = scrollY + innerHeight * 0.32; let cur = null;
    chapters.forEach(s => { if (s.offsetTop <= y) cur = s; });
    links.forEach(a => a.setAttribute('aria-current', !!cur && a.getAttribute('href') === '#' + cur.id));
    now.innerHTML = cur ? `<b>${cur.dataset.ch}</b>${cur.dataset.name}` : '<b>00</b>Intro';
    const h = document.documentElement.scrollHeight - innerHeight; prog.style.width = (h > 0 ? scrollY / h * 100 : 0) + '%';
  }
  addEventListener('scroll', spy, { passive: true }); spy();
  // reveal of decorative rulers / timeline line (content itself is always visible)
  if ('IntersectionObserver' in window && !U.reduce) {
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.remove('pre'); io.unobserve(e.target); } }), { rootMargin: '-15% 0px' });
    chapters.forEach(s => { if (s.getBoundingClientRect().top > innerHeight) { s.classList.add('pre'); io.observe(s); } });
  }

  /* ================= hero: EV architecture composition ================= */
  const H = $('#evcomp');
  function hero() {
    H.innerHTML = '';
    const s = el('svg', { viewBox: '0 0 700 470', class: 'evcomp', role: 'img', 'aria-label': 'Electric vehicle: battery, BMS, inverter, motor and control network' }, H);
    const L = css('--line2'), M = css('--muted'), HV = css('--hv'), SG = css('--sig'), VI = css('--violet'), INK = css('--ink');
    // frame ticks
    [[10, 10], [690, 10], [10, 460], [690, 460]].forEach(([x, y]) => { el('path', { d: `M${x} ${y + (y < 100 ? 14 : -14)} V${y} H${x + (x < 100 ? 14 : -14)}`, fill: 'none', stroke: L }, s); });
    txt(s, 28, 30, 'SYS · EV-ARCH / REV 3', 'font:600 10px ' + css('--f-mono') + ';letter-spacing:.14em;fill:' + M);
    txt(s, 672, 30, '1 : 25', 'font:600 10px ' + css('--f-mono') + ';fill:' + M, 'end');
    // body (side view)
    el('path', { d: 'M60 300 L60 256 Q62 236 92 230 L196 216 Q246 160 314 152 L438 152 Q492 156 534 210 L600 222 Q628 228 630 254 L630 300', fill: 'none', stroke: L, 'stroke-width': 1.6 }, s);
    el('path', { d: 'M210 214 L320 162 L330 214 Z M346 214 L346 162 L432 162 Q470 166 506 212 Z', fill: 'none', stroke: L, 'stroke-width': 1 }, s);
    el('line', { x1: 30, x2: 670, y1: 340, y2: 340, stroke: L }, s);
    [160, 520].forEach(cx => { el('circle', { cx, cy: 300, r: 38, fill: css('--bg'), stroke: M, 'stroke-width': 1.4 }, s); el('circle', { cx, cy: 300, r: 14, fill: 'none', stroke: L }, s); });
    const comp = (k, build) => { const g = el('g', { class: 'comp', 'data-k': k }, s); build(g); return g; };
    comp('bat', g => { el('rect', { x: 196, y: 262, width: 252, height: 24, fill: css('--hv-soft'), stroke: HV, 'stroke-width': 1.3 }, g); for (let i = 1; i < 12; i++) el('line', { x1: 196 + i * 21, x2: 196 + i * 21, y1: 262, y2: 286, stroke: HV, 'stroke-opacity': .35 }, g); });
    comp('bms', g => { el('rect', { x: 206, y: 234, width: 56, height: 20, fill: css('--surface'), stroke: SG }, g); txt(g, 234, 248, 'BMS', 'font:600 9.5px ' + css('--f-mono') + ';fill:' + INK, 'middle'); });
    comp('dcdc', g => { el('rect', { x: 280, y: 234, width: 60, height: 20, fill: css('--surface'), stroke: M }, g); txt(g, 310, 248, 'DC/DC', 'font:600 9.5px ' + css('--f-mono') + ';fill:' + INK, 'middle'); });
    comp('inv', g => { el('rect', { x: 466, y: 232, width: 64, height: 34, fill: css('--surface'), stroke: HV, 'stroke-width': 1.3 }, g); txt(g, 498, 253, 'PIM', 'font:600 10px ' + css('--f-mono') + ';fill:' + INK, 'middle'); });
    comp('mot', g => { el('circle', { cx: 520, cy: 300, r: 22, fill: css('--surface'), stroke: HV, 'stroke-width': 1.4 }, g); const r = el('g', { class: 'rot' }, g); el('path', { d: 'M520 284 V316 M504 300 H536', stroke: HV, 'stroke-width': 1.4 }, r); });
    comp('vcu', g => { el('rect', { x: 352, y: 180, width: 60, height: 22, fill: css('--surface'), stroke: VI }, g); txt(g, 382, 195, 'VCU', 'font:600 9.5px ' + css('--f-mono') + ';fill:' + INK, 'middle'); });
    comp('can', g => { el('path', { d: 'M382 202 V222 H234 V234 M382 222 H498 V232', fill: 'none', stroke: VI, 'stroke-width': 1.3, class: 'dash-can' }, g); });
    // HV cables + signals
    el('path', { d: 'M448 274 H458 V250 H466', fill: 'none', stroke: HV, 'stroke-width': 2, class: 'dash-hv' }, s);
    el('path', { d: 'M498 266 V280 H506', fill: 'none', stroke: HV, 'stroke-width': 2, class: 'dash-hv' }, s);
    el('path', { d: 'M340 244 H352 V258', fill: 'none', stroke: HV, 'stroke-width': 1.4, class: 'dash-hv' }, s);
    el('path', { d: 'M540 290 Q560 270 530 266', fill: 'none', stroke: SG, 'stroke-width': 1.2, class: 'dash-sig' }, s);
    el('path', { d: 'M234 254 V262', fill: 'none', stroke: SG, 'stroke-width': 1.2, class: 'dash-sig' }, s);
    // leader labels
    const lab = (x1, y1, x2, y2, t1, t2, anchor) => { const s0 = el('g', { class: 'lbl' }, s); el('path', { d: `M${x1} ${y1} L${x2} ${y2} H${x2 + (anchor === 'end' ? -60 : 60)}`, fill: 'none', stroke: L }, s0); el('circle', { cx: x1, cy: y1, r: 2.5, fill: INK }, s0); const tx = x2 + (anchor === 'end' ? -60 : 0); txt(s0, tx + (anchor === 'end' ? 60 : 0), y2 - 6, t1, 'font:600 10.5px ' + css('--f-mono') + ';letter-spacing:.12em;fill:' + INK, anchor); txt(s0, tx + (anchor === 'end' ? 60 : 0), y2 + 12, t2, 'font:500 10px ' + css('--f-mono') + ';fill:' + M, anchor); };
    lab(320, 286, 290, 390, 'HV BATTERY', '96S · 400 V class', 'start');
    lab(234, 234, 120, 120, 'BMS', 'SOC · SOH · contactors', 'start');
    lab(498, 232, 560, 100, 'INVERTER / PIM', 'SPWM · SVPWM · 6-step', 'start');
    lab(520, 322, 560, 390, 'IPMSM', 'FOC · flux weakening', 'start');
    lab(382, 180, 330, 70, 'CAN / CAN-FD', 'VCU · BMS · MCU', 'start');
    // oscilloscope strip
    el('rect', { x: 30, y: 410, width: 640, height: 44, fill: 'none', stroke: L }, s);
    const clip = el('clipPath', { id: 'oscclip' }, el('defs', {}, s)); el('rect', { x: 30, y: 410, width: 640, height: 44 }, clip);
    const osc = el('g', { 'clip-path': 'url(#oscclip)' }, s);
    const wave = el('g', { class: 'oscw' }, osc);
    let d1 = '', d2 = ''; for (let x = 0; x <= 1280; x += 2) { const th = x / 160 * Math.PI * 2; const y = 432 - 15 * Math.sin(th); d1 += (x ? 'L' : 'M') + (30 + x) + ' ' + y.toFixed(1); }
    for (let x = 0; x <= 1280; x += 4) { const th = x / 160 * Math.PI * 2, car = (x / 8) % 1; const on = 0.5 + 0.45 * Math.sin(th) > Math.abs(((x / 16) % 1) * 2 - 1); d2 += (x ? 'L' : 'M') + (30 + x) + ' ' + (on ? 418 : 446); }
    el('path', { d: d2, fill: 'none', stroke: HV, 'stroke-width': 1, opacity: .35 }, wave); el('path', { d: d1, fill: 'none', stroke: SG, 'stroke-width': 1.6 }, wave);
    txt(el('g',{class:'lbl'},s), 36, 424, 'CH1 i_a · CH2 v_an', 'font:500 9px ' + css('--f-mono') + ';fill:' + M);
  }
  hero(); U.onTheme(hero);
  let osx = 0; U.loop(H, dt => { osx = (osx + dt * 70) % 640; const w = H.querySelector('.oscw'); if (w) w.setAttribute('transform', `translate(${-osx} 0)`); const r = H.querySelector('.rot'); if (r) r.setAttribute('transform', `rotate(${(performance.now() / 8) % 360} 520 300)`); });
  $$('#meta button').forEach(b => {
    const on = () => { const svg = H.querySelector('svg'); svg.classList.add('focus'); const ks = b.dataset.k.split(' '); svg.querySelectorAll('.comp').forEach(c => c.classList.toggle('on', ks.includes(c.dataset.k))); };
    const off = () => { const svg = H.querySelector('svg'); svg.classList.remove('focus'); svg.querySelectorAll('.comp').forEach(c => c.classList.remove('on')); };
    b.addEventListener('mouseenter', on); b.addEventListener('focus', on); b.addEventListener('mouseleave', off); b.addEventListener('blur', off);
  });

  /* ================= about: process stepping, radar, DNA ================= */
  const steps = $$('#process .st'); let ps = 0;
  setInterval(() => { steps.forEach((s, i) => s.classList.toggle('on', i === ps)); ps = (ps + 1) % steps.length; }, U.reduce ? 1e9 : 1300);
  const PROFILE = [
    ['Automotive', .9, 'HV safety integration for Stellantis · EV battery management internship · ADAS prototype'],
    ['Embedded', .85, 'RP2040 / STM32 firmware in C · PIO-based CAN / CAN-FD · drivers and HAL'],
    ['Control', .85, 'FOC and six-step for IPMSM · MIMO state feedback, observers, Takagi–Sugeno'],
    ['Electronics', .82, 'Buck converter and CAN interface PCBs · rectifier, VSI and BMS circuits'],
    ['Validation', .9, 'HV network validation · ripple and FFT analysis · scenario-based BMS tests']];
  $('#evid').innerHTML = PROFILE.map(p => `<div><b>${p[0].toUpperCase()}</b><span>${p[2]}</span></div>`).join('');
  function radar() {
    const s = $('#radar'); s.innerHTML = ''; const cx = 130, cy = 128, R = 92, n = PROFILE.length;
    const P = (i, r) => [cx + r * Math.sin(i / n * 2 * Math.PI), cy - r * Math.cos(i / n * 2 * Math.PI)];
    [.25, .5, .75, 1].forEach(f => el('polygon', { points: PROFILE.map((_, i) => P(i, R * f).join(',')).join(' '), fill: 'none', stroke: css('--line'), 'stroke-width': 1 }, s));
    PROFILE.forEach((p, i) => { el('line', { x1: cx, y1: cy, x2: P(i, R)[0], y2: P(i, R)[1], stroke: css('--line') }, s); const [x, y] = P(i, R + 18); txt(s, x, y + 4, p[0].toUpperCase(), 'font:600 9px ' + css('--f-mono') + ';letter-spacing:.1em;fill:' + css('--muted'), 'middle'); });
    el('polygon', { points: PROFILE.map((p, i) => P(i, R * p[1]).join(',')).join(' '), fill: css('--hv'), 'fill-opacity': .14, stroke: css('--hv'), 'stroke-width': 1.6 }, s);
    PROFILE.forEach((p, i) => { const [x, y] = P(i, R * p[1]); el('circle', { cx: x, cy: y, r: 3, fill: css('--hv') }, s); });
  }
  radar(); U.onTheme(radar);
  const DNA = [['Automotive', 'HV architecture, BMS, ADAS'], ['Control', 'FOC, six-step, state feedback'], ['Embedded', 'C, RP2040 PIO, drivers'], ['Electronics', 'PCB, buck, inverters'], ['EV', 'battery → wheel, regen'], ['Validation', 'ripple, FFT, verdicts'], ['Simulation', 'Simulink, Stateflow, Simscape']];
  let dnaPulse = [];
  function dna() {
    const s = $('#dna'); s.innerHTML = ''; const cx = 600, cy = 210;
    const nodes = DNA.map((d, i) => { const a = -Math.PI / 2 + i / DNA.length * 2 * Math.PI; return { x: cx + 430 * Math.cos(a), y: cy + 160 * Math.sin(a), d }; });
    for (let r = 1; r <= 3; r++) el('ellipse', { cx, cy, rx: 145 * r, ry: 54 * r, fill: 'none', stroke: css('--line'), 'stroke-dasharray': '2 6' }, s);
    nodes.forEach(n => el('line', { x1: cx, y1: cy, x2: n.x, y2: n.y, stroke: css('--line2') }, s));
    dnaPulse = nodes.map(n => el('circle', { r: 3, fill: css('--hv') }, s));
    el('rect', { x: cx - 120, y: cy - 34, width: 240, height: 68, fill: css('--bg'), stroke: css('--hv'), 'stroke-width': 1.4 }, s);
    txt(s, cx, cy - 4, 'SAAD MAHFOUDI', 'font:800 17px ' + css('--f-display') + ';font-stretch:115%;letter-spacing:.04em;fill:' + css('--ink'), 'middle');
    txt(s, cx, cy + 16, 'ELECTRICAL · EMBEDDED', 'font:600 9.5px ' + css('--f-mono') + ';letter-spacing:.16em;fill:' + css('--muted'), 'middle');
    nodes.forEach(n => { const g = el('g', {}, s); el('rect', { x: n.x - 98, y: n.y - 24, width: 196, height: 48, fill: css('--surface'), stroke: css('--line2') }, g); txt(g, n.x, n.y - 3, n.d[0].toUpperCase(), 'font:700 11.5px ' + css('--f-mono') + ';letter-spacing:.14em;fill:' + css('--ink'), 'middle'); txt(g, n.x, n.y + 13, n.d[1], 'font:500 9.5px ' + css('--f-mono') + ';fill:' + css('--muted'), 'middle'); });
    dnaPulse.nodes = nodes;
  }
  dna(); U.onTheme(dna);
  U.loop($('#dna'), () => { const t = performance.now() / 1000; (dnaPulse.nodes || []).forEach((n, i) => { const f = ((t * 0.35 + i / 7) % 1); dnaPulse[i].setAttribute('cx', 600 + (n.x - 600) * f); dnaPulse[i].setAttribute('cy', 210 + (n.y - 210) * f); dnaPulse[i].setAttribute('opacity', Math.sin(f * Math.PI)); }); });

  /* ================= background journey ================= */
  const J = [
    ['2018', 'Baccalaureate', 'Morocco', 'edu', 'Room-temperature regulation: LM35 sensor, analogue stage, then a PIC16F877 controller.', 'SENSOR → ANALOGUE STAGE → PIC16F877 → LCD'],
    ['2018–20', 'DUT GEII', 'EST Salé', 'edu', 'Electronics, microcontrollers, electrical engineering and industrial computing.', 'ELECTRONICS → MCU → AUTOMATION'],
    ['2020–21', 'Licence pro automotive', 'EST Salé', 'edu', 'Automotive embedded electronics: ECUs, multiplexed networks, diagnostics.', 'ECU → CAN / LIN → DIAGNOSTICS'],
    ['2021–24', 'Engineering degree', 'FST Mohammedia', 'edu', 'Electrical engineering and industrial control: power electronics, machines, control, embedded.', 'MODEL → CONTROL → POWER ELECTRONICS'],
    ['2023', 'ADAS prototype', 'FST Mohammedia', 'work', 'Internship: camera perception on a vehicle prototype (signs, lights, pedestrians, lanes).', 'CAMERA → OPENCV → DECISION → VEHICLE'],
    ['2024', 'EV battery management', 'Capgemini · Stellantis', 'work', 'Graduation project: Li-ion traction pack and BMS modelled in Simulink / Stateflow.', 'CELLS → PACK MODEL → SOC / SOH → STATEFLOW'],
    ['2024–25', 'Embedded test tools', 'NGE Automotive', 'work', 'CAN / CAN-FD / LIN tools on RP2040 PIO, drivers, PCB, buck converter.', 'C → PIO → TRANSCEIVER → CAN BUS'],
    ['2025–', 'HV Safety Integration', 'Capgemini · Stellantis', 'work', 'HV network validation of electric and hybrid vehicles: DC bus, ripple, FFT, capacitors.', 'HV NETWORK → ACQUISITION → FFT → VERDICT']];
  const track = $('#journey .track');
  J.forEach((j, i) => { const d = document.createElement('div'); d.className = 'jn ' + j[3]; d.tabIndex = 0; d.innerHTML = `<div class="yr">${j[0]}</div><div class="pt"></div><h4>${j[1]}</h4><div class="pl">${j[2]}</div><span class="tag">${j[3] === 'work' ? 'PROFESSIONAL' : 'EDUCATION'}</span>`; const show = () => jshow(i); d.addEventListener('mouseenter', show); d.addEventListener('focus', show); d.addEventListener('click', show); track.appendChild(d); });
  function jshow(i) { const j = J[i]; $$('.jn').forEach((n, k) => n.style.opacity = k === i ? 1 : .55);
    $('#jd1').innerHTML = `<span class="mlabel"><b>${String(i + 1).padStart(2, '0')}</b> — ${j[0]}</span><h3 style="font:800 1.6rem/1.1 var(--f-display);font-stretch:115%;text-transform:uppercase;margin-top:10px">${j[1]}</h3><p class="mlabel" style="margin-top:8px">${j[2]}</p>`;
    $('#jd2').innerHTML = `<p>${j[4]}</p><div class="chain" style="margin-top:16px">${j[5].split(' → ').map(x => `<span>${x}</span>`).join('')}</div>`; }
  jshow(7);

  /* ================= career ================= */
  const crl = $$('#crail a'), xps = $$('.xp');
  const MORPH = [
    ['HV BATTERY', 'BMS', 'DC BUS', 'PIM', 'PMSM'], ['MCU', 'FIRMWARE', 'PIO', 'TRANSCEIVER', 'CAN BUS'], ['CELLS', 'PACK MODEL', 'SOC', 'SOH', 'STATEFLOW'], ['CAMERA', 'OPENCV', 'DETECTION', 'DECISION', 'VEHICLE']];
  let mi = -1;
  function morph(k) {
    if (k === mi) return; mi = k; const s = $('#morph'); s.innerHTML = '';
    MORPH[k].forEach((t, i) => { const y = 8 + i * 28; el('rect', { x: 30, y, width: 160, height: 20, fill: css(i === 0 ? '--hv-soft' : '--bg'), stroke: css(i === 0 ? '--hv' : '--line2') }, s); txt(s, 110, y + 14, t, 'font:600 9.5px ' + css('--f-mono') + ';letter-spacing:.12em;fill:' + css('--ink'), 'middle'); if (i) el('path', { d: `M110 ${y - 8} V${y}`, stroke: css('--hv'), class: 'dash-sig' }, s); });
  }
  function cspy() { let k = 0; xps.forEach((x, i) => { if (x.getBoundingClientRect().top < innerHeight * 0.45) k = i; }); crl.forEach((a, i) => a.setAttribute('aria-current', i === k)); morph(k); }
  addEventListener('scroll', cspy, { passive: true }); cspy(); U.onTheme(() => { const k = mi; mi = -1; morph(k); });
  const chainArch = (sel, uid, nodes, edges, w, h, info, extraNodes) => U.Arch($(sel), { uid, w, h, info: info || {}, legend: true, nodes: nodes.concat(extraNodes || []), edges });
  // 01 Capgemini: architecture + analysis chain
  const A1 = U.Arch($('#xpd1'), {
    uid: 'c1', w: 1000, h: 330, info: {},
    nodes: [
      { id: 'bat', x: 10, y: 40, w: 110, h: 50, t: 'HV battery', kind: 'hv' }, { id: 'bms', x: 150, y: 40, w: 90, h: 50, t: 'BMS', kind: 'ctrl' }, { id: 'ct', x: 270, y: 40, w: 110, h: 50, t: 'Contactors', kind: 'hv' },
      { id: 'bus', x: 410, y: 40, w: 100, h: 50, t: 'DC bus', kind: 'hv' }, { id: 'pim', x: 540, y: 40, w: 120, h: 50, t: 'PIM / inverter', kind: 'hv' }, { id: 'pm', x: 690, y: 40, w: 90, h: 50, t: 'PMSM' },
      { id: 'dc', x: 340, y: 130, w: 100, h: 40, t: 'DC/DC', kind: 'hv', fs: 10.5 }, { id: 'cp', x: 455, y: 130, w: 110, h: 40, t: 'Compressor', kind: 'hv', fs: 10.5 }, { id: 'wh', x: 580, y: 130, w: 120, h: 40, t: 'Water heater', kind: 'hv', fs: 10.5 },
      { id: 't', x: 10, y: 240, w: 140, h: 46, t: 'Time domain', kind: 'ctrl', fs: 10.5 }, { id: 'f', x: 175, y: 240, w: 100, h: 46, t: 'FFT', kind: 'ctrl', fs: 10.5 }, { id: 'fd', x: 300, y: 240, w: 160, h: 46, t: 'Frequency domain', kind: 'ctrl', fs: 10.5 },
      { id: 'v', x: 485, y: 240, w: 120, h: 46, t: 'Validation', kind: 'ctrl', fs: 10.5 }, { id: 'pf', x: 630, y: 240, w: 120, h: 46, t: 'PASS / FAIL', fs: 10.5 }, { id: 'ap', x: 775, y: 240, w: 140, h: 46, t: 'Action plan', kind: 'hv', fs: 10.5 }],
    edges: [
      { id: 'a', type: 'hv', d: 'M120 65 H148' }, { id: 'b', type: 'hv', d: 'M240 65 H268' }, { id: 'c', type: 'hv', d: 'M380 65 H408' }, { id: 'd', type: 'hv', d: 'M510 65 H538' }, { id: 'e', type: 'hv', d: 'M660 65 H688', label: 'v_abc', lx: 674, ly: 57 },
      { id: 'g', type: 'hv', d: 'M460 90 V110 H390 V128' }, { id: 'h', type: 'hv', d: 'M460 90 V110 H510 V128' }, { id: 'i', type: 'hv', d: 'M460 110 H640 V128' },
      { id: 'p', type: 'lv', d: 'M460 170 V200 H80 V238', label: 'V_dc · I_dc · branch currents', lx: 270, ly: 194 },
      { id: 'q1', type: 'sig', d: 'M150 263 H173' }, { id: 'q2', type: 'sig', d: 'M275 263 H298' }, { id: 'q3', type: 'sig', d: 'M460 263 H483' }, { id: 'q4', type: 'sig', d: 'M605 263 H628' }, { id: 'q5', type: 'sig', d: 'M750 263 H773' }]
  });
  ['a', 'b', 'c', 'd', 'e', 'g', 'h', 'i', 'p', 'q1', 'q2', 'q3', 'q4', 'q5'].forEach(k => A1.flow(k, .6));
  let c1s = 0; const C1 = ['t', 'f', 'fd', 'v', 'pf', 'ap']; setInterval(() => { C1.forEach((k, i) => A1.hi(k, i === c1s, k === 'pf' ? '--ok' : '--hv')); c1s = (c1s + 1) % (C1.length + 1); }, U.reduce ? 1e9 : 800);
  // 02 NGE
  const A2 = U.Arch($('#xpd2'), {
    uid: 'c2', w: 1000, h: 200, info: {},
    nodes: [['mcu', 'Microcontroller', 'RP2040', 'ctrl'], ['fw', 'Firmware', 'C / C++', 'ctrl'], ['pio', 'PIO', 'bit timing', 'ctrl'], ['proto', 'CAN / CAN-FD', 'frames', 'can'], ['xc', 'Transceiver', 'CAN_H · CAN_L', 'can'], ['net', 'Automotive network', 'ECUs', '']]
      .map(([id, t, s, k], i) => ({ id, x: i * 165, y: 30, w: 145, h: 56, t, s, kind: k, fs: 10.5 }))
      .concat([{ id: 'pc', x: 0, y: 128, w: 145, h: 40, t: 'PC · USB / UART', fs: 10 }, { id: 'lin', x: 660, y: 128, w: 145, h: 40, t: 'LIN', kind: 'can', fs: 10 }, { id: 'osc', x: 825, y: 128, w: 145, h: 40, t: 'Oscilloscope', fs: 10 }]),
    edges: [0, 1, 2, 3, 4].map(i => ({ id: 'n' + i, type: i < 3 ? 'sig' : 'can', d: `M${i * 165 + 145} 58 H${(i + 1) * 165 - 2}` })).concat([{ id: 'u', type: 'lv', d: 'M72 128 V88' }, { id: 'l', type: 'can', d: 'M732 128 V88' }, { id: 'o', type: 'lv', d: 'M897 128 V88', label: 'measure', lx: 903, ly: 112, anchor: 'start' }])
  });
  ['n0', 'n1', 'n2', 'n3', 'n4', 'u', 'l', 'o'].forEach(k => A2.flow(k, .7));
  // CAN frame strip with field labels
  const bits = CANENC.encode({ id: 0x1A0, data: [0x0E, 0xE1, 0x04, 0x47] }); const cf = U.canvas($('#canframe'), 86); let cpos = 0, cacc = 0;
  function drawFrame() {
    const { w, h } = cf.fit(), c = cf.ctx; c.clearRect(0, 0, w, h); const n = bits.length, bw = w / n;
    let f0 = 0; for (let i = 0; i <= n; i++) { if (i === n || bits[i].f !== bits[f0].f) { const x0 = f0 * bw, x1 = i * bw; c.fillStyle = `color-mix(in srgb, ${css(CANENC.COLORS[bits[f0].f])} ${f0 <= cpos ? 45 : 14}%, ${css('--surface')})`; c.fillRect(x0, 18, x1 - x0 - 1, 22); if (x1 - x0 > 26) { c.fillStyle = css('--muted'); c.font = '600 9px ' + css('--f-mono'); c.textAlign = 'center'; c.fillText(bits[f0].f, (x0 + x1) / 2, 12); } f0 = i; } }
    c.strokeStyle = css('--violet'); c.lineWidth = 1.6; c.beginPath(); for (let i = 0; i < n; i++) { const y = bits[i].b ? 50 : 72; i ? c.lineTo(i * bw, y) : c.moveTo(0, y); c.lineTo((i + 1) * bw, y); } c.stroke();
    c.fillStyle = css('--hv'); c.fillRect(cpos * bw, 18, Math.max(2, bw), 22); c.fillRect(cpos * bw, 46, 2, 30);
    c.fillStyle = css('--muted'); c.font = '9px ' + css('--f-mono'); c.textAlign = 'right'; c.fillText(`ID 0x1A0 · 4 data bytes · ${n} bits on the wire · CRC-15 0x${bits.crcVal.toString(16).toUpperCase()} · ${bits.nstuff} stuff bit(s)`, w, h - 2);
  }
  U.loop($('#canframe'), dt => { cacc += dt * 14; if (cacc > 1) { cacc = 0; cpos = (cpos + 1) % bits.length; drawFrame(); } }); U.onTheme(drawFrame);
  const G = (items, rel) => items.map(([src, cap]) => `<button type="button" data-zoom="${src}" data-cap="${cap}"><img src="${src}" alt="${cap}" loading="lazy"><span>${cap}</span></button>`).join('');
  $('#ngegal').innerHTML = G([['assets/img/nge-bench.jpg', 'Lab bench · CAN/LIN + firmware debug'], ['assets/img/can-board-3d.jpg', 'KiCad 3D · CAN interface board'], ['assets/img/canfd-scope.jpg', 'Scope · CAN FD data phase'], ['assets/img/canfd-bit-timing.jpg', 'Scope · bit timing at BRS'], ['assets/img/buck-rp2040.jpg', 'Buck module on the RP2040']]);
  // 03 PFE, 04 ADAS chains
  const chain = (sel, uid, items) => { const n = items.length, bw = Math.floor((1000 - (n - 1) * 20) / n); const A = U.Arch($(sel), { uid, w: 1000, h: 104, legend: false, info: {}, nodes: items.map(([id, t, s, k], i) => ({ id, x: i * (bw + 20), y: 20, w: bw, h: 58, t, s, kind: k, fs: 10.5 })), edges: items.slice(1).map((_, i) => ({ id: 'e' + i, type: 'sig', d: `M${i * (bw + 20) + bw} 49 H${(i + 1) * (bw + 20) - 2}` })) }); items.slice(1).forEach((_, i) => A.flow('e' + i, .6)); return A; };
  chain('#xpd3', 'c3', [['d', 'Data', 'datasheets', ''], ['m', 'Pack model', 'cells → pack', 'hv'], ['s', 'SOC', 'coulomb · Kalman', 'ctrl'], ['h', 'SOH', 'capacity · R0', 'ctrl'], ['f', 'BMS logic', 'Stateflow', 'ctrl'], ['b', 'Balancing', 'Stateflow', 'ctrl'], ['o', 'Dashboard', 'V · I · SOC · T', '']]);
  chain('#xpd4', 'c4', [['c', 'Camera', '', ''], ['p', 'Pre-processing', 'OpenCV', 'ctrl'], ['s', 'Signs · lights', 'detection', 'ctrl'], ['v', 'Vehicles · people', 'detection', 'ctrl'], ['l', 'Lanes', 'detection', 'ctrl'], ['d', 'Decision', 'real time', 'ctrl'], ['a', 'Prototype', 'Raspberry Pi', 'hv']]);
  $$('.archsvg').forEach(s => { if (s.closest('#xpd1,#xpd2')) s.style.minWidth = '720px'; });

  /* ================= projects ================= */
  const CAT = { ev: 'EV & Powertrain', control: 'Control Systems', embedded: 'Embedded Systems', electronics: 'Electronics', thermal: 'Thermal Systems' };
  const PRJ = [
    ['IPMSM control lab', 'ev control', 'Closed-loop FOC speed control of an IPMSM with SPWM, SVPWM and six-step, plus a DC-bus voltage-utilisation controller.', 'FOC · MTPA · SVPWM · SIX-STEP', 'img:ipmsm-top.jpg', 'Live: 3 modulators, flux weakening', 'projects/motor-lab.html'],
    ['EV digital twin · PMSM + BMS', 'ev embedded', 'Battery cells, BMS supervisor, contactors, HV bus, inverter, motor and wheels in one simulated vehicle with CAN traffic.', 'BMS · EKF · CAN · REGEN', 'svg:ev', 'Battery-to-wheel, faults, FFT', 'projects/ev-twin.html'],
    ['BMS supervisor · Stateflow', 'ev embedded', 'Two 14S packs: precharge, contactors, balancing, debounced faults, EKF SOC, SOP — plus my web console for the live model.', 'STATEFLOW · EKF · FASTAPI', 'img:bmsdash-scope.jpg', '19 states · 36 transitions', 'projects/bms.html'],
    ['Six-step PMSM · Kwon–Kim–Sul', 'ev control', 'IEEE paper implemented on my SVPWM/SPWM model: dynamic overmodulation, flux weakening, voltage-reference modification.', 'SIMULINK · OVERMODULATION', 'img:sixstep-model.jpg', '+12.4 % torque at 2500 rpm', 'projects/six-step.html'],
    ['CAN / CAN-FD tool on RP2040 PIO', 'embedded', 'CAN framing on a microcontroller with no CAN controller: C frame builder, PIO state machines, interface PCB.', 'C · PIO · CAN-FD · KICAD', 'img:canfd-scope.jpg', 'ISO 11898-1 frames on the bus', 'projects/can-lab.html'],
    ['Smart buck converter', 'electronics embedded', 'PWM-commandable DC/DC rail: RP2040 control, MOSFET stage, LC filter, ADC feedback, CAN set-point.', 'RP2040 · PWM · PI LOOP', 'img:buck-bench.jpg', 'Regulated rail, ripple measured', 'projects/power-lab.html#buck'],
    ['Heat exchanger · MIMO control', 'thermal control', 'Six-state nonlinear model, linearisation, pole placement, Luenberger observer and a Takagi–Sugeno representation.', 'STATE SPACE · OBSERVER · T–S', 'svg:hx', 'Poles −1…−6 · observer −3…−18', 'projects/thermal.html'],
    ['Three-phase rectifier + buck-boost', 'electronics', 'Diode bridge with R and RLE loads, then a buck-boost chopper regulating the output (Simulink / Simscape).', 'SIMSCAPE · 6-PULSE', 'img:rect-stage3.jpg', 'V_dc ≈ 538 V, 300 Hz ripple', 'projects/power-lab.html#rect'],
    ['Three-phase VSI · 180° vs SPWM', 'electronics ev', 'Two switching strategies on the same RL load, compared through their harmonic spectra.', 'SIMSCAPE · SPWM · THD', 'img:vsi-spwm-wave.jpg', '180°: THD ≈ 31 %', 'projects/power-lab.html#vsi'],
    ['BMS circuit & PCB prototype', 'electronics', 'Two-cell bench BMS: sensing, charge/discharge MOSFETs, bypass balancing; Proteus simulation and ARES PCB.', 'PROTEUS · ARES · ARDUINO', 'img:bms-ares-pcb.jpg', 'Routed PCB', 'projects/power-lab.html#bmspcb'],
    ['IPMSM FOC in Simulink', 'control ev', 'Speed loop with MTPA, d/q PI current loops and a polar voltage limiter feeding an IPMSM plant.', 'SIMULINK · MTPA · PI', 'img:ipmsm-speed.jpg', 'Speed tracking of step references', 'projects/power-lab.html#foc'],
    ['ADAS vehicle prototype', 'embedded', 'Camera-based detection of signs, lights, vehicles, pedestrians and lanes on an embedded prototype.', 'RASPBERRY PI · OPENCV', 'svg:adas', '4 perception functions', 'projects/power-lab.html#adas']];
  const glyph = c => {
    const k = c.split(' ')[0];
    const g = { ev: '<path d="M6 30H36M36 22h20v16H36zM56 30h18" stroke="var(--line2)" fill="none"/><circle cx="92" cy="30" r="10" stroke="var(--hv)" fill="none"/><path class="fl" d="M6 30H36M56 30h26" stroke="var(--hv)" fill="none"/>',
      control: '<circle cx="12" cy="22" r="5" stroke="var(--muted)" fill="none"/><rect x="28" y="14" width="26" height="16" stroke="var(--sig)" fill="none"/><rect x="66" y="14" width="26" height="16" stroke="var(--line2)" fill="none"/><path d="M17 22h11M54 22h12M92 22h14V38H12V27" stroke="var(--line2)" fill="none"/><path class="fl" d="M92 22h14V38H12V27" stroke="var(--sig)" fill="none"/>',
      embedded: '<rect x="40" y="8" width="30" height="30" stroke="var(--violet)" fill="none"/><path d="M40 16H20M40 30H20M70 16h40M70 30h40" stroke="var(--line2)" fill="none"/><path class="fl" d="M70 23h40" stroke="var(--violet)" fill="none"/>',
      electronics: '<path d="M6 22h20l6-10 8 20 8-20 8 20 6-10h20" stroke="var(--line2)" fill="none"/><path class="fl" d="M82 22h30" stroke="var(--hv)" fill="none"/><path d="M90 12v20M96 14v16" stroke="var(--muted)"/>',
      thermal: '<rect x="10" y="12" width="96" height="22" stroke="var(--line2)" fill="none"/><path class="fl" d="M10 23h96" stroke="var(--hv)" fill="none"/><path class="fl" d="M106 15H10" stroke="var(--sig)" fill="none" opacity=".7"/>' }[k];
    return `<svg class="glyph" viewBox="0 0 116 44" aria-hidden="true">${g}</svg>`;
  };
  const bigsvg = { ev: '<svg class="full" viewBox="0 0 320 180" aria-hidden="true"><g fill="none" stroke-width="1.4"><rect x="16" y="70" width="52" height="40" stroke="var(--hv)"/><rect x="88" y="78" width="36" height="24" stroke="var(--sig)"/><rect x="144" y="70" width="44" height="40" stroke="var(--hv)"/><rect x="208" y="70" width="44" height="40" stroke="var(--hv)"/><circle cx="288" cy="90" r="20" stroke="var(--muted)"/><path class="fl" d="M68 90h20M124 90h20M188 90h20M252 90h16" stroke="var(--hv)"/><path class="fl" d="M42 40h220" stroke="var(--violet)"/><path d="M42 40v30M106 40v38M230 40v30" stroke="var(--violet)" stroke-dasharray="2 4"/></g><g style="font:600 8px var(--f-mono);fill:var(--muted)" text-anchor="middle"><text x="42" y="125">CELLS</text><text x="106" y="125">BMS</text><text x="166" y="125">DC BUS</text><text x="230" y="125">INVERTER</text><text x="288" y="125">IPMSM</text><text x="152" y="34">CAN</text></g></svg>',
    hx: '<svg class="full" viewBox="0 0 320 180" aria-hidden="true"><g fill="none" stroke-width="1.4"><rect x="40" y="60" width="240" height="60" stroke="var(--line2)"/><rect x="40" y="78" width="240" height="24" stroke="var(--muted)"/><path class="fl" d="M10 90h300" stroke="var(--hv)"/><path class="fl" d="M280 68H40M280 112H40" stroke="var(--sig)"/></g><g style="font:600 8px var(--f-mono);fill:var(--muted)"><text x="12" y="82">HOT 75 °C</text><text x="246" y="54">COLD 16 °C</text><text x="246" y="140">T4</text><text x="290" y="82">T2</text></g></svg>',
    adas: '<svg class="full" viewBox="0 0 320 180" aria-hidden="true"><g fill="none" stroke-width="1.4"><rect x="16" y="74" width="40" height="32" stroke="var(--muted)"/><rect x="80" y="74" width="54" height="32" stroke="var(--sig)"/><rect x="160" y="30" width="70" height="22" stroke="var(--line2)"/><rect x="160" y="64" width="70" height="22" stroke="var(--line2)"/><rect x="160" y="98" width="70" height="22" stroke="var(--line2)"/><rect x="160" y="132" width="70" height="22" stroke="var(--line2)"/><rect x="256" y="74" width="50" height="32" stroke="var(--hv)"/><path class="fl" d="M56 90h24M134 90h12V41h14M146 75h14M146 109h14M146 90v53h14M230 41h12V90h14M230 143h12V90" stroke="var(--sig)"/></g></svg>' };
  const filt = $('#filters'), pg = $('#pgrid');
  const counts = k => PRJ.filter(p => k === 'all' || p[1].split(' ').includes(k)).length;
  filt.innerHTML = [['all', 'All']].concat(Object.entries(CAT)).map(([k, n], i) => `<button type="button" data-f="${k}" aria-pressed="${i === 0}">${n}<sup>${counts(k)}</sup></button>`).join('');
  pg.innerHTML = PRJ.map((p, i) => {
    const vis = p[4].startsWith('img:') ? `<img src="assets/img/${p[4].slice(4)}" alt="" loading="lazy">${glyph(p[1])}` : bigsvg[p[4].slice(4)];
    return `<a class="pcard" href="${p[6]}" data-c="${p[1]}"><div class="top"><b>P${String(i + 1).padStart(2, '0')}</b><span>${p[1].split(' ').map(c => CAT[c]).join(' · ')}</span></div><div class="vis">${vis}</div><div class="body"><h3>${p[0]}</h3><p>${p[2]}</p><div class="kw"><span>${p[3].split(' · ').join('</span><span>')}</span></div></div><div class="out"><span>OUTPUT · <em>${p[5]}</em></span><span class="go">EXPLORE SYSTEM →</span></div></a>`;
  }).join('');
  filt.onclick = e => { const b = e.target.closest('button'); if (!b) return; filt.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b)); const k = b.dataset.f; pg.querySelectorAll('.pcard').forEach(c => c.hidden = !(k === 'all' || c.dataset.c.split(' ').includes(k))); };

  /* ================= technical lab ================= */
  const pt = new Powertrain({ mode: 'manual', targetKmh: 80, cycle: 'mixed', strategy: 'auto' });
  $('#lspd').oninput = e => { pt.P.targetKmh = +e.target.value; $('#lspdv').textContent = e.target.value + ' km/h'; };
  $('#lstr').onchange = e => pt.P.strategy = e.target.value;
  $$('[data-lm]').forEach(b => b.onclick = () => { pt.P.mode = b.dataset.lm; pt.tc = 0; $$('[data-lm]').forEach(x => x.setAttribute('aria-pressed', x === b)); $('#lspd').disabled = pt.P.mode === 'auto'; });
  const CH = [['bat', 'BATTERY', 'hv'], ['bms', 'BMS', 'ctrl'], ['bus', 'DC BUS', 'hv'], ['inv', 'INVERTER', 'hv'], ['mot', 'PMSM', ''], ['whl', 'WHEEL', '']];
  let CR = {};
  function chainSvg() {
    const s = $('#chainv'); s.innerHTML = ''; CR = {};
    CH.forEach(([k, t, kind], i) => {
      const y = 12 + i * 76, g = el('g', {}, s);
      const r = el('rect', { x: 80, y, width: 200, height: 52, fill: css(kind === 'hv' ? '--hv-soft' : kind === 'ctrl' ? '--sig-soft' : '--bg'), stroke: css(kind === 'hv' ? '--hv' : kind === 'ctrl' ? '--sig' : '--line2'), 'stroke-width': 1.3 }, g);
      txt(g, 96, y + 22, t, 'font:700 12px ' + css('--f-mono') + ';letter-spacing:.14em;fill:' + css('--ink'));
      CR[k] = txt(g, 96, y + 40, '—', 'font:500 10.5px ' + css('--f-mono') + ';fill:' + css('--muted'));
      txt(g, 66, y + 30, String(i + 1).padStart(2, '0'), 'font:600 10px ' + css('--f-mono') + ';fill:' + css('--line2'), 'end');
      if (i < CH.length - 1) { el('line', { x1: 180, x2: 180, y1: y + 52, y2: y + 76, stroke: css('--line2') }, s); CR['f' + i] = el('line', { x1: 180, x2: 180, y1: y + 52, y2: y + 76, stroke: css(i < 4 ? '--hv' : '--muted'), 'stroke-width': 3, class: 'flowx', 'stroke-dasharray': '4 6' }, s); }
    });
    txt(s, 300, 40, 'V', 'font:600 9px ' + css('--f-mono') + ';fill:' + css('--muted'));
  }
  chainSvg(); U.onTheme(chainSvg);
  const spark = id => { const c = $(id), ctx = c.getContext('2d'), buf = []; return { push(v) { buf.push(v); if (buf.length > 120) buf.shift(); const d = Math.min(2, devicePixelRatio || 1), w = c.clientWidth; c.width = w * d; c.height = 34 * d; ctx.setTransform(d, 0, 0, d, 0, 0); let mn = Math.min(...buf), mx = Math.max(...buf); if (mx - mn < 1e-6) { mx += 1; mn -= 1; } ctx.strokeStyle = css('--hv'); ctx.lineWidth = 1.4; ctx.beginPath(); buf.forEach((v, i) => { const x = i / 119 * w, y = 31 - (v - mn) / (mx - mn) * 28; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke(); } }; };
  const SP = { spd: spark('#ls-spd'), trq: spark('#ls-trq'), cur: spark('#ls-cur'), vdc: spark('#ls-vdc'), soc: spark('#ls-soc') };
  const lfft = U.Spectrum($('#lfft'), { height: 120, spanIdx: 1, spans: [5000, 25000, 60000], title: '' });
  const lcar = U.Car($('#lcar'), { height: 140 });
  let la = 0, ls = 0, lsp = 0;
  U.loop($('#lab'), dt => {
    la += dt; while (la > 0.005) { pt.step(0.005); la -= 0.005; }
    lcar.update({ v: pt.v, x: pt.x, P: pt.Pdc, brake: pt.Fbrake < -50, dt, label: (pt.P.mode === 'auto' ? 'auto drive cycle' : 'manual') + ' · ' + E.STRATS[pt.strat].name });
    const on = pt.bms === 'Drive', k = pt.Pdc / 90000;
    for (let i = 0; i < 5; i++) { const f = CR['f' + i]; if (!f) continue; const r = i < 4 ? k : pt.Pmech / 90000; f.setAttribute('opacity', on && Math.abs(r) > .02 ? 1 : 0); f.style.animationDirection = r < 0 ? 'reverse' : 'normal'; f.style.animationDuration = Math.max(.25, 1.6 - Math.abs(r) * 1.3) + 's'; }
    CR.bat.textContent = `${pt.Vbat.toFixed(0)} V · ${pt.Ibat.toFixed(0)} A`; CR.bms.textContent = (pt.bms === 'Drive' ? pt.sub : pt.bms) + ' · SOC ' + (pt.soc * 100).toFixed(1) + ' %';
    CR.bus.textContent = `${(pt.Pdc / 1000).toFixed(1)} kW`; CR.inv.textContent = E.STRATS[pt.strat].name + ' · M ' + pt.Mreq.toFixed(2); CR.mot.textContent = `${(pt.op ? pt.op.rpm : 0).toFixed(0)} rpm · ${pt.Tmot.toFixed(0)} Nm`; CR.whl.textContent = `${(pt.v * 3.6).toFixed(0)} km/h`;
    lsp += dt; if (lsp > 0.15) { lsp = 0;
      $('#lv-spd').innerHTML = (pt.v * 3.6).toFixed(0); $('#lv-trq').textContent = pt.Tmot.toFixed(0); $('#lv-cur').textContent = pt.Ibat.toFixed(0); $('#lv-vdc').textContent = pt.Vdc.toFixed(0); $('#lv-soc').textContent = (pt.soc * 100).toFixed(2);
      SP.spd.push(pt.v * 3.6); SP.trq.push(pt.Tmot); SP.cur.push(pt.Ibat); SP.vdc.push(pt.Vdc); SP.soc.push(pt.soc * 100); }
    ls += dt; if (ls > 0.5) { ls = 0; const W = pt.waves(4096); if (W) { const st = E.stats(W.vbus); $('#lv-rip').textContent = st.pp.toFixed(2); const sp = E.spectrum(W.vbus, W.fs, W.integer ? 'rect' : 'hann'); lfft.set(sp, { peaks: E.peaks(sp, 2, 50) }); } }
  });

  /* ================= results ================= */
  const R = [];
  const rep = (no, title, src, srcLabel, plotId, rows, status, link) => R.push(`<article class="rep"><div class="rep-h"><b><i>R${String(no).padStart(2, '0')}</i>${title}</b><span class="src ${src}">${srcLabel}</span></div><div class="plot" id="${plotId}"></div><table>${rows.map(r => `<tr><td>${r[0]}</td><td>${r[1]}</td></tr>`).join('')}</table><div class="rep-f"><span class="st" style="color:var(--${status[1]})">${status[0]}</span><a href="${link[1]}">${link[0]} →</a></div></article>`);
  // R01 DC bus validation computed now from the illustrative model
  const we = E.rpm2we(6000), op = E.operate(120, we, E.STRATS.six.vlim(380), 'fixed'); op.we = we;
  const W1 = E.synth(op, 'six', 380, 10000, { N: 8192, aux: [t => 1500 / 380 * (1 + .15 * Math.sin(2 * Math.PI * 1e5 * t)), t => 3500 / 380 * (1 + .35 * Math.sin(2 * Math.PI * 720 * t))] });
  const s1 = E.stats(W1.vbus), sp1 = E.spectrum(W1.vbus, W1.fs, 'rect'), pk1 = E.peaks(sp1, 1, 50)[0], lim1 = 0.03 * 380;
  rep(1, 'DC bus validation', 'ill', 'ILLUSTRATIVE', 'r1', [['Operating point', `6000 rpm · ${op.T.toFixed(0)} Nm · ${(op.T * 6000 * 2 * Math.PI / 60 / 1000).toFixed(0)} kW`], ['DC bus', '380 V class · C_link 500 µF'], ['Peak-to-peak ripple', s1.pp.toFixed(2) + ' V'], ['Dominant harmonic', (pk1.f / 1000).toFixed(2) + ' kHz (6·f_e)'], ['Requirement', `≤ ${lim1.toFixed(1)} V · demonstration`]], s1.pp <= lim1 ? ['PASS', 'ok'] : ['FAIL → ACTION PLAN', 'bad'], ['HV lab', 'projects/hv-validation.html']);
  // R02 SOC (real run)
  const B = window.BMS; let emax = 0; B.t.forEach((t, i) => { if (t > 49) emax = Math.max(emax, Math.abs(B.socK[i] - B.socR[i])); });
  rep(2, 'SOC estimation · EKF', 'real', 'REAL SIMULATION DATA', 'r2', [['Source', 'BMS_POC model · logged run RUN_007'], ['Pack', '2 × 14S · 100 Ah'], ['Estimator', 'EKF per cell, 1-RC model'], ['Max error vs reference', emax.toFixed(3) + ' % SOC']], ['TRACKING', 'sig'], ['BMS project', 'projects/bms.html']);
  // R03 six-step capability
  rep(3, 'Six-step capability', 'real', 'REAL SIMULATION DATA', 'r3', [['Source', 'capability_curves_data.csv'], ['Base speed', `${Math.round(SIX.kpi.baseConv)} → ${Math.round(SIX.kpi.baseSix)} rpm`], ['Torque @ 2500 rpm', '+' + SIX.kpi.dT2500.toFixed(1) + ' %'], ['Peak power', `${SIX.kpi.Pmax_c.toFixed(2)} → ${SIX.kpi.Pmax_s.toFixed(2)} kW`]], ['EXTENDED', 'hv'], ['Six-step project', 'projects/six-step.html']);
  // R04 mode hysteresis
  rep(4, 'Mode decision · hysteresis', 'real', 'REAL SIMULATION DATA', 'r4', [['Profile', 'condition 3 · 1500 rpm'], ['Geometric flag', SIX.kpi.geomTrans + ' transitions'], ['Firmware-style hysteresis', SIX.kpi.hystTrans + ' transition'], ['Thresholds', `${SIX.mode.hi.toFixed(2)} / ${SIX.mode.lo.toFixed(2)}`]], ['STABLE', 'ok'], ['Six-step project', 'projects/six-step.html#firmware']);
  // R05 PWM utilisation
  rep(5, 'PWM voltage utilisation', 'calc', 'COMPUTED', 'r5', [['V_dc', '360 V'], ['SPWM limit V_dc/2', '180 V'], ['SVPWM limit V_dc/√3', '207.8 V (+15.5 %)'], ['Six-step 2V_dc/π', '229.2 V (+27.3 %)']], ['3 REGIONS', 'hv'], ['IPMSM lab', 'projects/motor-lab.html#mod']);
  // R06 CAN frame
  rep(6, 'CAN frame encoding', 'calc', 'COMPUTED', 'r6', [['Identifier', '0x1A0 · 4 bytes'], ['Bits on the wire', bits.length + ' incl. ' + bits.nstuff + ' stuff'], ['CRC-15', '0x' + bits.crcVal.toString(16).toUpperCase()], ['Duration @ 500 kbit/s', (bits.length * 2) + ' µs']], ['VALID FRAME', 'ok'], ['CAN lab', 'projects/can-lab.html']);
  // R07 thermal
  const TT = window.THTRAJ, last = TT[TT.length - 1];
  rep(7, 'Thermal control response', 'real', 'MY MODEL · RE-SIMULATED', 'r7', [['Step at t = 1 s', 'refs T2 → 60 °C · T4 → 45 °C'], ['T2 / T4 at 10 s', `${last[1].toFixed(2)} / ${last[2].toFixed(2)} °C`], ['Closed-loop poles', '−1 … −6'], ['Observer error at 10 s', last[3].toExponential(1)]], ['CONVERGED', 'ok'], ['Thermal lab', 'projects/thermal.html']);
  // R08 Bode
  const far = 1 / (2 * Math.PI * Math.sqrt(5e-6 * 500e-6));
  rep(8, 'DC-link impedance', 'ill', 'ILLUSTRATIVE', 'r8', [['Network', 'L_b 5 µH ∥ C 500 µF, ESR 1 mΩ'], ['Anti-resonance', (far / 1000).toFixed(2) + ' kHz'], ['C self-resonance', (1 / (2 * Math.PI * Math.sqrt(20e-9 * 500e-6)) / 1000).toFixed(0) + ' kHz'], ['Use', 'keep excitations off the peak']], ['CHECK PLACEMENT', 'warn'], ['HV lab · Bode', 'projects/hv-validation.html#bode']);
  // R09 speed response (real Simulink capture)
  rep(9, 'Motor speed response', 'real', 'REAL SIMULINK CAPTURE', 'r9', [['Model', 'IPMSM FOC · MTPA'], ['Input', 'series of speed steps'], ['Loops', 'speed PI → d/q PI current'], ['Limiter', 'polar voltage limit']], ['TRACKING', 'sig'], ['Project', 'projects/power-lab.html#foc']);
  $('#rgrid').innerHTML = R.join('');
  $('#r9').innerHTML = '<button type="button" data-zoom="assets/img/ipmsm-speed.jpg" data-cap="IPMSM speed response in Simulink" style="all:unset;cursor:zoom-in;display:block"><img src="assets/img/ipmsm-speed.jpg" alt="IPMSM speed response captured from Simulink" loading="lazy"></button>';
  function plots() {
    const mini = (id, o) => { const h = $('#' + id); h.innerHTML = ''; Kit.line(Object.assign({ el: h, w: 360, h: 150 }, o)); };
    mini('r1', { x: { min: 0, max: W1.Tw * 1e3, label: 'ms', short: 't', unit: 'ms' }, y: { min: s1.min - 1, max: s1.max + 1, label: 'V_bus', ticks: 3 }, series: [{ x: Array.from(W1.t, v => v * 1e3).filter((_, i) => i % 8 === 0), y: Array.from(W1.vbus).filter((_, i) => i % 8 === 0), color: '--hv', label: 'V_bus', unit: 'V' }], hlines: [{ y: s1.mean + lim1 / 2, color: '--bad' }, { y: s1.mean - lim1 / 2, color: '--bad' }] });
    const i0 = B.t.findIndex(t => t > 48);
    mini('r2', { x: { min: 48, max: 74, label: 's', short: 't', unit: 's' }, y: { min: 99.7, max: 100.02, label: 'SOC %', ticks: 3 }, series: [{ x: B.t.slice(i0), y: B.socR.slice(i0), color: '--muted', width: 3, label: 'reference', dp: 3 }, { x: B.t.slice(i0), y: B.socK.slice(i0), color: '--sig', label: 'EKF', dp: 3 }] });
    mini('r3', { x: { min: 0, max: 2500, label: 'rpm', short: 'n', unit: 'rpm', dp: 0 }, y: { min: 20, max: 70, label: 'Nm', ticks: 3 }, series: [{ x: SIX.cap.n, y: SIX.cap.Tc, color: '--muted', label: 'linear', unit: 'Nm' }, { x: SIX.cap.n, y: SIX.cap.Ts, color: '--hv', label: 'six-step', unit: 'Nm', width: 2 }] });
    mini('r4', { x: { min: 0, max: 60, label: 'ms', short: 't', unit: 'ms' }, y: { min: -.2, max: 2.3, label: 'flag', ticks: 2 }, series: [{ x: SIX.mode.geom.map(p => p[0]), y: SIX.mode.geom.map(p => p[1] * .9 + 1.2), color: '--hv', step: true, label: 'geometric' }, { x: SIX.mode.hyst.map(p => p[0]), y: SIX.mode.hyst.map(p => p[1] * .9), color: '--sig', step: true, label: 'hysteresis', width: 2 }] });
    const th = Array.from({ length: 361 }, (_, i) => i), sv = th.map(d => { const a = d * Math.PI / 180, va = Math.cos(a), vb = Math.cos(a - 2.094), vc = Math.cos(a + 2.094); return (va - (Math.max(va, vb, vc) + Math.min(va, vb, vc)) / 2) * 207.8; });
    mini('r5', { x: { min: 0, max: 360, label: 'θ °', short: 'θ', unit: '°', dp: 0 }, y: { min: -240, max: 240, label: 'V', ticks: 3 }, series: [{ x: th, y: th.map(d => 180 * Math.cos(d * Math.PI / 180)), color: '--muted', label: 'SPWM', unit: 'V' }, { x: th, y: sv, color: '--sig', label: 'SVPWM leg ref', unit: 'V' }, { x: th, y: th.map(d => 207.8 * Math.cos(d * Math.PI / 180)), color: '--hv', label: 'SVPWM fundamental', unit: 'V', dash: '4 3' }], hlines: [{ y: 180, color: '--muted' }, { y: -180, color: '--muted' }] });
    const h6 = $('#r6'); h6.innerHTML = ''; const cv = U.canvas(h6, 140); const { w } = cv.fit(), c = cv.ctx, bw = w / bits.length;
    bits.forEach((b, i) => { c.fillStyle = `color-mix(in srgb, ${css(CANENC.COLORS[b.f])} 40%, ${css('--surface')})`; c.fillRect(i * bw, 30, bw - .5, 30); });
    c.strokeStyle = css('--violet'); c.lineWidth = 1.5; c.beginPath(); bits.forEach((b, i) => { const y = b.b ? 80 : 110; i ? c.lineTo(i * bw, y) : c.moveTo(0, y); c.lineTo((i + 1) * bw, y); }); c.stroke();
    c.fillStyle = css('--muted'); c.font = '9px ' + css('--f-mono'); c.fillText('SOF · ID · CTRL · DATA · CRC · ACK · EOF', 0, 20); c.fillText('recessive 1', 0, 76); c.fillText('dominant 0', 0, 126);
    mini('r7', { x: { min: 0, max: 10, label: 's', short: 't', unit: 's' }, y: { min: 38, max: 63, label: '°C', ticks: 3 }, series: [{ x: TT.map(r => r[0]), y: TT.map(r => r[1]), color: '--hv', label: 'T2', unit: '°C' }, { x: TT.map(r => r[0]), y: TT.map(r => r[2]), color: '--sig', label: 'T4', unit: '°C' }] });
    const fs = Array.from({ length: 160 }, (_, i) => 10 * 10 ** (i / 160 * 5)), Z = fs.map(f => { const w = 2 * Math.PI * f; const zc = [1e-3, w * 20e-9 - 1 / (w * 500e-6)], zb = [0.03, w * 5e-6]; const nr = zc[0] * zb[0] - zc[1] * zb[1], ni = zc[0] * zb[1] + zc[1] * zb[0], dr = zc[0] + zb[0], di = zc[1] + zb[1]; return Math.hypot(nr, ni) / Math.hypot(dr, di) * 1000; });
    mini('r8', { x: { min: 1, max: 6, label: 'log₁₀ f', short: 'log f', unit: '' }, y: { min: -1, max: 2.8, label: 'log |Z| mΩ', ticks: 3 }, series: [{ x: fs.map(f => Math.log10(f)), y: Z.map(z => Math.log10(z)), color: '--hv', label: 'log|Z|', dp: 2 }] });
  }
  plots(); U.onTheme(plots);
});
