// THURIBLE CN-2: geometry and film. Four planted legs carry a tower; the crank disc and its pin drive a slotted
// lever (two rails, a sliding block) whose end is the cup; the censer bowl swings on chains from a boom. Film, 20 s:
// idle swing, a burst of three throws (each shot ballistic from the release, a pool where it lands), the quick-return
// isolated, a second burst. render(t) is pure.
import * as THREE from 'three';
import {runSim} from '../kit/runtime.js';
import {keyed} from '../kit/util.js';
import {partsKit} from '../slumber-kit/parts.js';
import {consoleUI, materials, studio} from '../slumber-kit/studio.js';
import {bowl, cup, landing, lever, RELEASE_THETA, shot, W} from './kin.js';

export const DURATION = 20;
const OMEGA = 5.5; // crank rad/s while throwing
const TAU = Math.PI * 2;
const sm = (u) => {
  const x = Math.min(1, Math.max(0, u));
  return x * x * x * (x * (x * 6 - 15) + 10);
};
// the crank runs in two bursts of three turns; θ(t) in closed form
const BURSTS = [[3, 3 + (3 * TAU) / OMEGA], [12, 12 + (3 * TAU) / OMEGA]];
const thetaAt = (t) => {
  let th = RELEASE_THETA + 0.6; // parked just after a release: the arm leans forward, the cup empty
  for (const [a, b] of BURSTS) th += OMEGA * Math.max(0, Math.min(t, b) - a);
  return th;
};
// release times: each time θ passes RELEASE_THETA (mod 2π) inside a burst
const RELEASES = (() => {
  const out = [];
  for (const [a, b] of BURSTS) {
    for (let k = 1; k <= 3; k++) {
      const th0 = thetaAt(a);
      const need = Math.ceil((th0 - RELEASE_THETA) / TAU + 1e-9) + k - 1;
      const thR = RELEASE_THETA + need * TAU;
      const tR = a + (thR - th0) / OMEGA;
      if (tR <= b + 1e-6) out.push(tR);
    }
  }
  return out;
})();

function build(scene) {
  const mat = materials();
  mat.blood = new THREE.MeshStandardMaterial({color: '#8a0f12', emissive: new THREE.Color('#ff3a1c'), emissiveIntensity: 0.35, roughness: 0.25});
  const root = new THREE.Group();
  scene.add(root);
  const K = partsKit(root, mat);
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
  const cupMesh = K.mesh(new THREE.SphereGeometry(0.3, 24, 12, 0, TAU, 0, Math.PI / 2).rotateX(Math.PI).translate(0, W.arm + 0.12, 0), mat.flesh, lev);
  void cupMesh;
  const load = K.mesh(new THREE.SphereGeometry(0.18, 16, 10), mat.blood, lev);
  // the bowl on chains
  const bowlG = new THREE.Group();
  root.add(bowlG);
  K.mesh(new THREE.SphereGeometry(0.42, 28, 14, 0, TAU, Math.PI / 2, Math.PI / 2), mat.flesh, bowlG);
  K.mesh(new THREE.TorusGeometry(0.42, 0.03, 8, 36).rotateX(Math.PI / 2), mat.accent, bowlG);
  K.mesh(new THREE.SphereGeometry(0.3, 18, 10, 0, TAU, 0, Math.PI / 2), mat.blood, bowlG);
  const chains = [-1, 1].map(() => K.mesh(new THREE.CylinderGeometry(0.015, 0.015, 1, 6), mat.dark, root));
  const shots = RELEASES.map(() => K.mesh(new THREE.SphereGeometry(0.2, 16, 10), mat.blood, root));
  const pools = RELEASES.map(() => K.mesh(new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2), mat.blood, root));
  return {
    update(t) {
      const theta = thetaAt(t);
      const L = lever(theta);
      crank.rotation.x = theta;
      lev.rotation.x = -L.ang;
      // the block rides the pin: its distance along the lever
      block.position.set(0, L.slide, 0);
      // the cup carries a load from the last release until the next one
      const last = RELEASES.filter((r) => r <= t).pop() ?? -1;
      const next = RELEASES.find((r) => r > t);
      load.visible = next !== undefined && (next - t) < (TAU / OMEGA) * 0.9 && t - last > 0.08;
      load.position.set(0, W.arm + 0.12, 0);
      const B = bowl(theta, t);
      bowlG.position.set(...B.p);
      bowlG.rotation.x = B.a;
      [-0.18, 0.18].forEach((dx, i) => {
        const a = new THREE.Vector3(dx, W.bowl.hang[1], W.bowl.hang[2]);
        const b = new THREE.Vector3(dx, B.p[1] + 0.05, B.p[2]);
        chains[i].position.copy(a).add(b).multiplyScalar(0.5);
        chains[i].scale.y = a.distanceTo(b);
        chains[i].quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
      });
      const Ld = landing(OMEGA);
      RELEASES.forEach((tr, i) => {
        const tau = t - tr;
        shots[i].visible = tau >= 0 && tau < Ld.T;
        if (shots[i].visible) shots[i].position.set(...shot(OMEGA, tau));
        const age = t - (tr + Ld.T);
        pools[i].visible = age >= 0;
        if (age >= 0) {
          pools[i].position.set(0.4 * Math.sin(i * 2.1), 0.012 + i * 0.002, Ld.at[2] + 0.35 * Math.cos(i * 1.7));
          pools[i].scale.setScalar(0.25 + 1.2 * Math.sqrt(Math.min(age, 3) / 3));
        }
      });
      return {theta, L, B};
    },
  };
}

