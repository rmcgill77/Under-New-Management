// ============================================================================
// Paint: the hand-drawn look. Pre-rendered textures (plaster, concrete, brick,
// planks, dirt, asphalt, tile, corrugated metal), pencil hatching, and shaded
// "drawn" shapes. Shared by the cutaway and the battle view. Textures are
// painted once into small canvases and used as repeating patterns.
// ============================================================================
const Paint = (() => {
  const cache = new Map();
  function rnd(seed) { let a = seed >>> 0 || 1; return () => { a ^= a << 13; a ^= a >>> 17; a ^= a << 5; return ((a >>> 0) % 100000) / 100000; }; }
  function hexToRgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function shade(hex, f) { const [r, g, b] = hexToRgb(hex); const c = (v) => Math.max(0, Math.min(255, Math.round(v * f))); return `rgb(${c(r)},${c(g)},${c(b)})`; }
  function mix(hex, hex2, t) { const a = hexToRgb(hex), b = hexToRgb(hex2); return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',')})`; }

  // Mottled base: soft blotches of lighter and darker paint, then fine speckle.
  function mottle(g, w, h, base, r, amt = 0.12, blots = 40) {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let i = 0; i < blots; i++) {
      const x = r() * w, y = r() * h, rad = 10 + r() * 40;
      const gr = g.createRadialGradient(x, y, 0, x, y, rad);
      const light = r() < 0.5;
      gr.addColorStop(0, light ? `rgba(255,240,215,${amt * r()})` : `rgba(20,12,6,${amt * r()})`);
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    for (let i = 0; i < w * h / 18; i++) { g.fillStyle = r() < 0.5 ? 'rgba(0,0,0,0.07)' : 'rgba(255,245,225,0.06)'; g.fillRect(r() * w, r() * h, 1, 1); }
  }
  function cracks(g, w, h, r, n, color = 'rgba(25,16,10,0.45)') {
    g.strokeStyle = color; g.lineWidth = 0.8;
    for (let i = 0; i < n; i++) {
      let x = r() * w, y = r() * h;
      g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < 5; k++) { x += (r() - 0.5) * 14; y += r() * 10; g.lineTo(x, y); }
      g.stroke();
    }
  }
  const PAINTERS = {
    plaster(g, w, h, r) { mottle(g, w, h, '#8a7058', r, 0.16, 50); cracks(g, w, h, r, 4); for (let i = 0; i < 6; i++) { g.fillStyle = 'rgba(60,40,24,0.08)'; const x = r() * w; g.fillRect(x, r() * h * 0.4, 3 + r() * 6, h); } },
    concrete(g, w, h, r) { mottle(g, w, h, '#5a5b5c', r, 0.14, 45); cracks(g, w, h, r, 3, 'rgba(10,10,12,0.4)'); g.strokeStyle = 'rgba(0,0,0,0.18)'; g.lineWidth = 1; for (let y = 0; y < h; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); } for (let i = 0; i < 30; i++) { g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.arc(r() * w, r() * h, 0.6 + r(), 0, 7); g.fill(); } },
    brick(g, w, h, r) { g.fillStyle = '#3d2a20'; g.fillRect(0, 0, w, h); const bw = 22, bh = 10; for (let y = 0; y < h; y += bh) for (let x = -(y / bh % 2) * bw / 2; x < w; x += bw) { g.fillStyle = mix('#7a4a34', '#5e3626', r()); g.fillRect(x + 1, y + 1, bw - 2, bh - 2); g.fillStyle = 'rgba(255,220,180,0.06)'; g.fillRect(x + 1, y + 1, bw - 2, 2); } for (let i = 0; i < 25; i++) { g.fillStyle = 'rgba(15,8,4,0.18)'; g.fillRect(r() * w, r() * h, 4 + r() * 10, 2 + r() * 5); } },
    planks(g, w, h, r) { const ph = 9; for (let y = 0; y < h; y += ph) { g.fillStyle = mix('#5e4330', '#4a3424', r()); g.fillRect(0, y, w, ph); g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, y + ph - 1, w, 1); for (let k = 0; k < 3; k++) { g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(r() * w, y, 1, ph - 1); } g.strokeStyle = 'rgba(255,230,190,0.05)'; g.beginPath(); g.moveTo(0, y + 3 + r() * 3); g.lineTo(w, y + 3 + r() * 3); g.stroke(); } },
    tile(g, w, h, r) { g.fillStyle = '#9aa29a'; g.fillRect(0, 0, w, h); const s = 12; for (let y = 0; y < h; y += s) for (let x = 0; x < w; x += s) { g.fillStyle = mix('#b3b9ae', '#8e968c', r()); g.fillRect(x + 1, y + 1, s - 2, s - 2); } for (let i = 0; i < 12; i++) { g.fillStyle = 'rgba(80,60,30,0.2)'; g.fillRect(r() * w, r() * h, 6 + r() * 14, 2 + r() * 20); } },
    dirt(g, w, h, r) { mottle(g, w, h, '#3c2c21', r, 0.09, 90); for (let i = 0; i < 60; i++) { g.fillStyle = r() < 0.5 ? 'rgba(20,14,10,0.28)' : 'rgba(120,96,70,0.14)'; g.beginPath(); g.ellipse(r() * w, r() * h, 1 + r() * 4, 1 + r() * 3, r() * 3, 0, 7); g.fill(); } },
    ground(g, w, h, r) { mottle(g, w, h, '#5b4636', r, 0.22, 60); for (let i = 0; i < 70; i++) { g.fillStyle = r() < 0.6 ? 'rgba(30,20,12,0.35)' : 'rgba(170,140,100,0.18)'; g.beginPath(); g.ellipse(r() * w, r() * h, 0.8 + r() * 3, 0.6 + r() * 2, r() * 3, 0, 7); g.fill(); } g.strokeStyle = 'rgba(25,16,10,0.25)'; for (let i = 0; i < 10; i++) { const x = r() * w, y = r() * h; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 6 + r() * 10, y + (r() - 0.5) * 4); g.stroke(); } },
    asphalt(g, w, h, r) { mottle(g, w, h, '#47443f', r, 0.16, 40); cracks(g, w, h, r, 5, 'rgba(15,12,10,0.6)'); for (let i = 0; i < w * h / 10; i++) { g.fillStyle = r() < 0.5 ? 'rgba(0,0,0,0.12)' : 'rgba(200,190,170,0.07)'; g.fillRect(r() * w, r() * h, 1, 1); } },
    metal(g, w, h, r) { for (let x = 0; x < w; x += 6) { g.fillStyle = x % 12 ? '#5c5a55' : '#6c6a63'; g.fillRect(x, 0, 6, h); } for (let i = 0; i < 18; i++) { g.fillStyle = `rgba(${120 + r() * 50},${60 + r() * 20},20,${0.15 + r() * 0.25})`; g.beginPath(); g.ellipse(r() * w, r() * h, 3 + r() * 12, 2 + r() * 8, 0, 0, 7); g.fill(); } },
    paper(g, w, h, r) { mottle(g, w, h, '#e9dcc0', r, 0.08, 20); },
  };
  // A repeating pattern for a texture kind (cached per canvas context).
  function pattern(ctx, kind, size = 128, seed = 1) {
    const key = `${kind}:${size}:${seed}`;
    let c = cache.get(key);
    if (!c) {
      c = document.createElement('canvas'); c.width = c.height = size;
      PAINTERS[kind](c.getContext('2d'), size, size, rnd(seed * 7919 + kind.length));
      cache.set(key, c);
    }
    const pkey = key + ':pat';
    if (!ctx[pkey]) ctx[pkey] = ctx.createPattern(c, 'repeat');
    return ctx[pkey];
  }

  // Pencil hatching inside a rectangle, clipped. Used for shadows and corners.
  function hatch(ctx, x, y, w, h, { spacing = 5, alpha = 0.18, angle = 1, seed = 1, color = '20,12,8', width = 0.8 } = {}) {
    const r = rnd(seed);
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    ctx.strokeStyle = `rgba(${color},${alpha})`; ctx.lineWidth = width;
    ctx.beginPath();
    for (let i = -h; i < w + h; i += spacing) {
      const j = (r() - 0.5) * 1.5;
      ctx.moveTo(x + i + j, y + h); ctx.lineTo(x + i + h * angle + j, y);
    }
    ctx.stroke(); ctx.restore();
  }
  // Soft darkening toward the edges of a rectangle (cheap ambient occlusion).
  function occlude(ctx, x, y, w, h, depth = 18, alpha = 0.45) {
    const sides = [
      { rect: [x, y, w, depth], from: [x, y], to: [x, y + depth] },
      { rect: [x, y + h - depth, w, depth], from: [x, y + h], to: [x, y + h - depth] },
      { rect: [x, y, depth, h], from: [x, y], to: [x + depth, y] },
      { rect: [x + w - depth, y, depth, h], from: [x + w, y], to: [x + w - depth, y] },
    ];
    for (const s of sides) {
      const g = ctx.createLinearGradient(s.from[0], s.from[1], s.to[0], s.to[1]);
      g.addColorStop(0, `rgba(10,6,4,${alpha})`); g.addColorStop(1, 'rgba(10,6,4,0)');
      ctx.fillStyle = g; ctx.fillRect(...s.rect);
    }
  }
  // A drawn box: fill, light top, dark base, then a wobbly pencil outline drawn twice.
  function jit(seed) { let a = (seed * 9301 + 49297) % 233280; return () => { a = (a * 9301 + 49297) % 233280; return a / 233280 - 0.5; }; }
  function wobblyRect(ctx, x, y, w, h, seed, amt = 1.4) {
    const j = jit(seed);
    ctx.beginPath();
    ctx.moveTo(x + j() * amt, y + j() * amt); ctx.lineTo(x + w + j() * amt, y + j() * amt);
    ctx.lineTo(x + w + j() * amt, y + h + j() * amt); ctx.lineTo(x + j() * amt, y + h + j() * amt); ctx.closePath();
  }
  function drawnBox(ctx, x, y, w, h, fill, seed = 1, { ink = '#21180f', line = 1.6, top = true } = {}) {
    ctx.fillStyle = fill; wobblyRect(ctx, x, y, w, h, seed); ctx.fill();
    ctx.save(); wobblyRect(ctx, x, y, w, h, seed); ctx.clip();
    if (top) { ctx.fillStyle = 'rgba(255,235,200,0.16)'; ctx.fillRect(x, y, w, Math.max(2, h * 0.18)); }
    const g = ctx.createLinearGradient(0, y + h * 0.5, 0, y + h);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(10,6,4,0.35)');
    ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
    if (w > 18 && h > 12) hatch(ctx, x + w * 0.7, y, w * 0.3, h, { spacing: 4, alpha: 0.14, seed });
    ctx.restore();
    ctx.strokeStyle = ink; ctx.lineWidth = line; wobblyRect(ctx, x, y, w, h, seed + 3); ctx.stroke();
    ctx.globalAlpha = 0.35; ctx.lineWidth = line * 0.6; wobblyRect(ctx, x + 0.6, y - 0.4, w, h, seed + 7, 2); ctx.stroke(); ctx.globalAlpha = 1;
  }
  // Warm light: a cone from a hanging bulb plus a pool on the floor.
  function lamp(ctx, x, top, floor, width, strength, flicker = 1) {
    const s = strength * flicker;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const cone = ctx.createLinearGradient(0, top, 0, floor);
    cone.addColorStop(0, `rgba(255,186,105,${0.16 * s})`); cone.addColorStop(1, `rgba(255,170,90,${0.02 * s})`);
    ctx.fillStyle = cone;
    ctx.beginPath(); ctx.moveTo(x - 10, top); ctx.lineTo(x + 10, top); ctx.lineTo(x + width / 2, floor); ctx.lineTo(x - width / 2, floor); ctx.closePath(); ctx.fill();
    const wash = ctx.createRadialGradient(x, top + 10, 4, x, top + 10, width * 0.75);
    wash.addColorStop(0, `rgba(255,180,100,${0.12 * s})`); wash.addColorStop(1, 'rgba(255,180,100,0)');
    ctx.fillStyle = wash; ctx.fillRect(x - width * 0.75, top - 10, width * 1.5, floor - top + 10);
    const pool = ctx.createRadialGradient(x, floor, 2, x, floor, width * 0.6);
    pool.addColorStop(0, `rgba(255,190,110,${0.22 * s})`); pool.addColorStop(1, 'rgba(255,190,110,0)');
    ctx.fillStyle = pool; ctx.fillRect(x - width * 0.6, floor - width * 0.3, width * 1.2, width * 0.35);
    const halo = ctx.createRadialGradient(x, top + 4, 1, x, top + 4, 26);
    halo.addColorStop(0, `rgba(255,220,150,${0.8 * s})`); halo.addColorStop(1, 'rgba(255,200,120,0)');
    ctx.fillStyle = halo; ctx.fillRect(x - 26, top - 22, 52, 52);
    ctx.restore();
    ctx.strokeStyle = '#1a130d'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, top - 12); ctx.lineTo(x, top); ctx.stroke();
    ctx.fillStyle = s > 0.05 ? '#ffe1a0' : '#5a5040'; ctx.beginPath(); ctx.arc(x, top + 3, 3.2, 0, 7); ctx.fill();
  }

  // ---------- people ----------
  const SKIN = ['#f1c9a5', '#d9a27a', '#b9774f', '#8d5a3b', '#62402a', '#e6b98f'];
  const COAT = ['#7a4a2e', '#4f6650', '#5b5f73', '#8a6a3a', '#6b3f3f', '#3f5966'];
  const HAIR = ['#2b211a', '#5a3d23', '#a8763e', '#c9b07a', '#7a7a7a', '#8a3b22'];
  const PANTS = ['#3a3229', '#2f3437', '#4a3b2a', '#33302c'];
  // A standing person, feet at (0,0), about 38 units tall. pose: stand | work | bend | sit | drink
  function person(ctx, look, { pose = 'stand', t = 0, seed = 1, facing = 1, sil = null, scale = 1, coatColor = null } = {}) {
    const s = sil;
    const coat = s || coatColor || COAT[look.coat % COAT.length], skin = s || SKIN[look.skin % SKIN.length], hair = s || HAIR[look.hair % HAIR.length];
    const pants = s || PANTS[(look.coat + look.hair) % PANTS.length], ink = s || '#1c140e';
    const breathe = Math.sin(t / 700 + seed) * 0.6;
    const work = pose === 'work' ? Math.sin(t / 220 + seed) : 0;
    const bend = pose === 'bend' ? 7 : 0;
    ctx.save(); ctx.scale(facing * scale, scale);
    // shadow
    if (!s) { ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.beginPath(); ctx.ellipse(0, 0, 9, 2.4, 0, 0, 7); ctx.fill(); }
    // legs and boots
    ctx.fillStyle = pants;
    if (pose === 'sit') { ctx.fillRect(-4, -10, 10, 4); ctx.fillRect(4, -10, 3, 10); }
    else { ctx.fillRect(-4.5, -15, 3.6, 15); ctx.fillRect(0.9, -15, 3.6, 15); }
    ctx.fillStyle = s || '#211812'; ctx.fillRect(-5, -2.5, 4.6, 2.5); ctx.fillRect(0.5, -2.5, 5, 2.5);
    ctx.save(); ctx.translate(0, pose === 'sit' ? 4 : 0); ctx.rotate(bend * 0.04);
    // torso: coat with darker side and collar
    const ty = -30 + breathe * 0.3 + bend * 0.4;
    ctx.fillStyle = coat; ctx.beginPath(); ctx.moveTo(-6, ty + 2); ctx.quadraticCurveTo(-7, ty + 10, -6.5, ty + 17); ctx.lineTo(6.5, ty + 17); ctx.quadraticCurveTo(7, ty + 10, 6, ty + 2); ctx.quadraticCurveTo(0, ty - 1, -6, ty + 2); ctx.fill();
    if (!s) { ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(2.5, ty + 2, 4, 15); ctx.fillStyle = 'rgba(255,230,190,0.12)'; ctx.fillRect(-5.5, ty + 3, 2, 12); ctx.fillStyle = coatColor ? shade(coatColor.startsWith('#') ? coatColor : '#555555', 0.7) : shade(COAT[look.coat % COAT.length], 0.7); ctx.beginPath(); ctx.moveTo(-3, ty + 1); ctx.lineTo(0, ty + 5); ctx.lineTo(3, ty + 1); ctx.fill(); }
    // arms
    ctx.strokeStyle = coat; ctx.lineCap = 'round'; ctx.lineWidth = 3.4;
    const armA = pose === 'work' ? -0.9 + work * 0.5 : pose === 'drink' ? -1.9 : pose === 'bend' ? -0.4 : 0.12 + breathe * 0.02;
    const armB = pose === 'work' ? -0.6 - work * 0.4 : -0.1;
    ctx.beginPath(); ctx.moveTo(4.5, ty + 4); ctx.lineTo(4.5 + Math.sin(-armA) * 11, ty + 4 + Math.cos(armA) * 11); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-4.5, ty + 4); ctx.lineTo(-4.5 + Math.sin(armB) * 10, ty + 4 + Math.cos(armB) * 10); ctx.stroke();
    ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(4.5 + Math.sin(-armA) * 11, ty + 4 + Math.cos(armA) * 11, 1.7, 0, 7); ctx.fill();
    if (pose === 'drink' && !s) { ctx.fillStyle = '#c7b48a'; ctx.fillRect(4.5 + Math.sin(-armA) * 11 - 1.5, ty + 4 + Math.cos(armA) * 11 - 4, 3, 4); }
    // head
    const hy = ty - 5;
    ctx.fillStyle = skin; ctx.beginPath(); ctx.ellipse(0.5, hy, 4.4, 5, 0, 0, 7); ctx.fill();
    if (!s) { ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.ellipse(2.6, hy + 0.5, 2, 4.2, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#1c140e'; ctx.fillRect(2.2, hy - 0.8, 1.2, 1.2); }
    // hair styles: short, long, bun, cap, shaved, wrap
    ctx.fillStyle = hair;
    const style = look.hair % 6;
    if (style === 0) { ctx.beginPath(); ctx.ellipse(0.2, hy - 2.6, 4.7, 3, 0, Math.PI, 0); ctx.fill(); }
    if (style === 1) { ctx.beginPath(); ctx.ellipse(0, hy - 2.4, 4.9, 3.2, 0, Math.PI, 0); ctx.fill(); ctx.fillRect(-4.6, hy - 2.4, 2.6, 8); }
    if (style === 2) { ctx.beginPath(); ctx.ellipse(0.2, hy - 2.6, 4.7, 3, 0, Math.PI, 0); ctx.fill(); ctx.beginPath(); ctx.arc(-3.6, hy - 4, 2.2, 0, 7); ctx.fill(); }
    if (style === 3) { ctx.fillStyle = s || shade(COAT[(look.coat + 2) % COAT.length], 0.8); ctx.beginPath(); ctx.ellipse(0.2, hy - 2.8, 5, 2.8, 0, Math.PI, 0); ctx.fill(); ctx.fillRect(0.5, hy - 3, 6.5, 1.6); }
    if (style === 4) { ctx.beginPath(); ctx.ellipse(0.2, hy - 3.2, 4.2, 1.8, 0, Math.PI, 0); ctx.fill(); }
    if (style === 5) { ctx.fillStyle = s || '#8a6a4a'; ctx.beginPath(); ctx.ellipse(0, hy - 2.4, 5.2, 3.6, 0, Math.PI, 0); ctx.fill(); ctx.fillRect(-5, hy - 2.6, 3, 3); }
    // ink outline of the body for the drawn look
    if (!s) { ctx.strokeStyle = ink; ctx.lineWidth = 0.7; ctx.globalAlpha = 0.65; ctx.beginPath(); ctx.ellipse(0.5, hy, 4.4, 5, 0, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-6, ty + 2); ctx.quadraticCurveTo(-7, ty + 10, -6.5, ty + 17); ctx.lineTo(6.5, ty + 17); ctx.quadraticCurveTo(7, ty + 10, 6, ty + 2); ctx.stroke(); ctx.globalAlpha = 1; }
    ctx.restore();
    ctx.restore();
  }

  return { pattern, hatch, occlude, drawnBox, wobblyRect, lamp, person, shade, mix, rnd, SKIN, COAT, HAIR };
})();
