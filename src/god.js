// ============================================================================
// God mode: hidden developer tools, unlocked from Settings with a passphrase.
// Everything here edits plain game state (s) and returns null on success or a
// short message on failure, like the rest of UNM, so the UI can toast it.
// This is a convenience lock for a single-player game, not security: the game
// runs entirely in the player's own browser.
// ============================================================================
UNM.god = (() => {
  const X = UNM._x;
  // SHA-256 of the passphrase. The passphrase itself is not stored in the game.
  const PASS_HASH = '0af839a415565bf26f0baafc58ce585dcee02f7f0619a6b30d68458a145bc5eb';

  function sha256(str) {
    const K = [];
    for (let i = 2, n = 0; n < 64; i++) { let p = true; for (let d = 2; d * d <= i; d++) if (i % d === 0) { p = false; break; } if (p) { K[n++] = (Math.cbrt(i) % 1) * 4294967296 | 0; } }
    const H = [];
    for (let i = 2, n = 0; n < 8; i++) { let p = true; for (let d = 2; d * d <= i; d++) if (i % d === 0) { p = false; break; } if (p) { H[n++] = (Math.sqrt(i) % 1) * 4294967296 | 0; } }
    const bytes = [];
    const u = unescape(encodeURIComponent(str));
    for (let i = 0; i < u.length; i++) bytes.push(u.charCodeAt(i));
    const bitLen = bytes.length * 8;
    bytes.push(0x80);
    while (bytes.length % 64 !== 56) bytes.push(0);
    for (let i = 7; i >= 0; i--) bytes.push(i >= 4 ? 0 : (bitLen >>> (i * 8)) & 255);
    const rr = (x, n) => (x >>> n) | (x << (32 - n));
    for (let o = 0; o < bytes.length; o += 64) {
      const w = [];
      for (let i = 0; i < 16; i++) w[i] = (bytes[o + i * 4] << 24) | (bytes[o + i * 4 + 1] << 16) | (bytes[o + i * 4 + 2] << 8) | bytes[o + i * 4 + 3];
      for (let i = 16; i < 64; i++) {
        const s0 = rr(w[i - 15], 7) ^ rr(w[i - 15], 18) ^ (w[i - 15] >>> 3), s1 = rr(w[i - 2], 17) ^ rr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
      }
      let [a, b, c, d, e, f, g, h] = H;
      for (let i = 0; i < 64; i++) {
        const t1 = (h + (rr(e, 6) ^ rr(e, 11) ^ rr(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) | 0;
        const t2 = ((rr(a, 2) ^ rr(a, 13) ^ rr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
      H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
    }
    return H.map((x) => (x >>> 0).toString(16).padStart(8, '0')).join('');
  }
  const check = (pw) => sha256(String(pw || '').trim()) === PASS_HASH;

  const FLAGS = {
    invincible: ['Invincible squad', 'Crew take no damage in battle.'],
    sureHit: ['Never miss', 'Every crew shot hits.'],
    oneHit: ['One-hit kills', 'Any hit that lands kills an enemy.'],
    freeBuild: ['Free, instant building', 'Rooms cost nothing and finish at once.'],
    infinite: ['Infinite resources', 'Buttons, salvage, food and water stay at 9999+, storage caps lifted.'],
    undying: ['No game over', 'The waystation cannot be lost to raids, hunger or an empty purse.'],
  };
  const g = (s) => (s.god = s.god || {});
  // Point the battle rules at this save's flags (or at nothing).
  function sync(s) { TAC.god = s && s.god ? s.god : null; }
  function toggle(s, flag) {
    if (!FLAGS[flag]) return 'No such switch.';
    g(s)[flag] = !g(s)[flag];
    if (flag === 'infinite') X.clampRes(s);
    sync(s);
    return null;
  }

  const num = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.round(Number(v)))); // NaN falls through below
  const bad = (v) => !Number.isFinite(Number(v));
  function setRes(s, kind, v) {
    if (!['buttons', 'salvage', 'food', 'water'].includes(kind) || bad(v)) return 'Pick a number.';
    s.res[kind] = num(v, 0, 99999);
    return null;
  }
  function setRep(s, v) { if (bad(v)) return 'Pick a number.'; s.rep = num(v, 0, 100); return null; }
  function setTrust(s, level) {
    if (bad(level)) return 'Pick a number.';
    const L = num(level, 1, UNM.TRUST_LEVELS.length);
    s.trust.points = Math.max(s.trust.points, UNM.TRUST_LEVELS[L - 1].at);
    if (L < s.trust.level) { s.trust.points = UNM.TRUST_LEVELS[L - 1].at; s.trust.best = L; s.trust.level = L; }
    UNM.updateTrust(s);
    return null;
  }
  function setDay(s, v) { if (bad(v)) return 'Pick a number.'; s.day = num(v, 1, 9999); return null; }
  function setDifficulty(s, d) { if (!UNM.DIFFICULTY[d]) return 'No such difficulty.'; s.difficulty = d; return null; }
  function ironmanOff(s) { s.ironman = false; return null; }

  // ---------- crew ----------
  const crewOf = (s, id) => s.crew.find((c) => c.id === id);
  function addRecruit(s, role, level) {
    const c = X.makeRecruit(s);
    if (role && role !== 'recruit' && UNM.roleById(role)) c.role = role;
    c.level = num(level || 1, 1, 20);
    s.crew.push(c);
    return null;
  }
  function setLevel(s, id, v) { const c = crewOf(s, id); if (!c) return 'No such person.'; c.level = num(c.level + Number(v), 1, 20); if (c.level >= 2 && c.role === 'recruit' && !s.pendingRoleChoice.includes(c.id)) s.pendingRoleChoice.push(c.id); return null; }
  function setRole(s, id, role) {
    const c = crewOf(s, id);
    if (!c) return 'No such person.';
    if (role !== 'recruit' && !UNM.roleById(role)) return 'No such role.';
    c.role = role; s.pendingRoleChoice = s.pendingRoleChoice.filter((x) => x !== id);
    return null;
  }
  function heal(c) { c.injured = 0; c.morale = 100; c.alive = true; c.left = false; if (c.away) { /* leave them on the mission */ } }
  function healCrew(s, id) { const c = crewOf(s, id); if (!c) return 'No such person.'; heal(c); return null; }
  function healAll(s) { for (const c of s.crew) if (c.alive || !c.left) heal(c); return null; }
  function dismiss(s, id) { const c = crewOf(s, id); if (!c) return 'No such person.'; for (const r of s.rooms) if (c.job === r.id) c.job = null; s.crew = s.crew.filter((x) => x !== c); return null; }
  function staffAll(s) {
    for (const r of s.rooms) {
      const t = UNM.ROOM_TYPES[r.type];
      if (r.state !== 'working' || !t.staff) continue;
      for (const c of s.crew.filter((x) => x.alive && !x.away && !x.job)) {
        if (UNM.workersIn(s, r.id).length >= t.staff) break;
        c.job = r.id;
      }
    }
    UNM.tutorialCheck(s);
    return null;
  }

  // ---------- rooms ----------
  function build(s, type, row, col) {
    const t = UNM.ROOM_TYPES[type];
    if (!t || !t.cost) return 'That cannot be built.';
    if ((row === 0) !== (t.level === 'surface')) return t.level === 'surface' ? 'That goes above ground.' : 'That goes below ground.';
    if (!UNM.slotFree(s, row, col, t.w)) return 'Not enough room there.';
    if (t.unique && s.rooms.some((r) => r.type === type)) return `You already have a ${t.name}.`;
    s.nextRoom = (s.nextRoom || 100) + 1;
    s.rooms.push({ id: `r${s.nextRoom}`, type, row, col, state: 'working', level: 1, buildLeft: 0, free: false });
    UNM.tutorialCheck(s);
    return null;
  }
  // First free slot for a room type, scanning dug rows.
  function buildAnywhere(s, type) {
    const t = UNM.ROOM_TYPES[type];
    if (!t || !t.cost) return 'That cannot be built.';
    const rows = t.level === 'surface' ? [0] : Array.from({ length: s.dug }, (_, i) => i + 1);
    for (const row of rows) for (let col = 0; col + t.w <= UNM.COLS; col++) if (UNM.slotFree(s, row, col, t.w)) return build(s, type, row, col);
    return t.level === 'surface' ? 'No free lot above ground.' : 'No free lot below ground. Dig deeper first.';
  }
  function repairAll(s) { for (const r of s.rooms) if (r.state === 'ruined' || r.state === 'damaged') { r.state = 'working'; r.free = false; } UNM.tutorialCheck(s); return null; }
  function finishBuilds(s) { for (const r of s.rooms) if (r.state === 'building') { r.state = 'working'; r.buildLeft = 0; } UNM.tutorialCheck(s); return null; }
  function setRoomLevel(s, id, v) {
    const r = s.rooms.find((x) => x.id === id);
    if (!r || ['sealed_door', 'team_management', 'vault'].includes(r.type)) return 'That room has no levels.';
    r.level = num(r.level + Number(v), 1, 3);
    return null;
  }
  function maxRooms(s) { for (const r of s.rooms) if (!['sealed_door', 'team_management', 'vault'].includes(r.type)) r.level = 3; return null; }
  function demolish(s, id) {
    const r = s.rooms.find((x) => x.id === id);
    if (!r || r.type === 'sealed_door') return 'Cannot clear that.';
    for (const c of s.crew) if (c.job === r.id) c.job = null;
    s.rooms = s.rooms.filter((x) => x !== r);
    return null;
  }
  function setDug(s, n) { s.dug = num(n, 0, UNM.MAX_UNDER); return null; }

  // ---------- plans, gear ----------
  function unlockTech(s) { const st = X.techState(s); st.done = UNM.TECH.map((t) => t.id); st.current = null; return null; }
  function relockTech(s) { const st = X.techState(s); st.done = []; st.current = null; return null; }
  function finishResearch(s) { const st = X.techState(s); if (!st.current) return 'Nothing is being researched.'; if (!st.done.includes(st.current.id)) st.done.push(st.current.id); st.current = null; return null; }
  function giveGear(s, type) { if (!UNM.GEAR[type]) return 'No such gear.'; X.gainGear(s, X.rng(s), type); return null; }

  // ---------- missions, warlords, story ----------
  function addMission(s, kind, danger) {
    if (!['salvage', 'rescue', 'combat', 'elite'].includes(kind)) return 'No such mission.';
    s.missions.push(X.makeMission(s, kind, { danger: num(danger || 1, 1, 5), far: false, expiresIn: 9 }));
    return null;
  }
  function refreshMissions(s) { X.refreshMissions(s); return null; }
  function clearMissions(s) { s.missions = s.missions.filter((m) => m.status !== 'open'); return null; }
  const warlordOf = (s, id) => s.warlords.find((w) => w.id === id);
  function setDisposition(s, id, v) { const w = warlordOf(s, id); if (!w) return 'No such warlord.'; if (bad(v)) return 'Pick a number.'; w.disposition = num(v, -100, 100); return null; }
  function befriendAll(s) { for (const w of s.warlords) if (w.alive) w.disposition = 100; return null; }
  function removeWarlord(s, id) { const w = warlordOf(s, id); if (!w || !w.alive) return 'No such warlord.'; UNM.eliminateWarlord(s, id); return null; }
  function raidTonight(s, id) { const w = warlordOf(s, id); if (!w || !w.alive) return 'No such warlord.'; g(s).forceRaid = id; return null; }
  function storyDone(s) {
    const st = UNM.storyState(s);
    st.pieces = 3; st.calls = Math.max(st.calls, 99);
    s.trust.points = Math.max(s.trust.points, UNM.TRUST_LEVELS[4].at); UNM.updateTrust(s);
    return null;
  }
  function unlockVault(s) { storyDone(s); return UNM.openVault(s); }

  // ---------- battle ----------
  function healSquad(s) {
    const b = s.battle; if (!b) return 'No battle is on.';
    for (const u of b.units) if (u.side === 'crew' && u.kind !== 'turret' && !u.dead) { u.hp = u.maxHp; u.downed = false; u.bleed = 0; }
    return null;
  }
  function winBattle(s) {
    const b = s.battle; if (!b) return 'No battle is on.';
    if (b.over) return 'The fight is already over.';
    // Scripted fights (the tutorial) need their story beat to fire first, so play turns out until it concludes.
    for (let i = 0; i < 4 && !b.over; i++) {
      for (const u of b.units) if (u.side === 'enemy' && TAC.active(u)) { u.dead = true; u.hp = 0; }
      if (TAC.checkEnd(b)) break;
      TAC.endTurn(b);
    }
    return null;
  }

  function skipTutorial(s) { UNM.skipTutorial(s); return null; }
  function reset(s) { s.god = {}; sync(s); return null; }

  return {
    FLAGS, check, sha256, sync, toggle, reset, skipTutorial,
    setRes, setRep, setTrust, setDay, setDifficulty, ironmanOff,
    addRecruit, setLevel, setRole, healCrew, healAll, dismiss, staffAll,
    build, buildAnywhere, repairAll, finishBuilds, setRoomLevel, maxRooms, demolish, setDug,
    unlockTech, relockTech, finishResearch, giveGear,
    addMission, refreshMissions, clearMissions, setDisposition, befriendAll, removeWarlord, raidTonight, storyDone, unlockVault,
    healSquad, winBattle,
  };
})();
