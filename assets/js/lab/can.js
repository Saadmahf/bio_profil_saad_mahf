/* =====================================================================
   CAN / CAN FD frame encoder (ISO 11898-1 bit layout)
   - Classic base frame: CRC-15 (0x4599), dynamic bit stuffing SOF..CRC
   - FD base frame: dynamic stuffing SOF..data, stuff-count (Gray + parity),
     CRC-17 (0x1685B, ≤16 B) / CRC-21 (0x102899, >16 B), fixed stuff bits
     every 4 bits from the stuff count to the end of the CRC
   ===================================================================== */
window.CANENC = (function () {
  const bitsOf = (v, n) => Array.from({ length: n }, (_, i) => (v >> (n - 1 - i)) & 1);
  const FD_LEN = [0, 1, 2, 3, 4, 5, 6, 7, 8, 12, 16, 20, 24, 32, 48, 64];
  function crc(bits, poly, width, init) {
    let r = init; const top = 1 << (width - 1), mask = (1 << width) - 1;
    for (const b of bits) { const fb = ((r & top) ? 1 : 0) ^ b; r = (r << 1) & mask; if (fb) r ^= poly; }
    return r;
  }
  const GRAY = [0, 1, 3, 2, 6, 7, 5, 4];
  /* returns [{b, f (field), s (stuff: 0 none, 1 dynamic, 2 fixed), fast (data phase)}] */
  function encode(o) {
    const fd = !!o.fd, id = o.id & 0x7ff, data = o.data.slice(0, fd ? 64 : 8);
    let dlc, len;
    if (!fd) { len = data.length; dlc = len; }
    else { dlc = FD_LEN.findIndex(l => l >= data.length); len = FD_LEN[dlc]; while (data.length < len) data.push(0); }
    const raw = []; const push = (arr, f, fast) => arr.forEach(b => raw.push({ b, f, fast: !!fast }));
    push([0], 'SOF'); push(bitsOf(id, 11), 'ID');
    if (!fd) { push([0], 'RTR'); push([0], 'IDE'); push([0], 'r0'); push(bitsOf(dlc, 4), 'DLC'); }
    else { push([0], 'RRS'); push([0], 'IDE'); push([1], 'FDF'); push([0], 'res'); push([o.brs ? 1 : 0], 'BRS'); push([0], 'ESI', o.brs); push(bitsOf(dlc, 4), 'DLC', o.brs); }
    data.forEach(byte => push(bitsOf(byte, 8), 'DATA', fd && o.brs));
    // dynamic stuffing
    const out = []; let run = 0, last = -1, nstuff = 0;
    const stuffRange = fd ? raw.length : null;
    function emitDyn(bit) {
      out.push(bit);
      if (bit.b === last) run++; else { run = 1; last = bit.b; }
      if (run === 5) { const s = { b: 1 - bit.b, f: bit.f, s: 1, fast: bit.fast }; out.push(s); nstuff++; last = s.b; run = 1; }
    }
    if (!fd) {
      raw.forEach(emitDyn);
      const c = crc(raw.map(x => x.b), 0x4599, 15, 0);
      bitsOf(c, 15).forEach(b => emitDyn({ b, f: 'CRC', fast: false }));
      out.crcVal = c; out.crcW = 15;
    } else {
      raw.forEach(emitDyn);
      // CRC covers SOF..data including dynamic stuff bits, then stuff count
      const sc = GRAY[nstuff % 8], scb = bitsOf(sc, 3), par = scb.reduce((a, b) => a ^ b, 0);
      const W = len <= 16 ? 17 : 21, poly = W === 17 ? 0x1685B : 0x102899;
      const c = crc(out.map(x => x.b).concat(scb, [par]), poly, W, 1 << (W - 1));
      const tail = scb.map(b => ({ b, f: 'SBC' })).concat([{ b: par, f: 'SBC' }], bitsOf(c, W).map(b => ({ b, f: 'CRC' })));
      // fixed stuff bit before stuff count and after every 4 bits
      let prev = out[out.length - 1].b;
      tail.forEach((t, i) => { if (i % 4 === 0) { out.push({ b: 1 - prev, f: i === 0 ? 'SBC' : 'CRC', s: 2, fast: !!o.brs }); prev = 1 - prev; } t.fast = !!o.brs; out.push(t); prev = t.b; });
      out.push({ b: 1 - prev, f: 'CRC', s: 2, fast: !!o.brs });
      out.crcVal = c; out.crcW = W; out.sc = nstuff;
    }
    out.push({ b: 1, f: 'CRCdel', fast: false }); out.push({ b: 0, f: 'ACK' }); out.push({ b: 1, f: 'ACKdel' });
    for (let i = 0; i < 7; i++) out.push({ b: 1, f: 'EOF' });
    for (let i = 0; i < 3; i++) out.push({ b: 1, f: 'IFS' });
    out.nstuff = nstuff; out.dlc = dlc; out.len = len; out.fd = fd;
    return out;
  }
  const COLORS = { SOF: '--ink', ID: '--hv', RTR: '--warn', RRS: '--warn', IDE: '--warn', r0: '--warn', FDF: '--warn', res: '--warn', BRS: '--warn', ESI: '--warn', DLC: '--violet', DATA: '--sig', SBC: '--violet', CRC: '--bad', CRCdel: '--muted', ACK: '--ok', ACKdel: '--muted', EOF: '--muted', IFS: '--line' };
  return { encode, COLORS, FD_LEN };
})();
