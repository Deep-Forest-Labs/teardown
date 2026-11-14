// GILDED GD-6: geometry and film. Six petals (lunes of the closed shell's sphere, flesh with gilded rims), each on its
// hinge and swung by a cylinder (barrel and rod) from the hub; the red core inside; a coin launcher (two counter-
// rotating wheels) under the front; four ducted fans on top. Film, 16 s: hovering armoured, a coin volley, the shell
// opening to vent (the core bared), closing. render(t) is pure.
import * as THREE from 'three';
import {runSim} from '../kit/runtime.js';
import {keyed} from '../kit/util.js';
import {partsKit} from '../slumber-kit/parts.js';
import {consoleUI, materials, studio} from '../slumber-kit/studio.js';
import {coinSpeed, G, petal} from './kin.js';

export const DURATION = 16;
const TAU = Math.PI * 2;
const OMEGA = 150;
const sm = (u) => {
  const x = Math.min(1, Math.max(0, u));
  return x * x * x * (x * (x * 6 - 15) + 10);
};
const openAt = (t) => keyed([[0, 0], [8, 0], [9.4, 1], [12.6, 1], [14, 0], [16, 0]], t, sm);
const VOLLEY = Array.from({length: 10}, (_, k) => 3 + k * 0.28);
const HOVER = [0, 3.2, 0];
// the closed shell's sphere (hinge ring and petal tips on it)
const YC = (G.ringR ** 2 + G.ringY ** 2 - (G.ringY - Math.sqrt(G.petal ** 2 - G.ringR ** 2)) ** 2) / (2 * G.ringY - 2 * (G.ringY - Math.sqrt(G.petal ** 2 - G.ringR ** 2)));
const RS = Math.hypot(G.ringR, G.ringY - YC);

function build(scene) {
  const mat = materials();
  mat.gold = new THREE.MeshStandardMaterial({color: '#c9a227', metalness: 0.6, roughness: 0.35});
  mat.core = new THREE.MeshStandardMaterial({color: '#d22a1c', emissive: new THREE.Color('#ff2a1c'), emissiveIntensity: 0.9});
  const root = new THREE.Group();
  root.position.set(...HOVER);
  scene.add(root);
  const K = partsKit(root, mat);
  // core and hub
  K.mesh(new THREE.SphereGeometry(0.34, 24, 18), mat.core, root).position.y = 0.05;
  K.mesh(new THREE.CylinderGeometry(0.2, 0.26, 0.5, 24).translate(0, 0.8, 0), mat.dark, root);
  K.mesh(new THREE.TorusGeometry(G.ringR, 0.04, 8, 48).rotateX(Math.PI / 2).translate(0, G.ringY, 0), mat.gold, root);
  // petals: a lune of the closed sphere in each sector, built closed, then hinged
  const thTop = Math.acos((G.ringY - YC) / RS);
  const petals = Array.from({length: G.petals}, (_, k) => {
    const mid = ((k + 0.5) / G.petals) * TAU;
    const axisDir = new THREE.Vector3(Math.cos(mid), 0, Math.sin(mid));
    const hinge = new THREE.Vector3(axisDir.x * G.ringR, G.ringY, axisDir.z * G.ringR);
    const pivot = new THREE.Group();
    pivot.position.copy(hinge);
    root.add(pivot);
    // three.js sphere φ runs from −x; my sector angle m maps to φ = π − m for x = cos m
    const half = TAU / G.petals / 2 - 0.02;
    const geo = new THREE.SphereGeometry(RS, 18, 16, Math.PI - mid - half, 2 * half, thTop, Math.PI - thTop).translate(0, YC, 0).translate(-hinge.x, -hinge.y, -hinge.z);
    K.mesh(geo, mat.flesh, pivot).material.side = THREE.DoubleSide;
    const rimPts = [];
    for (let j = 0; j <= 16; j++) {
      const th = thTop + ((Math.PI - thTop) * j) / 16;
      for (const e of [-half, half]) void e;
      rimPts.push(new THREE.Vector3(Math.cos(mid - half) * RS * Math.sin(th), YC + RS * Math.cos(th), Math.sin(mid - half) * RS * Math.sin(th)).sub(hinge));
    }
    K.mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rimPts), 24, 0.025, 6), mat.gold, pivot);
    const barrel = K.housing(0.07, 0.07, {stripe: false, m: mat.dark});
    const rod = K.housing(0.04, 0.04, {stripe: false, m: mat.steel});
    return {pivot, axis: new THREE.Vector3(-Math.sin(mid), 0, Math.cos(mid)), mid, barrel, rod};
  });
  // the launcher under the front: two counter-rotating wheels
  const wheels = [-1, 1].map((sx) => {
    const w = K.mesh(new THREE.CylinderGeometry(G.wheelR, G.wheelR, 0.06, 24), mat.dark, root);
    w.position.set(sx * (G.wheelR + 0.015), G.muzzle[1], G.muzzle[2] - 0.12);
    return w;
  });
  K.mesh(new THREE.BoxGeometry(0.4, 0.08, 0.3).translate(0, G.muzzle[1] + 0.1, G.muzzle[2] - 0.15), mat.gold, root);
  // ducted fans on top
  const fans = [];
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * TAU + TAU / 8;
    const p = [Math.cos(a) * 0.62, 1.05, Math.sin(a) * 0.62];
    K.mesh(new THREE.TorusGeometry(0.22, 0.04, 8, 28).rotateX(Math.PI / 2).translate(...p), mat.fleshDeep, root);
    const rot = new THREE.Group();
    rot.position.set(...p);
    root.add(rot);
    for (let j = 0; j < 3; j++) K.mesh(new THREE.BoxGeometry(0.36, 0.01, 0.06), mat.dark, rot).rotation.y = (j * TAU) / 3;
    K.place(K.housing(0.04, 0.04, {stripe: false, m: mat.steel}), [0, 0.95, 0], p, [0, 1, 0]);
    fans.push(rot);
  }
  const coins = VOLLEY.map(() => {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.012, 14), mat.gold);
    scene.add(c);
    return c;
  });
  return {
    update(t) {
      const c = openAt(t);
      const P = petal(c);
      const P0 = petal(0);
      petals.forEach((Pe) => {
        Pe.pivot.setRotationFromAxisAngle(Pe.axis, -(P.dir - P0.dir));
        // cylinder from the hub anchor to the horn, in this petal's radial plane
        const A = [Math.cos(Pe.mid) * G.anchor[0], G.anchor[1], Math.sin(Pe.mid) * G.anchor[0]];
        const Hn = [Math.cos(Pe.mid) * P.horn[0], P.horn[1], Math.sin(Pe.mid) * P.horn[0]];
        const mid = A.map((a, i) => a + (Hn[i] - a) * 0.55);
        K.place(Pe.barrel, A, mid, [0, 1, 0]);
        K.place(Pe.rod, mid, Hn, [0, 1, 0]);
      });
      wheels.forEach((w, i) => (w.rotation.y = (i ? -1 : 1) * t * 20));
      fans.forEach((f, i) => (f.rotation.y = t * (30 + i)));
      root.position.y = HOVER[1] + 0.06 * Math.sin(t * 1.4);
      const v = coinSpeed(OMEGA);
      VOLLEY.forEach((tv, i) => {
        const tau = t - tv;
        coins[i].visible = tau >= 0 && tau < 1.3;
        if (!coins[i].visible) return;
        const yaw = (i - 4.5) * 0.06;
        coins[i].position.set(HOVER[0] + Math.sin(yaw) * v * tau, HOVER[1] + G.muzzle[1] - 4.9 * tau * tau - 0.6 * tau, HOVER[2] + G.muzzle[2] + Math.cos(yaw) * v * tau);
        coins[i].rotation.set(tau * 20, 0, tau * 9);
      });
      return {c, P};
    },
  };
}

