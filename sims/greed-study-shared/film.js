// GREED study: geometry and film. The vault (floor, terrace one at 3 m, terrace two at 6 m), twelve lift cars on
// guide rails in the gap between the terraces, each with a water tank; a central headframe whose six sheaves carry the
// six pair cables; Mammon to the north, a water tower whose tank (his heart) feeds the cars. Film, 26 s: the pairs
// cycling on water ballast, Mammon rising, then the lock (a climb both ways round to the north lift), the cables cut,
// the vault gilded, Mammon leaning in to an air dash. render(t) is pure.
import * as THREE from 'three';
import {runSim} from '../kit/runtime.js';
import {keyed} from '../kit/util.js';
import {partsKit} from '../slumber-kit/parts.js';
import {consoleUI, materials, studio} from '../slumber-kit/studio.js';
import {CYCLE, cycleH, FILL_T, LEAN, liftPos, lockH, partner, ring, RUN_T, TAU, tank, TOP, W} from './kin.js';

export const DURATION = 26;
const sm = (u) => {
  const x = Math.min(1, Math.max(0, u));
  return x * x * x * (x * (x * 6 - 15) + 10);
};
const lockAt = (t) => sm((t - 17) / 3);
const riseAt = (t) => sm((t - 4) / 5);
const leanAt = (t) => LEAN * sm((t - 21) / 4);
const cutAt = (t) => t >= 20.5;
const goldAt = (t) => sm((t - 20.5) / 2);
const HEAD = 16;
const UP = new THREE.Vector3(0, 1, 0);
function span(m, a, b) {
  const va = new THREE.Vector3(...a);
  const d = new THREE.Vector3(...b).sub(va);
  m.position.copy(va).addScaledVector(d, 0.5);
  m.scale.set(1, d.length(), 1);
  m.quaternion.setFromUnitVectors(UP, d.normalize());
}
function ringGeo(r0, r1, h) {
  const s = new THREE.Shape();
  s.absarc(0, 0, r1, 0, TAU, false);
  const hole = new THREE.Path();
  hole.absarc(0, 0, r0, 0, TAU, true);
  s.holes.push(hole);
  return new THREE.ExtrudeGeometry(s, {depth: h, bevelEnabled: false, curveSegments: 64}).rotateX(Math.PI / 2).translate(0, h, 0);
}

