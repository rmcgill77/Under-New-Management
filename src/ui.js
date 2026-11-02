// ============================================================================
// Interface: top bar, side panel, sheets, Pilot Light, tutorial. Calls the
// rules in UNM, saves, and re-renders. Clicks are delegated via data-act.
// ============================================================================
(() => {
  const $ = (id) => document.getElementById(id);
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const T = UNM.ROOM_TYPES;
  const OLD_SAVE_KEY = 'unm-save-v1', OLD_DAY_KEY = 'unm-day-v1';
  const SLOT_KEY = (i) => `unm-slot-${i}`;
  const PREF_KEY = 'unm-prefs-v1';
  const DAY_KEY = (i) => `unm-day-${i}`;   // start-of-day snapshot per slot (not kept in Ironman)
  const SLOTS = 3;

  let s = null;                 // game state
  let tab = 'room';
  let panelOpen = true;
  let sel = null;               // {kind:'room', id} | {kind:'slot', row, col} | {kind:'dig'}
  let sheets = [];              // queued sheet descriptors
  let toastTimer = null, bubbleTimer = null;
  let prefs = loadPrefs();
  let scene = null;
  let seenNight = 0;
  let roleDeferredAt = '';
  let raidPick = [];

  // ---------- storage (guarded: may be unavailable) ----------
  let installEvt = null;        // the browser's install prompt, when it offers one
  const isStandalone = () => { try { return matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches || navigator.standalone === true; } catch (e) { return false; } };
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvt = e; if (menuOpen && menuEl) renderMenu(); });
  window.addEventListener('appinstalled', () => { installEvt = null; if (menuOpen && menuEl) renderMenu(); try { toast('Installed. Find it with your other apps.'); } catch (e) { /* ignore */ } });
  let slot = null;              // which save slot is being played (0-2), null at the main menu
  let menuOpen = false, menuEl = null;
  let lastStep = -1;
  function save() {
    if (slot === null) return;
    try {
      if (s.gameOver && s.ironman) { localStorage.removeItem(SLOT_KEY(slot)); localStorage.removeItem(DAY_KEY(slot)); return; }
      s.savedAt = Date.now();
      localStorage.setItem(SLOT_KEY(slot), UNM.serialize(s));
      if (!s.ironman && !s.gameOver && s.phase === 'morning' && !s.battle && s.dayMark !== s.day) { s.dayMark = s.day; localStorage.setItem(DAY_KEY(slot), UNM.serialize(s)); }
    } catch (e) { /* session only */ }
  }
  function dayStart() { try { const t = slot === null ? null : localStorage.getItem(DAY_KEY(slot)); return t ? UNM.deserialize(t) : null; } catch (e) { return null; } }
  let setup = { difficulty: 'standard', ironman: false, tutorial: true, saveName: '' };
  // The single save from before there were slots becomes slot 1.
  function migrateOldSave() {
    try {
      const t = localStorage.getItem(OLD_SAVE_KEY);
      if (!t) return;
      if (!localStorage.getItem(SLOT_KEY(0))) {
        const st = UNM.deserialize(t); st.saveName = st.saveName || 'Waystation'; st.savedAt = st.savedAt || Date.now();
        localStorage.setItem(SLOT_KEY(0), UNM.serialize(st));
        const d = localStorage.getItem(OLD_DAY_KEY); if (d) localStorage.setItem(DAY_KEY(0), d);
      }
      localStorage.removeItem(OLD_SAVE_KEY); localStorage.removeItem(OLD_DAY_KEY);
    } catch (e) { /* ignore */ }
  }
  function readSlot(i) { try { const t = localStorage.getItem(SLOT_KEY(i)); return t ? UNM.deserialize(t) : null; } catch (e) { return { broken: true }; } }
  function loadPrefs() {
    const osStill = (() => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } })();
    const osContrast = (() => { try { return matchMedia('(prefers-contrast: more)').matches; } catch (e) { return false; } })();
    const base = { res: ['buttons', 'salvage', 'food', 'water', 'power', 'defense'], music: true, sfx: true, text: 'md', cb: false, fast: false,
      font: 'std', loose: false, hc: osContrast, still: osStill, big: false, focus: false, hold: 'normal', vMusic: 100, vSfx: 100 };
    try { return { ...base, ...(JSON.parse(localStorage.getItem(PREF_KEY)) || {}) }; } catch (e) { return base; }
  }
  function savePrefs() { try { localStorage.setItem(PREF_KEY, JSON.stringify(prefs)); } catch (e) { /* ignore */ } }

  // Apply every display, motion and sound preference. Safe to call often.
  function applyPrefs() {
    const b = document.body.classList;
    for (const k of ['md', 'lg', 'xl', 'xxl']) b.toggle(`text-${k}`, prefs.text === k && k !== 'md');
    b.toggle('font-easy', prefs.font === 'easy'); b.toggle('font-plain', prefs.font === 'plain');
    b.toggle('space-loose', !!prefs.loose); b.toggle('hc', !!prefs.hc); b.toggle('cb', !!prefs.cb);
    b.toggle('still', !!prefs.still); b.toggle('big-touch', !!prefs.big); b.toggle('focus-strong', !!prefs.focus);
    window.__still = !!prefs.still;
    Sound.setVolume('music', prefs.vMusic / 100); Sound.setVolume('sfx', prefs.vSfx / 100);
    Battle.setOptions({ fast: prefs.fast || prefs.still, still: prefs.still, cb: prefs.cb, god: godUnlocked });
  }
  const HOLD = { normal: 1, slow: 2.5, tap: 0 };   // how long messages stay up; 0 = until tapped

  // ---------- updates ----------
  // The installed copy keeps an offline cache. A new build installs quietly in the background and waits;
  // we tell the player, and "Update now" hands over to it and reloads. Saves are already on the device.
  let swReg = null, updateReady = false, applying = false, laterHidden = false;
  const BUILD = window.__BUILD || '';
  function showUpdate() { updateReady = true; if (!laterHidden) $('update').hidden = false; if (document.getElementById('sheet') && sheets[0] && /ettings$/.test(sheets[0].kind)) render(); }
  function applyUpdate() {
    save();
    applying = true;
    $('update').hidden = true;
    toast('Updating…');
    const w = swReg && swReg.waiting;
    if (w) w.postMessage({ type: 'SKIP_WAITING' });
    else location.reload();
    setTimeout(() => { if (applying) location.reload(); }, 4000);   // fallback if the switch event never arrives
  }
  function checkForUpdate(manual) {
    if (!swReg) { if (manual) toast(window.__PWA ? 'Updates are not available right now.' : 'This preview copy does not update itself.'); return; }
    swReg.update().then(() => {
      if (swReg.waiting || swReg.installing) { if (manual && !updateReady) toast('Found a new version. Getting it ready…'); return; }
      if (manual) toast('You are on the latest version.');
    }).catch(() => { if (manual) toast('Could not check. Are you offline?', true); });
  }
  function setupUpdates() {
    if (!window.__PWA || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('sw.js').then((reg) => {
      swReg = reg;
      const watch = (w) => { if (w) w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) showUpdate(); }); };
      if (reg.waiting && navigator.serviceWorker.controller) showUpdate();
      reg.addEventListener('updatefound', () => watch(reg.installing));
      const check = () => reg.update().catch(() => { /* offline */ });
      setInterval(check, 20 * 60 * 1000);
      document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
      window.addEventListener('online', check);
    }).catch(() => { /* offline copy unavailable */ });
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (applying) location.reload(); });
  }

  // ---------- hidden developer tools (see god.js) ----------
  let godUnlocked = false, godTaps = 0, godTapAt = 0, godFails = 0, godLockUntil = 0;

  // ---------- Pilot Light voice ----------
  let audio = null;
  function chirp(kind = 'talk') {
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      const now = audio.currentTime;
      const notes = kind === 'warn' ? [440, 349] : kind === 'good' ? [523, 659, 784] : [587, 698];
      notes.forEach((f, i) => {
        const o = audio.createOscillator(), g = audio.createGain();
        o.type = 'triangle'; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, now + i * 0.08);
        g.gain.exponentialRampToValueAtTime(0.07, now + i * 0.08 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.08 + 0.15);
        o.connect(g).connect(audio.destination); o.start(now + i * 0.08); o.stop(now + i * 0.08 + 0.17);
      });
    } catch (e) { /* no audio */ }
  }
  const PILOT_IDLE = {
    1: ['I have kept the lights on for years. Well. One light.', 'Patrons pay in silver buttons. Do not ask me to make more. I tried.', 'New owner. Hm. You have your relative’s chin.', 'If anyone knocks after dark, I am a very large, very angry dog.'],
    2: ['You are not the worst owner this place has had. Top three, maybe.', 'The crew likes you. I am reserving judgment. Professionally.'],
    3: ['There are things I was asked to keep safe. Do not ask which things.', 'Your relative used to talk to me at night. You talk to me at noon. Progress.'],
    4: ['The intercom by the sealed door still works. Someone is listening.'],
    5: ['Whatever happens, I am with you. Mostly in the walls, but with you.'],
  };
  function pilotSays() {
    const r = Math.random;
    const lines = [];
    const tut = UNM.TUTORIAL[s.tutorial.step];
    if (tut) return tut.text;
    const p = UNM.powerReport(s);
    if (p.demand > p.supply) lines.push(`Power is short: ${p.supply} made, ${p.demand} wanted. Put someone on a generator before the lights start choosing favorites.`);
    if (s.res.food < UNM.living(s).length * 2) lines.push('Food is running thin. A staffed Grow Room would help. So would fewer mouths, but I did not say that.');
    if (s.res.water < UNM.living(s).length * 2) lines.push('Water is low. The pump needs hands.');
    if (UNM.living(s).length >= UNM.bedCount(s)) lines.push('Every bunk is taken. Build or repair Crew Quarters before you hire anyone else.');
    const hostile = s.warlords.filter((w) => w.alive && w.disposition < -40);
    if (hostile.length && UNM.defenseScore(s) < 14) lines.push(`${hostile[0].name} is not fond of you, and the walls are thin. Staff the watchtower.`);
    if (lines.length && r() < 0.75) return lines[Math.floor(r() * lines.length)];
    const pool = PILOT_IDLE[s.trust.level] || PILOT_IDLE[1];
    return pool[Math.floor(r() * pool.length)];
  }
  function speak(text, kind) {
    chirp(kind);
    const b = $('bubble');
    b.innerHTML = `<b>Pilot Light</b>${esc(text)}`;
    b.hidden = false;
    clearTimeout(bubbleTimer);
    if (HOLD[prefs.hold] !== 0) bubbleTimer = setTimeout(() => (b.hidden = true), 6000 * (HOLD[prefs.hold] || 1));
  }

  function toast(text, bad) {
    const t = $('toast');
    t.textContent = text; t.className = 'toast' + (bad ? ' bad' : ''); t.hidden = false;
    clearTimeout(toastTimer); if (HOLD[prefs.hold] !== 0) toastTimer = setTimeout(() => (t.hidden = true), 3200 * (HOLD[prefs.hold] || 1));
  }

  // ---------- helpers ----------
  const crewById = (id) => s.crew.find((c) => c.id === id);
  const roleName = (c) => (c.role === 'recruit' ? 'Recruit' : UNM.roleById(c.role).name);
  const SKIN = ['#f1c9a5', '#d9a27a', '#b9774f', '#8d5a3b', '#62402a', '#e6b98f'];
  const COAT = ['#7a4a2e', '#4f6650', '#5b5f73', '#8a6a3a', '#6b3f3f', '#3f5966'];
  // Portraits: the character's own pixel sprite, framed head and shoulders.
  const portraits = new Map();
  let portraitWait = false, portraitVer = -1;
  function portrait(c) {
    const key = `${JSON.stringify(Art.fullLook(c.look))}|${c.role}`;
    if (portraits.has(key)) return portraits.get(key);
    const cv = Art.portrait(c.look, c.role, 4);
    if (!cv) return null;
    const url = cv.toDataURL();
    portraits.set(key, url);
    return url;
  }
  setInterval(() => { if (portraitWait && Art.version !== portraitVer) { portraitVer = Art.version; portraitWait = false; render(); } }, 400);
  const face = (c) => { const url = portrait(c); return `<span class="face" style="${url ? '' : `background:${SKIN[c.look.skin % 6]};box-shadow:inset 0 -8px 0 ${COAT[c.look.coat % 6]}`}">${url ? `<img src="${url}" alt="">` : esc(c.name[0])}</span>`; };
  const costText = (c) => (c ? `${c.buttons} buttons · ${c.salvage} salvage` : '');
  const jobLabel = (c) => {
    if (!c.alive) return c.left ? 'Left' : 'Dead';
    if (c.away) { const m = s.missions.find((x) => x.id === c.away); return m ? `On mission: ${m.site}` : 'Away'; }
    if (c.injured) return `Injured (${c.injured} day${c.injured > 1 ? 's' : ''})`;
    if (!c.job) return 'Idle';
    const r = s.rooms.find((x) => x.id === c.job);
    return r ? T[r.type].name : 'Idle';
  };
  function act(fn) { const err = fn(); if (err) toast(err, true); afterChange(); return err; }
  function afterChange() { save(); queueAutoSheets(); render(); noteStep(); }
  // Pilot Light speaks up when the tutorial reaches its last suggestion.
  function noteStep() {
    const st = s.tutorial.step;
    if (lastStep !== -1 && st !== lastStep) { const step = UNM.TUTORIAL[st]; if (step && step.id === 'name') setTimeout(() => speak(step.text), 500); }
    lastStep = st;
  }

  // ---------- top bar ----------
  const RES_META = {
    buttons: { icon: '◉', label: 'Buttons' }, salvage: { icon: '⚙', label: 'Salvage' }, food: { icon: '✿', label: 'Food' },
    water: { icon: '≈', label: 'Water' }, power: { icon: 'ϟ', label: 'Power' }, defense: { icon: '⛨', label: 'Defense' },
    rep: { icon: '★', label: 'Reputation' }, crew: { icon: '☺', label: 'Crew' },
  };
  function renderTop() {
    $('day').textContent = `Day ${s.day}`;
    $('phase').textContent = s.phase[0].toUpperCase() + s.phase.slice(1);
    const caps = UNM.caps(s), p = UNM.powerReport(s);
    const val = {
      buttons: [s.res.buttons, s.res.buttons < 10], salvage: [`${s.res.salvage}/${caps.salvage}`, false],
      food: [`${s.res.food}/${caps.food}`, s.res.food < UNM.living(s).length * 2], water: [`${s.res.water}/${caps.water}`, s.res.water < UNM.living(s).length * 2],
      power: [`${p.supply}/${p.demand}`, p.demand > p.supply], defense: [UNM.defenseScore(s), false], rep: [s.rep, false],
      crew: [`${UNM.living(s).length}/${UNM.bedCount(s)}`, UNM.living(s).length > UNM.bedCount(s)],
    };
    $('res').innerHTML = prefs.res.map((k) => `<li class="${val[k][1] ? 'warn' : ''}" title="${RES_META[k].label}"><span class="ri" aria-hidden="true">${RES_META[k].icon}</span>${esc(val[k][0])}<span class="rl">${RES_META[k].label}</span></li>`).join('');
  }

  // ---------- side panel ----------
  const TABS = [['room', '▣', 'Room'], ['team', '☺', 'Team'], ['plans', '⚒', 'Plans'], ['missions', '⚑', 'Missions'], ['warlords', '♜', 'Warlords'], ['log', '☰', 'Log']];
  function renderRail() {
    const dots = {
      team: s.pendingRoleChoice.length > 0 || (s.phase === 'evening' && s.travelers.length > 0 && UNM.living(s).length < UNM.bedCount(s)),
      missions: s.missions.some((m) => m.status === 'open' && (m.urgent || m.scripted)),
      warlords: false,
      plans: s.tutorial.step >= UNM.TUTORIAL.length && !(s.tech && s.tech.current) && UNM.TECH.some((t) => UNM.techStatus(s, t) === 'available' && UNM.canPay(s, t.cost)),
    };
    $('rail').innerHTML = TABS.map(([id, icon, label]) => `<button class="tab ${tab === id && panelOpen ? 'on' : ''}" data-act="tab" data-arg="${id}" aria-pressed="${tab === id && panelOpen}">${icon}<span>${label}</span>${dots[id] ? '<i class="dot"></i>' : ''}</button>`).join('');
    $('side').classList.toggle('closed', !panelOpen);
    $('stage').classList.toggle('panel-open', panelOpen);
  }

  function renderRoomPanel() {
    if (!sel) {
      const rows = [...new Set(s.rooms.map((r) => r.row))].sort((a, b) => a - b);
      return `<p class="eyebrow">${esc(UNM.nameOf(s))}</p><h2>Tap a room</h2><p>Tap any room in the cutaway to repair, staff or upgrade it. Tap an empty lot (+) to build. Drag to look around; pinch or scroll to zoom.</p><div class="row"><button class="btn small" data-act="recenter">Recenter view</button></div>
        ${rows.map((row) => `<h3>${row === 0 ? 'Above ground' : `Below ground, level ${row}`}</h3><div class="pick">${s.rooms.filter((r) => r.row === row).sort((a, b) => a.col - b.col).map((r) => `<button class="btn small" data-act="selroom" data-arg="${r.id}">${esc(T[r.type].name)}${r.state === 'working' ? '' : ` <span class="cost">${r.state}</span>`}</button>`).join('')}</div>`).join('')}`;
    }
    if (sel.kind === 'dig') {
      const c = UNM.digCost(s);
      if (s.dug >= UNM.MAX_UNDER) return `<h2>Bedrock</h2><p>The ground below is solid rock. The base cannot go any deeper.</p>`;
      return `<p class="eyebrow">Below ground</p><h2>Dig a new level</h2><p>Opens ten more lots underground. Level ${s.dug + 1} of ${UNM.MAX_UNDER}.</p><button class="btn primary" data-act="dig" ${UNM.canPay(s, c) ? '' : 'disabled'}>Dig · <span class="cost">${costText(c)}</span></button>`;
    }
    if (sel.kind === 'slot') {
      const level = sel.row === 0 ? 'surface' : 'under';
      const opts = UNM.BUILDABLE.filter((k) => T[k].level === level);
      return `<p class="eyebrow">${sel.row === 0 ? 'Above ground' : `Below ground, level ${sel.row}`} · empty lot</p><h2>Build here</h2>
        <div class="stack">${opts.map((k) => {
          const t = T[k], c = UNM.costOf(s, k, 'build');
          const fits = UNM.slotFree(s, sel.row, sel.col, t.w);
          const dup = t.unique && s.rooms.some((r) => r.type === k);
          const needs = t.needsBuilt && !s.rooms.some((r) => r.type === t.needsBuilt && r.state === 'working');
          const why = !UNM.hasTech(s, t.tech) ? `Needs the ${UNM.techById(t.tech).name} plans` : !fits ? `Needs ${t.w} free lots side by side` : dup ? 'You already have one' : needs ? `Needs a working ${T[t.needsBuilt].name}` : !UNM.canPay(s, c) ? 'Not enough to build' : '';
          return `<button class="btn" data-act="build" data-arg="${k}" ${why ? 'disabled' : ''}><b>${t.name}</b> <span class="chip">${t.branch}</span><br><span class="small">${t.blurb}</span><br><span class="cost">${costText(c)} · ${t.days} day${t.days > 1 ? 's' : ''}${t.w > 1 ? ` · ${t.w} lots wide` : ''}${why ? ` · ${why}` : ''}</span></button>`;
        }).join('')}</div>`;
    }
    const room = s.rooms.find((r) => r.id === sel.id);
    if (!room) return '<p>That room is gone.</p>';
    const t = T[room.type];
    const p = UNM.powerReport(s);
    const workers = UNM.workersIn(s, room.id);
    const running = UNM.isRunning(s, room, p);
    let html = `<p class="eyebrow">${t.branch} · ${room.row === 0 ? 'above ground' : `below ground, level ${room.row}`}</p><h2>${t.name}${room.level > 1 ? ` · level ${room.level}` : ''}</h2><p>${t.blurb}</p>`;
    if (room.type === 'sealed_door') {
      const tl = UNM.TRUST_LEVELS[s.trust.level - 1];
      const st = UNM.storyState(s);
      html += `<div class="note-hand">${s.trust.level < 3 ? '“It is a door. It is sealed. Lovely craftsmanship. Shall we look at the generator?”' : s.trust.level < 4 ? '“I was asked to keep it closed. By someone you would have liked.”' : `“The intercom works. ${esc(st.relative)} is on the other side.”`}</div><p class="small muted">Pilot Light’s trust: ${tl.name} (${s.trust.level} of 5). Trust grows with honest, decent choices and a waystation that runs well.</p>`;
      if (s.trust.level >= 4) {
        const call = UNM.intercom(s);
        html += `<h3>Intercom</h3>${call ? '<button class="btn primary" data-act="intercom">Answer the intercom</button>' : `<p class="small muted">${st.calls >= 4 ? 'Nothing more to say until the door opens.' : st.callDay === s.day ? `${esc(st.relative)} is resting. Try again tomorrow.` : `${esc(st.relative)} is waiting to hear about the next keycard piece.`}</p>`}`;
        html += `<h3>Keycard</h3><p>${'▰'.repeat(st.pieces)}${'▱'.repeat(3 - st.pieces)} ${st.pieces} of 3 pieces</p>`;
        const why = UNM.canOpenVault(s);
        html += `<button class="btn ${why ? '' : 'primary'}" data-act="openVault" ${why ? 'disabled' : ''}>Open the vault</button>${why ? `<p class="small muted">${esc(why)}</p>` : ''}`;
      }
      return html;
    }
    if (room.type === 'vault') {
      html += `<button class="btn" data-act="screens">Look at the screens again</button>`;
      return html;
    }
    const chip = { working: running || (!t.staff && !t.power) ? ['good', 'Running'] : ['bad', t.power && !p.powered.has(room.id) ? 'No power' : 'Needs crew'], damaged: ['bad', 'Damaged'], ruined: ['bad', 'Ruined'], building: ['lamp', `Building · ${room.buildLeft} day${room.buildLeft > 1 ? 's' : ''} left`] }[room.state];
    html += `<div class="row"><span class="chip ${chip[0]}">${chip[1]}</span>${t.power ? `<span class="chip">Uses ${t.power * room.level} power</span>` : ''}${t.staff ? `<span class="chip">${workers.length}/${t.staff} crew</span>` : ''}</div>`;
    if (room.state === 'ruined' || room.state === 'damaged') {
      const c = room.free ? null : UNM.costOf(s, room.type, 'repair', room);
      html += `<h3>Repair</h3><button class="btn primary" data-act="repair" ${room.free || UNM.canPay(s, c) ? '' : 'disabled'}>${room.free ? 'Repair (free)' : `Repair · <span class="cost">${costText(c)}</span>`}</button>`;
    }
    if (room.state === 'working' && t.staff) {
      html += `<h3>Crew here</h3>`;
      html += workers.length ? workers.map((c) => `<div class="person">${face(c)}<div><b>${esc(c.name)}</b> <span class="muted small">${roleName(c)} · Lv ${c.level}</span><div class="row" style="margin-top:6px"><button class="btn small ghost" data-act="unassign" data-arg="${c.id}">Take off this job</button></div></div></div>`).join('') : '<p class="muted small">Nobody is working here.</p>';
      if (workers.length < t.staff) {
        const avail = s.crew.filter((c) => c.alive && !c.away && !c.injured && c.job !== room.id);
        html += avail.length ? `<p class="small muted">Add someone (moves them from their current job):</p><div class="stack">${avail.map((c) => `<button class="btn small" data-act="assign" data-arg="${c.id}">${esc(c.name)} · <span class="cost">${roleName(c)} · ${esc(jobLabel(c))}</span></button>`).join('')}</div>` : '<p class="small muted">No one is free.</p>';
      }
    }
    if (room.type === 'crew_quarters' && room.state === 'working') html += `<p class="small">Sleeps ${4 * room.level}. You have ${UNM.living(s).length} crew and ${UNM.bedCount(s)} bunks.</p>`;
    if (room.type === 'team_management') html += `<p class="small">Open the Missions panel to choose a job and a squad of four to six.</p><button class="btn small" data-act="tab" data-arg="missions">Open Missions</button>`;
    if (room.state === 'working' && room.level < 3 && t.cost && !t.unique) {
      const c = UNM.costOf(s, room.type, 'upgrade', room);
      const need = (UNM.LEVEL_TECH[room.type] || [])[room.level - 1];
      const locked = need && !UNM.hasTech(s, need);
      html += `<h3>Upgrade</h3><button class="btn" data-act="upgrade" ${UNM.canPay(s, c) && !locked ? '' : 'disabled'}>To level ${room.level + 1} · <span class="cost">${costText(c)}</span>${locked ? `<br><span class="cost">Needs the ${esc(UNM.techById(need).name)} plans</span>` : ''}</button><p class="small muted">Higher levels produce more${t.power ? ' and draw more power' : ''}, and cost more upkeep.</p>`;
    }
    if (room.type === 'bar' && room.state === 'working') {
      const left = UNM.marketLeft(s);
      html += `<h3>Traders</h3><p class="small muted">Passing traders sell from their carts. ${left} purchase${left === 1 ? '' : 's'} left today.</p><div class="stack">${Object.entries(UNM.MARKET).map(([k, m]) => { const price = Math.round(m.price * (s.difficulty === 'hard' ? 1.25 : 1)); return `<button class="btn small" data-act="buy" data-arg="${k}" ${left > 0 && s.res.buttons >= price ? '' : 'disabled'}>Buy ${m.amount} ${k} <span class="cost">${price} buttons</span></button>`; }).join('')}</div>`;
    }
    if (room.type === 'armory' && room.state === 'working') {
      const ok = UNM.workersIn(s, room.id).length > 0 && UNM.canPay(s, UNM.CRAFT_COST);
      html += `<h3>Make gear</h3><p class="small muted">${costText(UNM.CRAFT_COST)} each. Needs someone working here.</p><div class="stack">${['vest', 'scope', 'boots', 'kit'].map((g) => `<button class="btn small" data-act="craft" data-arg="${g}" ${ok ? '' : 'disabled'}>${esc(UNM.GEAR[g].name)} <span class="cost">${UNM.GEAR[g].effect}</span></button>`).join('')}</div><p class="small muted">In stores: ${(s.gear || []).length ? esc((s.gear || []).map((g) => UNM.GEAR[g].name).join(', ')) : 'nothing'}.</p>`;
    }
    if (room.state !== 'building' && t.cost) html += `<h3>Clear lot</h3><button class="btn small ghost" data-act="demolish">Tear it down (returns 3 salvage)</button>`;
    return html;
  }

  const originName = (id) => { const w = s.warlords.find((x) => x.id === id); return w ? w.name : 'a fallen warlord'; };
  function gearSelect(c) {
    const inv = s.gear || [];
    if (!c.gear && !inv.length) return '';
    const kinds = [...new Set(inv)];
    if (c.away) return c.gear ? `<span class="small muted">Gear: ${esc(UNM.GEAR[c.gear].name)}</span>` : '';
    return `<select aria-label="Gear for ${esc(c.name)}" data-act="gear" data-arg="${c.id}"><option value="">No gear</option>${c.gear ? `<option value="__keep" selected>${esc(UNM.GEAR[c.gear].name)} (${UNM.GEAR[c.gear].effect})</option>` : ''}${kinds.map((k) => `<option value="${k}">${esc(UNM.GEAR[k].name)} (${UNM.GEAR[k].effect}) · ${inv.filter((x) => x === k).length} in stores</option>`).join('')}</select>`;
  }
  function renderTeamPanel() {
    const crew = UNM.living(s);
    const beds = UNM.bedCount(s);
    const jobs = s.rooms.filter((r) => r.state === 'working' && T[r.type].staff > 0);
    let html = `<p class="eyebrow">${crew.length} crew · ${beds} bunks</p><h2>Team</h2><p class="small muted">Everyone starts as a recruit. When someone reaches level 2 you choose their role.</p>`;
    html += crew.map((c) => {
      const pending = s.pendingRoleChoice.includes(c.id);
      const options = [`<option value="">Idle</option>`].concat(jobs.map((r) => {
        const full = UNM.workersIn(s, r.id).filter((x) => x.id !== c.id).length >= T[r.type].staff;
        return `<option value="${r.id}" ${c.job === r.id ? 'selected' : ''} ${full && c.job !== r.id ? 'disabled' : ''}>${T[r.type].name}${full && c.job !== r.id ? ' (full)' : ''}</option>`;
      })).join('');
      return `<div class="person">${face(c)}<div class="stack" style="gap:5px">
        <div><b>${esc(c.name)}</b> <span class="muted small">${roleName(c)} · Lv ${c.level}${c.custom ? ' · custom' : ''}</span> ${pending ? `<button class="chip lamp" data-act="rolesheet" data-arg="${c.id}">Choose role</button>` : ''}</div>
        <div class="row small"><span class="muted">XP</span><div class="bar lampbar" style="flex:1"><i style="width:${c.xp}%"></i></div><span class="muted">Morale</span><div class="bar" style="flex:1"><i style="width:${c.morale}%;background:${c.morale < 30 ? 'var(--bad)' : 'var(--good)'}"></i></div></div>
        ${c.away || c.injured ? `<div class="small muted">${esc(jobLabel(c))}</div>` : `<select aria-label="Job for ${esc(c.name)}" data-act="job" data-arg="${c.id}">${options}</select>`}
        ${gearSelect(c)}${c.origin ? `<span class="small muted">From ${esc(originName(c.origin))}’s territory</span>` : ''}
        ${c.bio ? `<details class="bio"><summary class="small">Their story</summary><p class="small">${esc(c.bio)}</p></details>` : ''}
      </div></div>`;
    }).join('');
    html += `<h3>Looking for work</h3>`;
    if (s.phase !== 'evening' && !s.travelers.some((t) => t.rescued)) html += `<p class="small muted">Weary travelers drift into the bar in the evening. Come back then.</p>`;
    else if (!s.travelers.length) html += `<p class="small muted">Nobody tonight.</p>`;
    else html += s.travelers.map((t) => `<div class="person">${face(t)}<div><b>${esc(t.name)}</b> <span class="muted small">Recruit${t.rescued ? ' · rescued, grateful' : ''}${t.origin ? ` · from ${esc(originName(t.origin))}’s territory` : ' · from the open road'}</span>${t.bio ? `<p class="small bio-line">${esc(t.bio)}</p>` : ''}<div class="row" style="margin-top:6px"><button class="btn small primary" data-act="hire" data-arg="${t.id}" ${crew.length >= beds ? 'disabled' : ''}>Hire</button>${crew.length >= beds ? '<span class="small muted">No free bunks</span>' : ''}</div></div></div>`).join('');
    html += `<h3>Custom recruit</h3><p class="small muted">Put the word out for someone specific. Costs 5 silver buttons.</p>
      <div class="stack"><label class="field" for="cname">Name<input id="cname" maxlength="24" placeholder="Name"></label>
      <div class="row">${[['cskin', 'Skin', 6], ['chair', 'Hair', 6], ['ccoat', 'Coat', 6]].map(([id, l, n]) => `<label class="field" for="${id}" style="flex:1;min-width:80px">${l}<select id="${id}">${Array.from({ length: n }, (_, i) => `<option value="${i}">${l} ${i + 1}</option>`).join('')}</select></label>`).join('')}</div>
      <button class="btn" data-act="custom" ${crew.length >= beds ? 'disabled' : ''}>Recruit them</button></div>`;
    return html;
  }

  function renderMissionsPanel() {
    const teamRoom = s.rooms.some((r) => r.type === 'team_management' && r.state === 'working');
    const open = s.missions.filter((m) => m.status === 'open');
    const out = s.missions.filter((m) => m.status === 'out');
    let html = `<p class="eyebrow">Teams leave when you end the morning</p><h2>Missions</h2>`;
    if (!teamRoom) html += `<p class="bad">You need a working Team Room to send anyone out.</p>`;
    html += `<p class="small muted">Pick four to six crew. You command them on the mission map, turn by turn. Nearby jobs are fought when you end the morning; far jobs when the team arrives. Anyone you send is away from their job until they return.</p>`;
    if (out.length) html += `<h3>Out in the field</h3>` + out.map((m) => `<div class="card"><b>${esc(m.site)}</b><span class="small muted">${m.squad.length} crew · ${m.fought ? `heading home, back on day ${m.returnDay}` : `arrives day ${m.arriveDay}, back day ${m.returnDay}`}</span></div>`).join('');
    if (!open.length) html += `<p class="muted">No jobs on the board${s.tutorial.step < UNM.TUTORIAL.length ? ' yet' : ''}.</p>`;
    html += `<h3>On the board</h3><div class="stack">` + open.map((m) => {
      const from = m.from ? s.warlords.find((w) => w.id === m.from) : null;
      const left = m.expires - s.day;
      const chance = Math.round(UNM.successChance(s, m) * 100);
      const reward = Object.entries(m.reward).filter(([, v]) => v).map(([k, v]) => (k === 'recruit' ? 'a possible recruit' : k === 'gear' ? (m.scripted === 'stronghold' ? 'warlord plating and more gear' : 'a piece of gear') : `${v} ${k}`)).join(', ');
      const avail = s.crew.filter((c) => c.alive && !c.away && !c.injured);
      return `<div class="card ${m.urgent ? 'urgent' : ''} ${m.squad.length ? 'sel' : ''}">
        <div class="row"><span class="chip ${m.kind === 'rescue' ? 'bad' : m.kind === 'warlord' ? 'dark' : ''}">${m.scripted === 'intro' ? 'Story' : m.scripted === 'keycard' ? `Keycard ${m.piece} of 3` : m.scripted === 'stronghold' ? 'Stronghold' : m.strike ? 'Strike' : m.kind}</span>${m.rival && !m.from ? `<span class="chip">Against ${esc(originName(m.rival))}</span>` : ''}${m.urgent ? '<span class="chip bad">Urgent</span>' : ''}${from ? `<span class="chip">From ${esc(from.name)}</span>` : ''}</div>
        <b style="font-size:17px">${esc(m.site)}</b>
        <dl class="kv"><dt>Danger</dt><dd><span class="pips">${'●'.repeat(m.danger)}</span>${'○'.repeat(5 - m.danger)}</dd><dt>Travel</dt><dd>${m.travel ? `${m.travel} day${m.travel > 1 ? 's' : ''} each way` : 'Back the same day'}</dd>${m.scripted === 'intro' || m.scripted === 'keycard' ? '' : `<dt>Expires</dt><dd>${left <= 0 ? 'Today' : `In ${left} day${left > 1 ? 's' : ''}`}${m.kind === 'rescue' ? ' · people die if no one goes' : ''}</dd>`}<dt>Reward</dt><dd>${esc(reward)}</dd>${m.squad.length >= 4 && !m.scripted ? `<dt>Rough odds</dt><dd>${chance}% if you play it safe</dd>` : ''}</dl>
        <div class="pick">${avail.map((c) => `<label class="${!m.squad.includes(c.id) && m.squad.length >= 6 ? 'dis' : ''}"><input type="checkbox" data-act="squad" data-mission="${m.id}" data-arg="${c.id}" ${m.squad.includes(c.id) ? 'checked' : ''} ${!m.squad.includes(c.id) && m.squad.length >= 6 ? 'disabled' : ''}>${esc(c.name.split(' ')[0])} <span class="muted small">${c.role === 'recruit' ? 'Rct' : UNM.roleById(c.role).name.slice(0, 4)} ${c.level}</span></label>`).join('')}</div>
        <span class="small ${m.squad.length && m.squad.length < 4 ? 'bad' : 'muted'}">${m.squad.length ? `${m.squad.length} picked${m.squad.length < 4 ? ' · need at least 4' : ' · leaves when you end the morning'}` : 'Nobody picked'}</span>
      </div>`;
    }).join('') + `</div>`;
    return html;
  }

  function renderWarlordsPanel() {
    const def = UNM.defenseScore(s);
    const live = s.warlords.filter((w) => w.alive);
    const name = (id) => { const w = s.warlords.find((x) => x.id === id); return w ? w.name : '?'; };
    let html = `<p class="eyebrow">Generated for this game</p><h2>Warlords</h2><p class="small muted">They are not going away. Pay them, make pacts, plot with one against another, or oppose them openly and break their grip on their territory. Your defense tonight: <b>${def}</b>.</p>`;
    if (s.raidPlan && s.raidPlan.day === s.day) { const rw = s.warlords.find((x) => x.id === s.raidPlan.warlord); html += `<div class="card ${rw ? 'urgent' : ''}"><b>Informants</b><span class="small">${rw ? `${esc(rw.name)} is planning a raid tonight. Staff the walls, or keep crew home.` : 'No raid planned for tonight.'}</span></div>`; }
    if (s.conspiracy) html += `<div class="card urgent"><b>Conspiracy</b><span class="small">You are plotting with ${esc(name(s.conspiracy.ally))} against ${esc(name(s.conspiracy.target))} (since day ${s.conspiracy.since}). Their jobs against the target pay off; there is a small chance each night the target finds out.</span><div class="row"><button class="btn small ghost" data-act="endCons">Walk away from the plot</button></div></div>`;
    html += live.map((w) => {
      const mood = w.disposition > 40 ? ['good', 'Friendly'] : w.disposition > 0 ? ['', 'Cordial'] : w.disposition > -40 ? ['', 'Cold'] : ['bad', 'Hostile'];
      const stance = { pact: ['good', 'Pact'], oppose: ['bad', 'Opposed'], neutral: ['', 'No terms'] }[w.stance || 'neutral'] || ['', w.stance];
      const hold = w.hold ?? 100;
      const target = s.conspiracy && s.conspiracy.target === w.id;
      const others = live.filter((x) => x !== w && x.stance !== 'pact');
      let acts = `<button class="btn small" data-act="gift" data-arg="${w.id}" ${w.giftedDay === s.day || s.res.buttons < 5 ? 'disabled' : ''}>Send a gift · 5 buttons</button>`;
      if (w.stance === 'pact') acts += `<button class="btn small ghost" data-act="askBreak" data-arg="${w.id}">Break the pact</button>`;
      else if (w.stance === 'oppose') acts += `<button class="btn small ghost" data-act="standDown" data-arg="${w.id}">Stand down</button>`;
      else {
        if (w.temperament !== 'aggressive') acts += `<button class="btn small" data-act="pact" data-arg="${w.id}" ${w.disposition >= (s.rooms.some((x) => x.type === 'meeting_hall' && UNM.isRunning(s, x)) ? 15 : 30) && s.res.buttons >= 10 && !target ? '' : 'disabled'} title="Needs Friendly standing (less with a Meeting Hall)">Propose a pact · 10 buttons</button>`;
        acts += `<button class="btn small" data-act="askOppose" data-arg="${w.id}">Oppose openly</button>`;
      }
      const plot = !s.conspiracy && w.stance !== 'oppose' && w.disposition >= 10 && others.length
        ? `<div class="row"><select aria-label="Conspire with ${esc(w.name)} against" id="cons-${w.id}">${others.map((x) => `<option value="${x.id}">against ${esc(x.name)}</option>`).join('')}</select><button class="btn small" data-act="conspire" data-arg="${w.id}">Conspire</button></div>` : '';
      const people = s.crew.filter((c) => c.alive && c.origin === w.id).length;
      return `<div class="card" style="border-left:5px solid ${w.color}">
        <div class="row"><b style="font-size:17px">${esc(w.name)}</b><span class="chip ${mood[0]}">${mood[1]}</span><span class="chip ${stance[0]}">${stance[1]}</span>${target ? '<span class="chip dark">Your target</span>' : ''}</div>
        <span class="small muted">${esc(w.archetype)} · ${w.temperament}${people ? ` · ${people} of your crew came from here` : ''}</span>
        <dl class="kv"><dt>Holds</dt><dd>${w.resource}</dd><dt>Wants</dt><dd>${w.wants}</dd><dt>Raids by</dt><dd>${w.raidStyle}</dd><dt>Strength</dt><dd>${w.strength}</dd><dt>Raid odds</dt><dd>${Math.round(UNM.raidChance(w, s.day) * 100)}% a night</dd>${w.stance === 'pact' ? `<dt>Tribute</dt><dd>${UNM.pactCost(w, s)} buttons a night</dd>` : ''}</dl>
        <span class="small muted">Standing</span><div class="bar"><i style="width:${(w.disposition + 100) / 2}%;background:${w.color}"></i></div>
        <span class="small muted">Grip on their territory · ${hold}%${hold <= 30 ? ' · stronghold exposed' : ''}</span><div class="bar"><i style="width:${hold}%;background:${hold <= 30 ? 'var(--bad)' : 'var(--ink)'}"></i></div>
        <div class="row">${acts}</div>${plot}
      </div>`;
    }).join('');
    for (const v of s.vacant || []) html += `<div class="card" style="border-left:5px dashed ${v.color}"><b>Unclaimed territory</b><span class="small muted">${esc(v.was)} is gone. More travelers pass through while it is empty. Someone new will claim it in about ${Math.max(1, v.until - s.day)} day${v.until - s.day === 1 ? '' : 's'}.</span></div>`;
    html += `<p class="small muted">Pacts stop raids and demands for a nightly tribute. Opposing a warlord puts strikes against them on the board; conspiring brings their rival's jobs. Each hit loosens their grip. Below 30%, their stronghold is exposed: take it and they are gone.</p>`;
    return html;
  }

  function renderPlansPanel() {
    const st = s.tech || { done: [], current: null };
    let html = `<p class="eyebrow">From your relative’s notebooks</p><h2>Plans</h2><p class="small muted">Pilot Light works through one set of plans at a time, ready after a night or three. Plans unlock new rooms and higher room levels.</p>`;
    if (st.current) { const t = UNM.techById(st.current.id); html += `<div class="card sel"><b>Working on: ${esc(t.name)}</b><span class="small">${esc(t.text)} Ready in ${st.current.left} night${st.current.left === 1 ? '' : 's'}.</span></div>`; }
    for (const br of UNM.TECH_BRANCHES) {
      html += `<h3>${esc(br)}</h3><div class="stack">`;
      for (const t of UNM.TECH.filter((x) => x.branch === br)) {
        const status = UNM.techStatus(s, t);
        const needs = t.needs.filter((n) => !st.done.includes(n)).map((n) => UNM.techById(n).name);
        if (status === 'done') html += `<div class="row small"><span class="chip good">Done</span><b>${esc(t.name)}</b><span class="muted">${esc(t.text)}</span></div>`;
        else if (status === 'researching') html += `<div class="row small"><span class="chip lamp">In progress</span><b>${esc(t.name)}</b></div>`;
        else html += `<button class="btn" data-act="research" data-arg="${t.id}" ${status === 'available' && !st.current && UNM.canPay(s, t.cost) ? '' : 'disabled'}><b>${esc(t.name)}</b><br><span class="small">${esc(t.text)}</span><br><span class="cost">${costText(t.cost)} · ${t.days} night${t.days > 1 ? 's' : ''}${status === 'locked' ? ` · needs ${esc(needs.join(' and '))}` : ''}</span></button>`;
      }
      html += `</div>`;
    }
    return html;
  }
  function renderLogPanel() {
    return `<p class="eyebrow">What happened</p><h2>Log</h2><ul class="log">${s.log.map((l) => `<li class="${l.tone}"><span class="when">Day ${l.day}</span>${esc(l.text)}</li>`).join('')}</ul>`;
  }

  function renderDrawer() {
    const d = $('drawer');
    const scroll = d.scrollTop;
    const active = document.activeElement && d.contains(document.activeElement) ? document.activeElement.id : null;
    const cname = $('cname') ? $('cname').value : '';
    d.innerHTML = { room: renderRoomPanel, team: renderTeamPanel, plans: renderPlansPanel, missions: renderMissionsPanel, warlords: renderWarlordsPanel, log: renderLogPanel }[tab]();
    if ($('cname')) $('cname').value = cname;
    if (active && $(active)) $(active).focus();
    d.scrollTop = scroll;
  }

  // ---------- objective (tutorial) ----------
  const HIGHLIGHT = { repair_guest: ['guest_room'], repair_bar: ['bar'], repair_power: ['generator', 'water_pump'], staff: ['generator', 'water_pump', 'bar', 'guest_room'], intro_mission: ['team_management'] };
  function renderObjective() {
    const o = $('objective');
    const step = UNM.TUTORIAL[s.tutorial.step];
    if (!step) { o.hidden = true; return; }
    o.hidden = false;
    o.innerHTML = `<div class="who"><span>Pilot Light · step ${s.tutorial.step + 1} of ${UNM.TUTORIAL.length}</span><button data-act="skiptut">Skip tutorial</button></div><div>${esc(step.text)}</div>${step.id === 'name' ? '<div class="row" style="margin-top:8px"><button class="btn small primary" data-act="nameSign">Name it</button><button class="btn small ghost" data-act="leaveSign">Leave it</button></div>' : ''}`;
  }
  function highlights() {
    const step = UNM.TUTORIAL[s.tutorial.step];
    if (!step && (UNM.intercom(s) || (s.trust.level >= 4 && !UNM.canOpenVault(s)))) return s.rooms.filter((r) => r.type === 'sealed_door').map((r) => r.id);
    if (!step || !HIGHLIGHT[step.id]) return [];
    return s.rooms.filter((r) => HIGHLIGHT[step.id].includes(r.type) && (step.id !== 'staff' || UNM.workersIn(s, r.id).length === 0) && (step.id.startsWith('repair') ? r.state !== 'working' : true)).map((r) => r.id);
  }

  // ---------- sheets ----------
  function queueAutoSheets() {
    if (sheets.length) return;
    if (s.gameOver) { sheets.push({ kind: 'gameover' }); return; }
    if (s.phase === 'morning' && s.lastNight && seenNight !== s.day && s.day > 1) { seenNight = s.day; sheets.push({ kind: 'night', night: s.lastNight }); }
    while (s.storyQueue.length) sheets.push({ kind: 'story', text: s.storyQueue.shift() });
    if (s.pendingEvents.length && s.phase === 'morning') sheets.push({ kind: 'event' });
    if (s.pendingRoleChoice.length && roleDeferredAt !== s.day + s.phase) sheets.push({ kind: 'role', id: s.pendingRoleChoice[0] });
  }
  // ---------- settings pieces ----------
  const h3 = (text) => `<h3 class="sh">${text}</h3>`;
  const seg = (label, key, opts) => `<div class="seg" role="group" aria-label="${label}"><span class="lbl">${label}</span>${opts.map(([v, l]) => `<button class="btn small ${prefs[key] === v ? 'primary' : ''}" data-act="pset" data-arg="${key}:${v}" aria-pressed="${prefs[key] === v}">${l}</button>`).join('')}</div>`;
  const tog = (label, key, note) => `<button class="btn small" data-act="ptoggle" data-arg="${key}" aria-pressed="${!!prefs[key]}" ${note ? `title="${esc(note)}"` : ''}>${label}: ${prefs[key] ? 'on' : 'off'}</button>`;
  function audioHtml() {
    return `${h3('Sound')}<div class="row"><button class="btn small" data-act="music" aria-pressed="${prefs.music}">Music: ${prefs.music ? 'on' : 'off'}</button><button class="btn small" data-act="sfx" aria-pressed="${prefs.sfx}">Sound effects: ${prefs.sfx ? 'on' : 'off'}</button></div>
      <label class="vol">Music volume<input type="range" min="0" max="100" step="5" value="${prefs.vMusic}" data-vol="vMusic" aria-label="Music volume"><output>${prefs.vMusic}%</output></label>
      <label class="vol">Effects volume<input type="range" min="0" max="100" step="5" value="${prefs.vSfx}" data-vol="vSfx" aria-label="Sound effects volume"><output>${prefs.vSfx}%</output></label>`;
  }
  function accessHtml() {
    return `${h3('Accessibility')}
      ${seg('Text size', 'text', [['md', 'Normal'], ['lg', 'Large'], ['xl', 'Larger'], ['xxl', 'Largest']])}
      ${seg('Typeface', 'font', [['std', 'Game style'], ['easy', 'Easy-read'], ['plain', 'Plain']])}
      ${seg('Message time', 'hold', [['normal', 'Normal'], ['slow', 'Longer'], ['tap', 'Until I tap']])}
      <div class="row" style="margin-top:8px">${tog('High contrast', 'hc')}${tog('Colour-blind safe colours', 'cb')}${tog('Roomier text spacing', 'loose')}</div>
      <div class="row" style="margin-top:8px">${tog('Reduce motion and flashing', 'still')}${tog('Fast battle animations', 'fast')}</div>
      <div class="row" style="margin-top:8px">${tog('Bigger touch targets', 'big')}${tog('Strong focus outline', 'focus')}</div>
      <p class="small muted">The first time, High contrast and Reduce motion follow your device settings. Everything here is remembered on this device.</p>
      <div class="row"><button class="btn small ghost" data-act="resetAccess">Reset accessibility to defaults</button></div>`;
  }
  function aboutHtml() {
    const ver = BUILD ? `Version ${esc(BUILD)}` : 'Preview build (not installable)';
    return `${h3('Updates')}<p class="small">${ver}${updateReady ? ' · <b>a newer version is ready</b>' : ''}</p>
      <div class="row">${updateReady ? '<button class="btn small primary" data-act="applyUpdate">Update now</button>' : '<button class="btn small" data-act="checkUpdate">Check for updates</button>'}</div>`;
  }
  const STAT = (label, body) => `<div class="god-row"><span class="lbl">${label}</span>${body}</div>`;
  const gnum = (id, val, op, a, extra) => `<input class="god-in" type="number" id="${id}" value="${val}" aria-label="${esc(id)}"><button class="btn small" data-act="god" data-op="${op}" ${a !== undefined ? `data-a="${a}"` : ''} data-from="${id}">Set</button>${extra || ''}`;
  const gbtn = (label, op, a, b, cls) => `<button class="btn small ${cls || ''}" data-act="god" data-op="${op}" ${a !== undefined ? `data-a="${esc(a)}"` : ''} ${b !== undefined ? `data-b="${esc(b)}"` : ''}>${label}</button>`;
  function godHtml(sh) {
    const G = UNM.god, tabs = [['sw', 'Switches'], ['res', 'Resources'], ['crew', 'Crew'], ['base', 'Base'], ['world', 'World']];
    const tab = sh.tab || 'sw', f = s.god || {};
    let body = '';
    if (tab === 'sw') {
      body = `<p class="god-note">Switches are saved with this waystation.</p><div class="god-grid">${Object.entries(G.FLAGS).map(([k, [n, d]]) => `<button class="btn small" data-act="god" data-op="toggle" data-a="${k}" aria-pressed="${!!f[k]}" title="${esc(d)}">${esc(n)}: ${f[k] ? 'on' : 'off'}</button>`).join('')}</div>
        <ul class="report">${Object.values(G.FLAGS).map(([n, d]) => `<li><b>${esc(n)}</b>: ${esc(d)}</li>`).join('')}</ul>
        ${STAT('Difficulty', Object.entries(UNM.DIFFICULTY).map(([k, d]) => gbtn(d.name, 'setDifficulty', k, undefined, s.difficulty === k ? 'primary' : '')).join(''))}
        ${STAT('Ironman', gbtn('Turn it off', 'ironmanOff') + `<span class="small muted">${s.ironman ? 'on' : 'off'}</span>`)}
        <div class="god-row">${gbtn('Skip the tutorial', 'skipTutorial')}${gbtn('Switch everything off', 'reset')}</div>`;
    } else if (tab === 'res') {
      body = `${['buttons', 'salvage', 'food', 'water'].map((k) => STAT(k[0].toUpperCase() + k.slice(1), gnum('g-' + k, s.res[k], 'setRes', k))).join('')}
        ${STAT('Reputation', gnum('g-rep', s.rep, 'setRep'))}${STAT('Day', gnum('g-day', s.day, 'setDay'))}
        ${STAT('Pilot Light trust', [1, 2, 3, 4, 5].map((l) => gbtn(String(l), 'setTrust', l, undefined, s.trust.level === l ? 'primary' : '')).join(''))}
        <p class="god-note">Food, water and salvage are capped by storage unless Infinite resources is on.</p>`;
    } else if (tab === 'crew') {
      const roles = ['recruit', ...UNM.ROLES.map((r) => r.id)];
      body = `<div class="god-row">${gbtn('Heal and revive everyone', 'healAll')}${gbtn('Staff every room', 'staffAll')}</div>
        ${STAT('Add a person', roles.map((r) => gbtn(r === 'recruit' ? 'Recruit' : UNM.roleById(r).name, 'addRecruit', r)).join(''))}
        ${s.crew.map((c) => `<div class="god-who"><b>${esc(c.name)}</b><span class="small muted">${roleName(c)} ${c.level}${c.alive ? '' : ' · down'}</span>${gbtn('Lv −', 'setLevel', c.id, '-1')}${gbtn('Lv +', 'setLevel', c.id, '1')}${gbtn('Heal', 'healCrew', c.id)}${gbtn('Dismiss', 'dismiss', c.id, undefined, 'ghost')}
          <select class="god-in" style="width:auto" data-act="godrole" data-arg="${c.id}" aria-label="Role for ${esc(c.name)}">${roles.map((r) => `<option value="${r}" ${c.role === r ? 'selected' : ''}>${r === 'recruit' ? 'Recruit' : UNM.roleById(r).name}</option>`).join('')}</select></div>`).join('')}`;
    } else if (tab === 'base') {
      body = `<div class="god-row">${gbtn('Repair everything', 'repairAll')}${gbtn('Finish all building', 'finishBuilds')}${gbtn('Max every room', 'maxRooms')}</div>
        <div class="god-row">${gbtn('Unlock all plans', 'unlockTech')}${gbtn('Finish current research', 'finishResearch')}${gbtn('Lock plans again', 'relockTech', undefined, undefined, 'ghost')}</div>
        ${STAT('Underground', [0, 1, 2, 3, 4].filter((n) => n <= UNM.MAX_UNDER).map((n) => gbtn(`${n} levels`, 'setDug', n, undefined, s.dug === n ? 'primary' : '')).join(''))}
        ${STAT('Build one', Object.keys(T).filter((k) => T[k].cost).map((k) => gbtn(T[k].name, 'buildAnywhere', k)).join(''))}
        ${STAT('Gear', Object.entries(UNM.GEAR).map(([k, gdef]) => gbtn(gdef.name, 'giveGear', k)).join(''))}
        <p class="god-note">Tap a room in the cutaway to level it, or tear it down, from its panel as usual. "Build one" uses the first free lot and ignores cost and plans.</p>`;
    } else {
      body = `<div class="god-row">${gbtn('Refresh missions', 'refreshMissions')}${gbtn('Clear open missions', 'clearMissions', undefined, undefined, 'ghost')}</div>
        ${STAT('Add mission', ['salvage', 'rescue', 'combat', 'elite'].map((k) => gbtn(k[0].toUpperCase() + k.slice(1), 'addMission', k, '3')).join(''))}
        <div class="god-row">${gbtn('Everyone loves me', 'befriendAll')}${gbtn('Story: vault ready', 'storyDone')}${gbtn('Open the vault', 'unlockVault')}</div>
        ${s.warlords.filter((w) => w.alive).map((w) => `<div class="god-who"><b>${esc(w.name)}</b><span class="small muted">${esc(w.temperament)} · ${w.disposition}</span>${gnum('g-w-' + w.id, w.disposition, 'setDisposition', w.id)}${gbtn('Raid tonight', 'raidTonight', w.id)}${gbtn('Remove', 'removeWarlord', w.id, undefined, 'ghost')}</div>`).join('')}
        <p class="god-note">In battle, ⚡ Heal and ⚡ Win appear at the top of the screen.</p>`;
    }
    return `<p class="eyebrow">Developer tools</p><h2>God mode</h2><div class="god-tabs" role="tablist">${tabs.map(([k, l]) => `<button class="btn small ${tab === k ? 'primary' : ''}" role="tab" aria-selected="${tab === k}" data-act="godTab" data-arg="${k}">${l}</button>`).join('')}</div>${body}<div class="actions"><button class="btn primary" data-act="close">Done</button></div>`;
  }

  function showSheet() {
    const el = $('sheet'), scrim = $('scrim');
    const sh = sheets[0];
    if (!sh) { el.hidden = true; scrim.hidden = true; return; }
    el.hidden = false; scrim.hidden = false;
    let html = '';
    if (sh.kind === 'event') {
      const ev = s.pendingEvents[0];
      if (!ev) { sheets.shift(); return showSheet(); }
      const v = UNM.eventView(s, ev);
      html = `<p class="eyebrow">Morning, day ${s.day}</p><h2>${ev.id === 'demand' ? 'A rider at the gate' : ev.id.startsWith('pilot') ? 'Pilot Light has an idea' : ev.id === 'surrender' ? 'A prisoner' : 'At the bar'}</h2><p>${esc(v.text)}</p><div class="actions">${v.options.map((o) => `<button class="btn ${o === v.options[0] ? 'primary' : ''}" data-act="answer" data-arg="${o.id}" ${o.disabled ? 'disabled' : ''}>${esc(o.label)}</button>`).join('')}</div>`;
    } else if (sh.kind === 'result') {
      html = `<h2>${esc(sh.title)}</h2><p>${esc(sh.text)}</p><div class="actions"><button class="btn primary" data-act="close">Continue</button></div>`;
    } else if (sh.kind === 'story') {
      html = `<p class="eyebrow">Pilot Light’s trust grows</p><h2>${esc(UNM.TRUST_LEVELS[s.trust.level - 1].name)}</h2><div class="pilot-say">${esc(sh.text)}</div><div class="actions"><button class="btn primary" data-act="close">Continue</button></div>`;
    } else if (sh.kind === 'role') {
      const c = crewById(sh.id);
      if (!c || c.role !== 'recruit') { sheets.shift(); return showSheet(); }
      html = `<p class="eyebrow">Level ${c.level}</p><h2>${esc(c.name)} is ready for a role</h2><p>Pick what they become. It sticks.</p><div class="actions">${UNM.ROLES.map((r) => `<button class="btn" data-act="role" data-arg="${r.id}"><b>${r.name}</b> <span class="chip">${r.archetype}</span><br><span class="small">${r.summary}</span></button>`).join('')}<button class="btn ghost" data-act="close">Decide later</button></div>`;
    } else if (sh.kind === 'depart') {
      const going = s.missions.filter((m) => m.status === 'open' && m.squad.length >= 4);
      const short = s.missions.filter((m) => m.status === 'open' && m.squad.length > 0 && m.squad.length < 4);
      const intro = s.missions.find((m) => m.scripted === 'intro' && m.status === 'open');
      html = `<p class="eyebrow">End of morning</p><h2>${going.length ? 'Teams heading out' : 'Nobody is going out'}</h2>`;
      if (going.length) html += `<ul class="report">${going.map((m) => `<li><b>${esc(m.site)}</b>: ${m.squad.map((id) => esc(crewById(id).name.split(' ')[0])).join(', ')}</li>`).join('')}</ul>`;
      if (short.length) html += `<p class="bad">${short.map((m) => esc(m.site)).join(', ')}: a squad needs at least four. They will stay home.</p>`;
      if (intro && !going.includes(intro)) html += `<div class="pilot-say">The pump station will not clear itself. Pick four crew in Missions.</div>`;
      html += `<p class="small muted">${going.some((m) => !m.travel) ? 'Teams on nearby jobs go in now. You command them on the map, then midday runs.' : 'Midday: rooms produce and patrons arrive.'}${going.some((m) => m.travel) ? ' Teams on far jobs fight when they arrive.' : ''}</p><div class="actions"><button class="btn primary" data-act="confirmMorning">${going.length ? 'Send them and open for business' : 'Open for business'}</button><button class="btn ghost" data-act="close">Not yet</button></div>`;
    } else if (sh.kind === 'midday') {
      const t = sh.res.today;
      html = `<p class="eyebrow">Evening, day ${s.day}</p><h2>${t.buttons ? `${t.buttons} silver buttons today` : 'A slow day'}</h2><ul class="report">
        <li>${t.traffic} travelers came by. ${t.guests} stayed the night, ${t.served} ate at the bar${t.turnedAway ? `, ${t.turnedAway} turned away for lack of food or water` : ''}.</li>
        <li>Produced: ${Math.round(t.water + t.served)} water, ${Math.round(t.food + t.served)} food${t.salvage ? `, ${Math.round(t.salvage)} salvage` : ''} (before what patrons used).</li>
        <li>Power: ${t.power.supply} made, ${t.power.demand} wanted${t.power.demand > t.power.supply ? ' · some rooms sat dark' : ''}.</li></ul>`;
      for (const r of sh.res.reports) {
        const g = Object.entries(r.gained).filter(([k, v]) => v && k !== 'recruit').map(([k, v]) => `${v} ${k}`).join(', ');
        html += `<h3 style="font-family:var(--font-display);color:var(--rust);letter-spacing:.06em;text-transform:uppercase;font-size:15px;margin:16px 0 4px">${esc(r.mission.site)} · ${({ success: 'success', partial: 'partial success', retreat: 'retreated', wiped: 'squad lost' })[r.outcome] || r.outcome}</h3><p>${r.lines.map(esc).join(' ')}</p><ul class="report">${g ? `<li>Brought back ${esc(g)}.</li>` : ''}${r.gained.recruit ? '<li>A survivor is waiting at the bar, hoping for work.</li>' : ''}${r.injured.length ? `<li>Injured: ${esc(r.injured.join(', '))}.</li>` : ''}${r.died.length ? `<li class="bad">Lost: ${esc(r.died.join(', '))}.</li>` : ''}</ul>`;
      }
      if (sh.res.reports.some((r) => r.mission.scripted === 'intro')) html += `<div class="pilot-say">I am sorry. I liked them. There are travelers at the bar looking for work. The Team panel.</div>`;
      html += `<div class="actions"><button class="btn primary" data-act="close">On to the evening</button></div>`;
    } else if (sh.kind === 'night') {
      const n = sh.night;
      html = `<p class="eyebrow">Morning, day ${s.day}</p><h2>${n.raid ? (n.raid.outcome === 'repelled' ? 'Raid repelled' : n.raid.outcome === 'breached' ? 'Raiders got in' : 'Overrun') : 'A quiet night'}</h2>`;
      if (n.raid) html += `<p>${n.raid.lines.map(esc).join(' ')}</p>`;
      if (n.event) html += `<p>${esc(n.event)}</p>`;
      html += `<ul class="report">${n.lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul><div class="actions"><button class="btn primary" data-act="close">Start the day</button></div>`;
    } else if (sh.kind === 'intercom') {
      const v = UNM.intercom(s);
      if (!v) { sheets.shift(); return showSheet(); }
      html = `<p class="eyebrow">Intercom · the sealed door</p><h2>${esc(UNM.storyState(s).relative)}</h2>${v.lines.map((l) => `<div class="pilot-say" style="margin:8px 0">${esc(l)}</div>`).join('')}<div class="actions">${v.options.map((o) => `<button class="btn" data-act="intercomSay" data-arg="${o.id}">${esc(o.label)}</button>`).join('')}</div>`;
    } else if (sh.kind === 'intercomReply') {
      html = `<p class="eyebrow">Intercom</p><h2>${esc(UNM.storyState(s).relative)}</h2>${sh.lines.map((l) => `<div class="pilot-say" style="margin:8px 0">${esc(l)}</div>`).join('')}<div class="actions"><button class="btn primary" data-act="close">Hang up</button></div>`;
    } else if (sh.kind === 'ending') {
      const e = UNM.vaultEnding(s);
      const i = sh.page || 0;
      if (i < e.pages.length) html = `<p class="eyebrow">The vault · ${i + 1} of ${e.pages.length}</p><h2>${['The door opens', 'The screens', 'The truth'][i] || ''}</h2><p>${esc(e.pages[i])}</p><div class="actions"><button class="btn primary" data-act="endingNext">Go on</button></div>`;
      else html = `<p class="eyebrow">End of the main story</p><h2>Under New Management</h2><p>${esc(e.stats)}</p><p>${esc(e.outro)}</p><div class="actions"><button class="btn primary" data-act="close">Keep the lights on</button></div>`;
    } else if (sh.kind === 'confirm') {
      html = `<h2>${esc(sh.title)}</h2><p>${esc(sh.text)}</p><div class="actions"><button class="btn primary" data-act="confirmYes">${esc(sh.yes)}</button><button class="btn ghost" data-act="close">${esc(sh.no || 'Not now')}</button></div>`;
    } else if (sh.kind === 'raid') {
      const pr = s.pendingRaid;
      if (!pr) { sheets.shift(); return showSheet(); }
      const w = s.warlords.find((x) => x.id === pr.warlord);
      const base = UNM.raidBase(s);
      const avail = UNM.atHome(s).filter((c) => c.injured === 0);
      raidPick = raidPick.filter((id) => avail.some((c) => c.id === id));
      const solid = Math.min(10, Math.round(base.wallPower * 2));
      html = `<p class="eyebrow">Night, day ${s.day}</p><h2>Raid! ${esc(w ? w.name : 'Raiders')} at the wall</h2>
        <p>${pr.count} raiders, coming in by ${esc(pr.style)}. They want to wreck what is up top and carry off your buttons.</p>
        <ul class="report"><li>Wall: ${solid ? `${solid} of 10 sections solid` : 'barely standing'}, gate open in the middle.</li><li>Watchtowers: ${base.towers.length ? `${base.towers.length} (high ground: +10 aim, half cover)` : 'none'}.</li><li>Rooms they can wreck: ${base.rooms.length ? esc(base.rooms.map((x) => x.name).join(', ')) : 'nothing worth it'}.</li></ul>
        <h3 style="font-family:var(--font-display);color:var(--rust);letter-spacing:.06em;text-transform:uppercase;font-size:15px;margin:14px 0 6px">Defenders (up to 6)</h3>
        ${avail.length ? `<div class="pick">${avail.map((c) => `<label class="${!raidPick.includes(c.id) && raidPick.length >= 6 ? 'dis' : ''}"><input type="checkbox" data-act="raidpick" data-arg="${c.id}" ${raidPick.includes(c.id) ? 'checked' : ''} ${!raidPick.includes(c.id) && raidPick.length >= 6 ? 'disabled' : ''}>${esc(c.name.split(' ')[0])} <span class="muted small">${roleName(c)} ${c.level}</span></label>`).join('')}</div>` : '<p class="bad">Nobody fit to fight is home.</p>'}
        <p class="small muted">Watchtower crew start up in the towers. If every defender goes down, the waystation falls and the game ends. Falling back to the bunker costs rooms and buttons, not lives.</p>
        <div class="actions"><button class="btn primary" data-act="raidGo" ${raidPick.length ? '' : 'disabled'}>Man the walls${raidPick.length ? ` · ${raidPick.length}` : ''}</button><button class="btn" data-act="raidHide">Fall back to the bunker</button></div>`;
    } else if (sh.kind === 'gameover') {
      const ds = !s.ironman && dayStart();
      html = `<p class="eyebrow">Day ${s.day}${s.ironman ? ' · Ironman' : ''}</p><h2>The waystation is lost</h2><p>${esc(s.gameOver)}</p>${s.ironman ? '<p class="small muted">Ironman: this waystation is gone for good.</p>' : ''}<div class="actions">${ds ? `<button class="btn primary" data-act="retryDay">Try day ${ds.day} again</button>` : ''}<button class="btn ${ds ? '' : 'primary'}" data-act="toMenu">Main menu</button></div>`;
    } else if (sh.kind === 'settings') {
      html = `<h2>Settings</h2>${h3('The sign')}<div class="row"><input id="wsrename" class="name-input" type="text" maxlength="16" autocomplete="off" spellcheck="false" value="${esc(UNM.nameOf(s))}" aria-label="Waystation name"><button class="btn small" data-act="rename">Repaint it</button></div>${h3('Top bar shows')}<div class="pick">${Object.entries(RES_META).map(([k, m]) => `<label><input type="checkbox" data-act="pref" data-arg="${k}" ${prefs.res.includes(k) ? 'checked' : ''}>${m.label}</label>`).join('')}</div>
        ${audioHtml()}${accessHtml()}${aboutHtml()}
        <div class="actions"><button class="btn" data-act="help">How to play</button><button class="btn" data-act="recenter">Recenter the view</button>${s.tutorial.step < UNM.TUTORIAL.length ? '<button class="btn" data-act="skiptut">Skip the tutorial</button>' : ''}${!s.ironman && dayStart() && !s.battle ? `<button class="btn" data-act="retryDay">Restart day ${dayStart().day}</button>` : ''}<button class="btn" data-act="toMenu">Save and go to the main menu</button><button class="btn primary" data-act="close">Done</button></div><p class="small muted" data-act="godTap">${esc(s.saveName || 'Waystation')} · slot ${(slot || 0) + 1} · ${UNM.DIFFICULTY[s.difficulty || 'standard'].name}${s.ironman ? ' · Ironman: one save, no restarts' : ''}. The game saves in this browser after every action. Seed: ${esc(s.seed)}.</p>`;
    } else if (sh.kind === 'confirmNew') {
      html = `<h2>Start over?</h2><p>This replaces your current waystation (day ${s.day}). It cannot be undone.</p><div class="actions"><button class="btn primary" data-act="setupNew">Yes, set up a new game</button><button class="btn ghost" data-act="close">Keep playing</button></div>`;
    } else if (sh.kind === 'setup') {
      html = `<p class="eyebrow">Slot ${(sh.slot || 0) + 1} · a courier, a note, a ruined motel</p><h2 style="font-size:34px">New game</h2>
        <h3 style="font-family:var(--font-display);color:var(--rust);text-transform:uppercase;letter-spacing:.08em;font-size:15px">Name this save</h3>
        <p class="small">Only you see this. It labels the slot on the main menu.</p>
        <input id="savename" class="name-input" type="text" maxlength="24" autocomplete="off" spellcheck="false" placeholder="Save ${(sh.slot || 0) + 1}" value="${esc(setup.saveName)}" aria-label="Name this save" style="font-size:20px">
        <h3 style="font-family:var(--font-display);color:var(--rust);text-transform:uppercase;letter-spacing:.08em;font-size:15px">Difficulty</h3>
        <div class="stack">${Object.entries(UNM.DIFFICULTY).map(([k, d]) => `<button class="btn ${setup.difficulty === k ? 'primary' : ''}" data-act="setdiff" data-arg="${k}" aria-pressed="${setup.difficulty === k}"><b>${d.name}</b><br><span class="small">${esc(d.text)}</span></button>`).join('')}</div>
        <div class="pick" style="margin-top:12px"><label><input type="checkbox" data-act="setupopt" data-arg="ironman" ${setup.ironman ? 'checked' : ''}>Ironman: one save, no restarting the day</label><label><input type="checkbox" data-act="setupopt" data-arg="tutorial" ${setup.tutorial ? 'checked' : ''}>Play the tutorial (about 20 minutes)</label></div>
        <div class="actions"><button class="btn primary" data-act="newgame">Begin the story</button><button class="btn ghost" data-act="close">Back</button></div>`;
    } else if (sh.kind === 'namesign') {
      html = `<p class="eyebrow">Pilot Light</p><h2>Name the waystation</h2><p>Up to sixteen letters. It goes up on the sign over the roof, and yes, it will flicker.</p>
        <input id="signname" class="name-input" type="text" maxlength="16" autocomplete="off" spellcheck="false" placeholder="WAYSTATION" value="${esc(s.name || '')}" aria-label="Waystation name">
        <div class="actions"><button class="btn primary" data-act="paintSign">Paint the sign</button><button class="btn ghost" data-act="close">Not yet</button></div>`;
    } else if (sh.kind === 'menuSettings') {
      html = `<h2>Settings</h2>${audioHtml()}${accessHtml()}${aboutHtml()}<div class="actions"><button class="btn primary" data-act="close">Done</button></div>`;
    } else if (sh.kind === 'godPass') {
      html = `<p class="eyebrow">Restricted</p><h2>Say the words</h2><p class="small muted">Developer tools. This lock is only a courtesy: the game runs on your own device.</p>
        <div class="god-row"><input id="godpw" class="god-in" style="width:100%" type="password" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Passphrase" placeholder="Passphrase"></div>
        <div class="actions"><button class="btn primary" data-act="godTry">Unlock</button><button class="btn ghost" data-act="close">Never mind</button></div>`;
    } else if (sh.kind === 'god') {
      html = godHtml(sh);
    } else if (sh.kind === 'install') {
      const ua = navigator.userAgent || '', ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1), android = /Android/i.test(ua);
      const steps = {
        ios: ['iPhone and iPad (Safari)', 'Tap the Share button, then “Add to Home Screen”, then Add.'],
        android: ['Android (Chrome or Samsung Internet)', 'Open the browser menu (⋮), then “Install app” or “Add to Home screen”.'],
        desk: ['Computer (Chrome or Edge)', 'Click the install icon at the right end of the address bar, or open the browser menu and choose “Install Under New Management”.'],
      };
      const order = ios ? ['ios', 'android', 'desk'] : android ? ['android', 'ios', 'desk'] : ['desk', 'android', 'ios'];
      html = `<p class="eyebrow">Play it like an app</p><h2>Install the game</h2><p>Once installed it opens full screen with its own icon, works without a connection, and your saves stay on the device.</p>
        <ul class="report">${order.map((k) => `<li><b>${steps[k][0]}</b><br>${steps[k][1]}</li>`).join('')}</ul>
        ${window.__PWA ? '' : '<p class="small muted">This preview copy cannot be installed. Open the game from its own web address and these steps will work.</p>'}
        <div class="actions"><button class="btn primary" data-act="close">Got it</button></div>`;
    } else if (sh.kind === 'credits') {
      html = `<h2>Credits</h2><p><b>Under New Management</b><br>A waystation management and tactics game by Ryan.</p><p class="small muted">Art, music and sound are drawn and synthesised in code. Type is Big Shoulders Stencil Text, Alegreya Sans and IBM Plex Mono, used under the SIL Open Font License.</p><p class="small muted">Built with Claude.</p><div class="actions"><button class="btn primary" data-act="close">Back</button></div>`;
    } else if (sh.kind === 'help') {
      html = `<h2>How to play</h2><ul class="report">
        <li><b>Days</b> have four phases. Plan in the morning, then End morning: teams leave, rooms produce, patrons pay. In the evening hire and build, then End evening for the night.</li>
        <li><b>Rooms</b>: tap a room to repair, staff or upgrade it; tap an empty lot to build. Most rooms need crew, and many need power from a staffed Generator.</li>
        <li><b>Crew</b> eat 1 food and drink 1 water a night and need a bunk. Low morale makes people leave. At level 2 you choose their role.</li>
        <li><b>Buttons</b> are the only money and cannot be made, only earned. Upkeep is paid every night. Run out and the waystation is lost.</li>
        <li><b>Missions</b>: pick 4 to 6 crew. You fight turn by turn: two actions each, shooting ends a turn, cover blocks shots. Downed crew bleed out unless revived or carried out.</li>
        <li><b>Raids</b> come at night. Pick defenders and hold the walls, or fall back to the bunker and lose rooms and buttons instead of lives. If every defender falls, the waystation is lost.</li>
        <li><b>Warlords</b>: pay, make pacts, plot, or oppose them and take their stronghold.</li>
        <li><b>Plans</b> unlock new rooms and room levels. <b>Pilot Light</b> learns to trust you; it has secrets about the door downstairs.</li></ul>
        <div class="actions"><button class="btn primary" data-act="close">Got it</button></div>`;
    }
    el.innerHTML = html;
    const first = el.querySelector('button:not([disabled])');
    if (first) first.focus({ preventScroll: true });
  }

  // ---------- render ----------
  function renderPhaseBtn() {
    const b = $('phaseBtn');
    b.textContent = s.phase === 'morning' ? 'End morning' : s.phase === 'evening' ? 'End evening' : s.pendingRaid ? 'Raid!' : 'Night…';
    b.disabled = !!s.gameOver;
    $('pilot').classList.toggle('nudge', s.tutorial.step < UNM.TUTORIAL.length);
  }
  function render() {
    if (menuOpen) { showSheet(); UNM.god.sync(null); applyPrefs(); return; }
    renderTop(); renderRail(); renderDrawer(); renderObjective(); renderPhaseBtn(); showSheet();
    scene && scene.setState(s, sel, highlights());
    window.__unm = { s, UNM, sel, TAC, Battle, Sound, scene };
    UNM.god.sync(s);
    applyPrefs();
    Sound.setMood(s.battle ? (s.battle.kind === 'raid' ? 'raid' : 'battle') : s.story && s.story.open && sheets[0] && sheets[0].kind === 'ending' ? 'vault' : s.phase === 'night' && s.pendingRaid ? 'raid' : s.phase);
  }

  // ---------- confirm before spending ----------
  function askConfirm(o) { sheets.unshift({ kind: 'confirm', no: 'Cancel', ...o }); Sound.sfx('click'); render(); }

  // ---------- main menu and save slots ----------
  const ago = (ts) => {
    if (!ts) return '';
    const m = Math.round((Date.now() - ts) / 60000);
    if (m < 1) return 'Played just now';
    if (m < 60) return `Played ${m} min ago`;
    if (m < 60 * 24) return `Played ${Math.round(m / 60)} h ago`;
    return `Played ${new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
  };
  function renderMenu() {
    const cards = Array.from({ length: SLOTS }, (_, i) => {
      const m = readSlot(i);
      if (!m) return `<div class="slot empty"><div class="slot-n">Slot ${i + 1}</div><div class="slot-name muted">Empty</div><div class="slot-sub">Nobody is running a waystation here yet.</div><div class="row"><button class="btn primary" data-act="menuNew" data-arg="${i}">New game</button></div></div>`;
      if (m.broken) return `<div class="slot"><div class="slot-n">Slot ${i + 1}</div><div class="slot-name">Unreadable save</div><div class="slot-sub">This save is from a different version of the game.</div><div class="row"><button class="btn ghost small" data-act="menuDelete" data-arg="${i}">Delete</button></div></div>`;
      const crew = (m.crew || []).filter((c) => c.alive && !c.left).length;
      const diff = (UNM.DIFFICULTY[m.difficulty || 'standard'] || UNM.DIFFICULTY.standard).name;
      return `<div class="slot"><div class="slot-n">Slot ${i + 1}${m.ironman ? ' · <b class="iron">Ironman</b>' : ''}</div><div class="slot-name">${esc(m.saveName || 'Waystation')}</div><div class="slot-sub">${esc(UNM.nameOf(m))} · Day ${m.day}, ${esc(m.phase)} · ${crew} crew · ${esc(diff)}</div><div class="small muted">${esc(ago(m.savedAt))}</div><div class="row"><button class="btn primary" data-act="menuPlay" data-arg="${i}">Continue</button><button class="btn ghost small" data-act="menuDelete" data-arg="${i}">Delete</button></div></div>`;
    });
    menuEl.innerHTML = `<canvas class="menu-bg" aria-hidden="true"></canvas><div class="menu-shade"></div>
      <div class="menu-main"><p class="eyebrow">A waystation management game</p><h1>Under New Management</h1><p class="tag">Keep the lights on.</p>
      <div class="slots">${cards.join('')}</div>
      ${isStandalone() ? '' : `<div class="install"><div class="install-text"><b>Play it like an app</b><span>Install Under New Management on your phone, tablet or computer. It opens full screen, works offline, and keeps your saves.</span></div><button class="btn primary" data-act="install">${installEvt ? 'Install the game' : 'How to install'}</button></div>`}
      <div class="menu-links"><button class="btn small" data-act="menuHelp">How to play</button><button class="btn small" data-act="menuSettings">Settings</button><button class="btn small" data-act="menuStory">Replay the story</button><button class="btn small" data-act="menuCredits">Credits</button></div></div>`;
    Cine.backdrop(menuEl.querySelector('canvas'), true);
  }
  function setInert(on) { document.querySelectorAll('.topbar, .stage').forEach((e) => { e.inert = on; }); }
  function openMenu() {
    if (slot !== null && s) save();
    if (Battle.isOpen()) Battle.close();
    migrateOldSave();
    slot = null; s = UNM.newGame(7); UNM.skipTutorial(s);
    sheets = []; sel = null; menuOpen = true; lastStep = -1;
    scene.pause(true); setInert(true);
    menuEl.hidden = false; renderMenu();
    $('scrim').hidden = true; $('sheet').hidden = true; $('bubble').hidden = true;
    Sound.setMood('evening');
  }
  function closeMenu() { menuOpen = false; menuEl.hidden = true; Cine.backdrop(null, false); setInert(false); scene.pause(false); }
  const WELCOME = () => 'Welcome to the waystation. Mind the hole. And the other hole. ' + UNM.TUTORIAL[0].text;
  function enterSlot(i) {
    let st; try { st = UNM.deserialize(localStorage.getItem(SLOT_KEY(i))); } catch (e) { toast('That save could not be read.', true); return; }
    closeMenu(); s = st; slot = i; sheets = []; sel = null; roleDeferredAt = ''; raidPick = []; tab = 'room'; panelOpen = window.innerWidth >= 900;
    seenNight = s.day; lastStep = s.tutorial.step; scene.recenter(); queueAutoSheets(); render();
    if (s.battle) openBattle();
    else if (s.phase === 'night' && s.pendingRaid) raidAlert();
    else if (s.phase === 'night') { UNM.finishNight(s); afterChange(); }
    if (s.tutorial.step === 0 && s.day === 1) setTimeout(() => speak(WELCOME()), 600);
  }
  function beginNew(i) {
    if (Battle.isOpen()) Battle.close();
    const nm = (($('savename') && $('savename').value) || setup.saveName || '').trim().slice(0, 24) || `Save ${i + 1}`;
    s = UNM.newGame(Date.now());
    UNM.setDifficulty(s, setup.difficulty);
    s.saveName = nm; s.ironman = !!setup.ironman;
    if (!setup.tutorial) UNM.skipTutorial(s);
    slot = i; try { localStorage.removeItem(DAY_KEY(i)); } catch (e) { /* ignore */ }
    save(); sheets = []; sel = null; seenNight = 0; tab = 'room'; lastStep = s.tutorial.step; roleDeferredAt = ''; raidPick = [];
    closeMenu(); scene.recenter(); render();
    Cine.play(() => { afterChange(); if (setup.tutorial) setTimeout(() => speak(WELCOME()), 400); });
  }

  // ---------- tactical missions ----------
  // Ending the morning may start one battle per team arriving today; each one
  // is played on the tactical map before midday runs.
  function proceedMorning() {
    const res = UNM.endMorning(s);
    if (!res) { afterChange(); return; }
    if (res.battle) { save(); render(); openBattle(); return; }
    sheets.unshift({ kind: 'midday', res });
    afterChange();
  }
  function openBattle() {
    if (!s.battle || Battle.isOpen()) return;
    $('bubble').hidden = true;
    scene.pause(true); // the base view is hidden behind the battle: stop drawing it
    Battle.open(s.battle, {
      save,
      onDone() {
        scene.pause(false);
        const raid = s.battle && s.battle.kind === 'raid';
        UNM.finishBattle(s); save();
        if (raid) { UNM.finishNight(s); afterChange(); } else proceedMorning();
      },
    });
  }
  // A raid at the gate: pick defenders, then fight it on the waystation map.
  function raidAlert() {
    raidPick = UNM.defaultDefenders(s);
    sheets = sheets.filter((x) => x.kind !== 'raid');
    sheets.unshift({ kind: 'raid' });
    Sound.sfx('alarm'); save(); render();
  }

  // ---------- events ----------
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el || el.tagName === 'SELECT' || el.tagName === 'INPUT') return;
    const a = el.dataset.act, arg = el.dataset.arg;
    switch (a) {
      case 'tab': if (tab === arg && panelOpen && window.innerWidth < 900) panelOpen = false; else { tab = arg; panelOpen = true; } render(); break;
      case 'recenter': scene.recenter(); if (sheets[0] && sheets[0].kind === 'settings') { sheets.shift(); } render(); break;
      case 'build': {
        const at = sel, t = T[arg], c = UNM.costOf(s, arg, 'build');
        askConfirm({ title: `Build a ${t.name}?`, text: `${t.blurb} Costs ${costText(c)}. Ready in ${t.days} day${t.days > 1 ? 's' : ''}.`, yes: 'Build it', run: () => { if (!act(() => UNM.buildRoom(s, arg, at.row, at.col))) { const r = s.rooms[s.rooms.length - 1]; sel = { kind: 'room', id: r.id }; render(); } } });
        break;
      }
      case 'repair': {
        const room = s.rooms.find((r) => r.id === sel.id), id = sel.id;
        const go = () => { if (!act(() => UNM.repairRoom(s, id))) Sound.sfx('build'); };
        if (!room || room.free) go(); else askConfirm({ title: `Repair the ${T[room.type].name}?`, text: `Costs ${costText(UNM.costOf(s, room.type, 'repair', room))}.`, yes: 'Repair it', run: go });
        break;
      }
      case 'upgrade': {
        const room = s.rooms.find((r) => r.id === sel.id), id = sel.id;
        askConfirm({ title: `Upgrade the ${T[room.type].name}?`, text: `Takes it to level ${room.level + 1}. Costs ${costText(UNM.costOf(s, room.type, 'upgrade', room))}, and a little more upkeep each night.`, yes: 'Upgrade it', run: () => { if (!act(() => UNM.upgradeRoom(s, id))) Sound.sfx('build'); } });
        break;
      }
      case 'demolish': {
        const room = s.rooms.find((r) => r.id === sel.id), id = sel.id;
        askConfirm({ title: `Tear down the ${T[room.type].name}?`, text: 'Anyone working here goes idle. You get 3 salvage back. The room itself is gone.', yes: 'Tear it down', run: () => { act(() => UNM.demolishRoom(s, id)); sel = null; render(); } });
        break;
      }
      case 'dig': askConfirm({ title: 'Dig a new level?', text: `Opens ten more lots underground. Costs ${costText(UNM.digCost(s))}.`, yes: 'Start digging', run: () => { act(() => UNM.dig(s)); sel = null; render(); } }); break;
      case 'assign': act(() => UNM.assignJob(s, arg, sel.id)); break;
      case 'unassign': act(() => UNM.assignJob(s, arg, null)); break;
      case 'hire': act(() => UNM.hire(s, arg)); break;
      case 'custom': act(() => UNM.hire(s, null, { name: $('cname').value, look: { skin: +$('cskin').value, hair: +$('chair').value, coat: +$('ccoat').value } })); break;
      case 'gift': act(() => UNM.giftWarlord(s, arg)); break;
      case 'pact': act(() => UNM.proposePact(s, arg)); break;
      case 'research': { const t = UNM.techById(arg); askConfirm({ title: `Research ${t.name}?`, text: `Costs ${costText(t.cost)} and takes ${t.days} night${t.days > 1 ? 's' : ''}.`, yes: 'Start research', run: () => act(() => UNM.startResearch(s, arg)) }); break; }
      case 'buy': act(() => UNM.buySupplies(s, arg)); break;
      case 'intercom': sheets.unshift({ kind: 'intercom' }); Sound.sfx('click'); render(); break;
      case 'intercomSay': { sheets.shift(); const lines = UNM.answerIntercom(s, arg); if (lines) sheets.unshift({ kind: 'intercomReply', lines }); afterChange(); break; }
      case 'openVault': { if (!act(() => UNM.openVault(s))) { Sound.sfx('door'); Sound.setMood('vault'); sheets.unshift({ kind: 'ending', page: 0 }); render(); } break; }
      case 'screens': sheets.unshift({ kind: 'ending', page: 0 }); render(); break;
      case 'endingNext': sheets[0].page = (sheets[0].page || 0) + 1; if (sheets[0].page >= 3) Sound.sfx('win'); render(); break;
      case 'music': prefs.music = !prefs.music; savePrefs(); Sound.setEnabled('music', prefs.music); render(); break;
      case 'sfx': prefs.sfx = !prefs.sfx; savePrefs(); Sound.setEnabled('sfx', prefs.sfx); render(); break;
      case 'craft': act(() => UNM.craftGear(s, arg)); break;
      case 'standDown': act(() => UNM.standDown(s, arg)); break;
      case 'conspire': act(() => UNM.conspire(s, arg, $('cons-' + arg).value)); break;
      case 'endCons': act(() => UNM.endConspiracy(s)); break;
      case 'askOppose': { const w = s.warlords.find((x) => x.id === arg); sheets.unshift({ kind: 'confirm', title: `Oppose ${w.name}?`, text: `Your standing with them drops hard and they raid more often. In return, strikes against their people show up on the board. Hit them enough and their stronghold opens up.`, yes: 'Oppose them', act: 'oppose', arg }); render(); break; }
      case 'askBreak': { const w = s.warlords.find((x) => x.id === arg); sheets.unshift({ kind: 'confirm', title: `Break the pact with ${w.name}?`, text: 'No more tribute, but they will take it badly and the raids can start again.', yes: 'Break it', act: 'breakPact', arg }); render(); break; }
      case 'confirmYes': { const sh = sheets.shift(); if (sh.run) { Sound.sfx('click'); sh.run(); if (!sheets.length && !menuOpen) render(); else render(); } else act(() => (sh.act === 'oppose' ? UNM.oppose(s, sh.arg) : UNM.breakPact(s, sh.arg))); break; }
      case 'rolesheet': sheets.unshift({ kind: 'role', id: arg }); render(); break;
      case 'role': { const sh = sheets.shift(); UNM.chooseRole(s, sh.id, arg); chirp('good'); afterChange(); break; }
      case 'answer': { sheets.shift(); const res = UNM.answerEvent(s, arg); if (res) sheets.unshift({ kind: 'result', title: 'So be it', text: res }); afterChange(); break; }
      case 'close': { const sh = sheets.shift(); if (sh && sh.kind === 'role') roleDeferredAt = s.day + s.phase; afterChange(); break; }
      case 'confirmMorning': {
        sheets.shift();
        proceedMorning();
        break;
      }
      case 'raidGo': { sheets.shift(); UNM.startRaid(s, raidPick); save(); render(); openBattle(); break; }
      case 'raidHide': { sheets.shift(); UNM.startRaid(s, []); UNM.finishRaid(s); UNM.finishNight(s); afterChange(); break; }
      case 'skiptut': UNM.skipTutorial(s); sheets = sheets.filter((x) => x.kind !== 'settings'); afterChange(); toast('Tutorial skipped. The waystation is yours.'); break;
      case 'confirmNew': sheets[0] = { kind: 'confirmNew' }; render(); break;
      case 'newgame': beginNew((sheets[0] && sheets[0].slot) || 0); break;
      case 'menuNew': setup.saveName = ''; sheets = [{ kind: 'setup', slot: +arg, closable: true }]; render(); break;
      case 'menuPlay': enterSlot(+arg); break;
      case 'menuDelete': {
        const i = +arg, m = readSlot(i);
        askConfirm({ title: `Delete slot ${i + 1}?`, text: `${m && !m.broken ? `“${m.saveName || 'Waystation'}” (day ${m.day}) will be gone for good.` : 'This save will be removed.'} This cannot be undone.`, yes: 'Delete it', no: 'Keep it', run: () => { try { localStorage.removeItem(SLOT_KEY(i)); localStorage.removeItem(DAY_KEY(i)); } catch (e) { /* ignore */ } renderMenu(); } });
        break;
      }
      case 'menuHelp': sheets.unshift({ kind: 'help' }); render(); break;
      case 'menuSettings': sheets.unshift({ kind: 'menuSettings' }); render(); break;
      case 'menuCredits': sheets.unshift({ kind: 'credits' }); render(); break;
      case 'menuStory': Cine.play(() => {}); break;
      case 'install': {
        if (installEvt) { const ev = installEvt; installEvt = null; ev.prompt(); ev.userChoice && ev.userChoice.then(() => { if (menuOpen) renderMenu(); }); renderMenu(); }
        else { sheets.unshift({ kind: 'install' }); render(); }
        break;
      }
      case 'toMenu': sheets = []; openMenu(); break;
      case 'nameSign': sheets.unshift({ kind: 'namesign' }); render(); break;
      case 'leaveSign': UNM.leaveSign(s); afterChange(); toast('Fine. It stays WAYSTATION. You can change it in Settings.'); break;
      case 'paintSign': {
        const v = $('signname') && $('signname').value;
        if (!UNM.cleanName(v)) { toast('Give it a name first, or leave it for now.', true); break; }
        sheets.shift(); act(() => UNM.setName(s, v)); toast(`The sign now reads ${UNM.nameOf(s)}.`);
        setTimeout(() => speak(`${UNM.nameOf(s)}. Hm. It has a ring to it. I will let the lamps know.`, 'good'), 400);
        break;
      }
      case 'setdiff': setup.saveName = ($('savename') && $('savename').value) || setup.saveName; setup.difficulty = arg; render(); break;
      case 'rename': { const v = $('wsrename') && $('wsrename').value; act(() => UNM.setName(s, v)); toast(`The sign now reads ${UNM.nameOf(s)}.`); break; }
      case 'retryDay': { const d = dayStart(); if (d) { if (Battle.isOpen()) Battle.close(); scene.pause(false); s = d; s.gameOver = null; sheets = []; seenNight = s.day; sel = null; save(); render(); toast(`Back to the morning of day ${s.day}.`); } break; }
      case 'help': sheets.unshift({ kind: 'help' }); render(); break;
      case 'selroom': sel = { kind: 'room', id: arg }; render(); break;
      case 'pset': { const i = arg.indexOf(':'); prefs[arg.slice(0, i)] = arg.slice(i + 1); savePrefs(); render(); break; }
      case 'ptoggle': prefs[arg] = !prefs[arg]; savePrefs(); render(); break;
      case 'resetAccess': Object.assign(prefs, { text: 'md', cb: false, fast: false, font: 'std', loose: false, hc: false, still: false, big: false, focus: false, hold: 'normal', vMusic: 100, vSfx: 100 }); savePrefs(); render(); toast('Accessibility settings reset.'); break;
      case 'applyUpdate': applyUpdate(); break;
      case 'laterUpdate': laterHidden = true; $('update').hidden = true; break;
      case 'checkUpdate': checkForUpdate(true); break;
      case 'godTap': { const now = Date.now(); godTaps = now - godTapAt < 1500 ? godTaps + 1 : 1; godTapAt = now; if (godTaps >= 7) { godTaps = 0; sheets.unshift(godUnlocked ? { kind: 'god', tab: 'sw' } : { kind: 'godPass' }); render(); } break; }
      case 'godTry': {
        const now = Date.now();
        if (now < godLockUntil) { toast(`Wait ${Math.ceil((godLockUntil - now) / 1000)} seconds.`, true); break; }
        const box = $('godpw');
        if (box && UNM.god.check(box.value)) { godUnlocked = true; godFails = 0; sheets.shift(); sheets.unshift({ kind: 'god', tab: 'sw' }); Sound.sfx('door'); render(); }
        else { godFails += 1; if (godFails >= 3) { godLockUntil = now + 30000; godFails = 0; } if (box) box.value = ''; toast('Nothing happens.', true); }
        break;
      }
      case 'godTab': if (sheets[0] && sheets[0].kind === 'god') { sheets[0].tab = arg; render(); } break;
      case 'god': {
        if (!godUnlocked || !UNM.god[el.dataset.op]) break;
        const val = el.dataset.from ? $(el.dataset.from).value : el.dataset.b;
        const args = [el.dataset.a, val].filter((x) => x !== undefined);
        act(() => UNM.god[el.dataset.op](s, ...args));
        break;
      }
      case 'textsize': prefs.text = arg; savePrefs(); render(); break;
      case 'cb': prefs.cb = !prefs.cb; savePrefs(); render(); break;
      case 'fast': prefs.fast = !prefs.fast; savePrefs(); render(); break;
    }
  });
  document.addEventListener('change', (e) => {
    const el = e.target;
    if (el.dataset.act === 'job') act(() => UNM.assignJob(s, el.dataset.arg, el.value || null));
    if (el.dataset.act === 'squad') {
      const m = s.missions.find((x) => x.id === el.dataset.mission);
      const squad = el.checked ? [...m.squad, el.dataset.arg] : m.squad.filter((id) => id !== el.dataset.arg);
      act(() => UNM.setSquad(s, m.id, squad));
    }
    if (el.dataset.act === 'gear') {
      if (el.value !== '__keep') act(() => UNM.equipGear(s, el.dataset.arg, el.value || null));
    }
    if (el.dataset.act === 'godrole' && godUnlocked) act(() => UNM.god.setRole(s, el.dataset.arg, el.value));
    if (el.dataset.act === 'setupopt') { setup[el.dataset.arg] = el.checked; }
    if (el.dataset.act === 'raidpick') {
      raidPick = el.checked ? [...raidPick, el.dataset.arg].slice(0, 6) : raidPick.filter((id) => id !== el.dataset.arg);
      render();
    }
    if (el.dataset.act === 'pref') {
      prefs.res = el.checked ? [...prefs.res, el.dataset.arg] : prefs.res.filter((k) => k !== el.dataset.arg);
      prefs.res.sort((a, b) => Object.keys(RES_META).indexOf(a) - Object.keys(RES_META).indexOf(b));
      savePrefs(); renderTop();
    }
  });
  document.addEventListener('input', (e) => {
    const el = e.target.closest && e.target.closest('[data-vol]');
    if (!el) return;
    prefs[el.dataset.vol] = Number(el.value); savePrefs(); applyPrefs();
    const out = el.parentElement.querySelector('output'); if (out) out.textContent = `${el.value}%`;
    if (el.dataset.vol === 'vSfx') Sound.sfx('click');
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target && e.target.id === 'godpw') { e.preventDefault(); const b = document.querySelector('[data-act="godTry"]'); if (b) b.click(); } });
  $('phaseBtn').addEventListener('click', () => {
    if (sheets.length) return;
    if (s.battle) { openBattle(); return; }
    if (s.phase === 'morning') { sheets.push({ kind: 'depart' }); render(); }
    else if (s.phase === 'evening') { const res = UNM.endEvening(s); if (res && res.raid) raidAlert(); else afterChange(); }
    else if (s.phase === 'night' && s.pendingRaid) raidAlert();
  });
  $('pilot').addEventListener('click', () => speak(pilotSays()));
  $('bubble').addEventListener('click', () => ($('bubble').hidden = true));
  $('settingsBtn').addEventListener('click', () => { sheets.unshift({ kind: 'settings' }); render(); });
  $('scrim').addEventListener('click', () => { const sh = sheets[0]; if (sh && ['settings', 'menuSettings', 'credits', 'install', 'namesign', 'confirmNew', 'depart', 'role', 'confirm', 'help', 'god', 'godPass'].includes(sh.kind) || (sh && sh.kind === 'setup' && sh.closable)) { sheets.shift(); render(); } });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { const sh = sheets[0]; if (sh && ['settings', 'menuSettings', 'credits', 'install', 'namesign', 'confirmNew', 'depart', 'role', 'confirm', 'help', 'god', 'godPass'].includes(sh.kind) || (sh && sh.kind === 'setup' && sh.closable)) { sheets.shift(); render(); } } });

  // Audio may only start after a tap or key press.
  const wake = () => { Sound.setEnabled('music', prefs.music); Sound.setEnabled('sfx', prefs.sfx); Sound.init(); };
  window.addEventListener('pointerdown', wake, { passive: true });
  window.addEventListener('keydown', wake);

  // ---------- boot (keeps the game across live updates of the page) ----------
  function start(data) {
    menuEl = document.createElement('div'); menuEl.className = 'menu'; menuEl.id = 'menu'; menuEl.hidden = true;
    $('app').appendChild(menuEl);
    const resume = data && data.state && data.slot != null;
    s = resume ? data.state : UNM.newGame(7);
    if (!resume) UNM.skipTutorial(s);
    slot = resume ? data.slot : null;
    seenNight = s.day; // don't replay last night's report on reload
    panelOpen = window.innerWidth >= 900;
    scene = Scene.create($('cutaway'), {
      onTap(target) {
        if (target.kind === 'none') { sel = null; render(); return; }
        sel = target; tab = 'room'; panelOpen = true;
        if (target.kind === 'room') {
          const room = s.rooms.find((r) => r.id === target.id);
          if (room && room.type === 'sealed_door' && s.trust.level < 3) speak('That? Load-bearing door. Very load-bearing. Let us talk about the generator instead.', 'warn');
        }
        render();
      },
    });
    if (resume) {
      lastStep = s.tutorial.step;
      queueAutoSheets();
      render();
      if (s.battle) openBattle();
      else if (s.phase === 'night' && s.pendingRaid) raidAlert();
      else if (s.phase === 'night') { UNM.finishNight(s); afterChange(); }
    } else { render(); openMenu(); Brand.splash(); }
    Brand.setFavicon();
    setupUpdates();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (!menuOpen) render(); });
    window.claude?.hot?.snapshot?.(() => ({ state: menuOpen ? null : s, slot }));
    // test hook: start slot 1 straight away, no menu, no story
    window.__unmQuick = (o = {}) => { setup = { ...setup, difficulty: o.difficulty || 'standard', ironman: !!o.ironman, tutorial: o.tutorial !== false, saveName: o.name || 'Quick' }; try { localStorage.removeItem(SLOT_KEY(0)); } catch (e) { /* ignore */ } sheets = []; const keep = Cine.play; Cine.play = (cb) => cb && cb(); beginNew(0); Cine.play = keep; };
    window.__unmSelect = (id) => { sel = { kind: 'room', id }; tab = 'room'; panelOpen = true; render(); }; // test hook
  }
  window.claude?.hot?.ready ? window.claude.hot.ready(start) : start(window.claude?.hot?.data ?? {});
})();
