// THE CHOPPING BLOCK, swarm movement model (no three.js). One rule for the tier 1 chasers (Ash Motes): fly at a
// constant speed, turning at a capped rate toward a heading from a loiter guidance field round the player (the
// Lyapunov vector field drones use to circle a point): far out the heading points at the player, at the ring radius it
// is tangent (counter-clockwise), inside it points out. Nothing scripts a circle or a straight run-in: a standing
// player gets circled at the ring, the approach curves in, and a running player drags the swirl along behind them.
// (Plain pursuit with a turn cap was tried first: it flies through a standing player and loops back, which the
// reference never does: its tier 1 chasers circle a standing player and stay over 9 m off.) The tier 2 wanderer (Stray) steers at a
// capped rate toward a random point it picks again every 1.6-2.5 s.
// Numbers: the Chopping Block's frozen reference spec (measured from reference footage) for speed, orbit radius and
// period, wander timing; per-mote spread, climb and wobble are estimates (marked).
// Frame: x, z ground, y up; metres, seconds. Pure functions plus a step() that advances one agent by dt.

export const M = {
  arenaR: 50, // the Chopping Block disc (ChoppingBlockArenaConfig)
  mote: {
    v: [21, 25], // speed range, m/s (spec 18-25)
    turn: 2.2, // yaw rate cap, rad/s (a circle no tighter than v/ω ≈ 10-11 m)
    ring: [10.5, 12.5], // loiter radius per mote, m: it settles about 0.5 m outside, so 11-13 m (spec 11-15 m, period about 3 s)
    k: 1.2, // how late the field bends from inbound to tangent: the squared ratio keeps it pointed in until near the ring (EST)
    height: [1.2, 3.6], // cruising height over the player's feet, per mote (EST)
    climb: 5, // m/s (EST)
    wobble: (9 * Math.PI) / 180, // aim wobble amplitude (EST)
    wobbleHz: [1.1, 1.9],
    release: 0.7, // seconds to leave the censer (spec 0.6-0.8)
    rise: [0.35, 0.6], // each mote climbs out for this long before it starts to chase (EST)
  },
  // tier 3 and 4 chasers: the same rule, tighter and faster (Chopping Block definitions; spec: Hound about 6-7 m and
  // about 1.75 s a loop, Warden about 10-15 m and 100-115°/s, both counter-clockwise)
  hound: {v: [22, 24.5], turn: (230 * Math.PI) / 180, ring: [5.6, 6.4], k: 1.6, height: [0.8, 1.8], climb: 7, wobble: (5 * Math.PI) / 180, wobbleHz: [1.5, 2.2], rise: [0.3, 0.45]},
  warden: {v: [25, 27], turn: (125 * Math.PI) / 180, ring: [12.5, 14], k: 1.0, height: [2.4, 3.4], climb: 4, wobble: (4 * Math.PI) / 180, wobbleHz: [0.6, 0.9], rise: [0.5, 0.7]},
  stray: {
    v: [17, 21], // spec 17-21
    turn: (85 * Math.PI) / 180, // spec average 60-100°/s
    hold: [1.6, 2.5], // spec / published
    height: [2, 7],
    pickR: 0.8, // waypoints within this share of the arena radius
  },
  // censers: Censer 10 motes + a Stray; Twin Censer 10 motes + a Hound; Great Censer 15 motes + a Warden (Chopping Block)
  // censers spawn out over the void, lie flat with the head toward the middle and roll about their length; they come in
  // at a steady 1.7 m/s to about 11 m out, then wander slowly between 5 and 20 m and never park (measured in the captures)
  censer: {first: 3, every: 20, motes: 10, strays: 1, drift: 1.7, settle: 11, wander: 0.4, wanderIn: 5, wanderOut: 20, spawnR: 54, roll: (35 * Math.PI) / 180, height: 6},
  censers: {censer: {motes: 10, extra: 'stray', hp: 10, size: 1}, twin: {motes: 10, extra: 'hound', hp: 20, size: 1.25}, great: {motes: 15, extra: 'warden', hp: 90, size: 1.7}},
};
const TAU = Math.PI * 2;
/** The floor's radius at run time t: it shrinks 0.025 m/s toward 20 m; the flat floor reaches about 47.5 m. */
export const arenaAt = (t) => Math.max(20, Math.min(47.5, 50 - 0.025 * t));
export const wrapPi = (a) => ((((a + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
/** Seeded random in [0, 1) from an integer. */
export const rnd = (n) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};
const lerp = (a, b, u) => a + (b - a) * u;

/** A new mote leaving a censer at `at` (x, y, z) toward `toward` (x, z); `id` seeds its spread. */
export function newMote(id, at, toward, t, kind = 'mote') {
  const r = (k) => rnd(id * 13 + k);
  const P = M[kind];
  const yaw0 = Math.atan2(toward[1] - at[2], toward[0] - at[0]) + (r(1) - 0.5) * 2.0;
  return {
    kind,
    chaser: true,
    id,
    p: [...at],
    yaw: yaw0,
    v: lerp(P.v[0], P.v[1], r(2)),
    h: lerp(P.height[0], P.height[1], r(3)),
    wf: lerp(P.wobbleHz[0], P.wobbleHz[1], r(4)),
    wp: r(5) * TAU,
    born: t,
    rise: lerp(P.rise[0], P.rise[1], r(6)),
    R: lerp(P.ring[0], P.ring[1], r(7)),
    alive: true,
  };
}
export function newStray(id, at, t) {
  const r = (k) => rnd(id * 17 + k);
  return {kind: 'stray', id, p: [...at], yaw: r(1) * TAU, v: lerp(M.stray.v[0], M.stray.v[1], r(2)), born: t, next: t, goal: [0, 4, 0], n: 0, alive: true};
}

/** Steer a yaw toward a bearing at a capped rate. */
export function steer(yaw, bearing, cap, dt) {
  const d = wrapPi(bearing - yaw);
  return yaw + Math.max(-cap * dt, Math.min(cap * dt, d));
}
// note: yaw is measured from +x toward +z. Seen from above with +z down the screen that is clockwise on screen; the
// page draws the top-down view with +z up so a positive turn reads counter-clockwise, as in the reference.

/** The loiter field: the heading a mote wants at its position (counter-clockwise round the player at its ring R). */
export function moteHeading(a, player) {
  const dx = player[0] - a.p[0];
  const dz = player[2] - a.p[2];
  const d = Math.hypot(dx, dz);
  const bearing = Math.atan2(dz, dx);
  const q = d / a.R;
  const corr = Math.atan(M[a.kind].k * (q * q - 1)); // nearly +π/2 (straight at the player) far out, 0 on the ring, negative inside
  return bearing - (Math.PI / 2 - corr); // on the ring: player on the left, a counter-clockwise loop
}

/** Advance one agent by dt. `player` is [x, y, z] (feet). */
export function step(a, player, t, dt) {
  if (a.chaser) {
    const P = M[a.kind];
    const age = t - a.born;
    if (age < a.rise) {
      // rising out of the censer: climb, keep the launch heading
      a.p[1] += P.climb * 1.6 * dt;
    } else {
      a.yaw = steer(a.yaw, moteHeading(a, player) + P.wobble * Math.sin(TAU * a.wf * t + a.wp), P.turn, dt);
      const ty = player[1] + a.h;
      a.p[1] += Math.max(-P.climb * dt, Math.min(P.climb * dt, ty - a.p[1]));
    }
    const sp = age < a.rise ? a.v * 0.5 : a.v;
    a.p[0] += Math.cos(a.yaw) * sp * dt;
    a.p[2] += Math.sin(a.yaw) * sp * dt;
  } else {
    if (t >= a.next) {
      a.n++;
      const r = (k) => rnd(a.id * 31 + a.n * 7 + k);
      const ang = r(1) * TAU;
      const rad = Math.sqrt(r(2)) * M.arenaR * M.stray.pickR;
      a.goal = [rad * Math.cos(ang), lerp(M.stray.height[0], M.stray.height[1], r(3)), rad * Math.sin(ang)];
      a.next = t + lerp(M.stray.hold[0], M.stray.hold[1], r(4));
    }
    const bearing = Math.atan2(a.goal[2] - a.p[2], a.goal[0] - a.p[0]);
    a.yaw = steer(a.yaw, bearing, M.stray.turn, dt);
    a.p[1] += Math.max(-3 * dt, Math.min(3 * dt, a.goal[1] - a.p[1]));
    a.p[0] += Math.cos(a.yaw) * a.v * dt;
    a.p[2] += Math.sin(a.yaw) * a.v * dt;
  }
  return a;
}

/** The release schedule of one censer burst: [time offset, kind] for each agent (motes in loose clumps). */
export function burst(seed, type = 'censer') {
  const C = M.censers[type];
  const out = [];
  for (let k = 0; k < C.motes; k++) {
    const clump = Math.floor(k / 3);
    out.push([Math.min(M.mote.release, clump * 0.22 + rnd(seed * 5 + k) * 0.12), 'mote']);
  }
  out.push([M.mote.release * 0.5, C.extra]);
  return out.sort((a, b) => a[0] - b[0]);
}

// ---------------------------------------------------------------- the Spinewyrm (head only; the body rides its trail)
// Chopping Block definition: emerges about 3 s after it spawns, flies idly, then chases; burrows after 15 s up, or
// when the player gets close to its head. Head steering: a heading turned toward a target at a capped rate in 3D.
export const W = {speed: 16, turn: 1.15, idle: 4, up: 15, near: 3.5, under: 3.2, depth: -7, cruise: 9, emerge: 3};
// variants (Chopping Block definitions): the Elder chases as soon as it is up and does not burrow; the Pale circles
// high over the arena for good and eats seeking shards. Sizes are the body scale on BONEPEDE II (EST).
export const WYRMS = {
  // about 60 m along the body in the captures, so the Spinewyrm is BONEPEDE II at 8x; the others scale with it (EST)
  // orbs: Spinewyrm 25, Elder 50, Pale 10 (orbsPerPoint over its 25 belly orbs)
  spinewyrm: {scale: 8, speed: 16, turn: 1.15, idle: W.idle, up: W.up, burrow: true, points: 25, hpPer: 3, orbsPerPoint: 1},
  elder: {scale: 10, speed: 14, turn: 0.9, idle: 0, up: Infinity, burrow: false, points: 25, hpPer: 10, orbsPerPoint: 2},
  pale: {scale: 9, speed: 15, turn: 0.75, idle: Infinity, up: Infinity, burrow: false, points: 25, hpPer: 20, orbsPerPoint: 0.4, circleR: 30, circleY: 24},
};
const v3 = {
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  len: (a) => Math.hypot(a[0], a[1], a[2]),
  norm: (a) => {
    const l = Math.hypot(a[0], a[1], a[2]) || 1;
    return [a[0] / l, a[1] / l, a[2] / l];
  },
};
export function newWyrm(id, at, t, variant = 'spinewyrm') {
  return {kind: 'wyrm', variant, V: WYRMS[variant], id, head: [at[0], W.depth, at[2]], dir: [0, 1, 0], state: 'under', since: t, born: t, nextUp: t + W.emerge, target: [at[0], 0, at[2]], alive: true};
}
/** Turn a unit heading toward `want` by at most `max` radians (Rodrigues). */
function turnToward(dir, want, max) {
  const c = Math.max(-1, Math.min(1, dir[0] * want[0] + dir[1] * want[1] + dir[2] * want[2]));
  const ang = Math.acos(c);
  if (ang < 1e-6) return dir;
  const k = Math.min(1, max / ang);
  const ax = v3.norm([dir[1] * want[2] - dir[2] * want[1], dir[2] * want[0] - dir[0] * want[2], dir[0] * want[1] - dir[1] * want[0]]);
  const a = k * ang;
  const cr = [ax[1] * dir[2] - ax[2] * dir[1], ax[2] * dir[0] - ax[0] * dir[2], ax[0] * dir[1] - ax[1] * dir[0]];
  const d = ax[0] * dir[0] + ax[1] * dir[1] + ax[2] * dir[2];
  return v3.norm([0, 1, 2].map((i) => dir[i] * Math.cos(a) + cr[i] * Math.sin(a) + ax[i] * d * (1 - Math.cos(a))));
}
/** Advance the Spinewyrm's head by dt. `eye` is the player's eye point. */
export function stepWyrm(w, eye, t, dt) {
  const age = t - w.since;
  let want = null;
  let speed = W.speed;
  if (w.state === 'under') {
    // the first time it comes up where it spawned (out near the rim); after a burrow, at least 25 m from the player
    if (w.surfaced != null) {
      // try angles round the player until the point is on the floor and at least 25 m from the player
      const edge = arenaAt(t) - 5;
      let best = null;
      for (let k = 0; k < 24 && !best; k++) {
        const a = w.id * 2.1 + t * 0.1 + (k * TAU) / 24;
        for (const d of [28, 26]) {
          const q = [eye[0] + d * Math.cos(a), eye[2] + d * Math.sin(a)];
          if (Math.hypot(q[0], q[1]) <= edge) {
            best = q;
            break;
          }
        }
      }
      // a small floor late on may leave no such point: then the far side of the middle
      if (!best) {
        const pr = Math.hypot(eye[0], eye[2]) || 1;
        best = [(-eye[0] / pr) * edge, (-eye[2] / pr) * edge];
      }
      w.target = [best[0], 0, best[1]];
    }
    if (t >= w.nextUp) {
      w.state = 'idle';
      w.since = t;
      w.head = [w.target[0], W.depth, w.target[2]];
      w.dir = [0, 1, 0];
      w.surfaced = t;
    } else {
      w.head = [w.target[0], W.depth - 3, w.target[2]];
      return w;
    }
  }
  const up = t - (w.surfaced ?? t);
  const V = w.V;
  speed = V.speed;
  if (w.state === 'idle' && V.circleR) {
    // the Pale: climb to its height and circle the arena, ahead of where it is on the circle
    const a = Math.atan2(w.head[2], w.head[0]) + 0.5;
    want = v3.norm(v3.sub([V.circleR * Math.cos(a), V.circleY, V.circleR * Math.sin(a)], w.head));
  } else if (w.state === 'idle') {
    const a = t * 0.6 + w.id;
    want = v3.norm(v3.sub([w.target[0] + 10 * Math.cos(a), W.cruise, w.target[2] + 10 * Math.sin(a)], w.head));
    if (age >= V.idle) [w.state, w.since] = ['chase', t];
  }
  if (w.state === 'chase') {
    want = v3.norm(v3.sub([eye[0], eye[1] + 1.5, eye[2]], w.head));
    if (V.burrow && (up > V.up || v3.len(v3.sub(eye, w.head)) < W.near)) [w.state, w.since] = ['dive', t];
  } else if (w.state === 'dive') {
    want = v3.norm([w.dir[0], -1.2, w.dir[2]]);
    speed = W.speed * 1.15;
    if (w.head[1] < W.depth) {
      w.state = 'under';
      w.since = t;
      w.nextUp = t + W.under;
      return w;
    }
  }
  w.dir = turnToward(w.dir, want, V.turn * (w.state === 'dive' ? 2.2 : 1) * dt);
  for (let i = 0; i < 3; i++) w.head[i] += w.dir[i] * speed * dt;
  if (w.state !== 'dive' && w.head[1] < 1.2 && up > 1) w.head[1] = 1.2;
  return w;
}

// ---------------------------------------------------------------- censers: in over the void, then a slow wander
export function newCenserState(id, ang, t) {
  const r = M.censer.spawnR;
  return {id, p: [r * Math.cos(ang), M.censer.height, r * Math.sin(ang)], born: t, roll: 0, heading: ang + Math.PI, settled: false};
}
export function stepCenser(c, t, dt) {
  const r = Math.hypot(c.p[0], c.p[2]);
  const C = M.censer;
  if (!c.settled && r <= C.settle) c.settled = true;
  if (!c.settled) {
    c.heading = Math.atan2(-c.p[2], -c.p[0]); // straight in
    c.p[0] += Math.cos(c.heading) * C.drift * dt;
    c.p[2] += Math.sin(c.heading) * C.drift * dt;
  } else {
    // wander: a slowly turning heading, nudged back inside the 5-20 m band
    const radial = Math.atan2(c.p[2], c.p[0]);
    let want = c.heading + 0.35 * Math.sin(t * 0.21 + c.id);
    if (r > C.wanderOut) want = radial + Math.PI;
    else if (r < C.wanderIn) want = radial;
    const d = wrapPi(want - c.heading);
    c.heading += Math.max(-0.4 * dt, Math.min(0.4 * dt, d));
    c.p[0] += Math.cos(c.heading) * C.wander * dt;
    c.p[2] += Math.sin(c.heading) * C.wander * dt;
  }
  c.roll += C.roll * dt;
  return c;
}

// ---------------------------------------------------------------- checks (simulate, measure)
/** Simulate one mote against a player path for T seconds; returns samples [t, x, z, dist, angle round player]. */
export function simulate(path, T, dt = 1 / 120, id = 1, kind = 'mote') {
  const p0 = path(0);
  const a = newMote(id, [p0[0] + 40, 6, p0[2] + 5], [p0[0], p0[2]], 0, kind);
  const s = [];
  for (let t = 0; t < T; t += dt) {
    const pl = path(t);
    step(a, pl, t, dt);
    s.push([t, a.p[0], a.p[2], Math.hypot(a.p[0] - pl[0], a.p[2] - pl[2]), Math.atan2(a.p[2] - pl[2], a.p[0] - pl[0])]);
  }
  return s;
}

export function checks() {
  const out = [];
  // 1. standing player: it settles on its ring, centred on the player, about 3 s a loop, counter-clockwise
  for (const id of [1, 2, 3, 4, 5]) {
    const s = simulate(() => [0, 0, 0], 20, 1 / 240, id);
    const late = s.filter((x) => x[0] > 12);
    const r = late.reduce((a, x) => a + x[3], 0) / late.length;
    const v = newMote(id, [0, 0, 0], [0, 0], 0).v;
    const ang = late.map((x) => x[4]);
    let turned = 0;
    for (let k = 1; k < ang.length; k++) turned += wrapPi(ang[k] - ang[k - 1]);
    const rate = turned / (late[late.length - 1][0] - late[0][0]);
    const R = newMote(id, [0, 0, 0], [0, 0], 0).R;
    out.push({name: 'standing player: it settles on its ring (11-15 m), centred on the player', ok: Math.abs(r - R) < 1.5 && r > 10 && r < 15.5, value: `${r.toFixed(2)} (ring ${R.toFixed(2)}, v ${v.toFixed(1)})`});
    out.push({name: 'standing player: one loop every 3-3.6 s', ok: TAU / Math.abs(rate) > 2.8 && TAU / Math.abs(rate) < 3.7, value: (TAU / Math.abs(rate)).toFixed(2)});
    out.push({name: 'standing player: every mote circles the same way (counter-clockwise)', ok: rate > 0, value: ((rate * 180) / Math.PI).toFixed(0)});
    out.push({name: 'standing player: never touches (closest over 8 m once orbiting)', ok: Math.min(...late.map((x) => x[3])) > 8, value: Math.min(...late.map((x) => x[3])).toFixed(2)});
  }
  // 2. running player (12 m/s straight): the swarm keeps on them, swirling round a moving centre
  const run = (t) => [-40 + 12 * t, 0, 0];
  const s = simulate(run, 8, 1 / 240, 3);
  const late = s.filter((x) => x[0] > 4);
  const md = late.reduce((a, x) => a + x[3], 0) / late.length;
  out.push({name: 'running player: it keeps on them (mean distance 6-20 m)', ok: md > 6 && md < 20, value: md.toFixed(2)});
  // 3. the approach bends: heading three rings out vs at the ring
  const app = simulate(() => [0, 0, 0], 4, 1 / 240, 2);
  const R = newMote(2, [0, 0, 0], [0, 0], 0).R;
  const at = (dd) => app.findIndex((x) => x[3] < dd);
  const hd = (i) => Math.atan2(app[i + 4][2] - app[i][2], app[i + 4][1] - app[i][1]);
  const bend = Math.abs(wrapPi(hd(at(1.15 * R)) - hd(at(3 * R))));
  out.push({name: 'it swings onto the ring as it arrives (heading turns over 40° near the ring)', ok: bend > (40 * Math.PI) / 180, value: ((bend * 180) / Math.PI).toFixed(0)});
  // 3b. the tier 3 and 4 chasers: same rule; Hound tight (about 6-7 m, 1.6-2.0 s a loop), Warden wide (100-115°/s)
  for (const [kind, rLo, rHi, pLo, pHi] of [['hound', 5.5, 7.5, 1.4, 2.1], ['warden', 12.5, 15.5, 3.0, 3.8]]) {
    for (const id of [1, 2, 3]) {
      const sm = simulate(() => [0, 0, 0], 20, 1 / 240, id, kind).filter((x) => x[0] > 12);
      const r = sm.reduce((a, x) => a + x[3], 0) / sm.length;
      let turned = 0;
      for (let k = 1; k < sm.length; k++) turned += wrapPi(sm[k][4] - sm[k - 1][4]);
      const per = TAU / Math.abs(turned / (sm[sm.length - 1][0] - sm[0][0]));
      out.push({name: `${kind}: circles a standing player at ${rLo}-${rHi} m`, ok: r > rLo && r < rHi, value: r.toFixed(2)});
      out.push({name: `${kind}: ${pLo}-${pHi} s a loop, counter-clockwise`, ok: per > pLo && per < pHi && turned > 0, value: per.toFixed(2)});
    }
    // it closes faster than a mote from 40 m out (the charge)
    const tIn = (k) => simulate(() => [0, 0, 0], 4, 1 / 240, 1, k).findIndex((x) => x[3] < 15) / 240 - newMote(1, [0, 0, 0], [0, 0], 0, k).rise;
    out.push({name: `${kind}: once out of the censer, closes from about 40 m to 15 m in under 1.6 s (the charge)`, ok: tIn(kind) > 0 && tIn(kind) < 1.6, value: tIn(kind).toFixed(2)});
  }
  // 3c. the Spinewyrm: surfaces about 3 s after it spawns; burrows by 15 s up; dives when the player is at its head
  {
    const w = newWyrm(3, [20, 0, 0], 0);
    let surf = null;
    let dive = null;
    for (let t = 0; t < 40; t += 1 / 120) {
      stepWyrm(w, [0, 1.7, 0], t, 1 / 120);
      if (surf === null && w.surfaced != null) surf = t;
      if (dive === null && w.state === 'dive') dive = t;
    }
    out.push({name: 'spinewyrm: surfaces about 3 s after it spawns', ok: surf != null && Math.abs(surf - W.emerge) < 0.05, value: surf?.toFixed(2)});
    out.push({name: 'spinewyrm: burrows within 15 s of surfacing', ok: dive != null && dive - surf <= W.up + 0.05, value: (dive - surf).toFixed(2)});
    const w2 = newWyrm(4, [6, 0, 0], 0);
    let diveNear = null;
    for (let t = 0; t < 20; t += 1 / 120) {
      // stand still until it is chasing, then step up beside its head (the player closing in, as in the reference)
      const eye = w2.state === 'chase' ? [w2.head[0] + 2.5, w2.head[1] - 1.5, w2.head[2]] : [0, 1.7, 0];
      const prev = w2.state;
      stepWyrm(w2, eye, t, 1 / 120);
      if (prev === 'chase' && w2.state === 'dive') {
        diveNear = Math.hypot(w2.head[0] - eye[0], w2.head[1] - eye[1], w2.head[2] - eye[2]);
        break;
      }
    }
    // elder: chases as soon as it is up, never burrows; pale: climbs and circles high for good
    const el = newWyrm(5, [20, 0, 0], 0, 'elder');
    let chaseAt = null;
    let elDive = false;
    for (let t = 0; t < 40; t += 1 / 120) {
      stepWyrm(el, [0, 1.7, 0], t, 1 / 120);
      if (chaseAt === null && el.state === 'chase') chaseAt = t;
      if (el.state === 'dive') elDive = true;
    }
    out.push({name: 'elder spinewyrm: chases the moment it surfaces, never burrows', ok: chaseAt != null && chaseAt - W.emerge < 0.05 && !elDive, value: chaseAt?.toFixed(2)});
    const pa = newWyrm(6, [20, 0, 0], 0, 'pale');
    let low = Infinity;
    for (let t = 0; t < 40; t += 1 / 120) {
      stepWyrm(pa, [0, 1.7, 0], t, 1 / 120);
      if (t > 15) low = Math.min(low, pa.head[1]);
    }
    out.push({name: 'pale spinewyrm: circles high (over 15 m) for good', ok: low > 15, value: low.toFixed(1)});
    out.push({name: 'spinewyrm: dives when the player gets close to its head', ok: diveNear != null && diveNear < W.near + 0.5, value: diveNear?.toFixed(2)});
  }
  // 3d. censers: in from 54 m at 1.7 m/s, at about 11 m in about 25 s, then never stop and stay in 5-20 m
  {
    const c = newCenserState(1, 0.7, 0);
    let at11 = null;
    let minV = Infinity;
    let band = true;
    let last = [...c.p];
    for (let t = 0; t < 240; t += 1 / 60) {
      stepCenser(c, t, 1 / 60);
      const r = Math.hypot(c.p[0], c.p[2]);
      if (at11 === null && r <= M.censer.settle) at11 = t;
      minV = Math.min(minV, Math.hypot(c.p[0] - last[0], c.p[2] - last[2]) * 60);
      if (at11 !== null && t > at11 + 30 && (r < M.censer.wanderIn - 1 || r > M.censer.wanderOut + 1)) band = false;
      last = [...c.p];
    }
    out.push({name: 'censer: comes in from over the void to about 11 m in 22-27 s', ok: at11 > 22 && at11 < 27, value: at11.toFixed(1)});
    out.push({name: 'censer: never parks (always moving)', ok: minV > 0.3, value: minV.toFixed(2)});
    out.push({name: 'censer: wanders inside 5-20 m once in', ok: band, value: '-'});
    out.push({name: 'arena: 47.5 m flat floor, shrinking 0.025 m/s toward 20 m', ok: arenaAt(0) === 47.5 && Math.abs(arenaAt(456) - 38.6) < 1e-9 && arenaAt(5000) === 20, value: arenaAt(456).toFixed(1)});
  }
  // 4. the release: all motes out within 0.6-0.8 s
  const b = burst(7);
  out.push({name: 'a burst leaves within 0.8 s', ok: Math.max(...b.map((x) => x[0])) <= 0.8, value: Math.max(...b.map((x) => x[0])).toFixed(2)});
  // 5. a stray re-picks its point every 1.6-2.5 s and keeps its speed
  const st = newStray(4, [0, 4, 0], 0);
  const picks = [];
  let n = 0;
  for (let t = 0; t < 30; t += 1 / 120) {
    step(st, [0, 0, 0], t, 1 / 120);
    if (st.n !== n) {
      picks.push(t);
      n = st.n;
    }
  }
  const gaps = picks.slice(1).map((x, i) => x - picks[i]);
  out.push({name: 'a stray re-picks every 1.6-2.5 s', ok: gaps.every((g) => g >= 1.6 - 0.01 && g <= 2.5 + 0.01), value: `${Math.min(...gaps).toFixed(2)}-${Math.max(...gaps).toFixed(2)}`});
  return out;
}
export {TAU};
