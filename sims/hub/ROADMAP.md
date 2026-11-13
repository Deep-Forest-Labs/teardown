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

## Done (2026-11-13, stages v2)

- **All nine stages rebuilt model-first** (`stages/<biome>.kin.js` pure model + `stages/<biome>.js` builder on the
  shared `stages/shell.js` and `stages/rig.js`). The stage value runs 0..3: **Run** (no boss, the arena as the player
  sees it most of the run), **Arrival**, **Phase 1**, **Phase 2** (the arena transforms around the prince's
  mechanic). Arena scale feeds the layout numbers (`ownsScale`) and never stretches the prince.
- **Numeric interlocks** per stage (`node tools/check-stages.mjs [id]`, scales 0.7 to 2.5): 328,872 checks pass.
  What each stage proves: Altar grips and iris, Void hooks and ramps, Ruins pillar slopes and planted feet, Gluttony
  mass and the tower climb, Greed lift spacing and the lean, Lust's petal stair, Wrath's drawbridges meeting mid-yard
  over the flood, Fraud's clause floor staying one piece and its mirrors meeting as the new floor, Treachery's exact
  lake tiling with jumpable drift gaps.
- **Review sheets:** `node tools/review.mjs <id> "<s>@<t>[@az,el,dist]; ..." out.png` (needs `CHROMIUM`).
- Biome thumbs show Phase 2; design.json carries `fight.range` 3, `fight.states` and `fight.ownsScale` for all nine.

## Next, in order

1. **Enemies, model-first** like the stages and the centipede: swarmer tier 1 first (then tiers 2 and 3), then the
   rest, each with its own kin file, checks and review sheet, saved as v1 checkpoints. Find a movement reference per
   enemy (the centipede gif was the bar).
2. **Prince detail inside the stages** (faces, plates, weak-point dressing) toward the teardown Pelagos flagship.
3. **Swarmer tier 1 polish**, then tiers 2 and 3; then the other base enemies to v1 (scorpion and quadruped first:
   Rob's four-legged IK monster wish fits the quadruped).
4. **Stage passes:** tune each arena's layout around its prince (the fights already change the layout), more
   pads and lifts where the board's movement unlock needs them.
5. **Phases tuning:** waves per layer instead of one template; spawn spots chosen by scale per wave.
6. **Console extras** from the teardown kit: exploded view, labels with leader lines, turntable, an operation log
   of the fight's attacks on its timeline.
