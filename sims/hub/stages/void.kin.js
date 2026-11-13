// The Void and Belphegor (Sloth), model only. Stage value s from 0 to 3:
//   0       RUN       three tiers over the abyss: the centre disc (0 m), the middle ring (4 m, 8 segments) and the
//                     outer ring (8 m, 12 platforms with Dash-wide gaps). Pads lift a tier. No boss.
//   0 → 1   ARRIVAL   Belphegor, a 28 m sleeper-moth, lowers on its cord from the dark; six hook-legs reach down
//                     and hook the outer edge of every other platform (their tips solve onto the edges).
//   1 → 2   PHASE 1   it hangs high; the middle ring turns (its gaps move); a sleep beam sweeps the floor tier.
//   2 → 3   PHASE 2   the centre disc splits and its halves slide apart; Belphegor sinks through the gap. Its hooks
//                     pull the hooked platforms' inner edges up into ramps whose tops reach a jump below the weak
//                     points on its back. The beam sweeps the middle and top tiers in turn.
import {fabrik, seg, v} from './rig.js';

export const SPEC = {
  centreR: 8,
  mid: {r0: 10, r1: 16, y: 4, segs: 8, gapM: 2.2},
  outer: {r0: 18, r1: 24, y: 8, segs: 12, gapM: 4.5}, // gap: a running Dash wide (Dash: 50 m/s for 0.25 s)
  thick: 1.2,
  body: {r: 5, half: 9, highY: 34, sunkY: 0.5}, // capsule: radius and half-length of the straight part
  hook: {legs: 6, links: 11, linkL: 5},
  ramp: {maxDeg: 32},
  dashM: 12.5,
  jumpM: 1.8,
};
const TAU = Math.PI * 2;

/** Angular span of one segment and the gap between (radians) for a ring at radius r. */
function ringSlots(ring, scale) {
  const r = ((ring.r0 + ring.r1) / 2) * scale;
  const gapA = (ring.gapM / r); // gap is a fixed walking distance, not a scaled one
  const segA = TAU / ring.segs - gapA;
  return {gapA, segA};
}

