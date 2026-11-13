# SLUMBER Bestiary: where it stands and what is next

Live: https://deep-forest-labs.github.io/teardown/ · source: branch `dfl/bonepede` in Deep-Forest-Labs/teardown ·
build: `node tools/build-hub.mjs`, then `tools/thumbs.mjs` and `tools/export-design.mjs` (see each file's header).

## Done (2026-11-14)

- **Drawer** of every biome, enemy and prince (latest version shown) plus the live prototypes.
- **Stage modes:** Wander (patrol), Hunt (drive a player: WASD, Space, double jump), Phases (wave timelines per
  layer; play, pause, 0.5x to 4x, skip to any wave; the prince wave starts the fight).
- **Versions and tiers** (`versions.js`): v0 stand-ins are frozen in `standins.js`; new versions go in `enemies/`.
  Main view has version chips and tier chips (`#skull-v1-t2`). Swarm skull v1 has tiers 1 to 3 on one shared flock.
  The worm (BONEPEDE II) is v1. Everything else is v0.
- **Prince fights** for all nine layers: the arena and prince as one rig, scrubbed by fight phase, layout changing
  between phases. Leviathan is v1 (detail pass, `fights/leviathan.js`); the other eight are v0.
- **Prince console:** phase bar, live readouts, subsystems with live states, click to isolate.
- **Placement by scale:** spots measured for clear floor; the biggest walkers get the roomiest; Footprints toggle.
- **Arenas** default to 1.4x wide, 1.2x tall; width and height sliders; per-viewer memory.
- **design.json** export (schema v1, `DESIGN-DATA.md`): arenas, waves, fights, player, enemies with versions,
  tiers, agent speeds and phase timings. The Unity bridge session maps it into Unity.

## Next, in order

1. **Prince detail passes to the Leviathan v1 level** (then past it, toward the teardown Pelagos flagship): Mammon,
   Belial, then the rest. Each gets its own `fights/<prince>.js` and replaces its layer in `fightsAll.js`.
2. **Swarmer tier 1 polish**, then tiers 2 and 3; then the other base enemies to v1 (scorpion and quadruped first:
   Rob's four-legged IK monster wish fits the quadruped).
3. **Stage passes:** tune each arena's layout around its prince (the fights already change the layout), more
   pads and lifts where the board's movement unlock needs them.
4. **Phases tuning:** waves per layer instead of one template; spawn spots chosen by scale per wave.
5. **Console extras** from the teardown kit: exploded view, labels with leader lines, turntable, an operation log
   of the fight's attacks on its timeline.
