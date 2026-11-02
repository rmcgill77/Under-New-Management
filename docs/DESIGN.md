# Under New Management: Phased Game Plan

Oct 31, 2026 · @Ryan

## Vision and pillars

Under New Management is a post-apocalyptic management game. You lead a roadside outpost that works as a motel for travelers above ground and a launch base for field teams below it, surrounded by bandit warlords you can bargain with, scheme against, or fight. It pairs an XCOM 2 style home base and squad with Fallout Shelter style building, and XCOM style turn-based combat in the field.

- **Base:** a 2D layered side-view cutaway that you build up over time. Up top is a motel and rest stop where traders, travelers and the occasional friendly bandit eat, drink water and rest. Below ground is the operations side, where teams prepare for and return from jobs.
- **Time:** day phases, not a continuous clock, so you always have time to decide.
- **At the waystation:** you assign people to jobs and build up the base.
- **In the field:** XCOM style turn-based missions for combat, gathering salvage to keep the waystation running, and rescues.
- **Recruiting:** people passing through up top can be recruited onto your team.
- **Pressure:** four to five bandit warlords, each holding territory that touches the waystation. You can negotiate with them, conspire against them with others, or oppose all of them, and any of them can raid you. Upkeep adds a second, steadier pressure.
- **Tone:** cozy but gritty survival with small-community warmth.
- **Art:** clearly defined illustrated art, not blocky or angular. Music and sound should clearly fit the tone.
- **Platforms:** mobile first, desktop second. It must play on a monitor, a tablet and a phone, including a Galaxy Z Fold 7 open and closed.
- **Delivery:** browser-hosted on GitHub first, then the Google Play Store only for now (not the Apple App Store, no Steam). Ironman mode is added near the end.

## Backstory and opening

The world ended over 300 years ago, and nobody knows exactly how. Some say an alien invasion, others nuclear war, others overpopulation and lost resources. One thing is certain: the elite left Earth on a space station that has been lost to the void ever since. The people left behind found ways to survive and began to rebuild, but not always for humanity's good. As towns and villages rose, so did warlords striving to rule the wastelands. Most people now live under one warlord or another.

Very few people run waystations, the intersections of the trade routes where common folk and bandits alike can still find respite. Warlords either try to convince waystation owners to side with them or take the waystation by force.

- **The player:** inherits a waystation from a distant relative by courier. With little else going for them, and bandit life being awful, they decide to run it.
- **Arrival:** the waystation is in ruins, and the relative's last team greets the player at the bar.
- **Tutorial:** it covers running the waystation above and below ground, then an intro mission that teaches combat. One previous team member always dies in that mission, which forces the player to hire a new recruit to refill the team. Hiring them ends the tutorial.
- **Later factions:** a mutated faction and the return of the elites are planned as DLC, after the game is complete.

## Warlords and the wastes

The wastes are not inherently hostile. Most people on the road are just trying to get by, and the waystation lives off them.

- **Warlords:** every new game generates four to five different warlords, each holding territory that touches the waystation. At least one is always aggressive, and at least one is always friendlier than the others.
- **Your stance:** negotiate with them, conspire against them with others, or oppose all of them.
- **Raids:** bandits raid the waystation only occasionally, more often from aggressive warlords.
- **Weary travelers:** people looking for work who can be recruited onto your team.
- **People passing through:** they stay and spend at the motel and bar, giving passive income.
- **Generation:** a seeded generator builds each warlord's temperament, territory, resources and demands. A pure rules module enforces the two guarantees (one aggressive, one friendlier) and is covered by tests.

### How warlords work

Every warlord is built from the same traits, so each game has a different cast under the same rules.

- **Temperament:** aggressive, friendly, scheming, or neutral, within the two guarantees above.
- **Territory and resource:** each holds something you need or want, such as water, fuel, food, salvage routes, or recruits.
- **Wants:** tribute, protection, a safe place for their people to rest, or a pledge of loyalty.
- **Raid style:** frontal assault, sabotage of generators or water, theft, or a siege of the gates.
- **Rivalries:** who they hate or trust among the other warlords, which is what makes conspiring possible.
- **Relationship meter:** your actions move it, and raid frequency and strength follow it.

**Your options.** Negotiate for trade, safe passage, tribute, or alliance. Conspire with one warlord against another, paying favors they will later collect. Or oppose everyone and rely on your walls, watchtowers, and teams.

**Elimination and succession.** Warlords can be eliminated, which frees their territory for a time. After a while a new warlord takes their place, so the game keeps four to five. The two guarantees always hold: at least one aggressive warlord and at least one friendlier than the rest, so a replacement is chosen to keep them true.

**Visitors follow relationships.** A warlord's own people are among your visitors and recruits, so a warlord you anger sends fewer travelers and one you befriend sends more.

**Example archetypes** for the generator to mix and match:

- **The Tollkeeper:** controls a route, wants tribute, raids by cutting your supply.
- **The Zealot:** aggressive, attacks head-on, hates the Tollkeeper.
- **The Host:** friendly, rich in food and visitors, but wants protection in return.
- **The Schemer:** friendly on the surface, offers conspiracies, may betray you.

## Base rooms

Above ground is the motel and its defenses.

- Guest rooms for a single night or an extended stay.
- Entertainment area where patrons eat and drink while gambling or watching a live show.
- Walls and watchtowers to protect the waystation.
- Ideas to consider: a gate and checkpoint, a vehicle and animal yard, a bathhouse.

Below ground is the operations side.

- Generator rooms and water pump rooms.
- Food-producing rooms.
- Team management.
- Crew rooms, each with two bunk beds that sleep two each.
- Clinic.
- Ideas to consider: barracks, armory and loadout, salvage intake and workshop, storage.

## Building the waystation

