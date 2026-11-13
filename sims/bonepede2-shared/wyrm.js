// BONEPEDE II pose: a flying bone centipede. Given the trail, the head's arc length and a rowing phase, every part's
// placement is a pure function. No three.js here.
//   segments  sit on the trail at fixed spacing, rolled a little so the belly shows as the body turns
//   legs      one fringe pair per segment, two bones each, rowing in a wave that runs from head to tail
//   spines    one long dorsal spine per segment, longest over the back half, plus a short side pair
//   weak      one orb per segment on the belly centreline
import {roll, V} from './trail.js';

const {add, mul, norm} = V;

export const CFG = {
  N: 26,
  spacing: 0.3,
  radius: 0.33, // body half-thickness at the front
  taper: 0.6,
  femur: 0.62,
  tibia: 0.95,
  row: 0.55, // rowing sweep, radians
  rowLag: 0.42, // phase lag per segment (radians)
  rollAmp: 0.5,
  rollLen: 3.4,
  spine: 0.95,
};

export const widthAt = (i) => 1 - (1 - CFG.taper) * Math.pow(i / (CFG.N - 1), 1.4);

/**
 * headArc: the head's arc length along the trail. phase: the rowing phase in radians (time * rate).
 * Returns {segs, legs, spines, weak, head}. Each frame is {p, t, u, s}: position, forward, up, left.
 */
export function pose(trail, headArc, phase) {
  const segs = [];
  for (let i = 0; i < CFG.N; i++) {
    const a = headArc - (i + 1) * CFG.spacing;
    const f0 = trail.at(a);
    const f = roll(f0, CFG.rollAmp * Math.sin((2 * Math.PI * a) / CFG.rollLen));
    segs.push({i, a, w: widthAt(i), ...f});
  }
  const legs = [];
  const spines = [];
  const weak = [];
  for (const sg of segs) {
    const r = CFG.radius * sg.w;
    const belly = mul(sg.u, -1);
    const ph = phase - sg.i * CFG.rowLag;
    for (const side of [1, -1]) {
      const sw = Math.sin(ph + (side < 0 ? Math.PI : 0)); // left and right row out of step
      const root = add(add(sg.p, mul(sg.s, side * r * 0.85)), mul(belly, r * 0.35));
      const ls = 0.75 + 0.25 * sg.w;
      // femur out and down, swept forward and back by the row; tibia hangs down and trails the stroke
      const d1 = norm(add(add(mul(sg.s, side * 0.85), mul(belly, 0.55)), mul(sg.t, CFG.row * sw)));
      const knee = add(root, mul(d1, CFG.femur * ls));
      const d2 = norm(add(add(mul(belly, 0.95), mul(sg.s, side * 0.25)), mul(sg.t, CFG.row * 0.8 * Math.sin(ph - 0.9 + (side < 0 ? Math.PI : 0)) - 0.25)));
      const tip = add(knee, mul(d2, CFG.tibia * ls));
      legs.push({seg: sg.i, side, root, knee, tip});
    }
    // dorsal spine, raked back; longest from mid-body to the tail like the reference's back half
    const k = sg.i / (CFG.N - 1);
    const L = CFG.spine * (0.35 + 0.75 * Math.sin(Math.PI * Math.min(1, k * 1.15))) * (sg.i % 2 ? 0.8 : 1);
    const base = add(sg.p, mul(sg.u, r * 0.85));
    spines.push({base, tip: add(base, mul(norm(add(sg.u, mul(sg.t, -0.55))), L))});
    for (const side of [1, -1]) {
      const b = add(add(sg.p, mul(sg.u, r * 0.4)), mul(sg.s, side * r * 0.9));
      spines.push({base: b, tip: add(b, mul(norm(add(add(mul(sg.s, side), mul(sg.u, 0.6)), mul(sg.t, -0.5))), 0.26 * sg.w + 0.08))});
    }
    // weak point on the belly, facing out of it
    weak.push({seg: sg.i, p: add(sg.p, mul(belly, r * 0.92)), out: belly, t: sg.t});
  }
  const h = trail.at(headArc);
  const head = roll(h, CFG.rollAmp * Math.sin((2 * Math.PI * headArc) / CFG.rollLen));
  return {segs, legs, spines, weak, head};
}
