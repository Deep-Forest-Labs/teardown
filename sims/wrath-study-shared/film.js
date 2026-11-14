// WRATH study: geometry and film. The yard is a lock chamber between two cell blocks (their faces are the chamber
// walls, with cantilevered galleries at 3, 6 and 9 m); the fire is the chamber's fill; a mitre gate (two leaves in
// wall recesses, a walkway on top at the second tier) crosses mid-yard; the north end is the upper gate wall with the
// mule incline behind it. Amon is the mule. Film, 24 s: fill-and-drain waves (Torricelli), Amon climbing the incline,
// his beam sweeping, then the fill held under tier two and the gate leaves swinging shut to meet mid-yard.
// render(t) is pure.
import * as THREE from 'three';
import {runSim} from '../kit/runtime.js';
import {keyed} from '../kit/util.js';
import {partsKit} from '../slumber-kit/parts.js';
import {consoleUI, materials, studio} from '../slumber-kit/studio.js';
import {CLOSED, fill, leaf, Lk, WAVE, waveLevel} from './kin.js';

export const DURATION = 24;
const sm = (u) => {
  const x = Math.min(1, Math.max(0, u));
  return x * x * x * (x * (x * 6 - 15) + 10);
};
const LEN = 60;
const levelAt = (t) => (t < 16 ? waveLevel(t) : fill(waveLevel(16), t - 16, Lk.holdTop));
const gateAt = (t) => CLOSED * sm((t - 18) / 4);
const INC = {z0: -LEN / 2 - 18, z1: -LEN / 2 - 0.5};
const muleAt = (t) => sm((t - 4) / 6);

