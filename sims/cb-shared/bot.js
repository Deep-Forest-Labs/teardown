// THE CHOPPING BLOCK's expert player as a plain module (no three.js, no page state), for other stages to drive their
// own player with. It is the expert bot from live.js, lifted with the same numbers: the 1:1 study keeps its own copy so
// its tuning never moves with a host. Units: m, s, rad. Positions are [x, y, z] (feet for the player).
//
// Move: circle-strafe round a centre pulled partway toward the nearest spawner or big threat, radius 13 to 23 m and
//       inside the floor, flipping direction every 8 to 12 s or when a Hound or Warden is ahead on the line. When a
//       horde mass is within 14 m it kites: runs straight away from the mass, bending along the floor's edge.
// Hop:  jumps when motes are close ahead on its line, the second jump at the top (a double jump).
// Aim:  only what is in reach; spawners first (inside 30 m), then a swarm as its fullest 30° slice (three or more
//       motes inside 18 m), chargers inside 25 m, wanderers inside 15 m, a lone mote 6 to 22 m out, then whatever the
//       host adds. Led by the target's velocity. The hand turns at 20 rad/s and fires only within 0.07 rad.
// Gun:  the stream; the shotgun when the target is inside 12 m (a fresh aim each burst).

export const BOT = {
  shardSpeed: 120,
  shardLife: 0.34, // about 40 m of reach
  slew: 20, // rad/s
  onTarget: 0.07, // rad
  shotgunIn: 12, // m
  kiteIn: 14, // m: a horde mass this close is run from
  strafe: [13, 23], // m: the strafing circle's radius swings between these
  edgeKeep: 8, // m: the circle stays this far inside the floor
};
const TAU = Math.PI * 2;
const rnd = (n) => {
  const s = Math.sin(n * 12.9898) * 43758.5453;
  return s - Math.floor(s);
};
export const botReach = () => BOT.shardSpeed * BOT.shardLife * 0.92;

/** A fresh bot state. */
export function newBot() {
  return {dir: 1, flipAt: 8, centre: null, hand: null, moveDir: [1, 0]};
}

/**
 * The move direction [x, z] (unit) for this step.
 * w: {p: player feet, t, dt, floorR, censers: [{p}], threats: [{p}] (elites or princes to close on),
 *     agents: [{kind, p}] (the swarm: kind mote, stray, hound, warden)}
 */
export function botMove(b, w) {
  const {p, t, dt, floorR} = w;
  // the strafing circle's centre: partway toward the nearest spawner or big threat
  let best = null;
  let bd = Infinity;
  for (const q of [...(w.censers || []), ...(w.threats || [])]) {
    const d = Math.hypot(q.p[0] - p[0], q.p[2] - p[2]);
    if (d < bd) [best, bd] = [q.p, d];
  }
  let sc = [0, 0];
  if (best) {
    sc = [best[0] * 0.55, best[2] * 0.55];
    const r = Math.hypot(sc[0], sc[1]);
    const lim = Math.max(0, floorR - BOT.strafe[0] - 4);
    if (r > lim) sc = r > 0 ? [(sc[0] * lim) / r, (sc[1] * lim) / r] : [0, 0];
  }
  b.centre = b.centre ? b.centre.map((x, i) => x + (sc[i] - x) * Math.min(1, dt * 0.6)) : sc;
  const rx = p[0] - b.centre[0];
  const rz = p[2] - b.centre[1];
  const ang = Math.atan2(rz, rx);
  const r = Math.hypot(rx, rz);
  const swing = BOT.strafe[0] + (BOT.strafe[1] - BOT.strafe[0]) * (0.5 + 0.5 * Math.sin(t * 0.37));
  const want = Math.max(4, Math.min(swing, floorR - BOT.edgeKeep - Math.hypot(...b.centre)));
  const radial = Math.max(-1, Math.min(1, (want - r) / 4));
  let mx = -Math.sin(ang) * b.dir + Math.cos(ang) * radial;
  let mz = Math.cos(ang) * b.dir + Math.sin(ang) * radial;
  let l = Math.hypot(mx, mz) || 1;
  mx /= l;
  mz /= l;
  // kite a horde mass: run straight away from it, bending along the floor's edge
  const ms = (w.agents || []).filter((a) => a.kind === 'mote' && Math.hypot(a.p[0] - p[0], a.p[2] - p[2]) < BOT.kiteIn);
  if (ms.length > 5) {
    const c = ms.reduce((q, a) => [q[0] + a.p[0] / ms.length, q[1] + a.p[2] / ms.length], [0, 0]);
    let ax = p[0] - c[0];
    let az = p[2] - c[1];
    const pr = Math.hypot(p[0], p[2]);
    const edge = floorR - 6;
    if (pr > edge * 0.7 && pr > 0) {
      const tx = -p[2] / pr;
      const tz = p[0] / pr;
      const side = tx * ax + tz * az >= 0 ? 1 : -1;
      const k = Math.min(1, (pr - edge * 0.7) / (edge * 0.3));
      ax = ax * (1 - k) + tx * side * k * 2 - (p[0] / pr) * k;
      az = az * (1 - k) + tz * side * k * 2 - (p[2] / pr) * k;
    }
    l = Math.hypot(ax, az) || 1;
    mx = ax / l;
    mz = az / l;
  }
  // turn back when a charger is ahead on the line, and every 8 to 12 s anyway
  let ahead = false;
  for (const a of w.agents || []) {
    if (a.kind !== 'hound' && a.kind !== 'warden') continue;
    const dx = a.p[0] - p[0];
    const dz = a.p[2] - p[2];
    const d = Math.hypot(dx, dz);
    if (d < 12 && (dx * mx + dz * mz) / d > 0.5) ahead = true;
  }
  if (t > b.flipAt || ahead) {
    b.dir *= -1;
    b.flipAt = t + 8 + 4 * rnd(Math.floor(t));
  }
  b.moveDir = [mx, mz];
  return b.moveDir;
}

