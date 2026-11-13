// The Falkirk Wheel film, 28 s. render(t) is pure: the wheel angle and the docking input are keyed functions of t,
// every part is posed from kin.js, every readout comes from the same pose. The 180° turn takes 5.5 real minutes; the
// film shows it in 12 s and the clock on the panel runs real time.
import * as THREE from 'three';
import {runSim} from '../kit/runtime.js';
import {keyed} from '../kit/util.js';
import {D, readouts} from './kin.js';
import {buildMachine, PAL} from './machine.js';

export const DURATION = 28;
export const BEATS = [
  {t: 0, cap: 'DOCKED · LOWER CAISSON IN THE BASIN, UPPER ON THE AQUEDUCT'},
  {t: 2.6, cap: 'UNDOCK · GATES DOWN, SEALS OFF, STOW PINS OUT'},
  {t: 6, cap: 'TURN · 180° ON ONE 3.5 M AXLE'},
  {t: 10.5, cap: 'THE TRAIN · FIXED 8 M SUN, IDLERS AT 3×, CAISSON RINGS HOLD LEVEL'},
  {t: 15, cap: 'A CAISSON RIDES ITS RAIL INSIDE THE 8 M EYE'},
  {t: 19.4, cap: 'DOCK · PINS IN, SEAL ON, GATES UP'},
  {t: 23.6, cap: '24 M LIFT · ABOUT 1.5 kWh A HALF TURN'},
];
const smoother = (u) => {
  const x = Math.min(1, Math.max(0, u));
  return x * x * x * (x * (x * 6 - 15) + 10);
};
// wheel angle: the real drive ramps up and down; a smoothstep over 6 → 18.6 s
export const angleAt = (t) => Math.PI * smoother((t - 6) / 12.6);
const docking = (t) => {
  // undock 2.6 → 5.4, dock 19.4 → 22.6
  const out = 1 - smoother((t - 2.6) / 2.8);
  const back = smoother((t - 19.4) / 3.2);
  return t < 12 ? out : back;
};
export function opsAt(t) {
  const d = docking(t);
  // order: pins and seal lead when docking, gates follow; reversed when undocking
  const ph = (a, b) => smoother((d - a) / (b - a));
  return {pins: ph(0, 0.35), seal: ph(0.25, 0.6), gates: ph(0.55, 1), dock: d};
}
// camera: [t, [targetX, targetY, targetZ, az, el, dist]]
const CAM = [
  [0, [0, 10, 4, -58, 12, 96]],
  [2.2, [0, 1.5, 14, 38, 9, 30]],
  [5.4, [0, 1.5, 14, 30, 10, 32]],
  [6.6, [0, 10, 4, -62, 13, 96]],
  [9.6, [0, 11, -6, -110, 10, 74]],
  [10.8, [0, D.axleY - 3, -14, -150, 8, 31]],
  [14.2, [0, D.axleY - 3, -14, -134, 12, 33]],
  [15.4, [5, D.axleY, 13, -68, 14, 36]],
  [18.8, [0, D.lift - 1, 14, 36, 14, 30]],
  [22.8, [0, D.lift - 2, 14, 28, 18, 34]],
  [24.4, [0, 11, 4, -52, 15, 100]],
  [28, [0, 11, 4, -44, 17, 104]],
];

function overlay(app) {
  const el = document.createElement('div');
  el.style.cssText = `position:absolute;inset:0;pointer-events:none;font-family:'JetBrains Mono',monospace;color:#2a2620`;
  const panel = 'background:rgba(243,238,227,.92);border:1px solid rgba(110,98,78,.35)';
  el.innerHTML = `
  <div style="position:absolute;left:0;top:0;right:0;height:64px;${panel};border-width:0 0 1px 0;display:flex;align-items:center;gap:22px;padding:0 26px">
    <div style="width:44px;height:44px;background:${PAL.accent};color:#fff;font:800 13px Inter;display:grid;place-items:center">FW</div>
    <div><div style="font:700 10px Inter;letter-spacing:2px;color:#8a7f6c">ROTATING BOAT LIFT · FIELD SIMULATOR</div>
    <div style="font:800 26px/1.1 Inter;letter-spacing:-.01em">Falkirk Wheel <span style="color:${PAL.accent}">/</span></div></div>
    <div data-clock style="margin-left:auto;font-size:13px;letter-spacing:1px"></div>
  </div>
  <div style="position:absolute;left:24px;top:86px;width:250px;${panel};padding:14px 16px;font-size:12px;line-height:1.85" data-read></div>
  <div style="position:absolute;right:24px;top:86px;width:290px;${panel};padding:14px 16px;font-size:11px;line-height:1.9" data-subs></div>
  <div style="position:absolute;left:24px;bottom:24px;right:24px;${panel};padding:14px 18px;display:flex;align-items:center;gap:18px">
    <div style="width:34px;height:34px;border-radius:50%;background:${PAL.accent};color:#fff;display:grid;place-items:center;font:700 11px Inter" data-n></div>
    <div data-cap style="font:700 15px Inter;letter-spacing:1.2px"></div>
  </div>`;
  app.appendChild(el);
  const q = (s) => el.querySelector(s);
  return {
    set({cap, n, clock, rows, subs}) {
      q('[data-cap]').textContent = cap;
      q('[data-n]').textContent = String(n).padStart(2, '0');
      q('[data-clock]').textContent = clock;
      q('[data-read]').innerHTML = rows.map(([k, v]) => `<div style="display:flex;justify-content:space-between"><span style="color:#8a7f6c">${k}</span><b>${v}</b></div>`).join('');
      q('[data-subs]').innerHTML =
        '<div style="font:700 10px Inter;letter-spacing:2px;color:#8a7f6c;margin-bottom:4px">SUBSYSTEMS</div>' +
        subs.map(([k, v, hot]) => `<div style="display:flex;justify-content:space-between;gap:8px"><span>${k}</span><b style="padding:0 6px;color:#fff;background:${hot ? PAL.accent : '#6d7f6a'}">${v}</b></div>`).join('');
    },
  };
}

