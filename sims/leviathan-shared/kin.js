// LEVIATHAN LV-8: the Altar and its prince as one machine. Pelagos OC-8 (the teardown repo's robotic octopus) is the
// reference, turned over: its underside faces up, so the eight arms lie flat and radial with their wheel rows on
// top, the web between them is a floor of fleshy plates, the mantle is the dome at the centre (six petals over the
// cable core), and the torso is stretched down into the blood sea. Model only, no three.js.
//
// Each arm: a chain of N segments that shrink toward the tip by q, so a constant joint angle curls the tip into a
// true (logarithmic) spiral, as on Pelagos. The web between two neighbouring arms is a stack of trapezoid plates
// hinged to both; with both arms at the same pitch every trapezoid is exactly planar, so the floor never warps.
//
// Input: the stage value s (0 Run, 0→1 Arrival, 1→2 Phase 1, 2→3 Phase 2) and time t.

export const N = 16; // segments per arm
export const WEB = 9; // the inner segments carry the web; the rest are free tentacle
export const ARMS = 8;
export const S = {
  q: 0.89, // shrink per segment
  L0: 3.8, // first segment length (m): the arms are the hero, as on Pelagos
  aspect: 2.6, // segment length / radius
  crownR: 3.9, // the mantle dome's radius; arm roots sit on it
  plateGap: 0.12,
  sea: -9,
  torso: {r: 5.2, bottom: -46},
  petals: 6,
};
export const segL = (i) => S.L0 * S.q ** i;
export const segR = (i) => segL(i) / S.aspect;
const TAU = Math.PI * 2;
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const sm = (x) => {
  const u = clamp01(x);
  return u * u * u * (u * (u * 6 - 15) + 10);
};
export const seg = (s, a, b) => sm((s - a) / (b - a));
export const armAngle = (k) => (k / ARMS) * TAU + Math.PI / ARMS;

/** Joint pitches for arm k at stage s and time t: root tilt (the web), then the free tentacle. */
export function pitches(k, s, t) {
  const arrive = seg(s, 0.1, 0.9);
  const p1 = seg(s, 1, 1.15) * (1 - seg(s, 2, 2.2));
  const p2 = seg(s, 2, 2.6);
  const root = (14 * Math.PI) / 180 * p2; // phase two: the web tilts up into a bowl
  const d = new Array(N).fill(0);
  d[0] = root;
  // the free tentacle: hangs down over the rim (run), rises into an up-curled spiral (arrival on)
  const hang = -0.32;
  const curl = 0.36;
  for (let i = WEB; i < N; i++) d[i] = hang + (curl - hang) * arrive;
  d[WEB] += (-root) * 1; // the tentacle keeps its own line when the web tilts
  // phase one: arms rear in turn (one every 1.5 s, a 3 s cycle each) and slam back down
  if (p1 > 0) {
    const ph = ((t - k * 1.5) % 12 + 12) % 12;
    const rear = ph < 3 ? Math.sin((Math.PI * ph) / 3) : 0;
    d[WEB] += 0.9 * rear * p1;
  }
  // a slow breath along every free joint so the tips never hold dead still
  for (let i = WEB + 1; i < N; i++) d[i] += 0.05 * Math.sin(t * 1.3 + k + i * 0.6) * (0.3 + 0.7 * arrive);
  return d;
}

/** Arm k's joint frames: P (centre), dir (along), up (wheel side), r, L per segment. */
export function arm(k, s, t) {
  const a = armAngle(k);
  const u = [Math.cos(a), 0, Math.sin(a)];
  const d = pitches(k, s, t);
  const out = [];
  let phi = 0;
  const r0 = segR(0);
  let P = [u[0] * S.crownR, 0, u[2] * S.crownR]; // the arm's centreline is the floor line: it rides half proud, a ridge to jump
  for (let i = 0; i < N; i++) {
    phi += d[i];
    const dir = [u[0] * Math.cos(phi), Math.sin(phi), u[2] * Math.cos(phi)];
    const up = [-u[0] * Math.sin(phi), Math.cos(phi), -u[2] * Math.sin(phi)];
    const L = segL(i);
    out.push({i, P, dir, up, L, r: segR(i), phi});
    P = [P[0] + dir[0] * L, P[1] + dir[1] * L, P[2] + dir[2] * L];
  }
  out.push({i: N, P, tip: true});
  return {k, a, u, joints: out};
}

