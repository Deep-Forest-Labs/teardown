// The flying centipede's spine: the head lays a trail of points through the air and every segment sits on that trail
// a fixed arc length behind it, so the body follows the head exactly through loops and coils.
// Each trail sample carries a rotation-minimising frame (double reflection, Wang et al. 2008), nudged toward world up
// so the belly mostly faces down and still rolls as the body turns. Samples are append only: the same head positions
// pushed in the same order give the same body, whether a film pushes them all at load or a live page pushes one a frame.
// No three.js here.

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const norm = (a) => mul(a, 1 / (len(a) || 1));
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const lerp3 = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
export const V = {sub, add, mul, dot, len, norm, cross, lerp3};

const UP = [0, 1, 0];

export function createTrail({minStep = 0.02, upPull = 0.04} = {}) {
  const pos = [];
  const arc = [];
  const tan = [];
  const ups = [];
  const push = (p) => {
    const k = pos.length;
    if (k === 0) {
      pos.push(p);
      arc.push(0);
      tan.push([0, 0, 1]);
      ups.push(UP);
      return;
    }
    const d = len(sub(p, pos[k - 1]));
    if (d < minStep) return;
    const T = norm(sub(p, pos[k - 1]));
    // double reflection carries the previous up vector along the step without twisting it
    const v1 = sub(p, pos[k - 1]);
    const c1 = dot(v1, v1);
    const r0 = ups[k - 1];
    const t0 = tan[k - 1];
    const rL = sub(r0, mul(v1, (2 / c1) * dot(v1, r0)));
    const tL = sub(t0, mul(v1, (2 / c1) * dot(v1, t0)));
    const v2 = sub(T, tL);
    const c2 = dot(v2, v2);
    let r = c2 > 1e-12 ? sub(rL, mul(v2, (2 / c2) * dot(v2, rL))) : rL;
    // a gentle pull toward world up, kept perpendicular to the tangent
    const want = norm(sub(UP, mul(T, dot(UP, T))));
    r = norm(add(r, mul(want, upPull)));
    r = norm(sub(r, mul(T, dot(r, T))));
    if (k === 1) tan[0] = T;
    pos.push(p);
    arc.push(arc[k - 1] + d);
    tan.push(T);
    ups.push(r);
  };
  /** Frame at arc length a (clamped to the trail): {p, t (forward), u (up), s (left)}. */
  const at = (a) => {
    const n = pos.length;
    if (n < 2) return {p: pos[0] || [0, 0, 0], t: [0, 0, 1], u: UP, s: [1, 0, 0]};
    if (a <= 0) return frameAt(0, 0);
    if (a >= arc[n - 1]) return frameAt(n - 2, 1);
    let lo = 0;
    let hi = n - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (arc[mid] <= a) lo = mid;
      else hi = mid;
    }
    return frameAt(lo, (a - arc[lo]) / (arc[lo + 1] - arc[lo]));
  };
  const frameAt = (k, f) => {
    const p = lerp3(pos[k], pos[k + 1], f);
    const t = norm(lerp3(tan[k], tan[k + 1], f));
    let u = norm(lerp3(ups[k], ups[k + 1], f));
    u = norm(sub(u, mul(t, dot(u, t))));
    return {p, t, u, s: cross(u, t)};
  };
  return {
    push,
    at,
    get length() {
      return arc.length ? arc[arc.length - 1] : 0;
    },
  };
}

/** Rotate frame f about its forward axis by angle r (radians): the body roll. */
export function roll(f, r) {
  const c = Math.cos(r);
  const s = Math.sin(r);
  const u = add(mul(f.u, c), mul(f.s, s));
  const sd = add(mul(f.s, c), mul(f.u, -s));
  return {p: f.p, t: f.t, u, s: sd};
}
