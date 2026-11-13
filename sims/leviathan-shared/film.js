// LEVIATHAN LV-8 film, 34 s, in the Pelagos console's manner: the Altar as one machine through Run, Arrival,
// Phase 1 (with one arm taken apart along its chain) and Phase 2 (mantle open). render(t) is pure.
import * as THREE from 'three';
import {runSim} from '../kit/runtime.js';
import {keyed} from '../kit/util.js';
import {ARMS, model, N, WEB} from './kin.js';
import {buildMachine, PAL} from './machine.js';

export const DURATION = 34;
const sm = (u) => {
  const x = Math.min(1, Math.max(0, u));
  return x * x * x * (x * (x * 6 - 15) + 10);
};
// stage value s over the film
const S_KEYS = [
  [0, 0],
  [5, 0],
  [12, 1],
  [21.5, 1.6],
  [22.5, 2],
  [29, 3],
  [34, 3],
];
export const sAt = (t) => keyed(S_KEYS, t, (u) => sm(u));
export const BEATS = [
  {t: 0, mode: 'DORMANT', cap: 'RUN · A FLOOR OF FLESH PLATES OVER EIGHT ARMS · NOTHING OF THE PRINCE SHOWS'},
  {t: 5, mode: 'WAKING', cap: 'ARRIVAL · THE TIPS RISE OUT OF THE SEA INTO SPIRALS · THE OPTICS WAKE'},
  {t: 12.5, mode: 'HOLDING', cap: 'PHASE 1 · THE ARMS REAR IN TURN AND SLAM BACK INTO THE FLOOR'},
  {t: 16.5, mode: 'ARM 3 APART', cap: 'ONE ARM ALONG ITS CHAIN · SHELL, CAGE, GASKET, WHEEL ROWS'},
  {t: 22.5, mode: 'MANTLE OPEN', cap: 'PHASE 2 · THE WEB TILTS INTO A BOWL · THE PETALS OPEN ON THE CORE'},
];
const CAM = [
  [0, [0, 0, 0, 34, 30, 84]],
  [4.6, [0, 0, 0, 52, 24, 80]],
  [11.6, [0, 3, 0, 70, 18, 76]],
  [14.8, [0, 3, 0, 96, 20, 74]],
  [16.4, [10, 1, 17, 128, 20, 30]],
  [21, [10, 1, 17, 140, 22, 30]],
  [22.6, [0, 3, 0, 60, 30, 74]],
  [27.6, [0, 4, 0, 30, 26, 30]],
  [34, [0, 4, 0, 6, 28, 32]],
];

function overlay(app) {
  const el = document.createElement('div');
  el.style.cssText = `position:absolute;inset:0;pointer-events:none;font-family:'JetBrains Mono',monospace;color:#2a2620`;
  const panel = 'background:rgba(246,242,235,.92);border:1px solid rgba(110,98,78,.28)';
  el.innerHTML = `
  <div style="position:absolute;left:0;top:0;right:0;height:62px;${panel};border-width:0 0 1px 0;display:flex;align-items:center;gap:20px;padding:0 24px">
    <div style="width:46px;height:46px;background:${PAL.accent};color:#fff;font:800 12px Inter;display:grid;place-items:center">LV-8</div>
    <div><div style="font:700 9.5px Inter;letter-spacing:2px;color:#8a7f6c">LAYER 1 · THE ALTAR · PRINCE AND ARENA, ONE MACHINE</div>
    <div style="font:800 25px/1.1 Inter;letter-spacing:-.01em">Leviathan LV-8 <span style="color:${PAL.accent}">/</span></div></div>
  </div>
  <div style="position:absolute;left:22px;top:82px;width:250px;${panel};padding:12px 14px;font-size:10.5px;line-height:1.7">
    <div style="font:700 9.5px Inter;letter-spacing:2px;color:#8a7f6c;margin-bottom:6px">ARM CURL · TIP</div><div data-bars></div></div>
  <div style="position:absolute;right:22px;top:82px;width:280px;${panel};padding:12px 14px;font-size:10.5px;line-height:1.85" data-subs></div>
  <div style="position:absolute;left:30px;bottom:96px">
    <div style="font:700 9.5px Inter;letter-spacing:2px;color:#8a7f6c">OPERATING MODE</div>
    <div data-mode style="font:800 34px/1.1 Inter;color:${PAL.accent}"></div></div>
  <div style="position:absolute;left:22px;bottom:22px;right:22px;${panel};padding:12px 16px;display:flex;align-items:center;gap:16px">
    <div style="width:30px;height:30px;border-radius:50%;background:${PAL.accent};color:#fff;display:grid;place-items:center;font:700 10px Inter" data-n></div>
    <div data-cap style="font:700 13.5px Inter;letter-spacing:1.1px"></div>
    <div data-s style="margin-left:auto;font-size:11px;color:#8a7f6c"></div>
  </div>`;
  app.appendChild(el);
  const q = (s) => el.querySelector(s);
  return {
    set({cap, n, mode, bars, subs, s}) {
      q('[data-cap]').textContent = cap;
      q('[data-n]').textContent = String(n).padStart(2, '0');
      q('[data-mode]').textContent = mode;
      q('[data-s]').textContent = s;
      q('[data-bars]').innerHTML = bars
        .map(([k, v]) => `<div style="display:flex;align-items:center;gap:8px"><span style="width:22px;color:#8a7f6c">${k}</span><span style="flex:1;height:5px;background:#e3dcd0"><i style="display:block;height:5px;width:${Math.round(v * 100)}%;background:${PAL.accent}"></i></span><b style="width:34px;text-align:right">${Math.round(v * 100)}%</b></div>`)
        .join('');
      q('[data-subs]').innerHTML =
        '<div style="font:700 9.5px Inter;letter-spacing:2px;color:#8a7f6c;margin-bottom:4px">SUBSYSTEMS</div>' +
        subs.map(([k, v, hot]) => `<div style="display:flex;justify-content:space-between;gap:8px"><span>${k}</span><b style="padding:0 6px;color:#fff;background:${hot ? PAL.accent : '#6d7f6a'}">${v}</b></div>`).join('');
    },
  };
}

