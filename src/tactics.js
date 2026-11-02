// ============================================================================
// Tactics: pure turn-based combat rules. No DOM. A battle is plain JSON (saved
// with the game). Every action appends animation events to b.fx, which the
// battle view drains and plays.
// ============================================================================
const TAC = (() => {
  const W = 12, H = 16; // hex rows sit 0.87 apart, so 16 rows span what 14 square rows did
  const EXTRACT_ROWS = 2;          // bottom rows are the deploy / extraction zone
  const SIGHT = 11;

  // ---------- seeded rng stored on the battle ----------
  function rng(b) {
    const next = () => {
      let t = (b.rs = (b.rs + 0x6d2b79f5) | 0);
      t = Math.imul(t ^ (t >>> 15), 1 | t);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    return {
      next, int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)),
      chance: (p) => next() < p, pick: (a) => a[Math.floor(next() * a.length)],
      shuffle(a) { const c = a.slice(); for (let i = c.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); [c[i], c[j]] = [c[j], c[i]]; } return c; },
    };
  }

  // ---------- unit templates ----------
  const ROLE_STATS = {
    recruit: { hp: 10, aim: 62, mob: 5, range: 12, dmg: [3, 4], armor: 0 },
    bulwark: { hp: 15, aim: 58, mob: 4, range: 10, dmg: [3, 5], armor: 1 },
    longshot: { hp: 9, aim: 72, mob: 5, range: 17, dmg: [4, 6], armor: 0, longRange: true },
    drifter: { hp: 11, aim: 66, mob: 6, range: 12, dmg: [3, 5], armor: 0 },
    sawbones: { hp: 10, aim: 60, mob: 5, range: 11, dmg: [2, 4], armor: 0 },
    tinker: { hp: 10, aim: 62, mob: 5, range: 12, dmg: [3, 4], armor: 0 },
  };
  const ENEMY = {
    feral: { name: 'Feral', hp: 4, aim: 66, mob: 6, range: 1, dmg: [2, 3], armor: 0, scale: [1, 0] },
    hound: { name: 'War hound', hp: 6, aim: 70, mob: 7, range: 1, dmg: [3, 4], armor: 0, scale: [2, 2] },
    scav: { name: 'Scavenger', hp: 5, aim: 52, mob: 5, range: 10, dmg: [2, 3], armor: 0, scale: [1, 2] },
    raider: { name: 'Raider', hp: 7, aim: 56, mob: 5, range: 12, dmg: [3, 4], armor: 0, scale: [2, 3] },
    brute: { name: 'Brute', hp: 12, aim: 54, mob: 4, range: 5, dmg: [4, 6], armor: 1, scale: [3, 2] },
    marksman: { name: 'Marksman', hp: 6, aim: 66, mob: 4, range: 17, dmg: [4, 5], armor: 0, scale: [1, 3], longRange: true },
    machine: { name: 'Sentry machine', hp: 10, aim: 62, mob: 3, range: 10, dmg: [3, 4], armor: 1, scale: [2, 2] },
    intake: { name: 'Thing from the intake', hp: 6, aim: 64, mob: 5, range: 1, dmg: [3, 4], armor: 0, scale: [0, 0] },
  };
  const SIGNATURE = ['brute', 'marksman', 'hound'];
  const ABILITIES = {
    taunt: { name: 'Taunt', ap: 1, tip: 'Enemies that can see the Bulwark must shoot at them next turn. Bulwarks take 1 less damage.' },
    steady: { name: 'Steady shot', ap: 2, tip: 'Only before moving: +15 aim and +1 damage.' },
    quick: { name: 'Quick shot', ap: 1, tip: 'Fire without ending the turn. Recharges after 2 turns.' },
    patch: { name: 'Patch up', ap: 1, tip: 'Heal an adjacent ally 5, or get a downed ally back on their feet. Two per mission.' },
    reviveShot: { name: 'Revive shot', ap: 1, tip: 'Once per mission: revive a downed ally anywhere in sight.' },
    turret: { name: 'Deploy turret', ap: 1, tip: 'Once per mission: a turret on an adjacent tile fires at the end of each of your turns.' },
  };
  const ROLE_ABILITY = { bulwark: ['taunt'], longshot: ['steady'], drifter: ['quick'], sawbones: ['patch', 'reviveShot'], tinker: ['turret'], recruit: [] };

  // ---------- geometry ----------
  const idx = (x, y) => y * W + x;
  const inb = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
  const cov = (b, x, y) => (inb(x, y) ? b.cover[idx(x, y)] : 2);
  // Hex grid, "odd-r" offset layout: odd rows sit half a hex to the right.
  // hp() is a hex's position in a plane where neighbouring centres are 1 apart.
  const NB_EVEN = [[1, 0], [-1, 0], [0, -1], [-1, -1], [0, 1], [-1, 1]];
  const NB_ODD = [[1, 0], [-1, 0], [1, -1], [0, -1], [1, 1], [0, 1]];
  const nbrs = (x, y) => (y & 1 ? NB_ODD : NB_EVEN).map(([dx, dy]) => [x + dx, y + dy]);
  const ROW = Math.sqrt(3) / 2;
  const hp = (x, y) => ({ x: x + 0.5 * (y & 1), y: y * ROW });
  const dist = (a, c) => { const p = hp(a.x, a.y), q = hp(c.x, c.y); return Math.hypot(p.x - q.x, p.y - q.y); };
  const cube = (x, y) => { const q = x - (y - (y & 1)) / 2; return [q, y, -q - y]; };
  const hexDist = (a, c) => { const A = cube(a.x, a.y), C = cube(c.x, c.y); return Math.max(Math.abs(A[0] - C[0]), Math.abs(A[1] - C[1]), Math.abs(A[2] - C[2])); };
  // the hex containing a point of the hp() plane
  function fromHp(px, py) {
    const r = py / ROW, q = px - r / 2;
    let rx = Math.round(q), rz = Math.round(r), ry = Math.round(-q - r);
    const dx = Math.abs(rx - q), dz = Math.abs(rz - r), dy = Math.abs(ry + q + r);
    if (dx > dy && dx > dz) rx = -ry - rz; else if (dz > dy) rz = -rx - ry;
    return [rx + (rz - (rz & 1)) / 2, rz];
  }
  const active = (u) => !u.dead && !u.gone && !u.carriedBy;
  const standing = (u) => active(u) && !u.downed;
  const unitAt = (b, x, y) => b.units.find((u) => active(u) && u.x === x && u.y === y);
  const byId = (b, id) => b.units.find((u) => u.id === id);
  const inExtract = (u) => u.y >= H - EXTRACT_ROWS;
  const high = (b, x, y) => (b.height && inb(x, y) ? b.height[idx(x, y)] : 0);

  function clearLine(b, ax, ay, bx, by) {
    const A = hp(ax, ay), B = hp(bx, by);
    const steps = Math.ceil(Math.hypot(B.x - A.x, B.y - A.y) * 4);
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const [x, y] = fromHp(A.x + (B.x - A.x) * t + 1e-4, A.y + (B.y - A.y) * t + 1e-4);
      if ((x === ax && y === ay) || (x === bx && y === by)) continue;
      if (cov(b, x, y) === 2) return false;
    }
    return true;
  }
  // Line of sight with XCOM-style step-out: a unit next to a wall may lean around it.
  function los(b, a, t, ax = a.x, ay = a.y) {
    if (clearLine(b, ax, ay, t.x, t.y)) return true;
    // lean out only to a hex that also touches the wall you are sheltering behind
    const walls = nbrs(ax, ay).filter(([ex, ey]) => cov(b, ex, ey) === 2);
    if (!walls.length) return false;
    for (const [nx, ny] of nbrs(ax, ay)) {
      if (!inb(nx, ny) || cov(b, nx, ny) !== 0) continue;
      if (!walls.some(([ex, ey]) => hexDist({ x: nx, y: ny }, { x: ex, y: ey }) === 1)) continue;
      if (clearLine(b, nx, ny, t.x, t.y)) return true;
    }
    return false;
  }
  // Cover a target has against an attacker standing at (ax, ay): 0 none, 1 half, 2 full.
  function coverFrom(b, t, ax, ay) {
    // A hex side counts when the attacker is within 60 degrees of it.
    const T = hp(t.x, t.y), A = hp(ax, ay);
    const ux = A.x - T.x, uy = A.y - T.y, ul = Math.hypot(ux, uy) || 1;
    let best = 0;
    for (const [nx, ny] of nbrs(t.x, t.y)) {
      const N = hp(nx, ny);
      if (((N.x - T.x) * ux + (N.y - T.y) * uy) / ul >= 0.49) best = Math.max(best, cov(b, nx, ny));
    }
    if (high(b, t.x, t.y)) best = Math.max(best, 1); // a tower's railing is half cover
    return best;
  }

  function hitChance(b, a, t, opts = {}) {
    const ax = opts.x ?? a.x, ay = opts.y ?? a.y;
    const d = dist({ x: ax, y: ay }, t);
    if (a.range === 1) {
      if (hexDist({ x: ax, y: ay }, t) > 1) return 0;
      return Math.max(5, Math.min(95, a.aim));
    }
    if (d > a.range + 0.01) return 0;
    if (!los(b, { x: ax, y: ay }, t, ax, ay)) return 0;
    let c = a.aim + (opts.bonus || 0);
    if (high(b, ax, ay) > high(b, t.x, t.y)) c += 10; // shooting down from a watchtower
    if (!a.longRange && d > 8) c -= Math.round((d - 8) * 3);
    if (d <= 2) c += 10;
    const cv = coverFrom(b, t, ax, ay);
    c -= cv === 2 ? 40 : cv === 1 ? 20 : 0;
    if (t.hunker) c -= 15;
    return Math.max(5, Math.min(95, Math.round(c)));
  }
  const flanked = (b, a, t) => a.range !== 1 && coverFrom(b, t, a.x, a.y) === 0;

  // ---------- map generation ----------
  function generateMap(b, r, kind) {
    b.cover = new Array(W * H).fill(0);
    b.floor = Array.from({ length: W * H }, () => r.int(0, 3));
    const set = (x, y, v) => { if (inb(x, y) && y < H - EXTRACT_ROWS) b.cover[idx(x, y)] = v; };
    // Ruined buildings: hex-aligned parallelograms (rows across, a straight diagonal down each
    // side) with missing segments, so every wall runs along a true hex line.
    const rooms = r.int(2, 4);
    const step = (x, y, se) => (se ? [x + (y & 1), y + 1] : [x - 1 + (y & 1), y + 1]);
    for (let i = 0; i < rooms; i++) {
      const w = r.int(3, 5), h = r.int(3, 5), se = r.chance(0.5);
      const x0 = r.int(se ? 0 : 2, W - w - (se ? 2 : 0)), y0 = r.int(0, H - EXTRACT_ROWS - h - 2);
      const left = [[x0, y0]], right = [[x0 + w - 1, y0]];
      for (let k = 1; k < h; k++) { left.push(step(...left[k - 1], se)); right.push(step(...right[k - 1], se)); }
      const top = [], bottom = [];
      for (let x = x0; x < x0 + w; x++) top.push([x, y0]);
      for (let x = left[h - 1][0]; x <= right[h - 1][0]; x++) bottom.push([x, y0 + h - 1]);
      for (const [x, y] of [...top, ...bottom, ...left, ...right]) if (r.chance(0.62)) set(x, y, 2);
      // a guaranteed doorway on each side
      const mid = (a) => a[Math.floor(a.length / 2)];
      for (const [x, y] of [mid(top), mid(bottom), mid(left), mid(right)]) set(x, y, 0);
    }
    // Scattered half cover: crates, barrels, wrecks.
    const n = r.int(16, 22);
    for (let i = 0; i < n; i++) {
      const x = r.int(0, W - 1), y = r.int(0, H - EXTRACT_ROWS - 1);
      if (b.cover[idx(x, y)] === 0) set(x, y, 1);
      if (r.chance(0.3) && inb(x + 1, y) && b.cover[idx(x + 1, y)] === 0) set(x + 1, y, 1);
    }
    // A line of low cover just above the deploy zone so the squad starts safe.
    for (let x = 1; x < W - 1; x += r.int(2, 3)) set(x, H - EXTRACT_ROWS - 1, 1);
    b.prop = b.cover.map((c) => (c === 1 ? r.int(0, 2) : c === 2 ? r.int(0, 1) : 0));
    // Every open tile must be reachable from the deploy zone: carve a gap down
    // from any pocket that is cut off, then fill whatever is still sealed.
    const flood = () => {
      const seen = new Set(), q = [];
      for (let x = 0; x < W; x++) { seen.add(idx(x, H - 1)); q.push([x, H - 1]); }
      while (q.length) {
        const [x, y] = q.shift();
        for (const [nx, ny] of nbrs(x, y)) {
          if (!inb(nx, ny) || seen.has(idx(nx, ny)) || b.cover[idx(nx, ny)] !== 0) continue;
          seen.add(idx(nx, ny)); q.push([nx, ny]);
        }
      }
      return seen;
    };
    for (let pass = 0; pass < 30; pass++) {
      const seen = flood();
      let cut = -1;
      for (let i = W * H - 1; i >= 0; i--) if (b.cover[i] === 0 && !seen.has(i)) { cut = i; break; }
      if (cut < 0) break;
      let x = cut % W, y = Math.floor(cut / W);
      while (y < H - 1 && !seen.has(idx(x, y + 1))) { y += 1; b.cover[idx(x, y)] = 0; b.prop[idx(x, y)] = 0; }
    }
    const seen = flood();
    for (let i = 0; i < W * H; i++) if (b.cover[i] === 0 && !seen.has(i)) { b.cover[i] = 1; b.prop[i] = 3; }
    b.theme = kind;
  }
  function openTiles(b, pred) {
    const out = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (b.cover[idx(x, y)] === 0 && !unitAt(b, x, y) && !b.objs.some((o) => o.x === x && o.y === y && !o.done) && pred(x, y)) out.push([x, y]);
    return out;
  }

  // ---------- creation ----------
  function crewUnit(c, i) {
    const st = ROLE_STATS[c.role] || ROLE_STATS.recruit;
    const lv = c.level - 1;
    const moraleAim = c.morale > 80 ? 5 : c.morale < 30 ? -10 : 0;
    const g = c.gear;
    const hp = st.hp + lv * (c.role === 'bulwark' ? 3 : 2) + (g === 'vest' ? 3 : g === 'plating' ? 2 : 0);
    return {
      id: `u${i}`, side: 'crew', crewId: c.id, name: c.name, kind: c.role, level: c.level, look: c.look,
      x: 0, y: 0, hp, maxHp: hp, aim: st.aim + lv * 3 + moraleAim + (g === 'scope' ? 8 : 0), mob: st.mob + (g === 'boots' ? 1 : 0), range: st.range, dmg: st.dmg.slice(),
      armor: st.armor + (g === 'plating' ? 1 : 0), gear: g || null, longRange: !!st.longRange, ap: 2, moved: false, downed: false, bleed: 0, dead: false, gone: false,
      ow: false, hunker: false, cd: {}, uses: {}, kills: 0, wasDowned: false,
    };
  }
  function enemyUnit(kind, i, str, owner) {
    const e = ENEMY[kind];
    const hp = e.hp + e.scale[0] * (str - 1);
    return {
      id: `e${i}`, side: 'enemy', name: e.name, kind, x: 0, y: 0, hp, maxHp: hp, aim: e.aim + e.scale[1] * (str - 1) - (e.range > 1 ? 8 : 0), // hex lines of fire are more open: -8 keeps fights where they were
      mob: e.mob - (e.range === 1 && kind !== 'intake' ? 1 : 0), range: e.range, dmg: e.dmg.map((d) => d + Math.floor((str - 1) / 2)), armor: e.armor, longRange: !!e.longRange,
      ap: 2, dead: false, gone: false, downed: false, alerted: false, pod: 0, owner: owner ? owner.id : null, color: owner ? owner.color : null,
      signature: owner ? SIGNATURE[owner.territory % SIGNATURE.length] === kind : false,
    };
  }

  // spec: { seed, kind, site, danger, crew:[crew objects], owner: warlord|null, scripted }
  function create(spec) {
    if (spec.kind === 'raid') return createRaid(spec);
    const b = { v: 1, rs: spec.seed | 0, turn: 1, phase: 'player', units: [], objs: [], fx: [], log: [], over: null, stims: (spec.scripted === 'intro' ? 2 : 1) + spec.crew.filter((c) => c.gear === 'kit').length + ((spec.perks && spec.perks.stims) || 0), perks: spec.perks || {},
      kind: spec.kind, site: spec.site, danger: spec.danger, taunt: null, surrendered: 0, freed: 0, collected: 0, script: null, nextE: 0 };
    const r = rng(b);
    generateMap(b, r, spec.kind);
    // Crew deploy in the bottom rows.
    const spots = r.shuffle(openTiles(b, (x, y) => y >= H - EXTRACT_ROWS && x >= 2 && x <= W - 3));
    spec.crew.forEach((c, i) => { const u = crewUnit(c, i); const [x, y] = spots[i]; u.x = x; u.y = y; b.units.push(u); });
    // Objectives
    const str = Math.max(1, spec.owner ? spec.owner.strength : Math.ceil(spec.danger / 2));
    if (spec.scripted === 'keycard') {
      b.objective = 'caches'; b.keycard = true;
      const far = openTiles(b, (x, y) => y < 3);
      const [x, y] = far.length ? r.pick(far) : r.pick(openTiles(b, (x, y) => y < H - 5));
      b.objs.push({ type: 'cache', x, y, done: false, key: true });
    } else if (spec.kind === 'salvage' || spec.kind === 'elite') {
      b.objective = 'caches';
      const n = spec.kind === 'elite' ? 2 : 3;
      for (const [x, y] of r.shuffle(openTiles(b, (x, y) => y < H - 5)).slice(0, n)) b.objs.push({ type: 'cache', x, y, done: false });
    } else if (spec.kind === 'rescue') {
      b.objective = 'rescue';
      b.turnLimit = 8;
      for (const [x, y] of r.shuffle(openTiles(b, (x, y) => y < 5)).slice(0, 2)) b.objs.push({ type: 'survivor', x, y, done: false });
    } else b.objective = 'eliminate';
    // Enemies, in pods placed away from the squad.
    let roster;
    const site = (spec.site || '').toLowerCase();
    const sig = spec.owner ? SIGNATURE[spec.owner.territory % SIGNATURE.length] : null;
    const count = spec.scripted === 'intro' ? 3 : Math.min(6, 1 + spec.danger + (spec.kind === 'combat' || spec.kind === 'warlord' ? 1 : 0));
    if (spec.scripted === 'intro') roster = ['feral', 'feral', 'feral'];
    else if (site.includes('dog') || site.includes('feral')) roster = Array.from({ length: count }, () => 'feral');
    else if (spec.scripted === 'keycard') roster = Array.from({ length: Math.min(6, spec.danger + 2) }, (_, i) => (i % 2 ? 'machine' : r.pick(['scav', 'raider', 'marksman'])));
    else if (site.includes('machine')) roster = Array.from({ length: count }, (_, i) => (i % 2 ? 'machine' : 'scav'));
    else if (spec.kind === 'salvage' || spec.kind === 'elite') roster = Array.from({ length: count }, () => r.pick(['scav', 'scav', 'feral', 'raider']));
    else roster = Array.from({ length: count }, (_, i) => (sig && i % 3 === 2 ? sig : r.pick(['raider', 'raider', 'scav', spec.danger >= 3 ? 'marksman' : 'raider'])));
    const pods = [];
    for (let i = 0; i < roster.length; i += 3) pods.push(roster.slice(i, i + 3));
    pods.forEach((pod, p) => {
      const centers = openTiles(b, (x, y) => y < H - 6 - (p % 2) * 2);
      const [cx, cy] = r.pick(centers);
      for (const kind of pod) {
        const near = openTiles(b, (x, y) => hexDist({ x, y }, { x: cx, y: cy }) <= 2 && y < H - 5);
        const pick = near.length ? r.pick(near) : r.pick(openTiles(b, (x, y) => y < H - 5));
        const u = enemyUnit(kind, b.nextE++, spec.scripted === 'intro' ? 1 : str, spec.owner);
        if (spec.scripted === 'intro') { u.hp = 4; u.maxHp = 4; u.aim = 58; }
        u.x = pick[0]; u.y = pick[1]; u.pod = p;
        b.units.push(u);
      }
    });
    if (spec.scripted === 'intro') {
      const crewU = b.units.filter((u) => u.side === 'crew');
      b.script = { kind: 'intro', victim: r.pick(crewU).id, fired: false };
      b.intro = true;
    }
    b.fx.push({ t: 'say', text: openingLine(b) });
    return b;
  }
  function openingLine(b) {
    if (b.intro) return 'Pump station. Something is nesting in the intake. Stay in cover and keep each other alive.';
    if (b.keycard) return 'The keycard piece is somewhere at the far end. Grab it and get out, or clear the place.';
    return { caches: 'Find the caches, grab what you can, and get back to the bottom of the map.', rescue: `People are trapped up ahead. Reach them within ${b.turnLimit} turns.`, eliminate: 'Clear the area. Or get out alive if it turns.' }[b.objective];
  }

  // ---------- movement ----------
  function reach(b, u) {
    const mob = u.mob - (u.carrying ? 2 : 0);
    const maxCost = mob * Math.min(2, u.ap);
    const dist = new Map([[idx(u.x, u.y), 0]]);
    const prev = new Map();
    const open = [[0, u.x, u.y]];
    while (open.length) {
      open.sort((a, c) => a[0] - c[0]);
      const [d, x, y] = open.shift();
      if (d > (dist.get(idx(x, y)) ?? Infinity)) continue;
      for (const [nx, ny] of nbrs(x, y)) {
        if (!inb(nx, ny) || cov(b, nx, ny) !== 0) continue;
        const occ = unitAt(b, nx, ny);
        if (occ && occ.side !== u.side) continue;
        const nd = d + 1;
        if (nd > maxCost + 0.01 || nd >= (dist.get(idx(nx, ny)) ?? Infinity)) continue;
        dist.set(idx(nx, ny), nd); prev.set(idx(nx, ny), idx(x, y)); open.push([nd, nx, ny]);
      }
    }
    const tiles = [];
    for (const [k, d] of dist) {
      const x = k % W, y = Math.floor(k / W);
      if (d === 0 || unitAt(b, x, y)) continue;
      tiles.push({ x, y, ap: d <= mob + 0.01 ? 1 : 2 });
    }
    return { tiles, prev, start: idx(u.x, u.y) };
  }
  function pathTo(rc, x, y) {
    const out = [];
    let k = idx(x, y);
    while (k !== undefined && k !== rc.start) { out.unshift([k % W, Math.floor(k / W)]); k = rc.prev.get(k); }
    return out;
  }

  // ---------- helpers ----------
  function crewUnits(b) { return b.units.filter((u) => u.side === 'crew' && u.kind !== 'turret'); }
  function enemies(b) { return b.units.filter((u) => u.side === 'enemy' && active(u)); }
  function visibleEnemies(b) {
    const eyes = b.units.filter((u) => u.side === 'crew' && standing(u));
    return new Set(enemies(b).filter((e) => e.revealed || eyes.some((c) => dist(c, e) <= SIGHT && los(b, c, e))).map((e) => e.id));
  }
  function alertPod(b, pod, r) {
    const woke = enemies(b).filter((e) => e.pod === pod && !e.alerted);
    if (!woke.length) return;
    for (const e of woke) e.alerted = true;
    b.fx.push({ t: 'alert', ids: woke.map((e) => e.id) });
    // Scramble: each one takes a short free move into cover.
    for (const e of woke) {
      if (e.range === 1) continue;
      const rc = reach(b, { ...e, ap: 1, mob: Math.ceil(e.mob / 2) });
      const threats = b.units.filter((u) => u.side === 'crew' && standing(u));
      let best = null, bestScore = scoreSpot(b, e, e.x, e.y, threats);
      for (const t of rc.tiles) { const sc = scoreSpot(b, e, t.x, t.y, threats); if (sc > bestScore + 4) { best = t; bestScore = sc; } }
      if (best) { const path = pathTo(rc, best.x, best.y); const from = [e.x, e.y]; e.x = best.x; e.y = best.y; b.fx.push({ t: 'move', id: e.id, path: [from, ...path] }); }
    }
  }
  function checkSight(b) {
    const r = rng(b);
    const eyes = b.units.filter((u) => u.side === 'crew' && standing(u));
    for (const e of enemies(b)) if (!e.alerted && eyes.some((c) => dist(c, e) <= SIGHT - 1 && los(b, c, e))) alertPod(b, e.pod, r);
  }
  function scoreSpot(b, e, x, y, threats) {
    if (!threats.length) return 0;
    let s = 0;
    for (const t of threats) {
      const cv = coverFrom(b, { x, y }, t.x, t.y);
      s += cv === 2 ? 14 : cv === 1 ? 8 : -10;
    }
    s /= threats.length;
    const shots = threats.map((t) => hitChance(b, e, t, { x, y }));
    s += Math.max(0, ...shots) * 0.5;
    return s;
  }

  // ---------- damage ----------
  function damage(b, a, t, r, opts = {}) {
    const chance = opts.chance ?? hitChance(b, a, t, opts);
    const hit = opts.sure || r.next() * 100 < chance;
    const ev = { t: 'shot', from: a.id, to: t.id, hit, chance, dmg: 0, crit: false, melee: a.range === 1, ow: !!opts.ow };
    if (a.side === 'enemy') a.revealed = true;
    if (hit) {
      let d = r.int(a.dmg[0], a.dmg[1]) + (opts.dmgBonus || 0);
      const critChance = 10 + (flanked(b, a, t) ? 30 : 0);
      if (r.next() * 100 < critChance) { d += 2; ev.crit = true; }
      d = Math.max(1, d - (t.armor || 0));
      if (opts.lethal) d = t.hp + 50;
      // Tutorial fight: only the scripted loss is allowed; everyone else hangs on at 1.
      if (b.intro && t.side === 'crew' && !opts.lethal) d = Math.min(d, Math.max(0, t.hp - 1));
      t.hp -= d; ev.dmg = d;
    }
    ev.hpAfter = Math.max(0, t.hp);
    b.fx.push(ev);
    if (t.side === 'enemy' && !t.alerted) alertPod(b, t.pod, r);
    if (hit && t.hp <= 0) fall(b, t, a, opts.lethal);
    else if (hit && t.side === 'enemy' && t.hp <= t.maxHp * 0.35 && enemies(b).length === 1 && r.chance(0.4) && !b.intro) {
      t.gone = true; t.surrendered = true; b.surrendered += 1;
      b.fx.push({ t: 'surrender', id: t.id });
    }
    return ev;
  }
  function fall(b, t, killer, outright) {
    if (t.side === 'crew' && t.kind !== 'turret' && !outright) {
      t.hp = 0; t.downed = true; t.wasDowned = true; t.bleed = b.intro ? 5 : 3 + ((b.perks && b.perks.bleed) || 0); t.ow = false; t.hunker = false;
      if (t.carrying) dropCarried(b, t);
      b.fx.push({ t: 'down', id: t.id, bleed: t.bleed });
    } else {
      t.hp = 0; t.dead = true;
      if (t.carrying) dropCarried(b, t);
      if (killer && killer.side === 'crew') { const k = killer.ownerUnit ? byId(b, killer.ownerUnit) : killer; if (k) k.kills = (k.kills || 0) + 1; }
      b.fx.push({ t: 'die', id: t.id });
    }
  }
  function dropCarried(b, carrier) {
    const v = byId(b, carrier.carrying);
    carrier.carrying = null;
    if (!v) return;
    v.carriedBy = null;
    const spot = nbrs(carrier.x, carrier.y).find(([x, y]) => inb(x, y) && cov(b, x, y) === 0 && !unitAt(b, x, y));
    if (spot) { v.x = spot[0]; v.y = spot[1]; b.fx.push({ t: 'drop', id: v.id, x: v.x, y: v.y }); }
    else { v.dead = true; b.fx.push({ t: 'die', id: v.id }); }
  }

  // ---------- player actions ----------
  // Every action returns an error string or null.
  function canAct(b, u) {
    if (b.over) return 'The mission is over.';
    if (b.phase !== 'player') return 'Wait for the enemy turn to finish.';
    if (!u || u.side !== 'crew' || !standing(u) || u.kind === 'turret') return 'Pick one of your crew.';
    if (u.ap <= 0) return `${u.name.split(' ')[0]} is out of actions this turn.`;
    return null;
  }
  function move(b, uid, x, y) {
    const u = byId(b, uid); const err = canAct(b, u); if (err) return err;
    const rc = reach(b, u);
    const t = rc.tiles.find((p) => p.x === x && p.y === y);
    if (!t) return 'Too far, or blocked.';
    const path = pathTo(rc, x, y);
    const r = rng(b);
    // Walk step by step so overwatch can interrupt.
    u.ap -= t.ap; u.moved = true; u.hunker = false;
    const start = [u.x, u.y];
    const walked = [start];
    for (const [px, py] of path) { u.x = px; u.y = py; walked.push([px, py]); }
    b.fx.push({ t: 'move', id: u.id, path: walked });
    if (u.carrying) { const v = byId(b, u.carrying); v.x = u.x; v.y = u.y; }
    // Pick up objectives on arrival or next to them.
    touchObjectives(b, u);
    checkSight(b);
    void r;
    return finishAction(b);
  }
  function touchObjectives(b, u) {
    for (const o of b.objs) {
      if (o.done || hexDist(o, u) > 1) continue;
      o.done = true;
      if (o.type === 'cache') { b.collected += 1; b.fx.push({ t: 'pickup', id: u.id, x: o.x, y: o.y, text: o.key ? 'Keycard piece!' : b.kind === 'elite' ? 'Buttons!' : 'Salvage' }); }
      if (o.type === 'survivor') { b.freed += 1; b.fx.push({ t: 'pickup', id: u.id, x: o.x, y: o.y, text: 'Freed' }); }
    }
  }
  function targets(b, uid) {
    const u = byId(b, uid);
    if (!u || !standing(u)) return [];
    const vis = visibleEnemies(b);
    return enemies(b).filter((e) => vis.has(e.id)).map((e) => ({ id: e.id, chance: hitChance(b, u, e) })).filter((t) => t.chance > 0);
  }
  function shoot(b, uid, tid, mode = 'shot') {
    const u = byId(b, uid); const err = canAct(b, u); if (err) return err;
    if (u.carrying) return 'Put them down first. You cannot shoot while carrying someone.';
    const t = byId(b, tid);
    if (!t || !active(t) || t.side !== 'enemy') return 'No target there.';
    let opts = {};
    if (mode === 'steady') {
      if (u.kind !== 'longshot') return 'Only a Longshot can do that.';
      if (u.moved || u.ap < 2) return 'Steady shot needs a full turn without moving.';
      opts = { bonus: 15, dmgBonus: 1 };
    }
    if (mode === 'quick') {
      if (u.kind !== 'drifter') return 'Only a Drifter can do that.';
      if (u.cd.quick > 0) return `Quick shot recharges in ${u.cd.quick} turn${u.cd.quick > 1 ? 's' : ''}.`;
    }
    const chance = hitChance(b, u, t, opts);
    if (!chance) return 'No clear shot at that one.';
    const r = rng(b);
    damage(b, u, t, r, opts);
    if (mode === 'quick') { u.ap -= 1; u.cd.quick = 3; } else u.ap = 0;
    checkSight(b);
    return finishAction(b);
  }
  function overwatch(b, uid) {
    const u = byId(b, uid); const err = canAct(b, u); if (err) return err;
    if (u.carrying) return 'Not while carrying someone.';
    u.ow = true; u.ap = 0;
    b.fx.push({ t: 'tag', id: u.id, text: 'Overwatch' });
    return finishAction(b);
  }
  function hunker(b, uid) {
    const u = byId(b, uid); const err = canAct(b, u); if (err) return err;
    u.hunker = true; u.ap = 0;
    b.fx.push({ t: 'tag', id: u.id, text: 'Hunker down' });
    return finishAction(b);
  }
  function adjacentAllies(b, u, pred) {
    return b.units.filter((v) => v !== u && v.side === 'crew' && v.kind !== 'turret' && active(v) && hexDist(v, u) <= 1 && pred(v));
  }
  function ability(b, uid, ab, arg) {
    const u = byId(b, uid); const err = canAct(b, u); if (err) return err;
    const r = rng(b);
    if (ab === 'taunt') {
      if (u.kind !== 'bulwark') return 'Only a Bulwark can taunt.';
      if (u.cd.taunt > 0) return `Taunt recharges in ${u.cd.taunt} turn${u.cd.taunt > 1 ? 's' : ''}.`;
      b.taunt = { by: u.id }; u.cd.taunt = 3; u.ap -= 1;
      b.fx.push({ t: 'tag', id: u.id, text: 'Come on, then!' });
      for (const e of enemies(b)) if (!e.alerted && dist(e, u) <= 8) alertPod(b, e.pod, r);
    } else if (ab === 'patch') {
      if (u.kind !== 'sawbones') return 'Only a Sawbones can do that.';
      if ((u.uses.patch || 0) >= 2) return 'Out of bandages.';
      const v = byId(b, arg) || adjacentAllies(b, u, (v) => v.downed || v.hp < v.maxHp)[0];
      if (!v || hexDist(v, u) > 1 || !active(v)) return 'Stand next to the ally you want to patch.';
      u.uses.patch = (u.uses.patch || 0) + 1; u.ap -= 1;
      if (v.downed) revive(b, v, 3); else { v.hp = Math.min(v.maxHp, v.hp + 5); b.fx.push({ t: 'heal', id: v.id, hpAfter: v.hp }); }
    } else if (ab === 'reviveShot') {
      if (u.kind !== 'sawbones') return 'Only a Sawbones can do that.';
      if (u.uses.reviveShot) return 'The revive shot is spent for this mission.';
      const v = byId(b, arg) || b.units.find((v) => v.side === 'crew' && v.downed && active(v) && los(b, u, v));
      if (!v || !v.downed || !active(v)) return 'Nobody downed in sight.';
      if (!los(b, u, v) || dist(u, v) > 14) return 'You need a clear line to them.';
      u.uses.reviveShot = true; u.ap -= 1;
      b.fx.push({ t: 'dart', from: u.id, to: v.id });
      revive(b, v, 4);
    } else if (ab === 'turret') {
      if (u.kind !== 'tinker') return 'Only a Tinker can do that.';
      if (u.uses.turret) return 'The turret is already out.';
      const spot = arg ? arg.split(',').map(Number) : nbrs(u.x, u.y).find(([x, y]) => inb(x, y) && cov(b, x, y) === 0 && !unitAt(b, x, y));
      if (!spot || !inb(spot[0], spot[1]) || cov(b, spot[0], spot[1]) !== 0 || unitAt(b, spot[0], spot[1])) return 'No room next to the Tinker for a turret.';
      u.uses.turret = true; u.ap -= 1;
      const tb = (b.perks && b.perks.turret) || 0;
      const t = { id: `t${u.id}`, side: 'crew', kind: 'turret', name: 'Turret', ownerUnit: u.id, x: spot[0], y: spot[1], hp: 6 + u.level + tb * 3, maxHp: 6 + u.level + tb * 3, aim: 64 + u.level * 2, range: 11, dmg: [2 + tb, 3 + tb], armor: 1, ap: 0, mob: 0, dead: false, gone: false, downed: false, cd: {}, uses: {} };
      b.units.push(t);
      b.fx.push({ t: 'spawn', unit: { ...t } });
    } else if (ab === 'stim') {
      if (b.stims <= 0) return 'No stims left.';
      const v = byId(b, arg) || adjacentAllies(b, u, (v) => v.downed)[0];
      if (!v || !v.downed || hexDist(v, u) > 1) return 'Stand next to a downed ally.';
      b.stims -= 1; u.ap -= 1; revive(b, v, 2);
    } else if (ab === 'carry') {
      if (u.carrying) return 'Already carrying someone.';
      const v = byId(b, arg) || adjacentAllies(b, u, (v) => v.downed)[0];
      if (!v || !v.downed || hexDist(v, u) > 1) return 'Stand next to a downed ally.';
      u.carrying = v.id; v.carriedBy = u.id; v.x = u.x; v.y = u.y; u.ap -= 1; u.ow = false;
      b.fx.push({ t: 'carry', id: u.id, who: v.id });
    } else if (ab === 'extract') {
      if (b.kind === 'raid') return 'There is nowhere to run. This is home. Fall back to the bunker instead.';
      if (!inExtract(u)) return 'Get to the extraction zone at the bottom of the map first.';
      if (b.script && !b.script.fired) return 'Not yet. Pilot Light: “The intake is not clear. Something is still down there.”';
      u.gone = true; u.ap = 0;
      if (u.carrying) { const v = byId(b, u.carrying); v.gone = true; v.carriedBy = null; }
      b.fx.push({ t: 'extract', id: u.id, who: u.carrying || null });
    } else return 'Unknown order.';
    checkSight(b);
    return finishAction(b);
  }
  function revive(b, v, hp) {
    v.downed = false; v.bleed = 0; v.hp = hp; v.ap = 0;
    b.fx.push({ t: 'revive', id: v.id, hpAfter: hp });
  }

  // What a crew unit can do right now (for the action bar).
  function actions(b, uid) {
    const u = byId(b, uid);
    if (!u || u.side !== 'crew' || u.kind === 'turret' || !standing(u)) return [];
    const ok = !canAct(b, u);
    const list = [];
    const downedNear = adjacentAllies(b, u, (v) => v.downed).length > 0;
    list.push({ id: 'overwatch', name: 'Overwatch', on: ok && !u.carrying, tip: 'Spend the turn watching. Fires at the first enemy that moves in sight (−10 aim).' });
    list.push({ id: 'hunker', name: 'Hunker', on: ok, tip: 'Get your head down: −15 to enemy aim until your next turn.' });
    for (const ab of ROLE_ABILITY[u.kind] || []) {
      const a = ABILITIES[ab];
      let on = ok, note = '';
      if (ab === 'taunt' && u.cd.taunt > 0) { on = false; note = `${u.cd.taunt}t`; }
      if (ab === 'steady') { on = ok && !u.moved && u.ap >= 2 && !u.carrying; }
      if (ab === 'quick' && u.cd.quick > 0) { on = false; note = `${u.cd.quick}t`; }
      if (ab === 'patch') { const left = 2 - (u.uses.patch || 0); on = ok && left > 0 && adjacentAllies(b, u, (v) => v.downed || v.hp < v.maxHp).length > 0; note = `${left} left`; }
      if (ab === 'reviveShot') { on = ok && !u.uses.reviveShot && b.units.some((v) => v.side === 'crew' && v.downed && active(v) && los(b, u, v) && dist(u, v) <= 14); note = u.uses.reviveShot ? 'used' : '1 left'; }
      if (ab === 'turret') { on = ok && !u.uses.turret; note = u.uses.turret ? 'used' : ''; }
      list.push({ id: ab, name: a.name, on, note, tip: a.tip, aims: ab === 'steady' || ab === 'quick' });
    }
    if (downedNear) {
      list.push({ id: 'stim', name: 'Stim', on: ok && b.stims > 0, note: `${b.stims} left`, tip: 'Jab a downed ally next to you. They get up with 2 health.' });
      list.push({ id: 'carry', name: 'Carry', on: ok && !u.carrying, tip: 'Pick up a downed ally. Get them to extraction to save them.' });
    }
    if (inExtract(u) && b.kind !== 'raid') list.push({ id: 'extract', name: 'Extract', on: ok, tip: 'Leave the map. Anyone you carry leaves with you.' });
    return list;
  }

  // ---------- turn flow ----------
  function finishAction(b) {
    checkEnd(b);
    return null;
  }
  function endTurn(b) {
    if (b.over || b.phase !== 'player') return null;
    const r = rng(b);
    b.phase = 'enemy';
    // Turrets fire at the end of the player's turn.
    for (const t of b.units.filter((u) => u.kind === 'turret' && active(u))) {
      const vis = visibleEnemies(b);
      const opts = enemies(b).filter((e) => vis.has(e.id)).map((e) => [e, hitChance(b, t, e)]).filter(([, c]) => c > 0).sort((a, c) => c[1] - a[1]);
      if (opts.length) damage(b, t, opts[0][0], r);
    }
    if (checkEnd(b)) return null;
    enemyPhase(b, r);
    if (b.kind === 'raid') raidMorale(b);
    if (checkEnd(b)) return null;
    startPlayerTurn(b);
    checkEnd(b);
    return null;
  }
  function startPlayerTurn(b) {
    b.turn += 1; b.phase = 'player';
    for (const u of b.units.filter((u) => u.side === 'crew')) {
      if (!active(u) && !u.carriedBy) continue;
      if (u.downed) {
        u.bleed -= 1;
        if (u.bleed <= 0) { u.dead = true; u.downed = false; if (u.carriedBy) { const c = byId(b, u.carriedBy); if (c) c.carrying = null; u.carriedBy = null; } b.fx.push({ t: 'die', id: u.id, bled: true }); }
        else b.fx.push({ t: 'bleed', id: u.id, bleed: u.bleed });
        continue;
      }
      u.ap = 2; u.moved = false; u.ow = false; u.hunker = false;
      for (const k of Object.keys(u.cd)) if (u.cd[k] > 0) u.cd[k] -= 1;
    }
    if (b.taunt) b.taunt = null;
    for (const e of b.units) if (e.side === 'enemy' && e.pod !== 99) e.revealed = false;
    if (b.objective === 'rescue' && b.turn > b.turnLimit) {
      const left = b.objs.filter((o) => o.type === 'survivor' && !o.done);
      if (left.length && !b.rescueLost) { b.rescueLost = true; for (const o of left) o.lost = true; b.fx.push({ t: 'say', text: 'Too late. The people up ahead are gone.' }); }
    }
    if (b.objective === 'rescue' && !b.rescueLost && b.turn === b.turnLimit) b.fx.push({ t: 'say', text: 'Last turn to reach them.' });
  }

  function enemyPhase(b, r) {
    const crewUp = () => b.units.filter((u) => u.side === 'crew' && standing(u));
    // Intro: something comes up through the intake on the second enemy turn.
    if (b.script && !b.script.fired && (b.turn >= 2 || enemies(b).length === 0)) {
      const v = byId(b, b.script.victim);
      const someoneDied = crewUnits(b).some((u) => u.dead);
      b.script.fired = true;
      if (v && active(v) && !someoneDied) {
        const spot = nbrs(v.x, v.y).find(([x, y]) => inb(x, y) && cov(b, x, y) === 0 && !unitAt(b, x, y))
          || [[0, -2], [2, 0], [-2, 0], [1, -2], [-1, -2]].map(([dx, dy]) => [v.x + dx, v.y + dy]).find(([x, y]) => inb(x, y) && cov(b, x, y) === 0 && !unitAt(b, x, y));
        const e = enemyUnit('intake', b.nextE++, 1, null);
        e.alerted = true; e.revealed = true; e.pod = 99;
        if (spot) { e.x = spot[0]; e.y = spot[1]; }
        else { e.x = v.x; e.y = Math.max(0, v.y - 1); }
        b.units.push(e);
        b.fx.push({ t: 'spawn', unit: { ...e } });
        b.fx.push({ t: 'say', text: 'Movement in the intake pipe! Something is coming up under them—' });
        damage(b, e, v, r, { sure: true, lethal: true, chance: 100 });
        b.fx.push({ t: 'say', text: `${v.name.split(' ')[0]} is gone. Put that thing down.` });
      }
    }
    for (const e of r.shuffle(enemies(b))) {
      if (!active(e)) continue;
      if (!e.alerted) continue;
      e.ap = 2;
      const targets = crewUp().concat(b.units.filter((u) => u.kind === 'turret' && active(u)));
      if (!targets.length) break;
      const seen = targets.filter((t) => dist(e, t) <= SIGHT + 2 && (e.range === 1 || los(b, e, t)));
      let forced = null;
      if (b.taunt) { const tb = byId(b, b.taunt.by); if (tb && standing(tb) && dist(e, tb) <= 12 && (e.range === 1 || los(b, e, tb))) forced = tb; }
      if (b.kind === 'raid' && !forced && raidTurn(b, e, r, seen, targets)) continue;
      if (e.range === 1) { meleeTurn(b, e, forced ? [forced] : targets, r); continue; }
      const pool = forced ? [forced] : seen;
      const shotAt = (x, y) => pool.map((t) => [t, hitChance(b, e, t, { x, y })]).filter(([, c]) => c > 0).sort((a, c) => c[1] - a[1] || a[0].hp - c[0].hp);
      let here = shotAt(e.x, e.y);
      if (here.length && here[0][1] >= 50 && !forced) { damage(b, e, here[0][0], r); continue; }
      // Reposition: best spot within one move.
      const rc = reach(b, { ...e, ap: 1 });
      const threats = crewUp();
      let best = null, bestScore = scoreSpot(b, e, e.x, e.y, threats) + (here.length ? here[0][1] * 0.3 : 0);
      for (const t of rc.tiles) {
        const sh = shotAt(t.x, t.y);
        const sc = scoreSpot(b, e, t.x, t.y, threats) + (sh.length ? sh[0][1] * 0.3 : 0);
        if (sc > bestScore + 3) { best = t; bestScore = sc; }
      }
      if (best) { stepEnemy(b, e, rc, best.x, best.y, r); if (!active(e)) continue; }
      else if (!here.length) {
        // Nothing to shoot and nowhere better: close the distance.
        const rc2 = reach(b, e);
        const near = targets.slice().sort((a, c) => dist(e, a) - dist(e, c))[0];
        const pick = rc2.tiles.slice().sort((a, c) => dist(a, near) - dist(c, near))[0];
        if (pick) { stepEnemy(b, e, rc2, pick.x, pick.y, r); continue; }
      }
      if (!active(e)) continue;
      here = shotAt(e.x, e.y);
      if (here.length && here[0][1] >= 15) damage(b, e, here[0][0], r);
    }
  }
  function meleeTurn(b, e, targets, r) {
    const adj = (t) => hexDist(t, e) <= 1;
    let near = targets.filter(adj);
    if (!near.length) {
      const rc = reach(b, e);
      let best = null;
      for (const t of targets.slice().sort((a, c) => dist(e, a) - dist(e, c))) {
        const spots = rc.tiles.filter((p) => hexDist(p, t) <= 1 && p.ap === 1);
        if (spots.length) { best = spots.sort((a, c) => coverFrom(b, c, t.x, t.y) - coverFrom(b, a, t.x, t.y))[0]; break; }
      }
      if (!best) {
        const t = targets.slice().sort((a, c) => dist(e, a) - dist(e, c))[0];
        const pick = rc.tiles.slice().sort((a, c) => dist(a, t) - dist(c, t))[0];
        if (pick) stepEnemy(b, e, rc, pick.x, pick.y, r);
        return;
      }
      stepEnemy(b, e, rc, best.x, best.y, r);
      if (!active(e)) return;
      near = targets.filter((t) => active(t) && !t.downed && adj(t));
    }
    if (near.length) damage(b, e, near.sort((a, c) => a.hp - c.hp)[0], r);
  }
  function stepEnemy(b, e, rc, x, y, r) {
    const path = pathTo(rc, x, y);
    const walked = [[e.x, e.y]];
    for (const [px, py] of path) {
      e.x = px; e.y = py; walked.push([px, py]);
      // Overwatch reaction shots.
      for (const w of b.units.filter((u) => u.side === 'crew' && u.ow && standing(u))) {
        if (dist(w, e) > w.range || !los(b, w, e)) continue;
        w.ow = false;
        b.fx.push({ t: 'move', id: e.id, path: walked.splice(0, walked.length, [px, py]) });
        e.revealed = true;
        damage(b, w, e, r, { bonus: -10, ow: true });
        if (!active(e)) return;
      }
    }
    if (walked.length > 1) b.fx.push({ t: 'move', id: e.id, path: walked });
  }

  // ---------- end of mission ----------
  function objectiveDone(b) {
    if (b.objective === 'caches') return b.collected >= b.objs.length;
    if (b.objective === 'rescue') return b.freed >= b.objs.length;
    return enemies(b).length === 0;
  }
  function checkEnd(b) {
    if (b.over) return true;
    if (b.kind === 'raid') {
      if (!enemies(b).length) return conclude(b, b.raid.withdrew ? 'withdrew' : 'repelled');
      if (!crewUnits(b).some((u) => standing(u))) return conclude(b, 'overrun');
      return false;
    }
    const onMap = crewUnits(b).filter((u) => active(u));
    const standingCrew = onMap.filter((u) => !u.downed);
    const cleared = enemies(b).length === 0 && (!b.script || b.script.fired);
    if (cleared && onMap.length) {
      // Area secure: search the rest, carry the wounded home.
      for (const o of b.objs) if (!o.done && !o.lost) { o.done = true; if (o.type === 'cache') b.collected += 1; else b.freed += 1; }
      for (const u of onMap) u.gone = true;
      return conclude(b, 'secured');
    }
    if (!standingCrew.length) {
      if (onMap.length) {
        // Everyone left on the map is down: they bleed out.
        for (const u of onMap) { u.dead = true; b.fx.push({ t: 'die', id: u.id, bled: true }); }
      }
      return conclude(b, crewUnits(b).some((u) => u.gone && !u.dead) ? 'extracted' : 'wiped');
    }
    return false;
  }
  function conclude(b, how) {
    if (b.kind === 'raid') return concludeRaid(b, how);
    const crew = crewUnits(b);
    const done = objectiveDone(b);
    const someProgress = b.collected > 0 || b.freed > 0;
    let outcome;
    if (how === 'wiped') outcome = 'wiped';
    else if (how === 'secured' || done) outcome = 'success';
    else if (someProgress) outcome = 'partial';
    else outcome = 'retreat';
    b.over = {
      outcome, how,
      died: crew.filter((u) => u.dead).map((u) => u.crewId),
      survived: crew.filter((u) => !u.dead).map((u) => ({ crewId: u.crewId, hpLost: (u.maxHp - Math.max(0, u.hp)) / u.maxHp, downed: !!u.wasDowned || u.downed, kills: u.kills || 0 })),
      collected: b.collected, total: b.objs.length, freed: b.freed, surrendered: b.surrendered,
      kills: b.units.filter((u) => u.side === 'enemy' && u.dead).length, turns: b.turn,
    };
    b.fx.push({ t: 'over', outcome });
    return true;
  }
  function retreat(b) {
    if (b.over) return null;
    if (b.kind === 'raid') return fallBack(b);
    if (b.script && !b.script.fired) return 'Not yet. Pilot Light: “The intake is not clear.”';
    // Everyone still standing makes a run for it; the downed who are not carried are left behind.
    for (const u of crewUnits(b).filter((u) => active(u))) {
      if (u.downed) { u.dead = true; b.fx.push({ t: 'die', id: u.id, bled: true }); }
      else { u.gone = true; if (u.carrying) { const v = byId(b, u.carrying); v.gone = true; v.carriedBy = null; } b.fx.push({ t: 'extract', id: u.id }); }
    }
    conclude(b, 'retreated');
    return null;
  }


  // ======================================================================
  // Raids: the battlefield is the waystation itself. Buildings along the
  // bottom edge are the surface rooms; the wall line and watchtowers come
  // from the real rooms. Raiders want to wreck rooms, not just kill.
  // ======================================================================
  const WALL_Y = H - 7, TOWER_Y = H - 6, BLD_Y = H - 1;
  function ensureReachable(b, seeds) {
    const seen = new Set(), q = [];
    for (const [x, y] of seeds) if (b.cover[idx(x, y)] === 0) { seen.add(idx(x, y)); q.push([x, y]); }
    while (q.length) {
      const [x, y] = q.shift();
      for (const [nx, ny] of nbrs(x, y)) {
        if (!inb(nx, ny) || seen.has(idx(nx, ny)) || b.cover[idx(nx, ny)] !== 0) continue;
        seen.add(idx(nx, ny)); q.push([nx, ny]);
      }
    }
    for (let i = 0; i < W * H; i++) if (b.cover[i] === 0 && !seen.has(i)) { b.cover[i] = 1; b.prop[i] = 3; }
  }
  function generateRaidMap(b, r, base) {
    b.cover = new Array(W * H).fill(0);
    b.prop = new Array(W * H).fill(0);
    b.height = new Array(W * H).fill(0);
    b.floor = Array.from({ length: W * H }, () => r.int(0, 3));
    const set = (x, y, v, pr = 0) => { if (inb(x, y)) { b.cover[idx(x, y)] = v; b.prop[idx(x, y)] = pr; } };
    // The wastes beyond the wall: scattered wrecks and one or two ruins.
    for (let i = 0; i < r.int(1, 2); i++) {
      const x0 = r.int(0, W - 3), y0 = r.int(1, WALL_Y - 4);
      for (let k = 0; k < 3; k++) if (r.chance(0.7)) set(x0 + k, y0, 2, r.int(0, 1));
    }
    for (let i = 0; i < r.int(12, 16); i++) {
      const x = r.int(0, W - 1), y = r.int(1, WALL_Y - 2);
      if (b.cover[idx(x, y)] === 0) set(x, y, 1, r.int(0, 2));
    }
    // Buildings: one tile per lot the surface room covers.
    b.raid.rooms = [];
    for (const room of base.rooms) {
      const tiles = [];
      for (let c = room.col; c < room.col + room.w; c++) { const x = Math.min(W - 1, c + 1); set(x, BLD_Y, 2, 4); tiles.push([x, BLD_Y]); }
      b.raid.rooms.push({ roomId: room.id, name: room.name, tiles, wrecked: false });
    }
    // The wall line: stronger walls mean more solid segments. The gate stays open.
    const gate = [5, 6];
    const order = [4, 7, 3, 8, 2, 9, 1, 10, 0, 11];
    const solid = Math.min(order.length, Math.round(base.wallPower * 2));
    order.forEach((x, i) => {
      if (i < solid) set(x, WALL_Y, 2, 6);
      else if (r.chance(0.5)) set(x, WALL_Y, 1, 3);
    });
    for (const x of gate) set(x, WALL_Y, 0);
    if (base.checkpoint) set(5, WALL_Y, 1, 2); // the checkpoint narrows the gate to one gap
    for (const gx of gate) { set(gx, WALL_Y - 1, 0); set(gx, WALL_Y + 1, 0); } // keep the approach to the gate clear
    // Watchtowers stand just inside the wall: high ground, half cover all round.
    b.raid.towers = [];
    for (const col of base.towers) {
      let x = Math.min(W - 1, col + 1);
      if (gate.includes(x)) x = x === 5 ? 4 : 7;
      while (b.raid.towers.some(([tx]) => tx === x) && x < W - 1) x++;
      b.height[idx(x, TOWER_Y)] = 1; set(x, TOWER_Y, 0);
      b.raid.towers.push([x, TOWER_Y]);
    }
    // Turret nests: automatic guns on the wall line's inner side.
    b.raid.nests = [];
    for (const n of base.turrets || []) {
      let x = Math.min(W - 1, n.col + 1);
      while ((b.height[idx(x, TOWER_Y)] || b.raid.nests.some((q) => q.x === x)) && x < W - 1) x++;
      b.raid.nests.push({ x, y: TOWER_Y, level: n.level });
    }
    // Sandbag positions in the yard.
    for (const x of r.shuffle([1, 3, 5, 6, 8, 10]).slice(0, 3)) if (!b.height[idx(x, H - 4)]) set(x, H - 4, 1, 2);
    ensureReachable(b, Array.from({ length: W }, (_, x) => [x, H - 3]));
    b.theme = 'raid';
  }
  function createRaid(spec) {
    const b = { v: 1, rs: spec.seed | 0, turn: 1, phase: 'player', units: [], objs: [], fx: [], log: [], over: null, stims: 1 + spec.crew.filter((c) => c.gear === 'kit').length + ((spec.perks && spec.perks.stims) || 0), perks: spec.perks || {},
      kind: 'raid', site: spec.site, danger: spec.danger || 1, taunt: null, surrendered: 0, freed: 0, collected: 0, script: null, nextE: 0,
      objective: 'defend', raid: { style: spec.style || 'frontal assault', turnLimit: 10, withdrew: false, fled: 0, start: 0 } };
    const r = rng(b);
    generateRaidMap(b, r, spec.base);
    // Defenders: tower crew start up top, everyone else in the yard.
    const towers = b.raid.towers.slice();
    const yard = r.shuffle(openTiles(b, (x, y) => y >= H - 5 && y <= H - 2 && !high(b, x, y)));
    spec.crew.forEach((c, i) => {
      const u = crewUnit(c, i);
      const spot = spec.base.towerCrew.includes(c.id) && towers.length ? towers.shift() : yard.shift();
      u.x = spot[0]; u.y = spot[1];
      b.units.push(u);
    });
    for (const n of b.raid.nests) {
      if (unitAt(b, n.x, n.y)) continue;
      const hp = 7 + n.level * 2;
      b.units.push({ id: `n${n.x}`, side: 'crew', kind: 'turret', name: 'Turret nest', x: n.x, y: n.y, hp, maxHp: hp, aim: 60 + n.level * 4, range: 12, dmg: [2 + n.level - 1, 3 + n.level - 1], armor: 1, ap: 0, mob: 0, dead: false, gone: false, downed: false, cd: {}, uses: {} });
    }
    // Raiders come over the far edge, already moving.
    const owner = spec.owner;
    const str = Math.max(1, owner ? owner.strength : 1);
    const sig = owner ? SIGNATURE[owner.territory % SIGNATURE.length] : 'raider';
    const style = b.raid.style;
    const mix = style === 'siege' ? ['marksman', 'raider', 'raider'] : style === 'sabotage' || style === 'theft' ? ['scav', 'scav', 'raider', 'hound'] : ['raider', 'raider', 'brute', 'scav'];
    const roster = Array.from({ length: spec.count }, (_, i) => (i % 4 === 3 ? sig : r.pick(mix)));
    let spawn = r.shuffle(openTiles(b, (x, y) => y <= 2));
    if (!spawn.length) spawn = r.shuffle(openTiles(b, (x, y) => y < WALL_Y - 1));
    roster.forEach((kind, i) => {
      const u = enemyUnit(kind, b.nextE++, str, owner);
      const [x, y] = spawn[i % spawn.length];
      u.x = x; u.y = y; u.alerted = true; u.pod = Math.floor(i / 3);
      b.units.push(u);
    });
    b.raid.start = roster.length;
    b.fx.push({ t: 'say', text: `${owner ? owner.name : 'Raiders'}${owner ? '’s people are' : ' are'} at the wall: ${roster.length} of them. Hold them off, or fall back to the bunker and let them take what they want.` });
    return b;
  }
  function roomFieldFor(b) {
    // Steps from every open tile to the nearest tile beside a standing building.
    const field = new Map(), q = [];
    for (const room of b.raid.rooms) {
      if (room.wrecked) continue;
      for (const [tx, ty] of room.tiles) for (const [x, y] of nbrs(tx, ty)) {
        if (inb(x, y) && cov(b, x, y) === 0 && !field.has(idx(x, y))) { field.set(idx(x, y), 0); q.push([x, y]); }
      }
    }
    while (q.length) {
      const [x, y] = q.shift();
      const d = field.get(idx(x, y));
      for (const [nx, ny] of nbrs(x, y)) {
        if (!inb(nx, ny) || cov(b, nx, ny) !== 0 || field.has(idx(nx, ny))) continue;
        field.set(idx(nx, ny), d + 1); q.push([nx, ny]);
      }
    }
    return field;
  }
  function roomBeside(b, e) {
    return b.raid.rooms.find((room) => !room.wrecked && room.tiles.some(([x, y]) => hexDist({ x: x, y: y }, e) <= 1));
  }
  function wreck(b, e, room) {
    room.wrecked = true;
    for (const [x, y] of room.tiles) { b.cover[idx(x, y)] = 1; b.prop[idx(x, y)] = 5; }
    const [x, y] = room.tiles[0];
    b.fx.push({ t: 'wreck', id: e.id, x, y, text: `${room.name} wrecked` });
    e.revealed = true;
  }
  // Returns true if the raider's turn was handled here.
  function raidTurn(b, e, r, seen, targets) {
    const shotAt = (x, y) => seen.map((t) => [t, hitChance(b, e, t, { x, y })]).filter(([, c]) => c > 0).sort((a, c) => c[1] - a[1]);
    const adjFoe = targets.find((t) => hexDist(t, e) <= 1);
    if (e.range === 1 && adjFoe) return false; // dogs bite whoever is next to them
    let here = e.range === 1 ? [] : shotAt(e.x, e.y);
    if (here.length && here[0][1] >= 55) { damage(b, e, here[0][0], r); return true; }
    let room = roomBeside(b, e);
    if (room) { wreck(b, e, room); return true; }
    const field = roomFieldFor(b);
    if (!field.size) return false;
    const fd = (x, y) => field.get(idx(x, y)) ?? 99;
    const here0 = fd(e.x, e.y);
    const threats = targets;
    const rc = reach(b, { ...e, ap: 1 });
    let best = null, bestScore = -here0 * 3 + (here.length ? here[0][1] / 25 : 0);
    for (const t of rc.tiles) {
      const sh = e.range === 1 ? [] : shotAt(t.x, t.y);
      const cvr = threats.length ? threats.reduce((n, th) => n + coverFrom(b, t, th.x, th.y), 0) / threats.length : 0;
      const sc = -fd(t.x, t.y) * 3 + cvr * 1.2 + (sh.length ? sh[0][1] / 25 : 0);
      if (sc > bestScore) { best = t; bestScore = sc; }
    }
    if (!best && !here.length) {
      // Nothing useful within one move: run for the buildings.
      const rc2 = reach(b, e);
      const pick = rc2.tiles.slice().sort((a, c) => fd(a.x, a.y) - fd(c.x, c.y))[0];
      if (pick && fd(pick.x, pick.y) < here0) { stepEnemy(b, e, rc2, pick.x, pick.y, r); return true; }
      return false;
    }
    if (best) { stepEnemy(b, e, rc, best.x, best.y, r); if (!active(e)) return true; }
    room = roomBeside(b, e);
    if (room) { wreck(b, e, room); return true; }
    here = e.range === 1 ? [] : shotAt(e.x, e.y);
    if (here.length && here[0][1] >= 20) damage(b, e, here[0][0], r);
    else if (e.range === 1) { const f = targets.find((t) => hexDist(t, e) <= 1); if (f) damage(b, e, f, r); }
    return true;
  }
  function raidMorale(b) {
    const raiders = b.units.filter((u) => u.side === 'enemy');
    const lost = raiders.filter((u) => u.dead || u.gone).length;
    const left = enemies(b);
    if (!left.length) return;
    const allWrecked = b.raid.rooms.length && b.raid.rooms.every((m) => m.wrecked);
    if (lost >= Math.ceil(b.raid.start * 0.6)) {
      for (const e of left) { e.gone = true; e.fled = true; b.raid.fled += 1; b.fx.push({ t: 'flee', id: e.id }); }
      b.fx.push({ t: 'say', text: 'They are breaking! The rest are running for the hills.' });
    } else if (b.turn >= b.raid.turnLimit || allWrecked) {
      b.raid.withdrew = true;
      for (const e of left) { e.gone = true; b.fx.push({ t: 'flee', id: e.id }); }
      b.fx.push({ t: 'say', text: allWrecked ? 'They have wrecked everything up top and are pulling out with what they grabbed.' : 'They are pulling back with whatever they grabbed.' });
    } else if (b.turn === b.raid.turnLimit - 1) b.fx.push({ t: 'say', text: 'They will not stay much longer. One more turn.' });
  }
  function fallBack(b) {
    const r = rng(b);
    // Everyone goes below, the wounded carried down. The raiders help themselves up top.
    for (const u of crewUnits(b).filter((u) => active(u) || u.carriedBy)) {
      u.gone = true; u.carriedBy = null; u.carrying = null;
      b.fx.push({ t: 'extract', id: u.id });
    }
    const standingRooms = r.shuffle(b.raid.rooms.filter((m) => !m.wrecked));
    const raider = enemies(b)[0];
    for (const room of standingRooms.slice(0, Math.min(2, standingRooms.length))) wreck(b, raider || { id: null }, room);
    b.fx.push({ t: 'say', text: 'Everyone is below. Lock the hatch. Pilot Light is listening to them break things.' });
    for (const e of enemies(b)) e.gone = true;
    return concludeRaid(b, 'fellback') && null;
  }
  function concludeRaid(b, how) {
    const crew = crewUnits(b);
    if (how === 'overrun') for (const u of crew.filter((u) => active(u) && u.downed)) u.dead = true;
    const outcome = how === 'repelled' ? 'repelled' : how === 'overrun' ? 'overrun' : 'breached';
    b.over = {
      outcome, how,
      died: crew.filter((u) => u.dead).map((u) => u.crewId),
      survived: crew.filter((u) => !u.dead).map((u) => ({ crewId: u.crewId, hpLost: (u.maxHp - Math.max(0, u.hp)) / u.maxHp, downed: !!u.wasDowned || u.downed, kills: u.kills || 0 })),
      wrecked: b.raid.rooms.filter((m) => m.wrecked).map((m) => m.roomId), rooms: b.raid.rooms.length,
      kills: b.units.filter((u) => u.side === 'enemy' && u.dead).length, fled: b.raid.fled, surrendered: b.surrendered, turns: b.turn,
      collected: 0, total: 0, freed: 0,
    };
    b.fx.push({ t: 'over', outcome });
    return true;
  }

  // ---------- quick resolve for automated play (tests, autoplayer) ----------
  function autoplay(b, maxTurns = 30) {
    let guard = 0;
    while (!b.over && guard++ < maxTurns) {
      if (b.kind === 'raid') {
        // Defend like a careful player: hold cover, shoot what you can, watch the rest; fall back if it is lost.
        const up = crewUnits(b).filter((u) => standing(u));
        if (up.length <= 1 && enemies(b).length >= 3) { retreat(b); break; }
        for (const u of up) {
          if (b.over) break;
          const down = adjacentAllies(b, u, (v) => v.downed)[0];
          if (down && b.stims > 0) { ability(b, u.id, 'stim', down.id); continue; }
          const ts = targets(b, u.id).sort((a, c) => c.chance - a.chance);
          if (ts.length && ts[0].chance >= 30) { shoot(b, u.id, ts[0].id); continue; }
          if (!ts.length && b.turn > 2) {
            // Nobody in sight: step to covered ground nearer the gate.
            const rc = reach(b, { ...u, ap: 1 });
            const pick = rc.tiles.filter((t) => t.ap === 1 && t.y > H - 8).sort((a, c) => (Math.abs(a.x - 5.5) - coverFrom(b, a, 5.5, 0) * 2) - (Math.abs(c.x - 5.5) - coverFrom(b, c, 5.5, 0) * 2))[0];
            if (pick) move(b, u.id, pick.x, pick.y);
          }
          const u2 = byId(b, u.id);
          if (standing(u2) && u2.ap > 0) overwatch(b, u.id);
        }
        if (!b.over) endTurn(b);
        continue;
      }
      for (const u of crewUnits(b).filter((u) => standing(u))) {
        if (b.over) break;
        // Revive anyone downed next to us.
        const down = adjacentAllies(b, u, (v) => v.downed)[0];
        if (down && b.stims > 0) { ability(b, u.id, 'stim', down.id); continue; }
        const ts = targets(b, u.id).sort((a, c) => c.chance - a.chance);
        if (ts.length && ts[0].chance >= 45) { shoot(b, u.id, ts[0].id); continue; }
        // Objectives first, then the nearest visible enemy.
        const goal = b.objs.find((o) => !o.done && !o.lost) || enemies(b).sort((a, c) => dist(u, a) - dist(u, c))[0];
        if (goal) {
          const rc = reach(b, { ...u, ap: 1 });
          const pick = rc.tiles.filter((t) => t.ap === 1).sort((a, c) => (dist(a, goal) - coverFrom(b, a, goal.x, goal.y) * 1.5) - (dist(c, goal) - coverFrom(b, c, goal.x, goal.y) * 1.5))[0];
          if (pick) move(b, u.id, pick.x, pick.y);
        }
        if (b.over) break;
        const u2 = byId(b, u.id);
        if (standing(u2) && u2.ap > 0) { const t2 = targets(b, u.id).sort((a, c) => c.chance - a.chance)[0]; if (t2) shoot(b, u.id, t2.id); else overwatch(b, u.id); }
      }
      if (!b.over) endTurn(b);
    }
    if (!b.over) retreat(b);
    b.fx = [];
    return b.over;
  }

  return {
    W, H, EXTRACT_ROWS, ABILITIES, ENEMY, ROLE_STATS,
    create, reach, pathTo, move, shoot, overwatch, hunker, ability, actions, targets, endTurn, retreat, autoplay,
    hitChance, coverFrom, los, high, visibleEnemies, byId, active, standing, unitAt, inExtract, idx, flanked,
    nbrs, hexDist, dist, hp, fromHp,
  };
})();
