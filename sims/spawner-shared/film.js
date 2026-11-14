// WANDERER WS-3 film, 24 s: walking on its Jansen legs, the Geneva drive and valve isolated, the bellows pulse
// and the pour, mites dropping out of the chute. render(t) is pure.
import {runSim} from '../kit/runtime.js';
import {keyed} from '../kit/util.js';
import {buildFlock} from '../mite-shared/machine.js';
import {consoleUI, studio} from '../slumber-kit/studio.js';
import {BODY_PER_RAD, GENEVA} from './kin.js';
import {buildSpawner} from './machine.js';

export const DURATION = 24;
const RPS = 0.42; // crank turns per second
const TAU = Math.PI * 2;
const sm = (u) => {
  const x = Math.min(1, Math.max(0, u));
  return x * x * x * (x * (x * 6 - 15) + 10);
};
const BEATS = [
  {t: 0, mode: 'WANDERING', cap: 'WS-3 · EIGHT JANSEN LEGS ON ONE CRANKSHAFT · THE HIVE RIDES ON TOP'},
  {t: 6, mode: 'GENEVA', cap: 'A GENEVA DRIVE INDEXES THE VALVE ONE POCKET PER CRANK TURN · LOCKED BETWEEN'},
  {t: 12, mode: 'POUR', cap: 'THE BELLOWS PULSES (THE TELL) · THE VALVE TURNS · A MITE DROPS FROM THE CHUTE'},
  {t: 18, mode: 'WANDERING', cap: 'ONE CRANK: LEGS, VALVE, BELLOWS · ONE MITE PER STRIDE'},
];
const CAM = [
  [0, [0, 2.2, 0, 50, 14, 9.5]],
  [5.6, [0, 2.2, 0, 80, 12, 9]],
  [6.4, [1.0, 3.75, 0.55, 8, 4, 2.4]],
  [11.6, [1.0, 3.75, 0.55, -4, 6, 2.4]],
  [12.4, [0.6, 3.0, 0, 120, 14, 5.2]],
  [17.6, [0.6, 3.0, 0, 150, 16, 5.4]],
  [18.4, [0, 2.2, 0, 220, 16, 10]],
  [24, [0, 2.2, 0, 250, 18, 10.5]],
];

export function run() {
  runSim({duration: DURATION, fps: 60, theme: 'light', hud: {enabled: false}, director: {enabled: false}, watermark: ''}, ({canvas, capture}) => {
    const st = studio(canvas, {capture, shadow: 6, fog: [30, 110]});
    const sp = buildSpawner(st.scene);
    const flock = buildFlock(st.scene, 12);
    const ui = consoleUI(document.getElementById('app'), {code: 'WS-3', eyebrow: 'SPAWNER · WANDERS AND POURS', title: 'Wanderer WS-3'});
    return {
      resize: st.resize,
      render(t) {
        const theta = TAU * RPS * t;
        const P = sp.update(theta);
        // mites: one per crank turn, released when that turn's index ends; fall, then lift away
        const turns = Math.floor((theta + Math.PI) / TAU);
        let n = 0;
        for (let k = Math.max(0, turns - 11); k <= turns; k++) {
          const tRel = (k * TAU + (Math.PI / 2 - Math.PI / GENEVA.n) + 0.2 - Math.PI) / (TAU * RPS); // the moment the index completes
          const age = t - tRel;
          if (age < 0) continue;
          const x0 = BODY_PER_RAD * TAU * RPS * tRel + sp.valveC[0];
          const y0 = sp.valveC[1] - 0.95;
          const fall = Math.min(age, 0.45);
          const y = y0 - 4.9 * fall * fall + Math.max(0, age - 0.45) * 2.2;
          const ang = k * 2.4;
          const out = Math.max(0, age - 0.45) * 1.6;
          flock.set(n++, [x0 + Math.cos(ang) * out, y, Math.sin(ang) * out], [Math.cos(ang), 0.3, Math.sin(ang)], 0.6 * Math.sin(t * 30 + k));
        }
        flock.commit(n);
        const [x, y, z, az, el, dist] = keyed(CAM, t, sm);
        st.aim([x + P.x, y, z], az, el, dist);
        st.render();
        const bi = BEATS.reduce((k, b, i) => (t >= b.t ? i : k), 0);
        const down = P.legs.filter((L) => L.foot[1] - 0.12 < 0.03).length;
        ui.set({
          cap: BEATS[bi].cap,
          n: bi + 1,
          mode: BEATS[bi].mode,
          right: `CRANK ${Math.round(((theta * 180) / Math.PI) % 360)}°`,
          rows: [
            ['CRANK', `${(RPS * 60).toFixed(1)} rpm`],
            ['SPEED', `${Math.abs(BODY_PER_RAD * TAU * RPS).toFixed(2)} m/s`],
            ['FEET DOWN', `${down} / 8`],
            ['VALVE', `${(((P.valve * 180) / Math.PI) % 360).toFixed(1)}°`],
            ['GENEVA', P.engaged ? 'ENGAGED' : 'LOCKED'],
            ['POURED', `${Math.max(0, turns)} mites`],
          ],
          barsTitle: 'BELLOWS',
          bars: [['PULSE', P.squeeze]],
          subs: [
            ['Legs ×8 · Jansen', 'WALKING', bi === 0],
            ['Geneva drive', P.engaged ? 'INDEXING' : 'DWELL', P.engaged],
            ['Rotary valve ×8', P.engaged ? 'TURNING' : 'LOCKED', bi === 1],
            ['Bellows', P.squeeze > 0.5 ? 'PULSE' : 'REST', P.squeeze > 0.5],
            ['Hive', 'FULL', false],
          ],
        });
        return {};
      },
    };
  });
}
