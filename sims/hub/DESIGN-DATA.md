# Bestiary design data (`design.json`, schema v1)

The SLUMBER Bestiary exports what it has tuned as one JSON document. The Unity bridge imports it, so the next Unity
arena blockouts, round data and enemy definitions follow what the team settled here.

- **Team default:** `sims/hub/design.json` in this fork, written by `tools/export-design.mjs` from the built page.
  It is also published at https://deep-forest-labs.github.io/teardown/design.json.
- **Your tuning:** the stage panel's **Export design.json** button writes the same shape with your current arena
  scales and enemy speed. To make your tuning the team default, replace `sims/hub/design.json` with it and commit.
- Arena scales you set are also remembered in your browser (per viewer). Unset arenas use the default scale.

Units: metres, seconds, radians. The player is 1.8 m tall.

## Top level

| Field | Meaning |
|---|---|
| `schema`, `version` | `slumber-bestiary-design`, `1` |
| `player` | run speed 12, gravity 18, jump 1.8, double jump 2.4, pad launch speed, height (from SLUMBER's `Player.asset` via the Levels board) |
| `tuning.enemySpeedMultiplier` | the stage's global enemy speed when exported |
| `defaults.arenaScale` | `{w, h}` applied to arenas nobody has scaled (1.4 wide, 1.2 tall: Luke leans to bigger arenas) |
| `arenas.<id>` | one per layer: `altar`, `void`, `ruins`, `gluttony`, `greed`, `lust`, `wrath`, `fraud`, `treachery` |
| `enemies.<id>` | one per base enemy, elite and prince |

## `arenas.<id>`

| Field | Meaning |
|---|---|
| `layer`, `name`, `sin`, `teaches` | from the Levels board |
| `scale {w, h}` | multiply the blockout's x and z by `w`, y by `h` |
| `scaleIsDefault` | true when nobody tuned this arena |
| `prince` | the prince's enemy id |
| `fight.phases` | the two phase names; the fight rig changes the layout between them (see `fights.js`, `fights2.js`) |
| `fight.secondsPerPlay` | the sandbox plays phase one then two in this many seconds |
| `fight.killY` | falling below this height kills (water, abyss) |
| `fight.spawn`, `fight.spawnSpots` | player spawn and the enemy spawn spots (portals), unscaled |
| `waves[]` | `{t, name, spawn: [{enemy, count, tier, spot, spots}], prince, note}`: the Phases-mode timeline; `spot`/`spots` index `fight.spawnSpots`; the wave with `prince: true` starts the fight |
| `fight.phaseAt`, `fight.phaseTrigger` | health fraction that starts phase two (0.5), and what triggers it |

## `enemies.<id>`

| Field | Meaning |
|---|---|
| `name`, `role`, `size`, `status`, `home` | card data (`status`: `game` built in Unity, `prototype` live teardown page, `draft` whitebox only) |
| `verb`, `tell`, `counter` | the design lines from the board |
| `weakPoint` | where its weak point is and when it opens, or `null` (tier 1 swarmers never have one) |
| `sizeM`, `dimensionsM` | body height in metres, plus length, span or tier heights where they matter |
| `attacks[]` | `{name, range, projectileSpeed, damage (null: Unity owns damage), tell, active, recover, ...}` |
| `flockSize`, `flockSizeByTier` | swarm skull only: skulls per spawn entry in the sandbox (Unity counts skulls; scale as needed) |
| `version`, `versions[]`, `tiers` | latest design checkpoint, the history, and per-tier numbers |
| `agents[]` | read from the live rig: `speed` (m/s), `turnRate` (rad/s), `accel`, `flies`, `hover` |
| `timings[]` | read from the live rig: each loop of named phases and its seconds, e.g. scorpion `{stalk 2.6, scrape 1, charge 1, recover 1.6}` |

Changing a stand-in's numbers in `standins.js` changes the export on the next run of `tools/export-design.mjs`.
