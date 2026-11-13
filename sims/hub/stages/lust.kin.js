// Lust and Lilith, model only: a giant flower on a spire. Stage value s from 0 to 3:
//   0       RUN       a storm terrace ringed by updraft columns; a closed bud on a spire at the centre. No boss.
//   0 → 1   ARRIVAL   the bud opens: six petals hinge out from the bloom's rim into high platforms; Lilith rises
//                     in the bloom.
//   1 → 2   PHASE 1   she charms from the bloom (a pull toward the spire); the updrafts carry you to the petals.
//   2 → 3   PHASE 2   the petals droop to staggered angles, solved so their middles make a spiral staircase from
//                     the floor up to the bloom (each step a double jump); her mirror circles her, down 3 s in 8.
import {seg, v} from './rig.js';

export const SPEC = {
  terraceR: 24,
  spire: {r: 2.2, h: 18},
  bloomR: 3,
  petals: 6,
  petalL: 20,
  stepAt: 0.85, // where along a drooped petal you stand: the stair is read there
  openDeg: 96, // from vertical: just past level, a platform
  updrafts: 6,
  doubleJumpH: 4.2,
  lilith: {h: 22, r: 1.6},
};
const TAU = Math.PI * 2;

export function model(s, t, scale = 1) {
  const out = {tubes: [], slabs: [], balls: [], weak: [], spots: [], info: {}};
  const R = SPEC.terraceR * scale;
  const H = SPEC.spire.h;
  const open = seg(s, 0.1, 0.8);
  const rise = seg(s, 0.5, 1);
  const droop = seg(s, 2, 2.45);
  const Lp = SPEC.petalL;
  out.tubes.push({k: 'spire', a: [0, 0, 0], b: [0, H, 0], r: SPEC.spire.r, round: true});
  // petals: hinge on the bloom rim; angle from vertical: closed 8°, open 96°, phase two solved per petal
  out.petals = [];
  const n = SPEC.petals;
  for (let k = 0; k < n; k++) {
    const a = (k / n) * TAU;
    const dir = [Math.sin(a), 0, Math.cos(a)];
    const hinge = v.add(v.mul(dir, SPEC.bloomR), [0, H, 0]);
    const thClosed = (8 * Math.PI) / 180;
    const thOpen = (SPEC.openDeg * Math.PI) / 180;
    // phase two: the standing point of petal k (85% out) sits on a spiral from the floor up to the bloom
    const q = SPEC.stepAt;
    // the first step is as low as it can be with the tip still above the floor: H - q·(H - 0.3)
    const low = H - q * (H - 0.4);
    const stepTarget = low + (k / (n - 1)) * (H - low - 2.5);
    const cosT = (stepTarget - H) / (Lp * q); // its height = H + q·Lp·cos θ
    const thDroop = Math.acos(Math.max(-1, Math.min(1, cosT)));
    const th = thClosed + (thOpen - thClosed) * open + (thDroop - thOpen) * droop;
    const axis = [dir[0] * Math.sin(th), Math.cos(th), dir[2] * Math.sin(th)];
    const tip = v.add(hinge, v.mul(axis, Lp));
    const mid = v.add(hinge, v.mul(axis, Lp / 2));
    // the petal's flat face looks up and out; as a slab its 'up' is perpendicular to its length
    const faceUp = [-dir[0] * Math.cos(th), Math.sin(th), -dir[2] * Math.cos(th)];
    // a petal spans its whole slice of the circle where you stand on it, so neighbours meet edge to edge
    const rStep = SPEC.bloomR + Lp * SPEC.stepAt * Math.sin(th);
    const width = 2 * Math.max(SPEC.bloomR + 2, rStep) * Math.sin(Math.PI / n) * 1.02;
    out.slabs.push({k: 'petal', p: v.add(mid, v.mul(faceUp, -0.3)), up: faceUp, fwd: axis, s: [width, 0.6, Lp]});
    const step = v.add(hinge, v.mul(axis, Lp * SPEC.stepAt));
    out.petals.push({k, a, dir, hinge, tip, mid, step, th, axis, width});
  }
  // Lilith in the bloom
  const Li = SPEC.lilith;
  const base = [0, H - Li.h * (1 - rise) - 2, 0];
  out.tubes.push({k: 'lilith', a: base, b: v.add(base, [0, Li.h - 3, 0]), r: Li.r, round: true});
  const headP = v.add(base, [0, Li.h - 1.5, 0]);
  out.balls.push({k: 'lilith', p: headP, r: 1.8});
  for (const sx of [-1, 1]) out.slabs.push({k: 'wing', p: v.add(base, [sx * 8, Li.h - 7, -1]), up: [sx * 0.25, 1, 0], fwd: [0, 0, 1], s: [14, 0.4, 6]});
  // the mirror: circles her in phase two, down for 3 s in every 8
  const p2 = seg(s, 2, 2.15);
  const down = p2 > 0 && t % 8 < 3;
  const ma = t * 0.8;
  const mirrorP = v.add(base, [Math.sin(ma) * 7, (Li.h - 8) * (down ? 0.1 : 1), Math.cos(ma) * 7]);
  if (p2 > 0.05) out.slabs.push({k: 'mirror', p: mirrorP, up: [0, 1, 0], fwd: [Math.sin(ma), 0, Math.cos(ma)], s: [10, 10, 0.5]});
  const heart = v.add(base, [0, Li.h - 8, Li.r + 0.3]);
  out.weak.push({id: 'heart', p: rise > 0.02 ? heart : [0, -200, 0], open: s >= 1 && s < 2 ? 0.5 : p2 > 0 && down ? 1 : 0.1, r: 1});
  out.mirror = {down, p2};
  // updraft columns under the open petals' tips (they carry you up to them)
  out.updrafts = [];
  for (let k = 0; k < SPEC.updrafts; k++) {
    const a = ((k + 0.5) / SPEC.updrafts) * TAU;
    const r = Math.min(R - 3, SPEC.bloomR + Lp * 0.9);
    out.updrafts.push({p: [Math.sin(a) * r, 0, Math.cos(a) * r], top: H + 4});
  }
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * TAU + 0.3;
    const r = R * (k % 2 ? 0.45 : 0.82);
    out.spots.push([Math.sin(a) * r, 0.2, Math.cos(a) * r]);
  }
  out.info = {open, rise, droop, p2, down};
  return out;
}

