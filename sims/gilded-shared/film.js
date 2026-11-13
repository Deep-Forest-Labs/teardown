// GILDED SKULL film, 16 s: it hovers shut, rattles and spits a coin volley, splits open to vent and shows its core,
// shuts, then the plating is shot off plate by plate, the bare core is shot out and it bursts into coins. Pixel filter
// last. render(t) is pure: every state below is a function of t.
import {runSim} from '../kit/runtime.js';
import {keyed} from '../kit/util.js';
import {createOverlay, createStage} from '../bonepede-shared/stage.js';
import {coinAt, createSkull, JAW, PLATES, R} from './skull.js';

export const DURATION = 16;
export const BEATS = [
  {t: 0, cap: 'SHUT · EIGHT GOLD PLATES · NOTHING TO HIT'},
  {t: 2.4, cap: 'TELL · THE PLATES RATTLE, THE EYES LIGHT'},
  {t: 3.4, cap: 'COIN VOLLEY FROM THE JAW'},
  {t: 4.6, cap: 'IT VENTS · THE SHELL SPLITS · SHOOT THE CORE'},
  {t: 8.8, cap: 'OR BREAK THE PLATING, PLATE BY PLATE'},
  {t: 11.8, cap: 'BARE CORE · IT PAYS BIG'},
  {t: 13.4, cap: 'PIXEL FILTER PREVIEW · 4 PX'},
];

const ORDER = ['upper-front', 'upper-left', 'lower-left', 'upper-right', 'lower-right', 'upper-back', 'lower-back', 'lower-front'];
const BREAK = PLATES.map((p) => 8.8 + ORDER.indexOf(p.name) * 0.32);
const DEATH = 12.65;

export const origin = (t) => [0, 2.3 + 0.15 * Math.sin(1.3 * t), 0];
export const yaw = (t) => 0.3 * Math.sin(0.4 * t);

// the volley: seven coins fanned from the mouth
const VOLLEY_T = 3.45;
const volley = Array.from({length: 7}, (_, k) => {
  const a = (k - 3) * 0.16;
  return {a, v: [Math.sin(a) * 8.5, 2.2 + (k % 2) * 0.6, Math.cos(a) * 8.5], dt: k * 0.025};
});
// the death burst: coins sprayed all round, deterministic angles
const burst = Array.from({length: 26}, (_, k) => {
  const a = k * 2.399963; // golden angle
  const up = 3 + (k % 5) * 0.7;
  const sp = 2.2 + (k % 3) * 0.9;
  return {v: [Math.cos(a) * sp, up, Math.sin(a) * sp], dt: (k % 4) * 0.02};
});

export function stateAt(t) {
  const o = origin(t);
  const y = yaw(t);
  const open = keyed([[4.6, 0], [5.2, 1], [7.6, 1], [8.2, 0]], t);
  const tell = keyed([[2.4, 0], [3.2, 1], [3.45, 1], [3.7, 0]], t);
  const jaw = keyed([[3.2, 0], [3.4, 1], [3.9, 1], [4.3, 0]], t);
  const broken = BREAK.map((tb) => tb);
  const exposed = Math.max(open, BREAK.filter((tb) => t >= tb).length / PLATES.length);
  const hits = [6.0, 6.35, 12.0, 12.25, 12.5];
  let hit = 0;
  for (const th of hits) if (t >= th && t < th + 0.12) hit = 1 - (t - th) / 0.12;
  const dead = t >= DEATH ? Math.min(1, (t - DEATH) / 0.12) : 0;
  const coins = [];
  const c = Math.cos(y);
  const s = Math.sin(y);
  const rot = (v) => [v[0] * c + v[2] * s, v[1], -v[0] * s + v[2] * c];
  const mouth = [o[0] + s * R, o[1] - 0.25, o[2] + c * R];
  for (const k of volley) {
    const q = coinAt(mouth, rot(k.v), VOLLEY_T + k.dt, t);
    if (q) coins.push(q);
  }
  for (const k of burst) {
    const q = coinAt(o, k.v, DEATH + k.dt, t);
    if (q) coins.push(q);
  }
  return {
    t,
    origin: o,
    yaw: y,
    open,
    jaw,
    tell,
    broken,
    core: {open: exposed, hit: hit * exposed, dead, pulse: 0.5 + 0.5 * Math.sin(t * 6)},
    coins,
    exposed,
  };
}

const CAM = [
  [0, [28, 8, 5.2]],
  [3.3, [22, 6, 5.6]],
  [4.6, [30, 10, 4.4]],
  [7.8, [40, 12, 4.2]],
  [8.6, [55, 20, 6.4]],
  [11.6, [70, 18, 6.0]],
  [13.2, [80, 22, 6.5]],
  [13.6, [95, 26, 7.5]],
  [16, [110, 28, 8]],
];

export function run() {
  runSim({duration: DURATION, fps: 60, theme: 'dark', hud: {enabled: false}, director: {enabled: false}, watermark: ''}, ({canvas, capture}) => {
    const st = createStage(canvas, {capture});
    const skull = createSkull(st.scene);
    const overlay = createOverlay(document.getElementById('app'));
    const title = overlay.el.querySelector('div');
    title.firstElementChild.innerHTML = 'GILDED <span style="color:#e0b43a">SKULL</span>';
    title.lastElementChild.textContent = 'GREED ELITE · RANGED · SHELL OPENS TO A WEAK POINT';
    return {
      resize: st.resize,
      render(t) {
        const S = stateAt(t);
        const [az, el, dist] = keyed(CAM, t);
        st.aim([S.origin[0], S.origin[1] - 0.3, S.origin[2]], az, el, dist);
        skull.update(S, st.camera);
        st.follow([0, 0, 0]);
        st.render(t >= 13.4 ? 4 : 0);
        const left = BREAK.filter((tb) => t < tb).length;
        const beat = [...BEATS].reverse().find((b) => t >= b.t);
        overlay.set(beat.cap, [
          ['PLATES', `${left} / ${PLATES.length}`],
          ['CORE', S.core.dead >= 1 ? 'DEAD' : S.exposed > 0.5 ? 'EXPOSED' : 'SHUT'],
          ['SHELL', `${(S.open * 100).toFixed(0)} % OPEN`],
          ['COINS', `${S.coins.length}`],
        ]);
        return {};
      },
    };
  });
}
