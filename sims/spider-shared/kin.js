// RIMWALKER DS-6, the disc spider, model only. Reference: Joe Klann's walking linkage (US patent 6,260,862, the
// mechanical spider). Point coordinates from the patent's Table 1 (as reproduced on Wikibooks): fixed pivots 9, 11
// and the crank shaft 15; the crank 15-29; second rocker 11-27; first rocker 9-37; the connecting rod is the rigid
// triangle 29-27-35; the leg is the rigid triangle 37-35-33 (33 the foot). Every length below is measured from those
// coordinates and agrees between the table's two poses. Solved by circle intersection, branch matched to the patent.
// The mouth is a two-roller crusher that draws orbs in. Input: crank angle θ. Frame: x forward, y up, z across.

const T1 = {9: [1.366, 1.366], 11: [1.009, 0.574], 15: [1.599, 0.75], 27: [0.741, 0.75], 29: [1.331, 0.75], 33: [0, 0], 35: [0.232, 0.866], 37: [0.866, 1.5]};
const d2 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
export const LEN = {
  crank: d2(T1[15], T1[29]),
  rocker2: d2(T1[11], T1[27]),
  rocker1: d2(T1[9], T1[37]),
  rod: [d2(T1[29], T1[27]), d2(T1[27], T1[35]), d2(T1[29], T1[35])],
  leg: [d2(T1[37], T1[35]), d2(T1[35], T1[33]), d2(T1[37], T1[33])],
};
export const S = 1.25; // metres per patent unit: a leg about 2.3 m tall
const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
function ccBoth(a, ra, b, rb) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const d = Math.hypot(dx, dy);
  const x = (ra * ra - rb * rb + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, ra * ra - x * x));
  const m = [a[0] + (dx * x) / d, a[1] + (dy * x) / d];
  return [[m[0] - (dy * h) / d, m[1] + (dx * h) / d], [m[0] + (dy * h) / d, m[1] - (dx * h) / d], ra * ra - x * x];
}
// the third corner of a rigid triangle from two known corners, on the side the patent pose has it
function third(a, b, la, lb, sideRef) {
  const [p, q] = ccBoth(a, la, b, lb);
  return Math.sign(cross(a, b, p)) === sideRef ? p : q;
}
const SIDE = {
  elbow: Math.sign(cross(T1[11], T1[29], T1[27])),
  knee: Math.sign(cross(T1[29], T1[27], T1[35])),
  hip: Math.sign(cross(T1[9], T1[35], T1[37])),
  foot: Math.sign(cross(T1[37], T1[35], T1[33])),
};
const CRANK0 = Math.atan2(T1[29][1] - T1[15][1], T1[29][0] - T1[15][0]);

/** One leg in its own plane (patent units, x forward toward the foot side reversed below), crank angle θ. */
export function solveKlann(theta) {
  const a = CRANK0 + theta;
  const P = [T1[15][0] + LEN.crank * Math.cos(a), T1[15][1] + LEN.crank * Math.sin(a)];
  const E = third(T1[11], P, LEN.rocker2, LEN.rod[0], SIDE.elbow);
  const Kn = third(P, E, LEN.rod[2], LEN.rod[1], SIDE.knee);
  const H = third(T1[9], Kn, LEN.rocker1, LEN.leg[0], SIDE.hip);
  const F = third(H, Kn, LEN.leg[2], LEN.leg[1], SIDE.foot);
  return {9: T1[9], 11: T1[11], 15: T1[15], 29: P, 27: E, 35: Kn, 37: H, 33: F};
}
export const KLINKS = [[15, 29], [11, 27], [9, 37], [29, 27], [27, 35], [29, 35], [37, 35], [35, 33], [37, 33]];

