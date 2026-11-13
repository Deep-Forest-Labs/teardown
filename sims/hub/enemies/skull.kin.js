// Swarm skull tier 1, model only (no three.js). Every skull's pose is a pure function of time and the target point,
// so the same t gives the same flock on every machine (lockstep-friendly; no hidden velocities to drift).
//
// Reference: a fish school under threat mills in a torus and leaves a hole (a vacuole) round the predator (Muller,
// TU Delft; "rotating animal groups", Quart Rev Biol). Here the skulls are the predators and the player is the
// hole: the flock mills on a twisted torus round them, and one skull at a time peels off the ring, cuts through the
// hole (the bite) and rejoins its own slot on the far side. Consecutive strikers are ring neighbours, so the strikes
// read as one ribbon peeling off the turning ring.
//   MILL    on the torus: ring angle θ = ω t + 2π i / n, tube angle ψ = twist · θ (a helix wound round the ring)
//   TELL    the jaw chatters faster for the last moments before a skull peels off
//   STRIKE  a cubic Hermite from its ring point, through the bite point at the hole's centre, back to its own slot:
//           position and velocity match the ring at both ends, so nothing pops
// No weak point: tier 1 dies to one hit and is drawn as impostors in the game.
import {v} from '../stages/rig.js';

export const SPEC = {
  n: 28,
  size: 0.28,
  ring: {R: 4.5, r: 1.1, h: 1.6, omega: 1.1, twist: 3},
  cycle: 9, // each skull strikes once per cycle; the flock strikes every cycle / n seconds
  strike: 1.3,
  tell: 0.8, // seconds of chatter before a strike
  biteY: 1.1, // the bite point above the target (the player's chest)
  biteR: 0.98, // a skull within this of the bite point bites (size + 0.7, as in v1)
  maxMill: 9,
  maxStrike: 15,
  minSep: 0.6,
};
const TAU = Math.PI * 2;

/** A skull's slot on the turning ring, and its velocity. */
function mill(i, t, P) {
  const {R, r, h, omega, twist} = SPEC.ring;
  const th = omega * t + (TAU * i) / SPEC.n;
  const ps = twist * th;
  const rad = R + r * Math.cos(ps);
  const p = [P[0] + Math.cos(th) * rad, P[1] + h + r * Math.sin(ps), P[2] + Math.sin(th) * rad];
  const dRad = -r * Math.sin(ps) * twist * omega;
  const vel = [-Math.sin(th) * omega * rad + Math.cos(th) * dRad, r * Math.cos(ps) * twist * omega, Math.cos(th) * omega * rad + Math.sin(th) * dRad];
  return {p, vel};
}

const herm = (a, va, b, vb, u, h) => {
  const u2 = u * u;
  const u3 = u2 * u;
  const h00 = 2 * u3 - 3 * u2 + 1;
  const h10 = u3 - 2 * u2 + u;
  const h01 = -2 * u3 + 3 * u2;
  const h11 = u3 - u2;
  return [0, 1, 2].map((k) => h00 * a[k] + h10 * h * va[k] + h01 * b[k] + h11 * h * vb[k]);
};

/** Where skull i is in its cycle: τ < 0 before a strike (tell when τ > -tell/strike), 0..1 striking. */
function phase(i, t) {
  const start = (i * SPEC.cycle) / SPEC.n;
  const local = (((t - start) % SPEC.cycle) + SPEC.cycle) % SPEC.cycle;
  const t0 = t - local; // when this cycle's strike began
  return {tau: local / SPEC.strike, t0, untilNext: SPEC.cycle - local};
}

/** One skull's position at time t (strikes on or off). */
export function skullAt(i, t, P, strikes = true) {
  const m = mill(i, t, P);
  if (!strikes) return {p: m.p, state: 'mill', tau: -1};
  const {tau, t0, untilNext} = phase(i, t);
  if (tau >= 1) return {p: m.p, state: untilNext < SPEC.tell ? 'tell' : 'mill', tau: -untilNext / SPEC.strike};
  const A = mill(i, t0, P);
  const C = mill(i, t0 + SPEC.strike, P);
  const B = [P[0], P[1] + SPEC.biteY, P[2]];
  const hh = SPEC.strike / 2;
  // through the bite point along the chord from where it left to where it rejoins
  const vB = v.mul(v.norm(v.sub(C.p, A.p)), (v.dist(A.p, B) + v.dist(B, C.p)) / SPEC.strike);
  const p = tau < 0.5 ? herm(A.p, A.vel, B, vB, tau * 2, hh) : herm(B, vB, C.p, C.vel, tau * 2 - 1, hh);
  return {p, state: 'strike', tau};
}

