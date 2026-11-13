// Shared by every SLUMBER teardown machine: the light studio, the console overlay in the repo's manner, the flesh
// and machined materials, and small part helpers. Machines import this so they all read as one family.
import * as THREE from 'three';

export const PAL = {
  bg: '#efebe4',
  floor: '#e6e0d5',
  flesh: '#c98f84',
  fleshDeep: '#a9665e',
  membrane: '#e2a99b',
  bone: '#ece5d8',
  steel: '#55585e',
  dark: '#232124',
  accent: '#d24a2a',
};

export function materials() {
  return {
    flesh: new THREE.MeshPhysicalMaterial({color: PAL.flesh, roughness: 0.55, sheen: 0.7, sheenColor: new THREE.Color('#ffb3a2'), sheenRoughness: 0.5, clearcoat: 0.25, clearcoatRoughness: 0.45}),
    fleshDeep: new THREE.MeshPhysicalMaterial({color: PAL.fleshDeep, roughness: 0.6, sheen: 0.6, sheenColor: new THREE.Color('#ff9a8a'), clearcoat: 0.2}),
    membrane: new THREE.MeshPhysicalMaterial({color: PAL.membrane, roughness: 0.4, transparent: true, opacity: 0.38, side: THREE.DoubleSide, depthWrite: false, sheen: 0.5, sheenColor: new THREE.Color('#ffc4b6')}),
    bone: new THREE.MeshStandardMaterial({color: PAL.bone, roughness: 0.5}),
    steel: new THREE.MeshStandardMaterial({color: PAL.steel, roughness: 0.4, metalness: 0.6}),
    dark: new THREE.MeshStandardMaterial({color: PAL.dark, roughness: 0.55, metalness: 0.2}),
    accent: new THREE.MeshStandardMaterial({color: PAL.accent, roughness: 0.45}),
  };
}

