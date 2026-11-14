# Chopping Block part lists

Each enemy's rigid parts, for [the art pipeline](../ART-PIPELINE.md): what each part does in the motion, a size budget and its pivot. Code poses every part. Nothing is rigged.

**How to read the tables**

- **Size** is the part's length × width × depth in metres, at the enemy's base scale. It comes from the capture sheets in [`whitebox/`](whitebox/).
- **Tris** is a ceiling for one part. Heroes may keep the generator's face count. The ceilings for swarm parts hold, because those parts draw by the hundred.
- **Count** is the number of instances in one enemy.
- **Pivot** follows the convention in the pipeline doc: metres, +Y up, +Z forward. A link's origin sits at its near joint and the link runs along +Y. A drum's axis is +X. A shell's origin is the enemy's root.
- **Pose input** is the lab state the rig reads (`swarm.js`, `elites.js`). The rig never writes it.
- **Mechanism** is the real machine the block-out is built from, so the shape comes from how it works rather than from the name.

Every enemy that has weak points uses the shared weak-point socket (`sims/dfl-kit/weakpoint.js`), in the enemy's accent colour.

---

## Spawners

### Censer

Whitebox 4.9 × 6.3 × 4.9 m: a lathe body with six hanging cones. **Mechanism:** a censer drum on a slewing ring, a camera-iris vent underneath that opens for each burst, and arms that hang as two-link pendulum chains. **Pose input:** drift, spin (−20°/s), bob, time to the next burst (3 s, then every 20 s), hits.

| Part | Count | Role in the motion | Size (m) | Tris | Pivot |
|---|---|---|---|---|---|
| Drum shell | 1 | Spins on the ring and bobs; flinches on a hit | 4.9 × 3.5 × 4.9 | 2,000 | root, at the drum's centre |
| Crown cap | 1 | Counter-spins slowly against the drum | 2.0 × 0.8 × 2.0 | 600 | its base centre, on the drum's axis |
| Vent iris blade | 6 | Swings open about 40° over 0.6 s before each burst (the tell), then shuts | 1.1 × 0.1 × 0.5 | 120 | its hinge pin on the vent ring; +X along the pin |
| Arm upper link | 6 | Pendulum from the rim; lags the spin and the drift | 1.6 × 0.35 × 0.35 | 200 | its rim joint |
| Arm lower link | 6 | Second pendulum link; trails the upper link | 1.5 × 0.25 × 0.25 | 160 | its knee joint |
| Arm hook | 6 | Rigid on the lower link | 0.5 × 0.3 × 0.15 | 100 | its joint with the lower link |
| Weak-point socket | 1 | Sits in the vent; glows on the burst count | shared | shared | shared |

### Twin Censer

The Censer's parts at 1.25× (whitebox 6.1 × 7.9 m). It adds a second vent iris and socket on the opposite side of the drum, so the two weak points face apart. The crown cap is swapped for a heavier two-tier cap (one new part, 2.5 × 1.1 m, 800 tris).

### Great Censer

The Censer's parts at 1.7× (whitebox 8.3 × 10.8 m), with three vent irises and sockets 120° apart. It adds an outer crown ring that spins the other way (one new part, 4.0 × 0.5 m, 900 tris), and its shell colour shifts toward the darker flesh tone.

---

## The swarm

### Ash Mote

Whitebox 0.84 m: a sphere with two eyes. Up to 500 draw at once, so the budget is tight. **Mechanism:** a single-crank ornithopter. One crank drives both wings, and the body banks into the turn. **Pose input:** heading, turn rate (bank), speed, its own wobble phase, fevered.

| Part | Count | Role in the motion | Size (m) | Tris | Pivot |
|---|---|---|---|---|---|
| Body | 1 | Banks with the turn rate and pitches with the climb | 0.84 × 0.7 × 0.84 | 160 | root, at the body's centre |
| Wing | 2 | Flaps about ±35° at 6-9 Hz, faster in tight turns | 0.6 × 0.05 × 0.35 | 30 | its root hinge; +X along the hinge; the right wing is a baked mirror copy |
| Jaw | 1 | Opens as it nears the player | 0.3 × 0.15 × 0.25 | 30 | its hinge under the eyes |

The whole Ash Mote is 250 tris or fewer. Fevered is a palette swap and emissive eyes.

### Stray

Whitebox 2.3 × 1.6 × 2.3 m. **Mechanism:** a robotic fish's multi-joint tail. The tail links follow the heading change with a lag, so its S-bends show in the body. **Pose input:** heading, turn rate, speed, fevered.

