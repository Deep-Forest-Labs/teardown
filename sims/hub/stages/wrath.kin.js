// Wrath and Amon, model only: a burning prison yard. Stage value s from 0 to 3:
//   0       RUN       a yard between two stepped cell blocks (east and west, three tiers); fire floods the low
//                     ground in waves; pads climb out of it. No boss.
//   0 → 1   ARRIVAL   Amon, a 36 m jailer, climbs the north wall: his hands grip the top block's edge (solved
//                     arms) and he hauls himself up onto it.
//   1 → 2   PHASE 1   he sweeps the yard with his eye beam from the top block; the fire still comes in waves.
//   2 → 3   PHASE 2   the yard floods to the second tier for good; the second-tier cell doors on both sides fall
//                     outward as drawbridges, their lengths solved so opposite doors meet mid-yard above the fire.
import {fabrik, seg, v} from './rig.js';

export const SPEC = {
  yard: 50,
  tiers: [{h: 3, w: 6}, {h: 6, w: 6}, {h: 9, w: 6}], // each tier steps back toward the walls
  innerX: 13, // the first tier's inner face, at scale 1
  depth: 34,
  doors: 3, // per side, on tier two
  doorW: 4.5,
  fireWaveMax: 1.6,
  floodY: 6.4,
  amon: {torso: [12, 14, 7], head: 6, arm: {links: 5, linkL: 4.2}},
  northBlock: {w: 20, h: 12, d: 8},
};

export function layout(scale) {
  const ix = SPEC.innerX * scale;
  // tier k's inner face steps back by the widths of the tiers below
  const faces = SPEC.tiers.map((T, k) => ix + SPEC.tiers.slice(0, k).reduce((a, b) => a + b.w, 0));
  const north = -(SPEC.depth * scale) / 2 - SPEC.northBlock.d / 2 - 2;
  return {ix, faces, north, depth: SPEC.depth * scale, yard: SPEC.yard * scale};
}

export function model(s, t, scale = 1) {
  const L = layout(scale);
  const out = {tubes: [], slabs: [], balls: [], weak: [], spots: [], info: {}, L};
  const arrive = seg(s, 0.05, 0.95);
  const p2 = seg(s, 2, 2.35);
  const doorsDown = seg(s, 2.15, 2.4);
  // fire: waves in the run and phase one; the flood holds in phase two
  const wave = Math.max(0.05, SPEC.fireWaveMax * Math.sin(t * 0.35) + 0.3);
  const fireY = wave * (1 - p2) + SPEC.floodY * p2;
  out.fireY = fireY;
  // drawbridge doors: hinge on tier two's inner top edge; length solved so the pair meets at x = 0
  const tier2 = SPEC.tiers[1];
  const hingeX = L.faces[1];
  const doorLen = hingeX; // reaches the middle exactly
  out.doors = [];
  for (const sx of [-1, 1]) {
    for (let k = 0; k < SPEC.doors; k++) {
      const z = (k - (SPEC.doors - 1) / 2) * (L.depth / SPEC.doors);
      const hinge = [sx * hingeX, tier2.h, z];
      // closed: standing up (pointing +y); open: lying flat toward the middle
      const ang = (Math.PI / 2) * doorsDown;
      const dir = [-sx * Math.sin(ang), Math.cos(ang), 0];
      const tip = v.add(hinge, v.mul(dir, doorLen));
      out.doors.push({sx, k, hinge, tip, dir, ang, z});
      // a slab: long along dir; its 'up' is the face normal in the x-y plane, turned so it faces up once open
      const n = [sx * Math.cos(ang), Math.sin(ang), 0];
      out.slabs.push({k: 'door', p: v.lerp(hinge, tip, 0.5), up: n, fwd: dir, s: [SPEC.doorW, 0.5, doorLen]});
    }
  }
  // Amon climbs the north block
  const A = SPEC.amon;
  const NB = SPEC.northBlock;
  const edgeY = NB.h;
  // he rises behind the block first (hidden in the run), then hauls forward onto it once his hips clear the top
  const lift = seg(arrive, 0, 0.75);
  const haul = seg(arrive, 0.75, 1);
  const behind = L.north - NB.d / 2 - A.torso[2] / 2 - 0.5;
  const onTop = L.north - NB.d * 0.2;
  const torsoC = [0, edgeY - 30 + lift * (30 + A.torso[1] / 2), behind + (onTop - behind) * haul + p2 * 4];
  const fwd = [0, 0, 1];
  out.slabs.push({k: 'colossus', p: torsoC, up: [0, 1, 0], fwd, s: A.torso});
  const headC = v.add(torsoC, [0, A.torso[1] / 2 + A.head / 2, 1]);
  out.slabs.push({k: 'colossus', p: headC, up: [0, 1, 0], fwd, s: [A.head, A.head, A.head]});
  for (const sx of [-1, 1]) {
    const hb = v.add(headC, [sx * 2.2, A.head / 2, 0]);
    out.tubes.push({k: 'colossusDark', a: hb, b: v.add(hb, [sx * 2.5, 5, 0]), r: 0.8});
  }
  // arms: grip the block's front edge while climbing; rest on it after
  out.arms = [];
  for (const sx of [-1, 1]) {
    const sh = v.add(torsoC, [sx * (A.torso[0] / 2 + 1), A.torso[1] / 2 - 2, 0]);
    const grip = [sx * 7, edgeY + 0.3, L.north + NB.d / 2];
    const pole = v.add(sh, [sx * 10, -6, 6]);
    const pts = fabrik(sh, grip, A.arm.links, A.arm.linkL, pole, 48);
    out.arms.push({sx, pts, grip});
    for (let i = 0; i < A.arm.links; i++) out.tubes.push({k: 'colossus', a: pts[i], b: pts[i + 1], r: 1.4, round: true});
  }
  // the eye beam
  const beamOn = s >= 1 && t % 5 < 3.5;
  const yaw = Math.sin(t * 0.45) * 0.9;
  const eye = v.add(headC, [0, 0.6, A.head / 2]);
  const beamDir = [Math.sin(yaw) * Math.cos(0.42), -Math.sin(0.42), Math.cos(yaw) * Math.cos(0.42)];
  out.beam = {on: beamOn, from: eye, dir: beamDir};
  if (beamOn) out.tubes.push({k: 'beam', a: eye, b: v.add(eye, v.mul(beamDir, 80)), r: 0.25});
  for (const sx of [-1, 1]) out.weak.push({id: `eye${sx}`, p: v.add(headC, [sx * 1.4, 0.6, A.head / 2 + 0.1]), open: arrive > 0.95 ? 0.6 + 0.4 * p2 : 0, r: 0.7});
  out.amon = {torsoC, headC, behind};
  // spots: yard floor and tiers
  for (let k = 0; k < 8; k++) {
    const side = k % 2 ? 1 : -1;
    const tier = Math.floor(k / 2) % 3;
    const x = k < 2 ? side * L.ix * 0.4 : side * (L.faces[tier] + SPEC.tiers[tier].w / 2);
    const y = k < 2 ? 0 : SPEC.tiers[tier].h;
    const z = ((k % 4) - 1.5) * (L.depth / 5);
    out.spots.push([x, y + 0.2, z]);
  }
  out.info = {arrive, p2, doorsDown, fireY, beamOn};
  return out;
}

