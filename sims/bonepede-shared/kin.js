// Bone centipede: every pose is a pure function of s, the distance the head has crawled along its path, plus a few
// shaping values (rear, lunge). No three.js here. Units are metres.
//
// The body follows a path that is integrated once from a curvature schedule kappa(u) (u = arc length), so the
// segments trail the head exactly. Each segment carries a pair of three-bone legs. A leg's step cycle is
// c = u_i / stride + i * lag (+ 0.5 on the right side): the foot is planted on a fixed ground point for the stance
// part of the cycle and swings to the next ground point for the rest, so a planted foot cannot slip. The knee comes
// from closed-form two-bone IK (the circle-intersection idea in jansen.js).

export const CFG = {
  N: 16, // trunk segments, one leg pair each
  spacing: 0.34, // arc length between segments
  hipH: 0.46, // hip height above the floor
  halfW: 0.34, // half the body width at the front
  taper: 0.55, // width of the last segment as a fraction of the first
  coxa: 0.16,
  femur: 0.5,
  tibia: 0.66,
  reach: 1.12, // foot distance from the centreline at the front
  stride: 0.62,
  beta: 0.62, // stance fraction of the cycle
  lag: 0.135, // phase lag per segment: the step wave runs from tail to head
  lift: 0.3,
  sway: 0.07, // sideways wiggle of the centreline
  swayLen: 2.6,
  rearK: 5, // segments that lift when it rears
  rearPitch: 1.05, // radians at the front link when fully reared
  headAhead: 0.36,
};

export const widthAt = (i) => 1 - (1 - CFG.taper) * (i / (CFG.N - 1));

// ------------------------------------------------------------ the path
/**
 * kappa(u) in 1/m. The table grows on demand (append only), so the same kappa gives the same path whatever order it
 * is asked in. The live page changes kappa only ahead of the head, which keeps the tail on the path already laid.
 */
export function createPath(kappa, du = 0.01) {
  const xs = [0];
  const zs = [0];
  const hs = [0];
  let built = 0; // index of the last sample
  const ensure = (u) => {
    const need = Math.ceil(u / du) + 2;
    while (built < need) {
      const h = hs[built];
      const k = kappa(built * du);
      const hm = h + 0.5 * k * du;
      xs.push(xs[built] + Math.sin(hm) * du);
      zs.push(zs[built] + Math.cos(hm) * du);
      hs.push(h + k * du);
      built++;
    }
  };
  /** {x, z, h}: position and heading (0 = +z) at arc length u. */
  const at = (u) => {
    if (u <= 0) return {x: 0, z: u, h: 0}; // straight run-in behind the start
    ensure(u);
    const k = u / du;
    const n = Math.floor(k);
    const f = k - n;
    return {
      x: xs[n] + (xs[n + 1] - xs[n]) * f,
      z: zs[n] + (zs[n + 1] - zs[n]) * f,
      h: hs[n] + (hs[n + 1] - hs[n]) * f,
    };
  };
  return {at};
}

// ------------------------------------------------------------ small vector helpers (plain arrays)
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const norm = (a) => mul(a, 1 / (len(a) || 1));
const lerp3 = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
const smooth = (x) => {
  const k = Math.min(1, Math.max(0, x));
  return k * k * (3 - 2 * k);
};

/**
 * Two-bone IK, closed form. Root C, target F, bone lengths a and b, pole = the direction the knee bends toward.
 * Returns the knee; F is clamped onto the reachable shell, so the result always has exact bone lengths.
 */
export function twoBone(C, F, a, b, pole) {
  const d0 = sub(F, C);
  const D = Math.min(Math.max(len(d0), Math.abs(a - b) + 1e-4), a + b - 1e-4);
  const dir = norm(d0);
  const along = (a * a - b * b + D * D) / (2 * D);
  const h = Math.sqrt(Math.max(0, a * a - along * along));
  const p = norm(sub(pole, mul(dir, dot(pole, dir))));
  const knee = add(add(C, mul(dir, along)), mul(p, h));
  const foot = add(C, mul(dir, D));
  return {knee, foot};
}

// ------------------------------------------------------------ the pose
/** Centreline point (with sway) and its left normal at arc length u. */
function centre(path, u) {
  const p = path.at(u);
  const nx = Math.cos(p.h);
  const nz = -Math.sin(p.h);
  const sw = CFG.sway * Math.sin((2 * Math.PI * u) / CFG.swayLen);
  return {x: p.x + nx * sw, z: p.z + nz * sw, nx, nz, h: p.h};
}

/** Where leg (i, side) plants for step n: a ground point beside the path, ahead of the hip at touchdown. */
function plant(path, i, side, n, off) {
  const a = (n - i * CFG.lag - off) * CFG.stride + CFG.beta * CFG.stride * 0.5;
  const c = centre(path, a);
  const r = CFG.reach * widthAt(i) * side;
  return [c.x + c.nx * r, 0, c.z + c.nz * r];
}

