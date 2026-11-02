// ============================================================================
// Cutaway renderer (Canvas 2D). Draws state, reports taps. No game rules here.
// Layers, back to front: sky (fixed) · far skyline · mid junk · earth + rooms ·
// foreground rubble, with parallax on the back layers and phase lighting.
// ============================================================================
const Scene = (() => {
  const CELL = 150, SURF_H = 150, UND_H = 118, GROUND = 330, PAD = 16;
  const FONT_SIGN = '600 13px "Big Shoulders Stencil Text", "Arial Narrow", sans-serif';
  const FONT_SMALL = '600 11px "Alegreya Sans", system-ui, sans-serif';
  const PARALLAX = { far: 0.22, mid: 0.55, fore: 1.12 };
  const LIGHT = {
    morning: { top: '#9cb1b2', bottom: '#e6c99a', shade: 0, lamp: 0.25, far: '#8b8b7c', sun: { x: 0.18, y: 0.32, c: '#fff1c9' } },
    midday: { top: '#86a9b6', bottom: '#dccaa0', shade: 0, lamp: 0.12, far: '#9b947d', sun: { x: 0.5, y: 0.12, c: '#fff8e2' } },
    evening: { top: '#3f3a58', bottom: '#cf7d4c', shade: 0.28, lamp: 0.8, far: '#5b4646', sun: { x: 0.86, y: 0.42, c: '#ffb070' } },
    night: { top: '#0b1220', bottom: '#202d45', shade: 0.6, lamp: 1, far: '#1a2131', sun: { x: 0.78, y: 0.18, c: '#dfe6f2', moon: true } },
  };
  const SKIN = ['#f1c9a5', '#d9a27a', '#b9774f', '#8d5a3b', '#62402a', '#e6b98f'];
  const COAT = ['#7a4a2e', '#4f6650', '#5b5f73', '#8a6a3a', '#6b3f3f', '#3f5966'];
  const HAIR = ['#2b211a', '#5a3d23', '#a8763e', '#c9b07a', '#7a7a7a', '#8a3b22'];

  function roomRect(room, w) {
    const x = room.col * CELL;
    if (room.row === 0) return { x, y: GROUND - SURF_H, w: w * CELL, h: SURF_H };
    return { x, y: GROUND + PAD + (room.row - 1) * UND_H, w: w * CELL, h: UND_H };
  }
  function slotRect(row, col) { return roomRect({ row, col }, 1); }
  const world = () => ({ w: UNM.COLS * CELL, h: GROUND + PAD + UNM.MAX_UNDER * UND_H + 70 });

  // Seeded jitter so hand-drawn lines wobble the same way every frame.
  function jit(seed) { let a = seed * 9301 + 49297; return () => { a = (a * 9301 + 49297) % 233280; return a / 233280 - 0.5; }; }
  function roughRect(ctx, x, y, w, h, seed, amt = 2.2) {
    const j = jit(seed);
    ctx.beginPath();
    ctx.moveTo(x + j() * amt, y + j() * amt);
    ctx.lineTo(x + w + j() * amt, y + j() * amt);
    ctx.lineTo(x + w + j() * amt, y + h + j() * amt);
    ctx.lineTo(x + j() * amt, y + h + j() * amt);
    ctx.closePath();
  }
  function roughLine(ctx, x1, y1, x2, y2, seed, amt = 1.6) {
    const j = jit(seed);
    const mx = (x1 + x2) / 2 + j() * amt * 2, my = (y1 + y2) / 2 + j() * amt * 2;
    ctx.beginPath(); ctx.moveTo(x1 + j() * amt, y1 + j() * amt); ctx.quadraticCurveTo(mx, my, x2 + j() * amt, y2 + j() * amt); ctx.stroke();
  }
  function hash(str) { let h = 7; for (const ch of String(str)) h = (h * 31 + ch.charCodeAt(0)) % 100003; return h; }

  function create(canvas, { onTap }) {
    const screenCtx = canvas.getContext('2d');
    let ctx = screenCtx; // swapped to an offscreen context while painting cached sprites
    const sprites = new Map();
    const SPRITE_RES = Art.PX; // pixels per world unit in cached sprites: the game's pixel grid
    let dpr = 1, vw = 1, vh = 1;
    let cam = { x: 0, y: 0, scale: 1 };
    let state = null, selected = null, highlight = [];
    let grain = null, t0 = performance.now();
    let userMoved = false;

    let grainC = null;
    function grainCanvas() { if (!grainC) makeGrain(); return grainC; }
    function makeGrain() {
      const g = document.createElement('canvas'); grainC = g;
      g.width = g.height = 160;
      const gx = g.getContext('2d');
      const img = gx.createImageData(160, 160);
      let a = 12345;
      for (let i = 0; i < img.data.length; i += 4) {
        a = (a * 1103515245 + 12345) & 0x7fffffff;
        const v = (a >> 16) & 255;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
        img.data[i + 3] = 13;
      }
      gx.putImageData(img, 0, 0);
      return ctx.createPattern(g, 'repeat');
    }

    function resize() {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      vw = Math.max(1, rect.width); vh = Math.max(1, rect.height);
      canvas.width = Math.round(vw * dpr); canvas.height = Math.round(vh * dpr);
      if (!userMoved) fit(); else clamp();
    }

    function visibleBottom() { return GROUND + PAD + Math.min(UNM.MAX_UNDER, (state ? state.dug : 2) + 1) * UND_H + 30; }
    function fit() {
      const W = world();
      const top = GROUND - SURF_H - 130;
      const h = visibleBottom() - top;
      let scale = Math.min(vh * 0.94 / h, vw * 0.98 / W.w);
      if (vw < 700) scale = Math.min(vh * 0.72 / h, 0.62); // phones: readable rooms, pan sideways
      scale = Math.max(0.28, Math.min(1.25, scale));
      const cx = W.w * scale <= vw ? (vw - W.w * scale) / 2 : vw / 2 - 2.6 * CELL * scale;
      cam = { scale, x: cx, y: (vh - h * scale) / 2 - top * scale };
      clamp();
    }
    function clamp() {
      const W = world();
      cam.scale = Math.max(0.25, Math.min(2.2, cam.scale));
      const s = cam.scale, top = GROUND - SURF_H - 190, bottom = visibleBottom();
      const ww = W.w * s, mx = vw * 0.3, my = vh * 0.25;
      cam.x = ww <= vw - 2 * mx ? (vw - ww) / 2 : Math.min(mx, Math.max(vw - ww - mx, cam.x));
      const ch = (bottom - top) * s;
      cam.y = ch <= vh - 2 * my ? (vh - ch) / 2 - top * s : Math.min(my - top * s, Math.max(vh - my - bottom * s, cam.y));
    }

    // ---------- input ----------
    const pointers = new Map();
    let moved = false, pinch = null, downAt = null;
    const local = (e) => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    canvas.addEventListener('pointerdown', (e) => {
      canvas.setPointerCapture?.(e.pointerId);
      pointers.set(e.pointerId, local(e)); moved = false; downAt = local(e);
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, cam: { ...cam }, mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
      }
    });
    canvas.addEventListener('pointermove', (e) => {
      const prev = pointers.get(e.pointerId);
      if (!prev) return;
      const p = local(e); pointers.set(e.pointerId, p);
      if (pointers.size === 1) {
        if (Math.hypot(p.x - downAt.x, p.y - downAt.y) > 6) moved = true;
        if (moved) { cam.x += p.x - prev.x; cam.y += p.y - prev.y; userMoved = true; clamp(); }
      } else if (pinch) {
        moved = true; userMoved = true;
        const [a, b] = [...pointers.values()];
        zoomAt(pinch.mid, pinch.cam.scale * (Math.hypot(a.x - b.x, a.y - b.y) / pinch.d), pinch.cam);
      }
    });
    const up = (e) => {
      const had = pointers.has(e.pointerId);
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinch = null;
      if (had && !moved && pointers.size === 0 && e.type === 'pointerup') tap(local(e));
    };
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('wheel', (e) => { e.preventDefault(); userMoved = true; zoomAt(local(e), cam.scale * Math.exp(-e.deltaY * 0.0015), cam); }, { passive: false });
    function zoomAt(p, s, from) {
      const ns = Math.max(0.25, Math.min(2.2, s));
      const wx = (p.x - from.x) / from.scale, wy = (p.y - from.y) / from.scale;
      cam = { scale: ns, x: p.x - wx * ns, y: p.y - wy * ns };
      clamp();
    }
    function tap(p) {
      if (!state) return;
      const wx = (p.x - cam.x) / cam.scale, wy = (p.y - cam.y) / cam.scale;
      for (const room of state.rooms) {
        const r = roomRect(room, UNM.ROOM_TYPES[room.type].w);
        if (wx >= r.x && wx <= r.x + r.w && wy >= r.y && wy <= r.y + r.h) return onTap({ kind: 'room', id: room.id });
      }
      for (let row = 0; row <= state.dug; row++) {
        for (let col = 0; col < UNM.COLS; col++) {
          const r = slotRect(row, col);
          if (wx >= r.x && wx <= r.x + r.w && wy >= r.y && wy <= r.y + r.h && !UNM.roomAt(state, row, col)) return onTap({ kind: 'slot', row, col });
        }
      }
      if (state.dug < UNM.MAX_UNDER) {
        const r = slotRect(state.dug + 1, 0);
        if (wy >= r.y && wy <= r.y + r.h && wx >= 0 && wx <= world().w) return onTap({ kind: 'dig' });
      }
      onTap({ kind: 'none' });
    }

    // ---------- drawing ----------
    // ---------- sky and distance: chunky pixel layers, cached per time of day ----------
    const SKYPX = 0.5; // the backdrop is drawn at half the game's pixel density: big soft pixels
    const PH_COL = {
      morning: { cl: '#f3e4cc', cs: '#c9a59a', ch: '#fff6e6', far1: '#9a9488', far2: '#7c766c', city: '#6a665e', mid: '#5b4a3c', haze: 'rgba(240,215,180,0.35)' },
      midday: { cl: '#f6f2ea', cs: '#b8bcc0', ch: '#ffffff', far1: '#a89e86', far2: '#8a806a', city: '#787060', mid: '#5b4a3c', haze: 'rgba(230,220,190,0.3)' },
      evening: { cl: '#e8a070', cs: '#7a4a5a', ch: '#ffd0a0', far1: '#6a4a52', far2: '#4e3640', city: '#3a2a32', mid: '#3b2c2c', haze: 'rgba(220,120,80,0.28)' },
      night: { cl: '#3a4660', cs: '#1e2638', ch: '#56688a', far1: '#1c2436', far2: '#141a28', city: '#10141e', mid: '#121826', haze: 'rgba(40,60,90,0.25)' },
    };
    const lowCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w * SKYPX)); c.height = Math.max(1, Math.round(h * SKYPX)); const g = c.getContext('2d'); g.scale(SKYPX, SKYPX); return [c, g]; };
    // A pixel cumulus: lumpy top lit by the sun, flat shaded base.
    function cloudSprite(phase, k) {
      const key = `cloud|${phase}|${k}`;
      let c = sprites.get(key);
      if (c) return c;
      const P = PH_COL[phase] || PH_COL.morning, w = 220 + (k % 3) * 80, h = 90;
      let g; [c, g] = lowCanvas(w, h);
      let sd = k * 977 + 13; const rnd = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
      const puffs = [];
      for (let i = 0; i < 9; i++) { const x = 30 + rnd() * (w - 60), rr = 16 + rnd() * 26 * (1 - Math.abs(x / w - 0.5)); puffs.push([x, h - 22 - rr * 0.5 - rnd() * 8, rr]); }
      const lo = Math.min(...puffs.map(([x, , rr]) => x - rr * 0.6)), hi2 = Math.max(...puffs.map(([x, , rr]) => x + rr * 0.6));
      const blob = (dx, dy, col) => { g.fillStyle = col; g.beginPath(); for (const [x, y, rr] of puffs) { g.moveTo(x + rr + dx, y + dy); g.arc(x + dx, y + dy, rr, 0, 7); } g.fill(); g.beginPath(); g.roundRect(lo + dx, h - 32 + dy, hi2 - lo, 12, 6); g.fill(); };
      blob(0, 2, P.cs);
      g.save(); g.beginPath(); g.rect(0, 0, w, h - 26); g.clip(); blob(0, -3, P.cl); g.restore();
      g.save(); g.beginPath(); g.rect(0, 0, w, h - 40); g.clip(); blob(-3, -7, P.ch); g.restore();
      g.globalCompositeOperation = 'destination-out'; g.fillRect(0, h - 18, w, 18);
      Art.quantize(c, 6);
      sprites.set(key, c);
      return c;
    }
    function drawSky(L, time) {
      const phase = state.phase, P = PH_COL[phase] || PH_COL.morning;
      const g = ctx.createLinearGradient(0, 0, 0, vh);
      g.addColorStop(0, L.top); g.addColorStop(0.65, L.bottom); g.addColorStop(1, L.bottom);
      ctx.fillStyle = g; ctx.fillRect(0, 0, vw, vh);
      const sx = L.sun.x * vw, sy = L.sun.y * vh;
      const halo = ctx.createRadialGradient(sx, sy, 2, sx, sy, L.sun.moon ? 70 : 160);
      halo.addColorStop(0, L.sun.c); halo.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.globalAlpha = L.sun.moon ? 0.35 : 0.5; ctx.fillStyle = halo; ctx.fillRect(sx - 170, sy - 170, 340, 340); ctx.globalAlpha = 1;
      if (L.sun.moon) {
        ctx.fillStyle = '#dfe6f2';
        for (let i = 0; i < 90; i++) { const x = (i * 97 + i * i * 13) % vw, y = (i * 53 + i * i * 7) % (vh * 0.55); ctx.globalAlpha = 0.25 + 0.5 * Math.abs(Math.sin(time / 900 + i)); const s2 = i % 7 === 0 ? 3 : 2; ctx.fillRect(Math.round(x), Math.round(y), s2, s2); }
        ctx.globalAlpha = 1;
      }
      // a blocky pixel sun or moon
      const R0 = L.sun.moon ? 14 : 22;
      ctx.fillStyle = L.sun.c;
      for (let yy = -R0; yy <= R0; yy += 3) { const half = Math.floor(Math.sqrt(R0 * R0 - yy * yy) / 3) * 3; ctx.fillRect(Math.round(sx - half), Math.round(sy + yy), half * 2, 3); }
      if (L.sun.moon) { ctx.fillStyle = L.top; for (let yy = -12; yy <= 12; yy += 3) { const half = Math.floor(Math.sqrt(144 - yy * yy) / 3) * 3; ctx.fillRect(Math.round(sx + 7 - half), Math.round(sy - 4 + yy), half * 2, 3); } }
      // two decks of drifting clouds, the near one faster
      ctx.imageSmoothingEnabled = false;
      for (let i = 0; i < 5; i++) {
        const near = i % 2, spr = cloudSprite(phase, i), cw = spr.width / SKYPX * (near ? 1 : 0.7), chh = spr.height / SKYPX * (near ? 1 : 0.7);
        const speed = near ? 0.012 : 0.006, span = vw + cw + 200;
        const x = ((i * 410 + time * speed) % span + span) % span - cw - 100, y = vh * (near ? 0.1 + (i % 3) * 0.08 : 0.04 + (i % 3) * 0.05);
        ctx.globalAlpha = phase === 'night' ? 0.55 : near ? 0.95 : 0.7;
        ctx.drawImage(spr, Math.round(x), Math.round(y), cw, chh);
      }
      ctx.globalAlpha = 1; ctx.imageSmoothingEnabled = true;
      // birds in daylight: a loose flock crossing now and then
      if (!L.sun.moon) {
        const t2 = (time / 26000) % 1;
        if (t2 < 0.45) { ctx.fillStyle = 'rgba(40,30,30,0.6)'; for (let k = 0; k < 5; k++) { const bx = (t2 / 0.45) * (vw + 200) - 100 + k * 18 - (k % 2) * 8, by = vh * 0.18 + k * 6 + Math.sin(time / 300 + k) * 3, f = Math.sin(time / 120 + k) > 0; ctx.fillRect(bx - 4, by + (f ? -2 : 0), 3, 2); ctx.fillRect(bx - 1, by, 2, 2); ctx.fillRect(bx + 1, by + (f ? -2 : 0), 3, 2); } }
      }
    }
    function layerTransform(p) {
      const W = world();
      const fitX = (vw - W.w * cam.scale) / 2;
      ctx.setTransform(dpr * cam.scale, 0, 0, dpr * cam.scale, dpr * (fitX + (cam.x - fitX) * p), dpr * cam.y);
    }
    // Far: two ranges of mesas fading into haze, and a dead city on the skyline.
    function paintFar(phase, W) {
      const P = PH_COL[phase] || PH_COL.morning, base = GROUND - 30, x0 = -1400, w = W.w + 2800, top = base - 260;
      const [c, g] = lowCanvas(w, 300 + 40);
      g.translate(-x0, -top);
      let sd = 4242; const rnd = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
      const ridge = (col, y0, amp, step, flat) => {
        g.fillStyle = col; g.beginPath(); g.moveTo(x0, base + 40); let y = y0;
        for (let x = x0; x <= x0 + w; x += step) { if (flat && rnd() < 0.35) { y = y0 - amp * (0.6 + rnd() * 0.4); g.lineTo(x, y); g.lineTo(x + step * 0.3, y); x += step * 0.3; g.lineTo(x + step * 1.6, y); x += step * 1.6; g.lineTo(x + step * 0.3, y0 - rnd() * amp * 0.2); } else { y = y0 - rnd() * amp * 0.35; g.lineTo(x, y); } }
        g.lineTo(x0 + w, base + 40); g.closePath(); g.fill();
        // strata bands on the mesas
        g.save(); g.clip(); g.fillStyle = 'rgba(0,0,0,0.08)'; for (let yy = y0 - amp; yy < base; yy += 9) g.fillRect(x0, yy, w, 3); g.restore();
      };
      ridge(P.far1, base - 60, 150, 70, true);
      g.fillStyle = P.haze; g.fillRect(x0, top, w, 400);
      // a ruined city: towers with broken tops and empty windows, a crane, a radio mast
      for (let x = x0 + 300; x < x0 + w - 200; x += 160 + rnd() * 220) {
        if (rnd() < 0.35) continue;
        const n = 2 + Math.floor(rnd() * 4);
        for (let k = 0; k < n; k++) {
          const bw = 22 + rnd() * 34, bh = 50 + rnd() * 120, bx = x + k * (bw + 4 + rnd() * 10);
          g.fillStyle = P.city; g.beginPath(); g.moveTo(bx, base); g.lineTo(bx, base - bh); let cx2 = bx; while (cx2 < bx + bw) { cx2 += 4 + rnd() * 8; g.lineTo(Math.min(bx + bw, cx2), base - bh + rnd() * 14); } g.lineTo(bx + bw, base); g.fill();
          g.fillStyle = 'rgba(0,0,0,0.25)'; for (let wy = base - bh + 16; wy < base - 8; wy += 9) for (let wx = bx + 4; wx < bx + bw - 4; wx += 7) if (rnd() < 0.7) g.fillRect(wx, wy, 3, 4);
          if (phase === 'night') { g.fillStyle = 'rgba(255,190,110,0.8)'; for (let i = 0; i < 2; i++) if (rnd() < 0.2) g.fillRect(bx + 4 + rnd() * (bw - 8), base - bh * rnd(), 3, 4); }
        }
        if (rnd() < 0.25) { g.strokeStyle = P.city; g.lineWidth = 3; g.beginPath(); g.moveTo(x + 10, base); g.lineTo(x + 10, base - 170); g.lineTo(x + 90, base - 170); g.moveTo(x + 10, base - 150); g.lineTo(x + 40, base - 170); g.stroke(); g.lineWidth = 1; g.beginPath(); g.moveTo(x + 80, base - 170); g.lineTo(x + 80, base - 130); g.stroke(); }
      }
      g.fillStyle = P.haze; g.fillRect(x0, top, w, 400);
      ridge(P.far2, base - 10, 70, 46, true);
      Art.quantize(c, 12);
      c.x0 = x0; c.top = top; c.w = w; c.h = 340;
      return c;
    }
    function drawFar(L) {
      layerTransform(PARALLAX.far);
      const W = world(), key = `far|${state.phase}|${W.w}`;
      let c = sprites.get(key);
      if (!c) { for (const k of [...sprites.keys()]) if (k.startsWith('far|')) sprites.delete(k); c = paintFar(state.phase, W); sprites.set(key, c); }
      Art.blit(ctx, c, c.x0, c.top, c.w, c.h);
    }
    // Mid: the old highway — power poles with sagging lines, a billboard, a dead tree, a wrecked truck.
    function paintMid(phase, W) {
      const P = PH_COL[phase] || PH_COL.morning, y = GROUND - 4, x0 = -900, w = W.w + 1800, top = y - 170;
      const [c, g] = lowCanvas(w, 190);
      g.translate(-x0, -top);
      const col = P.mid, hi = phase === 'night' ? '#202a3c' : phase === 'evening' ? '#5a3e38' : '#7a6650';
      g.fillStyle = col; g.strokeStyle = col;
      // road shoulder and a faded lane
      g.fillRect(x0, y - 6, w, 10); g.fillStyle = hi; for (let x = x0; x < x0 + w; x += 60) g.fillRect(x, y - 3, 26, 2);
      g.fillStyle = col;
      // power poles and wires
      const poles = [];
      for (let x = x0 + 100; x < x0 + w; x += 320) { poles.push(x); g.fillRect(x, y - 130, 6, 130); g.fillRect(x - 22, y - 122, 50, 5); g.fillRect(x - 18, y - 126, 3, 4); g.fillRect(x + 18, y - 126, 3, 4); }
      g.lineWidth = 1.4;
      for (let i = 0; i < poles.length - 1; i++) for (const off of [-18, 19]) { if ((i + off) % 5 === 0) continue; g.beginPath(); g.moveTo(poles[i] + off, y - 124); g.quadraticCurveTo((poles[i] + poles[i + 1]) / 2 + off, y - 100, poles[i + 1] + off, y - 124); g.stroke(); }
      // billboard with a peeling advert
      const bx = W.w * 0.12;
      g.fillRect(bx + 20, y - 40, 6, 40); g.fillRect(bx + 120, y - 40, 6, 40);
      g.fillRect(bx, y - 104, 150, 66); g.fillStyle = hi; g.fillRect(bx + 6, y - 98, 138, 54);
      g.fillStyle = col; g.fillRect(bx + 14, y - 90, 70, 8); g.fillRect(bx + 14, y - 76, 50, 5); g.beginPath(); g.arc(bx + 112, y - 72, 16, 0, 7); g.fill();
      g.fillStyle = hi; g.beginPath(); g.moveTo(bx + 100, y - 98); g.lineTo(bx + 144, y - 98); g.lineTo(bx + 144, y - 60); g.closePath(); g.fill();
      // dead tree
      const tx = W.w * 0.45 + 380; g.fillStyle = col; g.fillRect(tx, y - 70, 6, 70);
      g.lineWidth = 3; g.beginPath(); g.moveTo(tx + 3, y - 50); g.lineTo(tx - 20, y - 80); g.moveTo(tx + 3, y - 60); g.lineTo(tx + 24, y - 92); g.moveTo(tx - 10, y - 66); g.lineTo(tx - 16, y - 96); g.moveTo(tx + 14, y - 76); g.lineTo(tx + 30, y - 78); g.stroke();
      // wrecked truck: cab, box, wheels, broken glass
      const wx = W.w * 0.74;
      g.fillStyle = col; g.beginPath(); g.roundRect(wx, y - 40, 132, 32, 4); g.fill(); g.beginPath(); g.roundRect(wx + 92, y - 64, 44, 30, 4); g.fill();
      g.fillStyle = hi; g.fillRect(wx + 104, y - 58, 22, 12); g.fillRect(wx + 8, y - 34, 76, 3);
      g.fillStyle = col; g.beginPath(); g.arc(wx + 26, y - 6, 12, 0, 7); g.arc(wx + 106, y - 6, 12, 0, 7); g.fill();
      g.fillStyle = hi; g.beginPath(); g.arc(wx + 26, y - 6, 4, 0, 7); g.arc(wx + 106, y - 6, 4, 0, 7); g.fill();
      // scrub and fence posts along the verge
      g.fillStyle = col;
      for (let x = x0; x < x0 + w; x += 37) { const h2 = 6 + ((x * 7) % 9 + 9) % 9; g.fillRect(x, y - 6 - h2, 2, h2); g.fillRect(x - 3, y - 8 - h2 / 2, 2, h2 / 2); g.fillRect(x + 3, y - 7 - h2 / 2, 2, h2 / 2); }
      Art.quantize(c, 8);
      c.x0 = x0; c.top = top; c.w = w; c.h = 190;
      return c;
    }
    function drawMid(L, phase) {
      layerTransform(PARALLAX.mid);
      const W = world(), key = `mid|${phase}|${W.w}`;
      let c = sprites.get(key);
      if (!c) { for (const k of [...sprites.keys()]) if (k.startsWith('mid|')) sprites.delete(k); c = paintMid(phase, W); sprites.set(key, c); }
      ctx.globalAlpha = 0.92; Art.blit(ctx, c, c.x0, c.top, c.w, c.h); ctx.globalAlpha = 1;
    }
    // The earth only changes when the crew digs: paint it once per depth.
    function drawEarth() {
      layerTransform(1);
      const W = world();
      const x0 = -700, y0 = GROUND - 8, w = W.w + 1400, h = W.h - GROUND + 40;
      const key = `earth|${state.dug}`;
      let c = sprites.get(key);
      if (!c) {
        c = document.createElement('canvas'); c.width = Math.ceil(w * SPRITE_RES); c.height = Math.ceil(h * SPRITE_RES);
        const g = c.getContext('2d'); g.scale(SPRITE_RES, SPRITE_RES); g.translate(-x0, -y0);
        const prev = ctx; ctx = g; paintEarth(); ctx = prev;
        Art.quantize(c, 16);
        for (const k of [...sprites.keys()]) if (k.startsWith('earth|')) sprites.delete(k);
        sprites.set(key, c);
      }
      ctx.fillStyle = '#3a2a20'; ctx.fillRect(-3000, GROUND + 14, x0 + 3000, W.h); ctx.fillRect(x0 + w, GROUND + 14, 3000, W.h);
      Art.blit(ctx, c, x0, y0, w, h);
      // deep earth below the last level, so tall screens never show sky under the ground
      const by = y0 + h - 2;
      ctx.fillStyle = Paint.pattern(ctx, 'dirt', 256, 7); ctx.fillRect(x0 - 3000, by, w + 6000, 4000);
      ctx.fillStyle = 'rgba(14,9,6,0.55)'; ctx.fillRect(x0 - 3000, by, w + 6000, 4000);
    }
    function paintEarth() {
      const W = world();
      // road + ground strip
      ctx.fillStyle = Paint.pattern(ctx, 'ground', 128, 6); ctx.fillRect(-2000, GROUND - 4, W.w + 4000, 18);
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(-2000, GROUND + 12, W.w + 4000, 3);
      ctx.fillStyle = Paint.pattern(ctx, 'dirt', 256, 7); ctx.fillRect(-2000, GROUND + 14, W.w + 4000, W.h);
      // dug-out cavity behind underground rooms
      const dugH = state.dug * UND_H + PAD;
      ctx.fillStyle = '#211812'; ctx.fillRect(-10, GROUND + PAD / 2, W.w + 20, dugH);
      ctx.fillStyle = Paint.pattern(ctx, 'concrete', 128, 9); ctx.globalAlpha = 0.35; ctx.fillRect(-10, GROUND + PAD / 2, W.w + 20, dugH); ctx.globalAlpha = 1;
      // strata
      ctx.strokeStyle = 'rgba(90,68,50,0.55)'; ctx.lineWidth = 1;
      for (let y = GROUND + 30; y < W.h + 100; y += 31) roughLine(ctx, -2000, y, W.w + 2000, y + ((y * 7) % 9) - 4, y, 3);
      // rocks in undug earth
      ctx.fillStyle = 'rgba(30,22,16,0.22)';
      for (let i = 0; i < 70; i++) {
        const x = (i * 211) % (W.w + 400) - 200, y = GROUND + PAD + state.dug * UND_H + 16 + ((i * 89) % (UND_H * (UNM.MAX_UNDER - state.dug) + 60));
        ctx.beginPath(); ctx.ellipse(x, y, 6 + (i % 5) * 3, 4 + (i % 3) * 2, i, 0, 7); ctx.fill();
      }
      // ladder shaft on the right edge of the dug area
      ctx.strokeStyle = '#6a5240'; ctx.lineWidth = 3;
      const lx = W.w + 4;
      roughLine(ctx, lx, GROUND, lx, GROUND + dugH, 3); roughLine(ctx, lx + 14, GROUND, lx + 14, GROUND + dugH, 4);
      for (let y = GROUND + 10; y < GROUND + dugH; y += 14) roughLine(ctx, lx, y, lx + 14, y, y, 0.8);
    }

    function drawFigure(x, y, look, time, seed, scale = 1, sil = null, pose = 'stand', facing = 1, extra = {}) {
      ctx.save(); ctx.translate(x, y);
      const artPose = pose === 'work' || pose === 'bend' ? (Math.floor(time / 380 + seed) % 3 === 0 ? 'idle' : 'work') : pose === 'drink' ? (Math.floor(time / 1400 + seed) % 4 === 0 ? 'idle' : 'drink') : pose === 'walk1' || pose === 'walk2' ? pose : 'idle';
      // breathing / working bob, then the illustrated figure (falls back to the procedural one until loaded)
      const bob = artPose === 'walk1' || artPose === 'walk2' ? 0 : pose === 'stand' && /walk/.test(String(pose)) ? 1 : artPose === 'work' ? Math.abs(Math.sin(time / 260 + seed)) * 1.2 : Math.sin(time / 900 + seed) * 0.35;
      ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.beginPath(); ctx.ellipse(0, 0, 9 * scale, 2.4 * scale, 0, 0, 7); ctx.fill();
      ctx.translate(0, -bob);
      if (sil || !Art.person(ctx, look, { pose: artPose, facing, height: 44 * scale, seed, role: extra.role, outfit: extra.outfit || 'crew' })) {
        ctx.translate(0, bob);
        Paint.person(ctx, look, { pose, t: time, seed, facing, sil, scale: scale * 0.92 });
      }
      ctx.restore();
    }

    function drawFurniture(room, r, seed) {
      const art = Furniture.room(room.type, r.w, r.h, seed);
      if (art) { Art.blit(ctx, art, r.x, r.y, r.w, r.h); return; }
      const ink = '#2a211a', f = r.y + r.h - 12;
      ctx.lineWidth = 2; ctx.strokeStyle = ink;
      const box = (x, y, w, h, fill) => { Paint.drawnBox(ctx, x, y, w, h, fill, seed + Math.round(x + y)); ctx.lineWidth = 2; ctx.strokeStyle = ink; };
      switch (room.type) {
        case 'guest_room': for (let i = 0; i < 3; i++) { box(r.x + 22 + i * 90, f - 20, 66, 20, '#8a6a4a'); box(r.x + 22 + i * 90, f - 30, 18, 10, '#d8ccb0'); } box(r.x + r.w - 40, r.y + 40, 22, 30, '#6d5a40'); break;
        case 'bar': box(r.x + 20, f - 38, r.w - 120, 38, '#6b4428'); for (let i = 0; i < 7; i++) box(r.x + 34 + i * 26, r.y + 36, 8, 18, ['#7fa36b', '#a8743a', '#5f7d8a'][i % 3]); box(r.x + r.w - 88, f - 26, 26, 26, '#7a5a3a'); box(r.x + r.w - 52, f - 26, 26, 26, '#7a5a3a'); break;
        case 'entertainment': box(r.x + 30, f - 26, 80, 22, '#2f5a3a'); box(r.x + r.w - 130, f - 34, 110, 34, '#4b2f3a'); ctx.fillStyle = '#d8c9a0'; ctx.fillRect(r.x + 40, f - 30, 10, 4); ctx.fillRect(r.x + 60, f - 30, 10, 4); break;
        case 'wall': box(r.x + 40, r.y + 8, 70, r.h - 16, '#5e4e40'); ctx.strokeStyle = 'rgba(0,0,0,0.35)'; for (let y = r.y + 26; y < r.y + r.h - 10; y += 18) roughLine(ctx, r.x + 42, y, r.x + 108, y, y); break;
        case 'watchtower': box(r.x + 66, r.y + 34, 18, r.h - 46, '#5e4e40'); box(r.x + 38, r.y + 22, 74, 14, '#5e4e40'); ctx.beginPath(); ctx.moveTo(r.x + 34, r.y + 22); ctx.lineTo(r.x + 75, r.y + 4); ctx.lineTo(r.x + 116, r.y + 22); ctx.fillStyle = '#4a3a2e'; ctx.fill(); ctx.stroke(); break;
        case 'generator': box(r.x + 26, f - 56, r.w - 52, 56, '#5d6a52'); ctx.strokeStyle = '#f2a649'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(r.x + r.w / 2, f - 28, 14, 0, 7); ctx.stroke(); break;
        case 'water_pump': box(r.x + 34, f - 66, 30, 66, '#4f6f7a'); box(r.x + 64, f - 48, 56, 10, '#4f6f7a'); box(r.x + 100, f - 26, 26, 26, '#3f5966'); break;
        case 'food': for (let i = 0; i < 4; i++) { box(r.x + 18 + i * 72, f - 22, 56, 22, '#4a3a24'); ctx.fillStyle = '#6f8f4a'; ctx.beginPath(); ctx.arc(r.x + 34 + i * 72, f - 28, 9, 0, 7); ctx.arc(r.x + 54 + i * 72, f - 30, 11, 0, 7); ctx.fill(); } break;
        case 'crew_quarters': for (const dx of [18, 82]) { ctx.strokeStyle = '#6a5240'; ctx.lineWidth = 3; roughRect(ctx, r.x + dx, f - 70, 50, 70, seed + dx); ctx.stroke(); roughLine(ctx, r.x + dx, f - 36, r.x + dx + 50, f - 36, dx); box(r.x + dx + 4, f - 44, 42, 8, '#8a6a4a'); box(r.x + dx + 4, f - 10, 42, 8, '#8a6a4a'); } break;
        case 'team_management': box(r.x + 22, f - 30, r.w - 44, 30, '#5a4632'); box(r.x + 28, r.y + 22, r.w - 56, 38, '#3a4a3f'); ctx.strokeStyle = '#d8c9a0'; ctx.lineWidth = 1.5; roughLine(ctx, r.x + 40, r.y + 34, r.x + 90, r.y + 48, 9); roughLine(ctx, r.x + 60, r.y + 30, r.x + 110, r.y + 40, 11); break;
        case 'clinic': box(r.x + 20, f - 22, 96, 22, '#b9b6a8'); ctx.fillStyle = '#b03a2e'; ctx.fillRect(r.x + r.w - 42, r.y + 26, 8, 24); ctx.fillRect(r.x + r.w - 50, r.y + 34, 24, 8); break;
        case 'storage': for (let i = 0; i < 3; i++) for (let k = 0; k < 2; k++) box(r.x + 22 + i * 38, f - 28 - k * 28, 32, 26, '#7a5c3a'); break;
        case 'workshop': box(r.x + 20, f - 30, r.w - 40, 30, '#5a4632'); ctx.fillStyle = '#9a9a8a'; ctx.fillRect(r.x + 34, r.y + 24, 6, 26); ctx.fillRect(r.x + 50, r.y + 30, 18, 6); break;
        case 'bathhouse': box(r.x + 24, f - 24, 110, 24, '#5f7d8a'); ctx.fillStyle = 'rgba(220,235,240,.35)'; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(r.x + 44 + i * 24, f - 34 - (i % 2) * 6, 6, 0, 7); ctx.fill(); } box(r.x + r.w - 70, f - 52, 40, 52, '#6d5a40'); break;
        case 'checkpoint': box(r.x + 20, f - 44, 26, 44, '#5e4e40'); box(r.x + 46, f - 22, r.w - 66, 8, '#a8432f'); box(r.x + 46, f - 30, r.w - 66, 4, '#d8ccb0'); break;
        case 'turret_nest': box(r.x + 40, f - 26, 70, 26, '#5e4e40'); box(r.x + 58, f - 42, 34, 16, '#5b6266'); ctx.strokeStyle = '#2b2f31'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(r.x + 88, f - 36); ctx.lineTo(r.x + 124, f - 48); ctx.stroke(); break;
        case 'purifier': box(r.x + 22, f - 60, 34, 60, '#4f6f7a'); box(r.x + 64, f - 44, 34, 44, '#6a8a94'); box(r.x + 56, f - 50, 8, 6, '#9ab8c0'); ctx.fillStyle = '#9fd0e0'; ctx.fillRect(r.x + 70, f - 36, 22, 4); break;
        case 'cold_storage': box(r.x + 24, f - 62, 46, 62, '#8a9a9c'); box(r.x + 76, f - 62, 46, 62, '#8a9a9c'); ctx.fillStyle = '#5b6266'; ctx.fillRect(r.x + 62, f - 40, 4, 14); ctx.fillRect(r.x + 80, f - 40, 4, 14); break;
        case 'armory': for (let i = 0; i < 5; i++) { ctx.strokeStyle = '#2b241d'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(r.x + 26 + i * 16, r.y + 26); ctx.lineTo(r.x + 30 + i * 16, f - 30); ctx.stroke(); } box(r.x + 20, f - 26, r.w - 40, 26, '#5a4632'); box(r.x + r.w - 52, r.y + 26, 28, 36, '#6b3f3f'); break;
        case 'messenger_post': box(r.x + 24, f - 34, 60, 34, '#6d5a40'); for (let i = 0; i < 6; i++) box(r.x + 28 + (i % 3) * 18, f - 64 + Math.floor(i / 3) * 14, 14, 12, '#4a3a2e'); ctx.fillStyle = '#d8ccb0'; ctx.fillRect(r.x + 96, r.y + 30, 24, 16); break;
        case 'meeting_hall': box(r.x + 40, f - 24, r.w - 80, 14, '#6b4428'); for (let i = 0; i < 6; i++) box(r.x + 46 + i * ((r.w - 100) / 5), f - 12, 10, 12, '#4a3a2e'); box(r.x + r.w / 2 - 40, r.y + 22, 80, 30, '#3a4a3f'); break;
        case 'informants': box(r.x + 20, f - 30, r.w - 40, 30, '#3a3027'); box(r.x + 28, r.y + 22, r.w - 56, 40, '#2f3a33'); ctx.strokeStyle = '#a8432f'; ctx.lineWidth = 1.5; roughLine(ctx, r.x + 36, r.y + 30, r.x + 90, r.y + 54, 7); roughLine(ctx, r.x + 50, r.y + 52, r.x + 110, r.y + 28, 8); break;
        case 'vault': {
          box(r.x + 14, r.y + 18, r.w - 28, 46, '#1d2622');
          ctx.fillStyle = '#7fd0a0'; ctx.fillRect(r.x + 20, r.y + 24, r.w - 40, 2);
          box(r.x + 20, f - 22, r.w - 40, 22, '#3a3f3c'); break;
        }
        case 'sealed_door': {
          ctx.fillStyle = '#16191d'; ctx.fillRect(r.x + 6, r.y + 6, r.w - 12, r.h - 12);
          box(r.x + r.w / 2 - 30, r.y + 18, 60, r.h - 30, '#2b3036');
          ctx.strokeStyle = '#9a6b2f'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(r.x + r.w / 2, r.y + r.h / 2 + 4, 12, 0, 7); ctx.stroke();
          ctx.fillStyle = '#4a5a52'; ctx.fillRect(r.x + 14, r.y + 34, 14, 22); // intercom
          break;
        }
      }
    }

    const WALL_KIND = { bar: 'brick', wall: 'brick', clinic: 'tile', bathhouse: 'tile', generator: 'metal', workshop: 'metal', armory: 'metal', turret_nest: 'brick', checkpoint: 'brick', purifier: 'tile', cold_storage: 'metal' };
    // Rooms: the static picture is cached per look; lamps and highlights are live.
    function drawRoom(room, L, time) {
      const t = UNM.ROOM_TYPES[room.type];
      const r = roomRect(room, t.w);
      const seed = hash(room.id);
      const surface = room.row === 0;
      const running = UNM.isRunning(state, room);
      const outdoor = room.type === 'wall' || room.type === 'watchtower';
      const lit = !outdoor && (running || (room.state === 'working' && !t.staff && !t.power) || room.type === 'vault');
      const why = room.state === 'working' && !running && (t.staff || t.power) ? (t.power && !UNM.powerReport(state).powered.has(room.id) ? 'NO POWER' : 'NEEDS CREW') : '';
      const furn = Furniture.room(room.type, r.w, r.h, seed) ? 1 : 0;
      const [nl, nr] = surface ? sides(room) : [false, false];
      const ext = surface && Furniture.exterior(room.type, r.w, r.h, seed, room.state !== 'working' && room.state !== 'building', nl, nr) ? 1 : 0;
      const key = `room|${room.id}|${room.type}|${room.state}|${room.level}|${room.buildLeft}|${lit}|${why}|${surface ? L.shade : 0}|${t.w}|${furn}|${ext}|${nl}${nr}`;
      let c = sprites.get(key);
      if (!c) {
        const pad = 25, padTop = surface && !Furniture.OUTDOOR.has(room.type) ? 100 : 25; // multiples of 25 units = 32 px, so rooms land on the pixel grid
        c = document.createElement('canvas'); c.width = Math.ceil((r.w + pad * 2) * SPRITE_RES); c.height = Math.ceil((r.h + pad + padTop) * SPRITE_RES);
        const g = c.getContext('2d'); g.scale(SPRITE_RES, SPRITE_RES); g.translate(pad - r.x, padTop - r.y);
        c.padTop = padTop;
        const prev = ctx; ctx = g; paintRoom(room, L, time, { lit, why }); ctx = prev;
        Art.quantize(c, surface ? 44 : 32);
        const old = sprites.get('of|' + room.id); if (old) sprites.delete(old);
        sprites.set(key, c); sprites.set('of|' + room.id, key);
        c.pad = pad;
      }
      Art.blit(ctx, c, r.x - c.pad, r.y - c.padTop, r.w + c.pad * 2, r.h + c.pad + c.padTop);
      const floorY = r.y + r.h - 14;
      if (lit) {
        const strength = surface ? 0.35 + L.lamp * 0.75 : 0.95;
        const n = t.w > 1 ? 2 : 1;
        for (let k = 0; k < n; k++) {
          const flick = 0.93 + Math.sin(time / 170 + seed + k) * 0.035 + Math.sin(time / 53 + seed * 3 + k) * 0.03;
          Paint.lamp(ctx, r.x + (r.w / n) * (k + 0.5), r.y + 15, floorY, Math.min(150, r.w / n * 0.9), strength, flick);
        }
      }
      if (room.type === 'vault') {
        const tt = time / 600;
        for (let i = 0; i < 9; i++) { ctx.fillStyle = `rgba(230,70,50,${0.5 + 0.5 * Math.sin(tt + i)})`; ctx.beginPath(); ctx.arc(r.x + 26 + ((i * 37) % (r.w - 52)), r.y + 32 + ((i * 23) % 26), 2.2, 0, 7); ctx.fill(); }
      }
      if (room.id === selected || highlight.includes(room.id)) {
        const pulse = highlight.includes(room.id) && room.id !== selected ? 0.55 + Math.sin(time / 220) * 0.45 : 1;
        ctx.strokeStyle = `rgba(242,166,73,${pulse})`; ctx.lineWidth = 5; roughRect(ctx, r.x + 1, r.y + 1, r.w - 2, r.h - 2, seed + 11, 1); ctx.stroke();
      }
    }
    // Is there a building (not an open-air wall or tower) right next to this surface room?
    function sides(room) {
      const t = UNM.ROOM_TYPES[room.type];
      const bld = (col) => { const o = UNM.roomAt(state, 0, col); return !!(o && o.id !== room.id && !Furniture.OUTDOOR.has(o.type)); };
      return [bld(room.col - 1), bld(room.col + t.w)];
    }
    function roomLabel(room, r, seed, why) {
      const t = UNM.ROOM_TYPES[room.type];
      // ---- sign plate: a paper tag on two nails ----
      ctx.font = FONT_SIGN;
      const label = room.state === 'building' ? `${t.name} · ${room.buildLeft}d` : t.name + (room.level > 1 ? ` ${'I'.repeat(room.level)}` : '');
      const tw = ctx.measureText(label).width;
      ctx.save(); ctx.translate(r.x + 10, r.y + 10); ctx.rotate(((seed % 7) - 3) * 0.006);
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(2, 2, tw + 12, 18);
      ctx.fillStyle = Paint.pattern(ctx, 'paper', 64, 5); Paint.wobblyRect(ctx, 0, 0, tw + 12, 18, seed + 5, 1); ctx.fill();
      if (room.state !== 'working') { ctx.fillStyle = 'rgba(60,40,20,0.25)'; ctx.fillRect(0, 0, tw + 12, 18); }
      ctx.fillStyle = '#3a2b1e'; ctx.beginPath(); ctx.arc(3, 3, 1.2, 0, 7); ctx.arc(tw + 9, 3, 1.2, 0, 7); ctx.fill();
      ctx.fillStyle = '#2a211a'; ctx.fillText(label, 6, 13);
      ctx.restore();
      if (why) { ctx.font = FONT_SMALL; ctx.fillStyle = '#ffcf9a'; ctx.fillText(why, r.x + 12, r.y + 44); }
    }
    // Walls, towers, the gate and gun nests stand in the open: dirt underfoot, sky behind.
    function paintOutdoor(room, r, seed, L, why) {
      const floorY = r.y + r.h - 12;
      ctx.fillStyle = Paint.pattern(ctx, 'dirt', 64, 3); ctx.fillRect(r.x, floorY, r.w, 12);
      ctx.fillStyle = 'rgba(30,20,12,0.35)'; ctx.fillRect(r.x, floorY, r.w, 2);
      if (room.state === 'working' || room.state === 'building') drawFurniture(room, r, seed);
      if (room.state === 'ruined' || room.state === 'damaged') {
        for (let i = 0; i < (room.state === 'ruined' ? 7 : 4); i++) {
          const dx = r.x + 16 + ((seed * (i + 3)) % Math.max(20, r.w - 40)), w = 10 + (i * 7) % 18, h = 6 + (i * 5) % 10;
          Paint.drawnBox(ctx, dx, floorY - h, w, h, i % 2 ? '#6e5a48' : '#5a4a3c', seed + i * 13, { line: 1.1 });
        }
        if (room.state === 'ruined') { ctx.save(); ctx.translate(r.x + r.w * 0.5, floorY - 20); ctx.rotate(0.5); Paint.drawnBox(ctx, -40, -4, 80, 8, '#5a4130', seed + 9); ctx.restore(); }
      }
      if (room.state === 'building') { ctx.strokeStyle = '#6a5240'; ctx.lineWidth = 3; roughLine(ctx, r.x + 14, r.y + 8, r.x + 14, floorY, seed); roughLine(ctx, r.x + r.w - 14, r.y + 8, r.x + r.w - 14, floorY, seed + 1); }
      if (L.shade > 0) { ctx.save(); ctx.globalCompositeOperation = 'source-atop'; ctx.fillStyle = `rgba(8,12,22,${0.55 * L.shade})`; ctx.fillRect(r.x - 30, r.y - 100, r.w + 60, r.h + 130); ctx.restore(); }
      roomLabel(room, r, seed, why);
    }
    function paintRoom(room, L, time, { lit, why }) {
      const t = UNM.ROOM_TYPES[room.type];
      const r = roomRect(room, t.w);
      const seed = hash(room.id);
      const surface = room.row === 0;
      const running = UNM.isRunning(state, room);
      const ix = r.x + 5, iy = r.y + 5, iw = r.w - 10, ih = r.h - 10;
      const floorY = r.y + r.h - 14;
      const outside = surface && Furniture.OUTDOOR.has(room.type);
      if (outside) { paintOutdoor(room, r, seed, L, why); return; }
      // ---- shell: textured back wall, floor, pipes, edge shadows ----
      ctx.save();
      ctx.beginPath(); ctx.rect(ix, iy, iw, ih); ctx.clip();
      const kind = room.type === 'vault' || room.type === 'sealed_door' ? 'concrete' : WALL_KIND[room.type] || (surface ? 'plaster' : 'concrete');
      ctx.fillStyle = Paint.pattern(ctx, kind, 128, kind === 'concrete' ? 2 : 1); ctx.fillRect(ix, iy, iw, ih);
      if (surface && kind === 'plaster') { ctx.fillStyle = 'rgba(40,24,14,0.28)'; ctx.fillRect(ix, floorY - 34, iw, 34); ctx.fillStyle = 'rgba(255,230,190,0.12)'; ctx.fillRect(ix, floorY - 35, iw, 2); }
      ctx.fillStyle = Paint.pattern(ctx, surface ? 'planks' : 'concrete', 64, 3); ctx.fillRect(ix, floorY, iw, r.y + r.h - floorY);
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(ix, floorY, iw, 2);
      if (!surface) {
        ctx.strokeStyle = '#3d3d3a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(ix, iy + 9); ctx.lineTo(ix + iw, iy + 9); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(ix, iy + 7.5); ctx.lineTo(ix + iw, iy + 7.5); ctx.stroke();
        ctx.fillStyle = '#2a2a28'; for (let x = ix + 20; x < ix + iw; x += 48) ctx.fillRect(x, iy + 5, 3, 9);
      }
      Paint.occlude(ctx, ix, iy, iw, ih, 16, surface ? 0.4 : 0.55);
      Paint.hatch(ctx, ix, iy, 26, ih, { spacing: 5, alpha: 0.12, seed });
      Paint.hatch(ctx, ix + iw - 22, iy, 22, ih, { spacing: 5, alpha: 0.14, seed: seed + 1, angle: -1 });
      ctx.restore();
      const [nl, nr] = surface ? sides(room) : [false, false];
      const extImg = surface ? Furniture.exterior(room.type, r.w, r.h, seed, room.state !== 'working' && room.state !== 'building', nl, nr) : null;
      if (surface && !extImg) { // corrugated roof until the building art is ready
        ctx.fillStyle = Paint.pattern(ctx, 'metal', 48, 4);
        Paint.wobblyRect(ctx, r.x - 3, r.y - 11, r.w + 6, 14, seed + 1, 1.2); ctx.fill();
        ctx.strokeStyle = '#1d1712'; ctx.lineWidth = 1.6; ctx.stroke();
        ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(r.x - 3, r.y + 2, r.w + 6, 3);
      }
      if (room.state === 'working' || room.state === 'building' || room.type === 'sealed_door') drawFurniture(room, r, seed);
      // ---- damage ----
      if (room.state === 'ruined' || room.state === 'damaged') {
        const ruined = room.state === 'ruined';
        ctx.save(); ctx.beginPath(); ctx.rect(ix, iy, iw, ih); ctx.clip();
        ctx.fillStyle = ruined ? 'rgba(14,10,8,0.6)' : 'rgba(14,10,8,0.3)'; ctx.fillRect(ix, iy, iw, ih);
        Paint.hatch(ctx, ix, iy, iw, ih, { spacing: ruined ? 4 : 7, alpha: ruined ? 0.22 : 0.12, seed: seed + 5 });
        ctx.strokeStyle = '#120d09'; ctx.lineWidth = 1.6;
        roughLine(ctx, r.x + 18, r.y + 10, r.x + 40, r.y + 60, seed); roughLine(ctx, r.x + 40, r.y + 60, r.x + 30, r.y + 92, seed + 2);
        roughLine(ctx, r.x + r.w - 28, r.y + 12, r.x + r.w - 50, r.y + 64, seed + 3);
        if (ruined) { // fallen beam
          ctx.save(); ctx.translate(r.x + r.w * 0.55, r.y + r.h * 0.5); ctx.rotate(0.38 + (seed % 5) * 0.05);
          Paint.drawnBox(ctx, -r.w * 0.4, -5, r.w * 0.8, 10, '#5a4130', seed + 9); ctx.restore();
        }
        for (let i = 0; i < (ruined ? 7 : 4); i++) {
          const dx = r.x + 16 + ((seed * (i + 3)) % Math.max(20, r.w - 40)), w = 10 + (i * 7) % 18, h = 6 + (i * 5) % 10;
          Paint.drawnBox(ctx, dx, r.y + r.h - 12 - h, w, h, i % 2 ? '#6e5a48' : '#5a4a3c', seed + i * 13, { line: 1.1 });
        }
        ctx.restore();
      }
      if (room.state === 'building') {
        ctx.strokeStyle = 'rgba(242,166,73,0.75)'; ctx.lineWidth = 3;
        for (let x = r.x - r.h; x < r.x + r.w; x += 22) { ctx.save(); ctx.beginPath(); ctx.rect(r.x + 6, r.y + 6, r.w - 12, r.h - 12); ctx.clip(); roughLine(ctx, x, r.y + r.h, x + r.h, r.y, x, 1); ctx.restore(); }
        // scaffold poles
        ctx.strokeStyle = '#6a5240'; ctx.lineWidth = 3; roughLine(ctx, r.x + 14, r.y + 8, r.x + 14, r.y + r.h - 8, seed); roughLine(ctx, r.x + r.w - 14, r.y + 8, r.x + r.w - 14, r.y + r.h - 8, seed + 1);
      }
      // ---- light ----
      if (surface && L.shade > 0) { ctx.fillStyle = `rgba(8,12,22,${(running ? 0.32 : 0.62) * L.shade})`; ctx.fillRect(ix, iy, iw, ih); }
      const outdoor = room.type === 'wall' || room.type === 'watchtower';
      if (!lit && !outdoor && room.state === 'working' && (t.staff || t.power)) {
        ctx.fillStyle = 'rgba(8,8,12,0.45)'; ctx.fillRect(ix, iy, iw, ih);
        Paint.lamp(ctx, r.x + r.w / 2, r.y + 15, floorY, 60, 0);
      }
      // grain + ink frame drawn twice for the pencil look
      ctx.fillStyle = ctx === screenCtx ? grain : (ctx.__grain || (ctx.__grain = ctx.createPattern(grainCanvas(), 'repeat'))); ctx.fillRect(ix, iy, iw, ih);
      if (extImg) {
        // the building around the cutaway, dimmed with the time of day
        const tmp = document.createElement('canvas'); tmp.width = extImg.width; tmp.height = extImg.height;
        const tg = tmp.getContext('2d'); tg.drawImage(extImg, 0, 0);
        if (L.shade > 0) { tg.globalCompositeOperation = 'source-atop'; tg.fillStyle = `rgba(8,12,24,${0.62 * L.shade})`; tg.fillRect(0, 0, tmp.width, tmp.height); }
        Art.blit(ctx, tmp, r.x - 20, r.y - 80, r.w + 40, r.h + 80);
      } else {
        ctx.strokeStyle = '#18120d'; ctx.lineWidth = 3; roughRect(ctx, r.x + 3, r.y + 3, r.w - 6, r.h - 6, seed + 9); ctx.stroke();
        ctx.globalAlpha = 0.4; ctx.lineWidth = 1.2; roughRect(ctx, r.x + 4, r.y + 2, r.w - 7, r.h - 5, seed + 19, 3); ctx.stroke(); ctx.globalAlpha = 1;
      }
      roomLabel(room, r, seed, why);
      void running;
    }

    // The motel sign on the roof: lit at dusk, one letter on the fritz.
    function drawSign(L, time) {
      const W = world();
      const word = UNM.nameOf(state);
      ctx.font = '800 30px "Big Shoulders Stencil Text", Impact, sans-serif';
      let tw = 0; for (const ch of word) tw += ctx.measureText(ch).width + 4;
      const w = Math.max(180, Math.ceil(tw + 44)), h = 40, x = W.w * 0.5 - w / 2, y = GROUND - SURF_H - 128;
      const lit = L.lamp > 0.5;
      const on = lit && Math.sin(time / 90) + Math.sin(time / 37) > 0.6;
      const key = `sign|${lit}|${on}|${word}`;
      let c = sprites.get(key);
      if (!c) {
        const pad = 120;
        c = document.createElement('canvas'); c.width = (w + pad * 2) * SPRITE_RES; c.height = (GROUND - SURF_H - y + pad * 2) * SPRITE_RES;
        const g = c.getContext('2d'); g.scale(SPRITE_RES, SPRITE_RES); g.translate(pad - x, pad - y);
        for (const k of [...sprites.keys()]) if (k.startsWith('sign|') && !k.endsWith('|' + word)) sprites.delete(k);
        const prev = ctx; ctx = g; paintSign(L, x, y, w, h, lit, on, word); ctx = prev;
        c.pad = pad; sprites.set(key, c);
      }
      Art.blit(ctx, c, x - c.pad, y - c.pad, w + c.pad * 2, GROUND - SURF_H - y + c.pad * 2);
    }
    function paintSign(L, x, y, w, h, lit, flickOn, word = 'WAYSTATION') {
      ctx.strokeStyle = '#2a1f17'; ctx.lineWidth = 4;
      roughLine(ctx, x + 40, y + h, x + 40, GROUND - SURF_H + 10, 31); roughLine(ctx, x + w - 40, y + h, x + w - 40, GROUND - SURF_H + 10, 37);
      Paint.drawnBox(ctx, x, y, w, h, '#2d2620', 41, { line: 2.2 });
      ctx.font = '800 30px "Big Shoulders Stencil Text", Impact, sans-serif';
      // the letter that never quite works: always the same one for a given name
      let broken = Math.min(4, word.length - 1); while (broken > 0 && word[broken] === ' ') broken--;
      let cx = x + 22;
      for (let i = 0; i < word.length; i++) {
        const ch = word[i], cw = ctx.measureText(ch).width + 4;
        const on = lit && (i !== broken || flickOn);
        if (on) { ctx.save(); ctx.shadowColor = 'rgba(255,170,80,0.95)'; ctx.shadowBlur = 16; ctx.fillStyle = '#ffd08a'; ctx.fillText(ch, cx, y + 31); ctx.restore(); }
        else { ctx.fillStyle = lit ? '#5a4632' : '#c9b48e'; ctx.fillText(ch, cx, y + 31); }
        cx += cw;
      }
      if (lit) { const g = ctx.createRadialGradient(x + w / 2, y + h / 2, 10, x + w / 2, y + h / 2, w * 0.7); g.addColorStop(0, 'rgba(255,170,80,0.18)'); g.addColorStop(1, 'rgba(255,170,80,0)'); ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.fillRect(x + w / 2 - w * 0.7, y + h / 2 - w * 0.7, w * 1.4, w * 1.4); ctx.restore(); }
    }

    function drawSlots(time) {
      ctx.setLineDash([6, 6]); ctx.lineWidth = 1.5;
      for (let row = 0; row <= state.dug; row++) {
        for (let col = 0; col < UNM.COLS; col++) {
          if (UNM.roomAt(state, row, col)) continue;
          const r = slotRect(row, col);
          const sel = selected && selected.kind === 'slot' && selected.row === row && selected.col === col;
          ctx.strokeStyle = sel ? '#f2a649' : row === 0 ? 'rgba(233,220,192,0.35)' : 'rgba(233,220,192,0.22)';
          ctx.strokeRect(r.x + 10, r.y + 12, r.w - 20, r.h - 24);
          ctx.fillStyle = sel ? '#f2a649' : 'rgba(233,220,192,0.35)';
          ctx.font = '300 26px system-ui'; ctx.fillText('+', r.x + r.w / 2 - 7, r.y + r.h / 2 + 9);
        }
      }
      ctx.setLineDash([]);
      if (state.dug < UNM.MAX_UNDER) {
        const r = slotRect(state.dug + 1, 0);
        ctx.strokeStyle = 'rgba(242,166,73,0.45)'; ctx.setLineDash([10, 8]); ctx.lineWidth = 2;
        ctx.strokeRect(10, r.y + 10, world().w - 20, r.h - 20); ctx.setLineDash([]);
        ctx.font = FONT_SIGN; ctx.fillStyle = 'rgba(242,166,73,0.8)';
        ctx.fillText('DIG DEEPER', world().w / 2 - 34, r.y + r.h / 2 + 4);
      }
    }

    function drawPeople(time, phase) {
      const placed = {};
      const spot = (room) => { placed[room.id] = (placed[room.id] || 0) + 1; return placed[room.id]; };
      const find = (type) => state.rooms.find((x) => x.type === type && x.state === 'working');
      for (const c of state.crew) {
        if (!c.alive || c.away) continue;
        let room = c.job ? state.rooms.find((x) => x.id === c.job) : null;
        if (!room || room.state !== 'working') room = (phase === 'evening' && find('bar')) || find('crew_quarters') || find('team_management');
        if (!room) continue;
        const r = roomRect(room, UNM.ROOM_TYPES[room.type].w);
        const n = spot(room), seed = hash(c.id);
        const span = r.w - 60;
        // Work at one spot, walk to another, work there, walk back.
        const period = 9000 + (seed % 5000), ph = ((time / period + (seed % 1000) / 1000) % 1 + 1) % 1;
        const ease = (t) => t * t * (3 - 2 * t);
        const sA = 0.15 + ((seed >> 3) % 30) / 100, sB = 0.55 + ((seed >> 5) % 35) / 100;
        let f, walking = 0;
        if (ph < 0.38) f = sA; else if (ph < 0.5) { f = sA + (sB - sA) * ease((ph - 0.38) / 0.12); walking = sB > sA ? 1 : -1; }
        else if (ph < 0.88) f = sB; else { f = sB + (sA - sB) * ease((ph - 0.88) / 0.12); walking = sA > sB ? 1 : -1; }
        const x = r.x + 30 + f * span;
        const sleeping = phase === 'night' && room.type === 'crew_quarters';
        if (sleeping) continue;
        const pose = { generator: 'work', water_pump: 'work', workshop: 'work', armory: 'work', purifier: 'work', bar: 'work', food: 'bend', clinic: 'work', informants: 'work', messenger_post: 'work' }[room.type] || 'stand';
        const face = walking || (ph < 0.5 ? (sB > sA ? 1 : -1) : (sB > sA ? -1 : 1)) * (seed % 2 ? 1 : -1);
        const walkPose = ['walk1', 'stand', 'walk2', 'stand'][Math.floor(time / 130) % 4];
        drawFigure(x, r.y + r.h - 13, c.look, time, seed, c.injured ? 0.92 : 1, null, walking ? walkPose : c.injured ? 'stand' : pose, face, { role: c.role });
        // Experience shows: a chevron per level past the first, in the role's colour.
        if (c.level > 1) {
          ctx.strokeStyle = { bulwark: '#c9874a', longshot: '#9fd0e0', drifter: '#b6c98a', sawbones: '#e07a5f', tinker: '#f0c060' }[c.role] || '#ebdfc4';
          ctx.lineWidth = 1.6;
          for (let k = 0; k < Math.min(3, c.level - 1); k++) { const yy = r.y + r.h - 13 - 44 - k * 4; ctx.beginPath(); ctx.moveTo(x - 4, yy + 2); ctx.lineTo(x, yy - 1); ctx.lineTo(x + 4, yy + 2); ctx.stroke(); }
        }
        if (c.injured) { ctx.fillStyle = '#b03a2e'; ctx.fillRect(x - 3, r.y + r.h - 52, 6, 2); ctx.fillRect(x - 1, r.y + r.h - 54, 2, 6); }
        void n;
      }
      // patrons
      if (state.today && (phase === 'evening' || phase === 'midday')) {
        const bar = find('bar'), guest = find('guest_room');
        const draw = (room, count, base) => {
          if (!room || !count) return;
          const r = roomRect(room, UNM.ROOM_TYPES[room.type].w);
          for (let i = 0; i < Math.min(count, 6); i++) drawFigure(r.x + 40 + ((i * 47 + base) % (r.w - 70)), r.y + r.h - 13, { skin: (i * 5 + base) % 6, hair: (i * 7 + base) % 6, coat: (i * 3 + base + 2) % 6, build: (i + base) % 3, age: (i * 3 + base) % 4 === 0 ? 2 : 1, style: (i * 3 + base) % 10, facial: (i * 2 + base) % 5, mark: (i + base) % 7 === 3 ? 1 : 0, acc: (i * 5 + base) % 5, top: (i * 7 + base) % 5 }, time, i + base, 0.95, null, room.type === 'bar' ? (i % 2 ? 'drink' : 'stand') : 'stand', i % 2 ? 1 : -1, { outfit: 'patron' });
        };
        draw(bar, state.today.served, 11);
        draw(guest, Math.ceil(state.today.guests / 2), 5);
      }
    }

    function drawFore() {
      layerTransform(PARALLAX.fore);
      const W = world();
      void W;
    }

    let paused = false;
    function frame() {
      requestAnimationFrame(frame);
      if (!state || paused) return;
      const time = performance.now() - t0;
      if (!grain) grain = makeGrain();
      const L = LIGHT[state.phase] || LIGHT.morning;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawSky(L, time);
      drawFar(L);
      drawMid(L, state.phase);
      drawEarth();
      layerTransform(1);
      drawSlots(time);
      drawSign(L, time);
      for (const room of state.rooms) drawRoom(room, L, time);
      drawPeople(time, state.phase);
      drawFore();
      // night vignette
      if (L.shade > 0.3) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const g = ctx.createRadialGradient(vw / 2, vh / 2, Math.min(vw, vh) * 0.3, vw / 2, vh / 2, Math.max(vw, vh) * 0.75);
        g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,10,${L.shade * 0.45})`);
        ctx.fillStyle = g; ctx.fillRect(0, 0, vw, vh);
      }
    }

    new ResizeObserver(resize).observe(canvas);
    resize();
    requestAnimationFrame(frame);

    return {
      setState(s, sel, hl) {
        const first = !state;
        state = s; selected = sel && sel.kind === 'room' ? sel.id : sel; highlight = hl || [];
        if (first) fit();
      },
      recenter() { userMoved = false; fit(); },
      pause(on) { paused = !!on; },
      focusRoom(id) {
        const room = state && state.rooms.find((r) => r.id === id);
        if (!room) return;
        const r = roomRect(room, UNM.ROOM_TYPES[room.type].w);
        const sx = cam.x + (r.x + r.w / 2) * cam.scale, sy = cam.y + (r.y + r.h / 2) * cam.scale;
        if (sx < 40 || sx > vw - 40 || sy < 40 || sy > vh - 40) { cam.x += vw / 2 - sx; cam.y += vh / 2 - sy; userMoved = true; clamp(); }
      },
    };
  }
  return { create };
})();