// contact: the body rests on whichever foot of the three-phase set is lowest, rides up and down with it (a real Klann
// walker bobs), and moves so that foot does not slide. Tabulated once over one third of a turn (the phase set
// repeats every 2π/3) and integrated in closed form: render stays a pure function of θ.
const PH3 = [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3];
const TN = 2400;
const SEG = (2 * Math.PI) / 3;
const TAB = (() => {
  const ys = new Float64Array(TN + 1);
  const xs = new Float64Array(TN + 1);
  let x = 0;
  let prev = null;
  for (let n = 0; n <= TN; n++) {
    const th = (n / TN) * SEG;
    const feet = PH3.map((p) => solveKlann(th + p)[33]);
    let lo = 0;
    for (let k = 1; k < 3; k++) if (feet[k][1] < feet[lo][1]) lo = k;
    if (prev) {
      // the contact foot's own movement over this step, measured on the same foot both ends
      const before = solveKlann(((n - 1) / TN) * SEG + PH3[lo])[33];
      x += feet[lo][0] - before[0]; // the leg is mirrored to lead forward, so the body follows the foot's own sense
    }
    ys[n] = feet[lo][1];
    xs[n] = x;
    prev = feet;
  }
  return {ys, xs, adv: x};
})();
function contact(theta) {
  const k = Math.floor(theta / SEG);
  const u = ((theta - k * SEG) / SEG) * TN;
  const n = Math.min(TN - 1, Math.floor(u));
  const f = u - n;
  return {x: (k * TAB.adv + TAB.xs[n] + (TAB.xs[n + 1] - TAB.xs[n]) * f) * S, lowY: TAB.ys[n] + (TAB.ys[n + 1] - TAB.ys[n]) * f};
}
export const BODY_PER_RAD = (TAB.adv / SEG) * S; // mean, for the panel
const ROWS = [-1.05, 0, 1.05]; // crank stations along the body (x)
const PHASE = [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3];
export function pose(theta) {
  const C = contact(theta);
  const x = C.x;
  const hipY = -C.lowY * S; // the frame rides on the contact foot
  const legs = [];
  ROWS.forEach((rx, r) => {
    for (const sz of [-1, 1]) {
      const ph = PHASE[(r + (sz > 0 ? 1 : 0)) % 3];
      const J = solveKlann(theta + ph);
      const pts = {};
      // the patent leg reaches toward -x: mirror it so the feet lead forward (+x), centre the crank on the station
      for (const k in J) pts[k] = [x + rx - (J[k][0] - T1[15][0]) * S, hipY + J[k][1] * S, sz * (1.35 + (r === 1 ? 0.2 : 0))] // leg planes out at the disc's rim;
      legs.push({r, sz, pts, foot: pts[33]});
    }
  });
  return {theta, x, hipY, legs};
}

const d3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
export function checks(theta) {
  const P = pose(theta);
  const out = [];
  let e = 0;
  const L = {'15-29': LEN.crank, '11-27': LEN.rocker2, '9-37': LEN.rocker1, '29-27': LEN.rod[0], '27-35': LEN.rod[1], '29-35': LEN.rod[2], '37-35': LEN.leg[0], '35-33': LEN.leg[1], '37-33': LEN.leg[2]};
  for (const Lg of P.legs) for (const [a, b] of KLINKS) e = Math.max(e, Math.abs(d3(Lg.pts[a], Lg.pts[b]) - L[`${a}-${b}`] * S));
  out.push({name: 'Klann links exact (6 legs)', ok: e < 1e-9, value: e.toExponential(1)});
  const low = Math.min(...P.legs.map((l) => l.foot[1]));
  out.push({name: 'no foot below the ground', ok: low >= -1e-6, value: low.toFixed(5)});
  const near = P.legs.filter((l) => l.foot[1] < 0.02).length;
  out.push({name: 'at least two feet on the ground', ok: near >= 2, value: near});
  // the contact feet (on the ground now and a moment later) do not slide
  const Q = pose(theta + 0.0005);
  P.legs.forEach((l, i) => {
    if (l.foot[1] > 1e-6 || Q.legs[i].foot[1] > 1e-6) return;
    out.push({name: 'contact feet never slide', ok: Math.abs(Q.legs[i].foot[0] - l.foot[0]) < 1e-5, value: Math.abs(Q.legs[i].foot[0] - l.foot[0]).toExponential(1)});
  });
  return out;
}
