// BONEPEDE sketch, live: drive it yourself. Speed and turn sliders, phase lag and stride, hold R to rear, S to strike,
// I to isolate a leg with its footprints, P for the pixel filter, drag to orbit, wheel to zoom.
// Live state (distance, the turn laid ahead of the head, the rear and strike timers) is plain accumulation; the pose
// from that state is still kin.js's pure function. Changing stride or lag re-phases the feet on purpose.
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {runSim} from '../kit/runtime.js';
import {createBody} from './body.js';
import {CFG, createPath, pose} from './kin.js';
import {createOverlay, createStage} from './stage.js';

export function runLive() {
  runSim({duration: 3600, fps: 60, theme: 'dark', hud: {enabled: false}, director: {enabled: false}, watermark: ''}, ({canvas}) => {
    const st = createStage(canvas);
    // turn schedule: [u, kappa] steps, only ever appended ahead of the head
    const steps = [[0, 0]];
    const kappa = (u) => {
      let k = 0;
      for (const [u0, v] of steps) if (u >= u0) k = v;
      return k;
    };
    const path = createPath(kappa);
    const body = createBody(st.scene);
    const app = document.getElementById('app');
    const overlay = createOverlay(app);
    const controls = new OrbitControls(st.camera, canvas);
    controls.enableDamping = true;
    controls.minDistance = 2;
    controls.maxDistance = 25;
    controls.maxPolarAngle = Math.PI * 0.49;
    st.camera.position.set(6, 4, -6);

    const state = {s: 0, speed: 0.9, turn: 0, rear: 0, rearHeld: false, lungeT: -1, iso: false, pixel: false};
    // controls panel
    const panel = document.createElement('div');
    panel.style.cssText = 'position:absolute;right:40px;bottom:40px;width:300px;padding:14px 16px;background:rgba(20,16,20,.82);border:1px solid #3a3133;color:#e8dcc4;font:13px "JetBrains Mono",monospace;display:grid;gap:8px;pointer-events:auto';
    const slider = (label, min, max, step, get, set) => {
      const row = document.createElement('label');
      row.style.cssText = 'display:grid;grid-template-columns:90px 1fr 48px;gap:8px;align-items:center';
      const out = document.createElement('span');
      const inp = Object.assign(document.createElement('input'), {type: 'range', min, max, step, value: get()});
      const show = () => (out.textContent = Number(get()).toFixed(2));
      inp.addEventListener('input', () => {
        set(Number(inp.value));
        show();
      });
      show();
      row.append(label, inp, out);
      panel.append(row);
    };
    slider('speed', 0, 2.5, 0.05, () => state.speed, (v) => (state.speed = v));
    slider('turn', -0.8, 0.8, 0.02, () => state.turn, (v) => (state.turn = v));
    slider('phase lag', 0, 0.5, 0.005, () => CFG.lag, (v) => (CFG.lag = v));
    slider('stride', 0.3, 1.2, 0.01, () => CFG.stride, (v) => (CFG.stride = v));
    slider('lift', 0.05, 0.6, 0.01, () => CFG.lift, (v) => (CFG.lift = v));
    const keys = document.createElement('div');
    keys.style.cssText = 'opacity:.7;line-height:1.6';
    keys.textContent = 'hold R rear · S strike · I isolate leg · P pixel filter · drag orbit';
    panel.append(keys);
    app.append(panel);

    addEventListener('keydown', (e) => {
      const k = e.key.toLowerCase();
      if (k === 'r') state.rearHeld = true;
      else if (k === 's' && state.rear > 0.5) state.lungeT = 0;
      else if (k === 'i') state.iso = !state.iso;
      else if (k === 'p') state.pixel = !state.pixel;
    });
    addEventListener('keyup', (e) => {
      if (e.key.toLowerCase() === 'r') state.rearHeld = false;
    });

    let last = performance.now();
    let lastTurn = 0;
    let fps = 60;
    return {
      resize: st.resize,
      render() {
        const now = performance.now();
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        fps += (1 / Math.max(dt, 1e-3) - fps) * 0.05;
        // rear and strike
        const rearing = state.rearHeld || state.lungeT >= 0;
        state.rear += ((rearing ? 1 : 0) - state.rear) * Math.min(1, dt * 4);
        let lunge = 0;
        if (state.lungeT >= 0) {
          state.lungeT += dt;
          const u = state.lungeT;
          lunge = u < 0.2 ? u / 0.2 : u < 0.6 ? 1 : Math.max(0, 1 - (u - 0.6) / 0.6);
          if (u > 1.2) state.lungeT = -1;
        }
        const crawl = state.speed * (1 - state.rear);
        // lay the turn a little ahead of the head so the body behind never changes
        if (state.turn !== lastTurn) {
          steps.push([state.s + 0.02, state.turn]);
          lastTurn = state.turn;
        }
        state.s += crawl * dt;
        const P = pose(path, state.s, {rear: state.rear, lunge, fangs: Math.min(1, state.rear * 0.8 + lunge)});
        body.update(P, {hero: state.iso ? {seg: 6, side: 1} : null, prints: state.iso});
        const c = [0, 0, 0];
        for (const sg of P.segs) for (let k = 0; k < 3; k++) c[k] += sg.pos[k] / CFG.N;
        // the camera rides along with the body
        const dx = c[0] - controls.target.x;
        const dz = c[2] - controls.target.z;
        controls.target.set(c[0], 0.5, c[2]);
        st.camera.position.x += dx;
        st.camera.position.z += dz;
        controls.update();
        st.follow(c);
        st.render(state.pixel ? 4 : 0);
        overlay.set(state.iso ? 'ONE LEG · PLANTED FEET NEVER SLIDE' : rearing ? 'REARING' : 'LIVE', [
          ['SPEED', `${crawl.toFixed(2)} m/s`],
          ['CRAWLED', `${state.s.toFixed(1)} m`],
          ['FEET DOWN', `${P.planted} / ${CFG.N * 2}`],
          ['FPS', `${fps.toFixed(0)}`],
        ]);
        return {};
      },
    };
  });
}
