document.addEventListener('DOMContentLoaded', () => {
  const E = EV, U = UI, css = U.css, TAU = E.TAU;
  const $ = s => document.querySelector(s);
  const S = { rpm: 6000, tq: 120, st: 'auto', fsw: 10000, vdc: 380, aux: { dcdc: true, comp: true, heater: false }, C: 500e-6, ESR: 1e-3, Lb: 5e-6, th: 0.03, ESL: 20e-9, ch: 'vbus', reg: null };

  /* auxiliary branch currents (illustrative load models) */
  function auxFns(V) {
    const out = {};
    if (S.aux.dcdc) out.dcdc = t => 1500 / V * (1 + 0.15 * Math.sin(TAU * 100e3 * t));
    if (S.aux.comp) out.comp = t => 3500 / V * (1 + 0.35 * Math.sin(TAU * 6 * 120 * t) + 0.2 * Math.sin(TAU * 20e3 * t));
    if (S.aux.heater) out.heater = t => (Math.sin(TAU * 1000 * t) > 0 ? 2 * 5000 / V : 0);
    return out;
  }
  function opFor(strat, rpm, tq, V) {
    const we = E.rpm2we(rpm);
    let k = strat;
    if (strat === 'auto') { const m = E.mtpa(tq), vr = E.volt(m.id, m.iq, we).v; S.reg = E.region(E.modIndex(vr, V), null); k = E.REG[S.reg].key; }
    const op = E.operate(tq, we, E.STRATS[k].vlim(V), k === 'six' ? 'fixed' : 'limit'); op.we = we; op.strat = k; return op;
  }
  function run(strat, opts) {
    opts = opts || {};
    const V = S.vdc, op = opFor(strat, opts.rpm ?? S.rpm, opts.tq ?? S.tq, V), aux = auxFns(V);
    const W = E.synth(op, op.strat, V, S.fsw, { N: opts.N || 16384, aux: Object.values(aux), dc: { C: opts.C ?? S.C, ESR: S.ESR, Lb: S.Lb } });
    W.op = op; W.auxArr = {};
    Object.entries(aux).forEach(([k, f]) => W.auxArr[k] = Float32Array.from(W.t, f));
    return W;
  }

  /* ---------------- controls ---------------- */
  const bind = (id, fn, out) => { const el = $('#' + id); el.oninput = el.onchange = () => { fn(+el.value || el.value); if (out) $(`[data-o=${out[0]}]`).textContent = out[1](el.value); schedule(); }; };
  bind('rpm', v => S.rpm = v, ['rpm', v => v + ' rpm']); bind('tq', v => S.tq = v, ['tq', v => v + ' Nm']);
  $('#st').onchange = e => { S.st = e.target.value; schedule(); }; $('#fsw').onchange = e => { S.fsw = +e.target.value; schedule(); };
  bind('vdc', v => S.vdc = v, ['vdc', v => v + ' V']); bind('c', v => S.C = v * 1e-6, ['c', v => v + ' µF']);
  bind('esr', v => S.ESR = v * 1e-3, ['esr', v => (+v).toFixed(1) + ' mΩ']); bind('lb', v => S.Lb = v * 1e-6, ['lb', v => v + ' µH']);
  bind('th', v => S.th = v / 100, ['th', v => (+v).toFixed(1) + ' % pk-pk']);
  bind('esl', v => S.ESL = v * 1e-9, ['esl', v => v + ' nH']);
  document.querySelectorAll('[data-aux]').forEach(b => b.onclick = () => { const k = b.dataset.aux; S.aux[k] = !S.aux[k]; b.setAttribute('aria-pressed', S.aux[k]); schedule(); });
  let tmr; function schedule() { clearTimeout(tmr); tmr = setTimeout(update, 120); }

  /* ---------------- HV network schematic ---------------- */
  const CH = {
    vbus: ['CH1', 'DC bus voltage V_bus', 'V'], ibat: ['CH2', 'DC bus (battery) current', 'A'], iinv: ['CH3', 'PIM input current', 'A'],
    comp: ['CH4', 'e-compressor current', 'A'], heater: ['CH5', 'water heater current', 'A'], dcdc: ['CH6', 'DC/DC input current', 'A'], ia: ['CH7', 'motor phase current i_a', 'A']
  };
  const NI = {
    bat: '<p>HV battery: source of the DC voltage; its internal resistance and the cable inductance form the battery side of the DC-link filter.</p>',
    cont: '<p>Main contactors and precharge. Validation also checks the precharge transient and contactor opening under load.</p>',
    clink: '<p>DC-link capacitor inside the PIM: the local energy buffer that supplies the switching-frequency current of the inverter.</p>',
    pim: '<p>Power inverter module driving the traction PMSM. Its DC input current is a chopped waveform: mean = power / V<sub>dc</sub>, plus large components at f<sub>sw</sub>, 2f<sub>sw</sub> and 6f<sub>e</sub>.</p>',
    pmsm: '<p>Traction PMSM. Motor-side signals (phase currents) explain where DC-side harmonics come from.</p>',
    comp: '<p>Electric A/C compressor: an independent inverter + motor on the same HV bus (here 3.5 kW, 120 Hz electrical, 20 kHz switching, illustrative).</p>',
    heater: '<p>HV water / coolant heater (PTC). PWM power control at 1 kHz here: a large square-wave current step on the bus.</p>',
    dcdc: '<p>DC/DC converter to the 12 V network (1.5 kW, 100 kHz, illustrative).</p>',
    daq: '<p>Acquisition system: high-voltage differential probes and current probes, synchronous sampling, then export to the analysis tools (MATLAB / Python).</p>'
  };
  Object.keys(CH).forEach(k => NI['p_' + k] = `<p><b>${CH[k][0]}</b> · ${CH[k][1]}. Selected for analysis.</p>`);
  const probe = (k, x, y) => ({ id: 'p_' + k, x, y, w: 50, h: 26, t: CH[k][0], kind: 'can', fs: 10 });
  const N = U.Arch($('#net-arch'), {
    uid: 'hv', w: 1120, h: 420, info: NI,
    onPick: id => { if (id.startsWith('p_')) { S.ch = id.slice(2); update(true); } },
    nodes: [
      { id: 'bat', x: 10, y: 120, w: 110, h: 64, t: 'HV battery', s: '', kind: 'hv' },
      { id: 'cont', x: 160, y: 120, w: 110, h: 64, t: 'Contactors', s: 'closed', kind: 'hv' },
      { id: 'clink', x: 340, y: 230, w: 110, h: 54, t: 'DC-link C', s: '', kind: 'hv' },
      { id: 'pim', x: 490, y: 230, w: 120, h: 54, t: 'PIM / inverter', s: '', kind: 'hv' },
      { id: 'pmsm', x: 490, y: 340, w: 120, h: 50, t: 'PMSM', s: '' },
      { id: 'comp', x: 650, y: 230, w: 130, h: 54, t: 'e-Compressor', s: '', kind: 'hv' },
      { id: 'heater', x: 820, y: 230, w: 130, h: 54, t: 'Water heater', s: '', kind: 'hv' },
      { id: 'dcdc', x: 990, y: 230, w: 120, h: 54, t: 'DC/DC', s: '', kind: 'hv' },
      { id: 'daq', x: 990, y: 20, w: 120, h: 52, t: 'DAQ', s: 'probes → analysis', kind: 'ctrl' },
      probe('vbus', 330, 60), probe('ibat', 285, 120), probe('iinv', 560, 182), probe('comp', 720, 182), probe('heater', 890, 182), probe('dcdc', 1060, 182), probe('ia', 618, 352)],
    edges: [
      { id: 'b1', type: 'hv', d: 'M120 152 H158' }, { id: 'b2', type: 'hv', d: 'M270 152 H1050', arrow: false, label: 'HV DC bus', lx: 650, ly: 144 },
      { id: 'b3', type: 'hv', d: 'M395 152 V228' }, { id: 'b4', type: 'hv', d: 'M550 152 V228' }, { id: 'b5', type: 'hv', d: 'M715 152 V228' }, { id: 'b6', type: 'hv', d: 'M885 152 V228' }, { id: 'b7', type: 'hv', d: 'M1050 152 V228' },
      { id: 'b8', type: 'hv', d: 'M550 284 V338', label: 'v_abc', lx: 556, ly: 316, anchor: 'start' },
      ...Object.keys(CH).map((k, i) => ({ id: 'q_' + k, type: 'lv', d: { vbus: 'M380 60 H600 V46 H988', ibat: 'M310 120 V96 H600 V46 H988', iinv: 'M610 195 H630 V96 H988 V60', comp: 'M770 195 H790 V96 H988 V60', heater: 'M940 195 H960 V96 H988 V60', dcdc: 'M1085 182 V74', ia: 'M668 365 H980 V74 H1000' }[k] }))]
  }, $('#netinfo'));
  /* analysis chain */
  const FLOW = ['acq', 'time', 'fft', 'rip', 'lim', 'res', 'act'];
  const F = U.Arch($('#flow'), {
    uid: 'fl', w: 1120, h: 120, legend: false, info: {},
    nodes: [
      { id: 'acq', x: 0, y: 30, w: 140, h: 56, t: 'Acquisition', s: '', kind: 'ctrl' }, { id: 'time', x: 162, y: 30, w: 140, h: 56, t: 'Time domain', s: '' },
      { id: 'fft', x: 324, y: 30, w: 140, h: 56, t: 'FFT', s: '' }, { id: 'rip', x: 486, y: 30, w: 150, h: 56, t: 'Ripple extraction', s: '' },
      { id: 'lim', x: 658, y: 30, w: 150, h: 56, t: 'Limit comparison', s: 'illustrative' }, { id: 'res', x: 830, y: 30, w: 120, h: 56, t: 'Verdict', s: '' }, { id: 'act', x: 972, y: 30, w: 146, h: 56, t: 'Action plan', s: '' }],
    edges: FLOW.slice(0, -1).map((k, i) => ({ id: 'f' + i, type: 'sig', d: `M${[140, 302, 464, 636, 808, 950][i]} 58 H${[160, 322, 484, 656, 828, 970][i]}` }))
  });
  let step = 0; setInterval(() => { step = (step + 1) % (FLOW.length + 2); FLOW.forEach((k, i) => F.hi(k, i === step, i === 5 ? (lastOk ? '--ok' : '--bad') : '--sig')); for (let i = 0; i < 6; i++) F.flow('f' + i, i < step ? 0.8 : 0.05); }, U.reduce ? 1e9 : 650);

  /* ---------------- ripple analysis views ---------------- */
  const ts = U.Scope($('#tscope'), { height: 300, lanes: [
    { name: 'selected', h: 1.2, chans: [{ key: 'sel', label: 'selected channel', color: '--hv' }] },
    { name: 'V_bus [V]', h: 1, chans: [{ key: 'vbus', label: 'V_bus', color: '--sig' }] },
    { name: 'I_bus [A]', h: 1, chans: [{ key: 'ibat', label: 'I_battery', color: '--ink' }, { key: 'idc', label: 'I into C ∥ loads', color: '--violet' }] }] });
  const tf = U.Spectrum($('#tfft'), { height: 230, spanIdx: 2, spans: [2000, 20000, 50000, 200000], title: 'amplitude spectrum' });
  let lastOk = true, lastW = null;
  function analyse(W, label) {
    const ch = S.ch, sig = ch === 'vbus' ? W.vbus : ch === 'ibat' ? W.ibat : ch === 'iinv' ? W.iinv : ch === 'ia' ? W.ia : (W.auxArr[ch] || new Float32Array(W.N));
    ts.set(W.t, { sel: sig, vbus: W.vbus, ibat: W.ibat, idc: W.idc }, `${CH[ch][0]} ${CH[ch][1]} · ${label}`);
    const sp = E.spectrum(sig, W.fs, W.integer ? 'rect' : 'hann'), pk = E.peaks(sp, 5, 20), st = E.stats(sig), vb = E.stats(W.vbus);
    const lim = S.th * S.vdc;
    tf.set(sp, { peaks: pk, threshold: ch === 'vbus' ? lim / 2 : null, thLabel: 'illustrative limit (amplitude)', markers: [{ f: S.fsw, label: 'f_sw' }, { f: 6 * W.fe, label: '6f_e', color: '--hv' }] });
    const ok = vb.pp <= lim; lastOk = ok;
    $('#metrics').innerHTML = `<div><span>V<sub>dc</sub></span><b>${vb.mean.toFixed(1)}</b><small>V</small></div><div><span>V<sub>bus</sub> pk-pk</span><b>${vb.pp.toFixed(2)}</b><small>V</small></div><div><span>V<sub>bus</sub> RMS ripple</span><b>${vb.rmsAC.toFixed(2)}</b><small>V</small></div>
      <div><span>${CH[ch][0]} pk-pk</span><b>${st.pp.toFixed(ch === 'vbus' ? 2 : 1)}</b><small>${CH[ch][2]}</small></div><div><span>dominant</span><b>${pk[0] ? (pk[0].f / 1000).toFixed(2) : '—'}</b><small>kHz</small></div><div><span>harmonic amp.</span><b>${pk[0] ? pk[0].a.toFixed(2) : '—'}</b><small>${CH[ch][2]}</small></div>
      <div><span>f<sub>sw</sub></span><b>${(S.fsw / 1000).toFixed(0)}</b><small>kHz</small></div><div><span>f<sub>e</sub></span><b>${W.fe.toFixed(0)}</b><small>Hz</small></div><div><span>modulation</span><b>${E.STRATS[W.op.strat].name}</b></div>`;
    const dom = pk[0] ? pk[0].f : 0, fr = 1 / (TAU * Math.sqrt(S.Lb * S.C));
    let action;
    if (ok) action = 'Within the illustrative limit with margin ' + ((1 - vb.pp / lim) * 100).toFixed(0) + ' %. Keep this operating point in the worst-case list for the next software release.';
    else if (Math.abs(dom - 6 * W.fe) < 0.15 * 6 * W.fe || dom < 2000) action = 'Dominant content is low-frequency (6·f<sub>e</sub> / load PWM). Capacitance alone is inefficient here: review the modulation region policy (six-step / overmodulation), the heater PWM frequency, or the load control strategy.';
    else if (Math.abs(dom - fr) < 0.25 * fr) action = `Dominant line sits near the battery-side L–C anti-resonance (${(fr / 1000).toFixed(2)} kHz). Damp it (ESR, damping network) or move it (C, cable inductance) before adding capacitance.`;
    else action = 'Dominant content is switching-related. Options: increase C<sub>link</sub> (see the sweep below), raise f<sub>sw</sub>, or interleave / phase-shift auxiliary converters.';
    $('#verdict').innerHTML = `<p style="margin-bottom:6px"><span class="illus">Illustrative threshold</span> V<sub>bus</sub> ripple ≤ ${(S.th * 100).toFixed(1)} % of V<sub>dc</sub> = ${lim.toFixed(1)} V pk-pk</p>
      <p><b style="font-size:1.4rem;color:var(--${ok ? 'ok' : 'bad'})">${ok ? 'PASS' : 'FAIL'}</b> · measured ${vb.pp.toFixed(2)} V pk-pk at the worst frequency ${(dom / 1000).toFixed(2)} kHz</p><p style="margin-top:6px"><b>Action plan:</b> ${action}</p>`;
    F.val('acq', CH[ch][0]); F.val('time', st.pp.toFixed(2) + ' ' + CH[ch][2] + ' pp'); F.val('fft', (W.N) + ' pts'); F.val('rip', 'dom ' + (dom / 1000).toFixed(2) + ' kHz'); F.val('lim', '≤ ' + lim.toFixed(1) + ' V'); F.val('res', ok ? 'PASS' : 'FAIL'); F.val('act', ok ? 'record margin' : 'see below');
    $('#chainstat').textContent = `${CH[ch][0]} → analysis · ${(W.fs / 1e6).toFixed(2)} MS/s · ${(W.Tw * 1e3).toFixed(2)} ms`;
    $('#tstat').textContent = W.integer ? W.periods + ' electrical period(s), rectangular window' : 'Hann window';
  }

  /* ---------------- modulation comparison ---------------- */
  const cmpCv = U.canvas($('#cmpspec'), 220); let cmpData = [];
  function drawCmp() {
    const { w, h: H } = cmpCv.fit(), ctx = cmpCv.ctx; ctx.clearRect(0, 0, w, H); if (!cmpData.length) return;
    const ml = 46, pw = w - ml - 10, ph = H - 30, fmax = 50000; let amax = 1e-6;
    cmpData.forEach(d => { for (let k = 1; k < d.sp.f.length && d.sp.f[k] < fmax; k++) amax = Math.max(amax, d.sp.A[k]); });
    const lmin = Math.log10(amax) - 3.5, Y = a => 6 + ph - (Math.max(lmin, Math.log10(Math.max(a, 1e-9))) - lmin) / (Math.log10(amax) - lmin) * ph;
    ctx.font = '10px ' + css('--f-mono'); ctx.fillStyle = css('--muted'); ctx.textAlign = 'center';
    for (let q = 0; q <= 5; q++) ctx.fillText((fmax * q / 5 / 1000) + ' kHz', ml + pw * q / 5, H - 8);
    ctx.textAlign = 'right'; ctx.fillText(amax.toPrecision(2) + ' V', ml - 4, 12); ctx.fillText((10 ** lmin).toExponential(0), ml - 4, 6 + ph);
    const cols = ['--sig', '--violet', '--warn', '--hv'];
    cmpData.forEach((d, i) => {
      ctx.strokeStyle = css(cols[i]); ctx.lineWidth = 1.4; ctx.beginPath();
      const { f, A } = d.sp; let kmax = 1; while (kmax < f.length && f[kmax] <= fmax) kmax++;
      for (let px = 0; px < pw; px += 2) { const k0 = Math.max(1, Math.floor(px / pw * kmax)), k1 = Math.max(k0 + 1, Math.floor((px + 2) / pw * kmax)); let a = 0; for (let k = k0; k < k1; k++) a = Math.max(a, A[k]); const x = ml + px; px ? ctx.lineTo(x, Y(a)) : ctx.moveTo(x, Y(a)); }
      ctx.stroke(); ctx.fillStyle = css(cols[i]); ctx.textAlign = 'left'; ctx.fillText(d.name, ml + 8 + i * 120, 14);
    });
  }
  U.onTheme(drawCmp); addEventListener('resize', drawCmp);
  function compare() {
    const rows = ['spwm', 'svpwm', 'ovm', 'six'].map(k => {
      const W = run(k, { N: 8192 }); const vb = E.stats(W.vbus), te = E.stats(W.Te), ic = E.stats(W.icap);
      const sp = E.spectrum(W.vbus, W.fs, W.integer ? 'rect' : 'hann'), pk = E.peaks(sp, 1, 20)[0];
      return { k, W, name: E.STRATS[k].name, vb, te, ic, sp, dom: pk ? pk.f : 0, thd: E.thd(W.ia, W.fs, W.fe), util: W.op.v / S.vdc, ev: k === 'six' ? 6 * W.fe : 6 * S.fsw };
    });
    cmpData = rows;
    $('#cmptab').innerHTML = `<thead><tr><th>strategy</th><th>operating point</th><th class="n">V<sub>bus</sub> pk-pk</th><th class="n">V<sub>bus</sub> RMS</th><th class="n">I<sub>C</sub> RMS</th><th class="n">i<sub>a</sub> THD</th><th class="n">torque ripple</th><th class="n">dominant</th><th class="n">|V|/V<sub>dc</sub></th><th class="n">switchings/s</th></tr></thead><tbody>${rows.map(r => `<tr data-k="${r.k}" style="cursor:pointer"><td><b>${r.name}</b></td><td class="mono" style="font-size:.78rem">T ${r.W.op.T.toFixed(0)} Nm · i<sub>d</sub> ${r.W.op.id.toFixed(0)} A${r.W.op.flag !== 'ok' ? ' · <span style="color:var(--bad)">' + r.W.op.flag + '</span>' : ''}</td><td class="n">${r.vb.pp.toFixed(2)} V</td><td class="n">${r.vb.rmsAC.toFixed(2)} V</td><td class="n">${r.ic.rmsAC.toFixed(0)} A</td><td class="n">${(r.thd * 100).toFixed(1)} %</td><td class="n">${r.te.pp.toFixed(1)} Nm</td><td class="n">${(r.dom / 1000).toFixed(2)} kHz</td><td class="n">${r.util.toFixed(3)}</td><td class="n">${(r.ev / 1000).toFixed(1)} k</td></tr>`).join('')}</tbody>`;
    $('#cmptab').querySelectorAll('tr[data-k]').forEach(tr => tr.onclick = () => { const r = rows.find(x => x.k === tr.dataset.k); $('#st').value = r.k; S.st = r.k; $('#cmptab').querySelectorAll('tr').forEach(x => x.setAttribute('aria-current', x === tr)); analyse(r.W, r.name + ' (from comparison)'); location.hash = 'ripple'; });
    drawCmp();
  }

  /* ---------------- capacitor optimisation ---------------- */
  U.Arch($('#capflow'), {
    uid: 'cf', w: 1120, h: 110, legend: false, info: {},
    nodes: [['loads', 'HV loads', 'i_dc(t)'], ['dist', 'Current disturbance', 'f_sw, 6f_e, aux'], ['max', 'Max ripple', 'illustrative'], ['req', 'Required C', 'first-order'], ['cand', 'C candidate', 'sweep'], ['sim', 'Simulation', 'time + FFT'], ['eval', 'Ripple check', 'pass / fail'], ['opt', 'Optimum', 'smallest C']]
      .map(([id, t, s], i) => ({ id, x: i * 140, y: 26, w: 124, h: 56, t, s, kind: i < 2 ? 'hv' : 'ctrl', fs: 10.5 })),
    edges: [0, 1, 2, 3, 4, 5, 6].map(i => ({ id: 'c' + i, type: 'sig', d: `M${i * 140 + 124} 54 H${i * 140 + 138}` }))
  });
  const capCv = U.canvas($('#capplot'), 270); let capRes = null;
  Kit.legend('#caplg', [{ color: '--hv', label: 'worst-case V_bus ripple pk-pk (% of V_dc)' }, { color: '--sig', label: 'capacitor RMS current (A, right axis)' }, { color: '--bad', label: 'illustrative limit', dash: 1 }]);
  function drawCap() {
    const { w, h: H } = capCv.fit(), ctx = capCv.ctx; ctx.clearRect(0, 0, w, H);
    const ml = 46, mr = 46, pw = w - ml - mr, ph = H - 34; ctx.font = '10px ' + css('--f-mono');
    if (!capRes) { ctx.fillStyle = css('--muted'); ctx.fillText('Run the sweep to evaluate C from 100 µF to 1500 µF at three operating points.', ml, 30); return; }
    const ymax = Math.max(S.th * 100 * 1.5, ...capRes.map(r => r.pp)) * 1.05, imax = Math.max(...capRes.map(r => r.ic)) * 1.1;
    const X = c => ml + (c - 100) / 1400 * pw, Y = v => 8 + ph - v / ymax * ph, Y2 = v => 8 + ph - v / imax * ph;
    ctx.fillStyle = css('--muted'); ctx.textAlign = 'center'; for (let c = 100; c <= 1500; c += 200) ctx.fillText(c + ' µF', X(c), H - 10);
    ctx.textAlign = 'right'; ctx.fillText(ymax.toFixed(1) + ' %', ml - 4, 14); ctx.fillText('0', ml - 4, 8 + ph); ctx.textAlign = 'left'; ctx.fillText(imax.toFixed(0) + ' A', w - mr + 4, 14);
    ctx.strokeStyle = css('--bad'); ctx.setLineDash([6, 4]); ctx.beginPath(); ctx.moveTo(ml, Y(S.th * 100)); ctx.lineTo(ml + pw, Y(S.th * 100)); ctx.stroke(); ctx.setLineDash([]);
    ctx.strokeStyle = css('--sig'); ctx.lineWidth = 1.6; ctx.beginPath(); capRes.forEach((r, i) => i ? ctx.lineTo(X(r.C), Y2(r.ic)) : ctx.moveTo(X(r.C), Y2(r.ic))); ctx.stroke();
    ctx.strokeStyle = css('--hv'); ctx.lineWidth = 2.4; ctx.beginPath(); capRes.forEach((r, i) => i ? ctx.lineTo(X(r.C), Y(r.pp)) : ctx.moveTo(X(r.C), Y(r.pp))); ctx.stroke();
    capRes.forEach(r => { ctx.fillStyle = css(r.pp <= S.th * 100 ? '--ok' : '--bad'); ctx.beginPath(); ctx.arc(X(r.C), Y(r.pp), 3.5, 0, 7); ctx.fill(); });
    const best = capRes.find(r => r.pp <= S.th * 100);
    if (best) { ctx.strokeStyle = css('--ok'); ctx.beginPath(); ctx.moveTo(X(best.C), 8); ctx.lineTo(X(best.C), 8 + ph); ctx.stroke(); ctx.fillStyle = css('--ok'); ctx.fillText('C_min ≈ ' + best.C + ' µF', X(best.C) + 4, 20); }
    ctx.strokeStyle = css('--ink'); ctx.beginPath(); ctx.arc(X(S.C * 1e6), 8 + ph, 4, 0, 7); ctx.stroke();
  }
  U.onTheme(drawCap); addEventListener('resize', drawCap);
  $('#sweep').onclick = () => {
    const Cs = []; for (let c = 100; c <= 1500; c += 100) Cs.push(c);
    const ops = [[S.rpm, S.tq], [3000, 250], [9000, 300]]; const out = []; let i = 0;
    $('#sweep').disabled = true;
    (function next() {
      if (i >= Cs.length) { capRes = out; drawCap(); report(); $('#sweep').disabled = false; $('#sweep').textContent = 'Run capacitor sweep again'; return; }
      const C = Cs[i]; let pp = 0, ic = 0, dom = 0, icAt = 0;
      ops.forEach(([r, t]) => { const W = run(S.st, { rpm: r, tq: t, C: C * 1e-6, N: 8192 }); const s = E.stats(W.vbus), c = E.stats(W.icap); if (s.pp / S.vdc * 100 > pp) { pp = s.pp / S.vdc * 100; const pk = E.peaks(E.spectrum(W.vbus, W.fs, 'rect'), 1, 20)[0]; dom = pk ? pk.f : 0; icAt = c.rmsAC; } ic = Math.max(ic, c.rmsAC); });
      out.push({ C, pp, ic, dom, icAt }); i++; $('#capstat').textContent = `evaluating ${C} µF…`; capRes = out; drawCap(); setTimeout(next, 0);
    })();
  };
  function report() {
    const best = capRes.find(r => r.pp <= S.th * 100), lim = S.th * S.vdc;
    const cur = capRes.reduce((a, r) => Math.abs(r.C - S.C * 1e6) < Math.abs(a.C - S.C * 1e6) ? r : a, capRes[0]);
    const est = cur.icAt / (TAU * Math.max(cur.dom, 1) * (lim / (2 * Math.SQRT2))) * 1e6;
    $('#capdash').innerHTML = `<div><span>limit</span><b>${(S.th * 100).toFixed(1)}</b><small>% pk-pk</small></div><div><span>C<sub>min</sub> (sim)</span><b>${best ? best.C : '>1500'}</b><small>µF</small></div><div><span>first-order est.</span><b>${est.toFixed(0)}</b><small>µF</small></div><div><span>I<sub>C,rms</sub> max</span><b>${Math.max(...capRes.map(r => r.ic)).toFixed(0)}</b><small>A</small></div><div><span>energy @ C<sub>min</sub></span><b>${best ? (0.5 * best.C * 1e-6 * S.vdc ** 2).toFixed(0) : '—'}</b><small>J</small></div><div><span>worst at</span><b>${(cur.dom / 1000).toFixed(2)}</b><small>kHz</small></div>`;
    $('#capnote').innerHTML = `<span class="illus">Illustrative</span> Worst case over three operating points (yours, 3000 rpm / 250 Nm, 9000 rpm / 300 Nm). The first-order estimate C ≈ I<sub>C,rms</sub> / (2π f<sub>dom</sub> · V<sub>ripple,rms</sub>) ${Math.abs(est - (best ? best.C : 1500)) / (best ? best.C : 1500) > 0.3 ? 'differs from the simulation because the ripple is not a single sinusoid and the battery-side L–C path carries part of the AC current' : 'is close to the simulated result here'}. The capacitor RMS current (${Math.max(...capRes.map(r => r.ic)).toFixed(0)} A) must also be within its thermal rating.`;
    $('#capstat').textContent = '15 candidates × 3 operating points';
  }
  $('#cap-eq').innerHTML = U.eqPanel('Engineering equations · DC-link sizing', `
    <span class="r">i_C(t) = i_dc(t) − i_bat(t),    v_C(t) = v_C(0) + (1/C) ∫ i_C dt</span>
    <span class="r">First-order: ΔV_pp ≈ ΔQ / C   ⇒   C ≥ ΔQ / ΔV_pp,max</span>
    <span class="r">Sinusoidal-ripple estimate: C ≈ I_C,rms / (2π f · V_ripple,rms)</span>
    <span class="r">Battery-side L–C anti-resonance: f_ar = 1 / (2π √(L_b C))</span>
    <span class="r">Capacitor self-resonance: f_sr = 1 / (2π √(ESL · C))</span>
    <span class="r">Losses: P_C = I_C,rms² · ESR   →   thermal limit on I_C,rms</span>
    <span class="r">Stored energy: W = ½ C V_dc²   (discharge time and safety)</span>`);

  /* ---------------- Bode / impedance ---------------- */
  const bCv = U.canvas($('#bodeplot'), 340); let sweepF = 100, idcSp = null;
  function Z(f) { const w = TAU * f; const zc = { re: S.ESR, im: w * S.ESL - 1 / (w * S.C) }, zb = { re: 0.03, im: w * S.Lb };
    const num = { re: zc.re * zb.re - zc.im * zb.im, im: zc.re * zb.im + zc.im * zb.re }, den = { re: zc.re + zb.re, im: zc.im + zb.im }; const d2 = den.re ** 2 + den.im ** 2;
    return { re: (num.re * den.re + num.im * den.im) / d2, im: (num.im * den.re - num.re * den.im) / d2 }; }
  function drawBode() {
    const { w, h: H } = bCv.fit(), ctx = bCv.ctx; ctx.clearRect(0, 0, w, H);
    const ml = 52, mr = 12, pw = w - ml - mr, h1 = (H - 40) * 0.62, h2 = (H - 40) * 0.38, f0 = 10, f1 = 1e6;
    const X = f => ml + Math.log10(f / f0) / Math.log10(f1 / f0) * pw;
    const zs = []; for (let k = 0; k <= 400; k++) { const f = f0 * (f1 / f0) ** (k / 400); const z = Z(f); zs.push({ f, m: Math.hypot(z.re, z.im), p: Math.atan2(z.im, z.re) * 180 / Math.PI }); }
    const mmax = Math.log10(Math.max(...zs.map(z => z.m)) * 2), mmin = Math.log10(Math.min(...zs.map(z => z.m)) / 2);
    const Ym = m => 6 + h1 - (Math.log10(m) - mmin) / (mmax - mmin) * h1, Yp = p => 20 + h1 + h2 - (p + 90) / 180 * h2;
    ctx.font = '10px ' + css('--f-mono'); ctx.fillStyle = css('--muted');
    for (let d = 1; d <= 6; d++) { const f = 10 ** d; ctx.strokeStyle = css('--grid'); ctx.beginPath(); ctx.moveTo(X(f), 6); ctx.lineTo(X(f), H - 20); ctx.stroke(); ctx.textAlign = 'center'; ctx.fillText(f >= 1000 ? f / 1000 + 'k' : f, X(f), H - 6); }
    ctx.textAlign = 'right'; ctx.fillText((10 ** mmax * 1000).toPrecision(2) + ' mΩ', ml - 4, 14); ctx.fillText((10 ** mmin * 1000).toPrecision(2) + ' mΩ', ml - 4, 6 + h1); ctx.fillText('+90°', ml - 4, 26 + h1); ctx.fillText('−90°', ml - 4, 20 + h1 + h2);
    // excitation lines from inverter DC current spectrum
    if (idcSp) { let amax = 0; for (let k = 1; k < idcSp.A.length; k++) if (idcSp.f[k] > 20) amax = Math.max(amax, idcSp.A[k]);
      ctx.strokeStyle = css('--violet'); ctx.globalAlpha = .55; ctx.beginPath(); for (let k = 1; k < idcSp.A.length; k++) { const f = idcSp.f[k]; if (f < 20 || f > f1 || idcSp.A[k] < amax * 0.03) continue; const x = X(f); ctx.moveTo(x, 6 + h1); ctx.lineTo(x, 6 + h1 - idcSp.A[k] / amax * h1 * 0.6); } ctx.stroke(); ctx.globalAlpha = 1; }
    ctx.strokeStyle = css('--hv'); ctx.lineWidth = 2.2; ctx.beginPath(); zs.forEach((z, i) => i ? ctx.lineTo(X(z.f), Ym(z.m)) : ctx.moveTo(X(z.f), Ym(z.m))); ctx.stroke();
    ctx.strokeStyle = css('--sig'); ctx.lineWidth = 1.6; ctx.beginPath(); zs.forEach((z, i) => i ? ctx.lineTo(X(z.f), Yp(z.p)) : ctx.moveTo(X(z.f), Yp(z.p))); ctx.stroke();
    const far = 1 / (TAU * Math.sqrt(S.Lb * S.C)), fsr = 1 / (TAU * Math.sqrt(S.ESL * S.C));
    [[far, 'anti-resonance L_b–C'], [fsr, 'C self-resonance'], [S.fsw, 'f_sw'], [2 * S.fsw, '2f_sw']].forEach(([f, t], i) => { ctx.strokeStyle = css(i < 2 ? '--bad' : '--muted'); ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.moveTo(X(f), 6); ctx.lineTo(X(f), 6 + h1); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = css(i < 2 ? '--bad' : '--muted'); ctx.textAlign = 'left'; ctx.fillText(t, X(f) + 3, 16 + i * 12); });
    const z = Z(sweepF), m = Math.hypot(z.re, z.im), p = Math.atan2(z.im, z.re) * 180 / Math.PI;
    ctx.strokeStyle = css('--ink'); ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(X(sweepF), 6); ctx.lineTo(X(sweepF), H - 20); ctx.stroke();
    ctx.fillStyle = css('--ink'); ctx.beginPath(); ctx.arc(X(sweepF), Ym(m), 4, 0, 7); ctx.fill(); ctx.beginPath(); ctx.arc(X(sweepF), Yp(p), 4, 0, 7); ctx.fill();
    $('#bodestat').textContent = `f ${sweepF >= 1000 ? (sweepF / 1000).toFixed(2) + ' kHz' : sweepF.toFixed(0) + ' Hz'} · |Z| ${(m * 1000).toFixed(2)} mΩ · ∠ ${p.toFixed(0)}°`;
    $('#bodedash').innerHTML = `<div><span>anti-res.</span><b>${(far / 1000).toFixed(2)}</b><small>kHz</small></div><div><span>|Z| peak</span><b>${(Math.hypot(Z(far).re, Z(far).im) * 1000).toFixed(1)}</b><small>mΩ</small></div><div><span>self-res.</span><b>${(fsr / 1000).toFixed(0)}</b><small>kHz</small></div><div><span>|Z| @ 2f<sub>sw</sub></span><b>${(Math.hypot(Z(2 * S.fsw).re, Z(2 * S.fsw).im) * 1000).toFixed(2)}</b><small>mΩ</small></div>`;
  }
  function drawCkt() {
    const svg = $('#ckt'); svg.innerHTML = ''; const e = (t, a) => U.el(t, a, svg), c = css('--ink'), hv = css('--hv');
    const txt = (x, y, s, col) => { const t = e('text', { x, y }); t.textContent = s; t.style.font = '11px ' + css('--f-mono'); t.style.fill = col || css('--muted'); };
    e('circle', { cx: 30, cy: 90, r: 16, fill: 'none', stroke: hv, 'stroke-width': 1.6 }); txt(22, 94, 'V_b', hv);
    e('path', { d: 'M30 74 V30 H60', fill: 'none', stroke: c }); e('rect', { x: 60, y: 24, width: 34, height: 12, fill: 'none', stroke: c }); txt(62, 18, 'R_b');
    e('path', { d: 'M94 30 H110 q6 -10 12 0 q6 -10 12 0 q6 -10 12 0 q6 -10 12 0 H190', fill: 'none', stroke: c }); txt(118, 18, 'L_b');
    e('path', { d: 'M190 30 V60', fill: 'none', stroke: c }); e('rect', { x: 182, y: 60, width: 16, height: 14, fill: 'none', stroke: c }); txt(204, 71, 'ESR');
    e('path', { d: 'M190 74 V80 q-8 4 0 8 q8 4 0 8 V100', fill: 'none', stroke: c }); txt(204, 94, 'ESL');
    e('line', { x1: 176, x2: 204, y1: 104, y2: 104, stroke: c, 'stroke-width': 2.4 }); e('line', { x1: 176, x2: 204, y1: 112, y2: 112, stroke: c, 'stroke-width': 2.4 }); txt(208, 112, 'C_link', css('--hv'));
    e('path', { d: 'M190 112 V150 H30 V106', fill: 'none', stroke: c }); e('path', { d: 'M190 30 H300 V70', fill: 'none', stroke: c }); e('path', { d: 'M300 110 V150 H190', fill: 'none', stroke: c });
    e('circle', { cx: 300, cy: 90, r: 18, fill: 'none', stroke: css('--violet'), 'stroke-width': 1.6 }); e('path', { d: 'M300 102 V78 M294 84 L300 78 L306 84', fill: 'none', stroke: css('--violet'), 'stroke-width': 1.6 }); txt(250, 132, 'i_dc (inv + aux)', css('--violet'));
    txt(60, 166, 'Z(f) = Z_C ∥ (R_b + jωL_b)');
  }
  drawCkt(); U.onTheme(() => { drawCkt(); drawBode(); }); addEventListener('resize', drawBode);
  U.loop($('#bodeplot'), dt => { sweepF *= Math.exp(dt * 0.9); if (sweepF > 1e6) sweepF = 10; drawBode(); });

  /* ---------------- main update ---------------- */
  function update(keepCmp) {
    const W = run(S.st); lastW = W;
    analyse(W, `${E.STRATS[W.op.strat].name} · ${S.rpm} rpm · ${W.op.T.toFixed(0)} Nm`);
    idcSp = E.spectrum(W.idc, W.fs, W.integer ? 'rect' : 'hann');
    Object.keys(CH).forEach(k => N.flow('q_' + k, k === S.ch ? 0.9 : 0));
    Object.keys(CH).forEach(k => N.hi('p_' + k, k === S.ch, '--violet'));
    const P = (W.op.T * S.rpm * TAU / 60) / 1000;
    N.val('bat', S.vdc + ' V'); N.val('pim', E.STRATS[W.op.strat].name + ' · ' + P.toFixed(0) + ' kW'); N.val('pmsm', S.rpm + ' rpm · ' + W.op.T.toFixed(0) + ' Nm');
    N.val('comp', S.aux.comp ? '3.5 kW' : 'off'); N.val('heater', S.aux.heater ? '5 kW · 1 kHz PWM' : 'off'); N.val('dcdc', S.aux.dcdc ? '1.5 kW' : 'off'); N.val('clink', (S.C * 1e6).toFixed(0) + ' µF');
    ['b1', 'b2', 'b3', 'b4', 'b8'].forEach(k => N.flow(k, Math.max(-1, Math.min(1, P / 80)))); N.flow('b5', S.aux.comp ? .4 : 0); N.flow('b6', S.aux.heater ? .5 : 0); N.flow('b7', S.aux.dcdc ? .3 : 0);
    if (!keepCmp) compare();
    drawBode(); if (capRes) drawCap();
  }
  N.select('p_vbus');
  update();
});
