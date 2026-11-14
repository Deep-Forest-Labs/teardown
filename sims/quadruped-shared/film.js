// STALKER QD-4: geometry and film in one file (it is small). Spot/Cheetah proportions ×2.5 in the Telson part
// language: a plated flesh chassis, a sensor head, hip drums, thigh and shank housings, knee drums, ball feet.
// Film, 16 s: stalking (trot), the stop, the crouch, the pounce (ballistic), the landing. render(t) is pure.
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {runSim} from '../kit/runtime.js';
import {keyed} from '../kit/util.js';
import {partsKit} from '../slumber-kit/parts.js';
import {consoleUI, materials, studio} from '../slumber-kit/studio.js';
import {pose, Q, SCRIPT} from './kin.js';

export const DURATION = 16;
const sm = (u) => {
  const x = Math.min(1, Math.max(0, u));
  return x * x * x * (x * (x * 6 - 15) + 10);
};

function build(scene) {
  const mat = materials();
  const root = new THREE.Group();
  scene.add(root);
  const K = partsKit(root, mat);
  const chassis = new THREE.Group();
  root.add(chassis);
  const [W, H, L] = Q.body;
  K.mesh(new RoundedBoxGeometry(W, H, L, 4, 0.14), mat.fleshDeep, chassis);
  // dorsal plates: overlapping flesh panels with accent stripes and rivets
  for (let i = 0; i < 6; i++) {
    const z = L / 2 - 0.22 - i * 0.36;
    K.mesh(new RoundedBoxGeometry(W * 1.04, 0.08, 0.4, 2, 0.03), mat.flesh, chassis).position.set(0, H / 2 + 0.03 + i * 0.004, z);
    K.mesh(new THREE.BoxGeometry(W * 0.9, 0.012, 0.03), mat.accent, chassis).position.set(0, H / 2 + 0.075 + i * 0.004, z + 0.12);
    for (const sx of [-1, 1]) K.mesh(new THREE.SphereGeometry(0.018, 6, 4), mat.dark, chassis).position.set(sx * W * 0.45, H / 2 + 0.075, z - 0.12);
  }
  // sensor head: a pod with two optics and a lower jaw
  const head = new THREE.Group();
  head.position.set(0, 0.08, L / 2 + 0.22);
  chassis.add(head);
  K.mesh(new RoundedBoxGeometry(W * 0.8, H * 0.8, 0.5, 3, 0.12), mat.flesh, head);
  for (const sx of [-1, 1]) {
    K.mesh(new THREE.CylinderGeometry(0.075, 0.08, 0.08, 24).rotateX(Math.PI / 2).translate(sx * 0.14, 0.06, 0.27), mat.bone, head);
    K.mesh(new THREE.TorusGeometry(0.065, 0.01, 8, 24).translate(sx * 0.14, 0.06, 0.31), mat.accent, head);
    K.mesh(new THREE.CircleGeometry(0.055, 24).translate(sx * 0.14, 0.06, 0.312), new THREE.MeshPhysicalMaterial({color: '#151416', roughness: 0.06, clearcoat: 1}), head);
  }
  const jaw = K.mesh(new RoundedBoxGeometry(W * 0.6, 0.08, 0.42, 2, 0.03), mat.bone, head);
  jaw.position.set(0, -0.2, 0.08);
  // legs
  const legs = ['FL', 'FR', 'BL', 'BR'].map(() => ({
    abd: K.drum(0.16, 0.2),
    hip: K.drum(0.14, 0.22),
    thigh: K.housing(0.2, 0.17),
    knee: K.drum(0.11, 0.2),
    shank: K.housing(0.13, 0.12),
    foot: K.mesh(new THREE.SphereGeometry(0.09, 18, 12), mat.dark, root),
    ring: K.mesh(new THREE.TorusGeometry(0.085, 0.015, 8, 24).rotateX(Math.PI / 2), mat.accent, root),
  }));
  return {
    root,
    update(t) {
      const P = pose(t);
      chassis.position.set(...P.body.p);
      chassis.rotation.x = -P.body.pitch;
      jaw.rotation.x = t > SCRIPT.leap[0] && t < SCRIPT.land[0] ? 0.45 : 0.05;
      P.legs.forEach((Lg, i) => {
        const G = legs[i];
        K.orient(G.abd, Lg.hip, [0, 0, 1]);
        K.orient(G.hip, Lg.hip, [1, 0, 0]);
        K.place(G.thigh, Lg.hip, Lg.knee, [Lg.sx, 0, 0], 0.26);
        K.orient(G.knee, Lg.knee, [1, 0, 0]);
        K.place(G.shank, Lg.knee, Lg.foot, [Lg.sx, 0, 0], 0.2);
        G.foot.position.set(Lg.foot[0], Lg.foot[1] + 0.09, Lg.foot[2]);
        G.ring.position.set(Lg.foot[0], Lg.foot[1] + 0.13, Lg.foot[2]);
      });
      return P;
    },
  };
}

