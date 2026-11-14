// BLISTER BL-3: geometry and film. A flesh bladder sac (its size from its volume), the pump housing on its flank with
// a glass face over the rotor, three rollers and the tube in its horseshoe track, the nozzle up front, three stubby
// legs. Film, 16 s: spitting gobs (range from the pump's flow), the pump isolated, the sac swelling, the burst (shards
// and a spreading cloud). render(t) is pure.
import * as THREE from 'three';
import {runSim} from '../kit/runtime.js';
import {keyed} from '../kit/util.js';
import {partsKit} from '../slumber-kit/parts.js';
import {consoleUI, materials, studio} from '../slumber-kit/studio.js';
import {bladderAt, BURST_THETA, exitSpeed, flight, P, spit, TAU} from './kin.js';

export const DURATION = 16;
const OMEGA = 22;
const sm = (u) => {
  const x = Math.min(1, Math.max(0, u));
  return x * x * x * (x * (x * 6 - 15) + 10);
};
const T_BURST = 1 + BURST_THETA / OMEGA; // the pump starts at 1 s
const thetaAt = (t) => OMEGA * Math.max(0, Math.min(t, T_BURST) - 1);
const GOBS = Array.from({length: 7}, (_, k) => 1.4 + k * 1.15).filter((g) => g < T_BURST);

function build(scene) {
  const mat = materials();
  mat.bile = new THREE.MeshStandardMaterial({color: '#b0702a', emissive: new THREE.Color('#d08a2a'), emissiveIntensity: 0.4, roughness: 0.3});
  mat.cloud = new THREE.MeshStandardMaterial({color: '#c9a060', transparent: true, opacity: 0.35, depthWrite: false});
  mat.glass = new THREE.MeshPhysicalMaterial({color: '#cfd6d8', transparent: true, opacity: 0.2, depthWrite: false, roughness: 0.05});
  const root = new THREE.Group();
  scene.add(root);
  const K = partsKit(root, mat);
  // legs: three stubby tripods
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * TAU + Math.PI / 2;
    const hip = [Math.cos(a) * 0.45, 0.95, Math.sin(a) * 0.45];
    const knee = [Math.cos(a) * 0.95, 0.75, Math.sin(a) * 0.95];
    const foot = [Math.cos(a) * 1.15, 0.05, Math.sin(a) * 1.15];
    K.orient(K.drum(0.12, 0.16), hip, [Math.sin(a), 0, -Math.cos(a)]);
    K.place(K.housing(0.16, 0.14), hip, knee, [0, 1, 0], 0.22);
    K.orient(K.drum(0.1, 0.14), knee, [Math.sin(a), 0, -Math.cos(a)]);
    K.place(K.housing(0.14, 0.12), knee, foot, [0, 1, 0], 0.16);
  }
  K.mesh(new THREE.CylinderGeometry(0.55, 0.6, 0.3, 28).translate(0, 1.0, 0), mat.dark, root);
  // the sac
  const sac = K.mesh(new THREE.SphereGeometry(1, 36, 24), mat.flesh, root);
  const veins = [];
  for (let k = 0; k < 6; k++) {
    const v = K.mesh(new THREE.TorusGeometry(1.01, 0.012, 6, 48, Math.PI), mat.fleshDeep, root);
    veins.push(v);
    v.rotation.y = (k / 6) * Math.PI;
  }
  // the pump on the right flank: housing, glass face, rotor with three rollers, the tube in its track
  const pump = new THREE.Group();
  pump.position.set(0.62, 1.15, 0.55);
  pump.scale.setScalar(0.75);
  pump.rotation.y = Math.PI / 2;
  root.add(pump);
  // an open rim and a back plate, so the rotor shows through the glass
  K.mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.24, 36, 1, true).rotateX(Math.PI / 2), mat.fleshDeep, pump).material.side = THREE.DoubleSide;
  K.mesh(new THREE.CircleGeometry(0.5, 36).translate(0, 0, -0.12), mat.dark, pump);
  K.mesh(new THREE.CircleGeometry(0.48, 36).translate(0, 0, 0.125), mat.glass, pump);
  K.mesh(new THREE.TorusGeometry(0.48, 0.03, 8, 40).translate(0, 0, 0.125), mat.accent, pump);
  const track = new THREE.TorusGeometry(P.rotorR + 0.06, P.bore * 1.4, 10, 40, P.trackArc);
  K.mesh(track, mat.bone, pump);
  const rotor = new THREE.Group();
  pump.add(rotor);
  K.mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.2, 16).rotateX(Math.PI / 2), mat.steel, rotor);
  for (let k = 0; k < P.rollers; k++) {
    const a = (k / P.rollers) * TAU;
    K.place(K.housing(0.05, 0.05, {stripe: false, m: mat.steel}), [0, 0, 0], [Math.cos(a) * P.rotorR, Math.sin(a) * P.rotorR, 0], [0, 0, 1]);
    K.mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.14, 16).rotateX(Math.PI / 2).translate(Math.cos(a) * P.rotorR, Math.sin(a) * P.rotorR, 0), mat.dark, rotor);
  }
  // the nozzle up front
  K.place(K.housing(0.12, 0.12, {stripe: false, m: mat.fleshDeep}), [0, 1.6, 0.3], P.noz, [1, 0, 0]);
  K.mesh(new THREE.TorusGeometry(0.08, 0.02, 8, 18).rotateX(Math.PI / 2 - P.noseUp).translate(...P.noz), mat.accent, root);
  const gobs = GOBS.map(() => K.mesh(new THREE.SphereGeometry(0.13, 12, 8), mat.bile, root));
  const shards = Array.from({length: 18}, () => K.mesh(new THREE.TetrahedronGeometry(0.22, 0), mat.flesh, root));
  const cloud = Array.from({length: 9}, () => K.mesh(new THREE.SphereGeometry(1, 16, 12), mat.cloud, root));
  return {
    update(t) {
      const th = thetaAt(t);
      const V = bladderAt(th);
      const burst = t >= T_BURST;
      const r = Math.cbrt((3 * V) / (4 * Math.PI)) * 3.5; // the sac's radius from its volume (drawn ×3.5: the enemy's size)
      sac.visible = !burst;
      sac.position.set(0, 1.25 + r, -0.1);
      sac.scale.set(r, r * 0.92, r);
      veins.forEach((v) => {
        v.visible = !burst;
        v.position.copy(sac.position);
        v.scale.set(r, r * 0.92, r);
      });
      rotor.rotation.z = th;
      const v = exitSpeed(OMEGA);
      GOBS.forEach((g, i) => {
        const tau = t - g;
        const T = flight(v);
        gobs[i].visible = tau >= 0 && tau < T;
        if (gobs[i].visible) gobs[i].position.set(...spit(v, tau, 0.25 * Math.sin(i * 1.7)));
      });
      const tb = t - T_BURST;
      shards.forEach((s, i) => {
        s.visible = tb > 0 && tb < 2.5;
        if (!s.visible) return;
        const a = i * 2.39996;
        const el = ((i % 6) / 6) * 1.4 - 0.2;
        const dir = [Math.cos(a) * Math.cos(el), Math.sin(el) + 0.3, Math.sin(a) * Math.cos(el)];
        const sp = 5 + (i % 4);
        s.position.set(dir[0] * sp * tb, Math.max(0.1, sac.position.y + dir[1] * sp * tb - 4.9 * tb * tb), -0.1 + dir[2] * sp * tb);
        s.rotation.set(tb * 6 + i, tb * 4, 0);
      });
      cloud.forEach((c, i) => {
        c.visible = tb > 0;
        if (!c.visible) return;
        const a = i * 2.1;
        const rr = 0.6 + 2.8 * Math.sqrt(Math.min(tb, 4) / 4);
        c.position.set(Math.cos(a) * rr * 0.7, sac.position.y - 0.4 + (i % 3) * 0.4, Math.sin(a) * rr * 0.7);
        c.scale.setScalar(0.6 + 1.6 * Math.sqrt(Math.min(tb, 4) / 4));
        c.material.opacity = 0.35 * (1 - Math.min(1, Math.max(0, tb - 3) / 3));
      });
      return {th, V, burst};
    },
  };
}

