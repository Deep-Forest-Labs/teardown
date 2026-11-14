// RIMWALKER DS-6: geometry and film. A flat flesh disc body on three crank stations; side frame plates carry the
// patent's fixed pivots (9, 11, 15); every Klann link is a housing or rod between solved joints with a drum at each
// joint; spiked feet; at the front a two-roller crusher that draws orbs in. Film, 20 s: walking, one leg isolated
// (crank, rockers, the two rigid triangles), swallowing orbs. render(t) is pure.
import * as THREE from 'three';
import {runSim} from '../kit/runtime.js';
import {keyed} from '../kit/util.js';
import {gear} from '../slumber-kit/studio.js';
import {partsKit, V} from '../slumber-kit/parts.js';
import {consoleUI, materials, studio} from '../slumber-kit/studio.js';
import {BODY_PER_RAD, KLINKS, pose} from './kin.js';

export const DURATION = 20;
const RPS = 0.5;
const TAU = Math.PI * 2;
const sm = (u) => {
  const x = Math.min(1, Math.max(0, u));
  return x * x * x * (x * (x * 6 - 15) + 10);
};
const ORBS = [-20.5, -22, -23.6, -25.4]; // orb x positions on the walk line: met during the swallow beat (1.42 m/s)

function build(scene) {
  const mat = materials();
  mat.orb = new THREE.MeshStandardMaterial({color: '#8fd4ff', emissive: new THREE.Color('#8fd4ff'), emissiveIntensity: 0.7});
  const root = new THREE.Group();
  scene.add(root);
  const K = partsKit(root, mat);
  const body = new THREE.Group();
  root.add(body);
  // the disc: a flat flesh dome with an accent rim, rivet ring and a dark belly ring
  K.mesh(new THREE.SphereGeometry(1.6, 48, 16, 0, TAU, 0, Math.PI / 2).scale(1, 0.32, 1), mat.flesh, body).position.y = 2.15;
  K.mesh(new THREE.TorusGeometry(1.6, 0.05, 10, 64).rotateX(Math.PI / 2), mat.accent, body).position.y = 2.15;
  K.mesh(new THREE.CylinderGeometry(1.55, 1.45, 0.12, 48), mat.dark, body).position.y = 2.09;
  for (let k = 0; k < 24; k++) {
    const a = (k / 24) * TAU;
    K.mesh(new THREE.SphereGeometry(0.035, 6, 4), mat.dark, body).position.set(Math.cos(a) * 1.5, 2.25, Math.sin(a) * 1.5);
  }
  // the mouth crusher: two toothed rollers across the front (axis z), counter-rotating
  const rollers = [-1, 1].map((sy) => {
    const r = K.mesh(gear(0.16, 12, 0.7, 0.2), mat.bone, body);
    r.position.set(-1.62, 1.75 + sy * 0.17, 0);
    return r;
  });
  K.mesh(new THREE.BoxGeometry(0.2, 0.62, 0.86), mat.fleshDeep, body).position.set(-1.45, 1.75, 0);
  // legs: links as housings/rods, drums at the joints
  const P0 = pose(0);
  const legs = P0.legs.map(() => ({
    links: KLINKS.map(([a, b]) => (a === 37 && b === 33) || (a === 35 && b === 33) ? K.housing(0.12, 0.1, {stripe: a === 37}) : K.housing(0.08, 0.07, {stripe: false, m: mat.bone})),
    drums: [15, 29, 27, 35, 37, 9, 11].map((j) => K.drum(j === 15 ? 0.14 : 0.09, 0.12)),
    spike: K.mesh(new THREE.ConeGeometry(0.06, 0.2, 12).rotateX(Math.PI).translate(0, 0.1, 0), mat.dark, root),
  }));
  // frame plates: per station and side, a plate tying the three fixed pivots to the body
  // frame: a triangle of struts through the three fixed pivots, and a strut up to the body
  const plates = P0.legs.map(() => [0, 1, 2, 3].map(() => K.housing(0.06, 0.06, {stripe: false, m: mat.steel})));
  const orbs = ORBS.map(() => K.mesh(new THREE.SphereGeometry(0.22, 18, 12), mat.orb, root));
  return {
    update(t) {
      const theta = TAU * RPS * t;
      const P = pose(theta);
      body.position.set(P.x, P.hipY - 0.06, 0);
      rollers.forEach((r, i) => (r.rotation.z = (i ? 1 : -1) * t * 3));
      P.legs.forEach((L, i) => {
        const g = legs[i];
        KLINKS.forEach(([a, b], k) => K.place(g.links[k], L.pts[a], L.pts[b], [0, 0, 1], 0.12));
        [15, 29, 27, 35, 37, 9, 11].forEach((j, k) => K.orient(g.drums[k], L.pts[j], [0, 0, 1]));
        g.spike.position.set(...L.pts[33]);
        const tri = plates[i];
        K.place(tri[0], L.pts[9], L.pts[11], [0, 0, 1]);
        K.place(tri[1], L.pts[11], L.pts[15], [0, 0, 1]);
        K.place(tri[2], L.pts[15], L.pts[9], [0, 0, 1]);
        K.place(tri[3], L.pts[9], [L.pts[9][0], P.hipY + 1.95, L.pts[9][2] * 0.85], [0, 0, 1]);
      });
      // orbs: drawn up into the rollers as the mouth passes over them, then gone
      ORBS.forEach((ox, i) => {
        const mouthX = P.x - 1.62;
        const k = Math.min(1, Math.max(0, (ox - mouthX) / 0.9 + 1));
        orbs[i].visible = mouthX > ox - 0.9;
        orbs[i].position.set(ox + (mouthX - ox) * k, 0.22 + (1.75 - 0.22) * k * k, 0);
        orbs[i].scale.setScalar(1 - 0.7 * Math.max(0, k - 0.6) / 0.4);
      });
      return P;
    },
  };
}