export function run() {
  runSim({duration: DURATION, fps: 60, theme: 'light', hud: {enabled: false}, director: {enabled: false}, watermark: ''}, ({canvas, capture}) => {
    const renderer = new THREE.WebGLRenderer({canvas, antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance'});
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.02;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(PAL.bg);
    scene.fog = new THREE.Fog(PAL.bg, 90, 240);
    const camera = new THREE.PerspectiveCamera(34, 1, 0.3, 700);
    scene.add(new THREE.HemisphereLight('#fffaf2', '#c9b9a6', 1.35));
    const key = new THREE.DirectionalLight('#fff4e6', 2.4);
    key.position.set(30, 60, 40);
    key.castShadow = true;
    key.shadow.mapSize.set(4096, 4096);
    Object.assign(key.shadow.camera, {left: -40, right: 40, top: 40, bottom: -40, near: 5, far: 200});
    key.shadow.bias = -0.0003;
    key.shadow.normalBias = 0.03;
    scene.add(key);
    const rim = new THREE.DirectionalLight('#e8eef6', 0.9);
    rim.position.set(-40, 25, -30);
    scene.add(rim);
    const machine = buildMachine(scene);
    const ui = overlay(document.getElementById('app'));
    const resize = () => {
      const w = canvas.clientWidth || innerWidth;
      const h = canvas.clientHeight || innerHeight;
      renderer.setPixelRatio(capture ? 1 : Math.min(devicePixelRatio || 1, 2));
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    return {
      resize,
      render(t) {
        const s = sAt(t);
        const M = model(s, t);
        const apart = Math.min(sm((t - 16.6) / 1.2), 1 - sm((t - 20.2) / 1.2));
        machine.update(M, {apart, apartArm: 2});
        const [x, y, z, az, el, dist] = keyed(CAM, t, (u) => sm(u));
        const A = (az * Math.PI) / 180;
        const E = (el * Math.PI) / 180;
        camera.position.set(x + dist * Math.cos(E) * Math.sin(A), y + dist * Math.sin(E), z + dist * Math.cos(E) * Math.cos(A));
        camera.lookAt(x, y, z);
        renderer.render(scene, camera);
        const bi = BEATS.reduce((k, b, i) => (t >= b.t ? i : k), 0);
        // curl per arm: how far its tip has turned up from hanging (0) to the full spiral (1)
        const bars = M.arms.map((Arm) => {
          const d = Arm.joints[N - 1].phi - Arm.joints[WEB - 1].phi;
          return [`A${Arm.k + 1}`, Math.min(1, Math.max(0, (d + 2.24) / 4.76))];
        });
        ui.set({
          cap: BEATS[bi].cap,
          n: bi + 1,
          mode: BEATS[bi].mode,
          s: `STAGE ${s.toFixed(2)} / 3`,
          bars,
          subs: [
            ['Arms ×8 · 16 links', s > 1 && s < 2 ? 'REARING' : s > 0.1 ? 'CURLING' : 'FLAT', bi === 2],
            ['Web plates ×72', s > 2.05 ? 'BOWL' : 'LEVEL', s > 2 && s < 2.6],
            ['Mantle petals ×6', M.open > 0.95 ? 'OPEN' : M.open > 0.02 ? 'OPENING' : 'SEALED', M.open > 0.02 && M.open < 0.98],
            ['Optics ×2', M.eyes > 0.5 ? 'AWAKE' : 'DARK', M.eyes > 0.02 && M.eyes < 0.98],
            ['Core', M.core > 0.5 ? 'EXPOSED' : 'HIDDEN', M.core > 0.02 && M.core < 0.98],
            [`Arm 3`, apart > 0.05 ? `${Math.round(apart * 100)}% APART` : 'LOCKED', apart > 0.05],
          ],
        });
        void ARMS;
        return {};
      },
    };
  });
}
