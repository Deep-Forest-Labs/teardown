// BONEPEDE sketch film, 20 s: crawl, turn, rear and strike, one leg isolated with its footprints, then the pixel
// filter. render(t) is a pure function of t: speed is tabulated at load and integrated into distance, the path's
// turn is laid by arc length from that table, and every pose comes from kin.js.
import {runSim} from '../kit/runtime.js';
import {keyed, smooth} from '../kit/util.js';
import {createBody} from './body.js';
import {CFG, createPath, pose} from './kin.js';
import {createOverlay, createStage} from './stage.js';

export const DURATION = 20;
export const BEATS = [
  {t: 0, cap: 'CRAWL · 16 SEGMENTS · 32 LEGS'},
  {t: 4.5, cap: 'TURN · THE TAIL FOLLOWS THE HEAD'},
  {t: 8.6, cap: 'TELL · IT STOPS AND REARS'},
  {t: 11.8, cap: 'STRIKE'},
  {t: 13.5, cap: 'ONE LEG · PLANTED FEET NEVER SLIDE'},
  {t: 17, cap: 'PIXEL FILTER PREVIEW · 4 PX'},
];

const SPEED = [
  [0, 0],
  [0.8, 0.95],
  [8.4, 0.95],
  [9.4, 0],
  [13.2, 0],
  [14.2, 0.8],
  [20, 0.8],
];
// distance table at 1/240 s, trapezoid rule
const DT = 1 / 240;
const DIST = [0];
for (let k = 1; k <= DURATION / DT + 1; k++) {
  const a = keyed(SPEED, (k - 1) * DT, smooth);
  const b = keyed(SPEED, k * DT, smooth);
  DIST.push(DIST[k - 1] + 0.5 * (a + b) * DT);
}
export const distAt = (t) => {
  const k = Math.min(Math.max(t, 0), DURATION) / DT;
  const n = Math.min(Math.floor(k), DIST.length - 2);
  return DIST[n] + (DIST[n + 1] - DIST[n]) * (k - n);
};
// a left turn laid along the stretch the head crawls between 4.5 s and 8.2 s
const U0 = distAt(4.5);
const U1 = distAt(8.2);
const kappa = (u) => (u > U0 && u < U1 ? 0.42 * Math.sin((Math.PI * (u - U0)) / (U1 - U0)) : 0);

// camera relative to the head's heading: [t, [azimuth, elevation, distance, focusOnHeroLeg 0..1]]
const CAM = [
  [0, [140, 26, 8.5, 0]],
  [4.3, [118, 32, 8.8, 0]],
  [8.4, [40, 14, 8.2, 0]],
  [11.2, [62, 12, 9.2, 0]], // swing to profile so the strike crosses the frame instead of hitting the lens
  [13.1, [66, 14, 9.2, 0]],
  [13.9, [102, 36, 5.6, 1]],
  [16.7, [108, 38, 5.8, 1]],
  [17.5, [142, 30, 8.8, 0]],
  [20, [154, 32, 9.4, 0]],
];
export const HERO = {seg: 6, side: 1};

export function opsAt(t) {
  return {
    rear: keyed([[8.8, 0], [10.4, 1], [11.75, 1], [12.0, 0.5], [13.2, 0]], t),
    lunge: keyed([[11.75, 0], [12.0, 1], [12.5, 1], [13.3, 0]], t),
    fangs: keyed([[9.3, 0], [10.6, 0.7], [11.75, 1], [12.05, 0.05], [13, 0]], t),
  };
}

export function run() {
  runSim({duration: DURATION, fps: 60, theme: 'dark', hud: {enabled: false}, director: {enabled: false}, watermark: ''}, ({canvas, capture}) => {
    const st = createStage(canvas, {capture});
    const path = createPath(kappa);
    const body = createBody(st.scene);
    const overlay = createOverlay(document.getElementById('app'));
    return {
      resize: st.resize,
      render(t) {
        const s = distAt(t);
        const ops = opsAt(t);
        const P = pose(path, s, ops);
        const iso = keyed([[13.5, 0], [13.9, 1], [16.8, 1], [17.2, 0]], t);
        body.update(P, {hero: iso > 0.5 ? HERO : null, prints: iso > 0.5});
        // centroid of the body, and the hero leg's segment
        const c = [0, 0, 0];
        for (const sg of P.segs) for (let k = 0; k < 3; k++) c[k] += sg.pos[k] / CFG.N;
        const hs = P.segs[HERO.seg].pos;
        const [az, el, dist, focus] = keyed(CAM, t);
        // while it rears, the camera eases toward the front third and up, so the head stays in frame
        const rf = Math.max(ops.rear, ops.lunge) * 0.45;
        const fr = P.segs[3].pos;
        const bx = c[0] + (fr[0] - c[0]) * rf;
        const bz = c[2] + (fr[2] - c[2]) * rf;
        const tgt = [bx + (hs[0] - bx) * focus, 0.35 + 0.2 * (1 - focus) + ops.rear * 0.55, bz + (hs[2] - bz) * focus];
        const heading = (P.segs[0].h * 180) / Math.PI;
        st.follow(c);
        st.aim(tgt, heading + az, el, dist);
        st.render(t >= 17 ? 4 : 0);
        const beat = [...BEATS].reverse().find((b) => t >= b.t);
        const speed = keyed(SPEED, t, smooth);
        overlay.set(beat.cap, [
          ['SPEED', `${speed.toFixed(2)} m/s`],
          ['CRAWLED', `${s.toFixed(2)} m`],
          ['FEET DOWN', `${P.planted} / ${CFG.N * 2}`],
          ['STRIDE', `${CFG.stride.toFixed(2)} m`],
          ['REAR', `${(ops.rear * 100).toFixed(0)} %`],
        ]);
        return {};
      },
    };
  });
}
