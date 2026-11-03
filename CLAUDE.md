# Under New Management: notes for Claude Code

A post-apocalyptic waystation management game with XCOM-style hex tactics, by Burnt Pixel Studios (Ryan).
Vanilla JavaScript + Canvas 2D, no framework and no npm dependencies. Everything is concatenated into one
self-contained HTML file by `build.py`, plus an installable PWA copy.

The full game design (vision, systems, roadmap, open decisions) is in `docs/DESIGN.md`. Read the
relevant section before changing a system.

## Build and run

```bash
python3 build.py                 # -> dist/under-new-management.html (single file)
                                 #    dist/preview.html (local test wrapper)
                                 #    dist/pwa/ (index.html, manifest, sw.js, icons) - host this folder over https to install
python3 -m http.server -d dist/pwa 8765   # play the installable copy at http://localhost:8765
```

`dist/` is generated and git-ignored. Never hand-edit it.

`build.py` concatenates `src/shell.html` + `src/style.css` + these scripts **in this order** (globals
depend on it): `rules.js, tactics.js, god.js, audio.js, paint.js, sprites.js, structures.js, furniture.js,
render.js, battle.js, dropdown.js, cinematic.js, brand.js, ui.js`. A new source file must be added
to the list in `build.py`.

## Source map

| File | What it holds |
|---|---|
| `src/rules.js` | `UNM`: all game rules and content. Pure: no DOM, no canvas. Seeded RNG in `state.rng`; content ids are append-only (saves reference them). `newGame`, `serialize`/`deserialize` (with migrations), tutorial steps (`TUTORIAL`), economy, crew, missions, warlords, raids, tech tree, story. |
| `src/tactics.js` | `TAC`: hex battle rules (pure): movement, cover, line of sight, hit chance, abilities, enemy AI. |
| `src/god.js` | `UNM.god`: hidden developer tools ("god mode"). Unlocked by tapping the footer line in in-game Settings 7 times and entering the passphrase (SHA-256 checked, session-only unlock; a courtesy lock, not security). Flags live in `s.god` and are read by `rules.js` (free build, infinite resources, no game over, forced raid) and `tactics.js` via `TAC.god` (invincible, sure hit, one-hit). Operations return `null` or an error string like the rest of `UNM`. Tested by `test/god.cjs`. |
| `src/battle.js` | `Battle`: tactics screen: canvas renderer, camera/fit (`hudSpace()`, `fit()`), HUD, input. |
| `src/render.js` | Base cutaway scene renderer (rooms, sky, earth, people walking). |
| `src/sprites.js` | `Art`: procedural SVG -> pixelized sprites for people/animals; `Art.portrait()` hand-placed 48x48 front-facing pixel portraits. |
| `src/paint.js`, `structures.js`, `furniture.js` | Procedural painting of buildings, rooms and furniture. |
| `src/ui.js` | Interface: top bar, side drawer, sheets (modals), Pilot Light (the tutorial guide), main menu with 3 save slots, confirm dialogs, install sheet. Clicks are delegated through `data-act` attributes handled in one big `switch`. |
| `src/dropdown.js` | Replaces every native `<select>` with a themed dropdown (the hidden select stays the value source and still fires `change`). |
| `src/cinematic.js` | `Cine`: the 8-card illustrated opening story (`CARDS`, `SCENES`). |
| `src/brand.js` | `Brand`: Burnt Pixel Studios splash, app icon art (`ICON_PICK = 'C'` is the approved icon), favicon. |
| `src/audio.js` | `Sound`: synthesized sound effects and music (Web Audio, no files). |
| `src/style.css` | All styles. Responsive blocks at the end: phone portrait, short landscape (`max-height: 560px`), Fold inner screen / tablets. |
| `assets/icons/` | Committed app icon PNGs. Regenerate with `python3 tools/make_icons.py [A|B|C]` (needs Playwright). |

## Updates and accessibility

- `build.py` writes a build id into the PWA (`window.__BUILD`) and a `sw.js` whose cache name changes per build. A new
  service worker installs quietly and **waits**; `ui.js` (`setupUpdates`) shows the "Update now" banner and the Settings row,
  and `applyUpdate` posts `SKIP_WAITING` then reloads. Do not add `skipWaiting()` back to the install handler.
- All display/motion/sound options are `prefs` keys applied by `applyPrefs()` as body classes (`text-xxl`, `font-easy`, `hc`,
  `still`, `big-touch`, `focus-strong`, `space-loose`, `cb`) with their CSS in the "accessibility options" block of `style.css`.
  New options go through the `seg()` / `tog()` helpers in `accessHtml()`.

## Saves

`localStorage` keys `unm-slot-0..2` (one per menu slot) and `unm-day-N` (start-of-day snapshot for
retry). Legacy `unm-save-v1` is migrated into slot 0. Any change to the state shape needs a
migration in `UNM.deserialize` so existing players' saves still load.

## Tests

```bash
node test/sim.cjs        # long multi-seed campaign simulations (expects "fails 0")
node test/tac.cjs        # tactics rules
node test/raid.cjs       # base raids
node test/abil.cjs       # role abilities
node test/politics.cjs   # warlords
node test/story.cjs      # story events
node test/god.cjs        # god mode
node test/tech.cjs       # tech tree (some "could not place" lines are known and pre-existing)
node test/balance.cjs    # balance report

pip install playwright && python3 -m playwright install chromium
python3 build.py && python3 test/setupui.py   # browser UI tests: setupui, battle, raidui, politicsui, plansui, storyui, roles, updateui (update banner, accessibility, god mode), godbattle
```

UI tests drive `dist/preview.html` and write screenshots to `shots/` (git-ignored). Set `CHROME=/path/to/chrome`
to use a system browser instead of Playwright's. Test hooks exposed by the game:
`window.__unmQuick(opts)` (start a game in slot 0, skipping the menu and story), `window.__unmSelect(id)`,
and `window.__unm = { s, UNM, sel, TAC, Battle, Sound, scene }`.

Run the node tests and at least `setupui.py` + `battle.py` before shipping a change.

## Conventions

- Rules stay pure (no DOM in `rules.js` / `tactics.js`) so the node tests can run them.
- Player-facing text is plain, warm and short; Pilot Light speaks in a dry, kind voice. No browser-native
  UI (selects, alerts, confirms): use the themed dropdown and the `askConfirm()` sheet.
- Spend actions (build, repair, upgrade, demolish, dig, research) always go through `askConfirm()`.
- Art is procedural pixel art; keep `image-rendering: pixelated` for sprites and draw portraits at integer scale.
- Must work in portrait and landscape, phones (including Galaxy Z Fold cover ~360x840 and inner ~840x757
  screens) and tablets, with touch targets of at least ~40px. Check the responsive blocks at the end of `style.css`.

## Where things stand (Nov 2026)

The game is feature complete for v1. Remaining work:

1. **Hosting**: deploy `dist/pwa` (the included GitHub Pages workflow does this on every push to `main`).
   Installing as an app needs https, which Pages provides.
2. **Google Play**: wrap the hosted PWA as a Trusted Web Activity (Bubblewrap / PWABuilder), add
   `/.well-known/assetlinks.json`, store listing, screenshots.
3. **Offline fonts**: fonts load from Google Fonts in `src/shell.html`; self-host them under `assets/` so the
   installed app looks right offline.
4. Real-device playtesting (Fold 7, tablets, iOS Safari), balance passes, music polish.
5. Held for later DLC: a mutated faction and the return of the Elite (see `docs/DESIGN.md`).