export function studio(canvas, {capture = false, shadow = 6, fog = [60, 200]} = {}) {
  const renderer = new THREE.WebGLRenderer({canvas, antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance'});
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PAL.bg);
  scene.fog = new THREE.Fog(PAL.bg, fog[0], fog[1]);
  const camera = new THREE.PerspectiveCamera(32, 1, 0.02, 600);
  scene.add(new THREE.HemisphereLight('#fffaf2', '#c9b9a6', 1.35));
  const key = new THREE.DirectionalLight('#fff4e6', 2.4);
  key.castShadow = true;
  key.shadow.mapSize.set(4096, 4096);
  Object.assign(key.shadow.camera, {left: -shadow, right: shadow, top: shadow, bottom: -shadow, near: 0.1, far: shadow * 12});
  key.shadow.bias = -0.0003;
  key.shadow.normalBias = 0.02;
  scene.add(key, key.target);
  const rim = new THREE.DirectionalLight('#e8eef6', 0.9);
  scene.add(rim, rim.target);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(800, 800).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({color: PAL.floor, roughness: 0.95}));
  floor.receiveShadow = true;
  scene.add(floor);
  const resize = () => {
    const w = canvas.clientWidth || innerWidth;
    const h = canvas.clientHeight || innerHeight;
    renderer.setPixelRatio(capture ? 1 : Math.min(devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  /** Orbit camera on a target; lights follow so the shadow box stays on the subject. */
  const aim = (target, az, el, dist) => {
    const A = (az * Math.PI) / 180;
    const E = (el * Math.PI) / 180;
    camera.position.set(target[0] + dist * Math.cos(E) * Math.sin(A), target[1] + dist * Math.sin(E), target[2] + dist * Math.cos(E) * Math.cos(A));
    camera.lookAt(...target);
    key.position.set(target[0] + shadow * 0.8, target[1] + shadow * 2.2, target[2] + shadow);
    key.target.position.set(...target);
    rim.position.set(target[0] - shadow, target[1] + shadow * 0.6, target[2] - shadow);
    rim.target.position.set(...target);
  };
  return {renderer, scene, camera, floor, resize, aim, render: () => renderer.render(scene, camera)};
}

/** The console: header, curve/bars panel on the left, subsystems on the right, mode word and the beat strip. */
export function consoleUI(app, {code, eyebrow, title}) {
  const el = document.createElement('div');
  el.style.cssText = `position:absolute;inset:0;pointer-events:none;font-family:'JetBrains Mono',monospace;color:#2a2620`;
  const panel = 'background:rgba(246,242,235,.92);border:1px solid rgba(110,98,78,.28)';
  el.innerHTML = `
  <div style="position:absolute;left:0;top:0;right:0;height:62px;${panel};border-width:0 0 1px 0;display:flex;align-items:center;gap:20px;padding:0 24px">
    <div style="width:46px;height:46px;background:${PAL.accent};color:#fff;font:800 11px Inter;display:grid;place-items:center">${code}</div>
    <div><div style="font:700 9.5px Inter;letter-spacing:2px;color:#8a7f6c">${eyebrow}</div>
    <div style="font:800 25px/1.1 Inter;letter-spacing:-.01em">${title} <span style="color:${PAL.accent}">/</span></div></div>
  </div>
  <div style="position:absolute;left:22px;top:82px;width:250px;${panel};padding:12px 14px;font-size:10.5px;line-height:1.75" data-left></div>
  <div style="position:absolute;right:22px;top:82px;width:280px;${panel};padding:12px 14px;font-size:10.5px;line-height:1.85" data-subs></div>
  <div style="position:absolute;left:30px;bottom:96px">
    <div style="font:700 9.5px Inter;letter-spacing:2px;color:#8a7f6c">OPERATING MODE</div>
    <div data-mode style="font:800 34px/1.1 Inter;color:${PAL.accent}"></div></div>
  <div style="position:absolute;left:22px;bottom:22px;right:22px;${panel};padding:12px 16px;display:flex;align-items:center;gap:16px">
    <div style="width:30px;height:30px;border-radius:50%;background:${PAL.accent};color:#fff;display:grid;place-items:center;font:700 10px Inter" data-n></div>
    <div data-cap style="font:700 13.5px Inter;letter-spacing:1.1px"></div>
    <div data-r style="margin-left:auto;font-size:11px;color:#8a7f6c"></div>
  </div>`;
  app.appendChild(el);
  const q = (s) => el.querySelector(s);
  const head = (t) => `<div style="font:700 9.5px Inter;letter-spacing:2px;color:#8a7f6c;margin-bottom:5px">${t}</div>`;
  return {
    set({cap, n, mode, right = '', rows = [], bars = [], barsTitle = '', subs = []}) {
      q('[data-cap]').textContent = cap;
      q('[data-n]').textContent = String(n).padStart(2, '0');
      q('[data-mode]').textContent = mode;
      q('[data-r]').textContent = right;
      q('[data-left]').innerHTML =
        rows.map(([k, v]) => `<div style="display:flex;justify-content:space-between"><span style="color:#8a7f6c">${k}</span><b>${v}</b></div>`).join('') +
        (bars.length ? `<div style="margin-top:8px">${head(barsTitle)}` + bars.map(([k, v]) => `<div style="display:flex;align-items:center;gap:8px"><span style="width:30px;color:#8a7f6c">${k}</span><span style="flex:1;height:5px;background:#e3dcd0"><i style="display:block;height:5px;width:${Math.round(Math.min(1, Math.max(0, v)) * 100)}%;background:${PAL.accent}"></i></span></div>`).join('') + '</div>' : '');
      q('[data-subs]').innerHTML = head('SUBSYSTEMS') + subs.map(([k, v, hot]) => `<div style="display:flex;justify-content:space-between;gap:8px"><span>${k}</span><b style="padding:0 6px;color:#fff;background:${hot ? PAL.accent : '#6d7f6a'}">${v}</b></div>`).join('');
    },
  };
}

// ------------------------------------------------------------ part helpers (geometry between two points, gears, lathes)
const Yax = new THREE.Vector3(0, 1, 0);
/** A cylinder whose ends sit exactly on points a and b. */
export function rod(a, b, r, seg = 10) {
  const A = new THREE.Vector3(...a);
  const B = new THREE.Vector3(...b);
  const g = new THREE.CylinderGeometry(r, r, A.distanceTo(B), seg);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(Yax, B.clone().sub(A).normalize()));
  g.translate((A.x + B.x) / 2, (A.y + B.y) / 2, (A.z + B.z) / 2);
  return g;
}
export function lathe(profile, seg = 32) {
  const g = new THREE.LatheGeometry(profile.map(([x, y]) => new THREE.Vector2(x, y)), seg);
  g.computeVertexNormals();
  return g;
}
export function gearShape(r, n, bore = 0.35) {
  const s = new THREE.Shape();
  const m = (2 * r) / n;
  const TAU = Math.PI * 2;
  for (let k = 0; k < n; k++) {
    const c = (k / n) * TAU;
    const p = TAU / n;
    const pts = [[r - 1.25 * m, c - 0.5 * p], [r - 1.25 * m, c - 0.25 * p], [r + m, c - 0.12 * p], [r + m, c + 0.12 * p], [r - 1.25 * m, c + 0.25 * p]];
    pts.forEach(([rad, a], i) => (k === 0 && i === 0 ? s.moveTo(rad * Math.cos(a), rad * Math.sin(a)) : s.lineTo(rad * Math.cos(a), rad * Math.sin(a))));
  }
  s.closePath();
  if (bore > 0) {
    const h = new THREE.Path();
    h.absarc(0, 0, r * bore, 0, TAU, true);
    s.holes.push(h);
  }
  return s;
}
export const gear = (r, n, w, bore) => new THREE.ExtrudeGeometry(gearShape(r, n, bore), {depth: w, bevelEnabled: false}).translate(0, 0, -w / 2);
