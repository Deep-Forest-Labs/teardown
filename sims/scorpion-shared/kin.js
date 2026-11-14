// STINGER SC-1, the scorpion, model only. Reference: the teardown repo's Telson SC-8 robotic scorpion (overlapping
// carapace plates, servo drums at every joint with the drum axis on the joint axis, spiked feet, chelae with a
// movable finger, a six-housing tail curling to the telson bulb and stinger). Flesh plates over machined joints.
// Inputs: walk distance w (m), claw opening cl/cr (0..1), tail strike k (0 cocked .. 1 struck), time t.
// Frame: x right, y up, z forward; metres. The body walks along +z.

export const B = {
  bodyY: 0.72, // carapace centreline height: low, so the legs arch high over it
  hips: [0.5, 0.18, -0.14, -0.46], // leg rows along the body
  hipX: 0.36,
  femur: 0.78,
  tibia: 0.82,
  tarsus: 0.3,
  footR: [1.35, 1.5, 1.5, 1.35], // foot circle radius from the hip, per row: splayed wide like Telson
  footZ: [0.55, 0.15, -0.2, -0.55], // foot forward offset from the hip
  stride: 0.42,
  lift: 0.16,
  tail: {base: [0, 1.0, -0.78], links: [0.36, 0.34, 0.32, 0.3, 0.28, 0.26], bulb: 0.22, blade: 0.36},
  arm: {shoulderX: 0.3, shoulderZ: 0.72, upper: 0.55, fore: 0.5},
  chela: {len: 0.42, finger: 0.36},
};
const TAU = Math.PI * 2;
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const sm = (x) => {
  const u = clamp01(x);
  return u * u * (3 - 2 * u);
};

/** Circle-circle intersection (2D), branch sgn. */
export function cc(a, ra, b, rb, sgn) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const d = Math.hypot(dx, dy);
  const x = (ra * ra - rb * rb + d * d) / (2 * d);
  const h2 = ra * ra - x * x;
  if (h2 < 0) return null;
  const h = Math.sqrt(h2);
  return [a[0] + (dx / d) * x - sgn * (dy / d) * h, a[1] + (dy / d) * x + sgn * (dx / d) * h];
}

// gait: alternating tetrapod (legs L1 R2 L3 R4 together); each foot: stance 70% of the cycle, swing 30%
const DUTY = 0.7;
const phaseOf = (row, sx) => (((row + (sx > 0 ? 1 : 0)) % 2) * 0.5 + row * 0.04) % 1;

/** Where the foot of (row, side) is in the world after walking w: planted feet stay put (no slip). */
export function footAt(row, sx, w) {
  const cyc = w / B.stride + phaseOf(row, sx);
  const n = Math.floor(cyc);
  const u = cyc - n;
  const home = [sx * (B.hipX + B.footR[row] * 0.82), 0, B.hips[row] + B.footZ[row] * 0.55];
  // in stance the foot holds the world spot it landed on: landed at the start of cycle n at body travel (n - phase)·stride
  const landZ = (n - phaseOf(row, sx)) * B.stride + B.stride * DUTY * 0.5;
  if (u < DUTY) return {p: [home[0], 0, home[2] + landZ], stance: true};
  // swing: from the lift-off spot to the next landing, an arc
  const s = (u - DUTY) / (1 - DUTY);
  const z0 = landZ;
  const z1 = landZ + B.stride;
  return {p: [home[0], B.lift * Math.sin(Math.PI * s), home[2] + z0 + (z1 - z0) * sm(s)], stance: false};
}

