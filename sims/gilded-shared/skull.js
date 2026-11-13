// GILDED SKULL (Greed elite, ranged): a floating skull built from eight gold plates around a red core. Whitebox
// mechanics in one rig:
//   open    0..1  the plates part along their centres and hinge outward to show the core (the weak window)
//   jaw     0..1  the lower front plate drops to spit a coin volley
//   tell    0..1  the plates rattle and the eye sockets glow before a volley
//   broken  per plate, the time it was shot off (or null): it flies off, spins and lies on the floor
//   core    weak point state {open, hit, dead, pulse}
// Every placement is a pure function of those values and t. The plate geometry is exact sphere lunes, so a closed
// shell has no gaps and an open one shows the dark inner shell between plates.
import * as THREE from 'three';
import {createWeakpoints} from '../dfl-kit/weakpoint.js';

export const R = 0.62; // skull radius
export const COL = {gold: '#c9a227', goldDark: '#8a6a17', inner: '#1d140b', socket: '#0d0805', coin: '#e8c75a', eye: '#ff3a1c'};
const G = 9.8;

// the eight plates: four around (front, right, back, left) times upper and lower
export const PLATES = [];
for (const band of [0, 1]) {
  for (let k = 0; k < 4; k++) {
    const phiMid = Math.PI / 2 - k * (Math.PI / 2); // three's sphere: phi = pi/2 faces +Z (front)
    const thetaMid = band === 0 ? Math.PI / 4 : (3 * Math.PI) / 4;
    const dir = [-Math.cos(phiMid) * Math.sin(thetaMid), Math.cos(thetaMid), Math.sin(phiMid) * Math.sin(thetaMid)];
    PLATES.push({band, k, phiStart: phiMid - Math.PI / 4, thetaStart: band === 0 ? 0 : Math.PI / 2, dir, name: `${band ? 'lower' : 'upper'}-${['front', 'right', 'back', 'left'][k]}`});
  }
}
export const JAW = PLATES.findIndex((p) => p.band === 1 && p.k === 0);
export const BROW = PLATES.findIndex((p) => p.band === 0 && p.k === 0);

/** Where a plate shot off at time tb is at time t, in the skull's world frame (origin, yaw). Lands on y = 0. */
export function debris(plate, origin, yaw, t, tb) {
  const dt = Math.max(0, t - tb);
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  const d = plate.dir;
  const dw = [d[0] * c + d[2] * s, d[1], -d[0] * s + d[2] * c]; // the plate's outward direction in the world
  const v = [dw[0] * 3.2, 2.6 + dw[1] * 2, dw[2] * 3.2];
  const p0 = [origin[0] + dw[0] * R, origin[1] + dw[1] * R, origin[2] + dw[2] * R];
  // time to land: solve p0.y + v.y t - g t^2 / 2 = 0.06
  const tl = (v[1] + Math.sqrt(v[1] * v[1] + 2 * G * (p0[1] - 0.06))) / G;
  const tt = Math.min(dt, tl);
  return {
    p: [p0[0] + v[0] * tt, Math.max(0.06, p0[1] + v[1] * tt - 0.5 * G * tt * tt), p0[2] + v[2] * tt],
    spin: 9 * tt,
    landed: dt >= tl,
    age: dt,
  };
}

