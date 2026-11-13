// The Ruins and Belial (Pride), model only. Stage value s from 0 to 3:
//   0       RUN       a courtyard; four great pillars stand in a tight square round the cracked slam tiles; a gallery
//                     ring of slabs on posts runs round it. No boss.
//   0 → 1   ARRIVAL   Belial's throne rises out of the crypt beyond the north gallery; chains run from each pillar's
//                     top to his shield.
//   1 → 2   PHASE 1   each pillar's base crack is a weak point; one by one they break and fall outward, and each
//                     comes to rest on the gallery's inner edge: a ramp up (the fall angle is solved for that).
//                     The shield shrinks with every chain that goes slack.
//   2 → 3   PHASE 2   the shield is gone; he stands, steps onto the gallery and walks it, feet planted on the slabs
//                     (closed-form stepping, like the centipede); slabs crumble behind him, never under a foot.
//                     His face is open.
import {twoBone} from '../../bonepede-shared/kin.js';
import {seg, v} from './rig.js';

export const SPEC = {
  court: 46, // side (m) at scale 1
  gallery: {r0: 15, r1: 19, slabs: 20, thick: 0.8, maxG: 10},
  pillar: {w: 3, h: 16, rbMin: 3},
  maxSlopeDeg: 40,
  belial: {hips: 17, thigh: 9.5, shin: 9.5, step: 3.2, footOut: 2.4, torso: [12, 14, 6], head: 5},
  shieldR: 15,
  throneOut: 12, // how far past the gallery the throne stands (north)
};
const TAU = Math.PI * 2;

/** The layout numbers at a scale: gallery radii and height, pillar radius (solved for a walkable ramp). */
export function layout(scale) {
  const G = SPEC.gallery;
  const r0 = G.r0 * scale;
  const r1 = G.r1 * scale;
  const tanMin = Math.tan(((90 - SPEC.maxSlopeDeg) * Math.PI) / 180); // the fall angle from vertical must be at least this
  // the pillar rests on the gallery's top edge, half a slab above the gallery height
  const height = Math.min(G.maxG, (r0 - SPEC.pillar.rbMin) / tanMin - G.thick / 2);
  const rb = Math.max(SPEC.pillar.rbMin, r0 - (height + G.thick / 2) * tanMin);
  const footOut = Math.min(SPEC.belial.footOut, (r1 - r0) / 2 - 0.4); // his stance fits the gallery's width
  // a pillar must be long enough to reach the gallery edge when it falls (taller pillars in bigger arenas)
  const ph = Math.max(SPEC.pillar.h, Math.hypot(r0 - rb, height + G.thick / 2) + 1.5);
  return {ph, r0, r1, height, rb, footOut, mid: (r0 + r1) / 2, throne: [0, 0, -(r1 + SPEC.throneOut)]};
}

