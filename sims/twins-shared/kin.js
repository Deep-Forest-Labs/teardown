// GEMEL TW-2, the twins, model only. Reference: the open differential (every car axle): one motor drives the carrier;
// the spider gears split it between the two half-shafts so that ω_left + ω_right = 2·ω_carrier, any split. The twins
// are two wheeled bodies on the ends of one axle with the differential in a pod between them, steering like a
// differential-drive robot. Kill one and its wheel locks: the identity sends twice the speed to the survivor, which
// whirls round its dead sibling (the enrage). Inputs: carrier ω and the steering split, or a dead side; time.
// Frame: x, z ground plane, y up; metres.

export const T = {track: 3.2, wheelR: 0.55, pod: 0.5};
/** Wheel speeds (rad/s) from the carrier speed and the steering split s (−1..1): ω_L = ω_c(1 − s), ω_R = ω_c(1 + s). */
export const split = (wc, s) => [wc * (1 - s), wc * (1 + s)];
/** With one side locked (dead), the other turns at twice the carrier. */
export const locked = (wc, dead) => (dead === 'L' ? [0, 2 * wc] : [2 * wc, 0]);
/** Pose of the pair after integrating wheel speeds: precomputed per script in the film (closed-form per segment). */
export function step(state, wl, wr, dt) {
  const vl = wl * T.wheelR;
  const vr = wr * T.wheelR;
  const v = (vl + vr) / 2;
  const w = (vr - vl) / T.track; // turn rate (positive left)
  const h = state.h + w * dt;
  return {x: state.x + Math.sin(state.h + (w * dt) / 2) * v * dt, z: state.z + Math.cos(state.h + (w * dt) / 2) * v * dt, h};
}
export const wheelsAt = (s) => {
  // h increasing turns the pair toward +x, so the slower (left) wheel sits on the +x side of the heading
  const lx = Math.cos(s.h) * (T.track / 2);
  const lz = -Math.sin(s.h) * (T.track / 2);
  return {L: [s.x + lx, s.z + lz], R: [s.x - lx, s.z - lz]};
};

export function checks(wc, s) {
  const out = [];
  const [wl, wr] = split(wc, s);
  out.push({name: 'differential identity: ω_L + ω_R = 2·ω_carrier', ok: Math.abs(wl + wr - 2 * wc) < 1e-12, value: (wl + wr - 2 * wc).toExponential(1)});
  const [l2, r2] = locked(wc, 'L');
  out.push({name: 'one side locked sends twice the speed to the other', ok: l2 === 0 && Math.abs(r2 - 2 * wc) < 1e-12 && Math.abs(l2 + r2 - 2 * wc) < 1e-12, value: r2.toFixed(3)});
  // no slip: each wheel's rim speed equals the ground speed of its contact point (a short integration step)
  const S0 = {x: 0, z: 0, h: 0.3};
  const dt = 1e-4;
  const S1 = step(S0, wl, wr, dt);
  const A = wheelsAt(S0);
  const B = wheelsAt(S1);
  const gl = Math.hypot(B.L[0] - A.L[0], B.L[1] - A.L[1]) / dt;
  const gr = Math.hypot(B.R[0] - A.R[0], B.R[1] - A.R[1]) / dt;
  out.push({name: 'left wheel rolls without slip', ok: Math.abs(gl - Math.abs(wl) * T.wheelR) < 1e-3, value: (gl - Math.abs(wl) * T.wheelR).toExponential(1)});
  out.push({name: 'right wheel rolls without slip', ok: Math.abs(gr - Math.abs(wr) * T.wheelR) < 1e-3, value: (gr - Math.abs(wr) * T.wheelR).toExponential(1)});
  // the track stays rigid
  out.push({name: 'track width rigid', ok: Math.abs(Math.hypot(B.L[0] - B.R[0], B.L[1] - B.R[1]) - T.track) < 1e-9, value: '-'});
  return out;
}
