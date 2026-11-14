// ROOST PR-3, the percher, model only. Reference: bird-inspired perching graspers (Stanford's SNAG and its kin):
// tendon-driven toes whose phalanges close in sequence round a branch, three forward and one back (anisodactyl).
// Closed, each toe's joints sit on a ring round the perch, every phalanx a chord of that ring, so it hugs the perch
// without passing into it. A dart launcher under the body fires down at the target. Input: grip g (0 open .. 1
// closed), launcher aim, time. Frame: x along the perch, y up, z across; metres.

export const P = {
  perch: {y: 6, r: 0.13},
  phal: [0.15, 0.13, 0.11], // phalanx lengths, base to tip
  toeT: 0.025, // toe half thickness
  ringPad: 0.012, // the closed joints' ring stands this far off the contact radius
  feet: [-0.22, 0.22], // foot x positions along the perch
  toesFwd: [-0.07, 0, 0.07], // fanned across x
  dart: {v: 14, g: 9.81},
};
const TAU = Math.PI * 2;
const RJ = P.perch.r + P.toeT + P.ringPad + 0.015; // the ring the joints sit on when closed (chords then 1.1-1.9 cm off the perch)

/** One toe's joints in its own plane (y-z), from the toe base at angle a0 round the perch, wrapping toward dir. */
export function toe(a0, dir, g) {
  // closed angles: each chord of length l on the ring RJ spans 2·asin(l / 2RJ)
  const closed = P.phal.map((l) => 2 * Math.asin(l / (2 * RJ)));
  const pts = [[Math.cos(a0) * RJ, Math.sin(a0) * RJ]];
  // open: the toe sticks out straight along the tangent; closed: chords on the ring; the bend grows with g
  let heading = a0 + dir * Math.PI / 2; // tangent direction at the base
  let a = a0;
  for (let k = 0; k < P.phal.length; k++) {
    // closed heading for chord k: from angle a to a + dir·span, chord direction
    const span = closed[k];
    const chordDir = a + dir * span / 2 + dir * Math.PI / 2;
    const hk = heading + (chordDir - heading) * g;
    const prev = pts[pts.length - 1];
    const q = [prev[0] + Math.cos(hk) * P.phal[k], prev[1] + Math.sin(hk) * P.phal[k]];
    pts.push(q);
    a += dir * span;
    heading = hk + (dir * span / 2) * g; // the next phalanx starts bent by the joint
  }
  return pts; // [y, z] offsets from the perch axis
}

/** Distance from point p to segment ab (2D). */
const segDist = (p, a, b) => {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const u = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(p[0] - a[0] - u * dx, p[1] - a[1] - u * dy);
};

export function grip(g) {
  // three forward toes wrap over the top toward +z then under; the hallux wraps the other way from behind
  const fwd = toe(Math.PI / 2 + 0.25, -1, g); // starts just behind the top, wraps forward (clockwise in y-z)
  const back = toe(Math.PI / 2 - 0.25, 1, g);
  return {fwd, back};
}

export function checks(g) {
  const out = [];
  const G = grip(g);
  for (const [name, pts] of [['forward toes', G.fwd], ['hallux', G.back]]) {
    let e = 0;
    for (let k = 0; k < P.phal.length; k++) e = Math.max(e, Math.abs(Math.hypot(pts[k + 1][0] - pts[k][0], pts[k + 1][1] - pts[k][1]) - P.phal[k]));
    out.push({name: `${name}: phalanx lengths exact`, ok: e < 1e-12, value: e.toExponential(1)});
    // no phalanx passes into the perch (its surface clears the perch by ≥ 0)
    let clear = Infinity;
    for (let k = 0; k < P.phal.length; k++) clear = Math.min(clear, segDist([0, 0], pts[k], pts[k + 1]) - P.toeT - P.perch.r);
    out.push({name: `${name}: never into the perch`, ok: clear >= -1e-9, value: clear.toFixed(4)});
    if (g > 0.9999) {
      let far = 0;
      for (let k = 0; k < P.phal.length; k++) far = Math.max(far, segDist([0, 0], pts[k], pts[k + 1]) - P.toeT - P.perch.r);
      out.push({name: `${name}: closed, every phalanx within 2 cm of the perch`, ok: far <= 0.02, value: far.toFixed(4)});
    }
  }
  return out;
}

/** The dart: from the launcher muzzle toward the target, ballistic; returns position at tau and the aim. */
export function dart(muzzle, target, tau) {
  // aim straight at the target with the drop compensated (low root of the ballistic elevation)
  const dx = Math.hypot(target[0] - muzzle[0], target[2] - muzzle[2]);
  const dy = target[1] - muzzle[1];
  const v = P.dart.v;
  const gg = P.dart.g;
  const disc = v ** 4 - gg * (gg * dx * dx + 2 * dy * v * v);
  const el = Math.atan((v * v - Math.sqrt(Math.max(0, disc))) / (gg * dx));
  const az = Math.atan2(target[0] - muzzle[0], target[2] - muzzle[2]);
  const vel = [Math.sin(az) * Math.cos(el) * v, Math.sin(el) * v, Math.cos(az) * Math.cos(el) * v];
  return {el, az, p: [muzzle[0] + vel[0] * tau, muzzle[1] + vel[1] * tau - 0.5 * gg * tau * tau, muzzle[2] + vel[2] * tau], T: dx / (Math.cos(el) * v)};
}
export {TAU};