/** The web plates between arm k and k+1: one trapezoid per inner segment, corners on the arms' top edges. */
export function plates(arms) {
  const out = [];
  for (let k = 0; k < ARMS; k++) {
    const A = arms[k];
    const B = arms[(k + 1) % ARMS];
    // side vectors: from each arm's centreline toward the gap
    const side = (X, sgn) => {
      const t = [-X.u[2] * sgn, 0, X.u[0] * sgn];
      return t;
    };
    const sa = side(A, 1);
    const sb = side(B, -1);
    for (let i = 0; i < WEB; i++) {
      // a plate hinges on the arm's flank at the centreline, tucked under its curve; both corners use this segment's
      // own frame, so the plate stays planar
      const corner = (X, sv, j) => {
        const F = X.joints[i];
        const J = X.joints[j];
        const r = segR(Math.min(j, N - 1)); // the arm's radius at that joint: plate edges follow the taper
        return [0, 1, 2].map((c) => J.P[c] + F.up[c] * 0 + sv[c] * (r * 0.8 + S.plateGap));
      };
      out.push({k, i, c: [corner(A, sa, i), corner(B, sb, i), corner(B, sb, i + 1), corner(A, sa, i + 1)]});
    }
  }
  return out;
}

/** The whole machine at stage s, time t. */
export function model(s, t) {
  const arms = Array.from({length: ARMS}, (_, k) => arm(k, s, t));
  const open = seg(s, 2.1, 2.7); // the mantle petals open on the core in phase two
  const eyes = seg(s, 0.7, 1); // optics wake at the end of the arrival
  const core = seg(s, 2.3, 2.9);
  return {s, t, arms, plates: plates(arms), open, eyes, core};
}

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

export function checks(s, t) {
  const M = model(s, t);
  const out = [];
  // links: each segment ends where the next begins, at its own length
  for (const A of M.arms) {
    let e = 0;
    for (let i = 0; i < N; i++) e = Math.max(e, Math.abs(dist(A.joints[i].P, A.joints[i + 1].P) - segL(i)));
    out.push({name: 'arm links exact', ok: e < 1e-9, value: e.toExponential(1)});
  }
  // every web plate is planar (a flat plate can be a rigid part)
  let warp = 0;
  for (const P of M.plates) {
    const [a, b, c, d] = P.c;
    const n = cross(sub(b, a), sub(d, a));
    const ln = Math.hypot(...n) || 1;
    warp = Math.max(warp, Math.abs(dot(sub(c, a), n) / ln));
  }
  out.push({name: 'web plates planar (warp < 1 mm)', ok: warp < 1e-3, value: warp.toExponential(1)});
  // the floor: in the run and phase one every plate is level at y = 0; in phase two it is a bowl no steeper than 35°
  const steep = Math.max(...M.plates.map((P) => {
    const [a, b, , d] = P.c;
    const n = cross(sub(b, a), sub(d, a));
    return (Math.acos(Math.min(1, Math.abs(n[1]) / Math.hypot(...n))) * 180) / Math.PI;
  }));
  if (s < 2) out.push({name: 'floor level before phase two', ok: steep < 0.01, value: steep.toFixed(3)});
  out.push({name: 'floor walkable (≤ 35°)', ok: steep <= 35, value: steep.toFixed(2)});
  // neighbouring plates in a web share their edge: plate i's outer edge is plate i+1's inner edge
  let seam = 0;
  for (const P of M.plates) {
    if (P.i === WEB - 1) continue;
    const Q = M.plates.find((x) => x.k === P.k && x.i === P.i + 1);
    seam = Math.max(seam, dist(P.c[3], Q.c[0]), dist(P.c[2], Q.c[1]));
  }
  out.push({name: 'plates meet edge to edge', ok: seam < 1e-6, value: seam.toExponential(1)});
  // tentacle tips stay out of the floor: every free joint beyond the rim, or above the floor
  const rim = Math.hypot(M.arms[0].joints[WEB].P[0], M.arms[0].joints[WEB].P[2]);
  let worst = Infinity;
  for (const A of M.arms) {
    for (let i = WEB + 1; i <= N; i++) {
      const P = A.joints[i].P;
      const rr = Math.hypot(P[0], P[2]);
      if (rr < rim - 0.5) worst = Math.min(worst, P[1] - segR(Math.min(i, N - 1)));
    }
  }
  out.push({name: 'tentacles never pass through the floor', ok: worst >= -1e-6, value: worst === Infinity ? 'outside rim' : worst.toFixed(3)});
  // no tip drops into the blood sea while it is supposed to be up (arrival on)
  if (s >= 1) {
    const low = Math.min(...M.arms.map((A) => A.joints[N].P[1]));
    out.push({name: 'raised tips stay above the sea', ok: low > S.sea + 1, value: low.toFixed(2)});
  }
  // the run hides the prince: tips hang, petals shut, optics dark
  if (s < 0.05) out.push({name: 'run: nothing of the prince shows', ok: M.open === 0 && M.eyes === 0, value: 'shut'});
  return out;
}
