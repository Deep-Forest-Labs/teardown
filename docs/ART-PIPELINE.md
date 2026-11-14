# Chopping Block art pipeline

How the Chopping Block roster goes from the lab's whiteboxes to game meshes for SLUMBER.

The lab (`sims/cb-shared`) is the source of truth for size, motion and how each enemy reads in play. Art follows the lab. It never changes behaviour or spawning, which the bestiary work owns.

The art is ours. Every design is drawn for SLUMBER, from our own names and mechanisms. No other game's names, shapes or art go into prompts, files or commits.

## Theme: the fleshy planet, on the Chopping Block

Luke's direction (2026-11-14): the Planet swarmer is the basis for every Chopping Block enemy, in the fleshy planet look. The arena stays the Chopping Block disc.

**The swarmer.** It is a cream flesh ball with two black dot eyes. Up close, a huge toothed mouth opens, with blood at the lips and cracked veins in the skin. It is not rigged. A turnaround sheet of it exists: `planet_swarmer/sheet/planet_sheet3.jpg` in the levels board's `concept_work`.

**Every enemy is a variation on that ball.**

- **Skin.** Cream, sticky flesh. Mouths, gums and veins in blood red. Black dot eyes. Skin strands stretch between parts that touch, like fused swarmers. The swarmer sheet has no outlines and soft painted rendering. The meshes keep value blocks big enough to survive the pixel filter.
- **Two reads.** From afar, every enemy reads as cute: round cream shapes with dot eyes. Up close it is grotesque: mouths, teeth, veins, blood. Mouths open on threat or attack states (a run-in, a burst, a call), so the grotesque read arrives with the danger.
- **Hierarchy by fusion.** Bigger enemies look like more swarmers fused together. A spawner is a swollen mother ball. A wyrm is a chain of fused balls. The boss is a great mass of them. Tier shows as size and how many balls have fused, not as a new creature language.
- **The mechanism stays.** The part lists in [`art/PARTS.md`](art/PARTS.md) are unchanged: the same rigid parts, motion roles, sizes and pivots. Flesh is the material and the skin over each part. The joints and links underneath still come from the mechanism.
- **Weak points are mouths or eyes,** in the blood-red accent, so the thing you shoot is the thing that looks hungry.
- **Strands.** As on the Planet, the black strands between swarmers are a runtime effect between touching neighbours, not part of any mesh. A fused look inside one enemy, like the skin between a wyrm's segments, is modelled on the parts.

## The five stages

| # | Stage | Output | Cost | Gate |
|---|---|---|---|---|
| 1 | Whitebox capture | Capture sheet and part plate per enemy | free | critic pass |
| 2 | Part block-out | Rigid part rig in the lab, recaptured | free | critic pass, Luke on the rig |
| 3 | Paintover | One part sheet per enemy (turnaround and exploded parts) | paid, one run per OK | Luke approves each sheet |
| 4 | Mesh | One GLB per part, pivots set, fitted at even scale | paid, one run per OK | fit check, Luke on the lab render |
| 5 | Hookup | Parts posed by code in the lab, then in Unity | free | lab before/after sheet, then Unity Play |

Each paid call needs Luke's own OK for that exact run in the session that makes it: provider, model, count, inputs and cost. A cap or an approval passed on by another session is not an OK. Concept images come from OpenRouter only. Never fal, and never a fallback to it.

## 1. Whitebox capture

```
set CHROMIUM=C:\Program Files\Google\Chrome\Application\chrome.exe
node sims/build.mjs cb-live
node tools/capture-cb.mjs                 # every enemy
node tools/capture-cb.mjs tithe cantor    # some
```

`tools/capture-cb.mjs` opens the built lab, turns spawning off, clears it, spawns one enemy and steps the real simulation a fixed time (no real clock). Then it freezes the pose and shoots it. The same command gives the same sheet. The only lab hooks are in `live.js`: `S.paused`, `S.cam`, and `clear`, `three` and `scene` on `window.CB`. They change no behaviour.

Each enemy gets these files in `teardown-out/art/<id>/`:

- `front`, `side`, `q3`, `top`: orthographic views at the size class's fixed scale, beside a 1.8 m figure, over a metre grid. The figure's feet are level with the enemy's lowest point.
- `fp`: the in-play view from 1.7 m eye height at a typical fighting distance, with the lab's 80° field of view.
- `front_mask`, `side_mask`: black-on-white silhouettes. A paintover has to keep this outline.
- `parts.png` and `parts.json`: the exploded part plate. It lays out every distinct rigid part of the pose at true scale, with how many times the pose uses it.
- `bounds.json`: bounds, centre, facing and the size class.

It also writes `sheets/<id>.png` and `sheets/<id>_parts.png`. Copies of those are committed in [`docs/art/whitebox/`](art/whitebox/).

**Size classes.** Each class has one scale, so enemies in the same class can be compared directly.

| Class | Frame height | Grid | Enemies |
|---|---|---|---|
| S | 6 m | 1 m | Ash Mote, Stray, Hound, Tithe Egg, Tithe Mite |
| M | 12 m | 1 m | Censer, Twin Censer, Warden, Tithe-Taker, Cantor's Eye, Briar |
| L | 24 m | 5 m | Great Censer, Great Tithe-Taker, the Cantor |
| XL | 56 m | 5 m | Spinewyrm, Elder Spinewyrm, Pale Spinewyrm |

**Facing.** Front is the enemy's heading. Without a heading, front faces the player at the arena centre. Side is the enemy's left. Top has its front pointing up the image.

## 2. Part block-out

Only the wyrms are built from real rigid parts today: BONEPEDE II's body, `sims/bonepede2-shared/body.js`, posed by `wyrm.js`. The other 14 whiteboxes are primitives: a sphere with two eyes, a lathe with cones. A paintover drawn over a sphere has nothing to follow, so these enemies need a part block-out before any paid paintover.

- Each enemy gets a part rig in `sims/cb-art/<enemy>.js`. Its parts and pivots come from [the part lists](art/PARTS.md), and it uses the shared machined-parts kit (`sims/slumber-kit/parts.js`).
- Every rig is a pure function `pose(state, t) → part transforms`. Its input is the lab's own agent state (heading, speed, turn rate, head-up, call, hits), the way `wyrm.js` poses the wyrm from its trail. The rig reads that state and never writes to it.
- Each rig starts from a real mechanism reference. The part lists name one per enemy. The shape comes from the mechanism, not from the enemy's name.
- The capture tool renders the rig in place of the lab's primitives, so the block-out has the same sheets. It goes into the live lab only once the bestiary work agrees. Until then the lab's primitives stay as they are.

## 3. Paintover

Each enemy gets one image from one call: a part sheet laid out from a template. Several separate calls drift apart, and one sheet keeps every part consistent. Generating all an enemy's tiers on one sheet worked before.

**Template.** A 4K canvas with two zones. The top zone holds a turnaround: front, side and three-quarter captures of the block-out. The bottom zone holds the exploded part plate. Each part sits in its own cell at true scale, with its id. Cells are spaced well apart so the mesh stage can separate the parts.

**Inputs to the call.**

- The template.
- The silhouette masks.
- The Planet swarmer sheet (`planet_sheet3.jpg`), for both the creature language and the rendering: soft painted, with no outlines, as Luke approved for the swarmer.
- A short brief from the enemy's lore and role. Not the card text.

**Rules.**

- **Silhouette and proportions** follow the whitebox. A script checks the turnaround against the masks: the outline must overlap at least 85% (intersection over union), or the run fails before Luke sees it.
- **Look.** The fleshy planet theme above, built for the pixel filter: solid value blocks and clear silhouettes that read at distance. Not low poly and not realistic texture. Blood red is the accent, and the weak points carry it.
- **Parts.** Every part is drawn separately in its cell, in the same pose and scale as the template. No part may grow into a neighbour, and no extra parts are invented.
- **Critic.** Before Luke sees a sheet, it is checked at the size it will be used: the full sheet, and the enemy at its in-play size in the first-person capture. A failing sheet is fixed or dropped, never shown.