- **Starting state:** the waystation begins in ruins with most rooms broken. A few can be repaired for free at first, as part of the tutorial.
- **Placement:** the player chooses which room goes where.
- **Size limit:** the base has a size limit, but it is large.
- **Tech tree:** room upgrades follow a tech tree rather than a fixed order.
- **Damage:** rooms can be damaged or destroyed in raids, and they can be repaired.
- **Costs:** building and upgrading cost silver buttons and salvage and take days to complete. Each room has a running cost, and upgrades raise both output and that cost.
- **Dependencies:** rooms rely on each other, for example pumps need power and food production needs water.

### Tech tree branches (draft)

Six branches, each with rooms that improve in tiers. This is a first draft to react to.

| Branch | Where | Rooms and tiers | What it unlocks |
| --- | --- | --- | --- |
| Hospitality | Above ground | Guest rooms (cot, private room, suite), bar and kitchen, entertainment area (gambling, then a live stage), bathhouse | More patrons, higher income, extended stays, more travelers and recruits |
| Defense | Above ground | Walls (patched, reinforced), watchtowers, gate and checkpoint, turret emplacements | Better raid maps, defensive positions, early warning of raids |
| Power and water | Below ground | Generators (fuel, then renewable), water pumps, purifier, storage tanks | Power and clean water for every other room, and a larger base |
| Food | Below ground | Food-producing rooms (basic, then larger yields), cold storage | Feeds crew and patrons, and supports a bigger team |
| Crew and operations | Below ground | Crew rooms, team management, clinic (basic, then advanced), armory and loadout, workshop | More crew, faster healing, better gear, and tech for the Tinker's robots and turrets |
| Diplomacy | Above ground | Messenger post, meeting hall, informant network | Better dealings with warlords: stronger negotiation, intelligence for conspiring, and warning of their moves |

## Day phases

A day has four phases. The game waits for the player in each, so there is always time to decide.

1. **Morning.** See who arrived overnight, check supplies and warlord messages, and assign jobs. It ends only when the player presses a button, which leads into choosing whether to send a team on a mission.
2. **Midday.** Teams travel to their mission site and play the mission. Production and income continue at the waystation.
3. **Evening.** Teams return with salvage and injuries, patrons fill the entertainment area, and the player recruits travelers. It ends only when the player presses a button.
4. **Night.** Raids and hazards happen here. A raid ends when the raid ends. On a quiet night with no raid, the game skips to the next morning with a short summary, and some quiet nights trigger a small event.

**Raids.** Raids are somewhat random, and their odds and strength depend on warlord relationships. There does not have to be a raid every night.

**Quiet-night events.** Small random happenings such as a late arrival, a visitor asking a favor, a warlord messenger, or a minor hazard below ground.

**Missions and travel.**

- A nearby mission site can be reached and played the same day. A far one takes a set number of days of travel.
- Some missions are limited by number of turns, such as rescues.
- Otherwise a mission has no limit until every team member dies or the team extracts successfully.

## Combat

Combat is XCOM style: turn-based, on an isometric tile grid, with permadeath.

**Turn structure**

- The squad moves, then the enemy moves.
- Each unit gets two actions per turn: move, shoot, use an ability or item, take cover, or overwatch.
- Half and full cover reduce hit chance, and height and flanking matter.
- The player sees hit chance before committing to an action.
- Fog of war hides unexplored areas, so scouting has a cost.

**Squads.** Four to six units per team. Level 1 units are recruits with no specialty, and the player chooses one of five roles for each when they level up. The role names below are working names. In the intro mission one team member always dies, so the player has to hire a new recruit to refill the team.

- **Bulwark (tank):** a heavy unit that taunts enemies into taking fire.
- **Longshot (marksman):** a long-range sniper with low health and high damage.
- **Drifter (scout):** an all-around mid-range unit with medium defense and attack.
- **Sawbones (medic):** heals, and has a long-range revive shot that can be used once per mission.
- **Tinker (tech):** uses robots, turrets and lasers to attack and defend.

**Downed and dead**

- A unit can be downed during combat. A downed unit has a set number of turns before dying.
- If the player has an item that brings the unit back up, it can be used to revive them.
- Without such an item, extracting a downed unit before their turns run out saves them.
- A unit who runs out of turns dies permanently.

**Retreat.** The player can retreat early without reaching extraction, at a heavy cost to morale and resources.

**Mission types**

- **Combat:** clear or defend an area.
- **Salvage:** gather resources that keep the waystation running, with a carrying limit that forces choices.
- **Rescue:** limited by number of turns.
- **Extraction:** a mission ends when the team extracts or every member dies.

**Consequences.** Injuries carry back to the waystation and need the clinic, which takes the unit out of the next day's jobs. Enemies can be bandits from specific warlords, so fighting one affects relationships with that warlord and its rivals.

**Raids.** Raids on the waystation use the same tactical combat, with the waystation as the map.

## Enemies

Enemies come from three sources: bandits tied to specific warlords, wasteland hazards, and later factions.

**Bandits**

- **Raiders:** basic frontline fighters, numerous and weak.
- **Brutes:** heavy melee or shotgun units that charge cover.
- **Marksmen:** long-range snipers that punish exposed squads.
- **Saboteurs:** target generators, pumps and turrets, mostly in raids.
- **Lieutenants and champions:** tougher leaders who buff nearby bandits, found on bigger missions and attacks.

**Warlord identity.** Each warlord favors a different mix of units and tactics, tied to their raid style, and has signature units unique to them.

**Scaling.** Enemies scale with warlord strength. Warlords who appear later in the game are harder, and early warlords who are still alive level up along with the player.

**Negotiation.** Some enemies are open to negotiation, such as bandits who surrender.

**Drops.** Enemies can drop a mix of salvage and silver buttons.

**Wasteland hazards.** These add mission variety and are not tied to warlords.

- Scavenger packs, wild animals and feral dogs.
- Environmental dangers such as radiation pockets and collapsing ruins.
- Old-world security machines still running in ruined sites.