export function run() {
  runSim({duration: DURATION, fps: 60, theme: 'light', hud: {enabled: false}, director: {enabled: false}, watermark: ''}, ({canvas, capture}) => {
    const renderer = new THREE.WebGLRenderer({canvas, antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance'});
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(PAL.bg);
    scene.fog = new THREE.Fog(PAL.bg, 120, 320);
    const camera = new THREE.PerspectiveCamera(34, 1, 0.5, 900);
    scene.add(new THREE.HemisphereLight('#fbf6ec', '#b9ad98', 1.25));
    const key = new THREE.DirectionalLight('#fff6e8', 2.4);
    key.position.set(40, 70, 50);
    key.castShadow = true;
    key.shadow.mapSize.set(4096, 4096);
    Object.assign(key.shadow.camera, {left: -60, right: 60, top: 60, bottom: -60, near: 10, far: 220});
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.04;
    scene.add(key);
    const fill = new THREE.DirectionalLight('#dfe6ee', 0.7);
    fill.position.set(-50, 20, -30);
    scene.add(fill);
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
        const a = angleAt(t);
        const ops = opsAt(t);
        const P = machine.update(a, ops);
        // isolate the train while it is explained, then the caissons
        const isoTrain = Math.min(smoother((t - 10.3) / 0.6), 1 - smoother((t - 14.4) / 0.6));
        const isoCais = Math.min(smoother((t - 15.0) / 0.6), 1 - smoother((t - 18.6) / 0.6));
        if (isoTrain > 0.001) machine.isolate(['train', 'drive'], isoTrain);
        else if (isoCais > 0.001) machine.isolate(['caissons', 'structure'], isoCais * 0.75);
        else machine.isolate(null, 0);
        let [x, y, z, az, el, dist] = keyed(CAM, t, (u) => smoother(u));
        // while the caisson beat runs, follow caisson A's eye on the aqueduct-side plate
        const follow = Math.min(smoother((t - 14.6) / 0.9), 1 - smoother((t - 18.4) / 0.9));
        if (follow > 0) {
          const C = P.caissons[0].centre;
          const f = [C[0], C[1], D.zPlate + 1];
          const k = follow;
          [x, y, z, az, el, dist] = [x + (f[0] - x) * k, y + (f[1] - y) * k, z + (f[2] - z) * k, az + (-36 - az) * k, el + (12 - el) * k, dist + (24 - dist) * k];
        }
        const A = (az * Math.PI) / 180;
        const E = (el * Math.PI) / 180;
        camera.position.set(x + dist * Math.cos(E) * Math.sin(A), y + dist * Math.sin(E), z + dist * Math.cos(E) * Math.cos(A));
        camera.lookAt(x, y, z);
        renderer.render(scene, camera);
        const da = (angleAt(t + 0.01) - angleAt(t - 0.01)) / 0.02;
        const real = (da * DURATION) / Math.PI; // film rad/s → share of the half turn
        void real;
        // the film's 12.6 s stands for the real 5.5 min: wheel rpm in real terms
        const realRate = (da * 12.6) / (D.minutesPerHalf * 60);
        const R = readouts(a, realRate);
        const bi = BEATS.reduce((k, b, i) => (t >= b.t ? i : k), 0);
        const docked = Math.abs(Math.sin(a)) < 0.035;
        ui.set({
          cap: BEATS[bi].cap,
          n: bi + 1,
          clock: `REAL TIME ${Math.floor(R.minutes)}:${String(Math.floor((R.minutes % 1) * 60)).padStart(2, '0')} / 5:30`,
          rows: [
            ['WHEEL', `${R.angleDeg.toFixed(1)}°`],
            ['WHEEL RPM', R.rpmWheel.toFixed(3)],
            ['IDLER RPM', `${R.rpmIdler.toFixed(3)} (3×)`],
            ['CAISSON LEVEL', `${Math.abs(R.levelDeg).toFixed(3)}°`],
            ['LIFTED', `${R.lifted.toFixed(1)} / ${D.lift} m`],
            ['WATER A / B', `${R.caissons[0].toFixed(1)} / ${R.caissons[1].toFixed(1)} m`],
            ['ENERGY', `${R.kWh.toFixed(2)} kWh`],
          ],
          subs: [
            ['Drive · 10 motors', da > 1e-3 ? 'TURNING' : 'HOLD', da > 1e-3],
            ['Gear train', da > 1e-3 ? 'MESHING' : 'IDLE', isoTrain > 0.5],
            ['Caissons ×2', 'LEVEL', isoCais > 0.5],
            ['Stow pins', docked && ops.pins > 0.5 ? 'IN' : 'OUT', ops.pins > 0.02 && ops.pins < 0.98],
            ['U-seals', docked && ops.seal > 0.5 ? 'ON' : 'OFF', ops.seal > 0.02 && ops.seal < 0.98],
            ['Gates', docked && ops.gates > 0.5 ? 'OPEN' : 'SHUT', ops.gates > 0.02 && ops.gates < 0.98],
          ],
        });
        return {};
      },
    };
  });
}
