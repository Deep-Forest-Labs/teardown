// GILDED GD-6, the gilded skull, model only. References: the orange-peel grab (a crane bucket of hinged petals):
// six armoured petals hinge on a top ring, each swung by its own hydraulic cylinder from the hub, petal angle solved
// from the cylinder's length; closed, the petal tips meet at the bottom and seal the shell, open they bare the core.
// The coin volley: a hopper feeds a pitching-machine launcher (two counter-rotating wheels; a coin leaves at the rim
// speed). It hovers on four ducted fans. Inputs: cylinder extension c (0 closed .. 1 open), launcher wheel ω, time.
// Frame: x right, y up, z forward; metres (the shell's centre at the origin).

export const G = {
  petals: 6,
  ringR: 0.55, // hinge ring radius
  ringY: 0.55, // hinge ring height
  petal: 1.2, // petal length from its hinge to its tip
  horn: 0.24, // the petal's crank arm the cylinder pushes (above the hinge, inward)
  anchor: [0.12, 0.95], // cylinder anchor on the hub (r, y)
  cyl: [0.55, 0.8], // cylinder length closed .. open (the horn can reach at most 0.587 + 0.24 = 0.827 from the anchor)
  wheelR: 0.12,
  muzzle: [0, -0.72, 0.25], // below the sealed tips (y −0.517): outside the shell's 0.675 m sphere
};
function cc(a, ra, b, rb, sgn) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const d = Math.hypot(dx, dy);
  const x = (ra * ra - rb * rb + d * d) / (2 * d);
  const h2 = ra * ra - x * x;
  if (h2 < 0) return null;
  const h = Math.sqrt(h2);
  return [a[0] + (dx / d) * x - sgn * (dy / d) * h, a[1] + (dy / d) * x + sgn * (dx / d) * h];
}
// the angle between the petal and its horn is fixed by the closed pose: closed, the petal tip lies on the axis below
const TIP_CLOSED = [0, G.ringY - Math.sqrt(G.petal ** 2 - G.ringR ** 2)];
const PETAL_DIR_CLOSED = Math.atan2(TIP_CLOSED[1] - G.ringY, TIP_CLOSED[0] - G.ringR);
const HORN_CLOSED = cc([G.ringR, G.ringY], G.horn, G.anchor, G.cyl[0], 1);
const HORN_OFF = Math.atan2(HORN_CLOSED[1] - G.ringY, HORN_CLOSED[0] - G.ringR) - PETAL_DIR_CLOSED;

/** One petal in its radial plane (r, y) at cylinder extension c. */
export function petal(c) {
  const L = G.cyl[0] + (G.cyl[1] - G.cyl[0]) * c;
  const H = [G.ringR, G.ringY];
  const horn = cc(H, G.horn, G.anchor, L, 1);
  if (!horn) return null;
  const hornAng = Math.atan2(horn[1] - H[1], horn[0] - H[0]);
  const dir = hornAng - HORN_OFF;
  const tip = [H[0] + Math.cos(dir) * G.petal, H[1] + Math.sin(dir) * G.petal];
  return {H, horn, tip, dir, L};
}
export const coinSpeed = (omega) => omega * G.wheelR; // the coin leaves at the wheels' rim speed

export function checks(c) {
  const out = [];
  const P = petal(c);
  out.push({name: 'petal linkage solvable', ok: !!P, value: P ? 'ok' : 'none'});
  if (!P) return out;
  const d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  out.push({name: 'cylinder length exact', ok: Math.abs(d(P.horn, G.anchor) - P.L) < 1e-12, value: '-'});
  out.push({name: 'horn length exact', ok: Math.abs(d(P.horn, P.H) - G.horn) < 1e-12, value: '-'});
  if (c < 1e-9) out.push({name: 'closed: the petal tips meet on the axis (the shell seals)', ok: Math.abs(P.tip[0]) < 1e-9, value: P.tip[0].toExponential(1)});
  if (c > 0.999) out.push({name: 'open: the petals swing clear of the core (≥ 0.9 m out)', ok: P.tip[0] >= 0.9, value: P.tip[0].toFixed(3)});
  // a petal never swings through the hub or above its hinge ring
  out.push({name: 'petal stays below its hinge', ok: P.tip[1] < G.ringY, value: P.tip[1].toFixed(3)});
  // volley: coin speed for the launcher at 150 rad/s
  out.push({name: 'coins leave at 15–22 m/s (150 rad/s)', ok: coinSpeed(150) >= 15 && coinSpeed(150) <= 22, value: coinSpeed(150).toFixed(1)});
  return out;
}
