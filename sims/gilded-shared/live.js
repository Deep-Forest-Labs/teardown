// GILDED SKULL, live: fight it. It turns to face you and, on Auto, runs its loop: hover, rattle and spit a coin
// volley, vent open for a few seconds, shut. Click a plate to shoot it off; click the core while it shows to hit it
// (three hits kill it, and it bursts into coins). Buttons fire each behaviour by hand.
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {runSim} from '../kit/runtime.js';
import {createOverlay, createStage} from '../bonepede-shared/stage.js';
import {createPanel, onClickPick} from '../dfl-kit/panel.js';
import {coinAt, createSkull, PLATES, R} from './skull.js';

const CORE_HP = 3;
// the same coin fans as the film
const VOLLEY = Array.from({length: 7}, (_, k) => {
  const a = (k - 3) * 0.16;
  return {v: [Math.sin(a) * 8.5, 2.2 + (k % 2) * 0.6, Math.cos(a) * 8.5], dt: k * 0.025};
});
const BURST = Array.from({length: 26}, (_, k) => {
  const a = k * 2.399963;
  const sp = 2.2 + (k % 3) * 0.9;
  return {v: [Math.cos(a) * sp, 3 + (k % 5) * 0.7, Math.sin(a) * sp], dt: (k % 4) * 0.02};
});