/** The whole flock at time t round target P. */
export function model(t, P = [0, 0, 0], {strikes = true} = {}) {
  const S = SPEC;
  const skulls = [];
  const dt = 1 / 240;
  for (let i = 0; i < S.n; i++) {
    const a = skullAt(i, t - dt, P, strikes);
    const b = skullAt(i, t + dt, P, strikes);
    const c = skullAt(i, t, P, strikes);
    const vel = v.mul(v.sub(b.p, a.p), 1 / (2 * dt));
    const fwd = v.norm(vel);
    // the jaw: idle chatter, faster and wider in the tell, gaping through the strike
    const tellK = c.state === 'tell' ? 1 + c.tau / (S.tell / S.strike) : 0; // 0 → 1 across the tell
    const gape = c.state === 'strike' ? Math.sin(Math.PI * c.tau) : 0;
    const jaw = 0.08 + 0.08 * Math.sin(t * (12 + 18 * tellK) + i) * (1 + tellK) + 0.55 * gape;
    skulls.push({i, p: c.p, vel, fwd, speed: v.len(vel), state: c.state, tau: c.tau, jaw});
  }
  const bite = [P[0], P[1] + S.biteY, P[2]];
  return {skulls, bite, biting: skulls.filter((k) => v.dist(k.p, bite) < S.biteR).map((k) => k.i)};
}

/** Draw lists for stages/rig.js: a cranium ball, a brow, two dark sockets and a hinged jaw per skull. */
export function drawList(m) {
  const s = SPEC.size;
  const out = {tubes: [], slabs: [], balls: []};
  for (const k of m.skulls) {
    const f = k.fwd;
    let right = [f[2], 0, -f[0]]; // up × fwd
    if (Math.hypot(right[0], right[2]) < 1e-6) right = [1, 0, 0];
    right = v.norm(right);
    const up = [f[1] * right[2] - f[2] * right[1], f[2] * right[0] - f[0] * right[2], f[0] * right[1] - f[1] * right[0]];
    const at = (x, y, z) => v.add(k.p, v.add(v.mul(right, x * s), v.add(v.mul(up, y * s), v.mul(f, z * s))));
    out.balls.push({k: 'bone', p: at(0, 0.05, 0), r: s});
    out.slabs.push({k: 'bone', p: at(0, 0.4, 0.65), up, fwd: f, s: [s * 1.5, s * 0.25, s * 0.5]});
    for (const sx of [-1, 1]) out.slabs.push({k: 'socket', p: at(sx * 0.38, 0.12, 0.9), up, fwd: f, s: [s * 0.42, s * 0.32, s * 0.2]});
    // the jaw hangs from a hinge under the cranium and swings down by k.jaw
    const j = k.jaw;
    const jf = v.add(v.mul(f, Math.cos(j)), v.mul(up, -Math.sin(j)));
    const ju = v.add(v.mul(up, Math.cos(j)), v.mul(f, Math.sin(j)));
    const hinge = at(0, -0.45, 0.1);
    out.slabs.push({k: 'bone', p: v.add(hinge, v.add(v.mul(jf, s * 0.45), v.mul(ju, -s * 0.12))), up: ju, fwd: jf, s: [s * 1.1, s * 0.3, s * 0.95]});
  }
  return out;
}

/** Numeric interlocks over a sweep of t, for a still target and a moving one. */
export function checks(t, P = [0, 0, 0]) {
  const out = [];
  const m = model(t, P);
  const S = SPEC;
  for (const k of m.skulls) {
    const cap = k.state === 'strike' ? S.maxStrike : S.maxMill;
    out.push({name: `${k.state === 'strike' ? 'strike' : 'mill'} speed under ${cap} m/s`, ok: k.speed <= cap, value: k.speed.toFixed(2)});
    out.push({name: 'above the ground', ok: k.p[1] - P[1] >= S.size, value: (k.p[1] - P[1]).toFixed(2)});
  }
  let minD = Infinity;
  for (let a = 0; a < S.n; a++) for (let b = a + 1; b < S.n; b++) minD = Math.min(minD, v.dist(m.skulls[a].p, m.skulls[b].p));
  out.push({name: `skulls never overlap (≥ ${S.minSep} m)`, ok: minD >= S.minSep, value: minD.toFixed(2)});
  out.push({name: 'at most two bites at once', ok: m.biting.length <= 2, value: m.biting.length});
  // no pops: position and velocity are continuous where a strike starts and ends
  for (let i = 0; i < S.n; i += 5) {
    const t0 = (i * S.cycle) / S.n + Math.floor(t / S.cycle) * S.cycle;
    for (const edge of [t0, t0 + S.strike]) {
      const e = 1e-4;
      const a = skullAt(i, edge - e, P).p;
      const b = skullAt(i, edge + e, P).p;
      const jump = v.dist(a, b);
      out.push({name: 'no pop at strike edges (position)', ok: jump < 0.01, value: jump.toExponential(1)});
      const va = v.mul(v.sub(skullAt(i, edge - e, P).p, skullAt(i, edge - 2 * e, P).p), 1 / e);
      const vb = v.mul(v.sub(skullAt(i, edge + 2 * e, P).p, skullAt(i, edge + e, P).p), 1 / e);
      out.push({name: 'no pop at strike edges (velocity)', ok: v.dist(va, vb) < 0.1, value: v.dist(va, vb).toFixed(3)});
    }
  }
  // every strike reaches the bite point
  for (let i = 0; i < S.n; i += 7) {
    const t0 = (i * S.cycle) / S.n;
    const mid = skullAt(i, t0 + S.strike / 2, P).p;
    out.push({name: 'strikes pass through the bite point', ok: v.dist(mid, m.bite) < 1e-6, value: v.dist(mid, m.bite).toExponential(1)});
  }
  return out;
}