const BEATS = [
  {t: 0, mode: 'ARMOURED', cap: 'GD-6 · SIX PETALS ON CYLINDERS, SHUT TIGHT: THE TIPS MEET ON THE AXIS'},
  {t: 3, mode: 'VOLLEY', cap: 'COINS PINCHED BETWEEN TWO WHEELS LEAVE AT THE RIM SPEED · 18 M/S'},
  {t: 8, mode: 'VENTING', cap: 'THE CYLINDERS EXTEND AND THE SHELL OPENS ON THE CORE · BREAK IT NOW'},
  {t: 12.6, mode: 'SEALING', cap: 'IT CLOSES AGAIN'},
];
const CAM = [
  [0, [0, 3.4, 0, 40, 14, 6]],
  [2.6, [0, 2.6, 1.6, 75, 6, 5.5]],
  [7.6, [0, 2.6, 1.8, 60, 8, 5.5]],
  [8.4, [0, 3.4, 0, 30, 22, 4.6]],
  [12.4, [0, 3.4, 0, 70, 24, 4.6]],
  [16, [0, 3.4, 0, 100, 16, 6]],
];

export function run() {
  runSim({duration: DURATION, fps: 60, theme: 'light', hud: {enabled: false}, director: {enabled: false}, watermark: ''}, ({canvas, capture}) => {
    const st = studio(canvas, {capture, shadow: 6, fog: [25, 90]});
    const gd = build(st.scene);
    const ui = consoleUI(document.getElementById('app'), {code: 'GD-6', eyebrow: 'GREED ELITE · ARMOURED, FIRES COIN VOLLEYS', title: 'Gilded GD-6'});
    return {
      resize: st.resize,
      render(t) {
        const S = gd.update(t);
        const [x, y, z, az, el, dist] = keyed(CAM, t, sm);
        st.aim([x, y, z], az, el, dist);
        st.render();
        const bi = BEATS.reduce((k, b, i) => (t >= b.t ? i : k), 0);
        ui.set({
          cap: BEATS[bi].cap,
          n: bi + 1,
          mode: BEATS[bi].mode,
          right: `SHELL ${Math.round(S.c * 100)}% OPEN`,
          rows: [
            ['CYLINDER', `${(S.P.L * 1000).toFixed(0)} mm`],
            ['PETAL TIP', `${S.P.tip[0].toFixed(2)} m out`],
            ['COIN', `${coinSpeed(OMEGA).toFixed(1)} m/s`],
            ['FANS', '4 · HOVER'],
          ],
          barsTitle: 'SHELL',
          bars: [['OPEN', S.c]],
          subs: [
            ['Petals ×6 · cylinders', S.c > 0.02 && S.c < 0.98 ? 'MOVING' : S.c > 0.5 ? 'OPEN' : 'SEALED', bi === 2],
            ['Core', S.c > 0.5 ? 'EXPOSED' : 'COVERED', S.c > 0.5],
            ['Coin launcher', bi === 1 ? 'FIRING' : 'READY', bi === 1],
            ['Ducted fans ×4', 'HOVER', false],
          ],
        });
        return {};
      },
    };
  });
}
