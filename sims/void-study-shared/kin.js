// THE VOID as one machine: the Arecibo radio telescope, model only (no three.js).
// Reference: Arecibo Observatory (1963–2020). A spherical reflector 305 m across (radius of curvature 265 m) set in a
// sinkhole; a 900-tonne triangular platform hung by cables from three towers, about 150 m over the dish; under it a
// curved azimuth arm that turns a full circle, with the Gregorian dome riding the arm out to 20° from the zenith; three
// pairs of tie-down cables from the platform's corners to anchors below, tensioned by jacks. In December 2020 the
// cables failed and the platform fell through the dish.
// Mapping onto the stage (v2): the dish, stepped, is the three tiers (its sagitta gives the 4 m and 8 m steps at
// the right radii); the platform is Belphegor, lowered from the dark on its cables; the feed beam is the sleep beam
// (it passes through the sphere's centre, so it lands on the dish at radius R·sin ζ, inside the floor tier); the
// three pairs of tie-downs are the six hook-legs, reeled in by their jacks so they lift every other outer platform's
// inner edge into a ramp; the platform then sinks through the split centre disc, as it fell in 2020.
// Numbers: real ones at game scale K (marked), EST where no source was used. Frame: y up, dish bottom at y = 0.

export const K = 1 / 6; // game scale on the real machine
export const A = {
  aperture: 305 * K, // dish diameter (real)
  Rs: 265 * K, // radius of curvature of the reflector (real)
  zMax: (20 * Math.PI) / 180, // the dome's reach from the zenith (real)
  side: 65 * K, // platform triangle side, EST
  towerR: 200 * K, // towers' distance from the dish axis, EST
  towerH: 80, // tower tops, game metres: above the platform's highest point, so the cables always hang down to it (EST)
  armR: 0.5, // the arm is an arc of radius Rs/2 about the sphere's centre (the focal surface)
  outerN: 12, // outer platforms (stage)
  midN: 8, // middle ring segments (stage)
  hooked: [0, 2, 4, 6, 8, 10], // every other outer platform takes a tie-down
  jump: 1.2, // the ramp top is this far below the platform deck (a jump)
};
const TAU = Math.PI * 2;
A.C = [0, A.Rs, 0]; // the sphere's centre, straight over the dish bottom
/** The dish surface's height at radius r (the sagitta). */
export const sag = (r) => A.Rs - Math.sqrt(A.Rs * A.Rs - r * r);
/** The radius at which the dish rises to height h. */
export const rAt = (h) => Math.sqrt(A.Rs * A.Rs - (A.Rs - h) ** 2);
// tiers: each flat at the height the dish reaches at its inner edge (0, 4, 8 m)
export const TIERS = [
  {h: 0, rIn: 0, rOut: rAt(4) - 2.4},
  {h: 4, rIn: rAt(4), rOut: rAt(8) - 1.6},
  {h: 8, rIn: rAt(8), rOut: rAt(8) + 7},
];
export const FOCUS_Y = A.Rs / 2; // the paraxial focus, half the radius above the bottom
export const DECK_HIGH = 70; // where the platform waits in the dark during the run

/** Platform corner k (0..2) for a deck height y. */
export function corner(k, y) {
  const a = (k / 3) * TAU + Math.PI / 2;
  const r = A.side / Math.sqrt(3);
  return [r * Math.cos(a), y, r * Math.sin(a)];
}
export const tower = (k) => {
  const a = (k / 3) * TAU + Math.PI / 2;
  return [A.towerR * Math.cos(a), A.towerH, A.towerR * Math.sin(a)];
};

/** The dome on the arm: azimuth φ, zenith ζ, with the platform deck at y (the arm hangs from it). */
export function dome(phi, zeta, y) {
  const drop = y - FOCUS_Y; // the arm moves with the platform
  const u = [Math.sin(zeta) * Math.cos(phi), -Math.cos(zeta), Math.sin(zeta) * Math.sin(phi)];
  const r = A.Rs * A.armR;
  return {p: [A.C[0] + u[0] * r, A.C[1] + u[1] * r + drop, A.C[2] + u[2] * r], u};
}
/** Where the feed beam from the dome (aimed along u) meets the dish sphere. */
export function beamSpot(phi, zeta, y) {
  const {p, u} = dome(phi, zeta, y);
  const o = [p[0] - A.C[0], p[1] - A.C[1], p[2] - A.C[2]];
  const b = o[0] * u[0] + o[1] * u[1] + o[2] * u[2];
  const c = o[0] ** 2 + o[1] ** 2 + o[2] ** 2 - A.Rs * A.Rs;
  const t = -b + Math.sqrt(b * b - c);
  return [p[0] + u[0] * t, p[1] + u[1] * t, p[2] + u[2] * t];
}

