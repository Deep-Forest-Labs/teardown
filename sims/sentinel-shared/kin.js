// IDOL ST-5, the statue sentinel, model only. Reference: heavy humanoid walkers (Boston Dynamics Atlas proportions):
// two-segment legs on hip, knee and ankle, flat feet, a slow double-support walk (each foot lifts only once the other
// is planted), the pelvis swaying over the stance foot. Its power pack (a flywheel on a crank) rides exposed on its
// back: the only place it takes damage. (Chebyshev's lambda walker was tried first: in every assembly its straight
// stretch is the side of the foot path nearer the frame, so hung from a body the return arc swings into the ground.)
// Input: walk distance w and time t. Frame: x across, y up, z forward; metres.
import {dist3, twoBone} from '../slumber-kit/parts.js';

export const B = {
  hipX: 0.42,
  thigh: 1.15,
  shank: 1.15,
  ankleH: 0.28,
  pelvisY: 2.05,
  stride: 0.9,
  lift: 0.22,
  foot: [0.42, 0.12, 0.85], // w, h, l
};
const DUTY = 0.62; // each foot planted 62% of its cycle: 12% of the cycle has both down
const sm = (x) => {
  const u = Math.min(1, Math.max(0, x));
  return u * u * (3 - 2 * u);
};

/** Foot of side sx after walking w: planted spots never move; a swing arcs to the next. */
export function footAt(sx, w) {
  const ph = sx < 0 ? 0 : 0.5;
  const cyc = w / (2 * B.stride) + ph;
  const n = Math.floor(cyc);
  const u = cyc - n;
  const land = (n - ph) * 2 * B.stride + B.stride * DUTY;
  if (u < DUTY) return {p: [sx * B.hipX, 0, land], stance: true, u};
  const s = (u - DUTY) / (1 - DUTY);
  return {p: [sx * B.hipX, B.lift * Math.sin(Math.PI * s), land + 2 * B.stride * sm(s)], stance: false, u};
}

export function pose(w, t) {
  const L = footAt(-1, w);
  const R = footAt(1, w);
  // the pelvis rides over the feet's mean, swaying toward whichever foot carries the weight
  const zMid = (L.p[2] + R.p[2]) / 2;
  const sway = 0.1 * Math.sin((w / (2 * B.stride)) * Math.PI * 2);
  const pelvis = [sway, B.pelvisY + 0.03 * Math.cos((w / B.stride) * Math.PI * 2), zMid + 0.15];
  const legs = [L, R].map((F, i) => {
    const sx = i ? 1 : -1;
    const hip = [pelvis[0] + sx * B.hipX, pelvis[1], pelvis[2]];
    const ankle = [F.p[0], F.p[1] + B.ankleH, F.p[2] - 0.12];
    const knee = twoBone(hip, ankle, B.thigh, B.shank, [0, 0.1, 1]); // knees forward
    return {sx, hip, knee, ankle, foot: F.p, stance: F.stance};
  });
  // the back pack: a flywheel turning with the walk, its crank driving a piston
  const fly = (w / B.stride) * 3 + t * 0.4;
  return {w, pelvis, legs, fly};
}

export function checks(w) {
  const P = pose(w, 0);
  const out = [];
  for (const L of P.legs) {
    out.push({name: 'legs reach their feet', ok: !!L.knee, value: L.knee ? 'ok' : dist3(L.hip, L.ankle).toFixed(3)});
    if (!L.knee) continue;
    out.push({name: 'leg links exact', ok: Math.abs(dist3(L.hip, L.knee) - B.thigh) < 1e-9 && Math.abs(dist3(L.knee, L.ankle) - B.shank) < 1e-9, value: '-'});
    out.push({name: 'knees bend forward', ok: L.knee[2] > (L.hip[2] + L.ankle[2]) / 2 - 1e-9, value: (L.knee[2] - (L.hip[2] + L.ankle[2]) / 2).toFixed(3)});
    out.push({name: 'feet never below the ground', ok: L.foot[1] >= -1e-12, value: L.foot[1].toFixed(3)});
  }
  out.push({name: 'always at least one foot planted', ok: P.legs.some((L) => L.stance), value: P.legs.filter((L) => L.stance).length});
  const Q = pose(w + 0.004, 0);
  P.legs.forEach((L, i) => {
    if (L.stance && Q.legs[i].stance) out.push({name: 'planted feet never slide', ok: dist3(L.foot, Q.legs[i].foot) < 1e-12, value: dist3(L.foot, Q.legs[i].foot).toExponential(1)});
  });
  return out;
}
