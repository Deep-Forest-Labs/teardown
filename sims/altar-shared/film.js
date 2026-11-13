// The Altar film, 30 s: the drum revolve run through Run, Arrival, Phase 1 and Phase 2. render(t) is pure: script.js
// gives the inputs, kin.js the pose, machine.js the parts; the panels read the same numbers.
import * as THREE from 'three';
import {runSim} from '../kit/runtime.js';
import {keyed} from '../kit/util.js';
import {D, pose} from './kin.js';
import {buildMachine, PAL} from './machine.js';
import {DURATION, opsAt, STATES, stateAt} from './script.js';

const sm = (u) => {
  const x = Math.min(1, Math.max(0, u));
  return x * x * x * (x * (x * 6 - 15) + 10);
};
// camera: [t, [x, y, z, az, el, dist]] — the cutaway faces +x
const CAM = [
  [0, [0, -6, 0, 70, 26, 92]],
  [8.4, [0, -6, 0, 100, 24, 92]],
  [9.6, [0, -14, 0, 90, 12, 86]],
  [14.4, [0, -10, 0, 78, 14, 84]],
  [15.6, [0, 0, 0, 60, 34, 84]],
  [20.4, [0, 0, 0, 30, 36, 86]],
  [21.6, [0, -4, 0, 84, 28, 88]],
  [30, [0, -4, 0, 110, 28, 90]],
];

function overlay(app) {
  const el = document.createElement('div');
  el.style.cssText = `position:absolute;inset:0;pointer-events:none;font-family:'JetBrains Mono',monospace;color:#2a2620`;
  const panel = 'background:rgba(243,238,227,.92);border:1px solid rgba(110,98,78,.35)';
  el.innerHTML = `
  <div style="position:absolute;left:0;top:0;right:0;height:64px;${panel};border-width:0 0 1px 0;display:flex;align-items:center;gap:22px;padding:0 26px">
    <div style="width:44px;height:44px;background:${PAL.accent};color:#fff;font:800 13px Inter;display:grid;place-items:center">L1</div>
    <div><div style="font:700 10px Inter;letter-spacing:2px;color:#8a7f6c">LAYER 1 · THE ALTAR · A DRUM REVOLVE (OLIVIER, NATIONAL THEATRE) × 2.5</div>
    <div style="font:800 26px/1.1 Inter;letter-spacing:-.01em">The Altar <span style="color:${PAL.accent}">/</span> <span data-state style="font-size:18px;color:${PAL.accent}"></span></div></div>
  </div>
  <div style="position:absolute;left:24px;top:86px;width:270px;${panel};padding:14px 16px;font-size:12px;line-height:1.85" data-read></div>
  <div style="position:absolute;right:24px;top:86px;width:300px;${panel};padding:14px 16px;font-size:11px;line-height:1.9" data-subs></div>
  <div style="position:absolute;left:24px;bottom:24px;right:24px;${panel};padding:14px 18px;display:flex;align-items:center;gap:18px">
    <div style="width:34px;height:34px;border-radius:50%;background:${PAL.accent};color:#fff;display:grid;place-items:center;font:700 11px Inter" data-n></div>
    <div data-cap style="font:700 15px Inter;letter-spacing:1.2px"></div>
  </div>`;
  app.appendChild(el);
  const q = (s) => el.querySelector(s);
  return {
    set({cap, n, state, rows, subs}) {
      q('[data-cap]').textContent = cap;
      q('[data-n]').textContent = String(n).padStart(2, '0');
      q('[data-state]').textContent = state;
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
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(PAL.bg);
    scene.fog = new THREE.Fog(PAL.bg, 140, 360);
    const camera = new THREE.PerspectiveCamera(34, 1, 0.5, 900);
    scene.add(new THREE.HemisphereLight('#fbf6ec', '#b9ad98', 1.3));
    const key = new THREE.DirectionalLight('#fff6e8', 2.3);
    key.position.set(50, 80, 30);
    key.castShadow = true;
    key.shadow.mapSize.set(4096, 4096);
    Object.assign(key.shadow.camera, {left: -50, right: 50, top: 50, bottom: -50, near: 10, far: 260});
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.04;
    scene.add(key);
    const fill = new THREE.DirectionalLight('#dfe6ee', 0.8);
    fill.position.set(60, -10, 20);
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
        const ops = opsAt(t);
        const S = stateAt(t);
        const pinned = S.name === 'PHASE 1' ? 1 - sm((t - 15) / 0.6) : S.name === 'PHASE 2' ? sm((t - 21) / 0.6) : 1;
        machine.update({...ops, pinned});
        // the arrival shows the drop: ghost the stage and the top deck so the shaft reads
        const iso = Math.min(sm((t - 9.8) / 0.6), 1 - sm((t - 14.6) / 0.6));
        machine.isolate(iso > 0.001 ? ['drum', 'elevators', 'load', 'drive'] : null, iso * 0.85);
        const [x, y, z, az, el, dist] = keyed(CAM, t, (u) => sm(u));
        const A = (az * Math.PI) / 180;
        const E = (el * Math.PI) / 180;
        camera.position.set(x + dist * Math.cos(E) * Math.sin(A), y + dist * Math.sin(E), z + dist * Math.cos(E) * Math.cos(A));
        camera.lookAt(x, y, z);
        renderer.render(scene, camera);
        const P = pose(ops);
        const d = (f) => ((f * 180) / Math.PI).toFixed(1);
        const open = P.elev.find((e) => e.ov < 1e-3);
        ui.set({
          cap: S.cap,
          n: STATES.indexOf(S) + 1,
          state: S.name,
          rows: [
            ['DRUM', `${d(((P.theta % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI))}°`],
            ['TOP DECK', `${d(((P.psi % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI))}° ${pinned > 0.5 ? 'PINNED' : 'FREE'}`],
            ['OPEN HALF', open ? `ELEVATOR ${open.id}` : 'NONE (TURNING)'],
            ['DECK A', `${P.elev[0].h.toFixed(1)} m`],
            ['DECK B', `${P.elev[1].h.toFixed(1)} m`],
            ['CW A / B', `${P.elev[0].cw.y1.toFixed(1)} / ${P.elev[1].cw.y1.toFixed(1)} m`],
            ['DRUM Ø', `${(2 * D.R).toFixed(0)} m (12 m × 2.5)`],
          ],
          subs: [
            ['Drive · 24 motors', 'TURNING', Math.abs(opsAt(t + 0.02).theta - ops.theta) > 1e-4],
            ['Wheels ×70', 'ON RAIL', false],
            ['Elevator A', P.elev[0].h > -0.05 ? 'AT STAGE' : P.elev[0].h < -D.travel + 0.1 ? 'BASEMENT' : 'BELOW', Math.abs(opsAt(t + 0.02).hA - ops.hA) > 1e-4],
            ['Elevator B', P.elev[1].h > -0.05 ? 'AT STAGE' : P.elev[1].h < -D.travel + 0.1 ? 'BASEMENT' : 'BELOW', Math.abs(opsAt(t + 0.02).hB - ops.hB) > 1e-4],
            ['Top deck', pinned > 0.5 ? 'PINNED' : 'FREE', pinned > 0.05 && pinned < 0.95],
            ['Load (prince)', ops.prince ? 'ON B' : '-', false],
          ],
        });
        return {};
      },
    };
  });
}