**Later factions.** The mutated faction and the returning elites each bring their own enemy sets and mechanics. They are DLC after the game is complete, so they are out of scope for now.

## Crew

- **Source:** weary travelers arrive looking for work and can be recruited. A warlord's people are among them, so relationships shape who shows up.
- **Starting team:** five members, all recruits. The intro mission always kills one, leaving four.
- **Recruits:** every level 1 team member is a recruit with no specialty. When a unit levels up, the player chooses their role from the five (Bulwark, Longshot, Drifter, Sawbones, Tinker).
- **Capacity:** each crew room adds four places, with two bunk beds in each room, each sleeping two.
- **Pay:** crew are paid in food, lodging and water, not money.
- **Jobs:** one job per day, either a mission or work at the waystation such as the clinic, generators, pumps, food, guard duty or the bar.
- **Growth:** missions earn experience toward levels.
- **Morale:** retreating, losses and poor conditions lower it, and low morale hurts performance or makes people leave.
- **Injury and death:** downed units who survive need clinic time, which takes them off the next day's jobs. Death is permanent and affects the morale of those who knew them.

## Economy

- **Income:** patrons spend at the motel (guest rooms for a night or an extended stay), the bar, gambling and live shows. Passing traffic is passive income, so more rooms and better entertainment earn more.
- **Salvage:** brought back from missions to keep the waystation running and to build.
- **Upkeep:** food, water, power and repairs, paid each day. Crew are covered by food, lodging and water.
- **Building:** new rooms cost silver buttons and salvage, and each has a running cost.
- **Warlords:** tribute, trade deals and favors feed into the economy, and a hostile warlord can cut your supply routes.
- **Currency:** an old-world currency with a finite supply, so it cannot be reproduced and an overflow cannot ruin the economy. The currency is silver buttons. Anyone can hold them, but they are nearly impossible to copy. They originally came from old clothing left behind by the elite.
- **Failure:** the waystation fails if the player runs out of silver buttons, loses all team members, or fails a raid.

## Missions

**Choosing.** The player chooses which missions to go on. There is always a variety to choose from, and some are more urgent than others.

**Expiry.** Missions can expire, and the consequences depend on the type:

- A rescue mission left too long expires, and the people to be rescued die.
- A salvage mission that expires has no consequences.

**Generation.** Missions are generated so that no two maps are the same.

**Warlord missions.** Warlords can give missions, which raise the player's standing with them and earn gear.

**Types.** Combat, salvage, rescue and extraction, as described under Combat.

**Locations and travel.** Sites include ruined towns, old-world buildings, caravan routes, warlord outposts and wasteland hazards. Nearby sites can be reached and played the same day, and far sites take days of travel. Entering a warlord's territory affects the relationship with that warlord.

**Briefing and structure.** A briefing card shows danger, expected rewards and pack choices before the team leaves. Some missions have optional goals that offer bigger rewards for more risk, and some bring reinforcements after a set number of turns.

**Rewards.** Salvage that keeps the waystation running, silver buttons, recruits from rescue missions, and warlord favor or loss of it, depending on who the player hits or helps.

## Tutorial

The tutorial takes roughly 20 to 30 minutes and is led by an NPC guide: an automated system that helped the player's relative manage things around the waystation before the relative disappeared. The guide is warmly protective and sarcastic, using humor to relate to the player, and is loyal to whoever currently owns the waystation. After the tutorial it keeps helping the player manage different areas of the waystation. Its name is Pilot Light, or Pilot for short: warm, but still a program. The tutorial can be skipped on later playthroughs.

1. **Arrival.** The courier drops the player at the ruined waystation. The five recruits greet them at the bar, and a short scene sets up the backstory and premise.
2. **Above ground.** The guide has the player repair the first guest room and the bar for free. The first travelers arrive, teaching the day phases, rooms and how patrons earn income.
3. **Below ground.** The player repairs the generator and water pump for free and learns that rooms depend on power and water. They open team management and assign their first jobs.
4. **First evening.** Patrons come in, the player earns their first silver buttons, and learns the evening phase and what a quiet night looks like.
5. **Intro mission.** A scripted combat mission teaches movement, cover, hit chance, overwatch, and the downed-and-extract rules. One recruit always dies, chosen at random, and the player cannot prevent it.
6. **Return and hire.** Back at the waystation, the loss registers. The player hires a new recruit from the travelers, which ends the tutorial.

A warlord makes first contact only after the tutorial ends.

## Story

The warlords are not the focus of the story. They are an ongoing inconvenience the player has to keep dealing with. The story follows the secret under the waystation.

1. **The note and the vault.** The player inherits the waystation through a cryptic note from their relative. An ancient vault is buried deep beneath the waystation, unknown to everyone but Pilot Light. It is an Elite control room.
2. **Pilot Light's trust.** Pilot Light slowly reveals more about the vault as the player builds a better relationship with it. Trust is earned through the player's choices.
3. **The relative is watching.** The relative has been communicating with Pilot Light the whole time and getting updates on the player. This gives the relative Pilot Light's read on the relationship, and on whether the player can be trusted.
4. **The intercom.** Once trust is high enough, Pilot Light gives the vault's location, and the player talks to the relative through an intercom.
5. **The keycard.** The relative requires the player to go on special missions to find the keycard that opens the vault and gets them out.
6. **The control room.** Inside are monitors and servers tracking the Elite's space station, which shows that the Elite are coming back. One console shows a map of the surrounding area with many small red dots appearing, beeping endlessly, and moving fast. Pilot Light integrates itself into the system and explains that the dots are strange mutated creatures beginning to spread, with distress calls flooding in.
7. **The truth.** Once free, the relative reveals information about the mutants rapidly approaching and the looming threat of the Elite possibly returning.

**The relative.** The relative did not abandon the waystation. They became trapped in the vault and survived off rations and water from a leaking pipe. They needed to confirm the truth about the mutants and the Elite, and they left the player the note that gave them control of the waystation.

