// ============================================================================
// Furniture: each room's contents as one hand-built SVG in the room's local
// coordinates (w x h, floor line at h - 12), rasterised once through
// Art.request. The room shell (walls, floor, roof) and live lights stay in
// render.js; this layer is the stuff people live and work among.
// ============================================================================
const Furniture = (() => {
  const { request, svg, shade, INK } = Art;
  const ol = (w = 1) => `stroke="${INK}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;
  const rng = (seed) => { let s = (seed * 9301 + 49297) % 233280; return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; }; };

  function kit(seed) {
    const defs = new Map();
    const vg = (c) => { const id = 'v' + c.slice(1); if (!defs.has(id)) defs.set(id, `<linearGradient id="${id}" x1="0" y1="0" x2="0.35" y2="1"><stop offset="0" stop-color="${shade(c, 1.18)}"/><stop offset="1" stop-color="${shade(c, 0.74)}"/></linearGradient>`); return `url(#${id})`; };
    const hg = (c) => { const id = 'h' + c.slice(1); if (!defs.has(id)) defs.set(id, `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${shade(c, 0.8)}"/><stop offset="0.35" stop-color="${shade(c, 1.25)}"/><stop offset="0.7" stop-color="${c}"/><stop offset="1" stop-color="${shade(c, 0.6)}"/></linearGradient>`); return `url(#${id})`; };
    // a box seen slightly from above and the left: front, top and right side faces
    const box = (x, y, w, h, c, d = 5, extra = '') => {
      const dy = d * 0.6;
      return `<g>`
        + `<path d="M${x + w},${y} L${x + w + d},${y - dy} L${x + w + d},${y + h - dy} L${x + w},${y + h} Z" fill="${shade(c, 0.6)}" ${ol(0.9)}/>`
        + `<path d="M${x},${y} L${x + d},${y - dy} L${x + w + d},${y - dy} L${x + w},${y} Z" fill="${shade(c, 1.22)}" ${ol(0.9)}/>`
        + `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${vg(c)}" ${ol(1)}/>${extra}</g>`;
    };
    const shadow = (x, w, y, a = 0.3) => `<ellipse cx="${x + w / 2}" cy="${y}" rx="${w / 2 + 3}" ry="2.6" fill="#000" opacity="${a}"/>`;
    const plankLines = (x, y, w, h, gap = 6, vertical = false) => {
      let s = '';
      if (vertical) for (let k = x + gap; k < x + w - 1; k += gap) s += `<path d="M${k},${y + 1} L${k},${y + h - 1}" stroke="#2a1a10" stroke-width="0.6" opacity="0.6"/>`;
      else for (let k = y + gap; k < y + h - 1; k += gap) s += `<path d="M${x + 1},${k} L${x + w - 1},${k}" stroke="#2a1a10" stroke-width="0.6" opacity="0.6"/>`;
      return s;
    };
    const nail = (x, y) => `<circle cx="${x}" cy="${y}" r="0.6" fill="#2a2420"/>`;
    const grain = `<filter id="gr" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" seed="${seed % 97}" result="n"/><feColorMatrix in="n" type="matrix" values="0 0 0 0 0.1  0 0 0 0 0.07  0 0 0 0 0.05  0 0 0 0.5 0" result="c"/><feComposite in="c" in2="SourceGraphic" operator="in" result="m"/><feBlend in="m" in2="SourceGraphic" mode="multiply"/></filter>`;
    const done = () => grain + [...defs.values()].join('');
    return { vg, hg, box, shadow, plankLines, nail, done };
  }

  // ---------- small props ----------
  const bottle = (x, y, c, k = 0) => {
    const h = [12, 10, 14, 9][k % 4], w = [4, 5, 3.6, 5.6][k % 4];
    return `<path d="M${x},${y} L${x},${y - h * 0.62} Q${x},${y - h * 0.75} ${x + w * 0.3},${y - h * 0.8} L${x + w * 0.3},${y - h} L${x + w * 0.7},${y - h} L${x + w * 0.7},${y - h * 0.8} Q${x + w},${y - h * 0.75} ${x + w},${y - h * 0.62} L${x + w},${y} Z" fill="${c}" ${ol(0.6)} opacity="0.92"/><path d="M${x + 0.9},${y - 1} L${x + 0.9},${y - h * 0.6}" stroke="#fff" stroke-width="0.6" opacity="0.45"/>${k % 2 ? `<rect x="${x + 0.4}" y="${y - h * 0.45}" width="${w - 0.8}" height="${h * 0.22}" fill="#d8ccb0" opacity="0.8"/>` : ''}`;
  };
  const mug = (x, y) => `<path d="M${x},${y} L${x},${y - 5} L${x + 4},${y - 5} L${x + 4},${y} Z" fill="#a8a294" ${ol(0.6)}/><path d="M${x + 4},${y - 4} q2,0 2,1.6 q0,1.4 -2,1.4" stroke="${INK}" stroke-width="0.6" fill="none"/>`;
  const oilLamp = (x, y) => `<ellipse cx="${x}" cy="${y - 1}" rx="3" ry="1.2" fill="#6a4a2a" ${ol(0.6)}/><path d="M${x - 2.2},${y - 1.5} Q${x - 3},${y - 7} ${x},${y - 9} Q${x + 3},${y - 7} ${x + 2.2},${y - 1.5} Z" fill="#e8d4a0" opacity="0.75" ${ol(0.6)}/><path d="M${x},${y - 3} Q${x - 1},${y - 5} ${x},${y - 6.4} Q${x + 1},${y - 5} ${x},${y - 3} Z" fill="#ffb040"/>`;
  const plant = (x, y, kind, r) => {
    let s = '';
    if (kind === 0) for (let i = 0; i < 7; i++) { const a = -1.3 + i * 0.43 + (r() - 0.5) * 0.2, l = 7 + r() * 4; s += `<path d="M${x},${y} Q${x + Math.cos(a) * l * 0.4 - 1},${y - l * 0.7} ${x + Math.sin(a) * l},${y - Math.cos(a) * l}" stroke="#3a5a24" stroke-width="2.6" fill="none" stroke-linecap="round"/><path d="M${x},${y} Q${x + Math.cos(a) * l * 0.4 - 1},${y - l * 0.7} ${x + Math.sin(a) * l},${y - Math.cos(a) * l}" stroke="#7aa04a" stroke-width="1.4" fill="none" stroke-linecap="round"/>`; }
    if (kind === 1) { s += `<path d="M${x},${y} L${x},${y - 18}" stroke="#7a6a4a" stroke-width="0.9"/>`; for (let i = 0; i < 5; i++) { const yy = y - 3 - i * 3.4, dir = i % 2 ? 1 : -1; s += `<path d="M${x},${yy} q${dir * 3},-2 ${dir * 5},0 q${-dir * 2},2 ${-dir * 5},0" fill="#5a8a3a" ${ol(0.5)}/>`; if (i % 2 === 0 && r() < 0.8) s += `<circle cx="${x + dir * 2}" cy="${yy + 2}" r="1.5" fill="#c0442a" ${ol(0.4)}/>`; } }
    if (kind === 2) { s += `<ellipse cx="${x}" cy="${y - 3}" rx="5.4" ry="3.6" fill="#8aa84a" ${ol(0.6)}/><ellipse cx="${x}" cy="${y - 4}" rx="3.4" ry="2.4" fill="#b0c86a"/><path d="M${x - 4},${y - 3} q4,-3 8,0" stroke="#5a7a2a" stroke-width="0.5" fill="none"/>`; }
    return s;
  };
  const crateF = (K, x, y, w, h, c = '#8a6440') => K.box(x, y, w, h, c, 4, K.plankLines(x, y, w, h, 5) + `<path d="M${x + 1.5},${y + 1.5} L${x + w - 1.5},${y + h - 1.5}" stroke="#4a3220" stroke-width="1.2" opacity="0.6"/>`);
  const jerry = (x, y, c = '#7a3a22') => `<path d="M${x},${y} L${x},${y - 12} L${x + 2},${y - 14} L${x + 8},${y - 14} L${x + 8},${y} Z" fill="${c}" ${ol(0.8)}/><path d="M${x + 1.5},${y - 11} L${x + 6.5},${y - 3} M${x + 6.5},${y - 11} L${x + 1.5},${y - 3}" stroke="${shade(c, 0.6)}" stroke-width="0.8"/><rect x="${x + 1}" y="${y - 16}" width="3" height="2.4" fill="#3a3632" ${ol(0.5)}/>`;
  const chair = (x, y, c = '#5a3e26', flip = false) => { const k = flip ? -1 : 1; return `<path d="M${x},${y} L${x},${y - 10} M${x + 9 * k},${y} L${x + 9 * k},${y - 10} M${x},${y - 10} L${x},${y - 24}" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/><path d="M${x},${y} L${x},${y - 10} M${x + 9 * k},${y} L${x + 9 * k},${y - 10} M${x},${y - 10} L${x},${y - 24}" stroke="${c}" stroke-width="1.2" stroke-linecap="round"/><rect x="${Math.min(x, x + 9 * k) - 1}" y="${y - 11.4}" width="11" height="2.6" fill="${shade(c, 1.2)}" ${ol(0.7)}/><rect x="${flip ? x - 1.6 : x - 1}" y="${y - 23}" width="2.6" height="9" fill="${c}" ${ol(0.6)}/>`; };

  // ---------- rooms ----------
  const ROOMS = {
    guest_room(K, w, h, r) {
      const f = h - 12, p = [];
      // boarded window and a faded picture on the wall
      p.push(`<rect x="${w - 70}" y="22" width="40" height="34" fill="#1e2a30" ${ol(1.2)}/><path d="M${w - 69},40 L${w - 31},38" stroke="#c8d8d8" stroke-width="0.5" opacity="0.3"/>${K.box(w - 74, 28, 48, 5, '#8a6a46', 2)}${K.box(w - 74, 44, 48, 5, '#7a5a3a', 2)}<rect x="${w - 74}" y="56" width="48" height="4" fill="#5a4030" ${ol(0.8)}/>`);
      p.push(`<rect x="34" y="30" width="22" height="16" fill="#6a5040" ${ol(1)}/><rect x="37" y="33" width="16" height="10" fill="#9a8a6a"/><path d="M37,43 L42,37 L46,40 L49,36 L53,43 Z" fill="#6a7a5a" opacity="0.8"/><path d="M45,30 L45,25" stroke="${INK}" stroke-width="0.6"/>`);
      const beds = w > 200 ? [16, 112, 208] : [16];
      for (const [i, x] of beds.entries()) {
        const bw = 64, c = ['#7a3a2e', '#3f5966', '#6a6a3a'][i % 3];
        p.push(K.shadow(x, bw, f + 1));
        p.push(`<rect x="${x}" y="${f - 28}" width="4" height="28" fill="${K.hg('#5a3a24')}" ${ol(0.8)}/><rect x="${x + bw - 3}" y="${f - 16}" width="3.6" height="16" fill="${K.hg('#5a3a24')}" ${ol(0.8)}/>`);
        p.push(`<path d="M${x + 4},${f - 26} Q${x + 2},${f - 31} ${x + 6},${f - 31}" stroke="${INK}" stroke-width="0.8" fill="#6a4a30"/><rect x="${x + 2}" y="${f - 9}" width="${bw - 2}" height="4" fill="#4a3220" ${ol(0.8)}/>`);
        p.push(`<path d="M${x + 4},${f - 9} L${x + 4},${f - 15} Q${x + bw / 2},${f - 17} ${x + bw - 2},${f - 15} L${x + bw - 2},${f - 9} Z" fill="#d8ccb0" ${ol(0.8)}/>`);
        p.push(`<path d="M${x + 6},${f - 17} Q${x + 12},${f - 21} ${x + 18},${f - 17} Q${x + 18},${f - 14} ${x + 12},${f - 14} Q${x + 6},${f - 14} ${x + 6},${f - 17} Z" fill="#ece2cc" ${ol(0.8)}/><path d="M${x + 9},${f - 17} q3,-1.4 6,0" stroke="#b0a68e" stroke-width="0.5" fill="none"/>`);
        p.push(`<path d="M${x + 19},${f - 17} Q${x + 30},${f - 20} ${x + 44},${f - 18} Q${x + 56},${f - 17} ${x + bw - 1},${f - 15} L${x + bw},${f - 4} Q${x + 50},${f - 2} ${x + 36},${f - 4} Q${x + 26},${f - 2} ${x + 19},${f - 5} Z" fill="${K.vg(c)}" ${ol(0.9)}/>`);
        p.push(`<path d="M${x + 28},${f - 18} Q${x + 30},${f - 10} ${x + 28},${f - 4} M${x + 44},${f - 18} Q${x + 46},${f - 11} ${x + 43},${f - 4}" stroke="${shade(c, 0.6)}" stroke-width="0.8" fill="none"/><path d="M${x + 20},${f - 15} L${x + bw - 1},${f - 13}" stroke="${shade(c, 1.4)}" stroke-width="1" opacity="0.6"/>`);
        p.push(`<path d="M${x + 20},${f - 11} L${x + bw},${f - 9}" stroke="#d8ccb0" stroke-width="1" stroke-dasharray="2 2" opacity="0.5"/>`);
        if (i < beds.length - 1 || w < 200) { const nx = x + bw + 8; p.push(K.shadow(nx, 16, f + 1) + crateF(K, nx, f - 14, 16, 14, '#6a4a30') + oilLamp(nx + 8, f - 15)); }
      }
      return p.join('');
    },
    bar(K, w, h, r) {
      const f = h - 12, p = [];
      const cw = w - 120;
      // back shelves crowded with bottles
      for (const sy of [34, 56]) { p.push(K.box(18, sy, cw + 10, 3.6, '#6b4428', 3)); for (let i = 0; i < Math.floor(cw / 9); i++) if (r() < 0.85) p.push(bottle(22 + i * 9 + r() * 2, sy, ['#5f7d4a', '#a8743a', '#4f6d7a', '#8a3a2a', '#c8b88a'][Math.floor(r() * 5)], Math.floor(r() * 4))); }
      p.push(`<rect x="${18 + cw / 2 + 10}" y="10" width="40" height="13" fill="#2a1e14" ${ol(1)}/><text x="${18 + cw / 2 + 30}" y="20.6" text-anchor="middle" font-family="Georgia, serif" font-weight="700" font-size="10" letter-spacing="2" fill="#f0a24a">BAR</text>`);
      // the counter: plank front, brass foot rail, worn top with taps and mugs
      p.push(K.shadow(18, cw, f + 1, 0.4));
      p.push(K.box(18, f - 38, cw, 38, '#6b4428', 6, K.plankLines(18, f - 38, cw, 38, 9, true) + `<rect x="18" y="${f - 38}" width="${cw}" height="5" fill="#4a2e1a"/>`));
      p.push(`<path d="M18,${f - 6} L${18 + cw},${f - 6}" stroke="${INK}" stroke-width="3"/><path d="M18,${f - 6} L${18 + cw},${f - 6}" stroke="#c8a050" stroke-width="1.6"/><path d="M18,${f - 7} L${18 + cw},${f - 7}" stroke="#f0d890" stroke-width="0.5"/>`);
      p.push(`<rect x="16" y="${f - 42}" width="${cw + 6}" height="4" fill="${K.vg('#8a5a34')}" ${ol(0.9)}/>`);
      for (let k = 0; k < 3; k++) { const tx = 40 + k * 12; p.push(`<path d="M${tx},${f - 42} L${tx},${f - 52} L${tx + 4},${f - 52}" stroke="${INK}" stroke-width="2.4" fill="none"/><path d="M${tx},${f - 42} L${tx},${f - 52} L${tx + 4},${f - 52}" stroke="#c8a050" stroke-width="1.2" fill="none"/><rect x="${tx - 1.6}" y="${f - 58}" width="3.2" height="6" rx="1" fill="#2a1e14" ${ol(0.5)}/>`); }
      for (let k = 0; k < 4; k++) p.push(mug(90 + k * 22 + r() * 6, f - 42));
      p.push(bottle(150, f - 42, '#5f7d4a', 2));
      // a table and stools for drinkers
      const tx = w - 90;
      p.push(K.shadow(tx, 44, f + 1) + `<rect x="${tx + 19}" y="${f - 22}" width="5" height="22" fill="${K.hg('#5a3a24')}" ${ol(0.8)}/><ellipse cx="${tx + 22}" cy="${f - 24}" rx="24" ry="4" fill="${K.vg('#8a5a34')}" ${ol(1)}/><ellipse cx="${tx + 22}" cy="${f - 1}" rx="10" ry="2" fill="#4a3220" ${ol(0.7)}/>`);
      p.push(mug(tx + 12, f - 25) + bottle(tx + 26, f - 25, '#a8743a', 0));
      for (const sx of [tx - 14, tx + 52]) p.push(`<path d="M${sx},${f} L${sx + 3},${f - 14} M${sx + 10},${f} L${sx + 7},${f - 14}" stroke="${INK}" stroke-width="2"/><path d="M${sx},${f} L${sx + 3},${f - 14} M${sx + 10},${f} L${sx + 7},${f - 14}" stroke="#6a4a30" stroke-width="1"/><ellipse cx="${sx + 5}" cy="${f - 15}" rx="6" ry="2.2" fill="#8a5a34" ${ol(0.8)}/>`);
      // kegs stacked at the far end
      for (const [kx, ky] of [[w - 34, f], [w - 18, f], [w - 26, f - 20]]) p.push(`<path d="M${kx - 7},${ky} Q${kx - 9},${ky - 10} ${kx - 7},${ky - 19} L${kx + 7},${ky - 19} Q${kx + 9},${ky - 10} ${kx + 7},${ky} Z" fill="${K.hg('#7a5030')}" ${ol(1)}/><path d="M${kx - 7.8},${ky - 4} L${kx + 7.8},${ky - 4} M${kx - 7.8},${ky - 15} L${kx + 7.8},${ky - 15}" stroke="#3a3632" stroke-width="1.4"/><ellipse cx="${kx}" cy="${ky - 19}" rx="7" ry="1.6" fill="#8a6040" ${ol(0.6)}/>`);
      return p.join('');
    },
    entertainment(K, w, h, r) {
      const f = h - 12, p = [];
      // string lights across the ceiling
      p.push(`<path d="M10,20 Q${w * 0.25},34 ${w * 0.5},20 Q${w * 0.75},34 ${w - 10},20" stroke="#2a2420" stroke-width="0.8" fill="none"/>`);
      for (let i = 1; i < 14; i++) { const t = i / 14, x = 10 + t * (w - 20), y = 20 + Math.sin((t * 2 % 1) * Math.PI) * 13; p.push(`<circle cx="${x}" cy="${y + 2}" r="1.8" fill="${['#f0c060', '#e07a5f', '#9fd0e0'][i % 3]}" ${ol(0.4)}/>`); }
      // card table with felt, cards and chips
      p.push(K.shadow(28, 90, f + 1, 0.35));
      p.push(`<path d="M40,${f} L44,${f - 22} M110,${f} L106,${f - 22}" stroke="${INK}" stroke-width="3.4"/><path d="M40,${f} L44,${f - 22} M110,${f - 0} L106,${f - 22}" stroke="#5a3a24" stroke-width="2"/>`);
      p.push(`<path d="M28,${f - 24} Q75,${f - 32} 122,${f - 24} L122,${f - 20} Q75,${f - 13} 28,${f - 20} Z" fill="${K.vg('#2f5a3a')}" ${ol(1)}/><path d="M28,${f - 20} Q75,${f - 13} 122,${f - 20} L122,${f - 18} Q75,${f - 11} 28,${f - 18} Z" fill="#5a3a24" ${ol(0.8)}/>`);
      for (let i = 0; i < 4; i++) p.push(`<path d="M${54 + i * 9},${f - 25} l5,-1 l1.4,2 l-5,1 Z" fill="#ece2cc" ${ol(0.5)}/>`);
      for (let i = 0; i < 5; i++) p.push(`<ellipse cx="${92 + (i % 2) * 6}" cy="${f - 24 - i * 1.4}" rx="3" ry="1" fill="${['#a8432f', '#e8dcc0', '#3f5966'][i % 3]}" ${ol(0.4)}/>`);
      p.push(chair(20, f) + chair(130, f, '#5a3e26', true));
      // stage with curtains and footlights
      const sx = w - 140;
      p.push(K.box(sx, f - 14, 124, 14, '#5a3a24', 5, K.plankLines(sx, f - 14, 124, 14, 30, true)));
      p.push(`<path d="M${sx},14 L${sx + 124},14 L${sx + 124},${f - 14} L${sx + 110},${f - 14} Q${sx + 100},50 ${sx + 96},20 L${sx + 28},20 Q${sx + 24},50 ${sx + 14},${f - 14} L${sx},${f - 14} Z" fill="${K.vg('#7a2a2e')}" ${ol(1)}/>`);
      for (let k = 0; k < 4; k++) p.push(`<path d="M${sx + 3 + k * 3},16 Q${sx + 4 + k * 3},60 ${sx + 2 + k * 3},${f - 15}" stroke="#4a1418" stroke-width="0.7" fill="none"/><path d="M${sx + 121 - k * 3},16 Q${sx + 120 - k * 3},60 ${sx + 122 - k * 3},${f - 15}" stroke="#4a1418" stroke-width="0.7" fill="none"/>`);
      p.push(`<path d="M${sx},14 Q${sx + 62},30 ${sx + 124},14" fill="#8a3236" ${ol(0.8)}/>`);
      for (let k = 0; k < 6; k++) p.push(`<path d="M${sx + 12 + k * 20},${f - 14} l3,-3 l3,3 Z" fill="#f0c060" ${ol(0.5)}/>`);
      p.push(`<path d="M${sx + 60},${f - 14} L${sx + 60},${f - 42}" stroke="${INK}" stroke-width="1.4"/><ellipse cx="${sx + 60}" cy="${f - 44}" rx="2.4" ry="3.2" fill="#3a3632" ${ol(0.6)}/>`);
      return p.join('');
    },
    wall(K, w, h, r) {
      const p = [], top = 10, bot = h - 12;
      for (const px of [36, 74, 112]) p.push(`<rect x="${px}" y="${top}" width="7" height="${bot - top}" fill="${K.hg('#5a4030')}" ${ol(1)}/>`);
      // overlapping sheet-metal panels with rust and bolts
      const panels = [[30, 18, 44, 62, '#6a6a62'], [72, 14, 46, 70, '#7a6a52'], [38, 74, 40, 50, '#5e6460'], [76, 80, 44, 44, '#6e5a48']];
      for (const [x, y, pw, ph, c] of panels) {
        p.push(`<rect x="${x}" y="${y}" width="${pw}" height="${ph}" fill="${K.vg(c)}" ${ol(1)}/>`);
        for (let k = x + 4; k < x + pw - 2; k += 5) p.push(`<path d="M${k},${y + 1} L${k},${y + ph - 1}" stroke="${shade(c, 0.7)}" stroke-width="1.4"/><path d="M${k + 1.4},${y + 1} L${k + 1.4},${y + ph - 1}" stroke="${shade(c, 1.25)}" stroke-width="0.6" opacity="0.7"/>`);
        p.push(`<ellipse cx="${x + pw * (0.3 + r() * 0.4)}" cy="${y + ph * (0.3 + r() * 0.5)}" rx="${4 + r() * 5}" ry="${3 + r() * 4}" fill="#8a4a20" opacity="0.5"/>`);
        p.push([[x + 2.5, y + 3], [x + pw - 2.5, y + 3], [x + 2.5, y + ph - 3], [x + pw - 2.5, y + ph - 3]].map(([a, b]) => K.nail(a, b)).join(''));
      }
      // barbed wire coil along the top
      for (let i = 0; i < 9; i++) p.push(`<ellipse cx="${30 + i * 11}" cy="${top + 2}" rx="7" ry="5" fill="none" stroke="#3a3632" stroke-width="0.8"/>`);
      for (let i = 0; i < 18; i++) p.push(`<path d="M${28 + i * 5.4},${top - 3 + (i % 3) * 2} l1.4,1.4 m-1.4,0 l1.4,-1.4" stroke="#5a5650" stroke-width="0.6"/>`);
      // sandbags at the foot
      for (let i = 0; i < 6; i++) p.push(`<ellipse cx="${26 + i * 18 + (i % 2) * 2}" cy="${bot - 4}" rx="9.6" ry="4.4" fill="${['#a8946a', '#9a8660', '#b49e72'][i % 3]}" ${ol(0.8)}/>`);
      for (let i = 0; i < 5; i++) p.push(`<ellipse cx="${35 + i * 18}" cy="${bot - 11}" rx="9.6" ry="4.2" fill="${['#9a8660', '#b49e72', '#8e7c58'][i % 3]}" ${ol(0.8)}/>`);
      return p.join('');
    },
    watchtower(K, w, h, r) {
      const p = [], bot = h - 12, pl = 52;
      // splayed timber legs with cross bracing
      p.push(`<path d="M44,${bot} L58,${pl} M106,${bot} L92,${pl}" stroke="${INK}" stroke-width="7.4" stroke-linecap="round"/><path d="M44,${bot} L58,${pl} M106,${bot} L92,${pl}" stroke="#6a4a30" stroke-width="5.4" stroke-linecap="round"/><path d="M45,${bot} L57,${pl}" stroke="#9a7048" stroke-width="1.2"/>`);
      for (const [y1, y2] of [[bot - 6, pl + 34], [pl + 34, bot - 6]]) p.push(`<path d="M${48 + (bot - y1) * 0.12},${y1} L${101 - (bot - y2) * 0.12},${y2}" stroke="${INK}" stroke-width="4"/><path d="M${48 + (bot - y1) * 0.12},${y1} L${101 - (bot - y2) * 0.12},${y2}" stroke="#7a5a38" stroke-width="2.4"/>`);
      // ladder
      p.push(`<path d="M70,${bot} L70,${pl + 4} M80,${bot} L80,${pl + 4}" stroke="${INK}" stroke-width="2.6"/><path d="M70,${bot} L70,${pl + 4} M80,${bot} L80,${pl + 4}" stroke="#8a6a46" stroke-width="1.4"/>`);
      for (let y = bot - 6; y > pl + 6; y -= 8) p.push(`<path d="M70,${y} L80,${y}" stroke="#5a4030" stroke-width="1.6"/>`);
      // platform, plank railing, roof and a searchlight
      p.push(K.box(38, pl, 74, 6, '#7a5a38', 5, K.plankLines(38, pl, 74, 6, 9, true)));
      p.push(`<rect x="40" y="${pl - 16}" width="70" height="12" fill="${K.vg('#6a4a30')}" ${ol(1)}/>${K.plankLines(40, pl - 16, 70, 12, 4)}<path d="M40,${pl - 16} L40,${pl} M110,${pl - 16} L110,${pl}" stroke="${INK}" stroke-width="3"/>`);
      p.push(`<path d="M42,${pl - 16} L42,${pl - 34} M108,${pl - 16} L108,${pl - 34}" stroke="${INK}" stroke-width="2.6"/><path d="M42,${pl - 16} L42,${pl - 34} M108,${pl - 16} L108,${pl - 34}" stroke="#6a4a30" stroke-width="1.4"/>`);
      p.push(`<path d="M32,${pl - 32} L75,${pl - 46} L118,${pl - 32} L114,${pl - 29} L36,${pl - 29} Z" fill="${K.vg('#5a5650')}" ${ol(1)}/>`);
      for (let k = 40; k < 112; k += 5) p.push(`<path d="M${k},${pl - 31} L${75 + (k - 75) * 0.15},${pl - 44}" stroke="#3a3632" stroke-width="0.5" opacity="0.6"/>`);
      p.push(`<path d="M96,${pl - 16} L100,${pl - 24}" stroke="${INK}" stroke-width="1.6"/><path d="M93,${pl - 28} L104,${pl - 30} L105,${pl - 22} L95,${pl - 20} Z" fill="#3a3f40" ${ol(0.8)}/><ellipse cx="104.5" cy="${pl - 26}" rx="1.6" ry="4" fill="#f8e8b0" ${ol(0.5)}/>`);
      return p.join('');
    },
    generator(K, w, h, r) {
      const f = h - 12, p = [];
      // exhaust stack to the ceiling
      p.push(`<path d="M96,${f - 50} L96,14 L118,14" stroke="${INK}" stroke-width="7" fill="none"/><path d="M96,${f - 50} L96,14 L118,14" stroke="#5a504a" stroke-width="5" fill="none"/><path d="M94.6,${f - 50} L94.6,15" stroke="#8a807a" stroke-width="1" opacity="0.7"/><rect x="92" y="${f - 64}" width="8" height="3" fill="#3a3632" ${ol(0.6)}/>`);
      // engine block on skids
      p.push(K.shadow(18, 104, f + 1, 0.4) + K.box(16, f - 6, 104, 6, '#3a3632', 4));
      p.push(K.box(22, f - 46, 72, 40, '#5d6a52', 6, `<rect x="26" y="${f - 40}" width="64" height="4" fill="#4a5642"/>`));
      for (let k = 0; k < 4; k++) p.push(`<rect x="${30 + k * 15}" y="${f - 60}" width="11" height="15" rx="1.4" fill="${K.vg('#7a8470')}" ${ol(0.9)}/>${[0, 1, 2].map((j) => `<path d="M${30 + k * 15},${f - 57 + j * 4} L${41 + k * 15},${f - 57 + j * 4}" stroke="#3a4232" stroke-width="0.8"/>`).join('')}`);
      p.push(`<path d="M28,${f - 62} L90,${f - 62}" stroke="${INK}" stroke-width="2.6"/><path d="M28,${f - 62} L90,${f - 62}" stroke="#2a2a28" stroke-width="1.4"/>`);
      // flywheel and belt
      p.push(`<circle cx="106" cy="${f - 26}" r="15" fill="${K.vg('#4a4e50')}" ${ol(1.2)}/><circle cx="106" cy="${f - 26}" r="11" fill="none" stroke="#2a2e30" stroke-width="1"/>${[0, 1, 2, 3, 4, 5].map((k) => `<path d="M106,${f - 26} L${106 + Math.cos(k * 1.047) * 11},${f - 26 + Math.sin(k * 1.047) * 11}" stroke="#2a2e30" stroke-width="1.8"/>`).join('')}<circle cx="106" cy="${f - 26}" r="3" fill="#8a9290" ${ol(0.7)}/>`);
      p.push(`<path d="M94,${f - 38} L106,${f - 41} M94,${f - 14} L106,${f - 11}" stroke="#1a1a18" stroke-width="2"/>`);
      // gauges and a hazard plate
      for (let k = 0; k < 3; k++) { const gx = 34 + k * 14, gy = f - 25; p.push(`<circle cx="${gx}" cy="${gy}" r="5" fill="#e8e0c8" ${ol(1)}/><path d="M${gx},${gy} L${gx + Math.cos(-2.4 + k * 0.9) * 4},${gy + Math.sin(-2.4 + k * 0.9) * 4}" stroke="#b0302a" stroke-width="0.8"/><circle cx="${gx}" cy="${gy}" r="0.8" fill="${INK}"/>`); }
      p.push(`<rect x="72" y="${f - 30}" width="16" height="10" fill="#d8a020" ${ol(0.8)}/><path d="M80,${f - 28.6} L76,${f - 21.6} L84,${f - 21.6} Z" fill="none" stroke="${INK}" stroke-width="0.8"/>`);
      p.push(`<path d="M24,${f - 10} Q40,${f - 4} 60,${f - 10}" stroke="#1a1a18" stroke-width="1.4" fill="none"/>`);
      p.push(jerry(126, f, '#7a3a22') + jerry(136, f, '#5a6a3a'));
      p.push(`<ellipse cx="60" cy="${f + 1}" rx="12" ry="1.6" fill="#1a1612" opacity="0.6"/>`);
      return p.join('');
    },
    water_pump(K, w, h, r) {
      const f = h - 12, p = [];
      // pipe run in from the wall and down into the floor
      p.push(`<path d="M8,30 L40,30 L40,${f - 60}" stroke="${INK}" stroke-width="7" fill="none"/><path d="M8,30 L40,30 L40,${f - 60}" stroke="#4f6f7a" stroke-width="5" fill="none"/><path d="M8,28.6 L39,28.6" stroke="#9ab8c0" stroke-width="0.8" opacity="0.6"/>`);
      for (const x of [20, 34]) p.push(`<rect x="${x - 1.6}" y="26" width="3.2" height="8" fill="#3a5560" ${ol(0.6)}/>`);
      // the pump: cylinder, cap, handle wheel
      p.push(K.shadow(24, 34, f + 1, 0.4));
      p.push(`<rect x="26" y="${f - 64}" width="28" height="64" rx="3" fill="${K.hg('#4f6f7a')}" ${ol(1.2)}/><rect x="23" y="${f - 68}" width="34" height="6" rx="2" fill="${K.hg('#3f5966')}" ${ol(1)}/><rect x="23" y="${f - 6}" width="34" height="6" rx="1" fill="${K.hg('#3f5966')}" ${ol(1)}/>`);
      for (let k = 0; k < 3; k++) p.push(`<path d="M26,${f - 50 + k * 16} L54,${f - 50 + k * 16}" stroke="#2f4550" stroke-width="1.6"/>`);
      p.push(`<circle cx="40" cy="${f - 76}" r="9" fill="none" stroke="${INK}" stroke-width="3.4"/><circle cx="40" cy="${f - 76}" r="9" fill="none" stroke="#b0302a" stroke-width="2"/><path d="M31,${f - 76} L49,${f - 76} M40,${f - 85} L40,${f - 67}" stroke="#b0302a" stroke-width="1.4"/><path d="M40,${f - 67} L40,${f - 68}" stroke="${INK}" stroke-width="3"/>`);
      // outlet to a holding tank with a sight glass
      p.push(`<path d="M54,${f - 30} L76,${f - 30}" stroke="${INK}" stroke-width="6"/><path d="M54,${f - 30} L76,${f - 30}" stroke="#4f6f7a" stroke-width="4"/>`);
      p.push(K.shadow(74, 50, f + 1, 0.4) + `<rect x="76" y="${f - 56}" width="46" height="56" rx="6" fill="${K.hg('#6a7a7a')}" ${ol(1.2)}/>`);
      for (let k = 0; k < 4; k++) p.push(`<path d="M76,${f - 48 + k * 13} L122,${f - 48 + k * 13}" stroke="#4a5858" stroke-width="1"/>`);
      p.push(`<rect x="112" y="${f - 50}" width="5" height="40" rx="2" fill="#1a2a30" ${ol(0.7)}/><rect x="113" y="${f - 30}" width="3" height="19" fill="#7fb2c0"/><ellipse cx="90" cy="${f - 36}" rx="7" ry="4" fill="#8a4a20" opacity="0.4"/>`);
      p.push(`<path d="M120,${f - 4} Q132,${f - 2} 136,${f}" stroke="#4f6f7a" stroke-width="2.6" fill="none"/><path d="M128,${f} l0,0" stroke="#000"/>`);
      p.push(`<path d="M128,${f} L130,${f - 10} L140,${f - 10} L142,${f} Z" fill="${K.hg('#7a7a72')}" ${ol(0.8)}/><ellipse cx="135" cy="${f - 10}" rx="5" ry="1.2" fill="#7fb2c0" ${ol(0.5)}/>`);
      return p.join('');
    },
    food(K, w, h, r) {
      const f = h - 12, p = [];
      const n = Math.max(1, Math.floor((w - 20) / 70));
      for (let i = 0; i < n; i++) {
        const x = 14 + i * ((w - 28) / n), bw = (w - 28) / n - 12;
        p.push(`<path d="M${x + bw / 2},10 L${x + bw / 2},26" stroke="#2a2420" stroke-width="0.8"/><path d="M${x + 4},26 L${x + bw - 4},26 L${x + bw - 10},31 L${x + 10},31 Z" fill="#4a4e50" ${ol(0.8)}/><rect x="${x + 10}" y="31" width="${bw - 20}" height="1.6" fill="#f8e8b0"/>`);
        p.push(K.shadow(x, bw, f + 1) + K.box(x, f - 18, bw, 18, '#5a4024', 4, K.plankLines(x, f - 18, bw, 18, 6)));
        p.push(`<path d="M${x + 1},${f - 18} Q${x + bw / 2},${f - 21} ${x + bw - 1},${f - 18}" fill="#3a2a1c"/>`);
        const kind = i % 3;
        for (let k = 0; k < Math.floor(bw / 11); k++) p.push(plant(x + 6 + k * 11 + r() * 2, f - 18, kind, r));
      }
      p.push(`<path d="M${w - 26},${f} L${w - 24},${f - 9} L${w - 14},${f - 9} L${w - 12},${f} Z" fill="${K.hg('#6a7a5a')}" ${ol(0.8)}/><path d="M${w - 14},${f - 7} L${w - 6},${f - 13}" stroke="${INK}" stroke-width="1.6"/><path d="M${w - 23},${f - 9} Q${w - 19},${f - 15} ${w - 15},${f - 9}" stroke="${INK}" stroke-width="0.8" fill="none"/>`);
      return p.join('');
    },
    crew_quarters(K, w, h, r) {
      const f = h - 12, p = [];
      for (const [i, x] of [16, 78].entries()) {
        const bw = 54, c1 = ['#5b5f73', '#7a4a2e'][i], c2 = ['#4f6650', '#6b3f3f'][i];
        p.push(K.shadow(x, bw, f + 1));
        p.push(`<path d="M${x},${f} L${x},${f - 74} M${x + bw},${f} L${x + bw},${f - 74}" stroke="${INK}" stroke-width="3.6"/><path d="M${x},${f} L${x},${f - 74} M${x + bw},${f} L${x + bw},${f - 74}" stroke="#6a6e70" stroke-width="2.2"/>`);
        for (const [by, c] of [[f - 42, c1], [f - 8, c2]]) {
          p.push(`<rect x="${x}" y="${by}" width="${bw}" height="3" fill="#4a4e50" ${ol(0.8)}/><path d="M${x + 2},${by} L${x + 2},${by - 5} Q${x + bw / 2},${by - 6.4} ${x + bw - 2},${by - 5} L${x + bw - 2},${by} Z" fill="#d8ccb0" ${ol(0.7)}/>`);
          p.push(`<path d="M${x + 3},${by - 6} Q${x + 7},${by - 9} ${x + 12},${by - 6} Q${x + 12},${by - 4} ${x + 7},${by - 4} Q${x + 3},${by - 4} ${x + 3},${by - 6} Z" fill="#ece2cc" ${ol(0.6)}/>`);
          p.push(`<path d="M${x + 13},${by - 6} Q${x + 30},${by - 9} ${x + bw - 1},${by - 6} L${x + bw},${by + 5} Q${x + 34},${by + 6} ${x + 13},${by + 3} Z" fill="${K.vg(c)}" ${ol(0.8)}/><path d="M${x + 26},${by - 7} Q${x + 28},${by - 1} ${x + 25},${by + 4}" stroke="${shade(c, 0.6)}" stroke-width="0.7" fill="none"/>`);
        }
        p.push(`<path d="M${x + bw - 2},${f - 44} L${x + bw - 2},${f - 72} M${x + bw - 8},${f - 44} L${x + bw - 8},${f - 72}" stroke="#4a4e50" stroke-width="1"/>${[0, 1, 2].map((k) => `<path d="M${x + bw - 8},${f - 50 - k * 8} L${x + bw - 2},${f - 50 - k * 8}" stroke="#4a4e50" stroke-width="1"/>`).join('')}`);
      }
      p.push(`<rect x="56" y="22" width="8" height="10" fill="#d8ccb0" ${ol(0.5)} transform="rotate(-6 60 27)"/><rect x="66" y="20" width="8" height="10" fill="#c8bca0" ${ol(0.5)} transform="rotate(5 70 25)"/><circle cx="60" cy="22" r="0.8" fill="#b0302a"/><circle cx="70" cy="20" r="0.8" fill="#b0302a"/>`);
      p.push(K.box(62, f - 9, 20, 9, '#3f5966', 3, `<rect x="70" y="${f - 7}" width="4" height="3" fill="#c8a050" ${ol(0.4)}/>`));
      return p.join('');
    },
    team_management(K, w, h, r) {
      const f = h - 12, p = [];
      // chalkboard with a route sketched on it
      p.push(`<rect x="26" y="18" width="98" height="40" fill="${K.vg('#3a4a3f')}" ${ol(1.2)}/><rect x="24" y="16" width="102" height="44" fill="none" stroke="#6a4a30" stroke-width="3"/>`);
      p.push(`<path d="M34,48 Q50,30 66,40 T100,28" stroke="#e8e0c8" stroke-width="0.9" fill="none" stroke-dasharray="3 2"/><path d="M98,24 l4,4 m0,-4 l-4,4" stroke="#e8a090" stroke-width="1.1"/><circle cx="34" cy="48" r="2" fill="none" stroke="#e8e0c8" stroke-width="0.8"/><path d="M40,24 L58,24 M40,28 L52,28 M106,46 L118,46 M106,50 L114,50" stroke="#e8e0c8" stroke-width="0.7" opacity="0.8"/>`);
      // table with a map, radio set
      p.push(K.shadow(16, 118, f + 1, 0.35) + `<path d="M22,${f} L22,${f - 24} M128,${f} L128,${f - 24}" stroke="${INK}" stroke-width="3.6"/><path d="M22,${f} L22,${f - 24} M128,${f} L128,${f - 24}" stroke="#5a3a24" stroke-width="2.2"/>` + K.box(16, f - 28, 118, 5, '#6b4428', 5));
      p.push(`<path d="M24,${f - 29} L60,${f - 32} L66,${f - 29} L30,${f - 27} Z" fill="#d8c8a0" ${ol(0.6)}/><path d="M34,${f - 29} Q44,${f - 31} 52,${f - 29}" stroke="#a8432f" stroke-width="0.6" fill="none"/>`);
      p.push(K.box(86, f - 44, 32, 16, '#4a4e44', 4, `<circle cx="94" cy="${f - 36}" r="3.4" fill="#2a2a28" ${ol(0.6)}/><circle cx="104" cy="${f - 36}" r="2.4" fill="#2a2a28" ${ol(0.6)}/><rect x="109" y="${f - 41}" width="7" height="4" fill="#f0c060" opacity="0.8"/>`) + `<path d="M114,${f - 47} L120,${f - 72}" stroke="${INK}" stroke-width="1"/><circle cx="120" cy="${f - 72}" r="1" fill="#b0302a"/><path d="M90,${f - 28} Q84,${f - 20} 76,${f - 28}" stroke="${INK}" stroke-width="0.8" fill="none"/><ellipse cx="76" cy="${f - 29}" rx="3" ry="2" fill="#2a2a28"/>`);
      p.push(chair(12, f));
      return p.join('');
    },
    clinic(K, w, h, r) {
      const f = h - 12, p = [];
      // cot with sheet and folded blanket
      p.push(K.shadow(16, 82, f + 1) + `<path d="M18,${f} L22,${f - 16} M94,${f} L90,${f - 16} M30,${f} L22,${f - 16} M82,${f} L90,${f - 16}" stroke="#5a5e60" stroke-width="1.6"/>`);
      p.push(`<rect x="16" y="${f - 20}" width="80" height="5" fill="#8a9290" ${ol(0.9)}/><path d="M17,${f - 20} Q56,${f - 24} 95,${f - 20} L96,${f - 12} Q56,${f - 10} 16,${f - 13} Z" fill="#e8e2d2" ${ol(0.8)}/><path d="M50,${f - 21} Q52,${f - 16} 50,${f - 12} M70,${f - 21} Q72,${f - 16} 70,${f - 12}" stroke="#b0a890" stroke-width="0.6" fill="none"/><path d="M18,${f - 21} Q24,${f - 26} 32,${f - 22} Q30,${f - 19} 20,${f - 19} Z" fill="#f2ecdc" ${ol(0.6)}/><path d="M74,${f - 22} L92,${f - 22} L92,${f - 18} L74,${f - 18} Z" fill="#7a3a2e" ${ol(0.6)}/>`);
      // IV stand
      p.push(`<path d="M104,${f} L108,${f - 4} L112,${f} M108,${f - 4} L108,${f - 62} M102,${f - 62} L114,${f - 62}" stroke="${INK}" stroke-width="2"/><path d="M108,${f - 4} L108,${f - 62}" stroke="#8a9290" stroke-width="1"/><path d="M104,${f - 62} L104,${f - 52} Q104,${f - 48} 107,${f - 48} L109,${f - 48} Q112,${f - 48} 112,${f - 52} L112,${f - 62}" fill="#dce8e8" opacity="0.85" ${ol(0.7)}/><rect x="104.6" y="${f - 56}" width="6.8" height="7" fill="#c86a5a" opacity="0.6"/><path d="M108,${f - 48} Q100,${f - 34} 90,${f - 22}" stroke="#a0b0b0" stroke-width="0.6" fill="none"/>`);
      // cabinet with a red cross and supplies on top
      p.push(K.box(w - 40, 22, 26, 34, '#b9b6a8', 3, `<rect x="${w - 34}" y="27" width="14" height="14" fill="#f0eee4" ${ol(0.5)}/><path d="M${w - 27},29 L${w - 27},39 M${w - 32},34 L${w - 22},34" stroke="#b0302a" stroke-width="3"/><path d="M${w - 40},46 L${w - 14},46" stroke="${INK}" stroke-width="0.6"/>`));
      p.push(bottle(w - 37, 21.4, '#8a6a3a', 1) + bottle(w - 30, 21.4, '#dce8e8', 3) + `<rect x="${w - 22}" y="15" width="6" height="6" fill="#f0eee4" ${ol(0.5)}/>`);
      p.push(K.box(w - 44, f - 22, 32, 22, '#9a978a', 3, `<path d="M${w - 44},${f - 11} L${w - 12},${f - 11}" stroke="${INK}" stroke-width="0.7"/><rect x="${w - 31}" y="${f - 18}" width="6" height="1.6" fill="#4a4e50"/><rect x="${w - 31}" y="${f - 7}" width="6" height="1.6" fill="#4a4e50"/>`));
      return p.join('');
    },
    storage(K, w, h, r) {
      const f = h - 12, p = [];
      const sx = 14, sw = 76;
      p.push(K.shadow(sx, sw, f + 1, 0.35));
      for (const x of [sx, sx + sw]) p.push(`<path d="M${x},${f} L${x},18" stroke="${INK}" stroke-width="3.6"/><path d="M${x},${f} L${x},18" stroke="#6a6e70" stroke-width="2.2"/>`);
      for (const sy of [f - 2, f - 34, f - 66]) {
        p.push(`<rect x="${sx}" y="${sy}" width="${sw}" height="3" fill="#5a5e60" ${ol(0.8)}/>`);
        if (sy > 30) { let x = sx + 3; while (x < sx + sw - 14) { const bw = 12 + Math.floor(r() * 10), bh = 10 + Math.floor(r() * 16); if (x + bw > sx + sw - 2) break; const t = r(); p.push(t < 0.5 ? crateF(K, x, sy - bh, bw, bh, ['#8a6440', '#7a5c3a', '#6a5a40'][Math.floor(r() * 3)]) : t < 0.8 ? `<path d="M${x},${sy} Q${x - 1},${sy - bh * 0.8} ${x + bw * 0.3},${sy - bh} L${x + bw * 0.7},${sy - bh} Q${x + bw + 1},${sy - bh * 0.8} ${x + bw},${sy} Z" fill="${K.vg('#a8946a')}" ${ol(0.8)}/><path d="M${x + bw * 0.3},${sy - bh + 2} L${x + bw * 0.7},${sy - bh + 2}" stroke="${INK}" stroke-width="0.8"/>` : jerry(x, sy, '#5a6a3a')); x += bw + 2; } }
      }
      p.push(K.shadow(98, 40, f + 1) + crateF(K, 98, f - 22, 24, 22, '#7a5c3a') + crateF(K, 102, f - 38, 18, 16, '#8a6440') + crateF(K, 124, f - 16, 16, 16, '#6a5a40'));
      return p.join('');
    },
    workshop(K, w, h, r) {
      const f = h - 12, p = [];
      // pegboard with hanging tools
      p.push(`<rect x="18" y="16" width="70" height="40" fill="${K.vg('#8a7458')}" ${ol(1)}/>`);
      for (let y = 20; y < 54; y += 5) for (let x = 22; x < 86; x += 5) p.push(`<circle cx="${x}" cy="${y}" r="0.5" fill="#4a3a2a"/>`);
      p.push(`<path d="M28,22 L28,40 M24,22 L32,22" stroke="${INK}" stroke-width="2.4"/><path d="M28,22 L28,40" stroke="#9aa0a0" stroke-width="1.2"/><path d="M40,22 L40,44 M37,24 Q40,20 43,24" stroke="${INK}" stroke-width="1.8" fill="none"/><path d="M40,30 L40,44" stroke="#8a2a1e" stroke-width="2.6"/><path d="M54,22 L60,46 M60,22 L54,46" stroke="${INK}" stroke-width="1.6"/><circle cx="54" cy="44" r="2" fill="none" stroke="#9aa0a0" stroke-width="1"/><circle cx="60" cy="44" r="2" fill="none" stroke="#9aa0a0" stroke-width="1"/><path d="M70,22 L70,36 L66,40 M76,22 L76,48" stroke="${INK}" stroke-width="1.6" fill="none"/><path d="M74,46 L78,46 L78,50 L74,50 Z" fill="#c8a050" ${ol(0.5)}/>`);
      // workbench with vice and a lamp-lit project
      p.push(K.shadow(14, 116, f + 1, 0.35) + `<path d="M18,${f} L18,${f - 30} M124,${f} L124,${f - 30}" stroke="${INK}" stroke-width="4"/><path d="M18,${f} L18,${f - 30} M124,${f} L124,${f - 30}" stroke="#5a3a24" stroke-width="2.4"/><path d="M18,${f - 10} L124,${f - 10}" stroke="${INK}" stroke-width="2.6"/><path d="M18,${f - 10} L124,${f - 10}" stroke="#6a4a30" stroke-width="1.4"/>`);
      p.push(K.box(14, f - 34, 112, 6, '#7a5434', 5));
      p.push(`<rect x="100" y="${f - 44}" width="12" height="10" fill="${K.vg('#3f5966')}" ${ol(0.8)}/><rect x="96" y="${f - 46}" width="20" height="3" fill="#3f5966" ${ol(0.6)}/><path d="M106,${f - 34} L106,${f - 28} M100,${f - 31} L112,${f - 31}" stroke="${INK}" stroke-width="1.4"/>`);
      p.push(`<path d="M40,${f - 34} L44,${f - 40} L60,${f - 40} L64,${f - 34} Z" fill="#8a9290" ${ol(0.7)}/><circle cx="48" cy="${f - 38}" r="2" fill="#4a4e50"/><path d="M68,${f - 35} l10,-1.2 l0.4,1.4 l-10,1.2 Z" fill="#9aa0a0" ${ol(0.5)}/>`);
      // scrap pile
      p.push(`<path d="M86,${f} L92,${f - 10} L100,${f - 6} L108,${f - 14} L120,${f - 4} L126,${f} Z" fill="#5a5650" ${ol(0.8)}/><path d="M94,${f - 6} L104,${f - 9} M110,${f - 8} L118,${f - 3}" stroke="#8a4a20" stroke-width="1.2"/><circle cx="102" cy="${f - 3}" r="3" fill="none" stroke="#3a3632" stroke-width="1.4"/>`);
      p.push(`<circle cx="132" cy="${f - 18}" r="7" fill="${K.vg('#5a5e60')}" ${ol(1)}/><circle cx="132" cy="${f - 18}" r="2" fill="#2a2a28"/><path d="M132,${f - 11} L132,${f} M126,${f} L138,${f}" stroke="${INK}" stroke-width="2"/>`);
      return p.join('');
    },
    bathhouse(K, w, h, r) {
      const f = h - 12, p = [];
      // clawfoot tub
      p.push(K.shadow(22, 92, f + 1, 0.35));
      p.push(`<path d="M20,${f - 30} L116,${f - 30} Q116,${f - 6} 98,${f - 6} L38,${f - 6} Q20,${f - 6} 20,${f - 30} Z" fill="${K.vg('#e8e2d2')}" ${ol(1.2)}/><path d="M18,${f - 32} L118,${f - 32} L118,${f - 29} L18,${f - 29} Z" fill="#f2ecdc" ${ol(0.9)}/><path d="M24,${f - 26} Q30,${f - 12} 44,${f - 9}" stroke="#fff" stroke-width="1.2" opacity="0.6" fill="none"/>`);
      for (const x of [34, 100]) p.push(`<path d="M${x},${f - 7} Q${x - 2},${f - 1} ${x - 5},${f} L${x + 3},${f} Q${x + 2},${f - 3} ${x + 4},${f - 7} Z" fill="#c8a050" ${ol(0.7)}/>`);
      p.push(`<path d="M22,${f - 31} Q68,${f - 34} 114,${f - 31}" stroke="#9fd0e0" stroke-width="2" opacity="0.7" fill="none"/><path d="M110,${f - 32} L110,${f - 46} L102,${f - 46}" stroke="${INK}" stroke-width="2.6" fill="none"/><path d="M110,${f - 32} L110,${f - 46} L102,${f - 46}" stroke="#c8a050" stroke-width="1.4" fill="none"/>`);
      // wooden barrel tub
      const bx = 140;
      p.push(K.shadow(bx, 52, f + 1) + `<path d="M${bx},${f - 30} L${bx + 52},${f - 30} L${bx + 48},${f} L${bx + 4},${f} Z" fill="${K.hg('#8a6440')}" ${ol(1.2)}/>${K.plankLines(bx + 2, f - 30, 48, 30, 6, true)}<path d="M${bx + 1},${f - 24} L${bx + 51},${f - 24} M${bx + 3},${f - 6} L${bx + 49},${f - 6}" stroke="#3a3632" stroke-width="2"/><ellipse cx="${bx + 26}" cy="${f - 30}" rx="26" ry="3" fill="#6fa0b0" ${ol(1)}/>`);
      // boiler and towel line
      const ox = w - 66;
      p.push(K.shadow(ox, 40, f + 1, 0.4) + `<rect x="${ox}" y="${f - 64}" width="36" height="64" rx="8" fill="${K.hg('#7a4a30')}" ${ol(1.2)}/><rect x="${ox + 10}" y="${f - 20}" width="16" height="12" rx="2" fill="#2a1a10" ${ol(0.8)}/><rect x="${ox + 12}" y="${f - 17}" width="12" height="7" fill="#f08a30" opacity="0.85"/><path d="M${ox + 18},${f - 64} L${ox + 18},14" stroke="${INK}" stroke-width="5"/><path d="M${ox + 18},${f - 64} L${ox + 18},14" stroke="#5a504a" stroke-width="3"/><circle cx="${ox + 18}" cy="${f - 46}" r="5" fill="#e8e0c8" ${ol(0.8)}/><path d="M${ox + 18},${f - 46} l3,-2" stroke="#b0302a" stroke-width="0.8"/>`);
      p.push(`<path d="M20,30 Q${w / 2 - 30},40 ${w - 80},30" stroke="#3a3632" stroke-width="0.8" fill="none"/>`);
      for (let i = 0; i < 4; i++) { const tx = 40 + i * 40, ty = 33 + Math.sin(i / 3 * Math.PI) * 6; p.push(`<path d="M${tx},${ty} L${tx + 16},${ty + 0.6} L${tx + 15},${ty + 20} Q${tx + 8},${ty + 22} ${tx + 1},${ty + 19} Z" fill="${['#e8e2d2', '#9fbcc8', '#d8b8a0', '#e8e2d2'][i]}" ${ol(0.7)}/><path d="M${tx + 2},${ty + 15} L${tx + 14},${ty + 15.4}" stroke="#a8432f" stroke-width="1" opacity="0.6"/>`); }
      return p.join('');
    },
    checkpoint(K, w, h, r) {
      const f = h - 12, p = [];
      // guard booth with a window and a tin roof
      p.push(K.shadow(14, 40, f + 1, 0.4) + K.box(16, f - 56, 34, 56, '#5e4e40', 5, K.plankLines(16, f - 56, 34, 56, 6, true) + `<rect x="22" y="${f - 46}" width="22" height="14" fill="#1e2a30" ${ol(0.9)}/><path d="M33,${f - 46} L33,${f - 32}" stroke="${INK}" stroke-width="0.8"/><rect x="20" y="${f - 30}" width="26" height="3" fill="#7a5a38" ${ol(0.6)}/>`));
      p.push(`<path d="M10,${f - 56} L58,${f - 56} L54,${f - 64} L14,${f - 64} Z" fill="${K.vg('#6a6a62')}" ${ol(1)}/>`);
      // boom barrier
      p.push(`<rect x="56" y="${f - 30}" width="10" height="30" fill="${K.hg('#3a3632')}" ${ol(1)}/><circle cx="61" cy="${f - 26}" r="3" fill="#8a9290" ${ol(0.6)}/>`);
      p.push(`<g transform="rotate(-4 61 ${f - 26})"><rect x="61" y="${f - 29}" width="${w - 72}" height="6" fill="#e8e2d2" ${ol(1)}/>${Array.from({ length: Math.floor((w - 72) / 12) }, (_, k) => `<rect x="${63 + k * 12}" y="${f - 29}" width="6" height="6" fill="#b0302a"/>`).join('')}<rect x="61" y="${f - 29}" width="${w - 72}" height="6" fill="none" ${ol(1)}/></g>`);
      p.push(`<rect x="${w - 14}" y="${f - 26}" width="4" height="26" fill="#3a3632" ${ol(0.7)}/>`);
      p.push(`<rect x="72" y="${f - 64}" width="44" height="18" fill="#e8dcc0" ${ol(1)}/><path d="M76,${f - 58} L112,${f - 58} M76,${f - 52} L102,${f - 52}" stroke="#2a1a10" stroke-width="2"/><path d="M80,${f - 46} L80,${f - 30} M108,${f - 46} L108,${f - 30}" stroke="#5a4030" stroke-width="1.6"/>`);
      return p.join('');
    },
    turret_nest(K, w, h, r) {
      const f = h - 12, p = [];
      for (let row = 0; row < 3; row++) for (let i = 0; i < 6 - row; i++) p.push(`<ellipse cx="${30 + row * 9 + i * 18}" cy="${f - 4 - row * 8}" rx="10" ry="4.6" fill="${['#a8946a', '#9a8660', '#b49e72', '#8e7c58'][(i + row) % 4]}" ${ol(0.8)}/><path d="M${24 + row * 9 + i * 18},${f - 6 - row * 8} q6,-2 12,0" stroke="#f2e2b8" stroke-width="0.6" opacity="0.5" fill="none"/>`);
      // tripod mount, gun body, ammo box, shield plate
      p.push(`<path d="M72,${f - 26} L60,${f - 18} M72,${f - 26} L86,${f - 18} M72,${f - 26} L72,${f - 36}" stroke="${INK}" stroke-width="3"/><path d="M72,${f - 26} L60,${f - 18} M72,${f - 26} L86,${f - 18} M72,${f - 26} L72,${f - 36}" stroke="#5a5e60" stroke-width="1.6"/>`);
      p.push(`<path d="M58,${f - 54} L84,${f - 58} L86,${f - 38} L60,${f - 34} Z" fill="${K.vg('#5b6266')}" ${ol(1)}/><path d="M70,${f - 48} L76,${f - 49}" stroke="#2a2a28" stroke-width="2"/>`);
      p.push(`<rect x="62" y="${f - 44}" width="26" height="9" rx="2" fill="${K.vg('#3a3f40')}" ${ol(1)}/><path d="M88,${f - 41} L128,${f - 50}" stroke="${INK}" stroke-width="4.4"/><path d="M88,${f - 41} L128,${f - 50}" stroke="#2b2f31" stroke-width="2.8"/><rect x="124" y="${f - 52.6}" width="6" height="4.6" fill="#1a1c1d" ${ol(0.6)} transform="rotate(-12 127 ${f - 50})"/>`);
      p.push(K.box(52, f - 36, 10, 7, '#5a6a3a', 2) + `<path d="M62,${f - 34} Q66,${f - 30} 66,${f - 36}" stroke="#c8a050" stroke-width="1.4" fill="none"/>`);
      return p.join('');
    },
    purifier(K, w, h, r) {
      const f = h - 12, p = [];
      p.push(`<path d="M8,24 L140,24" stroke="${INK}" stroke-width="5"/><path d="M8,24 L140,24" stroke="#4f6f7a" stroke-width="3.4"/>`);
      p.push(K.shadow(20, 36, f + 1, 0.4) + `<rect x="20" y="${f - 66}" width="34" height="66" rx="10" fill="${K.hg('#4f6f7a')}" ${ol(1.2)}/><path d="M37,${f - 66} L37,24" stroke="${INK}" stroke-width="3"/><path d="M37,${f - 66} L37,24" stroke="#4f6f7a" stroke-width="1.6"/>`);
      for (let k = 0; k < 3; k++) p.push(`<path d="M20,${f - 50 + k * 18} L54,${f - 50 + k * 18}" stroke="#2f4550" stroke-width="1.4"/>`);
      // glass column of clean water with rising bubbles
      p.push(`<rect x="66" y="${f - 58}" width="18" height="58" rx="3" fill="#cfe8f0" opacity="0.4" ${ol(1)}/><rect x="68" y="${f - 40}" width="14" height="38" fill="#7fc8e0" opacity="0.75"/><rect x="64" y="${f - 62}" width="22" height="5" fill="#3f5966" ${ol(0.8)}/><rect x="64" y="${f - 4}" width="22" height="4" fill="#3f5966" ${ol(0.8)}/>`);
      for (let k = 0; k < 6; k++) p.push(`<circle cx="${71 + (k * 5) % 9}" cy="${f - 8 - k * 5}" r="${0.8 + (k % 3) * 0.4}" fill="#f0fbff" opacity="0.8"/>`);
      p.push(`<path d="M54,${f - 30} L66,${f - 30} M84,${f - 20} L98,${f - 20}" stroke="${INK}" stroke-width="5"/><path d="M54,${f - 30} L66,${f - 30} M84,${f - 20} L98,${f - 20}" stroke="#4f6f7a" stroke-width="3.4"/>`);
      p.push(K.shadow(96, 34, f + 1) + K.box(98, f - 44, 30, 44, '#6a8a94', 4, `<rect x="104" y="${f - 36}" width="18" height="10" fill="#1a2a30" ${ol(0.6)}/><path d="M106,${f - 31} L109,${f - 31} L111,${f - 34} L113,${f - 28} L115,${f - 31} L120,${f - 31}" stroke="#7fe0a0" stroke-width="0.8" fill="none"/><circle cx="108" cy="${f - 18}" r="2" fill="#7fd0a0" ${ol(0.5)}/><circle cx="116" cy="${f - 18}" r="2" fill="#b0302a" ${ol(0.5)}/>`));
      return p.join('');
    },
    cold_storage(K, w, h, r) {
      const f = h - 12, p = [];
      for (const x of [18, 76]) {
        p.push(K.shadow(x, 50, f + 1, 0.4) + K.box(x, f - 72, 50, 72, '#8a9a9c', 5, `<path d="M${x},${f - 30} L${x + 50},${f - 30}" stroke="${INK}" stroke-width="0.8"/><rect x="${x + 40}" y="${f - 56}" width="4" height="16" rx="1.6" fill="${K.hg('#c8ccc6')}" ${ol(0.7)}/><rect x="${x + 40}" y="${f - 24}" width="4" height="12" rx="1.6" fill="${K.hg('#c8ccc6')}" ${ol(0.7)}/><rect x="${x + 6}" y="${f - 66}" width="16" height="6" fill="#e8e2d2" ${ol(0.5)}/><path d="M${x + 8},${f - 63} L${x + 20},${f - 63}" stroke="#2a3a5a" stroke-width="0.8"/>`));
        p.push(`<path d="M${x + 2},${f - 71} Q${x + 10},${f - 66} ${x + 18},${f - 70} Q${x + 30},${f - 65} ${x + 48},${f - 70}" stroke="#eef6f8" stroke-width="2" fill="none" opacity="0.8"/><path d="M${x + 1},${f - 71} L${x + 1},${f - 50}" stroke="#eef6f8" stroke-width="1.4" opacity="0.6"/>`);
      }
      return p.join('');
    },
    armory(K, w, h, r) {
      const f = h - 12, p = [];
      // wall rack of rifles
      p.push(`<rect x="18" y="18" width="78" height="6" fill="${K.vg('#5a3a24')}" ${ol(0.9)}/><rect x="18" y="66" width="78" height="6" fill="${K.vg('#5a3a24')}" ${ol(0.9)}/>`);
      for (let i = 0; i < 5; i++) { const x = 26 + i * 15; p.push(`<path d="M${x},20 L${x},70" stroke="${INK}" stroke-width="3.4"/><path d="M${x},20 L${x},48" stroke="#2e2c2a" stroke-width="2"/><path d="M${x},48 L${x},70" stroke="#7a5030" stroke-width="2.6"/><path d="M${x - 1},52 L${x - 4},62 L${x + 1},64" fill="#6a4428" ${ol(0.6)}/><rect x="${x + 1}" y="40" width="2.6" height="6" fill="#2b2a28" ${ol(0.4)}/>`); }
      // ammo crates and a bench
      p.push(K.shadow(14, 120, f + 1, 0.35) + K.box(14, f - 28, 86, 5, '#6b4428', 4) + `<path d="M18,${f} L18,${f - 23} M96,${f} L96,${f - 23}" stroke="${INK}" stroke-width="3.6"/><path d="M18,${f} L18,${f - 23} M96,${f} L96,${f - 23}" stroke="#5a3a24" stroke-width="2.2"/>`);
      p.push(`<path d="M30,${f - 29} l18,-3 l2,2 l-18,3 Z" fill="#2e2c2a" ${ol(0.6)}/><rect x="60" y="${f - 36}" width="10" height="7" fill="#c8a050" ${ol(0.6)}/><rect x="74" y="${f - 34}" width="6" height="5" fill="#8a2a1e" ${ol(0.5)}/>`);
      p.push(K.box(w - 50, f - 16, 34, 16, '#4f6650', 4, `<rect x="${w - 44}" y="${f - 11}" width="12" height="6" fill="#d8c8a0" ${ol(0.5)}/><path d="M${w - 42},${f - 8} L${w - 34},${f - 8}" stroke="${INK}" stroke-width="0.8"/>`) + K.box(w - 46, f - 30, 26, 14, '#5a6a3a', 3));
      p.push(K.box(w - 50, 26, 30, 38, '#6b3f3f', 3, `<path d="M${w - 35},26 L${w - 35},64" stroke="${INK}" stroke-width="0.8"/><circle cx="${w - 37}" cy="45" r="1" fill="#c8a050"/><circle cx="${w - 33}" cy="45" r="1" fill="#c8a050"/>`));
      return p.join('');
    },
    messenger_post(K, w, h, r) {
      const f = h - 12, p = [];
      // pigeon coops stacked on the wall
      for (let i = 0; i < 6; i++) {
        const x = 26 + (i % 3) * 22, y = 30 + Math.floor(i / 3) * 20;
        p.push(K.box(x, y, 20, 17, '#6a4a30', 3, `<rect x="${x + 3}" y="${y + 4}" width="14" height="10" fill="#1a120c"/>${[0, 1, 2].map((k) => `<path d="M${x + 3 + k * 4.6},${y + 4} L${x + 3 + k * 4.6},${y + 14}" stroke="#8a6a46" stroke-width="0.8"/>`).join('')}`));
        if (i % 2 === 0) p.push(`<path d="M${x + 6},${y + 13} Q${x + 7},${y + 8} ${x + 11},${y + 9} Q${x + 13},${y + 9} ${x + 13},${y + 11} L${x + 15},${y + 11} L${x + 13},${y + 12} Q${x + 11},${y + 14} ${x + 6},${y + 13} Z" fill="#a8a8a0" ${ol(0.5)}/><circle cx="${x + 12}" cy="${y + 10}" r="0.5" fill="${INK}"/>`);
      }
      // writing desk with letters, map pinned to the wall
      p.push(K.shadow(20, 70, f + 1, 0.35) + K.box(22, f - 30, 66, 5, '#6d5a40', 4) + `<path d="M26,${f} L26,${f - 25} M84,${f} L84,${f - 25}" stroke="${INK}" stroke-width="3.4"/><path d="M26,${f} L26,${f - 25} M84,${f} L84,${f - 25}" stroke="#5a4030" stroke-width="2"/>`);
      for (let k = 0; k < 4; k++) p.push(`<rect x="${32 + k * 9}" y="${f - 33 - k * 0.6}" width="10" height="3" fill="#e8dcc0" ${ol(0.4)} transform="rotate(${-4 + k * 3} ${37 + k * 9} ${f - 32})"/>`);
      p.push(`<path d="M70,${f - 31} L74,${f - 44}" stroke="#2a2a28" stroke-width="0.8"/><path d="M74,${f - 44} q2,-3 3,-6 q-3,2 -3,6" fill="#e8e2d2" ${ol(0.4)}/>`);
      p.push(`<rect x="96" y="26" width="34" height="24" fill="#d8c8a0" ${ol(0.9)}/><path d="M100,44 Q108,32 116,38 T128,30" stroke="#6a5a3a" stroke-width="0.7" fill="none"/><circle cx="104" cy="40" r="1.3" fill="#b0302a"/><circle cx="124" cy="32" r="1.3" fill="#b0302a"/><circle cx="114" cy="36" r="1.3" fill="#3f5966"/>`);
      p.push(K.shadow(100, 30, f + 1) + crateF(K, 102, f - 14, 22, 14, '#7a5c3a') + `<path d="M${106},${f - 15} q4,-6 12,-2" stroke="#a8946a" stroke-width="2" fill="none"/>`);
      return p.join('');
    },
    meeting_hall(K, w, h, r) {
      const f = h - 12, p = [];
      // banners of the camps that come here to talk
      const cols = ['#a8432f', '#3f5966', '#6a6a3a', '#5a3a6a', '#8a6a3a'];
      for (let i = 0; i < 5; i++) { const x = 30 + i * ((w - 60) / 4); p.push(`<path d="M${x - 10},16 L${x + 10},16 L${x + 10},44 L${x},38 L${x - 10},44 Z" fill="${K.vg(cols[i])}" ${ol(0.9)}/><path d="M${x - 12},16 L${x + 12},16" stroke="${INK}" stroke-width="1.8"/><circle cx="${x}" cy="26" r="3.4" fill="none" stroke="#e8dcc0" stroke-width="0.9" opacity="0.8"/>`); }
      // long table and chairs
      const tx = 40, tw = w - 80;
      p.push(K.shadow(tx, tw, f + 1, 0.35) + K.box(tx, f - 26, tw, 6, '#6b4428', 6) + `<path d="M${tx + 6},${f} L${tx + 6},${f - 20} M${tx + tw - 6},${f} L${tx + tw - 6},${f - 20}" stroke="${INK}" stroke-width="4"/><path d="M${tx + 6},${f} L${tx + 6},${f - 20} M${tx + tw - 6},${f} L${tx + tw - 6},${f - 20}" stroke="#5a3a24" stroke-width="2.4"/>`);
      p.push(`<path d="M${tx + 10},${f - 26} L${tx + tw - 10},${f - 26}" stroke="#d8ccb0" stroke-width="1.2" opacity="0.6"/>`);
      for (let i = 0; i < 4; i++) p.push(mug(tx + 24 + i * (tw - 48) / 3, f - 26));
      p.push(oilLamp(tx + tw / 2, f - 26));
      p.push(chair(tx - 14, f) + chair(tx + tw + 14, f, '#5a3e26', true));
      return p.join('');
    },
    informants(K, w, h, r) {
      const f = h - 12, p = [];
      // cork board covered in notes, photos and red string
      p.push(`<rect x="22" y="16" width="104" height="46" fill="${K.vg('#9a7a50')}" ${ol(1.2)}/><rect x="20" y="14" width="108" height="50" fill="none" stroke="#5a3a24" stroke-width="3"/>`);
      const pins = [];
      for (let i = 0; i < 8; i++) { const x = 30 + (i % 4) * 24 + r() * 6, y = 22 + Math.floor(i / 4) * 20 + r() * 4; pins.push([x + 5, y + 1]); p.push(`<rect x="${x}" y="${y}" width="${i % 3 ? 12 : 10}" height="${i % 3 ? 9 : 12}" fill="${i % 3 ? '#e8dcc0' : '#c8bca0'}" ${ol(0.5)} transform="rotate(${(r() - 0.5) * 12} ${x + 5} ${y + 5})"/>`); }
      p.push(`<path d="M${pins.map((q) => q.join(',')).join(' L')}" stroke="#b0302a" stroke-width="0.7" fill="none"/>`);
      for (const [x, y] of pins) p.push(`<circle cx="${x}" cy="${y}" r="1.1" fill="#b0302a" ${ol(0.3)}/>`);
      // desk with radio and a lamp
      p.push(K.shadow(18, 112, f + 1, 0.35) + K.box(18, f - 30, 112, 5, '#3a3027', 4) + `<path d="M22,${f} L22,${f - 25} M126,${f} L126,${f - 25}" stroke="${INK}" stroke-width="3.4"/><path d="M22,${f} L22,${f - 25} M126,${f} L126,${f - 25}" stroke="#4a3a2a" stroke-width="2"/>`);
      p.push(K.box(30, f - 44, 28, 14, '#4a4e44', 3, `<circle cx="38" cy="${f - 37}" r="3" fill="#2a2a28"/><rect x="45" y="${f - 41}" width="10" height="4" fill="#f0c060" opacity="0.8"/>`) + `<path d="M56,${f - 46} L62,${f - 70}" stroke="${INK}" stroke-width="1"/>`);
      p.push(`<path d="M100,${f - 31} L104,${f - 46} L96,${f - 52}" stroke="${INK}" stroke-width="1.6" fill="none"/><path d="M90,${f - 52} L100,${f - 58} L104,${f - 52} Z" fill="#3f5966" ${ol(0.7)}/><path d="M72,${f - 31} L88,${f - 32}" stroke="#e8dcc0" stroke-width="2"/>`);
      p.push(chair(66, f));
      return p.join('');
    },
    vault(K, w, h, r) {
      const f = h - 12, p = [];
      // the big map screen (the red dots are drawn live on top)
      p.push(`<rect x="12" y="16" width="${w - 24}" height="50" rx="3" fill="#0e1612" ${ol(1.4)}/><rect x="16" y="20" width="${w - 32}" height="42" fill="#13241c"/>`);
      p.push(`<path d="M22,52 Q40,34 60,40 T${w - 30},30" stroke="#2f6a4a" stroke-width="0.8" fill="none"/><path d="M30,26 L50,30 L46,44 L26,48 Z M${w - 60},34 L${w - 34},28 L${w - 30},50 L${w - 58},54 Z" fill="none" stroke="#2f6a4a" stroke-width="0.7"/>`);
      for (let y = 22; y < 62; y += 3) p.push(`<path d="M16,${y} L${w - 16},${y}" stroke="#000" stroke-width="0.5" opacity="0.25"/>`);
      p.push(`<rect x="16" y="20" width="${w - 32}" height="2" fill="#7fd0a0" opacity="0.8"/>`);
      // consoles with switches and small screens
      p.push(K.shadow(18, w - 36, f + 1, 0.4) + K.box(18, f - 24, w - 36, 24, '#3a3f3c', 5, Array.from({ length: Math.floor((w - 44) / 10) }, (_, k) => `<rect x="${22 + k * 10}" y="${f - 18}" width="6" height="3" fill="${['#7fd0a0', '#f0c060', '#b0302a'][k % 3]}" opacity="0.8"/><path d="M${25 + k * 10},${f - 10} l0,-3" stroke="#c8ccc6" stroke-width="1.2"/>`).join('')));
      p.push(`<path d="M18,${f - 24} L23,${f - 32} L${w - 13},${f - 32} L${w - 18},${f - 24} Z" fill="${K.vg('#4a504c')}" ${ol(0.9)}/>`);
      return p.join('');
    },
    sealed_door(K, w, h, r) {
      const p = [], cx = w / 2, cy = h / 2 + 4, R = Math.min(42, h / 2 - 12);
      p.push(`<rect x="6" y="6" width="${w - 12}" height="${h - 12}" fill="#16191d"/>`);
      // hazard frame
      p.push(`<defs><pattern id="hz" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="4" height="8" fill="#c89020"/><rect x="4" width="4" height="8" fill="#1e1e1c"/></pattern></defs><circle cx="${cx}" cy="${cy}" r="${R + 8}" fill="url(#hz)" ${ol(1.4)}/>`);
      p.push(`<circle cx="${cx}" cy="${cy}" r="${R}" fill="${K.vg('#3a4048')}" ${ol(1.6)}/><circle cx="${cx}" cy="${cy}" r="${R - 6}" fill="none" stroke="#22272c" stroke-width="2"/>`);
      for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; p.push(`<circle cx="${cx + Math.cos(a) * (R - 3)}" cy="${cy + Math.sin(a) * (R - 3)}" r="1.6" fill="#8a9290" ${ol(0.5)}/>`); }
      p.push(`<circle cx="${cx}" cy="${cy}" r="12" fill="none" stroke="${INK}" stroke-width="4.4"/><circle cx="${cx}" cy="${cy}" r="12" fill="none" stroke="#9a6b2f" stroke-width="3"/>`);
      for (let k = 0; k < 3; k++) { const a = k / 3 * Math.PI * 2; p.push(`<path d="M${cx},${cy} L${cx + Math.cos(a) * 18},${cy + Math.sin(a) * 18}" stroke="${INK}" stroke-width="3.6"/><path d="M${cx},${cy} L${cx + Math.cos(a) * 18},${cy + Math.sin(a) * 18}" stroke="#9a6b2f" stroke-width="2"/>`); }
      p.push(`<circle cx="${cx}" cy="${cy}" r="3.6" fill="#c8a050" ${ol(0.8)}/><path d="M${cx - R + 8},${cy - R / 2} Q${cx - R / 2},${cy - R + 4} ${cx - 4},${cy - R + 8}" stroke="#fff" stroke-width="1.2" opacity="0.15" fill="none"/>`);
      p.push(`<rect x="14" y="34" width="14" height="22" rx="2" fill="${K.vg('#4a5a52')}" ${ol(1)}/><circle cx="21" cy="41" r="3" fill="#2a2e2c" ${ol(0.5)}/><rect x="17" y="48" width="8" height="1.4" fill="#2a2e2c"/><rect x="17" y="51" width="8" height="1.4" fill="#2a2e2c"/><circle cx="25" cy="37" r="1" fill="#7fd0a0"/>`);
      return p.join('');
    },
  };

  // ======================================================================
  // Exteriors for buildings above ground: roof, siding, boardwalk and signs around the cutaway.
  // Box is (w + 40) x (h + 80); the room itself sits at (20, 80).
  // ======================================================================
  const OUTDOOR = new Set(['wall', 'watchtower', 'checkpoint', 'turret_nest']);
  function exteriorSVG(type, w, h, seed, broken, nl = false, nr = false) {
    const K = kit(seed), r = rng(seed % 97 + 3), X0 = 20, Y0 = 80, W = w + 40, H = h + 80;
    const p = [];
    const R = X0 + w, B = Y0 + h, cx = X0 + w / 2;
    const plank = (x, y, ww, hh, c, horiz = true) => `<rect x="${x}" y="${y}" width="${ww}" height="${hh}" fill="${K.vg(c)}" ${ol(1)}/>` + K.plankLines(x, y, ww, hh, horiz ? 6 : 5, !horiz);
    const shingles = (pts, c) => {
      // clip a field of staggered shingles to the roof polygon
      const id = 'cl' + Math.floor(r() * 1e6);
      let rows = '';
      for (let y = 0; y < Y0 + 4; y += 5) for (let x = -10 + ((y / 5) % 2) * 4; x < W + 10; x += 8) { const t = r(); rows += `<rect x="${x}" y="${y}" width="7.4" height="5" fill="${shade(c, 0.86 + t * 0.3)}" stroke="${shade(c, 0.55)}" stroke-width="0.5"/>`; }
      return `<clipPath id="${id}"><polygon points="${pts}"/></clipPath><g clip-path="url(#${id})">${rows}</g><polygon points="${pts}" fill="none" ${ol(1.2)}/>`;
    };
    const tin = (pts, c, vertical = true) => {
      const id = 'ct' + Math.floor(r() * 1e6);
      let ribs = '';
      for (let x = -10; x < W + 10; x += 4) ribs += `<rect x="${x}" y="0" width="2" height="${Y0 + 6}" fill="${shade(c, 1.18)}"/><rect x="${x + 2}" y="0" width="2" height="${Y0 + 6}" fill="${shade(c, 0.8)}"/>`;
      let rust = '';
      for (let i = 0; i < 5; i++) rust += `<ellipse cx="${10 + r() * (W - 20)}" cy="${20 + r() * 50}" rx="${4 + r() * 8}" ry="${3 + r() * 5}" fill="#8a4a20" opacity="0.45"/>`;
      return `<clipPath id="${id}"><polygon points="${pts}"/></clipPath><g clip-path="url(#${id})"><rect width="${W}" height="${Y0 + 6}" fill="${c}"/>${vertical ? ribs : ''}${rust}</g><polygon points="${pts}" fill="none" ${ol(1.2)}/>`;
    };
    const lantern = (x, y) => `<path d="M${x},${y - 6} L${x},${y}" stroke="${INK}" stroke-width="0.8"/><rect x="${x - 2.6}" y="${y}" width="5.2" height="7" rx="1" fill="#f0b050" ${ol(0.8)}/><path d="M${x - 3.4},${y} L${x + 3.4},${y} M${x - 2.6},${y + 7} L${x + 2.6},${y + 7}" stroke="${INK}" stroke-width="1.2"/>`;
    const hole = (x, y, s2) => broken ? `<polygon points="${x},${y} ${x + s2},${y - s2 * 0.3} ${x + s2 * 1.4},${y + s2 * 0.5} ${x + s2 * 0.6},${y + s2} ${x - s2 * 0.2},${y + s2 * 0.6}" fill="#1a120c" ${ol(0.8)}/><path d="M${x + s2 * 0.2},${y + s2 * 0.2} l${s2 * 0.8},${s2 * 0.5}" stroke="#6a4a30" stroke-width="1.6"/>` : '';
    // roof by building type (clipped on sides that touch a neighbour)
    p.push(`<clipPath id="own"><rect x="${nl ? X0 - 2 : 0}" y="0" width="${(nr ? R + 2 : W) - (nl ? X0 - 2 : 0)}" height="${H}"/></clipPath><g clip-path="url(#own)">`);
    if (type === 'guest_room') {
      const pts = `${X0 - 16},${Y0 + 2} ${cx},${Y0 - 50} ${R + 16},${Y0 + 2}`;
      p.push(`<rect x="${R - 70}" y="${Y0 - 58}" width="16" height="40" fill="${K.vg('#7a4a36')}" ${ol(1)}/>${K.plankLines(R - 70, Y0 - 58, 16, 40, 5)}<rect x="${R - 73}" y="${Y0 - 62}" width="22" height="5" fill="#4a3a30" ${ol(0.9)}/>`);
      p.push(shingles(pts, broken ? '#4a3a32' : '#5a4038'));
      p.push(`<path d="M${X0 - 18},${Y0 + 3} L${cx},${Y0 - 52} L${R + 18},${Y0 + 3}" fill="none" stroke="#3a2a20" stroke-width="3.2"/><path d="M${X0 - 18},${Y0 + 3} L${cx},${Y0 - 52} L${R + 18},${Y0 + 3}" fill="none" stroke="#8a6a46" stroke-width="1.4"/>`);
      p.push(`<polygon points="${cx - 18},${Y0 - 6} ${cx},${Y0 - 30} ${cx + 18},${Y0 - 6}" fill="${K.vg('#7a5a3a')}" ${ol(1)}/><rect x="${cx - 8}" y="${Y0 - 20}" width="16" height="12" fill="#f0b050" ${ol(1)}/><path d="M${cx},${Y0 - 20} L${cx},${Y0 - 8} M${cx - 8},${Y0 - 14} L${cx + 8},${Y0 - 14}" stroke="${INK}" stroke-width="1"/>`);
      p.push(hole(X0 + 40, Y0 - 16, 12));
      // VACANCY board hanging from the eave
      p.push(`<path d="M${X0 + 2},${Y0 + 4} L${X0 + 2},${Y0 + 10} M${X0 + 46},${Y0 + 4} L${X0 + 46},${Y0 + 10}" stroke="${INK}" stroke-width="0.8"/><rect x="${X0 - 2}" y="${Y0 + 10}" width="52" height="12" fill="#e8dcc0" ${ol(1)}/><text x="${X0 + 24}" y="${Y0 + 19.4}" text-anchor="middle" font-family="Georgia, serif" font-size="8" font-weight="700" fill="#a8432f" letter-spacing="0.8">VACANCY</text>`);
    } else if (type === 'bar') {
      // a western false front: a tall stepped facade above a low roof
      p.push(tin(`${X0 - 10},${Y0 + 2} ${X0 - 10},${Y0 - 10} ${R + 10},${Y0 - 10} ${R + 10},${Y0 + 2}`, '#6a6a62'));
      const fx0 = X0 + 14, fx1 = R - 14;
      p.push(`<polygon points="${fx0},${Y0 + 2} ${fx0},${Y0 - 40} ${cx - 40},${Y0 - 40} ${cx - 40},${Y0 - 54} ${cx + 40},${Y0 - 54} ${cx + 40},${Y0 - 40} ${fx1},${Y0 - 40} ${fx1},${Y0 + 2}" fill="${K.vg('#7a5a3e')}" ${ol(1.2)}/>`);
      for (let y = Y0 - 50; y < Y0; y += 6) p.push(`<path d="M${y < Y0 - 40 ? cx - 40 : fx0},${y} L${y < Y0 - 40 ? cx + 40 : fx1},${y}" stroke="#3a2a1c" stroke-width="0.6" opacity="0.6"/>`);
      p.push(`<rect x="${fx0 - 2}" y="${Y0 - 43}" width="${fx1 - fx0 + 4}" height="4" fill="#4a3424" ${ol(0.8)}/><rect x="${cx - 42}" y="${Y0 - 57}" width="84" height="4" fill="#4a3424" ${ol(0.8)}/>`);
      p.push(`<text x="${cx}" y="${Y0 - 20}" text-anchor="middle" font-family="Georgia, serif" font-size="17" font-weight="700" fill="#e8dcc0" opacity="0.82" letter-spacing="3">SALOON</text><text x="${cx}" y="${Y0 - 6}" text-anchor="middle" font-family="Georgia, serif" font-size="7" fill="#e8dcc0" opacity="0.65" letter-spacing="2">COLD DRINKS · HOT FOOD</text>`);
      // water tank on stilts at the back
      p.push(`<path d="M${R - 34},${Y0 - 10} L${R - 30},${Y0 - 42} M${R - 6},${Y0 - 10} L${R - 10},${Y0 - 42} M${R - 32},${Y0 - 24} L${R - 8},${Y0 - 34}" stroke="${INK}" stroke-width="2.4"/><rect x="${R - 36}" y="${Y0 - 70}" width="32" height="30" rx="4" fill="${K.hg('#6a5a4a')}" ${ol(1.1)}/><path d="M${R - 36},${Y0 - 62} L${R - 4},${Y0 - 62} M${R - 36},${Y0 - 48} L${R - 4},${Y0 - 48}" stroke="#3a3632" stroke-width="1.4"/><path d="M${R - 38},${Y0 - 70} Q${R - 20},${Y0 - 80} ${R - 2},${Y0 - 70} Z" fill="#5a4a3a" ${ol(1)}/>`);
      p.push(hole(fx0 + 20, Y0 - 34, 10));
    } else if (type === 'entertainment') {
      const pts = [];
      for (let i = 0; i <= 24; i++) { const t = i / 24, x = X0 - 12 + t * (w + 24), y = Y0 + 2 - Math.sin(t * Math.PI) * 44; pts.push(`${x},${y}`); }
      p.push(tin(pts.join(' '), '#7a6a5a'));
      for (let i = 1; i < 24; i++) { const t = i / 24, x = X0 - 12 + t * (w + 24), y = Y0 + 2 - Math.sin(t * Math.PI) * 44 - 2; p.push(`<circle cx="${x}" cy="${y}" r="2" fill="${i % 3 ? '#f0c060' : '#e07a5f'}" ${ol(0.5)}/>`); }
      p.push(`<rect x="${cx - 46}" y="${Y0 - 66}" width="92" height="20" fill="#2a1e14" ${ol(1.2)}/><text x="${cx}" y="${Y0 - 51.6}" text-anchor="middle" font-family="Georgia, serif" font-size="12" font-weight="700" fill="#f0c060" letter-spacing="2">CARDS · SHOWS</text><path d="M${cx - 30},${Y0 - 46} L${cx - 30},${Y0 - 40} M${cx + 30},${Y0 - 46} L${cx + 30},${Y0 - 40}" stroke="${INK}" stroke-width="1.6"/>`);
      p.push(hole(X0 + 60, Y0 - 30, 11));
    } else if (type === 'bathhouse') {
      p.push(tin(`${X0 - 14},${Y0 + 2} ${X0 - 14},${Y0 - 12} ${R + 14},${Y0 - 38} ${R + 14},${Y0 + 2}`, '#6a7072'));
      p.push(`<path d="M${X0 + 40},${Y0 - 16} L${X0 + 44},${Y0 - 40} M${X0 + 84},${Y0 - 22} L${X0 + 80},${Y0 - 40}" stroke="${INK}" stroke-width="2.4"/><rect x="${X0 + 34}" y="${Y0 - 66}" width="56" height="28" rx="12" fill="${K.hg('#8a4a30')}" ${ol(1.2)}/><path d="M${X0 + 46},${Y0 - 66} L${X0 + 46},${Y0 - 38} M${X0 + 78},${Y0 - 66} L${X0 + 78},${Y0 - 38}" stroke="#4a2a1a" stroke-width="1.4"/>`);
      p.push(`<rect x="${R - 40}" y="${Y0 - 76}" width="8" height="46" fill="${K.hg('#3a3632')}" ${ol(1)}/><rect x="${R - 43}" y="${Y0 - 80}" width="14" height="5" fill="#2a2622" ${ol(0.8)}/>`);
      p.push(`<text x="${cx}" y="${Y0 - 4}" text-anchor="middle" font-family="Georgia, serif" font-size="9" font-weight="700" fill="#e8dcc0" opacity="0.7" letter-spacing="2">HOT BATHS</text>`);
    } else if (type === 'messenger_post') {
      const pts = `${X0 - 12},${Y0 + 2} ${cx},${Y0 - 40} ${R + 12},${Y0 + 2}`;
      p.push(shingles(pts, '#5a5040'));
      p.push(`<rect x="${cx - 16}" y="${Y0 - 58}" width="32" height="20" fill="${K.vg('#6a4a30')}" ${ol(1)}/><polygon points="${cx - 20},${Y0 - 58} ${cx},${Y0 - 70} ${cx + 20},${Y0 - 58}" fill="#4a3a2e" ${ol(1)}/>${[0, 1, 2].map((k) => `<circle cx="${cx - 9 + k * 9}" cy="${Y0 - 48}" r="2.6" fill="#1a120c"/>`).join('')}<path d="M${cx + 8},${Y0 - 72} q2,-4 5,-3 l3,1 l-3,1 q-2,2 -5,1 Z" fill="#a8a8a0" ${ol(0.5)}/>`);
      p.push(`<path d="M${X0 + 16},${Y0 - 10} L${X0 + 16},${Y0 - 62} M${X0 + 10},${Y0 - 56} L${X0 + 22},${Y0 - 56} M${X0 + 12},${Y0 - 50} L${X0 + 20},${Y0 - 50}" stroke="${INK}" stroke-width="1.2"/>`);
    } else {
      p.push(tin(`${X0 - 10},${Y0 + 2} ${X0 - 10},${Y0 - 14} ${R + 10},${Y0 - 14} ${R + 10},${Y0 + 2}`, '#6a6a62'));
    }
    p.push(`</g>`);
    // eave board and gutter with a downpipe
    const eL = nl ? X0 : X0 - 18, eR = nr ? R : R + 18;
    p.push(`<rect x="${eL}" y="${Y0 - 1}" width="${eR - eL}" height="5" fill="#4a3424" ${ol(1)}/><rect x="${eL - (nl ? 0 : 2)}" y="${Y0 + 3}" width="${eR - eL + (nl ? 0 : 2) + (nr ? 0 : 2)}" height="3" fill="#6a6e70" ${ol(0.7)}/>${nr ? '' : `<rect x="${R + 12}" y="${Y0 + 5}" width="3.4" height="${h - 8}" fill="#6a6e70" ${ol(0.7)}/>`}`);
    // plank siding at both ends of the cutaway, corner posts
    p.push(plank(X0 - 2, Y0 + 5, 9, h - 5, '#6a4c32', true) + plank(R - 7, Y0 + 5, 9, h - 5, '#5a4028', true));
    p.push(`<rect x="${X0 - 5}" y="${Y0 + 4}" width="4" height="${h - 4}" fill="${K.hg('#4a3424')}" ${ol(0.9)}/><rect x="${R + 1}" y="${Y0 + 4}" width="4" height="${h - 4}" fill="${K.hg('#4a3424')}" ${ol(0.9)}/>`);
    // a boardwalk out front on short posts, steps at one end
    const bL = nl ? X0 : X0 - 18, bR = nr ? R : R + 18;
    p.push(`<rect x="${bL}" y="${B - 5}" width="${bR - bL}" height="6" fill="${K.vg('#7a5a38')}" ${ol(1)}/>${K.plankLines(bL, B - 5, bR - bL, 6, 9, true)}`);
    for (let x = bL + 4; x < bR; x += 40) p.push(`<rect x="${x}" y="${B + 1}" width="3" height="5" fill="#3a2a1c"/>`);
    if (!nl) p.push(`<rect x="${X0 - 28}" y="${B - 1}" width="10" height="3" fill="#6a4a30" ${ol(0.7)}/><rect x="${X0 - 34}" y="${B + 2}" width="12" height="3" fill="#6a4a30" ${ol(0.7)}/>`);
    p.push((nl ? '' : lantern(X0 - 10, Y0 + 12)) + (nr ? '' : lantern(R + 10, Y0 + 12)));
    return svg(W, H, `<g filter="url(#gr)">${p.join('')}</g>`, K.done());
  }
  function exterior(type, w, h, seed, broken, nl = false, nr = false) {
    if (OUTDOOR.has(type)) return null;
    const v = seed % 3;
    return request(`ext|${type}|${w}|${h}|${v}|${broken ? 1 : 0}|${nl ? 1 : 0}${nr ? 1 : 0}`, () => exteriorSVG(type, w, h, v * 101 + 7, broken, nl, nr), w + 40, h + 80, { pw: (w + 40) * Art.PX, ph: (h + 80) * Art.PX, k: 30, outline: false });
  }

  // Ready image for this room, or null (the caller draws the old furniture meanwhile).
  function room(type, w, h, seed) {
    const f = ROOMS[type];
    if (!f) return null;
    const v = seed % 3;
    return request(`room|${type}|${w}|${h}|${v}`, () => {
      const K = kit(seed), r = rng(v * 31 + 7);
      const body = f(K, w, h, r);
      return svg(w, h, `<g filter="url(#gr)">${body}</g>`, K.done());
    }, w, h, { pw: w * Art.PX, ph: h * Art.PX, k: 28, outline: false });
  }
  return { room, exterior, OUTDOOR, types: Object.keys(ROOMS) };
})();
