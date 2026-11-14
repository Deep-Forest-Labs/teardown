// LURE SR-4: geometry and film. A slender flesh column on three legs; the siren head (a slotted stator, the rotor
// spinning inside, two flared horns); on the chest the winch drum, the level-wind carriage on its diamond screw, and
// the harpoon launcher. Film, 14 s: the siren winds up (the tell), the harpoon flies and hooks, the drum reels the
// target in while the level-wind lays the cable. render(t) is pure.
import * as THREE from 'three';
import {runSim} from '../kit/runtime.js';
import {partsKit} from '../slumber-kit/parts.js';
import {consoleUI, materials, studio} from '../slumber-kit/studio.js';
import {harpoon, levelWind, pitchHz, reel, rpmAt, S, SCRIPT, TAU} from './kin.js';

export const DURATION = 14;
const TARGET = [1.5, 0.9, 11];
const H = harpoon(TARGET);
const T_HOOK = SCRIPT.fire + H.T;

function build(scene) {
  const mat = materials();
  mat.cable = new THREE.MeshStandardMaterial({color: '#2c2a28', roughness: 0.7});
  const root = new THREE.Group();
  scene.add(root);
  const K = partsKit(root, mat);
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * TAU + Math.PI / 2;
    K.place(K.housing(0.14, 0.12), [0, 0.9, 0], [Math.cos(a) * 1.1, 0.06, Math.sin(a) * 1.1], [0, 1, 0], 0.1);
  }
  K.mesh(new THREE.LatheGeometry([[0.0, 0.85], [0.42, 0.9], [0.3, 1.6], [0.22, 2.6], [0.3, 3.1], [0.0, 3.15]].map(([r, y]) => new THREE.Vector2(r, y)), 32), mat.flesh, root);
  // siren head: slotted stator (bars), rotor inside, two horns
  const head = new THREE.Group();
  head.position.set(0, 3.45, 0);
  root.add(head);
  for (let k = 0; k < S.ports; k++) {
    const a = (k / S.ports) * TAU;
    K.mesh(new THREE.BoxGeometry(0.06, 0.4, 0.08).translate(Math.cos(a) * 0.3, 0, Math.sin(a) * 0.3), mat.bone, head).rotation.y = -a;
  }
  for (const y of [-0.22, 0.22]) K.mesh(new THREE.TorusGeometry(0.31, 0.03, 8, 32).rotateX(Math.PI / 2).translate(0, y, 0), mat.accent, head);
  const rotor = new THREE.Group();
  head.add(rotor);
  for (let k = 0; k < S.ports; k++) K.mesh(new THREE.BoxGeometry(0.22, 0.34, 0.03).translate(0.13, 0, 0), mat.dark, rotor).rotation.y = (k / S.ports) * TAU;
  for (const sx of [-1, 1]) K.mesh(new THREE.CylinderGeometry(0.34, 0.08, 0.7, 24, 1, true).rotateZ((sx * Math.PI) / 2).translate(sx * 0.65, 0, 0), mat.fleshDeep, head).material.side = THREE.DoubleSide;
  // winch on the chest: drum (axis x), cable wraps, level-wind screw and carriage, launcher
  const chest = new THREE.Group();
  chest.position.set(0, 2.2, 0.32);
  root.add(chest);
  const drum = new THREE.Group();
  chest.add(drum);
  K.mesh(new THREE.CylinderGeometry(S.drum.r, S.drum.r, S.drum.width, 28).rotateZ(Math.PI / 2), mat.steel, drum);
  for (const sx of [-1, 1]) K.mesh(new THREE.CylinderGeometry(S.drum.r + 0.08, S.drum.r + 0.08, 0.03, 28).rotateZ(Math.PI / 2).translate((sx * S.drum.width) / 2, 0, 0), mat.dark, chest);
  const wraps = K.mesh(new THREE.CylinderGeometry(S.drum.r + 0.02, S.drum.r + 0.02, S.drum.width - 0.04, 28).rotateZ(Math.PI / 2), mat.cable, chest);
  const screw = new THREE.Group();
  screw.position.set(0, 0.2, 0.22);
  chest.add(screw);
  K.mesh(new THREE.CylinderGeometry(0.025, 0.025, S.drum.width + 0.1, 12).rotateZ(Math.PI / 2), mat.bone, screw);
  const helix = [];
  for (let k = 0; k <= 60; k++) {
    const u = k / 60;
    helix.push(new THREE.Vector3(-S.drum.width / 2 + u * S.drum.width, Math.cos(u * 30) * 0.03, Math.sin(u * 30) * 0.03));
  }
  K.mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(helix), 120, 0.006, 4), mat.dark, screw);
  const carriage = K.mesh(new THREE.BoxGeometry(0.08, 0.1, 0.1), mat.accent, chest);
  const cable = K.housing(0.012, 0.012, {stripe: false, m: mat.cable});
  const harpoonM = K.mesh(new THREE.ConeGeometry(0.06, 0.4, 10).rotateX(Math.PI / 2), mat.dark, root);
  return {
    update(t) {
      rotor.rotation.y = ((rpmAt(t) / 60) * TAU * t) % TAU;
      // the harpoon: in the launcher, in flight, hooked; then reeled
      const tau = t - SCRIPT.fire;
      const R = reel(t, H.dist);
      drum.rotation.x = -R.theta;
      const lw = levelWind(R.theta);
      carriage.position.set(lw, 0.2, 0.22);
      wraps.scale.set(1, 1, 1);
      const chestW = [0, 2.2, 0.32 + 0.22];
      let tip;
      if (tau < 0) tip = S.muzzle;
      else if (t < T_HOOK) tip = H.at(tau);
      else {
        // hooked: the target is dragged along the line toward the siren as the cable shortens
        const dir = [TARGET[0] - S.muzzle[0], TARGET[1] - S.muzzle[1], TARGET[2] - S.muzzle[2]];
        const d = Math.hypot(...dir);
        tip = [0, 1, 2].map((i) => S.muzzle[i] + (dir[i] / d) * R.L);
      }
      harpoonM.position.set(...tip);
      harpoonM.lookAt(tip[0] + (TARGET[0] - S.muzzle[0]), tip[1], tip[2] + (TARGET[2] - S.muzzle[2]));
      cable.visible = tau >= 0;
      if (tau >= 0) K.place(cable, [lw, chestW[1] + 0.2, chestW[2]], tip, [0, 1, 0]);
      return {tip, R, lw};
    },
  };
}

