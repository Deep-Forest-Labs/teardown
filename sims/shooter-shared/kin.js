// GUNNER GT-6, the shooter, model only. Reference mechanisms: the Gatling gun (one crank turns a cluster of six
// barrels; a fixed cam track drives each barrel's bolt forward and back, so a barrel fires each time it passes the
// top), and plain ballistics for the aim (the elevation that puts a slow, dodgeable shot on the target).
// It stands on a planted tripod and turns a pan-tilt turret. Inputs: crank angle ψ (cluster), target point, time.
// Frame: x right, y up, z forward; metres.
import {dist3, twoBone} from '../slumber-kit/parts.js';

export const G = {
  hub: [0, 2.3, 0], // turret pan axis top
  legs: 3,
  hipR: 0.55,
  footR: 2.0,
  thigh: 1.3,
  shank: 1.6,
  barrels: 6,
  clusterR: 0.13,
  barrelL: 1.2,
  bolt: 0.18, // bolt stroke along the barrel
  muzzleV: 15, // m/s: slow, a shot you can see and step out of
  g: 9.81,
  pivot: [0, 0.32, 0.18], // tilt axis offset from the pan axis
};
const TAU = Math.PI * 2;

/** Elevation that lands a shot fired at speed v from p on target q (the low arc). Null when out of range. */
export function aimElevation(p, q, v = G.muzzleV, high = false) {
  const dx = Math.hypot(q[0] - p[0], q[2] - p[2]);
  const dy = q[1] - p[1];
  const g = G.g;
  const disc = v ** 4 - g * (g * dx * dx + 2 * dy * v * v);
  if (disc < 0) return null;
  return Math.atan((v * v + (high ? 1 : -1) * Math.sqrt(disc)) / (g * dx));
}

/** Bolt position (0 back .. 1 closed and firing) for barrel i at cluster angle ψ: a cam track round the cluster. */
export const bolt = (i, psi) => 0.5 - 0.5 * Math.cos(psi + (i / G.barrels) * TAU); // 1 at the top (angle 0)

export function pose(psi, target, t) {
  // tripod feet planted at 120°; hips under the hub
  const legs = Array.from({length: G.legs}, (_, k) => {
    const a = (k / G.legs) * TAU + Math.PI / 2;
    const hip = [Math.cos(a) * G.hipR, G.hub[1] - 0.25, Math.sin(a) * G.hipR];
    const foot = [Math.cos(a) * G.footR, 0, Math.sin(a) * G.footR];
    const knee = twoBone(hip, foot, G.thigh, G.shank, [Math.cos(a), 1.2, Math.sin(a)]);
    return {a, hip, knee, foot};
  });
  const pan = Math.atan2(target[0] - G.hub[0], target[2] - G.hub[2]);
  const pivot = [G.hub[0] + Math.sin(pan) * G.pivot[2], G.hub[1] + G.pivot[1], G.hub[2] + Math.cos(pan) * G.pivot[2]];
  // the shot leaves the muzzle of the top barrel: aim so the arc from there lands on the target
  // (the muzzle depends on the elevation, so iterate a few times: it converges in 3)
  // the low arc, unless it would land too fast to dodge (close range): then the lob, the other root
  const solve = (high) => {
    let e0 = high ? 1.0 : 0.2;
    let mz = pivot;
    for (let it = 0; it < 8; it++) {
      const d = [Math.sin(pan) * Math.cos(e0), Math.sin(e0), Math.cos(pan) * Math.cos(e0)];
      const u = [-Math.sin(pan) * Math.sin(e0), Math.cos(e0), -Math.cos(pan) * Math.sin(e0)];
      mz = [0, 1, 2].map((c) => pivot[c] + d[c] * G.barrelL + u[c] * G.clusterR);
      const e = aimElevation(mz, target, G.muzzleV, high);
      if (e === null) break;
      e0 = e;
    }
    return e0;
  };
  let el = solve(false);
  {
    const d = [Math.sin(pan) * Math.cos(el), Math.sin(el), Math.cos(pan) * Math.cos(el)];
    const u = [-Math.sin(pan) * Math.sin(el), Math.cos(el), -Math.cos(pan) * Math.sin(el)];
    const mz = [0, 1, 2].map((c) => pivot[c] + d[c] * G.barrelL + u[c] * G.clusterR);
    if (flightTime({dir: d, muzzle: mz, target}) < 0.6) el = solve(true);
  }
  let muzzle = pivot;
  for (let it = 0; it < 0; it++) {
    const dir = [Math.sin(pan) * Math.cos(el), Math.sin(el), Math.cos(pan) * Math.cos(el)];
    const up = [-Math.sin(pan) * Math.sin(el), Math.cos(el), -Math.cos(pan) * Math.sin(el)];
    muzzle = [0, 1, 2].map((c) => pivot[c] + dir[c] * G.barrelL + up[c] * G.clusterR);
    const e = aimElevation(muzzle, target);
    if (e === null) break;
    el = e;
  }
  const dir = [Math.sin(pan) * Math.cos(el), Math.sin(el), Math.cos(pan) * Math.cos(el)];
  const up = [-Math.sin(pan) * Math.sin(el), Math.cos(el), -Math.cos(pan) * Math.sin(el)];
  muzzle = [0, 1, 2].map((c) => pivot[c] + dir[c] * G.barrelL + up[c] * G.clusterR);
  const bolts = Array.from({length: G.barrels}, (_, i) => bolt(i, psi));
  return {psi, legs, pan, el, pivot, dir, up, muzzle, bolts, target};
}

