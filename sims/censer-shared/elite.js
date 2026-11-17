// THURIBLE CN-2 as the Altar's Censer elite (no three.js): the study's machine (kin.js) given a behaviour, in the
// Chopping Block's way: one rule with its own numbers, stepped by dt, and checks that simulate it.
//
// Move:  it stalks on its four legs at a walking pace, holding a standoff ring 12 to 20 m from the player: every 6 s it
//        picks a point on that ring near its own bearing from the player and walks there, staying on the floor.
// Aim:   it turns toward the player at a capped rate and leads them by the shot's flight time (two passes).
// Throw: the crank is clutched between throws. Each cycle the bowl's swing grows for WIND seconds (the tell: the
//        chain clinks louder as the swing widens), then the crank runs one turn at the speed that lands the shot on the
//        aim point: a faster crank throws further (kin.landing), 3 to 30 m. The shot leaves the cup at the release on
//        the quick stroke and flies ballistic; where it lands it pools (burning blood) for POOL.life seconds.
// Units: m, s, rad. The machine's frame: the throw goes along +z at yaw 0; yaw turns it about +y.
import {cup, landing, launch, RELEASE_THETA} from './kin.js';

const TAU = Math.PI * 2;
export const CN = {
  hp: 40,
  bowlR: 0.9, // the swinging bowl is the weak point (shot through its chains or the bowl)
  bodyR: 1.6, // the tower soaks shards
  walk: 1.6, // m/s
  standoff: [12, 20],
  regoal: 6, // s
  turn: 1.4, // rad/s
  wind: 1.6, // s of growing swing before each throw
  rest: 0.8, // s parked after a throw
  range: [3, 30],
  pool: {r: 1.6, life: 4, grow: 0.6},
  shotR: 0.35, // the burning load, for a direct hit
};

