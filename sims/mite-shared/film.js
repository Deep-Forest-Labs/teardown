// MITE MT-1 film, 26 s: hover, the drive isolated, the bite, the teardown, then the swarm milling round a target.
// render(t) is pure: the crank angle is 2π·f·t, the bite is keyed, the flock comes from the pure mill model.
import * as THREE from 'three';
import {runSim} from '../kit/runtime.js';
import {keyed} from '../kit/util.js';
import {consoleUI, studio} from '../slumber-kit/studio.js';
import {skullAt, SPEC as MILL} from '../hub/enemies/skull.kin.js';
import {amplitude, G, LINK, ROD} from './kin.js';
import {buildFlock, buildMite} from './machine.js';

export const DURATION = 26;
const FLAP = 5; // Hz
const sm = (u) => {
  const x = Math.min(1, Math.max(0, u));
  return x * x * x * (x * (x * 6 - 15) + 10);
};
const BEATS = [
  {t: 0, mode: 'HOVERING', cap: 'MT-1 · THE SWARM, TIER ONE · ONE CRANK FLAPS BOTH WINGS'},
  {t: 4.5, mode: 'DRIVE', cap: 'CRANK, TWO RODS, TWO ROCKERS · ±29.6° STROKE FROM ONE TURN'},
  {t: 9.5, mode: 'BITE', cap: 'ANGULAR GRIPPER · A SLIDER AND TWO TOGGLE LINKS SHUT THE MANDIBLES'},
  {t: 14, mode: 'TEARDOWN', cap: 'CAGE THORAX, DRIVE, WINGS, HEAD, GRIPPER, ABDOMEN, LEGS'},
  {t: 19, mode: 'SWARM', cap: 'TWENTY-EIGHT MILL ROUND THE TARGET · ONE STRIKE EVERY 0.32 S'},
];
const HERO = [0, 1.25, 0];
const CAM = [
  [0, [...HERO, 35, 14, 1.5]],
  [4, [...HERO, 60, 10, 1.4]],
  [5, [0, 1.3, 0.02, 90, 4, 0.75]],
  [9.2, [0, 1.3, 0.02, 100, 8, 0.8]],
  [10, [0, 1.21, 0.3, 28, -14, 0.5]],
  [13.6, [0, 1.21, 0.3, -24, -12, 0.5]],
  [14.4, [...HERO, 40, 18, 1.8]],
  [18.4, [...HERO, 80, 16, 1.9]],
  [19.6, [0, 1.6, 0, 30, 24, 15]],
  [26, [0, 1.6, 0, 60, 22, 14]],
];
const biteAt = (t) => keyed([[0, 0.15], [9.8, 0.15], [10.6, 0], [11.4, 0], [11.55, 1], [12.3, 1], [12.9, 0.15], [26, 0.15]], t);

export function run() {
  runSim({duration: DURATION, fps: 60, theme: 'light', hud: {enabled: false}, director: {enabled: false}, watermark: ''}, ({canvas, capture}) => {
    const st = studio(canvas, {capture, shadow: 3, fog: [20, 80]});
    const mite = buildMite(st.scene);
    mite.root.position.set(...HERO);
    const flock = buildFlock(st.scene, MILL.n);
    // the target the swarm mills round: a bone post, player height
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.35, 1.8, 24).translate(0, 0.9, 0), new THREE.MeshStandardMaterial({color: '#cfc6b6', roughness: 0.8}));
    post.castShadow = true;
    st.scene.add(post);
    const ui = consoleUI(document.getElementById('app'), {code: 'MT-1', eyebrow: 'SWARM · TIER ONE · EVERY LAYER', title: 'Mite MT-1'});
    const A = amplitude();
    return {
      resize: st.resize,
      render(t) {
        const theta = TAU * FLAP * t;
        const bite = biteAt(t);
        const explode = Math.min(sm((t - 14.4) / 1.4), 1 - sm((t - 17.6) / 1.2));
        const swarm = sm((t - 19) / 0.8);
        // the hero: bobs a little; hidden once the swarm takes over
        mite.root.position.set(HERO[0], HERO[1] + 0.02 * Math.sin(t * 2.1), HERO[2]);
        mite.root.rotation.set(0.04 * Math.sin(t * 1.3), 0, 0);
        mite.root.visible = swarm < 1;
        const P = mite.update(theta, bite, {explode});
        // ghost the flesh while the drive is shown
        const iso = Math.min(sm((t - 4.6) / 0.6), 1 - sm((t - 9.2) / 0.6));
        for (const k of ['flesh', 'membrane']) {
          const m = mite.mat[k];
          m.transparent = true;
          m.opacity = (k === 'membrane' ? 0.38 : 1) * (1 - 0.85 * iso);
          m.depthWrite = k !== 'membrane' && iso < 0.5;
        }
        // the swarm: the pure mill, round the post
        post.visible = swarm > 0;
        for (let i = 0; i < MILL.n; i++) {
          const a = skullAt(i, t - 19 + 4, [0, 0, 0]);
          const b = skullAt(i, t - 19 + 4 + 0.02, [0, 0, 0]);
          flock.set(i, a.p, [b.p[0] - a.p[0], b.p[1] - a.p[1], b.p[2] - a.p[2]], 0.5 * Math.sin(theta + i));
        }
        flock.commit(swarm > 0 ? MILL.n : 0);
        const [x, y, z, az, el, dist] = keyed(CAM, t, (u) => sm(u));
        st.aim([x, y, z], az, el, dist);
        st.render();
        const bi = BEATS.reduce((k, b, i) => (t >= b.t ? i : k), 0);
        const gape = Math.hypot(P.jaws[0].tip[0] - P.jaws[1].tip[0], P.jaws[0].tip[1] - P.jaws[1].tip[1]);
        ui.set({
          cap: BEATS[bi].cap,
          n: bi + 1,
          mode: BEATS[bi].mode,
          right: `CRANK ${((((theta * 180) / Math.PI) % 360) + 360) % 360 | 0}°`,
          rows: [
            ['FLAP', `${FLAP.toFixed(1)} Hz`],
            ['STROKE', `${((P.wings[1].stroke * 180) / Math.PI).toFixed(1)}°`],
            ['RANGE', `${((A.lo * 180) / Math.PI).toFixed(1)}° / ${((A.hi * 180) / Math.PI).toFixed(1)}°`],
            ['ROD · LEVER', `${(ROD * 1000).toFixed(0)} · ${(G.lever * 1000).toFixed(0)} mm`],
            ['GAPE', `${(gape * 100).toFixed(1)} cm`],
            ['TOGGLE LINK', `${(LINK * 1000).toFixed(1)} mm`],
          ],
          barsTitle: 'WING STROKE',
          bars: [
            ['L', 0.5 + P.wings[0].stroke / (2 * A.hi)],
            ['R', 0.5 + P.wings[1].stroke / (2 * A.hi)],
          ],
          subs: [
            ['Drive · crank-rocker ×2', 'FLAPPING', bi === 1],
            ['Wings ×2 · veined', 'BEATING', false],
            ['Gripper · toggle', bite > 0.95 ? 'SHUT' : bite < 0.05 ? 'OPEN' : 'MOVING', bi === 2],
            ['Optics ×2', 'TRACKING', false],
            ['Abdomen · cell', 'CHARGED', false],
            ['Assembly', explode > 0.02 ? `${Math.round(explode * 100)}% APART` : 'LOCKED', explode > 0.02],
          ],
        });
        return {};
      },
    };
  });
}
const TAU = Math.PI * 2;
