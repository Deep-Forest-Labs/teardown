// SWEEPER DV-2, the diver, model only. Reference: the F-14's variable-sweep wing (20° to 68° of sweep), each wing on
// a glove pivot, swung by a screw-jack actuator between a fuselage anchor and a horn on the wing root. It marks the
// player with a beam from altitude, sweeps back and dives along a curve through the mark, then pulls out.
// Input: time t. Frame: x right, y up, z forward (fuselage nose +z in its own frame); metres.

export const D = {
  pivotX: 0.42, // glove pivot, each side
  pivotZ: 0.25,
  horn: 0.32, // wing-root horn the jack pulls, behind the pivot
  anchor: [0.16, 0, -0.55], // jack anchor in the fuselage (each side mirrored)
  sweep: [20, 68], // degrees (the F-14's range)
  wing: {span: 2.3, root: 0.9, tip: 0.35},
  cruiseY: 16,
  target: [0, 1.0, 22],
};
const TAU = Math.PI * 2;
const rad = (d) => (d * Math.PI) / 180;
const sm = (x) => {
  const u = Math.min(1, Math.max(0, x));
  return u * u * (3 - 2 * u);
};
// script: circle and mark (0-8), sweep and dive (8-11), pull out (11-14)
export const SCRIPT = {mark: [0, 8], dive: [8, 10.6], pull: [10.6, 14]};

/** Sweep angle (deg) at time t: spread while marking, back for the dive, spreading again in the pull-out. */
export const sweepAt = (t) => D.sweep[0] + (D.sweep[1] - D.sweep[0]) * Math.min(sm((t - 7.2) / 0.8), 1 - sm((t - 10.9) / 1.4));

/** The wing's pivot frame for one side at sweep s: the horn point, the jack's two ends and its length. */
export function wingJack(sx, s) {
  const a = rad(s);
  const pivot = [sx * D.pivotX, 0, D.pivotZ];
  // the horn sits behind the pivot on the wing root, turning with the sweep
  const horn = [pivot[0] - sx * D.horn * Math.sin(a) * 0.4, 0, pivot[2] - D.horn * Math.cos(a)];
  const anchor = [sx * D.anchor[0], D.anchor[1], D.anchor[2]];
  return {pivot, horn, anchor, len: Math.hypot(horn[0] - anchor[0], horn[2] - anchor[2]), a};
}

/** Flight path: a circle at altitude round the target while marking, then a dive curve through the mark. */
export function pathAt(t) {
  const T = D.target;
  const R = 9;
  const [m0, m1] = SCRIPT.mark;
  if (t < m1) {
    const ang = 0.5 * t;
    return [T[0] + R * Math.sin(ang), D.cruiseY, T[2] - R * Math.cos(ang)];
  }
  const ang = 0.5 * m1;
  const P0 = [T[0] + R * Math.sin(ang), D.cruiseY, T[2] - R * Math.cos(ang)];
  const tan0 = [Math.cos(ang) * 0.5 * R, 0, Math.sin(ang) * 0.5 * R]; // velocity on the circle
  const [d0, d1] = SCRIPT.dive;
  const [p0, p1] = SCRIPT.pull;
  // dive: a cubic from P0 (leaving the circle tangent) to the mark, arriving fast and steep
  const B = [T[0], T[1] + 1.2, T[2]]; // the bottom of the dive passes 1.2 m over the mark
  const away = [Math.cos(ang), 0, Math.sin(ang)];
  const bez = (a, b, c, d, u) => [0, 1, 2].map((k) => (1 - u) ** 3 * a[k] + 3 * (1 - u) ** 2 * u * b[k] + 3 * (1 - u) * u * u * c[k] + u ** 3 * d[k]);
  const C1 = [P0[0] + tan0[0] * 0.6, P0[1] + 2, P0[2] + tan0[2] * 0.6];
  const C2 = [B[0] - away[0] * 6, B[1], B[2] - away[2] * 6]; // arrives level: it swoops through the mark
  if (t < d1) return bez(P0, C1, C2, B, (t - d0) / (d1 - d0));
  // pull-out: from the bottom, along away, climbing back
  const u = (t - p0) / (p1 - p0);
  // leaves along the same line at the same speed: the handle scales with the two segments' durations
  const k = (p1 - p0) / (d1 - d0);
  const C3 = [B[0] + away[0] * 6 * k, B[1], B[2] + away[2] * 6 * k];
  const E = [B[0] + away[0] * 22, D.cruiseY * 0.8, B[2] + away[2] * 22];
  const C4 = [E[0] - away[0] * 8, E[1] - 5, E[2] - away[2] * 8];
  return bez(B, C3, C4, E, Math.min(1, u));
}

export function checks(t) {
  const out = [];
  const s = sweepAt(t);
  out.push({name: 'sweep within the F-14 range (20–68°)', ok: s >= 20 - 1e-9 && s <= 68 + 1e-9, value: s.toFixed(2)});
  // the jack: its length range over the whole sweep is a real screw jack's (extended ≤ 1.8× retracted)
  let lo = Infinity;
  let hi = 0;
  for (let k = 0; k <= 48; k++) {
    const L = wingJack(1, 20 + k).len;
    lo = Math.min(lo, L);
    hi = Math.max(hi, L);
  }
  out.push({name: 'jack stroke is buildable (max ≤ 1.8× min)', ok: hi / lo <= 1.8, value: (hi / lo).toFixed(2)});
  // path continuity (position and heading) and the dive passes over the mark
  const e = 1e-3;
  const a = pathAt(t - e);
  const b = pathAt(t);
  const c = pathAt(t + e);
  const v1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]].map((x) => x / e);
  const v2 = [c[0] - b[0], c[1] - b[1], c[2] - b[2]].map((x) => x / e);
  const jump = Math.hypot(...[0, 1, 2].map((k) => v2[k] - v1[k]));
  out.push({name: 'no kink in the flight path', ok: jump < 2.5, value: jump.toFixed(3)});
  out.push({name: 'never below 0.8 m', ok: b[1] >= 0.8, value: b[1].toFixed(2)});
  if (Math.abs(t - SCRIPT.dive[1]) < 1e-9) {
    const T = D.target;
    out.push({name: 'the dive passes 1.2 m over the mark', ok: Math.hypot(b[0] - T[0], b[1] - (T[1] + 1.2), b[2] - T[2]) < 1e-9, value: '-'});
  }
  return out;
}