const BEATS = [
  {t: 0, mode: 'STALKING', cap: 'QD-4 · A SLOW TROT · DIAGONAL PAIRS · PLANTED FEET NEVER SLIDE'},
  {t: 9, mode: 'CROUCH', cap: 'IT STOPS, FINISHES ITS STEP AND LOADS ITS HAUNCHES (THE TELL)'},
  {t: 10.6, mode: 'POUNCE', cap: 'PUSH-OFF UNTIL EACH LEG IS FULLY EXTENDED · A 6 M BALLISTIC LEAP'},
  {t: 11.9, mode: 'LANDED', cap: 'FORELEGS REACH, IT LANDS IN A CROUCH AND STANDS'},
];
const CAM = [
  [0, [0, 1.3, 1.5, 60, 14, 7.5]],
  [8.6, [0, 1.3, 3.4, 95, 10, 7.5]],
  [9.4, [0, 1.1, 3.8, 135, 12, 5.8]],
  [10.5, [0, 1.6, 6.5, 90, 8, 10]],
  [12.2, [0, 1.6, 7, 80, 8, 10]],
  [13.2, [0, 1.3, 9.6, 30, 14, 7]],
  [16, [0, 1.3, 9.6, 10, 16, 7]],
];

export function run() {
  runSim({duration: DURATION, fps: 60, theme: 'light', hud: {enabled: false}, director: {enabled: false}, watermark: ''}, ({canvas, capture}) => {
    const st = studio(canvas, {capture, shadow: 7, fog: [30, 110]});
    const q = build(st.scene);
    const ui = consoleUI(document.getElementById('app'), {code: 'QD-4', eyebrow: 'CHASER · STALKS AND POUNCES', title: 'Stalker QD-4'});
    return {
      resize: st.resize,
      render(t) {
        const P = q.update(t);
        const [x, y, z, az, el, dist] = keyed(CAM, t, sm);
        st.aim([x, y, z], az, el, dist);
        st.render();
        const bi = BEATS.reduce((k, b, i) => (t >= b.t ? i : k), 0);
        ui.set({
          cap: BEATS[bi].cap,
          n: bi + 1,
          mode: BEATS[bi].mode,
          right: `T ${t.toFixed(1)} s`,
          rows: [
            ['BODY HEIGHT', `${P.body.p[1].toFixed(2)} m`],
            ['PITCH', `${((P.body.pitch * 180) / Math.PI).toFixed(1)}°`],
            ['TRAVEL', `${P.body.p[2].toFixed(2)} m`],
            ['FEET DOWN', `${P.legs.filter((L) => L.stance).length} / 4`],
            ['LEG', `${Q.thigh} + ${Q.shank} m`],
          ],
          barsTitle: 'FOOT LIFT',
          bars: P.legs.map((L) => [L.id, Math.min(1, L.foot[1] / 1.2)]),
          subs: [
            ['Legs ×4 · 3 drums', bi === 0 ? 'TROTTING' : bi === 2 ? 'TUCKED' : 'PLANTED', bi === 0],
            ['Haunches', bi === 1 ? 'LOADED' : '-', bi === 1],
            ['Jaw', bi === 2 ? 'OPEN' : 'SHUT', bi === 2],
            ['Optics ×2', 'LOCKED ON', false],
          ],
        });
        return {};
      },
    };
  });
}
