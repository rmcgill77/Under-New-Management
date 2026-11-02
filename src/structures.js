// ============================================================================
// Structures: isometric battle props as hand-built SVG, rasterised once per
// kind and variant through Art.request. Tile sprite box is 100 x 125 with the
// hex centre on the ground at (50, 75); a hex is 64 wide and 48 tall.
// Light comes from the upper left: left faces lit, right faces in shade.
// ============================================================================
const Structures = (() => {
  const { request, svg, shade, INK } = Art;
  const W = 100, H = 125, CX = 50, CY = 75, A = 32;
  const SK = 26.565; // atan(0.5) in degrees: the face slope of square boxes
  const SKH = 20.556; // atan(12 / 32): the face slope of hex prisms
  const rng = (seed) => { let s = seed * 9301 + 49297; return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; }; };
  const P = (pts) => pts.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
  const oo = `stroke="${INK}" stroke-width="1" stroke-linejoin="round"`;
  // Points on box faces. u runs 0..1 along the face from its outer corner to the front corner (left)
  // or from the front corner to the outer corner (right); v is height above the ground.
  // Walls are hex prisms (pointy top, half-width 32, squashed radius 24) so they tile the hex map;
  // crates and the like stay square boxes. HEX switches the face helpers while a wall is drawn.
  const HR = 24;
  let HEX = false;
  const onL = (u, v, a = A, cx = CX, cy = CY) => (HEX ? [cx - a + u * a, cy + HR / 2 + u * HR / 2 - v] : [cx - a + u * a, cy + u * a / 2 - v]);
  const onR = (u, v, a = A, cx = CX, cy = CY) => (HEX ? [cx + u * a, cy + HR - u * HR / 2 - v] : [cx + u * a, cy + a / 2 - u * a / 2 - v]);

  // Shared texture defs. Patterns are authored flat and skewed onto each face.
  function defs(seed, sk = SK) {
    return `<pattern id="brickL" width="10" height="5" patternUnits="userSpaceOnUse" patternTransform="skewY(${sk})"><rect width="10" height="5" fill="#8a5a40"/><rect x="0.4" y="0.4" width="9.2" height="4" fill="#9a6448"/><path d="M0,4.7 L10,4.7 M5,0 L5,0" stroke="#5a4636" stroke-width="0.8"/></pattern>`
      + `<pattern id="brickR" width="10" height="5" patternUnits="userSpaceOnUse" patternTransform="skewY(-${sk})"><rect width="10" height="5" fill="#5e3a2a"/><rect x="0.4" y="0.4" width="9.2" height="4" fill="#6c4232"/><path d="M0,4.7 L10,4.7" stroke="#3a2c22" stroke-width="0.8"/></pattern>`
      + `<pattern id="brickL2" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="skewY(${sk})"><path d="M0,0 L0,5 M5,5 L5,10" stroke="#5a4636" stroke-width="0.8"/></pattern>`
      + `<pattern id="brickR2" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="skewY(-${sk})"><path d="M0,0 L0,5 M5,5 L5,10" stroke="#3a2c22" stroke-width="0.8"/></pattern>`
      + `<pattern id="plankL" width="4.6" height="40" patternUnits="userSpaceOnUse" patternTransform="skewY(${sk})"><rect width="4.6" height="40" fill="#8e6842"/><path d="M4.3,0 L4.3,40" stroke="#4a3220" stroke-width="0.7"/><path d="M1.6,6 Q2,9 1.4,13 M2.6,22 Q3,26 2.4,30" stroke="#6a4a2e" stroke-width="0.4" fill="none"/></pattern>`
      + `<pattern id="plankR" width="4.6" height="40" patternUnits="userSpaceOnUse" patternTransform="skewY(-${sk})"><rect width="4.6" height="40" fill="#5e432a"/><path d="M4.3,0 L4.3,40" stroke="#2e2014" stroke-width="0.7"/><path d="M1.6,8 Q2,11 1.4,15" stroke="#4a3220" stroke-width="0.4" fill="none"/></pattern>`
      + `<filter id="grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" seed="${seed}" result="n"/><feColorMatrix in="n" type="matrix" values="0 0 0 0 0.1  0 0 0 0 0.08  0 0 0 0 0.06  0 0 0 0.55 0" result="c"/><feComposite in="c" in2="SourceGraphic" operator="in" result="m"/><feBlend in="m" in2="SourceGraphic" mode="multiply"/></filter>`
      + `<pattern id="brickTop" width="9" height="6" patternUnits="userSpaceOnUse" patternTransform="skewX(-30) scale(1 0.6)"><rect width="9" height="6" fill="#6a4636"/><rect x="0.6" y="0.6" width="7.6" height="4.6" fill="#7e5240"/><rect x="1.4" y="1.2" width="2" height="1.4" fill="#9a6a52" opacity="0.6"/></pattern>`
      + `<pattern id="concTop" width="7" height="7" patternUnits="userSpaceOnUse"><rect width="7" height="7" fill="#6e6a62"/><circle cx="2" cy="2" r="1" fill="#55524b"/><circle cx="5" cy="5" r="0.8" fill="#8a867c"/><path d="M0,6 L3,4" stroke="#4a4842" stroke-width="0.5"/></pattern>`
      + `<linearGradient id="aoL" x1="0" y1="0" x2="0" y2="1"><stop offset="0.6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.35"/></linearGradient>`
      + `<linearGradient id="stain" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a2018" stop-opacity="0.45"/><stop offset="1" stop-color="#2a2018" stop-opacity="0"/></linearGradient>`;
  }
  // A jagged broken top edge for a face: n points from u=0..1 at height h minus random drops.
  function jag(r, h, n, deep) {
    const out = [];
    for (let i = 0; i <= n; i++) {
      let d = r() * 3;
      if (deep && i > 1 && i < n - 1 && r() < 0.3) d += 5 + r() * deep;
      out.push([i / n, h - d]);
    }
    out[0][1] = h - r() * 2; out[n][1] = h - r() * 2;
    return out;
  }
  // A box with optional broken top. Returns {left, right, top} polygon point lists.
  function shape(r, h, broken, a = A, cx = CX, cy = CY) {
    const lt = broken ? jag(r, h, 6, broken) : [[0, h], [1, h]];
    const rt = broken ? jag(r, h, 6, broken) : [[0, h], [1, h]];
    rt[0][1] = lt[lt.length - 1][1];
    const left = [onL(0, 0, a, cx, cy), onL(1, 0, a, cx, cy), ...lt.slice().reverse().map(([u, v]) => onL(u, v, a, cx, cy))];
    const right = [onR(0, 0, a, cx, cy), onR(1, 0, a, cx, cy), ...rt.slice().reverse().map(([u, v]) => onR(u, v, a, cx, cy))];
    const dr = () => (broken ? r() * 4 : 0);
    const back = HEX ? [[cx + a, cy - HR / 2 - h + dr()], [cx, cy - HR - h + dr()], [cx - a, cy - HR / 2 - h + dr()]] : [[cx, cy - a / 2 - h + dr()]];
    const top = [...lt.map(([u, v]) => onL(u, v, a, cx, cy)), ...rt.slice(1).map(([u, v]) => onR(u, v, a, cx, cy)), ...back];
    return { left, right, top, lt, rt };
  }

  // ---------- full cover ----------
  function brickWall(v) { HEX = true; try { return brickWallHex(v); } finally { HEX = false; } }
  function brickWallHex(v) {
    const r = rng(v * 17 + 3), h = 44, s = shape(r, h, 8);
    const p = [];
    p.push(`<g filter="url(#grain)"><polygon points="${P(s.left)}" fill="url(#brickL)"/><polygon points="${P(s.left)}" fill="url(#brickL2)"/><polygon points="${P(s.right)}" fill="url(#brickR)"/><polygon points="${P(s.right)}" fill="url(#brickR2)"/></g>`);
    // plaster remnants on the lit face, soot and damp low down
    const pu = 0.08 + r() * 0.4, pv = 8 + r() * 14;
    const pl = [onL(pu, pv), onL(pu + 0.12, pv - 2), onL(pu + 0.3, pv + 1), onL(pu + 0.36, pv + 9), onL(pu + 0.22, pv + 15), onL(pu + 0.05, pv + 12)];
    p.push(`<polygon points="${P(pl)}" fill="#a89878" opacity="0.7"/><polyline points="${P(pl)}" fill="none" stroke="#5a4636" stroke-width="0.5"/><polygon points="${P(s.left)}" fill="url(#aoL)"/><polygon points="${P(s.right)}" fill="url(#aoL)"/>`);
    if (v === 1) { // blown-out window on the shaded face
      const w = [onR(0.3, 18), onR(0.72, 18), onR(0.72, 33), onR(0.3, 33)];
      p.push(`<polygon points="${P(w)}" fill="#1a1410" ${oo}/><polygon points="${P([onR(0.3, 18), onR(0.72, 18), onR(0.72, 16), onR(0.3, 16)])}" fill="#8a8274" stroke="${INK}" stroke-width="0.6" stroke-linejoin="round"/><path d="M${P([onR(0.36, 18)])} L${P([onR(0.42, 26)])} L${P([onR(0.5, 20)])}" stroke="#c9d6d8" stroke-width="0.6" fill="none" opacity="0.6"/>`);
    }
    if (v === 2) p.push(`<path d="M${P([onL(0.62, 30)])} l2,4 l-1.4,3 l2.2,4 l-1,5" stroke="${INK}" stroke-width="0.8" fill="none"/><polygon points="${P([onL(0.66, 33), onL(0.8, 31), onL(0.78, 25), onL(0.68, 26)])}" fill="#4a2e22"/>`);
    p.push(`<polygon points="${P(s.top)}" fill="#5e4234" ${oo}/><polygon points="${P(s.top)}" fill="url(#brickTop)" opacity="0.4"/><polyline points="${P(s.lt.map(([u, v]) => onL(u, v - 1.2)))}" fill="none" stroke="#b07a58" stroke-width="0.8" opacity="0.7"/>`);
    // loose bricks and broken mortar across the broken top
    for (let i = 0; i < 7; i++) { const u = r() * 0.8 + 0.1, w2 = r() * 0.8 + 0.1, x = CX - A * 0.8 * (1 - u) + A * 0.8 * w2 * 0 + (u - w2) * A * 0.7, y = CY - h - 2 + (u + w2 - 1) * 6; p.push(`<path d="M${x - 2},${y} l4,-2 l2,1 l-4,2 Z" fill="${r() < 0.5 ? '#9a6448' : '#7a5040'}" stroke="${INK}" stroke-width="0.4"/>`); }
    for (let i = 0; i < 3; i++) { const [x, y] = onL(0.25 + i * 0.25, h - 2); p.push(`<path d="M${x - 2},${y - 1} l4,-2 l2,1 l-4,2 Z" fill="#a06a4c" stroke="${INK}" stroke-width="0.5" stroke-linejoin="round"/>`); }
    p.push(`<polygon points="${P(s.left)}" fill="none" ${oo}/><polygon points="${P(s.right)}" fill="none" ${oo}/>`);
    p.push(`<polygon points="${P(s.right)}" fill="#0a0806" opacity="0.18"/>`);
    // rubble at the foot
    p.push(rubbleBits(r, 4, CY + 10));
    return svg(W, H, p.join(''), defs(v + 5, SKH));
  }
  function concreteWall(v) { HEX = true; try { return concreteWallHex(v); } finally { HEX = false; } }
  function concreteWallHex(v) {
    const r = rng(v * 29 + 7), h = 44, s = shape(r, h, 10);
    const p = [];
    p.push(`<g filter="url(#grain)"><polygon points="${P(s.left)}" fill="#8e8a80"/><polygon points="${P(s.right)}" fill="#5e5b55"/></g>`);
    // form-work seams, tie holes, water streaks, a faded painted stripe
    for (const v2 of [14, 29]) p.push(`<path d="M${P([onL(0, v2)])} L${P([onL(1, v2)])} M${P([onR(0, v2)])} L${P([onR(1, v2)])}" stroke="#4a4842" stroke-width="0.6" opacity="0.7"/>`);
    for (const [u, v2] of [[0.25, 7], [0.75, 7], [0.25, 22], [0.75, 22], [0.25, 37]]) { const [x, y] = onL(u, v2); p.push(`<circle cx="${x}" cy="${y}" r="0.8" fill="#4a4842"/>`); const [x2, y2] = onR(u, v2); p.push(`<circle cx="${x2}" cy="${y2}" r="0.8" fill="#2e2c28"/>`); }
    for (let i = 0; i < 4; i++) { const u = 0.1 + r() * 0.8, [x, y] = onL(u, 40); p.push(`<rect x="${x - 1}" y="${y}" width="${1.4 + r() * 2}" height="${14 + r() * 18}" fill="url(#stain)"/>`); }
    if (v !== 1) p.push(`<polygon points="${P([onL(0, 8), onL(1, 8), onL(1, 12), onL(0, 12)])}" fill="#b0702a" opacity="0.55"/>`);
    if (v === 1) p.push(`<polygon points="${P([onR(0.2, 8), onR(0.5, 8), onR(0.5, 13), onR(0.2, 13)])}" fill="#d8a020" opacity="0.6"/><polygon points="${P([onR(0.5, 8), onR(0.8, 8), onR(0.8, 13), onR(0.5, 13)])}" fill="#1e1e1c" opacity="0.6"/>`);
    // a chunk knocked out of the corner with rebar showing
    const ch = [onL(0.86, 30), onL(1, 26), onR(0.14, 31), onR(0.1, 38), onL(0.92, 37)];
    p.push(`<polygon points="${P(ch)}" fill="#3e3a34" stroke="${INK}" stroke-width="0.6" stroke-linejoin="round"/>`);
    p.push(`<polygon points="${P(s.top)}" fill="#6a665e" ${oo}/><polygon points="${P(s.top)}" fill="url(#concTop)" opacity="0.9"/><path d="M${P([s.top[1]])} L${P([s.top[5]])}" stroke="#a6a296" stroke-width="0.8" opacity="0.6"/>`);
    p.push(`<polygon points="${P(s.left)}" fill="url(#aoL)"/><polygon points="${P(s.right)}" fill="url(#aoL)"/>`);
    // rebar sticking out of the broken top
    for (let i = 0; i < 3; i++) { const u = 0.2 + i * 0.3, side = i % 2 ? onR : onL, [x, y] = side(u, h - 4); const bend = (r() - 0.5) * 8; p.push(`<path d="M${x},${y} q${bend * 0.3},-6 ${bend},-${9 + r() * 5}" stroke="#2a1a12" stroke-width="1.6" fill="none" stroke-linecap="round"/><path d="M${x},${y} q${bend * 0.3},-6 ${bend},-${9 + r() * 5}" stroke="#8a4a22" stroke-width="0.8" fill="none" stroke-linecap="round"/>`); }
    p.push(`<polygon points="${P(s.left)}" fill="none" ${oo}/><polygon points="${P(s.right)}" fill="none" ${oo}/>`);
    p.push(rubbleBits(r, 3, CY + 10, '#9a968a'));
    return svg(W, H, p.join(''), defs(v + 9, SKH));
  }
  function palisade(v) {
    const r = rng(v * 13 + 1), p = [];
    // two rows of sharpened stakes along the tile, lashed with rope
    const stakes = [];
    for (let i = 0; i < 9; i++) { const u = (i + 0.5) / 9, top = 34 + r() * 6; stakes.push([u, top]); }
    for (const [u, top] of stakes) {
      const [x0, y0] = [CX - A * 0.9 + u * A * 1.8, CY + (u - 0.5) * 2 - 0], w = 3.6;
      p.push(`<path d="M${x0 - w},${y0} L${x0 - w},${y0 - top} L${x0},${y0 - top - 6} L${x0 + w},${y0 - top} L${x0 + w},${y0} Z" fill="#7a5a38" ${oo}/><path d="M${x0 + 0.6},${y0 - top - 4} L${x0 + w},${y0 - top} L${x0 + w},${y0} L${x0 + 1},${y0} Z" fill="#4a3420"/><path d="M${x0 - 1.6},${y0 - top + 4} Q${x0 - 1},${y0 - top / 2} ${x0 - 2},${y0 - 6}" stroke="#a07a50" stroke-width="0.5" fill="none" opacity="0.7"/>`);
    }
    for (const ht of [10, 26]) p.push(`<path d="M${CX - A * 0.95},${CY - ht - 1} L${CX + A * 0.95},${CY - ht + 1}" stroke="#2a1e14" stroke-width="2.4"/><path d="M${CX - A * 0.95},${CY - ht - 1} L${CX + A * 0.95},${CY - ht + 1}" stroke="#b09a6a" stroke-width="1.2" stroke-dasharray="1.6 1"/>`);
    p.push(`<path d="M${CX - A},${CY + 1} L${CX + A},${CY + 1}" stroke="#000" stroke-width="3" opacity="0.25"/>`);
    return svg(W, H, `<g filter="url(#grain)">${p.join('')}</g>`, defs(v + 2));
  }

  // ---------- half cover ----------
  function crate(cx, cy, a, h, r, stencil = true) {
    const s = shape(r, h, 0, a, cx, cy);
    const p = [];
    p.push(`<polygon points="${P(s.left)}" fill="url(#plankL)" ${oo}/><polygon points="${P(s.right)}" fill="url(#plankR)" ${oo}/><polygon points="${P(s.top)}" fill="#a07a50" ${oo}/>`);
    // frame boards and a diagonal brace on each face
    const frameL = (u1, v1, u2, v2) => `<path d="M${P([onL(u1, v1, a, cx, cy)])} L${P([onL(u2, v2, a, cx, cy)])}" stroke="#5a3e26" stroke-width="2.2"/><path d="M${P([onL(u1, v1, a, cx, cy)])} L${P([onL(u2, v2, a, cx, cy)])}" stroke="#a88258" stroke-width="1.2"/>`;
    const frameR = (u1, v1, u2, v2) => `<path d="M${P([onR(u1, v1, a, cx, cy)])} L${P([onR(u2, v2, a, cx, cy)])}" stroke="#2e2014" stroke-width="2.2"/><path d="M${P([onR(u1, v1, a, cx, cy)])} L${P([onR(u2, v2, a, cx, cy)])}" stroke="#6e5034" stroke-width="1.2"/>`;
    p.push(frameL(0.04, 1.2, 0.96, 1.2) + frameL(0.04, h - 1.2, 0.96, h - 1.2) + frameL(0.06, 2, 0.94, h - 2) + frameL(0.05, 1, 0.05, h - 1) + frameL(0.95, 1, 0.95, h - 1));
    p.push(frameR(0.04, 1.2, 0.96, 1.2) + frameR(0.04, h - 1.2, 0.96, h - 1.2) + frameR(0.06, h - 2, 0.94, 2) + frameR(0.95, 1, 0.95, h - 1));
    if (stencil) { const [x, y] = onL(0.5, h * 0.5, a, cx, cy); p.push(`<g transform="translate(${x} ${y}) skewY(${SK})" opacity="0.55"><rect x="-3.4" y="-2.6" width="6.8" height="5.2" fill="none" stroke="#2a1a10" stroke-width="0.6"/><path d="M-2,-1 L2,-1 M-2,1 L1,1" stroke="#2a1a10" stroke-width="0.7"/></g>`); }
    p.push(`<polygon points="${P(s.right)}" fill="#000" opacity="0.15"/>`);
    return p.join('');
  }
  function crates(v) {
    const r = rng(v * 7 + 2), p = [];
    if (v === 0) { p.push(crate(CX - 6, CY - 2, 15, 15, r)); p.push(crate(CX + 9, CY + 5, 13, 12, r)); p.push(crate(CX - 5, CY - 17, 10, 9, r, false)); }
    else if (v === 1) { p.push(crate(CX + 6, CY - 4, 14, 14, r)); p.push(crate(CX - 10, CY + 3, 14, 13, r)); }
    else { p.push(crate(CX, CY, 20, 16, r)); p.push(`<path d="M${CX - 18},${CY - 10} Q${CX - 10},${CY - 20} ${CX + 4},${CY - 26}" stroke="#2a1e14" stroke-width="1.6" fill="none"/><path d="M${CX - 18},${CY - 10} Q${CX - 10},${CY - 20} ${CX + 4},${CY - 26}" stroke="#c8b47c" stroke-width="0.8" fill="none" stroke-dasharray="1.4 0.8"/>`); }
    return svg(W, H, `<g filter="url(#grain)">${p.join('')}</g>`, defs(v + 20));
  }
  function drum(x, y, hue, r, tipped = false) {
    const rw = 7.4, hg = 19, lit = shade(hue, 1.25), dk = shade(hue, 0.55);
    const id = `d${Math.round(x * 10 + y)}`;
    const g = `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${shade(hue, 0.9)}"/><stop offset="0.3" stop-color="${lit}"/><stop offset="0.75" stop-color="${hue}"/><stop offset="1" stop-color="${dk}"/></linearGradient>`;
    const p = [`<defs>${g}</defs>`];
    p.push(`<path d="M${x - rw},${y - hg} L${x - rw},${y} A${rw},3 0 0 0 ${x + rw},${y} L${x + rw},${y - hg} Z" fill="url(#${id})" ${oo}/>`);
    for (const ry of [6, 13]) p.push(`<path d="M${x - rw},${y - ry} A${rw},3 0 0 0 ${x + rw},${y - ry}" stroke="${INK}" stroke-width="0.9" fill="none"/><path d="M${x - rw},${y - ry - 0.8} A${rw},3 0 0 0 ${x + rw},${y - ry - 0.8}" stroke="${lit}" stroke-width="0.6" fill="none" opacity="0.6"/>`);
    // rust blooms and drips
    for (let i = 0; i < 3; i++) { const rx = x - rw + 2 + r() * (rw * 2 - 4), ry = y - 3 - r() * 14; p.push(`<ellipse cx="${rx}" cy="${ry}" rx="${1 + r() * 2}" ry="${0.8 + r() * 1.4}" fill="#7a3a16" opacity="0.7"/><path d="M${rx},${ry} l0,${2 + r() * 3}" stroke="#6a3014" stroke-width="0.6" opacity="0.6"/>`); }
    if (r() < 0.5) p.push(`<path d="M${x - 2},${y - 12} L${x + 2},${y - 9} L${x - 2},${y - 6} Z" fill="#d8a020" stroke="${INK}" stroke-width="0.5"/>`);
    p.push(`<ellipse cx="${x}" cy="${y - hg}" rx="${rw}" ry="3" fill="${shade(hue, 1.05)}" ${oo}/><ellipse cx="${x}" cy="${y - hg}" rx="${rw - 1.4}" ry="2.1" fill="none" stroke="${dk}" stroke-width="0.7"/><circle cx="${x + 3}" cy="${y - hg}" r="0.9" fill="${dk}" stroke="${INK}" stroke-width="0.4"/>`);
    return p.join('');
  }
  function drums(v) {
    const r = rng(v * 5 + 11), hues = ['#4e6a5a', '#6b4e3a', '#3f5966', '#7a6a3a', '#5b4040'];
    const p = [];
    const spots = v === 0 ? [[-8, -3], [7, 2]] : v === 1 ? [[-9, -1], [3, -5], [5, 6]] : [[0, 0], [-12, 4]];
    for (const [dx, dy] of spots) p.push(drum(CX + dx, CY + dy, hues[Math.floor(r() * hues.length)], r));
    return svg(W, H, `<g filter="url(#grain)">${p.join('')}</g>`, defs(v + 30));
  }
  // A sandbag emplacement: three staggered courses laid along a shallow arc, each bag a stuffed
  // pillow with a seam, tied ears and a darker underside; the top course slumps a little.
  function sandbags(v) {
    const r = rng(v * 3 + 5), p = [];
    const tones = ['#b09a6c', '#a28c60', '#bba676', '#958052', '#a89464'];
    const gdefs = tones.map((c, i) => `<linearGradient id="sb${i}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${shade(c, 1.22)}"/><stop offset="0.45" stop-color="${c}"/><stop offset="1" stop-color="${shade(c, 0.58)}"/></linearGradient>`).join('');
    const bag = (x, y, rot, ti, w = 11, sag = 0) => {
      const hw = w / 2;
      return `<g transform="translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${rot.toFixed(1)})">`
        + `<path d="M${-hw},-3 Q${-hw - 1.8},0.3 ${-hw},3.4 Q0,${5 + sag} ${hw},3.4 Q${hw + 1.8},0.3 ${hw},-3 Q0,${-4.4 + sag} ${-hw},-3 Z" fill="url(#sb${ti})" stroke="${INK}" stroke-width="0.7" stroke-linejoin="round"/>`
        + `<path d="M${-hw + 1.2},-1.8 Q0,${-3 + sag} ${hw - 1.2},-1.8" stroke="#f4e6c0" stroke-width="0.7" fill="none" opacity="0.55"/>`
        + `<path d="M${-hw + 1.4},0.9 Q0,${2 + sag} ${hw - 1.4},0.9" stroke="${shade(tones[ti], 0.55)}" stroke-width="0.45" fill="none" stroke-dasharray="0.8 0.7"/>`
        + `<path d="M${-hw},-1.6 l-1.3,-0.9 M${-hw},2 l-1.3,0.8 M${hw},-1.6 l1.3,-0.9 M${hw},2 l1.3,0.8" stroke="${INK}" stroke-width="0.5"/>`
        + `<path d="M${-hw * 0.3},-0.4 l0.8,1 M${hw * 0.35},-0.8 l0.6,1.2" stroke="${shade(tones[ti], 0.7)}" stroke-width="0.4"/></g>`;
    };
    const arcY = (x) => CY + 8 - Math.pow((x - CX) / 30, 2) * 8;
    const slope = (x) => Math.atan2(-2 * (x - CX) / 900 * 7, 1) * 180 / Math.PI;
    const courses = [[6, 0], [5, 0.5], [4, 1]];
    courses.forEach(([n, off], row) => {
      for (let i = 0; i < n; i++) {
        if (row === 2 && v === 1 && i === 3) continue; // a gap where a bag fell
        const x = CX - 33 + (i + 0.5 + off) * (66 / 6) + (r() - 0.5) * 1.2;
        const y = arcY(x) - row * 6.2 + (r() - 0.5) * 0.6;
        p.push(bag(x, y, slope(x) + (r() - 0.5) * (row === 2 ? 10 : 4), Math.floor(r() * tones.length), 12.4 + r() * 1.4, row === 2 ? 0.8 : 0));
      }
      // shade the course below the next one: bags pressed together hold a shadow line
      if (row < 2) p.push(`<path d="M${CX - 31},${arcY(CX - 31) - row * 6.2 - 3.4} Q${CX},${CY + 8 - row * 6.2 - 3} ${CX + 31},${arcY(CX + 31) - row * 6.2 - 3.4}" stroke="#1a120a" stroke-width="1" fill="none" opacity="0.35"/>`);
    });
    // a loose bag on the ground at one end
    if (v !== 1) p.push(bag(v ? CX - 33 : CX + 33, arcY(CX + 30) + 4, v ? 22 : -18, 2, 10, 0.4));
    else p.push(bag(CX + 12, CY + 13, 8, 3, 10.4, 0.5));
    return svg(W, H, `<g filter="url(#grain)">${p.join('')}</g>`, defs(v + 40) + gdefs);
  }
  function rubbleBits(r, n, y0, col = '#9a6448', cx = CX) {
    let s = '';
    for (let i = 0; i < n; i++) {
      const x = cx - 26 + r() * 52, y = y0 - r() * 6, w = 2 + r() * 3;
      s += `<path d="M${x},${y} l${w},-1.4 l1.6,1.6 l-${w},1.6 Z" fill="${col}" stroke="${INK}" stroke-width="0.5" stroke-linejoin="round"/>`;
    }
    return s;
  }
  function rubble(v) {
    const r = rng(v * 11 + 9), p = [];
    // mound of broken masonry and dust
    p.push(`<path d="M${CX - 28},${CY + 3} Q${CX - 20},${CY - 8} ${CX - 8},${CY - 10} Q${CX + 2},${CY - 14} ${CX + 10},${CY - 7} Q${CX + 24},${CY - 4} ${CX + 28},${CY + 4} Q${CX},${CY + 12} ${CX - 28},${CY + 3} Z" fill="#6e6458" ${oo}/>`);
    p.push(`<path d="M${CX - 22},${CY - 2} Q${CX - 10},${CY - 9} ${CX + 2},${CY - 10}" stroke="#a49a88" stroke-width="1.2" fill="none" opacity="0.6"/>`);
    // a tilted slab
    const sl = v === 1 ? [[CX - 18, CY - 2], [CX + 4, CY - 13], [CX + 8, CY - 8], [CX - 14, CY + 3]] : [[CX - 4, CY - 6], [CX + 18, CY - 2], [CX + 16, CY + 4], [CX - 6, CY]];
    p.push(`<polygon points="${P(sl)}" fill="#9a968a" ${oo}/><polygon points="${P([sl[3], sl[2], [sl[2][0], sl[2][1] + 3], [sl[3][0], sl[3][1] + 3]])}" fill="#5e5b55" ${oo}/>`);
    p.push(`<path d="M${sl[0][0] + 3},${sl[0][1]} q2,-6 6,-8" stroke="#2a1a12" stroke-width="1.6" fill="none"/><path d="M${sl[0][0] + 3},${sl[0][1]} q2,-6 6,-8" stroke="#8a4a22" stroke-width="0.8" fill="none"/>`);
    // bricks and chunks
    for (let i = 0; i < 9; i++) {
      const x = CX - 22 + r() * 44, y = CY + 2 - r() * 10, w = 3 + r() * 3, br = r() < 0.6;
      p.push(`<path d="M${x},${y} l${w},-${w / 2} l2,1.2 l-${w},${w / 2} Z" fill="${br ? '#9a6448' : '#8a867c'}" stroke="${INK}" stroke-width="0.6" stroke-linejoin="round"/><path d="M${x},${y} l2,1.2 l0,1.6 l-2,-1.2 Z" fill="${br ? '#5e3a2a' : '#4e4b45'}" stroke="${INK}" stroke-width="0.5" stroke-linejoin="round"/>`);
    }
    if (v === 2) p.push(`<path d="M${CX + 6},${CY - 6} l10,-14 l3,1 l-10,14 Z" fill="#6e5034" ${oo}/>`);
    return svg(W, H, `<g filter="url(#grain)">${p.join('')}</g>`, defs(v + 50));
  }

  // ======================================================================
  // Wall runs. Walls are drawn as slabs between the centres of neighbouring wall hexes, with a
  // post at each hex, so a line of wall hexes reads as one ruined wall, not a row of blocks.
  // Sprite box 140 x 140 with the hex centre at (90, 110). A run goes to the W, NW or NE neighbour.
  // ======================================================================
  const RW = 140, RH = 140, OX = 90, OY = 110, KZ = 0.65; // KZ: screen y per ground unit
  const DIRS = { W: [-64, 0], E: [64, 0], NW: [-32, -36], NE: [32, -36], SW: [-32, 36], SE: [32, 36] };
  const STYLE = {
    brick: { h: 44, t: 11, face: ['#9a6448', '#7a4c36', '#5e3a2a'], top: '#6a4636', pat: 'brick' },
    concrete: { h: 42, t: 12, face: ['#9a968c', '#7e7a72', '#5e5b55'], top: '#6e6a62', pat: 'conc' },
    fence: { h: 36, t: 6, face: ['#8a6a44', '#6a4e30', '#4e3820'], top: '#7a5a38', pat: 'fence' },
    building: { h: 40, t: 14, face: ['#8a6a4a', '#6e5238', '#523c2a'], top: '#4a3324', pat: 'building' },
  };
  function slabGeom(dir, t) {
    const [dx, dy] = DIRS[dir];
    const gx = dx, gy = dy / KZ, gl = Math.hypot(gx, gy);
    let nx = (-gy / gl) * t / 2, ny = (gx / gl) * t / 2 * KZ;
    if (ny < 0 || (ny === 0 && nx < 0)) { nx = -nx; ny = -ny; }
    return { dx, dy, nx, ny, light: dir === 'W' || dir === 'E' ? 1 : dir === 'NW' || dir === 'SE' ? 0 : 2 };
  }
  function run(kind, dir, v, cap = false) {
    // Walls are drawn as half-runs from a hex centre to the midpoint with each neighbour, so the
    // hex that owns a joint draws every arm that meets there (the building front stays one piece).
    const S = STYLE[kind], r = rng(v * 41 + dir.charCodeAt(0) * 7 + dir.length * 3 + kind.length);
    const full = kind === 'building', g0 = slabGeom(dir, S.t), sc = full ? 1 : 0.5;
    const dx = g0.dx * sc, dy = g0.dy * sc, nx = g0.nx, ny = g0.ny, light = g0.light;
    const A = [OX, OY], B = [OX + dx, OY + dy];
    const at = (t, side, hgt) => [A[0] + dx * t + nx * side, A[1] + dy * t + ny * side - hgt];
    const ang = Math.atan2(dy, dx) * 180 / Math.PI;
    const p = [];
    const fc = S.face[light];
    if (kind === 'fence') {
      // sharpened stakes along the line, lashed with two rails
      const n = full ? 10 : 5;
      for (let i = 0; i < (full ? n + 1 : n); i++) {
        const t = i / n, [x, y] = at(t, 0, 0), top = S.h - 3 + r() * 6, w = 2.4;
        p.push(`<path d="M${x - w},${y} L${x - w},${y - top} L${x},${y - top - 5} L${x + w},${y - top} L${x + w},${y} Z" fill="${shade(fc, 0.9 + r() * 0.25)}" stroke="${INK}" stroke-width="0.8" stroke-linejoin="round"/><path d="M${x + 0.6},${y - top - 3} L${x + w},${y - top} L${x + w},${y} L${x + 0.8},${y} Z" fill="#000" opacity="0.25"/>`);
      }
      for (const hh of [9, 25]) { const [x1, y1] = at(0, 1, hh), [x2, y2] = at(1, 1, hh); p.push(`<path d="M${x1},${y1} L${x2},${y2}" stroke="#2a1e14" stroke-width="2.4"/><path d="M${x1},${y1} L${x2},${y2}" stroke="#b09a6a" stroke-width="1.1" stroke-dasharray="1.6 1"/>`); }
      return svg(RW, RH, `<g filter="url(#grain)">${p.join('')}</g>`, defs(v + 60));
    }
    // jagged broken top (buildings keep a straight roofline)
    const N = full ? 8 : 4, drops = [];
    for (let i = 0; i <= N; i++) { let d = kind === 'building' ? 0 : r() * 3; if (kind !== 'building' && i > 0 && i < N && r() < 0.22) d += 3 + r() * 7; drops.push(d); }
    drops[0] = Math.min(drops[0], 1.5); drops[N] = 0; // the far end meets the neighbour's half at full height
    const front = [at(0, 1, 0), at(1, 1, 0)];
    for (let i = N; i >= 0; i--) front.push(at(i / N, 1, S.h - drops[i]));
    const top = [];
    for (let i = 0; i <= N; i++) top.push(at(i / N, 1, S.h - drops[i]));
    for (let i = N; i >= 0; i--) top.push(at(i / N, -1, S.h - drops[i] - (drops[i] > 3 ? 1 : 0)));
    const patId = `${S.pat}${light}`;
    const skew = `skewY(${ang > 90 ? ang - 180 : ang < -90 ? ang + 180 : ang})`;
    const pdefs = kind === 'brick' ? `<pattern id="${patId}" width="10" height="5" patternUnits="userSpaceOnUse" patternTransform="${skew}"><rect width="10" height="5" fill="${shade(fc, 0.62)}"/><rect x="0.4" y="0.4" width="9.2" height="4" fill="${fc}"/><rect x="5.4" y="0.4" width="0.6" height="4" fill="${shade(fc, 0.62)}"/><rect x="1" y="0.8" width="2" height="1" fill="${shade(fc, 1.15)}" opacity="0.6"/></pattern>`
      : kind === 'concrete' ? `<pattern id="${patId}" width="16" height="14" patternUnits="userSpaceOnUse" patternTransform="${skew}"><rect width="16" height="14" fill="${fc}"/><path d="M0,13.5 L16,13.5" stroke="${shade(fc, 0.7)}" stroke-width="0.6"/><circle cx="4" cy="6" r="0.8" fill="${shade(fc, 0.6)}"/><circle cx="12" cy="6" r="0.8" fill="${shade(fc, 0.6)}"/></pattern>`
      : `<pattern id="${patId}" width="5" height="40" patternUnits="userSpaceOnUse" patternTransform="${skew}"><rect width="5" height="40" fill="${fc}"/><path d="M4.6,0 L4.6,40" stroke="${shade(fc, 0.55)}" stroke-width="0.8"/></pattern>`;
    if (cap) p.push(`<polygon points="${P([at(0, -1, 0), at(0, 1, 0), at(0, 1, S.h - drops[0]), at(0, -1, S.h - drops[0])])}" fill="${shade(S.face[2], 0.85)}" stroke="${INK}" stroke-width="0.9" stroke-linejoin="round"/><path d="M${P([at(0, 0, 4)])} L${P([at(0, 0, S.h - 6)])}" stroke="#000" stroke-width="1" opacity="0.2"/>`);
    p.push(`<polygon points="${P(front)}" fill="url(#${patId})"/><path d="M${P([at(0, 1, 0)])} L${P([at(1, 1, 0)])}" stroke="${INK}" stroke-width="0.9"/>`);
    // weathering: stains running down from the top, damp and soot at the foot
    for (let i = 0; i < 3; i++) { const t = 0.15 + r() * 0.7, [x, y] = at(t, 1, S.h - 6); p.push(`<path d="M${x},${y} l${dx * 0.03},${18 + r() * 14}" stroke="#2a2018" stroke-width="${1.4 + r() * 2}" opacity="0.28"/>`); }
    p.push(`<path d="M${P([at(0, 1, 3)])} L${P([at(1, 1, 3)])}" stroke="#1a120a" stroke-width="5" opacity="0.22"/>`);
    if (kind === 'brick' && r() < 0.3) { const t = 0.25 + r() * 0.4; p.push(`<polygon points="${P([at(t, 1, 16), at(t + 0.18, 1, 15), at(t + 0.2, 1, 26), at(t + 0.04, 1, 28)])}" fill="#a89878" opacity="0.7"/>`); }
    if (kind === 'brick' && v === 1 && (dir === 'W' || dir === 'NW')) { const t = 0.3; p.push(`<polygon points="${P([at(t, 1, 18), at(t + 0.22, 1, 18), at(t + 0.22, 1, 32), at(t, 1, 32)])}" fill="#140e0a" stroke="${INK}" stroke-width="0.7"/><polygon points="${P([at(t, 1, 18), at(t + 0.22, 1, 18), at(t + 0.22, 1, 16.6), at(t, 1, 16.6)])}" fill="#8a8274"/>`); }
    if (kind === 'concrete') { const t = 0.2 + r() * 0.5; p.push(`<polygon points="${P([at(t, 1, 8), at(t + 0.3, 1, 8), at(t + 0.3, 1, 12), at(t, 1, 12)])}" fill="#b0702a" opacity="0.5"/>`); }
    if (kind === 'building') {
      for (const t of (v === 0 ? [0.25, 0.68] : v === 1 ? [0.4] : [0.22, 0.75])) p.push(`<polygon points="${P([at(t - 0.1, 1, 14), at(t + 0.1, 1, 14), at(t + 0.1, 1, 28), at(t - 0.1, 1, 28)])}" fill="#f0b050" stroke="${INK}" stroke-width="0.8"/><path d="M${P([at(t, 1, 14)])} L${P([at(t, 1, 28)])} M${P([at(t - 0.1, 1, 21)])} L${P([at(t + 0.1, 1, 21)])}" stroke="#5a3a20" stroke-width="0.8"/>`);
      // eaves of a tin roof overhanging the wall
      p.push(`<polygon points="${P([at(0, 2.2, S.h - 1), at(1, 2.2, S.h - 1), at(1, -1.4, S.h + 5), at(0, -1.4, S.h + 5)])}" fill="#5a5650"/><path d="M${P([at(0, 2.2, S.h - 1)])} L${P([at(1, 2.2, S.h - 1)])} M${P([at(0, -1.4, S.h + 5)])} L${P([at(1, -1.4, S.h + 5)])}" stroke="${INK}" stroke-width="0.9"/>`);
      for (let i = 1; i < 8; i++) p.push(`<path d="M${P([at(i / 8, 2.2, S.h - 1)])} L${P([at(i / 8, -1.4, S.h + 5)])}" stroke="#3a3632" stroke-width="0.6"/>`);
    } else {
      p.push(`<polygon points="${P(top)}" fill="${S.top}"/>`);
      // outline only the long edges of the broken top, never the joint ends
      p.push(`<polyline points="${P(top.slice(0, N + 1))}" fill="none" stroke="${INK}" stroke-width="0.85" stroke-linejoin="round"/><polyline points="${P(top.slice(N + 1))}" fill="none" stroke="${INK}" stroke-width="0.7" stroke-linejoin="round" opacity="0.8"/>`);
      if (cap) p.push(`<path d="M${P([at(0, 1, S.h - drops[0])])} L${P([at(0, -1, S.h - drops[0])])} M${P([at(0, 1, 0)])} L${P([at(0, 1, S.h - drops[0])])}" stroke="${INK}" stroke-width="0.85"/>`);
      for (let i = 0; i < 5; i++) { const t = 0.08 + r() * 0.84, [x, y] = at(t, 0, S.h - drops[Math.round(t * N)] + 0.5); p.push(`<path d="M${x - 1.6},${y} l3,-1.2 l1.6,0.8 l-3,1.2 Z" fill="${kind === 'brick' ? '#9a6448' : '#8a867c'}" stroke="${INK}" stroke-width="0.4"/>`); }
      if (kind === 'concrete') for (let i = 0; i < 2; i++) { const t = 0.2 + r() * 0.6, [x, y] = at(t, 0, S.h - drops[Math.round(t * N)]); const bend = (r() - 0.5) * 8; p.push(`<path d="M${x},${y} q${bend * 0.3},-5 ${bend},-${8 + r() * 5}" stroke="#2a1a12" stroke-width="1.5" fill="none"/><path d="M${x},${y} q${bend * 0.3},-5 ${bend},-${8 + r() * 5}" stroke="#8a4a22" stroke-width="0.7" fill="none"/>`); }
    }
    return svg(RW, RH, `<g filter="url(#grain)">${p.join('')}</g>`, defs(v + 70) + pdefs);
  }
  // The post at each wall hex: a squat pier that caps the joints (or a broken stub on its own).
  function pier(kind, v, alone) {
    const S = STYLE[kind], r = rng(v * 13 + kind.length);
    const a = alone ? 13 : 7.5, h = alone ? S.h - 6 - r() * 10 : S.h - 2;
    const prevHex = HEX; HEX = false;
    try {
      const s2 = shape(r, h, alone ? 6 : 2, a, OX, OY);
      const p = [];
      const L = kind === 'concrete' ? '#9a968c' : kind === 'fence' ? '#7a5a38' : '#9a6448', R2 = shade(L, 0.62);
      p.push(`<polygon points="${P(s2.left)}" fill="${kind === 'brick' ? 'url(#brickL)' : L}" stroke="${INK}" stroke-width="0.9" stroke-linejoin="round"/>`);
      p.push(`<polygon points="${P(s2.right)}" fill="${kind === 'brick' ? 'url(#brickR)' : R2}" stroke="${INK}" stroke-width="0.9" stroke-linejoin="round"/>`);
      p.push(`<polygon points="${P(s2.top)}" fill="${S.top}" stroke="${INK}" stroke-width="0.8" stroke-linejoin="round"/>`);
      if (alone) p.push(rubbleBits(r, 4, OY + 8, kind === 'brick' ? '#9a6448' : '#9a968a', OX));
      return svg(RW, RH, `<g filter="url(#grain)">${p.join('')}</g>`, defs(v + 80));
    } finally { HEX = prevHex; }
  }
  const KIND = (cvr, pr) => (cvr !== 2 ? null : pr === 6 ? 'fence' : pr === 4 ? 'building' : pr ? 'concrete' : 'brick');
  const pixOpts = (w, h) => ({ pw: w * Art.PX, ph: h * Art.PX, k: 22, outline: false });
  function runImg(kind, dir, v, cap = false) { return request(`run|${kind}|${dir}|${v}|${cap ? 1 : 0}`, () => run(kind, dir, v, cap), RW, RH, pixOpts(RW, RH)); }
  function pierImg(kind, v, alone) { return kind === 'building' ? null : request(`pier|${kind}|${v}|${alone ? 1 : 0}`, () => pier(kind, v, alone), RW, RH, pixOpts(RW, RH)); }

  // Map (cover, prop) to a builder. Returns null when nothing here is illustrated.
  // Map (cover, prop) to a builder. Returns null when nothing here is illustrated.
  function builder(cvr, pr) {
    if (cvr === 2 && pr === 6) return palisade;
    if (cvr === 2 && pr === 4) return null;
    if (cvr === 2) return pr ? concreteWall : brickWall;
    if (pr === 5 || pr === 3) return rubble;
    if (pr === 1) return drums;
    if (pr === 2) return sandbags;
    return crates;
  }
  // Ready image for this tile, or null (caller paints the fallback).
  function tile(cvr, pr, variant) {
    const f = builder(cvr, pr);
    if (!f) return null;
    return request(`st|${cvr}|${pr}|${variant}`, () => f(variant), W, H, { pw: W * Art.PX, ph: H * Art.PX, k: 20, outline: false });
  }
  return { tile, W, H, CX, CY, builder, KIND, runImg, pierImg, RW, RH, OX, OY, DIRS };
})();
