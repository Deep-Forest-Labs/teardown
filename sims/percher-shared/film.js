// ROOST PR-3: geometry and film. A tall perch with a cross bar; a hunched flesh body with folded plated wings; two
// legs (housings, drums) down to feet whose toes close round the bar (posed from kin.js); a dart launcher under the
// chest that tracks the target below. Film, 16 s: landing (the grip closes as it settles), perched and firing down,
// the grip isolated, take-off. render(t) is pure.
import * as THREE from 'three';
import {runSim} from '../kit/runtime.js';
import {keyed} from '../kit/util.js';
import {partsKit, twoBone} from '../slumber-kit/parts.js';
import {consoleUI, materials, studio} from '../slumber-kit/studio.js';
import {dart, grip, P} from './kin.js';

export const DURATION = 16;
const sm = (u) => {
  const x = Math.min(1, Math.max(0, u));
  return x * x * x * (x * (x * 6 - 15) + 10);
};
const gripAt = (t) => keyed([[0, 0], [1.2, 0], [2.2, 1], [13.2, 1], [13.8, 0.3], [16, 0]], t, sm);
const liftAt = (t) => keyed([[0, 2.2], [1.6, 0], [13.4, 0], [16, 6]], t, sm); // body height above its perched pose
const targetAt = (t) => [3 * Math.sin(t * 0.35), 0.9, 9 + 2 * Math.cos(t * 0.3)];
const SHOTS = [4.2, 5.4, 6.6, 8.6, 9.8, 11];

function build(scene) {
  const mat = materials();
  mat.dart = new THREE.MeshStandardMaterial({color: '#ff4a1c', emissive: new THREE.Color('#ff4a1c'), emissiveIntensity: 0.8});
  const root = new THREE.Group();
  scene.add(root);
  const K = partsKit(root, mat);
  const Y = P.perch.y;
  // the perch: a post and a cross bar along x
  K.mesh(new THREE.CylinderGeometry(0.22, 0.3, Y, 20).translate(0, Y / 2, -0.6), mat.bone, root);
  K.mesh(new THREE.BoxGeometry(0.3, 0.3, 0.7).translate(0, Y, -0.3), mat.bone, root);
  K.mesh(new THREE.CylinderGeometry(P.perch.r, P.perch.r, 1.6, 24).rotateZ(Math.PI / 2).translate(0, Y, 0), mat.dark, root);
  // the body: torso capsule, neck and head, folded wings
  const body = new THREE.Group();
  root.add(body);
  K.mesh(new THREE.CapsuleGeometry(0.32, 0.5, 6, 24).rotateX(0.5), mat.flesh, body);
  K.mesh(new THREE.CapsuleGeometry(0.12, 0.25, 4, 16).rotateX(-0.6).translate(0, 0.42, 0.32), mat.fleshDeep, body);
  const head = new THREE.Group();
  head.position.set(0, 0.55, 0.48);
  body.add(head);
  K.mesh(new THREE.SphereGeometry(0.16, 20, 14).scale(1, 0.9, 1.3), mat.flesh, head);
  for (const sx of [-1, 1]) {
    K.mesh(new THREE.CylinderGeometry(0.05, 0.055, 0.05, 18).rotateZ(Math.PI / 2).translate(sx * 0.14, 0.03, 0.06), mat.bone, head);
    K.mesh(new THREE.CircleGeometry(0.04, 18).rotateY(sx * Math.PI / 2).translate(sx * 0.168, 0.03, 0.06), new THREE.MeshPhysicalMaterial({color: '#151416', clearcoat: 1}), head);
  }
  K.mesh(new THREE.ConeGeometry(0.06, 0.24, 12).rotateX(Math.PI / 2).translate(0, -0.03, 0.28), mat.bone, head);
  for (const sx of [-1, 1]) {
    const w = K.mesh(new THREE.BoxGeometry(0.05, 0.75, 0.32), mat.flesh, body);
    w.position.set(sx * 0.33, 0.05, -0.12);
    w.rotation.set(0.55, 0, sx * 0.12);
    for (let k = 0; k < 4; k++) K.mesh(new THREE.BoxGeometry(0.055, 0.02, 0.3), mat.dark, w).position.y = -0.3 + k * 0.2;
  }
  // the launcher: a turreted tube under the chest
  const turret = new THREE.Group();
  body.add(turret);
  turret.position.set(0, -0.35, 0.18);
  K.mesh(new THREE.SphereGeometry(0.12, 16, 12), mat.dark, turret);
  const tube = new THREE.Group();
  turret.add(tube);
  K.mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.45, 14).rotateX(Math.PI / 2).translate(0, 0, 0.22), mat.steel, tube);
  K.mesh(new THREE.TorusGeometry(0.05, 0.01, 6, 16).translate(0, 0, 0.45), mat.accent, tube);
  // legs and feet
  const legs = P.feet.map(() => ({hip: K.drum(0.08, 0.12), femur: K.housing(0.1, 0.09), knee: K.drum(0.07, 0.11), tibia: K.housing(0.08, 0.07), ankle: K.drum(0.06, 0.1), toes: []}));
  legs.forEach((L) => {
    for (let k = 0; k < 4; k++) L.toes.push([0, 1, 2].map((j) => K.housing(0.045 - j * 0.007, 0.04 - j * 0.006, {stripe: false, m: j === 2 ? mat.dark : mat.bone})));
  });
  const darts = SHOTS.map(() => K.mesh(new THREE.ConeGeometry(0.05, 0.3, 10).rotateX(Math.PI / 2), mat.dart, root));
  return {
    update(t) {
      const g = gripAt(t);
      const lift = liftAt(t);
      const G = grip(g);
      const bodyP = [0, Y + 0.95 + lift, -0.1];
      body.position.set(...bodyP);
      const target = targetAt(t);
      // feet: toe joints in the bar's y-z plane at each foot's x; the hallux behind
      legs.forEach((L, i) => {
        const fx = P.feet[i];
        const lifted = lift * 0.85;
        const toes = [...P.toesFwd.map((dx) => ({dx, pts: G.fwd})), {dx: 0, pts: G.back}];
        const base = [fx, Y + G.fwd[0][0] + lifted, G.fwd[0][1]];
        toes.forEach((T, k) => {
          T.pts.slice(0, 3).forEach((p, j) => {
            const a = [fx + T.dx, Y + p[0] + lifted, p[1]];
            const b = [fx + T.dx * 1.2, Y + T.pts[j + 1][0] + lifted, T.pts[j + 1][1]];
            K.place(L.toes[k][j], a, b, [1, 0, 0]);
          });
        });
        const ankle = [fx, base[1] + 0.06, base[2] + 0.02];
        const hip = [fx * 0.9, bodyP[1] - 0.25, bodyP[2] - 0.05];
        const knee = twoBone(hip, ankle, 0.5, 0.55, [0, 0.2, 1]) || hip;
        K.orient(L.hip, hip, [1, 0, 0]);
        K.place(L.femur, hip, knee, [0, 0, 1], 0.14);
        K.orient(L.knee, knee, [1, 0, 0]);
        K.place(L.tibia, knee, ankle, [0, 0, 1], 0.12);
        K.orient(L.ankle, ankle, [1, 0, 0]);
      });
      // launcher aim at the target (local to the body: the body does not turn)
      const muzzle = [bodyP[0], bodyP[1] - 0.35, bodyP[2] + 0.4];
      const D0 = dart(muzzle, target, 0);
      turret.rotation.y = D0.az;
      tube.rotation.x = -D0.el;
      SHOTS.forEach((ts, i) => {
        const tau = t - ts;
        const tg = targetAt(ts);
        const D = dart(muzzle, tg, Math.max(0, tau));
        darts[i].visible = tau >= 0 && tau < D.T;
        if (darts[i].visible) {
          darts[i].position.set(...D.p);
          const D2 = dart(muzzle, tg, tau + 0.01);
          darts[i].lookAt(...D2.p);
        }
      });
      return {g, target, el: D0.el};
    },
  };
}

