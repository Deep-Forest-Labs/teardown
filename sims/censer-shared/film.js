// THURIBLE CN-2: the film (the machine's geometry is machine.js, shared with the Bestiary's Censer elite). Film, 20 s:
// idle swing, a burst of three throws (each shot ballistic from the release, a pool where it lands), the quick-return
// isolated, a second burst. render(t) is pure.
import * as THREE from 'three';
import {runSim} from '../kit/runtime.js';
import {keyed} from '../kit/util.js';
import {partsKit} from '../slumber-kit/parts.js';
import {consoleUI, materials, studio} from '../slumber-kit/studio.js';
import {cup, landing, RELEASE_THETA, shot} from './kin.js';
import {buildMachine} from './machine.js';

export const DURATION = 20;
const OMEGA = 5.5; // crank rad/s while throwing
const TAU = Math.PI * 2;
const sm = (u) => {
  const x = Math.min(1, Math.max(0, u));
  return x * x * x * (x * (x * 6 - 15) + 10);
};
// the crank runs in two bursts of three turns; θ(t) in closed form
const BURSTS = [[3, 3 + (3 * TAU) / OMEGA], [12, 12 + (3 * TAU) / OMEGA]];
const thetaAt = (t) => {
  let th = RELEASE_THETA + 0.6; // parked just after a release: the arm leans forward, the cup empty
  for (const [a, b] of BURSTS) th += OMEGA * Math.max(0, Math.min(t, b) - a);
  return th;
};
// release times: each time θ passes RELEASE_THETA (mod 2π) inside a burst
const RELEASES = (() => {
  const out = [];
  for (const [a, b] of BURSTS) {
    for (let k = 1; k <= 3; k++) {
      const th0 = thetaAt(a);
      const need = Math.ceil((th0 - RELEASE_THETA) / TAU + 1e-9) + k - 1;
      const thR = RELEASE_THETA + need * TAU;
      const tR = a + (thR - th0) / OMEGA;
      if (tR <= b + 1e-6) out.push(tR);
    }
  }
  return out;
})();

function build(scene) {
  const mat = materials();
  mat.blood = new THREE.MeshStandardMaterial({color: '#8a0f12', emissive: new THREE.Color('#ff3a1c'), emissiveIntensity: 0.35, roughness: 0.25});
  const root = new THREE.Group();
  scene.add(root);
  const K = partsKit(root, mat);
  const M = buildMachine(root, K, mat);
  const shots = RELEASES.map(() => K.mesh(new THREE.SphereGeometry(0.2, 16, 10), mat.blood, root));
  const pools = RELEASES.map(() => K.mesh(new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2), mat.blood, root));
  return {
    update(t) {
      const theta = thetaAt(t);
      const {L, B} = M.pose(theta, t);
      // the cup carries a load from the last release until the next one
      const last = RELEASES.filter((r) => r <= t).pop() ?? -1;
      const next = RELEASES.find((r) => r > t);
      M.load.visible = next !== undefined && (next - t) < (TAU / OMEGA) * 0.9 && t - last > 0.08;
      const Ld = landing(OMEGA);
      RELEASES.forEach((tr, i) => {
        const tau = t - tr;
        shots[i].visible = tau >= 0 && tau < Ld.T;
        if (shots[i].visible) shots[i].position.set(...shot(OMEGA, tau));
        const age = t - (tr + Ld.T);
        pools[i].visible = age >= 0;
        if (age >= 0) {
          pools[i].position.set(0.4 * Math.sin(i * 2.1), 0.012 + i * 0.002, Ld.at[2] + 0.35 * Math.cos(i * 1.7));
          pools[i].scale.setScalar(0.25 + 1.2 * Math.sqrt(Math.min(age, 3) / 3));
        }
      });
      return {theta, L, B};
    },
  };
}

const BEATS = [
  {t: 0, mode: 'SWINGING', cap: 'CN-2 · THE BOWL SWINGS ON ITS CHAINS · THE SWING GROWS BEFORE EACH THROW'},
  {t: 3, mode: 'LOBBING', cap: 'QUICK RETURN: SLOW WIND-UP, FAST THROW · THE SHOT CLIMBS AND POOLS'},
  {t: 7.6, mode: 'QUICK RETURN', cap: 'A CRANK PIN SLIDES IN A SLOTTED LEVER · THE THROW IS THE SHORT STROKE'},
  {t: 12, mode: 'LOBBING', cap: 'THREE MORE · THE POOLS SPREAD WHERE THEY LAND'},
];
const CAM = [
  [0, [0, 2.4, 3, 70, 14, 12]],
  [2.6, [0, 2.4, 4, 85, 12, 14]],
  [7.4, [0, 2.6, 5, 95, 14, 15]],
  [8.2, [0.2, 2.3, 0.2, 90, 6, 4.2]],
  [11.4, [0.2, 2.3, 0.2, 80, 8, 4.4]],
  [12.2, [0, 2.4, 5, 110, 16, 16]],
  [20, [0, 2.4, 5, 130, 20, 17]],
];

export function run() {
  runSim({duration: DURATION, fps: 60, theme: 'light', hud: {enabled: false}, director: {enabled: false}, watermark: ''}, ({canvas, capture}) => {
    const st = studio(canvas, {capture, shadow: 10, fog: [40, 140]});
    const cn = build(st.scene);
    const ui = consoleUI(document.getElementById('app'), {code: 'CN-2', eyebrow: 'ALTAR ELITE · LOBS BURNING BLOOD THAT POOLS', title: 'Thurible CN-2'});
    const Ld = landing(OMEGA);
    return {
      resize: st.resize,
      render(t) {
        const S = cn.update(t);
        const [x, y, z, az, el, dist] = keyed(CAM, t, sm);
        st.aim([x, y, z], az, el, dist);
        st.render();
        const bi = BEATS.reduce((k, b, i) => (t >= b.t ? i : k), 0);
        const throwing = BURSTS.some(([a, b]) => t > a && t < b);
        ui.set({
          cap: BEATS[bi].cap,
          n: bi + 1,
          mode: BEATS[bi].mode,
          right: `CRANK ${Math.round((((S.theta * 180) / Math.PI) % 360 + 360) % 360)}°`,
          rows: [
            ['CRANK', throwing ? `${((OMEGA * 60) / TAU).toFixed(0)} rpm` : 'PARKED'],
            ['LEVER', `${((S.L.ang * 180) / Math.PI).toFixed(1)}°`],
            ['PIN IN SLOT', `${S.L.slide.toFixed(2)} m`],
            ['RANGE', `${Ld.at[2].toFixed(1)} m`],
            ['FLIGHT', `${Ld.T.toFixed(2)} s`],
            ['BOWL', `${((S.B.a * 180) / Math.PI).toFixed(1)}°`],
          ],
          barsTitle: 'SWING',
          bars: [['BOWL', Math.abs(S.B.a) / 0.6]],
          subs: [
            ['Legs ×4', 'PLANTED', false],
            ['Crank · slotted lever', throwing ? 'THROWING' : 'PARKED', throwing],
            ['Cup', 'LOADED', false],
            ['Bowl · chains', Math.abs(S.B.a) > 0.35 ? 'SWINGING HIGH' : 'SWINGING', Math.abs(S.B.a) > 0.35],
          ],
        });
        void cup;
        return {};
      },
    };
  });
}
