// GEMEL TW-2: geometry and film. Two wheel-bodies (a flesh tyre with spokes and an accent rim, a hooded body with an
// optic riding the hub) on the ends of one axle; the differential pod in the middle behind glass (ring gear, carrier,
// spider gears). Film, 16 s: weaving together; one is killed (its wheel locks) and the survivor whirls round it, the
// carrier spooling up (the enrage). The path is integrated once at load from the wheel speeds. render(t) is pure.
import * as THREE from 'three';
import {runSim} from '../kit/runtime.js';
import {gear, consoleUI, materials, studio} from '../slumber-kit/studio.js';
import {partsKit} from '../slumber-kit/parts.js';
import {locked, split, step, T, wheelsAt} from './kin.js';

export const DURATION = 16;
const KILL = 7;
const sm = (u) => {
  const x = Math.min(1, Math.max(0, u));
  return x * x * x * (x * (x * 6 - 15) + 10);
};
const carrierAt = (t) => (t < KILL ? 2.2 : 2.2 + 2.6 * sm((t - KILL) / 3));
const speedsAt = (t) => (t < KILL ? split(carrierAt(t), 0.32 * Math.sin(0.7 * t)) : locked(carrierAt(t), 'L'));
// integrate the pose and the wheel angles once
const DT = 1 / 240;
const TAB = (() => {
  const out = [];
  let s = {x: 0, z: 0, h: 0};
  let al = 0;
  let ar = 0;
  let ac = 0;
  for (let k = 0; k <= DURATION / DT + 1; k++) {
    const t = k * DT;
    out.push({...s, al, ar, ac});
    const [wl, wr] = speedsAt(t + DT / 2);
    s = step(s, wl, wr, DT);
    al += wl * DT;
    ar += wr * DT;
    ac += carrierAt(t + DT / 2) * DT;
  }
  return out;
})();
const at = (t) => {
  const u = Math.min(Math.max(t, 0), DURATION) / DT;
  const n = Math.floor(u);
  const a = TAB[n];
  const b = TAB[Math.min(n + 1, TAB.length - 1)];
  const f = u - n;
  const L = (p, q) => p + (q - p) * f;
  return {x: L(a.x, b.x), z: L(a.z, b.z), h: L(a.h, b.h), al: L(a.al, b.al), ar: L(a.ar, b.ar), ac: L(a.ac, b.ac)};
};

function build(scene) {
  const mat = materials();
  mat.glass = new THREE.MeshPhysicalMaterial({color: '#cfd6d8', transparent: true, opacity: 0.22, depthWrite: false, roughness: 0.05});
  mat.deadFlesh = new THREE.MeshStandardMaterial({color: '#6a5550', roughness: 0.9});
  const root = new THREE.Group();
  scene.add(root);
  const frame = new THREE.Group(); // the axle frame: origin at the pod, x along the axle (toward L), z forward
  root.add(frame);
  const K = partsKit(frame, mat);
  // axle and differential pod
  K.place(K.housing(0.12, 0.12, {stripe: false, m: mat.steel}), [-T.track / 2, T.wheelR, 0], [T.track / 2, T.wheelR, 0], [0, 1, 0]);
  K.mesh(new THREE.SphereGeometry(T.pod, 24, 18), mat.glass, frame).position.y = T.wheelR;
  const ring = K.mesh(gear(0.32, 30, 0.06, 0.6), mat.accent, frame);
  ring.position.set(0, T.wheelR, 0);
  ring.rotation.y = Math.PI / 2;
  const carrier = new THREE.Group();
  carrier.position.set(0, T.wheelR, 0);
  frame.add(carrier);
  for (const sy of [-1, 1]) K.mesh(new THREE.ConeGeometry(0.1, 0.14, 14).translate(0, 0.07, 0).rotateZ(sy > 0 ? 0 : Math.PI).translate(0, sy * 0.14, 0), mat.bone, carrier);
  const sides = [-1, 1].map((sx) => {
    const g = K.mesh(new THREE.ConeGeometry(0.11, 0.14, 14).rotateZ(sx > 0 ? -Math.PI / 2 : Math.PI / 2).translate(sx * 0.15, 0, 0), mat.dark, frame);
    g.position.y = T.wheelR;
    return g;
  });
  void sides;
  // the twins: wheel, hub, body
  const twins = [1, -1].map((sx) => {
    const g = new THREE.Group();
    g.position.set((sx * T.track) / 2, T.wheelR, 0);
    frame.add(g);
    const wheel = new THREE.Group();
    g.add(wheel);
    K.mesh(new THREE.TorusGeometry(T.wheelR - 0.12, 0.13, 14, 40).rotateY(Math.PI / 2), mat.flesh, wheel);
    K.mesh(new THREE.TorusGeometry(T.wheelR - 0.12, 0.03, 8, 40).rotateY(Math.PI / 2).translate(sx * 0.12, 0, 0), mat.accent, wheel);
    for (let k = 0; k < 6; k++) K.mesh(new THREE.BoxGeometry(0.05, T.wheelR - 0.15, 0.05).translate(0, (T.wheelR - 0.15) / 2, 0), mat.bone, wheel).rotation.x = (k / 6) * Math.PI * 2;
    K.mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.3, 16).rotateZ(Math.PI / 2), mat.dark, g);
    const bodyG = new THREE.Group();
    g.add(bodyG);
    const shell = K.mesh(new THREE.CapsuleGeometry(0.3, 0.55, 6, 18).translate(0, 0.75, 0), mat.flesh, bodyG);
    K.mesh(new THREE.SphereGeometry(0.26, 18, 12).translate(0, 1.38, 0.05), mat.fleshDeep, bodyG);
    const eye = K.mesh(new THREE.CircleGeometry(0.08, 18).translate(0, 1.4, 0.31), new THREE.MeshStandardMaterial({color: '#ff3a1c', emissive: new THREE.Color('#ff3a1c'), emissiveIntensity: 0.8}), bodyG);
    return {g, wheel, bodyG, shell, eye, sx};
  });
  return {
    update(t) {
      const S = at(t);
      frame.position.set(S.x, 0, S.z);
      frame.rotation.y = S.h;
      twins[0].wheel.rotation.x = S.al;
      twins[1].wheel.rotation.x = S.ar;
      carrier.rotation.x = S.ac;
      ring.rotation.z = S.ac;
      const dead = sm((t - KILL) / 0.8);
      twins[0].bodyG.rotation.z = 0.9 * dead;
      twins[0].shell.material = dead > 0.5 ? mat.deadFlesh : mat.flesh;
      twins[0].eye.visible = dead < 0.5;
      // the survivor leans into its whirl as it spools up
      twins[1].bodyG.rotation.z = -0.25 * sm((t - KILL) / 3);
      return {S, dead, sp: speedsAt(t)};
    },
  };
}

