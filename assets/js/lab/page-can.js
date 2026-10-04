document.addEventListener('DOMContentLoaded', () => {
  const U = UI, css = U.css, C = CANENC, $ = s => document.querySelector(s);

  /* ---------------- system architecture ---------------- */
  U.Arch($('#sysarch'), {
    uid: 'cs', w: 1120, h: 300, info: {
      pc: '<p>Host PC: configuration, logging and scripted test sequences over USB (CDC) or UART.</p>',
      core0: '<p>Core 0: application, frame builder (ID, DLC, data, CRC, bit stuffing), receive-side CRC check and decoding. Written in C on the Pico SDK.</p>',
      core1: '<p>Core 1: USB / UART host link and the software scheduler that NGE tools plug into.</p>',
      pio: '<p>PIO blocks: one state machine per TX and RX direction. Cycle-exact bit timing independent of CPU interrupts.</p>',
      xfd: '<p>CAN FD transceiver: converts TX/RX logic levels to the differential CAN_H / CAN_L bus, rated for the FD data-phase bit rate.</p>',
      xlin: '<p>LIN transceiver (single wire, 12 V, up to 20 kbit/s), master pull-up selectable.</p>',
      ecu: '<p>Automotive ECU(s) under test.</p>', uart: '<p>UART: debug console and a fallback host link.</p>'
    },
    nodes: [
      { id: 'pc', x: 10, y: 110, w: 110, h: 60, t: 'PC', s: 'test scripts' },
      { id: 'core1', x: 180, y: 60, w: 150, h: 50, t: 'Core 1', s: 'USB · scheduler', kind: 'ctrl' },
      { id: 'core0', x: 180, y: 170, w: 150, h: 50, t: 'Core 0', s: 'frame builder · CRC', kind: 'ctrl' },
      { id: 'pio', x: 390, y: 110, w: 150, h: 60, t: 'PIO SM ×2', s: 'TX · RX', kind: 'ctrl' },
      { id: 'xfd', x: 610, y: 60, w: 150, h: 50, t: 'CAN FD xcvr', s: '', kind: 'can' },
      { id: 'xlin', x: 610, y: 190, w: 150, h: 50, t: 'LIN xcvr', s: '', kind: 'can' },
      { id: 'ecu', x: 960, y: 110, w: 150, h: 60, t: 'Automotive ECU', s: 'device under test' },
      { id: 'uart', x: 10, y: 220, w: 110, h: 40, t: 'UART', s: '' }],
    edges: [
      { id: 'u1', type: 'lv', d: 'M120 130 H150 V85 H178', label: 'USB', lx: 140, ly: 78 }, { id: 'u2', type: 'lv', d: 'M120 240 H150 V200 H178', label: 'UART', lx: 136, ly: 254 },
      { id: 'i1', type: 'sig', d: 'M255 110 V168', label: 'FIFO', lx: 262, ly: 144, anchor: 'start' },
      { id: 'p1', type: 'sig', d: 'M330 195 H360 V140 H388', label: 'TX/RX FIFOs', lx: 336, ly: 230, anchor: 'start' },
      { id: 'p2', type: 'lv', d: 'M540 130 H575 V85 H608', label: 'TX / RX', lx: 572, ly: 78 }, { id: 'p3', type: 'lv', d: 'M540 150 H575 V215 H608' },
      { id: 'b1', type: 'can', d: 'M760 85 H860 V130 H958', label: 'CAN_H / CAN_L', lx: 860, ly: 76 }, { id: 'b2', type: 'can', d: 'M760 215 H860 V150 H958', label: 'LIN', lx: 860, ly: 230 }]
  }, $('#sysinfo'));

  /* ---------------- frame builder ---------------- */
  const ST = { fd: false, brs: true, bits: null, pos: -1, run: true, speed: 0.8, tx: false };
  const parse = () => {
    const id = parseInt($('#cid').value, 16) || 0;
    const data = $('#cdata').value.trim().split(/[\s,]+/).filter(Boolean).map(x => parseInt(x, 16) & 255).filter(x => !isNaN(x));
    return { id, data };
  };
  function build() {
    const p = parse(); ST.bits = C.encode({ id: p.id, data: p.data, fd: ST.fd, brs: ST.fd && ST.brs }); ST.pos = -1;
    const B = ST.bits, nb = B.length, fast = B.filter(b => b.fast).length;
    const tNom = 2e-6, tFast = ST.fd && ST.brs ? 0.5e-6 : 2e-6, T = (nb - fast) * tNom + fast * tFast;
    $('#fdash').innerHTML = `<div><span>bits on wire</span><b>${nb}</b></div><div><span>stuff bits</span><b>${B.nstuff}${ST.fd ? '+' + B.filter(b => b.s === 2).length : ''}</b></div><div><span>DLC</span><b>${B.dlc}</b><small>${B.len} B</small></div><div><span>CRC-${B.crcW}</span><b style="font-size:.9rem">0x${B.crcVal.toString(16).toUpperCase()}</b></div><div><span>frame time</span><b>${(T * 1e6).toFixed(0)}</b><small>µs</small></div><div><span>payload eff.</span><b>${(B.len * 8 / nb * 100).toFixed(0)}</b><small>%</small></div>`;
    // field table
    const groups = []; B.forEach(b => { const g = groups[groups.length - 1]; if (g && g.f === b.f) { g.n++; g.bits += b.s ? '' : b.b; g.st += b.s ? 1 : 0; } else groups.push({ f: b.f, n: 1, bits: b.s ? '' : '' + b.b, st: b.s ? 1 : 0 }); });
    const desc = { SOF: 'start of frame, hard sync', ID: 'identifier · arbitration (lower ID wins)', RTR: 'remote request (0 = data)', RRS: 'remote request substitution', IDE: 'identifier extension (0 = 11-bit)', r0: 'reserved', FDF: 'FD format (1)', res: 'reserved', BRS: 'bit-rate switch', ESI: 'error state indicator', DLC: 'data length code', DATA: 'payload', SBC: 'stuff count (Gray) + parity', CRC: 'cyclic redundancy check', CRCdel: 'CRC delimiter', ACK: 'acknowledge slot (receiver drives 0)', ACKdel: 'ACK delimiter', EOF: 'end of frame', IFS: 'interframe space' };
    $('#fields').innerHTML = `<thead><tr><th>field</th><th class="n">bits</th><th class="n">stuff</th><th>value</th><th>role</th></tr></thead><tbody>${groups.map(g => `<tr><td><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:var(${C.COLORS[g.f]});margin-right:6px"></span>${g.f}</td><td class="n">${g.n}</td><td class="n">${g.st || ''}</td><td class="mono" style="font-size:.78rem">${g.f === 'ID' ? '0x' + parseInt(g.bits, 2).toString(16).toUpperCase() : g.f === 'DATA' ? (g.bits.match(/.{8}/g) || []).map(x => parseInt(x, 2).toString(16).padStart(2, '0').toUpperCase()).join(' ') : g.bits.length <= 21 ? g.bits : ''}</td><td class="muted" style="font-size:.82rem">${desc[g.f] || ''}</td></tr>`).join('')}</tbody>`;
    drawStrip();
  }
  document.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { ST.fd = b.dataset.t === 'fd'; document.querySelectorAll('[data-t]').forEach(x => x.setAttribute('aria-pressed', x === b)); document.querySelector('[data-fdonly]').hidden = !ST.fd; if (ST.fd && parse().data.length <= 8) $('#cdata').value = '0E E1 04 47 03 33 00 10 20 30 40 50'; build(); });
  $('#cid').oninput = $('#cdata').oninput = build; $('#cbrs').onchange = e => { ST.brs = e.target.value === '1'; build(); };
  $('#spd').oninput = e => { ST.speed = +e.target.value; $('[data-o=spd]').textContent = ST.speed < .6 ? 'slow' : ST.speed < 1.6 ? 'medium' : 'fast'; };
  $('#send').onclick = () => { ST.pos = 0; ST.tx = true; ST.run = true; $('#pause').textContent = '❚❚'; };
  $('#pause').onclick = e => { ST.run = !ST.run; e.target.textContent = ST.run ? '❚❚' : '▶'; };

  /* bit strip */
  const sc = U.canvas($('#strip'), 120);
  function drawStrip() {
    const { w, h: H } = sc.fit(), ctx = sc.ctx; ctx.clearRect(0, 0, w, H); const B = ST.bits; if (!B) return;
    const perRow = Math.max(20, Math.floor((w - 10) / 13)), cw = (w - 10) / perRow, rows = Math.ceil(B.length / perRow), rh = Math.min(28, (H - 6) / rows);
    ctx.font = '600 9px ' + css('--f-mono'); ctx.textAlign = 'center';
    B.forEach((b, i) => {
      const x = 5 + (i % perRow) * cw, y = 3 + Math.floor(i / perRow) * rh;
      ctx.fillStyle = `color-mix(in srgb, ${css(C.COLORS[b.f])} ${i <= ST.pos ? 55 : 22}%, ${css('--surface')})`; ctx.fillRect(x, y, cw - 1, rh - 2);
      if (b.s) { ctx.strokeStyle = css(b.s === 1 ? '--violet' : '--bad'); ctx.lineWidth = 2; ctx.strokeRect(x + 1, y + 1, cw - 3, rh - 4); }
      if (i === ST.pos) { ctx.strokeStyle = css('--ink'); ctx.lineWidth = 2; ctx.strokeRect(x - 1, y - 1, cw + 1, rh); }
      ctx.fillStyle = css('--ink'); ctx.fillText(b.b, x + cw / 2, y + rh / 2 + 3);
    });
    sc.c.style.height = (rows * rh + 8) + 'px';
  }

  /* bus animation: last bits travel from TX node to ECU */
  const bc = U.canvas($('#bus'), 230); let tAcc = 0;
  function drawBus() {
    const { w, h: H } = bc.fit(), ctx = bc.ctx; ctx.clearRect(0, 0, w, H); const B = ST.bits; if (!B) return;
    const x0 = 120, x1 = w - 120, yH = 80, yL = 150, amp = 26;
    // nodes
    [[10, 'RP2040 node', 'TX'], [w - 110, 'ECU', 'RX']].forEach(([x, t, s]) => { ctx.fillStyle = css('--surface'); ctx.strokeStyle = css('--ink'); ctx.lineWidth = 1.3; ctx.fillRect(x, 70, 100, 92); ctx.strokeRect(x, 70, 100, 92); ctx.fillStyle = css('--ink'); ctx.font = '600 11px ' + css('--f-mono'); ctx.textAlign = 'center'; ctx.fillText(t, x + 50, 110); ctx.fillStyle = css('--muted'); ctx.font = '10px ' + css('--f-mono'); ctx.fillText(s, x + 50, 128); });
    // termination resistors
    ctx.font = '10px ' + css('--f-mono'); ctx.fillStyle = css('--muted'); ctx.textAlign = 'left'; ctx.fillText('120 Ω', x0 + 2, 118); ctx.textAlign = 'right'; ctx.fillText('120 Ω', x1 - 2, 118);
    // waveform: bit i is at position along the wire proportional to its age
    const nVis = 34, segW = (x1 - x0) / nVis;
    const lvl = (b, hi) => hi ? (b ? yH : yH - amp) : (b ? yL : yL + amp);
    ['CAN_H', 'CAN_L'].forEach((nm, k) => {
      ctx.strokeStyle = css(k ? '--sig' : '--hv'); ctx.lineWidth = 2.2; ctx.beginPath(); let started = false;
      for (let j = 0; j < nVis; j++) {
        const i = ST.pos - j, b = i >= 0 && i < B.length ? B[i].b : 1;
        const xa = x0 + j * segW, xb = xa + segW, y = lvl(b, !k);
        if (!started) { ctx.moveTo(xa, y); started = true; } else ctx.lineTo(xa, y);
        ctx.lineTo(xb, y);
      }
      ctx.stroke(); ctx.fillStyle = css(k ? '--sig' : '--hv'); ctx.textAlign = 'left'; ctx.fillText(nm, x0, k ? yL + amp + 16 : yH - amp - 8);
    });
    // field labels above the wire
    ctx.textAlign = 'center'; ctx.font = '600 9px ' + css('--f-mono');
    for (let j = 0; j < nVis; j++) { const i = ST.pos - j; if (i < 0 || i >= B.length) continue; const b = B[i]; const xa = x0 + j * segW;
      ctx.fillStyle = `color-mix(in srgb, ${css(C.COLORS[b.f])} 40%, ${css('--surface')})`; ctx.fillRect(xa, 20, segW - 1, 16); ctx.fillStyle = css('--ink'); ctx.fillText(b.s ? (b.s === 1 ? 'S' : 'F') : b.b, xa + segW / 2, 32);
      if (j === 0 || B[i + 1]?.f !== b.f) { ctx.fillStyle = css('--muted'); ctx.fillText(b.f, xa + segW / 2, 14); } }
    ctx.fillStyle = css('--muted'); ctx.textAlign = 'left'; ctx.font = '10px ' + css('--f-mono');
    ctx.fillText('dominant 0: CAN_H 3.5 V / CAN_L 1.5 V · recessive 1: both 2.5 V', x0, H - 8);
    const cur = B[ST.pos]; $('#cur').textContent = cur ? `bit ${ST.pos + 1}/${B.length} · ${cur.f}${cur.s ? (cur.s === 1 ? ' (dynamic stuff)' : ' (fixed stuff)') : ''}${cur.fast ? ' · data phase 2 Mbit/s' : ''}` : 'idle — press Transmit';
  }
  build(); drawBus(); U.onTheme(() => { drawStrip(); drawBus(); }); addEventListener('resize', () => { drawStrip(); drawBus(); });
  U.loop($('#bus'), dt => {
    if (!ST.run || !ST.tx || !ST.bits) return;
    const b = ST.bits[Math.max(0, ST.pos)], rate = 7 * ST.speed * (b && b.fast ? 4 : 1);
    tAcc += dt * rate; let moved = false;
    while (tAcc > 1) { tAcc -= 1; ST.pos++; moved = true; if (ST.pos >= ST.bits.length + 34) { ST.tx = false; ST.pos = ST.bits.length - 1; break; } }
    if (moved) { drawBus(); drawStrip(); pioFlow(); }
  });
  setTimeout(() => $('#send').click(), 600);

  /* ---------------- PIO path ---------------- */
  const PA = U.Arch($('#pioarch'), {
    uid: 'pa', w: 1120, h: 300, info: {
      app: '<p>Application asks for a frame (ID, DLC, payload).</p>', cfun: '<p>C frame builder: assembles fields, computes CRC-15/17/21, applies bit stuffing, packs the bit stream into 32-bit words.</p>',
      txf: '<p>TX FIFO (4×32 bit, 8 when joined) or DMA feeds the state machine without CPU timing constraints.</p>',
      smtx: '<p>TX state machine: shifts one bit per nominal bit time; the clock divider sets the time quantum. During arbitration it compares its own TX bit with RX and stops if it loses.</p>',
      gtx: '<p>GPIO TX pin to the transceiver TXD input.</p>', xcvr: '<p>CAN FD transceiver: logic level ↔ differential bus, fault-protected.</p>', bus: '<p>Twisted-pair bus, 120 Ω terminated at both ends.</p>',
      grx: '<p>GPIO RX pin from the transceiver RXD output.</p>', smrx: '<p>RX state machine: waits for the SOF falling edge (hard sync), samples each bit at the sample point, resynchronises on edges, removes stuff bits.</p>',
      rxf: '<p>RX FIFO / DMA to RAM.</p>', dec: '<p>CPU decodes fields, checks CRC and the stuff rule, then drives ACK and passes the frame to the application.</p>'
    },
    nodes: [
      { id: 'app', x: 10, y: 30, w: 120, h: 50, t: 'Application', s: 'C', kind: 'ctrl' }, { id: 'cfun', x: 160, y: 30, w: 140, h: 50, t: 'Frame builder', s: 'CRC · stuffing', kind: 'ctrl' },
      { id: 'txf', x: 330, y: 30, w: 110, h: 50, t: 'TX FIFO', s: 'DMA' }, { id: 'smtx', x: 470, y: 30, w: 140, h: 50, t: 'PIO SM0 · TX', s: 'bit timing', kind: 'ctrl' },
      { id: 'gtx', x: 640, y: 30, w: 100, h: 50, t: 'GPIO TX', s: '' }, { id: 'xcvr', x: 780, y: 100, w: 130, h: 90, t: 'Transceiver', s: 'CAN FD', kind: 'can' },
      { id: 'bus', x: 950, y: 110, w: 160, h: 70, t: 'CAN bus', s: 'CAN_H · CAN_L', kind: 'can' },
      { id: 'grx', x: 640, y: 210, w: 100, h: 50, t: 'GPIO RX', s: '' }, { id: 'smrx', x: 470, y: 210, w: 140, h: 50, t: 'PIO SM1 · RX', s: 'sync · sample', kind: 'ctrl' },
      { id: 'rxf', x: 330, y: 210, w: 110, h: 50, t: 'RX FIFO', s: 'DMA' }, { id: 'dec', x: 160, y: 210, w: 140, h: 50, t: 'Decoder', s: 'CRC check · ACK', kind: 'ctrl' }],
    edges: [
      { id: 't1', type: 'sig', d: 'M130 55 H158' }, { id: 't2', type: 'sig', d: 'M300 55 H328', label: 'words', lx: 314, ly: 47 }, { id: 't3', type: 'sig', d: 'M440 55 H468' }, { id: 't4', type: 'lv', d: 'M610 55 H638', label: 'bits', lx: 624, ly: 47 },
      { id: 't5', type: 'lv', d: 'M740 55 H845 V98', label: 'TXD', lx: 790, ly: 47 }, { id: 't6', type: 'can', d: 'M910 145 H948' },
      { id: 'r1', type: 'lv', d: 'M845 192 V235 H742', label: 'RXD', lx: 790, ly: 228 }, { id: 'r2', type: 'lv', d: 'M640 235 H612' }, { id: 'r3', type: 'sig', d: 'M470 235 H442' }, { id: 'r4', type: 'sig', d: 'M330 235 H302' },
      { id: 'r5', type: 'sig', d: 'M160 235 H70 V82', label: 'frame', lx: 76, ly: 160, anchor: 'start' }]
  }, $('#pioinfo'));
  function pioFlow() { const on = ST.tx ? 0.9 : 0; ['t1', 't2', 't3', 't4', 't5', 't6', 'r1', 'r2', 'r3', 'r4', 'r5'].forEach(k => PA.flow(k, on)); const b = ST.bits[ST.pos]; PA.val('smtx', b ? 'bit ' + b.b + ' · ' + b.f : 'idle'); PA.val('smrx', b ? (b.s ? 'drop stuff bit' : 'sample ' + b.b) : 'wait SOF'); }

  /* ---------------- bit timing ---------------- */
  const btc = U.canvas($('#btplot'), 230); const BT = { n: 16, sp: 75, pd: 220 };
  function drawBT() {
    const { w, h: H } = btc.fit(), ctx = btc.ctx; ctx.clearRect(0, 0, w, H);
    const tbit = 2e-6, tq = tbit / BT.n, sync = 1, p2 = Math.round(BT.n * (1 - BT.sp / 100)), p1 = BT.n - sync - p2, ml = 30, pw = w - 60, X = q => ml + q / BT.n * pw;
    const seg = [['Sync', sync, '--ink'], ['Prop + Phase_Seg1', p1, '--sig'], ['Phase_Seg2', p2, '--violet']]; let q = 0;
    ctx.font = '600 11px ' + css('--f-mono'); ctx.textAlign = 'center';
    seg.forEach(([n, len, c]) => { ctx.fillStyle = `color-mix(in srgb, ${css(c)} 25%, ${css('--surface')})`; ctx.fillRect(X(q), 40, X(q + len) - X(q), 50); ctx.strokeStyle = css(c); ctx.strokeRect(X(q), 40, X(q + len) - X(q), 50); ctx.fillStyle = css('--ink'); ctx.fillText(n + ' · ' + len + ' tq', (X(q) + X(q + len)) / 2, 70); q += len; });
    for (let k = 0; k <= BT.n; k++) { ctx.strokeStyle = css('--line'); ctx.beginPath(); ctx.moveTo(X(k), 92); ctx.lineTo(X(k), 100); ctx.stroke(); }
    const spx = X(sync + p1); ctx.strokeStyle = css('--hv'); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(spx, 26); ctx.lineTo(spx, 120); ctx.stroke(); ctx.fillStyle = css('--hv'); ctx.fillText('sample point ' + BT.sp + ' %', spx, 20);
    // round-trip delay bar
    const rt = 2 * BT.pd * 1e-9 / tq; ctx.fillStyle = css('--warn'); ctx.globalAlpha = .55; ctx.fillRect(X(sync), 130, X(sync + rt) - X(sync), 14); ctx.globalAlpha = 1; ctx.fillStyle = css('--ink'); ctx.textAlign = 'left'; ctx.font = '10px ' + css('--f-mono');
    ctx.fillText('2 × propagation delay = ' + (2 * BT.pd) + ' ns (' + rt.toFixed(1) + ' tq)', X(sync), 160);
    // edge + resync illustration
    ctx.strokeStyle = css('--muted'); ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(ml - 20, 200); ctx.lineTo(X(0), 200); ctx.lineTo(X(0), 180); ctx.lineTo(X(BT.n), 180); ctx.lineTo(X(BT.n), 200); ctx.lineTo(w, 200); ctx.stroke();
    ctx.fillStyle = css('--muted'); ctx.fillText('expected edge inside Sync_Seg; an early/late edge shortens Phase_Seg2 or lengthens Phase_Seg1 (SJW)', ml, H - 6);
    const ok = rt < p1; $('#bt').textContent = `500 kbit/s · tq = ${(tq * 1e9).toFixed(0)} ns`;
    $('#btnote').innerHTML = `${ok ? '<b style="color:var(--ok)">Arbitration OK</b>' : '<b style="color:var(--bad)">Too slow</b>'}: the bus round-trip (${(2 * BT.pd)} ns) must finish before the sample point so every node sees the same dominant/recessive level during arbitration. Margin: ${((p1 - rt) * tq * 1e9).toFixed(0)} ns. A later sample point helps arbitration on long buses; the FD data phase uses its own, shorter timing and transmitter-delay compensation.`;
  }
  [['ntq', 'n', 'tq', v => v], ['spp', 'sp', 'sp', v => v + ' %'], ['pd', 'pd', 'pd', v => v + ' ns']].forEach(([id, k, o, f]) => $('#' + id).oninput = e => { BT[k] = +e.target.value; $(`[data-o=${o}]`).textContent = f(e.target.value); drawBT(); });
  drawBT(); U.onTheme(drawBT); addEventListener('resize', drawBT);

  /* ---------------- PCB ---------------- */
  U.Arch($('#pcbarch'), {
    uid: 'pc', w: 760, h: 420, info: {
      conn: '<p>Vehicle connector: 12 V supply, CAN_H/CAN_L, LIN, ground.</p>', pin: '<p>Input protection: reverse-polarity protection and a TVS for automotive transients (load dump, ISO 7637 style pulses).</p>',
      reg: '<p>Regulation: 12 V → 5 V → 3.3 V for the MCU and transceivers.</p>', dec: '<p>Decoupling: 100 nF per supply pin plus bulk capacitance close to the MCU and transceivers.</p>',
      xtal: '<p>12 MHz crystal: clock reference for the PLL; bit timing accuracy depends on it.</p>', mcu: '<p>RP2040: two Cortex-M0+ cores, 2 PIO blocks × 4 state machines, USB device, QSPI flash interface.</p>',
      flash: '<p>QSPI flash holding the firmware (executed in place).</p>', xcvr: '<p>CAN FD transceiver with TXD dominant time-out and bus fault protection.</p>',
      cmc: '<p>Common-mode choke: reduces emissions and improves immunity on the differential pair.</p>', esd: '<p>ESD protection diodes on CAN_H/CAN_L and LIN.</p>',
      term: '<p>Split termination 2 × 60 Ω with a mid-point capacitor to ground: 120 Ω differential, better common-mode filtering. Jumper-selectable for a test tool.</p>',
      lin: '<p>LIN transceiver, master pull-up (1 kΩ + diode) selectable.</p>', usb: '<p>USB device port to the PC, with ESD protection.</p>', swd: '<p>SWD debug header for flashing and step debugging.</p>'
    },
    nodes: [
      { id: 'conn', x: 10, y: 170, w: 100, h: 80, t: 'Vehicle', s: 'connector' },
      { id: 'pin', x: 150, y: 20, w: 120, h: 46, t: 'Input prot.', s: 'rev-pol · TVS', fs: 10.5 }, { id: 'reg', x: 300, y: 20, w: 120, h: 46, t: 'Regulators', s: '5 V · 3.3 V', fs: 10.5 },
      { id: 'dec', x: 450, y: 20, w: 110, h: 46, t: 'Decoupling', s: '', fs: 10.5 }, { id: 'xtal', x: 600, y: 20, w: 140, h: 46, t: 'Crystal', s: '12 MHz', fs: 10.5 },
      { id: 'mcu', x: 470, y: 150, w: 150, h: 110, t: 'RP2040', s: 'PIO · USB · QSPI', kind: 'ctrl' },
      { id: 'flash', x: 650, y: 170, w: 100, h: 46, t: 'QSPI flash', s: '', fs: 10.5 }, { id: 'usb', x: 650, y: 250, w: 100, h: 46, t: 'USB', s: 'ESD', fs: 10.5 }, { id: 'swd', x: 650, y: 330, w: 100, h: 40, t: 'SWD', s: '', fs: 10.5 },
      { id: 'xcvr', x: 320, y: 150, w: 120, h: 50, t: 'CAN FD xcvr', s: '', kind: 'can', fs: 10.5 }, { id: 'lin', x: 320, y: 300, w: 120, h: 50, t: 'LIN xcvr', s: '', kind: 'can', fs: 10.5 },
      { id: 'cmc', x: 175, y: 150, w: 110, h: 40, t: 'CM choke', s: '', fs: 10.5 }, { id: 'term', x: 175, y: 210, w: 110, h: 46, t: 'Split term.', s: '2 × 60 Ω', fs: 10.5 }, { id: 'esd', x: 175, y: 300, w: 110, h: 40, t: 'ESD', s: '', fs: 10.5 }],
    edges: [
      { id: 'v1', type: 'sig', d: 'M60 170 V43 H148', label: '12 V', lx: 66, ly: 100, anchor: 'start' }, { id: 'v2', type: 'sig', d: 'M270 43 H298' }, { id: 'v3', type: 'sig', d: 'M420 43 H448' }, { id: 'v4', type: 'sig', d: 'M505 66 V148', label: '3.3 V', lx: 511, ly: 110, anchor: 'start' },
      { id: 'k1', type: 'lv', d: 'M670 66 V100 H590 V148' },
      { id: 'b1', type: 'can', d: 'M110 190 H173', label: 'CAN', lx: 140, ly: 182 }, { id: 'b2', type: 'can', d: 'M285 170 H318' }, { id: 'b3', type: 'can', d: 'M230 190 V208' },
      { id: 'd1', type: 'lv', d: 'M440 175 H468', label: 'TXD/RXD', lx: 454, ly: 167 }, { id: 'd2', type: 'can', d: 'M110 235 H140 V320 H173', label: 'LIN', lx: 146, ly: 290, anchor: 'start' }, { id: 'd3', type: 'can', d: 'M285 320 H318' }, { id: 'd4', type: 'lv', d: 'M440 325 H545 V262' },
      { id: 'q1', type: 'lv', d: 'M620 193 H648' }, { id: 'q2', type: 'lv', d: 'M620 240 H635 V273 H648' }, { id: 'q3', type: 'lv', d: 'M600 260 V350 H648' }]
  }, $('#pcbinfo'));
});
