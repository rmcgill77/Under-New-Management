// ============================================================================
// Under New Management — game rules (pure: no DOM, no canvas).
// Everything random draws from the seeded generator stored in state.rng so a
// save always replays the same way. Content ids are append-only.
// ============================================================================
const UNM = (() => {
  const SAVE_VERSION = 1;

  // ---------- seeded RNG (state lives in the game state) ----------
  function hashSeed(input) {
    const str = String(input);
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h >>> 0;
  }
  function rng(s) {
    function next() {
      s.rng = (s.rng + 0x6d2b79f5) >>> 0;
      let t = s.rng;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    return {
      next,
      int: (a, b) => a + Math.floor(next() * (b - a + 1)),
      chance: (p) => next() < p,
      pick: (l) => l[Math.floor(next() * l.length)],
      shuffle(l) { const o = l.slice(); for (let i = o.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); [o[i], o[j]] = [o[j], o[i]]; } return o; },
    };
  }

  // ---------- content ----------
  const COLS = 10;
  const MAX_UNDER = 4; // underground rows the base can grow to (size limit)
  const BEDS_PER_QUARTERS = 4; // two bunk beds, each sleeping two
  const LEVEL_MULT = [0, 1, 1.5, 2];

  // staff: max workers. power: daily draw when running. tier: tech-tree tier.
  const ROOM_TYPES = {
    guest_room: { name: 'Guest Rooms', level: 'surface', w: 2, cost: { buttons: 14, salvage: 10 }, days: 2, staff: 1, power: 1, branch: 'Hospitality', blurb: 'Beds for travelers, one night or an extended stay. Four guests per level.' },
    bar: { name: 'Bar & Kitchen', level: 'surface', w: 2, cost: { buttons: 16, salvage: 10 }, days: 2, staff: 2, power: 1, branch: 'Hospitality', blurb: 'Patrons eat and drink here. Uses food and water.' },
    entertainment: { name: 'Card Room', level: 'surface', w: 2, cost: { buttons: 24, salvage: 16 }, days: 3, staff: 1, power: 2, branch: 'Hospitality', needsBuilt: 'bar', tech: 'h3', blurb: 'Gambling for patrons; a live stage at level 3. Raises crew morale.' },
    wall: { name: 'Wall', level: 'surface', w: 1, cost: { buttons: 6, salvage: 12 }, days: 1, staff: 0, power: 0, branch: 'Defense', blurb: 'Keeps raiders at the gate. Adds defense.' },
    watchtower: { name: 'Watchtower', level: 'surface', w: 1, cost: { buttons: 10, salvage: 12 }, days: 2, staff: 2, power: 0, branch: 'Defense', blurb: 'Guards posted here spot raids early and fight from height.' },
    generator: { name: 'Generator', level: 'under', w: 1, cost: { buttons: 12, salvage: 14 }, days: 2, staff: 2, power: 0, branch: 'Power & Water', blurb: 'Makes power for every other room. Needs someone to tend it.' },
    water_pump: { name: 'Water Pump', level: 'under', w: 1, cost: { buttons: 10, salvage: 10 }, days: 2, staff: 2, power: 1, branch: 'Power & Water', blurb: 'Pulls water from the old aquifer.' },
    food: { name: 'Grow Room', level: 'under', w: 2, cost: { buttons: 12, salvage: 10 }, days: 2, staff: 2, power: 1, branch: 'Food', blurb: 'Grows food under lamps. Drinks water.' },
    clinic: { name: 'Clinic', level: 'under', w: 1, cost: { buttons: 14, salvage: 8 }, days: 2, staff: 1, power: 1, branch: 'Crew & Operations', blurb: 'Patches up the injured twice as fast when staffed.' },
    crew_quarters: { name: 'Crew Quarters', level: 'under', w: 1, cost: { buttons: 10, salvage: 8 }, days: 1, staff: 0, power: 0, branch: 'Crew & Operations', blurb: 'Two bunk beds, each sleeping two: room for four crew.' },
    team_management: { name: 'Team Room', level: 'under', w: 1, cost: { buttons: 12, salvage: 6 }, days: 1, staff: 0, power: 0, branch: 'Crew & Operations', unique: true, blurb: 'Maps, radio and a chalkboard. Teams leave on missions from here.' },
    storage: { name: 'Storage', level: 'under', w: 1, cost: { buttons: 8, salvage: 8 }, days: 1, staff: 0, power: 0, branch: 'Crew & Operations', blurb: 'Raises how much food, water and salvage you can keep.' },
    workshop: { name: 'Workshop', level: 'under', w: 1, cost: { buttons: 14, salvage: 12 }, days: 2, staff: 1, power: 1, branch: 'Crew & Operations', tech: 'c4', blurb: 'Strips scrap for salvage when staffed. Cuts repair costs.' },
    bathhouse: { name: 'Bathhouse', level: 'surface', w: 2, cost: { buttons: 26, salvage: 18 }, days: 3, staff: 1, power: 1, branch: 'Hospitality', tech: 'h5', blurb: 'Hot water and a door that locks. Guests pay more, the crew feels human again.' },
    checkpoint: { name: 'Gate Checkpoint', level: 'surface', w: 1, cost: { buttons: 14, salvage: 16 }, days: 2, staff: 1, power: 0, branch: 'Defense', tech: 'd3', blurb: 'A manned gate. Fewer raids, and in a raid the gate narrows to one gap.' },
    turret_nest: { name: 'Turret Nest', level: 'surface', w: 1, cost: { buttons: 20, salvage: 22 }, days: 2, staff: 0, power: 1, branch: 'Defense', tech: 'd4', blurb: 'An old gun on a new mount. Fights on its own in raids.' },
    purifier: { name: 'Purifier', level: 'under', w: 1, cost: { buttons: 18, salvage: 14 }, days: 2, staff: 1, power: 2, branch: 'Power & Water', tech: 'p3', blurb: 'Clean water. More of it, and patrons pay extra for a glass that does not glow.' },
    cold_storage: { name: 'Cold Storage', level: 'under', w: 1, cost: { buttons: 12, salvage: 12 }, days: 1, staff: 0, power: 1, branch: 'Food', tech: 'f3', blurb: 'Keeps far more food. Needs power.' },
    armory: { name: 'Armory', level: 'under', w: 1, cost: { buttons: 18, salvage: 18 }, days: 2, staff: 1, power: 0, branch: 'Crew & Operations', tech: 'c3', blurb: 'Every squad leaves with an extra stim, and the crew can make gear here.' },
    messenger_post: { name: 'Messenger Post', level: 'surface', w: 1, cost: { buttons: 12, salvage: 8 }, days: 1, staff: 1, power: 0, branch: 'Diplomacy', tech: 'x1', blurb: 'Riders and pigeons. Better haggling, cheaper tribute, warmer gifts.' },
    meeting_hall: { name: 'Meeting Hall', level: 'under', w: 2, cost: { buttons: 22, salvage: 14 }, days: 2, staff: 1, power: 1, branch: 'Diplomacy', tech: 'x2', blurb: 'Neutral ground. Pacts come easier and plots stay quieter.' },
    informants: { name: 'Informant Network', level: 'under', w: 1, cost: { buttons: 24, salvage: 10 }, days: 2, staff: 1, power: 0, branch: 'Diplomacy', tech: 'x3', blurb: 'Ears in every camp. Warns you of raids in the morning and keeps your plots secret.' },
    vault: { name: 'Vault Control Room', level: 'under', w: 1, cost: null, days: 0, staff: 0, power: 0, branch: 'The vault', blurb: 'Screens that never went dark. A map of red dots, and a light in the sky that is getting closer.' },
    sealed_door: { name: 'Sealed Door', level: 'under', w: 1, cost: null, days: 0, staff: 0, power: 0, branch: 'Unknown', blurb: 'Heavy, old, and humming faintly. Pilot Light changes the subject whenever you ask.' },
  };
  const BUILDABLE = Object.keys(ROOM_TYPES).filter((k) => k !== 'sealed_door');

  const ROLES = [
    { id: 'bulwark', name: 'Bulwark', archetype: 'Tank', summary: 'Heavy unit that taunts enemies into taking fire.', field: 4, guard: 4, job: 'watchtower' },
    { id: 'longshot', name: 'Longshot', archetype: 'Marksman', summary: 'Long-range sniper. Low health, high damage.', field: 4, guard: 3, job: 'watchtower' },
    { id: 'drifter', name: 'Drifter', archetype: 'Scout', summary: 'All-rounder. Medium defense and attack. Finds more salvage.', field: 3, guard: 2, job: null },
    { id: 'sawbones', name: 'Sawbones', archetype: 'Medic', summary: 'Heals, and has a long-range revive shot once per mission.', field: 2, guard: 1, job: 'clinic' },
    { id: 'tinker', name: 'Tinker', archetype: 'Tech', summary: 'Robots, turrets and lasers. Better at generators and the workshop.', field: 3, guard: 3, job: 'generator' },
  ];
  const roleById = (id) => ROLES.find((r) => r.id === id);

  const FIRST = ['Wren', 'Pike', 'Della', 'Otis', 'Marlow', 'Kit', 'Bram', 'Noor', 'Cass', 'Ezra', 'Lux', 'Hale', 'Ivy', 'Rourke', 'Sunny', 'Tobias', 'June', 'Abe', 'Mina', 'Silas', 'Rhea', 'Gus', 'Odette', 'Fenn'];
  const LAST = ['Vance', 'Okafor', 'Reyes', 'Lindqvist', 'Mercer', 'Tran', 'Doyle', 'Haddad', 'Kowal', 'Ames', 'Quill', 'Brandt', 'Sato', 'Mbeki', 'Fry', 'Castellan'];

  // ---------- warlords ----------
  const TEMPERAMENTS = ['aggressive', 'friendly', 'scheming', 'neutral'];
  const DISPOSITION = { aggressive: [-80, -40], scheming: [-20, 30], neutral: [-10, 20], friendly: [40, 70] };
  const ARCHETYPES = {
    aggressive: ['The Zealot', 'The Butcher', 'The Iron Fist'],
    friendly: ['The Host', 'The Shepherd', 'The Old Soldier'],
    scheming: ['The Schemer', 'The Broker', 'The Tollkeeper'],
    neutral: ['The Tollkeeper', 'The Hermit King', 'The Quartermaster'],
  };
  const W_FIRST = ['Mags', 'Corvin', 'Dusty', 'Ash', 'Brannock', 'Vela', 'Hollis', 'Rook', 'Juno', 'Sable', 'Tamsin', 'Garrick'];
  const W_EPITHET = ['the Red', 'Two-Rivers', 'of the Salt Flats', 'the Patient', 'Ironjaw', 'the Lantern', 'Half-Mile', 'the Quiet', 'Rustcrown', 'of the Long Road'];
  const W_RESOURCES = ['water', 'fuel', 'food', 'salvage routes', 'recruits'];
  const W_WANTS = ['tribute', 'protection', 'rest for their people', 'loyalty'];
  const W_RAIDS = ['frontal assault', 'sabotage', 'theft', 'siege'];
  const W_COLORS = ['#b4532a', '#6f8a3c', '#3f6f8a', '#8a6a2f', '#7a3f6f', '#4f7f70'];

  function makeWarlord(r, id, temperament, territory, day) {
    const [lo, hi] = DISPOSITION[temperament];
    return {
      id, temperament, territory, day,
      name: `${r.pick(W_FIRST)} ${r.pick(W_EPITHET)}`,
      archetype: r.pick(ARCHETYPES[temperament]),
      resource: r.pick(W_RESOURCES), wants: r.pick(W_WANTS),
      raidStyle: temperament === 'aggressive' ? r.pick(['frontal assault', 'siege']) : r.pick(W_RAIDS),
      disposition: r.int(lo, hi), strength: 1 + Math.floor(Math.max(0, day - 1) / 10),
      color: W_COLORS[territory % W_COLORS.length], alive: true, giftedDay: 0,
      stance: 'neutral', hold: 100,
    };
  }
  function enforceFriendliest(list) {
    const friendly = list.filter((w) => w.alive && w.temperament === 'friendly');
    if (!friendly.length) return;
    const warm = friendly.reduce((a, b) => (b.disposition > a.disposition ? b : a));
    const others = list.filter((w) => w.alive && w !== warm);
    const top = Math.max(-101, ...others.map((w) => w.disposition));
    if (warm.disposition <= top) warm.disposition = Math.min(100, top + 1);
    for (const w of others) if (w.disposition >= warm.disposition) w.disposition = warm.disposition - 1;
  }
  function checkGuarantees(list, vacant = 0) {
    const living = list.filter((w) => w.alive);
    const p = [];
    if (living.length + vacant < 4 || living.length + vacant > 5 || living.length < 3) p.push('count');
    if (!living.some((w) => w.temperament === 'aggressive')) p.push('aggressive');
    const top = Math.max(...living.map((w) => w.disposition));
    const at = living.filter((w) => w.disposition === top);
    if (at.length !== 1 || at[0].temperament !== 'friendly') p.push('friendliest');
    return p;
  }
  function generateWarlords(s) {
    const r = rng(s);
    const count = r.int(4, 5);
    const temps = ['aggressive', 'friendly'];
    while (temps.length < count) temps.push(r.pick(TEMPERAMENTS));
    const list = r.shuffle(temps).map((t, i) => makeWarlord(r, `w${i + 1}`, t, i, 1));
    enforceFriendliest(list);
    return list;
  }
  function raidChance(w, day) {
    if (!w.alive || day < 5 || w.stance === 'pact') return 0; // grace period; pacts mean no raids
    const hostility = Math.max(0, -w.disposition) / 100;
    const base = w.temperament === 'aggressive' ? 0.05 : 0.012;
    return Math.min(0.4, (base + hostility * 0.09 + (w.strength - 1) * 0.01) * (w.stance === 'oppose' ? 1.6 : 1));
  }
  // Keep relationships inside [-100, 100] and the friendliest guarantee true.
  function nudge(s, id, amount) {
    const w = s.warlords.find((x) => x.id === id);
    if (!w) return;
    w.disposition = Math.max(-100, Math.min(100, w.disposition + amount));
    if (w.temperament !== 'friendly' && amount > 0) {
      const warm = s.warlords.filter((x) => x.alive && x.temperament === 'friendly').reduce((a, b) => (b.disposition > a.disposition ? b : a), { disposition: -999 });
      if (w.disposition >= warm.disposition) w.disposition = warm.disposition - 1;
    }
    enforceFriendliest(s.warlords);
  }

  // ---------- crew ----------
  // First names stay distinct among the living crew and the people at the bar.
  function uniqueName(s, r) {
    const taken = new Set([...s.crew.filter((c) => c.alive), ...s.travelers].map((c) => c.name.split(' ')[0]));
    let first = r.pick(FIRST);
    for (let i = 0; i < 12 && taken.has(first); i++) first = r.pick(FIRST);
    return `${first} ${r.pick(LAST)}`;
  }
  // Where a recruit comes from: a warlord's people, weighted by how they feel about you.
  // Nobody comes from a warlord who hates you.
  function pickOrigin(s, r) {
    const pool = (s.warlords || []).filter((w) => w.alive && w.disposition > -40);
    if (!pool.length || r.chance(0.25)) return null;
    const weights = pool.map((w) => ((w.disposition + 60) / 100) ** 2 * (w.stance === 'pact' ? 1.5 : 1));
    let x = r.next() * weights.reduce((a, b) => a + b, 0);
    for (let i = 0; i < pool.length; i++) { x -= weights[i]; if (x <= 0) return pool[i]; }
    return pool[pool.length - 1];
  }
  // ---------- who people were before they walked in ----------
  const BIO = {
    was: ['a salvage diver in the drowned malls', 'a caravan guard on the salt road', 'a medic for a travelling preacher', 'a tinker who fixed radios for food', 'a farmer until the well went bad', 'a cook in a raider camp, by force', 'a courier who knew every shortcut', 'a scavenger working the old rail yards', 'a fighter in the pit at Cinder Flats', 'a schoolteacher in a bunker town', 'a mechanic for a convoy that never came back', 'a well-digger', 'a trapper in the scrub hills', 'a bartender at a waystation that burned', 'a lookout on a water tower for six years', 'a junk trader with a talking parrot, briefly', 'one of a warlord’s runners', 'a grave-digger, which kept them busy', 'a card sharp who got caught', 'raised by scavengers in a stalled train'],
    left: ['The settlement was raided and they were the only one to walk out.', 'Their crew split the take and left them in the desert.', 'They owe someone dangerous a lot of buttons.', 'The water ran out where they were.', 'They are looking for a sister who went west.', 'They got tired of answering to a warlord.', 'A fever took their family; they could not stay.', 'They were exiled for something they will not talk about.', 'They heard the waystation was hiring and walked for nine days.', 'Their old boss died and nobody needed them after.', 'They want somewhere with a roof and a door that locks.', 'They are running from a debt, or maybe a marriage.', 'A storm took their wagon and everything in it.', 'They just like to keep moving, until now.'],
    quirk: ['Hums the same three notes all day.', 'Will not eat anything that has been in a can.', 'Keeps a dried flower in their breast pocket.', 'Counts their buttons every night, twice.', 'Swears they can smell rain a day out.', 'Talks to machines and claims they answer.', 'Laughs at exactly the wrong moments.', 'Sleeps with their boots on.', 'Collects bottle caps, though they are worthless now.', 'Writes letters to people who are probably dead.', 'Refuses to sit with their back to a door.', 'Knows a story for every scar.', 'Cheats at cards and is bad at it.', 'Is always the first awake.', 'Prays to something nobody else has heard of.', 'Will not shut up about the old world, which they never saw.'],
  };
  function makeBio(r, from) {
    const was = r.pick(BIO.was), left = r.pick(BIO.left), quirk = r.pick(BIO.quirk);
    return `Was ${was}${from ? ` in ${from.name}’s country` : ''}. ${left} ${quirk}`;
  }
  // A person's look: skin, hair colour, clothes colour, build, age, hair style, facial hair, a mark,
  // an accessory and a kind of top. Older people go grey; scars and patches come with the road.
  function makeLook(r) {
    const age = r.chance(0.2) ? 0 : r.chance(0.78) ? 1 : 2;
    return {
      skin: r.int(0, 5), hair: r.int(0, 5), coat: r.int(0, 5),
      build: r.chance(0.25) ? 0 : r.chance(0.72) ? 1 : 2, age,
      style: r.int(0, 9), facial: age === 0 ? (r.chance(0.7) ? 0 : 1) : r.chance(0.45) ? 0 : r.int(1, 4),
      mark: r.chance(0.6) ? 0 : r.int(1, 4), acc: r.chance(0.45) ? 0 : r.int(1, 4), top: r.int(0, 4),
    };
  }
  function makeRecruit(s, extra = {}) {
    const r = rng(s);
    const from = 'origin' in extra ? null : pickOrigin(s, r);
    s.nextId = (s.nextId || 1) + 1;
    return {
      id: `c${s.nextId}`, name: uniqueName(s, r),
      role: 'recruit', level: 1, xp: 0, morale: 70, injured: 0, alive: true, custom: false,
      look: makeLook(r), bio: makeBio(r, from), job: null, away: null, gear: null,
      origin: from ? from.id : null, ...(from && from.disposition > 40 ? { morale: 80 } : {}),
      ...extra,
    };
  }
  const living = (s) => s.crew.filter((c) => c.alive);
  const atHome = (s) => s.crew.filter((c) => c.alive && !c.away);
  function bedCount(s) {
    return s.rooms.filter((r) => r.type === 'crew_quarters' && r.state === 'working').reduce((n, r) => n + BEDS_PER_QUARTERS * r.level, 0);
  }
  function addXp(s, c, n) {
    c.xp += n;
    while (c.xp >= 100) {
      c.xp -= 100; c.level += 1;
      log(s, `${c.name} reached level ${c.level}.`, 'good');
      if (c.role === 'recruit' && !s.pendingRoleChoice.includes(c.id)) s.pendingRoleChoice.push(c.id);
    }
  }
  function chooseRole(s, crewId, roleId) {
    const c = s.crew.find((x) => x.id === crewId);
    if (!c || c.role !== 'recruit' || c.level < 2 || !roleById(roleId)) return false;
    c.role = roleId;
    s.pendingRoleChoice = s.pendingRoleChoice.filter((id) => id !== crewId);
    log(s, `${c.name} is now a ${roleById(roleId).name}.`, 'good');
    return true;
  }

  // ---------- rooms ----------
  function roomAt(s, row, col) {
    return s.rooms.find((r) => r.row === row && col >= r.col && col < r.col + ROOM_TYPES[r.type].w);
  }
  function slotFree(s, row, col, w) {
    if (col < 0 || col + w > COLS) return false;
    if (row > s.dug) return false;
    for (let c = col; c < col + w; c++) if (roomAt(s, row, c)) return false;
    return true;
  }
  function workersIn(s, roomId) { return s.crew.filter((c) => c.alive && !c.away && c.injured === 0 && c.job === roomId); }
  function costOf(s, typeId, kind = 'build', room) {
    const base = ROOM_TYPES[typeId].cost;
    if (!base) return null;
    const workshop = s.rooms.some((r) => r.type === 'workshop' && r.state === 'working');
    let mult = kind === 'repair' ? 0.5 : kind === 'upgrade' ? 1 + (room ? room.level : 1) * 0.75 : 1;
    if (workshop && kind !== 'build') mult *= 0.75;
    return { buttons: Math.ceil(base.buttons * mult), salvage: Math.ceil(base.salvage * mult) };
  }
  const canPay = (s, cost) => !!cost && s.res.buttons >= cost.buttons && s.res.salvage >= cost.salvage;
  function pay(s, cost) { s.res.buttons -= cost.buttons; s.res.salvage -= cost.salvage; }

  function buildRoom(s, typeId, row, col) {
    const t = ROOM_TYPES[typeId];
    if (!t || !t.cost) return 'That cannot be built.';
    if ((row === 0) !== (t.level === 'surface')) return t.level === 'surface' ? 'That goes above ground.' : 'That goes below ground.';
    if (!slotFree(s, row, col, t.w)) return 'Not enough room there.';
    if (t.unique && s.rooms.some((r) => r.type === typeId)) return `You already have a ${t.name}.`;
    if (t.needsBuilt && !s.rooms.some((r) => r.type === t.needsBuilt && r.state === 'working')) return `Needs a working ${ROOM_TYPES[t.needsBuilt].name} first.`;
    if (!hasTech(s, t.tech)) return `Needs the ${techById(t.tech).name} plans.`;
    const cost = costOf(s, typeId, 'build');
    if (!canPay(s, cost)) return 'Not enough silver buttons or salvage.';
    pay(s, cost);
    s.nextRoom = (s.nextRoom || 100) + 1;
    s.rooms.push({ id: `r${s.nextRoom}`, type: typeId, row, col, state: 'building', level: 1, buildLeft: t.days, free: false });
    log(s, `Work started on a ${t.name}. Ready in ${t.days} day${t.days > 1 ? 's' : ''}.`);
    tutorialCheck(s);
    return null;
  }
  function repairRoom(s, roomId) {
    const room = s.rooms.find((r) => r.id === roomId);
    if (!room || (room.state !== 'ruined' && room.state !== 'damaged')) return 'Nothing to repair.';
    if (!room.free) {
      const cost = costOf(s, room.type, 'repair', room);
      if (!canPay(s, cost)) return 'Not enough silver buttons or salvage.';
      pay(s, cost);
    }
    room.state = 'working'; room.free = false;
    log(s, `${ROOM_TYPES[room.type].name} repaired.`, 'good');
    tutorialCheck(s);
    return null;
  }
  function upgradeRoom(s, roomId) {
    const room = s.rooms.find((r) => r.id === roomId);
    if (!room || room.state !== 'working' || room.level >= 3) return 'Cannot upgrade.';
    if (['sealed_door', 'team_management'].includes(room.type)) return 'Cannot upgrade.';
    const need = (LEVEL_TECH[room.type] || [])[room.level - 1];
    if (need && !hasTech(s, need)) return `Needs the ${techById(need).name} plans.`;
    const cost = costOf(s, room.type, 'upgrade', room);
    if (!canPay(s, cost)) return 'Not enough silver buttons or salvage.';
    pay(s, cost);
    room.level += 1;
    log(s, `${ROOM_TYPES[room.type].name} upgraded to level ${room.level}.`, 'good');
    return null;
  }
  function demolishRoom(s, roomId) {
    const room = s.rooms.find((r) => r.id === roomId);
    if (!room || room.type === 'sealed_door') return 'Cannot clear that.';
    if (s.tutorial && s.tutorial.step < TUTORIAL_ROOM_STEPS && TUTORIAL_ROOMS.some((x) => x[0] === room.type)) return 'Pilot Light needs that one for now. Keep it until the basics are done.';
    for (const c of s.crew) if (c.job === room.id) c.job = null;
    s.rooms = s.rooms.filter((r) => r !== room);
    s.res.salvage += 3;
    log(s, `${ROOM_TYPES[room.type].name} cleared. You saved 3 salvage from it.`);
    return null;
  }
  function digCost(s) { return { buttons: 10 + s.dug * 8, salvage: 15 + s.dug * 10 }; }
  function dig(s) {
    if (s.dug >= MAX_UNDER) return 'The ground below is solid rock.';
    const cost = digCost(s);
    if (!canPay(s, cost)) return 'Not enough silver buttons or salvage.';
    pay(s, cost);
    s.dug += 1;
    log(s, `The crew dug out a new level below ground.`, 'good');
    return null;
  }
  function assignJob(s, crewId, roomId) {
    const c = s.crew.find((x) => x.id === crewId);
    if (!c || !c.alive || c.away) return 'They are not here.';
    if (roomId) {
      const room = s.rooms.find((r) => r.id === roomId);
      const t = room && ROOM_TYPES[room.type];
      if (!room || room.state !== 'working' || !t.staff) return 'Nobody can work there.';
      if (workersIn(s, roomId).filter((x) => x.id !== crewId).length >= t.staff) return `${t.name} is fully staffed.`;
    }
    c.job = roomId || null;
    tutorialCheck(s);
    return null;
  }

  // ---------- power, production, patrons ----------
  const POWER_PRIORITY = ['water_pump', 'food', 'clinic', 'guest_room', 'bar', 'workshop', 'entertainment'];
  function powerReport(s) {
    let supply = 0;
    for (const r of s.rooms) {
      if (r.type !== 'generator' || r.state !== 'working') continue;
      for (const c of workersIn(s, r.id)) supply += Math.round(5 * LEVEL_MULT[r.level] * (c.role === 'tinker' ? 1.5 : 1));
    }
    const consumers = s.rooms.filter((r) => r.state === 'working' && ROOM_TYPES[r.type].power > 0)
      .sort((a, b) => POWER_PRIORITY.indexOf(a.type) - POWER_PRIORITY.indexOf(b.type));
    const powered = new Set();
    let used = 0, demand = 0;
    for (const r of consumers) {
      const need = ROOM_TYPES[r.type].power * r.level;
      demand += need;
      if (used + need <= supply) { used += need; powered.add(r.id); }
    }
    return { supply, demand, powered };
  }
  function isRunning(s, room, power = powerReport(s)) {
    const t = ROOM_TYPES[room.type];
    if (room.state !== 'working') return false;
    if (t.power > 0 && !power.powered.has(room.id)) return false;
    if (t.staff > 0 && workersIn(s, room.id).length === 0) return false;
    return true;
  }
  function caps(s) {
    const st = s.rooms.filter((r) => r.type === 'storage' && r.state === 'working').reduce((n, r) => n + r.level, 0);
    const cold = s.rooms.filter((r) => r.type === 'cold_storage' && isRunning(s, r)).reduce((n, r) => n + r.level, 0);
    return { food: 60 + st * 40 + cold * 60, water: 60 + st * 40, salvage: 80 + st * 50 };
  }
  function clampRes(s) {
    const c = caps(s);
    for (const k of ['food', 'water', 'salvage']) s.res[k] = Math.max(0, Math.min(c[k], Math.floor(s.res[k])));
    s.res.buttons = Math.floor(s.res.buttons);
  }
  function moraleMult(c) { return c.morale < 30 ? 0.7 : c.morale > 80 ? 1.15 : 1; }

  function middayTick(s) {
    const r = rng(s);
    const power = powerReport(s);
    const out = { water: 0, food: 0, salvage: 0, buttons: 0, guests: 0, served: 0, turnedAway: 0 };
    for (const room of s.rooms) {
      if (!isRunning(s, room, power)) continue;
      const m = LEVEL_MULT[room.level];
      const ws = workersIn(s, room.id);
      for (const c of ws) {
        const k = moraleMult(c);
        if (room.type === 'water_pump') out.water += 10 * m * k;
        if (room.type === 'food') { out.food += 10 * m * k; out.water -= 1; }
        if (room.type === 'workshop') out.salvage += 3 * m * k * (c.role === 'tinker' ? 1.5 : 1);
        if (room.type === 'purifier') out.water += 4 * m * k;
        addXp(s, c, 8);
      }
    }
    // Patrons: passing traffic grows with reputation and friendly warlords.
    const friendlyBonus = s.warlords.filter((w) => w.alive && (w.disposition > 30 || w.stance === 'pact')).length + (s.vacant || []).length;
    const traffic = r.int(2, 5) + Math.floor(s.rep / 15) + friendlyBonus + (s.guestTraffic || 0);
    const beds = s.rooms.filter((x) => x.type === 'guest_room' && isRunning(s, x, power)).reduce((n, x) => n + 4 * x.level, 0);
    const bars = s.rooms.filter((x) => x.type === 'bar' && isRunning(s, x, power));
    const barCap = bars.reduce((n, x) => n + 6 * x.level * Math.min(2, workersIn(s, x.id).length), 0);
    const cards = s.rooms.filter((x) => x.type === 'entertainment' && isRunning(s, x, power));
    out.guests = Math.min(traffic, beds);
    const bath = levelOf(s, 'bathhouse');
    out.buttons += out.guests * (4 + (hasTech(s, 'h2') ? 1 : 0) + bath);
    let food = s.res.food + out.food, water = s.res.water + out.water;
    // Every two patrons share a meal and a jug of water.
    for (let i = 0; i < Math.min(traffic, barCap); i++) {
      const needs = i % 2 === 0;
      if (needs && (food < 1 || water < 1)) { out.turnedAway += 1; continue; }
      if (needs) { food -= 1; water -= 1; out.food -= 1; out.water -= 1; }
      out.served += 1; out.buttons += 2;
    }
    if (cards.length) out.buttons += out.served * (cards.reduce((n, x) => n + x.level, 0) + (s.wesTables ? 1 : 0));
    if (running(s, 'purifier')) out.buttons += out.served;
    if (bath) { for (const c of atHome(s)) c.morale = Math.min(100, c.morale + 3); s.rep = Math.min(100, s.rep + 1); }
    if (cards.length) for (const c of atHome(s)) c.morale = Math.min(100, c.morale + 2);
    const unserved = traffic - Math.max(out.guests, out.served);
    s.rep = Math.max(0, Math.min(100, s.rep + (out.guests + out.served > 0 ? 2 : 0) - (out.turnedAway > 0 ? 2 : 0) - (unserved > 3 ? 1 : 0)));
    out.buttons = Math.round(out.buttons * diff(s).income);
    s.res.water += out.water; s.res.food += out.food; s.res.salvage += out.salvage; s.res.buttons += out.buttons;
    clampRes(s);
    s.today = { traffic, ...out, power: { supply: power.supply, demand: power.demand } };
    return s.today;
  }

  // ---------- missions (fought on the tactical map in tactics.js) ----------
  const SITES = {
    salvage: ['Collapsed overpass', 'Rusted rail yard', 'Gutted pharmacy', 'Old water tower', 'Buried bus depot', 'Dead mall'],
    rescue: ['Overturned caravan', 'Flooded farmhouse', 'Signal fire on the ridge', 'Trapped well-diggers'],
    combat: ['Bandit camp at the culvert', 'Scavenger nest', 'Feral dog den', 'Machine-guarded vault'],
    elite: ['Elite-era clothing store', 'Sealed tailor’s shop', 'Abandoned elite apartments'],
  };
  function makeMission(s, kind, opts = {}) {
    const r = rng(s);
    s.nextMission = (s.nextMission || 0) + 1;
    const far = opts.far ?? r.chance(0.35);
    const danger = opts.danger ?? Math.min(5, r.int(1, 2) + Math.floor(s.day / 8) + (far ? 1 : 0));
    const travel = far ? r.int(1, 2) : 0;
    const site = opts.site ?? r.pick(SITES[kind === 'warlord' ? 'combat' : kind]);
    const reward = { salvage: 0, buttons: 0, food: 0, water: 0, recruit: 0, gear: 0 };
    if (kind === 'salvage') { reward.salvage = 10 + danger * 6 + travel * 8; reward.food = r.int(0, 6); }
    if (kind === 'elite') { reward.buttons = 12 + danger * 6; reward.salvage = 6; }
    if (kind === 'rescue') { reward.recruit = 1; reward.buttons = 4 + danger * 2; }
    if (kind === 'combat') { reward.salvage = 6 + danger * 4; reward.buttons = 6 + danger * 4; }
    if (kind === 'warlord') { reward.buttons = 10 + danger * 5; reward.salvage = 4 + danger * 2; reward.gear = r.chance(0.5) ? 1 : 0; }
    if (kind === 'elite' && r.chance(0.2)) reward.gear = 1;
    return {
      id: `m${s.nextMission}`, kind, site, danger, travel,
      expires: s.day + (opts.expiresIn ?? (kind === 'rescue' ? r.int(1, 2) : r.int(3, 5))),
      urgent: kind === 'rescue', reward, squad: [], status: 'open',
      from: opts.from || null, scripted: opts.scripted || null,
    };
  }
  function refreshMissions(s) {
    const r = rng(s);
    // Expired missions: rescues cost lives, salvage just goes away.
    for (const m of s.missions) {
      if (m.status === 'open' && m.expires < s.day) {
        m.status = 'expired';
        if (m.kind === 'rescue') { log(s, `No one reached the ${m.site.toLowerCase()} in time. The people there are gone.`, 'bad'); s.rep = Math.max(0, s.rep - 3); }
        else if (m.kind === 'warlord') { const w = s.warlords.find((x) => x.id === m.from); if (w) { nudge(s, w.id, -5); log(s, `${w.name} noticed you ignored their job.`); } }
      }
    }
    s.missions = s.missions.filter((m) => m.status === 'open' || m.status === 'out');
    if (s.tutorial.step < TUTORIAL.length) return;
    const open = s.missions.filter((m) => m.status === 'open');
    const kinds = ['salvage', 'salvage', 'rescue', 'combat', 'elite'];
    while (open.length < 4) {
      const m = makeMission(s, r.pick(kinds));
      s.missions.push(m); open.push(m);
    }
    // Warlord contracts from those who like you well enough. A conspirator always wants its target hit.
    const cons = s.conspiracy && s.warlords.find((x) => x.id === s.conspiracy.ally && x.alive);
    if (r.chance(cons ? 0.65 : 0.3)) {
      const w = cons || r.pick(s.warlords.filter((x) => x.alive && x.disposition > -10 && x.stance !== 'oppose'));
      if (w && !s.missions.some((m) => m.from === w.id && m.status === 'open')) {
        const target = s.warlords.filter((x) => x.alive && x.id !== w.id && !(x.stance === 'pact'));
        const rival = cons ? s.warlords.find((x) => x.id === s.conspiracy.target) : target.length ? r.pick(target) : null;
        const m = makeMission(s, 'warlord', { from: w.id, site: rival ? `Hit ${rival.name}'s supply cache` : 'Clear the toll road' });
        m.rival = rival ? rival.id : null;
        s.missions.push(m);
        log(s, `${w.name} has a job for you.`);
      }
    }
    politicsMissions(s, r);
    storyMissions(s);
  }
  function setSquad(s, missionId, squad) {
    const m = s.missions.find((x) => x.id === missionId);
    if (!m || m.status !== 'open') return 'That mission is gone.';
    for (const other of s.missions) if (other !== m && other.status === 'open') other.squad = other.squad.filter((id) => !squad.includes(id));
    m.squad = squad.slice(0, 6);
    return null;
  }
  function squadPower(s, ids) {
    return ids.map((id) => s.crew.find((c) => c.id === id)).reduce((n, c) => n + (c.level * 2 + (c.role === 'recruit' ? 1 : roleById(c.role).field)) * moraleMult(c), 0);
  }
  function successChance(s, m) {
    if (m.squad.length < 4) return 0;
    const p = squadPower(s, m.squad);
    const threat = 10 + m.danger * 7;
    return Math.max(0.1, Math.min(0.95, 0.55 + (p - threat) / 40));
  }
  function launchMissions(s) {
    const teamRoom = s.rooms.some((r) => r.type === 'team_management' && r.state === 'working');
    const sent = [];
    for (const m of s.missions) {
      if (m.status !== 'open' || m.squad.length < 4 || !teamRoom) continue;
      m.status = 'out'; m.fought = false;
      m.arriveDay = s.day + m.travel; m.returnDay = m.arriveDay + m.travel; // there and back
      for (const id of m.squad) { const c = s.crew.find((x) => x.id === id); c.away = m.id; }
      sent.push(m);
      log(s, `A team of ${m.squad.length} left for the ${m.site.toLowerCase()}.`);
    }
    return sent;
  }
  // Who the squad will be fighting: a warlord's people, or nobody's in particular.
  function missionOwner(s, m) {
    const alive = s.warlords.filter((w) => w.alive);
    if (m.kind === 'warlord') return alive.find((w) => w.id === m.rival) || null;
    if (m.kind === 'combat' && !m.scripted && alive.length) {
      const coldest = alive.reduce((a, b) => (b.disposition < a.disposition ? b : a));
      return coldest.disposition < 0 ? coldest : null;
    }
    return null;
  }
  function battlePerks(s) {
    return { stims: running(s, 'armory') ? 1 : 0, bleed: hasTech(s, 'c2') ? 1 : 0, turret: hasTech(s, 'c5') ? 1 : 0 };
  }
  function startBattle(s, m) {
    const r = rng(s);
    const crew = m.squad.map((id) => s.crew.find((c) => c.id === id)).filter((c) => c && c.alive);
    s.battle = TAC.create({ seed: r.int(1, 2 ** 30), kind: m.kind, site: m.site, danger: m.danger, crew, owner: missionOwner(s, m), scripted: m.scripted, perks: battlePerks(s) });
    s.battle.missionId = m.id;
    return s.battle;
  }
  // Apply a finished battle to the waystation. Deaths land now; loot comes home with the team.
  function finishBattle(s) {
    const b = s.battle;
    if (!b || !b.over) return 'The fight is not over.';
    if (b.kind === 'raid') return finishRaid(s);
    const m = s.missions.find((x) => x.id === b.missionId);
    s.battle = null;
    if (!m) return null;
    const o = b.over;
    const r = rng(s);
    const squad = m.squad.map((id) => s.crew.find((c) => c.id === id)).filter(Boolean);
    const report = { mission: m, outcome: o.outcome, lines: [], gained: {}, died: [], injured: [], kills: o.kills, turns: o.turns };
    for (const id of o.died) {
      const c = s.crew.find((x) => x.id === id);
      if (c && c.alive) { c.alive = false; c.job = null; report.died.push(c.name); log(s, `${c.name} died at the ${m.site.toLowerCase()}.`, 'bad'); }
    }
    const share = o.outcome === 'success' ? 1 : o.outcome === 'partial' ? (o.total ? (m.kind === 'rescue' ? o.freed : o.collected) / o.total : 0.5) : 0;
    const drifters = squad.filter((c) => c.alive && c.role === 'drifter').length;
    for (const k of ['salvage', 'buttons', 'food', 'water']) {
      let v = Math.round((m.reward[k] || 0) * share * (k === 'salvage' ? 1 + drifters * 0.15 : 1));
      if (k === 'salvage') v += o.kills * 2;
      if (k === 'buttons') v += o.kills;
      if (v) report.gained[k] = v;
    }
    if (m.reward.recruit && o.freed > 0) report.gained.recruit = 1;
    const survivors = new Map(o.survived.map((x) => [x.crewId, x]));
    for (const c of squad.filter((c) => c.alive)) {
      const st = survivors.get(c.id);
      if (!st) continue;
      const days = st.downed ? 3 : st.hpLost > 0.5 ? 2 : st.hpLost > 0.2 ? 1 : 0;
      if (days) { c.injured = Math.max(c.injured, days); report.injured.push(c.name); }
      if (m.scripted === 'intro') { c.morale = Math.max(0, c.morale - 15); addXp(s, c, 60); continue; }
      addXp(s, c, 25 + st.kills * 15 + (o.outcome === 'success' ? 20 + m.danger * 8 : 0));
      c.morale = Math.max(0, Math.min(100, c.morale + (o.outcome === 'success' ? 8 : o.outcome === 'partial' ? 0 : -10) - report.died.length * 15));
    }
    if (m.scripted === 'intro') report.lines.push(`The pump station is clear. ${report.died[0] || 'Someone'} never saw it coming.`);
    else if (o.outcome === 'success') report.lines.push(pickLine(r, m.kind));
    else if (o.outcome === 'partial') report.lines.push('They got some of it and got out before it went bad.');
    else if (o.outcome === 'retreat') report.lines.push('They pulled out empty-handed. Alive counts for something.');
    else report.lines.push('Nobody came back.');
    if (o.kills) report.lines.push(`${o.kills} enem${o.kills === 1 ? 'y' : 'ies'} down.`);
    if (m.kind === 'warlord') {
      const w = s.warlords.find((x) => x.id === m.from);
      if (w && o.outcome === 'success') { nudge(s, w.id, 12); report.lines.push(`${w.name} is pleased.`); }
      const rv = s.warlords.find((x) => x.id === m.rival && x.alive);
      if (rv && (o.outcome === 'success' || o.kills > 0)) {
        nudge(s, rv.id, -15);
        if (m.scripted === 'stronghold' && o.outcome === 'success') {
          if (s.warlords.filter((x) => x.alive).length >= 4 && !(s.vacant || []).length) report.lines.push(...eliminateWarlord(s, rv.id));
          else { rv.hold = 0; report.lines.push(`${rv.name}'s stronghold is burning, but they slipped away. With the wastes this unsettled, they will be back.`); }
        }
        else {
          const hit = o.outcome === 'success' ? (m.strike ? 20 : 25) : 8;
          rv.hold = Math.max(0, (rv.hold ?? 100) - hit);
          report.lines.push(`${rv.name} will not forget this. Their grip on their territory is down to ${rv.hold}%.`);
        }
      }
    }
    if (o.outcome === 'success' && m.reward.gear) {
      const g = gainGear(s, r, m.scripted === 'stronghold' ? 'plating' : null);
      report.gear = [g];
      if (m.scripted === 'stronghold') report.gear.push(gainGear(s, r));
      report.lines.push(`They brought back ${report.gear.map((x) => GEAR[x].name.toLowerCase()).join(' and ')}. Equip it from the Team panel.`);
    }
    if (o.surrendered) {
      report.lines.push('One of them threw down their weapon and begged. The team brought them home.');
      s.pendingEvents.push({ id: 'surrender', site: m.site });
    }
    if (report.died.length) s.trust.points = Math.max(0, s.trust.points - 2);
    m.fought = true; m.report = report;
    if (o.outcome === 'wiped' || m.travel === 0) m.returnDay = Math.min(m.returnDay, s.day);
    if (m.scripted === 'intro') s.introDone = true;
    if (m.scripted === 'keycard' && o.collected > 0) {
      const st = storyState(s);
      st.pieces = Math.max(st.pieces, m.piece);
      report.lines.push(`Keycard piece ${m.piece} of 3 recovered.${m.piece < 3 ? ' The intercom will want to hear about it.' : ' That is all of them.'}`);
      log(s, `Keycard piece ${m.piece} of 3 recovered.`, 'good');
    }
    return null;
  }
  function autoFight(s, m) {
    startBattle(s, m);
    TAC.autoplay(s.battle, 40);
    return finishBattle(s);
  }
  function returnMission(s, m) {
    const report = m.report || { mission: m, outcome: 'retreat', lines: ['They came back.'], gained: {}, died: [], injured: [] };
    for (const [k, v] of Object.entries(report.gained)) {
      if (k === 'recruit') continue;
      s.res[k] = (s.res[k] || 0) + v;
    }
    if (report.gained.recruit) s.travelers.unshift({ ...makeRecruit(s), rescued: true });
    for (const id of m.squad) { const c = s.crew.find((x) => x.id === id); if (c) c.away = null; }
    m.status = 'done';
    clampRes(s);
    report.mission = { id: m.id, site: m.site, kind: m.kind, scripted: m.scripted };
    return report;
  }
  function pickLine(r, kind) {
    return r.pick({
      salvage: ['They came back loaded down and filthy, which is the good kind of filthy.', 'Wire, pipe, bolts, and one very confused cat.'],
      rescue: ['They found the survivors cold but alive. One of them wants work.', 'Everyone walked out. Slowly, but everyone.'],
      combat: ['The camp is empty now. The road is quieter for it.', 'Short, loud, and over fast.'],
      elite: ['A rack of rotting coats, every one with silver buttons sewn on.', 'They cut buttons off old elite clothes until their fingers bled.'],
      warlord: ['The job is done. Nobody asked too many questions.', 'Done, and done quietly.'],
    }[kind] || ['It went well.']);
  }

  // ---------- raids ----------
  function defenseScore(s) {
    let d = 0;
    for (const room of s.rooms) {
      if (room.type === 'wall' && room.state === 'damaged') { d += 2; continue; }
      if (room.state !== 'working') continue;
      if (room.type === 'wall') d += 4 * room.level;
      if (room.type === 'watchtower') {
        d += 2 * room.level;
        for (const c of workersIn(s, room.id)) d += (c.role === 'recruit' ? 2 : roleById(c.role).guard) + c.level;
      }
    }
    d += atHome(s).filter((c) => c.injured === 0).length;
    if (s.patchedWall === s.day) d += 3;
    return d;
  }
  function resolveRaid(s, w) {
    const r = rng(s);
    const attack = 6 + w.strength * 4 + r.int(0, 8) + (w.temperament === 'aggressive' ? 3 : 0);
    const defense = defenseScore(s);
    const res = { warlord: w.name, attack, defense, outcome: '', lines: [] };
    if (defense >= attack) {
      res.outcome = 'repelled';
      res.lines.push(`${w.name}'s raiders hit the gate and broke on it.`);
      for (const c of atHome(s)) { c.morale = Math.min(100, c.morale + 5); addXp(s, c, 15); }
      s.trust.points += 1;
      if (r.chance(0.4)) { res.lines.push('One raider was left behind, wounded and begging.'); s.pendingEvents.push({ id: 'surrender', site: 'the gate' }); }
    } else if (attack > defense * 2.5 + 10 && s.day >= 10) {
      res.outcome = 'overrun';
      res.lines.push(`${w.name}'s raiders poured over the walls. There were too many.`);
      s.gameOver = 'Raiders took the waystation.';
    } else {
      res.outcome = 'breached';
      const targets = s.rooms.filter((x) => x.row === 0 && x.state === 'working');
      if (targets.length) { const t = r.pick(targets); t.state = 'damaged'; for (const c of s.crew) if (c.job === t.id) c.job = null; res.lines.push(`They wrecked the ${ROOM_TYPES[t.type].name.toLowerCase()}.`); }
      const stolen = Math.floor(s.res.buttons * (0.1 + r.next() * 0.15));
      s.res.buttons -= stolen;
      if (stolen) res.lines.push(`They took ${stolen} silver buttons on the way out.`);
      if (r.chance(0.3)) { const c = r.pick(atHome(s)); if (c) { c.injured = 2; res.lines.push(`${c.name} was hurt holding the door.`); } }
      for (const c of atHome(s)) c.morale = Math.max(0, c.morale - 8);
    }
    nudge(s, w.id, -4);
    return res;
  }



  // ---------- the traders' market (at a working Bar) ----------
  const MARKET = { food: { amount: 10, price: 8 }, water: { amount: 10, price: 6 }, salvage: { amount: 10, price: 12 } };
  const MARKET_PER_DAY = 3;
  function marketLeft(s) { return MARKET_PER_DAY - (s.marketDay === s.day ? s.marketBuys || 0 : 0); }
  function buySupplies(s, kind) {
    const m = MARKET[kind];
    if (!m) return 'Nobody sells that.';
    if (!s.rooms.some((r) => r.type === 'bar' && r.state === 'working')) return 'Traders only stop at a working Bar.';
    if (marketLeft(s) <= 0) return 'The traders have sold what they brought today.';
    const price = Math.round(m.price * (s.difficulty === 'hard' ? 1.25 : 1));
    if (s.res.buttons < price) return 'Not enough silver buttons.';
    if (s.res[kind] + m.amount > caps(s)[kind]) return 'You have nowhere to keep it. Build storage.';
    s.res.buttons -= price; s.res[kind] += m.amount;
    if (s.marketDay !== s.day) { s.marketDay = s.day; s.marketBuys = 0; }
    s.marketBuys += 1;
    log(s, `Bought ${m.amount} ${kind} from a trader for ${price} buttons.`);
    return null;
  }

  // ---------- difficulty ----------
  const DIFFICULTY = {
    easy: { name: 'Easy', income: 1.25, upkeep: 0.8, raid: 0.7, size: -1, text: 'More buttons, cheaper upkeep, fewer and smaller raids.' },
    standard: { name: 'Standard', income: 1, upkeep: 1, raid: 1, size: 0, text: 'The wastes as intended.' },
    hard: { name: 'Hard', income: 0.95, upkeep: 1.15, raid: 1.3, size: 1, text: 'Thin margins, more raids, bigger raids.' },
  };
  const diff = (s) => DIFFICULTY[s.difficulty || 'standard'] || DIFFICULTY.standard;
  function setDifficulty(s, d) { if (DIFFICULTY[d]) s.difficulty = d; if (d === 'easy') s.res.buttons += 20; if (d === 'hard') s.res.buttons -= 10; }

  // ---------- plans (the tech tree) ----------
  // Pilot Light digs plans out of your relative's notebooks; one at a time,
  // paid up front, finished overnight. Ids are append-only.
  const TECH = [
    { id: 'h1', branch: 'Hospitality', name: 'Private rooms', text: 'Guest Rooms and the Bar to level 2.', cost: { buttons: 14, salvage: 8 }, days: 1, needs: [] },
    { id: 'h3', branch: 'Hospitality', name: 'Card tables', text: 'Unlocks the Card Room.', cost: { buttons: 18, salvage: 10 }, days: 1, needs: ['h1'] },
    { id: 'h2', branch: 'Hospitality', name: 'Suites', text: 'Guest Rooms to level 3. Guests pay 1 more each.', cost: { buttons: 28, salvage: 16 }, days: 2, needs: ['h1'] },
    { id: 'h4', branch: 'Hospitality', name: 'Live stage', text: 'Bar and Card Room to level 3.', cost: { buttons: 32, salvage: 18 }, days: 2, needs: ['h3'] },
    { id: 'h5', branch: 'Hospitality', name: 'Bathhouse', text: 'Unlocks the Bathhouse.', cost: { buttons: 36, salvage: 22 }, days: 3, needs: ['h2'] },
    { id: 'd1', branch: 'Defense', name: 'Reinforced walls', text: 'Walls to level 2 and 3: more solid wall in raids.', cost: { buttons: 12, salvage: 14 }, days: 1, needs: [] },
    { id: 'd2', branch: 'Defense', name: 'Tower lamps', text: 'Watchtowers to level 2 and 3.', cost: { buttons: 14, salvage: 12 }, days: 1, needs: [] },
    { id: 'd3', branch: 'Defense', name: 'Gate checkpoint', text: 'Unlocks the Gate Checkpoint.', cost: { buttons: 22, salvage: 18 }, days: 2, needs: ['d1'] },
    { id: 'd4', branch: 'Defense', name: 'Turret emplacements', text: 'Unlocks the Turret Nest.', cost: { buttons: 34, salvage: 28 }, days: 3, needs: ['d2', 'd3'] },
    { id: 'p1', branch: 'Power & Water', name: 'Generator overhaul', text: 'Generators to level 2 and 3.', cost: { buttons: 12, salvage: 14 }, days: 1, needs: [] },
    { id: 'p2', branch: 'Power & Water', name: 'Deep pump', text: 'Water Pumps to level 2 and 3.', cost: { buttons: 12, salvage: 12 }, days: 1, needs: [] },
    { id: 'p4', branch: 'Power & Water', name: 'Storage tanks', text: 'Storage to level 2 and 3.', cost: { buttons: 14, salvage: 10 }, days: 1, needs: [] },
    { id: 'p3', branch: 'Power & Water', name: 'Purifier', text: 'Unlocks the Purifier.', cost: { buttons: 26, salvage: 18 }, days: 2, needs: ['p1', 'p2'] },
    { id: 'f1', branch: 'Food', name: 'Better seed stock', text: 'Grow Rooms to level 2.', cost: { buttons: 12, salvage: 8 }, days: 1, needs: [] },
    { id: 'f2', branch: 'Food', name: 'Hydroponics', text: 'Grow Rooms to level 3.', cost: { buttons: 24, salvage: 16 }, days: 2, needs: ['f1', 'p2'] },
    { id: 'f3', branch: 'Food', name: 'Cold storage', text: 'Unlocks Cold Storage.', cost: { buttons: 18, salvage: 14 }, days: 2, needs: ['f1'] },
    { id: 'c1', branch: 'Crew & Operations', name: 'Bunk extensions', text: 'Crew Quarters to level 2 and 3 (4 more bunks each).', cost: { buttons: 14, salvage: 10 }, days: 1, needs: [] },
    { id: 'c4', branch: 'Crew & Operations', name: 'Workshop', text: 'Unlocks the Workshop; Workshops to level 3.', cost: { buttons: 14, salvage: 10 }, days: 1, needs: [] },
    { id: 'c2', branch: 'Crew & Operations', name: 'Surgery', text: 'Clinic to level 2 and 3. Downed crew last one more turn.', cost: { buttons: 24, salvage: 14 }, days: 2, needs: ['c1'] },
    { id: 'c3', branch: 'Crew & Operations', name: 'Armory', text: 'Unlocks the Armory: an extra stim per squad, and gear made to order.', cost: { buttons: 28, salvage: 22 }, days: 2, needs: ['c4'] },
    { id: 'c5', branch: 'Crew & Operations', name: "Tinker's bench", text: 'Tinker turrets get +3 health and +1 damage.', cost: { buttons: 26, salvage: 22 }, days: 2, needs: ['c4'] },
    { id: 'x1', branch: 'Diplomacy', name: 'Messenger post', text: 'Unlocks the Messenger Post.', cost: { buttons: 14, salvage: 6 }, days: 1, needs: [] },
    { id: 'x2', branch: 'Diplomacy', name: 'Meeting hall', text: 'Unlocks the Meeting Hall.', cost: { buttons: 24, salvage: 12 }, days: 2, needs: ['x1'] },
    { id: 'x3', branch: 'Diplomacy', name: 'Informant network', text: 'Unlocks the Informant Network.', cost: { buttons: 32, salvage: 12 }, days: 3, needs: ['x2'] },
  ];
  const TECH_BRANCHES = ['Hospitality', 'Defense', 'Power & Water', 'Food', 'Crew & Operations', 'Diplomacy'];
  // Plan needed to upgrade a room type to [level 2, level 3].
  const LEVEL_TECH = {
    guest_room: ['h1', 'h2'], bar: ['h1', 'h4'], entertainment: ['h4', 'h4'], bathhouse: ['h5', 'h5'],
    wall: ['d1', 'd1'], watchtower: ['d2', 'd2'], checkpoint: ['d3', 'd3'], turret_nest: ['d4', 'd4'],
    generator: ['p1', 'p1'], water_pump: ['p2', 'p2'], storage: ['p4', 'p4'], purifier: ['p3', 'p3'],
    food: ['f1', 'f2'], cold_storage: ['f3', 'f3'],
    crew_quarters: ['c1', 'c1'], clinic: ['c2', 'c2'], workshop: ['c4', 'c4'], armory: ['c3', 'c3'],
    messenger_post: ['x1', 'x1'], meeting_hall: ['x2', 'x2'], informants: ['x3', 'x3'],
  };
  const techState = (s) => (s.tech = s.tech || { done: [], current: null });
  const hasTech = (s, id) => !id || techState(s).done.includes(id);
  const techById = (id) => TECH.find((t) => t.id === id);
  function techStatus(s, t) {
    const st = techState(s);
    if (st.done.includes(t.id)) return 'done';
    if (st.current && st.current.id === t.id) return 'researching';
    return t.needs.every((n) => st.done.includes(n)) ? 'available' : 'locked';
  }
  function startResearch(s, id) {
    const t = techById(id), st = techState(s);
    if (!t) return 'No such plan.';
    if (st.current) return `Pilot Light is still working on ${techById(st.current.id).name}.`;
    const status = techStatus(s, t);
    if (status === 'done') return 'Already done.';
    if (status === 'locked') return `Needs ${t.needs.filter((n) => !st.done.includes(n)).map((n) => techById(n).name).join(' and ')} first.`;
    if (!canPay(s, t.cost)) return 'Not enough silver buttons or salvage.';
    pay(s, t.cost);
    st.current = { id, left: t.days };
    log(s, `Pilot Light is working through your relative's notes on ${t.name.toLowerCase()}. Ready in ${t.days} day${t.days > 1 ? 's' : ''}.`);
    return null;
  }
  function researchNight(s, night) {
    const st = techState(s);
    if (!st.current) return;
    st.current.left -= 1;
    if (st.current.left > 0) return;
    const t = techById(st.current.id);
    st.done.push(t.id); st.current = null;
    night.lines.push(`New plans ready: ${t.name}. ${t.text}`);
    log(s, `Plans ready: ${t.name}.`, 'good');
  }
  const running = (s, type) => s.rooms.some((x) => x.type === type && isRunning(s, x));
  const levelOf = (s, type) => s.rooms.filter((x) => x.type === type && isRunning(s, x)).reduce((n, x) => Math.max(n, x.level), 0);
  // Gear made to order at a staffed Armory.
  const CRAFT_COST = { buttons: 14, salvage: 12 };
  function craftGear(s, type) {
    if (!running(s, 'armory')) return 'You need a staffed Armory.';
    if (!['vest', 'scope', 'boots', 'kit'].includes(type)) return 'The Armory cannot make that.';
    if (!canPay(s, CRAFT_COST)) return 'Not enough silver buttons or salvage.';
    pay(s, CRAFT_COST);
    s.gear = s.gear || [];
    s.gear.push(type);
    log(s, `The Armory turned out a ${GEAR[type].name.toLowerCase()}.`, 'good');
    return null;
  }
  // Tonight's raid, if any. With informants this is decided in the morning so they can warn you.
  function rollRaid(s, r) {
    for (const w of r.shuffle(s.warlords.filter((x) => x.alive))) {
      let p = raidChance(w, s.day);
      if (s.rooms.some((x) => x.type === 'watchtower' && isRunning(s, x))) p *= 0.85;
      if (running(s, 'checkpoint')) p *= 0.85;
      p *= diff(s).raid;
      if (r.chance(p)) return w;
    }
    return null;
  }

  // ======================================================================
  // Warlord politics: pacts, open opposition, conspiracies, each warlord's
  // grip on their territory, stronghold assaults, successors, and gear.
  // ======================================================================
  const GEAR = {
    vest: { name: 'Scrap vest', effect: '+3 health' },
    scope: { name: 'Hand-ground scope', effect: '+8 aim' },
    boots: { name: 'Road boots', effect: '+1 move' },
    kit: { name: 'Field kit', effect: '+1 stim for the squad' },
    plating: { name: 'Warlord plating', effect: '+1 armor, +2 health' },
  };
  function gainGear(s, r, type) {
    const g = type || r.pick(['vest', 'vest', 'scope', 'boots', 'kit']);
    s.gear = s.gear || [];
    s.gear.push(g);
    log(s, `New gear: ${GEAR[g].name} (${GEAR[g].effect}).`, 'good');
    return g;
  }
  function equipGear(s, crewId, type) {
    const c = s.crew.find((x) => x.id === crewId);
    if (!c || !c.alive) return 'They are not here.';
    if (c.away) return 'They are out on a mission.';
    s.gear = s.gear || [];
    if (type) {
      const i = s.gear.indexOf(type);
      if (i < 0) return 'You do not have that.';
      s.gear.splice(i, 1);
    }
    if (c.gear) s.gear.push(c.gear);
    c.gear = type || null;
    return null;
  }
  const pactCost = (w, s) => Math.max(2, 3 + w.strength - (s && running(s, 'messenger_post') ? 1 : 0));
  function proposePact(s, id) {
    const w = s.warlords.find((x) => x.id === id && x.alive);
    if (!w) return 'They are gone.';
    if (w.temperament === 'aggressive') return `${w.name} does not make pacts. They make demands.`;
    if (w.stance !== 'neutral') return 'Settle your current terms with them first.';
    const need = running(s, 'meeting_hall') ? 15 : 30;
    if (w.disposition < need) return `${w.name} does not trust you enough yet (needs ${need >= 30 ? 'Friendly' : 'warmer than Cordial'} standing).`;
    if (s.conspiracy && s.conspiracy.target === id) return 'You cannot shake their hand while you plot against them.';
    if (s.res.buttons < 10) return 'Sealing a pact costs 10 silver buttons up front.';
    s.res.buttons -= 10; w.stance = 'pact'; nudge(s, id, 8);
    log(s, `You sealed a pact with ${w.name}: ${pactCost(w, s)} buttons a night, no raids, no demands.`, 'good');
    return null;
  }
  function breakPact(s, id) {
    const w = s.warlords.find((x) => x.id === id && x.alive);
    if (!w || w.stance !== 'pact') return 'There is no pact.';
    w.stance = 'neutral'; nudge(s, id, -25);
    log(s, `You broke your pact with ${w.name}. They will remember.`, 'bad');
    return null;
  }
  function oppose(s, id) {
    const w = s.warlords.find((x) => x.id === id && x.alive);
    if (!w) return 'They are gone.';
    if (w.stance === 'pact') return 'Break the pact first.';
    if (w.stance === 'oppose') return 'You already oppose them.';
    w.stance = 'oppose'; nudge(s, id, -30);
    if (s.conspiracy && s.conspiracy.ally === id) s.conspiracy = null;
    log(s, `You declared open opposition to ${w.name}. Their people will come for you, and you can go for them.`, 'bad');
    return null;
  }
  function standDown(s, id) {
    const w = s.warlords.find((x) => x.id === id && x.alive);
    if (!w || w.stance !== 'oppose') return 'You are not opposing them.';
    w.stance = 'neutral';
    s.missions = s.missions.filter((m) => !(m.status === 'open' && m.rival === id && (m.strike || m.scripted === 'stronghold')));
    log(s, `You stood down against ${w.name}. Nobody believes it is permanent.`);
    return null;
  }
  function conspire(s, allyId, targetId) {
    const a = s.warlords.find((x) => x.id === allyId && x.alive), t = s.warlords.find((x) => x.id === targetId && x.alive);
    if (!a || !t || a === t) return 'Pick two different warlords.';
    if (s.conspiracy) return 'You are already in one conspiracy. One knife at a time.';
    if (a.disposition < 10) return `${a.name} does not trust you enough to plot with you.`;
    if (a.stance === 'oppose') return `You are fighting ${a.name}.`;
    if (t.stance === 'pact') return `You have a pact with ${t.name}. Break it first.`;
    s.conspiracy = { ally: allyId, target: targetId, since: s.day };
    nudge(s, allyId, 5);
    log(s, `You are now conspiring with ${a.name} against ${t.name}. Expect their jobs on the board.`);
    return null;
  }
  function endConspiracy(s) {
    if (!s.conspiracy) return 'There is no conspiracy.';
    const a = s.warlords.find((x) => x.id === s.conspiracy.ally);
    s.conspiracy = null;
    if (a) nudge(s, a.id, -8);
    log(s, `You walked away from the plot${a ? ` with ${a.name}` : ''}.`);
    return null;
  }
  // Missions the player's stances put on the board.
  function politicsMissions(s, r) {
    const living = s.warlords.filter((w) => w.alive);
    for (const w of living) {
      const targeted = w.stance === 'oppose' || (s.conspiracy && s.conspiracy.target === w.id);
      if (!targeted) continue;
      const open = s.missions.filter((m) => m.status !== 'done' && m.rival === w.id);
      if (w.stance === 'oppose' && !open.some((m) => m.strike) && r.chance(0.7)) {
        const m = makeMission(s, 'warlord', { site: `Strike ${w.name}'s supply runners` });
        m.rival = w.id; m.strike = true; m.reward.buttons = Math.round(m.reward.buttons * 0.7);
        s.missions.push(m);
      }
      if ((w.hold ?? 100) <= 30 && living.length >= 4 && !(s.vacant || []).length && !open.some((m) => m.scripted === 'stronghold')) {
        const m = makeMission(s, 'warlord', { site: `${w.name}'s stronghold`, danger: Math.min(5, 3 + w.strength), expiresIn: 4 });
        m.rival = w.id; m.scripted = 'stronghold'; m.reward.gear = 1; m.reward.buttons += 30; m.reward.salvage += 20;
        s.missions.push(m);
        log(s, `${w.name} is on the ropes. Their stronghold is exposed for a few days.`, 'good');
        break; // one stronghold at a time
      }
    }
  }
  function politicsNight(s, r, night) {
    for (const w of s.warlords.filter((x) => x.alive && x.stance === 'pact')) {
      const cost = pactCost(w, s);
      if (s.res.buttons >= cost + 5) { s.res.buttons -= cost; night.lines.push(`Tribute to ${w.name}: ${cost} buttons.`); }
      else { w.stance = 'neutral'; nudge(s, w.id, -20); night.lines.push(`You could not pay ${w.name}'s tribute. The pact is off.`); }
    }
    if (s.conspiracy) {
      const t = s.warlords.find((x) => x.id === s.conspiracy.target);
      const leak = running(s, 'informants') ? 0 : running(s, 'meeting_hall') ? 0.035 : 0.07;
      if (t && t.alive && r.chance(leak)) {
        nudge(s, t.id, -25);
        night.lines.push(`${t.name} found out about your plot. Expect company.`);
        log(s, `${t.name} discovered your conspiracy.`, 'bad');
      }
    }
    // Grip slowly recovers when nobody is pressing.
    for (const w of s.warlords) if (w.alive && w.stance !== 'oppose' && !(s.conspiracy && s.conspiracy.target === w.id)) w.hold = Math.min(100, (w.hold ?? 100) + 2);
  }
  // Keep the promises: one aggressive and one strictly friendliest friendly among the living.
  function fixGuarantees(s, lines) {
    const living = s.warlords.filter((w) => w.alive);
    if (!living.some((w) => w.temperament === 'aggressive')) {
      const pick = living.filter((w) => w.temperament !== 'friendly').sort((a, b) => a.disposition - b.disposition)[0]
        || living.filter((w) => w.temperament === 'friendly').sort((a, b) => a.disposition - b.disposition)[0];
      if (pick) { pick.temperament = 'aggressive'; pick.disposition = Math.min(pick.disposition, -40); if (pick.stance === 'pact') pick.stance = 'neutral'; lines.push(`${pick.name} sees an opening and turns on everyone.`); }
    }
    if (!living.some((w) => w.temperament === 'friendly')) {
      const pick = living.filter((w) => w.temperament !== 'aggressive').sort((a, b) => b.disposition - a.disposition)[0];
      if (pick) { pick.temperament = 'friendly'; pick.disposition = Math.max(pick.disposition, 40); lines.push(`${pick.name} sends word: they would rather be your friend than your next problem.`); }
    }
    enforceFriendliest(s.warlords);
  }
  function eliminateWarlord(s, id) {
    const r = rng(s);
    const w = s.warlords.find((x) => x.id === id);
    if (!w || !w.alive) return [];
    const lines = [`${w.name} is finished. Their people scatter and the territory is up for grabs.`];
    w.alive = false; w.stance = 'gone'; w.hold = 0;
    s.vacant = s.vacant || [];
    s.vacant.push({ territory: w.territory, until: s.day + r.int(8, 12), was: w.name, color: w.color });
    if (s.conspiracy && (s.conspiracy.ally === id || s.conspiracy.target === id)) {
      const ally = s.conspiracy.target === id ? s.warlords.find((x) => x.id === s.conspiracy.ally && x.alive) : null;
      if (ally) { nudge(s, ally.id, 15); lines.push(`${ally.name} is delighted with the result.`); }
      s.conspiracy = null;
    }
    s.missions = s.missions.filter((m) => !(m.status === 'open' && (m.from === id || m.rival === id || m.scripted === 'stronghold')));
    const theirs = s.crew.filter((c) => c.alive && c.origin === id);
    for (const c of theirs) c.morale = Math.max(0, c.morale - 12);
    if (theirs.length) lines.push(`${theirs.map((c) => c.name.split(' ')[0]).join(', ')} came from ${w.name}'s territory and ${theirs.length > 1 ? 'are' : 'is'} taking it hard.`);
    fixGuarantees(s, lines);
    log(s, `${w.name} has been eliminated.`, 'good');
    s.trust.points += 1;
    return lines;
  }
  function successors(s, r, night) {
    if (!s.vacant || !s.vacant.length) return;
    for (const v of s.vacant.filter((x) => x.until <= s.day)) {
      s.nextWarlord = (s.nextWarlord || 10) + 1;
      const nw = makeWarlord(r, `w${s.nextWarlord}`, r.pick(TEMPERAMENTS), v.territory, s.day);
      nw.color = v.color;
      s.warlords.push(nw);
      const lines = [`${nw.name} (${nw.archetype}) has claimed the territory ${v.was} used to hold.`];
      fixGuarantees(s, lines);
      night.lines.push(...lines);
      log(s, lines[0]);
    }
    s.vacant = s.vacant.filter((x) => x.until > s.day);
  }

  // ---------- morning events ----------
  const EVENTS = {
    water_question: {
      text: 'A guest holds up a cup of your water and asks if it is safe. It is… mostly.',
      options: [
        { id: 'honest', label: 'Tell the truth', effect: (s) => { s.rep = Math.max(0, s.rep - 2); s.trust.points += 3; return 'They thank you and drink it anyway. Pilot Light makes an approving little chime.'; } },
        { id: 'lie', label: 'Swear it is spring water', effect: (s) => { s.res.buttons += 3; s.trust.points = Math.max(0, s.trust.points - 2); return 'They tip you 3 buttons. Pilot Light goes quiet for a while.'; } },
      ],
    },
    sick_traveler: {
      text: 'A traveler with a hacking cough asks for a bed. They cannot pay.',
      options: [
        { id: 'shelter', label: 'Give them a bed', effect: (s) => { s.rep = Math.min(100, s.rep + 3); s.trust.points += 2; s.res.food = Math.max(0, s.res.food - 2); return 'They sleep for a day straight and leave you a carved button as thanks.'; } },
        { id: 'refuse', label: 'Turn them away', effect: (s) => { s.trust.points = Math.max(0, s.trust.points - 1); return 'They walk on. The road is long.'; } },
      ],
    },
    trader: {
      text: 'A trader with a two-wheeled cart offers 12 salvage for 10 silver buttons.',
      options: [
        { id: 'buy', label: 'Trade 10 buttons', when: (s) => s.res.buttons >= 10, effect: (s) => { s.res.buttons -= 10; s.res.salvage += 12; return 'Wire, pipe and a box of mismatched screws.'; } },
        { id: 'pass', label: 'No deal', effect: () => 'The trader shrugs and rattles on down the road.' },
      ],
    },
    pilot_advice: {
      text: 'Pilot Light: “I ran the numbers. You should put everyone on the pumps today. Everyone. Trust me.”',
      options: [
        { id: 'follow', label: 'Do as it says', effect: (s) => { s.trust.points = Math.max(0, s.trust.points - 1); s.res.water += 6; return 'You get some extra water and a very empty bar. Pilot Light admits the math was “aspirational”.'; } },
        { id: 'overrule', label: 'Overrule it', effect: (s) => { s.trust.points += 2; return '“Fine. Correct, actually. I was testing you.” It was not testing you.'; } },
      ],
    },
    pilot_good_advice: {
      text: 'Pilot Light: “The east wall has a crack you could post a letter through. I would patch it before the next raid.”',
      options: [
        { id: 'follow', label: 'Patch it (4 salvage)', when: (s) => s.res.salvage >= 4, effect: (s) => { s.res.salvage -= 4; s.trust.points += 2; s.patchedWall = s.day; return '“See? I am occasionally useful.” Defense is a little better tonight.'; } },
        { id: 'ignore', label: 'Ignore it', effect: (s) => { s.trust.points = Math.max(0, s.trust.points - 1); return '“Your funeral. Possibly literally.”'; } },
      ],
    },
    surrender: {
      text: (ev) => `A bandit from ${ev.site} surrendered to your team and now sits at your gate, unarmed.`,
      options: [
        { id: 'spare', label: 'Spare them and let them go', effect: (s) => { s.trust.points += 3; s.rep = Math.min(100, s.rep + 1); return 'They leave without looking back. Word gets around that you play fair.'; } },
        { id: 'hire', label: 'Offer them work', when: (s) => living(s).length < bedCount(s), effect: (s) => { s.trust.points += 2; s.crew.push(makeRecruit(s, { morale: 50 })); return 'They take the job. Pilot Light locks the silverware.'; } },
        { id: 'turn_over', label: 'Hand them to the nearest warlord', effect: (s) => { s.trust.points = Math.max(0, s.trust.points - 3); const w = s.warlords.filter((x) => x.alive).sort((a, b) => b.disposition - a.disposition)[0]; if (w) nudge(s, w.id, 6); return `${w ? w.name : 'A warlord'} is grateful. Pilot Light is not.`; } },
      ],
    },
  };

  // ======================================================================
  // The campaign: the relative in the vault, the intercom, the keycard.
  // ======================================================================
  const RELATIVES = ['Aunt Odile', 'Uncle Bertram', 'Cousin Wynn', 'Aunt Maren', 'Uncle Cal', 'Cousin Ilse'];
  const KEY_SITES = [
    { site: 'Elite relay station', danger: 2 },
    { site: 'Flooded transit vault', danger: 3 },
    { site: 'The Warden’s tower', danger: 4 },
  ];
  function storyState(s) {
    if (!s.story) s.story = { calls: 0, pieces: 0, callDay: 0, open: false, relative: RELATIVES[hashSeed(s.seed + 'rel') % RELATIVES.length] };
    return s.story;
  }
  // The calls, in order. Each needs trust or keycard progress before it rings.
  const CALLS = [
    {
      ready: (s, st) => s.trust.level >= 4,
      text: (st) => [`A voice through the static: “Is that… you came. You got my note.” It is ${st.relative}. You last saw them when you were small.`, '“I am alive. The door sealed behind me and has not opened since. There are Elite rations down here, and a pipe that leaks just enough.”'],
      options: [
        { id: 'who', label: '“Why the riddle? Why not just tell me?”', trust: 1, reply: '“Because a note can be found by the wrong person. You were the right one. I had to hope.”' },
        { id: 'pilot', label: '“Pilot Light knew you were down here?”', trust: 2, reply: '“I asked it not to tell you. It needed to know you would keep the place running and keep people alive. So did I.”' },
      ],
      after: '“The door wants a keycard. The Elite cut theirs in three before they left. I marked the pieces on the old maps. Pilot will put the first one on your board.”',
    },
    {
      ready: (s, st) => st.pieces >= 1,
      text: () => ['“You found one! I heard Pilot chirp all the way down here.”', '“This is not a vault for gold. It is a control room. The screens never went dark.”'],
      options: [
        { id: 'screens', label: '“What is on the screens?”', trust: 1, reply: '“Lights. Some moving up, some spreading out. I will show you when you are in. You should see it, not hear it.”' },
        { id: 'rations', label: '“Are you all right for food?”', trust: 2, reply: '“Two weeks, if I am careful. Thank you for asking. People forget to.”' },
      ],
      after: '“The second piece is in a flooded transit vault. Mind the water. The machines down there do not.”',
    },
    {
      ready: (s, st) => st.pieces >= 2,
      text: (st, s) => ['“Two pieces. One more.”', `“Pilot tells me things, you know. About the crew. How many have you lost?”${s.crew.some((c) => !c.alive && !c.left) ? '' : ' (You have not lost anyone yet.)'}`],
      options: [
        { id: 'truth', label: 'Tell the truth', trust: 3, reply: '“Thank you for not lying to me. The ones who lie about that stop counting. You have not stopped.”' },
        { id: 'lie', label: '“Nobody worth mentioning.”', trust: -3, reply: 'A long silence. “Pilot keeps a list, you know. Every name.”' },
      ],
      after: '“The last piece is in the Warden’s tower. Whoever held this place before the warlords built it to keep people out. Be careful.”',
    },
    {
      ready: (s, st) => st.pieces >= 3,
      text: (st) => ['“That is all three. Put them in the slot by the door.”', 'Pilot Light, quietly: “I need a moment.” Then, to the room: “Once that door opens, everything changes. For all of you.”'],
      options: [
        { id: 'ready', label: '“We are ready.”', trust: 2, reply: `${'“Are you?”'} Pilot does not sound convinced, but it does not sound unkind either.` },
        { id: 'pilot_choice', label: '“Your call, Pilot. When you are sure.”', trust: 3, reply: '“…Thank you. Nobody has asked me that before.”' },
      ],
      after: 'Pilot Light: “When I trust you completely, the door is yours.”',
    },
  ];
  function intercom(s) {
    const st = storyState(s);
    if (st.open || st.calls >= CALLS.length) return null;
    const call = CALLS[st.calls];
    if (!call.ready(s, st)) return null;
    if (st.callDay === s.day) return null;
    return { index: st.calls, lines: call.text(st, s), options: call.options.map((o) => ({ id: o.id, label: o.label })) };
  }
  function answerIntercom(s, optId) {
    const st = storyState(s);
    const view = intercom(s);
    if (!view) return null;
    const call = CALLS[st.calls];
    const o = call.options.find((x) => x.id === optId) || call.options[0];
    s.trust.points = Math.max(0, s.trust.points + o.trust);
    st.calls += 1; st.callDay = s.day;
    updateTrust(s);
    log(s, `You spoke with ${st.relative} over the intercom.`);
    storyMissions(s);
    return [o.reply, call.after];
  }
  // Keycard missions: one at a time, offered again if a team fails.
  function storyMissions(s) {
    const st = storyState(s);
    if (st.open || st.pieces >= 3 || st.calls <= st.pieces) return;
    if (s.missions.some((m) => m.scripted === 'keycard' && m.status !== 'done')) return;
    const k = KEY_SITES[st.pieces];
    const m = makeMission(s, 'salvage', { site: k.site, danger: k.danger, far: false, expiresIn: 99 });
    m.scripted = 'keycard'; m.piece = st.pieces + 1;
    m.reward = { salvage: 10 + k.danger * 4, buttons: 8 + k.danger * 4, food: 0, water: 0, recruit: 0, gear: 1 };
    s.missions.push(m);
    log(s, `Keycard piece ${m.piece} of 3 is at the ${k.site.toLowerCase()}. It is on the Missions board.`, 'good');
  }
  function canOpenVault(s) {
    const st = storyState(s);
    if (st.open) return 'It is already open.';
    if (st.pieces < 3) return `You have ${st.pieces} of 3 keycard pieces.`;
    if (st.calls < CALLS.length) return 'Answer the intercom first.';
    if (s.trust.level < 5) return `Pilot Light is not ready to open it. Trust: ${TRUST_LEVELS[s.trust.level - 1].name} (needs Trusted).`;
    return null;
  }
  function openVault(s) {
    const err = canOpenVault(s);
    if (err) return err;
    const st = storyState(s);
    st.open = true; st.openDay = s.day;
    const door = s.rooms.find((r) => r.type === 'sealed_door');
    if (door) { door.type = 'vault'; door.state = 'working'; }
    s.nextId = (s.nextId || 1) + 1;
    s.crew.push({ id: `c${s.nextId}`, name: st.relative, role: 'sawbones', level: 3, xp: 0, morale: 90, injured: 0, alive: true, custom: true, look: { skin: 2, hair: 5, coat: 3, build: 0, age: 2, style: 8, facial: 0, mark: 1, acc: 2, top: 2 }, bio: 'Ran this waystation before you. Spent a long time locked under it with a leaking pipe and a voice on the intercom. Knows more about the vault than anyone alive, and is still deciding how much to tell.', job: null, away: null, gear: null, origin: null, relative: true });
    log(s, `The vault is open. ${st.relative} is out, thin and blinking, and joins the crew.`, 'good');
    return null;
  }
  function vaultEnding(s) {
    const st = storyState(s);
    const lost = s.crew.filter((c) => !c.alive && !c.left).length;
    const fallen = s.warlords.filter((w) => !w.alive).length;
    return {
      pages: [
        `The three pieces click into place. Somewhere in the walls, Pilot Light lets out a breath it does not need. The door rolls aside on rails nobody has oiled in years, and ${st.relative} steps out into the lamplight.`,
        `Behind them, the control room hums. One screen shows a slow arc across the sky: the Elite station, three centuries gone, is coming back down. Another shows the wastes as a map, and the map is covered in red dots. They are moving. They are spreading fast.`,
        `Pilot Light: “Those are not warlords. The old sensors call them mutated. Every dot is a distress call, and the calls are getting closer together.” ${st.relative}: “I needed to be sure before I put this on you. Now we are sure.”`,
      ],
      stats: `Day ${s.day}. ${lost ? `${lost} of your people lost along the way.` : 'You lost no one along the way.'} ${fallen ? `${fallen} warlord${fallen > 1 ? 's' : ''} fell.` : ''}`.trim(),
      outro: 'The main story ends here. The mutated and the returning Elite are coming in a later chapter. The waystation is still yours: keep the lights on.',
    };
  }

  // ---------- recurring guests with short arcs ----------
  const GUESTS = ['marguerite', 'ansel', 'wes'];
  function nextGuestEvent(s, r) {
    s.guests = s.guests || { marguerite: 0, ansel: 0, wes: 0, next: 5 };
    if (s.day < s.guests.next) return null;
    const open = GUESTS.filter((g) => s.guests[g] < 3);
    if (!open.length) return null;
    const g = r.pick(open);
    s.guests.next = s.day + r.int(3, 5);
    return { id: `${g}${s.guests[g] + 1}` };
  }
  const advance = (s, g) => { s.guests[g] += 1; };
  Object.assign(EVENTS, {
    marguerite1: { text: 'A woman with ink-stained fingers and a roll of maps asks for a bed. “Marguerite Okoro, cartographer. I can pay in maps, not buttons.”', options: [
      { id: 'yes', label: 'Give her a room for maps', effect: (s) => { advance(s, 'marguerite'); s.rep = Math.min(100, s.rep + 2); s.trust.points += 1; return 'She sketches the bar from memory before breakfast. Pilot Light asks for a copy.'; } },
      { id: 'no', label: 'Buttons or nothing', effect: (s) => { s.guests.marguerite = 3; return 'She rolls up her maps and walks on. You do not see her again.'; } } ] },
    marguerite2: { text: 'Marguerite is back, sunburnt and pleased. “I found something on the old rail line. A cache nobody has touched. I will mark it for you.”', options: [
      { id: 'mark', label: 'Thank her', effect: (s) => { advance(s, 'marguerite'); const m = makeMission(s, 'salvage', { site: 'Marguerite’s marked cache', danger: 2, far: false, expiresIn: 4 }); m.reward.salvage += 15; m.reward.buttons = 10; s.missions.push(m); return 'A new salvage job is on the board.'; } } ] },
    marguerite3: { text: 'Marguerite spreads a new map on the bar: every road within three days, with your waystation at the center. “I am selling copies to every caravan I meet.”', options: [
      { id: 'proud', label: 'Buy her a drink', effect: (s) => { advance(s, 'marguerite'); s.rep = Math.min(100, s.rep + 8); s.guestTraffic = (s.guestTraffic || 0) + 1; return 'More travelers will find their way here now.'; } } ] },
    ansel1: { text: 'A thin man in a patched robe asks to speak at the bar tonight. “Brother Ansel. I bring hope, mostly. Occasionally soup.”', options: [
      { id: 'allow', label: 'Let him speak', effect: (s) => { advance(s, 'ansel'); for (const c of living(s)) c.morale = Math.min(100, c.morale + 6); s.trust.points += 1; return 'He is better than he looks. The crew go to bed lighter.'; } },
      { id: 'refuse', label: 'Not in my bar', effect: (s) => { s.guests.ansel = 3; return 'He bows and goes. Pilot Light says nothing, pointedly.'; } } ] },
    ansel2: { text: 'Brother Ansel returns with six hungry people. “Their camp burned. I told them you were decent. Please do not make me a liar.”', options: [
      { id: 'feed', label: 'Feed them (10 food)', when: (s) => s.res.food >= 10, effect: (s) => { advance(s, 'ansel'); s.res.food -= 10; s.trust.points += 3; s.rep = Math.min(100, s.rep + 4); s.travelers.unshift({ ...makeRecruit(s), rescued: true }); return 'They eat like they have forgotten how. One of them asks if you need hands.'; } },
      { id: 'turn', label: 'You cannot feed everyone', effect: (s) => { s.guests.ansel = 3; s.trust.points = Math.max(0, s.trust.points - 2); return 'Ansel nods slowly and leads them back onto the road.'; } } ] },
    ansel3: { text: 'Ansel’s people have set up camp a mile off. “We owe you. If anyone comes for this place at night, we will make noise and throw rocks. Loud rocks.”', options: [
      { id: 'accept', label: 'Accept the help', effect: (s) => { advance(s, 'ansel'); s.anselWatch = true; return 'Raids will find your walls a little better defended from now on.'; } } ] },
    wes1: { text: 'A man in a too-good coat shuffles a deck at the bar. “Wes Pardee. Fancy a hand? Ten buttons says I take you.”', options: [
      { id: 'play', label: 'Play (bet 10)', when: (s) => s.res.buttons >= 10, effect: (s) => { advance(s, 'wes'); const r = rng(s); if (r.chance(0.5)) { s.res.buttons += 10; return 'You win. Wes laughs like he meant to lose. Maybe he did.'; } s.res.buttons -= 10; return 'He wins. Of course he wins.'; } },
      { id: 'pass', label: 'Not tonight', effect: (s) => { advance(s, 'wes'); return 'Wes shrugs and finds a softer mark.'; } } ] },
    wes2: { text: 'A patron drags Wes to you by the collar. “He is cheating!” Wes, calmly: “I am winning. There is a difference.” He is cheating.', options: [
      { id: 'out', label: 'Throw him out', effect: (s) => { s.guests.wes = 3; s.rep = Math.min(100, s.rep + 4); s.trust.points += 2; return 'Wes leaves with dignity and most of his buttons. The bar cheers.'; } },
      { id: 'cut', label: 'Take a cut and look away', effect: (s) => { advance(s, 'wes'); s.res.buttons += 15; s.trust.points = Math.max(0, s.trust.points - 3); return 'Fifteen buttons slide across the bar. Pilot Light dims the lights over your head.'; } } ] },
    wes3: { text: 'Wes leans on the bar. “Let me run your card tables properly. Honest games, mostly. You will make more than you lose.”', options: [
      { id: 'hire', label: 'Let him run the tables', effect: (s) => { advance(s, 'wes'); s.wesTables = true; return 'Card nights get busier. Pilot Light keeps a very close eye on the dice.'; } },
      { id: 'no', label: 'Send him packing', effect: (s) => { s.guests.wes = 3; return 'He tips his hat and is gone by morning.'; } } ] },
  });

  function warlordDemand(s, w) {
    const amount = 6 + w.strength * 4;
    return {
      id: 'demand', warlord: w.id, amount,
      text: `A rider from ${w.name} (${w.archetype}) delivers a demand: ${amount} silver buttons as ${w.wants === 'tribute' ? 'tribute' : 'a “protection fee”'}.`,
    };
  }
  function eventView(s, ev) {
    if (ev.id === 'demand') {
      const w = s.warlords.find((x) => x.id === ev.warlord);
      return {
        text: ev.text,
        options: [
          { id: 'pay', label: `Pay ${ev.amount} buttons`, disabled: s.res.buttons < ev.amount },
          { id: 'haggle', label: 'Haggle', disabled: false },
          { id: 'refuse', label: 'Refuse', disabled: false },
        ],
        warlord: w,
      };
    }
    const def = EVENTS[ev.id];
    return {
      text: typeof def.text === 'function' ? def.text(ev) : def.text,
      options: def.options.map((o) => ({ id: o.id, label: o.label, disabled: o.when ? !o.when(s) : false })),
    };
  }
  function answerEvent(s, optionId) {
    const ev = s.pendingEvents.shift();
    if (!ev) return null;
    let result;
    if (ev.id === 'demand') {
      const w = s.warlords.find((x) => x.id === ev.warlord);
      const r = rng(s);
      if (optionId === 'pay' && s.res.buttons >= ev.amount) { s.res.buttons -= ev.amount; nudge(s, w.id, 12); result = `${w.name}'s rider leaves satisfied.`; }
      else if (optionId === 'haggle') {
        if (r.chance((w.temperament === 'aggressive' ? 0.3 : 0.6) + (running(s, 'messenger_post') ? 0.25 : 0))) { const half = Math.ceil(ev.amount / 2); const paid = Math.min(half, s.res.buttons); s.res.buttons -= paid; nudge(s, w.id, 6); result = `You talk them down to ${paid}. The rider grumbles but takes it.`; }
        else { nudge(s, w.id, -10); result = 'The rider spits in the dust. That did not go well.'; }
      } else { nudge(s, w.id, -15); result = `You refuse. ${w.name} will hear about it.`; }
    } else {
      const opt = EVENTS[ev.id].options.find((o) => o.id === optionId) || EVENTS[ev.id].options.at(-1);
      result = opt.when && !opt.when(s) ? 'You cannot do that right now.' : opt.effect(s);
    }
    clampRes(s);
    updateTrust(s);
    log(s, result);
    return result;
  }

  // ---------- Pilot Light trust ----------
  const TRUST_LEVELS = [
    { level: 1, name: 'Wary', at: 0 },
    { level: 2, name: 'Warming', at: 8 },
    { level: 3, name: 'Reliable', at: 20 },
    { level: 4, name: 'Confiding', at: 36 },
    { level: 5, name: 'Trusted', at: 56 },
  ];
  const TRUST_BEATS = {
    2: 'Pilot Light: “You know, you are not the worst owner this place has had. Top three, maybe.” It still will not talk about the door downstairs.',
    3: 'Pilot Light: “There are… things I was asked to keep safe. That is all I can say.” Behind the generator you find a note in your relative’s handwriting: “Don’t let it rust shut.”',
    4: 'Pilot Light: “All right. There is a vault below the sealed door. And someone in it who has been asking about you.” A crackle of static comes from the old intercom by the door. Tap the Sealed Door to answer it.',
    5: 'Pilot Light: “I trust you. Find the keycard and I will open every door in this place.”',
  };
  function updateTrust(s) {
    const lvl = TRUST_LEVELS.filter((t) => s.trust.points >= t.at).at(-1).level;
    // Trust falls slowly: at most one level below the highest reached.
    const floorLvl = Math.max(1, s.trust.best - 1);
    const next = Math.max(lvl, floorLvl);
    if (next > s.trust.level) {
      for (let l = s.trust.level + 1; l <= next; l++) if (TRUST_BEATS[l]) s.storyQueue.push(TRUST_BEATS[l]);
    }
    s.trust.level = next;
    s.trust.best = Math.max(s.trust.best, next);
  }

  // ---------- tutorial (Pilot Light guides) ----------
  const TUTORIAL = [
    { id: 'repair_guest', text: 'Tap the ruined Guest Rooms up top and repair them. This one is on the house.', done: (s) => stateOf(s, 'guest_room') === 'working' },
    { id: 'repair_bar', text: 'Now the Bar & Kitchen. Also free. Enjoy it, it will not last.', done: (s) => stateOf(s, 'bar') === 'working' },
    { id: 'repair_power', text: 'Below ground: repair the Generator and the Water Pump. Nothing runs without them.', done: (s) => stateOf(s, 'generator') === 'working' && stateOf(s, 'water_pump') === 'working' },
    { id: 'staff', text: 'Rooms need people. Tap the Generator and put someone on it. Then staff the Pump, Bar and Guest Rooms.', done: (s) => ['generator', 'water_pump', 'bar', 'guest_room'].every((t) => s.rooms.some((r) => r.type === t && workersIn(s, r.id).length > 0)) },
    { id: 'end_morning', text: 'When you are ready, press End morning. Patrons come at midday.', done: (s) => s.day > 1 || s.phase !== 'morning' },
    { id: 'end_evening', text: 'That is the evening crowd. Press End evening to close up for the night.', done: (s) => s.day > 1 },
    { id: 'intro_mission', text: 'Morning. Something got into the old pump station up the road. Open Missions, pick four of the crew, and send them.', done: (s) => s.introDone },
    { id: 'hire', text: 'We lost someone. Hire a new recruit from the travelers at the bar (Team panel). I am sorry. I liked them.', done: (s) => s.introHired },
    { id: 'name', text: 'One more thing. The sign out front still just says WAYSTATION. Your relative never named the place. Do you want to?', done: (s) => !!s.signDone },
  ];
  function stateOf(s, type) { const r = s.rooms.find((x) => x.type === type); return r ? r.state : null; }
  // Rooms the early tutorial steps depend on. If one is missing (an old save, a slip), put a free ruined one back.
  const TUTORIAL_ROOMS = [['guest_room', 0, 2], ['bar', 0, 4], ['generator', 1, 0], ['water_pump', 1, 1]];
  const TUTORIAL_ROOM_STEPS = 4;
  function restoreTutorialRooms(s) {
    if (!s.tutorial || s.tutorial.step >= TUTORIAL_ROOM_STEPS) return;
    for (const [type, row, col] of TUTORIAL_ROOMS) {
      if (s.rooms.some((r) => r.type === type)) continue;
      const w = ROOM_TYPES[type].w;
      let at = null;
      for (let c = col; c + w <= COLS && !at; c++) if (slotFree(s, row, c, w)) at = { row, col: c };
      for (let c = 0; c < col && !at; c++) if (slotFree(s, row, c, w)) at = { row, col: c };
      if (!at) continue;
      s.nextRoom = (s.nextRoom || 100) + 1;
      s.rooms.push({ id: `r${s.nextRoom}`, type, row: at.row, col: at.col, state: 'ruined', level: 1, free: true, buildLeft: 0 });
      log(s, `Pilot Light patched the ${ROOM_TYPES[type].name} back in. This one is on the house.`, 'good');
    }
  }
  function tutorialCheck(s) {
    restoreTutorialRooms(s);
    while (s.tutorial.step < TUTORIAL.length && TUTORIAL[s.tutorial.step].done(s)) {
      s.tutorial.step += 1;
      if (TUTORIAL[s.tutorial.step - 1].id === 'end_evening' && !s.missions.some((m) => m.scripted === 'intro')) {
        const m = makeMission(s, 'combat', { site: 'Old pump station', danger: 1, far: false, expiresIn: 999, scripted: 'intro' });
        m.reward = { salvage: 18, buttons: 8, food: 0, water: 0, recruit: 0 };
        s.missions.push(m);
      }
      if (s.tutorial.step >= TUTORIAL.length) { log(s, 'Pilot Light: “That is the basics. The rest you learn the hard way, like everyone.”', 'good'); refreshMissions(s); }
    }
  }
  function skipTutorial(s) {
    s.tutorial.step = TUTORIAL.length; s.introDone = true; s.introHired = true;
    for (const r of s.rooms) if (r.free) { r.state = 'working'; r.free = false; }
    s.missions = s.missions.filter((m) => !m.scripted);
    refreshMissions(s);
  }

  // ---------- day flow ----------
  function log(s, text, tone = '') { s.log.unshift({ day: s.day, phase: s.phase, text, tone }); s.log.length = Math.min(s.log.length, 80); }

  function endMorning(s, opts = {}) {
    if (s.phase !== 'morning' || s.gameOver) return null;
    if (s.battle) {
      if (!opts.auto) return { battle: s.battle.missionId };
      TAC.autoplay(s.battle, 40); finishBattle(s);
    }
    if (s.launchedDay !== s.day) { s.launchedDay = s.day; s.sentToday = launchMissions(s).map((m) => m.id); }
    // Teams arriving at their site today fight first (tactical battle, or auto-resolved).
    for (const m of s.missions) if (m.status === 'out' && m.fought === undefined) m.fought = false, m.arriveDay = s.day;
    const due = s.missions.find((m) => m.status === 'out' && !m.fought && m.arriveDay <= s.day);
    if (due) {
      if (opts.auto) { autoFight(s, due); return endMorning(s, opts); }
      startBattle(s, due);
      return { battle: due.id };
    }
    const sent = (s.sentToday || []).map((id) => s.missions.find((m) => m.id === id)).filter(Boolean);
    s.sentToday = [];
    s.phase = 'midday';
    const today = middayTick(s);
    const reports = [];
    for (const m of s.missions.filter((x) => x.status === 'out' && x.fought && x.returnDay <= s.day)) reports.push(returnMission(s, m));
    s.missions = s.missions.filter((m) => m.status !== 'done');
    s.phase = 'evening';
    // Job seekers at the bar this evening (weary travelers looking for work).
    const r = rng(s);
    const seekers = r.int(1, 2) + (s.rep > 40 ? 1 : 0);
    s.travelers = s.travelers.filter((t) => t.rescued).slice(0, 2);
    while (s.travelers.length < seekers + s.travelers.filter((t) => t.rescued).length) s.travelers.push(makeRecruit(s));
    log(s, `Midday: ${today.guests} guest${today.guests === 1 ? '' : 's'} stayed, ${today.served} served at the bar, ${today.buttons} silver buttons earned.`, today.buttons ? 'good' : '');
    tutorialCheck(s);
    return { sent, today, reports };
  }

  // Evening ends: a raid may hit (fought on the waystation map), then the night runs.
  function endEvening(s, opts = {}) {
    if (s.phase !== 'evening' || s.gameOver) return null;
    const r = rng(s);
    s.phase = 'night';
    s.night = { raid: null, event: null, lines: [] };
    let raider = null;
    if (s.raidPlan && s.raidPlan.day === s.day) raider = s.raidPlan.warlord ? s.warlords.find((w) => w.id === s.raidPlan.warlord && w.alive) || null : null;
    else raider = rollRaid(s, r);
    s.raidPlan = null;
    if (opts.forceRaid) raider = s.warlords.find((w) => w.alive && w.temperament === 'aggressive') || s.warlords.find((w) => w.alive);
    if (raider) {
      s.pendingRaid = { warlord: raider.id, count: raidSize(s, raider), style: raider.raidStyle };
      if (!opts.auto) return { raid: s.pendingRaid };
      startRaid(s, defaultDefenders(s));
      if (s.battle) { TAC.autoplay(s.battle, 40); finishRaid(s); }
    }
    return finishNight(s);
  }
  function raidSize(s, w) { return Math.max(2, Math.min(8, 2 + w.strength + (w.temperament === 'aggressive' ? 1 : 0) + diff(s).size)); }
  function defaultDefenders(s) {
    const towers = new Set(s.rooms.filter((x) => x.type === 'watchtower').map((x) => x.id));
    const guard = (c) => (towers.has(c.job) ? 100 : 0) + (c.role === 'recruit' ? 2 : roleById(c.role).guard) * 3 + c.level;
    return atHome(s).filter((c) => c.injured === 0).sort((a, c) => guard(c) - guard(a)).slice(0, 6).map((c) => c.id);
  }
  function raidBase(s) {
    const SKIP = ['wall', 'watchtower'];
    return {
      rooms: s.rooms.filter((x) => x.row === 0 && !SKIP.includes(x.type) && x.state !== 'ruined').map((x) => ({ id: x.id, name: ROOM_TYPES[x.type].name, col: x.col, w: ROOM_TYPES[x.type].w })),
      wallPower: s.rooms.filter((x) => x.type === 'wall').reduce((n, x) => n + (x.state === 'working' ? x.level : x.state === 'damaged' ? 0.5 : 0), 0) + (s.patchedWall === s.day ? 1 : 0) + (s.anselWatch ? 0.5 : 0),
      towers: s.rooms.filter((x) => x.type === 'watchtower' && x.state === 'working').map((x) => x.col),
      checkpoint: running(s, 'checkpoint'),
      turrets: s.rooms.filter((x) => x.type === 'turret_nest' && isRunning(s, x)).map((x) => ({ col: x.col, level: x.level })),
      towerCrew: s.crew.filter((c) => c.alive && !c.away && s.rooms.some((x) => x.id === c.job && x.type === 'watchtower')).map((c) => c.id),
    };
  }
  // Start the raid battle with the chosen defenders. No defenders: everyone hides below.
  function startRaid(s, ids) {
    const pr = s.pendingRaid;
    if (!pr) return 'There is no raid.';
    const w = s.warlords.find((x) => x.id === pr.warlord);
    const crew = ids.map((id) => s.crew.find((c) => c.id === id)).filter((c) => c && c.alive && !c.away && c.injured === 0).slice(0, 6);
    const r = rng(s);
    s.battle = TAC.create({ seed: r.int(1, 2 ** 30), kind: 'raid', site: 'The waystation', crew, owner: w, style: pr.style, count: pr.count, base: raidBase(s), perks: battlePerks(s) });
    s.battle.raidOf = pr.warlord;
    if (!crew.length) TAC.retreat(s.battle);
    return null;
  }
  function finishRaid(s) {
    const b = s.battle;
    if (!b || !b.over || b.kind !== 'raid') return 'The raid is not over.';
    const o = b.over;
    const w = s.warlords.find((x) => x.id === b.raidOf);
    const r = rng(s);
    s.battle = null; s.pendingRaid = null;
    const res = { warlord: w ? w.name : 'Raiders', outcome: o.outcome, how: o.how, lines: [], kills: o.kills, wrecked: [] };
    for (const id of o.died) {
      const c = s.crew.find((x) => x.id === id);
      if (c && c.alive) { c.alive = false; c.job = null; res.lines.push(`${c.name} died defending the waystation.`); log(s, `${c.name} died defending the waystation.`, 'bad'); }
    }
    for (const st of o.survived) {
      const c = s.crew.find((x) => x.id === st.crewId);
      if (!c) continue;
      const days = st.downed ? 3 : st.hpLost > 0.5 ? 2 : st.hpLost > 0.2 ? 1 : 0;
      if (days) c.injured = Math.max(c.injured, days);
      addXp(s, c, 15 + st.kills * 15 + (o.outcome === 'repelled' ? 15 : 0));
    }
    for (const id of o.wrecked) {
      const room = s.rooms.find((x) => x.id === id);
      if (!room || room.state === 'ruined') continue;
      room.state = 'damaged';
      for (const c of s.crew) if (c.job === room.id) c.job = null;
      res.wrecked.push(ROOM_TYPES[room.type].name);
    }
    if (o.outcome === 'repelled' && w) w.hold = Math.max(0, (w.hold ?? 100) - 10);
    if (o.outcome === 'repelled') {
      res.lines.unshift(`${res.warlord}'s raiders broke on the walls.${o.fled ? ` ${o.fled} ran for it.` : ''}`);
      for (const c of atHome(s)) c.morale = Math.min(100, c.morale + 5);
      s.trust.points += 1;
      s.res.salvage += o.kills * 2;
      if (o.kills) res.lines.push(`The crew stripped ${o.kills * 2} salvage from the ones who did not leave.`);
    } else if (o.outcome === 'breached') {
      const stolen = Math.floor(s.res.buttons * Math.min(0.4, 0.1 + 0.05 * o.wrecked.length + (o.how === 'fellback' ? 0.1 : 0)));
      s.res.buttons -= stolen;
      res.lines.unshift(o.how === 'fellback' ? 'The crew went below and waited it out. Up top, the raiders took their time.' : `${res.warlord}'s raiders got what they came for and left.`);
      if (stolen) res.lines.push(`They took ${stolen} silver buttons on the way out.`);
      for (const c of atHome(s)) c.morale = Math.max(0, c.morale - 8);
    } else {
      res.lines.unshift(`${res.warlord}'s raiders cut down the last of the defenders.`);
      s.gameOver = 'Raiders took the waystation.';
    }
    if (res.wrecked.length) res.lines.push(`Wrecked: ${res.wrecked.join(', ')}. Repair them from the cutaway.`);
    if (o.surrendered || (o.outcome === 'repelled' && r.chance(0.3))) { res.lines.push('One raider was left behind, wounded and begging.'); s.pendingEvents.push({ id: 'surrender', site: 'the gate' }); }
    if (w) nudge(s, w.id, -4);
    if (!s.night) s.night = { raid: null, event: null, lines: [] };
    s.night.raid = res;
    return null;
  }
  function finishNight(s) {
    if (s.phase !== 'night' || s.battle || s.pendingRaid) return null;
    const r = rng(s);
    const night = s.night || { raid: null, event: null, lines: [] };
    s.night = null;
    if (s.gameOver) { s.lastNight = night; return night; }
    if (s.patchedWall === s.day && night.raid) night.lines.push('The patched wall held where it would have cracked.');
    if (!night.raid && r.chance(0.35)) {
      night.event = r.pick([
        'A traveler knocked after dark. Pilot Light let them in, grudgingly.',
        'Someone sang at the bar until the lamps went down.',
        'A pipe sprang a leak below ground. The crew patched it with a boot.',
        'Coyotes circled the wall and thought better of it.',
        'The sealed door hummed for an hour, then stopped.',
      ]);
    }
    // Upkeep: crew eat and drink, rooms cost maintenance.
    const people = living(s).filter((c) => !c.away).length;
    const away = living(s).filter((c) => c.away).length;
    const foodNeed = people, waterNeed = people;
    const short = s.res.food < foodNeed || s.res.water < waterNeed;
    s.res.food -= Math.min(s.res.food, foodNeed);
    s.res.water -= Math.min(s.res.water, waterNeed);
    // Upkeep: rooms that run machines or need tending. Bunks, walls and storage cost nothing.
    const maint = Math.round(s.rooms.filter((x) => x.state === 'working' && (ROOM_TYPES[x.type].staff || ROOM_TYPES[x.type].power)).reduce((n, x) => n + x.level, 0) * diff(s).upkeep);
    s.res.buttons -= maint;
    night.lines.push(`The crew ate ${foodNeed} food and drank ${waterNeed} water${away ? ` (${away} away on missions)` : ''}. Upkeep cost ${maint} silver buttons.`);
    if (short) { for (const c of living(s)) c.morale = Math.max(0, c.morale - 12); night.lines.push('There was not enough to go around. Morale dropped.'); }
    // Beds: anyone without a bed loses morale.
    if (living(s).length > bedCount(s)) { for (const c of living(s)) c.morale = Math.max(0, c.morale - 4); night.lines.push('Some of the crew slept on the floor.'); }
    // Healing and morale drift
    const clinic = s.rooms.some((x) => x.type === 'clinic' && isRunning(s, x));
    for (const c of living(s)) {
      if (c.injured > 0) c.injured = Math.max(0, c.injured - (clinic ? 2 : 1));
      c.morale += c.morale < 60 ? 2 : c.morale > 70 ? -1 : 0;
    }
    // Low morale: people leave.
    for (const c of living(s)) {
      if (c.morale < 12 && !c.away && r.chance(0.5)) { c.alive = false; c.left = true; c.job = null; night.lines.push(`${c.name} packed a bag in the night and left.`); }
    }
    // Construction progress
    for (const room of s.rooms.filter((x) => x.state === 'building')) {
      room.buildLeft -= 1;
      if (room.buildLeft <= 0) { room.state = 'working'; night.lines.push(`The ${ROOM_TYPES[room.type].name} is finished.`); }
    }
    politicsNight(s, r, night);
    if (s.rep >= 20 && !s.gameOver) s.trust.points += 1; // Pilot Light warms to an owner who keeps the place running
    if (storyState(s).calls > 0 && !s.story.open && r.chance(0.25)) night.lines.push(r.pick([`${s.story.relative} hummed something over the intercom until the lamps went down.`, 'The intercom clicked twice in the night. Pilot Light clicked back.', `${s.story.relative} asked Pilot Light for the weather. Pilot made some up.`]));
    researchNight(s, night);
    clampRes(s);
    // Next day
    s.day += 1;
    successors(s, r, night);
    if (running(s, 'informants')) {
      const w = rollRaid(s, r);
      s.raidPlan = { day: s.day, warlord: w ? w.id : null };
      if (w) { night.lines.push(`Your informants say ${w.name} is planning a raid tonight.`); log(s, `Informants: ${w.name} will raid tonight.`, 'bad'); }
      else night.lines.push('Your informants hear nothing about a raid tonight.');
    }
    s.phase = 'morning';
    s.lastNight = night;
    // Warlord strength grows; survivors keep pace with the player.
    const best = Math.max(1, ...living(s).map((c) => c.level));
    for (const w of s.warlords) if (w.alive) w.strength = Math.max(w.strength, 1 + Math.floor((s.day - 1) / 10), Math.floor(best / 2));
    // Morning events and demands (not during the tutorial's first days).
    if (s.tutorial.step >= TUTORIAL.length && s.pendingEvents.length === 0) {
      if (r.chance(0.22)) { const pool = s.warlords.filter((w) => w.alive && w.disposition < 30 && w.stance !== 'pact'); if (pool.length) s.pendingEvents.push(warlordDemand(s, r.pick(pool))); }
      else if (r.chance(0.5)) { const g = nextGuestEvent(s, r); if (g) s.pendingEvents.push(g); }
      if (!s.pendingEvents.length && r.chance(0.35)) s.pendingEvents.push({ id: r.pick(['water_question', 'sick_traveler', 'trader', 'pilot_advice', 'pilot_good_advice']) });
    }
    refreshMissions(s);
    // Failure checks
    if (!s.gameOver && s.res.buttons <= 0) s.gameOver = 'The waystation ran out of silver buttons.';
    if (!s.gameOver && living(s).length === 0) s.gameOver = 'There is no one left to run the waystation.';
    updateTrust(s);
    tutorialCheck(s);
    log(s, `Day ${s.day} begins.${night.raid ? ` Raid by ${night.raid.warlord}: ${night.raid.outcome}.` : ''}`, night.raid ? (night.raid.outcome === 'repelled' ? 'good' : 'bad') : '');
    return night;
  }

  function hire(s, travelerId, custom) {
    if (living(s).length >= bedCount(s)) return 'No free bunks. Repair or build Crew Quarters first.';
    let c;
    if (custom) {
      if (!custom.name || !custom.name.trim()) return 'Give your recruit a name.';
      if (s.res.buttons < 5) return 'A custom recruit costs 5 silver buttons for the word to get out.';
      s.res.buttons -= 5;
      c = makeRecruit(s, { name: custom.name.trim().slice(0, 24), custom: true, look: custom.look });
    } else {
      const i = s.travelers.findIndex((t) => t.id === travelerId);
      if (i < 0) return 'They already left.';
      c = s.travelers.splice(i, 1)[0];
      delete c.rescued;
    }
    s.crew.push(c);
    log(s, `${c.name} signs on as a recruit.`, 'good');
    if (s.introDone) s.introHired = true;
    tutorialCheck(s);
    return null;
  }

  function giftWarlord(s, id) {
    const w = s.warlords.find((x) => x.id === id);
    if (!w || !w.alive) return 'They are gone.';
    if (w.giftedDay === s.day) return 'You already sent a gift today.';
    if (s.res.buttons < 5) return 'A gift costs 5 silver buttons.';
    s.res.buttons -= 5; w.giftedDay = s.day; nudge(s, w.id, (w.temperament === 'aggressive' ? 2 : 5) + (running(s, 'messenger_post') ? 2 : 0));
    log(s, `You sent ${w.name} a gift of 5 silver buttons.`);
    return null;
  }

  // ---------- new game & saves ----------
  const START_ROOMS = [
    ['wall', 0, 0, 'damaged'], ['watchtower', 0, 1, 'ruined'], ['guest_room', 0, 2, 'ruined', true], ['bar', 0, 4, 'ruined', true], ['wall', 0, 9, 'damaged'],
    ['generator', 1, 0, 'ruined', true], ['water_pump', 1, 1, 'ruined', true], ['team_management', 1, 2, 'working'], ['crew_quarters', 1, 3, 'working'], ['crew_quarters', 1, 4, 'working'], ['food', 1, 5, 'ruined'],
    ['clinic', 2, 0, 'ruined'], ['storage', 2, 1, 'ruined'], ['sealed_door', 2, 9, 'sealed'],
  ];
  function newGame(seed = Date.now()) {
    const s = {
      v: SAVE_VERSION, seed: String(seed), rng: hashSeed(seed), day: 1, phase: 'morning',
      res: { buttons: 60, salvage: 24, food: 40, water: 40 }, rep: 10, dug: 2, difficulty: 'standard', ironman: false,
      rooms: START_ROOMS.map(([type, row, col, state, free], i) => ({ id: `r${i + 1}`, type, row, col, state, level: 1, free: !!free, buildLeft: 0 })),
      crew: [], travelers: [], missions: [], warlords: [], log: [], pendingEvents: [], pendingRoleChoice: [], storyQueue: [],
      trust: { points: 0, level: 1, best: 1 }, tutorial: { step: 0 }, introDone: false, introHired: false, gameOver: null, lastNight: null, today: null, signDone: false, saveName: '',
    };
    for (let i = 0; i < 5; i++) s.crew.push(makeRecruit(s));
    s.warlords = generateWarlords(s);
    s.log.push({ day: 1, phase: 'morning', text: 'A courier dropped you at the gate with a note from a relative you barely remember: “It’s yours now. Keep the lights on.”', tone: '' });
    return s;
  }
  function serialize(s) { return JSON.stringify({ v: SAVE_VERSION, s }); }
  function deserialize(text) {
    const o = JSON.parse(text);
    if (!o || o.v !== SAVE_VERSION || !o.s) throw new Error('Save is from a different version.');
    if (o.s.signDone === undefined) {
      // saves from before the naming step: anyone already past the old tutorial skips it
      const past = o.s.tutorial && o.s.tutorial.step >= 8;
      o.s.signDone = !!o.s.name || past;
      if (past) o.s.tutorial.step = Math.max(o.s.tutorial.step, 9);
    }
    if (o.s.saveName === undefined) o.s.saveName = '';
    restoreTutorialRooms(o.s);
    return o.s;
  }

  // The name on the sign: letters, digits, spaces and a little punctuation, up to 16 characters.
  function cleanName(raw) {
    const n = String(raw || '').toUpperCase().replace(/[^A-Z0-9 '&.!-]/g, '').replace(/\s+/g, ' ').trim().slice(0, 16);
    return n || 'WAYSTATION';
  }
  function setName(s, raw) { s.name = cleanName(raw); s.signDone = true; tutorialCheck(s); return null; }
  function leaveSign(s) { s.signDone = true; tutorialCheck(s); }
  const nameOf = (s) => s.name || 'WAYSTATION';
  return {
    cleanName, setName, leaveSign, nameOf,
    COLS, MAX_UNDER, ROOM_TYPES, BUILDABLE, ROLES, roleById, TRUST_LEVELS, TUTORIAL, LEVEL_MULT,
    newGame, serialize, deserialize, rng, checkGuarantees, DIFFICULTY, setDifficulty, MARKET, marketLeft, buySupplies, storyState, intercom, answerIntercom, canOpenVault, openVault, vaultEnding, GEAR, TECH, TECH_BRANCHES, LEVEL_TECH, hasTech, techById, techStatus, startResearch, craftGear, CRAFT_COST, equipGear, proposePact, breakPact, oppose, standDown, conspire, endConspiracy, pactCost, eliminateWarlord,
    roomAt, slotFree, workersIn, costOf, canPay, buildRoom, repairRoom, upgradeRoom, demolishRoom, digCost, dig, assignJob,
    powerReport, isRunning, caps, bedCount, living, atHome, chooseRole, hire, giftWarlord,
    successChance, setSquad, defenseScore, raidChance, startBattle, finishBattle, missionOwner, startRaid, finishRaid, finishNight, defaultDefenders, raidBase,
    eventView, answerEvent, endMorning, endEvening, skipTutorial, tutorialCheck, updateTrust,
  };
})();
