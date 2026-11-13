// MITE MT-1, the swarm's tier one, model only. Reference: the teardown repo's Mellis HB-7 flapping-wing drone (its
// part language: banded capsules, a geared thorax drive, veined wings on hinge clips, rod-and-ball legs), with flesh
// plates. Its job is to bite, so the head carries an angular gripper: two mandibles on pivots, swung by toggle links
// from a slider (the gripper geometry real robot grippers use).
// Inputs: crank angle θ (the flap) and bite b (0 open, 1 shut). Frame: x right, y up, z forward; metres.

export const G = {
  thorax: {r: 0.11, len: 0.16},
  head: {z: 0.17, r: 0.085},
  abdomen: {z0: -0.08, z1: -0.36, r: 0.1},
  crank: {c: [0, -0.03], r: 0.022}, // low in the thorax so both rocker loops stay Grashof
  hinge: {x: 0.07, y: 0.1, z: 0.02},
  lever: 0.045,
  wing: {span: 0.44, chord: 0.17}, // Mellis proportions: wings longer than the body is wide
  jaw: {pivot: [0.035, -0.03, 0.235], lever: 0.025, blade: 0.09, offset: Math.PI - 0.5, slide: [0.18, 0.205]},
  legs: [
    {z: 0.06, foot: [0.13, -0.17, 0.12]},
    {z: 0.0, foot: [0.15, -0.18, 0.0]},
    {z: -0.06, foot: [0.13, -0.17, -0.12]},
  ],
  femur: 0.12,
  tibia: 0.14,
};
const TAU = Math.PI * 2;

/** Circle-circle intersection in 2D: the point on circle (a, ra) ∩ (b, rb) on the side sgn picks. */
export function cc(a, ra, b, rb, sgn) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const d = Math.hypot(dx, dy);
  const x = (ra * ra - rb * rb + d * d) / (2 * d);
  const h2 = ra * ra - x * x;
  if (h2 < 0) return null;
  const h = Math.sqrt(h2);
  const ux = dx / d;
  const uy = dy / d;
  return [a[0] + ux * x - sgn * uy * h, a[1] + uy * x + sgn * ux * h];
}

// the rod: the middle of the window where the rocker loop closes for every crank angle (Grashof):
// |rod - lever| <= |pin - hinge| <= rod + lever, with |pin - hinge| = D ± crank
const D0 = Math.hypot(G.hinge.x - G.crank.c[0], G.hinge.y - G.crank.c[1]);
export const ROD = D0; // the window is [D0 + c - lever, D0 - c + lever]; its middle is D0
// the wing's angle on its lever: set so the stroke is centred on level (computed once from the loop itself)
let WING_OFF = Math.PI;
// the toggle-link length that shuts the jaw tips exactly on the centreline at full bite
const J = G.jaw;
const muShut = Math.acos(-J.pivot[0] / J.blade) - J.offset; // blade tip at x = 0
const levShut = [J.pivot[0] + J.lever * Math.cos(muShut), J.pivot[2] + J.lever * Math.sin(muShut)];
export const LINK = Math.hypot(levShut[0], levShut[1] - J.slide[1]);
// the branch of the toggle loop that contains the shut pose (the other one folds the blade backwards)
const JAW_BRANCH = (() => {
  const Pv = [J.pivot[0], J.pivot[2]];
  for (const sg of [-1, 1]) {
    const T = cc(Pv, J.lever, [0, J.slide[1]], LINK, sg);
    if (T && Math.hypot(T[0] - levShut[0], T[1] - levShut[1]) < 1e-9) return sg;
  }
  return 1;
})();

