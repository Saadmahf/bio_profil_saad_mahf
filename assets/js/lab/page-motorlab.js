document.addEventListener('DOMContentLoaded', () => {
  const E = EV, U = UI, css = U.css;
  const rig = Rig(document.getElementById('ctrl'), { id: 'ml', fixedVdc: true, params: { Vdc: 360, useBattery: false } });
  const pt = rig.pt;

  /* ---------- vehicle + dashboard ---------- */
  const car = U.Car(document.getElementById('car'), { height: 170 });
  const dash = Dash(document.getElementById('dash'), ['v', 'rpm', 'T', 'P', 'Vdc', 'st', 'M', 'id', 'iq', 'loss']);
  let wheel = 0;
  rig.on((p, dt) => {
    car.update({ v: p.v, x: p.x, P: p.Pdc, brake: p.Fbrake < -50, dt, label: p.P.mode === 'auto' ? 'auto cycle · ' + p.P.cycle : 'manual · target ' + p.P.targetKmh.toFixed(0) + ' km/h' });
    dash.update(p);
  });

  /* ---------- power & feedback architecture ---------- */
  const INFO = {
    bat: '<p>HV energy source. In this lab the DC voltage is set directly with the slider so the effect of V<sub>dc</sub> on the voltage limit is easy to see. The EV twin page uses a full battery + BMS model instead.</p>',
    bus: '<p>DC bus with the DC-link capacitor. The inverter draws a chopped current; the capacitor supplies its AC part so the battery sees a smoother current. Ripple is analysed in the <a href="hv-validation.html">HV validation lab</a>.</p>',
    inv: () => `<p>Three-phase two-level VSI, 6 switches. Current strategy: <b>${E.STRATS[pt.strat].name}</b>, f<sub>sw</sub> = ${pt.P.fsw / 1000} kHz${pt.strat === 'six' ? ' (six-step: one switching event per 60° electrical, so switching losses drop sharply)' : ''}.</p>`,
    mot: () => `<p>Interior PMSM, 8 poles. Torque T = 1.5·p·[ψ<sub>f</sub>·i<sub>q</sub> + (L<sub>d</sub>−L<sub>q</sub>)·i<sub>d</sub>·i<sub>q</sub>]. The second (reluctance) term is why negative i<sub>d</sub> both adds torque (MTPA) and weakens flux at high speed.</p><p class="mono">i<sub>d</sub> = ${pt.op ? pt.op.id.toFixed(0) : 0} A · i<sub>q</sub> = ${pt.op ? pt.op.iq.toFixed(0) : 0} A · T = ${pt.Tmot.toFixed(0)} Nm</p>`,
    gear: '<p>Single-speed reduction, ratio 9:1, efficiency 97 %. Motor speed = wheel speed × 9.</p>',
    whl: '<p>Wheel radius 0.31 m. Road load = rolling resistance (C<sub>rr</sub> 0.011) + aerodynamic drag (C<sub>d</sub>A 0.62 m²) + grade.</p>',
    ctl: '<p>Motor control unit: speed loop (from the VCU), MTPA / flux-weakening current references, d/q current PI loops, inverse Park and the modulator. Feedback: rotor angle θ and speed ω from a resolver, phase currents from current sensors, and V<sub>dc</sub>.</p>'
  };
  const A = U.Arch(document.getElementById('arch'), {
    uid: 'pw', w: 940, h: 300, info: INFO,
    nodes: [
      { id: 'bat', x: 10, y: 92, w: 110, h: 64, t: 'HV battery', s: '360 V', kind: 'hv' },
      { id: 'bus', x: 170, y: 92, w: 120, h: 64, t: 'DC bus', s: 'C_link 500 µF', kind: 'hv' },
      { id: 'inv', x: 340, y: 92, w: 120, h: 64, t: 'Inverter', s: 'SVPWM', kind: 'hv' },
      { id: 'mot', x: 510, y: 92, w: 120, h: 64, t: 'IPMSM', s: '0 rpm' },
      { id: 'gear', x: 680, y: 92, w: 100, h: 64, t: 'Gear 9:1', s: '' },
      { id: 'whl', x: 820, y: 92, w: 110, h: 64, t: 'Wheel', s: '0 km/h' },
      { id: 'ctl', x: 300, y: 214, w: 360, h: 50, t: 'Motor controller · FOC + modulator', s: '', kind: 'ctrl' }],
    edges: [
      { id: 'e1', type: 'hv', d: 'M120 124 H168' }, { id: 'e2', type: 'hv', d: 'M290 124 H338' }, { id: 'e3', type: 'hv', d: 'M460 124 H508', label: 'v_abc', lx: 484, ly: 116 },
      { id: 'e4', type: 'mech', d: 'M630 124 H678' }, { id: 'e5', type: 'mech', d: 'M780 124 H818' },
      { id: 'f1', type: 'sig', d: 'M560 156 V212', label: 'θ, ω', lx: 538, ly: 190 }, { id: 'f2', type: 'sig', d: 'M600 156 V212', label: 'i_abc', lx: 622, ly: 190 },
      { id: 'g', type: 'sig', d: 'M400 214 V158', label: 'gates', lx: 380, ly: 190 },
      { id: 'vs', type: 'lv', d: 'M230 156 V239 H298', label: 'V_dc sense', lx: 236, ly: 200, anchor: 'start' },
      { id: 'wr', type: 'lv', d: 'M760 239 H662', label: 'ω_ref (VCU)', lx: 712, ly: 232 }]
  }, document.getElementById('archinfo'));
  rig.on(p => {
    const r = p.Pdc / 90000;
    ['e1', 'e2', 'e3'].forEach(k => A.flow(k, r)); ['e4', 'e5'].forEach(k => A.flow(k, p.Pmech / 90000));
    ['f1', 'f2', 'g', 'vs', 'wr'].forEach(k => A.flow(k, p.Vdc > 5 ? 0.5 : 0));
    A.val('bat', p.Vdc.toFixed(0) + ' V'); A.val('inv', E.STRATS[p.strat].name); A.val('mot', (p.op ? p.op.rpm : 0).toFixed(0) + ' rpm · ' + p.Tmot.toFixed(0) + ' Nm');
    A.val('whl', (p.v * 3.6).toFixed(0) + ' km/h'); A.val('ctl', 'T* ' + (p.Treq || 0).toFixed(0) + ' Nm · i_d ' + (p.op ? p.op.id.toFixed(0) : 0) + ' A · i_q ' + (p.op ? p.op.iq.toFixed(0) : 0) + ' A');
    A.val('bus', (p.Pdc / 1000).toFixed(1) + ' kW');
  });

  /* ---------- modulation labs ---------- */
  MOD.SPWM(document.getElementById('spwm'));
  MOD.SVPWM(document.getElementById('svpwm'));
  MOD.SixStep(document.getElementById('six'));
  const sd = document.getElementById('sixdemo'); SixStepDemo(sd);

  /* ---------- DC-bus utilisation control ---------- */
  const UA = U.Arch(document.getElementById('uarch'), {
    uid: 'ua', w: 1000, h: 250, info: {},
    nodes: [
      { id: 'b', x: 10, y: 70, w: 100, h: 56, t: 'Battery', s: '', kind: 'hv' },
      { id: 'vs', x: 150, y: 70, w: 110, h: 56, t: 'V sensor', s: 'ADC', kind: 'ctrl' },
      { id: 'vdc', x: 300, y: 70, w: 120, h: 56, t: 'V_dc estimate', s: 'filtered', kind: 'ctrl' },
      { id: 'avc', x: 460, y: 52, w: 200, h: 92, t: 'Voltage availability', s: 'region', kind: 'ctrl' },
      { id: 'mod', x: 700, y: 70, w: 130, h: 56, t: 'Modulator', s: '', kind: 'hv' },
      { id: 'inv', x: 870, y: 70, w: 120, h: 56, t: 'Inverter→IPMSM', s: '', kind: 'hv' },
      { id: 'fw', x: 700, y: 172, w: 130, h: 50, t: 'Flux weakening', s: 'i_d*', kind: 'ctrl' },
      { id: 'cur', x: 460, y: 172, w: 200, h: 50, t: 'Current loop |V*| request', s: '', kind: 'ctrl' }],
    edges: [
      { id: 'a1', type: 'hv', d: 'M110 98 H148' }, { id: 'a2', type: 'lv', d: 'M260 98 H298' }, { id: 'a3', type: 'lv', d: 'M420 98 H458', label: 'V_dc', lx: 438, ly: 90 },
      { id: 'a4', type: 'sig', d: 'M660 98 H698', label: 'mode', lx: 680, ly: 90 }, { id: 'a5', type: 'sig', d: 'M830 98 H868', label: 'gates', lx: 850, ly: 90 },
      { id: 'a6', type: 'sig', d: 'M560 30 V50', label: 'ω_e → back-EMF ω·ψ', lx: 566, ly: 24, anchor: 'start' },
      { id: 'a7', type: 'sig', d: 'M560 172 V146', label: '|V*| req', lx: 566, ly: 162, anchor: 'start' },
      { id: 'a8', type: 'sig', d: 'M640 146 V160 H765 V170', label: 'V_lim', lx: 680, ly: 160 },
      { id: 'a9', type: 'sig', d: 'M700 197 H662', label: 'i_d*', lx: 681, ly: 190 }]
  }, null);
  const REGN = ['Linear · SPWM', 'Linear · SVPWM', 'Overmodulation', 'Six-step'];
  const tb = document.querySelector('#regtab tbody');
  tb.innerHTML = [['1 · Linear', '≤ 0.785 (π/4)', 'SPWM'], ['2 · Extended linear', '0.785 – 0.907', 'SVPWM'], ['3 · Overmodulation', '0.907 – 0.985', 'SVPWM + clamp'], ['4 · Voltage-limited', '≥ 0.985', 'Six-step + flux weakening']]
    .map((r, i) => `<tr data-r="${i}"><td>${r[0]}</td><td class="mono">${r[1]}</td><td>${r[2]}</td></tr>`).join('');
  const regDash = document.getElementById('regdash'); regDash.classList.add('dash');
  // voltage map canvas
  const vm = U.canvas(document.getElementById('vmap'), 300);
  function drawMap(p) {
    const { w, h: H } = vm.fit(), ctx = vm.ctx; ctx.clearRect(0, 0, w, H);
    const ml = 48, mb = 26, pw = w - ml - 10, ph = H - mb - 8, Vdc = Math.max(p.Vdc, 1);
    const X = r => ml + r / 12000 * pw, Y = v => 8 + ph - v / 300 * ph;
    const lims = [Vdc / 2, Vdc / Math.sqrt(3), 0.985 * 2 * Vdc / Math.PI, 2 * Vdc / Math.PI];
    const cols = ['--sig-soft', 'color-mix(in srgb,var(--sig) 30%,var(--surface))', 'var(--hv-soft)', 'color-mix(in srgb,var(--hv) 30%,var(--surface))'];
    let y0 = 0; lims.forEach((v, i) => { ctx.fillStyle = i === 0 ? css('--sig-soft') : cols[i].startsWith('--') ? css(cols[i]) : cols[i]; ctx.fillRect(ml, Y(v), pw, Y(y0) - Y(v)); y0 = v; });
    ctx.font = '10px ' + css('--f-mono');
    [['SPWM V_dc/2', 0], ['SVPWM V_dc/√3', 1], ['six-step 2V_dc/π', 3]].forEach(([t, i]) => { ctx.strokeStyle = css('--ink'); ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(ml, Y(lims[i])); ctx.lineTo(ml + pw, Y(lims[i])); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = css('--ink'); ctx.fillText(t + ' = ' + lims[i].toFixed(0) + ' V', ml + 6, Y(lims[i]) - 4); });
    // back-EMF line
    ctx.strokeStyle = css('--muted'); ctx.lineWidth = 1.2; ctx.beginPath();
    for (let r = 0; r <= 12000; r += 200) { const v = E.rpm2we(r) * E.M.psi; r ? ctx.lineTo(X(r), Y(v)) : ctx.moveTo(X(r), Y(v)); } ctx.stroke();
    // required voltage at the current torque request (MTPA, no limit)
    const T = p.Treq || 0, m = E.mtpa(T);
    ctx.strokeStyle = css('--hv'); ctx.lineWidth = 2.2; ctx.beginPath();
    for (let r = 0; r <= 12000; r += 150) { const v = Math.min(300, E.volt(m.id, m.iq, E.rpm2we(r)).v); r ? ctx.lineTo(X(r), Y(v)) : ctx.moveTo(X(r), Y(v)); } ctx.stroke();
    // axes
    ctx.fillStyle = css('--muted'); ctx.textAlign = 'center'; for (let r = 0; r <= 12000; r += 3000) ctx.fillText(r + ' rpm', X(r), H - 8);
    ctx.textAlign = 'right'; for (let v = 0; v <= 300; v += 100) ctx.fillText(v + ' V', ml - 5, Y(v) + 3);
    // operating points
    const rpm = p.op ? p.op.rpm : 0, vreq = E.volt(m.id, m.iq, E.rpm2we(rpm)).v, vapp = p.op ? p.op.v : 0;
    ctx.strokeStyle = css('--hv'); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(X(rpm), Y(Math.min(vreq, 298)), 7, 0, 7); ctx.stroke();
    ctx.fillStyle = css('--ink'); ctx.beginPath(); ctx.arc(X(rpm), Y(vapp), 5, 0, 7); ctx.fill();
    if (vreq > vapp + 2) { ctx.strokeStyle = css('--bad'); ctx.setLineDash([2, 3]); ctx.beginPath(); ctx.moveTo(X(rpm), Y(Math.min(vreq, 298))); ctx.lineTo(X(rpm), Y(vapp)); ctx.stroke(); ctx.setLineDash([]); }
    ctx.textAlign = 'left';
  }
  U.Spectrum && 0;
  Kit.legend('#vmap-lg', [{ color: '--hv', label: '|V| required by MTPA at current torque' }, { color: '--muted', label: 'back-EMF ω·ψ (no load)' }, { color: '--ink', label: '● applied |V|  ○ requested' }]);
  let lastReg = -1;
  rig.on(p => {
    drawMap(p);
    const rq = E.mtpa(p.Treq || 0), vreq = E.volt(rq.id, rq.iq, E.rpm2we(p.op ? p.op.rpm : 0)).v;
    UA.val('b', p.Vdc.toFixed(0) + ' V'); UA.val('vdc', p.Vdc.toFixed(0) + ' V'); UA.val('avc', REGN[p.reg] + (p.P.strategy !== 'auto' ? ' (forced ' + E.STRATS[p.strat].name + ')' : ''));
    UA.val('mod', E.STRATS[p.strat].name); UA.val('cur', '|V*| ' + vreq.toFixed(0) + ' V · M ' + p.Mreq.toFixed(2)); UA.val('fw', p.op && p.op.fw ? 'active · i_d ' + p.op.id.toFixed(0) + ' A' : 'inactive');
    UA.val('inv', (p.op ? p.op.v : 0).toFixed(0) + ' V applied');
    ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8', 'a9'].forEach(k => UA.flow(k, 0.5));
    regDash.innerHTML = `<div><span>V<sub>dc</sub></span><b>${p.Vdc.toFixed(0)}</b><small>V</small></div><div><span>|V| requested</span><b>${vreq.toFixed(0)}</b><small>V</small></div><div><span>|V| applied</span><b>${(p.op ? p.op.v : 0).toFixed(0)}</b><small>V</small></div><div><span>M</span><b>${p.Mreq.toFixed(2)}</b></div><div><span>T* / T</span><b>${(p.Treq || 0).toFixed(0)}/${p.Tmot.toFixed(0)}</b><small>Nm</small></div>`;
    if (p.reg !== lastReg) { lastReg = p.reg; tb.querySelectorAll('tr').forEach(tr => tr.setAttribute('aria-current', +tr.dataset.r === p.reg)); }
    const over = vreq > (p.op ? p.op.v : 0) + 2;
    document.getElementById('regnote').innerHTML = over
      ? `<b style="color:var(--hv)">Requested voltage &gt; available.</b> The back-EMF at ${(p.op ? p.op.rpm : 0).toFixed(0)} rpm needs ${vreq.toFixed(0)} V for MTPA but the ${E.STRATS[p.strat].name} limit is ${E.STRATS[p.strat].vlim(p.Vdc).toFixed(0)} V. The controller injects negative i<sub>d</sub> (flux weakening${p.op && p.op.flag === 'derated' ? ') and, at the current limit, derates torque' : ')'}.`
      : `Voltage margin available: the current loop runs MTPA without flux weakening. Region: <b>${REGN[p.reg]}</b>.`;
  });
  document.getElementById('util-eq').innerHTML = U.eqPanel('Engineering equations · voltage limit and regions', `
    <span class="r">|V*| = √(v_d*² + v_q*²),  v_d = R_s i_d − ω_e L_q i_q,  v_q = R_s i_q + ω_e (L_d i_d + ψ_f)</span>
    <span class="r">M = |V*| / (2V_dc/π)   (modulation index normalised to six-step)</span>
    <span class="r">SPWM linear limit  V_dc/2 → M = π/4 = 0.785</span>
    <span class="r">SVPWM linear limit V_dc/√3 → M = π/(2√3) = 0.907</span>
    <span class="r">Six-step           2V_dc/π → M = 1</span>
    <span class="r">Hysteresis band of 0.03 on the way down avoids mode chatter (same idea as my firmware-style six-step flag).</span>
    <span class="r">Region policy is chosen for demonstration; production drives usually run SVPWM through the whole linear range.</span>`);

  /* ---------- closed-loop architecture ---------- */
  const LI = {
    wref: '<p>Speed reference from the VCU (driver pedal or drive cycle), ramp-limited by the acceleration setting.</p>',
    spi: '<p>Speed PI with feed-forward of reference acceleration and road load. Output: torque request, clamped by the torque limit and, during regen, by the BMS charge-current limit.</p><p class="mono">T* = r/(G·η)·[m·a_ref + F_road + K_p e + K_i ∫e]</p>',
    mtpa: '<p>MTPA chooses the (i<sub>d</sub>, i<sub>q</sub>) pair with minimum current for T*. When the voltage limit is reached, flux weakening moves i<sub>d</sub> more negative along the voltage ellipse; at the current circle the torque is derated.</p>',
    cpi: '<p>Two PI controllers on i<sub>d</sub> and i<sub>q</sub> with cross-coupling decoupling (−ω L<sub>q</sub> i<sub>q</sub>, +ω(L<sub>d</sub> i<sub>d</sub> + ψ)). Output v<sub>d</sub>*, v<sub>q</sub>*.</p>',
    ipark: '<p>Rotates v<sub>d</sub>*, v<sub>q</sub>* back to the stator frame using θ<sub>e</sub>: v<sub>α</sub> = v<sub>d</sub> cosθ − v<sub>q</sub> sinθ, v<sub>β</sub> = v<sub>d</sub> sinθ + v<sub>q</sub> cosθ.</p>',
    modu: () => `<p>Turns v<sub>α</sub>, v<sub>β</sub> into duty cycles or six-step states. Current: <b>${E.STRATS[pt.strat].name}</b>.</p>`,
    inv: '<p>Two-level VSI applying ±V<sub>dc</sub>/2 per leg.</p>', mot: '<p>IPMSM: electromagnetic torque from i<sub>d</sub>, i<sub>q</sub>.</p>',
    veh: '<p>Gear 9:1, wheel 0.31 m, mass 1700 kg + payload, road load and grade. Integrates to vehicle speed, which closes the loop.</p>',
    sens: '<p>Phase current sensors (two are enough, i<sub>a</sub>+i<sub>b</sub>+i<sub>c</sub> = 0).</p>', clarke: '<p>i<sub>α</sub> = i<sub>a</sub>, i<sub>β</sub> = (i<sub>a</sub> + 2 i<sub>b</sub>)/√3</p>',
    park: '<p>i<sub>d</sub> = i<sub>α</sub> cosθ + i<sub>β</sub> sinθ, i<sub>q</sub> = −i<sub>α</sub> sinθ + i<sub>β</sub> cosθ</p>', res: '<p>Resolver gives rotor angle θ<sub>m</sub>; θ<sub>e</sub> = p·θ<sub>m</sub>, ω from its derivative.</p>'
  };
  const L = U.Arch(document.getElementById('larch'), {
    uid: 'lp', w: 1180, h: 360, info: LI,
    nodes: [
      { id: 'wref', x: 10, y: 40, w: 90, h: 56, t: 'ω_ref', s: '', kind: 'ctrl' }, { id: 'spi', x: 140, y: 40, w: 100, h: 56, t: 'Speed PI', s: '', kind: 'ctrl' },
      { id: 'mtpa', x: 280, y: 40, w: 110, h: 56, t: 'MTPA / FW', s: '', kind: 'ctrl' }, { id: 'cpi', x: 430, y: 40, w: 120, h: 56, t: 'Current PI ×2', s: '', kind: 'ctrl' },
      { id: 'ipark', x: 590, y: 40, w: 110, h: 56, t: 'Inv. Park', s: '' }, { id: 'modu', x: 740, y: 40, w: 120, h: 56, t: 'Modulator', s: '', kind: 'ctrl' },
      { id: 'inv', x: 900, y: 40, w: 110, h: 56, t: 'Inverter', s: '', kind: 'hv' }, { id: 'mot', x: 1050, y: 40, w: 120, h: 56, t: 'IPMSM', s: '' },
      { id: 'veh', x: 1050, y: 214, w: 120, h: 56, t: 'Vehicle', s: '' }, { id: 'sens', x: 900, y: 214, w: 110, h: 56, t: 'i sensors', s: '' },
      { id: 'clarke', x: 740, y: 214, w: 120, h: 56, t: 'Clarke', s: '' }, { id: 'park', x: 590, y: 214, w: 110, h: 56, t: 'Park', s: '' },
      { id: 'res', x: 430, y: 214, w: 120, h: 56, t: 'Resolver', s: 'θ_e, ω' }],
    edges: [
      { id: 'l1', type: 'sig', d: 'M100 68 H138', label: '', lx: 119, ly: 60 }, { id: 'l2', type: 'sig', d: 'M240 68 H278', label: 'T*', lx: 259, ly: 60 },
      { id: 'l3', type: 'sig', d: 'M390 68 H428', label: 'i*', lx: 409, ly: 60 }, { id: 'l4', type: 'sig', d: 'M550 68 H588', label: 'v_dq*', lx: 569, ly: 60 },
      { id: 'l5', type: 'sig', d: 'M700 68 H738', label: 'v_αβ*', lx: 719, ly: 60 }, { id: 'l6', type: 'sig', d: 'M860 68 H898', label: 'gates', lx: 879, ly: 60 },
      { id: 'l7', type: 'hv', d: 'M1010 68 H1048', label: 'v_abc', lx: 1029, ly: 60 },
      { id: 'l8', type: 'mech', d: 'M1110 96 V212', label: 'T_e', lx: 1120, ly: 160, anchor: 'start' },
      { id: 'l9', type: 'sig', d: 'M1030 68 V120 H955 V212', label: 'i_abc', lx: 960, ly: 140, anchor: 'start' },
      { id: 'l10', type: 'sig', d: 'M900 242 H862' }, { id: 'l11', type: 'sig', d: 'M740 242 H702', label: 'i_αβ', lx: 721, ly: 234 },
      { id: 'l12', type: 'sig', d: 'M640 214 V150 H490 V98', label: 'i_d, i_q', lx: 566, ly: 144 },
      { id: 'l13', type: 'sig', d: 'M1085 270 V300 H490 V272', label: 'θ_m', lx: 800, ly: 294 },
      { id: 'l14', type: 'sig', d: 'M550 242 H588', label: 'θ_e', lx: 569, ly: 234 },
      { id: 'l15', type: 'sig', d: 'M520 214 V180 H720 V98 H700', label: 'θ_e', lx: 724, ly: 150, anchor: 'start' },
      { id: 'l16', type: 'lv', d: 'M1140 270 V330 H190 V98', label: 'ω feedback', lx: 640, ly: 324 },
      { id: 'l17', type: 'lv', d: 'M800 14 V38', label: 'V_dc', lx: 806, ly: 14, anchor: 'start' }]
  }, document.getElementById('larchinfo'));
  rig.on(p => {
    const o = p.op || { id: 0, iq: 0, vd: 0, vq: 0, rpm: 0 };
    L.val('wref', (p.vref * 3.6).toFixed(0) + ' km/h'); L.val('spi', 'e ' + ((p.vref - p.v) * 3.6).toFixed(1) + ' km/h');
    L.val('mtpa', 'T* ' + (p.Treq || 0).toFixed(0) + ' Nm'); L.val('cpi', o.id.toFixed(0) + ' / ' + o.iq.toFixed(0) + ' A');
    L.val('ipark', '|v| ' + (o.v || 0).toFixed(0) + ' V'); L.val('modu', E.STRATS[p.strat].name); L.val('inv', p.Vdc.toFixed(0) + ' V'); L.val('mot', o.rpm.toFixed(0) + ' rpm');
    L.val('veh', (p.v * 3.6).toFixed(0) + ' km/h'); L.val('sens', 'Î ' + Math.hypot(o.id, o.iq).toFixed(0) + ' A');
    const k = Math.min(1, Math.abs(p.Pdc) / 60000) + 0.25;
    ['l1', 'l2', 'l3', 'l4', 'l5', 'l6', 'l9', 'l10', 'l11', 'l12', 'l13', 'l14', 'l15', 'l16', 'l17'].forEach(id => L.flow(id, k));
    L.flow('l7', p.Pdc / 90000); L.flow('l8', p.Pmech / 90000);
    L.label('l2', 'T* ' + (p.Treq || 0).toFixed(0)); L.label('l4', 'v_d ' + o.vd.toFixed(0) + ' v_q ' + o.vq.toFixed(0));
    L.label('l16', 'ω feedback · ' + (o.rpm || 0).toFixed(0) + ' rpm');
  });
  document.getElementById('loop-eq').innerHTML = U.eqPanel('Engineering equations · IPMSM and vehicle', `
    <span class="r">v_d = R_s i_d + L_d di_d/dt − ω_e L_q i_q</span>
    <span class="r">v_q = R_s i_q + L_q di_q/dt + ω_e (L_d i_d + ψ_f)</span>
    <span class="r">T_e = (3/2) p [ψ_f i_q + (L_d − L_q) i_d i_q]</span>
    <span class="r">MTPA: i_d = [ψ_f − √(ψ_f² + 8(L_q−L_d)² I_s²)] / [4(L_q − L_d)]</span>
    <span class="r">Limits: i_d² + i_q² ≤ I_max²,  (L_d i_d + ψ_f)² + (L_q i_q)² ≤ (V_lim/ω_e)²</span>
    <span class="r">m dv/dt = T_e G η / r − m g (C_rr + sin α) − ½ ρ C_d A v²</span>
    <span class="r">Parameters (illustrative): p = 4, R_s = 12 mΩ, L_d = 0.18 mH, L_q = 0.45 mH, ψ_f = 75 mWb, I_max = 450 A</span>`);

  /* ---------- FOC view ---------- */
  const motor = U.Motor(document.getElementById('motor'), { height: 300 });
  const chain = document.getElementById('chain'); let th = 0;
  rig.on((p, dt) => {
    const o = p.op || { id: 0, iq: 0, vd: 0, vq: 0, we: 0 };
    th += (o.we || 0) * dt * (U.reduce ? 0 : 0.02);   // displayed rotation slowed ×50 so it can be followed
    motor.update({ th, id: o.id, iq: o.iq });
    const c = Math.cos(th), s = Math.sin(th), S3 = Math.sqrt(3);
    const ial = o.id * c - o.iq * s, ibe = o.id * s + o.iq * c;
    const ia = ial, ib = -ial / 2 + S3 / 2 * ibe, ic = -ial / 2 - S3 / 2 * ibe;
    const va = o.vd * c - o.vq * s, vb = o.vd * s + o.vq * c;
    const pa = va, pb = -va / 2 + S3 / 2 * vb, pc = -va / 2 - S3 / 2 * vb, z = -(Math.max(pa, pb, pc) + Math.min(pa, pb, pc)) / 2, Vd = Math.max(p.Vdc, 1);
    const d = x => Math.min(1, Math.max(0, 0.5 + (x + z) / Vd));
    chain.innerHTML = `<thead><tr><th>stage</th><th>signals</th><th class="n">values</th></tr></thead><tbody>
      <tr><td>phase currents</td><td class="mono">i_a, i_b, i_c</td><td class="n">${ia.toFixed(0)} · ${ib.toFixed(0)} · ${ic.toFixed(0)} A</td></tr>
      <tr><td>Clarke</td><td class="mono">i_α, i_β</td><td class="n">${ial.toFixed(0)} · ${ibe.toFixed(0)} A</td></tr>
      <tr><td>Park (θₑ)</td><td class="mono">i_d, i_q</td><td class="n">${o.id.toFixed(0)} · ${o.iq.toFixed(0)} A</td></tr>
      <tr><td>Current PI</td><td class="mono">v_d*, v_q*</td><td class="n">${o.vd.toFixed(0)} · ${o.vq.toFixed(0)} V</td></tr>
      <tr><td>Inverse Park</td><td class="mono">v_α*, v_β*</td><td class="n">${va.toFixed(0)} · ${vb.toFixed(0)} V</td></tr>
      <tr><td>Modulator (min-max)</td><td class="mono">d_a, d_b, d_c</td><td class="n">${d(pa).toFixed(2)} · ${d(pb).toFixed(2)} · ${d(pc).toFixed(2)}</td></tr>
      <tr><td>Torque</td><td class="mono">T_e</td><td class="n">${E.torque(o.id, o.iq).toFixed(0)} Nm</td></tr></tbody>`;
  });
  document.getElementById('foc-eq').innerHTML = U.eqPanel('Engineering equations · Clarke and Park', `
    <span class="r">Clarke (amplitude-invariant): i_α = i_a,  i_β = (i_a + 2 i_b)/√3</span>
    <span class="r">Park:  i_d =  i_α cos θ_e + i_β sin θ_e,   i_q = −i_α sin θ_e + i_β cos θ_e</span>
    <span class="r">Inverse Park: v_α = v_d cos θ_e − v_q sin θ_e,  v_β = v_d sin θ_e + v_q cos θ_e</span>
    <span class="r">Flux linkage: ψ_d = L_d i_d + ψ_f,  ψ_q = L_q i_q  → i_d &lt; 0 weakens ψ_d</span>`);

  /* ---------- signal lab ---------- */
  const sc = U.Scope(document.getElementById('scope'), {
    height: 420, hidden: ['vbn', 'ib', 'ic'], lanes: [
      { name: 'gates', h: .9, chans: [{ key: 'ga', label: 'S_a', color: '--hv' }, { key: 'gb', label: 'S_b', color: '--sig' }, { key: 'gc', label: 'S_c', color: '--violet' }] },
      { name: 'voltage [V]', h: 1, chans: [{ key: 'vab', label: 'v_ab', color: '--ink' }, { key: 'van', label: 'v_an', color: '--hv' }] },
      { name: 'current [A]', h: 1.2, sym: true, chans: [{ key: 'ia', label: 'i_a', color: '--hv' }, { key: 'ib', label: 'i_b', color: '--sig' }, { key: 'ic', label: 'i_c', color: '--violet' }] },
      { name: 'torque [Nm]', h: .8, chans: [{ key: 'Te', label: 'T_e', color: '--violet' }] },
      { name: 'DC [A / V]', h: 1, chans: [{ key: 'idc', label: 'i_dc', color: '--sig' }] },
      { name: 'V_bus [V]', h: .8, chans: [{ key: 'vbus', label: 'V_bus', color: '--hv' }] }]
  });
  const fv = U.Spectrum(document.getElementById('fftv'), { height: 190, spanIdx: 2, title: 'V_bus ripple spectrum' });
  const fi = U.Spectrum(document.getElementById('ffti'), { height: 190, spanIdx: 1, spans: [2000, 20000, 50000], title: 'i_a spectrum', color: '--sig' });
  rig.onSlow(p => {
    if (sc.paused) return;
    const W = p.waves(8192); if (!W) return;
    const off = (a, k) => Float32Array.from(a, v => v * 0.8 + k);
    sc.set(W.t, { ga: off(W.Sa, 2.4), gb: off(W.Sb, 1.2), gc: off(W.Sc, 0), vab: W.vab, van: W.van, ia: W.ia, ib: W.ib, ic: W.ic, Te: W.Te, idc: W.idc, vbus: W.vbus },
      `${E.STRATS[p.strat].name} · f<sub>e</sub> ${W.fe.toFixed(0)} Hz · ${W.integer ? W.periods + ' electrical period(s)' : 'partial period'} · ΔV<sub>bus</sub> ${E.stats(W.vbus).pp.toFixed(2)} V pp · I<sub>rms</sub> ${W.Irms.toFixed(0)} A · torque ripple ${E.stats(W.Te).pp.toFixed(1)} Nm pp`);
    const sv = E.spectrum(W.vbus, W.fs, W.integer ? 'rect' : 'hann'), si = E.spectrum(W.ia, W.fs, W.integer ? 'rect' : 'hann');
    fv.set(sv, { peaks: E.peaks(sv, 4, 20), markers: p.strat === 'six' ? [{ f: 6 * W.fe, label: '6·f_e' }] : [{ f: p.P.fsw, label: 'f_sw' }, { f: 2 * p.P.fsw, label: '2f_sw' }] });
    fi.set(si, { peaks: E.peaks(si, 4, 1), markers: [{ f: W.fe, label: 'f_e', color: '--hv' }] });
    document.getElementById('sigstat').textContent = `${(W.Tw * 1e3).toFixed(2)} ms window · ${W.N} samples`;
  });

  /* ---------- where used ---------- */
  const W = [
    ['EV traction', 'Battery-electric car e-axle', ['bat', 'bus', 'inv', 'mot', 'gear', 'whl', 'ctl'], 'The full chain above: 300–800 V battery, SiC/IGBT inverter, IPMSM, single-speed gear. Six-step and overmodulation are used to extend the high-speed torque without a larger battery voltage.'],
    ['Hybrid', 'P2 / P4 hybrid e-machine', ['inv', 'mot', 'gear', 'ctl'], 'Same control structure, smaller machine; regenerative braking and engine-start torque are the key operating points.'],
    ['HV auxiliary', 'Electric A/C compressor motor', ['bus', 'inv', 'mot', 'ctl'], 'A smaller PMSM on the same HV bus, usually sensorless FOC; its inverter adds current ripple to the HV network (see the HV validation lab).'],
    ['Validation', 'HV network quality checks', ['bat', 'bus', 'inv'], 'The DC-bus waveforms produced here are what HV validation measures: ripple amplitude, dominant frequencies, compliance against limits.']];
  const wh = document.getElementById('where');
  wh.innerHTML = W.map((x, i) => `<button type="button" data-i="${i}" aria-pressed="false"><b>${x[0]}</b>${x[1]}</button>`).join('') + '<div class="infopanel" id="whinfo" style="grid-column:1/-1">Select an application to highlight the blocks it uses in the architecture at the top of the page.</div>';
  wh.querySelectorAll('button').forEach(b => b.onclick = () => {
    const on = b.getAttribute('aria-pressed') !== 'true'; wh.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', false)); b.setAttribute('aria-pressed', on);
    const x = W[+b.dataset.i]; A.highlight(on ? x[2] : null); document.getElementById('whinfo').innerHTML = on ? x[3] : 'Select an application.';
  });
});
