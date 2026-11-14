// WANDERER WS-3 geometry, posed from kin.js: Jansen legs as tubes with drums at every joint (instanced), the
// crankshaft and its webs, a flesh hull carrying the hive dome, the rotary airlock valve (glass end, eight vanes)
// indexed by a Geneva wheel and its pinned driver, the bellows, the chute.
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {LINKS, PIVOT} from '../strandbeest-shared/jansen.js';
import {materials} from '../slumber-kit/studio.js';
import {AXLE_Y, GENEVA, K, pose, STATIONS} from './kin.js';

const TAU = Math.PI * 2;
const V = (a) => new THREE.Vector3(...a);

/** A Geneva wheel outline: n radial slots, concave locking arcs between them. */
function genevaShape(n, C, a) {
  const R = Math.sqrt(C * C - a * a); // wheel radius where the pin enters
  const slotW = 0.045;
  const slotDepth = C - a + 0.02; // slot bottom radius = C - a (the pin's closest approach) - clearance
  const s = new THREE.Shape();
  const lockR = 0.62 * a; // the driver's locking disc radius, centred C away between slots
  for (let k = 0; k < n; k++) {
    const c = (k / n) * TAU;
    const half = Math.asin(slotW / 2 / R);
    // slot: in at c - half, down to the bottom, back out at c + half
    const p = (r, ang) => [r * Math.cos(ang), r * Math.sin(ang)];
    const inner = R - (R - (C - a)) - 0.0;
    void inner;
    const bottom = C - a - 0.02;
    const side = (r) => [r * Math.cos(c) - (slotW / 2) * -Math.sin(c), r * Math.sin(c) - (slotW / 2) * Math.cos(c)];
    const side2 = (r) => [r * Math.cos(c) + (slotW / 2) * -Math.sin(c), r * Math.sin(c) + (slotW / 2) * Math.cos(c)];
    if (k === 0) s.moveTo(...p(R, c - half));
    else s.lineTo(...p(R, c - half));
    s.lineTo(...side(bottom));
    s.lineTo(...side2(bottom));
    s.lineTo(...p(R, c + half));
    // concave locking arc to the next slot, centred at distance C between the slots
    const mid = c + Math.PI / n;
    const cx = C * Math.cos(mid);
    const cy = C * Math.sin(mid);
    const next = (k + 1) / n * TAU;
    const end = p(R, next - half);
    const a0 = Math.atan2(R * Math.sin(c + half) - cy, R * Math.cos(c + half) - cx);
    const a1 = Math.atan2(end[1] - cy, end[0] - cx);
    s.absarc(cx, cy, lockR, a0, a1, true);
    void slotDepth;
  }
  s.closePath();
  return s;
}

