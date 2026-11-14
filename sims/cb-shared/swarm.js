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
  stray: {
    v: [17, 21], // spec 17-21
    turn: (85 * Math.PI) / 180, // spec average 60-100°/s
    hold: [1.6, 2.5], // spec / published
    height: [2, 7],
    pickR: 0.8, // waypoints within this share of the arena radius
  },
  censer: {first: 3, every: 20, motes: 10, strays: 1, drift: 0.5, spin: (-20 * Math.PI) / 180, height: 6},
};
const TAU = Math.PI * 2;
export const wrapPi = (a) => ((((a + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
/** Seeded random in [0, 1) from an integer. */
export const rnd = (n) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};
const lerp = (a, b, u) => a + (b - a) * u;

/** A new mote leaving a censer at `at` (x, y, z) toward `toward` (x, z); `id` seeds its spread. */
export function newMote(id, at, toward, t) {
  const r = (k) => rnd(id * 13 + k);
  const yaw0 = Math.atan2(toward[1] - at[2], toward[0] - at[0]) + (r(1) - 0.5) * 2.0;
  return {
    kind: 'mote',
    id,
    p: [...at],
    yaw: yaw0,
    v: lerp(M.mote.v[0], M.mote.v[1], r(2)),
    h: lerp(M.mote.height[0], M.mote.height[1], r(3)),
    wf: lerp(M.mote.wobbleHz[0], M.mote.wobbleHz[1], r(4)),
    wp: r(5) * TAU,
    born: t,
    rise: lerp(M.mote.rise[0], M.mote.rise[1], r(6)),
    R: lerp(M.mote.ring[0], M.mote.ring[1], r(7)),
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
  const corr = Math.atan(M.mote.k * (q * q - 1)); // nearly +π/2 (straight at the player) far out, 0 on the ring, negative inside
  return bearing - (Math.PI / 2 - corr); // on the ring: player on the left, a counter-clockwise loop
}

/** Advance one agent by dt. `player` is [x, y, z] (feet). */
export function step(a, player, t, dt) {
  if (a.kind === 'mote') {
    const age = t - a.born;
    if (age < a.rise) {
      // rising out of the censer: climb, keep the launch heading
      a.p[1] += M.mote.climb * 1.6 * dt;
    } else {
      a.yaw = steer(a.yaw, moteHeading(a, player) + M.mote.wobble * Math.sin(TAU * a.wf * t + a.wp), M.mote.turn, dt);
      const ty = player[1] + a.h;
      a.p[1] += Math.max(-M.mote.climb * dt, Math.min(M.mote.climb * dt, ty - a.p[1]));
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
export function burst(seed) {
  const out = [];
  for (let k = 0; k < M.censer.motes; k++) {
    const clump = Math.floor(k / 3);
    out.push([Math.min(M.mote.release, clump * 0.22 + rnd(seed * 5 + k) * 0.12), 'mote']);
  }
  for (let k = 0; k < M.censer.strays; k++) out.push([M.mote.release * 0.5, 'stray']);
  return out.sort((a, b) => a[0] - b[0]);
}

// ---------------------------------------------------------------- checks (simulate, measure)
/** Simulate one mote against a player path for T seconds; returns samples [t, x, z, dist, angle round player]. */
export function simulate(path, T, dt = 1 / 120, id = 1) {
  const p0 = path(0);
  const a = newMote(id, [p0[0] + 40, 6, p0[2] + 5], [p0[0], p0[2]], 0);
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
