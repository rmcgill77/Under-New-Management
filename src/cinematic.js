// ============================================================================
// Opening story and title backdrop. Each card is a small pixel scene (192 x 108,
// drawn in code, scaled up without smoothing) with a few lines of text. The same
// scene code draws the animated backdrop behind the main menu.
// ============================================================================
const Cine = (() => {
  const W = 192, H = 108;
  const hex = (c) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
  const mix = (a, b, t) => { const x = hex(a), y = hex(b); return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * t)).join(',')})`; };
  const rnd = (seed) => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

  // ---------- drawing helpers ----------
  const R = (g, x, y, w, h, c) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
  function sky(g, top, bot, y1 = H) { for (let y = 0; y < y1; y += 2) R(g, 0, y, W, 2, mix(top, bot, y / y1)); }
  function stars(g, t, n = 70, seed = 4, maxY = 60) {
    const r = rnd(seed);
    for (let i = 0; i < n; i++) {
      const x = r() * W, y = r() * maxY, ph = r() * 6.28, b = 0.45 + 0.55 * Math.sin(t * 1.4 + ph);
      R(g, x, y, 1, 1, `rgba(255,244,214,${(0.35 + 0.5 * b).toFixed(2)})`);
    }
  }
  function disc(g, cx, cy, r, c) { g.fillStyle = c; for (let y = -r; y <= r; y++) { const w = Math.floor(Math.sqrt(r * r - y * y)); g.fillRect(Math.round(cx - w), Math.round(cy + y), w * 2 + 1, 1); } }
  function glow(g, cx, cy, r, rgb, a) { for (let i = r; i > 0; i -= 2) { g.fillStyle = `rgba(${rgb},${(a * (1 - i / r) * 0.5).toFixed(3)})`; disc(g, cx, cy, i, g.fillStyle); } }
  function skyline(g, seed, base, minH, maxH, color, wins, t, lit = '#ffe9a0', broken = false) {
    const r = rnd(seed); let x = -4;
    while (x < W + 4) {
      const w = 5 + Math.floor(r() * 8), h = minH + Math.floor(r() * (maxH - minH));
      if (broken) {
        const w1 = Math.max(2, Math.floor(w * (0.3 + r() * 0.5))), drop = 2 + Math.floor(r() * 9);
        R(g, x, base - h, w1, h + 40, color); R(g, x + w1, base - h + drop, w - w1, h + 40 - drop, color);
        if (r() < 0.4) R(g, x + w1 - 1, base - h - 3, 1, 3, color);
      } else R(g, x, base - h, w, h + 40, color);
      if (wins) for (let yy = base - h + 3; yy < base - 2; yy += 3) for (let xx = x + 1; xx < x + w - 1; xx += 2) {
        const on = r() < wins; const fl = on && Math.sin(t * 2 + xx * 3.1 + yy * 1.7) > -0.92;
        if (on && fl) R(g, xx, yy, 1, 1, lit);
      }
      x += w + (r() < 0.3 ? 1 : 0);
    }
  }
  function figure(g, x, y, c, bob = 0, pack = true) { // a traveller seen from behind, feet at y
    R(g, x - 2, y - 11 + bob, 4, 4, c); R(g, x - 3, y - 7 + bob, 6, 7, c); R(g, x - 2, y - 1, 2, 2, c); R(g, x + 1, y - 1, 2, 2, c);
    if (pack) R(g, x - 5, y - 8 + bob, 3, 5, c);
  }
  function dust(g, t, n, seed, color, speed = 18) {
    const r = rnd(seed);
    for (let i = 0; i < n; i++) { const sp = 0.5 + r(); const x = ((r() * W + t * speed * sp) % (W + 10)) - 5, y = r() * H * 0.8 + Math.sin(t + i) * 1.2; R(g, x, y, 1 + (r() < 0.2 ? 1 : 0), 1, color); }
  }

  // The waystation, drawn as one place so the title screen and the last cards match.
  function station(g, t, o = {}) {
    const ox = o.x || 0, gy = o.ground || 76, lit = o.lit !== false, flick = 0.65 + 0.35 * Math.sin(t * 9) * Math.sin(t * 3.3 + 1), signOn = lit && (Math.sin(t * 1.7) > -0.9);
    const wood = '#2b2018', wood2 = '#3a2b20', roof = '#241a14', brick = '#4a3226';
    // wall and wire
    R(g, ox + 4, gy - 9, 34, 9, '#3a3128'); for (let i = 0; i < 34; i += 6) R(g, ox + 4 + i, gy - 12, 1, 12, '#2a221b');
    R(g, ox + 4, gy - 12, 34, 1, '#5a5148');
    // motel block, two storeys, gable roof
    R(g, ox + 44, gy - 30, 44, 30, wood2); R(g, ox + 44, gy - 31, 44, 2, '#53402f');
    for (let i = 0; i < 14; i++) R(g, ox + 41 + i, gy - 40 + Math.abs(i - 0) * 0, 1, 1, roof);
    g.fillStyle = roof; g.beginPath(); g.moveTo(ox + 41, gy - 30); g.lineTo(ox + 66, gy - 46); g.lineTo(ox + 91, gy - 30); g.closePath(); g.fill();
    R(g, ox + 62, gy - 52, 3, 8, brick); // chimney
    [[48, gy - 24], [60, gy - 24], [72, gy - 24], [48, gy - 12], [60, gy - 12], [76, gy - 14]].forEach(([wx, wy], i) => {
      const on = lit && (i === 1 || (i === 4 && flick > 0.75));
      R(g, ox + wx, wy, 8, 6, on ? mix('#e8b25a', '#fff0b8', flick) : '#120d09');
      if (on) { g.fillStyle = `rgba(255,190,90,${0.1 * flick})`; g.fillRect(ox + wx - 3, wy - 2, 14, 12); }
      R(g, ox + wx + 3, wy, 1, 6, '#2b2018');
    });
    R(g, ox + 76, gy - 14, 8, 14, '#17100c');
    // saloon with a false front
    R(g, ox + 92, gy - 24, 34, 24, '#33261c'); R(g, ox + 90, gy - 32, 38, 9, '#3f2f22'); R(g, ox + 90, gy - 33, 38, 1, '#6a5240');
    R(g, ox + 97, gy - 30, 28, 4, '#2a1d14'); for (let i = 0; i < 7; i++) R(g, ox + 98 + i * 4, gy - 29, 2, 2, lit ? '#7a5a36' : '#3a2b20');
    R(g, ox + 98, gy - 16, 10, 8, lit ? mix('#c78b3e', '#ffd88a', flick) : '#120d09'); R(g, ox + 112, gy - 16, 10, 8, '#120d09'); R(g, ox + 108, gy - 14, 4, 14, '#17100c');
    // watchtower, tank
    R(g, ox + 132, gy - 36, 3, 36, '#2b2018'); R(g, ox + 146, gy - 36, 3, 36, '#2b2018'); R(g, ox + 130, gy - 44, 21, 8, '#33261c'); R(g, ox + 128, gy - 46, 25, 3, roof);
    R(g, ox + 134, gy - 41, 13, 3, lit ? '#e2a24a' : '#120d09'); R(g, ox + 134, gy - 36, 13, 1, '#1c140f');
    for (let i = 0; i < 6; i++) { R(g, ox + 134 + i * 2, gy - 34 + i * 5, 1, 5, '#2b2018'); }
    R(g, ox + 112, gy - 46, 14, 12, '#4a3a2c'); R(g, ox + 112, gy - 47, 14, 2, '#6a5646'); R(g, ox + 114, gy - 34, 2, 4, '#2b2018'); R(g, ox + 123, gy - 34, 2, 4, '#2b2018');
    // sign on posts over the roof
    R(g, ox + 54, gy - 58, 3, 22, '#1a130e'); R(g, ox + 76, gy - 58, 3, 22, '#1a130e'); R(g, ox + 57, gy - 50, 2, 1, '#1a130e'); R(g, ox + 74, gy - 50, 2, 1, '#1a130e'); R(g, ox + 55, gy - 44, 1, 1, '#3a2b20'); R(g, ox + 77, gy - 44, 1, 1, '#3a2b20');
    R(g, ox + 53, gy - 38, 5, 2, '#241a12'); R(g, ox + 75, gy - 39, 5, 2, '#241a12');
    R(g, ox + 50, gy - 66, 32, 9, '#1a130e'); R(g, ox + 51, gy - 65, 30, 7, signOn ? mix('#7a4a1c', '#e8903a', flick) : '#2a1c12');
    if (signOn) for (let i = 0; i < 9; i++) R(g, ox + 54 + i * 3, gy - 63, 2, 3, `rgba(255,236,176,${(0.55 + 0.4 * flick).toFixed(2)})`);
    if (signOn) glow(g, ox + 66, gy - 62, 24, '255,150,60', 0.6 * flick);
    if (o.smoke) smoke(g, ox + 63, gy - 52, t, 6, '150,140,130', 1.2, 0.6, 0.35);
    if (o.crows) { const cx = [[ox + 48, gy - 31], [ox + 83, gy - 32], [ox + 140, gy - 48]]; cx.forEach(([x, y], i) => { const fly = Math.sin(t * 0.35 + i * 2.2) > 0.9; if (!fly) { R(g, x, y - 2, 3, 2, '#0c0808'); R(g, x + 3, y - 3, 1, 1, '#0c0808'); } else bird(g, x + ((t * 20) % 40), y - 6 - ((t * 8) % 20), t, '#0c0808', i); }); }
    // lamp posts and poles
    R(g, ox + 156, gy - 26, 2, 26, '#2b2018'); R(g, ox + 150, gy - 25, 14, 1, '#2b2018'); R(g, ox + 160, gy - 24, 4, 3, lit ? '#f2c36a' : '#2b2018');
    // ground
    R(g, 0, gy, W, 3, '#3a2d22'); R(g, 0, gy + 3, W, H - gy - 3, '#2a1f17');
    if (o.under) {
      for (let y = gy + 3; y < H; y += 2) R(g, 0, y, W, 2, mix('#2a1f17', '#150f0b', (y - gy) / (H - gy)));
      const rooms = [[6, 'a'], [30, 'a'], [54, 'lamp'], [78, 'a'], [102, 'a'], [126, 'a']];
      rooms.forEach(([rx, k]) => { R(g, ox + rx, gy + 9, 22, 12, '#1c140e'); R(g, ox + rx + 1, gy + 10, 20, 10, k === 'lamp' ? mix('#6a4a24', '#c88a40', flick) : '#120d09'); if (k === 'lamp') R(g, ox + rx + 8, gy + 12, 6, 6, '#f0b560'); });
      rooms.forEach(([rx]) => { R(g, ox + rx + 6, gy + 24, 22, 12, '#1c140e'); R(g, ox + rx + 7, gy + 25, 20, 10, '#0f0a07'); });
      const pulse = 0.5 + 0.5 * Math.sin(t * 1.6);
      disc(g, ox + 168, gy + 28, 9, '#1c140e'); disc(g, ox + 168, gy + 28, 7, `rgb(${Math.round(110 + 80 * pulse)},${Math.round(60 + 40 * pulse)},20)`); disc(g, ox + 168, gy + 28, 4, '#0f0a07');
    }
  }

  // ---------- more helpers for the scenes ----------
  const sil = (g, x, y, c, arm = 0) => { R(g, x - 1, y - 9, 2, 2, c); R(g, x - 2, y - 7, 4, 5, c); R(g, x - 2, y - 2, 1, 2, c); R(g, x + 1, y - 2, 1, 2, c); if (arm) R(g, x + 2, y - 10, 1, 4, c); };
  function bird(g, x, y, t, c = '#1a1410', ph = 0) { const f = Math.sin(t * 9 + ph) > 0; R(g, x, y, 1, 1, c); R(g, x - 2, y + (f ? -1 : 0), 2, 1, c); R(g, x + 1, y + (f ? -1 : 0), 2, 1, c); }
  function smoke(g, x, y, t, n, rgb, up = 1.6, spread = 0.7, a = 0.5) {
    for (let i = 0; i < n; i++) { const k = ((t * 0.5 + i / n) % 1), yy = y - k * 26 * up, xx = x + Math.sin(k * 6 + i) * 3 * spread + k * 7 * spread, r = 1 + k * 3; g.fillStyle = `rgba(${rgb},${((1 - k) * a).toFixed(2)})`; g.fillRect(Math.round(xx - r), Math.round(yy - r), Math.round(r * 2), Math.round(r * 1.6)); }
  }
  function embers(g, t, n, seed, x0, x1, y0, rgb = '255,170,80') {
    const r = rnd(seed); for (let i = 0; i < n; i++) { const sp = 0.3 + r() * 0.5, k = (t * sp + r()) % 1, x = x0 + r() * (x1 - x0) + Math.sin(t * 2 + i) * 2, y = y0 - k * 40; R(g, x, y, 1, 1, `rgba(${rgb},${(1 - k).toFixed(2)})`); }
  }
  function ray(g, x, y, ang, len, w, rgb, a) { g.fillStyle = `rgba(${rgb},${a})`; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(ang - w) * len, y + Math.sin(ang - w) * len); g.lineTo(x + Math.cos(ang + w) * len, y + Math.sin(ang + w) * len); g.closePath(); g.fill(); }
  function dune(g, base, amp, f, ph, color, y1 = H) { g.fillStyle = color; g.beginPath(); g.moveTo(0, y1); for (let x = 0; x <= W; x += 4) g.lineTo(x, base + Math.sin(x * f + ph) * amp + Math.sin(x * f * 2.3 + ph * 1.7) * amp * 0.4); g.lineTo(W, y1); g.closePath(); g.fill(); }
  function moth(g, cx, cy, t, i) { const a = t * 3 + i * 2.1, x = cx + Math.cos(a) * (5 + i * 2), y = cy + Math.sin(a * 1.3) * (4 + i); R(g, x, y, 1, 1, '#e8dcc0'); R(g, x + (Math.sin(t * 30 + i) > 0 ? 1 : -1), y, 1, 1, '#c8b890'); }
  function tree(g, x, y, h, c1, c2) { R(g, x - 1, y - h * 0.5, 2, h * 0.5, '#3a2a1c'); disc(g, x, y - h * 0.7, Math.round(h * 0.35), c1); disc(g, x - 2, y - h * 0.6, Math.round(h * 0.25), c2); }
  function car(g, x, y, c, lights = false, dir = 1) { R(g, x, y, 9, 3, c); R(g, x + 2, y - 2, 5, 2, c); R(g, x + 3, y - 2, 3, 1, '#a8c8d8'); R(g, x + 1, y + 3, 2, 1, '#111'); R(g, x + 6, y + 3, 2, 1, '#111'); if (lights) { R(g, dir > 0 ? x + 9 : x - 1, y + 1, 1, 1, '#fff6c8'); } }

  // ---------- the cards ----------
  const SCENES = {
    oldWorld(g, t) {
      sky(g, '#5f9fd0', '#f8e4b0', 74);
      for (let k = 0; k < 9; k++) ray(g, 150, 38, -1.2 + k * 0.32 + Math.sin(t * 0.3 + k) * 0.03, 130, 0.05, '255,240,190', 0.06);
      glow(g, 150, 38, 28, '255,236,170', 0.8); disc(g, 150, 38, 7, '#fff6cc');
      const r = rnd(9); for (let i = 0; i < 5; i++) { const x = ((r() * 260 + t * (1.5 + i)) % 250) - 30, y = 8 + r() * 30, w = 16 + r() * 14; R(g, x, y, w, 3, 'rgba(255,255,255,0.8)'); R(g, x + 4, y - 2, w * 0.55, 3, 'rgba(255,255,255,0.8)'); R(g, x + 2, y + 3, w - 4, 1, 'rgba(190,210,230,0.55)'); }
      const px = (t * 11) % 250 - 25; R(g, px, 20, 7, 1, '#eef2f4'); R(g, px + 2, 19, 2, 1, '#eef2f4'); for (let i = 1; i < 46; i++) R(g, px - i, 20, 1, 1, `rgba(255,255,255,${(0.7 - i / 70).toFixed(2)})`);
      skyline(g, 3, 78, 24, 56, '#a8c4d4', 0.05, t); skyline(g, 5, 82, 14, 42, '#6a8aa0', 0.12, t, '#fff6c4');
      // neon billboard and monorail
      const hue = Math.floor(t * 1.5) % 3; R(g, 26, 52, 24, 9, '#202830'); R(g, 27, 53, 22, 7, ['#d85a8a', '#4ac0d8', '#e8c040'][hue]); for (let i = 0; i < 5; i++) R(g, 29 + i * 4, 56, 2, 1, '#fff');
      R(g, 0, 70, W, 2, '#4a5560'); R(g, 0, 72, W, 1, '#2a3038'); for (let x = 6; x < W; x += 26) R(g, x, 72, 2, 12, '#4a5560');
      for (let c = 0; c < 3; c++) { const tx = (t * 34 + c * 62) % (W + 70) - 40; R(g, tx, 65, 22, 5, '#d8dcd8'); R(g, tx, 66, 22, 1, '#3a78b0'); for (let k = 0; k < 6; k++) R(g, tx + 2 + k * 3, 67, 2, 2, '#fff2b0'); R(g, tx + 22, 66, 2, 3, '#a0a8a8'); }
      // park, street, people
      R(g, 0, 84, W, 24, '#5e8a54'); dune(g, 86, 1, 0.1, 0, '#6a9a5c', 90); for (let i = 0; i < 10; i++) tree(g, 8 + i * 20, 86 + (i % 2), 16 + (i % 3) * 3, '#3f7a3c', '#4f9048');
      R(g, 0, 90, W, 14, '#3c4248'); R(g, 0, 90, W, 1, '#8a8e92'); R(g, 0, 103, W, 1, '#8a8e92'); for (let x = -((t * 26) % 14); x < W; x += 14) R(g, x, 97, 7, 1, '#d8d0b0');
      for (let i = 0; i < 6; i++) { const dir = i % 2 ? -1 : 1, x = ((i * 47 + t * (16 + i * 2) * dir) % (W + 40) + W + 40) % (W + 40) - 20; car(g, x, 93 + (i % 2) * 6, ['#c24a3a', '#d8d4c8', '#3a6a9a', '#d8b03a', '#5a5a5a', '#4a8a5a'][i], true, dir); }
      for (let i = 0; i < 7; i++) { const x = ((i * 31 + t * (3 + (i % 3))) % (W + 20)) - 10; sil(g, x, 108, ['#2a2a38', '#4a3a3a', '#2a3a4a'][i % 3]); }
      for (let x = 12; x < W; x += 52) { R(g, x, 76, 1, 14, '#2a3038'); R(g, x - 1, 75, 3, 2, '#fff6c0'); }
      R(g, 96, 80, 1, 10, '#222'); R(g, 95, 79, 3, 3, '#222'); R(g, 96, 80 + (Math.floor(t * 0.7) % 3), 1, 1, ['#d84a3a', '#e8c040', '#4ac070'][Math.floor(t * 0.7) % 3]);
      for (let i = 0; i < 7; i++) bird(g, ((t * 14 + i * 9) % 230) - 15, 22 + i * 3 + Math.sin(t * 2 + i) * 2, t, '#2a3a44', i);
    },
    omens(g, t) {
      sky(g, '#06030e', '#4a2342', 78); stars(g, t, 90, 11, 54);
      for (let x = 0; x < W; x += 2) { const y = 12 + Math.sin(x * 0.05 + t * 0.7) * 6 + Math.sin(x * 0.13 - t) * 2; R(g, x, y, 2, 16, 'rgba(80,255,170,0.07)'); R(g, x, y + 4, 2, 8, 'rgba(120,255,210,0.07)'); }
      for (let m = 0; m < 3; m++) { const k = ((t + m * 1.7) % 6) / 6; if (k < 0.45) { const q = k / 0.45, x = 20 + m * 52 + q * 90, y = 4 + q * 52 - m * 3; for (let i = 0; i < 20; i++) R(g, x - i * 1.7, y - i * 0.95, 2, 1, `rgba(255,${Math.round(210 - i * 8)},${Math.round(130 - i * 5)},${(1 - i / 20).toFixed(2)})`); disc(g, x, y, 2, '#fff4c8'); } }
      const lights = [[138, 20], [152, 29], [124, 29]], pul = 0.5 + 0.5 * Math.sin(t * 1.6);
      lights.forEach(([x, y], i) => { ray(g, x, y + 2, Math.PI / 2 + Math.sin(t * 0.6 + i) * 0.08, 70, 0.1, '190,235,255', (0.05 + 0.05 * pul).toFixed(3)); });
      lights.forEach(([x, y]) => { glow(g, x, y, 9, '190,235,255', 0.9); disc(g, x, y, 2, `rgba(220,248,255,${(0.7 + 0.3 * Math.sin(t * 2 + x)).toFixed(2)})`); });
      for (const sx of [30, 168]) ray(g, sx, 92, -Math.PI / 2 + Math.sin(t * 0.7 + sx) * 0.7, 90, 0.035, '255,244,200', 0.09);
      skyline(g, 7, 82, 18, 58, '#1b1022', 0.24, t, '#ffd884'); R(g, 62, 30, 1, 52, '#120a18'); for (let i = 0; i < 4; i++) if (Math.sin(t * 2.2 + i) > -0.2) R(g, 61, 32 + i * 12, 3, 1, '#ff4a3a');
      skyline(g, 8, 92, 12, 42, '#10081a', 0.5, t, '#ffcf70');
      R(g, 96, 80, 64, 4, '#08040c'); for (let i = 0; i < 11; i++) sil(g, 99 + i * 5.5, 80, '#030106', i % 3 === 0 ? 1 : 0);
      R(g, 0, 92, W, 16, '#0b0610'); for (let x = 0; x < W; x += 3) if (Math.sin(x * 12.3 + t * 3) > 0.5) R(g, x, 96 + (x % 5), 1, 1, '#ffcf70');
      for (let i = 0; i < 9; i++) sil(g, ((i * 23 + t * 2) % 200) - 4, 108, '#020104');
    },
    elite(g, t) {
      sky(g, '#04050c', '#2a2036', 86); stars(g, t, 100, 13, 72);
      disc(g, 30, 20, 9, '#d9d6c8'); disc(g, 27, 18, 2, '#bcb9aa'); disc(g, 33, 23, 3, '#c4c1b2'); disc(g, 31, 16, 1, '#bcb9aa');
      const T = t % 12, ignite = Math.min(1, Math.max(0, (T - 1.5) / 2)), lift = Math.max(0, T - 4), ry = 80 - (lift * lift) * 3.4, rx = 62 + lift * 1.6, shake = lift < 0.1 && T > 2 ? Math.sin(t * 60) * 0.8 : 0;
      // pad, gantry, tanks
      R(g, 0, 90, W, 18, '#08080e'); R(g, 38, 84, 46, 6, '#1c1c28'); R(g, 38, 84, 46, 1, '#3a3a4c');
      R(g, 28, 40, 3, 50, '#2a2a3a'); for (let y = 42; y < 88; y += 5) { R(g, 28, y, 3, 1, '#4a4a60'); R(g, 31, y, 5, 1, '#3a3a4c'); } R(g, 31, 52, 14, 2, '#3a3a4c'); R(g, 31, 66, 14, 2, '#3a3a4c');
      if (Math.sin(t * 3) > 0) R(g, 29, 38, 1, 2, '#ff4a3a'); R(g, 29, 36, 1, 2, Math.sin(t * 3) > 0 ? '#3a1210' : '#ff4a3a');
      disc(g, 100, 84, 6, '#2a2a3a'); disc(g, 99, 82, 2, '#4a4a60'); R(g, 98, 88, 1, 3, '#2a2a3a'); R(g, 102, 88, 1, 3, '#2a2a3a'); disc(g, 118, 85, 5, '#2a2a3a'); disc(g, 117, 83, 2, '#4a4a60');
      if (ignite > 0) { glow(g, 62, 86, 36 * ignite + 8, '255,170,80', 1); for (let i = 0; i < 14; i++) { const k = ((t * 0.7 + i / 14) % 1), sx = 62 + (i % 2 ? 1 : -1) * k * 38 * ignite, r2 = 2 + k * 6; g.fillStyle = `rgba(170,160,150,${((1 - k) * 0.55).toFixed(2)})`; g.fillRect(Math.round(sx - r2), Math.round(86 - r2 - k * 5), Math.round(r2 * 2), Math.round(r2)); } }
      if (ignite > 0) for (let i = 0; i < 46; i++) { const sy = ry + 6 + i * 2.4; if (sy > 90) break; const sw = 1 + i * 0.12; R(g, rx - sw + Math.sin(i * 0.7 + t * 5) * 0.8, sy, sw * 2, 2, `rgba(${i < 7 ? '255,210,130' : '190,180,170'},${Math.max(0, (0.95 - i * 0.02) * ignite).toFixed(2)})`); }
      const bx = rx + shake; R(g, bx - 3, ry - 10, 6, 17, '#dcd8cc'); R(g, bx - 2, ry - 14, 4, 5, '#dcd8cc'); R(g, bx - 1, ry - 17, 2, 3, '#b8b4a8'); R(g, bx - 3, ry + 2, 6, 1, '#a8a498'); R(g, bx - 6, ry + 2, 3, 6, '#a8a498'); R(g, bx + 3, ry + 2, 3, 6, '#a8a498'); R(g, bx - 1, ry - 7, 3, 2, '#3a5a7a'); R(g, bx - 3, ry - 3, 6, 1, '#c03a2e');
      if (ignite > 0) glow(g, bx, ry + 9, 10 + 4 * ignite, '255,190,90', 1);
      const sx = 150 + Math.sin(t * 0.15) * 5, sy = 26; R(g, sx - 13, sy, 26, 2, '#8a8f9a'); R(g, sx - 2, sy - 7, 4, 16, '#aab0ba'); R(g, sx - 10, sy - 4, 6, 9, '#4a5a78'); R(g, sx + 4, sy - 4, 6, 9, '#4a5a78'); R(g, sx - 10, sy - 1, 6, 1, '#6a8ab0'); R(g, sx + 4, sy - 1, 6, 1, '#6a8ab0'); R(g, sx - 13, sy - 1, 26, 1, '#c8d4e4'); if (Math.sin(t * 3) > 0.2) R(g, sx, sy - 8, 1, 1, '#ff5a4a'); if (Math.sin(t * 1.3) > 0.5) R(g, sx - 12, sy + 3, 1, 1, '#9affc0');
      R(g, 0, 98, W, 10, '#030306'); R(g, 0, 98, W, 1, '#2a2a38');
      for (let i = 0; i < 16; i++) { const x = 6 + i * 12 + (i % 3) * 2, up = Math.sin(t * 2 + i) > 0.3; sil(g, x, 108, '#010103', up ? 1 : 0); if (up) R(g, x - 3, 98, 1, 3, '#010103'); }
    },
    centuries(g, t) {
      sky(g, '#4c2a1c', '#e2a860', 80); glow(g, 40, 72, 38, '255,200,120', 0.85); disc(g, 40, 72, 10, '#ffe6a8');
      for (let i = 0; i < 3; i++) { const a = t * 0.6 + i * 2.1; bird(g, 112 + Math.cos(a) * 22, 22 + i * 3 + Math.sin(a) * 5, t, '#1a1008', i); }
      skyline(g, 21, 80, 22, 56, '#744a2e', 0, t, '#ffd884', true);
      R(g, 150, 46, 2, 40, '#3a2418'); for (let k = 0; k < 3; k++) { const a = t * 0.35 + k * 2.09; for (let s2 = 1; s2 < 14; s2++) R(g, 151 + Math.cos(a) * s2, 46 + Math.sin(a) * s2, 1, 1, '#2a1a10'); }
      skyline(g, 22, 86, 10, 34, '#43281a', 0, t, '#ffd884', true);
      R(g, 56, 66, 54, 3, '#2a1a10'); R(g, 56, 66, 54, 1, '#5a3a24'); R(g, 62, 69, 3, 20, '#2a1a10'); R(g, 90, 69, 3, 20, '#2a1a10'); R(g, 104, 66, 6, 7, '#2a1a10'); for (let i = 0; i < 5; i++) R(g, 66 + i * 8, 62, 1, 4, '#2a1a10');
      dune(g, 90, 3, 0.05, 1, '#4a2c1c'); car(g, 70, 86, '#2a1a10'); car(g, 96, 88, '#2a1a10'); R(g, 76, 84, 2, 2, '#2a1a10');
      dune(g, 96, 4, 0.04, 3, '#3a2214'); dune(g, 102, 3, 0.07, 5, '#2a180e');
      for (let i = 0; i < 26; i++) R(g, (i * 37) % W, 100 + (i * 11) % 8, 4 + (i % 3), 1, '#46301e');
      const tw = (t * 22) % 250 - 20; disc(g, tw, 98 + Math.abs(Math.sin(t * 6)) * -3, 3, '#5a3e22'); R(g, tw - 3, 98, 6, 1, '#3a2814'); R(g, tw, 94, 1, 6, '#3a2814');
      R(g, 12, 100, 14, 2, '#d8caa8'); for (let i = 0; i < 4; i++) R(g, 14 + i * 3, 98, 1, 2, '#d8caa8'); disc(g, 8, 99, 2, '#d8caa8');
      dust(g, t, 80, 5, 'rgba(240,200,140,0.5)', 30);
      for (let i = 0; i < 6; i++) { const y = 30 + i * 11, x = ((t * 60 + i * 80) % 300) - 60; R(g, x, y, 40 + i * 6, 1, 'rgba(240,200,140,0.18)'); }
      const fx = (t * 7) % 250 - 25, bob = Math.round(Math.sin(t * 8)); figure(g, fx, 104, '#100c08', bob, true);
      for (let i = 0; i < 5; i++) R(g, fx - 4 - i * 2, 94 + bob + Math.round(Math.sin(t * 6 + i) * 1.2) + i * 0.4, 2, 1, '#8a3a2a'); // scarf in the wind
      R(g, fx - 16, 102, 7, 2, '#100c08'); R(g, fx - 19, 101, 3, 2, '#100c08'); R(g, fx - 15 + Math.round(Math.sin(t * 8)), 104, 1, 1, '#100c08'); R(g, fx - 11 + Math.round(Math.sin(t * 8 + 3)), 104, 1, 1, '#100c08');
    },
    warlords(g, t) {
      sky(g, '#190d1d', '#b24e2e', 70); glow(g, 96, 68, 46, '255,150,70', 0.75);
      for (let i = 0; i < 5; i++) smoke(g, 28 + i * 34, 76, t + i, 7, '40,26,30', 2.4, 1, 0.5);
      for (let i = 0; i < 5; i++) bird(g, ((t * 8 + i * 30) % 230) - 15, 18 + i * 4 + Math.sin(t * 2 + i) * 2, t, '#12080c', i);
      g.fillStyle = '#2b1621'; g.beginPath(); g.moveTo(0, 76); for (let x = 0; x <= W; x += 6) g.lineTo(x, 64 + Math.sin(x * 0.07) * 6 + Math.sin(x * 0.19) * 2); g.lineTo(W, 108); g.lineTo(0, 108); g.fill();
      for (let i = 0; i < 4; i++) { const k = ((t * 0.045 + i * 0.27) % 1), x = k * (W + 30) - 15, y = 66 + Math.sin(x * 0.07) * 6; R(g, x, y - 4, 2, 3, '#0e0709'); R(g, x - 2, y - 1, 6, 2, '#0e0709'); R(g, x - 2, y + 1, 1, 2, '#0e0709'); R(g, x + 3, y + 1, 1, 2, '#0e0709'); R(g, x + 3, y - 9, 1, 8, '#0e0709'); }
      g.fillStyle = '#170b12'; g.beginPath(); g.moveTo(0, 88); for (let x = 0; x <= W; x += 6) g.lineTo(x, 82 + Math.sin(x * 0.11 + 2) * 5); g.lineTo(W, 108); g.lineTo(0, 108); g.fill();
      // the prize
      ray(g, 96, 63, t * 1.2, 90, 0.05, '255,220,150', 0.12); R(g, 84, 66, 24, 11, '#0c0608'); R(g, 90, 61, 12, 6, '#0c0608'); R(g, 98, 55, 2, 6, '#0c0608'); R(g, 93, 69, 3, 3, `rgb(255,${Math.round(180 + 20 * Math.sin(t * 7))},90)`); R(g, 99, 69, 3, 3, '#ffcf80'); R(g, 94, 58, 3, 2, `rgb(255,${Math.round(170 + 30 * Math.sin(t * 5))},80)`);
      const flags = [[20, '#a8432f', 0], [56, '#c79a3a', 1], [136, '#4f7a45', 2], [172, '#5a6fa0', 3], [98, '#7a4a8a', 4]];
      flags.forEach(([x, c, i]) => {
        const by = i === 4 ? 36 : 56 + (i % 2) * 6, base = i === 4 ? 61 : 96 - (i % 2) * 4;
        R(g, x, by, 2, base - by + 4, '#0e0709'); R(g, x - 1, by - 2, 4, 2, '#0e0709');
        for (let k = 0; k < 18; k++) { const wv = Math.sin(t * 5 + k * 0.5 + i) * (1 + k * 0.14); R(g, x + 2 + k, by + 1 + wv, 1, 11 - Math.floor(k / 5), k < 14 ? c : '#12080c'); }
        const em = [[0, 0], [1, 0], [2, 0], [1, 1], [1, 2], [0, 2], [2, 2]][0]; for (let k = 0; k < 4; k++) R(g, x + 6 + (i % 2) * 2, by + 3 + (i + k) % 5, 3, 1, 'rgba(14,7,9,0.7)');
        if (i !== 4) { const y = base; R(g, x - 10, y - 4, 8, 4, '#0e0709'); R(g, x - 8, y - 7, 4, 3, '#0e0709'); R(g, x + 8, y - 3, 7, 3, '#0e0709'); R(g, x + 9, y - 6, 3, 3, '#0e0709'); const f = 0.6 + 0.4 * Math.sin(t * 9 + i * 2); R(g, x + 2, y - 3, 4, 3, '#0e0709'); R(g, x + 3, y - 5, 2, 2 + (f > 0.7 ? 1 : 0), `rgb(255,${Math.round(150 + 50 * f)},60)`); glow(g, x + 4, y - 4, 10, '255,150,60', f * 0.9); sil(g, x + 12, y + 1, '#0e0709'); }
      });
      embers(g, t, 36, 7, 8, 184, 96);
    },
    waystation(g, t) {
      sky(g, '#171126', '#a45c3a', 72); stars(g, t, 50, 17, 36); glow(g, 28, 62, 26, '255,160,90', 0.7); disc(g, 28, 62, 6, '#ffcf90');
      for (let i = 0; i < 3; i++) bird(g, ((t * 6 + i * 50) % 240) - 20, 14 + i * 5, t, '#1a1018', i);
      skyline(g, 31, 70, 8, 26, '#2a1a22', 0, t, '#ffd884', true);
      station(g, t, { x: 8, ground: 74, lit: false, under: true, smoke: true, crows: true });
      // dead tree and windmill pump
      R(g, 6, 50, 2, 24, '#120c0a'); R(g, 3, 52, 4, 1, '#120c0a'); R(g, 7, 55, 5, 1, '#120c0a'); R(g, 4, 58, 3, 1, '#120c0a'); R(g, 1, 50, 3, 1, '#120c0a');
      R(g, 176, 48, 2, 26, '#120c0a'); R(g, 172, 74, 10, 1, '#120c0a'); for (let k = 0; k < 4; k++) { const a = t * 1.5 + k * 1.57; for (let s2 = 1; s2 < 9; s2++) R(g, 177 + Math.cos(a) * s2, 48 + Math.sin(a) * s2, 1, 1, '#120c0a'); }
      dust(g, t, 22, 12, 'rgba(230,190,150,0.32)', 16);
      if (t % 8 < 0.25) for (let i = 0; i < 8; i++) R(g, 66 + 8 + (i * 5) % 28, 8 + 74 - 58 - 1 + (i % 3), 1, 1, '#ffd884');
    },
    letter(g, t) {
      R(g, 0, 0, W, H, '#150e0a'); const f = 0.82 + 0.18 * Math.sin(t * 7) * Math.sin(t * 2.3);
      // window with rain and the odd flash of lightning
      R(g, 128, 8, 52, 38, '#0c1018'); R(g, 130, 10, 48, 34, '#101a26'); const fl = (t % 9) < 0.18 || ((t + 0.3) % 9) < 0.08; if (fl) R(g, 130, 10, 48, 34, '#9ab8d0'); R(g, 152, 8, 2, 38, '#2a1d14'); R(g, 128, 26, 52, 2, '#2a1d14');
      for (let i = 0; i < 24; i++) { const x = 130 + (i * 7 + t * 20) % 48, y = 10 + (i * 13 + t * 90) % 34; R(g, x, y, 1, 3, 'rgba(160,190,220,0.5)'); }
      R(g, 128, 4, 52, 4, '#2a1d14'); R(g, 126, 46, 56, 3, '#3a2a1c');
      glow(g, 40, 24, 74, '255,170,80', f); ray(g, 40, 22, Math.PI / 2 - 0.3, 80, 0.5, '255,200,120', 0.05 * f);
      R(g, 36, 0, 1, 14, '#2a1d14'); R(g, 30, 12, 13, 9, '#e8b25a'); R(g, 32, 14, 9, 5, '#fff0b8'); R(g, 27, 21, 19, 3, '#3a2a1c');
      for (let i = 0; i < 3; i++) moth(g, 38, 20, t, i);
      for (let i = 0; i < 14; i++) { const x = 40 + Math.sin(t * 0.4 + i * 2) * 30 + i * 3, y = 28 + ((t * 3 + i * 7) % 50); R(g, x, y, 1, 1, `rgba(255,220,160,${(0.25 + 0.2 * Math.sin(t + i)).toFixed(2)})`); }
      R(g, 0, 62, W, 46, '#33241a'); for (let y = 66; y < H; y += 7) R(g, 0, y, W, 1, '#2a1c13'); for (let i = 0; i < 14; i++) R(g, (i * 29) % W, 64 + (i * 7) % 40, 8, 1, '#3d2c1f');
      g.save(); g.translate(92, 72); g.rotate(-0.07);
      R(g, -36, -28, 72, 50, '#d8c8a0'); R(g, -36, -28, 72, 2, '#efe3c0'); R(g, -36, 20, 72, 2, '#b4a47c'); R(g, 30, -28, 6, 50, 'rgba(120,100,70,0.2)');
      const r = rnd(33), prog = (t % 14) / 10; for (let line = 0; line < 5; line++) { let x = -30; const maxW = 56 - (line === 4 ? 30 : 0); const lim = Math.min(1, Math.max(0, prog - line * 0.16)) * maxW; while (x < -30 + lim) { const w = 2 + Math.floor(r() * 6); R(g, x, -21 + line * 7, Math.min(w, -30 + lim - x), 1, '#3a2a1c'); x += w + 2; } }
      R(g, -28, 14, 22, 1, '#6a2a1e'); R(g, 14, 8, 14, 6, 'rgba(168,67,47,0.8)'); R(g, 17, 10, 8, 1, 'rgba(255,200,170,0.5)'); g.restore();
      const gl = Math.sin(t * 2) > 0.8;
      for (const [kx, ky] of [[142, 82], [154, 89]]) { R(g, kx, ky, 12, 3, '#c9a24a'); R(g, kx + 10, ky - 2, 5, 7, '#c9a24a'); R(g, kx + 11, ky, 2, 3, '#33241a'); R(g, kx, ky, 12, 1, '#f0d278'); if (gl) R(g, kx + 5, ky - 1, 1, 1, '#fff'); }
      disc(g, 168, 74, 5, '#cfd2d4'); disc(g, 168, 74, 3, '#9aa0a4'); for (const [a, b] of [[167, 73], [169, 73], [167, 75], [169, 75]]) R(g, a, b, 1, 1, '#33241a'); if (Math.sin(t * 1.5) > 0.85) { R(g, 171, 70, 1, 3, '#fff'); R(g, 170, 71, 3, 1, '#fff'); }
      R(g, 20, 84, 26, 16, '#6a4a30'); R(g, 20, 84, 26, 2, '#8a6a48'); R(g, 46, 88, 4, 7, '#6a4a30'); smoke(g, 32, 82, t, 5, '220,210,190', 0.5, 0.4, 0.35);
      R(g, 6, 98, 20, 3, '#c9b484');
    },
    arrival(g, t, o = {}) {
      sky(g, '#090612', '#703c32', 76); stars(g, t, 80, 19, 46); glow(g, 20, 62, 22, '255,150,90', 0.45);
      for (let i = 0; i < 4; i++) bird(g, ((t * 5 + i * 60) % 230) - 15, 12 + i * 5, t, '#14080c', i);
      skyline(g, 41, 74, 6, 22, '#1d1320', 0, t, '#ffd884', true);
      station(g, t, { x: 34, ground: 80, lit: true, smoke: true, crows: true });
      g.fillStyle = '#3a2d26'; g.beginPath(); g.moveTo(0, H); g.lineTo(W * 0.3, H); g.lineTo(96, 80); g.lineTo(90, 80); g.fill();
      g.fillStyle = '#463830'; g.beginPath(); g.moveTo(34, H); g.lineTo(70, H); g.lineTo(101, 80); g.lineTo(92, 80); g.fill();
      for (let i = 0; i < 6; i++) { const k = i / 6; R(g, 96 - 36 * k * 1.4 + 2, 82 + 24 * k, 3 - k * 0, 1, 'rgba(240,220,190,0.35)'); }
      // the gate
      R(g, 88, 70, 3, 12, '#1a130e'); R(g, 103, 70, 3, 12, '#1a130e'); R(g, 88, 69, 18, 2, '#241a12'); const sw = Math.sin(t * 0.8) * 1.5; R(g, 91, 72 + sw * 0.2, 5, 9, '#2b2018'); for (let i = 0; i < 4; i++) R(g, 91, 73 + i * 2, 5, 1, '#3a2b20');
      R(g, 98, 71, 5, 9, '#1a130e'); R(g, 96, 62, 1, 7, '#1a130e'); R(g, 95, 61, 3, 2, '#e8b25a'); moth(g, 96, 62, t, 0); moth(g, 96, 62, t, 1);
      for (let i = 0; i < 6; i++) { const k = ((t * 0.8 + i * 0.37) % 1); R(g, 52 + i * 3 + (i % 2) * 1, 14 + 62 - 14 + k * 8, 1, 1, `rgba(255,220,140,${(1 - k).toFixed(2)})`); }
      dust(g, t, 24, 23, 'rgba(230,190,150,0.28)', 14);
      for (let i = 0; i < 4; i++) R(g, ((t * 70 + i * 90) % 280) - 40, 90 + i * 4, 30 + i * 6, 1, 'rgba(230,190,150,0.12)');
      if (!o.menu) { const bob = Math.round(Math.sin(t * 2) * 0.6); figure(g, 30, 107, '#0b0807', bob, true); for (let i = 0; i < 5; i++) R(g, 28 - i * 2, 99 + bob + Math.round(Math.sin(t * 5 + i) * 1.3), 2, 1, '#6a2a1e'); R(g, 40, 105, 7, 2, '#0b0807'); R(g, 45, 104, 3, 2, '#0b0807'); R(g, 41 + Math.round(Math.sin(t * 3)), 107, 1, 1, '#0b0807'); R(g, 44 + Math.round(Math.sin(t * 3 + 2)), 107, 1, 1, '#0b0807'); }
    },
  };

  const CARDS = [
    { scene: 'oldWorld', title: 'The Old World', text: 'There were lights you never had to tend. Cities that hummed all night, roads that went everywhere, and more people than the ground could feed.' },
    { scene: 'omens', title: 'Nobody Agrees', text: 'Then it ended. The ones who still tell stories disagree on how. Fire from the sky. Visitors from above. Too many mouths and not enough world. The ash does not say.' },
    { scene: 'elite', title: 'The Ones Who Left', text: 'A few had planned for it. They filled a station with the best of everything and climbed out of the world on a column of fire, promising to come back. The station went quiet. Then it went silent.' },
    { scene: 'centuries', title: 'Three Hundred Years', text: 'What was left learned to be small. People drifted between the ruins, trading what they could carry. The old money is dust, except silver buttons. Nobody can copy them. Nobody knows why.' },
    { scene: 'warlords', title: 'The Warlords', text: 'Where roads cross and water runs, someone with enough guns plants a flag. They carve the wastes into territories and fight over the few places left that are safe to sleep: the waystations.' },
    { scene: 'waystation', title: 'A Place at the Crossing', text: 'One sits where two old highways meet, a roadside inn with a bar, rooms, a watchtower and a generator that still turns over. Under it the ground goes deeper than any map. The last keeper never said why.' },
    { scene: 'letter', title: 'The Letter', text: 'A courier found you three days ago. A relative you barely remember had left you the keys, a handful of silver buttons, and a note. It was short. “It is yours now. Keep the lights on.”' },
    { scene: 'arrival', title: 'Under New Management', text: 'The road ends at a sagging sign and a single light. Someone has been keeping it burning. You put your hand on the gate.' },
  ];

  // ---------- title backdrop ----------
  let bgRaf = 0;
  function backdrop(canvas, on) {
    cancelAnimationFrame(bgRaf);
    if (!on || !canvas) return;
    canvas.width = W; canvas.height = H;
    const g = canvas.getContext('2d'); g.imageSmoothingEnabled = false;
    let last = 0; const reduce = (window.__still || matchMedia('(prefers-reduced-motion: reduce)').matches);
    const loop = (ms) => { if (ms - last > (reduce ? 1000 : 83)) { last = ms; SCENES.arrival(g, ms / 1000, { menu: true }); } bgRaf = requestAnimationFrame(loop); };
    bgRaf = requestAnimationFrame(loop);
  }

  // ---------- the player ----------
  function play(done, opts = {}) {
    const root = document.createElement('div');
    root.className = 'cine'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', 'The story so far');
    root.innerHTML = `<div class="cine-frame"><canvas class="cine-art" width="${W}" height="${H}" aria-hidden="true"></canvas><div class="cine-vig"></div></div>
      <div class="cine-copy"><p class="cine-step" aria-hidden="true"></p><h2 class="cine-title"></h2><p class="cine-text" aria-live="polite"></p></div>
      <div class="cine-bar"><button type="button" class="btn ghost small cine-skip">Skip story</button><span class="cine-dots" aria-hidden="true"></span><button type="button" class="btn primary cine-next">Next</button></div>`;
    document.body.appendChild(root);
    const cv = root.querySelector('canvas'), g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
    const titleEl = root.querySelector('.cine-title'), textEl = root.querySelector('.cine-text'), stepEl = root.querySelector('.cine-step'), nextBtn = root.querySelector('.cine-next'), dots = root.querySelector('.cine-dots');
    dots.innerHTML = CARDS.map(() => '<i></i>').join('');
    const reduce = (window.__still || matchMedia('(prefers-reduced-motion: reduce)').matches);
    let i = -1, typed = 0, typer = 0, raf = 0, t0 = performance.now(), cardT = 0, finished = false;
    const frame = (ms) => { SCENES[CARDS[i].scene](g, (ms - t0) / 1000); raf = requestAnimationFrame(frame); };
    function reveal(all) {
      const c = CARDS[i];
      clearInterval(typer);
      if (all || reduce) { typed = c.text.length; textEl.textContent = c.text; nextBtn.textContent = i === CARDS.length - 1 ? 'Enter the waystation' : 'Next'; return; }
      typer = setInterval(() => { typed += 2; textEl.textContent = c.text.slice(0, typed); if (typed >= c.text.length) { clearInterval(typer); typed = c.text.length; } }, 28);
    }
    function show(n) {
      i = n; typed = 0; const c = CARDS[i];
      root.classList.remove('in'); void root.offsetWidth; root.classList.add('in');
      titleEl.textContent = c.title; stepEl.textContent = `${i + 1} of ${CARDS.length}`; textEl.textContent = '';
      [...dots.children].forEach((d, k) => d.classList.toggle('on', k <= i));
      nextBtn.textContent = i === CARDS.length - 1 ? 'Enter the waystation' : 'Next';
      cancelAnimationFrame(raf); raf = requestAnimationFrame(frame); t0 = performance.now();
      reveal(false);
    }
    function advance() {
      if (finished) return;
      if (typed < CARDS[i].text.length) { reveal(true); return; }
      if (i >= CARDS.length - 1) finish(); else show(i + 1);
    }
    function finish() {
      if (finished) return; finished = true;
      clearInterval(typer); cancelAnimationFrame(raf);
      document.removeEventListener('keydown', onKey, true);
      root.classList.add('out'); setTimeout(() => root.remove(), 380);
      done && done();
    }
    function onKey(e) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowRight') { e.preventDefault(); e.stopPropagation(); advance(); }
      else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finish(); }
    }
    document.addEventListener('keydown', onKey, true);
    nextBtn.addEventListener('click', advance);
    root.querySelector('.cine-skip').addEventListener('click', finish);
    root.querySelector('.cine-frame').addEventListener('click', advance);
    root.querySelector('.cine-copy').addEventListener('click', advance);
    show(0); nextBtn.focus({ preventScroll: true });
    return { skip: finish, cards: CARDS.length };
  }

  return { play, backdrop, CARDS, SCENES, W, H };
})();