/** True when the bot should press jump now (motes close ahead on its line; the second jump near the top). */
export function botHop(b, p, agents, grounded, vy, airJumpsLeft) {
  const dir = b.moveDir;
  for (const a of agents) {
    if (a.kind !== 'mote') continue;
    const dx = a.p[0] - p[0];
    const dz = a.p[2] - p[2];
    const d = Math.hypot(dx, dz);
    if (d < 4 && a.p[1] < p[1] + 2.2 && (dx * dir[0] + dz * dir[1]) / (d || 1) > 0.2) return grounded || (vy < 0.5 && airJumpsLeft);
  }
  return false;
}

/**
 * The bot's target, led: {aim: [x, y, z] (not unit), dist} or null.
 * w: {eye, censers: [{p}], agents: [{kind, p, yaw, v}], extra: [{p, v?, score}] (host targets: score is a distance
 *     weight like the ones above; lower wins)}
 */
export function botTarget(w) {
  const {eye} = w;
  const REACH = botReach();
  const dist = (q) => {
    const d = Math.hypot(q[0] - eye[0], q[1] - eye[1], q[2] - eye[2]);
    return d < REACH ? d : Infinity;
  };
  let best = null;
  let bs = Infinity;
  for (const c of w.censers || []) {
    const d = dist(c.p);
    const s = d < 30 ? d * 0.4 : Infinity;
    if (s < bs) [best, bs] = [{p: c.p, v: [0, 0, 0]}, s];
  }
  const agents = w.agents || [];
  const near = agents.filter((a) => a.kind === 'mote' && dist(a.p) < 18);
  if (near.length >= 3) {
    const bins = Array.from({length: 12}, () => []);
    for (const a of near) bins[Math.floor(((Math.atan2(a.p[2] - eye[2], a.p[0] - eye[0]) + Math.PI) / TAU) * 12) % 12].push(a);
    const full = bins.reduce((m, q) => (q.length > m.length ? q : m), []);
    if (full.length >= 2) {
      const c = [0, 0, 0];
      const v = [0, 0, 0];
      for (const a of full) {
        for (let k = 0; k < 3; k++) c[k] += a.p[k] / full.length;
        v[0] += (Math.cos(a.yaw) * (a.v || 0)) / full.length;
        v[2] += (Math.sin(a.yaw) * (a.v || 0)) / full.length;
      }
      const s = 6 - Math.min(3, full.length * 0.4);
      if (s < bs) [best, bs] = [{p: c, v}, s];
    }
  }
  for (const a of agents) {
    const d = dist(a.p);
    const s = a.kind === 'hound' || a.kind === 'warden' ? (d < 25 ? d * 0.3 : Infinity) : a.kind === 'stray' ? (d < 15 ? d : Infinity) : near.length < 3 && d > 6 && d < 22 ? d * 1.2 : Infinity;
    if (s < bs) [best, bs] = [{p: a.p, v: [Math.cos(a.yaw) * (a.v || 0), 0, Math.sin(a.yaw) * (a.v || 0)]}, s];
  }
  for (const x of w.extra || []) {
    const d = dist(x.p);
    const s = Number.isFinite(d) ? d * x.score : Infinity;
    if (s < bs) [best, bs] = [{p: x.p, v: x.v || [0, 0, 0]}, s];
  }
  if (!best) return null;
  const d = dist(best.p);
  if (!Number.isFinite(d)) return null;
  const tf = d / BOT.shardSpeed;
  return {aim: [best.p[0] + best.v[0] * tf - eye[0], best.p[1] - eye[1], best.p[2] + best.v[2] * tf - eye[2]], dist: d};
}