export function checks(s, t, scale = 1) {
  const m = model(s, t, scale);
  const out = [];
  if (m.info.doorsDown > 0.999) {
    for (let k = 0; k < SPEC.doors; k++) {
      const a = m.doors.find((d) => d.sx < 0 && d.k === k);
      const b = m.doors.find((d) => d.sx > 0 && d.k === k);
      const gap = v.dist(a.tip, b.tip);
      out.push({name: `doors ${k}: meet mid-yard`, ok: gap < 0.05, value: gap.toFixed(3)});
      out.push({name: `doors ${k}: above the flood`, ok: a.tip[1] - m.fireY >= -0.5 && SPEC.tiers[1].h > m.fireY - 0.5, value: (a.tip[1] - m.fireY).toFixed(2)});
    }
  }
  if (m.info.p2 > 0.999) {
    out.push({name: 'flood below tier two, above tier one', ok: m.fireY > SPEC.tiers[0].h && m.fireY <= SPEC.tiers[1].h + 0.5, value: m.fireY.toFixed(2)});
  }
  for (const arm of m.arms) {
    let lenErr = 0;
    for (let i = 0; i < SPEC.amon.arm.links; i++) lenErr = Math.max(lenErr, Math.abs(v.dist(arm.pts[i], arm.pts[i + 1]) - SPEC.amon.arm.linkL));
    out.push({name: 'arm links exact', ok: lenErr < 1e-6, value: lenErr.toExponential(1)});
    if (m.info.arrive > 0.5) out.push({name: 'hands grip the block edge', ok: v.dist(arm.pts[SPEC.amon.arm.links], arm.grip) < 0.1, value: v.dist(arm.pts[SPEC.amon.arm.links], arm.grip).toFixed(3)});
  }
  // his body never passes through the block: either fully behind it or with his hips above its top
  const T = m.amon.torsoC;
  const front = T[2] + SPEC.amon.torso[2] / 2;
  const back = m.L.north - SPEC.northBlock.d / 2;
  const hips = T[1] - SPEC.amon.torso[1] / 2;
  out.push({name: 'torso clear of the north block', ok: front <= back + 1e-6 || hips >= SPEC.northBlock.h - 1e-6, value: `front ${(front - back).toFixed(2)} hips ${hips.toFixed(2)}`});
  if (s < 0.02) out.push({name: 'no boss in the run', ok: m.amon.headC[1] < SPEC.northBlock.h - 1, value: m.amon.headC[1].toFixed(1)});
  return out;
}

export const STATES = [
  {at: 0, name: 'Run', note: 'A burning yard between stepped cell blocks; fire in waves. No boss.'},
  {at: 0.5, name: 'Arrival', note: 'Amon hauls himself up the north wall onto the top block.'},
  {at: 1, name: 'Phase 1', note: 'The eye beam sweeps the yard; the fire still comes in waves.'},
  {at: 2, name: 'Phase 2', note: 'The flood holds at tier two; the cell doors fall as drawbridges that meet mid-yard.'},
];
