// SLUMBER Bestiary: a side drawer of every biome, enemy and prince, with the live prototypes, and a sandbox stage.
// A biome opens its arena with its elites, the base roster and its prince; an enemy or prince opens alone on a plinth;
// a prototype opens its live page inside the viewer.
// Stage panel: Wander (they patrol) or Hunt (drive the player with WASD + Space and they play their mechanic on you),
// weak points on or off, labels, prince, base roster, follow camera, arena width and height, enemy speed.
// Routing on the hash (#greed, #gilded, #proto-bonepede2). ?thumb=<id>&t=<s> renders one still (Wander mode).
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {createShots} from './agent.js';
import {ARENAS} from './arenas.js';
import {createPlayer} from './player.js';
import {allCards, BASE, BIOMES, PROTOTYPES, WEAK} from './roster.js';
import {BUILD} from './standins.js';

const q = new URLSearchParams(location.search);
const THUMB = q.get('thumb');
const THUMB_T = Number(q.get('t') ?? 3);
const CARDS = allCards();
const byId = Object.fromEntries(CARDS.map((c) => [c.id, c]));
const STATUS = {prototype: 'Prototype', game: 'In game', draft: 'Draft'};
const DT = 1 / 60;

// per-viewer settings (a convenience: the page works without storage)
const SETTINGS_KEY = 'bestiary-stage-v1';
const DEFAULTS = {hunt: false, weak: true, labels: true, prince: true, roster: true, follow: true, speed: 1, scale: {}};
let S = {...DEFAULTS};
try {
  S = {...DEFAULTS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}')};
} catch {}
const save = () => {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(S));
  } catch {}
};
if (THUMB) S = {...DEFAULTS, labels: false};

// ------------------------------------------------------------ DOM
const root = document.getElementById('root');
root.innerHTML = `
  <header class="top">
    <button class="drawer-toggle" id="drawer-toggle" aria-controls="drawer" aria-expanded="true">Bestiary</button>
    <div class="brand"><span class="brand-name">SLUMBER</span> <span class="brand-sub">Bestiary</span></div>
    <div class="top-note">Whitebox stand-ins and live prototypes. Nine layers down.</div>
  </header>
  <div class="shell">
    <nav class="drawer" id="drawer" aria-label="Biomes, enemies and prototypes"></nav>
    <main class="viewer" id="viewer">
      <canvas id="gl" tabindex="0" aria-label="Stage. In Hunt mode: WASD to move, Space to jump"></canvas>
      <iframe id="proto" title="Prototype" hidden></iframe>
      <div class="labels" id="labels"></div>
      <section class="info" id="info" aria-live="polite"></section>
      <section class="stage" id="stage" aria-label="Stage controls"></section>
      <div class="hud" id="hud" hidden></div>
    </main>
  </div>`;
const drawer = document.getElementById('drawer');
const viewer = document.getElementById('viewer');
const canvas = document.getElementById('gl');
const iframe = document.getElementById('proto');
const info = document.getElementById('info');
const labels = document.getElementById('labels');
const stageEl = document.getElementById('stage');
const hud = document.getElementById('hud');

const chip = (s) => `<span class="chip chip-${s}">${STATUS[s]}</span>`;
const card = (c, extra = '') => `
  <a class="card ${extra}" href="#${c.id}" data-id="${c.id}">
    <img src="${c.thumb || `thumbs/${c.id}.jpg`}" alt="" loading="lazy" width="160" height="100">
    <span class="card-text"><span class="card-name">${c.name}</span><span class="card-meta">${c.role || c.note || ''}</span>${c.status ? chip(c.status) : ''}</span>
  </a>`;
drawer.innerHTML = `
  <section class="group">
    <h2 class="group-h"><span class="g-num">▶</span> Live prototypes</h2>
    ${PROTOTYPES.map((p) => card({...p, status: 'prototype', role: p.note})).join('')}
  </section>
  <section class="group">
    <h2 class="group-h"><span class="g-num">·</span> Base roster <small>every layer</small></h2>
    ${BASE.map((e) => card(e)).join('')}
  </section>
  ${BIOMES.map((b) => `
  <section class="group">
    <h2 class="group-h"><span class="g-num">${b.layer}</span> ${b.name} <small>${b.sin} · ${b.move}</small></h2>
    ${card({id: b.id, name: 'Arena with its enemies', role: b.concept.split('.')[0], status: null}, 'card-biome')}
    ${b.elites.map((e) => card(e)).join('')}
    ${card(b.prince, 'card-prince')}
  </section>`).join('')}`;
