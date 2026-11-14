// IDOL ST-5: geometry and film. A plated flesh torso armoured at the front, a head with a slit optic, heavy hanging
// arms, legs of housings and drums on flat feet; on its back the exposed power pack: a flywheel turning on its shaft,
// its crank pin driving a piston through a connecting rod (a slider-crank, exact), glowing: the weak point.
// Film, 18 s: it walks you down (front, armoured), the camera circles behind to the pack, the pack isolated.
import * as THREE from 'three';
import {runSim} from '../kit/runtime.js';
import {keyed} from '../kit/util.js';
import {gear, consoleUI, materials, studio} from '../slumber-kit/studio.js';
import {partsKit} from '../slumber-kit/parts.js';
import {B, pose} from './kin.js';

export const DURATION = 18;
const SPEED = 0.55;
const sm = (u) => {
  const x = Math.min(1, Math.max(0, u));
  return x * x * x * (x * (x * 6 - 15) + 10);
};
const PACK = {crank: 0.16, rod: 0.48}; // slider-crank on the back

function build(scene) {
  const mat = materials();
  mat.glow = new THREE.MeshStandardMaterial({color: '#ff5a2a', emissive: new THREE.Color('#ff3a1c'), emissiveIntensity: 0.9});
  const root = new THREE.Group();
  scene.add(root);
  const K = partsKit(root, mat);
  const torso = new THREE.Group();
  root.add(torso);
  const Kt = partsKit(torso, mat);
  Kt.mesh(new THREE.CapsuleGeometry(0.6, 0.9, 6, 24).scale(1.15, 1, 0.75).translate(0, 0.95, 0), mat.fleshDeep, torso);
  // front armour: stacked flesh plates with rivets
  for (let k = 0; k < 5; k++) {
    const pl = Kt.mesh(new THREE.BoxGeometry(1.25 - k * 0.08, 0.3, 0.12), mat.flesh, torso);
    pl.position.set(0, 0.45 + k * 0.28, 0.48 + Math.sin(k * 0.7) * 0.02);
    for (const sx of [-1, 1]) Kt.mesh(new THREE.SphereGeometry(0.025, 6, 4), mat.dark, torso).position.set(sx * (0.55 - k * 0.04), 0.45 + k * 0.28, 0.55);
  }
  Kt.mesh(new THREE.BoxGeometry(1.3, 0.06, 0.14), mat.accent, torso).position.set(0, 1.85, 0.46);
  // head: a block with a slit optic
  const head = Kt.mesh(new THREE.BoxGeometry(0.5, 0.55, 0.5), mat.flesh, torso);
  head.position.set(0, 2.15, 0.08);
  Kt.mesh(new THREE.BoxGeometry(0.36, 0.06, 0.04), mat.glow, torso).position.set(0, 2.2, 0.34);
  // arms: shoulder drums, two housings each, hanging heavy
  for (const sx of [-1, 1]) {
    const sh = [sx * 0.85, 1.65, 0];
    const el = [sx * 0.95, 0.85, 0.12];
    const wr = [sx * 0.9, 0.05, 0.22];
    Kt.orient(Kt.drum(0.22, 0.3), sh, [1, 0, 0]);
    Kt.place(Kt.housing(0.3, 0.28), sh, el, [0, 0, 1], 0.3);
    Kt.orient(Kt.drum(0.17, 0.26), el, [1, 0, 0]);
    Kt.place(Kt.housing(0.26, 0.24), el, wr, [0, 0, 1], 0.24);
    Kt.mesh(new THREE.BoxGeometry(0.34, 0.3, 0.3), mat.fleshDeep, torso).position.set(...wr);
  }
  // the back pack: housing frame, flywheel, crank, rod, piston in its cylinder
  const pack = new THREE.Group();
  pack.position.set(0, 1.05, -0.55);
  torso.add(pack);
  Kt.mesh(new THREE.BoxGeometry(1.0, 1.1, 0.12).translate(0, 0, 0.05), mat.dark, pack);
  const fly = new THREE.Group();
  fly.position.set(-0.18, -0.15, -0.12);
  pack.add(fly);
  Kt.mesh(gear(0.32, 28, 0.08, 0.25), mat.steel, fly);
  Kt.mesh(new THREE.TorusGeometry(0.27, 0.025, 8, 36), mat.glow, fly);
  const pin = Kt.mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.16, 10).rotateX(Math.PI / 2), mat.accent, pack);
  const rod = Kt.housing(0.05, 0.04, {stripe: false, m: mat.bone});
  pack.add(rod);
  const cyl = Kt.mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.5, 18).translate(0, 0.55, -0.12), mat.glow, pack);
  void cyl;
  const piston = Kt.mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.18, 18), mat.steel, pack);
  // legs
  const legs = [0, 1].map(() => ({hip: K.drum(0.2, 0.3), thigh: K.housing(0.32, 0.3), knee: K.drum(0.18, 0.28), shank: K.housing(0.28, 0.26), ankle: K.drum(0.14, 0.24), foot: K.mesh(new THREE.BoxGeometry(...B.foot), mat.dark, root)}));
  return {
    update(t) {
      const w = SPEED * t;
      const P = pose(w, t);
      torso.position.set(P.pelvis[0], P.pelvis[1] - 0.15, P.pelvis[2]);
      P.legs.forEach((L, i) => {
        const G = legs[i];
        K.orient(G.hip, L.hip, [1, 0, 0]);
        K.place(G.thigh, L.hip, L.knee, [0, 0, 1], 0.38);
        K.orient(G.knee, L.knee, [1, 0, 0]);
        K.place(G.shank, L.knee, L.ankle, [0, 0, 1], 0.32);
        K.orient(G.ankle, L.ankle, [1, 0, 0]);
        G.foot.position.set(L.foot[0], L.foot[1] + B.foot[1] / 2, L.foot[2] + 0.12);
      });
      // slider-crank in the pack's plane (x across, y up); the piston slides along +y
      fly.rotation.z = -P.fly;
      const cp = [-0.18 + PACK.crank * Math.cos(P.fly), -0.15 + PACK.crank * Math.sin(P.fly), -0.2];
      pin.position.set(...cp);
      const px = 0;
      const py = cp[1] + Math.sqrt(PACK.rod * PACK.rod - (px - cp[0]) ** 2);
      piston.position.set(px, py, -0.12);
      Kt.place(rod, cp, [px, py, -0.2], [0, 0, 1]);
      return {P, py, cp};
    },
  };
}

