// ============================================================================
// Battle view: isometric canvas, animation queue, touch/mouse controls and
// HUD for TAC battles. Owns its own full-screen overlay.
// open(battle, { save, onDone }) — onDone fires when the debrief is closed.
// ============================================================================
const Battle = (() => {
  // Hex tiles seen from a raised angle: pointy-top, 64 wide, squashed to 48 tall; rows 36 apart.
  const TW = 64, HA = 32, HR = 24, ROWH = 36, WALL = 44, HALF = 17, LIFT = 16;
  const W = TAC.W, H = TAC.H;
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const SKIN = ['#f1c9a5', '#d9a27a', '#b9774f', '#8d5a3b', '#62402a', '#e6b98f'];
  const COAT = ['#7a4a2e', '#4f6650', '#5b5f73', '#8a6a3a', '#6b3f3f', '#3f5966'];
  const ROLE_TAG = { recruit: 'R', bulwark: 'B', longshot: 'L', drifter: 'D', sawbones: 'S', tinker: 'T' };
  const ROLE_NAME = { recruit: 'Recruit', bulwark: 'Bulwark', longshot: 'Longshot', drifter: 'Drifter', sawbones: 'Sawbones', tinker: 'Tinker' };
  const THEME = {
    salvage: ['#5c4b3a', '#57473a', '#614f3d', '#544536'], rescue: ['#4f4c3c', '#4a4838', '#55513f', '#47453a'],
    combat: ['#523f33', '#4c3b30', '#574437', '#4a3a2f'], elite: ['#4c4448', '#474044', '#51494c', '#433d40'],
    warlord: ['#563b30', '#50372d', '#5b4034', '#4c352c'],
    raid: ['#4d4232', '#483e30', '#524635', '#463c2e'],
  };
  const DUR = { move: 0, shot: 560, die: 480, down: 560, alert: 520, say: 650, tag: 520, pickup: 560, extract: 420, revive: 560, spawn: 380, heal: 420, dart: 460, bleed: 380, carry: 320, drop: 220, surrender: 700, over: 300, wreck: 700, flee: 380 };

  let el, cv, ctx, b = null, cb = null, dpr = 1;
  const cam = { x: 0, y: 0, scale: 1 };
  let view = { w: 0, h: 0 };
  let selId = null, targetId = null, pending = null, hover = null, tipText = '', modal = null;
  let queue = [], cur = null, curT = 0, disp = {}, floats = [], speed = 1, raf = 0, last = 0, animating = false;
  let say = { text: '', until: 0, bad: false };
  let reachCache = null, visCache = null, firstFit = true;
  let movedOnce = false, aimedOnce = false, enemyAnim = false;
  let opts = { fast: false, cb: false };
  const pal = () => (opts.cb ? { crew: '#7fb2e0', foe: '#f0a24a' } : { crew: '#8fc27c', foe: '#e0664a' });

  // ---------- coordinates ----------
  // hex centre in world space (odd rows sit half a hex to the right)
  const iso = (x, y) => ({ x: (x + 0.5 * (Math.round(y) & 1)) * TW, y: y * ROWH });
  const worldHex = (wx, wy) => { const [x, y] = TAC.fromHp(wx / TW, (wy / ROWH) * Math.sqrt(3) / 2); return { x, y }; };
  function pickTile(sx, sy) {
    const t = worldHex((sx - cam.x) / cam.scale, (sy - cam.y) / cam.scale);
    return t.x >= 0 && t.y >= 0 && t.x < W && t.y < H ? t : null;
  }
  const bounds = () => ({ minX: -HA - 10, maxX: (W - 1) * TW + HA * 2 + 10, minY: -HR - WALL - 10, maxY: (H - 1) * ROWH + HR + 10 });
  function hudSpace() {
    const top = el.querySelector('.b-top').offsetHeight + 8;
    const bot = el.querySelector('.b-bottom').offsetHeight + 8;
    return { top, bot };
  }
  function fit() {
    const bd = bounds(), sp = hudSpace();
    const mw = bd.maxX - bd.minX, mh = bd.maxY - bd.minY;
    const avail = view.h - sp.top - sp.bot;
    // Narrow screens: fill the height and pan sideways, so tiles stay big enough to tap.
    const s = view.w < 700 ? Math.min(view.w * 2.1 / mw, avail / mh) : Math.min(view.w / mw, avail / mh);
    cam.scale = Math.max(0.6, Math.min(view.w < 700 ? 1 : 1.25, s * 0.98));
    // Centre on the squad if the map does not fit.
    const crew = b.units.filter((u) => u.side === 'crew' && TAC.active(u));
    const cx = crew.length ? crew.reduce((n, u) => n + iso(u.x, u.y).x, 0) / crew.length : 0;
    const cy = crew.length ? crew.reduce((n, u) => n + iso(u.x, u.y).y, 0) / crew.length : 0;
    if (mw * cam.scale <= view.w) cam.x = view.w / 2 - ((bd.minX + bd.maxX) / 2) * cam.scale;
    else cam.x = view.w / 2 - cx * cam.scale;
    if (mh * cam.scale <= avail) cam.y = sp.top + avail / 2 - ((bd.minY + bd.maxY) / 2) * cam.scale;
    else cam.y = sp.top + avail * 0.62 - cy * cam.scale;
    clampCam();
  }
  function clampCam() {
    const bd = bounds();
    const pad = 80;
    cam.x = Math.min(view.w - pad - bd.minX * cam.scale, Math.max(pad - bd.maxX * cam.scale, cam.x));
    cam.y = Math.min(view.h - pad - bd.minY * cam.scale, Math.max(pad - bd.maxY * cam.scale, cam.y));
  }
  function resize() {
    if (!el || el.hidden) return;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    view = { w: el.clientWidth, h: el.clientHeight };
    cv.width = Math.round(view.w * dpr); cv.height = Math.round(view.h * dpr);
    cv.style.width = view.w + 'px'; cv.style.height = view.h + 'px';
    if (firstFit) { fit(); firstFit = false; } else clampCam();
  }

  // ---------- display state (what the player sees while events play) ----------
  function syncDisp() {
    disp = {};
    for (const u of b.units) disp[u.id] = { x: u.x, y: u.y, hp: Math.max(0, u.hp), downed: !!u.downed, dead: !!u.dead, gone: !!u.gone || !!u.carriedBy };
    reachCache = null; visCache = null;
  }
  function pull() {
    for (const ev of b.fx) queue.push(ev);
    b.fx = [];
    if (queue.length) animating = true;
  }
  function eventDur(ev) {
    if (ev.t === 'move') return Math.max(160, (ev.path.length - 1) * 115);
    if (ev.t === 'say') return DUR.say + Math.min(1400, ev.text.length * 14);
    return DUR[ev.t] || 300;
  }
  function begin(ev) {
    const d = disp;
    const at = (id) => (d[id] ? iso(d[id].x, d[id].y) : { x: 0, y: 0 });
    if (ev.t === 'say') showSay(ev.text);
    if (ev.t === 'shot') Sound.sfx(ev.melee ? 'bite' : 'shot');
    // turn to face where you are going or shooting
    if (ev.t === 'move' && d[ev.id] && ev.path.length > 1) { const a = iso(ev.path[0][0], ev.path[0][1]), z = iso(ev.path[ev.path.length - 1][0], ev.path[ev.path.length - 1][1]); if (Math.abs(z.x - a.x) > 4) d[ev.id].face = z.x > a.x ? 1 : -1; }
    if ((ev.t === 'shot' || ev.t === 'dart') && d[ev.from] && d[ev.to]) { const a = iso(d[ev.from].x, d[ev.from].y), z = iso(d[ev.to].x, d[ev.to].y); if (Math.abs(z.x - a.x) > 4) d[ev.from].face = z.x > a.x ? 1 : -1; }
    if (ev.t === 'alert') Sound.sfx('alert');
    if (ev.t === 'wreck') Sound.sfx('wreck');
    if (ev.t === 'revive' || ev.t === 'heal') Sound.sfx('heal');
    if (ev.t === 'pickup' || ev.t === 'extract') Sound.sfx('click');
    if (ev.t === 'alert') { for (const id of ev.ids) { if (d[id]) d[id].alert = true; float(at(id), '!', '#f0a24a', 24); } }
    if (ev.t === 'spawn') { d[ev.unit.id] = { x: ev.unit.x, y: ev.unit.y, hp: ev.unit.hp, downed: false, dead: false, gone: false, spawned: true }; }
    if (ev.t === 'tag') float(at(ev.id), ev.text, '#ebdfc4');
    if (ev.t === 'pickup') float(iso(ev.x, ev.y), ev.text, '#f0a24a');
    if (ev.t === 'surrender') float(at(ev.id), 'Surrenders', '#ebdfc4');
    if (ev.t === 'wreck') { float(iso(ev.x, ev.y), ev.text, '#ff8a5c', 17); showSay(ev.text + '!', true); }
    if (ev.t === 'flee') float(at(ev.id), 'Flees', '#ebdfc4');
    if (ev.t === 'bleed') float(at(ev.id), `Bleeding · ${ev.bleed}`, '#e07a5f');
    if (ev.t === 'carry') { if (d[ev.who]) d[ev.who].gone = true; float(at(ev.id), 'Carrying', '#ebdfc4'); }
    if (ev.t === 'heal') float(at(ev.id), `+${Math.max(0, ev.hpAfter - (d[ev.id] ? d[ev.id].hp : 0))}`, '#9fd18b');
    if (ev.t === 'over') animating = true;
  }
  function end(ev) {
    const d = disp;
    if (ev.t === 'move' && d[ev.id]) { const [x, y] = ev.path[ev.path.length - 1]; d[ev.id].x = x; d[ev.id].y = y; }
    if (ev.t === 'down' || ev.t === 'die') Sound.sfx('down');
    if (ev.t === 'down' && d[ev.id]) { d[ev.id].downed = true; d[ev.id].hp = 0; float(iso(d[ev.id].x, d[ev.id].y), `Down · ${ev.bleed} turns`, '#e07a5f'); }
    if (ev.t === 'die' && d[ev.id]) { d[ev.id].dead = true; float(iso(d[ev.id].x, d[ev.id].y), ev.bled ? 'Bled out' : 'Killed', '#e07a5f'); }
    if (ev.t === 'revive' && d[ev.id]) { d[ev.id].downed = false; d[ev.id].hp = ev.hpAfter; float(iso(d[ev.id].x, d[ev.id].y), 'Back up', '#9fd18b'); }
    if (ev.t === 'heal' && d[ev.id]) d[ev.id].hp = ev.hpAfter;
    if (ev.t === 'extract' && d[ev.id]) { d[ev.id].gone = true; if (ev.who && d[ev.who]) d[ev.who].gone = true; }
    if (ev.t === 'drop' && d[ev.id]) { d[ev.id].gone = false; d[ev.id].x = ev.x; d[ev.id].y = ev.y; }
    if ((ev.t === 'surrender' || ev.t === 'flee') && d[ev.id]) d[ev.id].gone = true;
    if (ev.t === 'alert') for (const id of ev.ids) if (d[id]) d[id].alert = false;
  }
  function shotMid(ev) {
    const d = disp[ev.to];
    if (!d) return;
    const p = iso(d.x, d.y);
    Sound.sfx(ev.hit ? 'hit' : 'miss');
    const from = disp[ev.from] ? iso(disp[ev.from].x, disp[ev.from].y) : p, dir = Math.sign(p.x - from.x) || 1;
    if (ev.hit) { burst(p.x, p.y - 26, dir, 7 + (ev.crit ? 6 : 0), ['#9a2a1e', '#c0442a', '#5a1410']); if (ev.crit) shake = 160; d.hitAt = performance.now(); d.hitDir = dir; }
    else burst(p.x + dir * 10 + (Math.random() - 0.5) * 20, p.y + 2, 0, 6, ['#8a7a64', '#6a5c4a', '#a8987e'], true);
    if (ev.hit) { d.hp = ev.hpAfter; float(p, `${ev.crit ? 'Crit ' : ''}−${ev.dmg}`, ev.crit ? '#ffcf6b' : '#ff9c84', ev.crit ? 20 : 17); }
    else float(p, 'Miss', '#cfc3a8');
  }
  // Pixel particles: blood, dust, sparks and smoke.
  let parts = [], shake = 0;
  function burst(x, y, dir, n, cols, dust = false) {
    for (let i = 0; i < n; i++) parts.push({ x, y, vx: dir * (30 + Math.random() * 70) + (Math.random() - 0.5) * 50, vy: dust ? -20 - Math.random() * 30 : -40 - Math.random() * 60, g: dust ? 40 : 260, life: 0, max: dust ? 520 : 420, c: cols[i % cols.length], s: dust ? 3 : 2 });
  }
  function puff(x, y) { for (let i = 0; i < 4; i++) parts.push({ x, y, vx: (Math.random() - 0.3) * 20, vy: -10 - Math.random() * 14, g: -6, life: 0, max: 600, c: '#cfc6b4', s: 3, smoke: true }); }
  function float(p, text, color, size = 15) { floats.push({ x: p.x, y: p.y - 46, text, color, size, t: 0 }); }

  // ---------- drawing ----------
  function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.min(255, Math.max(0, Math.round(((n >> 16) & 255) * f))), g = Math.min(255, Math.max(0, Math.round(((n >> 8) & 255) * f))), bl = Math.min(255, Math.max(0, Math.round((n & 255) * f)));
    return `rgb(${r},${g},${bl})`;
  }
  // A hex outline (the name stays from the square-grid days).
  function diamond(c, inset = 0) {
    const a = HA - inset, r = HR - inset * 0.75;
    ctx.beginPath();
    ctx.moveTo(c.x, c.y - r); ctx.lineTo(c.x + a, c.y - r / 2); ctx.lineTo(c.x + a, c.y + r / 2);
    ctx.lineTo(c.x, c.y + r); ctx.lineTo(c.x - a, c.y + r / 2); ctx.lineTo(c.x - a, c.y - r / 2); ctx.closePath();
  }
  // A hex prism with textured faces, shaded sides, and a pencil outline (fallback before the art loads).
  function block(c, h, base, inset = 0, alpha = 1, tex = null, topTex = null) {
    ctx.globalAlpha = alpha;
    const hw = HA - inset * 2, hh = HR - inset * 1.5;
    const left = () => { ctx.beginPath(); ctx.moveTo(c.x - hw, c.y + hh / 2); ctx.lineTo(c.x, c.y + hh); ctx.lineTo(c.x, c.y + hh - h); ctx.lineTo(c.x - hw, c.y + hh / 2 - h); ctx.closePath(); };
    const right = () => { ctx.beginPath(); ctx.moveTo(c.x + hw, c.y + hh / 2); ctx.lineTo(c.x, c.y + hh); ctx.lineTo(c.x, c.y + hh - h); ctx.lineTo(c.x + hw, c.y + hh / 2 - h); ctx.closePath(); };
    const top = () => { ctx.beginPath(); ctx.moveTo(c.x, c.y - hh - h); ctx.lineTo(c.x + hw, c.y - hh / 2 - h); ctx.lineTo(c.x + hw, c.y + hh / 2 - h); ctx.lineTo(c.x, c.y + hh - h); ctx.lineTo(c.x - hw, c.y + hh / 2 - h); ctx.lineTo(c.x - hw, c.y - hh / 2 - h); ctx.closePath(); };
    left(); ctx.fillStyle = tex ? Paint.pattern(ctx, tex, 64, 11) : shade(base, 0.72); ctx.fill();
    if (tex) { ctx.fillStyle = 'rgba(12,8,5,0.22)'; ctx.fill(); }
    right(); ctx.fillStyle = tex ? Paint.pattern(ctx, tex, 64, 11) : shade(base, 0.55); ctx.fill();
    ctx.fillStyle = tex ? 'rgba(12,8,5,0.48)' : 'rgba(0,0,0,0)'; ctx.fill();
    if (h > 14) { ctx.save(); right(); ctx.clip(); Paint.hatch(ctx, c.x, c.y - h - hh, hw, h + hh * 2, { spacing: 4, alpha: 0.18, seed: Math.round(c.x + c.y) }); ctx.restore(); }
    top(); ctx.fillStyle = topTex ? Paint.pattern(ctx, topTex, 64, 12) : shade(base, 1.08); ctx.fill();
    if (topTex) { ctx.fillStyle = 'rgba(255,235,200,0.06)'; ctx.fill(); }
    ctx.strokeStyle = 'rgba(18,12,8,.8)'; ctx.lineWidth = 1.2;
    left(); ctx.stroke(); right(); ctx.stroke(); top(); ctx.stroke();
    ctx.globalAlpha = 1;
  }
  // The floor never changes during a battle: paint it once.
  let floorCache = null, vignette = null;
  function drawFloor() {
    const bd = bounds();
    if (!floorCache || floorCache.b !== b) {
      const RES = Art.PX, w = bd.maxX - bd.minX + 200, h = bd.maxY - bd.minY + 200;
      const c = document.createElement('canvas'); c.width = Math.ceil(w * RES); c.height = Math.ceil(h * RES);
      const g = c.getContext('2d'); g.scale(RES, RES); g.translate(100 - bd.minX, 100 - bd.minY);
      const prev = ctx; ctx = g; paintFloor(); bakeWash(); ctx = prev;
      Art.quantize(c, 40);
      floorCache = { b, c, x: bd.minX - 100, y: bd.minY - 100, w, h };
    }
    Art.blit(ctx, floorCache.c, floorCache.x, floorCache.y, floorCache.w, floorCache.h);
  }
  // The ground: one continuous surface with large soft patches, wear, stones and stains, a faint
  // hex grid on top, and every prop seated into it with contact shade, a cast shadow and debris.
  function paintFloor() {
    const pal = THEME[b.theme] || THEME.combat;
    const paved = b.theme === 'elite' || b.theme === 'warlord';
    let sd = 7 + b.floor.reduce((a, v, i) => (a + v * (i + 3)) % 2147483000, 0);
    const rnd = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
    const bd = bounds();
    const all = () => { ctx.beginPath(); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const c = iso(x, y); ctx.moveTo(c.x, c.y - HR); ctx.lineTo(c.x + HA, c.y - HR / 2); ctx.lineTo(c.x + HA, c.y + HR / 2); ctx.lineTo(c.x, c.y + HR); ctx.lineTo(c.x - HA, c.y + HR / 2); ctx.lineTo(c.x - HA, c.y - HR / 2); ctx.closePath(); } };
    // the ground is a plain rectangle with frayed, darkening edges (the hexes only exist for moving)
    const gx0 = -HA, gx1 = (W - 1) * TW + HA + HA, gy0 = -HR - 6, gy1 = (H - 1) * ROWH + HR + 6;
    ctx.save(); ctx.beginPath();
    ctx.moveTo(gx0, gy0); for (let x = gx0; x <= gx1; x += 16) ctx.lineTo(x, gy0 + (rnd() - 0.5) * 6);
    for (let y = gy0; y <= gy1; y += 16) ctx.lineTo(gx1 + (rnd() - 0.5) * 6, y);
    for (let x = gx1; x >= gx0; x -= 16) ctx.lineTo(x, gy1 + (rnd() - 0.5) * 6);
    for (let y = gy1; y >= gy0; y -= 16) ctx.lineTo(gx0 + (rnd() - 0.5) * 6, y);
    ctx.closePath(); ctx.clip();
    ctx.fillStyle = Paint.pattern(ctx, paved ? 'asphalt' : 'ground', 128, 21); ctx.fillRect(bd.minX, bd.minY, bd.maxX - bd.minX, bd.maxY - bd.minY + 60);
    ctx.fillStyle = pal[0]; ctx.globalAlpha = 0.35; ctx.fillRect(bd.minX, bd.minY, bd.maxX - bd.minX, bd.maxY - bd.minY + 60); ctx.globalAlpha = 1;
    // big soft patches of darker and paler ground, so the floor reads as terrain rather than tiles
    for (let i = 0; i < 16; i++) {
      const x = bd.minX + rnd() * (bd.maxX - bd.minX), y = bd.minY + rnd() * (bd.maxY - bd.minY), rad = 70 + rnd() * 150, dark = rnd() < 0.55;
      const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
      g.addColorStop(0, dark ? 'rgba(25,16,10,0.28)' : 'rgba(210,180,140,0.14)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.save(); ctx.translate(x, y); ctx.scale(1, 0.62); ctx.translate(-x, -y); ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2); ctx.restore();
    }
    // old tyre tracks or a worn footpath crossing the map
    for (let k = 0; k < (paved ? 1 : 2); k++) {
      const y0 = bd.minY + (0.2 + rnd() * 0.6) * (bd.maxY - bd.minY), y1 = y0 + (rnd() - 0.5) * 220;
      for (const off of [-9, 9]) { ctx.strokeStyle = paved ? 'rgba(10,8,6,0.16)' : 'rgba(30,20,12,0.15)'; ctx.lineWidth = paved ? 12 : 6; ctx.beginPath(); ctx.moveTo(bd.minX - 20, y0 + off); ctx.bezierCurveTo(bd.minX + 200, y0 + off + 60, bd.maxX - 200, y1 + off - 60, bd.maxX + 20, y1 + off); ctx.stroke(); }
    }
    // small details per hex: stones, cracks, weeds, stains, the odd puddle
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const c = iso(x, y);
      for (let k = 0, n = 2 + Math.floor(rnd() * 5); k < n; k++) { const px = c.x + (rnd() - 0.5) * 54, py = c.y + (rnd() - 0.5) * 36, s2 = 1 + rnd() * 1.8; ctx.fillStyle = rnd() < 0.5 ? 'rgba(30,22,16,0.55)' : 'rgba(190,170,140,0.45)'; ctx.fillRect(px, py, s2 * 1.6, s2); }
      if (rnd() < 0.18) { ctx.strokeStyle = 'rgba(20,14,10,0.45)'; ctx.lineWidth = 1; ctx.beginPath(); let px = c.x + (rnd() - 0.5) * 40, py = c.y + (rnd() - 0.5) * 24; ctx.moveTo(px, py); for (let j = 0; j < 4; j++) { px += 4 + rnd() * 7; py += (rnd() - 0.5) * 7; ctx.lineTo(px, py); } ctx.stroke(); }
      if (!paved && rnd() < 0.2) { const px = c.x + (rnd() - 0.5) * 44, py = c.y + (rnd() - 0.5) * 28; ctx.strokeStyle = rnd() < 0.5 ? '#5d6036' : '#6e6638'; ctx.lineWidth = 1; for (let j = 0; j < 5; j++) { ctx.beginPath(); ctx.moveTo(px + j * 1.4, py); ctx.lineTo(px + j * 1.4 + (rnd() - 0.5) * 4, py - 3 - rnd() * 4); ctx.stroke(); } }
      if (rnd() < 0.07) { const px = c.x + (rnd() - 0.5) * 30, py = c.y + (rnd() - 0.5) * 18; ctx.fillStyle = 'rgba(12,8,6,0.25)'; ctx.beginPath(); ctx.ellipse(px, py, 8 + rnd() * 8, 4 + rnd() * 3, 0, 0, 7); ctx.fill(); }
      if (rnd() < 0.04) { const px = c.x + (rnd() - 0.5) * 24, py = c.y + (rnd() - 0.5) * 12, rw = 10 + rnd() * 10; ctx.fillStyle = 'rgba(40,50,56,0.7)'; ctx.beginPath(); ctx.ellipse(px, py, rw, rw * 0.42, 0, 0, 7); ctx.fill(); ctx.strokeStyle = 'rgba(180,200,210,0.35)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(px - 2, py - 1, rw * 0.6, rw * 0.2, 0, Math.PI * 1.1, Math.PI * 1.7); ctx.stroke(); }
    }
    // seat every prop: contact shade, a soft shadow cast down and to the right, and its own debris
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = TAC.idx(x, y), cvr = b.cover[i];
      if (!cvr) continue;
      const pr = b.prop[i], c = iso(x, y), tall = cvr === 2 ? (pr === 6 ? 36 : WALL) : HALF;
      const steps = Math.round(tall / 5);
      for (let k = 1; k <= steps; k++) {
        const t = k / steps, ox = t * tall * 0.45, oy = t * tall * 0.22;
        if (cvr === 2 && pr !== 5) {
          ctx.strokeStyle = ctx.fillStyle = `rgba(8,5,3,${0.08 * (1 - t * 0.6)})`; ctx.lineWidth = pr === 4 ? 22 : 13; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.arc(c.x + ox, c.y + oy, pr === 4 ? 4 : 8, 0, 7); ctx.fill();
          for (const [nx, ny] of TAC.nbrs(x, y)) if (nx >= 0 && ny >= 0 && nx < W && ny < H && b.cover[TAC.idx(nx, ny)] === 2) { const n2 = iso(nx, ny); ctx.beginPath(); ctx.moveTo(c.x + ox, c.y + oy); ctx.lineTo((c.x + n2.x) / 2 + ox, (c.y + n2.y) / 2 + oy); ctx.stroke(); }
        } else { ctx.fillStyle = `rgba(8,5,3,${0.07 * (1 - t * 0.6)})`; ctx.beginPath(); ctx.ellipse(c.x + t * tall * 0.5, c.y + 4 + t * tall * 0.2, 24, 11, 0, 0, 7); ctx.fill(); }
      }
      const g = ctx.createRadialGradient(c.x, c.y + 2, 4, c.x, c.y + 2, 40);
      g.addColorStop(0, 'rgba(10,6,4,0.45)'); g.addColorStop(1, 'rgba(10,6,4,0)');
      ctx.fillStyle = g; ctx.save(); ctx.translate(c.x, c.y); ctx.scale(1, 0.6); ctx.translate(-c.x, -c.y); ctx.fillRect(c.x - 40, c.y - 40, 80, 80); ctx.restore();
      const chips = (n, cols, spread, sz) => { for (let k = 0; k < n; k++) { const a = rnd() * Math.PI * 2, d2 = 18 + rnd() * spread; ctx.fillStyle = cols[k % cols.length]; ctx.fillRect(c.x + Math.cos(a) * d2, c.y + 6 + Math.sin(a) * d2 * 0.55, sz + rnd() * sz, sz * 0.7 + rnd()); } };
      if (cvr === 2 && pr === 0) chips(9, ['#8a5440', '#6a4030', '#a8a090'], 18, 2.4);
      else if (cvr === 2 && pr === 1) chips(9, ['#8a867c', '#6e6a62', '#b4b0a4'], 18, 2.2);
      else if (cvr === 2 && pr === 6) chips(6, ['#7a5a38', '#5a4028'], 14, 2.6);
      else if (cvr === 1 && pr === 2) { for (let k = 0; k < 4; k++) { ctx.fillStyle = `rgba(176,156,110,${0.35 + rnd() * 0.25})`; ctx.beginPath(); ctx.ellipse(c.x + (rnd() - 0.5) * 50, c.y + 10 + rnd() * 6, 5 + rnd() * 6, 2 + rnd() * 2, 0, 0, 7); ctx.fill(); } }
      else if (cvr === 1 && pr === 1) { ctx.fillStyle = 'rgba(14,10,8,0.4)'; ctx.beginPath(); ctx.ellipse(c.x + 6, c.y + 8, 18, 6, 0, 0, 7); ctx.fill(); ctx.fillStyle = 'rgba(120,50,20,0.3)'; ctx.beginPath(); ctx.ellipse(c.x - 10, c.y + 9, 6, 2.4, 0, 0, 7); ctx.fill(); }
      else if (cvr === 1 && pr === 0) chips(6, ['#b09a6a', '#8a6a42'], 14, 2.6);
      else if (cvr === 1 && pr === 3) chips(10, ['#8a8478', '#9a6448', '#5e5a52'], 16, 2);
    }
    // darken toward the edges so the map fades into the wastes
    for (const [x0, y0, x1, y1] of [[gx0, 0, gx0 + 40, 0], [gx1, 0, gx1 - 40, 0], [0, gy0, 0, gy0 + 34], [0, gy1, 0, gy1 - 34]]) {
      const g = ctx.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, 'rgba(8,5,3,0.55)'); g.addColorStop(1, 'rgba(8,5,3,0)');
      ctx.fillStyle = g; ctx.fillRect(gx0, gy0, gx1 - gx0, gy1 - gy0);
    }
    ctx.restore();
    // No grid on the ground: hexes show only where you can move. Zones are soft painted areas.
    const zone = (rows, color) => {
      const top = iso(0, H - rows).y - HR, g = ctx.createLinearGradient(0, top, 0, top + 40);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, color);
      ctx.fillStyle = g; ctx.fillRect(gx0, top, gx1 - gx0, gy1 - top);
    };
    if (b.kind !== 'raid') zone(TAC.EXTRACT_ROWS, 'rgba(110,160,90,.24)'); else zone(6, 'rgba(240,162,74,.07)');
    const lc = iso(0, H - 1);
    ctx.save(); ctx.font = '600 13px "IBM Plex Mono", monospace'; ctx.textAlign = 'center';
    if (b.kind === 'raid') { ctx.fillStyle = 'rgba(240,190,120,.8)'; ctx.fillText('THE WAYSTATION', lc.x + 40, lc.y + HR + 18); const tc = iso(0, 0); ctx.fillStyle = 'rgba(220,150,120,.7)'; ctx.fillText('THE WASTES', tc.x + 40, tc.y - HR - 8); }
    else { ctx.fillStyle = 'rgba(170,210,150,.75)'; ctx.fillText('EXTRACTION', lc.x + 30, lc.y + HR + 18); }
    ctx.restore();
  }
  function drawHighlights() {
    const u = selected();
    if (!u || busy() || u.ap <= 0 || u.carriedBy) return;
    const rc = reach();
    for (const t of rc.tiles) {
      const c = iso(t.x, t.y);
      diamond(c, 2);
      ctx.fillStyle = t.ap === 1 ? 'rgba(120,175,225,.32)' : 'rgba(240,190,90,.26)';
      ctx.fill();
      if (t.ap === 2) { ctx.strokeStyle = 'rgba(240,190,90,.55)'; ctx.lineWidth = 1; ctx.stroke(); }
    }
    // Selected unit ring
    const d = disp[u.id];
    if (d) { const c = iso(d.x, d.y); ctx.strokeStyle = '#f0a24a'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.ellipse(c.x, c.y, 20, 10, 0, 0, Math.PI * 2); ctx.stroke(); }
    const p = pending || hover;
    if (p && rc.tiles.some((t) => t.x === p.x && t.y === p.y)) {
      const path = [[u.x, u.y], ...TAC.pathTo(rc.raw, p.x, p.y)];
      ctx.strokeStyle = pending ? '#f0a24a' : 'rgba(240,162,74,.6)'; ctx.lineWidth = 3; ctx.setLineDash([6, 5]);
      ctx.beginPath(); path.forEach(([x, y], i) => { const c = iso(x, y); i ? ctx.lineTo(c.x, c.y) : ctx.moveTo(c.x, c.y); }); ctx.stroke(); ctx.setLineDash([]);
      const c = iso(p.x, p.y); diamond(c, 1); ctx.strokeStyle = '#f0a24a'; ctx.lineWidth = 2; ctx.stroke();
      // Cover shields on the tile's edges.
      for (const [nx, ny] of TAC.nbrs(p.x, p.y)) {
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const cv2 = b.cover[TAC.idx(nx, ny)] || 0;
        if (!cv2) continue;
        const a = iso(p.x, p.y), n = iso(nx, ny);
        shield((a.x + n.x) / 2, (a.y + n.y) / 2 - 14, cv2);
      }
    }
  }
  function shield(x, y, level) {
    ctx.save(); ctx.translate(x, y);
    const h = level === 2 ? 18 : 11;
    ctx.fillStyle = level === 2 ? '#7fb2e0' : '#c9d9e8'; ctx.strokeStyle = '#1b1510'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(-6, -h); ctx.lineTo(6, -h); ctx.lineTo(6, 0); ctx.quadraticCurveTo(0, 6, 0, 6); ctx.quadraticCurveTo(0, 6, -6, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  // Two rusted drums standing together.
  function barrels(c) {
    for (const [dx, dy, hue] of [[-7, -2, '#5e6a5a'], [7, 3, '#6b4e3a']]) {
      const bx = c.x + dx, by = c.y + dy, rw = 8, hgt = 20;
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(bx, by, rw + 2, 3.5, 0, 0, 7); ctx.fill();
      ctx.fillStyle = hue; ctx.fillRect(bx - rw, by - hgt, rw * 2, hgt);
      ctx.fillStyle = Paint.pattern(ctx, 'metal', 48, 13); ctx.globalAlpha = 0.45; ctx.fillRect(bx - rw, by - hgt, rw * 2, hgt); ctx.globalAlpha = 1;
      const g = ctx.createLinearGradient(bx - rw, 0, bx + rw, 0); g.addColorStop(0, 'rgba(255,235,200,0.12)'); g.addColorStop(0.6, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.4)');
      ctx.fillStyle = g; ctx.fillRect(bx - rw, by - hgt, rw * 2, hgt);
      ctx.strokeStyle = 'rgba(15,10,6,0.6)'; ctx.lineWidth = 1; for (const ry of [6, 13]) { ctx.beginPath(); ctx.moveTo(bx - rw, by - ry); ctx.lineTo(bx + rw, by - ry); ctx.stroke(); }
      ctx.fillStyle = Paint.shade(hue, 1.15); ctx.beginPath(); ctx.ellipse(bx, by - hgt, rw, 3, 0, 0, 7); ctx.fill();
      ctx.strokeStyle = '#17110c'; ctx.lineWidth = 1.2; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(bx - rw, by - hgt); ctx.lineTo(bx - rw, by); ctx.moveTo(bx + rw, by - hgt); ctx.lineTo(bx + rw, by); ctx.stroke();
    }
  }
  // Cover blocks are cached as sprites per kind; walls in front of people fade.
  const coverSprites = new Map();
  const SP = { w: 100, h: 125, ox: 50, oy: 75 }; // matches Structures: 128 x 160 px
  // Walls are drawn as runs to wall neighbours plus a pier; movement stays on hexes underneath.
  function wallNb(x, y) {
    const odd = y & 1;
    return { W: [x - 1, y], NW: [odd ? x : x - 1, y - 1], NE: [odd ? x + 1 : x, y - 1] };
  }
  const isWall = (x, y) => x >= 0 && y >= 0 && x < W && y < H && b.cover[TAC.idx(x, y)] === 2 && b.prop[TAC.idx(x, y)] !== 4;
  function tinted(key, img, w, h, tint) {
    let c = coverSprites.get(key);
    if (c) return c;
    c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    if (tint) { g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(12,18,40,0.4)'; g.fillRect(0, 0, c.width, c.height); }
    coverSprites.set(key, c);
    return c;
  }
  // The wall graph: which wall hexes join, with corner triangles broken so walls never double
  // back on themselves, and one material per connected wall so joints match.
  let wallG = null;
  function wallGraph() {
    const sig = b.cover.join('') + b.prop.join('');
    if (wallG && wallG.b === b && wallG.sig === sig) return wallG;
    const key = (x, y) => y * W + x, edges = new Set(), adj = new Map();
    const ek = (a, c) => (a < c ? `${a}-${c}` : `${c}-${a}`);
    const nodes = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (isWall(x, y)) nodes.push([x, y]);
    for (const [x, y] of nodes) { adj.set(key(x, y), []); }
    for (const [x, y] of nodes) for (const [nx, ny] of TAC.nbrs(x, y)) if (isWall(nx, ny)) { edges.add(ek(key(x, y), key(nx, ny))); adj.get(key(x, y)).push(key(nx, ny)); }
    const deg = (k) => adj.get(k).filter((o) => edges.has(ek(k, o))).length;
    // break each triangle: keep the edge within a row and the diagonal to the run's loose end
    for (const [x, y] of nodes) {
      const a = key(x, y);
      for (const c of adj.get(a)) for (const d of adj.get(a)) {
        if (c >= d || !edges.has(ek(a, c)) || !edges.has(ek(a, d)) || !edges.has(ek(c, d))) continue;
        const tri = [a, c, d], row = (k) => Math.floor(k / W);
        const lone = tri.find((k) => tri.filter((o) => row(o) === row(k)).length === 1);
        const pair = tri.filter((k) => k !== lone);
        const keep = deg(pair[0]) <= deg(pair[1]) ? pair[0] : pair[1];
        edges.delete(ek(lone, pair[0] === keep ? pair[1] : pair[0]));
      }
    }
    // one material per wall
    const kindOf = new Map(), seen = new Set();
    for (const [x, y] of nodes) {
      const s0 = key(x, y);
      if (seen.has(s0)) continue;
      const comp = [s0], q = [s0]; seen.add(s0);
      while (q.length) { const k = q.pop(); for (const o of adj.get(k)) if (edges.has(ek(k, o)) && !seen.has(o)) { seen.add(o); comp.push(o); q.push(o); } }
      const votes = {};
      for (const k of comp) { const kd = Structures.KIND(2, b.prop[k]); votes[kd] = (votes[kd] || 0) + 1; }
      const pick = Object.entries(votes).sort((m, n) => n[1] - m[1] || (m[0] < n[0] ? -1 : 1))[0][0];
      for (const k of comp) kindOf.set(k, pick);
    }
    wallG = { b, sig, has: (x1, y1, x2, y2) => edges.has(ek(key(x1, y1), key(x2, y2))), kindOf, links: (x, y) => adj.get(key(x, y)).filter((o) => edges.has(ek(key(x, y), o))).map((o) => [o % W, Math.floor(o / W)]) };
    return wallG;
  }
  function drawWall(x, y, kind, behind) {
    const c = iso(x, y), raid = b.kind === 'raid', v = (x * 7 + y * 13) % 3;
    const ox = Structures.OX, oy = Structures.OY, rw = Structures.RW, rh = Structures.RH;
    if (behind) ctx.globalAlpha = 0.42;
    let drawn = false;
    if (kind === 'building') {
      const img = Structures.runImg('building', 'W', v);
      if (img) { Art.blit(ctx, tinted(`run|building|${v}`, img, rw, rh, false), c.x + 32 - ox, c.y - oy, rw, rh); drawn = true; }
    } else {
      const G = wallGraph(), links = G.links(x, y);
      kind = G.kindOf.get(TAC.idx(x, y)) || kind;
      // every arm that meets here, back ones first, so the joint is drawn by one hex in one pass
      const arms = links.map(([nx, ny]) => { const n = iso(nx, ny), dx = n.x - c.x, dy = n.y - c.y; return { dir: dy < -1 ? (dx < 0 ? 'NW' : 'NE') : dy > 1 ? (dx < 0 ? 'SW' : 'SE') : (dx < 0 ? 'W' : 'E'), dy }; }).sort((p, q) => p.dy - q.dy);
      for (const { dir, dy } of arms) {
        const cap = arms.length === 1 && dy < 0; // a wall that ends here shows its cut end
        const img = Structures.runImg(kind, dir, v, cap);
        if (img) { Art.blit(ctx, tinted(`run|${kind}|${dir}|${v}|${cap}|${raid}`, img, rw, rh, raid), c.x - ox, c.y - oy, rw, rh); drawn = true; }
      }
      // a free-standing stub when the wall has no neighbours at all; joints need no post
      if (!links.length) {
        const pi = Structures.pierImg(kind, v, true);
        if (pi) { Art.blit(ctx, tinted(`pier|${kind}|${v}|true|${raid}`, pi, rw, rh, raid), c.x - ox, c.y - oy, rw, rh); drawn = true; }
      }
    }
    ctx.globalAlpha = 1;
    return drawn;
  }
  function drawCover(x, y, behind) {
    const i = TAC.idx(x, y), cvr = b.cover[i];
    if (!cvr) return;
    const pr = b.prop[i], c = iso(x, y);
    const kind = Structures.KIND(cvr, pr);
    if (kind && drawWall(x, y, kind, behind)) return;
    const variant = (x * 7 + y * 13) % 3;
    const art = Structures.tile(cvr, pr, variant);
    const key = `${cvr}|${pr}|${b.theme}|${b.kind === 'raid'}|${art ? 'a' + variant : ''}`;
    let spr = coverSprites.get(key);
    if (!spr) {
      const RES = Art.PX;
      spr = document.createElement('canvas'); spr.width = SP.w * RES; spr.height = SP.h * RES;
      const g = spr.getContext('2d'); g.scale(RES, RES);
      const prev = ctx; ctx = g;
      g.imageSmoothingEnabled = false;
      if (art) g.drawImage(art, 0, 0, SP.w, SP.h); else { paintCover(cvr, pr, { x: SP.ox, y: SP.oy }); Art.quantize(spr, 16); }
      if (b.kind === 'raid' && pr !== 4) { g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(12,18,40,0.4)'; g.fillRect(0, 0, SP.w, SP.h); g.globalCompositeOperation = 'source-over'; }
      ctx = prev;
      coverSprites.set(key, spr);
    }
    if (behind && cvr === 2) ctx.globalAlpha = 0.42;
    Art.blit(ctx, spr, c.x - SP.ox, c.y - SP.oy, SP.w, SP.h);
    ctx.globalAlpha = 1;
  }
  function paintCover(cvr, pr, c) {
    const behind = false;
    if (cvr === 2 && pr === 4) {
      block(c, 34, '#7b5a3e', 1, behind ? 0.42 : 1, 'brick', 'metal');
      if (!behind) {
        const glow = 0.9;
        ctx.fillStyle = `rgba(240,170,80,${glow})`;
        ctx.fillRect(c.x - 20, c.y - 22, 7, 8); ctx.fillRect(c.x - 9, c.y - 16, 7, 8);
        ctx.fillStyle = '#4a3324'; ctx.beginPath(); ctx.moveTo(c.x, c.y - 16 - 34); ctx.lineTo(c.x + 32, c.y - 34); ctx.lineTo(c.x, c.y + 16 - 34 - 6); ctx.lineTo(c.x - 32, c.y - 34); ctx.closePath(); ctx.fill();
      }
      return;
    }
    if (pr === 5) { block(c, 8, '#4e4034', 3, 1, 'dirt', 'dirt'); ctx.fillStyle = 'rgba(255,120,60,.35)'; ctx.fillRect(c.x - 6, c.y - 12, 4, 3); return; }
    if (cvr === 2 && pr === 6) {
      block(c, WALL - 6, '#6a5236', 2, behind ? 0.42 : 1, 'planks', 'planks');
      if (!behind) { ctx.strokeStyle = 'rgba(30,20,12,.5)'; ctx.lineWidth = 1; for (let k = -24; k < 0; k += 6) { ctx.beginPath(); ctx.moveTo(c.x + k, c.y + (k + 32) / 2 - 16); ctx.lineTo(c.x + k, c.y + (k + 32) / 2 - 16 - WALL + 8); ctx.stroke(); } }
      return;
    }
    if (cvr === 2) {
      block(c, WALL, pr ? '#6d6257' : '#7a5a45', 0, behind ? 0.42 : 1, pr ? 'concrete' : 'brick', pr ? 'concrete' : 'plaster');
    } else if (pr === 3) block(c, 9, '#5d5348', 4, 1, 'dirt', 'dirt');
    else if (pr === 1) barrels(c);
    else if (pr === 2) block(c, HALF - 2, '#8a7a5a', 3, 1, 'ground', 'ground');
    else block(c, HALF, '#8a6340', 6, 1, 'planks', 'planks');
  }
  function drawTower(x, y) {
    const c = iso(x, y);
    // a square plank platform on four posts with a rail
    const P4 = [[-22, 0], [0, -12], [22, 0], [0, 12]];
    ctx.lineCap = 'round';
    for (const [dx, dy] of P4) { ctx.strokeStyle = '#1b130d'; ctx.lineWidth = 4.4; ctx.beginPath(); ctx.moveTo(c.x + dx, c.y + dy); ctx.lineTo(c.x + dx, c.y + dy - LIFT); ctx.stroke(); ctx.strokeStyle = '#6a4a30'; ctx.lineWidth = 2.6; ctx.stroke(); }
    ctx.beginPath(); P4.forEach(([dx, dy], k) => (k ? ctx.lineTo : ctx.moveTo).call(ctx, c.x + dx * 1.15, c.y + dy * 1.15 - LIFT)); ctx.closePath();
    ctx.fillStyle = Paint.pattern(ctx, 'planks', 64, 4); ctx.fill(); ctx.fillStyle = 'rgba(122,90,56,0.35)'; ctx.fill(); ctx.strokeStyle = '#1b130d'; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.strokeStyle = '#5a4030'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(c.x - 25, c.y - LIFT - 9); ctx.lineTo(c.x, c.y - 14 - LIFT - 9); ctx.lineTo(c.x + 25, c.y - LIFT - 9); ctx.stroke();
    for (const [dx, dy] of [[-25, 0], [0, -14], [25, 0]]) { ctx.beginPath(); ctx.moveTo(c.x + dx, c.y + dy - LIFT); ctx.lineTo(c.x + dx, c.y + dy - LIFT - 9); ctx.stroke(); }
  }
  function drawObj(x, y) {
    for (const o of b.objs) {
      if (o.x !== x || o.y !== y || o.done) continue;
      const c = iso(x, y);
      if (o.type === 'cache') {
        const glow = 0.5 + 0.5 * Math.sin(performance.now() / 300);
        ctx.fillStyle = `rgba(240,162,74,${0.18 + glow * 0.15})`; ctx.beginPath(); ctx.ellipse(c.x, c.y, 24, 12, 0, 0, Math.PI * 2); ctx.fill();
        block(c, 12, b.theme === 'elite' ? '#8b7d92' : '#a77b3c', 8);
        ctx.fillStyle = '#f0a24a'; ctx.fillRect(c.x - 2, c.y - 17, 4, 4);
      } else if (o.type === 'survivor') {
        if (o.lost) { ctx.fillStyle = 'rgba(30,20,15,.6)'; ctx.beginPath(); ctx.ellipse(c.x, c.y, 14, 6, 0, 0, Math.PI * 2); ctx.fill(); continue; }
        ctx.fillStyle = '#d6c08a'; ctx.beginPath(); ctx.ellipse(c.x, c.y - 9, 7, 10, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#e0b48a'; ctx.beginPath(); ctx.arc(c.x, c.y - 22, 5, 0, Math.PI * 2); ctx.fill();
        const f = 0.5 + 0.5 * Math.sin(performance.now() / 160);
        ctx.fillStyle = `rgba(255,90,60,${0.5 + f * 0.5})`; ctx.beginPath(); ctx.arc(c.x + 9, c.y - 26, 3, 0, Math.PI * 2); ctx.fill();
      }
    }
  }
  function unitPos(u) {
    const d = disp[u.id];
    let p = iso(d.x, d.y), hx = d.x, hy = d.y;
    if (cur && cur.t === 'move' && cur.id === u.id) {
      const path = cur.path, f = Math.min(1, curT / eventDur(cur)) * (path.length - 1);
      const i = Math.min(path.length - 2, Math.floor(f)), k = f - i;
      if (path.length > 1) {
        const a = iso(path[i][0], path[i][1]), c = iso(path[i + 1][0], path[i + 1][1]);
        p = { x: a.x + (c.x - a.x) * k, y: a.y + (c.y - a.y) * k };
        [hx, hy] = k < 0.5 ? path[i] : path[i + 1];
      } else p = iso(path[0][0], path[0][1]);
    }
    if (b.height && b.height[TAC.idx(hx, hy)]) p.y -= LIFT;
    return p;
  }
  function shown(u) {
    const d = disp[u.id];
    if (!d || d.gone) return false;
    if (d.dead) return false;
    if (u.side === 'crew') return true;
    if (involved(u.id)) return true;
    return vis().has(u.id);
  }
  function involved(id) {
    if (cur && (cur.id === id || cur.from === id || cur.to === id || (cur.ids && cur.ids.includes(id)))) return true;
    return false;
  }
  function poseOpts(u) {
    const d = disp[u.id];
    const face = d.face || (u.side === 'crew' ? 1 : -1);
    if (u.side === 'crew') return { role: u.kind, outfit: 'crew', facing: face, height: 50 };
    return { outfit: ['raider', 'scav', 'brute', 'marksman'].includes(u.kind) ? u.kind : 'raider', facing: face, height: u.kind === 'brute' ? 60 : 50 };
  }
  function muzzleOf(id) {
    const u = TAC.byId(b, id);
    if (!u || !disp[id] || ['feral', 'hound', 'intake', 'turret'].includes(u.kind)) return { x: 0, y: -24 };
    if (u.kind === 'machine') return { x: (disp[id].face || -1) * 18, y: -26 };
    return Art.muzzle(poseOpts(u));
  }
  // What a unit is doing this frame: pose, offset, fall rotation and fade.
  function animOf(u, now) {
    const d = disp[u.id], a = { pose: 'idle', dx: 0, dy: 0, rot: 0, alpha: 1, flash: 0, frame: 0 };
    a.dy = -Math.sin(now / 900 + u.x * 1.7 + u.y) * 0.35; // breathing
    if (u.ow) a.pose = 'aim';
    if (!cur) return a;
    const dur = eventDur(cur), k = Math.min(1, curT / dur);
    if (cur.t === 'move' && cur.id === u.id) {
      const step = Math.floor(curT / 105) % 4;
      a.pose = ['walk1', 'idle', 'walk2', 'idle'][step]; a.frame = step % 2; a.dy -= step % 2 ? 1 : 0;
    }
    if ((cur.t === 'shot' || cur.t === 'dart') && cur.from === u.id) {
      if (cur.melee) { const t = disp[cur.to]; if (t) { const A = iso(d.x, d.y), Z = iso(t.x, t.y), l = Math.sin(Math.min(1, k / 0.5) * Math.PI) * 0.45; a.dx = (Z.x - A.x) * l; a.dy += (Z.y - A.y) * l; a.frame = 1; } }
      else { a.pose = 'aim'; if (k < 0.14) { a.flash = 1 - k / 0.14; a.dx = -(d.face || 1) * 2 * a.flash; } }
    }
    if (cur.t === 'shot' && cur.to === u.id && cur.hit && k > 0.45 && k < 0.7) { const f = Math.sin((k - 0.45) / 0.25 * Math.PI); a.dx += (d.hitDir || 1) * 4 * f; a.hurt = true; }
    if ((cur.t === 'die' || cur.t === 'down') && cur.id === u.id) {
      const f = Math.min(1, k / 0.6);
      a.rot = f * f * Math.PI / 2; a.dy += 0; a.fall = true;
      if (cur.t === 'die' && k > 0.6) a.alpha = 1 - (k - 0.6) / 0.4;
    }
    return a;
  }
  function drawUnit(u) {
    const d = disp[u.id];
    const c = unitPos(u);
    const now = performance.now();
    const an = animOf(u, now);
    ctx.save(); ctx.translate(c.x, c.y);
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(an.dx * 0.5, 0, 13, 6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = an.alpha * (an.hurt && Math.floor(now / 50) % 2 ? 0.45 : 1);
    ctx.translate(an.dx, an.dy);
    if (an.fall) { const fc = (d.face || (u.side === 'crew' ? 1 : -1)); ctx.rotate(-fc * an.rot); }
    if (u.kind === 'turret') {
      ctx.strokeStyle = '#2a211a'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(0, -10); ctx.lineTo(8, 0); ctx.moveTo(0, -10); ctx.lineTo(0, 2); ctx.stroke();
      ctx.fillStyle = '#7d8a8f'; ctx.fillRect(-7, -20, 14, 10); ctx.fillStyle = '#3c4447'; ctx.fillRect(4, -17, 12, 3);
      ctx.fillStyle = '#f0a24a'; ctx.fillRect(-4, -18, 3, 3);
    } else if (d.downed) {
      // lying on their side in a spreading stain, a pulsing cross above
      const fc = d.face || 1;
      ctx.fillStyle = 'rgba(110,20,14,0.55)'; ctx.fillRect(-16, -2, 30, 5); ctx.fillRect(-12, -4, 20, 9);
      ctx.save(); ctx.translate(0, 2); ctx.rotate(-fc * Math.PI / 2);
      const ok = u.side === 'crew' && Art.person(ctx, u.look || { skin: 1, hair: 1, coat: 1 }, { pose: 'idle', armed: false, role: u.kind, facing: fc, height: 46, seed: u.id.charCodeAt(1) || 1 });
      ctx.restore();
      if (!ok) { ctx.fillStyle = COAT[(u.look && u.look.coat) % 6 || 0]; ctx.beginPath(); ctx.ellipse(0, -4, 14, 5, -0.3, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = SKIN[(u.look && u.look.skin) % 6 || 0]; ctx.beginPath(); ctx.arc(-13, -2, 4.5, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = `rgba(220,60,40,${0.5 + 0.5 * Math.sin(now / 200)})`; ctx.fillRect(-3, -26, 6, 2); ctx.fillRect(-1, -28, 2, 6);
    } else if (u.side === 'crew') {
      const look = u.look || { skin: 1, hair: 1, coat: 1 };
      const po = poseOpts(u);
      if (Art.person(ctx, look, { ...po, pose: an.pose, armed: true, seed: u.id.charCodeAt(1) || 1 })) {
        if (an.flash) muzzleFlash(Art.muzzle(po), an.flash, po.facing);
        // role tag: a small stencilled badge at the shoulder
        ctx.fillStyle = 'rgba(20,14,10,0.8)'; ctx.fillRect(-14, -44, 9, 8);
        ctx.fillStyle = '#ebdfc4'; ctx.font = '700 7px "IBM Plex Mono", monospace'; ctx.textAlign = 'center'; ctx.fillText(ROLE_TAG[u.kind] || 'R', -9.5, -37.5);
      } else {
        Paint.person(ctx, look, { pose: 'stand', t: now, seed: u.id.charCodeAt(1) || 1, facing: 1, scale: 1.05 });
        ctx.strokeStyle = '#1d1712'; ctx.lineWidth = 2.6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(3, -22); ctx.lineTo(u.kind === 'longshot' ? 21 : u.kind === 'bulwark' ? 13 : 16, -26); ctx.stroke();
        if (u.kind === 'bulwark') { Paint.drawnBox(ctx, -12, -30, 6, 18, '#5b5f63', 7, { line: 1 }); }
        ctx.fillStyle = 'rgba(20,14,10,0.75)'; ctx.fillRect(-4.5, -26, 9, 8);
        ctx.fillStyle = '#ebdfc4'; ctx.font = '700 7px "IBM Plex Mono", monospace'; ctx.textAlign = 'center'; ctx.fillText(ROLE_TAG[u.kind] || 'R', 0, -19.5);
      }
      if (u.carrying && !d.gone) { ctx.fillStyle = COAT[0]; ctx.beginPath(); ctx.ellipse(0, -30, 11, 4, 0.2, 0, Math.PI * 2); ctx.fill(); }
    } else {
      drawEnemy(u, now, an);
    }
    ctx.restore();
  }
  function muzzleFlash(m, f, face) {
    const x = Math.round(m.x), y = Math.round(m.y);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(x, y, 0, x, y, 16); g.addColorStop(0, `rgba(255,220,140,${0.7 * f})`); g.addColorStop(1, 'rgba(255,160,60,0)');
    ctx.fillStyle = g; ctx.fillRect(x - 16, y - 16, 32, 32);
    ctx.restore();
    ctx.fillStyle = '#fff4c8'; ctx.fillRect(x - 1, y - 2, 4, 4);
    ctx.fillStyle = '#ffc04a'; ctx.fillRect(x + face * 3, y - 1, 4 * face, 2); ctx.fillRect(x + face, y - 4, 2, 2); ctx.fillRect(x + face, y + 2, 2, 2);
    if (f > 0.9) puff(x + 0, y);
  }
  function drawEnemy(u, now, an = { pose: 'idle', frame: 0 }) {
    const tint = u.color || '#7a2e22';
    const moving = cur && cur.t === 'move' && cur.id === u.id;
    const face = disp[u.id].face || -1;
    {
      if ((u.kind === 'feral' || u.kind === 'hound') && Art.dog(ctx, { hound: u.kind === 'hound', color: tint, frame: moving ? Math.floor(now / 90) % 2 : an.frame, length: u.kind === 'hound' ? 40 : 36, facing: face })) return;
      if ((u.kind === 'intake' || u.kind === 'machine') && Art.creature(ctx, u.kind, u.kind === 'intake' ? 44 : 40, face)) { if (an.flash && u.kind === 'machine') muzzleFlash({ x: face * 18, y: -26 }, an.flash, face); return; }
      if (!['feral', 'hound', 'intake', 'machine'].includes(u.kind)) {
        const n0 = parseInt(u.id.slice(1), 10) || 0, big0 = u.kind === 'brute' ? 1.2 : 1;
        const po = poseOpts(u);
        if (Art.person(ctx, { skin: (n0 * 5 + 1) % 6, hair: (n0 * 3 + 3) % 6, coat: n0 % 6, build: (n0 * 7) % 3, age: n0 % 5 === 4 ? 2 : 1, style: (n0 * 7 + 2) % 10, facial: (n0 * 3) % 5, mark: (n0 * 2) % 5, acc: 0, top: 0 }, { ...po, pose: an.pose, armed: true, color: tint, seed: n0 })) {
          if (an.flash) muzzleFlash(Art.muzzle(po), an.flash, po.facing);
          if (u.signature) { ctx.fillStyle = '#f0a24a'; ctx.strokeStyle = '#1c140e'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, -60 * big0); ctx.lineTo(4, -56 * big0); ctx.lineTo(0, -52 * big0); ctx.lineTo(-4, -56 * big0); ctx.closePath(); ctx.fill(); ctx.stroke(); }
          return;
        }
      }
    }
    if (u.kind === 'feral' || u.kind === 'hound') {
      const fur = u.kind === 'hound' ? '#6b5642' : '#8a7158';
      const step = Math.sin(now / 160 + u.x) * 1.5;
      ctx.lineCap = 'round'; ctx.strokeStyle = '#17110c'; ctx.lineWidth = 3.6;
      for (const [lx, k] of [[-9, 1], [-5, -1], [6, 1], [9, -1]]) { ctx.beginPath(); ctx.moveTo(lx, -9); ctx.lineTo(lx + step * k, 0); ctx.stroke(); }
      ctx.strokeStyle = fur; ctx.lineWidth = 2.4;
      for (const [lx, k] of [[-9, 1], [-5, -1], [6, 1], [9, -1]]) { ctx.beginPath(); ctx.moveTo(lx, -9); ctx.lineTo(lx + step * k, -1); ctx.stroke(); }
      ctx.fillStyle = fur; ctx.strokeStyle = '#17110c'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.ellipse(0, -12, 13, 6, 0.05, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(12, -14); ctx.quadraticCurveTo(19, -18, 20, -12); ctx.stroke(); // tail
      ctx.beginPath(); ctx.ellipse(-14, -17, 6.5, 5, -0.35, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-17, -21); ctx.lineTo(-15, -26); ctx.lineTo(-12, -21); ctx.closePath(); ctx.fill(); ctx.stroke(); // ear
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(2, -9, 11, 3, 0, 0, Math.PI * 2); ctx.fill();
      ctx.save(); ctx.shadowColor = '#ff7a3d'; ctx.shadowBlur = 6; ctx.fillStyle = '#ffb070'; ctx.beginPath(); ctx.arc(-17.5, -18, 1.4, 0, 7); ctx.fill(); ctx.restore();
      if (u.kind === 'hound') { ctx.fillStyle = tint; ctx.fillRect(-10, -16, 4, 8); }
      return;
    }
    if (u.kind === 'intake') {
      ctx.fillStyle = '#1c1714';
      ctx.beginPath(); ctx.ellipse(0, -14, 14, 15, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#1c1714'; ctx.lineWidth = 3;
      for (let k = 0; k < 5; k++) { const a = k * 1.25 + now / 400; ctx.beginPath(); ctx.moveTo(0, -10); ctx.quadraticCurveTo(Math.cos(a) * 18, -8 + Math.sin(a) * 6, Math.cos(a) * 22, 2); ctx.stroke(); }
      ctx.fillStyle = '#d9e05a'; ctx.fillRect(-5, -20, 3, 3); ctx.fillRect(3, -20, 3, 3);
      return;
    }
    if (u.kind === 'machine') {
      ctx.fillStyle = '#5b6266'; roundRect(-11, -30, 22, 24, 3); ctx.fill();
      ctx.fillStyle = '#ff5a3d'; ctx.fillRect(-6, -24, 12, 3);
      ctx.fillStyle = '#2b2f31'; ctx.fillRect(-9, -6, 6, 6); ctx.fillRect(3, -6, 6, 6);
      return;
    }
    const big = u.kind === 'brute' ? 1.25 : 1;
    const n = parseInt(u.id.slice(1), 10) || 0;
    const coat = { raider: '#4c3328', scav: '#5a5040', marksman: '#4b4a3c', brute: '#3e2b22' }[u.kind] || '#4c3328';
    Paint.person(ctx, { skin: (n * 5 + 1) % 6, hair: (n * 3 + 3) % 6, coat: n % 6 }, { pose: 'stand', t: now, seed: n + 3, facing: -1, scale: 1.05 * big, coatColor: coat });
    ctx.scale(big, big);
    ctx.fillStyle = tint; ctx.fillRect(-6, -24, 12, 3); // the warlord's colours
    ctx.fillStyle = '#1c1612'; ctx.fillRect(-5, -37, 10, 2.5); // goggles
    ctx.strokeStyle = '#120d0a'; ctx.lineWidth = 2.6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-3, -22); ctx.lineTo(u.kind === 'marksman' ? -24 : u.kind === 'brute' ? -14 : -17, -26); ctx.stroke();
    if (u.signature) { ctx.fillStyle = '#f0a24a'; ctx.beginPath(); ctx.moveTo(0, -46); ctx.lineTo(4, -42); ctx.lineTo(0, -38); ctx.lineTo(-4, -42); ctx.fill(); }
  }
  function roundRect(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function drawOverlay() {
    const u = selected();
    const ts = u && !busy() && u.ap > 0 ? TAC.targets(b, u.id) : [];
    for (const v of b.units) {
      if (!shown(v)) continue;
      const d = disp[v.id], c = unitPos(v);
      // health pips
      const n = v.maxHp, w = Math.min(36, n * 4);
      const x0 = c.x - w / 2, y0 = c.y - (v.side === 'crew' && !d.downed ? 52 : 42);
      ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(x0 - 1, y0 - 1, w + 2, 6);
      ctx.fillStyle = v.side === 'crew' ? pal().crew : pal().foe;
      ctx.fillRect(x0, y0, w * Math.max(0, d.hp) / n, 4);
      if (d.alert) { ctx.fillStyle = '#f0a24a'; ctx.font = '800 18px "Big Shoulders Stencil Text", sans-serif'; ctx.textAlign = 'center'; ctx.fillText('!', c.x, y0 - 6); }
      if (v.side === 'crew' && v.ow && !d.downed) { ctx.fillStyle = '#7fb2e0'; ctx.font = '600 10px "IBM Plex Mono", monospace'; ctx.textAlign = 'center'; ctx.fillText('WATCH', c.x, y0 - 4); }
      if (v.side === 'crew' && v.hunker && !d.downed) { ctx.fillStyle = '#c9d9e8'; ctx.font = '600 10px "IBM Plex Mono", monospace'; ctx.textAlign = 'center'; ctx.fillText('HUNKER', c.x, y0 - 4); }
      if (d.downed && v.side === 'crew') { ctx.fillStyle = '#ff9c84'; ctx.font = '700 11px "IBM Plex Mono", monospace'; ctx.textAlign = 'center'; ctx.fillText(`DOWN ${v.bleed}`, c.x, y0 - 4); }
    }
    for (const t of ts) {
      const e = TAC.byId(b, t.id), c = unitPos(e);
      const on = targetId === t.id;
      ctx.strokeStyle = on ? '#ff6a4a' : 'rgba(255,106,74,.6)'; ctx.lineWidth = on ? 3 : 1.5;
      ctx.beginPath(); ctx.ellipse(c.x, c.y, 18, 9, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.font = `700 ${on ? 15 : 12}px "IBM Plex Mono", monospace`; ctx.textAlign = 'center';
      const label = `${t.chance}%`;
      const mw = ctx.measureText(label).width + 8;
      ctx.fillStyle = on ? '#ff6a4a' : 'rgba(30,20,15,.85)'; ctx.fillRect(c.x - mw / 2, c.y + 10, mw, on ? 19 : 16);
      ctx.fillStyle = on ? '#1b1510' : '#ffb39f'; ctx.fillText(label, c.x, c.y + (on ? 24 : 22));
    }
    // shot tracer
    if (cur && cur.t === 'shot' && disp[cur.from] && disp[cur.to]) {
      const a = unitPos(TAC.byId(b, cur.from)), t = unitPos(TAC.byId(b, cur.to));
      const k = Math.min(1, curT / (eventDur(cur) * 0.45));
      if (!cur.melee && k > 0 && curT < eventDur(cur) * 0.8) {
        const mx = cur.hit ? t.x : t.x + 18, my = cur.hit ? t.y - 22 : t.y - 40;
        ctx.strokeStyle = cur.from[0] === 'e' ? '#ff8a5c' : '#ffd27a'; ctx.lineWidth = 2;
        const m = muzzleOf(cur.from), ox = a.x + m.x, oy = a.y + m.y;
        const k0 = Math.max(0, k - 0.35);
        ctx.beginPath(); ctx.moveTo(ox + (mx - ox) * k0, oy + (my - oy) * k0); ctx.lineTo(ox + (mx - ox) * k, oy + (my - oy) * k); ctx.stroke();
      }
    }
    if (cur && cur.t === 'dart' && disp[cur.from] && disp[cur.to]) {
      const a = unitPos(TAC.byId(b, cur.from)), t = unitPos(TAC.byId(b, cur.to)), k = Math.min(1, curT / eventDur(cur));
      ctx.fillStyle = '#9fd18b'; ctx.beginPath(); ctx.arc(a.x + (t.x - a.x) * k, a.y - 24 + (t.y - a.y) * k, 4, 0, Math.PI * 2); ctx.fill();
    }
    for (const q of parts) { ctx.globalAlpha = Math.max(0, 1 - q.life / q.max) * (q.smoke ? 0.5 : 1); ctx.fillStyle = q.c; const s3 = q.smoke ? q.s + q.life / 120 : q.s; ctx.fillRect(Math.round(q.x - s3 / 2), Math.round(q.y - s3 / 2), s3, s3); }
    ctx.globalAlpha = 1;
    for (const f of floats) {
      ctx.globalAlpha = Math.max(0, 1 - f.t / 1100);
      ctx.font = `800 ${f.size}px "Big Shoulders Stencil Text", sans-serif`; ctx.textAlign = 'center';
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(15,10,8,.9)'; ctx.strokeText(f.text, f.x, f.y - f.t / 30);
      ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, f.y - f.t / 30);
      ctx.globalAlpha = 1;
    }
  }
  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, view.w, view.h); // the backdrop gradient is CSS on the canvas
    const sx = shake ? (Math.random() - 0.5) * 6 : 0, sy = shake ? (Math.random() - 0.5) * 6 : 0;
    ctx.save(); ctx.translate(cam.x + sx, cam.y + sy); ctx.scale(cam.scale, cam.scale);
    drawFloor();
    drawHighlights();
    // Depth pass: walls, objectives and units by diagonal.
    const byTile = new Map();
    for (const u of b.units) {
      if (!disp[u.id] || !shown(u)) continue;
      const c = unitPos(u);
      const t = pickWorld(c.x, c.y + (b.height && b.height[TAC.idx(disp[u.id].x, disp[u.id].y)] ? LIFT : 0));
      const k = TAC.idx(t.x, t.y);
      if (!byTile.has(k)) byTile.set(k, []);
      byTile.get(k).push(u);
    }
    const people = b.units.filter((u) => disp[u.id] && shown(u)).map((u) => ({ x: disp[u.id].x, y: disp[u.id].y }));
    for (const o of b.objs) if (!o.done) people.push({ x: o.x, y: o.y });
    // Back rows first; a wall fades when someone stands just behind it.
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const k = TAC.idx(x, y);
        const behind = b.cover[k] === 2 && people.some((q) => q.y < y && q.y >= y - 2 && TAC.hexDist(q, { x, y }) <= 2);
        drawCover(x, y, behind);
        if (b.height && b.height[k]) drawTower(x, y);
        drawObj(x, y);
        for (const u of byTile.get(k) || []) drawUnit(u);
      }
    }
    drawLighting();
    drawOverlay();
    ctx.restore();
    // Vignette and paper grain over the whole view.
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const vkey = `${view.w}x${view.h}|${b.kind === 'raid'}`;
    if (!vignette || vignette.key !== vkey) {
      const c = document.createElement('canvas'); c.width = Math.ceil(view.w / 2); c.height = Math.ceil(view.h / 2);
      const g = c.getContext('2d');
      const vg = g.createRadialGradient(c.width / 2, c.height / 2, Math.min(c.width, c.height) * 0.35, c.width / 2, c.height / 2, Math.max(c.width, c.height) * 0.75);
      vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, `rgba(5,3,2,${b.kind === 'raid' ? 0.6 : 0.45})`);
      g.fillStyle = vg; g.fillRect(0, 0, c.width, c.height);
      vignette = { key: vkey, c };
    }
    ctx.drawImage(vignette.c, 0, 0, view.w, view.h);
  }
  // Raids happen at night: dark blue wash, warm light from windows and towers.
  // Missions get a dusty daylight wash from the top of the map.
  function bakeWash() {
    const bd = bounds();
    ctx.globalCompositeOperation = 'source-atop'; // tint only the painted hexes
    try { washFill(bd); } finally { ctx.globalCompositeOperation = 'source-over'; }
  }
  function washFill(bd) {
    if (b.kind === 'raid') { ctx.fillStyle = 'rgba(12,18,40,0.42)'; ctx.fillRect(bd.minX - 200, bd.minY - 200, bd.maxX - bd.minX + 400, bd.maxY - bd.minY + 400); return; }
    const top = iso(0, 0), g = ctx.createLinearGradient(top.x, top.y - 40, top.x, iso(W - 1, H - 1).y);
    g.addColorStop(0, 'rgba(255,214,150,0.10)'); g.addColorStop(1, 'rgba(40,20,10,0.10)');
    ctx.fillStyle = g; ctx.fillRect(bd.minX - 200, bd.minY - 200, bd.maxX - bd.minX + 400, bd.maxY - bd.minY + 400);
  }
  function drawLighting() {
    if (b.kind === 'raid') {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const lights = [];
      for (const room of b.raid.rooms) if (!room.wrecked) for (const [x, y] of room.tiles) lights.push([x, y - 0.6, 90, 0.22]);
      for (const [x, y] of b.raid.towers || []) lights.push([x, y, 70, 0.16]);
      const flick = 0.92 + Math.sin(performance.now() / 160) * 0.05;
      for (const [x, y, rad, a] of lights) { const c = iso(x, y); const g = ctx.createRadialGradient(c.x, c.y - 10, 4, c.x, c.y - 10, rad); g.addColorStop(0, `rgba(255,170,90,${a * flick})`); g.addColorStop(1, 'rgba(255,170,90,0)'); ctx.fillStyle = g; ctx.fillRect(c.x - rad, c.y - 10 - rad, rad * 2, rad * 2); }
      ctx.restore();
    }
  }
  function pickWorld(wx, wy) {
    const t = worldHex(wx, wy);
    return { x: Math.max(0, Math.min(W - 1, t.x)), y: Math.max(0, Math.min(H - 1, t.y)) };
  }

  // ---------- loop ----------
  function frame(t) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(64, t - (last || t)); last = t;
    if (!cur && !queue.length && b.fx.length) { pull(); reachCache = null; visCache = null; }
    if (!cur && queue.length) { cur = queue.shift(); curT = 0; begin(cur); }
    if (cur) {
      const dur = eventDur(cur);
      const before = curT;
      curT += dt * speed * (opts.fast ? 2.5 : 1);
      if (cur.t === 'shot' && before < dur * 0.45 && curT >= dur * 0.45) shotMid(cur);
      if (curT >= dur) { end(cur); cur = null; }
    }
    for (const f of floats) f.t += dt * speed;
    for (const q of parts) { const s2 = dt / 1000; q.life += dt; q.x += q.vx * s2; q.y += q.vy * s2; q.vy += q.g * s2; }
    parts = parts.filter((q) => q.life < q.max);
    if (shake > 0) shake = Math.max(0, shake - dt);
    floats = floats.filter((f) => f.t < 1100);
    if (animating && !cur && !queue.length) { animating = false; enemyAnim = false; speed = 1; syncDisp(); idle(); }
    draw();
  }
  function idle() {
    if (b.over) { showDebrief(); return; }
    const u = selected();
    if (!u || !TAC.standing(u) || u.ap <= 0) selectNext();
    renderHud();
  }

  // ---------- selection & helpers ----------
  const selected = () => (selId ? TAC.byId(b, selId) : null);
  const busy = () => animating || b.phase !== 'player' || !!b.over;
  function vis() { if (!visCache) visCache = TAC.visibleEnemies(b); return visCache; }
  function reach() {
    const u = selected();
    if (!reachCache || reachCache.id !== u.id) {
      const rc = TAC.reach(b, u);
      reachCache = { id: u.id, tiles: rc.tiles, raw: rc };
    }
    return reachCache;
  }
  function ready() { return b.units.filter((u) => u.side === 'crew' && u.kind !== 'turret' && TAC.standing(u) && u.ap > 0); }
  function selectNext() {
    const list = ready();
    if (!list.length) { selId = selId && TAC.byId(b, selId) && TAC.standing(TAC.byId(b, selId)) ? selId : (b.units.find((u) => u.side === 'crew' && TAC.standing(u)) || {}).id || null; return; }
    const i = list.findIndex((u) => u.id === selId);
    selId = list[(i + 1) % list.length].id;
    targetId = null; pending = null; reachCache = null;
  }
  function select(id) {
    const u = TAC.byId(b, id);
    if (!u || u.side !== 'crew' || u.kind === 'turret' || !TAC.active(u)) return;
    selId = id; targetId = null; pending = null; reachCache = null;
    renderHud();
  }

  // ---------- actions ----------
  function run(fn) {
    if (busy()) return;
    const err = fn();
    if (err) { showSay(err, true); renderHud(); return; }
    targetId = null; pending = null; reachCache = null; visCache = null;
    pull();
    cb.save();
    renderHud();
  }
  function showSay(text, bad) {
    say = { text, until: performance.now() + 4200 + text.length * 30, bad: !!bad };
    const s = el.querySelector('.b-say');
    s.innerHTML = `<b>${bad ? 'Can’t do that' : 'Pilot Light'}</b>${esc(text)}`;
    s.classList.toggle('bad', !!bad);
    s.hidden = false;
    clearTimeout(showSay.t);
    showSay.t = setTimeout(() => { s.hidden = true; }, say.until - performance.now());
  }

  // ---------- input ----------
  const pointers = new Map();
  let drag = null, pinch = null;
  function onDown(e) {
    cv.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) drag = { x: e.clientX, y: e.clientY, cx: cam.x, cy: cam.y, moved: false, type: e.pointerType };
    if (pointers.size === 2) {
      const [a, c] = [...pointers.values()];
      pinch = { d: Math.hypot(a.x - c.x, a.y - c.y), scale: cam.scale, mx: (a.x + c.x) / 2, my: (a.y + c.y) / 2, cx: cam.x, cy: cam.y };
      drag = null;
    }
  }
  function onMove(e) {
    const rect = cv.getBoundingClientRect();
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && pointers.size === 2) {
      const [a, c] = [...pointers.values()];
      const d = Math.hypot(a.x - c.x, a.y - c.y);
      const ns = Math.max(0.45, Math.min(2, pinch.scale * d / pinch.d));
      const mx = pinch.mx - rect.left, my = pinch.my - rect.top;
      cam.x = mx - (mx - pinch.cx) * ns / pinch.scale; cam.y = my - (my - pinch.cy) * ns / pinch.scale; cam.scale = ns;
      clampCam();
      return;
    }
    if (drag) {
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!drag.moved && Math.hypot(dx, dy) > 8) drag.moved = true;
      if (drag.moved) { cam.x = drag.cx + dx; cam.y = drag.cy + dy; clampCam(); }
      return;
    }
    if (e.pointerType === 'mouse') {
      const t = pickTile(e.clientX - rect.left, e.clientY - rect.top);
      hover = t;
    }
  }
  function onUp(e) {
    pointers.delete(e.pointerId);
    if (pinch) { if (pointers.size < 2) pinch = null; drag = null; return; }
    if (drag && !drag.moved) {
      const rect = cv.getBoundingClientRect();
      tap(e.clientX - rect.left, e.clientY - rect.top, drag.type);
    }
    drag = null;
  }
  function onWheel(e) {
    e.preventDefault();
    const rect = cv.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const ns = Math.max(0.45, Math.min(2, cam.scale * (e.deltaY < 0 ? 1.1 : 0.9)));
    cam.x = mx - (mx - cam.x) * ns / cam.scale; cam.y = my - (my - cam.y) * ns / cam.scale; cam.scale = ns;
    clampCam();
  }
  function tap(sx, sy, type) {
    if (animating) { speed = 4; return; }
    if (busy()) return;
    const t = pickTile(sx, sy);
    if (!t) { pending = null; targetId = null; renderHud(); return; }
    const who = b.units.find((u) => shown(u) && disp[u.id] && disp[u.id].x === t.x && disp[u.id].y === t.y && TAC.active(u))
      || b.units.find((u) => shown(u) && disp[u.id] && TAC.active(u) && u.kind !== 'turret' && (() => { const c = unitPos(u); const p = { x: (sx - cam.x) / cam.scale, y: (sy - cam.y) / cam.scale }; return Math.abs(p.x - c.x) < 14 && p.y < c.y + 4 && p.y > c.y - 44; })());
    const u = selected();
    if (who && who.side === 'crew' && who.kind !== 'turret') { select(who.id); return; }
    if (who && who.side === 'enemy') {
      if (u && TAC.targets(b, u.id).some((x) => x.id === who.id)) {
        if (targetId === who.id && type !== 'mouse') { /* second tap: just keep it aimed */ }
        targetId = who.id; aimedOnce = true; pending = null; renderHud();
      } else showSay(u ? `${u.name.split(' ')[0]} has no shot at that ${who.name.toLowerCase()}.` : 'Pick one of your crew first.', true);
      return;
    }
    if (!u || u.ap <= 0) return;
    const rc = reach();
    if (rc.tiles.some((p) => p.x === t.x && p.y === t.y)) {
      if (type === 'mouse' || (pending && pending.x === t.x && pending.y === t.y)) { movedOnce = true; run(() => TAC.move(b, u.id, t.x, t.y)); }
      else { pending = t; targetId = null; renderHud(); }
      return;
    }
    pending = null; targetId = null; renderHud();
  }

  // ---------- HUD ----------
  function objectiveText() {
    if (b.kind === 'raid') {
      const left = b.units.filter((u) => u.side === 'enemy' && TAC.active(u)).length;
      const hit = b.raid.rooms.filter((m) => m.wrecked).length;
      return `Hold the waystation · ${left} raider${left === 1 ? '' : 's'} left · ${hit}/${b.raid.rooms.length} rooms wrecked · they give up after turn ${b.raid.turnLimit}`;
    }
    if (b.objective === 'caches') return `Caches ${b.collected}/${b.objs.length} · then extract or clear the area`;
    if (b.objective === 'rescue') { const left = Math.max(0, b.turnLimit - b.turn + 1); return b.rescueLost ? 'Too late for the survivors · get out' : `Survivors ${b.freed}/${b.objs.length} · ${left} turn${left === 1 ? '' : 's'} left`; }
    const seen = TAC.visibleEnemies(b).size;
    return `Clear the area · ${seen} enem${seen === 1 ? 'y' : 'ies'} in sight`;
  }
  function introTip() {
    if (!b.intro) return '';
    if (b.script && b.script.fired) return 'Finish the job. Every enemy down clears the area and the team comes home.';
    if (!movedOnce) return 'Tap one of your crew, then tap a blue tile twice to move (blue is one action, amber is two). Shields show cover: tall is full, short is half.';
    if (!aimedOnce) return 'Tap an enemy you can see, or press Aim, to line up a shot. Your odds are on the Shoot button. Shooting ends that person’s turn.';
    return 'When everyone has acted, End turn. Wounded crew go down and bleed out in a few turns unless revived or carried to the green zone.';
  }
  function renderHud() {
    if (!b) return;
    const top = el.querySelector('.b-top');
    top.querySelector('.b-site').textContent = b.site;
    top.querySelector('.b-retreat').textContent = b.kind === 'raid' ? 'Fall back' : 'Retreat';
    top.querySelector('.b-turn').textContent = `Turn ${b.turn}${enemyAnim ? ' · enemy activity' : ''}`;
    top.querySelector('.b-obj').textContent = objectiveText();
    const crew = b.units.filter((u) => u.side === 'crew' && u.kind !== 'turret');
    el.querySelector('.b-units').innerHTML = crew.map((u) => {
      const st = u.dead ? 'Dead' : u.gone ? 'Out' : u.carriedBy ? 'Carried' : u.downed ? `Down · ${u.bleed}` : u.carrying ? 'Carrying' : '';
      const apPips = TAC.standing(u) ? '<i class="ap' + (u.ap > 0 ? ' on' : '') + '"></i><i class="ap' + (u.ap > 1 ? ' on' : '') + '"></i>' : '';
      return `<button class="b-unit ${u.id === selId ? 'sel' : ''} ${u.dead ? 'dead' : ''} ${u.downed ? 'down' : ''}" data-b="sel" data-id="${u.id}" ${u.dead || u.gone ? 'disabled' : ''}>
        <span class="b-name">${esc(u.name.split(' ')[0])}<small>${ROLE_NAME[u.kind] || 'Recruit'}</small></span>
        <span class="b-hp"><i style="width:${Math.max(0, u.hp) / u.maxHp * 100}%"></i></span>
        <span class="b-st">${apPips}${st ? `<em>${st}</em>` : ''}</span></button>`;
    }).join('');
    const bar = el.querySelector('.b-actions');
    const u = selected();
    let html = '';
    if (busy()) html = `<span class="b-wait">${b.over ? 'Mission over' : enemyAnim ? 'Enemy turn… tap the map to speed up' : 'Tap the map to speed up'}</span>`;
    else if (u && TAC.standing(u)) {
      const t = targetId ? TAC.byId(b, targetId) : null;
      if (t) {
        html += `<button class="btn primary" data-b="shoot" ${u.ap > 0 ? '' : 'disabled'}>Shoot · ${TAC.hitChance(b, u, t)}%</button>`;
        if (u.kind === 'longshot') html += `<button class="btn" data-b="ab" data-ab="steady" ${!u.moved && u.ap >= 2 ? '' : 'disabled'}>Steady · ${TAC.hitChance(b, u, t, { bonus: 15 })}%</button>`;
        if (u.kind === 'drifter') html += `<button class="btn" data-b="ab" data-ab="quick" ${u.cd.quick > 0 || u.ap < 1 ? 'disabled' : ''}>Quick shot${u.cd.quick > 0 ? ` (${u.cd.quick})` : ` · ${TAC.hitChance(b, u, t)}%`}</button>`;
        html += `<button class="btn ghost" data-b="untarget">Cancel</button>`;
      } else {
        const tsAll = TAC.targets(b, u.id);
        if (tsAll.length && u.ap > 0) html += `<button class="btn primary" data-b="nextTarget">Aim · ${tsAll.length} in sight</button>`;
        for (const a of TAC.actions(b, u.id)) {
          if (a.aims) continue;
          html += `<button class="btn" data-b="ab" data-ab="${a.id}" data-tip="${esc(a.tip)}" ${a.on ? '' : 'disabled'}>${esc(a.name)}${a.note ? ` <small>${esc(a.note)}</small>` : ''}</button>`;
        }
      }
      const left = ready().length;
      html += `<button class="btn primary end" data-b="end">End turn${left ? ` <small>${left} can act</small>` : ''}</button>`;
    } else html = `<button class="btn primary end" data-b="end">End turn</button>`;
    bar.innerHTML = html;
    const tip = el.querySelector('.b-tip');
    const u2 = selected();
    const t2 = targetId ? TAC.byId(b, targetId) : null;
    let tx = tipText || introTip();
    if (!tx && u2 && !busy()) {
      if (t2) {
        const cvr = TAC.coverFrom(b, t2, u2.x, u2.y);
        tx = `${t2.name}${t2.signature ? ' (signature unit)' : ''} · ${Math.max(0, t2.hp)}/${t2.maxHp} health · ${cvr === 2 ? 'in full cover' : cvr === 1 ? 'in half cover' : 'exposed, flanked: crit chance up'}.`;
      } else if (pending) tx = 'Tap the same tile again to move there.';
      else tx = `${u2.name} · ${ROLE_NAME[u2.kind] || 'Recruit'} · aim ${u2.aim} · ${u2.ap} action${u2.ap === 1 ? '' : 's'} left. Stims: ${b.stims}.`;
    }
    tip.textContent = tx;
    tipText = '';
  }
  function showDebrief() {
    const o = b.over;
    const m = el.querySelector('.b-modal');
    const crew = b.units.filter((u) => u.side === 'crew' && u.kind !== 'turret');
    const title = { success: 'Mission accomplished', partial: 'Partial success', retreat: 'The team pulled out', wiped: 'The squad is gone', repelled: 'Raid repelled', breached: o.how === 'fellback' ? 'You waited it out below' : 'They got what they came for', overrun: 'The waystation has fallen' }[o.outcome];
    const raidLine = b.kind === 'raid' ? `<p class="small">${o.kills} raider${o.kills === 1 ? '' : 's'} down${o.fled ? ` · ${o.fled} fled` : ''} · ${o.wrecked.length ? `wrecked: ${b.raid.rooms.filter((r) => r.wrecked).map((r) => esc(r.name)).join(', ')}` : 'no rooms lost'}.</p>` : '';
    m.innerHTML = `<div class="b-card"><p class="eyebrow">${esc(b.site)} · ${o.turns} turn${o.turns === 1 ? '' : 's'}</p><h2>${title}</h2>
      <ul class="report">${crew.map((u) => `<li class="${u.dead ? 'bad' : ''}"><b>${esc(u.name)}</b>: ${u.dead ? 'killed' : u.wasDowned ? 'went down, made it home' : u.hp < u.maxHp ? 'wounded' : 'unhurt'}${u.kills ? ` · ${u.kills} kill${u.kills > 1 ? 's' : ''}` : ''}</li>`).join('')}</ul>
      ${raidLine}<p class="small" ${b.kind === 'raid' ? 'hidden' : ''}>${o.kills} enem${o.kills === 1 ? 'y' : 'ies'} down${o.total ? ` · ${b.objective === 'rescue' ? `${o.freed} of ${o.total} survivors freed` : `${o.collected} of ${o.total} caches`}` : ''}${o.surrendered ? ` · ${o.surrendered} surrendered` : ''}.</p>
      ${b.intro ? '<div class="pilot-say">I am sorry. I liked them. There will be travelers at the bar looking for work.</div>' : ''}
      <div class="actions"><button class="btn primary" data-b="done">${b.kind === 'raid' ? (o.outcome === 'overrun' ? 'Continue' : 'See the damage') : 'Back to the waystation'}</button></div></div>`;
    m.hidden = false;
    modal = 'debrief';
    renderHud();
  }
  function confirmRetreat() {
    const m = el.querySelector('.b-modal');
    if (b.kind === 'raid') {
      m.innerHTML = `<div class="b-card"><h2>Fall back to the bunker?</h2><p>Everyone goes below, the wounded carried down. Nobody else dies tonight, but the raiders will wreck more rooms up top and take a bigger share of your silver buttons.</p><div class="actions"><button class="btn primary" data-b="retreatYes">Fall back</button><button class="btn ghost" data-b="closeModal">Hold the line</button></div></div>`;
      m.hidden = false; modal = 'retreat'; return;
    }
    const left = b.units.filter((u) => u.side === 'crew' && u.downed && TAC.active(u) && !u.carriedBy);
    m.innerHTML = `<div class="b-card"><h2>Retreat?</h2><p>Everyone standing runs for it now. The mission fails${b.collected || b.freed ? ', but you keep what you already found' : ''}.</p>${left.length ? `<p class="bad">${left.map((u) => esc(u.name)).join(', ')} ${left.length > 1 ? 'are' : 'is'} down and not being carried. They will be left behind and die.</p>` : ''}<div class="actions"><button class="btn primary" data-b="retreatYes">Pull out</button><button class="btn ghost" data-b="closeModal">Keep fighting</button></div></div>`;
    m.hidden = false; modal = 'retreat';
  }

  function onClick(e) {
    const t = e.target.closest('[data-b]');
    if (!t) return;
    const a = t.dataset.b;
    if (a === 'sel') { select(t.dataset.id); centerOn(t.dataset.id); }
    else if (a === 'shoot') { const u = selected(); aimedOnce = true; run(() => TAC.shoot(b, u.id, targetId)); }
    else if (a === 'ab') {
      const u = selected(); const ab = t.dataset.ab;
      if (ab === 'overwatch') run(() => TAC.overwatch(b, u.id));
      else if (ab === 'hunker') run(() => TAC.hunker(b, u.id));
      else if (ab === 'steady' || ab === 'quick') run(() => TAC.shoot(b, u.id, targetId, ab));
      else run(() => TAC.ability(b, u.id, ab));
    }
    else if (a === 'untarget') { targetId = null; renderHud(); }
    else if (a === 'nextTarget') cycleTarget();
    else if (a === 'end') { if (!busy()) { targetId = null; pending = null; enemyAnim = true; run(() => TAC.endTurn(b)); } }
    else if (a === 'retreat') { if (!busy()) confirmRetreat(); }
    else if (a === 'retreatYes') { el.querySelector('.b-modal').hidden = true; modal = null; run(() => TAC.retreat(b)); }
    else if (a === 'closeModal') { el.querySelector('.b-modal').hidden = true; modal = null; }
    else if (a === 'done') { const done = cb.onDone; close(); done(); }
    else if (a === 'recenter') { fit(); }
  }
  function onHoverTip(e) {
    const t = e.target.closest('[data-tip]');
    if (t) { el.querySelector('.b-tip').textContent = t.dataset.tip; }
  }
  function centerOn(id) {
    const d = disp[id]; if (!d) return;
    const c = iso(d.x, d.y), sp = hudSpace();
    const sx = c.x * cam.scale + cam.x, sy = c.y * cam.scale + cam.y;
    if (sx < 40 || sx > view.w - 40 || sy < sp.top + 20 || sy > view.h - sp.bot - 20) {
      cam.x = view.w / 2 - c.x * cam.scale; cam.y = sp.top + (view.h - sp.top - sp.bot) / 2 - c.y * cam.scale; clampCam();
    }
  }
  // Step through visible targets, best odds first, and bring each into view.
  function cycleTarget() {
    const u = selected();
    if (!u || busy()) return;
    const ts = TAC.targets(b, u.id).sort((a, c) => c.chance - a.chance);
    if (!ts.length) return;
    const i = ts.findIndex((t) => t.id === targetId);
    targetId = ts[(i + 1) % ts.length].id; aimedOnce = true; pending = null;
    centerOn(targetId);
    renderHud();
  }
  function onKey(e) {
    if (!el || el.hidden || modal) return;
    if (e.key === 'Escape') { targetId = null; pending = null; renderHud(); }
    if (e.key === 't' || e.key === 'T') cycleTarget();
    if (e.key === 'Tab') { e.preventDefault(); selectNext(); renderHud(); if (selId) centerOn(selId); }
    if (e.key === 'e' || e.key === 'E') { if (!busy()) { enemyAnim = true; run(() => TAC.endTurn(b)); } }
  }

  // ---------- open / close ----------
  function build() {
    el = document.createElement('section');
    el.className = 'battle'; el.hidden = true;
    el.setAttribute('aria-label', 'Tactical mission');
    el.innerHTML = `<canvas class="b-canvas" aria-label="Battlefield. Tap your crew to select, tiles to move, enemies to aim."></canvas>
      <header class="b-top"><div class="b-head"><b class="b-site"></b><span class="b-turn"></span></div><div class="b-obj"></div><div class="b-tools"><button class="btn small ghost" data-b="recenter" aria-label="Recenter map">⌖</button><button class="btn small ghost b-retreat" data-b="retreat">Retreat</button></div></header>
      <div class="b-say" role="status" hidden></div>
      <footer class="b-bottom"><div class="b-tip" aria-live="polite"></div><div class="b-units"></div><div class="b-actions"></div></footer>
      <div class="b-modal" hidden></div>`;
    document.getElementById('app').appendChild(el);
    cv = el.querySelector('canvas'); ctx = cv.getContext('2d');
    cv.addEventListener('pointerdown', onDown);
    cv.addEventListener('pointermove', onMove);
    cv.addEventListener('pointerup', onUp);
    cv.addEventListener('pointercancel', (e) => { pointers.delete(e.pointerId); drag = null; pinch = null; });
    cv.addEventListener('pointerleave', () => { hover = null; });
    cv.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('click', onClick);
    el.addEventListener('pointerover', onHoverTip);
    window.addEventListener('resize', resize);
    window.addEventListener('keydown', onKey);
  }
  function open(battle, callbacks) {
    if (!el) build();
    b = battle; cb = callbacks;
    selId = null; targetId = null; pending = null; queue = []; cur = null; floats = []; modal = null; firstFit = true;
    movedOnce = b.turn > 1; aimedOnce = b.turn > 1;
    el.querySelector('.b-modal').hidden = true;
    el.querySelector('.b-say').hidden = true;
    el.hidden = false;
    document.body.classList.add('in-battle');
    // The state is already final; show it as it was, then play any queued events.
    syncDisp();
    for (const ev of b.fx) if (ev.t === 'spawn' && disp[ev.unit.id]) disp[ev.unit.id].gone = true;
    pull();
    selectNext();
    renderHud();
    resize();
    cancelAnimationFrame(raf); last = 0; raf = requestAnimationFrame(frame);
    if (b.over && !queue.length) showDebrief();
  }
  function close() {
    cancelAnimationFrame(raf);
    if (el) el.hidden = true;
    document.body.classList.remove('in-battle');
    b = null; cb = null;
  }
  // Test hooks: screen position of a tile, and whether animations have settled.
  function screenOf(x, y, lift = 0) { const c = iso(x, y); const r = cv.getBoundingClientRect(); return { x: r.left + c.x * cam.scale + cam.x, y: r.top + (c.y - lift) * cam.scale + cam.y }; }
  const settled = () => !!b && !animating && !queue.length && !cur;
  function setOptions(o) { opts = { ...opts, ...o }; }
  return { open, close, setOptions, cycleTarget, targetId: () => targetId, isOpen: () => !!(el && !el.hidden), screenOf, settled, selectedId: () => selId, resync: () => { syncDisp(); visCache = null; reachCache = null; } };
})();