function build(scene) {
  const mat = materials();
  mat.fire = new THREE.MeshStandardMaterial({color: '#ff6a1f', emissive: new THREE.Color('#ff4a12'), emissiveIntensity: 0.9, roughness: 0.4, transparent: true, opacity: 0.92});
  mat.block = new THREE.MeshStandardMaterial({color: '#b7aca0', roughness: 0.85});
  mat.cell = new THREE.MeshStandardMaterial({color: '#3a3330', roughness: 0.9});
  mat.beam = new THREE.MeshBasicMaterial({color: '#ffd28a', transparent: true, opacity: 0.3, depthWrite: false});
  const root = new THREE.Group();
  scene.add(root);
  const K = partsKit(root, mat);
  const hw = Lk.W / 2;
  // chamber floor and the two cell blocks
  K.mesh(new THREE.BoxGeometry(Lk.W, 0.4, LEN).translate(0, -0.2, 0), mat.dark, root);
  for (const s of [-1, 1]) {
    K.mesh(new THREE.BoxGeometry(10, 9, LEN).translate(s * (hw + 5), 4.5, 0), mat.block, root);
    // cell doors on the face, three rows
    for (let row = 0; row < 3; row++) {
      for (let c = -6; c <= 6; c++) {
        const z = c * 4.4;
        if (row < 2 && z > -12 && z < 1.2) continue; // the gate recess
        K.mesh(new THREE.BoxGeometry(0.1, 2.2, 1.6).translate(s * (hw + 0.02), row * 3 + 1.3, z), mat.cell, root);
      }
    }
    // galleries (cantilevered), cut at the gate bay below tier two
    for (const [y, cut] of [[3, true], [6, false], [9, false]]) {
      if (cut) {
        K.mesh(new THREE.BoxGeometry(2, 0.3, LEN / 2 - 12).translate(s * (hw - 1), y, -LEN / 2 + (LEN / 2 - 12) / 2), mat.steel, root);
        K.mesh(new THREE.BoxGeometry(2, 0.3, LEN / 2 - 1.2).translate(s * (hw - 1), y, 1.2 + (LEN / 2 - 1.2) / 2), mat.steel, root);
      } else K.mesh(new THREE.BoxGeometry(2, 0.3, LEN).translate(s * (hw - 1), y, 0), mat.steel, root);
    }
  }
  // the north gate wall (upper level) and the mule incline behind it
  K.mesh(new THREE.BoxGeometry(Lk.W + 20, 9, 2).translate(0, 4.5, -LEN / 2 - 1), mat.block, root);
  const incLen = Math.hypot(INC.z1 - INC.z0, 9);
  const inc = K.mesh(new THREE.BoxGeometry(8, 0.6, incLen), mat.block, root);
  inc.position.set(0, 4.5, (INC.z0 + INC.z1) / 2);
  inc.rotation.x = Math.atan2(9, INC.z1 - INC.z0);
  const rack = K.mesh(new THREE.BoxGeometry(0.5, 0.3, incLen), mat.accent, root);
  rack.position.set(0, 4.85, (INC.z0 + INC.z1) / 2);
  rack.rotation.x = inc.rotation.x;
  // the fire
  const fire = K.mesh(new THREE.BoxGeometry(Lk.W - 0.1, 1, LEN - 0.1).translate(0, 0.5, 0), mat.fire, root);
  // the mitre gate leaves
  const leaves = [-1, 1].map((s) => {
    const g = new THREE.Group();
    g.position.set(s * hw, 0, Lk.gateZ);
    root.add(g);
    K.mesh(new THREE.BoxGeometry(0.9, Lk.tiers[1], Lk.leaf).translate(0, Lk.tiers[1] / 2, -Lk.leaf / 2), mat.fleshDeep, g);
    K.mesh(new THREE.BoxGeometry(1.6, 0.25, Lk.leaf).translate(0, Lk.tiers[1] + 0.12, -Lk.leaf / 2), mat.steel, g);
    for (let i = 1; i < 4; i++) K.mesh(new THREE.BoxGeometry(1, 0.2, Lk.leaf).translate(0, i * 1.5, -Lk.leaf / 2), mat.dark, g);
    return {g, s};
  });
  // Amon, the mule: a giant locomotive with a rack pinion, a cab head and an eye lamp
  const mule = new THREE.Group();
  root.add(mule);
  const Km = partsKit(mule, mat);
  Km.mesh(new THREE.BoxGeometry(7, 4, 10).translate(0, 2.6, 0), mat.flesh, mule);
  Km.mesh(new THREE.BoxGeometry(5, 3.4, 4).translate(0, 6, 2.2), mat.fleshDeep, mule);
  for (const z of [-3, 3]) for (const x of [-3.2, 3.2]) Km.mesh(new THREE.CylinderGeometry(1, 1, 0.6, 16).rotateZ(Math.PI / 2).translate(x, 1, z), mat.dark, mule);
  const pinion = Km.mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.5, 12).rotateZ(Math.PI / 2).translate(0, 0.9, 0), mat.accent, mule);
  const eye = Km.mesh(new THREE.SphereGeometry(0.6, 16, 12).translate(0, 6.4, 4.25), mat.accent, mule);
  const beam = new THREE.Mesh(new THREE.ConeGeometry(4, 40, 24, 1, true).rotateX(-Math.PI / 2).translate(0, 0, 20), mat.beam);
  scene.add(beam);
  return {
    update(t) {
      const y = levelAt(t);
      fire.scale.y = Math.max(0.01, y);
      fire.visible = y > 0.02;
      const g = gateAt(t);
      for (const L of leaves) L.g.rotation.y = L.s * g; // each leaf swings toward the centre
      const m = muleAt(t);
      const z = INC.z0 + (INC.z1 - INC.z0) * m;
      const my = (9 * (z - INC.z0)) / (INC.z1 - INC.z0);
      const onTop = Math.max(0, (t - 10) / 1.5);
      mule.position.set(0, my + 0.4, z + Math.min(1, onTop) * 1.2);
      mule.rotation.x = -inc.rotation.x * (1 - sm(onTop));
      pinion.rotation.x = -(z - INC.z0) / 0.9;
      // the beam: from his eye down into the yard, sweeping side to side in phase 1
      mule.updateMatrixWorld();
      const e = new THREE.Vector3(0, 6.4, 4.8).applyMatrix4(mule.matrixWorld);
      beam.position.copy(e);
      const sweep = Math.sin((t - 10) * 0.9) * 0.6;
      beam.rotation.set(0.28, sweep, 0, 'YXZ');
      beam.visible = t > 10.5;
      eye.material.emissiveIntensity = t > 10 ? 1 : 0.3;
      const L = leaf(-1, g);
      return {y, g, m, gap: Math.max(0, 2 * Math.abs(L.tip[0]))};
    },
  };
}