**Model.** OpenRouter `google/gemini-3-pro-image-preview`, the model that takes 4K. It cost about $0.25 an image when last used. Check the price before asking for the OK.

## 4. Mesh

The movement stays in code. Each part is a separate rigid mesh. No rigging unless it is truly unavoidable. Nothing on the current roster needs it.

**One call per enemy.** Generate the bottom zone of the approved part sheet, the exploded plate, as one image-to-3D model. Because the parts were painted apart, the model comes back as separate pieces. Blender splits it into loose parts and matches each piece to its part id by cell position. A part that comes back fused or broken is the only thing re-run, alone, with its own OK. Simple parts, such as spikes, plain links and pins, may be modelled from the part list in a Blender script instead. A script fits the part to the pivots exactly, and the paintover gives its colours.

**Fit.**

- **Even scale.** Fit at the size budget's length. Width and depth may differ from the whitebox by up to 25%. Never stretch a part.
- **Pivots.** Set by script to the part's pivot convention (below). Then check numerically that pins sit on pins and links span their joints.
- **Colour.** Solid colour from a small palette texture or vertex colours, bright enough to survive the pixel filter. Hero parts keep the generator's face count. Swarm parts are held to the budgets in the part list, because hundreds of them draw at once.

**Pivot convention.** Every part follows it.

- Units are metres, with +Y up and +Z the enemy's forward.
- A link's origin is at its near joint, the one closer to the body. The link runs along +Y to its far joint, at its rest length.
- A drum or hinge part has its origin on the joint axis, and the axis is +X.
- A body or shell has its origin at the enemy's root, the point the lab moves, with +Z along the heading.
- Code may scale a part per instance, but only evenly, never along one axis. A spine that needs three lengths gets three meshes: long, mid and short.
- A part with a left and right hand, such as a mandible, is modelled on the left. The right one is a baked mirror copy, not a negative scale.

**Export.** One GLB per part, named `<enemy>_<part>.glb`, plus a `<enemy>.parts.json` that lists each part's id, pivot, rest length and budget.

## 5. Hookup

1. **Lab.** The rig from stage 2 loads the GLBs in place of its block-out parts, with the same pose function and the same instancing. The capture tool runs again. Each enemy gets a before and after sheet, whitebox beside meshed, from the same cameras. Luke judges that sheet and the moving lab.
2. **Unity.** Each part becomes a prefab. The pose function is ported to C# as a component that sets part transforms each frame from the enemy's state. Only the `slumber-code-owner` subagent writes that C#. The swarm (Ash Motes, Strays, Hounds, mites) draws through instancing per part. The planned swarmer skins pipeline (texture-sheet animation for near meshes, impostors far off) takes over at range. Judge it in Play from the player's camera.

## Variants

Variants reuse their family's parts with changes. They never become new designs.

| Variant | Family | What changes |
|---|---|---|
| Twin Censer | Censer | 1.25× scale, a second weak point and vent, heavier crown |
| Great Censer | Censer | 1.7× scale, three weak points, an extra crown ring, the darker shell colour |
| Elder Spinewyrm | Spinewyrm | 5.5× scale, thicker plate and spine meshes swapped in, scarred colours |
| Pale Spinewyrm | Spinewyrm | 5× scale, the same meshes, a pale see-through material, mouth glow to show it swallows shards |
| Great Tithe-Taker | Tithe-Taker | 1.7× scale, an armour plate set over the carapace, a longer neck stage |
| Fevered (Ash Mote, Stray, Hound, Warden) | each | The same meshes. Flushed, raw skin and open, bleeding mouths. A material change, plus the mouth held open. |

## Where things are

| What | Where |
|---|---|
| Capture tool | `tools/capture-cb.mjs` |
| Capture sheets and part plates | [`docs/art/whitebox/`](art/whitebox/) (copies); `teardown-out/art/` (full size, untracked) |
| Part lists | [`docs/art/PARTS.md`](art/PARTS.md) |
| Part rigs (stage 2) | `sims/cb-art/` (not built yet) |
| Paintovers, meshes | `_LOCAL/art/<enemy>/` until approved, then `docs/art/<enemy>/` and the SLUMBER repo |
