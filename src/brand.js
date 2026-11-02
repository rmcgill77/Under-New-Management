// ============================================================================
// Brand: the app icon (three concepts to choose from), the Burnt Pixel Studios
// splash, and the runtime favicon. Everything is drawn in code on a pixel grid.
// ============================================================================
const Brand = (() => {
  const ICON_PICK = 'C';     // the concept the build uses until one is approved
  const hex = (c) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
  const mix = (a, b, t) => { const x = hex(a), y = hex(b); return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * t)).join(',')})`; };
  const R = (g, x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
  const disc = (g, cx, cy, r, c) => { g.fillStyle = c; for (let y = -r; y <= r; y++) { const w = Math.floor(Math.sqrt(r * r - y * y + 0.25)); g.fillRect(cx - w, cy + y, w * 2 + 1, 1); } };
  const glow = (g, cx, cy, r, rgb, a) => { for (let i = r; i > 0; i -= 1) { g.fillStyle = `rgba(${rgb},${(a * (1 - i / r) * 0.35).toFixed(3)})`; for (let y = -i; y <= i; y++) { const w = Math.floor(Math.sqrt(i * i - y * y)); g.fillRect(cx - w, cy + y, w * 2 + 1, 1); } } };
  const rnd = (seed) => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

  // ---------- flame, shared by icons and the splash ----------
  function flame(g, cx, base, h, t = 0) {
    // a pixel teardrop built from stacked rows; t makes it lick
    const rows = h, sway = Math.round(Math.sin(t * 7) * 0.8 + Math.sin(t * 13) * 0.5);
    for (let i = 0; i < rows; i++) {
      const k = i / rows, y = base - i;
      const w = Math.max(1, Math.round((k < 0.25 ? 0.55 + k * 1.6 : 1 - (k - 0.25) * 1.25) * h * 0.32));
      const lean = Math.round(k * k * sway * 2);
      R(g, cx - w + lean, y, w * 2, 1, k > 0.78 ? '#f28a2e' : '#e0602a');
      if (w > 2) R(g, cx - w + 1 + lean, y, w * 2 - 2, 1, k > 0.6 ? '#ffb347' : '#f58b2f');
      if (w > 3 && k < 0.7) R(g, cx - w + 2 + lean, y, w * 2 - 4, 1, k < 0.2 ? '#fff0b0' : '#ffd070');
    }
  }

  // ---------- three icon concepts, each on a 64 x 64 grid ----------
  const ICONS = {
    // A: the waystation at dusk, sign lit, one window glowing, road leading to the door
    A(g) {
      for (let y = 0; y < 64; y++) R(g, 0, y, 64, 1, mix('#120c20', '#a05430', Math.pow(y / 46, 1.6) * (y < 46 ? 1 : 0) + (y >= 46 ? 1 : 0)));
      const r = rnd(5); for (let i = 0; i < 16; i++) R(g, Math.floor(r() * 64), Math.floor(r() * 20), 1, 1, 'rgba(255,240,210,0.8)');
      glow(g, 32, 12, 18, '255,150,60', 1);
      R(g, 0, 46, 64, 18, '#241a13'); R(g, 0, 46, 64, 1, '#3a2d22');
      g.fillStyle = '#4a382c'; g.beginPath(); g.moveTo(26, 64); g.lineTo(38, 64); g.lineTo(34, 46); g.lineTo(30, 46); g.fill();
      R(g, 31, 56, 2, 1, '#8a7258'); R(g, 31, 51, 2, 1, '#8a7258');
      R(g, 14, 30, 36, 17, '#3a2b20'); R(g, 14, 30, 36, 1, '#5a4535');
      g.fillStyle = '#1c140f'; g.beginPath(); g.moveTo(11, 30); g.lineTo(32, 19); g.lineTo(53, 30); g.closePath(); g.fill();
      R(g, 22, 12, 2, 12, '#120d09'); R(g, 40, 12, 2, 12, '#120d09');
      R(g, 17, 3, 30, 11, '#120d09'); R(g, 18, 4, 28, 9, '#c8702a'); R(g, 19, 5, 26, 7, '#f0a04a');
      for (let i = 0; i < 6; i++) R(g, 21 + i * 4, 7, 3, 3, '#fff0c0');
      R(g, 18, 35, 8, 6, '#ffd070'); R(g, 38, 35, 8, 6, '#2a1d14'); R(g, 21, 35, 1, 6, '#8a5a1e'); R(g, 18, 38, 8, 1, '#8a5a1e');
      glow(g, 22, 38, 10, '255,200,100', 0.8); R(g, 29, 38, 6, 9, '#17100c');
      R(g, 52, 32, 1, 15, '#120d09'); R(g, 50, 31, 5, 2, '#ffd070'); glow(g, 52, 32, 7, '255,200,100', 0.9);
    },
    // B: the pilot light, one flame in a dark doorway under a gable
    B(g) {
      for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x += 1) { /* radial vignette painted in bands */ }
      R(g, 0, 0, 64, 64, '#160d09'); glow(g, 32, 38, 34, '255,140,50', 1); glow(g, 32, 38, 20, '255,170,70', 1);
      R(g, 6, 50, 52, 14, '#0e0907'); R(g, 6, 50, 52, 1, '#3a2b20');
      g.fillStyle = '#0e0907'; g.beginPath(); g.moveTo(6, 22); g.lineTo(32, 6); g.lineTo(58, 22); g.lineTo(58, 64); g.lineTo(6, 64); g.closePath(); g.fill();
      g.strokeStyle = '#4a3322'; g.lineWidth = 1; g.beginPath(); g.moveTo(6.5, 22.5); g.lineTo(32, 6.5); g.lineTo(57.5, 22.5); g.stroke();
      R(g, 17, 26, 30, 30, '#1c110b'); R(g, 18, 27, 28, 29, '#2a1810'); glow(g, 32, 46, 14, '255,160,60', 1);
      flame(g, 32, 53, 24, 0.4);
      R(g, 30, 53, 5, 2, '#7a4a28'); R(g, 28, 55, 9, 1, '#5a3620');
      const r = rnd(8); for (let i = 0; i < 7; i++) R(g, 24 + Math.floor(r() * 17), 22 + Math.floor(r() * 14), 1, 1, 'rgba(255,200,110,0.9)');
    },
    // C: a roadside warning sign: a diamond, a little waystation and a flame
    C(g) {
      for (let y = 0; y < 64; y++) R(g, 0, y, 64, 1, mix('#1e1510', '#0e0907', y / 64));
      const r = rnd(3); for (let i = 0; i < 12; i++) R(g, Math.floor(r() * 64), Math.floor(r() * 64), 1, 1, 'rgba(255,230,190,0.25)');
      const d = (cx, cy, rad, c) => { g.fillStyle = c; for (let y = -rad; y <= rad; y++) g.fillRect(cx - (rad - Math.abs(y)), cy + y, (rad - Math.abs(y)) * 2 + 1, 1); };
      R(g, 31, 52, 3, 12, '#3a2b20'); d(33, 33, 28, '#120d09'); d(32, 32, 27, '#d8a43a'); d(32, 32, 24, '#120d09'); d(32, 32, 23, '#2b1a10');
      glow(g, 32, 34, 16, '255,150,60', 1);
      R(g, 22, 33, 20, 12, '#120d09'); g.fillStyle = '#120d09'; g.beginPath(); g.moveTo(20, 33); g.lineTo(32, 25); g.lineTo(44, 33); g.closePath(); g.fill();
      R(g, 25, 36, 4, 4, '#ffd070'); R(g, 35, 36, 4, 4, '#ffd070'); R(g, 30, 39, 4, 6, '#3a2418');
      flame(g, 32, 24, 12, 0.7);
    },
  };
  function icon(variant = ICON_PICK, size = 512, maskable = false) {
    const c64 = document.createElement('canvas'); c64.width = c64.height = 64;
    const g = c64.getContext('2d'); g.imageSmoothingEnabled = false; ICONS[variant](g);
    const out = document.createElement('canvas'); out.width = out.height = size;
    const o = out.getContext('2d'); o.imageSmoothingEnabled = false;
    if (maskable) { o.fillStyle = mix('#120d09', '#120d09', 0); o.fillRect(0, 0, size, size); const pad = size * 0.1; o.drawImage(c64, pad, pad, size - pad * 2, size - pad * 2); }
    else o.drawImage(c64, 0, 0, size, size);
    return out;
  }
  function setFavicon(variant = ICON_PICK) {
    try {
      const href = icon(variant, 64).toDataURL('image/png');
      for (const rel of ['icon', 'apple-touch-icon']) {
        let l = document.querySelector(`link[rel="${rel}"]`);
        if (!l) { l = document.createElement('link'); l.rel = rel; document.head.appendChild(l); }
        l.href = rel === 'icon' ? href : icon(variant, 180).toDataURL('image/png');
      }
    } catch (e) { /* no canvas export */ }
  }

  // ---------- Burnt Pixel Studios: pixel wordmark and mark ----------
  const FONT = {
    B: ['1111.', '1...1', '1...1', '1111.', '1...1', '1...1', '1111.'], U: ['1...1', '1...1', '1...1', '1...1', '1...1', '1...1', '.111.'],
    R: ['1111.', '1...1', '1...1', '1111.', '1.1..', '1..1.', '1...1'], N: ['1...1', '11..1', '1.1.1', '1..11', '1...1', '1...1', '1...1'],
    T: ['11111', '..1..', '..1..', '..1..', '..1..', '..1..', '..1..'], P: ['1111.', '1...1', '1...1', '1111.', '1....', '1....', '1....'],
    I: ['.111.', '..1..', '..1..', '..1..', '..1..', '..1..', '.111.'], X: ['1...1', '1...1', '.1.1.', '..1..', '.1.1.', '1...1', '1...1'],
    E: ['11111', '1....', '1....', '1111.', '1....', '1....', '11111'], L: ['1....', '1....', '1....', '1....', '1....', '1....', '11111'],
    S: ['.1111', '1....', '1....', '.111.', '....1', '....1', '1111.'], D: ['1111.', '1...1', '1...1', '1...1', '1...1', '1...1', '1111.'],
    O: ['.111.', '1...1', '1...1', '1...1', '1...1', '1...1', '.111.'], ' ': ['.....', '.....', '.....', '.....', '.....', '.....', '.....'],
  };
  function text(g, str, x, y, color, reveal = 1, t = 0) {
    // draws str with 5x7 letters, 1px apart; reveal 0..1 lights letters left to right with a hot edge
    const n = str.length;
    for (let i = 0; i < n; i++) {
      const glyph = FONT[str[i]]; if (!glyph) continue;
      const k = reveal * (n + 1) - i; if (k <= 0) continue;
      const hot = k < 1 ? 1 - k : 0;
      for (let row = 0; row < 7; row++) for (let col = 0; col < 5; col++) if (glyph[row][col] === '1') {
        const flick = hot > 0 && Math.sin(t * 40 + i * 3 + row + col * 2) > 0 ? 0 : 1;
        R(g, x + i * 6 + col, y + row, 1, 1, hot > 0.5 ? '#ffd070' : hot > 0 ? '#f0a04a' : color);
        if (!flick) R(g, x + i * 6 + col, y + row, 1, 1, '#ffe9a8');
      }
    }
  }
  const textWidth = (s) => s.length * 6 - 1;
  const W = 160, H = 90;
  function logo(g, t) {
    // t in seconds since the splash began
    R(g, 0, 0, W, H, '#0b0706');
    for (let y = 0; y < H; y++) if (y % 2 === 0) R(g, 0, y, W, 1, 'rgba(255,255,255,0.012)');
    const cx = 80, my = 14, S = 4, N = 5; // the mark: a 5x5 block of pixels, one by one catching light
    const ign = Math.min(1, Math.max(0, (t - 0.3) / 1.2)), glowK = Math.min(1, t / 1.4);
    glow(g, cx, my + 10, 26, '255,130,40', 0.55 * glowK);
    const r = rnd(12);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const order = (i + j) / (N * 2 - 2), on = ign * 1.25 - order;
      const x = cx - (N * S) / 2 + i * S, y = my + 4 + j * S;
      // the top-right corner has burned away to ash
      const burnt = (i >= 3 && j <= 1) || (i === 4 && j === 2) || (i === 2 && j === 0);
      if (on <= 0) { R(g, x, y, S - 1, S - 1, '#241a14'); continue; }
      if (burnt) { R(g, x, y, S - 1, S - 1, on > 0.4 ? (r() < 0.5 ? '#16100c' : '#1e1510') : '#241a14'); if (on > 0.4 && (i + j) % 2 === 0) R(g, x + 1, y + 1, 1, 1, `rgba(255,140,50,${(0.5 + 0.5 * Math.sin(t * 6 + i * 2 + j)).toFixed(2)})`); continue; }
      const heat = Math.min(1, on * 2);
      R(g, x, y, S - 1, S - 1, mix('#6a2a14', '#e8742a', heat)); R(g, x, y, S - 1, 1, mix('#8a3a1a', '#ffb347', heat)); R(g, x, y + S - 2, S - 1, 1, mix('#3a1a0e', '#a8421e', heat));
    }
    if (t > 0.9) { const fl = Math.min(1, (t - 0.9) / 0.6); for (let k = 0; k < 3; k++) flame(g, cx + 2 + k * 3 - 3, my + 3 - k, Math.round((9 + k * 3) * fl), t + k); }
    if (t > 0.9) for (let i = 0; i < 22; i++) { const sp = 0.35 + (i % 5) * 0.12, k = (t * sp + i * 0.137) % 1, x = cx - 8 + ((i * 53) % 17) + Math.sin(t * 2 + i) * 3, y = my + 6 - k * 26; R(g, x, y, 1, 1, `rgba(255,${160 + (i % 4) * 20},70,${(1 - k).toFixed(2)})`); }
    const a = Math.min(1, Math.max(0, (t - 1.5) / 1.1)), b = Math.min(1, Math.max(0, (t - 2.1) / 0.9));
    text(g, 'BURNT PIXEL', Math.round(80 - textWidth('BURNT PIXEL') / 2), 52, '#f3e4c4', a, t);
    text(g, 'STUDIOS', Math.round(80 - textWidth('STUDIOS') / 2), 64, '#d88a3a', b, t);
    if (t > 3.0) R(g, 60, 76, Math.min(40, (t - 3.0) * 60), 1, 'rgba(216,138,58,0.5)');
  }

  function splash(done) {
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const root = document.createElement('div');
    root.className = 'splash'; root.setAttribute('role', 'img'); root.setAttribute('aria-label', 'Burnt Pixel Studios');
    root.innerHTML = '<canvas width="160" height="90" aria-hidden="true"></canvas><p class="splash-skip" aria-hidden="true">tap to continue</p>';
    document.body.appendChild(root);
    const cv = root.firstChild, g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
    const t0 = performance.now(), LEN = reduce ? 1.4 : 4.1; let raf = 0, over = false;
    function finish() {
      if (over) return; over = true; cancelAnimationFrame(raf);
      document.removeEventListener('keydown', finish, true);
      root.classList.add('out'); setTimeout(() => root.remove(), 520); done && done();
    }
    const frame = (ms) => { const t = reduce ? 3.4 : (ms - t0) / 1000; logo(g, t); if (t >= LEN) finish(); else raf = requestAnimationFrame(frame); };
    raf = requestAnimationFrame(frame);
    root.addEventListener('pointerdown', finish); document.addEventListener('keydown', finish, true);
    setTimeout(() => { root.querySelector('.splash-skip').classList.add('on'); }, 900);
    return { skip: finish };
  }

  return { icon, setFavicon, splash, logo, ICONS, ICON_PICK, W, H };
})();