const toggle = document.getElementById('drawer-toggle');
const setDrawer = (open) => {
  document.body.classList.toggle('drawer-closed', !open);
  toggle.setAttribute('aria-expanded', String(open));
};
toggle.addEventListener('click', () => setDrawer(document.body.classList.contains('drawer-closed')));
if (matchMedia('(max-width: 760px)').matches) setDrawer(false);

// ------------------------------------------------------------ 3D stage
const renderer = new THREE.WebGLRenderer({canvas, antialias: true, preserveDrawingBuffer: !!THUMB, powerPreference: 'high-performance'});
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
const scene = new THREE.Scene();
const BG = new THREE.Color('#15141b');
scene.background = BG;
scene.fog = new THREE.Fog(BG, 90, 200);
const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 800);
scene.add(new THREE.HemisphereLight('#7a8fb8', '#241a1c', 1.15));
const key = new THREE.DirectionalLight('#f1e2c8', 2.3);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
Object.assign(key.shadow.camera, {left: -55, right: 55, top: 55, bottom: -55, near: 1, far: 180});
key.shadow.bias = -0.0005;
key.shadow.normalBias = 0.03;
key.position.set(30, 70, 25);
scene.add(key, key.target);
const rim = new THREE.DirectionalLight('#b8321f', 1.8);
rim.position.set(-30, 18, -35);
scene.add(rim);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(600, 600).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({color: '#211e26', roughness: 1}));
ground.position.y = -0.6;
ground.receiveShadow = true;
ground.userData.tag = 'ground';
scene.add(ground);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI * 0.495;
controls.maxDistance = 200;

const player = createPlayer(scene);
const ray = new THREE.Raycaster();
const DOWN = new THREE.Vector3(0, -1, 0);
let world = null;

// floors and features from the arena's tagged meshes
function collect(group) {
  const floor = [];
  const updrafts = [];
  const fire = [];
  group.traverse((o) => {
    if (!o.isMesh) return;
    const t = o.userData.tag;
    if (t === 'updraft') updrafts.push(o);
    else if (t === 'fire') fire.push(o);
    else if (t === 'nocollide' || o.material.isMeshBasicMaterial) return;
    else floor.push(o);
  });
  return {floor, updrafts, fire};
}
const surface = (x, z, yFrom) => {
  if (!world) return null;
  ray.set(new THREE.Vector3(x, yFrom, z), DOWN);
  ray.far = 400;
  const hit = ray.intersectObjects(world.floor, false)[0];
  return hit ? {y: hit.point.y, tag: hit.object.userData.tag} : null;
};
const groundY = (x, z, yFrom) => surface(x, z, yFrom)?.y ?? null;
const V = new THREE.Vector3();
const inUpdraft = (p) =>
  world.updrafts.some((m) => {
    m.getWorldPosition(V);
    const r = 1.6 * world.arenaGroup.scale.x;
    return Math.hypot(p.x - V.x, p.z - V.z) < r && p.y < V.y + 13 * world.arenaGroup.scale.y;
  });
const hazardAt = (p) =>
  world.fire.some((m) => {
    m.getWorldPosition(V);
    const half = 22 * world.arenaGroup.scale.x;
    return Math.abs(p.x - V.x) < half && Math.abs(p.z - V.z) < half && p.y < V.y + 0.1 && p.y > V.y - 3;
  });

const clearWorld = () => {
  if (!world) return;
  scene.remove(world.root);
  labels.innerHTML = '';
  world = null;
};
const setCam = (target, az, el, dist) => {
  const a = (az * Math.PI) / 180;
  const e = (el * Math.PI) / 180;
  controls.target.set(...target);
  camera.position.set(target[0] + dist * Math.cos(e) * Math.sin(a), target[1] + dist * Math.sin(e), target[2] + dist * Math.cos(e) * Math.cos(a));
  controls.update();
};