/**
 * The whole body for one instant.
 * s: arc length of the head. ops.rear 0..1 lifts the front segments, ops.lunge 0..1 throws the head forward,
 * ops.fangs 0..1 opens the forcipules.
 */
export function pose(path, s, ops = {}) {
  const rear = ops.rear ?? 0;
  const lunge = ops.lunge ?? 0;
  const segs = [];
  for (let i = 0; i < CFG.N; i++) {
    const u = s - i * CFG.spacing;
    const c = centre(path, u);
    const w = widthAt(i);
    const rk = Math.max(0, 1 - i / CFG.rearK);
    segs.push({i, u, w, pos: [c.x, CFG.hipH * (0.8 + 0.2 * w), c.z], n: [c.nx, 0, c.nz], h: c.h, rk});
  }
  // rear and lunge pitch the front segments up (or forward and down) around the segment behind them, one link at a
  // time from the back, so the spacing between plates never stretches. The lunge also lengthens each link a little.
  const K = CFG.rearK;
  for (let i = K - 1; i >= 0; i--) {
    const back = segs[i + 1].pos;
    const hz = [segs[i].pos[0] - segs[i + 1].pos[0], 0, segs[i].pos[2] - segs[i + 1].pos[2]];
    const dh = norm(hz);
    const ramp = (K - i) / K;
    const pitch = (rear * CFG.rearPitch - lunge * 0.3) * ramp;
    const L = CFG.spacing * (1 + 0.12 * lunge);
    segs[i].pos = add(back, add(mul(dh, L * Math.cos(pitch)), [0, L * Math.sin(pitch), 0]));
    segs[i].pos[1] = Math.max(segs[i].pos[1], 0.24); // a lunge from the ground scrapes along it, never through it
  }
  // forward axis of each segment from its neighbours (includes the pitch when it rears)
  for (let i = 0; i < CFG.N; i++) {
    const a = segs[Math.max(0, i - 1)].pos;
    const b = segs[Math.min(CFG.N - 1, i + 1)].pos;
    segs[i].fwd = norm(sub(a, b));
  }
  // legs
  const legs = [];
  let planted = 0;
  for (const sg of segs) {
    for (const side of [1, -1]) {
      const off = side > 0 ? 0 : 0.5;
      const cyc = sg.u / CFG.stride + sg.i * CFG.lag + off;
      const n = Math.floor(cyc);
      const f = cyc - n;
      const F0 = plant(path, sg.i, side, n, off);
      let foot;
      let stance = f < CFG.beta;
      if (stance) foot = F0;
      else {
        const k = (f - CFG.beta) / (1 - CFG.beta);
        const F1 = plant(path, sg.i, side, n + 1, off);
        foot = lerp3(F0, F1, smooth(k));
        foot[1] = CFG.lift * Math.sin(Math.PI * k);
      }
      // reared segments let their legs hang and reach forward, like a strike pose
      const hang = Math.max(rear, lunge) * sg.rk;
      if (hang > 0) {
        const out = mul(sg.n, side * CFG.reach * sg.w * 0.75);
        const hangFoot = add(add(sg.pos, out), add(mul(sg.fwd, 0.35), [0, -0.35, 0]));
        foot = lerp3(foot, hangFoot, Math.min(1, hang * 1.4));
        if (hang > 0.3) stance = false;
      }
      if (stance) planted++;
      const hip = add(sg.pos, mul(sg.n, side * CFG.halfW * sg.w));
      const coxaEnd = add(add(hip, mul(sg.n, side * CFG.coxa)), [0, 0.04, 0]);
      const s2 = 0.8 + 0.2 * sg.w; // back legs are a little shorter
      // knee bends out and up, slightly backward: a low splayed leg, not a crab arch over the back
      const pole = add(add(mul(sg.n, side * 0.9), [0, 0.55, 0]), mul(sg.fwd, -0.3));
      const {knee, foot: tip} = twoBone(coxaEnd, foot, CFG.femur * s2, CFG.tibia * s2, pole);
      legs.push({seg: sg.i, side, hip, coxaEnd, knee, foot: tip, stance, plant: F0, cyc});
    }
  }
  // head: ahead of segment 0, along its forward axis, thrown forward by the lunge
  const s0 = segs[0];
  const head = add(add(s0.pos, mul(s0.fwd, CFG.headAhead + lunge * 0.12)), [0, rear * 0.12 - lunge * 0.1, 0]);
  head[1] = Math.max(head[1], 0.28);
  return {segs, legs, head: {pos: head, fwd: s0.fwd, n: s0.n, fangs: ops.fangs ?? 0}, planted};
}
