// PUFFER PF-2 film, 20 s: holding closed, swelling (the chains extend, the shell parts), the core exposed, the
// charge on its duct, the teardown. render(t) is pure.
import * as THREE from 'three';
import {runSim} from '../kit/runtime.js';
import {keyed} from '../kit/util.js';
import {consoleUI, studio} from '../slumber-kit/studio.js';
import {S} from './kin.js';
import {buildPuffer} from './machine.js';

export const DURATION = 20;
const sm = (u) => {
  const x = Math.min(1, Math.max(0, u));
  return x * x * x * (x * (x * 6 - 15) + 10);
};
const BEATS = [
  {t: 0, mode: 'HOLDING', cap: 'PF-2 · TWELVE PLATES ON A DODECAHEDRON · CLOSED, THEY TILE THE SPHERE'},
  {t: 3.5, mode: 'SWELLING', cap: 'ELEVEN SCISSOR CHAINS PUSH THE PLATES OUT · 1.72× ITS CLOSED SIZE'},
  {t: 8, mode: 'EXPOSED', cap: 'THE SEAMS OPEN ON THE CORE · POP IT AT RANGE'},
  {t: 12, mode: 'CHARGE', cap: 'THE AFT DUCT SPOOLS UP AND IT FLIES IN'},
  {t: 15.5, mode: 'TEARDOWN', cap: 'PLATES, CHAINS, DUCT, CORE'},
];
const swellAt = (t) => keyed([[0, 0], [3.8, 0], [7.2, 1], [20, 1]], t, sm);
const travelAt = (t) => (t < 12 ? 0 : 3.2 * Math.max(0, t - 12.6) ** 1.4 * (t < 15.4 ? 1 : 0) + (t >= 15.4 ? 0 : 0));
const CAM = [
  [0, [0, 1.3, 0, 30, 12, 2.6]],
  [3.4, [0, 1.3, 0, 50, 14, 2.6]],
  [7.6, [0, 1.3, 0, 80, 18, 2.4]],
  [11.6, [0, 1.3, 0, 120, 16, 2.2]],
  [12.4, [0, 1.3, 4, 18, 6, 7.5]],
  [15.2, [0, 1.3, 4, 8, 6, 7.5]],
  [15.8, [0, 1.3, 0, 40, 18, 3.2]],
  [20, [0, 1.3, 0, 70, 20, 3.4]],
];

export function run() {
  runSim({duration: DURATION, fps: 60, theme: 'light', hud: {enabled: false}, director: {enabled: false}, watermark: ''}, ({canvas, capture}) => {
    const st = studio(canvas, {capture, shadow: 3, fog: [15, 60]});
    const pf = buildPuffer(st.scene);
    const ui = consoleUI(document.getElementById('app'), {code: 'PF-2', eyebrow: 'SWARM · SWELLS, THEN FLIES IN', title: 'Puffer PF-2'});
    return {
      resize: st.resize,
      render(t) {
        const u = swellAt(t);
        const charge = sm((t - 12) / 0.8) * (1 - sm((t - 15.2) / 0.3));
        const explode = sm((t - 15.8) / 1.4) * (1 - sm((t - 18.8) / 1));
        const z = t >= 12 && t < 15.4 ? travelAt(t) : 0;
        pf.root.position.set(0, 1.3 + 0.03 * Math.sin(t * 1.7), z);
        pf.root.rotation.set(0.1 * Math.sin(t * 0.7), t * 0.15 * (1 - charge), 0);
        const P = pf.update(u, t * (8 + 60 * charge), explode);
        const [x, y, zz, az, el, dist] = keyed(CAM, t, sm);
        st.aim([x, y, zz], az, el, dist);
        st.render();
        const bi = BEATS.reduce((k, b, i) => (t >= b.t ? i : k), 0);
        ui.set({
          cap: BEATS[bi].cap,
          n: bi + 1,
          mode: BEATS[bi].mode,
          right: `SWELL ${Math.round(u * 100)}%`,
          rows: [
            ['SHELL RADIUS', `${(P.r + 0.0).toFixed(2)} m`],
            ['LINK ANGLE', `${((P.T.th * 180) / Math.PI).toFixed(1)}°`],
            ['CHAIN', `${S.cells} cells · ${(P.T.ext * 100).toFixed(0)} cm`],
            ['FAN', `${Math.round((8 + 60 * charge) * 9.55)} rpm`],
            ['TRAVEL', `${z.toFixed(1)} m`],
          ],
          barsTitle: 'CORE EXPOSURE',
          bars: [['CORE', u]],
          subs: [
            ['Plates ×11', u > 0.95 ? 'PARTED' : u > 0.02 ? 'PARTING' : 'SEALED', bi === 1],
            ['Scissor chains ×11', u > 0.02 && u < 0.98 ? 'EXTENDING' : 'LOCKED', bi === 1],
            ['Core', u > 0.5 ? 'EXPOSED' : 'COVERED', bi === 2],
            ['Aft duct', charge > 0.5 ? 'FULL THRUST' : 'IDLE', bi === 3],
            ['Assembly', explode > 0.02 ? `${Math.round(explode * 100)}% APART` : 'LOCKED', explode > 0.02],
          ],
        });
        void THREE;
        return {};
      },
    };
  });
}