function makeActor(c, parent, pos, centre) {
  const g = new THREE.Group();
  g.position.copy(pos);
  parent.add(g);
  const K = {home: pos.clone(), centre};
  const update = BUILD[c.kind](g, K);
  const label = document.createElement('a');
  label.className = `label label-${c.status}`;
  label.href = `#${c.id}`;
  label.textContent = c.name;
  labels.append(label);
  return {g, update, card: c, label};
}

// build a scene for the current card at the current scale
let current = null;
function build(c) {
  clearWorld();
  const root = new THREE.Group();
  scene.add(root);
  const arenaGroup = new THREE.Group();
  const actorsGroup = new THREE.Group();
  const shotsGroup = new THREE.Group();
  root.add(arenaGroup, actorsGroup, shotsGroup);
  const actors = [];
  let cam;
  let spawn;
  let leash;
  let killY = -25;
  const centre = new THREE.Vector3();
  if (c.kind === 'biome') {
    const b = c.biome;
    const sc = S.scale[b.id] || {w: 1, h: 1};
    arenaGroup.scale.set(sc.w, sc.h, sc.w);
    const arena = ARENAS[b.arena](arenaGroup);
    const place = (p) => new THREE.Vector3(p[0] * sc.w, p[1] * sc.h, p[2] * sc.w);
    const roster = [...b.elites, ...(S.roster ? ['skull', 'worm', 'scorpion', 'spawner', 'quadruped', 'shooter'].map((id) => BASE.find((e) => e.id === id)) : [])];
    roster.slice(0, arena.spots.length).forEach((e, i) => actors.push(makeActor(e, actorsGroup, place(arena.spots[i]), centre)));
    if (S.prince) actors.push(makeActor(b.prince, actorsGroup, place(arena.prince), centre));
    spawn = place(b.arena === 'void' ? [0, 0.1, 5] : [0, 2, 8]);
    leash = 26 * sc.w;
    killY = b.arena === 'void' ? -12 : -25;
    const ac = arena.cam;
    cam = [[ac.target[0] * sc.w, ac.target[1] * sc.h, ac.target[2] * sc.w], ac.az, ac.el, ac.dist * Math.max(sc.w, 0.7)];
    ground.visible = b.arena !== 'void';
    world = {root, arenaGroup, actorsGroup, shots: createShots(shotsGroup), actors, arena, leash, centre, killY, spawn, ...collect(arenaGroup)};
    if (ground.visible) world.floor.push(ground);
  } else {
    const prince = c.size === 'Prince';
    const R = prince ? 30 : 9;
    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 0.6, 48), new THREE.MeshStandardMaterial({color: '#4a4750', roughness: 0.9, flatShading: true}));
    plinth.position.y = -0.3;
    plinth.receiveShadow = true;
    arenaGroup.add(plinth);
    actors.push(makeActor(c, actorsGroup, new THREE.Vector3(0, prince ? 12 : 0, 0), centre));
    spawn = new THREE.Vector3(prince ? -14 : -3, 0, prince ? 6 : 2.5);
    leash = R - 1;
    ground.visible = true;
    world = {root, arenaGroup, actorsGroup, shots: createShots(shotsGroup), actors, arena: null, leash, centre, killY, spawn, ...collect(arenaGroup)};
    // frame from the solid parts over the first seconds of Wander
    const ctx0 = makeCtx(0);
    const box = new THREE.Box3();
    const part = new THREE.Box3();
    for (let t = 0; t <= 4; t += DT) {
      ctx0.t = t;
      for (const a of actors) a.update(ctx0);
      if (Math.abs(t % 1.3) < DT) {
        actorsGroup.updateMatrixWorld(true);
        actorsGroup.traverse((o) => {
          if (!o.isMesh || o.isInstancedMesh || o.material.isMeshBasicMaterial || o.material.transparent) return;
          part.setFromObject(o);
          if (part.max.y > -20) box.union(part); // spare pieces wait at -50 m: leave them out
        });
      }
    }
    // an all-instanced body (Beelzebub's swarm) leaves the box empty: frame its anchor at its size instead
    const anchor = new THREE.Vector3(0, prince ? 12 : 1, 0);
    if (box.isEmpty() || box.getSize(new THREE.Vector3()).length() < 1) box.setFromCenterAndSize(anchor, new THREE.Vector3(1, 1, 1).multiplyScalar(prince ? 16 : 3));
    box.expandByPoint(spawn);
    const cen = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const span = Math.max(size.x, size.y * 1.4, size.z, 2.5);
    cam = [[cen.x, cen.y, cen.z], 32, prince ? 12 : 16, span * 1.55 + 2];
    // rebuild so the scene starts fresh at t = 0
    root.remove(actorsGroup);
    labels.innerHTML = '';
    const fresh = new THREE.Group();
    root.add(fresh);
    world.actorsGroup = fresh;
    world.actors = [makeActor(c, fresh, new THREE.Vector3(0, prince ? 12 : 0, 0), centre)];
  }
  player.spawnAt(world.spawn);
  player.S.hits = 0;
  player.setOn(S.hunt && !THUMB);
  world.t = 0;
  current = c;
  return cam;
}