export function pose(w, cl, cr, k, t) {
  const body = [0, B.bodyY + 0.025 * Math.sin((w / B.stride) * TAU * 2), w];
  const legs = [];
  for (let row = 0; row < 4; row++) {
    for (const sx of [-1, 1]) {
      const hip = [sx * B.hipX, body[1] - 0.05, body[2] + B.hips[row]];
      const F = footAt(row, sx, w);
      const foot = F.p;
      // the tarsus drops near-vertically onto the foot, angled out a little
      const out = Math.atan2(foot[0] - hip[0], foot[2] - hip[2]);
      const ankle = [foot[0] - Math.sin(out) * 0.08, foot[1] + B.tarsus, foot[2] - Math.cos(out) * 0.08];
      // hip → knee → ankle in the vertical plane through hip and ankle; the knee rises above both (arachnid)
      const hx = Math.hypot(ankle[0] - hip[0], ankle[2] - hip[2]);
      const k2 = cc([0, 0], B.femur, [hx, ankle[1] - hip[1]], B.tibia, 1);
      const dir = [(ankle[0] - hip[0]) / hx, (ankle[2] - hip[2]) / hx];
      const knee = k2 ? [hip[0] + dir[0] * k2[0], hip[1] + k2[1], hip[2] + dir[1] * k2[0]] : null;
      legs.push({row, sx, hip, knee, ankle, foot, stance: F.stance, yaw: Math.atan2(dir[0], dir[1])});
    }
  }
  // tail: joint pitches; cocked = a high C over the back, struck = whipped forward over the head
  const T = B.tail;
  const cocked = [0.55, 0.62, 0.66, 0.62, 0.55, 0.5];
  const struck = [1.7, 0.35, 0.28, 0.22, 0.18, 0.12]; // the first joint throws the tail up, the rest roll it forward
  const sway = 0.04 * Math.sin(t * 1.6);
  const tail = [];
  let P = [body[0], body[1] + T.base[1] - B.bodyY, body[2] + T.base[2]];
  let phi = 0; // pitch from straight back (-z), positive curls up and over toward +z
  for (let i = 0; i < T.links.length; i++) {
    phi += cocked[i] + (struck[i] - cocked[i]) * k + (i === 0 ? sway : 0);
    const d = [0, Math.sin(phi), -Math.cos(phi)];
    const Q = [P[0] + d[1] * 0, P[1] + d[1] * T.links[i], P[2] + d[2] * T.links[i]];
    tail.push({a: P, b: Q, phi, L: T.links[i]});
    P = Q;
  }
  const phiBulb = phi + 0.5 + 0.6 * k;
  const db = [0, Math.sin(phiBulb), -Math.cos(phiBulb)];
  const bulb = [P[0], P[1] + db[1] * T.bulb, P[2] + db[2] * T.bulb];
  const phiBlade = phiBulb + 0.9;
  const tipDir = [0, Math.sin(phiBlade), -Math.cos(phiBlade)];
  const tip = [bulb[0], bulb[1] + tipDir[1] * T.blade, bulb[2] + tipDir[2] * T.blade];
  // arms and chelae: shoulder at the front corners, chela held forward and low; two-bone with the elbow out
  const arms = [-1, 1].map((sx) => {
    const sh = [sx * B.arm.shoulderX, body[1], body[2] + B.arm.shoulderZ];
    const target = [sx * 0.55, body[1] - 0.25 + 0.05 * Math.sin(t * 1.1 + sx), body[2] + 1.55];
    // two-bone in the plane through shoulder, wrist and a pole out to the side and up: lengths stay exact
    const d = [target[0] - sh[0], target[1] - sh[1], target[2] - sh[2]];
    const dl = Math.hypot(...d);
    const u = d.map((x) => x / dl);
    const pole = [sx, 0.45, 0];
    const pd = pole[0] * u[0] + pole[1] * u[1] + pole[2] * u[2];
    let v = [pole[0] - pd * u[0], pole[1] - pd * u[1], pole[2] - pd * u[2]];
    const vl = Math.hypot(...v);
    v = v.map((x) => x / vl);
    const U = B.arm.upper;
    const Fo = B.arm.fore;
    const a = (U * U - Fo * Fo + dl * dl) / (2 * dl);
    const h2 = U * U - a * a;
    const elbow = h2 >= 0 ? [0, 1, 2].map((c) => sh[c] + u[c] * a + v[c] * Math.sqrt(h2)) : null;
    const open = sx < 0 ? cl : cr;
    return {sx, sh, elbow, wrist: target, open};
  });
  return {w, body, legs, tail, bulb, tip, arms, k};
}

const d3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

export function checks(w, cl, cr, k, t) {
  const P = pose(w, cl, cr, k, t);
  const out = [];
  for (const L of P.legs) {
    out.push({name: 'legs reach their feet', ok: !!L.knee, value: L.knee ? 'ok' : 'none'});
    if (!L.knee) continue;
    out.push({name: 'leg links exact', ok: Math.abs(d3(L.hip, L.knee) - B.femur) < 1e-9 && Math.abs(d3(L.knee, L.ankle) - B.tibia) < 1e-9, value: '-'});
    out.push({name: 'knees well above the hip (arachnid stance)', ok: L.knee[1] > L.hip[1] + 0.2, value: (L.knee[1] - L.hip[1]).toFixed(3)});
    out.push({name: 'feet on or above the ground', ok: L.foot[1] >= -1e-9, value: L.foot[1].toFixed(3)});
  }
  // planted feet do not slip: a stance foot is in the same world spot a moment later
  for (const L of P.legs) {
    if (!L.stance) continue;
    const later = footAt(L.row, L.sx, w + 0.01);
    if (later.stance) out.push({name: 'planted feet never slide', ok: d3(later.p, L.foot) < 1e-9, value: d3(later.p, L.foot).toExponential(1)});
  }
  // at least four feet down at any moment (stable)
  out.push({name: 'at least four feet down', ok: P.legs.filter((L) => L.stance).length >= 4, value: P.legs.filter((L) => L.stance).length});
  // tail: links exact, every joint above the carapace top, the stinger ends in front of the head when struck
  let e = 0;
  for (const s of P.tail) e = Math.max(e, Math.abs(d3(s.a, s.b) - s.L));
  out.push({name: 'tail links exact', ok: e < 1e-9, value: e.toExponential(1)});
  const top = P.body[1] + 0.2;
  out.push({name: 'tail stays above the back', ok: P.tail.slice(1).every((s) => s.a[1] > top) && P.bulb[1] > top, value: Math.min(...P.tail.slice(1).map((s) => s.a[1])).toFixed(2)});
  if (k > 0.999) out.push({name: 'struck stinger comes down over the front half, pointing down', ok: P.tip[2] > P.body[2] + 0.1 && P.tip[1] < P.bulb[1] && P.tip[1] > 0.3, value: `${(P.tip[2] - P.body[2]).toFixed(2)} ahead, ${P.tip[1].toFixed(2)} up`});
  for (const A of P.arms) {
    out.push({name: 'arms reach their chelae', ok: !!A.elbow, value: A.elbow ? 'ok' : 'none'});
    if (A.elbow) out.push({name: 'arm links exact', ok: Math.abs(d3(A.sh, A.elbow) - B.arm.upper) < 1e-9 && Math.abs(d3(A.elbow, A.wrist) - B.arm.fore) < 1e-9, value: '-'});
    if (A.elbow) out.push({name: 'elbows bend outward', ok: A.sx * (A.elbow[0] - (A.sh[0] + A.wrist[0]) / 2) > 0.05, value: (A.elbow[0]).toFixed(2)});
  }
  return out;
}