const BEATS = [
  {t: 0, mode: 'SPITTING', cap: 'BL-3 · A ROLLER PUMP SPITS BILE IN ARCS · ITS RANGE IS THE PUMP’S FLOW'},
  {t: 4, mode: 'PUMP', cap: 'THREE ROLLERS SQUEEZE THE TUBE IN ITS TRACK · ONE ALWAYS SEALS IT'},
  {t: 7, mode: 'SWELLING', cap: 'A THIRD OF EVERY STROKE FILLS THE SAC (THE TELL)'},
  {t: T_BURST, mode: 'BURST', cap: 'AT ITS LIMIT THE SAC BURSTS IN A CLOUD'},
];
const CAM = [
  [0, [0, 1.8, 3, 70, 14, 10]],
  [3.6, [0, 1.8, 3, 90, 14, 10]],
  [4.4, [0.62, 1.15, 0.55, 90, 6, 1.9]],
  [6.6, [0.62, 1.15, 0.55, 100, 8, 1.9]],
  [7.4, [0, 2.2, 0, 40, 10, 7]],
  [T_BURST, [0, 2.2, 0, 60, 12, 8]],
  [16, [0, 2.2, 0, 90, 16, 12]],
];

export function run() {
  runSim({duration: DURATION, fps: 60, theme: 'light', hud: {enabled: false}, director: {enabled: false}, watermark: ''}, ({canvas, capture}) => {
    const st = studio(canvas, {capture, shadow: 7, fog: [30, 100]});
    const bl = build(st.scene);
    const ui = consoleUI(document.getElementById('app'), {code: 'BL-3', eyebrow: 'GLUTTONY ELITE · SPITS BILE, THEN BURSTS', title: 'Blister BL-3'});
    return {
      resize: st.resize,
      render(t) {
        const S = bl.update(t);
        const [x, y, z, az, el, dist] = keyed(CAM, t, sm);
        st.aim([x, y, z], az, el, dist);
        st.render();
        const bi = BEATS.reduce((k, b, i) => (t >= b.t ? i : k), 0);
        const v = exitSpeed(OMEGA);
        ui.set({
          cap: BEATS[bi].cap,
          n: bi + 1,
          mode: BEATS[bi].mode,
          right: `ROTOR ${(S.th / TAU).toFixed(1)} turns`,
          rows: [
            ['ROTOR', S.burst ? 'STOPPED' : `${((OMEGA * 60) / TAU).toFixed(0)} rpm`],
            ['NOZZLE', `${v.toFixed(1)} m/s`],
            ['RANGE', `${(Math.cos(P.noseUp) * v * flight(v)).toFixed(1)} m`],
            ['SAC', `${(S.V * 1000).toFixed(0)} L / ${P.bladder.vmax * 1000} L`],
          ],
          barsTitle: 'SAC',
          bars: [['FILL', (S.V - P.bladder.v0) / (P.bladder.vmax - P.bladder.v0)]],
          subs: [
            ['Roller pump', S.burst ? 'DEAD' : 'PUMPING', bi === 1],
            ['Nozzle', S.burst ? '-' : 'SPITTING', bi === 0],
            ['Sac', S.burst ? 'BURST' : 'SWELLING', bi >= 2],
          ],
        });
        return {};
      },
    };
  });
}