function makeCtx(t) {
  return {
    t,
    dt: DT,
    camera,
    hunt: S.hunt && !THUMB,
    player: player.S,
    showWeak: S.weak,
    showMarker: true,
    speedMul: S.speed,
    ground: groundY,
    surface,
    inUpdraft,
    hazardAt,
    centre: world.centre,
    leash: world.leash,
    killY: world.killY,
    shots: world.shots,
    agents: world.actors.map((a) => ({pos: a.g.position})),
    pull: new THREE.Vector3(),
    hurt: () => player.hurt(),
  };
}

function infoFor(c) {
  if (c.kind === 'biome') {
    const b = c.biome;
    return `
      <div class="info-eyebrow">Layer ${b.layer} · ${b.sin} · teaches ${b.move}</div>
      <h1>${b.name}</h1>
      <p>${b.concept}</p>
      <p class="info-small">Prince: <a href="#${b.prince.id}">${b.prince.name}</a>. Elites: ${b.elites.map((e) => `<a href="#${e.id}">${e.name}</a>`).join(', ')}. Orange pads launch the player, yellow lifts carry it.</p>`;
  }
  const home = BIOMES.find((b) => b.elites.some((e) => e.id === c.id) || b.prince.id === c.id);
  const proto = c.proto ? PROTOTYPES.find((p) => p.id === c.proto) : null;
  return `
    <div class="info-eyebrow">${c.role} · size ${c.size}${home ? ` · <a href="#${home.id}">${home.name}</a>` : ' · every layer'}</div>
    <h1>${c.name} ${chip(c.status)}</h1>
    <dl class="spec">
      <dt>Does</dt><dd>${c.verb}</dd>
      <dt>Tell</dt><dd>${c.tell}</dd>
      <dt>Counter</dt><dd>${c.counter}</dd>
      <dt>Weak point</dt><dd>${WEAK[c.id] || 'None'}</dd>
    </dl>
    ${proto ? `<p class="info-small"><a class="btn" href="#${proto.id}">Open the live prototype</a></p>` : ''}`;
}