**Earning Pilot Light's trust.** Trust is earned through the player's choices, and the relative learns the result because Pilot Light reports on the player. Choices that build trust:

- Protecting the crew.
- Being honest with travelers.
- Sparing surrendering bandits.
- Judging Pilot Light's advice. It is sometimes wrong or biased, so following good advice and overruling bad advice can both earn trust.

As trust grows, Pilot Light shares more about the vault, up to giving its location and opening the intercom to the relative. A draft of the levels follows.

| Level | Pilot Light's attitude | What it unlocks |
| --- | --- | --- |
| 1. Wary | Helpful with the basics, and deflects questions about the relative and the vault with jokes | Tutorial help and routine management advice |
| 2. Warming | Drier, more personal remarks, and more willing to give opinions | Advice in more areas of the waystation, and a first hint that something below ground is off limits |
| 3. Reliable | Admits there are things it has been asked to protect | The first clues: a locked door below ground, and notes in the relative's handwriting |
| 4. Confiding | Admits the vault exists and that someone is in contact with it | The vault's location, the intercom to the relative, and the keycard missions |
| 5. Trusted | Shares everything, including what the relative asked of it | Opening the vault once the keycard is found, and full access to the control room |

Trust can fall as well as rise, but slowly, so one bad choice does not lock the player out of the story. The player reaches level 4 about two-thirds of the way through the game, so the keycard missions and the reveal land in the final stretch.

**Link to later content.** The mutated faction and the return of the Elite are the DLC after the game is complete. The base game's story builds to this reveal, and the DLC takes up what follows.

## Art direction

**Tone and references.** Cozy but gritty. The feel draws on State of Decay and Metro, and the visuals sit close to This War of Mine: hand-drawn, textured and worn, with muted colors, not clean or glossy. The art stays clearly defined, not blocky or angular.

**Color and light**

- **The wastes:** muted, dusty ochres, faded teal and rust.
- **The waystation:** warm amber lamplight, so it reads as the one safe, glowing place.
- **Day phases:** each phase has its own sky and light, from pale morning to deep blue night. Raids at night add harsh red and white.
- **Below ground:** cooler and more industrial, with pockets of warm light where crew are working.

**The base (cutaway)**

- 3-5 parallax layers, with the motel up top and the operations level below.
- Each room is a lit, animated scene built from modular pieces, with small details such as steam, flickering lamps and crew moving about.
- Ruined rooms look visibly broken, and repairs show up room by room, so progress is visible.

**Characters**

- Slightly stylized and expressive, and readable on a phone screen.
- Built from layered modular parts so every recruit looks distinct, and a recruit's chosen role shows in their gear.
- Each role has a clear silhouette: the Bulwark is bulky, the Longshot lean, and the Tinker has robots and gadgets around them.
- Recruits show their experience visibly, such as patches or scars.
- When recruiting, the player can either choose a randomly generated traveler looking to be hired or design a custom recruit.

**Pilot Light.** An automated system, not a robot, that lives within the waystation itself. It has no body. It shows up through screens, speakers, lights and a flame motif in the rooms it is helping with, and it is a visible presence in the art.

**Tactical view.** Isometric, in the same textured style as the base, with enough contrast that cover and hit chance read clearly on a small screen.

## User interface

**Principles.** Mobile first, built for one-handed use on a phone with thumb-sized touch targets and no hover-only features. Actions live where they belong: the player taps a room to manage it, with no big menus. The look is worn and hand-made, like notes and labels pinned up around the waystation.

**Base screen**

- The cutaway can be panned and zoomed, and tapping a room opens its details (jobs, upgrades, repair).
- A persistent side panel gives quick access to the team, missions, building and warlords.
- All necessary economy items are shown on the main screen so they are easy to see, and the player can customize which ones appear and where.
- A phase button ends Morning or Evening, since the player decides when those phases end.
- Pilot Light appears as a small glowing icon the player can tap for advice or a short comment.
- A notification-style feed shows events such as arrivals, expiring missions and warnings.

**Pilot Light's voice.** Its comments are text only for now, and it makes its own distinctive noises when it talks to the player.

**Key screens**

- **Team:** crew list, roles, injuries, morale, and the role choice at level-up.
- **Missions:** the available list with urgency markers and expiry timers, leading to the briefing card.
- **Build:** the tech tree and room placement.
- **Warlords:** relationships, demands and offered missions.
- **Recruiting:** randomly generated travelers, or the custom recruit creator.

**Tactical view.** Isometric, with tap to select and tap to move, and the hit chance shown before the player commits. An action bar shows the selected unit's actions, and a turn indicator shows downed-unit countdowns.

**Screen sizes.** The cover screen of a Galaxy Z Fold 7 uses the compact phone layout, and the open screen shows more of the cutaway with the side panel alongside. On a phone or the closed cover screen, the side panel is a slim docked strip that expands into a drawer when tapped, so it is always one tap away. Desktop uses the same screens with the side panel always open.

## What carries over from The Midnight Appraiser

Only the structure and tech of The Midnight Appraiser carry over. Its appraisal system, shop, Heat, audit and continuous clock are deliberately left out.

| Appraiser system | Waystation version |
| --- | --- |
| Night run with a briefing card | Field mission launched from below ground, with a briefing card (danger, energy, pack choices) |
| Arcane Society vs Ringval Knights, join one or neither | Four to five bandit warlords: ally, scheme, or oppose all of them |
| Rent | Upkeep of the waystation, paid with salvage |
| Actions live where they belong | Each system is a room you click into |
| Append-only look and save data | Same, applied to modular crew parts and room kits |
| Deterministic generation, pure rules modules, versioned saves | Same technical shape |

Three things are new here: you manage as a leader from a cutaway, people take jobs by assignment rather than you walking everywhere, and nights and raids put the base itself at risk.

