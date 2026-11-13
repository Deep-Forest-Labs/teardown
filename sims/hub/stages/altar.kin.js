// The Altar and Leviathan, model only (no three.js). One stage value s from 0 to 3 drives everything:
//   0       RUN       most of a run: the disc floats on the blood sea, the pool is sealed by a bone iris, the rim
//                     has eight empty grip notches. No boss.
//   0 → 1   ARRIVAL   the sea boils; eight tentacles rise and grip the notches (their tips solve onto them);
//                     the iris opens; the skull rises through it.
//   1 → 2   PHASE 1   the skull is up, eyes open (weak points), ring volleys. The disc is held level by the grips.
//   2 → 3   PHASE 2   the skull sinks and the iris seals. Tentacles let go in pairs, tower and slam across the
//                     disc; a slammed arm lies stuck (tip suckers open) and is a ridge you can climb. The disc dips
//                     toward the side that lost its grip.
// Creature sizes are fixed; the arena scale only moves the layout (disc radius, notches, tentacle roots), so a
// bigger arena never stretches Leviathan. checks() asserts the interlocks the drawing relies on.
import {clamp01, fabrik, seg, v} from './rig.js';

export const SPEC = {
  discR: 20, // at scale 1
  discTop: 0,
  discThick: 1.6,
  lip: 0.9, // raised lip height at the rim
  poolR: 8.6,
  seaY: -8,
  notches: 8,
  arm: {links: 15, linkL: 2.5, rootOut: 4.5, rootY: -10, r0: 1.25, r1: 0.3},
  skull: {r: 7, rise: 4.6, sunkY: -18},
  irisPlates: 8,
  maxTiltDeg: 7,
  slam: {period: 5, reach: 17, tower: 16}, // reach: how far in from the rim a slam lands (m)
  gripIn: 4, // a gripping tip holds the disc top this far in from the rim
  rimLinks: 7, // links from the root to the rim lip; the rest go over it
};

const TAU = Math.PI * 2;

/** Rotate p about the origin by the disc tilt (axis in the floor plane, angle in radians). */
function tiltFn(axis, ang) {
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  const [kx, ky, kz] = axis;
  return (p) => {
    const d = kx * p[0] + ky * p[1] + kz * p[2];
    const cx = [ky * p[2] - kz * p[1], kz * p[0] - kx * p[2], kx * p[1] - ky * p[0]];
    return [p[0] * c + cx[0] * s + kx * d * (1 - c), p[1] * c + cx[1] * s + ky * d * (1 - c), p[2] * c + cx[2] * s + kz * d * (1 - c)];
  };
}

/** Which arm pair slams at time t in phase two, and where it is in its stroke (0..1). */
function slamState(k, t, p2) {
  if (p2 <= 0) return {on: false, u: 0};
  const P = SPEC.slam.period;
  const pair = Math.floor(t / P) % (SPEC.notches / 2);
  if (k % (SPEC.notches / 2) !== pair) return {on: false, u: 0};
  return {on: true, u: (t % P) / P};
}

