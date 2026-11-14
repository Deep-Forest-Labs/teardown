// THE CHOPPING BLOCK, the rest of the roster (no three.js): the Tithe-Taker and its eggs and mites, the Cantor and its
// Eye, the Briar. Timings are the Chopping Block definitions (from the reference's published behaviour); movement
// numbers and sizes are estimates (marked EST). Every agent is a plain object stepped by dt; the checks simulate.
import {M, rnd, TAU, wrapPi} from './swarm.js';

export const E = {
  tithe: {raise: 3, hp: 25, hideAfterHit: 1, pullR: 22, pullV: 9, eatR: 1.6, layEvery: 1.0, jitter: [0.25, 0.7], dash: 7, headY: 3.2, rimR: 44},
  egg: {hatch: 10, mites: 5, hp: 3},
  mite: {hp: 3, burst: [0.45, 0.8], dash: 15, coast: 2.5, offset: 4, dashFor: 0.3},
  cantor: {wake: 8.5333, firstCall: 13.5333, every: 20, call: 2.4, spin: (14 * Math.PI) / 180, hover: 7, points: 6, hpPer: 250, eyeDrop: 3.3167, eyeWake: 10},
  eye: {hp: 2400, every: 2.5333, stunHold: 0.3},
  briar: {emerge: 3, hp: 120, r: 1.6},
  // fevered (called by the Cantor or its Eye): the same kind, more health, a hotter look (Chopping Block definitions)
  fevered: {mote: 10, stray: 20, hound: 100, warden: 300},
};

// ---------------------------------------------------------------- Tithe-Taker
export function newTithe(id, t, ang = rnd(id * 5) * TAU) {
  return {kind: 'tithe', id, p: [E.tithe.rimR * Math.cos(ang), 0, E.tithe.rimR * Math.sin(ang)], born: t, hp: E.tithe.hp, lastHit: -9, eaten: 0, laid: 0, nextLay: 0, nextJit: t + 3, vel: [0, 0], head: 0, alive: true};
}
/** Head up 0..1: rises over the first 3 s, ducks while hurt in the last second. */
export function titheHead(a, t) {
  const up = Math.min(1, (t - a.born) / E.tithe.raise);
  return t - a.lastHit < E.tithe.hideAfterHit ? 0 : up;
}
/** Facing the player once the head is fully up (and not ducking). */
export const titheFacing = (a, t) => titheHead(a, t) >= 1;
/** Step: jittery repositioning near where it stands; while facing, it pulls loose orbs in and lays one egg per orb. */
export function stepTithe(a, player, orbs, t, dt, lay) {
  if (t >= a.nextJit) {
    const r = (k) => rnd(a.id * 41 + Math.floor(t * 10) + k);
    const ang = r(1) * TAU;
    a.vel = [Math.cos(ang) * E.tithe.dash, Math.sin(ang) * E.tithe.dash];
    a.nextJit = t + E.tithe.jitter[0] + (E.tithe.jitter[1] - E.tithe.jitter[0]) * r(2);
    a.jitEnd = t + 0.18;
  }
  if (t < (a.jitEnd ?? 0)) {
    a.p[0] += a.vel[0] * dt;
    a.p[2] += a.vel[1] * dt;
    const r = Math.hypot(a.p[0], a.p[2]);
    if (r > M.arenaR - 3) {
      a.p[0] *= (M.arenaR - 3) / r;
      a.p[2] *= (M.arenaR - 3) / r;
    }
  }
  a.head = titheHead(a, t);
  a.yaw = Math.atan2(player[2] - a.p[2], player[0] - a.p[0]);
  if (titheFacing(a, t)) {
    for (const o of orbs) {
      if (o.taken) continue;
      const dx = a.p[0] - o.p[0];
      const dz = a.p[2] - o.p[2];
      const d = Math.hypot(dx, dz);
      if (d < E.tithe.eatR) {
        o.taken = true;
        a.eaten++;
      } else if (d < E.tithe.pullR) {
        o.p[0] += (dx / d) * E.tithe.pullV * dt;
        o.p[2] += (dz / d) * E.tithe.pullV * dt;
        o.pulled = true;
      }
    }
  }
  // one egg per orb eaten, ejected one at a time
  if (a.laid < a.eaten && t >= a.nextLay) {
    a.laid++;
    a.nextLay = t + E.tithe.layEvery;
    const ang = a.yaw + Math.PI + (rnd(a.id * 7 + a.laid) - 0.5) * 1.6;
    lay([a.p[0] + 3.5 * Math.cos(ang), 0.4, a.p[2] + 3.5 * Math.sin(ang)], t);
  }
  return a;
}
export const newEgg = (id, p, t) => ({kind: 'egg', id, p: [...p], born: t, hp: E.egg.hp, alive: true});
/** An egg hatches 10 s after it is laid. */
export const eggHatched = (g, t) => t - g.born >= E.egg.hatch;