export function createSkull(scene) {
  const root = new THREE.Group(); // the floating skull
  scene.add(root);
  const mat = {
    gold: new THREE.MeshStandardMaterial({color: COL.gold, metalness: 0.55, roughness: 0.45, flatShading: true, side: THREE.DoubleSide}),
    goldDark: new THREE.MeshStandardMaterial({color: COL.goldDark, metalness: 0.4, roughness: 0.6, flatShading: true}),
    inner: new THREE.MeshStandardMaterial({color: COL.inner, roughness: 1, flatShading: true, side: THREE.BackSide}),
    socket: new THREE.MeshStandardMaterial({color: COL.socket, emissive: new THREE.Color(COL.eye), emissiveIntensity: 0, roughness: 1, flatShading: true}),
    coin: new THREE.MeshStandardMaterial({color: COL.coin, metalness: 0.6, roughness: 0.35, flatShading: true}),
  };
  const shadowed = (m) => {
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  };
  // the dark inner shell you see between parted plates
  const inner = shadowed(new THREE.Mesh(new THREE.IcosahedronGeometry(R * 0.9, 1), mat.inner));
  root.add(inner);
  // the core
  const core = createWeakpoints(root, 1, 0.24);
  // plates: each a pivot (placed by open/break) holding its lune and its details
  const plates = PLATES.map((p, i) => {
    const pivot = new THREE.Group();
    const geo = new THREE.SphereGeometry(R, 5, 3, p.phiStart, Math.PI / 2, p.thetaStart, Math.PI / 2);
    pivot.add(shadowed(new THREE.Mesh(geo, mat.gold)));
    // a dark rim ridge along the plate's lower or upper edge so the seams read
    if (i === BROW) {
      for (const sx of [-1, 1]) {
        const eye = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.15, 0.12), mat.socket);
        eye.position.set(sx * 0.2, 0.2, R * 0.86);
        eye.rotation.x = -0.25;
        pivot.add(eye);
      }
      const brow = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.08, 0.14), mat.goldDark));
      brow.position.set(0, 0.32, R * 0.78);
      brow.rotation.x = -0.45;
      pivot.add(brow);
    }
    if (i === JAW) {
      for (let k = 0; k < 6; k++) {
        const tooth = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 0.06), mat.goldDark));
        const a = -0.45 + k * 0.18;
        tooth.position.set(Math.sin(a) * R * 0.92, -0.06, Math.cos(a) * R * 0.92);
        pivot.add(tooth);
      }
    }
    // a coin-stack horn on each upper side plate: Greed's crown
    if (p.band === 0 && (p.k === 1 || p.k === 3)) {
      for (let c = 0; c < 4; c++) {
        const coin = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.11 - c * 0.018, 0.11 - c * 0.018, 0.05, 8), mat.goldDark));
        const sx = p.k === 3 ? 1 : -1;
        coin.position.set(sx * (R * 0.72 + c * 0.05), R * 0.62 + c * 0.07, -0.05);
        coin.rotation.z = -sx * 0.6;
        pivot.add(coin);
      }
    }
    scene.add(pivot); // plates are placed in world space so broken ones can leave the skull
    return {pivot, p};
  });
  const eyes = plates[BROW].pivot.children.filter((c) => c.material === mat.socket);

  // coins: thrown volleys and the death burst, one pool
  const MAXC = 64;
  const coins = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.09, 0.09, 0.025, 8), mat.coin, MAXC);
  coins.castShadow = true;
  coins.frustumCulled = false;
  scene.add(coins);

  const M = new THREE.Matrix4();
  const Q = new THREE.Quaternion();
  const Q2 = new THREE.Quaternion();
  const E = new THREE.Euler();
  const P3 = new THREE.Vector3();
  const S1 = new THREE.Vector3(1, 1, 1);
  const AX = new THREE.Vector3();
  const Y = new THREE.Vector3(0, 1, 0);

  /**
   * st: {origin [x,y,z], yaw, open, jaw, tell, broken: [tb|null x8], core: {...}, coins: [{p:[..], spin}], t}
   */
  const update = (st, camera) => {
    root.position.set(...st.origin);
    root.rotation.set(0, st.yaw, 0);
    root.updateMatrixWorld();
    plates.forEach(({pivot, p}, i) => {
      const tb = st.broken[i];
      if (tb != null && st.t >= tb) {
        const d = debris(p, st.origin, st.yaw, st.t, tb);
        pivot.matrixAutoUpdate = true;
        pivot.position.set(...d.p);
        E.set(d.spin, st.yaw + i, d.spin * 0.6);
        pivot.quaternion.setFromEuler(E);
        if (d.landed) pivot.quaternion.setFromEuler(E.set(p.band ? Math.PI : 0, st.yaw + i, 0)); // lies cup down or up
        pivot.scale.setScalar(d.landed ? 0.95 : 1);
        pivot.updateMatrixWorld();
        return;
      }
      // closed: at the skull; open: pushed out along its centre and hinged away from the core
      const rattle = st.tell * 0.025 * Math.sin(st.t * 61 + i * 2.1);
      const push = st.open * R * 0.55 + rattle;
      const dir = new THREE.Vector3(...p.dir);
      AX.crossVectors(Y, dir).normalize(); // horizontal hinge axis through the plate's own middle
      let ang = st.open * 0.42 * (p.band === 0 ? -1 : 1);
      if (i === JAW) ang += st.jaw * 0.5;
      Q.setFromAxisAngle(AX, ang);
      // turn about the plate's centroid (not the skull centre), then push it out along its centre
      const cen = dir.clone().multiplyScalar(R * 0.75);
      M.makeTranslation(cen.x + dir.x * push, cen.y + dir.y * push, cen.z + dir.z * push);
      M.multiply(new THREE.Matrix4().makeRotationFromQuaternion(Q));
      M.multiply(new THREE.Matrix4().makeTranslation(-cen.x, -cen.y, -cen.z));
      pivot.matrixAutoUpdate = false;
      pivot.matrix.multiplyMatrices(root.matrixWorld, M);
      pivot.matrixWorldNeedsUpdate = true;
    });
    for (const e of eyes) e.material.emissiveIntensity = st.tell * 3;
    // core: at the centre, its socket ring facing the skull's front
    core.face(camera);
    core.set(0, M.identity(), st.core); // the core's meshes are children of root already
    core.commit();
    // coins
    let n = 0;
    for (const c of st.coins) {
      if (n >= MAXC) break;
      E.set(c.spin, c.spin * 0.7, Math.PI / 2);
      Q2.setFromEuler(E);
      M.compose(P3.set(...c.p), Q2, S1);
      coins.setMatrixAt(n++, M);
    }
    M.makeScale(0, 0, 0);
    while (n < MAXC) coins.setMatrixAt(n++, M);
    coins.instanceMatrix.needsUpdate = true;
    // the inner shell shrinks away as the skull opens or loses plates, so the core is what you see
    const expose = Math.max(st.open, st.broken.filter((b) => b != null && st.t >= b).length / PLATES.length);
    const sc = Math.max(0.001, 1 - expose * 1.5);
    inner.scale.setScalar(sc);
    inner.visible = sc > 0.01;
  };
  return {root, update, plates, core, pickables: () => [core.mesh, ...plates.map((p) => p.pivot)]};
}

/** A coin thrown at t0 from p0 with velocity v, at time t; null before it is thrown or after it settles. */
export function coinAt(p0, v, t0, t) {
  const dt = t - t0;
  if (dt < 0) return null;
  const tl = (v[1] + Math.sqrt(v[1] * v[1] + 2 * G * Math.max(0, p0[1] - 0.02))) / G;
  const tt = Math.min(dt, tl);
  if (dt > tl + 4) return null;
  return {p: [p0[0] + v[0] * tt, Math.max(0.02, p0[1] + v[1] * tt - 0.5 * G * tt * tt), p0[2] + v[2] * tt], spin: dt < tl ? dt * 14 : 0};
}
