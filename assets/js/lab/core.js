/* =====================================================================
   EV LAB CORE — physics used by every interactive page.
   Everything here is an illustrative engineering model (no OEM data):
   - IPMSM steady-state dq model + MTPA / flux-weakening operating point
   - Modulators: SPWM, SVPWM (min-max injection), overmodulation, six-step
   - Switched-waveform synthesis: gates, pole/phase voltages, current ripple,
     inverter DC current, DC-link node (battery R-L + capacitor C/ESR/ESL)
   - FFT, metrics, vehicle longitudinal dynamics, battery 1-RC model
   ===================================================================== */
window.EV = (function () {
  const TAU = 2 * Math.PI, S3 = Math.sqrt(3);

  /* ---------- illustrative traction machine & vehicle ---------- */
  const M = {             // IPMSM, 8 poles (illustrative, ~100 kW class)
    p: 4, Rs: 0.012, Ld: 0.18e-3, Lq: 0.45e-3, psi: 0.075, Imax: 450
  };
  const V = {             // vehicle
    m: 1700, r: 0.31, G: 9, eta: 0.97, Crr: 0.011, CdA: 0.62, rho: 1.2, g: 9.81
  };
  const DC = { C: 500e-6, ESR: 1.0e-3, ESL: 0, Lb: 5e-6, Rb: 0.03 }; // DC link (illustrative); ESL only used in the AC/Bode analysis

  /* ---------- machine equations ---------- */
  const torque = (id, iq) => 1.5 * M.p * iq * (M.psi + (M.Ld - M.Lq) * id);
  function volt(id, iq, we) {
    const vd = M.Rs * id - we * M.Lq * iq;
    const vq = M.Rs * iq + we * (M.Ld * id + M.psi);
    return { vd, vq, v: Math.hypot(vd, vq) };
  }
  // feasible iq interval for |v| <= Vlim at a given id (quadratic in iq)
  function iqRange(id, we, Vlim) {
    const a = M.Rs * M.Rs + we * we * M.Lq * M.Lq;
    const b = 2 * M.Rs * we * (M.Ld * id + M.psi - M.Lq * id);
    const c = (M.Rs * id) ** 2 + (we * (M.Ld * id + M.psi)) ** 2 - Vlim * Vlim;
    const disc = b * b - 4 * a * c;
    if (disc < 0) return null;
    const s = Math.sqrt(disc);
    return [(-b - s) / (2 * a), (-b + s) / (2 * a)];
  }
  /* MTPA (no voltage limit): minimum current for |T| */
  function mtpa(T) {
    if (Math.abs(T) < 1e-6) return { id: 0, iq: 0 };
    let best = null;
    for (let k = 0; k <= 200; k++) {
      const id = -M.Imax * k / 200;
      const iq = Math.sign(T) * Math.abs(T) / (1.5 * M.p * (M.psi + (M.Ld - M.Lq) * id));
      const I = Math.hypot(id, iq);
      if (!best || I < best.I) best = { id, iq, I };
    }
    return best;
  }
  /* Operating point with current + voltage limits.
     mode 'limit'  : |v| <= Vlim (SPWM/SVPWM/overmod)  -> MTPA, then flux weakening, then torque derating
     mode 'fixed'  : |v| == Vlim (six-step, magnitude fixed, angle controlled) */
  function operate(Tref, we, Vlim, mode) {
    const N = 160;
    const sgn = Tref >= 0 ? 1 : -1, Ta = Math.abs(Tref);
    let best = null, bestMax = null;
    const idMin = -M.Imax, idMax = mode === 'fixed' ? M.Imax : 0;
    for (let k = 0; k <= N; k++) {
      const id = idMax - (idMax - idMin) * k / N;
      const iqI = Math.sqrt(Math.max(0, M.Imax * M.Imax - id * id));
      const kt = 1.5 * M.p * (M.psi + (M.Ld - M.Lq) * id);
      if (kt <= 0) continue;
      const iqNeed = sgn * Ta / kt;
      if (mode === 'fixed') {
        if (Math.abs(iqNeed) > iqI) continue;
        const e = volt(id, iqNeed, we).v - Vlim;
        if (best && Math.sign(e) !== Math.sign(best.e) && !best.done) {
          const f = best.e / (best.e - e); const idx = best.id + (id - best.id) * f;
          const iqx = sgn * Ta / (1.5 * M.p * (M.psi + (M.Ld - M.Lq) * idx));
          best = { id: idx, iq: iqx, e: 0, done: true };
        } else if (!best || !best.done) best = { id, iq: iqNeed, e, done: false };
        continue;
      }
      const r = iqRange(id, we, Vlim);
      if (!r) continue;
      const lo = Math.max(r[0], -iqI), hi = Math.min(r[1], iqI);
      if (lo > hi) continue;
      // best achievable torque at this id (for derating)
      const iqLim = sgn > 0 ? hi : lo;
      const Tlim = torque(id, iqLim);
      if (!bestMax || Math.abs(Tlim) > Math.abs(bestMax.T) || (sgn * Tlim < 0)) {
        if (sgn * Tlim >= 0 && (!bestMax || Math.abs(Tlim) > Math.abs(bestMax.T))) bestMax = { id, iq: iqLim, T: Tlim };
      }
      if (iqNeed >= lo && iqNeed <= hi) {
        const I = Math.hypot(id, iqNeed);
        if (!best || I < best.I) best = { id, iq: iqNeed, I };
      }
    }
    let flag = 'ok', pt;
    if (mode === 'fixed') {
      if (best && best.done) pt = best;
      else {
        const m0 = mtpa(Tref);
        if (volt(m0.id, m0.iq, we).v > Vlim) { const r = operate(Tref, we, Vlim, 'limit'); r.flag = r.flag === 'ok' ? 'ok' : r.flag; return r; }
        flag = 'overcurrent'; pt = m0;   // below base speed: fixed six-step voltage cannot be absorbed within Imax
      }
    } else if (best) pt = best;
    else if (bestMax) { pt = bestMax; flag = 'derated'; }
    else { pt = { id: -M.Imax, iq: 0 }; flag = 'voltage'; }
    const v = volt(pt.id, pt.iq, we);
    const fw = pt.id < (mtpa(Tref).id - 1);
    return { id: pt.id, iq: pt.iq, vd: v.vd, vq: v.vq, v: v.v, T: torque(pt.id, pt.iq), flag, fw };
  }
  /* maximum torque envelope at a speed (for limits / capability curves) */
  function tmax(we, Vlim) { return operate(1e4, we, Vlim, 'limit').T; }

  /* ---------- modulation strategies ---------- */
  const STRATS = {
    spwm:   { name: 'SPWM',            vlim: Vdc => Vdc / 2 },
    svpwm:  { name: 'SVPWM',           vlim: Vdc => Vdc / S3 },
    ovm:    { name: 'Overmodulation',  vlim: Vdc => 0.97 * 2 * Vdc / Math.PI },
    six:    { name: 'Six-step',        vlim: Vdc => 2 * Vdc / Math.PI }
  };
  /* modulation index (Holtz): M = |v| / (2Vdc/π) */
  const modIndex = (v, Vdc) => v / (2 * Vdc / Math.PI);
  /* Global DC-bus utilisation controller: region from requested voltage, with hysteresis */
  const REG = [
    { key: 'spwm',  lim: Math.PI / 4,               label: '1 · Linear (SPWM)' },
    { key: 'svpwm', lim: Math.PI / (2 * S3),        label: '2 · Linear (SVPWM)' },
    { key: 'ovm',   lim: 0.985,                     label: '3 · Overmodulation' },
    { key: 'six',   lim: Infinity,                  label: '4 · Six-step' }];
  function region(Mreq, prev) {
    let k = REG.findIndex(r => Mreq <= r.lim);
    if (prev != null && k < prev && Mreq > REG[k].lim - 0.03) k = prev; // hysteresis band on the way down
    return k;
  }

  /* ---------- waveform synthesis over an analysis window ---------- */
  function tri(x) { x = x - Math.floor(x); return x < 0.5 ? 2 * x : 2 - 2 * x; } // 0..1
  /* op: {id,iq,vd,vq,we}, strat key, Vdc, fsw, opts {N, Tmax, aux:[fn(t)->A], dc:{...}} */
  function synth(op, strat, Vdc, fsw, opts) {
    opts = opts || {};
    const N = opts.N || 8192;
    const we = Math.max(Math.abs(op.we), 1e-3) * Math.sign(op.we || 1);
    const fe = Math.abs(we) / TAU, Te = 1 / Math.max(fe, 1e-6);
    const Tcap = opts.Tmax || 0.02;
    let periods = Math.max(1, Math.floor(Tcap / Te)), Tw = Te * periods, integer = true;
    if (Te > Tcap) { Tw = Tcap; integer = false; periods = Tw / Te; }
    const fs = N / Tw, dt = 1 / fs;
    const th0 = opts.theta0 || 0;
    const Sa = new Uint8Array(N), Sb = new Uint8Array(N), Sc = new Uint8Array(N);
    const van = new Float32Array(N), vbn = new Float32Array(N), vcn = new Float32Array(N), vab = new Float32Array(N);
    const ra = new Float32Array(N), rb = new Float32Array(N), rc = new Float32Array(N);
    const t = new Float32Array(N);
    for (let n = 0; n < N; n++) {
      const tt = n * dt; t[n] = tt; const th = th0 + we * tt;
      const c = Math.cos(th), s = Math.sin(th);
      const va = op.vd * c - op.vq * s, vb_ = op.vd * s + op.vq * c;            // alpha, beta
      let xa = va, xb = -0.5 * va + S3 / 2 * vb_, xc = -0.5 * va - S3 / 2 * vb_;   // phase refs
      if (strat === 'svpwm' || strat === 'ovm') { const z = -(Math.max(xa, xb, xc) + Math.min(xa, xb, xc)) / 2; xa += z; xb += z; xc += z; }
      if (strat === 'ovm') { const g = op.ovmGain || 1; xa *= g; xb *= g; xc *= g; }
      ra[n] = xa; rb[n] = xb; rc[n] = xc;
      let a, b, cc;
      if (strat === 'six') { a = xa > 0; b = xb > 0; cc = xc > 0; }
      else {
        const car = tri(tt * fsw);                       // symmetric carrier
        const da = Math.min(1, Math.max(0, 0.5 + xa / Vdc)), db = Math.min(1, Math.max(0, 0.5 + xb / Vdc)), dc = Math.min(1, Math.max(0, 0.5 + xc / Vdc));
        a = da > car; b = db > car; cc = dc > car;
      }
      Sa[n] = a; Sb[n] = b; Sc[n] = cc;
      const pa = (a - 0.5) * Vdc, pb = (b - 0.5) * Vdc, pc = (cc - 0.5) * Vdc, cm = (pa + pb + pc) / 3;
      van[n] = pa - cm; vbn[n] = pb - cm; vcn[n] = pc - cm; vab[n] = pa - pb;
    }
    // fundamental of applied phase voltage (exact DFT when window holds integer periods)
    function fund(x) {
      if (!integer) return null;
      let re = 0, im = 0; const k = periods;
      for (let n = 0; n < N; n++) { const ph = TAU * k * n / N; re += x[n] * Math.cos(ph); im -= x[n] * Math.sin(ph); }
      return { re: 2 * re / N, im: 2 * im / N };
    }
    const Ls = (M.Ld + M.Lq) / 2;
    const ia = new Float32Array(N), ib = new Float32Array(N), ic = new Float32Array(N), Te_ = new Float32Array(N);
    const fA = fund(van), fB = fund(vbn), fC = fund(vcn);
    const harm = [van, vbn, vcn].map((x, k) => {
      const f = [fA, fB, fC][k]; const out = new Float32Array(N); let acc = 0, mean = 0;
      for (let n = 0; n < N; n++) {
        let v1;
        if (f) { const ph = TAU * periods * n / N; v1 = f.re * Math.cos(ph) - f.im * Math.sin(ph); }
        else v1 = [ra, rb, rc][k][n] - (ra[n] + rb[n] + rc[n]) / 3; // linear-mode fundamental
        acc += (x[n] - v1) * dt / Ls; out[n] = acc; mean += acc;
      }
      mean /= N; for (let n = 0; n < N; n++) out[n] -= mean; return out;
    });
    let Irms = 0, Ia1 = 0;
    for (let n = 0; n < N; n++) {
      const th = th0 + we * t[n], c = Math.cos(th), s = Math.sin(th);
      const ial = op.id * c - op.iq * s, ibe = op.id * s + op.iq * c;
      ia[n] = ial + harm[0][n]; ib[n] = -0.5 * ial + S3 / 2 * ibe + harm[1][n]; ic[n] = -0.5 * ial - S3 / 2 * ibe + harm[2][n];
      // Park of actual currents -> instantaneous torque
      const al = ia[n], be = (ia[n] + 2 * ib[n]) / S3;
      const idn = al * c + be * s, iqn = -al * s + be * c;
      Te_[n] = torque(idn, iqn); Irms += ia[n] * ia[n];
    }
    Irms = Math.sqrt(Irms / N);
    // inverter DC current + HV auxiliary loads
    const idc = new Float32Array(N), iinv = new Float32Array(N); let mean = 0;
    for (let n = 0; n < N; n++) {
      iinv[n] = Sa[n] * ia[n] + Sb[n] * ib[n] + Sc[n] * ic[n];
      let ix = iinv[n]; if (opts.aux) for (const f of opts.aux) ix += f(t[n]);
      idc[n] = ix; mean += ix;
    }
    mean /= N;
    // DC-link node: battery (Vb, Rb, Lb) -> node <- capacitor (C, ESR, ESL); two passes for periodic steady state
    const d = Object.assign({}, DC, opts.dc || {});
    const Vb = Vdc + d.Rb * mean;
    let iL = mean, vC = Vb - d.Rb * mean;
    const vbus = new Float32Array(N), ibat = new Float32Array(N), icap = new Float32Array(N);
    const sub = 4, h = dt / sub;
    for (let pass = 0; pass < 2; pass++) {
      for (let n = 0; n < N; n++) {
        const ix = idc[n], ixp = idc[(n + N - 1) % N];
        for (let k = 0; k < sub; k++) {
          const ic_ = iL - ix;
          const vb = vC + d.ESR * ic_ + d.ESL * (-(ix - ixp) / dt);
          iL += h * (Vb - d.Rb * iL - vb) / d.Lb;
          vC += h * ic_ / d.C;
        }
        if (pass === 1) { const ic_ = iL - ix; vbus[n] = vC + d.ESR * ic_; ibat[n] = iL; icap[n] = ic_; }
      }
    }
    return { N, fs, dt, Tw, fe, we, periods, integer, t, Sa, Sb, Sc, ra, rb, rc, van, vbn, vcn, vab, ia, ib, ic, Te: Te_, idc, iinv, vbus, ibat, icap, Irms, Idc: mean, Vdc };
  }

  /* ---------- FFT (radix-2, in place) ---------- */
  function fft(re, im) {
    const n = re.length;
    for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { [re[i], re[j]] = [re[j], re[i]];[im[i], im[j]] = [im[j], im[i]]; } }
    for (let len = 2; len <= n; len <<= 1) {
      const ang = -TAU / len, wr = Math.cos(ang), wi = Math.sin(ang);
      for (let i = 0; i < n; i += len) {
        let cr = 1, ci = 0;
        for (let j = 0; j < len / 2; j++) {
          const ar = re[i + j], ai = im[i + j], br = re[i + j + len / 2] * cr - im[i + j + len / 2] * ci, bi = re[i + j + len / 2] * ci + im[i + j + len / 2] * cr;
          re[i + j] = ar + br; im[i + j] = ai + bi; re[i + j + len / 2] = ar - br; im[i + j + len / 2] = ai - bi;
          const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
        }
      }
    }
  }
  /* single-sided amplitude spectrum, DC removed; window 'rect' (integer periods) or 'hann' */
  function spectrum(x, fs, win) {
    const N = x.length, re = new Float64Array(N), im = new Float64Array(N);
    let m = 0; for (let i = 0; i < N; i++) m += x[i]; m /= N;
    let cg = 0;
    for (let i = 0; i < N; i++) { const w = win === 'hann' ? 0.5 - 0.5 * Math.cos(TAU * i / N) : 1; re[i] = (x[i] - m) * w; cg += w; }
    fft(re, im);
    const half = N / 2, A = new Float32Array(half), f = new Float32Array(half);
    for (let k = 0; k < half; k++) { A[k] = (k === 0 ? 1 : 2) * Math.hypot(re[k], im[k]) / cg; f[k] = k * fs / N; }
    return { f, A, df: fs / N };
  }
  function peaks(sp, n, fmin) {
    const out = [];
    for (let k = 2; k < sp.A.length - 1; k++) if (sp.f[k] >= (fmin || 0) && sp.A[k] > sp.A[k - 1] && sp.A[k] >= sp.A[k + 1]) out.push({ f: sp.f[k], a: sp.A[k] });
    return out.sort((a, b) => b.a - a.a).slice(0, n);
  }
  function stats(x) {
    let mn = Infinity, mx = -Infinity, m = 0; for (const v of x) { if (v < mn) mn = v; if (v > mx) mx = v; m += v; } m /= x.length;
    let r = 0; for (const v of x) r += (v - m) ** 2; return { min: mn, max: mx, mean: m, pp: mx - mn, rmsAC: Math.sqrt(r / x.length) };
  }
  function thd(x, fs, f1) {
    const sp = spectrum(x, fs, 'rect'); const k1 = Math.round(f1 / sp.df); if (k1 < 1) return 0;
    let h = 0; for (let k = 2 * k1; k < sp.A.length; k += 1) h += sp.A[k] ** 2;
    let a1 = 0; for (let k = Math.max(1, k1 - 1); k <= k1 + 1; k++) a1 = Math.max(a1, sp.A[k]);
    return Math.sqrt(h) / Math.max(a1, 1e-9);
  }

  /* ---------- vehicle ---------- */
  function roadLoad(v, grade) { // N, v in m/s
    const s = Math.sign(v) || 0;
    return V.m * V.g * (V.Crr * s + Math.sin(Math.atan(grade || 0))) + 0.5 * V.rho * V.CdA * v * Math.abs(v);
  }
  const rpm2we = rpm => rpm * TAU / 60 * M.p;
  const v2rpm = v => v / V.r * V.G * 60 / TAU;
  const rpm2v = rpm => rpm * TAU / 60 / V.G * V.r;

  /* ---------- battery: 96S Li-ion, 1-RC, OCV table reused from my BMS parameters ---------- */
  const OCV_SOC = [0, .006, .025, .05, .1, .2, .25, .3, .4, .45, .5, .55, .6, .65, .7, .75, .8, .85, .9, .95, .97, 1];
  const OCV_V = [2.5, 3.0339, 3.2401, 3.3458, 3.39395, 3.5066, 3.5522, 3.58875, 3.6383, 3.66755, 3.7064, 3.7604, 3.8309, 3.87795, 3.91795, 3.96195, 4.01475, 4.0629, 4.088, 4.11595, 4.137, 4.21085];
  function ocv(soc) { soc = Math.min(1, Math.max(0, soc)); let k = 1; while (k < OCV_SOC.length - 1 && OCV_SOC[k] < soc) k++; const f = (soc - OCV_SOC[k - 1]) / (OCV_SOC[k] - OCV_SOC[k - 1]); return OCV_V[k - 1] + f * (OCV_V[k] - OCV_V[k - 1]); }
  const PACK = { S: 96, Q: 120, R0: 0.55e-3, R1: 0.4e-3, tau: 40 };

  return { TAU, S3, M, V, DC, PACK, torque, volt, operate, mtpa, tmax, STRATS, REG, region, modIndex, synth, spectrum, peaks, stats, thd, fft, roadLoad, rpm2we, v2rpm, rpm2v, ocv };
})();