/** A shot fired at time t0 from pose P: where it is at t (null once it has landed). */
export function shotAt(P, t0, t) {
  const tau = t - t0;
  if (tau < 0) return null;
  const v = P.dir.map((d) => d * G.muzzleV);
  const p = [P.muzzle[0] + v[0] * tau, P.muzzle[1] + v[1] * tau - 0.5 * G.g * tau * tau, P.muzzle[2] + v[2] * tau];
  return p[1] < P.target[1] - 0.01 ? null : p;
}
/** Flight time of a shot to the target height. */
export function flightTime(P) {
  const vy = P.dir[1] * G.muzzleV;
  const dy = P.muzzle[1] - P.target[1];
  return (vy + Math.sqrt(vy * vy + 2 * G.g * dy)) / G.g;
}

export function checks(psi, target) {
  const P = pose(psi, target, 0);
  const out = [];
  for (const L of P.legs) {
    out.push({name: 'legs reach their feet', ok: !!L.knee, value: L.knee ? 'ok' : 'none'});
    if (L.knee) out.push({name: 'leg links exact', ok: Math.abs(dist3(L.hip, L.knee) - G.thigh) < 1e-9 && Math.abs(dist3(L.knee, L.foot) - G.shank) < 1e-9, value: '-'});
  }
  // the shot lands on the target
  const T = flightTime(P);
  const v = P.dir.map((d) => d * G.muzzleV);
  const land = [P.muzzle[0] + v[0] * T, P.muzzle[1] + v[1] * T - 0.5 * G.g * T * T, P.muzzle[2] + v[2] * T];
  out.push({name: 'every shot lands on its target (< 5 cm)', ok: dist3(land, target) < 0.05, value: dist3(land, target).toFixed(4)});
  out.push({name: 'shots are dodgeable (flight ≥ 0.6 s)', ok: T >= 0.6, value: T.toFixed(2)});
  // exactly one bolt fully closed at the firing positions (the top), none past its travel
  const top = P.bolts.filter((b) => b > 0.999).length;
  const atFire = Math.abs(((psi % (TAU / G.barrels)) + TAU / G.barrels) % (TAU / G.barrels)) < 1e-9;
  if (atFire) out.push({name: 'one bolt closed at each firing position', ok: top === 1, value: top});
  out.push({name: 'bolts stay inside their cam travel', ok: P.bolts.every((b) => b >= -1e-12 && b <= 1 + 1e-12), value: '-'});
  return out;
}