const BEATS = [
  {t: 0, mode: 'ADVANCING', cap: 'ST-5 · IT WALKS YOU DOWN · THE FRONT IS PLATED, SHOTS GLANCE OFF'},
  {t: 7, mode: 'FLANK', cap: 'GET BEHIND IT · THE POWER PACK RIDES OPEN ON ITS BACK'},
  {t: 12, mode: 'WEAK POINT', cap: 'A FLYWHEEL AND A SLIDER-CRANK · THE GLOWING PACK IS ALL THAT TAKES DAMAGE'},
];
const CAM = [
  [0, [0, 2.4, 2, 10, 8, 11.5]],
  [6.6, [0, 2.4, 4, 20, 8, 11.5]],
  [9.6, [0, 2.6, 5, 175, 10, 8.5]],
  [11.6, [0, 2.6, 6, 190, 10, 8]],
  [12.4, [0, 2.95, 6.0, 175, 6, 2.9]],
  [18, [0, 2.95, 9.0, 200, 8, 3.1]],
];

export function run() {
  runSim({duration: DURATION, fps: 60, theme: 'light', hud: {enabled: false}, director: {enabled: false}, watermark: ''}, ({canvas, capture}) => {
    const st = studio(canvas, {capture, shadow: 6, fog: [25, 90]});
    const se = build(st.scene);
    const ui = consoleUI(document.getElementById('app'), {code: 'ST-5', eyebrow: 'RUINS ELITE · ONLY TAKES DAMAGE FROM BEHIND', title: 'Idol ST-5'});
    return {
      resize: st.resize,
      render(t) {
        const S = se.update(t);
        let [x, y, z, az, el, dist] = keyed(CAM, t, sm);
        z = S.P.pelvis[2] + (z - SPEED * t) * 0 + (t > 12 ? -0.6 : 0);
        st.aim([x, y, z], az, el, dist);
        st.render();
        const bi = BEATS.reduce((k, b, i) => (t >= b.t ? i : k), 0);
        ui.set({
          cap: BEATS[bi].cap,
          n: bi + 1,
          mode: BEATS[bi].mode,
          right: `WALKED ${(SPEED * t).toFixed(1)} m`,
          rows: [
            ['STRIDE', `${B.stride} m`],
            ['FEET DOWN', `${S.P.legs.filter((L) => L.stance).length} / 2`],
            ['FLYWHEEL', `${Math.round(((S.P.fly * 180) / Math.PI) % 360)}°`],
            ['PISTON', `${(S.py * 100).toFixed(0)} cm`],
          ],
          barsTitle: 'ARMOUR',
          bars: [['FRONT', 1], ['BACK', 0.05]],
          subs: [
            ['Front plates', 'DEFLECTING', bi === 0],
            ['Legs ×2', 'WALKING', false],
            ['Power pack', 'EXPOSED', bi >= 1],
          ],
        });
        return {};
      },
    };
  });
}
