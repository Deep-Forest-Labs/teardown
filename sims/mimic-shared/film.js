// FALSE ORB MM-1: geometry and film. Two glowing hemispheres (an orb, among real orbs); the upper one hinges at the
// back on the four-bar (crank, coupler, rocker shown on the side); inside, flesh and a ring of teeth; four legs fold
// out of the base. Film, 14 s: the disguise among real orbs, the target walking in, the snap open, the lunge, the bites.
// render(t) is pure.
import * as THREE from 'three';
import {runSim} from '../kit/runtime.js';
import {keyed} from '../kit/util.js';
import {partsKit} from '../slumber-kit/parts.js';
import {consoleUI, materials, studio} from '../slumber-kit/studio.js';
import {CLOSED_THETA, H, JAW_MAX, jawAt, M, O, rocker} from './kin.js';

export const DURATION = 14;
const sm = (u) => {
  const x = Math.min(1, Math.max(0, u));
  return x * x * x * (x * (x * 6 - 15) + 10);
};
// crank: parked shut until 6 s, then turning (each turn: open and snap); the lunge 6.6 → 7.4
const thetaAt = (t) => CLOSED_THETA + (t < 6 ? 0 : (t - 6) * 7.5);
const legsAt = (t) => sm((t - 5.6) / 0.5) * (1 - sm((t - 12.5) / 0.8));
const lungeAt = (t) => sm((t - 6.4) / 0.9);

