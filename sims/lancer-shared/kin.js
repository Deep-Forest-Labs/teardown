// FROST LANCER IL-3, model only. References: the cranequin (a crank turns a pinion through a reduction; the pinion
// drives a toothed rack that hooks the string and draws it back to the nut) and the ballista's torsion arms (two rigid
// arms on twisted-sinew springs, torque κ·(φ − φ0)). The string has a fixed length; drawing the nut back by x swings
// both arms, solved exactly. Stored energy E = κ(φ − φ0)² over both arms; launch speed v = √(2ηE / m). The lance flies a
// plain ballistic arc; the hit passes its momentum to the target, which slides on the ice under kinetic friction μ.
// Inputs: crank angle, time. Frame: stock local z forward, x right; world y up; SI units.

export const B = {
  w: 0.14, // arm hinge offset from the stock centreline
  La: 0.8, // arm length
  l: 0.95, // half string length (tip to nut)
  phi0: (15 * Math.PI) / 180, // arm sweep at rest (pre-twist)
  stroke: 0.4, // power stroke, m
  E: 1600, // stored energy at full draw, J
  eta: 0.5, // efficiency (energy into the lance)
  m: 1.2, // lance mass, kg
  rp: 0.04, // pinion radius, m
  ratio: 4, // crank to pinion reduction
  launchY: 2.1, // bolt height at launch
  target: {d: 20, y: 1.1, M: 80}, // distance, hit height, target mass
  mu: 0.02, // ice kinetic friction
  g: 9.81,
};

/** Arm tip for sweep φ (right arm; the left mirrors in x). Back is −z. */
export const tip = (phi) => [B.w + B.La * Math.cos(phi), -B.La * Math.sin(phi)];
/** Arm sweep with the nut drawn back to z = −x (fixed string length). */
export function armAt(x) {
  let lo = 0;
  let hi = Math.PI / 2;
  const f = (p) => {
    const t = tip(p);
    return Math.hypot(t[0], t[1] + x) - B.l;
  };
  // at small φ the tip is far out (string too long → f > 0 means tip too far); find the root by bisection
  for (let k = 0; k < 80; k++) {
    const mid = (lo + hi) / 2;
    if (f(lo) * f(mid) <= 0) hi = mid;
    else lo = mid;
  }
  return (lo + hi) / 2;
}
// rest: the nut position at which the arms sit at φ0
export const X0 = (() => {
  const t = tip(B.phi0);
  return -t[1] + Math.sqrt(B.l * B.l - t[0] * t[0]);
})();
export const X1 = X0 + B.stroke;
export const PHI1 = armAt(X1);
export const KAPPA = B.E / (PHI1 - B.phi0) ** 2;
export const energyAt = (x) => KAPPA * (armAt(x) - B.phi0) ** 2;
export const V = Math.sqrt((2 * B.eta * B.E) / B.m);
/** Draw force at the nut by virtual work, and the torque at the crank. */
export function drawForce(x) {
  const h = 1e-5;
  const F = (energyAt(x + h) - energyAt(x - h)) / (2 * h);
  return {F, crank: (F * B.rp) / B.ratio};
}
/** Rack (nut) position for crank angle c (radians, from the rest point). */
export const rackAt = (c) => Math.min(X1, X0 + (c / B.ratio) * B.rp);
export const CRANK_FULL = ((X1 - X0) / B.rp) * B.ratio;

/** Ballistic: the low elevation that puts the lance on the target. */
export const AIM = (() => {
  const {d, y} = B.target;
  const hAt = (th) => {
    const vx = V * Math.cos(th);
    const T = d / vx;
    return B.launchY + V * Math.sin(th) * T - 0.5 * B.g * T * T - y;
  };
  let lo = (-10 * Math.PI) / 180;
  let hi = (30 * Math.PI) / 180;
  for (let k = 0; k < 80; k++) {
    const mid = (lo + hi) / 2;
    if (hAt(lo) * hAt(mid) <= 0) hi = mid;
    else lo = mid;
  }
  return (lo + hi) / 2;
})();
export const FLIGHT = B.target.d / (V * Math.cos(AIM));
/** Lance state τ seconds after release: forward distance, height, pitch of the velocity. */
export function lance(tau) {
  const T = Math.min(tau, FLIGHT);
  const vz = V * Math.cos(AIM);
  const vy = V * Math.sin(AIM) - B.g * T;
  return {z: vz * T, y: B.launchY + V * Math.sin(AIM) * T - 0.5 * B.g * T * T, pitch: Math.atan2(vy, vz), hit: tau >= FLIGHT};
}
// the hit: momentum into the target (the lance stays in it), then friction stops it
export const SLIDE_V = (B.m * V * Math.cos(AIM)) / (B.target.M + B.m);
export const SLIDE_T = SLIDE_V / (B.mu * B.g);
export const SLIDE_D = (SLIDE_V * SLIDE_V) / (2 * B.mu * B.g);
export function slide(tau) {
  const T = Math.min(Math.max(0, tau), SLIDE_T);
  return SLIDE_V * T - 0.5 * B.mu * B.g * T * T;
}

export function checks(x) {
  const out = [];
  const p = armAt(x);
  const t = tip(p);
  const L = Math.hypot(t[0], t[1] + x);
  out.push({name: 'the string keeps its length', ok: Math.abs(L - B.l) < 1e-9, value: (L - B.l).toExponential(1)});
  out.push({name: 'the arms sweep further as the nut draws back', ok: armAt(x + 1e-3) > p, value: ((p * 180) / Math.PI).toFixed(2)});
  out.push({name: 'arms stay forward of square (< 80°)', ok: p < (80 * Math.PI) / 180, value: ((p * 180) / Math.PI).toFixed(1)});
  out.push({name: 'rest sweep is φ0', ok: Math.abs(armAt(X0) - B.phi0) < 1e-9, value: ((armAt(X0) * 180) / Math.PI).toFixed(3)});
  out.push({name: 'full draw stores E', ok: Math.abs(energyAt(X1) - B.E) < 1e-6, value: energyAt(X1).toFixed(1)});
  const end = lance(FLIGHT);
  out.push({name: 'the arc lands on the target', ok: Math.abs(end.z - B.target.d) < 1e-6 && Math.abs(end.y - B.target.y) < 1e-6, value: `${end.z.toFixed(3)}, ${end.y.toFixed(3)}`});
  out.push({name: 'momentum: (m + M)·v_slide = m·v_x', ok: Math.abs((B.m + B.target.M) * SLIDE_V - B.m * V * Math.cos(AIM)) < 1e-9, value: SLIDE_V.toFixed(3)});
  out.push({name: 'the slide stops at v²/(2μg)', ok: Math.abs(slide(99) - SLIDE_D) < 1e-9, value: SLIDE_D.toFixed(3)});
  return out;
}
