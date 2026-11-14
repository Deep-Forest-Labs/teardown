// PUFFER PF-2 geometry, posed from kin.js: eleven spherical-pentagon flesh plates on scissor chains (links and pin
// drums instanced), the aft duct with its rotor, a dark cage round a glowing core that shows when it swells.
import * as THREE from 'three';
import {materials} from '../slumber-kit/studio.js';
import {AXES, corners, FAN, pose, S, tong} from './kin.js';

const V = (a) => new THREE.Vector3(...a);
/** A spherical pentagon at radius R from five corner directions round axis ax: a fan of subdivided triangles. */
function capGeo(ax, cs, R, sub = 6) {
  const pos = [];
  const c = V(ax);
  for (let k = 0; k < 5; k++) {
    const a = V(cs[k]);
    const b = V(cs[(k + 1) % 5]);
    for (let i = 0; i < sub; i++)
      for (let j = 0; j < sub - i; j++) {
        const P = (ii, jj) => c.clone().multiplyScalar(1 - (ii + jj) / sub).addScaledVector(a, ii / sub).addScaledVector(b, jj / sub).normalize().multiplyScalar(R);
        pos.push(P(i, j), P(i + 1, j), P(i, j + 1));
        if (j < sub - i - 1) pos.push(P(i + 1, j), P(i + 1, j + 1), P(i, j + 1));
      }
  }
  const g = new THREE.BufferGeometry().setFromPoints(pos);
  g.computeVertexNormals();
  return g;
}

export function buildPuffer(scene) {
  const mat = materials();
  mat.core = new THREE.MeshStandardMaterial({color: '#d24a2a', emissive: new THREE.Color('#ff4a1c'), emissiveIntensity: 0.2, roughness: 0.4});
  const root = new THREE.Group();
  scene.add(root);
  const add = (geo, m, parent = root) => {
    const o = new THREE.Mesh(geo, m);
    o.castShadow = true;
    o.receiveShadow = true;
    parent.add(o);
    return o;
  };
  // plates: a pivot per axis that slides out along it
  const plates = AXES.map((ax, f) => {
    const g = new THREE.Group();
    root.add(g);
    const cs = corners(f);
    if (f !== FAN) {
      add(capGeo(ax, cs, S.R0), mat.flesh, g);
      add(capGeo(ax, cs, S.R0 - S.plateT), mat.fleshDeep, g).material.side = THREE.BackSide;
      // seam rim: a thin accent tube round the plate's edge, rivets at the corners
      const rim = [];
      for (let k = 0; k < 5; k++) {
        const a = V(cs[k]);
        const b = V(cs[(k + 1) % 5]);
        for (let s = 0; s <= 8; s++) rim.push(a.clone().lerp(b, s / 8).normalize().multiplyScalar(S.R0 * 0.995));
      }
      add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rim, true), 80, 0.006, 6, true), mat.accent, g);
      for (const cv of cs) add(new THREE.SphereGeometry(0.012, 8, 6).translate(...V(cv).multiplyScalar(S.R0 * 1.003).toArray()), mat.dark, g);
      // the riser: a short stem under the plate where the chain ends
      add(new THREE.CylinderGeometry(0.03, 0.04, 0.08, 14).translate(0, 0.04, 0).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), V(ax))).translate(...V(ax).multiplyScalar(S.R0 - S.plateT - 0.08).toArray()), mat.steel, g);
    }
    return {g, ax};
  });
  // the aft duct: a ring, stator spokes, a rotor that spins
  const fanAx = V(AXES[FAN]);
  const duct = new THREE.Group();
  root.add(duct);
  duct.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), fanAx);
  duct.position.copy(fanAx.clone().multiplyScalar(S.R0 * 0.82));
  add(new THREE.TorusGeometry(0.22, 0.04, 12, 48).rotateX(Math.PI / 2), mat.flesh, duct);
  add(new THREE.TorusGeometry(0.215, 0.012, 8, 48).rotateX(Math.PI / 2).translate(0, 0.045, 0), mat.accent, duct);
  for (let k = 0; k < 4; k++) add(new THREE.BoxGeometry(0.42, 0.02, 0.02).rotateY((k * Math.PI) / 4), mat.steel, duct);
  const rotor = new THREE.Group();
  duct.add(rotor);
  for (let k = 0; k < 7; k++) {
    const blade = add(new THREE.BoxGeometry(0.17, 0.008, 0.05).translate(0.1, 0.02, 0), mat.dark, rotor);
    blade.rotation.set(0.35, (k / 7) * Math.PI * 2, 0);
  }
  add(new THREE.CylinderGeometry(0.05, 0.05, 0.08, 18).translate(0, 0.02, 0), mat.accent, rotor);
  // the core: a glowing sphere in a dark cage
  add(new THREE.SphereGeometry(S.core * 0.75, 28, 20), mat.core);
  add(new THREE.IcosahedronGeometry(S.core, 1), new THREE.MeshStandardMaterial({color: '#232124', wireframe: true}));
  // scissor chains: instanced links and pins
  const chains = AXES.map((ax, f) => f).filter((f) => f !== FAN);
  const nLinks = chains.length * S.cells * 2;
  const nPins = chains.length * (S.cells * 3 + 2);
  const links = new THREE.InstancedMesh(new THREE.BoxGeometry(0.018, 1, 0.01), mat.bone, nLinks);
  const pins = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.014, 0.014, 0.03, 12).rotateX(Math.PI / 2), mat.dark, nPins);
  for (const m of [links, pins]) {
    m.castShadow = true;
    m.frustumCulled = false;
    root.add(m);
  }
  const M = new THREE.Matrix4();
  const Q = new THREE.Quaternion();
  function update(u, fanAngle, explode = 0) {
    const P = pose(u);
    const T = tong(u);
    P.plates.forEach((Pl, f) => {
      if (f === FAN) return;
      plates[f].g.position.copy(V(Pl.ax).multiplyScalar(Pl.off + explode * 0.5));
    });
    duct.position.copy(fanAx.clone().multiplyScalar(S.R0 * 0.82 + explode * 0.5));
    rotor.rotation.y = fanAngle;
    let nl = 0;
    let np = 0;
    for (const f of chains) {
      const ax = V(AXES[f]);
      // the chain's plane: the axis and a side vector
      const ref = Math.abs(ax.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
      const side = new THREE.Vector3().crossVectors(ax, ref).normalize();
      const at = (p) => ax.clone().multiplyScalar(S.core + p[0] + explode * 0.25).addScaledVector(side, p[1]);
      for (let i = 0; i < S.cells; i++) {
        for (const s of [-1, 1]) {
          const a = at([i * T.cell, s * T.half]);
          const b = at([(i + 1) * T.cell, -s * T.half]);
          Q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
          M.compose(a.clone().add(b).multiplyScalar(0.5), Q, new THREE.Vector3(1, a.distanceTo(b), 1));
          links.setMatrixAt(nl++, M);
        }
      }
      const facing = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3().crossVectors(ax, side));
      for (const p of T.pins) pins.setMatrixAt(np++, M.compose(at(p), facing, new THREE.Vector3(1, 1, 1)));
    }
    links.count = nl;
    pins.count = np;
    links.instanceMatrix.needsUpdate = true;
    pins.instanceMatrix.needsUpdate = true;
    mat.core.emissiveIntensity = 0.15 + 0.85 * u;
    return P;
  }
  return {root, update, mat};
}
