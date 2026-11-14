// LANTERN OB-5: geometry and film. A squat flesh base on four legs, a glass lantern head with four bull's-eye panels
// (concentric Fresnel rings) round a lamp, a beam from each panel sweeping the floor; on its back the weight tower (the
// weight visible through a slot), the winding drum and a two-gear train up to the lens. Film, 18 s: the sweep over
// posts round it (each flashes as a beam crosses), the lens close, the clockwork close. render(t) is pure.
import * as THREE from 'three';
import {runSim} from '../kit/runtime.js';
import {keyed} from '../kit/util.js';
import {gear, consoleUI, materials, studio} from '../slumber-kit/studio.js';
import {partsKit} from '../slumber-kit/parts.js';
import {beams, drumAt, flashPeriod, L, lensAt, TAU, weightAt} from './kin.js';

export const DURATION = 18;
const sm = (u) => {
  const x = Math.min(1, Math.max(0, u));
  return x * x * x * (x * (x * 6 - 15) + 10);
};
const POSTS = [0.4, 1.9, 3.2, 4.6, 5.5].map((a, i) => [Math.sin(a) * (9 + (i % 2) * 4), Math.cos(a) * (9 + (i % 2) * 4)]);

function build(scene) {
  const mat = materials();
  mat.glass = new THREE.MeshPhysicalMaterial({color: '#dfe6e8', transparent: true, opacity: 0.18, depthWrite: false, roughness: 0.05});
  mat.beam = new THREE.MeshBasicMaterial({color: '#ffcf8a', transparent: true, opacity: 0.38, depthWrite: false, side: THREE.DoubleSide});
  mat.lamp = new THREE.MeshStandardMaterial({color: '#fff2d8', emissive: new THREE.Color('#ffd28a'), emissiveIntensity: 1});
  const root = new THREE.Group();
  scene.add(root);
  const K = partsKit(root, mat);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const hip = [sx * 0.7, 1.6, sz * 0.7];
    const knee = [sx * 1.5, 2.0, sz * 1.5];
    const foot = [sx * 1.9, 0.05, sz * 1.9];
    K.orient(K.drum(0.16, 0.2), hip, [sz, 0, -sx]);
    K.place(K.housing(0.2, 0.18), hip, knee, [0, 1, 0], 0.26);
    K.orient(K.drum(0.14, 0.18), knee, [sz, 0, -sx]);
    K.place(K.housing(0.17, 0.15), knee, foot, [0, 1, 0], 0.2);
  }
  K.mesh(new THREE.CylinderGeometry(0.95, 1.1, 1.3, 32).translate(0, 2.1, 0), mat.flesh, root);
  K.mesh(new THREE.TorusGeometry(1.0, 0.04, 8, 40).rotateX(Math.PI / 2).translate(0, 2.75, 0), mat.accent, root);
  // the lantern: glass cylinder, a roof, the lamp and the rotating lens
  const lampY = L.lampY;
  K.mesh(new THREE.CylinderGeometry(0.85, 0.85, 1.4, 32, 1, true).translate(0, lampY, 0), mat.glass, root);
  K.mesh(new THREE.ConeGeometry(1.05, 0.7, 32).translate(0, lampY + 1.05, 0), mat.fleshDeep, root);
  K.mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.12, 32).translate(0, lampY - 0.72, 0), mat.dark, root);
  K.mesh(new THREE.SphereGeometry(0.16, 16, 12).translate(0, lampY, 0), mat.lamp, root);
  const lens = new THREE.Group();
  lens.position.y = lampY;
  root.add(lens);
  const beamMeshes = [];
  for (let k = 0; k < L.panels; k++) {
    const p = new THREE.Group();
    p.rotation.y = -(k / L.panels) * TAU;
    lens.add(p);
    K.mesh(new THREE.BoxGeometry(0.5, 0.9, 0.03).translate(0, 0, 0.6), mat.bone, p);
    for (let r = 1; r <= 4; r++) K.mesh(new THREE.TorusGeometry(r * 0.055, 0.008, 6, 24).translate(0, 0, 0.62), mat.accent, p);
    const beam = K.mesh(new THREE.ConeGeometry(1.6, 24, 20, 1, true).rotateX(-Math.PI / 2).translate(0, -0.3, 12.6).rotateX(0.07), mat.beam, p);
    beam.castShadow = false;
    beamMeshes.push(beam);
  }
  // the clockwork on the back: weight tower, weight, drum, gear train
  const back = new THREE.Group();
  back.position.set(0, 0, -1.55); // clear of the lantern deck (r 0.9) and the gears' 0.32 m wheel
  root.add(back);
  K.mesh(new THREE.BoxGeometry(0.4, L.tower, 0.3).translate(0, L.tower / 2 + 0.5, -0.1), mat.fleshDeep, back);
  K.mesh(new THREE.BoxGeometry(0.12, L.tower - 0.4, 0.32).translate(0, L.tower / 2 + 0.5, -0.1), mat.dark, back);
  const weight = K.mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.35, 16), mat.steel, back);
  const drum = K.mesh(new THREE.CylinderGeometry(L.drumR, L.drumR, 0.25, 20).rotateZ(Math.PI / 2), mat.dark, back);
  drum.position.set(0, L.tower + 0.7, 0.1);
  const g1 = K.mesh(gear(0.32, 32, 0.05), mat.steel, back);
  g1.position.set(0.25, L.tower + 0.7, 0.2);
  g1.rotation.y = Math.PI / 2;
  const g2 = K.mesh(gear(0.1, 10, 0.05), mat.accent, back);
  g2.position.set(0.25, L.tower + 0.7 + 0.42, 0.2);
  g2.rotation.y = Math.PI / 2;
  const posts = POSTS.map(([x, z]) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.35, 1.8, 20).translate(0, 0.9, 0), new THREE.MeshStandardMaterial({color: '#cfc6b6', roughness: 0.8, emissive: new THREE.Color('#ff5a2a'), emissiveIntensity: 0}));
    m.position.set(x, 0, z);
    m.castShadow = true;
    scene.add(m);
    return m;
  });
  return {
    update(t) {
      lens.rotation.y = -lensAt(t);
      const wy = weightAt(t);
      weight.position.set(0, wy + 0.5, -0.1);
      drum.rotation.x = drumAt(t);
      g1.rotation.z = drumAt(t);
      g2.rotation.z = -drumAt(t) * 3.2;
      // posts flash while a beam crosses their bearing
      const B = beams(t);
      posts.forEach((p, i) => {
        const bearing = Math.atan2(POSTS[i][0], POSTS[i][1]);
        const near = Math.min(...B.map((b) => {
          const d = Math.abs(((bearing - b) % TAU + TAU + Math.PI) % TAU - Math.PI);
          return d;
        }));
        p.material.emissiveIntensity = Math.max(0, 1 - near / 0.12) * 0.8;
      });
      return {wy};
    },
  };
}