const BEATS = [
  {t: 0, mode: 'SWINGING', cap: 'CN-2 · THE BOWL SWINGS ON ITS CHAINS · THE SWING GROWS BEFORE EACH THROW'},
  {t: 3, mode: 'LOBBING', cap: 'QUICK RETURN: SLOW WIND-UP, FAST THROW · THE SHOT CLIMBS AND POOLS'},
  {t: 7.6, mode: 'QUICK RETURN', cap: 'A CRANK PIN SLIDES IN A SLOTTED LEVER · THE THROW IS THE SHORT STROKE'},
  {t: 12, mode: 'LOBBING', cap: 'THREE MORE · THE POOLS SPREAD WHERE THEY LAND'},
];
const CAM = [
  [0, [0, 2.4, 3, 70, 14, 12]],
  [2.6, [0, 2.4, 4, 85, 12, 14]],
  [7.4, [0, 2.6, 5, 95, 14, 15]],
  [8.2, [0.2, 2.3, 0.2, 90, 6, 4.2]],
  [11.4, [0.2, 2.3, 0.2, 80, 8, 4.4]],
  [12.2, [0, 2.4, 5, 110, 16, 16]],
  [20, [0, 2.4, 5, 130, 20, 17]],
];

export function run() {
  runSim({duration: DURATION, fps: 60, theme: 'light', hud: {enabled: false}, director: {enabled: false}, watermark: ''}, ({canvas, capture}) => {
    const st = studio(canvas, {capture, shadow: 10, fog: [40, 140]});
    const cn = build(st.scene);
    const ui = consoleUI(document.getElementById('app'), {code: 'CN-2', eyebrow: 'ALTAR ELITE · LOBS BURNING BLOOD THAT POOLS', title: 'Thurible CN-2'});
    const Ld = landing(OMEGA);
    return {
      resize: st.resize,
      render(t) {
        const S = cn.update(t);
        const [x, y, z, az, el, dist] = keyed(CAM, t, sm);
        st.aim([x, y, z], az, el, dist);
        st.render();
        const bi = BEATS.reduce((k, b, i) => (t >= b.t ? i : k), 0);
        const throwing = BURSTS.some(([a, b]) => t > a && t < b);
        ui.set({
          cap: BEATS[bi].cap,
          n: bi + 1,
          mode: BEATS[bi].mode,
          right: `CRANK ${Math.round((((S.theta * 180) / Math.PI) % 360 + 360) % 360)}°`,
          rows: [
            ['CRANK', throwing ? `${((OMEGA * 60) / TAU).toFixed(0)} rpm` : 'PARKED'],
            ['LEVER', `${((S.L.ang * 180) / Math.PI).toFixed(1)}°`],
            ['PIN IN SLOT', `${S.L.slide.toFixed(2)} m`],
            ['RANGE', `${Ld.at[2].toFixed(1)} m`],
            ['FLIGHT', `${Ld.T.toFixed(2)} s`],
            ['BOWL', `${((S.B.a * 180) / Math.PI).toFixed(1)}°`],
          ],
          barsTitle: 'SWING',
          bars: [['BOWL', Math.abs(S.B.a) / 0.6]],
          subs: [
            ['Legs ×4', 'PLANTED', false],
            ['Crank · slotted lever', throwing ? 'THROWING' : 'PARKED', throwing],
            ['Cup', 'LOADED', false],
            ['Bowl · chains', Math.abs(S.B.a) > 0.35 ? 'SWINGING HIGH' : 'SWINGING', Math.abs(S.B.a) > 0.35],
          ],
        });
        void cup;
        return {};
      },
    };
  });
}