export function model(s, t, scale = 1) {
  const sc = scale;
  const out = {tubes: [], slabs: [], balls: [], weak: [], spots: [], info: {}};
  const arrive = seg(s, 0.05, 0.75);
  const hooked = seg(s, 0.55, 1);
  const p1 = seg(s, 1, 1.1) * (1 - seg(s, 2, 2.1));
  const p2 = seg(s, 2, 2.4);
  const split = seg(s, 2, 2.2); // the centre opens before the body arrives
  const sink = seg(s, 2.15, 2.4);

  // the middle ring turns in phase one, and keeps its angle after
  const midTurn = (s < 1 ? 0 : s < 2 ? (s - 1) * 1.6 : 1.6) + p1 * Math.sin(t * 0.25) * 0.4;
  const mid = SPEC.mid;
  const outer = SPEC.outer;
  const ms = ringSlots(mid, sc);
  const os = ringSlots(outer, sc);
  out.mid = {turn: midTurn, ...ms};

  // the centre disc: two halves that slide apart along x
  const half = split * (SPEC.body.r + 1.2);
  out.centre = {half, r: SPEC.centreR * sc};

  // Belphegor's body: hangs on a cord, sinks through the centre in phase two
  const B = SPEC.body;
  // it hangs high enough to reach every hooked platform's inner edge (lower on a big arena), and in phase two sinks
  // until its back is a jump above the ramps' tops
  const reach = SPEC.hook.links * SPEC.hook.linkL * 0.9;
  const edgeR = outer.r0 * sc - B.r;
  const highY = Math.min(B.highY, outer.y + Math.sqrt(Math.max(1, reach * reach - edgeR * edgeR)) - B.half * 0.4);
  const depth0 = (outer.r1 - outer.r0) * sc;
  const rampTop = outer.y + depth0 * Math.sin((SPEC.ramp.maxDeg * Math.PI) / 180);
  const sunkY = rampTop + 1.0 - B.half - B.r;
  const bodyY = highY + 70 * (1 - arrive) + (sunkY - highY) * sink + Math.sin(t * 0.4) * 0.6 * (1 - sink);
  const c = [0, bodyY, 0];
  out.body = {c, r: B.r, half: B.half};
  // body: a capsule drawn as a tube with caps, the cord above
  out.tubes.push({k: 'body', a: [0, bodyY - B.half, 0], b: [0, bodyY + B.half, 0], r: B.r, round: true});
  out.balls.push({k: 'body', p: [0, bodyY + B.half, 0], r: B.r}, {k: 'body', p: [0, bodyY - B.half, 0], r: B.r});
  out.tubes.push({k: 'cord', a: [0, bodyY + B.half + B.r, 0], b: [0, bodyY + 140, 0], r: 0.7});
  // face at the bottom: a pale mask with sockets, looking down
  out.balls.push({k: 'mask', p: [0, bodyY - B.half - B.r * 0.6, 0], r: B.r * 0.75});
  // weak points on its back (top): reachable from the ramps in phase two
  const backY = bodyY + B.half + B.r;
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * TAU;
    out.weak.push({id: `back${k}`, p: [Math.sin(a) * 2, backY - 0.3, Math.cos(a) * 2], open: p2 > 0.9 ? 1 : 0.25, r: 0.9});
  }
  out.info.backY = backY;

  // outer platforms: every other one gets a hook; hooked ones tilt into ramps in phase two
  const H = SPEC.hook;
  out.platforms = [];
  for (let k = 0; k < outer.segs; k++) {
    const a0 = (k / outer.segs) * TAU + os.gapA / 2;
    const a1 = a0 + os.segA;
    const am = (a0 + a1) / 2;
    const dir = [Math.sin(am), 0, Math.cos(am)];
    const isHooked = k % 2 === 0;
    // in phase two the hooks drag their platforms in over the middle ring (they sit higher, so they pass over it)
    const maxT = (SPEC.ramp.maxDeg * Math.PI) / 180;
    // solve the pull so the tilted ramp's top lands 1 m from the body: r1 - pull - depth·cos(tilt) = r + 1
    const pull = isHooked ? p2 * (outer.r1 * sc - (outer.r1 - outer.r0) * sc * Math.cos(maxT) - (B.r + 1)) : 0;
    const r0 = outer.r0 * sc - pull;
    const r1 = outer.r1 * sc - pull;
    const depth = r1 - r0;
    // ramp: hinge on the outer edge, inner edge lifts by the tilt
    const tilt = isHooked ? ((SPEC.ramp.maxDeg * Math.PI) / 180) * p2 : 0;
    const hinge = v.add(v.mul(dir, r1), [0, outer.y, 0]);
    const innerTop = v.add(hinge, v.add(v.mul(dir, -depth * Math.cos(tilt)), [0, depth * Math.sin(tilt), 0]));
    out.platforms.push({k, a0, a1, am, dir, isHooked, tilt, hinge, innerTop, r0, r1});
    const width = 2 * ((r0 + r1) / 2) * Math.sin(os.segA / 2);
    const centre = v.lerp(hinge, innerTop, 0.5);
    const up = [-dir[0] * Math.sin(tilt), Math.cos(tilt), -dir[2] * Math.sin(tilt)];
    out.slabs.push({k: isHooked ? 'hooked' : 'tier', p: v.sub(centre, v.mul(up, SPEC.thick / 2)), up, fwd: v.mul(dir, -1), s: [width, SPEC.thick, depth]});
    if (isHooked) {
      // a hook-leg from the body to the platform's inner edge (where it pulls)
      const legIdx = k / 2;
      const la = (legIdx / H.legs) * TAU;
      const shoulder = [Math.sin(la) * B.r * 0.9, bodyY + B.half * 0.4, Math.cos(la) * B.r * 0.9];
      const folded = v.add(shoulder, v.mul([Math.sin(la), 0, Math.cos(la)], 4));
      const edge = v.add(innerTop, [0, 0.2, 0]);
      const target = v.lerp(v.add(folded, [0, -8, 0]), edge, hooked);
      const pole = v.add(v.mul([Math.sin(la), 0, Math.cos(la)], 40 * sc), [0, bodyY + 10, 0]);
      const pts = fabrik(shoulder, target, H.links, H.linkL, pole, 64);
      out.platforms[k].leg = {pts, target, edge, hooked};
      for (let i = 0; i < H.links; i++) {
        out.tubes.push({k: 'leg', a: pts[i], b: pts[i + 1], r: 0.55 - i * 0.05});
        out.balls.push({k: 'joint', p: pts[i + 1], r: 0.62 - i * 0.05});
      }
      out.tubes.push({k: 'hook', a: pts[H.links], b: v.add(pts[H.links], [0, -1.6, 0]), r: 0.3});
    }
  }

  // the sleep beam: a wedge sweeping one tier
  const tierIdx = p2 > 0.5 ? (Math.floor(t / 6) % 2 ? 1 : 2) : 0;
  const tiers = [[0, SPEC.centreR * sc, 0], [mid.r0 * sc, mid.r1 * sc, mid.y], [outer.r0 * sc, outer.r1 * sc, outer.y]];
  out.beam = {on: arrive > 0.99 && s >= 1, r0: tiers[tierIdx][0], r1: tiers[tierIdx][1], y: tiers[tierIdx][2] + 0.15, angle: t * 0.9, width: 0.5, tier: tierIdx};

  // spots: on the tiers, a pair per tier and two on the outer ring
  const spotAt = (r, y, a) => [Math.sin(a) * r, y + 0.2, Math.cos(a) * r];
  out.spots = [
    spotAt(SPEC.centreR * sc * 0.5, 0, 0.6), spotAt(SPEC.centreR * sc * 0.5, 0, 3.7),
    spotAt(((mid.r0 + mid.r1) / 2) * sc, mid.y, midTurn + TAU / 16), spotAt(((mid.r0 + mid.r1) / 2) * sc, mid.y, midTurn + (5 * TAU) / 16),
    spotAt(((outer.r0 + outer.r1) / 2) * sc, outer.y, os.gapA / 2 + os.segA / 2 + TAU / 12), spotAt(((outer.r0 + outer.r1) / 2) * sc, outer.y, os.gapA / 2 + os.segA / 2 + (7 * TAU) / 12),
    spotAt(((outer.r0 + outer.r1) / 2) * sc, outer.y, os.gapA / 2 + os.segA / 2 + (3 * TAU) / 12), spotAt(((mid.r0 + mid.r1) / 2) * sc, mid.y, midTurn + (11 * TAU) / 16),
  ];
  out.info = {...out.info, arrive, hooked, p1, p2, split, sink, midTurn, tier: tierIdx, bodyY};
  return out;
}

