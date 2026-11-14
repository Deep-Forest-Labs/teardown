// Posable machined parts shared by the SLUMBER machines (the Telson part language): a servo drum whose axis sits on
// the joint axis, a housing that spans two solved joints, and the helpers that place them. Each maker returns a
// Group; place/orient pose it from model points every frame.
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';

const UNIT_BOX = new RoundedBoxGeometry(1, 1, 1, 3, 0.16);
export const V = (a) => new THREE.Vector3(...a);

export function partsKit(root, mat) {
  const meshes = [];
  const mesh = (geo, m, parent) => {
    const o = new THREE.Mesh(geo, m);
    o.castShadow = true;
    o.receiveShadow = true;
    parent.add(o);
    meshes.push(o);
    return o;
  };
  /** Servo drum: dark body, accent ring on each face, steel hub. Its axis is local Y. */
  const drum = (r, w) => {
    const n = new THREE.Group();
    root.add(n);
    mesh(new THREE.CylinderGeometry(r, r, w, 28), mat.dark, n);
    for (const s of [-1, 1]) mesh(new THREE.TorusGeometry(r * 0.82, r * 0.09, 8, 32).rotateX(Math.PI / 2).translate(0, (s * w) / 2, 0), mat.accent, n);
    mesh(new THREE.CylinderGeometry(r * 0.35, r * 0.35, w * 1.15, 16), mat.steel, n);
    return n;
  };
  /** Housing: a rounded flesh box spanning two joints (local Y is the span), a dark band, an accent stripe. */
  const housing = (w, h, {stripe = true, m = mat.flesh} = {}) => {
    const n = new THREE.Group();
    root.add(n);
    const body = mesh(UNIT_BOX, m, n);
    body.scale.set(w, 1, h);
    const band = mesh(new THREE.BoxGeometry(1, 1, 1), mat.dark, n);
    band.scale.set(w * 1.03, 0.07, h * 1.03);
    const st = stripe ? mesh(new THREE.BoxGeometry(1, 1, 1), mat.accent, n) : null;
    if (st) st.position.set(w * 0.25, 0, h / 2 + 0.004);
    n.userData.len = (L) => {
      body.scale.y = L;
      band.position.y = -0.3 * L;
      if (st) st.scale.set(w * 0.12, 0.5 * L, 0.01);
    };
    return n;
  };
  /** Span a part from a to b; upHint sets its roll; shrink leaves room for the drums at the ends. */
  const place = (n, a, b, upHint = [0, 1, 0], shrink = 0) => {
    const A = V(a);
    const B = V(b);
    const Y = B.clone().sub(A);
    const L = Y.length();
    Y.normalize();
    let Z = V(upHint).addScaledVector(Y, -V(upHint).dot(Y));
    if (Z.lengthSq() < 1e-8) Z = Math.abs(Y.x) < 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1);
    Z.normalize();
    const X = new THREE.Vector3().crossVectors(Y, Z);
    n.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, Y, Z));
    n.position.copy(A).add(B).multiplyScalar(0.5);
    n.userData.len?.(Math.max(0.01, L - shrink));
  };
  /** Put a drum on point p with its axis along axis. */
  const orient = (n, p, axis) => {
    n.position.copy(V(p));
    n.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), V(axis).normalize());
  };
  return {drum, housing, place, orient, mesh, meshes, UNIT_BOX};
}

/** Two-bone IK: the knee between root a and end c, lengths L1 and L2, bent toward the pole direction. */
export function twoBone(a, c, L1, L2, pole) {
  const d = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const dl = Math.hypot(...d);
  const u = d.map((x) => x / dl);
  const pd = pole[0] * u[0] + pole[1] * u[1] + pole[2] * u[2];
  let v = [pole[0] - pd * u[0], pole[1] - pd * u[1], pole[2] - pd * u[2]];
  const vl = Math.hypot(...v) || 1;
  v = v.map((x) => x / vl);
  const x = (L1 * L1 - L2 * L2 + dl * dl) / (2 * dl);
  const h2 = L1 * L1 - x * x;
  if (h2 < 0 || dl > L1 + L2) return null;
  return [0, 1, 2].map((k) => a[k] + u[k] * x + v[k] * Math.sqrt(h2));
}
export const dist3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