export function model(s, t, scale = 1) {
  const R = SPEC.discR * scale;
  const A = SPEC.arm;
  const out = {tubes: [], slabs: [], balls: [], weak: [], spots: [], info: {}, R};
  const arrive = seg(s, 0.05, 1);
  const grip = seg(s, 0.25, 0.75); // tentacles reach the notches
  // order matters: the iris is fully open before the skull reaches the disc, and the skull is gone before it seals
  const irisOpen = seg(s, 0.5, 0.75) * (1 - seg(s, 2.15, 2.35));
  const skullUp = seg(s, 0.75, 1) * (1 - seg(s, 2, 2.15));
  const p2 = seg(s, 2.2, 2.35);

  // --- which grips are released this instant (phase two), and the tilt that follows
  const strokes = [];
  let dipX = 0;
  let dipZ = 0;
  for (let k = 0; k < SPEC.notches; k++) {
    const st = slamState(k, t, p2);
    strokes.push(st);
    if (st.on && st.u > 0.05 && st.u < 0.95) {
      const a = (k / SPEC.notches) * TAU;
      dipX += Math.sin(a);
      dipZ += Math.cos(a);
    }
  }
  const dipLen = Math.hypot(dipX, dipZ);
  // a bigger disc tilts less: the rim may rise at most 3 m, or the grips on the high side lose their reach
  const maxTilt = Math.min((SPEC.maxTiltDeg * Math.PI) / 180, Math.asin(3 / R));
  const tiltAng = dipLen > 0 ? maxTilt * p2 : 0;
  const axis = dipLen > 0 ? [dipZ / dipLen, 0, -dipX / dipLen] : [1, 0, 0]; // dips toward the released side
  const T = tiltFn(axis, tiltAng);
  out.tilt = {axis, angle: tiltAng};

  // --- the iris: plates slide out under the disc as it opens
  const nI = SPEC.irisPlates;
  for (let k = 0; k < nI; k++) {
    const a = (k / nI) * TAU + Math.PI / nI;
    const dir = [Math.sin(a), 0, Math.cos(a)];
    const plateL = SPEC.poolR;
    const centerR = plateL * 0.5 + irisOpen * plateL; // closed: covers 0..poolR; open: poolR..2·poolR (under the disc)
    const p = T(v.add(v.mul(dir, centerR), [0, -0.35 - 0.25 * (k % 2), 0]));
    const w = 2 * SPEC.poolR * Math.sin(Math.PI / nI) * 1.15;
    out.slabs.push({k: 'iris', p, up: T([0, 1, 0]), fwd: T(dir), s: [w, 0.3, plateL]});
  }
  out.info.aperture = irisOpen * SPEC.poolR;

  // --- notches on the rim (move with the tilt)
  const notches = [];
  for (let k = 0; k < SPEC.notches; k++) {
    const a = (k / SPEC.notches) * TAU;
    const dir = [Math.sin(a), 0, Math.cos(a)];
    const n = T(v.add(v.mul(dir, R - SPEC.gripIn), [0, SPEC.discTop + 0.5, 0]));
    notches.push(n);
    out.slabs.push({k: 'notch', p: T(v.add(v.mul(dir, R - 0.2), [0, SPEC.lip * 0.5, 0])), up: T([0, 1, 0]), fwd: T(dir), s: [2.6, SPEC.lip + 0.4, 1.6]});
  }

  // --- tentacles: rooted in the sea outside the rim, tips solved onto their targets
  let stuck = 0;
  const arms = [];
  for (let k = 0; k < SPEC.notches; k++) {
    const a = (k / SPEC.notches) * TAU;
    const dir = [Math.sin(a), 0, Math.cos(a)];
    const root = v.add(v.mul(dir, R + A.rootOut), [0, A.rootY, 0]);
    const under = v.add(v.mul(dir, R + A.rootOut + 2), [0, SPEC.seaY - 10, 0]); // waiting under the sea
    // arriving, a tip rises outside the rim first, then comes in over it (it never cuts through the disc)
    const above = T(v.add(v.mul(dir, R + 2), [0, SPEC.lip + 7, 0]));
    let target = grip < 0.5 ? v.lerp(under, above, seg(grip, 0, 0.5)) : v.lerp(above, notches[k], seg(grip, 0.5, 1));
    // the spare length arches up over the rim once gripping; while waiting it bends down, under the sea
    let pole = v.lerp(v.add(v.mul(dir, R + A.rootOut + 6), [0, SPEC.seaY - 14, 0]), v.add(v.mul(dir, R - SPEC.gripIn * 0.5), [0, 12, 0]), seg(grip, 0, 0.6));
    const st = strokes[k];
    let isStuck = false;
    if (st.on) {
      // lands a fixed distance in from the rim (a creature size, not an arena size), on the disc's top
      const across = T(v.add(v.mul(dir, R - SPEC.slam.reach), [0, SPEC.discTop + 0.6, 0]));
      const tower = T(v.add(v.mul(dir, R - 2), [0, SPEC.slam.tower, 0]));
      const u = st.u;
      if (u < 0.3) target = v.lerp(notches[k], tower, seg(u, 0, 0.3));
      else if (u < 0.4) target = v.lerp(tower, across, seg(u, 0.3, 0.4));
      else if (u < 0.75) {
        target = across;
        isStuck = true;
      } else target = v.lerp(across, notches[k], seg(u, 0.75, 1));
      pole = T(v.add(v.mul(dir, R - SPEC.slam.reach * 0.5), [0, SPEC.slam.tower + 6, 0]));
    }
    if (isStuck) stuck++;
    // two solves: root to the rim lip, then over the lip to the target, so the arm drapes over the edge
    const lipPt = T(v.add(v.mul(dir, R + 0.4), [0, SPEC.lip + 0.7, 0]));
    const out1 = v.add(v.mul(dir, R + A.rootOut + 8), [0, -2, 0]);
    // waiting: one solve straight to the target under the sea; arriving and after: over the lip in two solves
    const waiting = grip < 0.5 && !st.on;
    const p1 = waiting ? fabrik(root, target, A.links, A.linkL, pole, 40) : fabrik(root, lipPt, SPEC.rimLinks, A.linkL, out1, 40);
    const p2s = waiting ? null : fabrik(p1[SPEC.rimLinks], target, A.links - SPEC.rimLinks, A.linkL, pole, 40); // from where the first solve ended
    const pts = waiting ? p1 : p1.concat(p2s.slice(1));
    arms.push({k, pts, target, isStuck, root, lipPt, waiting, notch: notches[k], gripping: !st.on && grip > 0.999});
    for (let i = 0; i < A.links; i++) {
      const r = A.r0 + (A.r1 - A.r0) * (i / (A.links - 1));
      out.tubes.push({k: i % 2 ? 'fleshA' : 'fleshB', a: pts[i], b: pts[i + 1], r});
      out.balls.push({k: 'knuckle', p: pts[i + 1], r: r * 1.15}); // the joint collars, like the flagship's arm wheels
    }
    const tip = pts[A.links];
    out.tubes.push({k: 'claw', a: tip, b: v.add(tip, v.mul(v.norm(v.sub(tip, pts[A.links - 1])), 1.4)), r: 0.22});
    out.weak.push({id: `tip${k}`, p: tip, open: isStuck ? 1 : 0, r: 0.45});
  }
  out.arms = arms;

  // --- the skull, rising through the iris
  const S = SPEC.skull;
  const cy = S.sunkY + (S.rise - S.sunkY) * skullUp + Math.sin(t * 0.6) * 0.8 * skullUp;
  const c = [0, cy, 0];
  out.skull = {c, r: S.r};
  out.balls.push({k: 'bone', p: c, r: S.r});
  // crown plates lie on the skull's surface: two rows facing out
  for (let row = 0; row < 2; row++) {
    for (let k = 0; k < 6; k++) {
      const az = -1.05 + k * 0.42;
      const el = 0.6 + row * 0.38;
      const n = [Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)];
      out.slabs.push({k: 'plate', p: v.add(c, v.mul(n, S.r + 0.15)), up: n, fwd: [Math.sin(az), 0, Math.cos(az)], s: [2.4, 0.4, 2.0]});
    }
  }
  const face = [0, 0, 1];
  for (const sx of [-1, 1]) {
    const eye = v.add(c, [sx * 2.7, 1.2, S.r * 0.86]);
    out.slabs.push({k: 'socket', p: eye, up: [0, 1, 0], fwd: face, s: [3.2, 2.2, 1.6]});
    out.weak.push({id: `eye${sx}`, p: v.add(eye, [0, 0, 0.9]), open: skullUp > 0.9 && s < 2 ? 1 : 0, r: 1.0});
    // tusks: from the cheek, curving forward and down
    const t0 = v.add(c, [sx * 5.2, -2.2, 4.4]);
    out.tubes.push({k: 'bone', a: t0, b: v.add(t0, [sx * 1.2, -2.8, 4.2]), r: 0.6});
  }
  // jaw: a hinge under the skull, opening with the bite
  const bite = 0.35 * Math.max(0, Math.sin(t * 1.3)) * skullUp;
  const hinge = v.add(c, [0, -3.6, 2]);
  const jawDir = [0, -Math.sin(bite), Math.cos(bite)];
  out.slabs.push({k: 'bone', p: v.add(hinge, v.mul(jawDir, 3.2)), up: [0, Math.cos(bite), Math.sin(bite)], fwd: jawDir, s: [8.6, 1.6, 6.8]});
  for (let k = 0; k < 10; k++) {
    const x = -3.2 + k * 0.71;
    const top = v.add(c, [x, -2.7, 6.3]);
    out.tubes.push({k: 'bone', a: top, b: v.add(top, [0, -1.1, 0.1]), r: 0.22});
  }
  // the mantle trailing down into the sea
  out.tubes.push({k: 'fleshB', a: v.add(c, [0, -3, -3]), b: v.add(c, [0, -20, -9]), r: 5.5, round: true});

  // --- spawn spots: on the disc, off the pool and off the slam lines; marked on the tilted disc
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * TAU + TAU / 16;
    const r = SPEC.poolR + 1.5 + (R - SPEC.poolR - 3) * (k % 2 ? 0.3 : 0.75);
    out.spots.push(T([Math.sin(a) * r, SPEC.discTop + 0.2, Math.cos(a) * r]));
  }
  out.info = {...out.info, arrive, grip, irisOpen, skullUp, p2, stuck, tiltDeg: (tiltAng * 180) / Math.PI};
  out.T = T;
  out.Tinv = tiltFn(axis, -tiltAng);
  return out;
}

