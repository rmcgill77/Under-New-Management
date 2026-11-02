// ============================================================================
// Sound: procedural music and effects with Web Audio (no audio files).
// The score is a wasteland: wind over open ground, a slow drone, and a lone
// slide guitar (Karplus-Strong strings rendered once into buffers) playing
// sparse phrases into a long desert reverb. Battles add frame drums and
// clanking metal; nights add crackling fire and the odd far-off howl.
// Starts on the first tap.
// ============================================================================
const Sound = (() => {
  let ac = null, master, musicBus, sfxBus, verb, verbIn, noise, timer = 0;
  let enabled = { music: true, sfx: true };
  let mood = 'morning', nextT = 0, step = 0, phrase = [], rest = 0;
  let wind = null, drone = null;
  const MUSIC_LEVEL = 0.3, SFX_LEVEL = 0.55;
  const vol = { music: 1, sfx: 1 };
  // root: tonic (MIDI); beat: seconds per step; play: chance a phrase starts on a free step;
  // wind/drone: bed levels; drums: battle pulse; fire: night crackle
  const MOODS = {
    morning: { root: 52, beat: 0.42, play: 0.22, wind: 0.05, drone: 0.018, bright: 3200 },
    midday: { root: 52, beat: 0.4, play: 0.2, wind: 0.07, drone: 0.014, bright: 3600 },
    evening: { root: 50, beat: 0.48, play: 0.28, wind: 0.05, drone: 0.022, bright: 2600 },
    night: { root: 47, beat: 0.56, play: 0.16, wind: 0.08, drone: 0.026, bright: 1800, fire: true },
    battle: { root: 45, beat: 0.34, play: 0.16, wind: 0.035, drone: 0.03, bright: 2400, drums: true },
    raid: { root: 43, beat: 0.3, play: 0.14, wind: 0.04, drone: 0.034, bright: 2200, drums: true, metal: true },
    vault: { root: 46, beat: 0.62, play: 0.12, wind: 0.02, drone: 0.04, bright: 1400, eerie: true },
  };
  // minor pentatonic with a flat second for colour (the Ennio note)
  const SCALE = [0, 3, 5, 7, 10, 12, 15, 17];
  const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);

  function init() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      master = ac.createGain(); master.gain.value = 0.85;
      const comp = ac.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 3;
      master.connect(comp).connect(ac.destination);
      musicBus = ac.createGain(); musicBus.gain.value = enabled.music ? MUSIC_LEVEL * vol.music : 0; musicBus.connect(master);
      sfxBus = ac.createGain(); sfxBus.gain.value = enabled.sfx ? SFX_LEVEL * vol.sfx : 0; sfxBus.connect(master);
      noise = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
      const d = noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      // a long, dark desert reverb from shaped noise
      verb = ac.createConvolver(); verb.buffer = impulse(3.2, 2.6);
      verbIn = ac.createGain(); verbIn.gain.value = 1;
      const vf = ac.createBiquadFilter(); vf.type = 'lowpass'; vf.frequency.value = 3800;
      verbIn.connect(verb).connect(vf).connect(musicBus);
      nextT = ac.currentTime + 0.3;
      startBeds();
      timer = setInterval(schedule, 120);
      document.addEventListener('visibilitychange', () => { if (!ac) return; document.hidden ? ac.suspend() : ac.resume(); });
    } catch (e) { ac = null; }
  }
  function impulse(sec, decay) {
    const len = Math.floor(ac.sampleRate * sec), b = ac.createBuffer(2, len, ac.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); let lp = 0; for (let i = 0; i < len; i++) { lp += (Math.random() * 2 - 1 - lp) * 0.35; d[i] = lp * Math.pow(1 - i / len, decay); } }
    return b;
  }

  // ---------- beds: wind and drone ----------
  function startBeds() {
    if (!ac) return;
    const m = MOODS[mood] || MOODS.morning, now = ac.currentTime;
    if (!wind) {
      // two layers of moving air: a broad rush and a thin whistle, each gusting on its own slow cycle
      const mk = (type, freq, q, lfoRate, lfoDepth) => {
        const src = ac.createBufferSource(); src.buffer = noise; src.loop = true;
        const f = ac.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
        const g = ac.createGain(); g.gain.value = 0.0001;
        const lfo = ac.createOscillator(), lg = ac.createGain(); lfo.frequency.value = lfoRate; lg.gain.value = lfoDepth; lfo.connect(lg).connect(f.frequency); lfo.start();
        const gl = ac.createOscillator(), gg = ac.createGain(); gl.frequency.value = lfoRate * 0.7; gg.gain.value = 0.5; gl.connect(gg);
        const amp = ac.createGain(); amp.gain.value = 0.6; gg.connect(amp.gain); gl.start();
        src.connect(f).connect(amp).connect(g).connect(musicBus); src.start();
        return { g, base: 1 };
      };
      wind = [mk('bandpass', 420, 0.6, 0.05, 260), mk('bandpass', 1500, 9, 0.031, 700)];
      wind[1].base = 0.35;
    }
    for (const w of wind) { w.g.gain.cancelScheduledValues(now); w.g.gain.setTargetAtTime(m.wind * w.base, now, 2); }
    // the drone: two low sines a fifth apart breathing in and out, plus a bowed-metal shimmer
    const old = drone;
    const g = ac.createGain(); g.gain.value = 0.0001;
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 600;
    const oscs = [[m.root - 24, 'sine', 1], [m.root - 17, 'sine', 0.5], [m.root - 12.04, 'triangle', 0.18]].map(([n, type, lv]) => { const o = ac.createOscillator(); o.type = type; o.frequency.value = hz(n); const og = ac.createGain(); og.gain.value = lv; o.connect(og).connect(lp); o.start(); return o; });
    const swell = ac.createOscillator(), sg = ac.createGain(); swell.frequency.value = 0.045; sg.gain.value = m.drone * 0.5; swell.connect(sg).connect(g.gain); swell.start();
    lp.connect(g); g.connect(musicBus); g.connect(verbIn);
    g.gain.setTargetAtTime(m.drone, now, 2.5);
    drone = { g, oscs: [...oscs, swell] };
    if (old) { old.g.gain.cancelScheduledValues(now); old.g.gain.setTargetAtTime(0.0001, now, 1.2); setTimeout(() => { try { old.oscs.forEach((o) => o.stop()); } catch (e) { /* gone */ } }, 5000); }
  }

  // ---------- the guitar: Karplus-Strong strings, rendered once per note ----------
  const strings = new Map();
  function stringBuf(midi, bright = 0.5) {
    const key = `${midi}|${bright}`;
    if (strings.has(key)) return strings.get(key);
    const sr = ac.sampleRate, f = hz(midi), len = Math.floor(sr * 3.2), N = Math.max(2, Math.round(sr / f));
    const b = ac.createBuffer(1, len, sr), d = b.getChannelData(0), line = new Float32Array(N);
    // excite with a pick-shaped burst: bright noise, a little low-passed
    let lp = 0;
    for (let i = 0; i < N; i++) { lp += ((Math.random() * 2 - 1) - lp) * (0.35 + bright * 0.5); line[i] = lp; }
    let idx = 0, prev = 0;
    const loss = 0.9965 - (midi > 64 ? (midi - 64) * 0.0004 : 0);
    for (let i = 0; i < len; i++) {
      const cur = line[idx];
      const next = loss * (0.5 * cur + 0.5 * prev);
      prev = cur; line[idx] = next; d[i] = cur; idx = (idx + 1) % N;
    }
    // a touch of body resonance: soften the very top and fade the tail cleanly
    for (let i = len - 2000; i < len; i++) d[i] *= (len - i) / 2000;
    strings.set(key, b);
    return b;
  }
  // slide: start a little flat and glide up, like a bottleneck on a steel string
  function guitar(t, midi, vel, { slide = 0, len = 3, pan = 0, verbAmt = 0.55, bright } = {}) {
    const m = MOODS[mood] || MOODS.morning;
    const src = ac.createBufferSource(); src.buffer = stringBuf(midi, 0.55);
    if (slide) { src.playbackRate.setValueAtTime(Math.pow(2, -slide / 12), t); src.playbackRate.exponentialRampToValueAtTime(1, t + 0.09 + slide * 0.03); }
    // gentle vibrato after the attack
    const vib = ac.createOscillator(), vg = ac.createGain(); vib.frequency.value = 5.2; vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(0.004, t + 0.6); vib.connect(vg).connect(src.playbackRate); vib.start(t); vib.stop(t + len);
    const tone = ac.createBiquadFilter(); tone.type = 'peaking'; tone.frequency.value = 2400; tone.Q.value = 1.2; tone.gain.value = 5;
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = bright || m.bright;
    const g = ac.createGain(); g.gain.setValueAtTime(vel, t); g.gain.setTargetAtTime(0.0001, t + len * 0.7, len * 0.15);
    const p = ac.createStereoPanner ? ac.createStereoPanner() : null;
    src.connect(tone).connect(lp).connect(g);
    if (p) { p.pan.value = pan; g.connect(p).connect(musicBus); } else g.connect(musicBus);
    const send = ac.createGain(); send.gain.value = verbAmt; g.connect(send).connect(verbIn);
    src.start(t); src.stop(t + len + 0.1);
  }
  // a slow strum of the low open strings to mark the bar
  function strum(t, root, vel) {
    [0, 7, 12, 15].forEach((iv, i) => guitar(t + i * 0.045, root - 12 + iv, vel * (1 - i * 0.15), { len: 4, pan: -0.2 + i * 0.12, verbAmt: 0.7, bright: 1600 }));
  }

  // ---------- percussion and texture ----------
  function drum(t, vel, pitch = 70) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.frequency.setValueAtTime(pitch * 1.8, t); o.frequency.exponentialRampToValueAtTime(pitch, t + 0.12);
    g.gain.setValueAtTime(vel, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
    const src = ac.createBufferSource(), f = ac.createBiquadFilter(), ng = ac.createGain();
    src.buffer = noise; f.type = 'lowpass'; f.frequency.value = 500; ng.gain.setValueAtTime(vel * 0.5, t); ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
    o.connect(g); src.connect(f).connect(ng);
    for (const n of [g, ng]) { n.connect(musicBus); const s = ac.createGain(); s.gain.value = 0.3; n.connect(s).connect(verbIn); }
    o.start(t); o.stop(t + 0.65); src.start(t, Math.random()); src.stop(t + 0.2);
  }
  function clank(t, vel) {
    // struck scrap metal: inharmonic partials ringing out
    [1, 2.76, 5.4, 8.93].forEach((r, i) => {
      const o = ac.createOscillator(), g = ac.createGain(); o.type = 'sine'; o.frequency.value = 180 * r * (0.95 + Math.random() * 0.1);
      g.gain.setValueAtTime(vel / (i + 1.5), t); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4 / (i + 1));
      o.connect(g); g.connect(musicBus); const s = ac.createGain(); s.gain.value = 0.8; g.connect(s).connect(verbIn); o.start(t); o.stop(t + 1.5);
    });
  }
  function crackle(t) {
    for (let i = 0; i < 4; i++) { const tt = t + Math.random() * 0.4, src = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain(); src.buffer = noise; f.type = 'highpass'; f.frequency.value = 2500 + Math.random() * 3000; g.gain.setValueAtTime(0.05 + Math.random() * 0.08, tt); g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.02); src.connect(f).connect(g).connect(musicBus); src.start(tt, Math.random()); src.stop(tt + 0.03); }
  }
  function howl(t) {
    // something far off, calling: a gliding, wavering voice drowned in reverb
    const o = ac.createOscillator(), g = ac.createGain(), vib = ac.createOscillator(), vg = ac.createGain();
    o.type = 'triangle'; o.frequency.setValueAtTime(420, t); o.frequency.linearRampToValueAtTime(760, t + 0.7); o.frequency.linearRampToValueAtTime(640, t + 2.2); o.frequency.linearRampToValueAtTime(380, t + 3);
    vib.frequency.value = 6; vg.gain.value = 14; vib.connect(vg).connect(o.frequency);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.025, t + 0.5); g.gain.exponentialRampToValueAtTime(0.0001, t + 3);
    const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1500;
    o.connect(f).connect(g); const s = ac.createGain(); s.gain.value = 2.5; g.connect(s).connect(verbIn); g.connect(musicBus);
    o.start(t); vib.start(t); o.stop(t + 3.1); vib.stop(t + 3.1);
  }

  // ---------- the score ----------
  // A phrase is a handful of notes walking the scale, often ending on a long held note.
  function newPhrase(m) {
    const n = 3 + Math.floor(Math.random() * 4), out = [];
    let deg = Math.floor(Math.random() * 5);
    for (let i = 0; i < n; i++) {
      deg = Math.max(0, Math.min(SCALE.length - 1, deg + [-2, -1, -1, 1, 1, 2][Math.floor(Math.random() * 6)]));
      const last = i === n - 1;
      out.push({ midi: m.root + 12 + SCALE[deg], hold: last ? 4 : Math.random() < 0.3 ? 2 : 1, slide: Math.random() < (last ? 0.7 : 0.25) ? 1 + Math.floor(Math.random() * 2) : 0 });
    }
    return out;
  }
  function schedule() {
    if (!ac || !enabled.music) { if (ac) nextT = ac.currentTime + 0.2; return; }
    const m = MOODS[mood] || MOODS.morning;
    while (nextT < ac.currentTime + 0.5) {
      const t = nextT;
      if (step % 32 === 0) strum(t, m.root, m.drums ? 0.16 : 0.12);
      if (rest > 0) rest -= 1;
      else if (phrase.length) {
        const n = phrase.shift();
        guitar(t, n.midi, 0.2 + Math.random() * 0.06, { slide: n.slide, len: 1.4 + n.hold * 0.7, pan: (Math.random() - 0.5) * 0.4 });
        if (n.hold > 2 && Math.random() < 0.35) guitar(t + 0.02, n.midi - 5, 0.1, { len: 3, pan: 0.2 });
        rest = n.hold - 1;
        if (!phrase.length) rest += 6 + Math.floor(Math.random() * 10);
      } else if (Math.random() < m.play) phrase = newPhrase(m);
      if (m.drums) {
        const s = step % 16;
        if (s === 0 || s === 10) drum(t, 0.4, 62);
        else if (s === 6 || s === 13) drum(t, 0.18, 96);
        else if (s === 8 && Math.random() < 0.6) drum(t, 0.12, 120);
        if (m.metal && s === 4 && Math.random() < 0.4) clank(t, 0.05);
      }
      if (m.fire && Math.random() < 0.25) crackle(t);
      if ((m.fire || m.eerie) && Math.random() < 0.006) howl(t);
      if (m.eerie && step % 24 === 12) clank(t, 0.03);
      step += 1;
      nextT += m.beat * (0.94 + Math.random() * 0.12);
    }
  }

  // ---------- effects ----------
  function burst(t, dur, type, freq, vel, q = 0.8, wet = 0) {
    const src = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    src.buffer = noise; f.type = type; f.frequency.value = freq; f.Q.value = q;
    g.gain.setValueAtTime(vel, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(sfxBus); src.start(t, Math.random() * 1.5); src.stop(t + dur + 0.02);
    if (wet) { const s = ac.createGain(); s.gain.value = wet; g.connect(s).connect(verbIn); }
  }
  function tone(t, f0, f1, dur, type, vel, wet = 0) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(vel, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(sfxBus); o.start(t); o.stop(t + dur + 0.02);
    if (wet) { const s = ac.createGain(); s.gain.value = wet; g.connect(s).connect(verbIn); }
  }
  function sfx(name) {
    if (!ac || !enabled.sfx) return;
    const t = ac.currentTime + 0.01;
    switch (name) {
      // a rifle crack with a body and an echo off the ruins
      case 'shot': burst(t, 0.05, 'highpass', 2500, 0.7); burst(t, 0.25, 'lowpass', 1200, 0.6, 0.8, 0.5); tone(t, 140, 45, 0.22, 'sine', 0.55); break;
      case 'hit': burst(t, 0.09, 'bandpass', 700, 0.45, 1.5); tone(t, 180, 70, 0.12, 'sine', 0.3); break;
      case 'miss': burst(t, 0.25, 'bandpass', 3200, 0.16, 6); burst(t + 0.05, 0.3, 'lowpass', 500, 0.12); break;
      case 'bite': burst(t, 0.12, 'bandpass', 450, 0.45, 2); burst(t + 0.05, 0.1, 'bandpass', 900, 0.25, 3); break;
      case 'down': burst(t, 0.35, 'lowpass', 260, 0.45); tone(t, 110, 55, 0.4, 'sine', 0.3, 0.3); break;
      case 'wreck': burst(t, 1.2, 'lowpass', 380, 0.7, 0.8, 0.6); tone(t, 80, 28, 1, 'sine', 0.5); clank(t + 0.15, 0.06); break;
      case 'alarm': for (let i = 0; i < 3; i++) { clank(t + i * 0.5, 0.09); } break;
      case 'alert': tone(t, 660, 990, 0.1, 'triangle', 0.08, 0.4); break;
      case 'click': burst(t, 0.03, 'bandpass', 2400, 0.18, 4); break;
      case 'build': for (let i = 0; i < 3; i++) { burst(t + i * 0.15, 0.05, 'bandpass', 1600, 0.4, 3); clank(t + i * 0.15, 0.02); } break;
      case 'heal': guitar(t, 76, 0.12, { len: 1.6, verbAmt: 0.8 }); guitar(t + 0.12, 83, 0.1, { len: 1.6, verbAmt: 0.8 }); break;
      case 'door': tone(t, 60, 45, 2.5, 'sawtooth', 0.1, 0.5); burst(t, 2.4, 'lowpass', 300, 0.25, 0.8, 0.6); break;
      case 'win': [64, 67, 71, 76].forEach((n, i) => guitar(t + i * 0.18, n, 0.16, { len: 2.5, slide: i === 3 ? 1 : 0, verbAmt: 0.8 })); break;
    }
  }

  function setMood(m) {
    if (m === mood) return;
    mood = m; phrase = []; rest = 2;
    if (ac) startBeds();
  }
  function setEnabled(kind, on) {
    enabled[kind] = on;
    if (!ac) return;
    const bus = kind === 'music' ? musicBus : sfxBus;
    bus.gain.setTargetAtTime(on ? (kind === 'music' ? MUSIC_LEVEL : SFX_LEVEL) * vol[kind] : 0, ac.currentTime, 0.2);
  }
  // Volume sliders: v is 0..1 and scales that bus on top of the on/off switch.
  function setVolume(kind, v) { vol[kind] = Math.max(0, Math.min(1, v)); setEnabled(kind, enabled[kind]); }
  return { init, sfx, setMood, setEnabled, setVolume, get started() { return !!ac; } };
})();