export function checks(s, t, scale = 1) {
  const m = model(s, t, scale);
  const out = [];
  const H = SPEC.hook;
  for (const P of m.platforms) {
    if (!P.leg) continue;
    const err = v.dist(P.leg.pts[H.links], P.leg.target);
    if (P.leg.hooked > 0.999) out.push({name: `hook ${P.k}: tip on the platform edge`, ok: err < 0.05, value: err.toFixed(3)});
    let lenErr = 0;
    for (let i = 0; i < H.links; i++) lenErr = Math.max(lenErr, Math.abs(v.dist(P.leg.pts[i], P.leg.pts[i + 1]) - H.linkL));
    out.push({name: `hook ${P.k}: link lengths exact`, ok: lenErr < 1e-6, value: lenErr.toExponential(1)});
    if (m.info.p2 > 0.999) {
      // the ramp's top is within a jump below the weak points on the back
      const below = m.info.backY - P.innerTop[1];
      out.push({name: `ramp ${P.k}: back within a jump of its top`, ok: below > -0.5 && below <= SPEC.jumpM + 0.3, value: below.toFixed(2)});
      const horiz = Math.hypot(P.innerTop[0], P.innerTop[2]) - m.body.r;
      out.push({name: `ramp ${P.k}: top at the body's edge`, ok: horiz < 3, value: horiz.toFixed(2)});
    }
  }
  // outer gaps need a Dash but not more than one
  const os = ringSlots(SPEC.outer, scale);
  const gapM = os.gapA * ((SPEC.outer.r0 + SPEC.outer.r1) / 2) * scale;
  out.push({name: 'outer gaps: a running Dash wide', ok: gapM > 3 && gapM < SPEC.dashM, value: gapM.toFixed(2)});
  // the body passes through the open centre without touching the halves
  const b = m.body;
  const lo = b.c[1] - b.half - b.r;
  const hi = b.c[1] + b.half + b.r;
  if (lo < 0.2 && hi > -SPEC.thick) out.push({name: 'body clears the split centre', ok: m.centre.half >= b.r + 0.5, value: (m.centre.half - b.r).toFixed(2)});
  // nothing of the boss shows in the run
  if (s < 0.02) out.push({name: 'no boss in the run', ok: m.body.c[1] - b.half - b.r > 60, value: (m.body.c[1] - b.half - b.r).toFixed(1)});
  return out;
}

export const STATES = [
  {at: 0, name: 'Run', note: 'Three tiers over the abyss. No boss.'},
  {at: 0.5, name: 'Arrival', note: 'Belphegor lowers on its cord; six hooks catch the outer platforms.'},
  {at: 1, name: 'Phase 1', note: 'It hangs high; the middle ring turns; the beam sweeps the floor tier.'},
  {at: 2, name: 'Phase 2', note: 'The centre splits, it sinks through; hooked platforms tilt into ramps to its back.'},
];
