// STINGER SC-1 film, 30 s, in Telson's manner: standing, walking (feet planted, no slip), the left chela opening,
// the tail striking, the tail apart along its chain. render(t) is pure.
import {runSim} from '../kit/runtime.js';
import {keyed} from '../kit/util.js';
import {consoleUI, studio} from '../slumber-kit/studio.js';
import {B} from './kin.js';
import {buildScorpion} from './machine.js';

export const DURATION = 30;
const sm = (u) => {
  const x = Math.min(1, Math.max(0, u));
  return x * x * x * (x * (x * 6 - 15) + 10);
};
const BEATS = [
  {t: 0, mode: 'STANDING', cap: 'SC-1 · EIGHT LEGS, TWO CHELAE, A SIX-HOUSING TAIL · A DRUM AT EVERY JOINT'},
  {t: 4, mode: 'WALKING', cap: 'ALTERNATING TETRAPOD · FOUR FEET ALWAYS DOWN · PLANTED FEET NEVER SLIDE'},
  {t: 10.5, mode: 'CLAW L OPEN', cap: 'CHELA · GLASS-TOPPED SHELL, FIXED FINGER, HINGED FINGER'},
  {t: 15.5, mode: 'STRIKE', cap: 'TAIL STRIKE · THE FIRST DRUM THROWS IT UP, THE REST ROLL THE STINGER DOWN'},
  {t: 21, mode: 'TAIL APART', cap: 'SIX HOUSINGS, SIX DRUMS, THE BULB AND THE BLADE'},
  {t: 26, mode: 'STANDING', cap: 'SC-1 STINGER · FLESH PLATES OVER MACHINED JOINTS'},
];
// walk distance: still, walk 4 → 10 at 0.5 m/s, still after
const walkAt = (t) => (t < 4 ? 0 : t < 10 ? 0.5 * (t - 4) - (0.5 * (1 - sm((t - 4) / 0.8)) * 0.4) * 0 : 3);
const strikeAt = (t) => keyed([[0, 0], [16.2, 0], [16.45, 1], [17.4, 1], [18.6, 0], [30, 0]], t);
const clawL = (t) => (t > 10.8 && t < 15 ? 0.5 + 0.5 * Math.sin((t - 10.8) * 2.6 - Math.PI / 2) : 0.08);
const CAM = [
  [0, [0, 0.9, 0, 38, 18, 6.2]],
  [3.6, [0, 0.9, 0, 60, 16, 6]],
  [4.6, [0, 0.8, 1.2, 95, 10, 6.8]],
  [9.8, [0, 0.8, 2.8, 105, 12, 6.8]],
  [10.8, [-0.55, 0.65, 4.7, -40, 22, 1.7]],
  [14.8, [-0.55, 0.65, 4.7, -10, 24, 1.8]],
  [15.6, [0, 1.3, 3, 92, 8, 6.4]],
  [20.6, [0, 1.3, 3, 98, 10, 6.4]],
  [21.4, [0, 1.6, 2.4, 120, 16, 5.6]],
  [25.6, [0, 1.6, 2.4, 140, 18, 5.6]],
  [26.4, [0, 0.9, 3, 30, 18, 6.6]],
  [30, [0, 0.9, 3, 10, 20, 6.8]],
];

export function run() {
  runSim({duration: DURATION, fps: 60, theme: 'light', hud: {enabled: false}, director: {enabled: false}, watermark: ''}, ({canvas, capture}) => {
    const st = studio(canvas, {capture, shadow: 5, fog: [25, 90]});
    const sc = buildScorpion(st.scene);
    const ui = consoleUI(document.getElementById('app'), {code: 'SC-1', eyebrow: 'GROUND ELITE · EVERY LAYER', title: 'Stinger SC-1'});
    return {
      resize: st.resize,
      render(t) {
        const w = walkAt(t);
        const k = strikeAt(t);
        const cl = clawL(t);
        const apart = Math.min(sm((t - 21.4) / 1.2), 1 - sm((t - 24.6) / 1.2));
        const P = sc.update(w, cl, 0.08, k, t, {tailApart: apart});
        const [x, y, z, az, el, dist] = keyed(CAM, t, (u) => sm(u));
        st.aim([x, y, z], az, el, dist);
        st.render();
        const bi = BEATS.reduce((kk, b, i) => (t >= b.t ? i : kk), 0);
        const down = P.legs.filter((L) => L.stance).length;
        ui.set({
          cap: BEATS[bi].cap,
          n: bi + 1,
          mode: BEATS[bi].mode,
          right: `WALKED ${w.toFixed(2)} m`,
          rows: [
            ['STRIDE', `${B.stride.toFixed(2)} m`],
            ['FEET DOWN', `${down} / 8`],
            ['CLAW L', `${Math.round(cl * 100)}% OPEN`],
            ['STRIKE', `${Math.round(k * 100)}%`],
            ['STINGER', `${P.tip[1].toFixed(2)} m up`],
            ['TAIL', `${B.tail.links.length} housings`],
          ],
          barsTitle: 'LEG LOAD · STANCE',
          bars: P.legs.map((L, i) => [`${L.sx < 0 ? 'L' : 'R'}${L.row + 1}`, L.stance ? 0.4 + 0.15 * (i % 3) : 0.05]),
          subs: [
            ['Legs ×8 · 3 drums each', w > 0 && w < 3 ? 'WALKING' : 'STANDING', bi === 1],
            ['Chela L', cl > 0.5 ? 'OPEN' : 'SHUT', bi === 2],
            ['Chela R', 'SHUT', false],
            ['Tail ×6 drums', k > 0.5 ? 'STRUCK' : 'COCKED', bi === 3],
            ['Telson · blade', 'ARMED', false],
            ['Assembly', apart > 0.02 ? `${Math.round(apart * 100)}% APART` : 'LOCKED', apart > 0.02],
          ],
        });
        return {};
      },
    };
  });
}