// ---------------------------------------------------------------- mites: dart at the player in bursts, random offsets
export function newMite(id, p, t) {
  return {kind: 'mite', id, p: [p[0], 0.3, p[2]], born: t, hp: E.mite.hp, next: t + 0.2, dashTo: null, dashEnd: 0, alive: true};
}
export function stepMite(a, player, t, dt) {
  if (t >= a.next) {
    const r = (k) => rnd(a.id * 23 + Math.floor(t * 20) + k);
    const ang = r(1) * TAU;
    const off = E.mite.offset * Math.sqrt(r(2));
    a.dashTo = [player[0] + off * Math.cos(ang), player[2] + off * Math.sin(ang)];
    a.dashEnd = t + E.mite.dashFor;
    a.next = t + E.mite.burst[0] + (E.mite.burst[1] - E.mite.burst[0]) * r(3);
  }
  if (a.dashTo) {
    const dx = a.dashTo[0] - a.p[0];
    const dz = a.dashTo[1] - a.p[2];
    const d = Math.hypot(dx, dz) || 1;
    const v = t < a.dashEnd ? E.mite.dash : E.mite.coast;
    a.p[0] += (dx / d) * Math.min(d, v * dt);
    a.p[2] += (dz / d) * Math.min(d, v * dt);
    a.yaw = Math.atan2(dz, dx);
  }
  return a;
}

// ---------------------------------------------------------------- the Cantor and its Eye
export function newCantor(id, t, ang = rnd(id * 3) * TAU) {
  const r = 26;
  return {kind: 'cantor', id, p: [r * Math.cos(ang), E.cantor.hover, r * Math.sin(ang)], born: t, spin: 0, hp: Array(E.cantor.points).fill(E.cantor.hpPer), alive: true};
}
/** Awake 8.53 s after it appears. */
export const cantorAwake = (c, t) => t - c.born >= E.cantor.wake;
/** Is a call (beckon) running at t? Calls start at 13.53 s and repeat every 20 s, each lasting about 2.4 s. */
export function cantorCalling(c, t) {
  const s = t - c.born - E.cantor.firstCall;
  if (s < 0) return false;
  return s % E.cantor.every < E.cantor.call;
}
export function stepCantor(c, t, dt) {
  if (cantorAwake(c, t)) c.spin += E.cantor.spin * dt; // counter-clockwise from above
  return c;
}
/** The Eye drops 3.32 s after the Cantor dies and wakes 10 s after the death; then calls every 2.53 s unless kept under fire. */
export function newEye(id, p, deathT) {
  return {kind: 'eye', id, p: [p[0], E.cantor.hover, p[2]], died: deathT, hp: E.eye.hp, lastHit: -9, nextCall: deathT + E.cantor.eyeWake, callEnd: -9, alive: true};
}
export const eyeLanded = (e, t) => t - e.died >= E.cantor.eyeDrop;
export const eyeAwake = (e, t) => t - e.died >= E.cantor.eyeWake;
export const eyeStunned = (e, t) => t - e.lastHit < E.eye.stunHold;
export function stepEye(e, t) {
  if (!eyeAwake(e, t)) return e;
  if (t >= e.nextCall) {
    if (!eyeStunned(e, t)) e.callEnd = t + 1.2;
    e.nextCall += E.eye.every;
  }
  return e;
}
export const eyeCalling = (e, t) => t < e.callEnd;