/** Outer platform k: hinged on its outer edge; its inner edge lifted by angle α. */
export function outer(k, alpha) {
  const T = TIERS[2];
  const a = ((k + 0.5) / A.outerN) * TAU;
  const L = T.rOut - T.rIn;
  const hinge = [T.rOut * Math.cos(a), T.h, T.rOut * Math.sin(a)];
  const rIn = T.rOut - L * Math.cos(alpha);
  const edge = [rIn * Math.cos(a), T.h + L * Math.sin(alpha), rIn * Math.sin(a)];
  return {a, hinge, edge, L};
}
// phase 2: the deck sinks to its lowest, and the ramps rise until their tops are a jump below it
export const DECK_LOW = 13.2;
export const RAMP_MAX = Math.asin((DECK_LOW - A.jump - TIERS[2].h) / (TIERS[2].rOut - TIERS[2].rIn));
/** Which platform corner a hooked platform's tie-down runs to (the nearest one). */
export function tieCorner(k) {
  const a = ((k + 0.5) / A.outerN) * TAU;
  let best = 0;
  let bd = Infinity;
  for (let c = 0; c < 3; c++) {
    const ca = (c / 3) * TAU + Math.PI / 2;
    const d = Math.abs(((a - ca + Math.PI) % TAU + TAU) % TAU - Math.PI);
    if (d < bd) {
      bd = d;
      best = c;
    }
  }
  return best;
}

export function checks(phi, zeta, y, alpha) {
  const out = [];
  const d3 = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
  out.push({name: 'tier steps sit on the dish sphere (4 m, 8 m)', ok: Math.abs(sag(TIERS[1].rIn) - 4) < 1e-9 && Math.abs(sag(TIERS[2].rIn) - 8) < 1e-9, value: `${TIERS[1].rIn.toFixed(2)}, ${TIERS[2].rIn.toFixed(2)} m`});
  out.push({name: 'the dish rim is inside the outer ring', ok: A.aperture / 2 <= TIERS[2].rOut, value: (A.aperture / 2).toFixed(2)});
  const sp = beamSpot(phi, zeta, FOCUS_Y);
  const r = Math.hypot(sp[0], sp[2]);
  out.push({name: 'at the focus the beam crosses the sphere centre: spot radius R·sin ζ', ok: Math.abs(r - A.Rs * Math.sin(zeta)) < 1e-9, value: r.toFixed(3)});
  out.push({name: 'phase 1: the beam stays on the floor tier', ok: A.Rs * Math.sin(A.zMax) < TIERS[0].rOut, value: (A.Rs * Math.sin(A.zMax)).toFixed(2)});
  const spl = beamSpot(phi, zeta, y);
  out.push({name: 'the beam spot lies on the dish', ok: Math.abs(d3(spl, A.C) - A.Rs) < 1e-9, value: d3(spl, A.C).toFixed(3)});
  for (const k of A.hooked) {
    const o = outer(k, alpha);
    out.push({name: 'a ramp keeps its length (rigid on its hinge)', ok: Math.abs(d3(o.hinge, o.edge) - o.L) < 1e-9, value: o.L.toFixed(3)});
    const c = corner(tieCorner(k), DECK_LOW);
    out.push({name: 'at full lift the tie-down pulls up (its corner is above the ramp edge)', ok: c[1] > outer(k, RAMP_MAX).edge[1], value: (c[1] - outer(k, RAMP_MAX).edge[1]).toFixed(2)});
  }
  out.push({name: 'ramp top is a jump below the sunk deck', ok: Math.abs(DECK_LOW - outer(0, RAMP_MAX).edge[1] - A.jump) < 1e-9, value: outer(0, RAMP_MAX).edge[1].toFixed(2)});
  out.push({name: 'the main cables hang down from the towers at every deck height', ok: A.towerH > DECK_HIGH, value: A.towerH});
  return out;
}
export {TAU};
