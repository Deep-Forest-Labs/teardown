// BONEPEDE II, live: fly it and shoot it. The head steers toward a wandering target with a capped turn rate and lays
// the trail as it goes; the body is still wyrm.js's pure pose on that trail. Click a belly orb to shoot it.
// Panel: speed, wander radius, height, turn rate, rowing rate; Coil (tight circle round a point), Dive (swoop at the
// floor and back), Reset orbs; P pixel filter, F follow camera.
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {runSim} from '../kit/runtime.js';
import {createOverlay, createStage} from '../bonepede-shared/stage.js';
import {createPanel, onClickPick} from '../dfl-kit/panel.js';
import {createBody} from './body.js';
import {createTrail, V} from './trail.js';
import {CFG, pose} from './wyrm.js';

const {add, sub, mul, norm, dot, cross} = V;

export function runLive() {
  runSim({duration: 3600, fps: 60, theme: 'dark', hud: {enabled: false}, director: {enabled: false}, watermark: ''}, ({canvas}) => {
    const st = createStage(canvas);
    st.scene.fog.near = 14;
    st.scene.fog.far = 40;
    const body = createBody(st.scene);
    window.__BP2 = {body, st}; // console access for debugging picks
    const app = document.getElementById('app');
    const overlay = createOverlay(app);
    const title = overlay.el.querySelector('div');
    title.firstElementChild.innerHTML = 'BONEPEDE <span style="color:#d23a22">II</span>';
    title.lastElementChild.textContent = 'LIVE · CLICK THE BELLY ORBS';

    // a straight run-in so the whole body exists from the first frame
    const trail = createTrail({minStep: 0.015});
    for (let z = -12; z <= 0; z += 0.05) trail.push([0, 3, z]);
    const S = {
      head: [0, 3, 0],
      dir: [0, 0, 1],
      speed: 3.2,
      wander: 6,
      height: 3.2,
      turn: 2.2, // max turn rate, rad/s
      row: 5.2,
      clock: 0,
      phase: 0,
      mode: 'wander',
      modeT: 0,
      coilAt: [0, 3, 0],
      pixel: false,
      follow: true,
    };
    const weak = Array.from({length: CFG.N}, () => ({hitT: -9, deadT: null}));

    const panel = createPanel(app);
    panel.slider('speed', 0.5, 8, 0.1, () => S.speed, (v) => (S.speed = v));
    panel.slider('wander', 1, 12, 0.1, () => S.wander, (v) => (S.wander = v));
    panel.slider('height', 1, 7, 0.1, () => S.height, (v) => (S.height = v));
    panel.slider('turn rate', 0.5, 5, 0.05, () => S.turn, (v) => (S.turn = v));
    panel.slider('row rate', 0, 12, 0.1, () => S.row, (v) => (S.row = v));
    panel.slider('row sweep', 0, 1.2, 0.01, () => CFG.row, (v) => (CFG.row = v));
    panel.button('Coil', () => {
      S.mode = 'coil';
      S.modeT = 0;
      S.coilAt = add(S.head, mul(S.dir, 2.5));
    });
    panel.button('Dive', () => {
      S.mode = 'dive';
      S.modeT = 0;
    });
    panel.button('Reset orbs', () => weak.forEach((w) => ((w.hitT = -9), (w.deadT = null))));
    panel.button('Pixel', () => (S.pixel = !S.pixel));
    panel.button('Follow', () => (S.follow = !S.follow));
    panel.note('click an orb to shoot it · drag to orbit · wheel to zoom');

    const controls = new OrbitControls(st.camera, canvas);
    controls.enableDamping = true;
    controls.maxDistance = 40;
    st.camera.position.set(9, 6, -9);
    onClickPick(canvas, st.camera, body.pickables, (h) => {
      if (!h) return;
      const w = weak[h.instanceId];
      if (w && w.deadT == null) {
        w.hitT = S.clock;
        w.deadT = S.clock + 0.08;
      }
    });
    addEventListener('keydown', (e) => {
      const k = e.key.toLowerCase();
      if (k === 'p') S.pixel = !S.pixel;
      if (k === 'f') S.follow = !S.follow;
    });

    // where the head wants to go this instant
    const targetAt = (t) => {
      if (S.mode === 'coil') {
        // a tight horizontal circle, radius under the body length, so it wraps round itself
        const a = S.modeT * 1.9;
        return add(S.coilAt, [Math.sin(a) * 1.6, 0.5 * Math.sin(a * 0.5), Math.cos(a) * 1.6]);
      }
      if (S.mode === 'dive') {
        const k = S.modeT < 1.4 ? 0.4 : S.height + 2;
        return add([S.head[0], 0, S.head[2]], add(mul(S.dir, 4), [0, k, 0]));
      }
      return [
        S.wander * Math.sin(0.23 * t) + 0.35 * S.wander * Math.sin(0.71 * t + 1),
        S.height + 1.4 * Math.sin(0.5 * t + 0.6),
        S.wander * Math.sin(0.31 * t + 0.3) + 0.3 * S.wander * Math.cos(0.83 * t),
      ];
    };

    let last = performance.now();
    let fps = 60;
    return {
      resize: st.resize,
      render() {
        const now = performance.now();
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        fps += (1 / Math.max(dt, 1e-3) - fps) * 0.05;
        S.clock += dt;
        S.modeT += dt;
        if (S.mode === 'coil' && S.modeT > 6) S.mode = 'wander';
        if (S.mode === 'dive' && S.modeT > 3) S.mode = 'wander';
        // steer: rotate the heading toward the target by at most turn * dt
        const want = norm(sub(targetAt(S.clock), S.head));
        const c = Math.min(1, Math.max(-1, dot(S.dir, want)));
        const ang = Math.acos(c);
        const maxA = S.turn * dt * (S.mode === 'coil' ? 1.6 : 1);
        if (ang > 1e-4) {
          const k = Math.min(1, maxA / ang);
          const axis = norm(cross(S.dir, want));
          // Rodrigues rotation of dir about axis by k * ang
          const a = k * ang;
          S.dir = norm(add(add(mul(S.dir, Math.cos(a)), mul(cross(axis, S.dir), Math.sin(a))), mul(axis, dot(axis, S.dir) * (1 - Math.cos(a)))));
        }
        S.head = add(S.head, mul(S.dir, S.speed * dt));
        S.head[1] = Math.max(0.7, S.head[1]);
        trail.push(S.head.slice());
        S.phase += S.row * dt;

        const P = pose(trail, trail.length, S.phase);
        const ws = (i) => {
          const w = weak[i];
          const hdt = S.clock - w.hitT;
          return {
            open: 1,
            hit: hdt >= 0 && hdt < 0.12 ? 1 - hdt / 0.12 : 0,
            dead: w.deadT == null ? 0 : Math.min(1, Math.max(0, (S.clock - w.deadT) / 0.1)),
            pulse: 0.5 + 0.5 * Math.sin(S.clock * 5 - i * 0.55),
          };
        };
        body.update(P, st.camera, ws, 0.5 + 0.5 * Math.sin(S.clock * 2.3));
        const cen = [0, 0, 0];
        for (const sg of P.segs) for (let k = 0; k < 3; k++) cen[k] += sg.p[k] / CFG.N;
        if (S.follow) {
          const d = sub(cen, [controls.target.x, controls.target.y, controls.target.z]);
          controls.target.set(...cen);
          st.camera.position.x += d[0];
          st.camera.position.y += d[1];
          st.camera.position.z += d[2];
        }
        controls.update();
        st.follow([cen[0], 0, cen[2]]);
        st.render(S.pixel ? 4 : 0);
        const alive = weak.filter((w) => w.deadT == null).length;
        overlay.set(S.mode === 'coil' ? 'COIL' : S.mode === 'dive' ? 'DIVE' : alive === 0 ? 'ALL WEAK POINTS DOWN' : 'LIVE', [
          ['WEAK POINTS', `${alive} / ${CFG.N}`],
          ['SPEED', `${S.speed.toFixed(1)} m/s`],
          ['HEIGHT', `${S.head[1].toFixed(1)} m`],
          ['FPS', `${fps.toFixed(0)}`],
        ]);
        return {};
      },
    };
  });
}
