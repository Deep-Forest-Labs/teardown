// BONEPEDE II geometry: rigid parts only, one InstancedMesh per part type, posed from wyrm.js. Burnt bone over dark
// flesh so the red belly orbs carry the read; the weak points come from the shared dfl-kit part.
import * as THREE from 'three';
import {createWeakpoints} from '../dfl-kit/weakpoint.js';
import {CFG} from './wyrm.js';

export const COL = {
  bone: '#b9a684',
  boneDark: '#6f5f4a',
  flesh: '#2a1310',
  leg: '#c2ae88',
  claw: '#5b4a3a',
  socket: '#0d0707',
};

const flat = (c, extra = {}) => new THREE.MeshStandardMaterial({color: c, roughness: 0.85, metalness: 0, flatShading: true, ...extra});
const cyl = (rt, rb, seg = 5) => new THREE.CylinderGeometry(rt, rb, 1, seg, 1);

export function createBody(scene) {
  const group = new THREE.Group();
  scene.add(group);
  const N = CFG.N;
  const mats = {bone: flat(COL.bone), boneDark: flat(COL.boneDark), flesh: flat(COL.flesh), leg: flat(COL.leg), claw: flat(COL.claw), socket: flat(COL.socket)};
  const inst = (geo, mat, n) => {
    const m = new THREE.InstancedMesh(geo, mat, n);
    m.castShadow = true;
    m.receiveShadow = true;
    m.frustumCulled = false;
    group.add(m);
    return m;
  };
  const plates = inst(new THREE.CylinderGeometry(0.5, 0.5, 1, 6, 1).rotateX(Math.PI / 2), mats.bone, N); // along +Z
  const bellies = inst(new THREE.CylinderGeometry(0.5, 0.5, 1, 6, 1).rotateX(Math.PI / 2), mats.flesh, N);
  const femurs = inst(cyl(0.045, 0.065), mats.leg, N * 2);
  const knees = inst(new THREE.IcosahedronGeometry(0.055, 0), mats.boneDark, N * 2);
  const tibias = inst(new THREE.ConeGeometry(0.05, 1, 4), mats.claw, N * 2); // tip at +Y
  const spines = inst(new THREE.ConeGeometry(0.5, 1, 4), mats.boneDark, N * 3);
  const weak = createWeakpoints(group, N, 0.06);

  // head: skull, sockets, mandibles that open
  const head = new THREE.Group();
  head.matrixAutoUpdate = false;
  group.add(head);
  const part = (geo, mat, p, s = [1, 1, 1], r = [0, 0, 0], parent = head) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(...p);
    m.scale.set(...s);
    m.rotation.set(...r);
    m.castShadow = true;
    parent.add(m);
    return m;
  };
  part(new THREE.IcosahedronGeometry(0.3, 0), mats.bone, [0, 0.04, 0.05], [1.2, 0.85, 1.35]);
  part(new THREE.BoxGeometry(0.52, 0.09, 0.18), mats.boneDark, [0, 0.22, 0.24], [1, 1, 1], [0.3, 0, 0]);
  part(new THREE.BoxGeometry(0.12, 0.09, 0.06), mats.socket, [0.13, 0.12, 0.4]);
  part(new THREE.BoxGeometry(0.12, 0.09, 0.06), mats.socket, [-0.13, 0.12, 0.4]);
  // crown spikes
  for (const sx of [-1, 1]) part(new THREE.ConeGeometry(0.06, 0.55, 4), mats.boneDark, [sx * 0.18, 0.32, -0.05], [1, 1, 1], [-0.7, 0, -sx * 0.35]);
  const mandible = (side) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.16, -0.12, 0.3);
    head.add(pivot);
    part(new THREE.ConeGeometry(0.06, 0.5, 4), mats.claw, [-side * 0.06, 0, 0.22], [1, 1, 1], [Math.PI / 2, 0, 0], pivot);
    return pivot;
  };
  const mL = mandible(1);
  const mR = mandible(-1);

  const M = new THREE.Matrix4();
  const Q = new THREE.Quaternion();
  const A = new THREE.Vector3();
  const B = new THREE.Vector3();
  const D = new THREE.Vector3();
  const S = new THREE.Vector3();
  const X = new THREE.Vector3();
  const Y = new THREE.Vector3();
  const Z = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0);
  const tube = (mesh, i, a, b, r = 1) => {
    A.set(a[0], a[1], a[2]);
    B.set(b[0], b[1], b[2]);
    D.subVectors(B, A);
    const L = D.length();
    Q.setFromUnitVectors(UP, D.multiplyScalar(1 / (L || 1)));
    M.compose(A.add(B).multiplyScalar(0.5), Q, S.set(r, L, r));
    mesh.setMatrixAt(i, M);
  };
  /** Frame matrix: +Z forward f, +Y up u, at p, scaled. */
  const frame = (p, f, u, sx = 1, sy = 1, sz = 1) => {
    Z.set(f[0], f[1], f[2]);
    Y.set(u[0], u[1], u[2]);
    X.crossVectors(Y, Z).normalize();
    M.makeBasis(X.multiplyScalar(sx), Y.multiplyScalar(sy), Z.multiplyScalar(sz));
    M.setPosition(p[0], p[1], p[2]);
    return M;
  };
  const point = (mesh, i, p) => {
    M.makeTranslation(p[0], p[1], p[2]);
    mesh.setMatrixAt(i, M);
  };

  /** weakState(i) -> {open, hit, dead, pulse}; open the mandibles 0..1. */
  const update = (P, camera, weakState, open = 0) => {
    for (const sg of P.segs) {
      const r = CFG.radius * sg.w;
      const up = [sg.p[0] + sg.u[0] * r * 0.25, sg.p[1] + sg.u[1] * r * 0.25, sg.p[2] + sg.u[2] * r * 0.25];
      plates.setMatrixAt(sg.i, frame(up, sg.t, sg.u, r * 2.5, r * 1.3, CFG.spacing * 1.12));
      const dn = [sg.p[0] - sg.u[0] * r * 0.35, sg.p[1] - sg.u[1] * r * 0.35, sg.p[2] - sg.u[2] * r * 0.35];
      bellies.setMatrixAt(sg.i, frame(dn, sg.t, sg.u, r * 1.9, r * 1.1, CFG.spacing * 1.05));
    }
    P.legs.forEach((L, k) => {
      tube(femurs, k, L.root, L.knee);
      point(knees, k, L.knee);
      tube(tibias, k, L.knee, L.tip);
    });
    P.spines.forEach((s, k) => tube(spines, k, s.base, s.tip, k % 3 === 0 ? 0.14 : 0.09));
    weak.face(camera);
    for (const w of P.weak) {
      // socket faces out of the belly: +Z = out, +Y = forward
      frame(w.p, w.out, w.t);
      weak.set(w.seg, M, weakState(w.seg));
    }
    weak.commit();
    const h = P.head;
    head.matrix.copy(frame(h.p, h.t, h.u));
    mL.rotation.y = -0.25 + open * 0.8;
    mR.rotation.y = 0.25 - open * 0.8;
    for (const m of [plates, bellies, femurs, knees, tibias, spines]) m.instanceMatrix.needsUpdate = true;
  };
  return {group, update, weak, pickables: () => [weak.mesh]};
}
