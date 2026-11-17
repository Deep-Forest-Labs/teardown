// THURIBLE CN-2, the machine's geometry, shared by the film and the Bestiary's Censer elite. Four planted legs carry
// a tower; the crank disc and its pin drive a slotted lever (two rails, a sliding block) whose end is the cup; the
// censer bowl swings on chains from a boom. pose() sets every moving part from the model (kin.js): nothing is keyed.
import * as THREE from 'three';
import {bowl, lever, W} from './kin.js';

const TAU = Math.PI * 2;

/** Build the machine under `root` with a parts kit K and materials `mat` (mat.blood is the burning load). */
export function buildMachine(root, K, mat) {
  // legs: four, planted, two-segment housings with drums
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const hip = [sx * 0.55, 1.4, sz * 0.55];
    const knee = [sx * 1.3, 1.75, sz * 1.2];
    const foot = [sx * 1.7, 0.08, sz * 1.6];
    K.orient(K.drum(0.13, 0.18), hip, [sz, 0, -sx]);
    K.place(K.housing(0.16, 0.14), hip, knee, [0, 1, 0], 0.24);
    K.orient(K.drum(0.11, 0.16), knee, [sz, 0, -sx]);
    K.place(K.housing(0.13, 0.12), knee, foot, [0, 1, 0], 0.2);
    K.mesh(new THREE.ConeGeometry(0.1, 0.22, 12).rotateX(Math.PI), mat.dark, root).position.set(...foot);
  }
  // the tower: a flesh housing from the hips up past the crank, a boom back to the bowl's hanger
  K.mesh(new THREE.CylinderGeometry(0.62, 0.7, 0.5, 28), mat.flesh, root).position.set(0, 1.4, 0);
  K.place(K.housing(0.36, 0.3), [0, 1.6, -0.15], [0, 3.0, -0.15], [0, 0, 1]);
  K.place(K.housing(0.18, 0.16, {stripe: false}), [0, 2.95, -0.15], [0, W.bowl.hang[1] + 0.1, W.bowl.hang[2]], [1, 0, 0]);
  K.orient(K.drum(0.14, 0.5), W.pivot, [1, 0, 0]);
  // crank disc (axis x) with its pin
  const crank = new THREE.Group();
  crank.position.set(0.32, W.crankC[1], W.crankC[2]);
  root.add(crank);
  K.mesh(new THREE.CylinderGeometry(W.crankR + 0.1, W.crankR + 0.1, 0.06, 36).rotateZ(Math.PI / 2), mat.dark, crank);
  K.mesh(new THREE.TorusGeometry(W.crankR + 0.07, 0.015, 8, 40).rotateY(Math.PI / 2).translate(0.035, 0, 0), mat.accent, crank);
  // the slotted lever: two rails from the pivot to the cup, a sliding block on the pin, the cup
  const lev = new THREE.Group();
  lev.position.set(0.2, W.pivot[1], W.pivot[2]);
  root.add(lev);
  for (const dz of [-0.07, 0.07]) K.mesh(new THREE.BoxGeometry(0.06, W.arm, 0.04).translate(0, W.arm / 2, dz), mat.bone, lev);
  for (const y of [0.3, W.slot[1] + 0.12, W.arm - 0.2]) K.mesh(new THREE.BoxGeometry(0.09, 0.05, 0.2).translate(0, y, 0), mat.steel, lev);
  const block = K.mesh(new THREE.BoxGeometry(0.12, 0.14, 0.12), mat.accent, lev);
  K.mesh(new THREE.SphereGeometry(0.3, 24, 12, 0, TAU, 0, Math.PI / 2).rotateX(Math.PI).translate(0, W.arm + 0.12, 0), mat.flesh, lev);
  const load = K.mesh(new THREE.SphereGeometry(0.18, 16, 10), mat.blood, lev);
  load.position.set(0, W.arm + 0.12, 0);
  // the bowl on chains
  const bowlG = new THREE.Group();
  root.add(bowlG);
  K.mesh(new THREE.SphereGeometry(0.42, 28, 14, 0, TAU, Math.PI / 2, Math.PI / 2), mat.flesh, bowlG);
  K.mesh(new THREE.TorusGeometry(0.42, 0.03, 8, 36).rotateX(Math.PI / 2), mat.accent, bowlG);
  K.mesh(new THREE.SphereGeometry(0.3, 18, 10, 0, TAU, 0, Math.PI / 2), mat.blood, bowlG);
  const chains = [-1, 1].map(() => K.mesh(new THREE.CylinderGeometry(0.015, 0.015, 1, 6), mat.dark, root));
  const A = new THREE.Vector3();
  const B2 = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0);
  return {
    load,
    bowl: bowlG,
    /** Pose every moving part for crank angle θ; the bowl from kin.bowl(θ, t), or a given bowl state {a, p}. */
    pose(theta, t, bowlState = bowl(theta, t)) {
      const L = lever(theta);
      crank.rotation.x = theta;
      lev.rotation.x = -L.ang;
      block.position.set(0, L.slide, 0); // the block rides the pin
      bowlG.position.set(...bowlState.p);
      bowlG.rotation.x = bowlState.a;
      [-0.18, 0.18].forEach((dx, i) => {
        A.set(dx, W.bowl.hang[1], W.bowl.hang[2]);
        B2.set(dx, bowlState.p[1] + 0.05, bowlState.p[2]);
        chains[i].position.copy(A).add(B2).multiplyScalar(0.5);
        chains[i].scale.y = A.distanceTo(B2);
        chains[i].quaternion.setFromUnitVectors(UP, B2.sub(A).normalize());
      });
      return {L, B: bowlState};
    },
  };
}
