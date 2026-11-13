// Treachery and the Companion, model only: Cocytus, a frozen lake in a bowl. Stage value s from 0 to 3:
//   0       RUN       a whole frozen lake (it is already cut into floes, seams shut). No boss.
//   0 → 1   ARRIVAL   the Companion forms out of the cold, tail first: a pale wraith of stacked rings.
//   1 → 2   PHASE 1   beside you: it circles the lake with you and fights at your side.
//   2 → 3   PHASE 2   it turns: the lake breaks along its seams. Ring k drifts out by k gaps, so the gaps between
//                     rings are one gap wide and the gaps within a ring are 2·d·sin(π/n); the rings counter-turn.
//                     Every 8 s it dives at a floe and pushes it under for 3 s (its heart shows while it dives).
import {seg, v} from './rig.js';

export const SPEC = {
  rings: [{r: 6, n: 1}, {r: 12.5, n: 6}, {r: 19, n: 10}], // outer radius and sector count of each ring, scale 1
  gap: 2.4,
  jump: 3.5,
  water: -2.5,
  bowlRise: 8,
  bowlH: 9,
  comp: {spine: 12, len: 16, head: 3.2},
  diveEvery: 8,
};
const TAU = Math.PI * 2;

export function layout(scale) {
  const radii = SPEC.rings.map((R) => R.r * scale);
  const lakeR = radii[radii.length - 1];
  const flatR = lakeR + (SPEC.rings.length - 1) * SPEC.gap + 1.5; // room for the drift
  return {radii, lakeR, flatR, rimR: flatR + SPEC.bowlRise * Math.max(1, scale)};
}

/** The tiling: every floe as a ring sector (the centre is a whole disc). */
export function floes(L) {
  const out = [];
  SPEC.rings.forEach((R, k) => {
    const r0 = k ? L.radii[k - 1] : 0;
    const r1 = L.radii[k];
    for (let j = 0; j < R.n; j++) out.push({ring: k, j, r0, r1, a0: (j / R.n) * TAU + k * 0.31, a1: ((j + 1) / R.n) * TAU + k * 0.31, n: R.n});
  });
  return out;
}

export function model(s, t, scale = 1) {
  const L = layout(scale);
  const out = {tubes: [], slabs: [], balls: [], weak: [], spots: [], info: {}, L};
  const form = seg(s, 0.05, 0.95);
  const turn = seg(s, 2, 2.3); // it turns, the lake breaks
  const drift = seg(s, 2.05, 2.5);
  const p2 = turn;
  // the dive: which floe, and how far under
  const cycle = Math.floor(t / SPEC.diveEvery);
  const inDive = (t % SPEC.diveEvery) / SPEC.diveEvery;
  const all = floes(L);
  const diveIdx = 1 + ((cycle * 7 + 3) % (all.length - 1)); // never the centre disc
  const dive = p2 > 0.999 ? seg(inDive, 0.2, 0.35) * (1 - seg(inDive, 0.6, 0.75)) : 0;
  out.floes = all.map((F, i) => {
    const d = F.ring * SPEC.gap * drift;
    const spin = drift * Math.sin(t * 0.05) * 0.4 * (F.ring % 2 ? 1 : -1) * (F.ring ? 1 : 0);
    const mid = (F.a0 + F.a1) / 2 + spin;
    const off = F.ring ? [Math.cos(mid) * d, 0, Math.sin(mid) * d] : [0, 0, 0];
    const bob = Math.sin(t * 0.8 + i) * 0.22 * drift;
    const sink = i === diveIdx ? dive * 1.8 : 0;
    return {...F, i, off: [off[0], bob - sink, off[2]], spin, d, top: 0.05 + bob - sink};
  });
  // the Companion: a spine of stacked rings, tail at the ice, head up; it forms from the tail up
  const C = SPEC.comp;
  const orbit = t * 0.25;
  const besideR = L.lakeR * 0.62;
  const beside = [Math.cos(orbit) * besideR, 21, Math.sin(orbit) * besideR];
  const loom = [0, 22, -L.lakeR * 0.35];
  const target = out.floes[diveIdx];
  const tMid = (target.a0 + target.a1) / 2 + target.spin;
  const tr = (target.r0 + target.r1) / 2 + target.d;
  const diveP = [Math.cos(tMid) * tr, target.top + 7, Math.sin(tMid) * tr];
  const head0 = v.lerp(beside, loom, p2);
  const head = v.lerp(head0, diveP, dive);
  // the tail's length is solved from the head's height, so it coils up when the head comes down and never dips in
  const len = Math.max(2, Math.min(C.len, head[1] - 4));
  out.spine = [];
  for (let i = 0; i < C.spine; i++) {
    const q = i / (C.spine - 1); // 0 tail, 1 neck
    const sway = Math.sin(t * 1.3 - q * 3) * 2 * (1 - q);
    const p = v.add(head, [sway, -(1 - q) * len - 2, Math.cos(t * 1.1 - q * 2.5) * 1.5 * (1 - q)]);
    const grown = seg(form, q * 0.6, q * 0.6 + 0.4);
    const r = (0.5 + 2.6 * Math.pow(q, 0.8)) * grown;
    out.spine.push({p, r});
    if (r > 0.05) out.balls.push({k: 'ghost', p, r});
  }
  const headR = C.head * seg(form, 0.6, 1);
  if (headR > 0.05) {
    out.balls.push({k: 'ghost', p: head, r: headR});
    // the face: a dark plate that looks at the lake in phase one and at its dive target in phase two
    const look = v.norm(v.sub(dive > 0 ? [diveP[0], target.top, diveP[2]] : [0, 0, 0], head));
    out.slabs.push({k: 'face', p: v.add(head, v.mul(look, headR * 0.75)), up: [0, 1, 0], fwd: v.norm([look[0], 0, look[2]]), s: [headR * 1.4, headR * 0.8, 0.5]});
  }
  const chest = out.spine[C.spine - 3].p;
  out.weak.push({id: 'heart', p: form > 0.5 ? chest : [0, -200, 0], open: dive > 0.5 ? 1 : 0, r: 1});
  out.comp = {head, headR, chest, diveIdx, dive};
  for (let k = 0; k < 8; k++) {
    const F = out.floes[(k * 3 + 1) % out.floes.length];
    const a = (F.a0 + F.a1) / 2;
    const r = F.ring ? (F.r0 + F.r1) / 2 : 0;
    out.spots.push([Math.cos(a) * r, 0.25, Math.sin(a) * r]);
  }
  out.info = {form, turn, drift, p2, dive, diveIdx, cycle};
  return out;
}

