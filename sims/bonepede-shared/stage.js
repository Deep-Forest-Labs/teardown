// A dark altar floor under slate-blue fill and a red rim light, with an optional pixel-filter preview: the scene is
// drawn into a low-resolution target and blown up with nearest sampling, roughly what SLUMBER's pixel pass does.
import * as THREE from 'three';

export const LOOK = {
  bg: '#14151c',
  floor: '#2b2426',
  grid: '#3a3133',
  sky: '#46597e',
  ground: '#1a1113',
  key: '#e9d8bf',
  rim: '#b8321f',
};

export function createStage(canvas, {capture = false} = {}) {
  const renderer = new THREE.WebGLRenderer({canvas, antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance'});
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(LOOK.bg);
  scene.fog = new THREE.Fog(LOOK.bg, 9, 26);
  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 200);

  scene.add(new THREE.HemisphereLight(LOOK.sky, LOOK.ground, 1.1));
  const key = new THREE.DirectionalLight(LOOK.key, 2.2);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = key.shadow.camera.bottom = -6;
  key.shadow.camera.right = key.shadow.camera.top = 6;
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 30;
  key.shadow.bias = -0.0008;
  key.shadow.normalBias = 0.02;
  scene.add(key, key.target);
  const rim = new THREE.DirectionalLight(LOOK.rim, 2.6);
  scene.add(rim, rim.target);

  // floor: flat stone with a faint 1 m grid so a planted foot visibly stays put
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({color: LOOK.floor, roughness: 0.95}));
  floor.receiveShadow = true;
  scene.add(floor);
  const grid = new THREE.GridHelper(200, 200, LOOK.grid, LOOK.grid);
  grid.position.y = 0.002;
  scene.add(grid);

  // pixel preview
  const low = new THREE.WebGLRenderTarget(4, 4, {minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, samples: 0});
  const quadScene = new THREE.Scene();
  const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({map: low.texture}));
  quadScene.add(quad);

  const size = {w: 1, h: 1};
  let pixel = 4; // screen px per art px
  const resize = () => {
    size.w = canvas.clientWidth || innerWidth;
    size.h = canvas.clientHeight || innerHeight;
    renderer.setPixelRatio(capture ? 1 : Math.min(devicePixelRatio || 1, 2));
    renderer.setSize(size.w, size.h, false);
    camera.aspect = size.w / size.h;
    camera.updateProjectionMatrix();
    low.setSize(Math.max(1, Math.round(size.w / pixel)), Math.max(1, Math.round(size.h / pixel)));
  };

  /** Point the lights at the subject so the shadow box follows it. */
  const follow = (c) => {
    key.position.set(c[0] + 4, 9, c[2] + 3);
    key.target.position.set(c[0], 0, c[2]);
    rim.position.set(c[0] - 5, 3, c[2] - 6);
    rim.target.position.set(c[0], 0.5, c[2]);
  };

  /** Orbit camera: target point, azimuth and elevation in degrees, distance in metres. */
  const aim = (target, az, el, dist) => {
    const a = (az * Math.PI) / 180;
    const e = (el * Math.PI) / 180;
    camera.position.set(target[0] + dist * Math.cos(e) * Math.sin(a), target[1] + dist * Math.sin(e), target[2] + dist * Math.cos(e) * Math.cos(a));
    camera.lookAt(target[0], target[1], target[2]);
  };

  const render = (px = 0) => {
    if (px > 0) {
      if (px !== pixel) {
        pixel = px;
        resize();
      }
      renderer.setRenderTarget(low);
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);
      renderer.render(quadScene, quadCam);
    } else renderer.render(scene, camera);
  };
  return {THREE, renderer, scene, camera, resize, follow, aim, render, size};
}

/** A plain DOM overlay: title block, beat caption, a few readouts. */
export function createOverlay(app) {
  const el = document.createElement('div');
  el.style.cssText = 'position:absolute;inset:0;pointer-events:none;font-family:"JetBrains Mono",monospace;color:#e8dcc4;';
  el.innerHTML = `
    <div style="position:absolute;left:40px;top:34px">
      <div style="font:800 46px/1 Inter,sans-serif;letter-spacing:-0.01em">BONEPEDE <span style="color:#d23a22">SKETCH</span></div>
      <div style="margin-top:8px;font-size:14px;opacity:.7;letter-spacing:.08em">SKULL WORM ART STUDY · POSE = f(DISTANCE CRAWLED)</div>
    </div>
    <div data-cap style="position:absolute;left:40px;bottom:40px;font-size:20px;letter-spacing:.06em"></div>
    <div data-read style="position:absolute;right:40px;top:76px;text-align:right;font-size:14px;line-height:1.7;opacity:.85"></div>`;
  app.appendChild(el);
  const cap = el.querySelector('[data-cap]');
  const read = el.querySelector('[data-read]');
  return {
    set(caption, rows) {
      cap.textContent = caption;
      read.innerHTML = rows.map(([k, v]) => `${k} <b style="color:#fff">${v}</b>`).join('<br>');
    },
    el,
  };
}
