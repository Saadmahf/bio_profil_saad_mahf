/* =====================================================================
   RIG — shared control panel (manual / automatic) + simulation loop.
   One Powertrain instance per page; subscribers receive the state each frame.
   ===================================================================== */
window.Rig = function (ctrlHost, opt) {
  opt = opt || {};
  const pt = new Powertrain(Object.assign({ useBattery: !opt.fixedVdc }, opt.params || {}));
  const subs = [], slow = [];
  const RPM = [0, 500, 1000, 2000, 3000, 5000, 8000, 10000];
  ctrlHost.classList.add('ctrl');
  ctrlHost.innerHTML = `
    <div class="seg" role="group" aria-label="Drive mode" style="width:100%"><button type="button" data-mode="manual" style="flex:1">Manual</button><button type="button" data-mode="auto" style="flex:1" aria-pressed="true">Automatic</button></div>
    <div data-show="auto">
      <label for="${opt.id}-cyc">driving cycle<select id="${opt.id}-cyc">
        <option value="mixed">Start → accel → cruise → accel → brake → stop</option><option value="city">City driving</option><option value="highway">Highway</option><option value="launch">Full acceleration</option><option value="regen">Regenerative braking</option></select></label>
    </div>
    <div data-show="manual" hidden style="display:grid;gap:12px">
      <label>target motor speed <b data-o="rpm">3000 rpm · 39 km/h</b>
        <input type="range" id="${opt.id}-rpm" min="0" max="12000" step="50" value="3000"></label>
      <div class="row" role="group" aria-label="Speed presets">${RPM.map(r => `<button type="button" class="iconbtn" data-rpm="${r}" style="flex:0 0 auto;height:28px">${r >= 1000 ? r / 1000 + 'k' : r}</button>`).join('')}</div>
      <label for="${opt.id}-num">or type rpm<input type="number" id="${opt.id}-num" min="0" max="12000" step="10" value="3000"></label>
      <label>acceleration limit <b data-o="acc">2.5 m/s²</b><input type="range" id="${opt.id}-acc" min="0.5" max="5" step="0.1" value="2.5"></label>
    </div>
    <hr>
    <label>modulation strategy<select id="${opt.id}-st">
      <option value="auto">Auto · DC-bus utilisation controller</option><option value="spwm">SPWM</option><option value="svpwm">SVPWM</option><option value="ovm">Overmodulation</option><option value="six">Six-step</option></select></label>
    <label>switching frequency<select id="${opt.id}-fsw"><option value="5000">5 kHz</option><option value="10000" selected>10 kHz</option><option value="16000">16 kHz</option><option value="20000">20 kHz</option></select></label>
    <label>torque limit <b data-o="tl">320 Nm</b><input type="range" id="${opt.id}-tl" min="40" max="320" step="5" value="320"></label>
    ${opt.fixedVdc ? `<label>battery / DC-bus voltage <b data-o="vdc">360 V</b><input type="range" id="${opt.id}-vdc" min="200" max="450" step="5" value="360"></label>` : ''}
    <label>road grade (load) <b data-o="gr">0 %</b><input type="range" id="${opt.id}-gr" min="-8" max="15" step="0.5" value="0"></label>
    <label>payload <b data-o="ms">0 kg</b><input type="range" id="${opt.id}-ms" min="0" max="600" step="25" value="0"></label>
    ${opt.aux ? `<hr><div class="mono" style="font-size:.72rem;color:var(--muted)">HV auxiliary loads</div><div class="row">
      <button type="button" class="iconbtn" data-aux="dcdc" aria-pressed="true">DC/DC</button><button type="button" class="iconbtn" data-aux="comp" aria-pressed="false">e-compressor</button><button type="button" class="iconbtn" data-aux="heater" aria-pressed="false">water heater</button></div>` : ''}
    ${opt.faults ? `<hr><div class="mono" style="font-size:.72rem;color:var(--muted)">BMS fault injection</div><div class="row">
      <button type="button" class="iconbtn" data-inj="oc">over-current</button><button type="button" class="iconbtn" data-inj="ot">over-temp</button><button type="button" class="iconbtn" data-inj="ov">cell OV</button><button type="button" class="iconbtn" data-inj="pre">precharge fail</button></div>
      <button type="button" class="iconbtn" data-reset style="width:100%">Reset fault · restart precharge</button>` : ''}
    <div class="row"><button type="button" class="iconbtn" data-run>❚❚ Pause</button><button type="button" class="iconbtn" data-restart>↺ Restart</button></div>
    <p class="mono" style="font-size:.66rem;color:var(--muted);margin:0">Illustrative 100 kW-class IPMSM, 1700 kg vehicle, 96S pack. Model computed live in your browser.</p>`;
  const $ = s => ctrlHost.querySelector(s), P = pt.P;
  const kmh = rpm => (EV.rpm2v(rpm) * 3.6).toFixed(0);
  function setRpm(r) { r = Math.max(0, Math.min(12000, +r || 0)); P.targetKmh = EV.rpm2v(r) * 3.6; $(`#${opt.id}-rpm`).value = r; $(`#${opt.id}-num`).value = r; $('[data-o=rpm]').textContent = `${r} rpm · ${kmh(r)} km/h`; ctrlHost.querySelectorAll('[data-rpm]').forEach(b => b.setAttribute('aria-pressed', +b.dataset.rpm === r)); }
  ctrlHost.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => { P.mode = b.dataset.mode; ctrlHost.querySelectorAll('[data-mode]').forEach(x => x.setAttribute('aria-pressed', x === b)); ctrlHost.querySelectorAll('[data-show]').forEach(d => d.hidden = d.dataset.show !== P.mode); if (P.mode === 'manual') setRpm(Math.round(pt.op ? pt.op.rpm / 50 : 0) * 50); else pt.tc = 0; });
  $(`#${opt.id}-cyc`).onchange = e => { P.cycle = e.target.value; pt.tc = 0; };
  $(`#${opt.id}-rpm`).oninput = e => setRpm(e.target.value);
  $(`#${opt.id}-num`).onchange = e => setRpm(e.target.value);
  ctrlHost.querySelectorAll('[data-rpm]').forEach(b => b.onclick = () => setRpm(b.dataset.rpm));
  $(`#${opt.id}-acc`).oninput = e => { P.accel = +e.target.value; $('[data-o=acc]').textContent = P.accel.toFixed(1) + ' m/s²'; };
  $(`#${opt.id}-st`).onchange = e => P.strategy = e.target.value;
  $(`#${opt.id}-fsw`).onchange = e => P.fsw = +e.target.value;
  $(`#${opt.id}-tl`).oninput = e => { P.torqueLim = +e.target.value; $('[data-o=tl]').textContent = P.torqueLim + ' Nm'; };
  if (opt.fixedVdc) $(`#${opt.id}-vdc`).oninput = e => { P.Vdc = +e.target.value; $('[data-o=vdc]').textContent = P.Vdc + ' V'; };
  $(`#${opt.id}-gr`).oninput = e => { P.grade = +e.target.value; $('[data-o=gr]').textContent = P.grade + ' %'; };
  $(`#${opt.id}-ms`).oninput = e => { P.mass = +e.target.value; $('[data-o=ms]').textContent = P.mass + ' kg'; };
  ctrlHost.querySelectorAll('[data-aux]').forEach(b => b.onclick = () => { const k = b.dataset.aux; P.aux[k] = !P.aux[k]; b.setAttribute('aria-pressed', P.aux[k]); });
  ctrlHost.querySelectorAll('[data-inj]').forEach(b => b.onclick = () => { const k = b.dataset.inj; if (k === 'pre') { pt.clearFault(); pt.inject.pre = true; } else if (k === 'ot') pt.inject.heat = true; else pt.inject[k] = true; });
  const rb = $('[data-reset]'); if (rb) rb.onclick = () => { pt.clearFault(); pt.Tcell = 25; };
  let run = true;
  $('[data-run]').onclick = e => { run = !run; e.target.textContent = run ? '❚❚ Pause' : '▶ Play'; };
  $('[data-restart]').onclick = () => { pt.reset(); };
  if (opt.mode) ctrlHost.querySelector(`[data-mode=${opt.mode}]`).click();
  setRpm(3000);
  // loop: physics at 200 Hz sub-steps, subscribers each frame, slow subscribers ~4 Hz
  let acc = 0, slowT = 0;
  UI.loop(ctrlHost.parentElement, dt => {
    if (!run) return;
    acc += dt; while (acc > 0.005) { pt.step(0.005); acc -= 0.005; }
    subs.forEach(f => f(pt, dt));
    slowT += dt; if (slowT > (opt.slowPeriod || 0.3)) { slowT = 0; slow.forEach(f => f(pt)); }
  });
  return { pt, on: f => subs.push(f), onSlow: f => { slow.push(f); f(pt); } };
};

