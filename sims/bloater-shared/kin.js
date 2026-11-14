// BLISTER BL-3, the bloater, model only. Reference: the peristaltic roller pump (medical and food pumps): rollers on
// a rotor squeeze a tube against a horseshoe track; each rotor turn moves an exact volume (the tube's bore times the
// track length between roller pinches), and at least one roller always seals the tube so nothing flows back. The pump
// feeds a spit nozzle (bile arcs) and, through a check valve, a bladder that swells until it bursts.
// Inputs: rotor angle θ (cumulative), time. Frame: x right, y up, z forward; metres.

export const P = {
  rotorR: 0.32, // roller centres
  rollers: 3,
  trackArc: (250 * Math.PI) / 180, // the horseshoe the tube lies in
  bore: 0.03, // tube inner radius
  nozzle: 0.022, // nozzle exit radius
  keep: 0.35, // the share of each stroke diverted into the bladder
  bladder: {v0: 0.06, vmax: 0.12}, // m³: bursts about 30 rotor turns in
  noz: [0, 1.9, 0.75], // nozzle position
  noseUp: 0.55, // nozzle elevation (rad)
  g: 9.81,
};
const TAU = Math.PI * 2;
const area = (r) => Math.PI * r * r;
/** Volume pumped per rotor radian: bore area × the track length one roller sweeps per radian. */
export const VOL_PER_RAD = area(P.bore) * P.rotorR;
/** Rollers pinching the tube at rotor angle θ (those inside the track's arc). */
export function pinching(theta) {
  const out = [];
  for (let k = 0; k < P.rollers; k++) {
    const a = ((((theta + (k / P.rollers) * TAU) % TAU) + TAU) % TAU);
    if (a <= P.trackArc) out.push(k);
  }
  return out;
}
/** Exit speed at the nozzle for rotor speed ω (rad/s): continuity, (1 − keep) of the flow leaves there. */
export const exitSpeed = (omega) => ((1 - P.keep) * VOL_PER_RAD * omega) / area(P.nozzle);
/** A spit leaving at speed v: where it is after tau, its range on the ground. */
export function spit(v, tau, yaw = 0) {
  const vh = v * Math.cos(P.noseUp);
  const vy = v * Math.sin(P.noseUp);
  return [P.noz[0] + Math.sin(yaw) * vh * tau, P.noz[1] + vy * tau - 0.5 * P.g * tau * tau, P.noz[2] + Math.cos(yaw) * vh * tau];
}
export const flight = (v) => (v * Math.sin(P.noseUp) + Math.sqrt((v * Math.sin(P.noseUp)) ** 2 + 2 * P.g * P.noz[1])) / P.g;
/** Bladder volume after the rotor has turned θ in total. */
export const bladderAt = (theta) => P.bladder.v0 + P.keep * VOL_PER_RAD * theta;
/** The rotor angle at which the bladder reaches its limit (the burst). */
export const BURST_THETA = (P.bladder.vmax - P.bladder.v0) / (P.keep * VOL_PER_RAD);

export function checks(theta, omega) {
  const out = [];
  out.push({name: 'at least one roller always seals the tube (no backflow)', ok: pinching(theta).length >= 1, value: pinching(theta).length});
  const v = exitSpeed(omega);
  const T = flight(v);
  const R = Math.cos(P.noseUp) * v * T;
  out.push({name: 'a spit carries 5–14 m', ok: R >= 5 && R <= 14, value: R.toFixed(2)});
  out.push({name: 'a spit is readable (flight ≥ 0.7 s)', ok: T >= 0.7, value: T.toFixed(2)});
  const V = bladderAt(theta);
  out.push({name: 'bladder never exceeds its limit before the burst', ok: theta > BURST_THETA || V <= P.bladder.vmax + 1e-12, value: V.toFixed(3)});
  return out;
}
export {TAU};
