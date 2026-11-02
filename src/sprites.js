// ============================================================================
// Art: hand-authored vector illustrations (SVG built in code), rasterised once
// into canvases and cached. Characters, animals, creatures and machines here;
// room furniture and battle structures in structures.js. Callers get null until
// an image is ready and draw a fallback meanwhile; Art.version changes whenever
// a new image lands so cached scenes can rebuild.
// ============================================================================
const Art = (() => {
  let version = 0;
  const store = new Map();
  // Pixel density of the whole game: art pixels per world unit (a 50-unit soldier is 64 px tall).
  const PX = 1.28;

  // ---------- pixel pipeline ----------
  // Picks k representative colours from an RGBA buffer (sampled k-means, redmean-weighted).
  function palette(d, k, seed = 7) {
    const n = d.length / 4, sample = [];
    const step = Math.max(1, Math.floor(n / 4000));
    for (let i = (seed % step); i < n; i += step) if (d[i * 4 + 3] > 127) sample.push(i * 4);
    if (!sample.length) return [];
    const dist = (r, g, b, c) => { const rm = (r + c[0]) / 2, dr = r - c[0], dg = g - c[1], db = b - c[2]; return (2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db; };
    // farthest-point init so small accent colours (a red sash, a lens) survive
    const cs = [[d[sample[0]], d[sample[0] + 1], d[sample[0] + 2]]];
    const best = new Float64Array(sample.length).fill(Infinity);
    while (cs.length < Math.min(k, sample.length)) {
      const c = cs[cs.length - 1]; let far = 0, fi = 0;
      for (let j = 0; j < sample.length; j++) { const o = sample[j]; const v = dist(d[o], d[o + 1], d[o + 2], c); if (v < best[j]) best[j] = v; if (best[j] > far) { far = best[j]; fi = j; } }
      if (far < 30) break;
      const o = sample[fi]; cs.push([d[o], d[o + 1], d[o + 2]]);
    }
    for (let it = 0; it < 7; it++) {
      const acc = cs.map(() => [0, 0, 0, 0]);
      for (const o of sample) { let bi = 0, bv = Infinity; for (let c = 0; c < cs.length; c++) { const v = dist(d[o], d[o + 1], d[o + 2], cs[c]); if (v < bv) { bv = v; bi = c; } } const a2 = acc[bi]; a2[0] += d[o]; a2[1] += d[o + 1]; a2[2] += d[o + 2]; a2[3]++; }
      for (let c = 0; c < cs.length; c++) if (acc[c][3]) cs[c] = [acc[c][0] / acc[c][3], acc[c][1] / acc[c][3], acc[c][2] / acc[c][3]];
    }
    return { cs: cs.map((c) => c.map(Math.round)), dist };
  }
  function nearest(P, r, g, b) { let bi = 0, bv = Infinity; for (let c = 0; c < P.cs.length; c++) { const v = P.dist(r, g, b, P.cs[c]); if (v < bv) { bv = v; bi = c; } } return bi; }
  // Turns a supersampled canvas into crisp pixel art: palette, majority vote per pixel block,
  // stray-pixel cleanup and (optionally) a selective dark outline around the silhouette.
  function pixelize(src, pw, ph, { k = 14, outline = true, ss = 3, clean = false, soft = false } = {}) {
    const g0 = src.getContext('2d'), W0 = src.width, H0 = src.height;
    const d = g0.getImageData(0, 0, W0, H0).data;
    const P = palette(d, k);
    const out = document.createElement('canvas'); out.width = pw; out.height = ph;
    if (!P.cs) return out;
    const idx = new Int16Array(pw * ph).fill(-1);
    const votes = new Int32Array(P.cs.length + 1);
    for (let y = 0; y < ph; y++) for (let x = 0; x < pw; x++) {
      votes.fill(0);
      const x0 = Math.floor(x * W0 / pw), x1 = Math.max(x0 + 1, Math.floor((x + 1) * W0 / pw));
      const y0 = Math.floor(y * H0 / ph), y1 = Math.max(y0 + 1, Math.floor((y + 1) * H0 / ph));
      let tot = 0;
      for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) {
        const o = (yy * W0 + xx) * 4; tot++;
        if (d[o + 3] < 128) votes[P.cs.length]++; else votes[nearest(P, d[o], d[o + 1], d[o + 2])]++;
      }
      let bi = P.cs.length, bv = -1;
      for (let c = 0; c <= P.cs.length; c++) if (votes[c] > bv) { bv = votes[c]; bi = c; }
      // keep thin solid details: solid wins if it covers at least 40% of the block
      if (bi === P.cs.length && votes[P.cs.length] < tot * 0.6) { bv = -1; for (let c = 0; c < P.cs.length; c++) if (votes[c] > bv) { bv = votes[c]; bi = c; } }
      idx[y * pw + x] = bi === P.cs.length ? -1 : bi;
    }
    // stray pixels: a lone colour surrounded by one other colour takes that colour
    const at = (x, y) => (x < 0 || y < 0 || x >= pw || y >= ph ? -2 : idx[y * pw + x]);
    if (clean) {
      // interior specks of the darkest colour (stray line ends) melt into their surroundings
      const lum = (c) => P.cs[c][0] * 0.3 + P.cs[c][1] * 0.59 + P.cs[c][2] * 0.11;
      let dark = 0; for (let c = 1; c < P.cs.length; c++) if (lum(c) < lum(dark)) dark = c;
      for (let pass = 0; pass < 2; pass++) for (let y = 1; y < ph - 1; y++) for (let x = 1; x < pw - 1; x++) {
        if (at(x, y) !== dark) continue;
        const n = [at(x - 1, y), at(x + 1, y), at(x, y - 1), at(x, y + 1)];
        if (n.some((v) => v < 0)) continue; // keep the silhouette outline
        const same = n.filter((v) => v === dark).length;
        if (same <= 1) { const cnt = {}; for (const v of n) if (v !== dark) cnt[v] = (cnt[v] || 0) + 1; const best = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0]; if (best && best[1] >= 2) idx[y * pw + x] = +best[0]; }
      }
    }
    for (let y = 0; y < ph; y++) for (let x = 0; x < pw; x++) {
      const c = at(x, y); if (c < 0) continue;
      const n = [at(x - 1, y), at(x + 1, y), at(x, y - 1), at(x, y + 1)];
      if (n.every((v) => v !== c) && n[0] === n[1] && n[1] === n[2] && n[2] === n[3] && n[0] >= 0) idx[y * pw + x] = n[0];
    }
    const g = out.getContext('2d'), im = g.createImageData(pw, ph), od = im.data;
    for (let i = 0; i < pw * ph; i++) { const c = idx[i]; if (c < 0) continue; const col = P.cs[c]; od[i * 4] = col[0]; od[i * 4 + 1] = col[1]; od[i * 4 + 2] = col[2]; od[i * 4 + 3] = 255; }
    if (outline) {
      for (let y = 0; y < ph; y++) for (let x = 0; x < pw; x++) {
        if (at(x, y) >= 0) continue;
        const n = [at(x - 1, y), at(x + 1, y), at(x, y - 1), at(x, y + 1)].filter((v) => v >= 0);
        if (!n.length) continue;
        const col = P.cs[n[0]], o = (y * pw + x) * 4;
        if (soft) {
          // a soft edge: the neighbouring colour a few shades darker, half see-through, never black
          od[o] = Math.round(col[0] * 0.62); od[o + 1] = Math.round(col[1] * 0.58); od[o + 2] = Math.round(col[2] * 0.56); od[o + 3] = 150;
        } else { od[o] = Math.round(col[0] * 0.28 + 6); od[o + 1] = Math.round(col[1] * 0.24 + 4); od[o + 2] = Math.round(col[2] * 0.22 + 3); od[o + 3] = 255; }
      }
    }
    g.putImageData(im, 0, 0);
    return out;
  }
  // Snap an already-painted canvas (rooms, floors) to a palette in place: cheap, no resampling.
  function quantize(c, k = 24) {
    const g = c.getContext('2d'), im = g.getImageData(0, 0, c.width, c.height), d = im.data;
    const P = palette(d, k, 3);
    if (!P.cs) return c;
    const cache = new Map();
    for (let o = 0; o < d.length; o += 4) {
      if (d[o + 3] < 8) continue;
      const key = ((d[o] >> 2) << 12) | ((d[o + 1] >> 2) << 6) | (d[o + 2] >> 2);
      let ci = cache.get(key); if (ci === undefined) { ci = nearest(P, d[o], d[o + 1], d[o + 2]); cache.set(key, ci); }
      const col = P.cs[ci]; d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2];
    }
    g.putImageData(im, 0, 0);
    return c;
  }
  // Load an SVG illustration and turn it into pixel art of pw x ph. Returns null until ready.
  function request(key, build, w, h, pix) {
    let e = store.get(key);
    if (!e) {
      e = { ready: false };
      store.set(key, e);
      if (typeof Image === 'undefined') return null;
      const img = new Image();
      const pw = Math.max(1, Math.round(pix.pw)), ph = Math.max(1, Math.round(pix.ph)), ss = pix.ss || 3;
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = pw * ss; c.height = ph * ss;
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        e.canvas = pixelize(c, pw, ph, pix); e.ready = true; version++;
      };
      img.onerror = () => { e.failed = true; };
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(build());
    }
    return e.ready ? e.canvas : null;
  }
  // Draw a pixel sprite without smoothing.
  function blit(ctx, img, x, y, w, h) { const s = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = false; ctx.drawImage(img, x, y, w, h); ctx.imageSmoothingEnabled = s; }

  // ---------- colour helpers ----------
  const hex = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const shade = (h, f) => `#${hex(h).map((v) => Math.max(0, Math.min(255, Math.round(v * f))).toString(16).padStart(2, '0')).join('')}`;
  const INK = '#1b130d';
  const SKIN = ['#f1c9a5', '#d9a27a', '#b9774f', '#8d5a3b', '#62402a', '#e6b98f'];
  const HAIR = ['#2b211a', '#5a3d23', '#a8763e', '#c9b07a', '#8a8a86', '#8a3b22'];
  const COAT = ['#7a4a2e', '#4f6650', '#5b5f73', '#8a6a3a', '#6b3f3f', '#3f5966'];
  const PANTS = ['#3a3229', '#2f3437', '#4a3b2a', '#33302c', '#3d3a33'];
  const svg = (w, h, body, defs = '') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><defs>${defs}</defs>${body}</svg>`;
  const grad = (id, a, b, x2 = 1, y2 = 0) => `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`;
  const o = `stroke="${INK}" stroke-width="0.9" stroke-linejoin="round" stroke-linecap="round"`;

  // ======================================================================
  // People. viewBox 48 x 96, facing right, feet at y 94, centre x 23.
  // look: {skin, hair, coat}; opts: {role, armed, pose, outfit, color}
  // outfit: crew | patron | raider | scav | brute | marksman
  // ======================================================================
  const CHAR_W = 64, CHAR_H = 96; // wide enough for a raised rifle; the body sits at x 23
  // Fine grit multiplied over cloth and skin so nothing reads as flat vector fill.
  const grit = (id, seedN, amt = 0.32, freq = 1.8) => `<filter id="${id}" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency="${freq}" numOctaves="2" seed="${seedN}" result="n"/><feColorMatrix in="n" type="matrix" values="0 0 0 0 0.12  0 0 0 0 0.08  0 0 0 0 0.05  0 0 0 ${amt} 0" result="c"/><feComposite in="c" in2="SourceGraphic" operator="in" result="m"/><feBlend in="m" in2="SourceGraphic" mode="multiply"/></filter>`;
  function rifle(x, y, len, { scope = false, double = false } = {}) {
    // Built for the pixel grid: a warm wood stock, a pale steel receiver and barrel with a bright top
    // edge, so the gun stays its own shape against any coat.
    const steel = '#6a7276', steelD = '#3e4448', hi = '#c4ccce';
    return `<g>`
      + `<path d="M${x},${y + 0.4} L${x + 9},${y - 1.6} L${x + 11},${y - 1.6} L${x + 11},${y + 2.6} L${x + 7},${y + 2.8} L${x + 1.6},${y + 5} Q${x - 0.8},${y + 4.8} ${x},${y + 0.4} Z" fill="#a8743e" stroke="${INK}" stroke-width="0.9" stroke-linejoin="round"/>`
      + `<path d="M${x + 1},${y + 0.6} L${x + 9},${y - 1}" stroke="#e0b07a" stroke-width="0.9"/>`
      + `<rect x="${x + 10.4}" y="${y - 2.6}" width="9" height="4.6" rx="0.6" fill="${steel}" stroke="${INK}" stroke-width="0.9"/>`
      + `<path d="M${x + 11},${y - 1.8} L${x + 19},${y - 1.8}" stroke="${hi}" stroke-width="0.9"/>`
      + `<path d="M${x + 13},${y + 2} L${x + 12.2},${y + 7.4} L${x + 15.4},${y + 7.6} L${x + 15.8},${y + 2} Z" fill="${steelD}" stroke="${INK}" stroke-width="0.8"/>`
      + `<rect x="${x + 19.2}" y="${y - 1.9}" width="${len}" height="${double ? 3.4 : 2.6}" rx="0.5" fill="${steel}" stroke="${INK}" stroke-width="0.9"/>`
      + `<path d="M${x + 19.6},${y - 1.2} L${x + 19 + len},${y - 1.2}" stroke="${hi}" stroke-width="0.8"/>`
      + (double ? '' : `<rect x="${x + 19.2}" y="${y + 0.6}" width="${len * 0.5}" height="2" rx="0.5" fill="#8a5a32" stroke="${INK}" stroke-width="0.7"/>`)
      + (scope ? `<rect x="${x + 12}" y="${y - 6.4}" width="10" height="3.2" rx="1.4" fill="${steelD}" stroke="${INK}" stroke-width="0.8"/><circle cx="${x + 21.6}" cy="${y - 4.8}" r="1.1" fill="#9fd6e6"/>` : '')
      + `</g>`;
  }
  function hand(x, y, skin, back = false) {
    const c = back ? shade(skin, 0.8) : skin;
    return `<path d="M${x - 2.2},${y - 1.2} Q${x - 1},${y - 2.6} ${x + 1.4},${y - 2} Q${x + 2.8},${y - 1} ${x + 2.4},${y + 1} Q${x + 2.2},${y + 2.8} ${x + 0.2},${y + 3} Q${x - 2},${y + 2.6} ${x - 2.4},${y + 0.6} Z" fill="${c}" ${o}/><path d="M${x + 1.6},${y - 1.6} Q${x + 3.4},${y - 0.6} ${x + 2.6},${y + 0.8}" stroke="${INK}" stroke-width="0.5" fill="none"/><path d="M${x - 1},${y + 0.6} L${x + 1.6},${y + 0.8} M${x - 0.8},${y + 1.8} L${x + 1.4},${y + 2}" stroke="${shade(skin, 0.6)}" stroke-width="0.35"/>`;
  }
  // Fill in the newer look fields for people saved before they existed.
  function fullLook(l) {
    return {
      skin: l.skin || 0, hair: l.hair || 0, coat: l.coat || 0,
      build: l.build ?? 1, age: l.age ?? 1, style: l.style ?? (l.hair || 0) % 6,
      facial: l.facial ?? (((l.coat || 0) + (l.skin || 0)) % 3 === 0 ? 3 : 0),
      mark: l.mark ?? 0, acc: l.acc ?? 0, top: l.top ?? 0,
    };
  }
  const SHIRT = ['#c8b89a', '#8a8a7a', '#9a6a5a', '#6a7a8a', '#b0a070'];
  function personSVG(look0, { role = 'recruit', armed = false, pose = 'idle', outfit = 'crew', color = '#a8432f', seed = 0 } = {}) {
    const look = fullLook(look0);
    const skin = SKIN[look.skin % 6], hair = look.age === 2 ? ['#b8b4aa', '#9a968c', '#d0ccc2'][look.hair % 3] : HAIR[look.hair % 6];
    let coat = COAT[look.coat % 6];
    const pants = PANTS[(look.coat + look.hair) % PANTS.length];
    if (outfit === 'raider') coat = ['#3e2b22', '#4c3328', '#2f2a26'][seed % 3];
    if (outfit === 'scav') coat = ['#6a5d48', '#5a5040', '#73644c'][seed % 3];
    if (outfit === 'brute') coat = '#33261f';
    if (outfit === 'marksman') coat = ['#4b4a3c', '#3f4436'][seed % 2];
    if (outfit === 'crew' && role === 'sawbones') coat = '#8a8577';
    const style = look.style % 10;
    const facial = outfit === 'patron' && look.facial === 3 ? 1 : look.facial % 5;
    const crewish = outfit === 'crew' || outfit === 'patron';
    const top = crewish && role !== 'bulwark' ? look.top % 5 : 0;
    const shirt = SHIRT[(look.hair + look.skin) % SHIRT.length];
    const defs = grad('coat', shade(coat, 1.22), shade(coat, 0.7)) + grad('coatb', shade(coat, 0.82), shade(coat, 0.5))
      + grad('skin', shade(skin, 1.08), shade(skin, 0.78)) + grad('pant', shade(pants, 1.2), shade(pants, 0.66))
      + grad('pantb', shade(pants, 0.86), shade(pants, 0.5))
      + grad('metal', '#c9ccc6', '#4a4e50', 0.4, 1) + grad('wood', '#9a6a3e', '#4f3220', 0, 1)
      + `<linearGradient id="grime" x1="0" y1="0" x2="0" y2="1"><stop offset="0.55" stop-color="#3a2a1a" stop-opacity="0"/><stop offset="1" stop-color="#3a2a1a" stop-opacity="0.55"/></linearGradient>`
      + `<radialGradient id="face" cx="0.68" cy="0.38" r="0.85"><stop offset="0" stop-color="${shade(skin, 1.1)}"/><stop offset="0.6" stop-color="${skin}"/><stop offset="1" stop-color="${shade(skin, 0.68)}"/></radialGradient>`
      + grit('g', (look.skin * 7 + look.coat * 3 + seed) % 50 + 1);
    const work = pose === 'work', drink = pose === 'drink', aim = pose === 'aim';
    // walk1 / walk2 are the two stride extremes; legs swing from the hips, arms counter-swing
    const st = pose === 'walk1' ? 15 : pose === 'walk2' ? -15 : 0;
    const wide = outfit === 'brute' ? 2.2 : [-1.1, 0, 1.8][look.build % 3];
    const p = [];
    // ---------- behind the body ----------
    if (outfit === 'crew' && role === 'drifter') p.push(`<path d="M8.6,30 Q8,27.6 11,27 L16.4,27 L16.4,53 L10,53 Q8,52 8.4,48.6 Z" fill="#5e4a32" ${o}/><path d="M9,36 L16,36 M9,44 L16,44" stroke="${INK}" stroke-width="0.6" opacity="0.6"/><rect x="9.4" y="46" width="6.4" height="5.6" rx="1" fill="#4a3a28" ${o}/><path d="M10,28.6 Q12,26.4 15.6,27.4" stroke="#7a6446" stroke-width="0.6" fill="none"/>`);
    if (style === 8 && outfit !== 'brute') p.push(`<path d="M16.4,10 Q11.6,20 13,33 Q16,36 19.4,33 Q17.6,22 20.6,12 Z" fill="${hair}" ${o}/><path d="M29.6,12 Q32.4,20 31.4,28 L28.6,27 Q29.6,20 27.8,13 Z" fill="${shade(hair, 0.8)}" ${o}/><path d="M15.6,16 Q14.6,24 15.6,31" stroke="${shade(hair, 0.6)}" stroke-width="0.5" fill="none"/>`);
    if (top === 3) p.push(`<path d="M16,21 Q14.6,27.4 19,28.6 L27.4,28.6 Q31.4,27.4 30.2,21.6 Q26,25 23,25 Q19.4,25 16,21 Z" fill="${shade(coat, 0.8)}" ${o}/>`);
    if (style === 1 && outfit !== 'brute') p.push(`<path d="M17,12 Q12.6,22 14.6,34 Q16.8,35.4 18.6,31.6 Q17,22 20.4,14 Z" fill="${hair}" ${o}/><path d="M16.4,18 Q15.4,26 16.4,32" stroke="${shade(hair, 0.6)}" stroke-width="0.5" fill="none"/>`);
    // The far arm: in front of the body when reaching forward, otherwise hanging just outside the
    // far edge of the torso so both arms always show.
    // Rifles are held with two hands: the front hand on the grip, the far hand under the forend.
    const twoHand = armed && !(outfit === 'crew' && role === 'bulwark');
    const fh = aim ? [38.6, 31.4] : work ? [39, 40] : drink ? [30, 34] : armed ? [33.5, 45] : st > 0 ? [26.6, 55] : st < 0 ? [35.6, 53.6] : [31.6, 56];
    const longGun = outfit === 'marksman' || (outfit === 'crew' && role === 'longshot');
    const glen = longGun ? 18 : outfit === 'brute' ? 9 : 12;
    const gx = aim ? fh[0] - 15 : fh[0] - 13, gy = fh[1] - 1, grot = aim ? 0 : -14;
    let support = null;
    if (twoHand) {
      const lx = gx + 19.2 + glen * 0.25 - fh[0], ly = gy + 2.4 - fh[1], a = grot * Math.PI / 180;
      support = [fh[0] + lx * Math.cos(a) - ly * Math.sin(a), fh[1] + lx * Math.sin(a) + ly * Math.cos(a)];
    }
    const backFront = aim || work || twoHand;
    const bx = 13.6 - wide;
    const backHand = twoHand ? support : work ? [35.4, 45] : st > 0 ? [bx + 3, 54.4] : st < 0 ? [bx - 4, 53.6] : [bx - 1.6, 55.6];
    const bctl = twoHand ? (aim ? '27,42' : '27,47') : work ? '24,44' : `${bx - 3},42`;
    const backInk = () => `<path d="M${backFront ? 17 : bx + 1.4},30 Q${bctl} ${backHand[0]},${backHand[1]}" fill="none" stroke="${INK}" stroke-width="6.4" stroke-linecap="round"/><path d="M${backFront ? 17 : bx + 1.4},30 Q${bctl} ${backHand[0]},${backHand[1]}" fill="none" stroke="url(#coatb)" stroke-width="4.8" stroke-linecap="round"/>`;
    const backHandSVG = () => hand(backHand[0], backHand[1] + (twoHand ? 0.4 : 1.2), skin, !twoHand);
    const backArm = () => backInk() + backHandSVG();
    if (!backFront) p.push(backArm());
    // ---------- legs: tapered, mid-stride, with knee creases and road dirt ----------
    p.push(`<g filter="url(#g)"><g transform="rotate(${st} 19 57)">`);
    p.push(`<path d="M15.6,56 Q14.6,64 15.8,71.4 Q15.2,78 15.4,86 L21.2,86 Q21,78 21.8,71.4 Q23,63 22.6,56 Z" fill="url(#pantb)" ${o}/><path d="M15.4,60 L21,86 L15.4,86 Z" fill="url(#grime)"/><path d="M16.2,70.8 Q18.6,69.8 21.4,71" stroke="${shade(pants, 0.4)}" stroke-width="0.6" fill="none"/>`);
    p.push(`<path d="M14.6,84.6 L21.8,84.6 L22,90 Q24.4,90.6 24.6,92.6 L24.6,94 L14.2,94 Z" fill="#2a1d14" ${o}/><path d="M14.4,93 L24.4,93" stroke="#14100c" stroke-width="1.6"/></g><g transform="rotate(${-st} 27 57)">`);
    p.push(`<path d="M23.2,56 Q23.2,64 25,71.4 Q25.2,78 25.6,86 L31.4,86 Q31,78 30.8,71.4 Q31.4,63 30.4,56 Z" fill="url(#pant)" ${o}/>`);
    p.push(`<path d="M23.2,58 L25.6,86 L23.2,86" fill="url(#grime)"/>`);
    p.push(`<path d="M25.6,70.6 Q28,69.4 30.6,70.6 M25.8,72.6 Q28,71.8 30.4,72.8" stroke="${shade(pants, 0.45)}" stroke-width="0.6" fill="none"/>`);
    p.push(`<path d="M28.4,57 Q29.6,66 28.6,72 Q29.4,79 29.6,86" stroke="${shade(pants, 0.5)}" stroke-width="1.6" opacity="0.5" fill="none"/>`);
    // front boot: laced, scuffed, sole
    p.push(`<path d="M24.6,84.6 L31.8,84.6 L32,89.6 Q35.6,90.2 36.2,92.6 L36.2,94 L24.6,94 Z" fill="#3a281c" ${o}/>`);
    p.push(`<path d="M24.8,93 L36,93" stroke="#14100c" stroke-width="1.6"/><path d="M26,86.4 L30.8,86.4 M26,88.2 L31,88.2 M26.2,90 L31.2,90" stroke="#7a6450" stroke-width="0.45"/><path d="M27,85.4 L30,90.8 M30,85.4 L27,90.8" stroke="#7a6450" stroke-width="0.35" opacity="0.7"/><path d="M33,90.4 Q35,90.8 35.6,92" stroke="#6a5644" stroke-width="0.6" fill="none"/></g></g>`);
    // ---------- torso ----------
    p.push(`<g filter="url(#g)">`);
    if (outfit === 'scav') {
      p.push(`<path d="M12.6,30 Q11.4,44 10.6,62.4 L34.6,62.4 Q33.4,44 32.4,30 Q28,23.6 23,23.6 Q17.6,23.6 12.6,30 Z" fill="url(#coat)" ${o}/><path d="M10.6,62.4 L13.6,58 L16.8,63.4 L20,58.2 L23,63.6 L26,58.2 L29,63.4 L32.2,58 L34.6,62.4" fill="none" stroke="${INK}" stroke-width="0.7"/><path d="M17.4,32 Q20,46 16.6,58.6 M27.6,33 Q26,46 29.4,58.6 M22.6,30 Q23.6,44 22.4,60" stroke="${INK}" stroke-width="0.5" opacity="0.35" fill="none"/><path d="M27,30 Q31,44 33,60 L31,61 Q28,46 26,31 Z" fill="${shade(coat, 0.6)}" opacity="0.45"/>`);
    } else {
      const torso = `M${13.4 - wide},29.4 Q${14.2 - wide},25.6 19,24.6 Q23,23.8 27,24.6 Q${31.8 + wide},25.6 ${32.6 + wide},29.4 Q${33.2 + wide},40 ${31.8 + wide},49 Q${32.2 + wide},56 ${31.6 + wide},61.4 L${14.4 - wide},61.4 Q${13.8 - wide},56 ${14.2 - wide},49 Q${12.8 - wide},40 ${13.4 - wide},29.4 Z`;
      if (top === 2) p.push(`<path d="M${14 - wide},56 L${12 - wide},80 Q${16},81 ${19},79 L20,58 Z M${32 + wide},56 L${34.4 + wide},79 Q31,81 27.6,79.4 L26,58 Z" fill="url(#coatb)" ${o}/><path d="M${13.4 - wide},66 L${12.6 - wide},78 M${33 + wide},66 L${33.8 + wide},78" stroke="${shade(coat, 0.5)}" stroke-width="0.6"/>`);
      p.push(`<path d="${torso}" fill="${top === 1 ? shirt : 'url(#coat)'}" ${o}/>`);
      if (top === 1) p.push(`<path d="M${13.6 - wide},29 Q15,26 19.4,25 L21.4,40 L20.6,61.4 L${14.4 - wide},61.4 Q${13.8 - wide},50 ${14.2 - wide},45 Z M26.6,25 Q31,26 ${32.4 + wide},29 L${31.8 + wide},49 L${31.6 + wide},61.4 L25.6,61.4 L24.8,40 Z" fill="url(#coat)" ${o}/><circle cx="22.8" cy="45" r="0.5" fill="#3a2a1c"/><circle cx="22.8" cy="52" r="0.5" fill="#3a2a1c"/>`);
      // shading: shadow down the far side and under the chest, highlight on the near shoulder
      p.push(`<path d="M${27.6},25.2 Q${32 + wide},27 ${32.4 + wide},31 Q${33 + wide},41 ${31.6 + wide},49 Q${32 + wide},56 ${31.4 + wide},61 L28.4,61 Q29.6,50 28.6,42 Q29.4,32 27.6,25.2 Z" fill="${shade(coat, 0.55)}" opacity="0.55"/><path d="M${14.6 - wide},28.6 Q16.4,25.6 19.6,25 Q17,28 16.4,36" stroke="${shade(coat, 1.45)}" stroke-width="1.1" fill="none" opacity="0.55"/>`);
      p.push(`<path d="M19.6,25.6 L23,35 L26.4,25.6 Q23,24.2 19.6,25.6 Z" fill="${outfit === 'raider' || outfit === 'brute' ? '#4a3e34' : shirt}"/>`);
      p.push(`<path d="M18.6,25 Q19.6,32 23,40.4 L21.6,41 Q18,33 17.6,25.6 Z M27.4,25 Q26.4,32 23,40.4 L24.4,41 Q28,33 28.4,25.6 Z" fill="${shade(coat, 1.12)}"/>`);
      p.push(`<path d="M17.4,33.4 Q19.4,44 17.4,58.6 M28.6,34 Q27.2,46 29.2,58.6 M20,46 Q23,47.6 26.4,46" stroke="${INK}" stroke-width="0.5" opacity="0.32" fill="none"/>`);
      p.push(`<rect x="${14 - wide}" y="50" width="${17.6 + wide * 2}" height="3.4" fill="#2a1f17" ${o}/><rect x="21.6" y="49.7" width="3.2" height="4" rx="0.4" fill="#b08a3e" stroke="${INK}" stroke-width="0.5"/><rect x="22.4" y="50.6" width="1.6" height="2.2" fill="#2a1f17"/><path d="M26,52.6 L31,52.6 L30.6,58 L26.4,58 Z" fill="${shade(coat, 0.6)}" ${o}/><path d="M26.2,54.2 L30.8,54.2" stroke="${INK}" stroke-width="0.4"/>`);
      if (outfit !== 'brute') p.push(`<circle cx="22.6" cy="43.4" r="0.75" fill="#3a2a1c" stroke="${shade(coat, 1.3)}" stroke-width="0.3"/><circle cx="22.4" cy="47" r="0.75" fill="#3a2a1c" stroke="${shade(coat, 1.3)}" stroke-width="0.3"/>`);
      if (top === 3) p.push(`<path d="M21,27 L20.4,36 M25,27 L25.6,36" stroke="#e8dcc0" stroke-width="0.6"/><circle cx="20.4" cy="36.4" r="0.6" fill="#e8dcc0"/><circle cx="25.6" cy="36.4" r="0.6" fill="#e8dcc0"/><path d="M${15 - wide},44 Q23,46 ${31 + wide},44 L${31 + wide},52 Q23,54 ${15 - wide},52 Z" fill="${shade(coat, 0.85)}" opacity="0.6"/>`);
      if (top === 4) p.push(`<path d="M${12.4 - wide},29 Q23,22 ${33.6 + wide},29 L${36 + wide},50 L32,47.6 L28.6,51.6 L25,48 L21.6,52 L18,48 L14.6,51.4 L${10.4 - wide},50 Z" fill="${shade(SHIRT[(look.coat + 2) % SHIRT.length], 0.8)}" ${o}/><path d="M17,31 Q16,40 14.6,49 M23,28 L23,51 M29,31 Q30,40 31.6,48" stroke="${INK}" stroke-width="0.4" opacity="0.35" fill="none"/><path d="M${12.6 - wide},33 L${34.6 + wide},33" stroke="#a8432f" stroke-width="1.2" opacity="0.7"/>`);
      if (look.acc === 4) p.push(`<path d="M20,26 Q22.4,33 25.4,26" stroke="#9a9a90" stroke-width="0.5" fill="none"/><rect x="21.8" y="31.6" width="1.8" height="2.6" rx="0.4" fill="#c8ccc6" stroke="${INK}" stroke-width="0.3"/>`);
    }
    p.push(`</g>`);
    // ---------- outfit and role gear ----------
    const rivets = (pts) => pts.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="0.45" fill="#2a2a28"/>`).join('');
    if (outfit === 'crew' && role === 'bulwark') p.push(`<path d="M14.8,29.6 Q23,26 31.4,29.6 L30.8,47.4 Q23,50 15.4,47.4 Z" fill="url(#metal)" ${o}/><path d="M16.6,34 Q23,32.6 29.6,34 M16.4,39.6 Q23,38.2 29.8,39.6 M16.6,45 Q23,43.8 29.6,45" stroke="${INK}" stroke-width="0.5" opacity="0.55" fill="none"/>${rivets([[17, 31.6], [29, 31.6], [17, 46], [29, 46]])}<path d="M27,25.6 Q33.6,24.6 34.6,31 L29.2,32.4 Z" fill="url(#metal)" ${o}/><path d="M18,36 Q20,35 21,37" stroke="#7a3a22" stroke-width="0.8" opacity="0.6" fill="none"/>`);
    if (outfit === 'crew' && role === 'sawbones') p.push(`<path d="M15,30.4 L31,30.4 L30.2,60.4 L15.8,60.4 Z" fill="#d6cfbd" opacity="0.55"/><path d="M18,40 Q20,41 19.4,44 M26,50 Q27.6,51 27,53" stroke="#8a2a1e" stroke-width="0.6" opacity="0.55" fill="none"/><path d="M15.4,52 L28.4,29.6" stroke="#4a3424" stroke-width="1.3"/><rect x="9.6" y="50" width="7.6" height="6.6" rx="1.2" fill="#6b4a32" ${o}/><rect x="11.8" y="51.2" width="3.2" height="4.2" fill="#e9e2d0"/><path d="M13.4,51.8 L13.4,54.8 M11.9,53.3 L14.9,53.3" stroke="#c03a2e" stroke-width="1.1"/>`);
    if (outfit === 'crew' && role === 'tinker') p.push(`<rect x="13.6" y="53.4" width="18" height="3.2" fill="#5a4636" ${o}/><path d="M16,56.6 L15.2,62 M16.6,56.6 Q14.6,58.6 15.6,60.4" stroke="#9aa0a0" stroke-width="1.2" fill="none"/><path d="M19.4,56.4 L20,61.6" stroke="#b08a3e" stroke-width="1.4"/><rect x="27.4" y="56.4" width="3" height="4.6" fill="#7a2a1e" ${o}/>`);
    if (outfit === 'crew' && role === 'drifter') p.push(`<path d="M14.4,28.6 L18.2,52 M31.6,28.6 L28,52" stroke="#3a2c1e" stroke-width="1.5"/><rect x="16.2" y="38" width="2.6" height="3.6" rx="0.4" fill="#5a4630" ${o}/>`);
    if (outfit === 'raider') p.push(`<path d="M15,30 L31,51.4" stroke="${color}" stroke-width="3.4"/><path d="M15,30 L31,51.4" stroke="${INK}" stroke-width="0.5" opacity="0.55"/><path d="M16.4,31 L30,49.4" stroke="${shade(color, 1.35)}" stroke-width="0.6" opacity="0.6"/><path d="M27.4,26 Q34.4,23.6 35.6,30.4 L30,31.6 Z" fill="#4e4a44" ${o}/><path d="M29.6,25.4 L30.8,20.6 L32,25 M32.4,25.8 L35,21.8 L34.6,27" fill="#a8a296" ${o}/><path d="M17,36 Q19,38 18,41" stroke="#2a1a12" stroke-width="0.7" fill="none"/>`);
    if (outfit === 'brute') p.push(`<path d="M12.6,28.4 Q23,24 33.4,28.4 L32.4,50.4 Q23,53.4 13.6,50.4 Z" fill="url(#metal)" ${o}/><path d="M15.6,33 Q23,31.4 30.6,33 M15.4,39 Q23,37.4 30.8,39 M15.6,45 Q23,43.6 30.6,45" stroke="${INK}" stroke-width="0.6" opacity="0.55" fill="none"/>${rivets([[15.4, 30.6], [30.6, 30.6], [15.6, 48.4], [30.6, 48.4], [23, 29]])}<path d="M13.6,29 L32.4,48" stroke="${color}" stroke-width="2.8" opacity="0.9"/><path d="M7.6,26 Q13.6,21.4 17.4,28 L12,33.6 Q7.4,31.4 7.6,26 Z M38.6,26 Q32.6,21.4 28.8,28 L34.2,33.6 Q38.8,31.4 38.6,26 Z" fill="#4e4a44" ${o}/><path d="M9.6,24.6 L9,20.4 L11.4,23.6 M36.6,24.6 L37.4,20.4 L35,23.6" fill="#a8a296" ${o}/>`);
    if (outfit === 'marksman') p.push(`<path d="M13.8,61 L11.4,75 L19.4,72.4 Z M31.4,61 L34.6,75 L26.8,72.4 Z" fill="url(#coat)" ${o}/><path d="M15.8,27.4 Q23,31.6 30.4,27.4" stroke="${color}" stroke-width="2.6" fill="none"/>`);
    // ---------- neck and head ----------
    p.push(`<path d="M20.4,19.6 L20.4,26 Q23,27.8 25.6,26 L25.6,19.6 Z" fill="${shade(skin, 0.76)}" ${o}/><path d="M20.6,21 Q23,23.4 25.4,21.6" stroke="${shade(skin, 0.55)}" stroke-width="0.8" fill="none" opacity="0.7"/>`);
    p.push(`<g><path d="M16.4,15 Q16.2,7.2 23,7 Q29.8,7 29.9,13.6 L30.9,16.4 Q31.2,17.6 30,17.9 L29.8,19.8 Q28.6,22.8 24.6,22.8 Q19.2,22.8 17.4,19.4 Q16.2,17.4 16.4,15 Z" fill="url(#face)" ${o}/></g>`);
    p.push(`<path d="M24.6,17.8 Q27,19 29.6,18.2" stroke="${shade(skin, 0.7)}" stroke-width="0.7" fill="none" opacity="0.6"/><path d="M21.4,15.6 Q22.6,18.6 25,19" stroke="${shade(skin, 0.7)}" stroke-width="0.6" fill="none" opacity="0.5"/>`);
    p.push(`<ellipse cx="18.8" cy="15.6" rx="1.8" ry="2.5" fill="${shade(skin, 0.84)}" ${o}/>`);
    // eye: white, iris, lid, brow
    const iris = ['#3a2614', '#2a3442', '#2e3a26', '#1e140c'][look.coat % 4];
    // whites then pupils looking forward: two pixels per eye, readable on any skin tone
    p.push(`<rect x="25.6" y="13.2" width="3" height="2.2" rx="0.5" fill="#ece2d0"/><rect x="27.1" y="13.2" width="1.6" height="2.2" rx="0.4" fill="${iris}"/><rect x="21.6" y="13.4" width="2.6" height="2" rx="0.5" fill="#ddd2c0"/><rect x="22.8" y="13.4" width="1.4" height="2" rx="0.4" fill="${iris}"/>`);
    p.push(`<path d="M25.8,12.2 L28.8,12" stroke="${shade(hair, 0.8)}" stroke-width="1.1" stroke-linecap="round"/><path d="M21.8,12.4 L24,12.3" stroke="${shade(hair, 0.8)}" stroke-width="1" stroke-linecap="round"/>`);
    // nose with nostril, lips
    // a soft nose shadow and a plain mouth: simple shapes that hold up at sprite size
    p.push(`<path d="M27.6,15.4 L29.4,17.4 L27.4,17.8 Z" fill="${shade(skin, 0.72)}"/>`);
    p.push(`<rect x="25" y="19.4" width="3.4" height="0.9" rx="0.4" fill="${shade(skin, 0.55)}"/>`);
    if (facial === 1) p.push(`<path d="M19,17.6 Q20,22.6 24.6,22.8 Q28.6,22.6 29.4,19.6 Q27,21 24.6,20.6 Q21,20.2 19,17.6 Z" fill="${shade(hair, 0.7)}" opacity="0.4"/>`);
    if (facial === 2) p.push(`<path d="M25.6,18.8 Q27.4,18 29.8,18.6 Q30.2,19.8 29.4,20.2 Q27.6,19.4 25.8,20 Z" fill="${hair}" stroke="${INK}" stroke-width="0.4"/>`);
    if (facial === 3) p.push(`<path d="M18.4,17.8 Q19.4,23 24.6,23.2 Q28.8,23 29.6,19.4 Q28.6,21.6 27.6,21 Q26.4,21.6 24.6,21 Q21.2,20.6 18.4,17.8 Z" fill="${hair}" opacity="0.88"/><path d="M20,19.6 Q22,22 25,22.4" stroke="${shade(hair, 0.6)}" stroke-width="0.4" fill="none"/>`);
    if (facial === 4) p.push(`<path d="M26,20.6 Q27.6,24.4 29.2,20.6 Q27.6,21.4 26,20.6 Z" fill="${hair}" stroke="${INK}" stroke-width="0.4"/><path d="M26.4,18.8 Q27.8,18.2 29.4,18.8" stroke="${hair}" stroke-width="0.8" fill="none"/>`);
    if (look.age === 2) p.push(`<path d="M27.4,16.4 Q27,19 28,20.4" stroke="${shade(skin, 0.6)}" stroke-width="0.9" fill="none"/>`);
    if (look.age === 0) p.push(`<ellipse cx="27.2" cy="17.4" rx="1.4" ry="0.8" fill="#e0806a" opacity="0.25"/>`);
    const mark = look.mark % 5;
    if (mark === 1) p.push(`<path d="M25.6,16.4 L28.4,19.6" stroke="#e8a898" stroke-width="1.4" stroke-linecap="round"/>`);
    if (mark === 3) p.push(`<path d="M24.6,13 L31,12.8 L31,15.4 L24.6,15.8 Z" fill="#7a2a1e" opacity="0.55"/><path d="M27,17 l2.6,0.2 M27.2,18 l2.4,0.2" stroke="#2a1a14" stroke-width="0.4" opacity="0.6"/>`);
    // ---------- hair ----------
    const hc = hair, hd = shade(hair, 0.62), hl = shade(hair, 1.4);
    const strands = () => ''; // fine strand lines turn into stray pixels at sprite size
    if (style === 0) p.push(`<path d="M16.2,15.6 Q15,6 23.2,5.4 Q30.8,5.2 30.6,12.4 Q28,8.8 23.4,9.6 Q19.6,10.2 18.8,16.6 Z" fill="${hc}" ${o}/>${strands('M18.6,8.6 Q22,6.4 27,7.2 M17.4,11 Q20,8.6 24,8.6 M17.2,13.6 Q18.2,11 21,10.4')}<path d="M20,7 Q24,5.8 27.6,7" stroke="${hl}" stroke-width="0.6" opacity="0.6" fill="none"/>`);
    if (style === 1) p.push(`<path d="M16.2,16 Q14.8,5.6 23.4,5.2 Q31.2,5.2 30.6,12.8 Q27,8.6 22,10.4 Q19,11.8 18.4,18 Z" fill="${hc}" ${o}/>${strands('M18,9 Q22,6.4 28,7.6 M17.2,12 Q19.4,9 24,9')}<circle cx="16.8" cy="12.4" r="1.5" fill="${hd}" ${o}/>`);
    if (style === 2) p.push(`<path d="M16.2,15.4 Q15.2,6.2 23.2,5.6 Q30.6,5.4 30.4,12.2 Q27.4,9.2 23,9.8 Q19.6,10.4 18.6,16 Z" fill="${hc}" ${o}/><circle cx="17" cy="7.2" r="3.6" fill="${hc}" ${o}/>${strands('M15,6.6 Q17,5 19.2,6.8 M15.2,8.6 Q17.4,7.2 19.6,8.8 M19.4,8.4 Q23,6.4 28,8')}`);
    if (style === 3) { const cap = outfit === 'raider' ? '#3a3632' : shade(COAT[(look.coat + 2) % 6], 0.85); p.push(`<path d="M15.6,12.6 Q15.4,4.2 23.2,4 Q30.4,4 30.6,10.8 L36.4,12 Q36.2,13.8 31,13.6 L15.8,13.6 Z" fill="${cap}" ${o}/><path d="M17.6,11.6 Q23,10.2 30.2,11 M23,4.2 L23.4,10.6" stroke="${INK}" stroke-width="0.5" opacity="0.5" fill="none"/><path d="M30.6,12.2 L36,12.4" stroke="${shade(cap, 1.4)}" stroke-width="0.5" opacity="0.6"/><path d="M16.4,13.6 L16.6,17.2" stroke="${hc}" stroke-width="1.8"/>`); }
    if (style === 4) p.push(`<path d="M16.4,14 Q16.2,6.6 23.2,6.2 Q30.2,6.2 30,11.4 Q27,8.4 23,8.8 Q19.4,9.4 18.2,14.6 Z" fill="${hc}" opacity="0.72" ${o}/><path d="M17.6,9 Q21,7 26,7.6" stroke="${hd}" stroke-width="0.5" opacity="0.6" fill="none"/>`);
    if (style === 6) p.push(`<path d="M17,10 Q20,6.6 25,6.8" stroke="#fff" stroke-width="1" opacity="0.35" fill="none"/><path d="M16.8,13.6 Q16.8,11 18,9.6" stroke="${hd}" stroke-width="0.8" fill="none" opacity="0.5"/>`);
    if (style === 7) p.push(`<path d="M18.6,9.4 Q19,3.4 23,2.6 Q27.4,2.8 27.6,8 Q25,6.4 23,6.6 Q20.6,7 18.6,9.4 Z" fill="${hc}" ${o}/>`);
    if (style === 8) p.push(`<path d="M16,16 Q14.6,5.8 23.2,5.2 Q31,5 30.6,12.8 Q27,9.2 22,10.4 Q18.6,11.6 18.2,18.4 Z" fill="${hc}" ${o}/>${strands('M18,9 Q22,6.4 28,7.6 M17,12 Q19,9 24,8.8 M16.6,15 Q17,12 19,11')}`);
    if (style === 9) { const cap = ['#7a2a1e', '#3f5966', '#4a4a3a', '#6a5a3a'][look.coat % 4]; p.push(`<path d="M15.8,13.4 Q15.4,4.6 23.2,4.2 Q30.6,4.2 30.6,11.6 L30.4,13.4 Q23,11.4 15.8,13.4 Z" fill="${cap}" ${o}/><path d="M15.8,12 Q23,10 30.6,11.8 L30.4,13.6 Q23,11.6 15.8,13.6 Z" fill="${shade(cap, 0.75)}" stroke="${INK}" stroke-width="0.6"/><circle cx="23" cy="3.8" r="1.6" fill="${shade(cap, 1.2)}" ${o}/>`); }
    if (style === 5) p.push(`<path d="M15.8,15.2 Q15,5.6 23.2,5.2 Q30.8,5.2 30.6,12 Q27,10.2 22,10.4 Q19,10.8 18.4,16 Z" fill="#8a6a4a" ${o}/><path d="M16,9 L11.2,12.8 L13,14 L16.8,11.4 Z M15.8,10 L12,16 L13.8,16.4 L17,11.6 Z" fill="#7a5a3c" ${o}/><path d="M18,8 Q23,6.4 28.4,8.2 M17.2,11 Q22,9.2 29,10.6 M18.4,13.4 Q22,12 26,12.4" stroke="${INK}" stroke-width="0.5" opacity="0.4" fill="none"/>`);
    // face gear and personal touches
    // eyepatch: worn brown leather with a lit edge, a thick strap angled up around the head
    if (mark === 2) p.push(`<path d="M16.2,10.8 L25.6,13.4" stroke="#4a3022" stroke-width="1.8" stroke-linecap="round"/><path d="M25.4,13 Q27.2,12.2 28.8,13 L28.6,15.6 Q27.2,16.6 25.6,15.6 Z" fill="#5a3a26"/><path d="M25.6,13.2 Q27.2,12.5 28.6,13.2" stroke="#a87a52" stroke-width="0.7" fill="none"/>`);
    if (mark === 4) p.push(`<path d="M16.4,9.6 Q23,6.6 30.4,9.6 L30.2,11.8 Q23,9 16.6,12 Z" fill="#e8e0cc" ${o}/><circle cx="27.6" cy="10.2" r="0.9" fill="#a8432f" opacity="0.8"/>`);
    if (look.acc === 1 && !(outfit === 'crew' && (role === 'drifter' || role === 'longshot'))) p.push(`<path d="M19.4,22.6 Q23,25.4 28,22.8 L26.6,27.4 Q23,28.2 20,26 Z" fill="${['#a8432f', '#3f5966', '#6a6a3a', '#5a3a6a'][look.coat % 4]}" ${o}/><path d="M26.6,27.4 l1.4,2.4 l-2.4,-0.6 Z" fill="${['#a8432f', '#3f5966', '#6a6a3a', '#5a3a6a'][look.coat % 4]}" stroke="${INK}" stroke-width="0.5"/>`);
    if (look.acc === 2 && style !== 9 && style !== 3 && !(outfit === 'crew' && role === 'tinker') && crewish) p.push(`<path d="M16.2,9.2 Q23,6.4 30.4,8.6" stroke="#5a4232" stroke-width="2.6" fill="none"/><rect x="22.6" y="5.2" width="8" height="4.4" rx="2" fill="#3a2e24" ${o}/><rect x="23.6" y="6.2" width="2.8" height="2.4" rx="1" fill="#e0a850"/><rect x="27.2" y="6.2" width="2.8" height="2.4" rx="1" fill="#e0a850"/>`);
    if (look.acc === 3) p.push(`<circle cx="18.4" cy="18.4" r="0.8" fill="#d8b04a" stroke="${INK}" stroke-width="0.3"/>`);
    if (outfit === 'crew' && role === 'tinker') p.push(`<path d="M16.2,10.4 Q23,7.8 30.4,9.6" stroke="#5a4232" stroke-width="2.6" fill="none"/><rect x="22.8" y="6.6" width="8.6" height="5" rx="2.2" fill="#3a2e24" ${o}/><rect x="23.8" y="7.6" width="3.2" height="3" rx="1.2" fill="#8fd0e0"/><rect x="27.6" y="7.6" width="3.2" height="3" rx="1.2" fill="#8fd0e0"/>`);
    if (outfit === 'raider' || outfit === 'marksman') p.push(`<path d="M17,12.2 Q24,10.8 30.8,12.2 L30.8,15.6 Q24,14.8 17,15.8 Z" fill="#2a2420" ${o}/><circle cx="26.4" cy="13.8" r="1.7" fill="#3a2a18" stroke="${INK}" stroke-width="0.6"/><circle cx="26.4" cy="13.8" r="1.1" fill="#c08a3a"/><circle cx="29.5" cy="13.8" r="1.4" fill="#3a2a18" stroke="${INK}" stroke-width="0.6"/><circle cx="29.5" cy="13.8" r="0.9" fill="#c08a3a"/><path d="M25.8,13.2 L26.4,13.6" stroke="#ffe0a0" stroke-width="0.4"/>`);
    if (outfit === 'raider' && seed % 2) p.push(`<path d="M22.4,17.4 Q27,16 31.2,17.6 L30.2,21.8 Q26,23.6 22.8,22.4 Z" fill="#3a3632" ${o}/><circle cx="28" cy="19.8" r="1.2" fill="#5a5650" ${o}/><path d="M24,18.6 L24,21.6 M25.4,18.2 L25.4,22" stroke="${INK}" stroke-width="0.4" opacity="0.6"/>`);
    if (outfit === 'brute') p.push(`<path d="M15.4,14.2 Q14.8,3.6 23.2,3.2 Q31.6,3.4 31.2,13.6 L29.6,13.6 Q29,8.4 23.2,8 Q17.4,8.4 17.2,14.2 Z" fill="url(#metal)" ${o}/><path d="M23.2,3.4 L23.2,8" stroke="${INK}" stroke-width="0.6"/>${rivets([[18, 9.6], [28.4, 9.6]])}`);
    if (outfit === 'marksman') p.push(`<path d="M15.2,16.4 Q14.2,3.6 23.4,3.6 Q32.2,3.8 31.6,13.2 Q30,7.6 23.4,7.6 Q18,8 17.6,17.4 Z" fill="${shade(coat, 0.9)}" ${o}/><path d="M17,8 Q16,13 16.6,17" stroke="${shade(coat, 0.6)}" stroke-width="0.6" fill="none"/>`);
    if (outfit === 'crew' && role === 'drifter') p.push(`<path d="M19.2,22.6 Q23,25.6 28.2,22.6 L27.2,26.2 Q23,28 19.8,26 Z" fill="#a8432f" ${o}/><path d="M21,24.4 Q23,25.6 26,24.4" stroke="#6a2a1e" stroke-width="0.4" fill="none"/>`);
    if (outfit === 'crew' && role === 'longshot') p.push(`<path d="M18.8,22.4 Q23,25.8 28.6,22.4 L28.8,27.2 Q23,29.6 18.6,26.8 Z" fill="#6a6a52" ${o}/><path d="M20,25 Q23,26.8 27.6,25" stroke="#4a4a38" stroke-width="0.4" fill="none"/>`);
    if (backFront) p.push(twoHand ? backInk() : backArm());
    // ---------- front arm, held items ----------
    const elbow = aim ? '35,40' : work ? '34,36' : drink ? '34.6,44' : armed ? '31.5,43' : '33.4,43';
    if (twoHand) {
      p.push(`<g transform="rotate(${grot} ${fh[0]} ${fh[1]})">${rifle(gx, gy, glen, { scope: longGun, double: outfit === 'brute' })}</g>`);
      p.push(backHandSVG());
    }
    p.push(`<path d="M29.6,29.2 Q${elbow} ${fh[0]},${fh[1]}" fill="none" stroke="${INK}" stroke-width="6.8" stroke-linecap="round"/><path d="M29.6,29.2 Q${elbow} ${fh[0]},${fh[1]}" fill="none" stroke="url(#coat)" stroke-width="5.2" stroke-linecap="round"/><path d="M30.6,32 Q${elbow} ${fh[0] - 1},${fh[1] - 1}" fill="none" stroke="${shade(coat, 1.35)}" stroke-width="0.8" opacity="0.45"/>`);
    p.push(`<path d="M${fh[0] - 2.6},${fh[1] - 1.2} Q${fh[0] - 1},${fh[1] - 2.6} ${fh[0] + 0.6},${fh[1] - 1}" stroke="${shade(coat, 0.55)}" stroke-width="1.3" fill="none"/>`);
    if (outfit === 'crew' && role === 'sawbones') p.push(`<rect x="27.6" y="33" width="5.8" height="3" fill="#e9e2d0" stroke="${INK}" stroke-width="0.5" transform="rotate(30 30 34)"/><path d="M29.8,33.2 L30.8,35.6" stroke="#c03a2e" stroke-width="0.9" transform="rotate(30 30 34)"/>`);
    if (drink) p.push(`<path d="M${fh[0] - 1.8},${fh[1] - 6.4} L${fh[0] + 2},${fh[1] - 6.4} L${fh[0] + 1.6},${fh[1] - 0.6} L${fh[0] - 1.4},${fh[1] - 0.6} Z" fill="#c7b48a" ${o}/><path d="M${fh[0] - 1.6},${fh[1] - 5} L${fh[0] + 1.8},${fh[1] - 5}" stroke="#8a6a3a" stroke-width="0.6"/>`);
    p.push(hand(fh[0], fh[1] + 0.6, skin));
    if (outfit === 'crew' && role === 'bulwark' && armed) p.push(`<path d="M30.6,31.6 Q38.4,30.4 41.6,33.6 L41.6,64.4 Q36.4,68.6 30.6,64.4 Z" fill="url(#metal)" ${o}/><rect x="32.6" y="37.6" width="7" height="2" rx="1" fill="#2a2420"/><path d="M31.6,46 L40.8,46 M31.6,54 L40.8,54" stroke="${INK}" stroke-width="0.5" opacity="0.5"/>${rivets([[32, 34], [40.4, 34.6], [32, 62], [40.4, 62]])}<path d="M37,49 Q38.6,50.6 38,52.6" stroke="#4a4e50" stroke-width="0.8" fill="none"/><path d="M32,33 Q33,48 32.2,63" stroke="#fff" stroke-width="0.7" opacity="0.35" fill="none"/>`);
    // rim light from the lamp side
    p.push(`<path d="M14.4,30 Q13.4,44 14.4,60" stroke="#ffd9a0" stroke-width="0.9" opacity="0.35" fill="none"/><path d="M17,9 Q19.6,6.4 23,6.2" stroke="#ffe2b0" stroke-width="0.8" opacity="0.4" fill="none"/>`);
    return svg(CHAR_W, CHAR_H, p.join(''), defs);
  }
  // Draw a person with feet at (0,0) on ctx, height in world units.
  function person(ctx, look, opts = {}) {
    const fl = fullLook(look);
    const key = `p|${look.skin}|${look.hair}|${look.coat}|${fl.build}${fl.age}${fl.style}${fl.facial}${fl.mark}${fl.acc}${fl.top}|${opts.role || ''}|${opts.armed ? 1 : 0}|${opts.pose || 'idle'}|${opts.outfit || 'crew'}|${opts.color || ''}|${(opts.seed || 0) % 6}`;
    const img = request(key, () => softInk(personSVG(look, opts)), CHAR_W, CHAR_H, { pw: 43, ph: 64, k: 22, clean: true, soft: true });
    if (!img) return false;
    const h = (opts.height || 46) * (opts.outfit === 'brute' ? 1 : [0.97, 1, 1.02][fl.build % 3] * (fl.age === 2 ? 0.98 : 1)), w = h * CHAR_W / CHAR_H;
    ctx.save();
    if (opts.facing === -1) ctx.scale(-1, 1);
    blit(ctx, img, -w * 23 / CHAR_W, -h * 94 / CHAR_H, w, h);
    ctx.restore();
    return true;
  }
  // Line art for people and animals: a warm, see-through brown rather than black, so figures read by
  // colour and shading instead of a hard outline.
  const softInk = (svgText) => svgText.split(`stroke="${INK}"`).join('stroke="#3a2618" stroke-opacity="0.5"');
  // A head-and-shoulders portrait cut from the same illustration, as its own crisp pixel image.
  function bust(look, role = 'recruit') {
    const fl = fullLook(look);
    const key = `bust2|${look.skin}|${look.hair}|${look.coat}|${fl.build}${fl.age}${fl.style}${fl.facial}${fl.mark}${fl.acc}${fl.top}|${role}`;
    // a tight frame on head and shoulders, rendered at 2x the old pixel density so eyes, brows, hair and kit read
    return request(key, () => softInk(personSVG(look, { role, pose: 'idle', outfit: 'crew' })).replace(/viewBox="[^"]*" width="[^"]*" height="[^"]*"/, `viewBox="${BUST_BOX.join(' ')}" width="${BUST_BOX[2]}" height="${BUST_BOX[3]}"`), BUST_BOX[2], BUST_BOX[3], { pw: 64, ph: 64, k: 28, outline: false, ss: 4 });
  }
  const BUST_BOX = [8, -2, 30, 30];
  // Where the rifle's muzzle sits for a figure drawn by person() at this height (aim pose).
  function muzzle(opts = {}) {
    const h = opts.height || 46, k = h / CHAR_H;
    const long = opts.outfit === 'marksman' || (opts.outfit !== 'brute' && opts.role === 'longshot');
    const len = long ? 20 : opts.outfit === 'brute' ? 9 : 13;
    return { x: (38.6 - 16 + 16.6 + len - 23) * k * (opts.facing === -1 ? -1 : 1), y: -(94 - 29.9) * k };
  }

  // ======================================================================
  // Animals. viewBox 76 x 46, facing right, feet at y 44.
  // ======================================================================
  // A limb drawn as tapered segments: outline pass then fill pass so joints stay clean.
  function limb(pts, widths, fill) {
    let ink = '', body = '';
    for (let i = 0; i < pts.length - 1; i++) {
      const [x1, y1] = pts[i], [x2, y2] = pts[i + 1], w = widths[i];
      ink += `<path d="M${x1},${y1} L${x2},${y2}" stroke="${INK}" stroke-width="${w + 1.5}" stroke-linecap="round"/>`;
      body += `<path d="M${x1},${y1} L${x2},${y2}" stroke="${fill}" stroke-width="${w}" stroke-linecap="round"/>`;
    }
    return ink + body;
  }
  function dogSVG({ hound = false, color = '#a8432f', frame = 0 } = {}) {
    const fur = hound ? '#4e3e30' : '#8a7356', dark = shade(fur, 0.58), light = shade(fur, 1.3), belly = shade(fur, 1.18);
    const defs = grad('fur', light, dark, 0, 1) + grad('furb', shade(fur, 0.78), shade(fur, 0.48), 0, 1) + grit('g', hound ? 7 : 3, 0.5, 1.3)
      + `<linearGradient id="side" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${light}"/><stop offset="0.55" stop-color="${fur}"/><stop offset="1" stop-color="${belly}"/></linearGradient>`;
    const k = frame ? 1 : -1, B = hound ? 1.6 : 0;
    const farF = shade(fur, 0.62), nearF = fur;
    const p = [];
    // far legs (stride opposite the near pair)
    p.push(limb([[47, 22], [47 + k * 1.5, 31], [48 + k * 2.6, 39.4], [50 + k * 2.6, 43]], [4.4, 3, 2.4], farF));
    p.push(limb([[20, 21], [24 - k * 1.5, 30], [18 - k * 2, 36.4], [19.6 - k * 2.4, 43]], [6, 3.4, 2.4], farF));
    // tail: low and ragged on a feral dog, high on a war hound
    const tail = hound ? 'M13,18 Q6,10 4,6' : 'M13,20 Q6,23 3.6,31';
    p.push(`<path d="${tail}" stroke="${INK}" stroke-width="${hound ? 4.6 : 4.2}" fill="none" stroke-linecap="round"/><path d="${tail}" stroke="${fur}" stroke-width="${hound ? 3 : 2.6}" fill="none" stroke-linecap="round"/>`);
    if (!hound) p.push(`<path d="M5,27 l-2,1.4 M4.4,29.4 l-2,0.6 M7,25.4 l-1.6,2" stroke="${dark}" stroke-width="0.8"/>`);
    // body: deep chest, tucked waist, heavy haunch, rough topline
    p.push(`<g filter="url(#g)">`);
    p.push(`<path d="M11.4,22 Q10.4,${14.6 - B} 19,${13.4 - B} L23,${13 - B} L24.6,${11.8 - B} L26.6,${13 - B} L31,${12.8 - B} L33,${11.4 - B} L35,${12.6 - B} Q41,${12 - B} 45,${10.6 - B} L47,${8.8 - B} L48.6,${10.4 - B} Q53.6,${10.6 - B} 56,15.4 Q58.4,23 54.4,${29.6 + B} Q50,${33 + B} 44.6,${30.6 + B} Q38.4,${25.6 + B} 31,${25.4 + B / 2} Q25,25.6 21.6,${28.6 + B / 2} Q13.4,30.4 11.4,22 Z" fill="url(#side)" ${o}/>`);
    // haunch and shoulder muscle, rib cage, mange
    p.push(`<path d="M13,22 Q15,15 23,15.6 Q27,19 24.6,26" stroke="${dark}" stroke-width="0.9" fill="none" opacity="0.6"/><path d="M46,13.6 Q51.6,17.6 50,27" stroke="${dark}" stroke-width="0.9" fill="none" opacity="0.6"/>`);
    if (!hound) p.push(`<path d="M36,17.6 Q37.6,21.6 36.4,25.2 M39.4,17 Q41,21.4 40,26 M42.6,16.4 Q44.4,21.4 43.6,27.4" stroke="${dark}" stroke-width="0.7" fill="none" opacity="0.75"/><ellipse cx="29" cy="17.4" rx="3.2" ry="2" fill="#b89a86" opacity="0.55"/><ellipse cx="18" cy="23.4" rx="2" ry="1.4" fill="#a88a76" opacity="0.5"/><path d="M27.4,16.6 Q29,16 30.6,17.2" stroke="#7a3a2a" stroke-width="0.5" fill="none" opacity="0.8"/>`);
    p.push(`<path d="M15,${13.6 - B} Q30,${11 - B} 46,${10 - B}" stroke="${light}" stroke-width="1.1" opacity="0.55" fill="none"/><path d="M22,${27.6 + B / 2} Q33,${24 + B} 45,${29.6 + B}" stroke="${dark}" stroke-width="1.6" opacity="0.45" fill="none"/>`);
    p.push(`<path d="M18,${15 - B} l1.4,-2 M27.6,${13.6 - B} l1.2,-2 M37.6,${12.6 - B} l1,-2 M41.6,${12 - B} l1,-2.2 M50,${11.4 - B} l1.4,-2.2 M53,13 l1.6,-1.8" stroke="${dark}" stroke-width="0.7"/>`);
    if (hound) p.push(`<path d="M44,${11 - B} Q48.6,21 45.4,${30 + B}" stroke="${INK}" stroke-width="4.6" fill="none"/><path d="M44,${11 - B} Q48.6,21 45.4,${30 + B}" stroke="${color}" stroke-width="3.2" fill="none"/><path d="M24,${12.6 - B} Q21.6,21 24.6,${27.6 + B / 2}" stroke="${INK}" stroke-width="3.8" fill="none"/><path d="M24,${12.6 - B} Q21.6,21 24.6,${27.6 + B / 2}" stroke="${color}" stroke-width="2.4" fill="none"/><path d="M24,18.4 L46.4,18.4" stroke="#2e241a" stroke-width="2.2"/><rect x="32" y="${12.6 - B}" width="7" height="4" rx="0.8" fill="#3a2e22" ${o}/><circle cx="46.6" cy="18.4" r="1" fill="#b08a3e" stroke="${INK}" stroke-width="0.4"/>`);
    p.push(`</g>`);
    // neck with a ragged ruff
    p.push(`<path d="M47,${11 - B} L49,${6.6 - B} L50.6,${9 - B} L52.4,${4.8 - B} L54,${7.6 - B} L56.4,4.4 L57,7.4 Q61,9 62,13 Q58.4,17 56.4,25 Q52,22 49.4,17 Z" fill="url(#fur)" ${o}/>`);
    p.push(`<path d="M55,19.6 l-1.6,1.6 M57,21 l-1.2,2 M53.4,17.6 l-1.8,1" stroke="${dark}" stroke-width="0.7"/>`);
    if (hound) p.push(`<path d="M52,${8 - B} Q55.6,16 61,14.6" stroke="${INK}" stroke-width="3.4" fill="none"/><path d="M52,${8 - B} Q55.6,16 61,14.6" stroke="#3a2e22" stroke-width="2.2" fill="none"/><path d="M53.4,9.6 l-1.8,-1.4 M55,13 l-2,0.2 M57.6,15 l-1.2,1.6 M60,15 l0,2" stroke="#c9c2b0" stroke-width="0.9"/>`);
    // head: broad skull, stop, long muzzle, snarling open jaw
    p.push(`<path d="M68.6,13.6 L72.4,13.6 Q70.4,16.8 66,16.8 Q62,16.6 61,14.6 Z" fill="#3a1410" ${o}/>`);
    p.push(`<path d="M61.4,14.8 Q64.6,17.6 68.6,16.2 L70.4,14.8 Q66,15.6 62.6,13.6 Z" fill="${shade(fur, 0.82)}" ${o}/>`);
    p.push(`<g filter="url(#g)"><path d="M55.4,9.6 Q55.6,3.4 61.6,2.6 Q65.4,2.4 67,5.4 Q68.4,7.2 71.4,8.2 L74.4,9.2 Q75.8,10.4 75,11.8 Q74,13 72.4,13 Q68,13.4 64.4,14 Q60.4,14.6 57.6,12.8 Q55.4,11.6 55.4,9.6 Z" fill="url(#fur)" ${o}/></g>`);
    p.push(`<path d="M67,6 Q70,7.2 72,8.4 M67.6,8.4 Q69.4,8.6 70.6,9.6 M68,10.4 Q69.4,10.2 70.4,11" stroke="${dark}" stroke-width="0.6" fill="none"/>`);
    p.push(`<path d="M73,9.4 Q75.6,9.4 75.4,11 Q74.4,11.8 73,11.2 Z" fill="#1a1412"/><circle cx="73.8" cy="9.9" r="0.35" fill="#8a8078"/>`);
    p.push(`<path d="M66,13.6 l0.5,1.8 M67.6,13.4 l0.3,1.6 M69.2,13.2 l0.2,1.4 M71,13.1 l0.1,1.1 M66.6,16.4 l0.4,-1.4 M68.4,16 l0.2,-1.2" stroke="#e8dfc6" stroke-width="0.6"/>`);
    p.push(`<path d="M63.4,4.6 Q65,5.6 66,7" stroke="${INK}" stroke-width="0.7" fill="none"/><path d="M63,6.4 Q64.6,5.6 66,6.6 Q64.6,7.6 63,6.4 Z" fill="#2a0a00"/><circle cx="64.6" cy="6.5" r="0.75" fill="${hound ? '#ff6a2a' : '#d8a040'}"/><circle cx="64.8" cy="6.4" r="0.3" fill="#1a0a00"/>`);
    // ears pinned back
    p.push(`<path d="M57.4,4.6 L53.2,-0.2 Q56.6,0 60.6,3 Z" fill="${dark}" ${o}/><path d="M59.4,3.6 L57.4,0.2 Q60.6,0.6 62.4,3 Z" fill="${shade(fur, 0.75)}" ${o}/><path d="M56.4,3.2 L55,1.4" stroke="#8a5a4a" stroke-width="0.6"/>`);
    // near legs
    p.push(limb([[50.6, 22], [50.4 - k * 1.6, 31.4], [51 - k * 2.8, 39.6], [53 - k * 2.6, 43]], [5, 3.2, 2.6], nearF));
    p.push(limb([[17.6, 21], [22 + k * 1.6, 30], [16 + k * 2.4, 36.2], [17.6 + k * 2.6, 43]], [6.6, 3.6, 2.6], nearF));
    p.push(`<path d="M${51 - k * 2.6},43.6 l3.6,0 M${16.4 + k * 2.6},43.6 l3.4,0 M${48.8 + k * 2.6},43.6 l2.8,0 M${18.4 - k * 2.4},43.6 l2.8,0" stroke="${INK}" stroke-width="1.6" stroke-linecap="round"/>`);
    p.push(`<path d="M51,24 Q49.6,30 50,34" stroke="${light}" stroke-width="0.8" opacity="0.5" fill="none"/><path d="M19,22 Q22,26 22.6,29.6" stroke="${light}" stroke-width="0.8" opacity="0.45" fill="none"/>`);
    return svg(76, 46, p.join(''), defs);
  }
  function dog(ctx, { hound = false, color = '#a8432f', frame = 0, length = 34, facing = -1 } = {}) {
    const img = request(`dog|${hound}|${color}|${frame}`, () => softInk(dogSVG({ hound, color, frame })), 76, 46, { pw: 50, ph: 30, k: 14, soft: true });
    if (!img) return false;
    const w = length, h = w * 46 / 76;
    ctx.save(); if (facing === -1) ctx.scale(-1, 1);
    blit(ctx, img, -w * 0.5, -h * 44 / 46, w, h);
    ctx.restore();
    return true;
  }

  // The thing in the intake: a low, eyeless, wet crawler with long jointed limbs. 60 x 56, ground at y 52.
  function intakeSVG() {
    const skin = '#8f9282';
    const defs = `<linearGradient id="b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c4c6b4"/><stop offset="0.45" stop-color="${skin}"/><stop offset="1" stop-color="#3e3e36"/></linearGradient>`
      + `<radialGradient id="maw" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#120404"/><stop offset="0.7" stop-color="#4a1410"/><stop offset="1" stop-color="#8a3a30"/></radialGradient>` + grit('g', 11, 0.6, 1.2);
    const far = '#5e6056', near = '#a2a492';
    const p = [`<ellipse cx="30" cy="52" rx="24" ry="2.2" fill="#000" opacity="0.3"/>`];
    p.push(limb([[40, 36], [46, 25], [51, 38], [54, 51.4]], [3, 2, 1.3], far));
    p.push(limb([[20, 38], [13, 29], [8, 40], [6, 51.4]], [3.6, 2.4, 1.4], far));
    p.push(limb([[30, 40], [33, 32], [36, 51.4]], [2.6, 1.6], far));
    // body: long, low, hunched, ridged spine
    p.push(`<g filter="url(#g)"><path d="M7,41 Q6,33 13,29 Q22,24 33,25.6 Q43,27 47,33 Q49,38 45,41.6 Q37,45 27,44.2 Q16,45.4 10,44 Q7,43 7,41 Z" fill="url(#b)" ${o}/></g>`);
    for (let i = 0; i < 7; i++) { const t = (i + 0.5) / 7, x = 11 + t * 32, y = 28.6 - Math.sin(t * Math.PI) * 2.6 + (t < 0.2 ? 1 : 0); p.push(`<path d="M${(x - 1.3).toFixed(1)},${(y + 0.8).toFixed(1)} Q${x.toFixed(1)},${(y - 2).toFixed(1)} ${(x + 1.3).toFixed(1)},${(y + 0.8).toFixed(1)}" fill="#cfd0bc" stroke="${INK}" stroke-width="0.6"/>`); }
    p.push(`<path d="M18,31 Q19.6,37 18,43 M23,30 Q25,37 23.4,43.6 M28,29.6 Q30,37 28.6,43.8 M33,30 Q35,37 33.6,43.4 M38,31 Q39.6,37 38.6,42.6" stroke="#4e5046" stroke-width="0.7" fill="none" opacity="0.75"/>`);
    p.push(`<path d="M12,31 Q24,25.6 38,27.6" stroke="#f2f4e2" stroke-width="1.1" opacity="0.55" fill="none"/><ellipse cx="21" cy="30" rx="2.6" ry="0.9" fill="#fff" opacity="0.45"/><ellipse cx="40" cy="31" rx="1.6" ry="0.6" fill="#fff" opacity="0.45"/><ellipse cx="30" cy="36" rx="3" ry="1.4" fill="#6a4a40" opacity="0.5"/>`);
    // head: eyeless wedge thrust forward, opening into a round maw ringed with needles
    p.push(`<path d="M43,32 Q49,28.4 54.6,31.4 Q59.4,34.4 58.8,38.4 Q57.8,42.4 52.6,42.8 Q46.6,43.2 43.6,40 Q41.4,36 43,32 Z" fill="url(#b)" ${o}/>`);
    p.push(`<ellipse cx="55.2" cy="37.6" rx="3" ry="3.6" fill="url(#maw)" stroke="${INK}" stroke-width="0.8"/>`);
    for (let i = 0; i < 11; i++) { const a = i / 11 * Math.PI * 2, x = 55.2 + Math.cos(a) * 2.7, y = 37.6 + Math.sin(a) * 3.3, x2 = 55.2 + Math.cos(a) * 1.3, y2 = 37.6 + Math.sin(a) * 1.7; p.push(`<path d="M${x.toFixed(2)},${y.toFixed(2)} L${x2.toFixed(2)},${y2.toFixed(2)}" stroke="#ece2cc" stroke-width="0.55"/>`); }
    p.push(`<path d="M45,33 Q49.6,30.2 54,31.8" stroke="#f2f4e2" stroke-width="0.9" opacity="0.6" fill="none"/><path d="M47,34.6 Q48.4,36.4 47.6,38.4 M49.6,33.6 Q51,35 50.6,36.6" stroke="#4e5046" stroke-width="0.6" fill="none"/>`);
    p.push(`<path d="M55,41.4 Q55.6,45 54.6,48.4 M57,40.6 Q58.2,43 57.8,45" stroke="#5a2a24" stroke-width="0.9" fill="none" stroke-linecap="round"/><circle cx="54.6" cy="48.8" r="0.8" fill="#5a2a24"/>`);
    // near limbs
    const claw = (x, y) => `<path d="M${x},${y} l3,0.4 M${x},${y} l1.2,1.2 M${x},${y} l-2.2,0.6" stroke="${INK}" stroke-width="1" stroke-linecap="round"/>`;
    p.push(limb([[42, 36], [48, 23], [53.6, 36], [57, 51.4]], [3.8, 2.6, 1.7], near)); p.push(claw(57, 51.4));
    p.push(`<path d="M48,23 l-0.6,-2.6" stroke="${INK}" stroke-width="1.5" stroke-linecap="round"/>`);
    p.push(limb([[16, 39], [9, 31], [4, 42], [3, 51.4]], [4.6, 2.8, 1.6], near)); p.push(claw(3, 51.4));
    p.push(limb([[27, 41], [24, 34], [21, 51.4]], [3.4, 2], near)); p.push(claw(21, 51.4));
    p.push(`<path d="M25,44.4 Q25.6,47.6 25,49.6 M35,43.6 Q35.4,46 35,47.4" stroke="#3e3e36" stroke-width="1" fill="none" stroke-linecap="round" opacity="0.8"/>`);
    return svg(60, 56, p.join(''), defs);
  }
  // Sentry machine: tracked base, armoured hull, sensor head with a red lens, rusted plates. 48 x 60.
  function machineSVG() {
    const defs = grad('m', '#9aa29e', '#40474a', 0.3, 1) + grad('md', '#6e7674', '#2a2f31', 0.3, 1) + grit('g', 5, 0.45, 1.5)
      + `<radialGradient id="lens" cx="0.4" cy="0.4" r="0.6"><stop offset="0" stop-color="#ffe6c0"/><stop offset="0.35" stop-color="#ff4a2a"/><stop offset="1" stop-color="#3a0600"/></radialGradient>`
      + `<pattern id="haz" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="2" height="4" fill="#d8a020"/><rect x="2" width="2" height="4" fill="#1e1e1c"/></pattern>`;
    const p = [];
    // tracks
    p.push(`<rect x="4" y="45" width="38" height="12" rx="6" fill="#1e2224" ${o}/>`);
    for (let i = 0; i < 13; i++) p.push(`<path d="M${6.4 + i * 2.8},45.4 l0,1.6 M${6.4 + i * 2.8},55 l0,1.6" stroke="#4a5052" stroke-width="1.1"/>`);
    for (let i = 0; i < 4; i++) p.push(`<circle cx="${11 + i * 8}" cy="51" r="3.4" fill="url(#md)" ${o}/><circle cx="${11 + i * 8}" cy="51" r="1.2" fill="#8a9290" stroke="${INK}" stroke-width="0.5"/>`);
    // hull
    p.push(`<g filter="url(#g)"><path d="M8,46 L10.4,25 Q11.4,19.6 17,19.4 L31,19.4 Q36.6,19.6 37.6,25 L40,46 Z" fill="url(#m)" ${o}/></g>`);
    p.push(`<path d="M9.4,40 L38.8,40 L39.6,46 L8.6,46 Z" fill="url(#haz)" stroke="${INK}" stroke-width="0.8"/>`);
    p.push(`<path d="M11.6,30 L36.6,30 M11,36 L37.4,36 M24,19.6 L24,40" stroke="${INK}" stroke-width="0.6" opacity="0.55"/><path d="M12,21.4 Q17,20.6 23,20.8" stroke="#e0e6e2" stroke-width="0.9" opacity="0.6" fill="none"/>`);
    for (let i = 0; i < 4; i++) p.push(`<rect x="27" y="${31.4 + i * 1.1}" width="8" height="0.6" fill="#1e2224"/>`);
    p.push(`<path d="M13.6,32 Q16,31 19.6,32.6 Q21,35 18,35.4 Q14.6,35.6 13.6,32 Z" fill="#8a4a20" opacity="0.65"/><path d="M15,35.4 Q15.4,38 14.8,39.6 M18.4,35.4 L18.6,38" stroke="#7a3a14" stroke-width="0.6" opacity="0.7"/><ellipse cx="32" cy="25.4" rx="3" ry="1.4" fill="#8a4a20" opacity="0.5"/>`);
    for (const [x, y] of [[13, 22.6], [35, 22.6], [12, 38.4], [36.2, 38.4], [21.6, 22.4], [26.4, 22.4]]) p.push(`<circle cx="${x}" cy="${y}" r="0.85" fill="#2b2f31" stroke="#b0b6b2" stroke-width="0.25"/>`);
    p.push(`<path d="M15,25.6 l2.4,0 l0,1.4 l-2.4,0 l0,1.4 l2.4,0 M19,26.6 l1.6,0 M21.6,25.6 l2,0 l-1.4,3" stroke="#e8e0c0" stroke-width="0.5" fill="none" opacity="0.7"/>`);
    // gun arm
    p.push(`<path d="M36,26 L42,26 L42,31 L36.6,31 Z" fill="url(#md)" ${o}/><rect x="41.4" y="27" width="6" height="2.8" fill="#2a2e30" ${o}/><rect x="46.4" y="26.6" width="1.6" height="3.6" fill="#1a1c1d" ${o}/><path d="M38,31 Q36,36 33,37.6" stroke="#1a1c1d" stroke-width="1.2" fill="none"/>`);
    // sensor head
    p.push(`<path d="M17,19.4 L18,16.6 L30,16.6 L31,19.4 Z" fill="#2b2f31" ${o}/>`);
    p.push(`<path d="M14.6,8.4 Q15,5.6 18,5.6 L31,5.6 Q34,5.6 34,8.6 L33,16.6 L15.6,16.6 Z" fill="url(#m)" ${o}/><path d="M14.2,8.2 Q24,4.4 34.4,8.4 L34.4,9.6 Q24,6 14.2,9.6 Z" fill="#30363a" ${o}/>`);
    p.push(`<rect x="17.6" y="10.6" width="15" height="4.4" rx="2" fill="#141617" ${o}/><circle cx="28" cy="12.8" r="3" fill="url(#lens)" stroke="${INK}" stroke-width="0.8"/><circle cx="28" cy="12.8" r="6" fill="#ff4a2a" opacity="0.14"/><circle cx="27.1" cy="11.9" r="0.7" fill="#fff" opacity="0.8"/><rect x="19" y="12" width="4" height="1.4" fill="#3a4044"/>`);
    p.push(`<path d="M18,5.6 L17,0.8 M17,0.8 L19.6,0.8" stroke="${INK}" stroke-width="0.9" fill="none"/><circle cx="17" cy="0.9" r="0.7" fill="#d84a2a"/>`);
    return svg(48, 60, p.join(''), defs);
  }
  function creature(ctx, kind, size = 40, facing = -1) {
    const img = kind === 'intake' ? request('intake', intakeSVG, 60, 56, { pw: 60, ph: 56, k: 12 }) : request('machine', machineSVG, 48, 60, { pw: 42, ph: 52, k: 14 });
    if (!img) return false;
    const w = kind === 'intake' ? size * 1.1 : size * 0.8, h = kind === 'intake' ? w * 56 / 60 : w * 60 / 48;
    ctx.save(); if (facing === -1) ctx.scale(-1, 1);
    blit(ctx, img, -w / 2, -h * (kind === 'intake' ? 52 / 56 : 0.96), w, h);
    ctx.restore();
    return true;
  }

  // ======================================================================
  // Portraits: hand-placed, front-facing pixel art on a 48 x 48 grid. Built pixel by pixel (not
  // cut from the side-on sprite) so both eyes match, the face is symmetric and shading stays clean.
  // ======================================================================
  const PG = 48;
  const mixc = (a, b, t) => { const A = hex(a), B = hex(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join(''); };
  const IRIS = ['#4a3020', '#3b6380', '#4c6a3a', '#6b4c2c', '#5a5a52'];
  const PCACHE = new Map();
  function portraitPixels(look0, role = 'recruit') {
    const L = fullLook(look0);
    const g = new Array(PG * PG).fill(null), tag = new Array(PG * PG).fill('');
    const inb = (x, y) => x >= 0 && y >= 0 && x < PG && y < PG;
    const set = (x, y, c, t = '') => { if (c && inb(x, y)) { g[y * PG + x] = c; if (t) tag[y * PG + x] = t; } };
    const get = (x, y) => (inb(x, y) ? g[y * PG + x] : null);
    const tg = (x, y) => (inb(x, y) ? tag[y * PG + x] : '');
    const sym = (x, y, c, t) => { set(x, y, c, t); set(PG - 1 - x, y, c, t); };
    const row = (y, x0, x1, c, t) => { for (let x = x0; x <= x1; x++) set(x, y, c, t); };
    const span = (y, hw, c, t) => row(y, 24 - hw, 23 + hw, c, t);
    const tint = (x, y, c, k) => { const v = get(x, y); if (v) g[y * PG + x] = mixc(v, c, k); };

    const skin = SKIN[L.skin % 6];
    const sk = { b: skin, lt: shade(skin, 1.1), hi: shade(skin, 1.18), sh: shade(skin, 0.86), dk: shade(skin, 0.72), ln: shade(skin, 0.5) };
    const hair = L.age === 2 ? ['#b8b4aa', '#9a968c', '#d0ccc2'][L.hair % 3] : HAIR[L.hair % 6];
    const hr = { b: hair, hl: shade(hair, 1.3), hd: shade(hair, 0.72), hk: shade(hair, 0.5) };
    const coat = role === 'sawbones' ? '#8a8577' : COAT[L.coat % 6];
    const shirt = SHIRT[(L.hair + L.skin) % SHIRT.length];
    const style = L.style % 10, facial = L.facial % 5, mark = L.mark % 5;
    const top = role === 'bulwark' ? 0 : L.top % 5;
    const build = L.build % 3;
    const iris = L.skin >= 2 && L.skin !== 5 ? ['#3a2618', '#4a3020', '#5a3a22', '#3a2618', '#4c5a3a'][(L.hair + L.coat) % 5] : IRIS[(L.skin + L.hair * 2 + L.coat) % IRIS.length];
    const lower = build === 2 ? [9, 9, 8, 7, 6, 5, 4] : build === 0 ? [8, 7, 6, 5, 4, 3, 2] : [8, 8, 7, 6, 5, 4, 3];
    const HHW = (y) => (y < 9 || y > 32 ? -1 : y <= 14 ? [3, 5, 6, 7, 8, 8][y - 9] : y <= 25 ? 9 : lower[y - 26]);

    // ---------- behind: long hair, hood ----------
    const longHair = style === 1 || style === 8;
    if (longHair) {
      const bottom = style === 8 ? 46 : 40;
      for (let y = 10; y <= bottom; y++) {
        const hw = y < 20 ? Math.max(HHW(y), 0) + 3 : Math.min(13, 12 + (y > 30 ? 1 : 0)) - (y > bottom - 2 ? bottom - y < 1 ? 3 : 1 : 0);
        span(y, hw, hr.hd, 'hair');
      }
    }
    if (top === 3) for (let y = 30; y <= 39; y++) span(y, Math.min(12, 8 + (y - 30)), shade(coat, 0.72), 'cloth');

    // ---------- torso ----------
    const cloth = top === 1 ? shirt : top === 4 ? shade(SHIRT[(L.hair + L.skin + 2) % SHIRT.length], 0.92) : coat;
    const thw = (y) => [8, 12, 15, 17, 18, 19, 19, 19, 19, 19, 19][y - 37] + (y >= 40 ? (build === 2 ? 1 : build === 0 ? -1 : 0) : 0);
    for (let y = 37; y < PG; y++) {
      const hw = thw(y), x0 = 24 - hw, x1 = 23 + hw;
      for (let x = x0; x <= x1; x++) {
        let c = cloth;
        if (x <= x0 + 1) c = shade(cloth, 1.16);
        else if (x >= x1 - 3) c = shade(cloth, x >= x1 - 1 ? 0.62 : 0.74);
        if (y === 37 + (x < 24 ? 0 : 0) && false) c = cloth;
        set(x, y, c, 'cloth');
      }
      // arm seams
      if (y >= 42) { set(x0 + 4, y, shade(cloth, 0.66)); set(x1 - 4, y, shade(cloth, 0.58)); }
      // top-of-shoulder light
      if (y === 38 || y === 39) { set(x0 + 2, y, shade(cloth, 1.24)); set(x0 + 3, y, shade(cloth, 1.12)); }
    }
    if (top === 0 || top === 3) {
      for (let y = 37; y < PG; y++) { const k = Math.min(5, ((y - 37) >> 1) + 1); row(y, 24 - k, 23 + k, y < 40 ? sk.sh : shirt, y < 40 ? 'skin' : 'cloth'); set(23 - k, y, shade(coat, 1.3)); set(24 + k, y, shade(coat, 0.55)); }
      for (let y = 43; y < PG; y += 3) set(25 + Math.min(5, ((y - 37) >> 1) + 1), y, shade(coat, 0.45));
    }
    if (top === 1) {
      for (let y = 37; y <= 39; y++) { const k = y - 36; row(y, 24 - k, 23 + k, sk.sh, 'skin'); }
      sym(19, 37, shade(shirt, 1.25)); sym(20, 37, shade(shirt, 1.25)); sym(20, 38, shade(shirt, 1.2)); sym(21, 39, shade(shirt, 1.12)); sym(21, 40, shade(shirt, 0.8));
      for (const y of [42, 45]) { set(23, y, shade(shirt, 0.5)); }
      for (let y = 40; y < PG; y++) set(24, y, shade(shirt, 0.82));
    }
    if (top === 2) {
      for (let y = 40; y < PG; y++) { set(23, y, shade(coat, 0.5)); set(24, y, shade(coat, 1.15)); }
      for (let y = 37; y <= 39; y++) { const k = y - 36; row(y, 24 - k, 23 + k, sk.sh, 'skin'); }
    }
    if (top === 4) {
      for (let x = 0; x < PG; x++) for (const y0 of [42, 46]) { const y = y0 + ((x >> 1) & 1); if (get(x, y)) set(x, y, y0 === 42 ? '#8a3a2a' : '#d8ccb0'); }
      for (let y = 37; y <= 38; y++) row(y, 21, 26, sk.sh, 'skin');
    }
    if (role === 'bulwark') {
      for (let y = 38; y <= 43; y++) {
        const w = [4, 6, 7, 7, 6, 5][y - 38], x0 = 24 - thw(y);
        for (let i = 0; i < w; i++) { set(x0 + i, y, y === 38 ? '#c4c8c6' : i < 2 ? '#a6aaa8' : '#878c8c', 'cloth'); set(PG - 1 - (x0 + i), y, y === 38 ? '#9aa09e' : '#6e7373', 'cloth'); }
      }
      sym(10, 40, '#3a3a36'); sym(12, 42, '#3a3a36');
    }
    if (role === 'sawbones') {
      row(37, 18, 29, '#e9e2d0', 'cloth'); row(38, 17, 19, '#d8d0bc'); row(38, 28, 30, '#c8c0aa');
      for (const [x, y] of [[19, 39], [18, 40], [18, 41], [19, 42], [20, 43], [21, 44]]) sym(x, y, '#5a5a56');
      row(44, 22, 25, '#5a5a56'); set(23, 45, '#c8ccc8'); set(24, 45, '#9aa0a0');
    }

    // ---------- neck ----------
    const nhw = build === 2 ? 5 : 4;
    for (let y = 29; y <= 38; y++) for (let x = 24 - nhw; x <= 23 + nhw; x++) set(x, y, y <= 34 ? sk.dk : x >= 23 + nhw - 1 ? sk.dk : sk.sh, 'skin');

    // ---------- head ----------
    for (let y = 9; y <= 32; y++) {
      const hw = HHW(y), x0 = 24 - hw, x1 = 23 + hw;
      for (let x = x0; x <= x1; x++) {
        let c = sk.b;
        if (x === x0) c = sk.sh;
        else if (x === x0 + 1 && y >= 13 && y <= 26) c = sk.lt;
        if (x >= x1 - 1) c = x === x1 ? sk.dk : sk.sh;
        set(x, y, c, 'skin');
      }
    }
    // forehead light, cheek light, jaw shade
    row(11, 19, 22, sk.lt); row(12, 18, 21, sk.lt);
    set(17, 23, sk.lt); set(17, 24, sk.lt); set(18, 24, sk.hi);
    for (let y = 24; y <= 31; y++) { const hw = HHW(y); set(23 + hw - 2, y, sk.sh); }
    for (let x = 21; x <= 26; x++) set(x, 32, sk.sh);
    // ears
    for (let y = 19; y <= 24; y++) { if (y > 19 && y < 24) { set(13, y, sk.sh, 'skin'); set(34, y, sk.dk, 'skin'); } set(14, y, y === 19 || y === 24 ? sk.sh : sk.dk, 'skin'); set(33, y, sk.dk, 'skin'); }
    set(13, 21, sk.b); set(13, 22, sk.b);

    // ---------- face ----------
    if (mark === 3) { for (let y = 19; y <= 21; y++) row(y, 15, 32, null); for (let y = 18; y <= 22; y++) for (let x = 15; x <= 32; x++) tint(x, y, '#6e2418', y === 18 || y === 22 ? 0.3 : 0.55); }
    // brows
    const brow = L.age === 2 ? shade(hair, 0.82) : hr.hk;
    sym(17, 18, brow); sym(18, 17, brow); sym(19, 17, brow); sym(20, 17, brow); sym(21, 17, build === 2 ? brow : shade(brow, 1.25));
    // eyes: lid, 4 x 2 eye, 2 x 2 iris with a dark top row
    for (let x = 18; x <= 21; x++) sym(x, 19, sk.ln);
    sym(17, 19, shade(sk.ln, 1.2));
    sym(18, 20, '#ece4d4'); sym(21, 20, '#ece4d4'); sym(18, 21, mixc('#ece4d4', skin, 0.45)); sym(21, 21, mixc('#ece4d4', skin, 0.45));
    sym(19, 20, shade(iris, 0.5)); sym(20, 20, shade(iris, 0.5)); sym(19, 21, iris); sym(20, 21, iris);
    set(19, 20, shade(iris, 0.8)); set(27, 20, shade(iris, 0.8)); // the same catchlight side on both eyes
    sym(19, 22, sk.sh); sym(20, 22, sk.sh);
    // nose: a short, soft shape
    set(24, 22, sk.sh); set(24, 23, sk.sh); set(23, 24, sk.lt); set(25, 24, sk.sh);
    set(22, 25, sk.dk); set(23, 25, sk.sh); set(24, 25, sk.sh); set(25, 25, sk.dk);
    // mouth
    const lip = mixc(sk.ln, '#5a1e16', 0.35);
    set(21, 28, sk.dk); row(28, 22, 25, lip); set(26, 28, sk.dk);
    row(29, 22, 25, mixc(skin, '#b8645a', 0.22)); set(23, 29, mixc(sk.lt, '#c87a6a', 0.2));
    if (L.age === 2) { sym(16, 20, sk.dk); sym(16, 21, sk.sh); sym(21, 26, sk.sh); sym(21, 27, sk.sh); row(14, 20, 27, sk.sh); }
    if (L.age === 0) { sym(17, 25, mixc(skin, '#e0806a', 0.3)); sym(18, 25, mixc(skin, '#e0806a', 0.3)); }

    // facial hair
    const fc = shade(hair, L.age === 2 ? 0.92 : 0.82), fd = shade(hair, 0.62);
    const mustache = () => { row(26, 21, 26, fc, 'hair'); set(20, 27, fd, 'hair'); set(27, 27, fd, 'hair'); row(27, 21, 26, fd, 'hair'); set(22, 26, shade(hair, 1.2)); };
    if (facial === 1) for (let y = 25; y <= 32; y++) { const hw = HHW(y); for (let x = 24 - hw; x <= 23 + hw; x++) if ((x + y) % 2 === 0 && !(y >= 28 && y <= 29 && x >= 21 && x <= 26) && !(y === 25 && x >= 21 && x <= 26)) tint(x, y, fd, 0.34); }
    if (facial === 2) mustache();
    if (facial === 4) { mustache(); for (let y = 30; y <= 33; y++) row(y, y === 33 ? 23 : 22, y === 33 ? 24 : 25, (y + 1) % 2 ? fc : fd, 'hair'); }
    if (facial === 3) {
      for (let y = 18; y <= 34; y++) {
        const hw = y <= 32 ? HHW(y) : y === 33 ? 5 : 3;
        for (let x = 24 - hw; x <= 23 + hw; x++) {
          const edge = x <= 24 - hw + 1 || x >= 22 + hw;
          if (y < 25 && !edge) continue;
          if (y >= 25 && y <= 27 && x >= 19 && x <= 28) continue;
          if ((y === 28 || y === 29) && x >= 21 && x <= 26) continue;
          let c = x >= 26 ? fd : fc;
          if ((x * 5 + y * 3) % 9 === 0) c = shade(hair, x < 24 ? 1.22 : 0.62);
          set(x, y, c, 'hair');
        }
      }
      mustache(); row(28, 22, 25, lip);
    }
    // marks on the face
    if (mark === 1) { const sc = mixc(skin, '#f4c4b4', 0.6); for (const [x, y] of [[29, 16], [29, 17], [29, 18], [30, 22], [30, 23], [31, 24]]) set(x, y, sc); set(30, 16, shade(sc, 0.8)); }

    // ---------- hair ----------
    const H = (x, y, c = hr.b) => set(x, y, c, 'hair');
    const cap = (y0, y1, extra = 1) => { for (let y = y0; y <= y1; y++) { const hw = (y < 9 ? [4, 6, 7, 8][Math.max(0, y - 5)] : HHW(y) + extra); for (let x = 24 - hw; x <= 23 + hw; x++) H(x, y); } };
    const sides = (y0, y1, w = 2) => { for (let y = y0; y <= y1; y++) for (let i = 0; i < w; i++) { H(15 + i - 1, y); H(32 - i + 1, y, hr.hd); } };
    if (style === 0) { cap(8, 14); for (let x = 16; x <= 31; x++) if (x % 3 !== 1) H(x, 15); H(16, 16); H(17, 16); H(31, 16); sides(15, 19); }
    if (style === 1) { cap(8, 14); row(15, 15, 22, hr.b, 'hair'); row(16, 15, 19, hr.b, 'hair'); H(28, 15); H(29, 15); H(30, 15); for (let y = 15; y <= 40; y++) { for (const x of [13, 14, 15]) H(x, y); for (const x of [32, 33, 34]) H(x, y, hr.hd); } }
    if (style === 2) { cap(9, 14, 0); sides(15, 17, 1); for (let y = 2; y <= 9; y++) { const hw = [2, 3, 4, 4, 4, 4, 3, 2][y - 2]; for (let x = 24 - hw; x <= 23 + hw; x++) H(x, y); } row(9, 21, 26, hr.hd, 'hair'); for (const x of [18, 22, 26, 30]) H(x, 11, hr.hd); }
    if (style === 3 || style === 9) {
      const cc = style === 3 ? shade(COAT[(L.coat + 2) % 6], 0.85) : ['#7a2a1e', '#3f5966', '#4a4a3a', '#6a5a3a'][L.coat % 4];
      sides(14, 19);
      const crown = style === 3 ? [[6, 5], [7, 7], [8, 8], [9, 9], [10, 9], [11, 10], [12, 10], [13, 10]] : [[4, 3], [5, 5], [6, 7], [7, 8], [8, 9], [9, 9], [10, 10], [11, 10], [12, 10]];
      for (const [y, hw] of crown) for (let x = 24 - hw; x <= 23 + hw; x++) set(x, y, x < 24 - hw + 3 ? shade(cc, 1.18) : x > 23 + hw - 3 ? shade(cc, 0.72) : cc, 'hat');
      if (style === 3) {
        for (let y = 6; y <= 13; y++) set(24, y, shade(cc, 0.6));
        span(14, 11, shade(cc, 0.62), 'hat'); span(15, 10, shade(cc, 0.46), 'hat'); row(14, 13, 16, shade(cc, 0.8));
        for (let x = 15; x <= 32; x++) tint(x, 16, '#000', 0.25);
      } else {
        for (let y = 13; y <= 15; y++) { span(y, 10, shade(cc, 0.78), 'hat'); for (let x = 14; x <= 33; x += 2) set(x, y, shade(cc, 0.6)); }
        for (let y = 1; y <= 4; y++) { const hw = [1, 2, 2, 1][y - 1]; for (let x = 24 - hw; x <= 23 + hw; x++) set(x, y, shade(cc, y < 3 ? 1.35 : 1.15), 'hat'); }
      }
    }
    if (style === 4) { for (let y = 9; y <= 15; y++) { const hw = HHW(y); for (let x = 24 - hw; x <= 23 + hw; x++) { const c = (x + y) % 2 ? hr.b : mixc(hair, skin, 0.4); set(x, y, y === 15 ? mixc(hair, skin, 0.5) : c, 'hair'); } } }
    if (style === 5) {
      const w = '#8a6a4a';
      for (let y = 7; y <= 15; y++) { const hw = y < 9 ? [6, 8][y - 7] : HHW(y) + 1; for (let x = 24 - hw; x <= 23 + hw; x++) set(x, y, x > 28 ? shade(w, 0.74) : x < 18 ? shade(w, 1.15) : w, 'hat'); }
      for (let x = 15; x <= 32; x++) { set(x, 10 + ((x - 15) >> 2) % 2, shade(w, 0.7)); set(x, 13 + ((x - 13) >> 3), shade(w, 0.72)); }
      for (const [x, y] of [[12, 10], [13, 10], [11, 11], [12, 11], [13, 11], [12, 12], [11, 13], [10, 14], [11, 14], [10, 15], [9, 16], [10, 16], [9, 17]]) set(x, y, shade(w, x < 11 ? 0.8 : 0.95), 'hat');
      sides(16, 18, 1);
    }
    if (style === 6) { for (const [x, y] of [[19, 11], [20, 11], [21, 10], [22, 10], [20, 12]]) set(x, y, sk.hi); for (let y = 16; y <= 19; y++) { H(15, y, mixc(hair, skin, 0.3)); H(32, y, mixc(hr.hd, skin, 0.3)); } }
    if (style === 7) {
      for (let y = 10; y <= 17; y++) for (const x of [15, 16, 31, 32]) if ((x + y) % 2 === 0) tint(x, y, hair, 0.5);
      for (let y = 8; y <= 12; y++) span(y, Math.min(HHW(Math.max(9, y)), 5), hr.b, 'hair');
      for (let y = 2; y <= 7; y++) { const hw = [2, 3, 3, 3, 2, 2][y - 2]; for (let x = 24 - hw; x <= 23 + hw; x++) H(x, y); }
      row(7, 22, 25, '#a8432f', 'hat');
    }
    if (style === 8) { cap(8, 13); for (let y = 8; y <= 12; y++) { set(23, y, hr.hk); } for (let y = 14; y <= 18; y++) { row(y, 15, 19 - Math.max(0, y - 15), hr.b, 'hair'); row(y, 28 + Math.max(0, y - 15), 32, hr.hd, 'hair'); } for (let y = 14; y <= 45; y++) { for (const x of [12, 13, 14, 15]) H(x, y); for (const x of [32, 33, 34, 35]) H(x, y, hr.hd); } }
    // hair shading: a lit top edge on the left, a shadow side, a few strands
    for (let y = 0; y < PG; y++) for (let x = 0; x < PG; x++) {
      if (tg(x, y) !== 'hair' || g[y * PG + x] !== hr.b) continue;
      if (x >= 28) g[y * PG + x] = hr.hd;
      else if (tg(x, y - 1) !== 'hair' && x < 26) g[y * PG + x] = hr.hl;
      else if ((x * 7 + y * 3) % 11 === 0) g[y * PG + x] = hr.hd;
    }
    // hair and hats cast a soft shadow on the skin just below them
    for (let y = 1; y < PG; y++) for (let x = 0; x < PG; x++) if (tg(x, y) === 'skin' && (tg(x, y - 1) === 'hair' || tg(x, y - 1) === 'hat') && y < 30) tint(x, y, '#2a1a10', 0.28);

    // ---------- gear over the head ----------
    if (mark === 4) { span(13, 10, '#e2d8c2', 'hat'); span(14, 10, '#c8bca2', 'hat'); set(19, 13, '#a8432f'); set(19, 14, '#8a3424'); for (const [x, y] of [[12, 14], [11, 15], [12, 15], [11, 16], [10, 17]]) set(x, y, '#d0c4aa', 'hat'); }
    if (mark === 2) {
      for (let x = 14; x <= 26; x++) set(x, Math.round(19 - (26 - x) * 0.45), '#3a2418', 'hat');
      for (let x = 30; x <= 33; x++) set(x, 19, '#3a2418', 'hat');
      for (let y = 19; y <= 22; y++) row(y, y === 22 ? 27 : 26, y === 22 ? 28 : 29, '#2a1a12', 'hat');
      row(19, 26, 29, '#5a3a28'); set(26, 20, '#4a3020');
    }
    const goggles = (role === 'tinker' || L.acc === 2) && style !== 3 && style !== 9;
    if (goggles) {
      span(12, 10, '#5a4232', 'hat'); span(13, 10, '#4a3426', 'hat');
      for (const x0 of [17, 26]) { for (let y = 10; y <= 14; y++) row(y, x0, x0 + 4, '#2e241c', 'hat'); row(11, x0 + 1, x0 + 3, '#e0a850'); row(12, x0 + 1, x0 + 3, '#c8883a'); row(13, x0 + 1, x0 + 3, '#a86a2a'); set(x0 + 1, 11, '#f6dc9a'); }
    }
    if (L.acc === 3) { set(13, 25, '#e2bc56', 'hat'); set(13, 26, '#a8822e', 'hat'); }

    // ---------- neckwear ----------
    const scarf = role === 'drifter' ? '#a8432f' : role === 'longshot' ? '#6a6a52' : L.acc === 1 ? ['#a8432f', '#3f5966', '#6a6a52', '#8a6a3a'][L.coat % 4] : null;
    if (scarf) {
      for (let y = 33; y <= 37; y++) { const hw = y === 33 ? 5 : 6 + (y > 35 ? 1 : 0); for (let x = 24 - hw; x <= 23 + hw; x++) set(x, y, x >= 23 + hw - 2 ? shade(scarf, 0.68) : x <= 24 - hw + 1 ? shade(scarf, 1.18) : scarf, 'cloth'); }
      row(35, 19, 28, shade(scarf, 0.8));
      for (let y = 38; y <= 42; y++) { const hw = Math.max(0, 3 - (y - 38)); row(y, 23 - hw, 24 + hw - 1, y === 38 ? scarf : shade(scarf, 0.84), 'cloth'); }
    }
    if (L.acc === 4 && !scarf) { for (const [x, y] of [[20, 37], [21, 38], [21, 39], [22, 40]]) sym(x, y, '#9a9a90'); row(41, 23, 24, '#9a9a90'); row(42, 23, 24, '#d0d4ce'); row(43, 23, 24, '#a8aca6'); }

    // ---------- outline: soft dark edge around the silhouette ----------
    const out = g.slice();
    for (let y = 0; y < PG; y++) for (let x = 0; x < PG; x++) {
      if (g[y * PG + x]) continue;
      const n = [get(x - 1, y), get(x + 1, y), get(x, y - 1), get(x, y + 1)].some(Boolean);
      if (n) out[y * PG + x] = '#1c130d';
    }
    return out;
  }
  function portrait(look, role = 'recruit', scale = 4) {
    const fl = fullLook(look);
    const key = `${JSON.stringify(fl)}|${role}|${scale}`;
    if (PCACHE.has(key)) return PCACHE.get(key);
    if (typeof document === 'undefined') return null;
    const px = portraitPixels(look, role);
    const VW = 40, OX = 4, OY = 2; // frame the head and shoulders a little tighter than the grid
    const c = document.createElement('canvas'); c.width = VW * scale; c.height = VW * scale;
    const x = c.getContext('2d');
    // backdrop: a warm lamp glow in hard pixel bands, dithered where they meet
    const BG = ['#5a3f28', '#47331f', '#382818', '#2a1e14'];
    for (let yy = 0; yy < PG; yy++) for (let xx = 0; xx < PG; xx++) {
      const d = Math.hypot(xx - 19, yy - 16) / 9 + ((xx + yy) % 2) * 0.45;
      x.fillStyle = BG[Math.min(3, Math.floor(d))]; x.fillRect((xx - OX) * scale, (yy - OY) * scale, scale, scale);
    }
    for (let yy = 0; yy < PG; yy++) for (let xx = 0; xx < PG; xx++) { const v = px[yy * PG + xx]; if (v) { x.fillStyle = v; x.fillRect((xx - OX) * scale, (yy - OY) * scale, scale, scale); } }
    PCACHE.set(key, c);
    return c;
  }
  return { request, person, dog, creature, svg, grad, shade, INK, o, get version() { return version; }, personSVG, dogSVG, pixelize, quantize, blit, PX, muzzle, fullLook, bust, portrait, portraitPixels };
})();
