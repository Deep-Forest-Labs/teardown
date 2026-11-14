// SEER FP-4, the false prophet, model only. Reference: mirror illusions (Pepper's ghost, the mirror drums of optical
// toys): what you see in a plane mirror stands exactly as far behind the glass as the real thing stands in front.
// Four tall mirror panels ride telescoping arms round the prophet and turn slowly; each throws a decoy, the prophet
// reflected across that panel's plane. Only the real one fires. Inputs: arm extension e, turn angle a, time.
// Frame: x, z ground, y up; metres.

export const F = {panels: 4, armMin: 1.2, armMax: 3.2};
const TAU = Math.PI * 2;
/** Panel k: its centre on the ground plane and its outward normal (facing the prophet's side). */
export function panel(k, e, a) {
  const ang = a + (k / F.panels) * TAU;
  const r = F.armMin + (F.armMax - F.armMin) * e;
  const n = [Math.cos(ang), Math.sin(ang)]; // radial: the glass faces in, toward the prophet
  return {c: [n[0] * r, n[1] * r], n, ang, r};
}
/** Reflect a ground point p across panel k's plane. */
export function reflect(p, P) {
  const d = (p[0] - P.c[0]) * P.n[0] + (p[1] - P.c[1]) * P.n[1];
  return [p[0] - 2 * d * P.n[0], p[1] - 2 * d * P.n[1]];
}
/** The real prophet's position (it drifts) and its decoys. */
export function scene(e, a, t) {
  const real = [0.4 * Math.sin(t * 0.5), 0.3 * Math.cos(t * 0.4)];
  const panels = Array.from({length: F.panels}, (_, k) => panel(k, e, a));
  return {real, panels, decoys: panels.map((P) => reflect(real, P))};
}

export function checks(e, a, t) {
  const out = [];
  const S = scene(e, a, t);
  S.panels.forEach((P, k) => {
    const D = S.decoys[k];
    const dReal = (S.real[0] - P.c[0]) * P.n[0] + (S.real[1] - P.c[1]) * P.n[1];
    const dDec = (D[0] - P.c[0]) * P.n[0] + (D[1] - P.c[1]) * P.n[1];
    out.push({name: 'a decoy stands as far behind its glass as the real one stands in front', ok: Math.abs(dReal + dDec) < 1e-12, value: (dReal + dDec).toExponential(1)});
    // the decoy lies on the perpendicular through the real one (no sideways shift)
    const along = (D[0] - S.real[0]) * -P.n[1] + (D[1] - S.real[1]) * P.n[0];
    out.push({name: 'the decoy sits on the mirror’s perpendicular through the real one', ok: Math.abs(along) < 1e-12, value: along.toExponential(1)});
    out.push({name: 'the real prophet is inside the ring of mirrors', ok: dReal < 0, value: dReal.toFixed(3)});
  });
  return out;
}
export {TAU};
