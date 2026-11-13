// Draw a stage from its model. A stage's kin file returns plain numbers each frame (no three.js): tubes between
// two solved points, slabs with a position, an up axis and a forward axis, and spheres. This file turns them into
// instanced meshes, the way the teardown Strandbeest draws every link between the two joints its solver found, so
// parts meet exactly where the model says they meet. Static pieces (floors that never move) are built once by the
// stage itself.
//   tubes:   {k: material key, a: [x,y,z], b: [x,y,z], r, round?}    a box (or a cylinder when round) from a to b
//   slabs:   {k, p: [x,y,z], up: [x,y,z], fwd: [x,y,z], s: [w,h,d]}   a box centred on p
//   balls:   {k, p, r}
import * as THREE from 'three';

const UP = new THREE.Vector3(0, 1, 0);

export function createRig(group, materials, capacity = 1024) {
  const geo = {tube: new THREE.BoxGeometry(1, 1, 1), round: new THREE.CylinderGeometry(0.5, 0.5, 1, 10), slab: new THREE.BoxGeometry(1, 1, 1), ball: new THREE.IcosahedronGeometry(1, 1)};
  const pools = {};
  const pool = (kind, k) => {
    const key = `${kind}:${k}`;
    if (!pools[key]) {
      const m = new THREE.InstancedMesh(geo[kind], materials[k], capacity);
      m.castShadow = true;
      m.receiveShadow = true;
      m.frustumCulled = false;
      m.count = 0;
      m.userData.rigKey = k;
      group.add(m);
      pools[key] = {m, n: 0};
    }
    return pools[key];
  };
  const M = new THREE.Matrix4();
  const Q = new THREE.Quaternion();
  const A = new THREE.Vector3();
  const B = new THREE.Vector3();
  const S = new THREE.Vector3();
  const X = new THREE.Vector3();
  const Y = new THREE.Vector3();
  const Z = new THREE.Vector3();
  return {
    pools,
    /** Draw one frame of the model. */
    draw(model) {
      for (const p of Object.values(pools)) p.n = 0;
      for (const t of model.tubes || []) {
        A.set(...t.a);
        B.set(...t.b);
        const d = B.clone().sub(A);
        const L = d.length();
        Q.setFromUnitVectors(UP, d.multiplyScalar(1 / (L || 1)));
        M.compose(A.add(B).multiplyScalar(0.5), Q, S.set(t.r * 2, L, t.r * 2));
        const p = pool(t.round ? 'round' : 'tube', t.k);
        p.m.setMatrixAt(p.n++, M);
      }
      for (const s of model.slabs || []) {
        Y.set(...s.up).normalize();
        Z.set(...s.fwd);
        Z.addScaledVector(Y, -Z.dot(Y)).normalize();
        X.crossVectors(Y, Z);
        M.makeBasis(X.multiplyScalar(s.s[0]), Y.multiplyScalar(s.s[1]), Z.multiplyScalar(s.s[2]));
        M.setPosition(...s.p);
        const p = pool('slab', s.k);
        p.m.setMatrixAt(p.n++, M);
      }
      for (const b of model.balls || []) {
        M.makeScale(b.r, b.r, b.r).setPosition(...b.p);
        const p = pool('ball', b.k);
        p.m.setMatrixAt(p.n++, M);
      }
      for (const p of Object.values(pools)) {
        p.m.count = p.n;
        p.m.instanceMatrix.needsUpdate = true;
        p.m.computeBoundingSphere();
      }
    },
  };
}

// ------------------------------------------------------------ small vector helpers for kin files (plain arrays)
export const v = {
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  mul: (a, k) => [a[0] * k, a[1] * k, a[2] * k],
  len: (a) => Math.hypot(a[0], a[1], a[2]),
  dist: (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]),
  norm: (a) => {
    const l = Math.hypot(a[0], a[1], a[2]) || 1;
    return [a[0] / l, a[1] / l, a[2] / l];
  },
  lerp: (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k],
  rotY: (a, ang) => [a[0] * Math.cos(ang) + a[2] * Math.sin(ang), a[1], -a[0] * Math.sin(ang) + a[2] * Math.cos(ang)],
};
export const clamp01 = (x) => Math.min(1, Math.max(0, x));
export const smooth = (x) => {
  const k = clamp01(x);
  return k * k * (3 - 2 * k);
};
/** 0..1 as s runs from a to b, smoothed. */
export const seg = (s, a, b) => smooth((s - a) / (b - a));

/**
 * FABRIK: a chain of n equal links from a fixed base to a target, with a pole that the joints bias toward.
 * Fixed iteration count, so the same inputs give the same chain. Returns n + 1 joint positions; the tip lands on
 * the target when it is within reach (the kin checks assert this).
 */
export function fabrik(base, target, n, L, pole, iters = 24) {
  // start from a straight chain bent toward the pole so the solve converges to the same side every time
  const pts = [];
  const toT = v.norm(v.sub(target, base));
  const mid = v.add(v.lerp(base, target, 0.5), v.mul(v.norm(v.sub(pole, base)), n * L * 0.25));
  for (let i = 0; i <= n; i++) {
    const k = i / n;
    pts.push(k < 0.5 ? v.lerp(base, mid, k * 2) : v.lerp(mid, target, (k - 0.5) * 2));
  }
  const reach = n * L;
  if (v.dist(base, target) >= reach) {
    for (let i = 0; i <= n; i++) pts[i] = v.add(base, v.mul(toT, i * L));
    return pts;
  }
  for (let it = 0; it < iters; it++) {
    // nudge the middle joints toward the pole first (keeps the bend on one side), then the two exact passes,
    // so every iteration ends with exact link lengths and the base in place
    // near full stretch the pole nudge only slows convergence: skip it
    if (it < iters - 16 && v.dist(base, target) < reach * 0.9) for (let i = 1; i < n; i++) pts[i] = v.add(pts[i], v.mul(v.norm(v.sub(pole, pts[i])), L * 0.08));
    pts[n] = target.slice();
    for (let i = n - 1; i >= 0; i--) pts[i] = v.add(pts[i + 1], v.mul(v.norm(v.sub(pts[i], pts[i + 1])), L));
    pts[0] = base.slice();
    for (let i = 1; i <= n; i++) pts[i] = v.add(pts[i - 1], v.mul(v.norm(v.sub(pts[i], pts[i - 1])), L));
  }
  return pts;
}
