// God mode: passphrase, flags and operations on plain state. Run: node test/god.cjs
const fs = require('fs'), vm = require('vm');
const ctx = { console, Math, Date }; vm.createContext(ctx);
const src = (f) => fs.readFileSync(__dirname + '/../src/' + f, 'utf8');
vm.runInContext(src('rules.js') + ';' + src('tactics.js') + ';' + src('god.js') + ';globalThis.UNM=UNM;globalThis.TAC=TAC;', ctx);
const { UNM, TAC } = ctx, G = UNM.god;
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('FAIL', m); } };
const expectNull = (r, m) => ok(r === null, m + ' -> ' + r);

// passphrase
ok(G.check('SicParvisMagna'), 'right passphrase');
ok(G.check('  SicParvisMagna '), 'passphrase ignores outer spaces');
ok(!G.check('sicparvismagna'), 'case matters');
ok(!G.check(''), 'empty rejected');
ok(!G.check('SicParvisMagna!'), 'wrong rejected');
ok(G.sha256('abc') === 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad', 'sha256 vector');

const s = UNM.newGame(7);
// resources, rep, trust, day
expectNull(G.setRes(s, 'buttons', 500), 'setRes'); ok(s.res.buttons === 500, 'buttons set');
ok(G.setRes(s, 'gold', 1) !== null, 'bad resource refused'); ok(G.setRes(s, 'food', 'x') !== null, 'NaN refused');
G.setRep(s, 150); ok(s.rep === 100, 'rep clamps');
G.setTrust(s, 5); ok(s.trust.level === 5, 'trust 5'); G.setTrust(s, 2); ok(s.trust.level === 2, 'trust back to 2');
G.setDay(s, 12); ok(s.day === 12, 'day');
// crew
const n0 = s.crew.length; G.addRecruit(s, 'bulwark', 3); ok(s.crew.length === n0 + 1 && s.crew.at(-1).role === 'bulwark' && s.crew.at(-1).level === 3, 'add recruit');
const c = s.crew[0]; c.injured = 3; c.alive = false; G.healCrew(s, c.id); ok(c.alive && c.injured === 0 && c.morale === 100, 'heal/revive');
G.setLevel(s, c.id, 2); ok(c.level === 3, 'level up'); G.setRole(s, c.id, 'tinker'); ok(c.role === 'tinker', 'role');
ok(G.setRole(s, c.id, 'wizard') !== null, 'bad role refused');
G.dismiss(s, s.crew.at(-1).id); ok(s.crew.length === n0, 'dismiss');
// rooms
G.repairAll(s); ok(s.rooms.every((r) => r.state === 'working' || r.state === 'sealed'), 'repair all');
expectNull(G.buildAnywhere(s, 'workshop'), 'build workshop without tech'); ok(s.rooms.some((r) => r.type === 'workshop' && r.state === 'working'), 'workshop built');
ok(G.buildAnywhere(s, 'workshop') === null || true, 'second workshop ok or refused');
G.maxRooms(s); ok(s.rooms.filter((r) => r.type === 'bar').every((r) => r.level === 3), 'max rooms');
G.staffAll(s); ok(s.crew.some((x) => x.job), 'staff all');
G.setDug(s, 4); ok(s.dug === 4, 'dig');
const gr = s.rooms.find((r) => r.type === 'guest_room'); G.demolish(s, gr.id); ok(!s.rooms.includes(gr), 'demolish');
// tech
G.unlockTech(s); ok(UNM.TECH.every((t) => UNM.hasTech(s, t.id)), 'all tech');
G.relockTech(s); ok(!UNM.hasTech(s, 'h1'), 'tech relocked');
// flags
G.toggle(s, 'freeBuild'); const before = { ...s.res }; G.buildAnywhere(s, 'bar'); ok(s.res.buttons === before.buttons && s.res.salvage === before.salvage, 'free build costs nothing');
G.toggle(s, 'infinite'); ok(s.res.buttons >= 9999, 'infinite buttons');
G.toggle(s, 'undying'); s.res.buttons = 0; s.crew.forEach((x) => (x.alive = false)); s.phase = 'night'; s.night = { raid: null, event: null, lines: [] }; s.battle = null; s.pendingRaid = null;
UNM.finishNight(s); ok(!s.gameOver, 'undying: no game over');
ok(G.toggle(s, 'nope') !== null, 'unknown flag');
// missions / warlords / gear / story
const m0 = s.missions.length; G.addMission(s, 'elite', 3); ok(s.missions.length === m0 + 1, 'mission added');
G.giveGear(s, 'plating'); ok(s.gear.includes('plating'), 'gear');
const w = s.warlords[0]; G.setDisposition(s, w.id, 999); ok(w.disposition === 100, 'disposition clamps');
G.raidTonight(s, w.id); ok(s.god.forceRaid === w.id, 'raid queued');
G.storyDone(s); ok(UNM.storyState(s).pieces === 3 && s.trust.level === 5, 'story prerequisites');
G.befriendAll(s); G.removeWarlord(s, s.warlords[1].id); ok(!s.warlords[1].alive, 'warlord removed');
// battle flags
const s2 = UNM.newGame(3); const squad = s2.crew.slice(0, 4); squad.forEach((x) => (x.level = 3));
const b = TAC.create({ seed: 5, kind: 'combat', site: 'x', danger: 3, crew: squad }); s2.battle = b;
G.toggle(s2, 'invincible'); G.toggle(s2, 'sureHit'); G.toggle(s2, 'oneHit');
const o = TAC.autoplay(b, 30); ok(o && o.died.length === 0, 'invincible squad loses nobody');
const s3 = UNM.newGame(4); const b3 = TAC.create({ seed: 9, kind: 'combat', site: 'x', danger: 3, crew: s3.crew.slice(0, 4) }); s3.battle = b3;
expectNull(G.healSquad(s3), 'heal squad'); expectNull(G.winBattle(s3), 'win battle'); ok(b3.over && b3.over.outcome === 'success', 'win battle ends successfully: ' + JSON.stringify(b3.over && b3.over.outcome));
G.reset(s3); ok(Object.keys(s3.god).length === 0 && TAC.god && Object.keys(TAC.god).length === 0, 'reset');
// saves round-trip with god flags
G.toggle(s, 'freeBuild'); const back = UNM.deserialize(UNM.serialize(s)); ok(back.god && back.god.freeBuild !== undefined, 'god flags survive save');
// normal play untouched
const n = UNM.newGame(11); ok(!n.god, 'new game has no god state'); TAC.god = null;
console.log(fails ? `god: ${fails} FAILED` : 'god: all ok');
process.exit(fails ? 1 : 0);