/** Turn the hand toward `aim` at the capped rate. Returns {dir: the hand (unit), on: within the firing cone}. */
export function botSlew(b, aim, dt) {
  const l = Math.hypot(...aim) || 1;
  const want = aim.map((x) => x / l);
  const cur = b.hand && b.hand.every(Number.isFinite) ? b.hand : want;
  const dot = Math.max(-1, Math.min(1, cur[0] * want[0] + cur[1] * want[1] + cur[2] * want[2]));
  const ang = Math.acos(dot);
  const step = Math.min(ang, BOT.slew * dt);
  if (ang < 1e-6) b.hand = want;
  else {
    // a true turn by `step` toward the target, in the plane of the two (any plane when they are opposite)
    let perp = want.map((x, i) => x - cur[i] * dot);
    let pl = Math.hypot(...perp);
    if (pl < 1e-6) {
      perp = Math.abs(cur[1]) < 0.9 ? [-cur[2], 0, cur[0]] : [0, -cur[2], cur[1]];
      pl = Math.hypot(...perp);
    }
    b.hand = cur.map((x, i) => x * Math.cos(step) + (perp[i] / pl) * Math.sin(step));
  }
  return {dir: b.hand, on: ang - step < BOT.onTarget};
}

// ---------------------------------------------------------------- checks
export function checks() {
  const out = [];
  // aims at the fullest slice of a swarm, not its middle (a ring of motes round the player has its middle on the player)
  {
    const agents = [];
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU;
      agents.push({kind: 'mote', p: [8 * Math.cos(a), 1, 8 * Math.sin(a)], yaw: 0, v: 0});
    }
    for (let i = 0; i < 5; i++) agents.push({kind: 'mote', p: [8 + i * 0.2, 1, 0.3 * i], yaw: 0, v: 0});
    const r = botTarget({eye: [0, 1.7, 0], agents});
    out.push({name: 'bot: aims at the fullest slice of a ring of motes', ok: !!r && r.aim[0] > 6, value: r ? r.aim.map((x) => x.toFixed(1)).join(', ') : 'none'});
  }
  // a spawner in reach wins over a lone mote
  {
    const r = botTarget({eye: [0, 1.7, 0], censers: [{p: [20, 6, 0]}], agents: [{kind: 'mote', p: [0, 1, 10], yaw: 0, v: 20}]});
    out.push({name: 'bot: a spawner in reach is shot first', ok: !!r && r.aim[0] > 15, value: r ? r.aim.map((x) => x.toFixed(1)).join(', ') : 'none'});
  }
  // the hand slews at 20 rad/s: a half turn takes about 0.16 s, and it fires only on target
  {
    const b = newBot();
    b.hand = [1, 0, 0];
    let tOn = null;
    for (let t = 0; t < 1; t += 1 / 60) if (botSlew(b, [-1, 0, 0.001], 1 / 60).on && tOn == null) tOn = t;
    out.push({name: 'bot: a half turn of the hand takes about 0.16 s', ok: tOn != null && tOn > 0.12 && tOn < 0.22, value: tOn?.toFixed(3)});
  }
  // the strafe stays on a 30 m floor for a minute and keeps moving
  {
    const b = newBot();
    const p = [0, 0, 5];
    let maxR = 0;
    let path = 0;
    for (let t = 0; t < 60; t += 1 / 60) {
      const [mx, mz] = botMove(b, {p, t, dt: 1 / 60, floorR: 30, censers: [], agents: []});
      p[0] += mx * 12 / 60;
      p[2] += mz * 12 / 60;
      path += 12 / 60;
      maxR = Math.max(maxR, Math.hypot(p[0], p[2]));
    }
    out.push({name: 'bot: strafes inside a 30 m floor for a minute', ok: maxR < 28, value: `max ${maxR.toFixed(1)} m, ran ${path.toFixed(0)} m`});
  }
  return out;
}