// ------------------------------------------------------------ stage panel
function renderStage() {
  const c = current;
  const biome = c && c.kind === 'biome' ? c.biome : null;
  const sc = biome ? S.scale[biome.id] || {w: 1, h: 1} : null;
  stageEl.innerHTML = `
    <div class="stage-row seg" role="group" aria-label="Mode">
      <button type="button" data-mode="wander" aria-pressed="${!S.hunt}">Wander</button>
      <button type="button" data-mode="hunt" aria-pressed="${S.hunt}">Hunt</button>
    </div>
    <div class="stage-row toggles">
      ${[['weak', 'Weak points'], ['labels', 'Labels'], ['prince', 'Prince'], ['roster', 'Base roster'], ['follow', 'Follow']].map(([k, l]) => `<label><input type="checkbox" id="st-${k}" data-k="${k}" ${S[k] ? 'checked' : ''}> ${l}</label>`).join('')}
    </div>
    ${biome ? `
    <label class="stage-slider">Arena width <input type="range" id="st-w" min="0.5" max="2.5" step="0.05" value="${sc.w}"><output id="st-w-o">${sc.w.toFixed(2)}×</output></label>
    <label class="stage-slider">Arena height <input type="range" id="st-h" min="0.5" max="2.5" step="0.05" value="${sc.h}"><output id="st-h-o">${sc.h.toFixed(2)}×</output></label>` : ''}
    <label class="stage-slider">Enemy speed <input type="range" id="st-speed" min="0.3" max="2" step="0.05" value="${S.speed}"><output id="st-speed-o">${S.speed.toFixed(2)}×</output></label>
    <div class="stage-row">
      <button type="button" data-act="reset">Restart scene</button>
      ${biome ? '<button type="button" data-act="unscale">1× arena</button>' : ''}
    </div>
    <p class="stage-note">${S.hunt ? 'WASD to move, Space to jump (twice for a double jump). Click the stage first.' : 'Hunt mode drops in a player and the enemies play their mechanic on it.'}</p>`;
}
stageEl.addEventListener('click', (e) => {
  const m = e.target.closest('[data-mode]');
  if (m) {
    S.hunt = m.dataset.mode === 'hunt';
    save();
    rebuild();
    if (S.hunt) canvas.focus();
    return;
  }
  const act = e.target.closest('[data-act]')?.dataset.act;
  if (act === 'reset') rebuild();
  if (act === 'unscale' && current?.kind === 'biome') {
    delete S.scale[current.biome.id];
    save();
    rebuild();
  }
});
stageEl.addEventListener('change', (e) => {
  const k = e.target.dataset.k;
  if (k) {
    S[k] = e.target.checked;
    save();
    if (k === 'prince' || k === 'roster') rebuild();
    if (k === 'labels') labels.hidden = !S.labels;
    if (k === 'follow' && !S.follow) controls.enabled = true;
    return;
  }
  if (e.target.id === 'st-w' || e.target.id === 'st-h') rebuild(true); // re-place the enemies on the new floor
});
stageEl.addEventListener('input', (e) => {
  if (e.target.id === 'st-speed') {
    S.speed = Number(e.target.value);
    document.getElementById('st-speed-o').textContent = `${S.speed.toFixed(2)}×`;
    save();
  }
  if ((e.target.id === 'st-w' || e.target.id === 'st-h') && current?.kind === 'biome') {
    const id = current.biome.id;
    const sc = (S.scale[id] = {...(S.scale[id] || {w: 1, h: 1})});
    if (e.target.id === 'st-w') sc.w = Number(e.target.value);
    else sc.h = Number(e.target.value);
    document.getElementById(`${e.target.id}-o`).textContent = `${Number(e.target.value).toFixed(2)}×`;
    world?.arenaGroup.scale.set(sc.w, sc.h, sc.w); // live preview; enemies re-place on release
    save();
  }
});

function rebuild(keepCam = false) {
  if (!current || current.kind === 'proto') return;
  const camPos = camera.position.clone();
  const tgt = controls.target.clone();
  const cam = build(current);
  if (keepCam) {
    camera.position.copy(camPos);
    controls.target.copy(tgt);
  } else if (S.hunt && !THUMB) {
    // third person: behind and above the player, looking toward the arena centre
    const sp = world.spawn;
    const az = (Math.atan2(sp.x - world.centre.x, sp.z - world.centre.z) * 180) / Math.PI;
    setCam([sp.x, sp.y + 1.2, sp.z], az, 32, current.kind === 'biome' ? 26 : 17);
  } else setCam(...cam);
  renderStage();
  info.innerHTML = infoFor(current);
}

function openProto(p) {
  clearWorld();
  current = p;
  canvas.hidden = true;
  stageEl.hidden = true;
  hud.hidden = true;
  iframe.hidden = false;
  if (!iframe.src.endsWith(p.page)) iframe.src = p.page;
  info.innerHTML = `<div class="info-eyebrow">Live prototype</div><h1>${p.name}</h1><p>${p.note}. It runs in its own page: use its panel.</p>`;
}