## Phased roadmap

Nine phases, each ending in something playable, each with an exit test that must pass before the next begins. **Build order:** we finish the whole game here as a playable single-file artifact (vanilla JS and Canvas 2D), then hand it to Claude Code and GitHub for the React and PixiJS port, tests and Google Play packaging. The zip is held until the game is finished. Status below is as of 2026-11-01.

### Phase 0. Foundations: done

- Design bible written, setting and art direction settled, test devices defined (phone, tablet, desktop, Galaxy Z Fold 7 open and closed).
- Starter repo (Vite, React, PixiJS, tests, deploy workflow) exists and is held for the handoff.
- *Exit:* a design bible and an empty project that builds, tests and deploys. Met for the design; the deploy is verified at handoff.

### Phase 1. Cutaway and renderer: done in the artifact

- Built: layered 2D cutaway with parallax, phase lighting, pan and zoom, room furniture, crew and patron figures, phone, Fold and desktop layouts.
- Left: art pass from placeholder shapes to the illustrated kit (Phase 7), the PixiJS port, a 60fps check on a real mid-range phone, a real Fold 7 check.
- *Exit:* a lit, scrollable base that runs at 60fps and works on the Fold 7 open and closed.

### Phase 2. Base building and crew: done in the artifact (tech tree added 2026-11-01)

- Built: repair, build, upgrade, demolish and dig; job assignment; four day phases; hiring and custom recruits; role choice at level 2; the tutorial with the scripted intro loss.
- Built: the tech tree as Plans: 24 plans across the six drafted branches, researched one at a time from the relative's notebooks (paid up front, ready after one to three nights). Plans gate room levels 2 and 3 and unlock new rooms.
- Built: new rooms. Hospitality: Bathhouse. Defense: Gate Checkpoint (fewer raids, one-gap gate in raids) and Turret Nest (fights on its own in raids). Power and water: Purifier. Food: Cold Storage. Crew and operations: Armory (extra stim per squad, gear made to order); Surgery and Tinker's bench plans improve battles.
- Built: Diplomacy rooms. Messenger Post (better haggling, cheaper tribute, warmer gifts), Meeting Hall (pacts at lower standing, plots leak half as often), Informant Network (raids decided and announced in the morning, plots never leak).
- Built: recruits show experience in the cutaway with role-coloured chevrons per level.
- Left: a wider surface (only ten lots, so surface rooms compete), renewable generators, advanced clinic beyond Surgery, illustrated room art.
- *Exit:* build rooms, assign jobs and play a full day of phases. Met.

### Phase 3. Visitors and upkeep: mostly done

- Built: patrons who eat, drink and rest; shared meals; maintenance costs.
- Left: named traders, friendly-bandit visits, quiet-night small events, and visitor flow that reacts to warlord standing.
- *Exit:* a base loop that runs and is fun without combat.

### Phase 4. Field missions: first pass done (2026-11-01)

- Built: generated 12×14 isometric maps per mission type (ruins, half and full cover, always reachable); two-action turns with move, dash, shoot, overwatch and hunker; hit chance from aim, range, cover and flanking, with crits.
- Built: role abilities (Bulwark taunt and armor, Longshot steady shot, Drifter quick shot, Sawbones patch up and once-per-mission revive shot, Tinker turret), plus a shared stim and carrying downed allies.
- Built: downed countdown, extraction zone, retreat that leaves the uncarried downed behind, permadeath; enemy pods that alert on sight, scramble to cover and flank; warlord signature units (brute, marksman, war hound) and surrender.
- Built: objectives per type (clear, recover caches, free survivors within 8 turns), debrief, loot and XP, injuries from wounds; far missions fight on arrival; battles save and resume.
- Built: the intro mission as the combat tutorial with guided tips; one random recruit is always killed by a scripted ambush, and the rest cannot die there.
- Left: loadouts and gear, elevation, explosives and destructible cover, more enemy types, richer enemy AI, illustrated art, balance pass with real play.
- *Exit:* a complete mission, from board to debrief, feeds salvage and buttons back into upkeep. Met.

### Phase 5. Warlords: first pass done (2026-11-01)

- Built earlier: generation with the aggressive and friendliest guarantees, demands at the gate, gifts, contract jobs, raids.
- Built: three stances per warlord. A pact (Friendly standing, not with aggressive warlords) costs 10 buttons up front and a nightly tribute, and stops their raids and demands; breaking it costs standing. Open opposition drops standing, raises their raid odds, and puts strikes against their people on the board. A conspiracy with one warlord against another brings the ally's jobs against the target, with a small nightly chance the target finds out.
- Built: each warlord has a grip on their territory. Strikes, contracts against them and repelled raids loosen it; it recovers when nobody presses. Below 30% their stronghold is exposed for a few days; taking it eliminates them.
- Built: elimination leaves the territory unclaimed for 8 to 12 days (more passing travelers), then a successor claims it. The guarantees always hold: another warlord turns aggressive or friendly if needed, and only one territory can be vacant at a time.
- Built: gear from warlord jobs, elite jobs and strongholds (scrap vest, scope, road boots, field kit, warlord plating), one piece per crew member, lost if they die.
- Built: recruits come from warlord territories weighted by standing; nobody comes from a warlord who hates you; crew from an eliminated warlord's land take it hard.
- Left: Diplomacy rooms that improve these options (Phase 2 tech tree), warlords negotiating with each other on their own, warlord-specific personalities in events.
- *Exit:* each warlord plays distinctly and the player can pursue all three stances. Met for the first pass.

### Phase 6. Raids and base defense: first pass done (2026-11-01)

