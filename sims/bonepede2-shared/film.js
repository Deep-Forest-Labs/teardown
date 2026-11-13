// BONEPEDE II film, 20 s: it swims through the air in loops and coils, the belly rolls to show the row of weak
// points, they are shot out one by one from the tail, then the pixel filter. render(t) is pure: the head's flight path
// is a closed-form curve sampled into the trail once at load, and the weak points' states are functions of t.
import {runSim} from '../kit/runtime.js';
import {keyed} from '../kit/util.js';
import {createOverlay, createStage} from '../bonepede-shared/stage.js';
import {createBody} from './body.js';
import {createTrail} from './trail.js';
import {CFG, pose} from './wyrm.js';

export const DURATION = 20;
export const BEATS = [
  {t: 0, cap: 'IT SWIMS THE AIR · THE BODY FOLLOWS THE HEAD'},
  {t: 5.5, cap: 'COIL · THE BELLY ROLLS TO SHOW ITS WEAK POINTS'},
  {t: 10, cap: 'SHOOT THE ROW · 26 ORBS'},
  {t: 14.5, cap: 'LEG FRINGE · ROWING WAVE HEAD TO TAIL'},
  {t: 17.2, cap: 'PIXEL FILTER PREVIEW · 4 PX'},
];

// flight path: a slow 3D Lissajous with a tighter loop on top, 2 to 5 m off the floor
export const flight = (tau) => [
  4.6 * Math.sin(0.41 * tau) + 1.3 * Math.sin(1.23 * tau + 0.4),
  3.1 + 1.5 * Math.sin(0.73 * tau + 0.7) + 0.55 * Math.sin(1.71 * tau),
  3.8 * Math.sin(0.82 * tau + 0.3) + 0.8 * Math.cos(1.37 * tau),
];
const TAU0 = -12; // the trail starts before t = 0 so the whole body is already in the air
const SPEED = 0.95; // flight time per second

// sample the head's flight into the trail at load, and the head's arc length per film time
const trail = createTrail({minStep: 0.015});
const ARC = [];
const DT = 1 / 240;
for (let k = 0, tau = TAU0; tau <= DURATION * SPEED + 0.5; k++, tau = TAU0 + k * DT) {
  trail.push(flight(tau));
  if (tau >= 0 && ARC.length <= (DURATION / DT) + 2) ARC.push(trail.length);
}
const arcAt = (t) => {
  const k = Math.min(Math.max(t * SPEED, 0), DURATION) / DT;
  const n = Math.min(Math.floor(k), ARC.length - 2);
  return ARC[n] + (ARC[n + 1] - ARC[n]) * (k - n);
};

// shots: tail first, one every 0.16 s from 10.2 s, each a 0.12 s hit flash then a pop
const SHOT0 = 10.2;
const SHOT_GAP = 0.16;
export function weakAt(t) {
  return (i) => {
    const order = CFG.N - 1 - i;
    const ts = SHOT0 + order * SHOT_GAP;
    const dt = t - ts;
    const hit = dt >= 0 && dt < 0.12 ? 1 - dt / 0.12 : 0;
    const dead = dt >= 0.08 ? Math.min(1, (dt - 0.08) / 0.1) : 0;
    const pulse = 0.5 + 0.5 * Math.sin(t * 5 - i * 0.55);
    return {open: 1, hit, dead, pulse};
  };
}

// camera relative to the body's centroid: [azimuth, elevation, distance] in world space, slow orbit
const CAM = [
  [0, [30, 18, 13]],
  [5.5, [70, 10, 11.5]],
  [10, [100, -8, 10]], // from below: the belly row faces the lens
  [14.3, [120, -6, 9.5]],
  [14.6, [150, 6, 7.5]],
  [17, [170, 8, 7.5]],
  [17.4, [200, 22, 13]],
  [20, [230, 24, 13.5]],
];

export function run() {
  runSim({duration: DURATION, fps: 60, theme: 'dark', hud: {enabled: false}, director: {enabled: false}, watermark: ''}, ({canvas, capture}) => {
    const st = createStage(canvas, {capture});
    st.scene.fog.near = 12;
    st.scene.fog.far = 34;
    const body = createBody(st.scene);
    const overlay = createOverlay(document.getElementById('app'));
    overlay.el.querySelector('div').firstElementChild.innerHTML = 'BONEPEDE <span style="color:#d23a22">II</span>';
    overlay.el.querySelector('div').lastElementChild.textContent = 'FLYING SKULL WORM STUDY · POSE = f(HEAD PATH)';
    return {
      resize: st.resize,
      render(t) {
        const P = pose(trail, arcAt(t), t * 5.2);
        const ws = weakAt(t);
        body.update(P, st.camera, ws, 0.5 + 0.5 * Math.sin(t * 2.3));
        const c = [0, 0, 0];
        for (const sg of P.segs) for (let k = 0; k < 3; k++) c[k] += sg.p[k] / CFG.N;
        const [az, el, dist] = keyed(CAM, t);
        st.follow([c[0], 0, c[2]]);
        st.aim(c, az, el, dist);
        st.render(t >= 17.2 ? 4 : 0);
        let alive = 0;
        for (let i = 0; i < CFG.N; i++) if (ws(i).dead < 1) alive++;
        const beat = [...BEATS].reverse().find((b) => t >= b.t);
        overlay.set(beat.cap, [
          ['SEGMENTS', `${CFG.N}`],
          ['LEGS', `${CFG.N * 2}`],
          ['WEAK POINTS', `${alive} / ${CFG.N}`],
          ['HEIGHT', `${P.head.p[1].toFixed(1)} m`],
        ]);
        return {};
      },
    };
  });
}