function route() {
  const id = decodeURIComponent(location.hash.slice(1)) || 'altar';
  const c = byId[id] || byId.altar;
  iframe.hidden = true;
  iframe.removeAttribute('src');
  if (c.kind === 'proto') openProto(c);
  else {
    canvas.hidden = false;
    stageEl.hidden = !!THUMB;
    resize();
    current = c;
    rebuild();
  }
  for (const a of drawer.querySelectorAll('.card')) a.setAttribute('aria-current', a.dataset.id === c.id ? 'true' : 'false');
  drawer.querySelector(`.card[data-id="${c.id}"]`)?.scrollIntoView({block: 'nearest'});
  if (matchMedia('(max-width: 760px)').matches) setDrawer(false);
}

// click an enemy in the scene to open it (Wander mode only: in Hunt the canvas is for playing)
const ndc = new THREE.Vector2();
let down = null;
canvas.addEventListener('pointerdown', (e) => (down = [e.clientX, e.clientY]));
canvas.addEventListener('pointerup', (e) => {
  if (!world || S.hunt || !down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5 || world.actors.length < 2) return;
  const r = canvas.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  ray.far = Infinity;
  const hits = ray.intersectObjects([world.actorsGroup], true);
  if (!hits.length) return;
  const a = world.actors.find((x) => {
    let o = hits[0].object;
    while (o && o !== x.g) o = o.parent;
    return o === x.g;
  });
  if (a) location.hash = a.card.id;
});

// ------------------------------------------------------------ loop
const resize = () => {
  const w = canvas.clientWidth || viewer.clientWidth;
  const h = canvas.clientHeight || viewer.clientHeight;
  renderer.setPixelRatio(THUMB ? 1 : Math.min(devicePixelRatio || 1, 2));
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
};
addEventListener('resize', resize);

const prevP = new THREE.Vector3();
function tick() {
  world.t += DT;
  const ctx = makeCtx(world.t);
  world.arena?.update(world.t);
  for (const a of world.actors) a.update(ctx);
  world.shots.update(DT, ctx);
  prevP.copy(player.S.pos);
  player.update(DT, ctx);
  if (S.hunt && S.follow && player.S.on) {
    // the camera rides with the player; orbit still works around it
    const d = player.S.pos.clone().sub(prevP);
    camera.position.add(d);
    controls.target.add(d);
    controls.target.lerp(player.S.pos.clone().setY(player.S.pos.y + 1.2), 0.08);
  }
}
const B = new THREE.Box3();
function drawLabels() {
  labels.hidden = !S.labels;
  if (!S.labels || world.actors.length < 2) {
    for (const a of world.actors) a.label.style.display = 'none';
    return;
  }
  for (const a of world.actors) {
    B.setFromObject(a.g);
    if (B.isEmpty()) continue;
    V.set((B.min.x + B.max.x) / 2, B.max.y + 0.6, (B.min.z + B.max.z) / 2).project(camera);
    const vis = V.z < 1 && Math.abs(V.x) < 1.1 && Math.abs(V.y) < 1.1;
    a.label.style.display = vis ? '' : 'none';
    if (vis) a.label.style.transform = `translate(${((V.x + 1) / 2) * canvas.clientWidth}px, ${((1 - V.y) / 2) * canvas.clientHeight}px) translate(-50%, -100%)`;
  }
}

if (THUMB) {
  document.body.classList.add('thumb-mode');
  location.hash = THUMB;
  route();
  while (world && world.t < THUMB_T) tick();
  controls.update();
  renderer.render(scene, camera);
  window.THUMB_READY = true;
} else {
  addEventListener('hashchange', route);
  route();
  let last = performance.now();
  let acc = 0;
  const loop = (now) => {
    acc = Math.min(acc + (now - last) / 1000, 0.25);
    last = now;
    if (world && !canvas.hidden) {
      while (acc >= DT) {
        tick();
        acc -= DT;
      }
      controls.update();
      renderer.render(scene, camera);
      drawLabels();
      hud.hidden = !player.S.on;
      if (player.S.on) hud.textContent = `HITS TAKEN ${player.S.hits}`;
    } else acc = 0;
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
