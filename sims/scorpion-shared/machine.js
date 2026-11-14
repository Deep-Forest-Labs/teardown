// STINGER SC-1 geometry in Telson SC-8's part language, posed from kin.js: a servo drum at every joint with its
// axis on the joint axis, a housing between every pair of solved joints, overlapping carapace tergites over a dark
// belly frame, chelae with glass tops and a hinged finger, the tail's housings and drums to the bulb and blade.
// Flesh plates, machined joints.
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {materials} from '../slumber-kit/studio.js';
import {B, pose} from './kin.js';

const V = (a) => new THREE.Vector3(...a);
const UNIT_BOX = new RoundedBoxGeometry(1, 1, 1, 3, 0.16);

export function buildScorpion(scene) {
  const mat = materials();
  mat.glass = new THREE.MeshPhysicalMaterial({color: '#1a1819', roughness: 0.06, metalness: 0.2, clearcoat: 1, transparent: true, opacity: 0.8});
  const root = new THREE.Group();
  scene.add(root);
  const groups = {legs: [], tail: [], arms: [], body: []};
  const mesh = (g, geo, m, parent = root) => {
    const o = new THREE.Mesh(geo, m);
    o.castShadow = true;
    o.receiveShadow = true;
    parent.add(o);
    groups[g].push(o);
    return o;
  };

  // ------------------------------------------------------------ part makers (posed each frame)
  /** A servo drum: dark body, an accent ring each face, a steel hub. Axis set at pose time. */
  const drum = (g, r, w) => {
    const n = new THREE.Group();
    root.add(n);
    mesh(g, new THREE.CylinderGeometry(r, r, w, 28), mat.dark, n);
    for (const s of [-1, 1]) mesh(g, new THREE.TorusGeometry(r * 0.82, r * 0.09, 8, 32).rotateX(Math.PI / 2).translate(0, (s * w) / 2, 0), mat.accent, n);
    mesh(g, new THREE.CylinderGeometry(r * 0.35, r * 0.35, w * 1.15, 16), mat.steel, n);
    return n;
  };
  /** A housing: a rounded flesh box from a to b (its long axis), with a dark band and an accent stripe. */
  const housing = (g, w, h, stripe = true) => {
    const n = new THREE.Group();
    root.add(n);
    const body = mesh(g, UNIT_BOX, mat.flesh, n);
    body.scale.set(w, 1, h);
    const band = mesh(g, new THREE.BoxGeometry(1, 1, 1), mat.dark, n);
    band.scale.set(w * 1.03, 0.08, h * 1.03);
    band.position.y = -0.3;
    if (stripe) {
      const st = mesh(g, new THREE.BoxGeometry(1, 1, 1), mat.accent, n);
      st.scale.set(w * 0.12, 0.5, 0.01);
      st.position.set(w * 0.25, 0.05, h / 2 + 0.004);
    }
    n.userData.len = (L) => {
      body.scale.y = L;
      band.position.y = -0.3 * L;
      if (stripe) n.children[2].scale.y = 0.5 * L;
    };
    return n;
  };
  const place = (n, a, b, upHint, shrink = 0) => {
    const A2 = V(a);
    const B2 = V(b);
    const Y = B2.clone().sub(A2);
    const L = Y.length();
    Y.normalize();
    const Z = V(upHint).addScaledVector(Y, -V(upHint).dot(Y)).normalize();
    const X = new THREE.Vector3().crossVectors(Y, Z);
    n.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, Y, Z));
    n.position.copy(A2).add(B2).multiplyScalar(0.5);
    n.userData.len?.(Math.max(0.01, L - shrink));
  };
  const orient = (n, p, axis) => {
    n.position.copy(V(p));
    n.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), V(axis).normalize());
  };

  // ------------------------------------------------------------ body: tergites over a belly frame, head with optics
  const body = new THREE.Group();
  root.add(body);
  const arch = (w, h, t) => {
    const s = new THREE.Shape();
    s.absellipse(0, 0, w, h, 0, Math.PI, false);
    s.absellipse(0, 0, w - t, h - t, Math.PI, 0, true);
    return s;
  };
  const NT = 8;
  for (let i = 0; i < NT; i++) {
    const z = 0.55 - i * 0.19;
    const w = 0.44 - Math.abs(i - 3) * 0.022;
    const g = new THREE.ExtrudeGeometry(arch(w, w * 0.62, 0.05), {depth: 0.25, bevelEnabled: true, bevelSize: 0.015, bevelThickness: 0.015, bevelSegments: 2, curveSegments: 24}).translate(0, 0, -0.125);
    const tg = mesh('body', g, mat.flesh, body);
    tg.position.set(0, 0.04 + i * 0.006, z);
    tg.rotation.x = -0.08;
    const st = mesh('body', new THREE.TorusGeometry(w * 0.985, 0.008, 6, 40, Math.PI).scale(1, 0.62, 1), mat.accent, body); // follows the arch's squash
    st.position.set(0, 0.04 + i * 0.006, z + 0.06);
    st.rotation.x = -0.08;
    for (let r = 0; r < 7; r++) {
      const a = (r / 6) * Math.PI;
      const rv = mesh('body', new THREE.SphereGeometry(0.011, 6, 4), mat.dark, body);
      rv.position.set(Math.cos(a) * w * 1.005, 0.04 + i * 0.006 + Math.sin(a) * w * 0.62, z - 0.08);
    }
  }
  mesh('body', new THREE.BoxGeometry(0.62, 0.16, 1.7), mat.dark, body).position.set(0, -0.06, -0.1);
  for (const sx of [-1, 1]) mesh('body', new THREE.BoxGeometry(0.06, 0.1, 1.55), mat.steel, body).position.set(sx * 0.33, -0.05, -0.08);
  // head: a flesh shell, two large optics, four small
  const headG = new THREE.ExtrudeGeometry(arch(0.42, 0.3, 0.42), {depth: 0.34, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 3, curveSegments: 24}).translate(0, 0, -0.17);
  mesh('body', headG, mat.fleshDeep, body).position.set(0, 0.0, 0.82);
  for (const [x, y, r] of [[-0.14, 0.2, 0.07], [0.14, 0.2, 0.07], [-0.27, 0.12, 0.035], [0.27, 0.12, 0.035], [-0.3, 0.05, 0.03], [0.3, 0.05, 0.03]]) {
    const e = new THREE.Group();
    body.add(e);
    e.position.set(x, y, 0.97);
    mesh('body', new THREE.CylinderGeometry(r, r * 1.1, 0.06, 24).rotateX(Math.PI / 2), mat.bone, e);
    mesh('body', new THREE.TorusGeometry(r * 0.85, r * 0.14, 8, 24).translate(0, 0, 0.03), mat.accent, e);
    mesh('body', new THREE.CircleGeometry(r * 0.75, 24).translate(0, 0, 0.031), mat.glass, e);
  }

  // ------------------------------------------------------------ legs
  const legs = Array.from({length: 8}, () => ({
    coxa: drum('legs', 0.09, 0.11),
    femur: housing('legs', 0.13, 0.11),
    knee: drum('legs', 0.075, 0.12),
    tibia: housing('legs', 0.11, 0.1),
    ankle: drum('legs', 0.06, 0.1),
    tarsus: housing('legs', 0.06, 0.06, false),
    spike: mesh('legs', new THREE.ConeGeometry(0.035, 0.12, 12).translate(0, -0.06, 0), mat.dark),
  }));

  // ------------------------------------------------------------ tail: housing between joints, a drum at each joint
  const T = B.tail;
  const tail = T.links.map((L, i) => ({drum: drum('tail', 0.13 - i * 0.008, 0.2 - i * 0.012), house: housing('tail', 0.2 - i * 0.012, 0.18 - i * 0.012)}));
  const bulb = new THREE.Group();
  root.add(bulb);
  const neck = housing('tail', 0.1, 0.09, false); // last drum to the bulb
  mesh('tail', new THREE.SphereGeometry(1, 28, 18).scale(0.11, 0.15, 0.11), mat.flesh, bulb);
  mesh('tail', new THREE.TorusGeometry(0.108, 0.012, 8, 32).rotateX(Math.PI / 2), mat.accent, bulb);
  const blade = new THREE.Group();
  root.add(blade);
  {
    const s = new THREE.Shape();
    s.moveTo(-0.04, 0);
    s.quadraticCurveTo(0.03, T.blade * 0.6, 0.11, T.blade);
    s.quadraticCurveTo(0.02, T.blade * 0.5, 0.04, 0);
    s.closePath();
    mesh('tail', new THREE.ExtrudeGeometry(s, {depth: 0.04, bevelEnabled: true, bevelSize: 0.006, bevelThickness: 0.006, bevelSegments: 1}).translate(0, 0, -0.02), mat.dark, blade);
    mesh('tail', new THREE.ConeGeometry(0.018, 0.08, 10).rotateZ(-0.6).translate(0.1, T.blade - 0.02, 0), mat.accent, blade);
  }

  // ------------------------------------------------------------ arms and chelae
  const arms = [-1, 1].map((sx) => {
    const chela = new THREE.Group();
    root.add(chela);
    const C = B.chela;
    const shell = mesh('arms', UNIT_BOX, mat.flesh, chela);
    shell.scale.set(0.24, 0.2, C.len);
    const glass = mesh('arms', new RoundedBoxGeometry(1, 1, 1, 2, 0.2), mat.glass, chela);
    glass.scale.set(0.16, 0.08, C.len * 0.6);
    glass.position.set(0, 0.1, -0.02);
    const gearIn = mesh('arms', new THREE.CylinderGeometry(0.05, 0.05, 0.03, 14).rotateZ(Math.PI / 2), mat.dark, chela);
    gearIn.position.set(0, 0.06, 0);
    mesh('arms', new THREE.BoxGeometry(0.26, 0.02, 0.02), mat.accent, chela).position.set(0, 0.0, C.len / 2 - 0.02);
    const finger = (m) => {
      const s = new THREE.Shape();
      s.moveTo(0, -0.03);
      s.quadraticCurveTo(C.finger * 0.6, -0.05, C.finger, 0.02);
      s.lineTo(C.finger * 0.85, 0.04);
      for (let k = 6; k >= 1; k--) s.lineTo((C.finger * k) / 7, 0.02 + (k % 2) * 0.02); // the cutting edge's teeth
      s.lineTo(0, 0.03);
      s.closePath();
      return new THREE.ExtrudeGeometry(s, {depth: 0.07, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.008, bevelSegments: 1}).translate(0, 0, -0.035).rotateY(-Math.PI / 2);
    };
    const fixed = mesh('arms', finger(), mat.bone, chela);
    fixed.position.set(sx * 0.05, -0.02, C.len / 2);
    fixed.rotation.z = 0;
    const moving = new THREE.Group();
    chela.add(moving);
    moving.position.set(-sx * 0.05, 0.0, C.len / 2 - 0.02);
    mesh('arms', finger(), mat.dark, moving).scale.y = -1;
    mesh('arms', new THREE.CylinderGeometry(0.035, 0.035, 0.1, 14), mat.steel, moving);
    return {sx, shoulder: drum('arms', 0.1, 0.14), upper: housing('arms', 0.15, 0.14), elbow: drum('arms', 0.085, 0.14), fore: housing('arms', 0.14, 0.13), wrist: drum('arms', 0.075, 0.12), chela, moving};
  });

  // ------------------------------------------------------------ pose
  const UP = [0, 1, 0];
  function update(w, cl, cr, k, t, {tailApart = 0} = {}) {
    const P = pose(w, cl, cr, k, t);
    body.position.set(...P.body);
    P.legs.forEach((L, i) => {
      const Lg = legs[i];
      // the knee and ankle axes: horizontal, across the leg's plane
      const plane = [Math.cos(L.yaw), 0, -Math.sin(L.yaw)];
      orient(Lg.coxa, L.hip, UP);
      place(Lg.femur, L.hip, L.knee, UP, 0.16);
      orient(Lg.knee, L.knee, plane);
      place(Lg.tibia, L.knee, L.ankle, UP, 0.14);
      orient(Lg.ankle, L.ankle, plane);
      place(Lg.tarsus, L.ankle, [L.foot[0], L.foot[1] + 0.1, L.foot[2]], [0, 0, 1], 0.08);
      Lg.spike.position.set(L.foot[0], L.foot[1] + 0.12, L.foot[2]);
    });
    P.tail.forEach((S, i) => {
      const off = tailApart * (i + 1) * 0.12;
      const dir = V(S.b).sub(V(S.a)).normalize();
      const a = V(S.a).addScaledVector(dir, off);
      const b = V(S.b).addScaledVector(dir, off);
      orient(tail[i].drum, a.toArray(), [1, 0, 0]);
      place(tail[i].house, a.toArray(), b.toArray(), [0, Math.cos(S.phi), Math.sin(S.phi)], 0.2);
    });
    const offB = tailApart * 7 * 0.12;
    const last = P.tail[P.tail.length - 1];
    const ld = V(last.b).sub(V(last.a)).normalize();
    bulb.position.copy(V(P.bulb)).addScaledVector(ld, offB);
    place(neck, V(last.b).addScaledVector(ld, offB * 0.93).toArray(), bulb.position.toArray(), [1, 0, 0], 0.1);
    blade.position.copy(V(P.bulb)).addScaledVector(ld, offB * 1.15);
    const tipDir = V(P.tip).sub(V(P.bulb)).normalize();
    blade.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tipDir);
    bulb.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), V(P.bulb).sub(V(last.b)).normalize());
    P.arms.forEach((A, i) => {
      const R = arms[i];
      orient(R.shoulder, A.sh, [0, 1, 0]);
      place(R.upper, A.sh, A.elbow, UP, 0.18);
      orient(R.elbow, A.elbow, V(A.elbow).sub(V(A.sh)).cross(V(A.wrist).sub(V(A.elbow))).normalize().toArray());
      place(R.fore, A.elbow, A.wrist, UP, 0.16);
      orient(R.wrist, A.wrist, [1, 0, 0]);
      R.chela.position.set(A.wrist[0], A.wrist[1], A.wrist[2] + B.chela.len / 2);
      R.chela.rotation.set(0, 0, 0);
      R.moving.rotation.y = -A.sx * 0.65 * A.open;
    });
    return P;
  }
  return {root, update, groups, mat};
}