/** A call pulls every chaser toward the caller; one that reaches it turns Fevered (more health) and goes back to its rule. */
export function callPull(a, caller, dt) {
  const dx = caller[0] - a.p[0];
  const dy = caller[1] - a.p[1];
  const dz = caller[2] - a.p[2];
  const d = Math.hypot(dx, dy, dz) || 1;
  const v = Math.max(a.v ?? 18, 18) * 1.3;
  a.p[0] += (dx / d) * v * dt;
  a.p[1] += (dy / d) * v * dt;
  a.p[2] += (dz / d) * v * dt;
  a.yaw = Math.atan2(dz, dx);
  if (d < 4 && !a.fevered && E.fevered[a.kind]) {
    a.fevered = true;
    a.hp = E.fevered[a.kind];
  }
  return a;
}

// ---------------------------------------------------------------- the Briar: comes up and stays
export const newBriar = (id, p, t) => ({kind: 'briar', id, p: [p[0], 0, p[2]], born: t, hp: E.briar.hp, alive: true});
export const briarUp = (b, t) => Math.min(1, Math.max(0, (t - b.born - E.briar.emerge + 0.6) / 0.6));
/** Push a ground point out of a standing Briar. */
export function pushOut(b, p, t, r = 0.5) {
  if (briarUp(b, t) < 0.5) return p;
  const dx = p[0] - b.p[0];
  const dz = p[2] - b.p[2];
  const d = Math.hypot(dx, dz) || 1e-6;
  const min = E.briar.r + r;
  if (d >= min) return p;
  return [b.p[0] + (dx / d) * min, p[1], b.p[2] + (dz / d) * min];
}