| Part | Count | Role in the motion | Size (m) | Tris | Pivot |
|---|---|---|---|---|---|
| Body | 1 | Banks into the turn | 1.6 × 1.4 × 1.6 | 500 | root |
| Fin pair (front) | 2 | Rows slowly and splays when it turns | 0.9 × 0.08 × 0.5 | 60 | its root hinge |
| Tail link | 3 | Each link yaws toward the last heading, lagging 0.1 s, 0.2 s and 0.3 s | 0.5 / 0.4 / 0.3 long | 80 | its front joint; the link runs along −Z, so the tail points backward |
| Tail fan | 1 | Rigid on the last link | 0.5 × 0.05 × 0.4 | 40 | its joint with the last link |
| Eye cluster | 1 | Rigid on the body | 0.5 × 0.3 × 0.2 | 60 | its seat on the body |

The whole Stray is 1,000 tris or fewer.

### Hound

Whitebox 2.3 m long, 1.1 m tall. **Mechanism:** variable-sweep wings. The wings sweep back as the turn tightens, so a Hound circling at 6 m looks like a dart. **Pose input:** heading, turn rate, speed, fevered.

| Part | Count | Role in the motion | Size (m) | Tris | Pivot |
|---|---|---|---|---|---|
| Fuselage | 1 | Banks hard (up to 60°) into the turn | 2.3 × 0.9 × 0.9 | 500 | root |
| Wing | 2 | Sweep angle 20-65°, from the turn rate | 1.2 × 0.06 × 0.5 | 60 | its glove pivot; +Y is the pivot axis |
| Jaw | 1 | Snaps open during the run-in | 0.6 × 0.2 × 0.4 | 80 | its hinge |
| Tail spike | 1 | Yaws a little against the bank | 0.8 × 0.15 × 0.15 | 40 | its root |

The whole Hound is 900 tris or fewer.

### Warden

Whitebox 4.9 × 3.4 × 4.0 m. **Mechanism:** articulated plate armour, like the overlapping plates of a lobster tail. Four plates slide over each other as it banks through its wide circle. **Pose input:** heading, turn rate, speed, fevered.

| Part | Count | Role in the motion | Size (m) | Tris | Pivot |
|---|---|---|---|---|---|
| Core hull | 1 | Banks gently | 3.8 × 2.6 × 3.2 | 1,200 | root |
| Armour plate | 4 | Each plate turns a share of the bank about a shared hinge line, so the plates fan | 3.6 × 0.3 × 1.2 | 200 | its hinge on the spine; +X along the hinge |
| Ram prow | 1 | Rigid at the front; it leads the sweep | 2.0 × 1.2 × 1.0 | 300 | its seat on the hull |
| Eye bank | 1 | Rigid; the eye cluster under the prow | 1.0 × 0.4 × 0.3 | 100 | its seat |

The whole Warden is 2,500 tris or fewer.

---

## Wyrms

### Spinewyrm

The lab already has this body: BONEPEDE II (`sims/bonepede2-shared/body.js`, posed by `wyrm.js`) at 4×. It is about 31 m long. Its parts are rigid and instanced, and they are listed here at the 4× scale. **Pose input:** the head's trail, the rowing phase, mandible open, per-segment hit and dead state.

| Part | Count | Role in the motion | Size (m) | Tris | Pivot |
|---|---|---|---|---|---|
| Skull | 1 | Rides the trail's head frame | 3.4 × 3.6 × 3.8 | 3,000 | root of the head frame |
| Brow plate | 1 | Rigid on the skull | 2.1 × 0.4 × 0.7 | 300 | its seat |
| Eye socket | 2 | Rigid; inset, it carries the glow | 0.5 × 0.4 × 0.25 | 60 | its seat |
| Crown spike | 2 | Rigid, raked back | 2.2 long | 80 | its base |
| Mandible | 2 | Swings open 0-0.8 rad on the mandible state | 2.0 long | 200 | its hinge; the left is modelled, the right is a baked mirror copy |
| Segment plate (dorsal) | 26 | Sits on the trail at 1.2 m spacing and rolls with the trail | 3.3 × 1.7 × 1.3 at the front | 300 | segment centre, +Z along the trail |
| Segment belly | 26 | Under the plate; holds the weak point | 2.5 × 1.5 × 1.3 at the front | 200 | segment centre |
| Femur | 52 | Rows in a wave from head to tail | 2.5 long | 60 | hip joint |
| Knee drum | 52 | Sits on the knee joint | 0.45 | 40 | joint centre; axis +X |
| Tibia | 52 | Hangs and trails the stroke | 3.8 long | 50 | knee joint |
| Dorsal spine (long, mid, short) | 26 | One per segment; longest over the back half | 3.8 / 2.8 / 1.6 long | 40 | its base on the plate |
| Side spine | 52 | A short pair per segment | 1.0-1.3 long | 30 | its base |
| Weak-point socket | 26 | Shared part, on the belly centreline | shared | shared | shared |