const STAGES = [
  {t: 0, s: 'RUN', cap: 'WRATH · THE YARD IS A LOCK CHAMBER · IT FILLS WITH FIRE AND DRAINS IN WAVES THAT STOP UNDER TIER ONE'},
  {t: 4, s: 'ARRIVAL', cap: 'AMON IS THE MULE · HE CLIMBS THE RACK INCLINE ONTO THE NORTH GATE WALL'},
  {t: 10.5, s: 'PHASE 1', cap: 'HIS LAMP SWEEPS THE YARD · THE FILL FOLLOWS TORRICELLI: dh/dt = k·√(H − h), FAST AT FIRST, THEN SLOWING'},
  {t: 16, s: 'PHASE 2', cap: 'THE LOCK FILLS AND HOLDS UNDER TIER TWO · THE MITRE GATE SWINGS SHUT, ITS LEAVES MEET MID-YARD AT 1:3'},
];
const CAM = [
  [0, [0, 3, 0, 30, 34, 62]],
  [3.8, [0, 5, -24, 60, 22, 52]],
  [10, [0, 8, -26, 130, 18, 40]],
  [10.8, [0, 3, -6, 20, 40, 60]],
  [15.6, [0, 3, -6, 40, 40, 60]],
  [16.4, [0, 4, -4, 35, 30, 44]],
  [24, [0, 4, -4, 65, 34, 44]],
];

export function run() {
  runSim({duration: DURATION, fps: 60, theme: 'light', hud: {enabled: false}, director: {enabled: false}, watermark: ''}, ({canvas, capture}) => {
    const st = studio(canvas, {capture, shadow: 40, fog: [110, 300]});
    st.camera.far = 1500;
    st.camera.updateProjectionMatrix();
    const v = build(st.scene);
    const ui = consoleUI(document.getElementById('app'), {code: 'WR-7', eyebrow: 'STAGE STUDY · LAYER 7 · WRATH · AFTER THE PANAMA CANAL LOCKS', title: 'Wrath'});
    return {
      resize: st.resize,
      render(t) {
        const S = v.update(t);
        const [x, y, z, az, el, dist] = keyed(CAM, t, sm);
        st.aim([x, y, z], az, el, dist);
        st.render();
        const bi = STAGES.reduce((k, b, i) => (t >= b.t ? i : k), 0);
        ui.set({
          cap: STAGES[bi].cap,
          n: bi + 1,
          mode: STAGES[bi].s,
          right: `FIRE ${S.y.toFixed(2)} m`,
          rows: [
            ['CHAMBER', `${Lk.W.toFixed(1)} m (33.5 m real)`],
            ['WAVE', `${WAVE.up.toFixed(1)} s up, ${WAVE.down.toFixed(1)} s down`],
            ['HOLD', `${Lk.holdTop} m, tier two ${Lk.tiers[1]} m`],
            ['GATE', `${((S.g * 180) / Math.PI).toFixed(1)}° / ${((CLOSED * 180) / Math.PI).toFixed(1)}°`],
            ['LEAF', `${Lk.leaf.toFixed(2)} m at 1:3`],
            ['GAP', `${S.gap.toFixed(2)} m`],
          ],
          barsTitle: 'LEVELS',
          bars: [['FIRE', S.y / Lk.tiers[1]], ['MULE', S.m], ['GATE', S.g / CLOSED]],
          subs: [
            ['Chamber · culverts', bi === 3 ? 'HOLDING' : 'CYCLING', bi === 0 || bi === 2],
            ['Amon · mule', bi === 1 ? 'CLIMBING' : S.m > 0.99 ? 'ON THE WALL' : 'BELOW', bi === 1],
            ['Mitre gate', S.g > CLOSED - 1e-3 ? 'SHUT' : S.g > 0 ? 'SWINGING' : 'RECESSED', bi === 3],
          ],
        });
        return {};
      },
    };
  });
}
