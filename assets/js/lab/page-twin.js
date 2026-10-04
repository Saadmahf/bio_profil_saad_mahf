document.addEventListener('DOMContentLoaded', () => {
  const E = EV, U = UI, css = U.css;
  const rig = Rig(document.getElementById('ctrl'), { id: 'tw', aux: true, faults: true });
  const pt = rig.pt;
  const car = U.Car(document.getElementById('car'), { height: 170 });
  const dash = Dash(document.getElementById('dash'), ['v', 'rpm', 'T', 'P', 'Vb', 'Ib', 'Vdc', 'soc', 'st', 'bms']);
  const roll = U.Roll(document.getElementById('roll'), { height: 220, span: 60, lanes: [
    { name: 'speed km/h', h: .8, s: [{ key: 'v', label: 'vehicle speed', color: '--ink' }, { key: 'vr', label: 'reference', color: '--muted', dash: 1 }] },
    { name: 'I_bat A', h: 1, s: [{ key: 'I', label: 'battery current (+ = discharge)', color: '--hv' }] },
    { name: 'V_bat V', h: .8, s: [{ key: 'V', label: 'pack voltage', color: '--sig' }] }] });
  rig.on((p, dt) => {
    car.update({ v: p.v, x: p.x, P: p.Pdc, brake: p.Fbrake < -50, dt, label: (p.P.mode === 'auto' ? 'auto · ' + p.P.cycle : 'manual') + ' · BMS ' + (p.bms === 'Drive' ? p.sub : p.bms) });
    dash.update(p);
    roll.push(p.t, { v: p.v * 3.6, vr: p.vref * 3.6, I: p.Ibat, V: p.Vbat });
    const pill = document.getElementById('bmspill');
    const cls = p.bms === 'Fault' ? 'bad' : p.sub === 'Regen' ? 'ok' : p.bms === 'Drive' ? 'hv' : 'sig';
    pill.innerHTML = `<span class="pill ${cls}">${p.bms === 'Drive' ? p.sub.toUpperCase() : p.bms.toUpperCase()}</span>`;
  });

  /* ---------------- system architecture ---------------- */
  const INFO = {
    cells: () => `<p>96 Li-ion cells in series, 120 Ah (illustrative). OCV-SOC curve and 1-RC parameters reuse the cell table from my BMS model.</p><p class="mono">OCV ${pt.packOCV().toFixed(0)} V · I ${pt.Ibat.toFixed(0)} A · SOC ${(pt.soc * 100).toFixed(2)} %</p>`,
    cmu: '<p>Cell monitoring: every cell voltage and a set of temperatures, sent to the BMS controller on an isolated LV link.</p>',
    bms: () => `<p>BMS controller: state machine (standby → precharge → drive → fault), SOC estimation (EKF), charge-current limit, regen blocking near full charge and passive balancing (ΔV &gt; 20 mV, V<sub>max</sub> &gt; 4.00 V).</p><p class="mono">state ${pt.bms} · I_chg limit ${(pt.Ichg || 0).toFixed(0)} A · regen ${pt.regenBlk ? 'blocked' : 'allowed'}</p>`,
    isens: '<p>Pack current sensor (shunt or Hall). Feeds coulomb counting, the EKF and the over-current protection (|I| &gt; 520 A, illustrative).</p>',
    cont: () => `<p>Main contactors K+ / K− and the precharge relay with its resistor. The bus is charged through the resistor until V<sub>link</sub> ≥ 95 % of the pack voltage (minimum 0.5 s, timeout 5 s), then the main contactor closes.</p><p class="mono">${pt.bms === 'Drive' ? 'K+ closed · KP open' : pt.bms === 'Precharge' ? 'K− closed · KP closed · K+ open' : 'all open'}</p>`,
    bus: () => `<p>HV DC bus shared by the traction inverter and the auxiliaries.</p><p class="mono">V_dc ${pt.Vdc.toFixed(0)} V</p>`,
    clink: '<p>DC-link capacitor: supplies the high-frequency part of the inverter current. Its sizing is studied in the <a href="hv-validation.html#cap">HV validation lab</a>.</p>',
    inv: () => `<p>Power inverter module (PIM). Strategy chosen by the DC-bus utilisation controller: <b>${E.STRATS[pt.strat].name}</b>.</p>`,
    mot: () => `<p>IPMSM, 8 poles. ${pt.op ? `${pt.op.rpm.toFixed(0)} rpm, i_d ${pt.op.id.toFixed(0)} A, i_q ${pt.op.iq.toFixed(0)} A, T ${pt.Tmot.toFixed(0)} Nm` : ''}</p><p><a href="motor-lab.html">Open the IPMSM control lab →</a></p>`,
    gear: '<p>Reduction gear 9:1.</p>', whl: '<p>Wheels, r = 0.31 m. During braking, the share regen cannot absorb goes to the friction brakes.</p>',
    pedal: '<p>Driver inputs: accelerator and brake pedal positions (analogue / redundant tracks), read by the VCU.</p>',
    vcu: '<p>Vehicle control unit: turns pedal position (or the cycle) into a speed / torque request, arbitrates with the BMS limits, sends the torque request over CAN.</p>',
    mcu: '<p>Motor controller: FOC current loops, flux weakening and the modulator. Sends speed and torque back on CAN.</p>',
    dcdc: '<p>DC/DC converter feeding the 12 V network (1.5 kW illustrative). Switching at ~100 kHz, adds a small high-frequency ripple to the HV bus.</p>',
    comp: '<p>Electric A/C compressor: its own small inverter + PMSM, 3.5 kW when on (illustrative). Adds current ripple at its motor and switching frequencies.</p>',
    heat: '<p>HV coolant / water heater (PTC), 5 kW when on, here PWM-controlled at 1 kHz (illustrative). A strong low-frequency current disturbance on the bus.</p>',
    val: '<p>Validation acquisition: HV voltage/current probes on the bus and branches plus the CAN log. Time-domain and FFT analysis happen in the <a href="hv-validation.html">HV validation lab</a>.</p>',
    can: '<p>CAN bus connecting VCU, BMS and motor controller. See the frame table below.</p>'
  };
  const S = U.Arch(document.getElementById('sys'), {
    uid: 'sy', w: 1200, h: 560, info: INFO,
    groups: [{ x: 4, y: 228, w: 230, h: 230, t: 'BATTERY PACK' }],
    nodes: [
      { id: 'pedal', x: 10, y: 30, w: 120, h: 56, t: 'Pedals', s: 'accel · brake' },
      { id: 'vcu', x: 200, y: 30, w: 120, h: 56, t: 'VCU', s: '', kind: 'ctrl' },
      { id: 'mcu', x: 740, y: 30, w: 130, h: 56, t: 'Motor controller', s: 'FOC', kind: 'ctrl' },
      { id: 'val', x: 1040, y: 30, w: 150, h: 56, t: 'Validation DAQ', s: 'FFT · ripple', kind: 'can' },
      { id: 'cells', x: 14, y: 250, w: 120, h: 70, t: 'Cells 96S', s: '', kind: 'hv' },
      { id: 'isens', x: 150, y: 262, w: 72, h: 46, t: 'I sensor', fs: 10.5 },
      { id: 'cmu', x: 14, y: 360, w: 120, h: 48, t: 'Cell monitoring', s: 'V, T ×96', kind: 'ctrl', fs: 10.5 },
      { id: 'bms', x: 150, y: 360, w: 80, h: 90, t: 'BMS', s: 'ctrl', kind: 'ctrl' },
      { id: 'cont', x: 262, y: 250, w: 130, h: 70, t: 'Contactors', s: 'open', kind: 'hv' },
      { id: 'bus', x: 432, y: 250, w: 118, h: 70, t: 'HV DC bus', s: '', kind: 'hv' },
      { id: 'clink', x: 590, y: 250, w: 110, h: 70, t: 'DC-link C', s: '500 µF', kind: 'hv' },
      { id: 'inv', x: 740, y: 250, w: 130, h: 70, t: 'Inverter / PIM', s: '', kind: 'hv' },
      { id: 'mot', x: 910, y: 250, w: 110, h: 70, t: 'IPMSM', s: '' },
      { id: 'gear', x: 1060, y: 250, w: 120, h: 70, t: 'Gear 9:1', s: '' },
      { id: 'whl', x: 1060, y: 380, w: 120, h: 56, t: 'Wheels', s: '' },
      { id: 'dcdc', x: 432, y: 470, w: 118, h: 50, t: 'DC/DC → 12 V', s: '', kind: 'hv', fs: 10.5 },
      { id: 'comp', x: 580, y: 470, w: 130, h: 50, t: 'e-Compressor', s: 'off', kind: 'hv', fs: 10.5 },
      { id: 'heat', x: 740, y: 470, w: 130, h: 50, t: 'Water heater', s: 'off', kind: 'hv', fs: 10.5 },
      { id: 'can', x: 520, y: 128, w: 120, h: 34, t: 'CAN bus', kind: 'can', fs: 10.5 }],
    edges: [
      { id: 'p1', type: 'hv', d: 'M134 285 H148' }, { id: 'p2', type: 'hv', d: 'M222 285 H260' }, { id: 'p3', type: 'hv', d: 'M392 285 H430' },
      { id: 'p4', type: 'hv', d: 'M550 285 H588' }, { id: 'p5', type: 'hv', d: 'M700 285 H738' }, { id: 'p6', type: 'hv', d: 'M870 285 H908', label: 'v_abc', lx: 889, ly: 277 },
      { id: 'm1', type: 'mech', d: 'M1020 285 H1058' }, { id: 'm2', type: 'mech', d: 'M1120 320 V378' },
      { id: 'x0', type: 'hv', d: 'M491 320 V440 H805 V468', arrow: false }, { id: 'x1', type: 'hv', d: 'M491 440 V468' }, { id: 'x2', type: 'hv', d: 'M645 440 V468' }, { id: 'x3', type: 'hv', d: 'M805 440 V468' },
      { id: 's1', type: 'lv', d: 'M74 320 V358', label: 'cell V, T', lx: 80, ly: 344, anchor: 'start' }, { id: 's2', type: 'lv', d: 'M134 384 H148' },
      { id: 's3', type: 'lv', d: 'M186 308 V358', label: 'I', lx: 192, ly: 336, anchor: 'start' }, { id: 's4', type: 'lv', d: 'M230 410 H327 V322', label: 'contactor cmd', lx: 236, ly: 404, anchor: 'start' },
      { id: 'g1', type: 'lv', d: 'M805 86 V248', label: 'gates', lx: 811, ly: 210, anchor: 'start' }, { id: 'g2', type: 'lv', d: 'M965 248 V58 H872', label: 'θ, i_abc', lx: 972, ly: 200, anchor: 'start' },
      { id: 'pd', type: 'lv', d: 'M130 58 H198', label: 'pedal %', lx: 164, ly: 50 },
      { id: 'c0', type: 'can', d: 'M60 145 H1115', arrow: false }, { id: 'c1', type: 'can', d: 'M260 86 V143' }, { id: 'c2', type: 'can', d: 'M805 143 V88' },
      { id: 'c3', type: 'can', d: 'M240 147 V200 H190 V358', label: 'BMS_Status', lx: 246, ly: 180, anchor: 'start' }, { id: 'c4', type: 'can', d: 'M1115 143 V88' },
      { id: 'v1', type: 'lv', d: 'M550 262 H570 V205 H1150 V88', label: 'V_dc / I_dc probes', lx: 690, ly: 199 }]
  }, document.getElementById('sysinfo'));
  rig.on(p => {
    const k = (p.Pdc + p.Paux) / 90000, on = p.bms === 'Drive';
    ['p1', 'p2', 'p3'].forEach(id => S.flow(id, on ? k : 0));
    ['p4', 'p5', 'p6'].forEach(id => S.flow(id, on ? p.Pdc / 90000 : 0));
    ['m1', 'm2'].forEach(id => S.flow(id, p.Pmech / 90000));
    S.flow('x0', on && p.Paux > 0 ? 0.3 : 0); S.flow('x1', on && p.P.aux.dcdc ? 0.25 : 0); S.flow('x2', on && p.P.aux.comp ? 0.4 : 0); S.flow('x3', on && p.P.aux.heater ? 0.5 : 0);
    ['s1', 's2', 's3', 's4', 'pd', 'c0', 'c1', 'c2', 'c3', 'c4', 'v1'].forEach(id => S.flow(id, 0.45)); S.flow('g1', on ? 0.6 : 0); S.flow('g2', on ? 0.6 : 0);
    S.val('cells', (p.soc * 100).toFixed(1) + ' % · ' + p.Vbat.toFixed(0) + ' V');
    S.val('cont', p.bms === 'Drive' ? 'closed' : p.bms === 'Precharge' ? 'precharging ' + (p.vlink / Math.max(1, p.packOCV()) * 100).toFixed(0) + ' %' : 'open');
    S.hi('cont', p.bms === 'Fault', '--bad');
    S.val('bus', p.Vdc.toFixed(0) + ' V · ' + ((p.Pdc + (on ? p.Paux : 0)) / 1000).toFixed(1) + ' kW'); S.val('inv', E.STRATS[p.strat].name);
    S.val('mot', (p.op ? p.op.rpm : 0).toFixed(0) + ' rpm'); S.val('whl', (p.v * 3.6).toFixed(0) + ' km/h'); S.val('bms', p.bms === 'Drive' ? p.sub : p.bms);
    S.val('vcu', 'T* ' + (p.Treq || 0).toFixed(0) + ' Nm'); S.val('mcu', p.Tmot.toFixed(0) + ' Nm');
    S.val('comp', p.P.aux.comp ? '3.5 kW' : 'off'); S.val('heat', p.P.aux.heater ? '5 kW PWM' : 'off'); S.val('dcdc', p.P.aux.dcdc ? '1.5 kW' : 'off');
  });

  /* ---------------- BMS panel ---------------- */
  const cellsEl = document.getElementById('cells'); cellsEl.innerHTML = pt.cells.map((_, k) => `<i title="cell ${k + 1}"></i>`).join('');
  const cellIs = [...cellsEl.children];
  const fsm = document.getElementById('fsm');
  const ST = [['Standby', 10, 60], ['Precharge', 120, 60], ['Drive', 240, 20], ['Fault', 400, 60]];
  function buildFsm() {
    fsm.innerHTML = ''; const e = (t, a) => U.el(t, a, fsm);
    const defs = e('defs', {}); const mk = U.el('marker', { id: 'fa', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto' }, defs); U.el('path', { d: 'M0 0L10 5L0 10z', fill: css('--muted') }, mk);
    [['M100 80 H118', ''], ['M220 80 H238', 'V_link ≥ 95 %'], ['M370 80 H398', 'fault (debounced)'], ['M455 105 V140 H55 V102', 'fault cleared + reset']].forEach(([d, l], i) => { e('path', { d, fill: 'none', stroke: css('--muted'), 'stroke-width': 1.3, 'marker-end': 'url(#fa)' }); if (l) { const t = e('text', { x: i === 3 ? 255 : (i === 1 ? 229 : 384), y: i === 3 ? 158 : 70, 'text-anchor': 'middle' }); t.textContent = l; t.style.font = '9.5px ' + css('--f-mono'); t.style.fill = css('--muted'); } });
    ST.forEach(([n, x, y]) => {
      const w = n === 'Drive' ? 130 : 90, hh = n === 'Drive' ? 120 : 40, yy = n === 'Drive' ? 10 : 60;
      const r = e('rect', { x, y: yy, width: w, height: hh, rx: 9, fill: css('--surface'), stroke: css(n === 'Fault' ? '--bad' : '--ink'), 'stroke-width': 1.3, 'data-s': n });
      const t = e('text', { x: x + 8, y: yy + 16 }); t.textContent = n; t.style.font = '600 11px ' + css('--f-mono'); t.style.fill = css('--ink'); t.dataset.s = n;
    });
    ['Idle', 'Traction', 'Regen'].forEach((n, i) => { const r = e('rect', { x: 250, y: 30 + i * 32, width: 110, height: 26, rx: 6, fill: css('--surface'), stroke: css('--line'), 'data-sub': n }); const t = e('text', { x: 258, y: 47 + i * 32 }); t.textContent = n; t.style.font = '500 10.5px ' + css('--f-mono'); t.style.fill = css('--ink'); });
  }
  buildFsm(); U.onTheme(buildFsm);
  const bmsDash = document.getElementById('bmsdash');
  rig.on(p => {
    let vmin = 9, vmax = 0; const vs = p.cells.map(c => { const v = E.ocv(p.soc + c.d) - E.PACK.R0 * p.Ibat - p.vrc / E.PACK.S; if (v < vmin) vmin = v; if (v > vmax) vmax = v; return v; });
    const lo = vmin - 0.004, hi = Math.max(vmax + 0.004, lo + 0.02);
    cellIs.forEach((el, k) => { const f = (vs[k] - lo) / (hi - lo); el.style.background = `color-mix(in srgb, ${css('--hv')} ${Math.round(f * 100)}%, ${css('--sig')})`; el.classList.toggle('b', !!p.cells[k].bal); });
    document.getElementById('cellstat').textContent = `V_max ${vmax.toFixed(3)} · V_min ${vmin.toFixed(3)} · ΔV ${((vmax - vmin) * 1000).toFixed(0)} mV`;
    fsm.querySelectorAll('rect[data-s]').forEach(r => { const on = r.dataset.s === p.bms; r.setAttribute('fill', on ? css(p.bms === 'Fault' ? '--bad' : '--hv-soft') : css('--surface')); });
    fsm.querySelectorAll('rect[data-sub]').forEach(r => r.setAttribute('fill', p.bms === 'Drive' && r.dataset.sub === p.sub ? css(p.sub === 'Regen' ? '--sig-soft' : '--hv-soft') : css('--surface')));
    bmsDash.innerHTML = `<div><span>T cell</span><b>${p.Tcell.toFixed(1)}</b><small>°C</small></div><div><span>I<sub>chg</sub> limit</span><b>${(p.Ichg || 0).toFixed(0)}</b><small>A</small></div><div><span>regen</span><b>${p.regenBlk ? 'blocked' : 'allowed'}</b></div><div><span>balancing</span><b>${p.balancing ? 'ON' : 'off'}</b></div><div><span>SOC EKF</span><b>${(p.socK * 100).toFixed(2)}</b><small>%</small></div><div><span>V<sub>link</sub></span><b>${p.vlink.toFixed(0)}</b><small>V</small></div>`;
    document.getElementById('faultbox').innerHTML = p.fault ? `<b style="color:var(--bad)">FAULT ${p.fault}</b> — ${p.faultMsg}. Contactors opened, torque request set to zero, the vehicle coasts. Use “Reset fault” in the control panel.`
      : p.bms === 'Precharge' ? `Precharging: V<sub>link</sub> ${p.vlink.toFixed(0)} V of ${p.packOCV().toFixed(0)} V. ${p.inject.pre ? '<b>Injected failure: V_link will not rise → timeout at 5 s.</b>' : ''}`
      : `No active fault. Inject one from the control panel to see the supervisor react.`;
  });
  const socRoll = U.Roll(document.getElementById('soc'), { height: 200, span: 60, lanes: [{ name: 'SOC %', dp: 1, s: [{ key: 't', label: 'true SOC (model)', color: '--ink', w: 2.5 }, { key: 'k', label: 'EKF estimate', color: '--hv' }, { key: 'c', label: 'coulomb counting', color: '--violet', dash: 1 }] }] });
  rig.on(p => socRoll.push(p.t, { t: p.soc * 100, k: p.socK * 100, c: p.socCC * 100 }));
  document.getElementById('bms-eq').innerHTML = U.eqPanel('Engineering equations · battery and SOC', `
    <span class="r">V_t = OCV(SOC) − R_0 I − V_1,    dV_1/dt = (R_1 I − V_1)/τ_1</span>
    <span class="r">Coulomb counting: SOC(t) = SOC_0 − (1/Q) ∫ I dt</span>
    <span class="r">EKF state x = [SOC, V_1],  prediction x⁻ = f(x, I),  correction x = x⁻ + K (V_meas − V̂_t)</span>
    <span class="r">H = [dOCV/dSOC, −1],  K = P Hᵀ (H P Hᵀ + R)⁻¹</span>
    <span class="r">Charge-current limit: I_chg = (4.20 V − V_max,OCV − V_1) / R_0   (keeps the highest cell under 4.20 V)</span>
    <span class="r">Balancing: on when ΔV &gt; 20 mV and V_max &gt; 4.00 V, off when ΔV &lt; 10 mV (bleed shown display-accelerated)</span>`);

  /* ---------------- CAN table ---------------- */
  const ct = document.getElementById('cantab'); let ctT = 0;
  rig.on((p, dt) => { ctT += dt; if (ctT < 0.25) return; ctT = 0;
    ct.innerHTML = `<thead><tr><th>ID</th><th>message</th><th>period</th><th>DLC</th><th>data</th><th>sender → receiver</th></tr></thead><tbody>${p.can.frames.map(f => `<tr><td>${f.id}</td><td>${f.name}</td><td>${f.period} ms</td><td>${f.data.split(' ').length}</td><td>${f.data}</td><td>${{ VCU_TorqueReq: 'VCU → MCU', BMS_Status: 'BMS → VCU', BMS_Limits: 'BMS → VCU, MCU', MCU_Status: 'MCU → VCU' }[f.name]}</td></tr>`).join('')}</tbody>`; });

  /* ---------------- DC bus ---------------- */
  const sc = U.Scope(document.getElementById('scope'), { height: 330, hidden: ['ibat'], lanes: [
    { name: 'phase [A]', h: 1, sym: true, chans: [{ key: 'ia', label: 'i_a', color: '--hv' }, { key: 'ib', label: 'i_b', color: '--sig' }, { key: 'ic', label: 'i_c', color: '--violet' }] },
    { name: 'DC current [A]', h: 1, chans: [{ key: 'idc', label: 'i_dc (inverter+aux)', color: '--sig' }, { key: 'ibat', label: 'i_battery', color: '--ink' }] },
    { name: 'V_bus [V]', h: 1, chans: [{ key: 'vbus', label: 'V_bus', color: '--hv' }] }] });
  const ff = U.Spectrum(document.getElementById('fft'), { height: 200, spanIdx: 2, title: 'V_bus ripple spectrum' });
  const TH = 0.03; // illustrative demonstration threshold: 3 % of V_dc pk-pk
  rig.onSlow(p => {
    const W = p.waves(8192); if (!W || sc.paused) return;
    sc.set(W.t, { ia: W.ia, ib: W.ib, ic: W.ic, idc: W.idc, ibat: W.ibat, vbus: W.vbus }, `${E.STRATS[p.strat].name} · f<sub>e</sub> ${W.fe.toFixed(0)} Hz · window ${(W.Tw * 1e3).toFixed(2)} ms`);
    const sp = E.spectrum(W.vbus, W.fs, W.integer ? 'rect' : 'hann'), st = E.stats(W.vbus), pk = E.peaks(sp, 4, 20);
    const lim = TH * p.Vdc;
    ff.set(sp, { peaks: pk, threshold: lim / 2, thLabel: 'illustrative amplitude limit' });
    const ok = st.pp <= lim;
    document.getElementById('ripdash').innerHTML = `<div><span>V<sub>dc</sub> mean</span><b>${st.mean.toFixed(1)}</b><small>V</small></div><div><span>ripple pk-pk</span><b>${st.pp.toFixed(2)}</b><small>V</small></div><div><span>ripple RMS</span><b>${st.rmsAC.toFixed(2)}</b><small>V</small></div><div><span>dominant</span><b>${pk[0] ? (pk[0].f / 1000).toFixed(2) : '—'}</b><small>kHz</small></div><div><span>C<sub>link</sub> I<sub>rms</sub></span><b>${E.stats(W.icap).rmsAC.toFixed(0)}</b><small>A</small></div><div><span>check</span><b style="color:var(--${ok ? 'ok' : 'bad'})">${ok ? 'PASS' : 'FAIL'}</b></div>`;
    document.getElementById('ripnote').innerHTML = `<span class="illus">Illustrative threshold</span> ripple pk-pk ≤ 3 % of V<sub>dc</sub> (${lim.toFixed(1)} V) — a demonstration value, not an OEM requirement. Turn on the e-compressor or the water heater, or force six-step, and watch the spectrum and the verdict change.`;
    document.getElementById('busstat').textContent = `${W.N} samples · ${(W.fs / 1e6).toFixed(2)} MS/s`;
  });
});