export function runLive() {
  runSim({duration: 3600, fps: 60, theme: 'dark', hud: {enabled: false}, director: {enabled: false}, watermark: ''}, ({canvas}) => {
    const st = createStage(canvas);
    const skull = createSkull(st.scene);
    window.__GILDED = {skull, st}; // console access for debugging picks
    const app = document.getElementById('app');
    const overlay = createOverlay(app);
    const title = overlay.el.querySelector('div');
    title.firstElementChild.innerHTML = 'GILDED <span style="color:#e0b43a">SKULL</span>';
    title.lastElementChild.textContent = 'LIVE · CLICK PLATES TO STRIP THEM · CLICK THE CORE WHEN IT SHOWS';

    const S = {clock: 0, auto: true, loopT: 0, open: 0, openTarget: 0, tellT: null, volleys: [], broken: PLATES.map(() => null), hp: CORE_HP, hitT: -9, deathT: null, yaw: 0, pixel: false};
    const reset = () => {
      Object.assign(S, {loopT: 0, open: 0, openTarget: 0, tellT: null, volleys: [], broken: PLATES.map(() => null), hp: CORE_HP, hitT: -9, deathT: null});
    };
    const fire = () => {
      if (S.deathT == null && S.tellT == null) S.tellT = S.clock;
    };
    const panel = createPanel(app);
    panel.button('Volley', fire);
    panel.button('Vent', () => (S.openTarget = S.openTarget > 0.5 ? 0 : 1));
    panel.button('Auto', () => (S.auto = !S.auto));
    panel.button('Reset', reset);
    panel.button('Pixel', () => (S.pixel = !S.pixel));
    panel.note('drag to orbit · wheel to zoom · P pixel filter');
    addEventListener('keydown', (e) => {
      if (e.key.toLowerCase() === 'p') S.pixel = !S.pixel;
    });

    const controls = new OrbitControls(st.camera, canvas);
    controls.enableDamping = true;
    controls.target.set(0, 2, 0);
    controls.maxDistance = 25;
    st.camera.position.set(2.2, 2.4, 5.2);

    const exposedNow = () => Math.max(S.open, S.broken.filter((b) => b != null).length / PLATES.length);
    const coreHit = new st.THREE.Sphere();
    onClickPick(canvas, st.camera, skull.pickables, (h, ray) => {
      if (S.deathT != null) return;
      // while the core shows, a shot within 1.6x its radius counts, ahead of any plate edge in front of it
      coreHit.set(skull.root.position, 0.24 * 1.6);
      if (exposedNow() >= 0.5 && ray.ray.intersectsSphere(coreHit)) {
        S.hitT = S.clock;
        S.hp--;
        if (S.hp <= 0) S.deathT = S.clock + 0.1;
        return;
      }
      if (!h || h.object === skull.core.mesh) return; // shut: the shell takes it
      // a plate: walk up to its pivot
      let o = h.object;
      const idx = () => skull.plates.findIndex((p) => p.pivot === o);
      while (o && idx() < 0) o = o.parent;
      const i = o ? idx() : -1;
      if (i >= 0 && S.broken[i] == null) S.broken[i] = S.clock;
    });

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
        const t = S.clock;
        // the auto loop: 2.4 s idle, tell and volley, vent 3 s, shut; 8 s in all
        if (S.auto && S.deathT == null) {
          S.loopT += dt;
          if (S.loopT > 2.4 && S.tellT == null && S.loopT < 3) fire();
          S.openTarget = S.loopT > 4.6 && S.loopT < 7.6 ? 1 : 0;
          if (S.loopT > 8.2) S.loopT = 0;
        }
        if (S.deathT != null) S.openTarget = 1;
        S.open += Math.sign(S.openTarget - S.open) * Math.min(Math.abs(S.openTarget - S.open), dt / 0.55);
        // tell for 0.8 s, then the jaw drops and the volley leaves; the jaw shuts after
        let tell = 0;
        let jaw = 0;
        if (S.tellT != null) {
          const u = t - S.tellT;
          tell = u < 0.8 ? u / 0.8 : Math.max(0, 1 - (u - 1.05) / 0.25);
          jaw = u < 0.8 ? 0 : u < 1.5 ? Math.min(1, (u - 0.8) / 0.2) : Math.max(0, 1 - (u - 1.5) / 0.4);
          if (u >= 1.05 && !S.volleys.some((v) => v.t === S.tellT + 1.05)) S.volleys.push({t: S.tellT + 1.05, yaw: S.yaw, o: origin(S.tellT + 1.05)});
          if (u > 2) S.tellT = null;
        }
        // face the camera, slowly
        const want = Math.atan2(st.camera.position.x, st.camera.position.z);
        let d = want - S.yaw;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        S.yaw += Math.sign(d) * Math.min(Math.abs(d), dt * 1.2);

        const coins = [];
        for (const v of S.volleys) {
          const c = Math.cos(v.yaw);
          const s = Math.sin(v.yaw);
          const mouth = [v.o[0] + s * R, v.o[1] - 0.25, v.o[2] + c * R];
          for (const k of VOLLEY) {
            const q = coinAt(mouth, [k.v[0] * c + k.v[2] * s, k.v[1], -k.v[0] * s + k.v[2] * c], v.t + k.dt, t);
            if (q) coins.push(q);
          }
        }
        S.volleys = S.volleys.filter((v) => t - v.t < 8);
        if (S.deathT != null) for (const k of BURST) {
          const q = coinAt(origin(S.deathT), k.v, S.deathT + k.dt, t);
          if (q) coins.push(q);
        }
        const exposed = exposedNow();
        const hdt = t - S.hitT;
        const state = {
          t,
          origin: origin(t),
          yaw: S.yaw,
          open: S.open,
          jaw,
          tell,
          broken: S.broken,
          core: {
            open: exposed,
            hit: hdt >= 0 && hdt < 0.12 ? 1 - hdt / 0.12 : 0,
            dead: S.deathT == null ? 0 : Math.min(1, Math.max(0, (t - S.deathT) / 0.12)),
            pulse: 0.5 + 0.5 * Math.sin(t * 6),
          },
          coins,
        };
        skull.update(state, st.camera);
        controls.update();
        st.follow([0, 0, 0]);
        st.render(S.pixel ? 4 : 0);
        const left = S.broken.filter((b) => b == null).length;
        overlay.set(S.deathT != null ? 'DEAD · IT PAID OUT' : exposed > 0.5 ? 'CORE EXPOSED · SHOOT IT' : tell > 0 ? 'TELL · VOLLEY COMING' : 'SHUT', [
          ['PLATES', `${left} / ${PLATES.length}`],
          ['CORE HP', `${Math.max(0, S.hp)} / ${CORE_HP}`],
          ['AUTO', S.auto ? 'ON' : 'OFF'],
          ['FPS', `${fps.toFixed(0)}`],
        ]);
        return {};
      },
    };
  });
}

const origin = (t) => [0, 2.3 + 0.15 * Math.sin(1.3 * t), 0];
