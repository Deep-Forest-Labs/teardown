// WRATH as one machine: a canal lock, after the Panama Canal locks (1914), model only (no three.js).
// Reference: a lock chamber 33.5 m wide fills by gravity through culverts from the level above and drains to the level
// below; with the inflow driven by the head left, the level follows Torricelli: dh/dt = k·√(H − h), so
// √(H − h) = √(H − h0) − k·t/2 (and draining, √(h − L) = √(h0 − L) − k·t/2). Mitre gates close each end: two leaves
// hinged on the walls swing out and meet mid-chamber at a shallow angle, pointing upstream, with a walkway along the
// top. Electric locomotives ("mules") tow ships along the walls and climb rack inclines between the levels.
// Mapping onto the stage (v2): the yard is the chamber and the fire is its fill. RUN: the lock fills and drains in
// waves that stop below the first tier. ARRIVAL: Amon is the mule, a giant one climbing the north incline onto the top
// tier. PHASE 2: the lock fills to just under the second tier and holds; the second-tier gates (the cell doors) swing
// shut, their two leaves meeting mid-yard: walkways above the fire. Numbers: width real at scale K; levels and mitre
// angle EST; time compressed. Frame: y up, chamber floor y = 0, north −z, the chamber along z.

export const K = 0.6;
export const Lk = {
  W: 33.53 * K, // chamber width (real 33.53 m)
  tiers: [3, 6, 9], // cell-block tiers on both walls
  upper: 7, // the level the culverts fill from (EST)
  lower: 0, // the level it drains to
  k: 0.9, // culvert constant (C_d·a·√(2g)/A), time-compressed (EST)
  waveTop: 2.4, // run: the fill stops here, below tier one
  holdTop: 5.4, // phase 2: the fill holds here, under tier two
  mitre: Math.atan(1 / 3), // leaves meet at 1:3 (a common mitre, EST)
  gateZ: 0, // the gate line across the yard
  inclineGrade: 0.5, // the mule incline, rise over run (EST)
};
Lk.leaf = Lk.W / 2 / Math.cos(Lk.mitre);
/** Filling from h0 toward the upper level: the level τ seconds on (stops at `stop`). */
export function fill(h0, tau, stop) {
  const s = Math.sqrt(Lk.upper - h0) - (Lk.k * tau) / 2;
  const h = Lk.upper - Math.max(0, s) ** 2;
  return Math.min(h, stop);
}
/** Draining from h0 toward the lower level. */
export function drain(h0, tau) {
  const s = Math.sqrt(h0 - Lk.lower) - (Lk.k * tau) / 2;
  return Lk.lower + Math.max(0, s) ** 2;
}
/** Time to fill from h0 to h1, and to drain from h0 to h1. */
export const fillT = (h0, h1) => (2 * (Math.sqrt(Lk.upper - h0) - Math.sqrt(Lk.upper - h1))) / Lk.k;
export const drainT = (h0, h1) => (2 * (Math.sqrt(h0 - Lk.lower) - Math.sqrt(h1 - Lk.lower))) / Lk.k;
export const WAVE = {up: fillT(0, Lk.waveTop), down: drainT(Lk.waveTop, 0.02), dwell: 0.6};
WAVE.period = WAVE.up + WAVE.dwell + WAVE.down + WAVE.dwell;
/** The fire level in the run (repeating waves). */
export function waveLevel(t) {
  const p = ((t % WAVE.period) + WAVE.period) % WAVE.period;
  if (p < WAVE.up) return fill(0, p, Lk.waveTop);
  if (p < WAVE.up + WAVE.dwell) return Lk.waveTop;
  if (p < WAVE.up + WAVE.dwell + WAVE.down) return drain(Lk.waveTop, p - WAVE.up - WAVE.dwell);
  return drain(Lk.waveTop, WAVE.down);
}
/** Mitre gate leaf on side s (−1 west, +1 east): hinge on the wall, swung ψ from the wall (0 open … closed). */
export const CLOSED = Math.PI / 2 - Lk.mitre;
export function leaf(s, psi) {
  const hinge = [s * (Lk.W / 2), Lk.gateZ];

  const dir = [-s * Math.sin(psi), -Math.cos(psi)]; // open: recessed in the wall pointing north; closing toward the centre
  return {hinge, tip: [hinge[0] + dir[0] * Lk.leaf, hinge[1] + dir[1] * Lk.leaf], dir};
}

export function checks(t, psi) {
  const out = [];
  const y = waveLevel(t);
  out.push({name: 'run: the fire stays below tier one', ok: y <= Lk.waveTop + 1e-12 && y < Lk.tiers[0], value: y.toFixed(3)});
  // Torricelli: the closed form satisfies dh/dt = k√(H − h)
  const h0 = 0.5;
  const tau = 0.7;
  const e = 1e-5;
  const d = (fill(h0, tau + e, 99) - fill(h0, tau - e, 99)) / (2 * e);
  const want = Lk.k * Math.sqrt(Lk.upper - fill(h0, tau, 99));
  out.push({name: 'filling obeys dh/dt = k·√(H − h)', ok: Math.abs(d - want) < 1e-6, value: d.toFixed(4)});
  out.push({name: 'a wave fills to the top in its fill time', ok: Math.abs(fill(0, WAVE.up, 99) - Lk.waveTop) < 1e-9, value: WAVE.up.toFixed(3)});
  const L = leaf(-1, CLOSED);
  const R = leaf(1, CLOSED);
  out.push({name: 'closed, the two leaves meet mid-yard', ok: Math.hypot(L.tip[0] - R.tip[0], L.tip[1] - R.tip[1]) < 1e-9 && Math.abs(L.tip[0]) < 1e-9, value: L.tip[1].toFixed(3)});
  out.push({name: 'closed, the mitre points upstream (north)', ok: L.tip[1] < L.hinge[1], value: ((Lk.mitre * 180) / Math.PI).toFixed(2)});
  const lp = leaf(-1, psi);
  out.push({name: 'a leaf keeps its length', ok: Math.abs(Math.hypot(lp.tip[0] - lp.hinge[0], lp.tip[1] - lp.hinge[1]) - Lk.leaf) < 1e-9, value: Lk.leaf.toFixed(3)});
  out.push({name: 'phase 2: the walkway (tier two) stays above the held fire', ok: Lk.tiers[1] > Lk.holdTop, value: (Lk.tiers[1] - Lk.holdTop).toFixed(2)});
  return out;
}
