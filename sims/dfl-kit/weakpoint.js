// SLUMBER prototype weak point: a glowing red orb in a dark socket ring. One InstancedMesh pool serves every weak point
// on a creature. Its look is a pure function of a small state per instance, so a film can scrub it and a live page can
// drive it:
//   open   0..1  how exposed it is (0 = shut, shrunk into the socket, dim; 1 = fully out and glowing)
//   hit    0..1  a hit flash (white-hot), decays in the caller
//   dead   0..1  popped: the orb bursts and leaves a dark, cracked socket
//   pulse  0..1  the idle throb, usually from time
// The orb is the thing to shoot. Everything else on the creature is armour.
import * as THREE from 'three';

export const WEAK = {
  core: new THREE.Color('#ff2414'),
  hot: new THREE.Color('#fff1d6'),
  dead: new THREE.Color('#1b0b09'),
  socket: '#120a09',
};

/**
 * n: how many weak points; radius in metres. Returns {set(i, matrix, state), commit(), count}.
 * The matrix places the socket: +Z is the direction the orb faces out of the body.
 */
export function createWeakpoints(scene, n, radius = 0.12) {
  const orbMat = new THREE.MeshStandardMaterial({color: '#4a0805', emissive: '#ffffff', emissiveIntensity: 1, roughness: 0.35, flatShading: true});
  const orbs = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(radius, 1), orbMat, n);
  orbs.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
  // emissive follows the instance colour: patch the shader so emissive is multiplied by vColor
  orbMat.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('vec3 totalEmissiveRadiance = emissive;', 'vec3 totalEmissiveRadiance = emissive * vColor.rgb * 2.2;');
  };
  orbMat.vertexColors = false; // instanceColor already feeds vColor
  const ringGeo = new THREE.TorusGeometry(radius * 1.15, radius * 0.32, 4, 8);
  const rings = new THREE.InstancedMesh(ringGeo, new THREE.MeshStandardMaterial({color: WEAK.socket, roughness: 0.9, flatShading: true}), n);
  // a soft halo card so the glow reads at distance and under the pixel filter, without a bloom pass
  const haloMat = new THREE.MeshBasicMaterial({color: '#ff3018', transparent: true, opacity: 1, depthWrite: false, blending: THREE.AdditiveBlending});
  const halos = new THREE.InstancedMesh(new THREE.CircleGeometry(radius * 1.9, 12), haloMat, n);
  halos.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
  for (const m of [orbs, rings, halos]) {
    m.frustumCulled = false;
    scene.add(m);
  }
  orbs.castShadow = rings.castShadow = true;

  const M = new THREE.Matrix4();
  const S = new THREE.Matrix4();
  const C = new THREE.Color();
  const P = new THREE.Vector3();
  const Q = new THREE.Quaternion();
  const V = new THREE.Vector3();
  let camQ = new THREE.Quaternion();
  return {
    count: n,
    mesh: orbs, // for click picking: a hit's instanceId is the weak point index
    /** Halos face the camera: pass its quaternion once per frame. */
    face(camera) {
      camQ = camera.quaternion;
    },
    set(i, matrix, {open = 1, hit = 0, dead = 0, pulse = 0} = {}) {
      rings.setMatrixAt(i, matrix);
      // the orb sits in the ring, pushed out along +Z as it opens, shrinking to nothing as it dies
      const out = (open - 0.5) * radius * 0.9;
      const sc = (0.55 + 0.45 * open) * (1 - dead) * (1 + 0.06 * pulse);
      S.makeScale(sc, sc, sc).setPosition(0, 0, out);
      M.multiplyMatrices(matrix, S);
      orbs.setMatrixAt(i, M);
      const glow = (0.25 + 0.75 * open) * (0.85 + 0.15 * pulse) * (1 - dead);
      C.copy(WEAK.dead).lerp(WEAK.core, glow).lerp(WEAK.hot, hit * (1 - dead));
      orbs.setColorAt(i, C);
      // halo at the orb, facing the camera, fading with exposure
      M.decompose(P, Q, V);
      const hs = (0.5 + 0.5 * open) * (1 - dead) + 1.4 * hit * (1 - dead);
      M.compose(P, camQ, V.set(hs, hs, hs));
      halos.setMatrixAt(i, M);
      C.setRGB(1, 0.19, 0.09).multiplyScalar(0.22 * glow + 0.6 * hit);
      halos.setColorAt(i, C);
    },
    commit() {
      for (const m of [orbs, rings, halos]) m.instanceMatrix.needsUpdate = true;
      orbs.instanceColor.needsUpdate = true;
      halos.instanceColor.needsUpdate = true;
    },
  };
}
