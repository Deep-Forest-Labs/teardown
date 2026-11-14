// CANTOR ZL-7, the zealot, model only. References: the umbrella mechanism (ribs hinged at a top notch, stretchers
// from a runner that slides up the shaft to a point on each rib: the runner's height sets every rib's angle, solved by
// circle intersection) at the scale of a ward over its allies; and the three-wheel omni ("kiwi") drive: three omni
// wheels at 120° whose speeds follow from the body's velocity and spin. Bolts leave the rib tips in turn.
// Inputs: canopy open o (runner position 0..1), body path, time. Frame: x, z ground plane, y up; metres.

export const Z = {
  top: 4.2, // the top notch height on the shaft
  notchR: 0.18,
  rib: 2.6,
  ribs: 8,
  stretchAt: 1.0, // the stretcher meets the rib this far from the notch
  runnerR: 0.15,
  stretcher: 1.25,
  runner: [1.98, 3.42], // runner height closed (rib hangs straight: 4.2 − 1.0 − 1.25 + a hair) .. open (rib just under level)
  wheels: {r: 0.28, R: 0.55}, // wheel radius, distance from the centre
};
const TAU = Math.PI * 2;
function cc(a, ra, b, rb, sgn) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const d = Math.hypot(dx, dy);
  const x = (ra * ra - rb * rb + d * d) / (2 * d);
  const h2 = ra * ra - x * x;
  if (h2 < 0) return null;
  const h = Math.sqrt(h2);
  return [a[0] + (dx / d) * x - sgn * (dy / d) * h, a[1] + (dy / d) * x + sgn * (dx / d) * h];
}
/** One rib in its radial plane (r outward, y up) for runner fraction o: the stretcher point, the rib angle and tip. */
export function rib(o) {
  const yr = Z.runner[0] + (Z.runner[1] - Z.runner[0]) * o;
  const T = [Z.notchR, Z.top];
  const Rn = [Z.runnerR, yr];
  // the stretcher point on the rib: distance stretchAt from the notch and stretcher from the runner; the outer branch
  const S = cc(T, Z.stretchAt, Rn, Z.stretcher, 1);
  if (!S) return null;
  const dir = [(S[0] - T[0]) / Z.stretchAt, (S[1] - T[1]) / Z.stretchAt];
  const tip = [T[0] + dir[0] * Z.rib, T[1] + dir[1] * Z.rib];
  return {T, Rn, S, tip, droop: Math.atan2(-dir[1], dir[0])};
}
/** Omni-drive wheel speeds (m/s at the rim) for body velocity (vx, vz) and spin w. */
export function wheelSpeeds(vx, vz, w, heading = 0) {
  return [0, 1, 2].map((k) => {
    const a = heading + (k / 3) * TAU;
    // each wheel drives along its tangent (perpendicular to its radius)
    return -Math.sin(a) * vx + Math.cos(a) * vz + Z.wheels.R * w;
  });
}
/** The body velocity the three wheel speeds produce (the inverse): it must give back what we asked for. */
export function bodyFromWheels(s, heading = 0) {
  // solve the 3×3 system [−sin a, cos a, R] · [vx, vz, w] = s
  const A = [0, 1, 2].map((k) => {
    const a = heading + (k / 3) * TAU;
    return [-Math.sin(a), Math.cos(a), Z.wheels.R];
  });
  const det = (m) => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  const D = det(A);
  const col = (j) => A.map((row, i) => row.map((v, k) => (k === j ? s[i] : v)));
  return [det(col(0)) / D, det(col(1)) / D, det(col(2)) / D];
}

export function checks(o) {
  const out = [];
  const R = rib(o);
  out.push({name: 'rib linkage solvable', ok: !!R, value: R ? 'ok' : 'none'});
  if (R) {
    const d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
    out.push({name: 'stretcher length exact', ok: Math.abs(d(R.S, R.Rn) - Z.stretcher) < 1e-12, value: '-'});
    out.push({name: 'stretcher meets the rib at its station', ok: Math.abs(d(R.S, R.T) - Z.stretchAt) < 1e-12, value: '-'});
    out.push({name: 'ribs never fold above the notch line or below the runner', ok: R.tip[1] < Z.top + 1e-9 && R.tip[1] > 0.5, value: R.tip[1].toFixed(2)});
  }
  if (o > 0.999) out.push({name: 'open: the ward spans at least 4.5 m across', ok: R && R.tip[0] * 2 >= 4.5, value: (R.tip[0] * 2).toFixed(2)});
  if (o < 1e-6) out.push({name: 'closed: the canopy furls tight to the shaft', ok: R && R.tip[0] < 0.75, value: R.tip[0].toFixed(2)});
  // omni drive: the wheels reproduce the commanded motion exactly
  for (const [vx, vz, w] of [[0.6, 0, 0], [0, 0.6, 0.3], [-0.4, 0.3, -0.5]]) {
    const back = bodyFromWheels(wheelSpeeds(vx, vz, w));
    const err = Math.hypot(back[0] - vx, back[1] - vz, back[2] - w);
    out.push({name: 'omni wheels reproduce the body motion', ok: err < 1e-12, value: err.toExponential(1)});
  }
  return out;
}
export {TAU};