function build(scene) {
  const mat = materials();
  mat.vault = new THREE.MeshStandardMaterial({color: '#cdbfa4', roughness: 0.6, metalness: 0.1});
  mat.water = new THREE.MeshStandardMaterial({color: '#5d8fb3', roughness: 0.2, transparent: true, opacity: 0.85});
  mat.cable = new THREE.MeshStandardMaterial({color: '#2b2a2c', roughness: 0.6});
  const plain = new THREE.Color('#cdbfa4');
  const gold = new THREE.Color('#e0b43a');
  const root = new THREE.Group();
  scene.add(root);
  const K = partsKit(root, mat);
  K.mesh(new THREE.CylinderGeometry(8, 8, 0.3, 48).translate(0, 0.15, 0), mat.vault, root);
  K.mesh(ringGeo(8.2, 16, W.t1), mat.vault, root);
  K.mesh(ringGeo(20, 28, W.t2), mat.vault, root);
  // the headframe
  for (const [x, z] of [[-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2], [1.2, 1.2]]) K.mesh(new THREE.BoxGeometry(0.4, HEAD, 0.4).translate(x, HEAD / 2, z), mat.steel, root);
  K.mesh(new THREE.BoxGeometry(3.4, 0.6, 3.4).translate(0, HEAD, 0), mat.dark, root);
  const sheaves = Array.from({length: 6}, (_, k) => {
    const g = new THREE.Group();
    g.position.y = HEAD + 0.9;
    g.rotation.y = -(Math.PI / 2 + (k / W.n) * TAU) + Math.PI / 2;
    root.add(g);
    K.mesh(new THREE.TorusGeometry(0.8, 0.12, 8, 24), mat.accent, g);
    return g;
  });
  // the twelve cars
  const cars = Array.from({length: W.n}, (_, k) => {
    const [x, z] = liftPos(k);
    for (const s of [-1, 1]) {
      const a = Math.PI / 2 + (k / W.n) * TAU;
      K.mesh(new THREE.BoxGeometry(0.25, 10, 0.25).translate(x - Math.sin(a) * 1.7 * s, 5, z + Math.cos(a) * 1.7 * s), mat.dark, root);
    }
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = -(Math.PI / 2 + (k / W.n) * TAU);
    root.add(g);
    K.mesh(new THREE.BoxGeometry(3, 0.35, 3).translate(0, W.carDeck, 0), mat.fleshDeep, g);
    K.mesh(new THREE.BoxGeometry(2.4, 0.9, 2.4).translate(0, 0.45, 0), mat.ghost || mat.steel, g).material = new THREE.MeshStandardMaterial({color: '#8a8f94', transparent: true, opacity: 0.35, depthWrite: false});
    const water = K.mesh(new THREE.BoxGeometry(2.3, 1, 2.3).translate(0, 0.5, 0), mat.water, g);
    for (const [px, pz] of [[-1.4, -1.4], [1.4, -1.4], [-1.4, 1.4], [1.4, 1.4]]) K.mesh(new THREE.BoxGeometry(0.15, 2.2, 0.15).translate(px, W.carDeck + 1.1, pz), mat.steel, g);
    K.mesh(new THREE.BoxGeometry(3, 0.2, 0.3).translate(0, W.carDeck + 2.2, 0), mat.steel, g);
    const cable = K.mesh(new THREE.CylinderGeometry(0.06, 0.06, 1, 5), mat.cable, root);
    return {k, g, water, cable, x, z};
  });
  // Mammon: the water tower to the north
  const tower = new THREE.Group();
  tower.position.set(0, 0, -W.towerR);
  root.add(tower);
  K.mesh(new THREE.CylinderGeometry(1.4, 2.2, W.towerH, 16).translate(0, W.towerH / 2, 0), mat.flesh, tower);
  K.mesh(new THREE.SphereGeometry(3, 24, 16).translate(0, W.towerH, 0), mat.fleshDeep, tower);
  const heart = K.mesh(new THREE.SphereGeometry(1.2, 18, 12).translate(0, W.towerH, 2.6), mat.accent, tower);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU;
    K.mesh(new THREE.ConeGeometry(0.4, 2, 6).translate(Math.cos(a) * 2.2, W.towerH + 3.2, Math.sin(a) * 2.2), mat.gold || mat.accent, tower);
  }
  const main = K.mesh(new THREE.CylinderGeometry(0.25, 0.25, 1, 8), mat.steel, root);
  return {
    update(t) {
      const lk = lockAt(t);
      const h6 = Array.from({length: 6}, (_, k) => cycleH(k, t) * (1 - lk) + lockH(k) * lk);
      const H = ring(h6);
      cars.forEach((c) => {
        c.g.position.y = H[c.k];
        // ballast: the pair's upper car fills, runs down full, dumps at the bottom
        const k6 = c.k % 6;
        const tt = t + k6 * 0.9;
        const cyc = Math.floor(tt / CYCLE);
        const loc = tt - cyc * CYCLE;
        const upperIsPartner = cyc % 2 === 0; // lift k6 goes up, so its partner is the heavy one
        const isUpper = (c.k < 6) !== upperIsPartner;
        let fill = 0;
        if (isUpper) fill = loc < FILL_T ? loc / FILL_T : loc < FILL_T + RUN_T ? 1 : Math.max(0, 1 - (loc - FILL_T - RUN_T) / 1.2);
        if (lk > 0) fill *= 1 - lk;
        c.water.scale.y = Math.max(0.02, fill * 0.85);
        span(c.cable, [c.x * 0.06, HEAD + 0.9, c.z * 0.06], [c.x, H[c.k] + W.carDeck + 2.2, c.z]);
        c.cable.visible = !cutAt(t);
      });
      sheaves.forEach((s, k) => (s.rotation.z = (H[k] - W.t1) / 0.8));
      const rise = riseAt(t);
      tower.position.y = -W.towerH * 1.2 * (1 - rise);
      tower.rotation.x = leanAt(t);
      const tk = tank(leanAt(t));
      span(main, [tk[0], tk[1] + tower.position.y, tk[2]], [0, HEAD + 0.3, 0]);
      main.visible = rise > 0.98 && !cutAt(t);
      mat.vault.color.copy(plain).lerp(gold, goldAt(t));
      mat.vault.emissive = new THREE.Color('#ff7a2a');
      mat.vault.emissiveIntensity = 0.25 * goldAt(t);
      heart.material.emissiveIntensity = t > 9 ? 1 : 0.3;
      return {H, lk, rise, lean: leanAt(t)};
    },
  };
}