export function model(s, t, scale = 1) {
  const L = layout(scale);
  const out = {tubes: [], slabs: [], balls: [], weak: [], spots: [], info: {}, L};
  const arrive = seg(s, 0.05, 0.9);
  const stand = seg(s, 2, 2.2);
  const p2 = seg(s, 2, 2.1);
  // pillars fall at s = 1.25, 1.45, 1.65, 1.85 (each over 0.12)
  const P = SPEC.pillar;
  out.pillars = [];
  let standing = 0;
  for (let k = 0; k < 4; k++) {
    const a = Math.PI / 4 + (k / 4) * TAU;
    const dir = [Math.sin(a), 0, Math.cos(a)];
    const fall = seg(s, 1.13 + k * 0.2, 1.25 + k * 0.2);
    // rests when the pillar's centre line passes over the gallery's inner top edge
    const restTheta = Math.atan2(L.r0 - L.rb, L.height + SPEC.gallery.thick / 2);
    const theta = restTheta * fall;
    const base = v.mul(dir, L.rb);
    const axis = [Math.sin(theta) * dir[0], Math.cos(theta), Math.sin(theta) * dir[2]];
    const top = v.add(base, v.mul(axis, L.ph));
    if (fall < 0.5) standing++;
    out.pillars.push({k, a, dir, base, top, theta, restTheta, fall, axis});
    out.slabs.push({k: 'pillar', p: v.add(base, v.mul(axis, L.ph / 2)), up: axis, fwd: dir, s: [P.w, L.ph, P.w]});
    // the crack at the base is the weak point in phase one
    out.weak.push({id: `crack${k}`, p: v.add(base, v.add(v.mul(dir, -P.w / 2 - 0.1), [0, 1.2, 0])), open: s >= 1 && fall < 0.05 ? 1 : 0, r: 0.6});
  }

  // the throne rises in the arrival; Belial on it, seated
  const B = SPEC.belial;
  const throneY = -60 * (1 - arrive);
  const throne = v.add(L.throne, [0, throneY, 0]);
  out.slabs.push({k: 'throne', p: v.add(throne, [0, 5, -3]), up: [0, 1, 0], fwd: [0, 0, 1], s: [18, 10, 10]});
  out.slabs.push({k: 'throne', p: v.add(throne, [0, 15, -7]), up: [0, 1, 0], fwd: [0, 0, 1], s: [18, 14, 2]});

  // phase two: walk the gallery from the north, clockwise most of the way round
  const walk = Math.max(0, s - 2.2) / 0.8; // 0..1
  const stepAng = B.step / L.mid;
  const travel = walk * TAU * 0.85; // radians walked
  const heading = Math.PI + travel; // angle on the ring (0 = +z)
  const ringPt = (ang, r) => [Math.sin(ang) * r, L.height, Math.cos(ang) * r];
  // seated (phase one) or walking (phase two): hips position and facing
  let hips;
  let fwd;
  if (stand < 1) {
    const seat = v.add(throne, [0, 10, 2]);
    const firstStep = v.add(ringPt(Math.PI, L.mid), [0, B.hips, 0]);
    hips = v.lerp(seat, firstStep, stand);
    fwd = [0, 0, 1];
  } else {
    hips = v.add(ringPt(heading, L.mid), [0, B.hips + 0.4 * Math.abs(Math.sin((travel / stepAng) * Math.PI)), 0]);
    fwd = [Math.cos(heading), 0, -Math.sin(heading)]; // tangent, clockwise seen from above
  }
  const side = [fwd[2], 0, -fwd[0]];
  // legs: closed-form stepping on the ring; each foot's planted spot is a fixed point on a slab
  out.feet = [];
  const legOut = [];
  for (const sd of [1, -1]) {
    const hip = v.add(hips, v.mul(side, sd * 2.6));
    let foot;
    let planted = true;
    if (stand < 1) {
      foot = v.lerp(v.add(throne, [sd * 3, 0.5, 6]), v.add(ringPt(Math.PI, L.mid + sd * L.footOut), [0, SPEC.gallery.thick / 2, 0]), stand);
      planted = stand > 0.999 || stand < 0.001;
    } else {
      const cyc = travel / stepAng / 2 + (sd > 0 ? 0 : 0.5);
      const n = Math.floor(cyc);
      const f = cyc - n;
      const at = (m) => v.add(ringPt(Math.PI + (m * 2 + (sd > 0 ? 0 : 1)) * stepAng, L.mid + sd * L.footOut), [0, SPEC.gallery.thick / 2, 0]);
      if (f < 0.6) foot = at(n);
      else {
        planted = false;
        const k = (f - 0.6) / 0.4;
        foot = v.lerp(at(n), at(n + 1), k * k * (3 - 2 * k));
        foot[1] += 2.4 * Math.sin(Math.PI * k);
      }
    }
    const {knee, foot: tip} = twoBone(hip, foot, B.thigh, B.shin, v.add(fwd, [0, 0.3, 0]));
    legOut.push({hip, knee, tip, planted});
    out.feet.push({p: tip, planted, sd});
    out.tubes.push({k: 'colossus', a: hip, b: knee, r: 1.7, round: true}, {k: 'colossus', a: knee, b: tip, r: 1.4, round: true});
    out.slabs.push({k: 'colossusDark', p: v.add(tip, [0, 0.4, 0]), up: [0, 1, 0], fwd, s: [2.8, 0.8, 4.2]});
  }
  out.legs = legOut;
  // torso, head with crown, arms
  const T = B.torso;
  const chest = v.add(hips, [0, T[1] / 2 + 1, 0]);
  out.slabs.push({k: 'colossus', p: chest, up: [0, 1, 0], fwd, s: T});
  const head = v.add(chest, [0, T[1] / 2 + B.head / 2 + 0.6, 0]);
  out.slabs.push({k: 'colossus', p: head, up: [0, 1, 0], fwd, s: [B.head, B.head, B.head]});
  for (let c = 0; c < 5; c++) {
    const base = v.add(head, v.add(v.mul(side, -2 + c), [0, B.head / 2, 0]));
    out.tubes.push({k: 'gold', a: base, b: v.add(base, [0, 2.6 - Math.abs(c - 2) * 0.5, 0]), r: 0.35});
  }
  for (const sd of [1, -1]) {
    const sh = v.add(chest, v.add(v.mul(side, sd * (T[0] / 2 + 1.2)), [0, T[1] / 2 - 1.5, 0]));
    const swing = stand > 0.5 ? 0.35 * Math.sin((travel / stepAng) * Math.PI + (sd > 0 ? Math.PI : 0)) : 0;
    const hand = v.add(sh, v.add(v.mul(fwd, Math.sin(swing) * 10), [0, -Math.cos(swing) * 12, 0]));
    out.tubes.push({k: 'colossus', a: sh, b: hand, r: 1.3, round: true});
  }
  out.weak.push({id: 'face', p: v.add(head, v.mul(fwd, B.head / 2 + 0.2)), open: p2 > 0.9 ? 1 : 0.15, r: 0.9});
  out.belial = {hips, chest, head, fwd};

  // chains from pillar tops to the shield; slack (gone) when the pillar falls
  const shieldC = v.add(chest, [0, 0, 0]);
  out.shield = {c: shieldC, r: SPEC.shieldR * (0.35 + 0.65 * (standing / 4)) * (1 - seg(s, 1.85, 2)) * seg(s, 0.6, 0.9)};
  for (const pl of out.pillars) {
    if (pl.fall > 0.02 || out.shield.r < 0.5) continue;
    const toTop = v.norm(v.sub(pl.top, shieldC));
    const anchor = v.add(shieldC, v.mul(toTop, out.shield.r));
    out.tubes.push({k: 'chain', a: pl.top, b: anchor, r: 0.18});
    pl.chain = {a: pl.top, b: anchor};
  }

  // gallery slabs: crumble a while after he has passed them, never under a planted foot
  out.slabs.gallery = [];
  const nS = SPEC.gallery.slabs;
  const segA = TAU / nS;
  out.galleryDrop = [];
  for (let k = 0; k < nS; k++) {
    const am = (k + 0.5) * segA;
    // angle he has passed this slab by (0 if ahead or not walking)
    let behind = 0;
    if (stand >= 1) {
      const rel = (((am - Math.PI) % TAU) + TAU) % TAU; // how far round from the start this slab sits
      behind = travel - rel;
    }
    const drop = behind > stepAng * 3 ? Math.min(1, (behind - stepAng * 3) / (stepAng * 2)) : 0;
    out.galleryDrop.push({k, am, drop});
  }

  // spots: in the courtyard, clear of the pillars' fall lines
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * TAU;
    const r = L.rb + 2 + (L.r0 - L.rb - 4) * (k % 2 ? 0.35 : 0.8);
    out.spots.push([Math.sin(a) * r, 0.2, Math.cos(a) * r]);
  }
  out.info = {arrive, stand, p2, walk, standing, travelDeg: (travel * 180) / Math.PI, height: L.height};
  return out;
}

