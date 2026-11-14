// SEER FP-4: geometry and film. A robed flesh prophet with a halo ring and one eye; four tall mirror panels on two-
// stage telescoping arms round it; a translucent decoy behind each glass at the reflected point (facing back out). Only
// the real one fires. Film, 16 s: arms extend, the decoys appear and wheel round as the panels turn, bolts from the
// real one, the decoys isolated against the real one. render(t) is pure.
import * as THREE from 'three';
import {runSim} from '../kit/runtime.js';
import {keyed} from '../kit/util.js';
import {partsKit} from '../slumber-kit/parts.js';
import {consoleUI, materials, studio} from '../slumber-kit/studio.js';
import {F, scene as mirrorScene} from './kin.js';

export const DURATION = 16;
const sm = (u) => {
  const x = Math.min(1, Math.max(0, u));
  return x * x * x * (x * (x * 6 - 15) + 10);
};
const extAt = (t) => keyed([[0, 0.05], [1.5, 0.05], [4, 1], [16, 1]], t, sm);
const turnAt = (t) => 0.25 * t;
const BOLTS = [6, 7.4, 8.8, 10.2, 11.6, 13];
const TARGET = [0, 1.2, 11];

function prophet(K, mat, parent, ghost) {
  const g = new THREE.Group();
  parent.add(g);
  const m = ghost ? mat.ghost : mat.flesh;
  K.mesh(new THREE.LatheGeometry([[0, 0], [0.55, 0.05], [0.45, 0.8], [0.32, 1.6], [0.36, 2.0], [0, 2.05]].map(([r, y]) => new THREE.Vector2(r, y)), 28), m, g);
  K.mesh(new THREE.SphereGeometry(0.28, 18, 12).translate(0, 2.3, 0), ghost ? mat.ghost : mat.fleshDeep, g);
  K.mesh(new THREE.TorusGeometry(0.42, 0.03, 8, 32).translate(0, 2.6, -0.1), ghost ? mat.ghost : mat.accent, g);
  K.mesh(new THREE.CircleGeometry(0.08, 18).translate(0, 2.32, 0.28), ghost ? mat.ghost : mat.eye, g);
  return g;
}

function build(scene3) {
  const mat = materials();
  mat.mirror = new THREE.MeshPhysicalMaterial({color: '#cfd8de', emissive: new THREE.Color('#9fb0bc'), emissiveIntensity: 0.35, metalness: 0.2, roughness: 0.12, clearcoat: 1});
  mat.ghost = new THREE.MeshStandardMaterial({color: '#e9b8ad', transparent: true, opacity: 0.38, depthWrite: false});
  mat.eye = new THREE.MeshStandardMaterial({color: '#ff3a1c', emissive: new THREE.Color('#ff3a1c'), emissiveIntensity: 1});
  mat.bolt = new THREE.MeshStandardMaterial({color: '#ffd3a8', emissive: new THREE.Color('#ff8a3a'), emissiveIntensity: 1});
  const root = new THREE.Group();
  scene3.add(root);
  const K = partsKit(root, mat);
  const real = prophet(K, mat, root, false);
  const decoys = Array.from({length: F.panels}, () => prophet(K, mat, root, true));
  const panels = Array.from({length: F.panels}, () => {
    const g = new THREE.Group();
    root.add(g);
    K.mesh(new THREE.BoxGeometry(1.6, 2.8, 0.06).translate(0, 1.5, 0), mat.mirror, g);
    K.mesh(new THREE.BoxGeometry(1.7, 0.08, 0.1).translate(0, 2.92, 0), mat.dark, g);
    K.mesh(new THREE.BoxGeometry(1.7, 0.08, 0.1).translate(0, 0.08, 0), mat.dark, g);
    return {g, arm1: K.housing(0.1, 0.1, {stripe: false, m: mat.fleshDeep}), arm2: K.housing(0.07, 0.07, {stripe: false, m: mat.steel})};
  });
  const bolts = BOLTS.map(() => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8), mat.bolt);
    scene3.add(m);
    return m;
  });
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.35, 1.8, 20).translate(0, 0.9, 0), new THREE.MeshStandardMaterial({color: '#cfc6b6', roughness: 0.8}));
  post.position.set(TARGET[0], 0, TARGET[2]);
  post.castShadow = true;
  scene3.add(post);
  return {
    update(t) {
      const e = extAt(t);
      const S = mirrorScene(e, turnAt(t), t);
      real.position.set(S.real[0], 0, S.real[1]);
      real.rotation.y = Math.atan2(TARGET[0] - S.real[0], TARGET[2] - S.real[1]);
      S.panels.forEach((P, k) => {
        const p = panels[k];
        p.g.position.set(P.c[0], 0, P.c[1]);
        p.g.rotation.y = -P.ang + Math.PI / 2;
        const base = [S.real[0] + P.n[0] * 0.4, 0.9, S.real[1] + P.n[1] * 0.4];
        const mid = [S.real[0] + P.n[0] * (0.4 + (P.r - 0.4) * 0.55), 0.9, S.real[1] + P.n[1] * (0.4 + (P.r - 0.4) * 0.55)];
        K.place(p.arm1, base, mid, [0, 1, 0]);
        K.place(p.arm2, mid, [P.c[0], 0.9, P.c[1]], [0, 1, 0]);
        const D = S.decoys[k];
        decoys[k].position.set(D[0], 0, D[1]);
        // a reflection faces the other way across the glass
        const look = Math.atan2(TARGET[0] - S.real[0], TARGET[2] - S.real[1]);
        const nAng = Math.atan2(P.n[0], P.n[1]);
        decoys[k].rotation.y = 2 * nAng - look + Math.PI;
        decoys[k].visible = e > 0.2;
      });
      BOLTS.forEach((tb, i) => {
        const tau = t - tb;
        bolts[i].visible = tau >= 0 && tau < 1.2;
        if (!bolts[i].visible) return;
        const from = [S.real[0], 2.3, S.real[1]];
        bolts[i].position.set(from[0] + (TARGET[0] - from[0]) * tau / 1.2, from[1] + (TARGET[1] - from[1]) * tau / 1.2, from[2] + (TARGET[2] - from[2]) * tau / 1.2);
      });
      return {S, e};
    },
  };
}