const BEATS = [
  {t: 0, mode: 'SINGING', cap: 'SR-4 · A SLOTTED ROTOR CHOPS THE AIR · PITCH = RPM × PORTS ÷ 60 (THE TELL)'},
  {t: SCRIPT.fire, mode: 'HARPOON', cap: 'THE HARPOON FLIES AND HOOKS'},
  {t: SCRIPT.reel[0], mode: 'REELING', cap: 'THE DRUM REELS YOU IN · A DIAMOND SCREW LAYS THE CABLE A PITCH PER TURN'},
];

export function run() {
  runSim({duration: DURATION, fps: 60, theme: 'light', hud: {enabled: false}, director: {enabled: false}, watermark: ''}, ({canvas, capture}) => {
    const st = studio(canvas, {capture, shadow: 9, fog: [35, 110]});
    const sr = build(st.scene);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.35, 1.8, 20).translate(0, 0.9, 0), new THREE.MeshStandardMaterial({color: '#cfc6b6', roughness: 0.8}));
    post.castShadow = true;
    st.scene.add(post);
    const ui = consoleUI(document.getElementById('app'), {code: 'SR-4', eyebrow: 'LUST ELITE · SINGS A PULL THAT DRAGS YOU IN', title: 'Lure SR-4'});
    return {
      resize: st.resize,
      render(t) {
        const S2 = sr.update(t);
        const hooked = t >= T_HOOK;
        post.position.set(hooked ? S2.tip[0] : TARGET[0], 0, hooked ? S2.tip[2] : TARGET[2]);
        const close = t < 3.5 ? 1 : t > 6.2 && t < 9 ? 0.7 : 0;
        st.aim([0.5 + (1 - close) * 0.8, 2.9 + (1 - close) * -1.1, 1.5 + (1 - close) * 3.5], 70 - close * 20, 10, 6 + (1 - close) * 8);
        st.render();
        const bi = BEATS.reduce((k, b, i) => (t >= b.t ? i : k), 0);
        ui.set({
          cap: BEATS[bi].cap,
          n: bi + 1,
          mode: BEATS[bi].mode,
          right: `${pitchHz(rpmAt(t)).toFixed(0)} Hz`,
          rows: [
            ['ROTOR', `${rpmAt(t).toFixed(0)} rpm`],
            ['PORTS', `${S.ports}`],
            ['CABLE', `${S2.R.L.toFixed(2)} m`],
            ['DRUM', `${(S2.R.theta / TAU).toFixed(1)} turns`],
            ['LEVEL-WIND', `${(S2.lw * 100).toFixed(1)} cm`],
          ],
          barsTitle: 'PITCH',
          bars: [['HZ', pitchHz(rpmAt(t)) / 500]],
          subs: [
            ['Siren rotor', rpmAt(t) > 2000 ? 'SCREAMING' : 'WINDING', bi === 0],
            ['Harpoon', t < SCRIPT.fire ? 'LOADED' : hooked ? 'HOOKED' : 'FLYING', bi === 1],
            ['Winch · level-wind', t > SCRIPT.reel[0] ? 'REELING' : 'HOLD', bi === 2],
          ],
        });
        return {};
      },
    };
  });
}
