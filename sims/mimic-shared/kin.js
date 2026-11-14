// FALSE ORB MM-1, the mimic, model only. Reference: the crank-rocker four-bar (Grashof: shortest + longest ≤ the other
// two, the shortest link the crank, so the crank turns fully while the rocker swings back and forth). The rocker is
// the upper shell's hinge: one crank turn opens the jaw and snaps it shut. Closed, the two hemispheres make a glowing
// orb. Four folded legs spring out for the lunge. Inputs: crank angle θ, time. Frame: x right, y up, z forward; metres.

export const M = {R: 0.32, a: 0.05, b: 0.2, c: 0.11, g: 0.18}; // crank, coupler, rocker, ground (m)
function cc(p, rp, q, rq, sgn) {
  const dx = q[0] - p[0];
  const dy = q[1] - p[1];
  const d = Math.hypot(dx, dy);
  const x = (rp * rp - rq * rq + d * d) / (2 * d);
  const h2 = rp * rp - x * x;
  if (h2 < 0) return null;
  const h = Math.sqrt(h2);
  return [p[0] + (dx / d) * x - sgn * (dy / d) * h, p[1] + (dy / d) * x + sgn * (dx / d) * h];
}
// in the side plane (z forward, y up): crank pivot O at the back of the lower shell, rocker pivot H (the hinge) behind
const O = [-0.06, -0.02];
const H = [O[0] - M.g, O[1]];
/** Rocker (jaw) angle for crank angle θ. */
export function rocker(theta) {
  const A = [O[0] + M.a * Math.cos(theta), O[1] + M.a * Math.sin(theta)];
  const Bp = cc(A, M.b, H, M.c, 1);
  if (!Bp) return null;
  return {A, B: Bp, ang: Math.atan2(Bp[1] - H[1], Bp[0] - H[0])};
}
// the rocker's range over a turn sets the jaw: closed at its minimum
const RANGE = (() => {
  let lo = Infinity;
  let hi = -Infinity;
  let thLo = 0;
  for (let k = 0; k < 7200; k++) {
    const r = rocker((k / 7200) * Math.PI * 2);
    if (!r) continue;
    if (r.ang < lo) {
      lo = r.ang;
      thLo = (k / 7200) * Math.PI * 2;
    }
    hi = Math.max(hi, r.ang);
  }
  return {lo, hi, thLo};
})();
export const CLOSED_THETA = RANGE.thLo;
export const jawAt = (theta) => {
  const r = rocker(theta);
  return r ? r.ang - RANGE.lo : 0; // 0 shut
};
export const JAW_MAX = RANGE.hi - RANGE.lo;
export {O, H};

export function checks(theta) {
  const out = [];
  const L = [M.a, M.b, M.c, M.g].sort((x, y) => x - y);
  out.push({name: 'Grashof: shortest + longest ≤ the other two', ok: L[0] + L[3] <= L[1] + L[2], value: `${(L[0] + L[3]).toFixed(3)} ≤ ${(L[1] + L[2]).toFixed(3)}`});
  out.push({name: 'the crank is the shortest link (a crank-rocker)', ok: M.a === L[0], value: M.a});
  const r = rocker(theta);
  out.push({name: 'the loop closes at every crank angle', ok: !!r, value: r ? 'ok' : 'none'});
  if (r) {
    const d = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);
    out.push({name: 'coupler and rocker exact', ok: Math.abs(d(r.A, r.B) - M.b) < 1e-12 && Math.abs(d(r.B, H) - M.c) < 1e-12, value: '-'});
  }
  out.push({name: 'the jaw opens 50–90° over a turn', ok: JAW_MAX >= (50 * Math.PI) / 180 && JAW_MAX <= (90 * Math.PI) / 180, value: ((JAW_MAX * 180) / Math.PI).toFixed(1)});
  return out;
}