export function buildSpawner(scene) {
  const mat = materials();
  mat.glass = new THREE.MeshPhysicalMaterial({color: '#cfd6d8', roughness: 0.05, transmission: 0, transparent: true, opacity: 0.22, depthWrite: false});
  const root = new THREE.Group();
  scene.add(root);
  const body = new THREE.Group(); // moves with the walk
  root.add(body);
  const add = (geo, m, parent = body) => {
    const o = new THREE.Mesh(geo, m);
    o.castShadow = true;
    o.receiveShadow = true;
    parent.add(o);
    return o;
  };
  // ---------------------------------------------------------- legs (instanced tubes and drums)
  const nLegs = STATIONS.length * 2;
  const tubes = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 1, 10), mat.bone, nLegs * LINKS.length);
  const drums = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 1, 18).rotateX(Math.PI / 2), mat.dark, nLegs * 6);
  const rings = new THREE.InstancedMesh(new THREE.TorusGeometry(1, 0.14, 6, 20), mat.accent, nLegs * 6);
  const pads = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 14, 10).scale(1.3, 0.55, 1), mat.flesh, nLegs);
  for (const m of [tubes, drums, rings, pads]) {
    m.castShadow = true;
    m.frustumCulled = false;
    root.add(m);
  }
  // ---------------------------------------------------------- crankshaft, frame, hull
  const zMax = STATIONS[STATIONS.length - 1] + 0.3;
  add(new THREE.CylinderGeometry(0.06, 0.06, zMax * 2 + 0.3, 16).rotateX(Math.PI / 2).translate(0, AXLE_Y, 0), mat.steel);
  const hullY = AXLE_Y + 0.55;
  const hull = add(new RoundedBoxGeometry(2.4, 0.6, zMax * 2 + 0.4, 4, 0.22), mat.flesh);
  hull.position.set(-0.1, hullY, 0);
  for (let k = -3; k <= 3; k++) add(new THREE.BoxGeometry(0.012, 0.605, zMax * 2 + 0.405), mat.dark).position.set(k * 0.32 - 0.1, hullY, 0);
  // frame struts from the hull to each station's pivot and axle bearing
  for (const z of STATIONS)
    for (const sz of [-0.14, 0.14]) {
      add(new THREE.CylinderGeometry(0.11, 0.11, 0.08, 18).rotateX(Math.PI / 2).translate(0, AXLE_Y, z + sz), mat.dark);
      const P = [PIVOT[0] * K, AXLE_Y + PIVOT[1] * K, z + sz];
      add(new THREE.CylinderGeometry(0.04, 0.05, 1, 10).applyMatrix4(new THREE.Matrix4().compose(V([P[0] / 2, (P[1] + hullY - 0.3) / 2, P[2]]), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), V([P[0], P[1] - (hullY - 0.3), 0]).normalize()), V([1, V([P[0], P[1] - (hullY - 0.3), 0]).length(), 1]))), mat.steel);
    }
  // ---------------------------------------------------------- hive dome on the hull, with seams and rivets
  const domeY = hullY + 0.28;
  const DOME_X = -0.55; // the dome sits forward so the valve and its Geneva wheel clear it (dome reaches x = 0.40)
  add(new THREE.SphereGeometry(0.95, 40, 20, 0, TAU, 0, Math.PI / 2), mat.flesh).position.set(DOME_X, domeY, 0);
  add(new THREE.TorusGeometry(0.95, 0.025, 8, 48).rotateX(Math.PI / 2), mat.accent).position.set(DOME_X, domeY + 0.02, 0);
  // ---------------------------------------------------------- rotary airlock valve at the stern (axis z)
  const valveC = [1.15, domeY + 0.05, 0]; // aft of the dome: its wheel (r ≈ 0.36) clears the dome's 0.40 by 0.4 m
  const VR = 0.42;
  const VL = 0.8;
  add(new THREE.CylinderGeometry(VR + 0.04, VR + 0.04, VL, 36, 1, true, Math.PI * 0.15, Math.PI * 1.7).rotateX(Math.PI / 2).rotateZ(-Math.PI / 2).translate(...valveC), mat.fleshDeep).material.side = THREE.DoubleSide;
  for (const sz of [-1, 1]) add(new THREE.CylinderGeometry(VR + 0.06, VR + 0.06, 0.04, 36).rotateX(Math.PI / 2).translate(valveC[0], valveC[1], sz * (VL / 2 + 0.02)), sz > 0 ? mat.glass : mat.dark);
  const rotor = new THREE.Group();
  rotor.position.set(...valveC);
  body.add(rotor);
  add(new THREE.CylinderGeometry(0.08, 0.08, VL + 0.1, 16).rotateX(Math.PI / 2), mat.steel, rotor);
  for (let k = 0; k < GENEVA.n; k++) {
    const vane = add(new THREE.BoxGeometry(VR - 0.06, 0.025, VL - 0.04).translate((VR - 0.06) / 2 + 0.07, 0, 0), mat.bone, rotor);
    vane.rotation.z = (k / GENEVA.n) * TAU;
    add(new THREE.BoxGeometry(0.02, 0.05, VL - 0.04).translate(VR - 0.01, 0, 0), mat.accent, vane);
  }
  // inlet throat from the dome, chute below
  // the feed pipe: out of the dome's crown, over and down into the valve's inlet
  add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V([DOME_X + 0.5, domeY + 0.7, 0]), V([0.55, domeY + 0.95, 0]), V([valveC[0] - 0.05, valveC[1] + VR + 0.45, 0]), V([valveC[0] - 0.05, valveC[1] + VR + 0.02, 0])]), 32, 0.13, 16), mat.fleshDeep);
  add(new THREE.CylinderGeometry(0.17, 0.17, 0.06, 20).translate(valveC[0] - 0.05, valveC[1] + VR + 0.04, 0), mat.accent);
  add(new THREE.CylinderGeometry(0.2, 0.14, 0.5, 18, 1, true).translate(valveC[0], valveC[1] - VR - 0.25, 0), mat.dark).material.side = THREE.DoubleSide;
  // ---------------------------------------------------------- the Geneva wheel on the valve shaft, the driver beside it
  const gz = VL / 2 + 0.12;
  const wheel = new THREE.Group();
  wheel.position.set(valveC[0], valveC[1], gz);
  body.add(wheel);
  add(new THREE.ExtrudeGeometry(genevaShape(GENEVA.n, GENEVA.C, GENEVA.a), {depth: 0.05, bevelEnabled: false}).translate(0, 0, -0.025), mat.steel, wheel);
  const driverC = [valveC[0] - GENEVA.C, valveC[1], gz + 0.06];
  const driver = new THREE.Group();
  driver.position.set(...driverC);
  body.add(driver);
  add(new THREE.CylinderGeometry(GENEVA.a + 0.04, GENEVA.a + 0.04, 0.04, 32).rotateX(Math.PI / 2), mat.dark, driver);
  add(new THREE.CylinderGeometry(0.022, 0.022, 0.12, 12).rotateX(Math.PI / 2).translate(GENEVA.a, 0, -0.04), mat.accent, driver);
  add(new THREE.CylinderGeometry(0.62 * GENEVA.a, 0.62 * GENEVA.a, 0.05, 32, 1, false, Math.PI * 0.5 + 0.6, TAU - 1.2).rotateX(Math.PI / 2).translate(0, 0, -0.05), mat.bone, driver);
  // drive chain from the crankshaft up to the driver: two sprockets, a chain loop
  add(new THREE.CylinderGeometry(0.1, 0.1, 0.03, 20).rotateX(Math.PI / 2).translate(driverC[0], AXLE_Y, zMax + 0.12), mat.dark);
  add(new THREE.TorusGeometry(1, 0.012, 4, 40).scale(0.1, (driverC[1] - AXLE_Y) / 2 + 0.1, 1).translate(driverC[0], (driverC[1] + AXLE_Y) / 2, zMax + 0.12), mat.dark);
  // ---------------------------------------------------------- bellows on the port side
  const bellows = new THREE.Group();
  bellows.position.set(-0.6, hullY + 0.3, zMax + 0.05);
  body.add(bellows);
  const folds = [];
  for (let k = 0; k < 7; k++) folds.push(add(new THREE.TorusGeometry(0.2 - (k % 2) * 0.04, 0.05, 8, 24).rotateX(Math.PI / 2), k % 2 ? mat.fleshDeep : mat.flesh, bellows));
  add(new THREE.CylinderGeometry(0.24, 0.24, 0.04, 24), mat.dark, bellows);
  const cap = add(new THREE.CylinderGeometry(0.24, 0.24, 0.05, 24), mat.accent, bellows);

  const M = new THREE.Matrix4();
  const Q = new THREE.Quaternion();
  const Yv = new THREE.Vector3(0, 1, 0);
  function update(theta) {
    const P = pose(theta);
    body.position.x = P.x;
    let nt = 0;
    let nd = 0;
    P.legs.forEach((L, i) => {
      for (const [a, b] of LINKS) {
        const A = V(L.pts[a]);
        const B = V(L.pts[b]);
        Q.setFromUnitVectors(Yv, B.clone().sub(A).normalize());
        tubes.setMatrixAt(nt++, M.compose(A.clone().add(B).multiplyScalar(0.5), Q, V([0.035, A.distanceTo(B), 0.035])));
      }
      for (const j of ['A', 'B', 'C', 'D', 'E', 'P']) {
        const p = V(L.pts[j]);
        const r = j === 'P' ? 0.09 : 0.07;
        drums.setMatrixAt(nd, M.compose(p, Q.identity(), V([r, r, 0.1])));
        rings.setMatrixAt(nd, M.compose(p.clone().setZ(p.z + (L.side ? 0.05 : -0.05)), Q.identity(), V([r * 0.8, r * 0.8, r * 0.8])));
        nd++;
      }
      pads.setMatrixAt(i, M.compose(V(L.foot).setY(L.foot[1] - 0.06), Q.identity(), V([0.09, 0.09, 0.09])));
    });
    for (const m of [tubes, drums, rings, pads]) m.instanceMatrix.needsUpdate = true;
    rotor.rotation.z = -P.valve;
    wheel.rotation.z = -P.valve;
    driver.rotation.z = theta + Math.PI / 2;
    const h = 0.42 * (1 - 0.45 * P.squeeze);
    folds.forEach((f, k) => (f.position.y = (k + 0.5) * (h / folds.length)));
    cap.position.y = h + 0.02;
    return P;
  }
  return {root, body, update, valveC, mat};
}
