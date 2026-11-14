// THE RUINS as one machine: Domenico Fontana's move of the Vatican obelisk (1586), model only (no three.js).
// Reference: Fontana, "Della trasportatione dell'obelisco Vaticano" (1590). A 25 m red granite obelisk was lowered
// inside a timber tower (the castello) by ropes run from capstans, laid on a sledge, rolled on log rollers along an
// earth causeway, and raised again the same way in St Peter's Square.
// Mapping onto the stage (v2): Belial is the obelisk inside its castello; his ARRIVAL is the raise (the obelisk pivots
// up on its base, hauled by ropes over the castello head); the four courtyard pillars are smaller obelisks whose ropes
// also run to the castello's capstans; PHASE 1 lowers each one outward on its rope (a rigid body turning on its base
// edge) until it rests on the gallery's inner edge, a ramp up; PHASE 2 hauls the whole rig up a causeway onto the
// gallery and rolls it round on rollers (a load on rollers moves at twice the rollers' speed), the slabs behind it
// dropping into the crypt, never one under a roller.
// Numbers: obelisk height real at game scale K; layout EST (stage). Frame: y up, courtyard floor y = 0, north −z.

export const K = 0.8;
export const R = {
  belialL: 25.3 * K, // the Vatican obelisk's shaft (real, about 25.3 m)
  pillarL: 14, // courtyard pillars, EST
  pillarW: 1.6,
  sq: 6, // pillars stand at (±sq, ±sq)
  galIn: 16, // gallery inner edge radius
  galOut: 21,
  galH: 4.5,
  slabs: 24,
  belialR: 28, // where Belial stands (north)
  castelloHalf: 2.2, // castello posts at ±this (fits the 5 m gallery)
  castelloH: 0.8 * 27, // the castello's height, EST
  rollerR: 0.35,
  rollerN: 5,
  rollerGap: 1.1,
};
const TAU = Math.PI * 2;
R.galMid = (R.galIn + R.galOut) / 2;

/** Pillar k (0..3): its base hinge (on the outer edge of the footing, toward the corner) and fall direction. */
export function pillar(k) {
  const a = (k / 4) * TAU + Math.PI / 4;
  const dir = [Math.cos(a), Math.sin(a)];
  const rb = Math.hypot(R.sq, R.sq) + R.pillarW / 2;
  return {a, dir, rb, base: [dir[0] * rb, 0, dir[1] * rb]};
}
// rest: the pillar's upper face lies on the gallery's inner edge
export const REST = Math.atan2(R.galIn - pillar(0).rb, R.galH); // from vertical
export const CONTACT = Math.hypot(R.galIn - pillar(0).rb, R.galH); // along the pillar
/** Pillar k's top when it has turned θ from vertical. */
export function pillarTop(k, theta) {
  const P = pillar(k);
  return [P.base[0] + P.dir[0] * R.pillarL * Math.sin(theta), R.pillarL * Math.cos(theta), P.base[2] + P.dir[1] * R.pillarL * Math.sin(theta)];
}
/** Belial's obelisk: base on its pivot, raised θ from horizontal (lying north). */
export function belialTop(base, theta) {
  return [base[0], base[1] + R.belialL * Math.sin(theta), base[2] - R.belialL * Math.cos(theta)];
}

/** The rig's path in phase 2: up the causeway from (0, 0, −belialR) to the gallery, then round it. u in metres. */
export const CAUSEWAY = R.belialR - R.galMid;
export function rigAt(u) {
  if (u <= CAUSEWAY) {
    const f = u / CAUSEWAY;
    return {p: [0, R.galH * f, -(R.belialR - u)], ang: -Math.PI / 2, onGallery: false};
  }
  const ang = -Math.PI / 2 + (u - CAUSEWAY) / R.galMid;
  return {p: [R.galMid * Math.cos(ang), R.galH, R.galMid * Math.sin(ang)], ang, onGallery: true};
}
/** Rollers: they travel at half the load's speed; one that falls out the back is carried to the front. */
export function rollers(u) {
  const span = R.rollerN * R.rollerGap;
  const out = [];
  for (let i = 0; i < R.rollerN; i++) {
    // roller position relative to the sledge: moves back at half speed, wraps
    let rel = (i * R.rollerGap - u / 2) % span;
    if (rel < 0) rel += span;
    out.push({rel: rel - span / 2 + R.rollerGap / 2, spin: u / 2 / R.rollerR});
  }
  return out;
}
/** Slab k's centre angle on the gallery. */
export const slabAng = (k) => ((k + 0.5) / R.slabs) * TAU;
const angDist = (a, b) => Math.abs(((a - b + Math.PI) % TAU + TAU) % TAU - Math.PI);
/** A slab drops once the rig has passed it by two slab widths (never while the rig is on it). */
export function slabDropped(k, u) {
  if (u <= CAUSEWAY) return false;
  const travelled = (u - CAUSEWAY) / R.galMid; // radians round the ring
  const start = -Math.PI / 2;
  const behind = (((start + travelled - slabAng(k)) % TAU) + TAU) % TAU; // how far behind the rig this slab is
  return travelled > behind && behind > (2.5 * TAU) / R.slabs && behind < travelled;
}

export function checks(u) {
  const out = [];
  out.push({name: 'a fallen pillar rests on the gallery edge (its face passes through it)', ok: Math.abs(CONTACT * Math.cos(REST) - R.galH) < 1e-9 && Math.abs(CONTACT * Math.sin(REST) - (R.galIn - pillar(0).rb)) < 1e-9, value: ((REST * 180) / Math.PI).toFixed(1)});
  out.push({name: 'the pillar reaches past the edge (the tip overhangs the gallery)', ok: R.pillarL > CONTACT, value: CONTACT.toFixed(2)});
  out.push({name: 'the ramp is climbable (under 40° from level)', ok: 90 - (REST * 180) / Math.PI < 40, value: (90 - (REST * 180) / Math.PI).toFixed(1)});
  out.push({name: 'the castello fits the gallery width', ok: 2 * R.castelloHalf + 0.4 < R.galOut - R.galIn, value: 2 * R.castelloHalf});
  out.push({name: 'the castello is taller than the obelisk', ok: R.castelloH > R.belialL, value: R.castelloH.toFixed(1)});
  const h = 1e-4;
  const r0 = rollers(u);
  const r1 = rollers(u + h);
  const v = (r1[0].rel - r0[0].rel) / h;
  if (Math.abs(v) < 1) out.push({name: 'a roller moves at half the load speed (−½ relative to the sledge)', ok: Math.abs(v + 0.5) < 1e-6, value: v.toFixed(3)});
  const rig = rigAt(u);
  if (rig.onGallery) {
    for (let k = 0; k < R.slabs; k++) {
      const under = angDist(slabAng(k), rig.ang) < (TAU / R.slabs) * 1.2;
      if (under) out.push({name: 'no slab under the rig has dropped', ok: !slabDropped(k, u), value: k});
    }
  }
  return out;
}
export {TAU};
