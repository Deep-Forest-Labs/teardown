// TREACHERY as one machine: an ice carousel, model only (no three.js).
// Reference: the Finnish ice carousel: a disc is cut out of a frozen lake with chainsaws and spun on the water by
// outboard motors set in the cut. Ice floats with ρ_ice/ρ_water of its thickness under (917/1000), so a 1 m slab
// shows 8.3 cm; holding it fully under takes (ρ_water − ρ_ice)·g·V, its leftover buoyancy (Archimedes).
// Mapping onto the stage (v2): Cocytus is the lake, cut into a centre disc and rings of floes (seams shut). PHASE 1:
// the whole carousel turns, the Companion circling with you. PHASE 2: ring k drifts out by k gaps (so the gaps between
// rings are one gap wide) and the rings counter-turn, each on its own motors; floes in a ring that moved out by d open
// gaps of 2·d·sin(π/n). Every 8 s the Companion dives on a floe and holds it under for 3 s. The Companion is drawn as
// its stack of rings, not modelled as a mechanism. Numbers: densities real; layout EST (stage). Frame: y up, water y = 0.

export const T = {
  rhoI: 917, // ice, kg/m³ (real)
  rhoW: 1000, // fresh water
  g: 9.81,
  thick: 1.0, // floe thickness
  rings: [{r0: 0, r1: 6, n: 1}, {r0: 6, r1: 12, n: 6}, {r0: 12, r1: 18, n: 10}, {r0: 18, r1: 24, n: 14}, {r0: 24, r1: 30, n: 18}],
  gap: 1.2, // the drift unit
  omega: 0.06, // ring turn rate in phase 2, rad/s (EST)
  together: 0.025, // phase 1 carousel rate
  diveEvery: 8,
  diveHold: 3,
};
const TAU = Math.PI * 2;
export const FREEBOARD = T.thick * (1 - T.rhoI / T.rhoW);
/** Floe j of ring k: its centre angle and (for the drift) its outward unit vector. */
export function floe(k, j, drift, turn) {
  const R = T.rings[k];
  const a = ((j + 0.5) / R.n) * TAU + turn;
  const d = drift * k * T.gap;
  return {a, d, rMid: (R.r0 + R.r1) / 2 + d, off: [d * Math.cos(a), d * Math.sin(a)]};
}
/** Area of one floe of ring k (an annular sector). */
export const floeArea = (k) => (Math.PI * (T.rings[k].r1 ** 2 - T.rings[k].r0 ** 2)) / T.rings[k].n;
/** The force to hold a floe of ring k fully under. */
export const pushForce = (k) => (T.rhoW - T.rhoI) * T.g * floeArea(k) * T.thick;
/** The gap a ring's floes open when the ring moves out by d (at the floes' inner corners: chord of the turn). */
export const innerGap = (k, d) => (T.rings[k].n > 1 ? 2 * d * Math.sin(Math.PI / T.rings[k].n) : 0);

export function checks(drift) {
  const out = [];
  out.push({name: 'Archimedes: the freeboard is (1 − ρi/ρw) of the thickness', ok: Math.abs(FREEBOARD - 0.083) < 1e-12, value: FREEBOARD.toFixed(3)});
  for (let k = 1; k < T.rings.length; k++) {
    const gapBetween = (T.rings[k].r0 + k * drift * T.gap) - (T.rings[k - 1].r1 + (k - 1) * drift * T.gap);
    out.push({name: 'the gap between neighbouring rings is one drift unit', ok: Math.abs(gapBetween - drift * T.gap) < 1e-9, value: gapBetween.toFixed(3)});
    // two neighbouring floes in ring k: their corner points after translating out by d
    const R = T.rings[k];
    const d = drift * k * T.gap;
    const f0 = floe(k, 0, drift, 0);
    const f1 = floe(k, 1, drift, 0);
    const edge = (TAU / R.n) * 1; // the shared edge sits at angle edge
    const c0 = [R.r0 * Math.cos(edge) + f0.off[0], R.r0 * Math.sin(edge) + f0.off[1]];
    const c1 = [R.r0 * Math.cos(edge) + f1.off[0], R.r0 * Math.sin(edge) + f1.off[1]];
    out.push({name: 'floes moving out by d open gaps of 2·d·sin(π/n)', ok: Math.abs(Math.hypot(c0[0] - c1[0], c0[1] - c1[1]) - innerGap(k, d)) < 1e-9, value: innerGap(k, d).toFixed(3)});
  }
  out.push({name: 'pushing a floe under takes its leftover buoyancy', ok: Math.abs(pushForce(2) - (T.rhoW - T.rhoI) * T.g * floeArea(2) * T.thick) < 1e-9, value: `${(pushForce(2) / 1000).toFixed(1)} kN`});
  return out;
}
export {TAU};