const BEATS = [
  {t: 0, mode: 'RIMWALKING', cap: 'DS-6 · SIX KLANN LEGS · THE BODY RIDES THE LOWEST FOOT, WHICH NEVER SLIDES'},
  {t: 6, mode: 'ONE LEG', cap: 'CRANK, TWO ROCKERS, TWO RIGID TRIANGLES · LENGTHS FROM KLANN’S PATENT'},
  {t: 12, mode: 'SWALLOW', cap: 'A TWO-ROLLER CRUSHER AT THE MOUTH DRAWS THE ORBS IN'},
];
const CAM = [
  [0, [0, 1.5, 0, 50, 14, 9]],
  [5.6, [0, 1.5, 0, 80, 12, 8.5]],
  [6.4, [0, 1.2, 1.4, 4, 6, 5.6]],
  [11.6, [0, 1.2, 1.4, 14, 8, 5.6]],
  [12.4, [-2.2, 1.0, 0, -95, 12, 6]],
  [20, [-2.2, 1.0, 0, -75, 14, 6.4]],
];

export function run() {
  runSim({duration: DURATION, fps: 60, theme: 'light', hud: {enabled: false}, director: {enabled: false}, watermark: ''}, ({canvas, capture}) => {
    const st = studio(canvas, {capture, shadow: 6, fog: [25, 90]});
    const sp = build(st.scene);
    const ui = consoleUI(document.getElementById('app'), {code: 'DS-6', eyebrow: 'ALTAR ELITE · CIRCLES THE RIM, SWALLOWS ORBS', title: 'Rimwalker DS-6'});
    return {
      resize: st.resize,
      render(t) {
        const P = sp.update(t);
        const [x, y, z, az, el, dist] = keyed(CAM, t, sm);
        st.aim([x + P.x, y, z], az, el, dist);
        st.render();
        const bi = BEATS.reduce((k, b, i) => (t >= b.t ? i : k), 0);
        const down = P.legs.filter((l) => l.foot[1] < 0.02).length;
        ui.set({
          cap: BEATS[bi].cap,
          n: bi + 1,
          mode: BEATS[bi].mode,
          right: `WALKED ${Math.abs(P.x).toFixed(1)} m`,
          rows: [
            ['CRANK', `${(RPS * 60).toFixed(0)} rpm`],
            ['SPEED', `${Math.abs(BODY_PER_RAD * TAU * RPS).toFixed(2)} m/s`],
            ['BODY', `${P.hipY.toFixed(3)} m (bob)`],
            ['FEET DOWN', `${down} / 6`],
          ],
          barsTitle: 'FOOT HEIGHT',
          bars: P.legs.map((l, i) => [`${l.sz < 0 ? 'L' : 'R'}${l.r + 1}`, Math.min(1, l.foot[1] / 0.7)]),
          subs: [
            ['Legs ×6 · Klann', 'WALKING', bi === 0],
            ['Crank stations ×3', 'TURNING', bi === 1],
            ['Crusher rollers', 'TURNING', bi === 2],
            ['Disc body', 'CARRIED', false],
          ],
        });
        return {};
      },
    };
  });
}