export function checks(s, t, scale = 1) {
  const m = model(s, t, scale);
  const out = [];
  for (const P of m.petals) {
    out.push({name: `petal ${P.k}: stays above the floor`, ok: P.tip[1] > 0.2, value: P.tip[1].toFixed(2)});
  }
  if (m.info.open > 0.999 && m.info.droop < 0.001) {
    for (const P of m.petals) out.push({name: `petal ${P.k}: open as a platform (near level)`, ok: Math.abs(P.th - Math.PI / 2) < 0.15, value: ((P.th * 180) / Math.PI).toFixed(1)});
  }
  if (m.info.droop > 0.999) {
    const mids = m.petals.map((P) => P.step[1]);
    out.push({name: 'stair: first step reachable from the floor', ok: mids[0] <= SPEC.doubleJumpH, value: mids[0].toFixed(2)});
    for (let k = 1; k < mids.length; k++) {
      const dh = mids[k] - mids[k - 1];
      out.push({name: `stair ${k}: step a double jump`, ok: dh > 0 && dh <= SPEC.doubleJumpH, value: dh.toFixed(2)});
      const chord = Math.hypot(m.petals[k].step[0] - m.petals[k - 1].step[0], m.petals[k].step[2] - m.petals[k - 1].step[2]);
      const gap = chord - (m.petals[k].width + m.petals[k - 1].width) / 2;
      out.push({name: `stair ${k}: neighbouring petals meet`, ok: gap < 1.5, value: gap.toFixed(2)});
    }
    const top = mids[mids.length - 1];
    out.push({name: 'stair: top a double jump below the bloom', ok: SPEC.spire.h - top <= SPEC.doubleJumpH, value: (SPEC.spire.h - top).toFixed(2)});
  }
  if (s < 0.02) out.push({name: 'no boss in the run (bud shut)', ok: m.petals.every((P) => P.th < 0.2), value: 'shut'});
  return out;
}

export const STATES = [
  {at: 0, name: 'Run', note: 'A storm terrace and updrafts; a closed bud on a spire. No boss.'},
  {at: 0.5, name: 'Arrival', note: 'The bud opens into six high petals; Lilith rises in the bloom.'},
  {at: 1, name: 'Phase 1', note: 'She charms from the bloom; the updrafts carry you to the petals.'},
  {at: 2, name: 'Phase 2', note: 'The petals droop into a spiral stair up to her; shoot while the mirror is down.'},
];