export function checks(s, t, scale = 1) {
  const m = model(s, t, scale);
  const {L} = m;
  const out = [];
  // the tiling: the floes' areas add up to the whole lake, and no floe overlaps another's angle in its ring
  const area = m.floes.reduce((a, F) => a + ((F.a1 - F.a0) / 2) * (F.r1 * F.r1 - F.r0 * F.r0), 0);
  out.push({name: 'tiling: floes cover the lake exactly', ok: Math.abs(area - Math.PI * L.lakeR * L.lakeR) < 1e-6, value: (area - Math.PI * L.lakeR * L.lakeR).toExponential(1)});
  if (m.info.drift > 0.999) {
    for (let k = 1; k < SPEC.rings.length; k++) {
      const n = SPEC.rings[k].n;
      const d = k * SPEC.gap;
      const within = 2 * d * Math.sin(Math.PI / n);
      out.push({name: `ring ${k}: gaps within the ring jumpable`, ok: within <= SPEC.jump && within >= 1, value: within.toFixed(2)});
      out.push({name: `ring ${k}: gap to the ring inside jumpable`, ok: SPEC.gap <= SPEC.jump, value: SPEC.gap.toFixed(2)});
    }
  }
  for (const F of m.floes) {
    const outer = F.r1 + F.d;
    if (F.ring === SPEC.rings.length - 1) out.push({name: 'floes stay on the flat of the bowl', ok: outer + 0.2 <= L.flatR, value: (L.flatR - outer).toFixed(2)});
  }
  if (m.info.dive > 0.5) {
    out.push({name: 'dive: the floe goes under the waterline', ok: m.floes[m.info.diveIdx].top < 0, value: m.floes[m.info.diveIdx].top.toFixed(2)});
    out.push({name: 'dive: its head stays above the floe', ok: m.comp.head[1] - m.comp.headR > m.floes[m.info.diveIdx].top + 0.5, value: (m.comp.head[1] - m.comp.headR).toFixed(2)});
    out.push({name: 'dive: never the centre disc', ok: m.floes[m.info.diveIdx].ring > 0, value: m.info.diveIdx});
  }
  if (m.info.form > 0.999) out.push({name: 'its tail hangs above the ice', ok: m.spine[0].p[1] - m.spine[0].r > 0.3, value: (m.spine[0].p[1] - m.spine[0].r).toFixed(2)});
  if (s < 0.02) out.push({name: 'no boss in the run', ok: m.balls.length === 0, value: m.balls.length});
  return out;
}

export const STATES = [
  {at: 0, name: 'Run', note: 'A whole frozen lake in a bowl. No boss.'},
  {at: 0.5, name: 'Arrival', note: 'The Companion forms out of the cold, tail first.'},
  {at: 1, name: 'Phase 1', note: 'Beside you: it circles the lake and fights with you.'},
  {at: 2, name: 'Phase 2', note: 'It turns: the lake breaks on its seams into drifting floes; it dives and pushes floes under.'},
];
