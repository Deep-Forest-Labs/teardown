// RAGER BK-8: geometry and film. A hunched flesh brute on the biped legs, heavy arms, and on its shoulders the Watt
// governor: a spindle, two flyballs on arms at the conical-pendulum angle, links to the sleeve. Film, 18 s: four hits
// land (a flash each); after every one the governor's setpoint rises, the balls climb and the walk quickens. The walk
// distance is integrated once at load from the engine speed (stride per spindle radian). render(t) is pure.
import * as THREE from 'three';
import {runSim} from '../kit/runtime.js';
import {partsKit} from '../slumber-kit/parts.js';
import {consoleUI, materials, studio} from '../slumber-kit/studio.js';
import {armAngle, B, bipedPose, sleeve, speedAt, STRIDE_PER_RAD, W} from './kin.js';

export const DURATION = 18;
const HITS = [3, 6.5, 10, 13.5];
const sm = (u) => {
  const x = Math.min(1, Math.max(0, u));
  return x * x * x * (x * (x * 6 - 15) + 10);
};
const hitsAt = (t) => HITS.reduce((h, th) => h + sm((t - th) / 0.6), 0);
const omegaAt = (t) => speedAt(hitsAt(t));
const DT = 1 / 240;
const TAB = (() => {
  const d = [0];
  const ang = [0];
  for (let k = 1; k <= DURATION / DT + 2; k++) {
    const w = omegaAt((k - 0.5) * DT);
    d.push(d[k - 1] + w * STRIDE_PER_RAD * DT);
    ang.push(ang[k - 1] + w * DT);
  }
  return {d, ang};
})();
const tab = (arr, t) => {
  const u = Math.min(Math.max(t, 0), DURATION) / DT;
  const n = Math.floor(u);
  return arr[n] + (arr[n + 1] - arr[n]) * (u - n);
};

function build(scene) {
  const mat = materials();
  mat.flash = new THREE.MeshBasicMaterial({color: '#ffd0a0', transparent: true, opacity: 0});
  const root = new THREE.Group();
  scene.add(root);
  const K = partsKit(root, mat);
  const torso = new THREE.Group();
  root.add(torso);
  const Kt = partsKit(torso, mat);
  Kt.mesh(new THREE.SphereGeometry(0.85, 28, 20).scale(1.25, 0.95, 0.9).translate(0, 0.95, 0.15), mat.flesh, torso);
  Kt.mesh(new THREE.SphereGeometry(0.32, 20, 14).translate(0, 1.15, 0.95), mat.fleshDeep, torso);
  Kt.mesh(new THREE.BoxGeometry(0.34, 0.05, 0.04).translate(0, 1.2, 1.25), new THREE.MeshStandardMaterial({color: '#ff3a1c', emissive: new THREE.Color('#ff3a1c'), emissiveIntensity: 0.9}), torso);
  for (const sx of [-1, 1]) {
    const sh = [sx * 1.05, 1.3, 0.3];
    const el = [sx * 1.35, 0.55, 0.65];
    const fist = [sx * 1.2, -0.25, 0.95];
    Kt.orient(Kt.drum(0.26, 0.34), sh, [1, 0, 0]);
    Kt.place(Kt.housing(0.36, 0.32), sh, el, [0, 0, 1], 0.32);
    Kt.orient(Kt.drum(0.2, 0.3), el, [1, 0, 0]);
    Kt.place(Kt.housing(0.32, 0.3), el, fist, [0, 0, 1], 0.26);
    Kt.mesh(new THREE.BoxGeometry(0.45, 0.42, 0.45), mat.fleshDeep, torso).position.set(...fist);
  }
  // the governor on the shoulders
  const gov = new THREE.Group();
  gov.position.set(0, 1.85, -0.15);
  torso.add(gov);
  Kt.mesh(new THREE.CylinderGeometry(0.2, 0.25, 0.12, 20), mat.dark, gov);
  const spindle = new THREE.Group();
  gov.add(spindle);
  const top = W.l + W.link + 0.15;
  Kt.mesh(new THREE.CylinderGeometry(0.025, 0.025, top + 0.1, 10).translate(0, top / 2, 0), mat.steel, spindle);
  Kt.mesh(new THREE.SphereGeometry(0.05, 10, 8).translate(0, top, 0), mat.accent, spindle);
  const arms = [-1, 1].map(() => ({arm: Kt.housing(0.025, 0.025, {stripe: false, m: mat.bone}), link: Kt.housing(0.018, 0.018, {stripe: false, m: mat.steel}), ball: Kt.mesh(new THREE.SphereGeometry(0.1, 16, 12), mat.accent, spindle)}));
  arms.forEach((A) => {
    spindle.add(A.arm);
    spindle.add(A.link);
  });
  const sleeveM = Kt.mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.07, 14), mat.dark, spindle);
  // legs
  const legs = [0, 1].map(() => ({hip: K.drum(0.2, 0.3), thigh: K.housing(0.32, 0.3), knee: K.drum(0.18, 0.28), shank: K.housing(0.28, 0.26), foot: K.mesh(new THREE.BoxGeometry(...B.foot), mat.dark, root)}));
  const flash = new THREE.Mesh(new THREE.SphereGeometry(1.4, 20, 14), mat.flash);
  root.add(flash);
  return {
    update(t) {
      const w = tab(TAB.d, t);
      const P = bipedPose(w, t);
      torso.position.set(P.pelvis[0], P.pelvis[1] - 0.1, P.pelvis[2]);
      torso.rotation.x = 0.25 + 0.15 * (hitsAt(t) / 4);
      P.legs.forEach((L, i) => {
        const G = legs[i];
        K.orient(G.hip, L.hip, [1, 0, 0]);
        K.place(G.thigh, L.hip, L.knee, [0, 0, 1], 0.38);
        K.orient(G.knee, L.knee, [1, 0, 0]);
        K.place(G.shank, L.knee, L.ankle, [0, 0, 1], 0.32);
        G.foot.position.set(L.foot[0], L.foot[1] + B.foot[1] / 2, L.foot[2] + 0.12);
      });
      // governor: spindle angle from the integrated engine, balls at the conical-pendulum angle
      spindle.rotation.y = tab(TAB.ang, t);
      const om = omegaAt(t);
      const S = sleeve(om);
      const piv = [0, top - 0.02, 0];
      arms.forEach((A, i) => {
        const sx = i ? 1 : -1;
        const ball = [sx * Math.sin(S.th) * W.l, piv[1] - Math.cos(S.th) * W.l, 0];
        const mid = [sx * S.mid[0], piv[1] + S.mid[1], 0];
        const sl = [0, piv[1] + S.y, 0];
        Kt.place(A.arm, piv, ball, [0, 0, 1]);
        Kt.place(A.link, mid, sl, [0, 0, 1]);
        A.ball.position.set(...ball);
      });
      sleeveM.position.set(0, piv[1] + S.y, 0);
      // the flash of each hit
      const near = HITS.map((th) => Math.max(0, 1 - Math.abs(t - th) / 0.25)).reduce((a, b) => Math.max(a, b), 0);
      mat.flash.opacity = 0.35 * near;
      flash.position.copy(torso.position).add(new THREE.Vector3(0, 1, 0.3));
      return {P, om, S, w};
    },
  };
}