const BEATS = [
  {t: 0, mode: 'SWEEPING', cap: 'OB-5 · A FRESNEL LENS OF FOUR PANELS · FOUR BEAMS SWEEP THE FLOOR'},
  {t: 8, mode: 'LENS', cap: 'EACH BULL’S-EYE THROWS A BEAM · A FLASH EVERY 60 ÷ (RPM × PANELS) = 6 S'},
  {t: 13, mode: 'CLOCKWORK', cap: 'A FALLING WEIGHT TURNS THE DRUM · A GEAR TRAIN STEPS IT UP TO THE LENS'},
];
const CAM = [
  [0, [0, 2, 0, 30, 34, 26]],
  [7.6, [0, 2, 0, 80, 32, 26]],
  [8.4, [0, L.lampY, 0, 40, 10, 4.2]],
  [12.6, [0, L.lampY, 0, 70, 12, 4.2]],
  [13.4, [0.25, L.tower + 0.8, -1.55, 150, 8, 3.4]],
  [18, [0.25, L.tower + 0.4, -1.55, 185, 10, 3.8]],
];

export function run() {
  runSim({duration: DURATION, fps: 60, theme: 'light', hud: {enabled: false}, director: {enabled: false}, watermark: ''}, ({canvas, capture}) => {
    const st = studio(canvas, {capture, shadow: 14, fog: [40, 140]});
    const ob = build(st.scene);
    const ui = consoleUI(document.getElementById('app'), {code: 'OB-5', eyebrow: 'WRATH ELITE · SWEEPS A BEAM ACROSS THE ARENA', title: 'Lantern OB-5'});
    return {
      resize: st.resize,
      render(t) {
        const S = ob.update(t);
        const [x, y, z, az, el, dist] = keyed(CAM, t, sm);
        st.aim([x, y, z], az, el, dist);
        st.render();
        const bi = BEATS.reduce((k, b, i) => (t >= b.t ? i : k), 0);
        ui.set({
          cap: BEATS[bi].cap,
          n: bi + 1,
          mode: BEATS[bi].mode,
          right: `LENS ${Math.round(((lensAt(t) * 180) / Math.PI) % 360)}°`,
          rows: [
            ['LENS', `${L.rpm} rpm`],
            ['PANELS', `${L.panels}`],
            ['FLASH', `every ${flashPeriod().toFixed(1)} s`],
            ['DRUM', `${((drumAt(t) * 180) / Math.PI).toFixed(0)}°`],
            ['WEIGHT', `${S.wy.toFixed(2)} m`],
          ],
          barsTitle: 'WEIGHT LEFT',
          bars: [['DROP', S.wy / L.weightStart]],
          subs: [
            ['Fresnel lens ×4', 'TURNING', bi < 2],
            ['Lamp', 'LIT', false],
            ['Weight · drum · train', 'RUNNING', bi === 2],
          ],
        });
        return {};
      },
    };
  });
}