export function checks(s, t, scale = 1) {
  const m = model(s, t, scale);
  const L = m.L;
  const out = [];
  for (const pl of m.pillars) {
    if (pl.fall > 0.999) {
      // the fallen pillar's centre line passes over the gallery's inner top edge, and it is long enough to reach it
      const edge = [pl.dir[0] * L.r0, L.height + SPEC.gallery.thick / 2, pl.dir[2] * L.r0];
      const rel = v.sub(edge, pl.base);
      const along = rel[0] * pl.axis[0] + rel[1] * pl.axis[1] + rel[2] * pl.axis[2];
      const off = v.len(v.sub(rel, v.mul(pl.axis, along)));
      out.push({name: `pillar ${pl.k}: rests on the gallery edge`, ok: off < 0.05 && along < L.ph, value: `${off.toFixed(3)} / ${along.toFixed(1)}`});
      const slope = 90 - (pl.theta * 180) / Math.PI;
      out.push({name: `pillar ${pl.k}: walkable slope`, ok: slope <= SPEC.maxSlopeDeg + 0.01, value: slope.toFixed(1)});
    }
    if (pl.chain) out.push({name: `pillar ${pl.k}: chain from top to shield`, ok: v.dist(pl.chain.a, pl.top) < 1e-9, value: 'exact'});
  }
  // legs: exact bone lengths, planted feet on a slab that has not dropped
  for (const leg of m.legs) {
    const e1 = Math.abs(v.dist(leg.hip, leg.knee) - SPEC.belial.thigh);
    const e2 = Math.abs(v.dist(leg.knee, leg.tip) - SPEC.belial.shin);
    out.push({name: 'leg bones exact', ok: e1 < 1e-6 && e2 < 1e-6, value: Math.max(e1, e2).toExponential(1)});
  }
  if (m.info.stand >= 1) {
    for (const f of m.feet) {
      if (!f.planted) continue;
      const r = Math.hypot(f.p[0], f.p[2]);
      const a = ((Math.atan2(f.p[0], f.p[2]) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      const k = Math.floor(a / ((Math.PI * 2) / SPEC.gallery.slabs));
      const slab = m.galleryDrop[k];
      out.push({name: 'planted foot on the gallery', ok: r > L.r0 && r < L.r1 && Math.abs(f.p[1] - (L.height + SPEC.gallery.thick / 2)) < 0.05, value: r.toFixed(2)});
      out.push({name: 'planted foot on a slab still there', ok: slab.drop === 0, value: slab.drop.toFixed(2)});
    }
  }
  if (s < 0.02) out.push({name: 'no boss in the run', ok: m.belial.head[1] < -5, value: m.belial.head[1].toFixed(1)});
  out.push({name: 'gallery height a pad-jump', ok: L.height >= 5 && L.height <= SPEC.gallery.maxG, value: L.height.toFixed(2)});
  return out;
}

export const STATES = [
  {at: 0, name: 'Run', note: 'A courtyard, four pillars round the slam tiles, a gallery ring. No boss.'},
  {at: 0.5, name: 'Arrival', note: 'The throne rises from the crypt; chains bind the pillars to his shield.'},
  {at: 1, name: 'Phase 1', note: 'Break each pillar at its cracked base; it falls onto the gallery as a ramp.'},
  {at: 2, name: 'Phase 2', note: 'He walks the gallery; it crumbles behind him. His face is open.'},
];
