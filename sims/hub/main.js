// SLUMBER Bestiary: a side drawer of every biome, enemy and prince, with the live prototypes. A biome opens its arena
// blockout with its elites, the base roster and its prince in place and moving; an enemy or prince opens alone on a
// plinth beside a 1.8 m player; a prototype opens its live page inside the viewer.
// Routing on the hash (#greed, #gilded, #proto-bonepede2). ?thumb=<id>&t=<s> renders one still for card thumbnails.
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {ARENAS, playerMarker} from './arenas.js';
import {allCards, BASE, BIOMES, PROTOTYPES} from './roster.js';
import {BUILD} from './standins.js';

const q = new URLSearchParams(location.search);
const THUMB = q.get('thumb');
const THUMB_T = Number(q.get('t') ?? 3);
const CARDS = allCards();
const byId = Object.fromEntries(CARDS.map((c) => [c.id, c]));
const STATUS = {prototype: 'Prototype', game: 'In game', draft: 'Draft'};
const SIZE_M = {S: 0.7, M: 1.8, L: 3.5, 'S to L': 1.8, Prince: 20};

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
      <canvas id="gl"></canvas>
      <iframe id="proto" title="Prototype" hidden></iframe>
      <div class="labels" id="labels"></div>
      <section class="info" id="info" aria-live="polite"></section>
      <div class="hint" id="hint">Drag to orbit · scroll to zoom · click an enemy</div>
    </main>
  </div>`;
const drawer = document.getElementById('drawer');
const viewer = document.getElementById('viewer');
const canvas = document.getElementById('gl');
const iframe = document.getElementById('proto');
const info = document.getElementById('info');
const labels = document.getElementById('labels');
const hint = document.getElementById('hint');

const chip = (s) => `<span class="chip chip-${s}">${STATUS[s]}</span>`;
const thumb = (id) => `thumbs/${id}.jpg`;
const card = (c, extra = '') => `
  <a class="card ${extra}" href="#${c.id}" data-id="${c.id}">
    <img src="${c.thumb || thumb(c.id)}" alt="" loading="lazy" width="160" height="100">
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
scene.fog = new THREE.Fog(BG, 70, 160);
const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 600);
scene.add(new THREE.HemisphereLight('#7a8fb8', '#241a1c', 1.15));
const key = new THREE.DirectionalLight('#f1e2c8', 2.3);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
Object.assign(key.shadow.camera, {left: -40, right: 40, top: 40, bottom: -40, near: 1, far: 140});
key.shadow.bias = -0.0005;
key.shadow.normalBias = 0.03;
key.position.set(25, 50, 20);
scene.add(key, key.target);
const rim = new THREE.DirectionalLight('#b8321f', 1.8);
rim.position.set(-30, 18, -35);
scene.add(rim);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({color: '#211e26', roughness: 1}));
ground.position.y = -0.6;
ground.receiveShadow = true;
scene.add(ground);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI * 0.495;

let world = null; // {group, actors: [{update, group, card}], arena, focus}
const clearWorld = () => {
  if (!world) return;
  scene.remove(world.group);
  world.group.traverse((o) => {
    o.geometry?.dispose?.();
  });
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

const ctx = {camera};
const actor = (c, parent, pos) => {
  const g = new THREE.Group();
  g.position.set(...pos);
  parent.add(g);
  const update = BUILD[c.kind](g, ctx);
  const label = document.createElement('a');
  label.className = `label label-${c.status}`;
  label.href = `#${c.id}`;
  label.textContent = c.name;
  labels.append(label);
  return {g, update, card: c, label, height: c.size === 'Prince' ? 14 : (SIZE_M[c.size] || 2) * 1.6 + 2};
};

function openBiome(b) {
  clearWorld();
  const group = new THREE.Group();
  scene.add(group);
  const arena = ARENAS[b.arena](group);
  const actors = [];
  const roster = [...b.elites, ...['skull', 'worm', 'scorpion', 'spawner', 'quadruped', 'shooter'].map((id) => BASE.find((e) => e.id === id))];
  roster.slice(0, arena.spots.length).forEach((c, i) => actors.push(actor(c, group, arena.spots[i])));
  actors.push(actor(b.prince, group, arena.prince));
  const pm = playerMarker();
  pm.position.set(...(b.arena === 'void' ? [0, 0, 5] : [0, 0, 8]));
  group.add(pm);
  ground.visible = b.arena !== 'void';
  world = {group, actors, arena};
  const c = arena.cam;
  setCam(c.target, c.az, c.el, c.dist);
  info.innerHTML = `
    <div class="info-eyebrow">Layer ${b.layer} · ${b.sin} · teaches ${b.move}</div>
    <h1>${b.name}</h1>
    <p>${b.concept}</p>
    <p class="info-small">Prince: <a href="#${b.prince.id}">${b.prince.name}</a>. Elites: ${b.elites.map((e) => `<a href="#${e.id}">${e.name}</a>`).join(', ')}. The base roster turns up on every layer. Teal capsule: a 1.8 m player.</p>`;
}

function openFocus(c) {
  clearWorld();
  const group = new THREE.Group();
  scene.add(group);
  const prince = c.size === 'Prince';
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(prince ? 18 : 7, prince ? 18 : 7, 0.6, 40), new THREE.MeshStandardMaterial({color: '#4a4750', roughness: 0.9, flatShading: true}));
  plinth.position.y = -0.3;
  plinth.receiveShadow = true;
  group.add(plinth);
  const a = actor(c, group, prince ? [0, 12, 0] : [0, 0, 0]);
  // the 1.8 m player stands to the left of the subject, off the camera's line
  const pm = playerMarker();
  pm.position.set(prince ? -14 : -2.6, 0, prince ? 4 : 0.6);
  group.add(pm);
  ground.visible = true;
  world = {group, actors: [a], arena: null};
  // frame the subject from where its parts actually are over the first few seconds
  // (solid parts only: beams, thrown lances, glows and shield bubbles would make the frame far too wide)
  const box = new THREE.Box3();
  const part = new THREE.Box3();
  for (const t of [0, 1.3, 2.6, 3.9]) {
    a.update(t, ctx);
    a.g.updateMatrixWorld(true);
    a.g.traverse((o) => {
      if (!o.isMesh || o.isInstancedMesh || o.material.isMeshBasicMaterial || o.material.transparent) return;
      box.union(part.setFromObject(o));
    });
  }
  if (box.isEmpty()) box.setFromObject(a.g);
  box.expandByObject(pm);
  const cen = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const span = Math.max(size.x, size.y * 1.4, size.z, 2.5);
  setCam([cen.x, cen.y, cen.z], 32, prince ? 12 : 16, span * 1.55 + 2);
  const home = BIOMES.find((b) => b.elites.some((e) => e.id === c.id) || b.prince.id === c.id);
  const proto = c.proto ? PROTOTYPES.find((p) => p.id === c.proto) : null;
  info.innerHTML = `
    <div class="info-eyebrow">${c.role} · size ${c.size}${home ? ` · <a href="#${home.id}">${home.name}</a>` : ' · every layer'}</div>
    <h1>${c.name} ${chip(c.status)}</h1>
    <dl class="spec">
      <dt>Does</dt><dd>${c.verb}</dd>
      <dt>Tell</dt><dd>${c.tell}</dd>
      <dt>Counter</dt><dd>${c.counter}</dd>
    </dl>
    ${proto ? `<p class="info-small"><a class="btn" href="#${proto.id}">Open the live prototype</a></p>` : `<p class="info-small">${c.status === 'game' ? 'Built in the game; this is a whitebox stand-in.' : 'Draft: a whitebox stand-in for talking about it.'} Red orbs are weak points. Teal capsule: a 1.8 m player.</p>`}`;
}

