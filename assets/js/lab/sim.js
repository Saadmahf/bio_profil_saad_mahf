/* =====================================================================
   POWERTRAIN SIM — vehicle + VCU speed loop + IPMSM operating point +
   DC-bus utilisation controller + battery + simplified BMS supervisor.
   Re-used by the IPMSM lab, the EV digital twin and the home-page hero.
   All numbers are illustrative engineering values, not measured data.
   ===================================================================== */
(function () {
  const E = window.EV;

  const CYCLES = {      // [time s, speed km/h] breakpoints
    mixed:   [[0, 0], [3, 0], [13, 60], [21, 60], [31, 110], [41, 110], [53, 0], [58, 0]],
    city:    [[0, 0], [2, 0], [9, 45], [15, 45], [21, 0], [24, 0], [31, 50], [37, 50], [44, 20], [48, 35], [55, 0], [58, 0]],
    highway: [[0, 90], [6, 90], [14, 130], [26, 130], [32, 100], [40, 120], [48, 120], [52, 110]],
    launch:  [[0, 0], [2, 0], [12, 150], [16, 150], [26, 0], [30, 0]],
    regen:   [[0, 120], [3, 120], [15, 0], [19, 0]]
  };
  function cycleAt(c, t) {
    const T = c[c.length - 1][0]; t = t % T;
    for (let k = 1; k < c.length; k++) if (t <= c[k][0]) { const f = (t - c[k - 1][0]) / (c[k][0] - c[k - 1][0]); return c[k - 1][1] + f * (c[k][1] - c[k - 1][1]); }
    return c[c.length - 1][1];
  }

  class Powertrain {
    constructor(o) {
      o = o || {};
      this.P = Object.assign({
        Vdc: 360, useBattery: true, fsw: 10000, strategy: 'auto', mode: 'auto', cycle: 'mixed',
        targetKmh: 60, accel: 2.5, grade: 0, mass: 0, torqueLim: 320,
        aux: { dcdc: true, comp: false, heater: false }
      }, o);
      this.reset();
    }
    reset() {
      Object.assign(this, {
        t: 0, tc: 0, v: 0, x: 0, vref: 0, integ: 0, soc: 0.82, vrc: 0, Tcmd: 0, Tmot: 0, Fbrake: 0,
        reg: 0, strat: 'spwm', op: null, Ibat: 0, Vbat: 0, Vdc: 0, Pdc: 0, Pmech: 0, Ploss: 0, Paux: 0,
        bms: 'Standby', sub: 'Idle', preT: 0, vlink: 0, fault: null, faultMsg: '', inject: {},
        cells: Array.from({ length: 96 }, (_, k) => ({ q: 1 + 0.025 * Math.sin(k * 2.39), d: 0.012 * Math.sin(k * 1.71 + 1), T: 25 + 2 * Math.sin(k * .7), bal: 0 })),
        Tcell: 25, balancing: false, regenBlk: false, socK: 0.70, Pk: [[1e-2, 0], [0, 1e-7]], vrcK: 0, Mreq: 0
      });
      this.Vbat = this.packOCV();
      this.can = { t: 0, log: [] };
    }
    packOCV() { let s = 0; for (const c of this.cells) s += E.ocv(this.soc + c.d); return s; }
    cellV(c) { const R0 = E.PACK.R0; return E.ocv(this.soc + c.d) - (R0 * this.Ibat + this.vrc / 1) / 1; }

    /* ---------- BMS supervisor (simplified version of my Stateflow chart) ---------- */
    bmsStep(dt) {
      const P = this.P, ocvPack = this.packOCV();
      if (this.fault) { this.bms = 'Fault'; this.vlink = Math.max(0, this.vlink - dt * this.vlink * 3); return; }
      if (this.bms === 'Standby') { this.vlink *= Math.exp(-dt * 2); if (this.enable !== false) { this.bms = 'Precharge'; this.preT = 0; } }
      if (this.bms === 'Precharge') {
        this.preT += dt;
        const tau = this.inject.pre ? 1e9 : 0.25;             // R_pre·C_link, illustrative
        this.vlink = ocvPack * (1 - Math.exp(-this.preT / tau));
        if (this.preT > 0.5 && this.vlink >= 0.95 * ocvPack) this.bms = 'Drive';
        if (this.preT > 5) this.trip('PRE', 'Precharge timeout: V_link < 95 % V_pack after 5 s');
      }
      if (this.bms === 'Drive') {
        this.vlink = this.Vbat;
        const Imin = this.cells.reduce((m, c) => Math.min(m, this.soc + c.d), 1);
        const vmax = Math.max(...this.cells.map(c => E.ocv(this.soc + c.d))) - E.PACK.R0 * this.Ibat;
        if (Math.abs(this.Ibat) > 520 || this.inject.oc) this.trip('OC', 'Over-current: |I| > 520 A (debounced)');
        if (vmax > 4.25 || this.inject.ov) this.trip('OV', 'Cell over-voltage: V_max > 4.25 V');
        if (this.Tcell > 55 || this.inject.ot) this.trip('OT', 'Over-temperature: T_cell > 55 °C');
        if (Imin < 0.02) this.trip('UV', 'Cell under-voltage: lowest cell empty');
        this.sub = this.Ibat > 10 ? 'Traction' : this.Ibat < -10 ? 'Regen' : 'Idle';
      }
      // regen blocked near full charge (hysteresis), as in the D_Regen guard of my chart
      const vmaxOCV = Math.max(...this.cells.map(c => E.ocv(this.soc + c.d)));
      if (vmaxOCV >= 4.18) this.regenBlk = true; else if (vmaxOCV < 4.13) this.regenBlk = false;
      // balancing: dV > 20 mV and V_max > 4.00 V, off below 10 mV (thresholds from my chart)
      const vs = this.cells.map(c => E.ocv(this.soc + c.d)); const dV = Math.max(...vs) - Math.min(...vs);
      if (!this.balancing && dV > 0.020 && Math.max(...vs) > 4.0 && this.Ibat <= 0) this.balancing = true;
      if (this.balancing && (dV < 0.010 || this.Ibat > 20)) this.balancing = false;
      const vmin = Math.min(...vs);
      this.cells.forEach((c, k) => { c.bal = this.balancing && vs[k] > vmin + 0.010 ? 1 : 0; if (c.bal) c.d -= dt * 4e-4; }); // bleed, display-accelerated
      this.dV = dV;
    }
    trip(code, msg) { if (!this.fault) { this.fault = code; this.faultMsg = msg; this.bms = 'Fault'; } }
    clearFault() { this.fault = null; this.faultMsg = ''; this.inject = {}; this.bms = 'Standby'; }

    /* ---------- one simulation step ---------- */
    step(dt) {
      const P = this.P; this.t += dt;
      this.bmsStep(dt);
      const contactors = this.bms === 'Drive';
      // speed reference
      let target;
      if (P.mode === 'auto') { this.tc += dt; target = cycleAt(CYCLES[P.cycle], this.tc) / 3.6; }
      else target = P.targetKmh / 3.6;
      const amax = P.accel;
      const vr0 = this.vref;
      this.vref += Math.max(-amax * dt * 1.6, Math.min(amax * dt, target - this.vref));
      const aref = (this.vref - vr0) / dt;
      // VCU speed PI -> wheel force -> motor torque request
      const m = E.V.m + P.mass;
      const e = this.vref - this.v;
      const ff = m * aref + E.roadLoad(this.v, P.grade / 100);   // feed-forward: reference acceleration + road load
      this.integ = Math.max(-6000, Math.min(6000, this.integ + e * dt * 900));
      const Freq = ff + 3500 * e + this.integ;
      let Treq = Freq * E.V.r / E.V.G / (Freq > 0 ? E.V.eta : 1 / E.V.eta);
      // motor operating point
      const wm = this.v / E.V.r * E.V.G, rpm = wm * 60 / E.TAU, we = wm * E.M.p;
      this.Vdc = contactors ? (P.useBattery ? this.Vbat : P.Vdc) : this.vlink;
      const Vdc = Math.max(this.Vdc, 1);
      // regen limits from BMS (charge current limit, regen block)
      // charge-current limit (SOP-style): keep the highest cell below 4.20 V under regen current
      const vmaxOCV = Math.max(...this.cells.map(c => E.ocv(this.soc + c.d)));
      const Ichg = this.regenBlk ? 0 : Math.max(0, Math.min(250, (4.20 - vmaxOCV - this.vrc / E.PACK.S) / E.PACK.R0));
      this.Ichg = Ichg;
      const Pregen = Ichg * Vdc;
      let Tlim = P.torqueLim;
      Treq = Math.max(-Math.min(Tlim, wm > 1 ? Pregen / wm : Tlim), Math.min(Tlim, Treq));
      if (!contactors) Treq = 0;
      this.Treq = Treq;
      // global DC-bus utilisation controller: requested voltage (MTPA, unconstrained) -> region
      const mt = E.mtpa(Treq), vreq = E.volt(mt.id, mt.iq, we).v;
      if (contactors) { this.Mreq = E.modIndex(vreq, Vdc); this.reg = E.region(this.Mreq, this.reg); }
      this.strat = P.strategy === 'auto' ? E.REG[this.reg].key : P.strategy;
      const vlim = E.STRATS[this.strat].vlim(Vdc);
      const op = E.operate(Treq, we, vlim, this.strat === 'six' ? 'fixed' : 'limit');
      op.we = we; op.rpm = rpm; this.op = op;
      this.Tmot = contactors ? op.T : 0;
      // mechanical: friction brake supplies what regen cannot
      const Fm = this.Tmot * E.V.G / E.V.r * (this.Tmot > 0 ? E.V.eta : 1 / E.V.eta);
      this.Fbrake = Freq < 0 ? Math.min(0, Freq - Math.min(0, Fm)) : 0;
      if (!contactors) this.Fbrake = this.vref < this.v - 0.3 ? Math.min(0, Freq) : 0;
      const a = (Fm + this.Fbrake - E.roadLoad(this.v, P.grade / 100)) / m;
      this.v = Math.max(0, this.v + a * dt); if (this.v < 0.05 && target < 0.05) this.v = 0;
      this.acc = a; this.x += this.v * dt;
      // electrical power + illustrative losses
      const I2 = op.id * op.id + op.iq * op.iq, Ipk = Math.sqrt(I2);
      const Pcu = 1.5 * E.M.Rs * I2;
      const fswEff = this.strat === 'six' ? Math.abs(we) / E.TAU : P.fsw;
      const Psw = 3 * fswEff * Vdc * Ipk * 1.5e-7, Pcond = 3 * (0.9 * Ipk / Math.PI + 2e-3 * I2 / 2);
      this.Pmech = this.Tmot * wm; this.Ploss = contactors && Ipk > 1 ? Pcu + Psw + Pcond : 0;
      this.Pdc = this.Pmech + this.Ploss;
      this.Paux = (P.aux.dcdc ? 1500 : 0) + (P.aux.comp ? 3500 : 0) + (P.aux.heater ? 5000 : 0);
      if (!contactors) { this.Pdc = 0; }
      const Pb = this.Pdc + (contactors ? this.Paux : 0);
      // battery 1-RC
      const Voc = this.packOCV() - this.vrc, R0 = E.PACK.R0 * E.PACK.S;
      const disc = Voc * Voc - 4 * R0 * Pb;
      this.Ibat = disc > 0 ? (Voc - Math.sqrt(disc)) / (2 * R0) : Voc / (2 * R0);
      this.Vbat = Voc - R0 * this.Ibat;
      this.vrc += dt * (this.Ibat * E.PACK.R1 * E.PACK.S - this.vrc) / E.PACK.tau;
      this.soc -= this.Ibat * dt / (E.PACK.Q * 3600);
      this.Tcell += dt * (this.Ibat * this.Ibat * E.PACK.R0 * 0.02 - (this.Tcell - 25) * 0.01) + (this.inject.heat ? dt * 3 : 0);
      this.ekf(dt);
      this.canStep(dt);
      return this;
    }
    /* ---------- SOC estimators: coulomb counting vs EKF (1-RC cell model) ---------- */
    ekf(dt) {
      const cellI = this.Ibat, Q = E.PACK.Q * 3600, R0 = E.PACK.R0, R1 = E.PACK.R1, tau = E.PACK.tau;
      // predict
      let s = this.socK - cellI * dt / Q, v1 = this.vrcK * Math.exp(-dt / tau) + R1 * (1 - Math.exp(-dt / tau)) * cellI;
      const a = Math.exp(-dt / tau);
      let P = this.Pk; P = [[P[0][0] + 1e-7, P[0][1] * a], [P[1][0] * a, P[1][1] * a * a + 1e-10]];
      // measurement: mean cell terminal voltage (with sensor noise)
      const meas = this.Vbat / E.PACK.S + (Math.random() - 0.5) * 0.004;
      const h = (E.ocv(s + 1e-3) - E.ocv(s - 1e-3)) / 2e-3;
      const pred = E.ocv(s) - v1 - R0 * cellI;
      const S = h * h * P[0][0] - 2 * h * P[0][1] + P[1][1] + 2e-6;
      const K0 = (h * P[0][0] - P[0][1]) / S, K1 = (h * P[1][0] - P[1][1]) / S;
      const y = meas - pred; s += K0 * y; v1 += K1 * y;
      const H = [h, -1];
      P = [[P[0][0] - K0 * (H[0] * P[0][0] + H[1] * P[1][0]), P[0][1] - K0 * (H[0] * P[0][1] + H[1] * P[1][1])],
           [P[1][0] - K1 * (H[0] * P[0][0] + H[1] * P[1][0]), P[1][1] - K1 * (H[0] * P[0][1] + H[1] * P[1][1])]];
      this.socK = s; this.vrcK = v1; this.Pk = P;
      this.socCC = (this.socCC ?? 0.75) - cellI * dt / Q * 1.02; // coulomb counter with 2 % gain error, wrong initial SOC
    }
    /* ---------- CAN traffic (illustrative message set, not an OEM DBC) ---------- */
    canStep(dt) {
      this.can.t += dt; const out = [];
      const per = [['0x100', 'VCU_TorqueReq', 0.01], ['0x1A0', 'BMS_Status', 0.1], ['0x1A1', 'BMS_Limits', 0.1], ['0x2B0', 'MCU_Status', 0.01]];
      this.can.frames = per.map(([id, name, p]) => {
        let d;
        if (name === 'VCU_TorqueReq') d = [Math.round(this.Tmot * 10) & 0xffff, this.P.mode === 'auto' ? 1 : 0];
        if (name === 'BMS_Status') d = [Math.round(this.Vbat * 10), Math.round(this.Ibat * 10) & 0xffff, Math.round(this.soc * 1000)];
        if (name === 'BMS_Limits') d = [this.regenBlk ? 0 : 2880, 4000, this.fault ? 1 : 0];
        if (name === 'MCU_Status') d = [Math.round(this.op ? this.op.rpm : 0), Math.round(this.Tmot * 10) & 0xffff];
        const bytes = []; d.forEach(v => { bytes.push((v >> 8) & 0xff, v & 0xff); });
        return { id, name, period: p * 1000, data: bytes.slice(0, 8).map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ') };
      });
    }
    /* auxiliary HV load current sources for the ripple engine (illustrative) */
    auxSources() {
      const a = this.P.aux, V = Math.max(this.Vdc, 1), out = [];
      if (a.dcdc) out.push(t => 1500 / V * (1 + 0.15 * Math.sin(E.TAU * 100e3 * t)));                 // DC/DC, 100 kHz
      if (a.comp) out.push(t => 3500 / V * (1 + 0.35 * Math.sin(E.TAU * 6 * 120 * t) + 0.2 * Math.sin(E.TAU * 20e3 * t))); // e-compressor inverter
      if (a.heater) out.push(t => (Math.sin(E.TAU * 1000 * t) > 0 ? 2 * 5000 / V : 0));                 // PTC heater, 1 kHz PWM 50 %
      return out;
    }
    waves(N) {
      if (!this.op || this.Vdc < 5) return null;
      const op = Object.assign({}, this.op);
      if (Math.abs(op.we) < 2) op.we = 2;            // standstill: show a slow electrical rotation
      return E.synth(op, this.strat, this.Vdc, this.P.fsw, { N: N || 8192, aux: this.auxSources() });
    }
  }
  window.Powertrain = Powertrain; window.CYCLES = CYCLES;
})();