// ---------------------------------------------------------------- checks
export function checks() {
  const out = [];
  const dt = 1 / 120;
  // Tithe-Taker: head up and facing after 3 s; ducks for 1 s when hit; eats pulled orbs and lays one egg per orb
  const a = newTithe(1, 0, 0);
  const orbs = [{p: [30, 0.3, 0]}, {p: [34, 0.3, 4]}, {p: [-30, 0.3, 0]}]; // the last is 74 m away, out of its 22 m pull
  const eggs = [];
  let faceAt = null;
  for (let t = 0; t < 12; t += dt) {
    stepTithe(a, [0, 0, 0], orbs, t, dt, (p, tt) => eggs.push(newEgg(eggs.length, p, tt)));
    if (faceAt === null && titheFacing(a, t)) faceAt = t;
  }
  out.push({name: 'tithe-taker: faces the player 3 s after it appears', ok: Math.abs(faceAt - 3) < 0.02, value: faceAt.toFixed(2)});
  out.push({name: 'tithe-taker: eats the orbs in reach, not the far one', ok: a.eaten === 2 && !orbs[2].taken, value: a.eaten});
  out.push({name: 'tithe-taker: one egg per orb eaten', ok: eggs.length === a.eaten, value: eggs.length});
  a.lastHit = 20;
  out.push({name: 'tithe-taker: ducks while hurt, back up 1 s after the last hit', ok: titheHead(a, 20.5) === 0 && titheHead(a, 21.01) === 1, value: '-'});
  // eggs hatch at 10 s into 5 mites
  const g = newEgg(1, [0, 0, 0], 0);
  out.push({name: 'egg: hatches 10 s after it is laid', ok: !eggHatched(g, 9.99) && eggHatched(g, 10), value: E.egg.hatch});
  // mites: dash in bursts toward points round the player, never stay still for long
  const m = newMite(1, [20, 0, 0], 0);
  let near = Infinity;
  const ds = [];
  let last = [...m.p];
  for (let t = 0; t < 8; t += dt) {
    stepMite(m, [0, 0, 0], t, dt);
    near = Math.min(near, Math.hypot(m.p[0], m.p[2]));
    ds.push(Math.hypot(m.p[0] - last[0], m.p[2] - last[2]) / dt);
    last = [...m.p];
  }
  const fast = ds.filter((v) => v > E.mite.dash * 0.9).length / ds.length;
  out.push({name: 'mite: reaches the player (inside its 4 m offset)', ok: near < E.mite.offset, value: near.toFixed(2)});
  out.push({name: 'mite: moves in bursts (fast under half the time)', ok: fast > 0.1 && fast < 0.6, value: fast.toFixed(2)});
  // Cantor: awake at 8.53 s, calls from 13.53 s every 20 s
  const c = newCantor(1, 0, 0);
  out.push({name: 'cantor: wakes 8.53 s after it appears', ok: !cantorAwake(c, 8.53) && cantorAwake(c, 8.534), value: E.cantor.wake});
  const starts = [];
  let was = false;
  for (let t = 0; t < 60; t += dt) {
    const on = cantorCalling(c, t);
    if (on && !was) starts.push(t);
    was = on;
  }
  out.push({name: 'cantor: calls at 13.53 s and every 20 s', ok: starts.length === 3 && Math.abs(starts[0] - 13.533) < 0.01 && Math.abs(starts[1] - starts[0] - 20) < 0.01, value: starts.map((x) => x.toFixed(2)).join(', ')});
  // Eye: lands 3.32 s after the death, wakes at 10 s, calls every 2.53 s, held off by steady fire
  const e = newEye(2, [0, 0, 0], 100);
  out.push({name: 'eye: lands 3.32 s after the Cantor dies, wakes at 10 s', ok: !eyeLanded(e, 103.3) && eyeLanded(e, 103.32) && !eyeAwake(e, 109.99) && eyeAwake(e, 110), value: '-'});
  const calls = [];
  for (let t = 100; t < 120; t += dt) {
    const before = e.callEnd;
    stepEye(e, t);
    if (e.callEnd !== before) calls.push(t);
  }
  out.push({name: 'eye: calls every 2.53 s once awake', ok: calls.length >= 3 && Math.abs(calls[1] - calls[0] - 2.5333) < 0.02, value: calls.slice(0, 3).map((x) => x.toFixed(2)).join(', ')});
  const e2 = newEye(3, [0, 0, 0], 0);
  let calls2 = 0;
  for (let t = 0; t < 20; t += dt) {
    e2.lastHit = t; // under constant fire
    const b = e2.callEnd;
    stepEye(e2, t);
    if (e2.callEnd !== b) calls2++;
  }
  out.push({name: 'eye: under constant fire it never calls', ok: calls2 === 0, value: calls2});
  // a call turns a chaser Fevered when it reaches the caller
  const ch = {kind: 'mote', p: [20, 2, 0], v: 23, hp: 1};
  for (let k = 0; k < 400 && !ch.fevered; k++) callPull(ch, [0, 7, 0], dt);
  out.push({name: 'called chasers reach the caller and turn Fevered (Ash Mote 1 → 10 health)', ok: ch.fevered && ch.hp === 10, value: ch.hp});
  // Briar: up after 3 s, then you cannot stand inside it
  const b = newBriar(1, [0, 0, 0], 0);
  const pushed = pushOut(b, [0.3, 0, 0.2], 5);
  out.push({name: 'briar: up after about 3 s', ok: briarUp(b, 2.3) === 0 && briarUp(b, 3) === 1, value: E.briar.emerge});
  out.push({name: 'briar: pushes the player out of its footprint', ok: Math.hypot(pushed[0], pushed[2]) >= E.briar.r + 0.5 - 1e-9, value: Math.hypot(pushed[0], pushed[2]).toFixed(2)});
  return out;
}
export {wrapPi};