**Taper.** The body tapers to 0.6× at the tail. Today the code does this by stretching the plates per instance, which an even scale does not allow. The art has three plate and belly sizes (front, middle, tail), each scaled evenly, overlapping a little where the sizes change.

### Elder Spinewyrm

The Spinewyrm's parts at 5.5×. It swaps in two heavier meshes: a thicker plate (one new part) and the long dorsal spine with a barbed tip (one new part). Its colours are scarred and darker. It never burrows, so it needs no burrowing dust on the belly.

### Pale Spinewyrm

The Spinewyrm's parts at 5×, with no new meshes. A pale, see-through material, as the lab draws it today. The jaw and throat get an emissive inner glow, because it swallows seeking shards near its head and the player should be able to read that.

---

## Tithe-Taker

### Tithe-Taker

Whitebox 7.0 × 4.3 × 7.1 m. It has a carapace dome, a neck, a head and six legs. **Mechanism:**

- The neck is a telescopic hydraulic cylinder. Its stages slide out as the head rises over 3 s and drop back when it is hit. Today the code stretches the neck; the art has rigid stages that slide instead.
- The legs are hexapod two-bone legs, solved analytically (`twoBone` in `slumber-kit/parts.js`), with feet planted between dashes.
- The mouth is a clamshell grab, like a dredger's bucket. It opens when orbs are pulled in.
- An ovipositor chute ejects the eggs.

**Pose input:** position, dashes, yaw, head-up (0-1), ducking, eating, laying.

| Part | Count | Role in the motion | Size (m) | Tris | Pivot |
|---|---|---|---|---|---|
| Carapace | 1 | Root; tilts a little on each dash | 5.7 × 1.5 × 6.7 | 3,000 | root, at ground level under the centre |
| Underbody | 1 | Rigid; the leg mounts | 4.5 × 0.8 × 5.0 | 800 | root |
| Neck stage | 3 | Nested; each slides out its share of the head-up value | 1.2 / 1.0 / 0.8 wide, 0.8 long | 200 | its base on the stage below; slides along +Y |
| Head | 1 | Rises on the top stage, turns to face the player, ducks when hit | 2.1 × 1.7 × 2.1 | 1,500 | its joint with the neck |
| Eye | 1 | Rigid in the head; carries the accent colour | 0.7 | 100 | its seat |
| Clamshell jaw | 2 | Opens while it pulls orbs in and shuts on each orb eaten | 1.2 × 0.4 × 0.8 | 200 | its hinge; +X along the hinge |
| Leg femur | 6 | Two-bone solve from the hip to the planted foot | 2.0 long | 150 | hip joint |
| Leg knee drum | 6 | Sits on the knee joint | 0.4 | 60 | axis +X |
| Leg tibia | 6 | Two-bone solve; the foot stays planted through a dash and steps after it | 2.4 long | 150 | knee joint |
| Ovipositor | 1 | Pulses once per egg laid (1 s apart) | 1.4 × 0.6 × 0.6 | 300 | its root at the rear |

### Great Tithe-Taker

The Tithe-Taker's parts at 1.7× (whitebox 12.6 × 7.3 m). It adds an armour plate set over the carapace (one new part, 4 plates) and a fourth neck stage. The head rises over 9 s, so the stages slide slower.

### Tithe Egg

Whitebox 0.9 × 1.2 m. **Mechanism:** a burst disc. The shell is scored into five petals that split open at the hatch. **Pose input:** age (it swells faster as it nears 10 s), hatched.

| Part | Count | Role in the motion | Size (m) | Tris | Pivot |
|---|---|---|---|---|---|
| Shell petal | 5 | Closed together as the shell; the swell is an even scale on all five; at the hatch they hinge open 110° | 0.5 × 1.0 × 0.3 | 60 | its hinge at the base ring |
| Base ring | 1 | Rigid; sits on the floor | 0.9 × 0.2 × 0.9 | 80 | root |
| Yolk core | 1 | Shows through the cracks; pulses before the hatch | 0.6 | 60 | root |