const STAGES = [
  {t: 0, s: 'RUN', cap: 'GREED · SIX WATER-BALANCE PAIRS · THE TOP CAR FILLS ITS TANK, OUTWEIGHS ITS PARTNER, RUNS DOWN AND HAULS IT UP'},
  {t: 4, s: 'ARRIVAL', cap: 'MAMMON RISES IN THE NORTH: THE WATER TOWER THAT FEEDS EVERY CAR · HIS TANK IS HIS HEART'},
  {t: 9, s: 'PHASE 1', cap: 'ONE CABLE PER PAIR OVER THE HEADFRAME: PARTNERS’ HEIGHTS ALWAYS SUM TO 9 M'},
  {t: 17, s: 'PHASE 2', cap: 'THE PAIRS LOCK INTO A CLIMB, 3 TO 6 M BOTH WAYS ROUND · BRAKES SET, CABLES CUT · HE LEANS IN TO AN AIR DASH'},
];
const CAM = [
  [0, [0, 4, 0, 30, 32, 80]],
  [8.6, [0, 6, -10, 20, 22, 80]],
  [9.4, [0, 4, 8, 150, 28, 52]],
  [16.6, [0, 4, 8, 190, 28, 52]],
  [17.4, [0, 6, -4, 10, 26, 64]],
  [26, [0, 7, -10, 330, 18, 60]],
];

export function run() {
  runSim({duration: DURATION, fps: 60, theme: 'light', hud: {enabled: false}, director: {enabled: false}, watermark: ''}, ({canvas, capture}) => {
    const st = studio(canvas, {capture, shadow: 40, fog: [110, 300]});
    st.camera.far = 1500;
    st.camera.updateProjectionMatrix();
    const v = build(st.scene);
    const ui = consoleUI(document.getElementById('app'), {code: 'GR-5', eyebrow: 'STAGE STUDY · LAYER 5 · GREED · AFTER THE LYNTON & LYNMOUTH CLIFF RAILWAY', title: 'Greed'});
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
          right: `PAIR 1 · ${S.H[0].toFixed(2)} + ${S.H[partner(0)].toFixed(2)} = ${(S.H[0] + S.H[partner(0)]).toFixed(2)} m`,
          rows: [
            ['BALLAST', `${W.water} kg tips ${W.carM} kg cars`],
            ['ACCEL', `${((W.water * W.g) / (2 * W.carM + W.water)).toFixed(2)} m/s²`],
            ['RUN', `${RUN_T.toFixed(2)} s for 3 m`],
            ['TOP LIFT', `#${TOP.k + 1} north, ${TOP.h} m`],
            ['LEAN', `${((S.lean * 180) / Math.PI).toFixed(1)}° / ${((LEAN * 180) / Math.PI).toFixed(1)}°`],
          ],
          barsTitle: 'LIFTS',
          bars: S.H.slice(0, 6).map((h, k) => [`${k + 1}`, (h - W.t1) / (W.t2 - W.t1)]),
          subs: [
            ['Water-balance pairs ×6', S.lk > 0.99 ? 'LOCKED' : 'CYCLING', bi === 0 || bi === 2],
            ['Mammon · water tower', bi === 1 ? 'RISING' : bi === 3 ? 'LEANING' : S.rise > 0.5 ? 'UP' : 'BELOW', bi === 1 || bi === 3],
            ['Cables', t >= 20.5 ? 'CUT' : 'RUNNING', bi === 3],
          ],
        });
        return {};
      },
    };
  });
}
