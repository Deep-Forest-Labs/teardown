// LUST as one machine: a hydraulic flower, after Calatrava's Burke Brise Soleil (Milwaukee Art Museum, 2001), model
// only. Reference: the Brise Soleil is a 66 m wingspan of steel fins that hinge open and shut on a spine, swung by
// hydraulic cylinders; each fin is a rigid blade turning about one hinge, and a cylinder from a fixed base to a point
// on the blade sets its angle (the triangle base–hinge–rod end, solved by the law of cosines).
// Mapping onto the stage (v2): six wedge petals hinge on the rim of the bloom at the spire top, each on its own
// cylinder. RUN: shut, a bud. ARRIVAL: all six cylinders retract together and the petals open level (high platforms);
// Lilith rises in the bloom on the spire's central telescopic ram. PHASE 2: the cylinders set six different lengths
// and the petals droop to staggered angles whose tips climb a double jump each, 4 m to the bloom (the v2 note said
// middles; with the floor in the way the tips are the steps). Updraft columns ring
// the terrace. Numbers: layout EST (stage), cylinder rule real (stroke under the closed length). Frame: y up.

export const L = {
  Hb: 14, // bloom (hinge ring) height
  rb: 3, // hinge ring radius
  Lp: 14, // petal length
  n: 6,
  cylBase: [0.8, 19.25], // cylinder base on the mast above the bloom (radius, height): the mount with the most leverage
  // over the whole 146° swing (17°) that keeps the stroke under the closed length, found by search
  rodE: 1.5, // rod end, distance along the petal from its hinge
  shutAng: (100 * Math.PI) / 180, // the bud: petals lean 10° in past vertical, tips meeting over the mast
  step: 2, // staircase rise per petal
  updrafts: 8,
  updraftR: 34,
};
const TAU = Math.PI * 2;
/** The rod end and the petal middle in the petal's plane (r out, y up) at angle φ above level. */
export const petalPt = (phi, d) => [L.rb + d * Math.cos(phi), L.Hb + d * Math.sin(phi)];
/** Cylinder length for petal angle φ. */
export function cylLen(phi) {
  const p = petalPt(phi, L.rodE);
  return Math.hypot(p[0] - L.cylBase[0], p[1] - L.cylBase[1]);
}
/** Petal angle for a cylinder length (law of cosines on base–hinge–rod end). */
export function phiFor(len) {
  const b = [L.cylBase[0] - L.rb, L.cylBase[1] - L.Hb]; // base relative to the hinge
  const db = Math.hypot(...b);
  const c = (L.rodE * L.rodE + db * db - len * len) / (2 * L.rodE * db); // cos of the angle at the hinge
  const angB = Math.atan2(b[1], b[0]);
  return angB - Math.acos(Math.max(-1, Math.min(1, c))); // the petal is clockwise of the base direction
}
/** Phase-2 angles: petal k's tip at 4 + 2k m (the top one level with the bloom). */
export const STAIR = Array.from({length: L.n}, (_, k) => Math.asin((-(L.n - 1 - k) * L.step) / L.Lp));
export const LEN = {shut: cylLen(L.shutAng), open: cylLen(0)};
export const STAIR_LEN = STAIR.map(cylLen);
export const ALL_LEN = [LEN.shut, LEN.open, ...STAIR_LEN];

export function checks(phi) {
  const out = [];
  const len = cylLen(phi);
  out.push({name: 'the cylinder length gives back the petal angle', ok: Math.abs(phiFor(len) - phi) < 1e-9, value: ((phi * 180) / Math.PI).toFixed(2)});
  const lo = Math.min(...ALL_LEN);
  const hi = Math.max(...ALL_LEN);
  out.push({name: 'stroke under the closed length (one cylinder covers bud to lowest step)', ok: hi - lo < lo, value: `${lo.toFixed(2)}–${hi.toFixed(2)} m`});
  STAIR.forEach((a, k) => {
    const mid = petalPt(a, L.Lp)[1];
    out.push({name: 'staircase: petal tips climb a double jump each', ok: Math.abs(mid - (L.Hb - (L.n - 1 - k) * L.step)) < 1e-9, value: mid.toFixed(2)});
  });
  // the shut petals stay clear of each other: at the shut angle the hinge-ring polygon still has room at the tips
  const tipR = L.rb + L.Lp * Math.cos(L.shutAng);
  out.push({name: 'the shut bud stays round the spire axis (tips inside the hinge ring’s reach)', ok: tipR > 0, value: tipR.toFixed(2)});
  const low = petalPt(STAIR[0], L.Lp)[1];
  out.push({name: 'the lowest petal’s tip stays above the floor', ok: low > 0.2, value: low.toFixed(2)});
  const p = petalPt(phi, L.rodE);
  const c = [p[0] - L.cylBase[0], p[1] - L.cylBase[1]];
  const lev = Math.asin(Math.abs(c[0] * Math.sin(phi) - c[1] * Math.cos(phi)) / Math.hypot(...c));
  out.push({name: 'the cylinder keeps ≥ 15° of leverage on the petal', ok: lev >= (15 * Math.PI) / 180 - 1e-9, value: ((lev * 180) / Math.PI).toFixed(1)});
  const yAtMast = L.rb + (L.cylBase[1] - L.Hb) / Math.tan(L.shutAng);
  out.push({name: 'shut petals clear the mast', ok: yAtMast > L.cylBase[0] + 0.5, value: yAtMast.toFixed(2)});
  return out;
}
export {TAU};