### Tithe Mite

Whitebox 0.9 × 0.45 × 0.64 m. Up to 120 draw at once. **Mechanism:** a hexapod micro-robot on a tripod gait. Its legs are single links that cycle fast while it dashes and stop while it coasts. Its mandibles work as a gripper. **Pose input:** heading, dash or coast.

| Part | Count | Role in the motion | Size (m) | Tris | Pivot |
|---|---|---|---|---|---|
| Body | 1 | Pitches forward during a dash | 0.9 × 0.4 × 0.6 | 120 | root |
| Leg | 6 | Tripod gait: three swing while three stance, at 12 Hz in a dash and still while coasting | 0.45 long | 20 | hip joint; the right legs are baked mirror copies |
| Mandible | 2 | Snaps at the end of each dash | 0.3 long | 20 | its hinge |

The whole Tithe Mite is 300 tris or fewer.

---

## The Cantor

### The Cantor

Whitebox 11.4 m across and 11.4 m tall. **Mechanism:** a bell with a swinging clapper. The call is the clapper striking. Ten tentacles hang as three-link pendulum chains, and the six rim weak points are drums set into the bell's lip. **Pose input:** spin (14°/s once awake), bob, awake, calling, the call's progress, per-point health.

| Part | Count | Role in the motion | Size (m) | Tris | Pivot |
|---|---|---|---|---|---|
| Bell shell | 1 | Turns slowly and bobs; flares its lip during a call | 11.1 × 6.6 × 11.1 | 6,000 | root, at the bell's centre |
| Crown | 1 | Rigid on top; the suspension | 4.0 × 2.5 × 4.0 | 1,500 | its seat |
| Clapper | 1 | Swings inside the bell and strikes on each call; hidden from below until it swings | 1.8 × 4.0 × 1.8 | 800 | its hanging pivot; axis +X |
| Rim drum | 6 | Seats for the weak points; each one's cover blows off when that point dies | 1.7 × 1.5 × 1.7 | 400 | its seat on the lip |
| Tentacle link | 30 | Ten chains of three links; each chain is a pendulum that lags the spin and swings out during a call | 2.0 long each | 150 | its upper joint |
| Weak-point socket | 6 | Shared part, in the rim drums | shared | shared | shared |

The call ring stays an effect, not a mesh.

### Cantor's Eye

Whitebox a 4 m sphere. **Mechanism:** a gimbal camera with a two-blade shutter. The gimbal turns to watch the player, and the shutter blades close while it is stunned. **Pose input:** look direction, stunned, calling, landed.

| Part | Count | Role in the motion | Size (m) | Tris | Pivot |
|---|---|---|---|---|---|
| Eyeball | 1 | Turns in the gimbal to track the player | 4.0 | 2,000 | its centre |
| Iris and lens | 1 | Rigid in the ball; dilates (even scale) when it calls | 1.8 × 0.4 | 300 | its seat on the ball |
| Gimbal ring | 2 | The outer ring yaws, the inner ring pitches | 4.6 × 0.3 | 400 | ring centre; axis +Y (outer), +X (inner) |
| Shutter blade | 2 | Closes over the lens while it is stunned (hit in the last 0.3 s) | 2.6 × 1.4 × 0.2 | 200 | its hinge on the inner ring |
| Seat | 1 | The wreck of the Cantor's crown it lands in | 3.0 × 1.2 × 3.0 | 800 | root, at ground level |

---

## Obstacles

### Briar

Whitebox 2.9 × 5.0 × 4.2 m: nine cones in a cluster. **Mechanism:** a retractable bollard, the kind of road spike that rises from a ground collar. Today the code scales the cluster up from the floor. The art slides rigid spikes up instead. **Pose input:** rise (0-1 over about 3 s), hits.

| Part | Count | Role in the motion | Size (m) | Tris | Pivot |
|---|---|---|---|---|---|
| Ground collar | 1 | Rigid; the cracked floor ring the spikes rise through | 3.2 × 0.4 × 3.2 | 600 | root, at floor level |
| Spike, long | 3 | Slides up out of the collar, raked out | 5.0 long | 150 | its base; slides along its own +Y |
| Spike, mid | 3 | As above, staggered 0.2 s later | 4.0 long | 120 | its base |
| Spike, short | 3 | As above, staggered 0.4 s later | 3.0 long | 100 | its base |

Use three spike meshes at even scale, never one stretched spike.