const BEATS = [
  {t: 0, mode: 'PAIRED', cap: 'TW-2 · ONE MOTOR, ONE OPEN DIFFERENTIAL, TWO WHEEL-BODIES · THEY STEER AS ONE'},
  {t: KILL, mode: 'ENRAGED', cap: 'KILL ONE AND ITS WHEEL LOCKS · THE DIFF SENDS TWICE THE SPEED TO THE SURVIVOR'},
  {t: 11, mode: 'WHIRLING', cap: 'ω LEFT + ω RIGHT = 2·ω CARRIER · IT WHIRLS ROUND ITS DEAD TWIN, FASTER AND FASTER'},
];

export function run() {
  runSim({duration: DURATION, fps: 60, theme: 'light', hud: {enabled: false}, director: {enabled: false}, watermark: ''}, ({canvas, capture}) => {
    const st = studio(canvas, {capture, shadow: 8, fog: [30, 100]});
    const tw = build(st.scene);
    const ui = consoleUI(document.getElementById('app'), {code: 'TW-2', eyebrow: 'LUST ELITE · MOVE AS A PAIR; KILL ONE AND THE OTHER ENRAGES', title: 'Gemel TW-2'});
    return {
      resize: st.resize,
      render(t) {
        const R = tw.update(t);
        const W = wheelsAt(R.S);
        const focus = t < KILL ? [R.S.x, 1, R.S.z] : [W.L[0], 1, W.L[1]];
        st.aim(focus, 40 + t * 8, 18, t < KILL ? 9 : 10);
        st.render();
        const bi = BEATS.reduce((k, b, i) => (t >= b.t ? i : k), 0);
        ui.set({
          cap: BEATS[bi].cap,
          n: bi + 1,
          mode: BEATS[bi].mode,
          right: `CARRIER ${carrierAt(t).toFixed(2)} rad/s`,
          rows: [
            ['ω LEFT', `${R.sp[0].toFixed(2)} rad/s`],
            ['ω RIGHT', `${R.sp[1].toFixed(2)} rad/s`],
            ['SUM', `${(R.sp[0] + R.sp[1]).toFixed(2)} = 2·${carrierAt(t).toFixed(2)}`],
            ['TRACK', `${T.track} m`],
          ],
          barsTitle: 'WHEEL SPEED',
          bars: [['L', R.sp[0] / 10], ['R', R.sp[1] / 10]],
          subs: [
            ['Differential', 'SPLITTING', bi === 0],
            ['Left twin', R.dead > 0.5 ? 'DEAD · LOCKED' : 'ALIVE', bi === 1],
            ['Right twin', bi > 0 ? 'ENRAGED' : 'ALIVE', bi > 0],
          ],
        });
        return {};
      },
    };
  });
}