const BEATS = [
  {t: 0, mode: 'ADVANCING', cap: 'BK-8 · A WATT GOVERNOR ON ITS SHOULDERS SETS ITS ENGINE SPEED'},
  {t: 3, mode: 'HIT', cap: 'EVERY HIT KNOCKS THE SETPOINT UP · THE BALLS CLIMB, THE ENGINE RUNS FASTER'},
  {t: 10, mode: 'RAGING', cap: 'cos θ = g ÷ (ω²·l) · THE MORE YOU HURT IT, THE FASTER IT COMES'},
];

export function run() {
  runSim({duration: DURATION, fps: 60, theme: 'light', hud: {enabled: false}, director: {enabled: false}, watermark: ''}, ({canvas, capture}) => {
    const st = studio(canvas, {capture, shadow: 7, fog: [30, 110]});
    const bk = build(st.scene);
    const ui = consoleUI(document.getElementById('app'), {code: 'BK-8', eyebrow: 'WRATH ELITE · GROWS FASTER AS IT TAKES DAMAGE', title: 'Rager BK-8'});
    return {
      resize: st.resize,
      render(t) {
        const S = bk.update(t);
        st.aim([S.P.pelvis[0], 2.6, S.P.pelvis[2]], 145 + t * 4, 14, 9);
        st.render();
        const bi = BEATS.reduce((k, b, i) => (t >= b.t ? i : k), 0);
        ui.set({
          cap: BEATS[bi].cap,
          n: bi + 1,
          mode: BEATS[bi].mode,
          right: `WALKED ${S.w.toFixed(1)} m`,
          rows: [
            ['HITS', `${Math.round(hitsAt(t))}`],
            ['ENGINE', `${S.om.toFixed(2)} rad/s`],
            ['BALL ANGLE', `${((armAngle(S.om) * 180) / Math.PI).toFixed(1)}°`],
            ['SLEEVE', `+${(S.S.lift * 100).toFixed(1)} cm`],
            ['WALK', `${(S.om * STRIDE_PER_RAD).toFixed(2)} m/s`],
          ],
          barsTitle: 'RAGE',
          bars: [['SPEED', (S.om - 5) / 5]],
          subs: [
            ['Watt governor', 'SPINNING', bi === 0],
            ['Setpoint', `STEP ${Math.round(hitsAt(t))}`, bi === 1],
            ['Legs ×2', 'WALKING', bi === 2],
          ],
        });
        return {};
      },
    };
  });
}