const BEATS = [
  {t: 0, mode: 'REVEALING', cap: 'FP-4 · FOUR MIRROR PANELS TELESCOPE OUT ROUND IT'},
  {t: 4, mode: 'DECEIVING', cap: 'EACH GLASS THROWS A DECOY, AS FAR BEHIND IT AS THE PROPHET STANDS IN FRONT'},
  {t: 6, mode: 'FIRING', cap: 'ONLY THE REAL ONE FIRES · FIND IT BY ITS SHOTS'},
];

export function run() {
  runSim({duration: DURATION, fps: 60, theme: 'light', hud: {enabled: false}, director: {enabled: false}, watermark: ''}, ({canvas, capture}) => {
    const st = studio(canvas, {capture, shadow: 9, fog: [40, 120]});
    const fp = build(st.scene);
    const ui = consoleUI(document.getElementById('app'), {code: 'FP-4', eyebrow: 'FRAUD ELITE · CASTS DECOYS, FIRES FROM ONE', title: 'Seer FP-4'});
    return {
      resize: st.resize,
      render(t) {
        const S = fp.update(t);
        st.aim([0, 1.4, 0], 20 + t * 6, 32 - 6 * Math.min(1, t / 6), 18);
        st.render();
        const bi = BEATS.reduce((k, b, i) => (t >= b.t ? i : k), 0);
        ui.set({
          cap: BEATS[bi].cap,
          n: bi + 1,
          mode: BEATS[bi].mode,
          right: `${S.e > 0.2 ? F.panels + 1 : 1} FIGURES`,
          rows: [
            ['ARMS', `${(F.armMin + (F.armMax - F.armMin) * S.e).toFixed(2)} m`],
            ['TURN', `${Math.round(((turnAt(t) * 180) / Math.PI) % 360)}°`],
            ['DECOYS', `${S.e > 0.2 ? F.panels : 0}`],
            ['REAL', `${S.S.real.map((v) => v.toFixed(2)).join(', ')}`],
          ],
          barsTitle: 'ARMS',
          bars: [['OUT', S.e]],
          subs: [
            ['Mirror panels ×4', S.e > 0.95 ? 'OUT' : 'EXTENDING', bi < 2],
            ['Decoys', S.e > 0.2 ? 'CAST' : '-', bi === 1],
            ['Prophet', bi === 2 ? 'FIRING' : 'HIDING', bi === 2],
          ],
        });
        return {};
      },
    };
  });
}