/** The interlocks the drawing relies on. Each: {name, ok, value}. */
export function checks(s, t, scale = 1) {
  const m = model(s, t, scale);
  const A = SPEC.arm;
  const out = [];
  const reach = A.links * A.linkL;
  for (const arm of m.arms) {
    const d = v.dist(arm.root, arm.notch);
    out.push({name: `arm ${arm.k}: notch within reach`, ok: d < reach - 1, value: `${d.toFixed(1)} < ${reach}`});
    const tipErr = v.dist(arm.pts[A.links], arm.target);
    const lipErr = v.dist(arm.pts[SPEC.rimLinks], arm.lipPt);
    if (!arm.waiting) out.push({name: `arm ${arm.k}: drapes over the lip`, ok: lipErr < 0.05, value: lipErr.toFixed(3)});
    if (arm.waiting) {
      // hidden while waiting: every joint stays under the sea
      const top = Math.max(...arm.pts.map((p) => p[1]));
      if (m.info.grip < 0.01) out.push({name: `arm ${arm.k}: hidden under the sea in the run`, ok: top < SPEC.seaY - 0.3, value: top.toFixed(2)});
    }
    if (arm.gripping) out.push({name: `arm ${arm.k}: tip on its notch`, ok: tipErr < 0.05, value: tipErr.toFixed(3)});
    if (arm.isStuck) out.push({name: `arm ${arm.k}: stuck tip on the disc`, ok: tipErr < 0.05 && Math.hypot(arm.target[0], arm.target[2]) < m.R, value: tipErr.toFixed(3)});
    // no joint sinks into the disc inside its footprint (the tip may touch the top)
    let worst = Infinity;
    for (let i = 1; i < A.links; i++) {
      const p = m.Tinv(arm.pts[i]); // in the disc's own (tilted) frame
      const r = Math.hypot(p[0], p[2]);
      if (r < m.R - 0.5) worst = Math.min(worst, p[1] - (SPEC.discTop - 0.2));
    }
    out.push({name: `arm ${arm.k}: stays above the disc`, ok: worst > -0.05, value: worst === Infinity ? 'clear' : worst.toFixed(2)});
    let lenErr = 0;
    for (let i = 0; i < A.links; i++) lenErr = Math.max(lenErr, Math.abs(v.dist(arm.pts[i], arm.pts[i + 1]) - A.linkL));
    out.push({name: `arm ${arm.k}: link lengths exact`, ok: lenErr < 1e-6, value: lenErr.toExponential(1)});
  }
  // the skull clears the iris whenever it is level with the disc
  const top = m.skull.c[1] + m.skull.r;
  const bottom = m.skull.c[1] - m.skull.r;
  const passing = top > SPEC.discTop - SPEC.discThick && bottom < SPEC.discTop;
  if (passing) {
    const gap = m.info.aperture - m.skull.r;
    out.push({name: 'skull clears the open iris', ok: gap > 0.3, value: gap.toFixed(2)});
  }
  out.push({name: 'tilt within limit', ok: m.info.tiltDeg <= SPEC.maxTiltDeg + 1e-6, value: m.info.tiltDeg.toFixed(2)});
  out.push({name: 'spots on the disc, off the pool', ok: m.spots.every((p) => Math.hypot(p[0], p[2]) < m.R - 1 && Math.hypot(p[0], p[2]) > SPEC.poolR + 1), value: m.spots.length});
  return out;
}

export const STATES = [
  {at: 0, name: 'Run', note: 'No boss. The pool is sealed; the rim notches are empty.'},
  {at: 0.5, name: 'Arrival', note: 'The sea boils, tentacles grip the rim, the iris opens, the skull rises.'},
  {at: 1, name: 'Phase 1', note: 'Surfaced: eyes open, ring volleys; the grips hold the disc level.'},
  {at: 2, name: 'Phase 2', note: 'The skull sinks, the iris seals; pairs of tentacles slam and the disc dips toward them.'},
];
export const clampS = (s) => Math.min(3, Math.max(0, s));
export {clamp01};