// crank speed for a landing distance: the table is monotonic (faster throws further), inverted by bisection
const OMEGA = {lo: 1.5, hi: 13};
export function omegaFor(dist) {
  let lo = OMEGA.lo;
  let hi = OMEGA.hi;
  for (let k = 0; k < 40; k++) {
    const mid = (lo + hi) / 2;
    if (landing(mid).at[2] < dist) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

// the crank turns this far from its parked angle (just after a release) to the next release
const RUNUP = TAU - 0.6;

export function newThurible(id, at, t, yaw = 0) {
  return {kind: 'thurible', id, p: [...at], yaw, theta: RELEASE_THETA + 0.6, omega: 0, phase: 'rest', since: t, goal: null, nextGoal: t, hp: CN.hp, alive: true, born: t, swing: 0.15, aim: null};
}
const rot = (v, yaw) => [v[0] * Math.cos(yaw) + v[2] * Math.sin(yaw), v[1], -v[0] * Math.sin(yaw) + v[2] * Math.cos(yaw)];
/** The cup's world position for the machine's current crank angle. */
export const cupWorld = (m) => {
  const c = rot(cup(m.theta), m.yaw);
  return [m.p[0] + c[0], m.p[1] + c[1], m.p[2] + c[2]];
};
/** The machine-frame bowl hang point in world space, and the bowl's centre for hits (it swings about ±0.6 rad). */
export const bowlWorld = (m) => {
  const b = rot([0, 3.3 - 1.1 * Math.cos(m.swingA || 0), -0.6 + 1.1 * Math.sin(m.swingA || 0)], m.yaw);
  return [m.p[0] + b[0], m.p[1] + b[1], m.p[2] + b[2]];
};

/**
 * Step one machine. player: {p: feet [x, y, z], v: [vx, vy, vz]}. floorR: the floor radius round the origin.
 * fire(shot) is called at a release with {p, v, t}; shots then fly under stepShot.
 */
export function stepThurible(m, player, t, dt, floorR, fire) {
  const pp = player.p;
  // move: a point on the standoff ring near its bearing from the player, inside the floor
  if (t >= m.nextGoal || !m.goal) {
    const b = Math.atan2(m.p[2] - pp[2], m.p[0] - pp[0]) + (((m.id * 7 + Math.floor(t)) % 5) - 2) * 0.25;
    const r = (CN.standoff[0] + CN.standoff[1]) / 2;
    let g = [pp[0] + r * Math.cos(b), pp[2] + r * Math.sin(b)];
    const gr = Math.hypot(g[0], g[1]);
    const lim = floorR - 3;
    if (gr > lim) g = [(g[0] * lim) / gr, (g[1] * lim) / gr];
    m.goal = g;
    m.nextGoal = t + CN.regoal;
  }
  const dxg = m.goal[0] - m.p[0];
  const dzg = m.goal[1] - m.p[2];
  const dg = Math.hypot(dxg, dzg);
  const dp = Math.hypot(pp[0] - m.p[0], pp[2] - m.p[2]);
  // it closes in when the player is out of reach and backs off when they are inside the ring
  if (dg > 0.5 && m.phase !== 'throw') {
    m.p[0] += (dxg / dg) * Math.min(dg, CN.walk * dt);
    m.p[2] += (dzg / dg) * Math.min(dg, CN.walk * dt);
  }
  if (dp < CN.standoff[0] - 2 || dp > CN.standoff[1] + 4) m.nextGoal = Math.min(m.nextGoal, t);
  // aim: lead by the crank's run to the release plus the flight time (two passes); locked once a throw starts, so the
  // crank speed and the facing agree at the release
  let aim = m.phase === 'throw' && m.fixAim ? m.fixAim : [pp[0], pp[2]];
  if (m.phase !== 'throw') {
    let T = 2;
    for (let k = 0; k < 2; k++) {
      aim = [pp[0] + (player.v?.[0] || 0) * T, pp[2] + (player.v?.[2] || 0) * T];
      const d = Math.hypot(aim[0] - m.p[0], aim[1] - m.p[2]);
      const w = omegaFor(Math.max(CN.range[0], Math.min(CN.range[1], d)));
      T = landing(w).T + RUNUP / w;
    }
  }
  m.aim = aim;
  const want = Math.atan2(aim[0] - m.p[0], aim[1] - m.p[2]); // yaw 0 throws along +z
  const dy = Math.atan2(Math.sin(want - m.yaw), Math.cos(want - m.yaw));
  m.yaw += Math.max(-CN.turn * dt, Math.min(CN.turn * dt, dy));
  // the throw cycle: rest (parked) -> wind (the swing grows) -> throw (one crank turn at the aimed speed)
  const age = t - m.since;
  if (m.phase === 'rest' && age >= CN.rest) [m.phase, m.since] = ['wind', t];
  else if (m.phase === 'wind' && age >= CN.wind) {
    const d = Math.hypot(aim[0] - m.p[0], aim[1] - m.p[2]);
    // only throws in range and roughly facing the aim; otherwise it keeps swinging (the tell holds)
    if (d >= CN.range[0] && d <= CN.range[1] && Math.abs(dy) < 0.15) {
      m.omega = omegaFor(d);
      m.fixAim = aim;
      [m.phase, m.since] = ['throw', t];
    }
  }
  if (m.phase === 'throw') {
    const before = m.theta;
    m.theta += m.omega * dt;
    // the release: θ passes RELEASE_THETA (mod 2π) on the quick stroke
    const k0 = Math.floor((before - RELEASE_THETA) / TAU);
    const k1 = Math.floor((m.theta - RELEASE_THETA) / TAU);
    if (k1 > k0) {
      const L = launch(m.omega);
      const c = rot(L.p, m.yaw);
      fire({p: [m.p[0] + c[0], m.p[1] + c[1], m.p[2] + c[2]], v: rot(L.v, m.yaw), t, pool: null});
      m.thrownAt = t;
    }
    // park just after the release (the arm forward, the cup empty)
    if (m.thrownAt != null && t > m.thrownAt && m.theta - RELEASE_THETA - k1 * TAU >= 0.6) {
      [m.phase, m.since] = ['rest', t];
      m.thrownAt = null;
    }
  }
  // the bowl's swing: small at rest, growing over the wind (the tell), full through the throw
  const u = m.phase === 'wind' ? Math.min(1, age / CN.wind) : m.phase === 'throw' ? 1 : 0;
  m.swing = 0.15 + 0.45 * u * u;
  m.swingA = m.swing * Math.sin(t * Math.sqrt(9.81 / 1.1));
  return m;
}

/** Fly a shot: ballistic under g; returns 'land' at the floor (it becomes a pool there), else null. */
export function stepShot(s, dt, floorY, g = 9.81) {
  s.v[1] -= g * dt;
  for (let k = 0; k < 3; k++) s.p[k] += s.v[k] * dt;
  if (s.p[1] <= floorY) {
    s.p[1] = floorY;
    return 'land';
  }
  return null;
}
/** A pool's radius at age a: it spreads to full size over POOL.grow s. */
export const poolR = (a) => CN.pool.r * Math.min(1, 0.3 + 0.7 * (a / CN.pool.grow));

// ---------------------------------------------------------------- checks
function run(target, secs, floorR = 40, start = [0, 0, -16]) {
  const m = newThurible(1, start, 0, 0);
  const shots = [];
  const lands = [];
  const tells = [];
  const dt = 1 / 120;
  for (let t = 0; t < secs; t += dt) {
    const pl = target(t);
    stepThurible(m, pl, t, dt, floorR, (s) => {
      shots.push(s);
      tells.push(m.swing);
    });
    for (const s of shots) {
      if (s.done) continue;
      if (stepShot(s, dt, 0)) {
        s.done = true;
        const at = target(t).p;
        lands.push({p: [...s.p], miss: Math.hypot(s.p[0] - at[0], s.p[2] - at[2]), t});
      }
    }
  }
  return {m, lands, tells};
}
export function checks() {
  const out = [];
  // a standing player at three distances: the shot lands within 1.5 m of the feet
  for (const d of [8, 14, 22]) {
    const r = run(() => ({p: [0, 0, 0], v: [0, 0, 0]}), 8, 40, [0, 0, -d]);
    const first = r.lands[0];
    out.push({name: `censer: lands on a standing player ${d} m away (within 1.5 m)`, ok: !!first && first.miss < 1.5, value: first ? `${first.miss.toFixed(2)} m` : 'no throw'});
  }
  // it leads a running player: someone running 8 m/s across its line at 15 m is hit within 2.5 m
  {
    // a straight run across its line at 8 m/s (a turn inside the lead time is a fair dodge, so the check runs straight)
    const r = run((t) => ({p: [-24 + 8 * t, 0, 0], v: [8, 0, 0]}), 6, 40, [0, 0, -15]);
    const best = r.lands.length ? Math.min(...r.lands.map((l) => l.miss)) : Infinity;
    out.push({name: 'censer: leads a player running straight across its line (within 2.5 m)', ok: best < 2.5, value: Number.isFinite(best) ? `${best.toFixed(2)} m over ${r.lands.length} throws` : 'no throw'});
  }
  // the tell: every throw comes at the full swing, and throws are at least rest + wind apart
  {
    const r = run(() => ({p: [0, 0, 0], v: [0, 0, 0]}), 20, 40, [0, 0, -14]);
    const gaps = r.lands.slice(1).map((l, i) => l.t - r.lands[i].t);
    out.push({name: 'censer: every throw comes at the full swing (the tell)', ok: r.tells.length >= 3 && r.tells.every((s) => s > 0.55), value: r.tells.map((s) => s.toFixed(2)).join(', ')});
    out.push({name: `censer: at most one throw per ${(CN.rest + CN.wind).toFixed(1)} s`, ok: gaps.every((g) => g >= CN.rest + CN.wind - 0.05), value: gaps.map((g) => g.toFixed(2)).join(', ')});
  }
  // it holds its standoff and stays on the floor
  {
    const r = run(() => ({p: [0, 0, 0], v: [0, 0, 0]}), 40, 24, [0, 0, -4]);
    const d = Math.hypot(r.m.p[0], r.m.p[2]);
    out.push({name: 'censer: walks out to its standoff ring (12-20 m) and stays on a 24 m floor', ok: d >= CN.standoff[0] - 1 && d <= Math.min(CN.standoff[1] + 1, 21), value: `${d.toFixed(1)} m`});
  }
  return out;
}