function build(scene) {
  const mat = materials();
  mat.orb = new THREE.MeshStandardMaterial({color: '#8fd4ff', emissive: new THREE.Color('#8fd4ff'), emissiveIntensity: 0.6, roughness: 0.3});
  const root = new THREE.Group();
  scene.add(root);
  const K = partsKit(root, mat);
  const R = M.R;
  // lower shell (fixed to the body) and the upper shell on its hinge at the back
  const lower = K.mesh(new THREE.SphereGeometry(R, 32, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), mat.orb, root);
  const hinge = new THREE.Group();
  root.add(hinge);
  const upper = K.mesh(new THREE.SphereGeometry(R, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), mat.orb, hinge);
  // the inside: a flesh lining and two rings of teeth
  K.mesh(new THREE.SphereGeometry(R * 0.96, 28, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), mat.fleshDeep, root).material.side = THREE.BackSide;
  K.mesh(new THREE.SphereGeometry(R * 0.96, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat.fleshDeep, hinge).material.side = THREE.BackSide;
  for (const [g, s] of [[root, 1], [hinge, -1]]) {
    for (let k = 0; k < 14; k++) {
      const a = (k / 14) * Math.PI * 2;
      const tooth = K.mesh(new THREE.ConeGeometry(0.025, 0.09, 6).rotateX(s > 0 ? 0 : Math.PI).translate(0, s * 0.045, 0), mat.bone, g);
      tooth.position.set(Math.cos(a) * R * 0.88, 0, Math.sin(a) * R * 0.88);
    }
  }
  // the four-bar on the right side (x = R)
  const fb = new THREE.Group();
  fb.position.x = R + 0.02;
  root.add(fb);
  const crank = K.housing(0.02, 0.02, {stripe: false, m: mat.accent});
  const coupler = K.housing(0.015, 0.015, {stripe: false, m: mat.steel});
  const rock = K.housing(0.02, 0.02, {stripe: false, m: mat.dark});
  [crank, coupler, rock].forEach((p) => fb.add(p));
  // legs: four, folded flat under the base, swinging down to stand
  const legs = [0, 1, 2, 3].map((k) => {
    const g = new THREE.Group();
    const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
    g.position.set(Math.cos(a) * R * 0.7, -R * 0.6, Math.sin(a) * R * 0.7);
    g.rotation.y = -a;
    root.add(g);
    K.mesh(new THREE.BoxGeometry(0.32, 0.035, 0.035).translate(0.16, 0, 0), mat.bone, g);
    K.mesh(new THREE.ConeGeometry(0.02, 0.08, 6).rotateZ(Math.PI).translate(0.32, -0.04, 0), mat.dark, g);
    return g;
  });
  return {
    update(t) {
      const th = thetaAt(t);
      const jaw = jawAt(th);
      const lunge = lungeAt(t);
      const legK = legsAt(t);
      // body height rises as the legs swing down; the lunge hops it forward
      const hop = Math.sin(Math.PI * Math.min(1, Math.max(0, (t - 6.4) / 0.9))) * 0.4;
      root.position.set(0, R + 0.22 * legK + hop, 2.6 * lunge);
      hinge.position.set(0, 0, -R);
      upper.position.set(0, 0, R);
      hinge.children.forEach((c) => {
        if (c !== upper) c.position.z = R;
      });
      hinge.rotation.x = -jaw;
      // the legs telescope out of the base: retracted (hidden inside the shell) while it poses as an orb
      legs.forEach((g) => {
        g.rotation.z = -1.1 * legK;
        g.scale.x = 0.05 + 0.95 * legK;
        g.visible = legK > 0.02;
      });
      // four-bar in the side plane (fb local: y up, z forward)
      const r = rocker(th);
      const map = (p) => [0, p[1], p[0]];
      K.place(crank, map(O), map(r.A), [1, 0, 0]);
      K.place(coupler, map(r.A), map(r.B), [1, 0, 0]);
      K.place(rock, map(H), map(r.B), [1, 0, 0]);
      mat.orb.emissiveIntensity = 0.45 + 0.2 * Math.sin(t * 2.2) - 0.35 * Math.min(1, jaw * 3);
      return {jaw, th, lunge};
    },
  };
}

const BEATS = [
  {t: 0, mode: 'DISGUISED', cap: 'MM-1 · ONE OF THESE ORBS IS NOT AN ORB'},
  {t: 5.5, mode: 'SPRUNG', cap: 'LEGS SWING DOWN, A CRANK-ROCKER SNAPS THE SHELL OPEN · IT LUNGES'},
  {t: 8, mode: 'BITING', cap: 'EVERY CRANK TURN OPENS THE JAW 61° AND SNAPS IT SHUT'},
];

export function run() {
  runSim({duration: DURATION, fps: 60, theme: 'light', hud: {enabled: false}, director: {enabled: false}, watermark: ''}, ({canvas, capture}) => {
    const st = studio(canvas, {capture, shadow: 4, fog: [20, 70]});
    const mm = build(st.scene);
    const m = materials();
    m.orb = new THREE.MeshStandardMaterial({color: '#8fd4ff', emissive: new THREE.Color('#8fd4ff'), emissiveIntensity: 0.6, roughness: 0.3});
    for (const [x, z] of [[-1.1, 0.4], [1.0, -0.6], [-0.4, -1.3]]) {
      const o = new THREE.Mesh(new THREE.SphereGeometry(M.R, 28, 18), m.orb);
      o.position.set(x, M.R, z);
      o.castShadow = true;
      st.scene.add(o);
    }
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.35, 1.8, 20).translate(0, 0.9, 0), new THREE.MeshStandardMaterial({color: '#cfc6b6', roughness: 0.8}));
    post.castShadow = true;
    st.scene.add(post);
    const ui = consoleUI(document.getElementById('app'), {code: 'MM-1', eyebrow: 'FRAUD ELITE · POSES AS AN ORB, THEN BITES', title: 'False Orb MM-1'});
    return {
      resize: st.resize,
      render(t) {
        const S = mm.update(t);
        post.position.set(0.1, 0, 8 - Math.min(t, 5.5) * 0.85);
        st.aim([0, 0.5, 1.2 + S.lunge * 1.4], 40 + t * 5, 16, 5.5);
        st.render();
        const bi = BEATS.reduce((k, b, i) => (t >= b.t ? i : k), 0);
        ui.set({
          cap: BEATS[bi].cap,
          n: bi + 1,
          mode: BEATS[bi].mode,
          right: `JAW ${((S.jaw * 180) / Math.PI).toFixed(0)}°`,
          rows: [
            ['CRANK', `${M.a * 1000} mm`],
            ['COUPLER', `${M.b * 1000} mm`],
            ['ROCKER', `${M.c * 1000} mm`],
            ['GROUND', `${M.g * 1000} mm`],
            ['JAW MAX', `${((JAW_MAX * 180) / Math.PI).toFixed(1)}°`],
          ],
          barsTitle: 'JAW',
          bars: [['OPEN', S.jaw / JAW_MAX]],
          subs: [
            ['Shell', S.jaw > 0.05 ? 'OPEN' : 'ORB', bi > 0],
            ['Four-bar', t >= 6 ? 'TURNING' : 'PARKED', bi === 2],
            ['Legs ×4', legsAt(t) > 0.5 ? 'OUT' : 'FOLDED', bi === 1],
          ],
        });
        return {};
      },
    };
  });
}