export function pose(theta, bite) {
  const pin = [G.crank.c[0] + G.crank.r * Math.sin(theta), G.crank.c[1] + G.crank.r * Math.cos(theta)];
  const wings = [-1, 1].map((sx) => {
    const H = [sx * G.hinge.x, G.hinge.y];
    // lever tip: on the lever circle and the rod circle; the branch keeps the lever pointing inward
    const L = cc(H, G.lever, pin, ROD, sx);
    const lam = L ? Math.atan2(L[1] - H[1], L[0] - H[0]) : NaN;
    const wingAng = sx > 0 ? lam + WING_OFF : lam - WING_OFF; // the wing is rigid with its lever
    const dir = [Math.cos(wingAng), Math.sin(wingAng)];
    const tip = [H[0] + dir[0] * G.wing.span, H[1] + dir[1] * G.wing.span];
    return {sx, H, L, lam, dir, tip, stroke: Math.atan2(dir[1], sx * dir[0])};
  });
  const zs = J.slide[0] + (J.slide[1] - J.slide[0]) * bite;
  // the gripper is symmetric about the slider: solve the right jaw, mirror it for the left
  const Pv = [J.pivot[0], J.pivot[2]];
  const Sp = [0, zs];
  const T = cc(Pv, J.lever, Sp, LINK, JAW_BRANCH);
  const mu = T ? Math.atan2(T[1] - Pv[1], T[0] - Pv[0]) : NaN;
  const bladeAng = mu + J.offset;
  const tipR = [Pv[0] + J.blade * Math.cos(bladeAng), Pv[1] + J.blade * Math.sin(bladeAng)];
  const jaws = [-1, 1].map((sx) => ({
    sx,
    Pv: [sx * Pv[0], Pv[1]],
    T: T ? [sx * T[0], T[1]] : null,
    S: Sp,
    tip: [sx * tipR[0], tipR[1]],
    mu,
    bladeAng: sx > 0 ? bladeAng : Math.PI - bladeAng,
  }));
  // legs: hip on the thorax side, foot tucked; knee by circle intersection in the leg's plane
  const legs = [];
  for (const L of G.legs) {
    for (const sx of [-1, 1]) {
      const hip = [sx * G.thorax.r * 0.8, -0.05, L.z];
      const foot = [sx * L.foot[0], L.foot[1] + 0.01 * Math.sin(theta * 0.25 + L.z * 30), L.foot[2]];
      const d = Math.hypot(foot[0] - hip[0], foot[1] - hip[1], foot[2] - hip[2]);
      // in the plane of hip, foot and up: knee bends up and out
      const k = cc([0, 0], G.femur, [d, 0], G.tibia, 1);
      const ex = [(foot[0] - hip[0]) / d, (foot[1] - hip[1]) / d, (foot[2] - hip[2]) / d];
      let ey = [-ex[0] * ex[1], 1 - ex[1] * ex[1], -ex[2] * ex[1]];
      const ln = Math.hypot(...ey) || 1;
      ey = ey.map((v) => v / ln);
      const knee = k ? [hip[0] + ex[0] * k[0] + ey[0] * k[1], hip[1] + ex[1] * k[0] + ey[1] * k[1], hip[2] + ex[2] * k[0] + ey[2] * k[1]] : null;
      legs.push({hip, knee, foot});
    }
  }
  return {theta, bite, pin, wings, jaws, legs, zs};
}

const d2 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const d3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

export function checks(theta, bite) {
  const P = pose(theta, bite);
  const out = [];
  for (const W of P.wings) {
    out.push({name: 'wing linkage solvable', ok: !!W.L, value: W.L ? 'ok' : 'none'});
    if (!W.L) continue;
    out.push({name: 'rod length exact', ok: Math.abs(d2(W.L, P.pin) - ROD) < 1e-9, value: d2(W.L, P.pin).toFixed(6)});
    out.push({name: 'lever length exact', ok: Math.abs(d2(W.L, W.H) - G.lever) < 1e-9, value: '-'});
    out.push({name: 'wing tip clears the body', ok: Math.abs(W.tip[0]) > G.thorax.r + 0.05, value: W.tip[0].toFixed(3)});
  }
  for (const Jw of P.jaws) {
    out.push({name: 'jaw linkage solvable', ok: !!Jw.T, value: Jw.T ? 'ok' : 'none'});
    if (!Jw.T) continue;
    out.push({name: 'toggle link exact', ok: Math.abs(d2(Jw.T, Jw.S) - LINK) < 1e-9, value: '-'});
    out.push({name: 'jaws never cross the centreline', ok: Jw.sx * Jw.tip[0] >= -1e-6, value: Jw.tip[0].toFixed(4)});
  }
  if (bite > 0.9999) out.push({name: 'jaw tips meet when shut', ok: d2(P.jaws[0].tip, P.jaws[1].tip) < 1e-3, value: d2(P.jaws[0].tip, P.jaws[1].tip).toFixed(5)});
  if (bite < 1e-4) out.push({name: 'open gape ≥ 6 cm', ok: d2(P.jaws[0].tip, P.jaws[1].tip) >= 0.06, value: d2(P.jaws[0].tip, P.jaws[1].tip).toFixed(3)});
  for (const L of P.legs) {
    out.push({name: 'legs reach their feet', ok: !!L.knee, value: L.knee ? 'ok' : 'none'});
    if (L.knee) out.push({name: 'leg links exact', ok: Math.abs(d3(L.hip, L.knee) - G.femur) < 1e-9 && Math.abs(d3(L.knee, L.foot) - G.tibia) < 1e-9, value: '-'});
  }
  return out;
}

// centre the stroke on level: sample one turn with the raw offset, then shift by the mean
{
  let lo = Infinity;
  let hi = -Infinity;
  for (let k = 0; k < 720; k++) {
    const s = pose((k / 720) * TAU, 0).wings[1].stroke;
    lo = Math.min(lo, s);
    hi = Math.max(hi, s);
  }
  WING_OFF -= (lo + hi) / 2;
}

/** Stroke amplitude over a full crank turn (for the panel and a check). */
export function amplitude() {
  let lo = Infinity;
  let hi = -Infinity;
  for (let k = 0; k < 360; k++) {
    const s = pose((k / 360) * TAU, 0).wings[1].stroke;
    lo = Math.min(lo, s);
    hi = Math.max(hi, s);
  }
  return {lo, hi};
}