function openProto(p) {
  clearWorld();
  canvas.hidden = true;
  hint.hidden = true;
  iframe.hidden = false;
  if (!iframe.src.endsWith(p.page)) iframe.src = p.page;
  info.innerHTML = `<div class="info-eyebrow">Live prototype</div><h1>${p.name}</h1><p>${p.note}. It runs in its own page: use its panel.</p>`;
}

function route() {
  const id = decodeURIComponent(location.hash.slice(1)) || 'altar';
  const c = byId[id] || byId.altar;
  canvas.hidden = false;
  hint.hidden = false;
  iframe.hidden = true;
  iframe.removeAttribute('src');
  if (c.kind === 'proto') openProto(c);
  else {
    resize(); // the canvas may have been hidden (size 0) while a prototype had the viewer
    if (c.kind === 'biome') openBiome(c.biome);
    else openFocus(c);
  }
  for (const a of drawer.querySelectorAll('.card')) a.setAttribute('aria-current', a.dataset.id === c.id ? 'true' : 'false');
  drawer.querySelector(`.card[data-id="${c.id}"]`)?.scrollIntoView({block: 'nearest'});
  if (matchMedia('(max-width: 760px)').matches) setDrawer(false);
}

// click an enemy in the scene to open it
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
let down = null;
canvas.addEventListener('pointerdown', (e) => (down = [e.clientX, e.clientY]));
canvas.addEventListener('pointerup', (e) => {
  if (!world || !down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5) return;
  const r = canvas.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hits = ray.intersectObjects(world.actors.map((a) => a.g), true);
  if (!hits.length) return;
  const a = world.actors.find((x) => {
    let o = hits[0].object;
    while (o && o !== x.g) o = o.parent;
    return o === x.g;
  });
  if (a && world.actors.length > 1) location.hash = a.card.id;
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
const V = new THREE.Vector3();
const frame = (t) => {
  if (world) {
    world.arena?.update(t);
    for (const a of world.actors) {
      a.update(t, ctx);
      if (world.actors.length > 1) {
        // label above the actor's current bounds
        a.g.getWorldPosition(V);
        const b = new THREE.Box3().setFromObject(a.g);
        if (!b.isEmpty()) V.set((b.min.x + b.max.x) / 2, b.max.y + 0.6, (b.min.z + b.max.z) / 2);
        V.project(camera);
        const vis = V.z < 1 && Math.abs(V.x) < 1.1 && Math.abs(V.y) < 1.1;
        a.label.style.display = vis ? '' : 'none';
        if (vis) a.label.style.transform = `translate(${((V.x + 1) / 2) * canvas.clientWidth}px, ${((1 - V.y) / 2) * canvas.clientHeight}px) translate(-50%, -100%)`;
      } else a.label.style.display = 'none';
    }
  }
  controls.update();
  renderer.render(scene, camera);
};

if (THUMB) {
  document.body.classList.add('thumb-mode');
  location.hash = THUMB;
  route();
  resize();
  frame(THUMB_T);
  window.THUMB_READY = true;
} else {
  addEventListener('hashchange', route);
  route();
  resize();
  const t0 = performance.now();
  const loop = () => {
    if (!canvas.hidden) frame((performance.now() - t0) / 1000);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