/* standard dashboard tiles */
window.Dash = function (host, keys) {
  const D = {
    v: ['vehicle', 'km/h', p => (p.v * 3.6).toFixed(0)], rpm: ['motor', 'rpm', p => p.op ? p.op.rpm.toFixed(0) : '0'],
    T: ['torque', 'Nm', p => p.Tmot.toFixed(0)], P: ['DC power', 'kW', p => (p.Pdc / 1000).toFixed(1)],
    Vb: ['battery', 'V', p => p.Vbat.toFixed(0)], Ib: ['battery I', 'A', p => p.Ibat.toFixed(0)], Vdc: ['DC bus', 'V', p => p.Vdc.toFixed(0)],
    soc: ['SOC', '%', p => (p.soc * 100).toFixed(2)], st: ['modulation', '', p => EV.STRATS[p.strat].name], M: ['M req', '', p => p.Mreq.toFixed(2)],
    id: ['i_d', 'A', p => p.op ? p.op.id.toFixed(0) : 0], iq: ['i_q', 'A', p => p.op ? p.op.iq.toFixed(0) : 0],
    bms: ['BMS', '', p => p.bms === 'Drive' ? p.sub : p.bms], loss: ['inv+motor loss', 'kW', p => (p.Ploss / 1000).toFixed(2)]
  };
  host.classList.add('dash');
  host.innerHTML = keys.map(k => `<div><span>${D[k][0]}</span><b data-k="${k}">—</b><small>${D[k][1]}</small></div>`).join('');
  const els = keys.map(k => [host.querySelector(`[data-k=${k}]`), D[k][2]]);
  return { update(p) { els.forEach(([e, f]) => { const t = f(p); if (e.textContent !== t) e.textContent = t; }); } };
};