- Built: raids are fought on the Phase 4 engine on a map built from the real waystation: surface rooms become buildings along the bottom edge, wall rooms set how much of the palisade is solid (the gate is always open), and working watchtowers become high ground (+10 aim, half cover).
- Built: a raid alert at night shows the warlord, raider count and style, wall strength and rooms at risk; the player picks up to six defenders (watchtower crew start in the towers) or falls back to the bunker.
- Built: raiders try to wreck rooms as well as fight; raid style sets the mix (frontal assault, siege, sabotage, theft) plus the warlord's signature unit; raiders break and run after losing 60% of their number and give up after turn 10.
- Built: results carry over: wrecked rooms become damaged, a breach or fall-back costs a share of silver buttons, deaths and injuries apply, repelling earns salvage, XP, morale and Pilot Light trust; if every defender goes down the waystation falls and the game ends.
- Left: hazards below ground, defenders choosing start tiles before the fight, raiders tunnelling or targeting below-ground rooms, raid size and frequency tuning with real play.
- *Exit:* a raid forces real decisions about where to send your people. Met for the first pass: who stays home versus goes on missions, and fight versus fall back.

### Phase 7. Campaign, audio and polish: done, first art pass in (2026-11-01)

- Built: the vault campaign. At trust level 4 the intercom by the Sealed Door rings; the relative (named per game) is alive inside. Four calls, one a day, each unlocked by progress, with choices that raise or cost Pilot Light's trust (lying about the dead costs it).
- Built: three keycard missions (Elite relay station, flooded transit vault, the Warden's tower), danger 2 to 4, with machines and a single keycard piece at the far end; offered again if a team fails.
- Built: opening the vault needs all three pieces, every call answered and trust level 5. The door becomes the Vault Control Room, the relative joins the crew as a level 3 Sawbones, and a three-page reveal shows the Elite station coming back and the red dots of the mutated spreading, then end-of-story stats. Play continues afterwards.
- Built: Pilot Light warms to a well-run waystation (one trust point a night at reputation 20 or more), so the story lands around days 23 to 34 in simulation; occasional night lines from the relative over the intercom.
- Built: three recurring guests with three-step arcs: Marguerite Okoro the cartographer (a marked cache, then more traffic), Brother Ansel (morale, refugees, then help on the walls in raids), Wes Pardee the card sharp (a bet, a cheating choice, then better card nights).
- Built: procedural music and sound with Web Audio, no files: a drone and plucked minor-pentatonic notes that shift by time of day, with a tense pulse in battles and raids; effects for shots, hits, misses, bites, downed crew, wrecked rooms, raid alarm, building, healing and the vault door. Music and effects toggles in Settings.
- Left: the illustrated art pass (rooms, crew, tactical sprites replacing placeholder shapes), voice for Pilot Light (text only for now), more guests and night events.
- The mutated faction and the return of the elites stay DLC, after the game is complete.
- *Exit:* the campaign is playable start to finish. Met, except the art pass.

**Art pass (2026-11-01).** Everything is still drawn in code, with no image files, so it fits a single-page artifact.

- A shared paint kit pre-renders textures once: plaster, concrete, brick, planks, tile, corrugated metal, dirt, ground, asphalt and paper. It also provides pencil hatching, soft edge shadows, shaded drawn boxes with doubled pencil outlines, and warm hanging lamps.
- Cutaway: textured walls and floors per room type, pipes below ground, corrugated roofs, shaded furniture, paper name tags on nails, ruined rooms with debris and a fallen beam, construction scaffolding, lamps that light only running rooms, a lit WAYSTATION sign with one letter on the fritz, textured earth and drifting clouds.
- Crew and patrons are redrawn as fuller figures: coats with collars, arms, boots, six hairstyles, working poses (tending machines, bending over crops, pouring and drinking at the bar) and a facing direction.
- Battle maps: textured ground, brick and concrete ruins with hatched shadows, plank crates, rusted drums, sandbags and rubble. Crew and raiders use the same figures, raiders wear goggles and their warlord's colours, and feral dogs are outlined with glowing eyes. Raids play at night, lit by the waystation's windows and towers, with a vignette over the view.
- Performance: static pictures (rooms, earth, sign, battle floor and cover blocks) are cached and only lamps, people and effects draw live. The base view stops drawing while a battle is open. On a simulated slow phone, battles run faster than before the art pass and the base view costs the same.
- Illustrated pass (2026-11-01): characters, animals, battle structures and room furniture are now hand-built SVG illustrations, turned into images once when the game loads (sprites.js, structures.js, furniture.js). Crew show their role gear (bulwark armour and shield, longshot scope and scarf, drifter pack, sawbones coat and satchel, tinker goggles and tool belt); raiders, scavengers, brutes and marksmen each have their own outfit. Feral dogs and war hounds have real anatomy, the intake creature is a pale eyeless crawler, the sentry machine is tracked. Battle cover is broken brick and concrete walls with rebar and blown-out windows, palisades, crates, rusted drums, sandbags and rubble, three variants each. All 24 room types have detailed furniture. The old drawn shapes stay as a fallback for the moment before images load. Frame cost on a simulated slow phone is unchanged.
- Hi-bit pixel look (2026-11-01, Ryan chose the finer of two densities): the whole game sits on one pixel grid of 1.28 pixels per world unit, so a soldier is 32 x 64 pixels. Illustrations are drawn large, then reduced to pixel art with a limited palette per sprite, stray pixels cleaned up and a dark outline around characters, animals and creatures. Rooms, the battle floor and the earth snap to a palette too and are drawn without smoothing; lamp light and the interface stay smooth. Frames got cheaper (simulated slow phone battle about 39 ms, was about 68).
- Hex battles (2026-11-01, Ryan chose a hex grid over a fully open map): battle maps are pointy-top hexes in odd-row offset layout, 12 x 16, seen from a raised angle. Movement is six-way at one point per hex; cover counts per hex side when the attacker is within 60 degrees of it; leaning out from behind a wall only works to a hex that also touches that wall. To keep difficulty where the square grid had it, ranged enemies have 8 less aim and melee enemies (not the intake creature) 1 less movement; warlord missions came out a little harder than before in simulation. Walls are hex prisms that tile the map.
- Animation (2026-11-01): crew and raiders walk with a four-step stride, raise rifles to aim, fire with recoil, a muzzle flash and smoke, flinch when hit, and fall when downed or killed; downed crew lie on their side in a stain. Dogs run and lunge, hits throw blood or dust, crits shake the camera. In the base, crew work at one spot, walk to another and turn to face the way they go; drinkers lift their glasses.
- Grounded props (2026-11-01): the battle floor is one continuous surface (large light and dark patches, tyre tracks, stones, cracks, weeds, stains, puddles) under a faint hex grid. Every prop is seated into it: contact shade, a soft shadow cast down and to the right, and its own debris (brick and concrete chips, spilled sand, oil and rust stains, splinters, dust). Props no longer carry a dark sticker outline. Sandbags are now three staggered courses along an arc with seams and tied ends; wall tops are textured masonry and concrete.
- Surface buildings (2026-11-01): rooms above ground are drawn as buildings around the cutaway: guest rooms under a shingled gable with a dormer, chimney and a VACANCY board; the bar behind a western false front reading SALOON with a water tank; the card room under a barrel roof ringed with bulbs; the bathhouse with a boiler tank and stovepipe; the messenger post with a pigeon loft. All get plank siding, a gutter, lanterns and a boardwalk; damaged roofs show holes. Walls, watchtowers, the gate checkpoint and turret nests stand in the open with sky behind them. Underground rooms stay as cutaway boxes.
- Backdrop (2026-11-01): pixel clouds in two drifting decks coloured by time of day, a blocky sun and crescent moon, stars, a passing flock; far mesas with strata and a ruined city with a crane and lit windows at night, fading into haze; a mid layer of the old highway with power lines, a billboard, a dead tree and a wrecked truck.
- Waystation name (2026-11-01): the player names the place on the setup screen (up to 16 characters; blank keeps WAYSTATION) and can repaint it in Settings. The flickering roof sign spells it out and resizes to fit; the room panel shows it too.
- Battle walls (2026-11-01): wall hexes are drawn as continuous ruined walls, fences and the waystation front, joined to neighbouring wall hexes with a pier at each; the ground is a plain frayed rectangle with no hex grid painted on it; hexes appear only for movement and targeting. Watchtower platforms are square plank decks.
- Clean joins (2026-11-01): battle walls are built from a wall graph with corner triangles broken, so walls never double back or cross; each connected wall uses one material; piers appear only at ends and corners, and straight runs flow through. Above ground, buildings that touch share a wall: eaves, gutters, downpipes, lanterns and boardwalk steps stop at a neighbouring building instead of overlapping it. The roof sign stands behind the roofs, the dark foreground mounds that slid across the buildings are gone, and the raid waystation's roof segments meet edge to edge.
- Wall joints (2026-11-01, from Ryan's screenshot of a bad corner): ruined buildings on battle maps are now hex-aligned parallelograms, rows across and one straight diagonal down each side, instead of offset-grid rectangles whose sides zigzagged. Each wall hex draws a half-run toward every neighbour it joins (back arms first), so one hex owns each joint and nothing is painted over it later; the halves meet without outlines at the seam. Posts are gone except for free-standing stubs; a wall that ends shows its cut end face. Broken tops are shallower and windows rarer. Simulated difficulty is about the same as before.
- Characters (2026-11-01): every recruit's look now has build (slim, average, heavy), age (young, adult, old with grey hair and lines), ten hair styles (including bald, mohawk, long, beanie), facial hair (stubble, moustache, beard, goatee), a mark (scar, eyepatch, face paint, head bandage), an accessory (neck bandana, goggles, earring, tags) and a top (jacket, vest over a shirt, duster, hoodie, poncho). Older saves fill these in from the old three numbers. Raiders and bar patrons vary the same way. The Team and hiring lists show a pixel portrait cut from each person's own sprite.
- Backstories (2026-11-01): each recruit gets a short story built from what they used to be, why they left, and a habit, e.g. “Was a mechanic for a convoy that never came back. A storm took their wagon and everything in it. Laughs at exactly the wrong moments.” Recruits from a warlord's land mention it. Shown under each traveller looking for work and behind “Their story” on the Team tab; the relative has their own.
- Music (2026-11-01): replaced the beeping synth with a wasteland score: two layers of gusting wind, a low breathing drone, and a lone slide guitar (plucked strings modelled in code) playing sparse phrases into a long desert reverb, with a slow open-string strum every few bars. Nights add campfire crackle and a rare far-off howl; battles add frame drums; raids add clanking scrap metal; the vault is eerie and sparse. Gunshots echo, heals and wins are guitar notes, the alarm is struck metal.
- Sprite clarity (2026-11-01, from Ryan's note that guns merged into bodies and heads had stray lines): rifles are redrawn for the pixel grid in separate materials (warm wood stock, pale steel with a bright top edge, chunkier parts) and held forward of the hip so the gun never crosses the torso. Details too thin to survive at sprite size are gone: hair strand lines, ear lines, forehead wrinkles, scar stitches, hat ribs and mohawk spikes; the face has no grain. Straps for goggles and eyepatches are solid bands. The shirt collar is a plain V (it read as a T). People get a larger palette, and the pixel step clears stray dark specks inside the figure while keeping the outline.
- No black outlines on people (2026-11-01, Ryan's preference): characters, portraits and dogs draw their line art in a see-through warm brown instead of black, and the pixel step gives their silhouette a soft edge (the neighbouring colour a few shades darker, half transparent) instead of a near-black outline. Figures read by colour and shading.
- Faces and arms (2026-11-01, from Ryan's note that some looked one-armed and faces looked off): people are drawn three-quarter on. The far arm hangs just outside the far edge of the body so both arms and hands always show, and comes in front of the body when aiming or working. Faces have two eyes, each a light white with a dark pupil so they read on every skin tone, two bold brows, a soft nose shadow and a plain mouth, replacing the profile eye, outlined nose and lips that broke up at sprite size.
- Eyepatches are worn brown leather with a lit edge and a strap, not black squares.
- Anyone holding a rifle uses both hands: front hand on the grip, far hand under the forend (carried and aimed).
- Every dropdown is a themed in-game control (paper tab, dark wood list, lamp highlight); no browser-native selects.
- Building, repairing (when it costs something), upgrading, tearing down, digging and researching all ask for confirmation first.
- Main menu with three save slots (Continue, Delete with confirmation, New game), How to play, Settings, Replay the story, Credits; the old single save becomes slot 1.
- New game prompts to name the save; the waystation itself is named later, when Pilot Light suggests it near the end of the tutorial (Name it / Leave it; Settings can still rename).
- After starting a new game an eight-card illustrated story plays: the old world, nobody agreeing how it ended, the Elite leaving, three hundred years, the warlords, the waystation, the letter, arrival. Skippable; replayable from the menu.
- Left: painted illustrations beyond what code can draw (portraits, a title painting), more furniture variety per room level, animated walking between rooms.

### Phase 8. Release: in-game work done, packaging at handoff (2026-11-01)

- Built: a balance pass using a sensible autoplayer (staffs essentials first, repairs and researches with a reserve, buys food when short, defends from cover, falls back when nearly beaten). Changes: grow rooms and pumps make 10 per worker, guests pay 4, upkeep only for staffed or powered rooms, start with 60 buttons and 40 food and water, crew +2 health, enemy aim slightly lower, raid size no longer double-scaled by day, fewer raids, grace period to day 5.
- Built: a traders' market at the Bar (food, water, salvage, three buys a day) so buttons can feed the crew.
- Results over 60 days (40 games each, autoplayer): Easy about 68% survive, Standard about 40%, Hard about 20%. A person using cover, overwatch and fall-back should do better; needs real play to confirm.
- Built: new game setup on first launch and from Settings: difficulty (Easy, Standard, Hard), Ironman, tutorial on or off. Ironman keeps one save and deletes it when the waystation falls. Other games keep a start-of-day snapshot: Try this day again on a loss, Restart day in Settings.
- Built: accessibility: three text sizes, colour-blind safe colours, fast battle animations (on automatically with reduced motion), a room list in the Room panel so rooms can be reached without tapping the canvas, an Aim button and T key that cycle visible targets and bring them into view; existing keys Tab (next unit), E (end turn), Escape.
- Built: How to play in Settings.
- Left for the handoff: reconcile the artifact rules with the starter repo's tests, port to React and PixiJS, Capacitor packaging, Google Play listing; the illustrated art pass; balance from real play.
- *Exit:* a release candidate that passes the full test suite and device matrix. Met for the artifact (all simulations and browser tests pass at phone, Fold cover and desktop); real devices and store packaging come with the handoff.

### Proposed build order from here

Phase 4 first, since it is the biggest missing piece and Phase 6 reuses it. Then Phase 6, the rest of Phase 5, the tech tree from Phase 2, Phase 7, and Phase 8 last.

## Technical foundation

The stack follows the Appraiser's static-site approach, with a canvas renderer for high-resolution illustrated art and a mobile-first layout.

- **Shell:** React for UI and menus, hosted on GitHub Pages, with a service worker for an offline copy and an update banner. For Google Play, the web build is wrapped as an Android app (for example with Capacitor).
- **Renderer:** PixiJS (WebGL) inside a React component for the cutaway and the tactical view. Plain DOM will not hold up with many animated, lit rooms.
- **Art:** clearly defined, high-resolution hand-drawn and textured art, not blocky or angular pixel art. Characters and rooms are built from layered, modular parts to keep asset volume bounded.
- **Depth and light:** 3-5 parallax layers (far wasteland, surface structures, cutaway rooms, foreground props), with per-room lighting, glow, shadows and dust, and sky colour that follows the day phase and weather.
- **Layout:** mobile first, desktop second. Responsive for phone, tablet, and monitor, and tested on a Galaxy Z Fold 7 open and closed, where the screen size and shape change mid-session.
- **Audio:** music and sound effects that fit the tone, with music that shifts by day phase and mission state.
- **Rules:** pure modules for jobs, upkeep, warlords, and combat, tested with node:test; flows tested with Playwright through a debug hook.
- **Data:** deterministic generation for the wastes, versioned saves with a minimum supported version, and append-only look and content data so old saves never break.
- **Process:** one slice per PR, screenshots to check visuals, and a roadmap entry for every decision.

## Open decisions and risks

The clock, crew control, renderer and platform are settled. The setting is the main decision left for Phase 0, and art volume is the biggest risk.

- [x] **Clock:** day phases, not a continuous clock, so the player has time to decide.
- [x] **Crew control:** at the waystation the player assigns people to jobs and builds up the base; in the field, missions play like XCOM with turn-based combat.
- [x] **Renderer:** confirmed: PixiJS inside React for the cutaway and tactical view.
- [x] **Steam:** Google Play only for now; Steam is not planned.
- [ ] **Setting specifics:** warlords are generated per game, and the wastes are not inherently hostile. The backstory is written; still open is how much of it the player learns.
- [x] **Quiet nights:** the game skips to the next morning with a summary, and some quiet nights trigger a small event.
- [x] **Currency:** an old-world currency with a finite supply: silver buttons that anyone can hold but that are nearly impossible to copy.
- [ ] **Risk, art volume:** high-resolution illustrated art is costly; mitigated by a modular room and crew kit locked in Phase 1.
- [ ] **Risk, scope:** a management game plus tactical combat is two games, so each phase ends with something playable before the next begins.
- [ ] **Risk, devices:** test the renderer and layout on a mid-range phone and a Galaxy Z Fold 7 (open and closed) at the end of Phase 1.
