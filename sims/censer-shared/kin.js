// THURIBLE CN-2, the censer, model only. Reference: the Whitworth quick-return mechanism (shaping machines): a crank
// pin slides in a slotted lever pivoted below the crank, so the lever swings slowly one way and fast the other. The
// lever is the throwing arm; the shot (burning blood) leaves its cup at the fastest point of the fast stroke and flies
// ballistic to a pool. The censer bowl hangs on chains as a pendulum: its swing grows before each throw (the tell).
// Input: crank angle θ, time t. Frame: x right, y up, z forward (the throw goes +z); metres.

export const W = {
  crankC: [0, 2.6, 0], // crank centre (in the y-z plane)
  crankR: 0.42,
  pivot: [0, 1.7, 0], // the slotted lever's pivot, below the crank
  arm: 2.6, // pivot to the cup
  slot: [0.45, 1.35], // the slot runs this far along the lever from the pivot
  g: 9.81,
  bowl: {hang: [0, 3.3, -0.6], chain: 1.1},
};
const TAU = Math.PI * 2;

/** Lever angle (from straight up, toward +z positive) for crank angle θ; the pin's slide distance along it. */
export function lever(theta) {
  const pin = [W.crankC[1] + W.crankR * Math.cos(-theta), W.crankC[2] + W.crankR * Math.sin(-theta)]; // (y, z): the crank turns so the throw (+z) is the quick stroke
  const dy = pin[0] - W.pivot[1];
  const dz = pin[1] - W.pivot[2];
  return {ang: Math.atan2(dz, dy), slide: Math.hypot(dy, dz), pin};
}
/** The cup at the end of the arm. */
export function cup(theta) {
  const L = lever(theta);
  return [0, W.pivot[1] + W.arm * Math.cos(L.ang), W.pivot[2] + W.arm * Math.sin(L.ang)];
}
// the release: on the quick (forward) stroke, while the arm still leans back at REL_ANG, so the cup's velocity points up
// and forward and the shot climbs (a catapult lets go before the arm is upright)
export const REL_ANG = -0.25;
const RELEASE = (() => {
  const n = 72000;
  for (let k = 0; k < n; k++) {
    const th = (k / n) * TAU;
    const a0 = lever(th).ang;
    const a1 = lever(th + TAU / n).ang;
    if (a0 <= REL_ANG && a1 > REL_ANG && a1 > a0) return {th, w: (a1 - a0) / (TAU / n)};
  }
  return {th: 0, w: 0};
})();
export const RELEASE_THETA = RELEASE.th;
export const GAIN = RELEASE.w; // lever rate per unit crank rate at the release
/** The shot's launch state for crank speed ω (rad/s): from the cup at the release angle. */
export function launch(omega) {
  const p = cup(RELEASE_THETA);
  const L = lever(RELEASE_THETA);
  const wArm = GAIN * omega;
  // the cup moves on a circle round the pivot: velocity is ω·r along the tangent (+ang direction)
  const v = [0, -W.arm * wArm * Math.sin(L.ang), W.arm * wArm * Math.cos(L.ang)];
  return {p, v};
}
export function shot(omega, tau) {
  const {p, v} = launch(omega);
  return [p[0] + v[0] * tau, p[1] + v[1] * tau - 0.5 * W.g * tau * tau, p[2] + v[2] * tau];
}
export function landing(omega) {
  const {p, v} = launch(omega);
  const T = (v[1] + Math.sqrt(v[1] * v[1] + 2 * W.g * p[1])) / W.g;
  return {T, at: shot(omega, T)};
}
/** The bowl's pendulum: amplitude grows over the windup before each throw. */
export function bowl(theta, t) {
  const wind = ((((theta - RELEASE_THETA) % TAU) + TAU) % TAU) / TAU; // 0 just after a throw → 1 at the next
  const amp = 0.15 + 0.45 * wind * wind;
  const a = amp * Math.sin(t * Math.sqrt(W.g / W.bowl.chain));
  const h = W.bowl.hang;
  return {a, p: [h[0], h[1] - W.bowl.chain * Math.cos(a), h[2] + W.bowl.chain * Math.sin(a)]};
}

export function checks(theta, omega) {
  const out = [];
  const L = lever(theta);
  out.push({name: 'the crank pin stays inside the slot', ok: L.slide >= W.slot[0] && L.slide <= W.slot[1], value: L.slide.toFixed(3)});
  // quick return: the fast stroke takes less of the turn than the slow one
  const n = 3600;
  let fwd = 0;
  for (let k = 0; k < n; k++) if (lever(((k + 0.5) / n) * TAU + 1e-6).ang > lever(((k + 0.5) / n) * TAU - 1e-6).ang) fwd++;
  out.push({name: 'quick return: the throw is the shorter stroke', ok: fwd / n < 0.45, value: (fwd / n).toFixed(3)});
  const Ld = landing(omega);
  out.push({name: 'the shot lands ahead, in range (6–18 m)', ok: Ld.at[2] > 6 && Ld.at[2] < 18, value: Ld.at[2].toFixed(2)});
  out.push({name: 'the shot is a lob you can read (flight ≥ 0.8 s)', ok: Ld.T >= 0.8, value: Ld.T.toFixed(2)});
  const B = bowl(theta, 0.3);
  const hang = Math.hypot(B.p[1] - W.bowl.hang[1], B.p[2] - W.bowl.hang[2]);
  out.push({name: 'chain length exact', ok: Math.abs(hang - W.bowl.chain) < 1e-9, value: hang.toFixed(4)});
  return out;
}