const BEATS = [
  {t: 0, mode: 'LANDING', cap: 'PR-3 · IT DROPS ONTO THE PERCH AND THE TOES CLOSE ROUND THE BAR'},
  {t: 3.2, mode: 'FIRING', cap: 'PERCHED HIGH, THE LAUNCHER TRACKS YOU AND FIRES DOWN, AIMED BY BALLISTICS'},
  {t: 11.6, mode: 'GRIP', cap: 'THREE TOES FORWARD, ONE BACK · EVERY PHALANX A CHORD ROUND THE BAR'},
  {t: 13.2, mode: 'TAKE-OFF', cap: 'THE GRIP OPENS AND IT LIFTS AWAY'},
];
const CAM = [
  [0, [0, 7.8, 0, 60, 8, 8]],
  [3, [0, 5, 3, 70, 18, 13]],
  [11.2, [0, 5, 3, 100, 18, 13]],
  [11.8, [0.22, 6.05, 0.05, 20, 12, 1.5]],
  [13, [0.22, 6.05, 0.05, 40, 16, 1.6]],
  [13.6, [0, 7.5, 0, 60, 10, 8]],
  [16, [0, 9, 0, 40, 8, 10]],
];

export function run() {
  runSim({duration: DURATION, fps: 60, theme: 'light', hud: {enabled: false}, director: {enabled: false}, watermark: ''}, ({canvas, capture}) => {
    const st = studio(canvas, {capture, shadow: 9, fog: [40, 120]});
    const pr = build(st.scene);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.35, 1.8, 20).translate(0, 0.9, 0), new THREE.MeshStandardMaterial({color: '#cfc6b6', roughness: 0.8}));
    post.castShadow = true;
    st.scene.add(post);
    const ui = consoleUI(document.getElementById('app'), {code: 'PR-3', eyebrow: 'VOID ELITE · HOLDS THE HIGH PERCHES, FIRES DOWN', title: 'Roost PR-3'});
    return {
      resize: st.resize,
      render(t) {
        const S = pr.update(t);
        post.position.set(S.target[0], 0, S.target[2]);
        const [x, y, z, az, el, dist] = keyed(CAM, t, sm);
        st.aim([x, y, z], az, el, dist);
        st.render();
        const bi = BEATS.reduce((k, b, i) => (t >= b.t ? i : k), 0);
        ui.set({
          cap: BEATS[bi].cap,
          n: bi + 1,
          mode: BEATS[bi].mode,
          right: `PERCH ${P.perch.y} m`,
          rows: [
            ['GRIP', `${Math.round(S.g * 100)}%`],
            ['TOES', '3 fwd · 1 back'],
            ['PHALANGES', P.phal.map((l) => (l * 100).toFixed(0)).join('·') + ' cm'],
            ['AIM', `${((S.el * 180) / Math.PI).toFixed(1)}°`],
            ['DART', `${P.dart.v} m/s`],
          ],
          barsTitle: 'GRIP',
          bars: [['TOES', S.g]],
          subs: [
            ['Feet ×2 · toes ×4', S.g > 0.95 ? 'LOCKED' : S.g > 0.05 ? 'CLOSING' : 'OPEN', bi === 0 || bi === 2],
            ['Launcher', bi === 1 ? 'FIRING' : 'TRACKING', bi === 1],
            ['Wings', 'FOLDED', false],
          ],
        });
        return {};
      },
    };
  });
}
