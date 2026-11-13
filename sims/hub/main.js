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
import {ALL_FIGHTS as FIGHTS} from './fightsAll.js';
import {createPlayer} from './player.js';
import {allCards, BASE, BIOMES, PROTOTYPES, WEAK} from './roster.js';
import {BUILDS as BUILD} from './builds.js';
import {latestOf, parseId, versionsOf} from './versions.js';

import {PRINCE_FIGHT_SECONDS, WAVES} from './waves.js';
import {buildDesign, DEFAULT_SCALE} from './design.js';

const q = new URLSearchParams(location.search);
const THUMB = q.get('thumb');
const THUMB_T = Number(q.get('t') ?? 3);
const CARDS = allCards();
const byId = Object.fromEntries(CARDS.map((c) => [c.id, c]));
const STATUS = {prototype: 'Prototype', game: 'In game', draft: 'Draft'};
const DT = 1 / 60;

// per-viewer settings (a convenience: the page works without storage)
const SETTINGS_KEY = 'bestiary-stage-v1';
const DEFAULTS = {footprints: false, mode: 'wander', waveSpeed: 1, hunt: false, weak: true, labels: true, prince: true, roster: true, follow: true, speed: 1, scale: {}, fight: true, auto: true, phase: {}};
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
// mode is wander, hunt or phases; hunt is true whenever a player is in and the enemies come for it
S.hunt = S.mode !== 'wander';

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
    <span class="card-text"><span class="card-name">${c.name}</span><span class="card-meta">${c.role || c.note || ''}</span><span class="chips">${c.status ? chip(c.status) : ''}${c.kind && c.kind !== 'biome' && c.kind !== 'proto' ? `<span class="chip chip-v">${latestOf(c).v}</span>` : ''}</span></span>
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

// the version and tier picked in the main view for the open card (null = latest, tier 1)
let SEL = {v: null, tier: null};
function makeActor(c, parent, pos, centre, sel = {}) {
  const g = new THREE.Group();
  g.position.copy(pos);
  parent.add(g);
  const vers = versionsOf(c);
  const ver = (sel.v && vers.find((x) => x.v === sel.v)) || vers.at(-1);
  const K = {home: pos.clone(), centre, tier: sel.tier || 1};
  const update = BUILD[ver.kind](g, K);
  const label = document.createElement('a');
  label.className = `label label-${c.status}`;
  label.href = `#${c.id}`;
  label.textContent = c.name;
  labels.append(label);
  return {g, update, card: c, label, home: pos.clone()};
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
    const sc = S.scale[b.id] || DEFAULT_SCALE;
    arenaGroup.scale.set(sc.w, sc.h, sc.w);
    // a prince fight replaces the arena and the floating prince with one rig (fights.js)
    const fight = S.fight && FIGHTS[b.id] ? FIGHTS[b.id](arenaGroup) : null;
    const arena = fight ? null : ARENAS[b.arena](arenaGroup);
    const spots = fight ? fight.spots(0) : arena.spots;
    const place = (p) => new THREE.Vector3(p[0] * sc.w, p[1] * sc.h, p[2] * sc.w);
    const roster = [...b.elites, ...(S.roster ? ['skull', 'worm', 'scorpion', 'spawner', 'quadruped', 'shooter'].map((id) => BASE.find((e) => e.id === id)) : [])];
    if (S.prince && !fight) actors.push(makeActor(b.prince, actorsGroup, place(arena.prince), centre));
    spawn = place(fight ? fight.spawn : b.arena === 'void' ? [0, 0.1, 5] : [0, 2, 8]);
    leash = 26 * sc.w;
    killY = fight ? fight.killY : b.arena === 'void' ? -12 : -25;
    const ac = fight ? fight.cam : arena.cam;
    cam = [[ac.target[0] * sc.w, ac.target[1] * sc.h, ac.target[2] * sc.w], ac.az, ac.el, ac.dist * Math.max(sc.w, 0.7)];
    // a fight over water or an abyss has no ground plane under it
    ground.visible = fight ? fight.killY < -10 : b.arena !== 'void';
    world = {root, arenaGroup, actorsGroup, shots: createShots(shotsGroup), actors, arena, fight, f: 0, rt: {}, leash, centre, killY, spawn, ...collect(arenaGroup)};
    if (ground.visible) world.floor.push(ground);
    // place the roster by scale: measure each spot's clear floor, give the biggest walkers the roomiest spots
    if (S.mode !== 'phases') {
      fight?.update(makeCtx(0), 0);
      arenaGroup.updateMatrixWorld(true);
      const clear = spots.map((p) => clearanceAt(place(p)));
      const order = roster.slice(0, spots.length).map((e, i) => ({e, i, need: needOf(e), flies: FLIERS.has(e.id)}));
      const free = spots.map((_, i) => i);
      const pick = (o) => {
        // walkers: the roomiest free spot; fliers: the least roomy (they do not need floor)
        free.sort((a, b) => (o.flies ? clear[a] - clear[b] : clear[b] - clear[a]));
        return free.shift();
      };
      order.sort((a, b) => Number(a.flies) - Number(b.flies) || b.need - a.need);
      for (const o of order) {
        const si = pick(o);
        const a = makeActor(o.e, actorsGroup, place(spots[si]), centre);
        a.need = o.need;
        a.clear = clear[si];
        a.flies = o.flies;
        world.actors.push(a);
      }
    }
    // Phases mode: the layer's waves arrive at its spawn spots (portals) on a clock you can speed up or skip
    if (S.mode === 'phases') Object.assign(world, {waves: WAVES[b.id], wt: 0, next: 0, playing: true, portals: spots.map(place)});
  } else {
    const prince = c.size === 'Prince';
    const R = prince ? 30 : 9;
    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 0.6, 48), new THREE.MeshStandardMaterial({color: '#4a4750', roughness: 0.9, flatShading: true}));
    plinth.position.y = -0.3;
    plinth.receiveShadow = true;
    arenaGroup.add(plinth);
    actors.push(makeActor(c, actorsGroup, new THREE.Vector3(0, prince ? 12 : 0, 0), centre, SEL));
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
    world.actors = [makeActor(c, fresh, new THREE.Vector3(0, prince ? 12 : 0, 0), centre, SEL)];
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
    // true once per `period` seconds of stage time, per period (for a prince's volleys)
    ringTimer: (period) => {
      const k = Math.floor(t / period);
      if (world.rt[period] === k) return false;
      world.rt[period] = k;
      return k > 0;
    },
  };
}

function versionChips(c) {
  const vers = versionsOf(c);
  const cur = (SEL.v && vers.find((x) => x.v === SEL.v)) || vers.at(-1);
  const tiers = cur.tiers || [];
  const tier = SEL.tier || 1;
  const vrow = vers
    .map((x, i) => `<a class="vchip" href="#${c.id}-${x.v}${tiers.length && x.tiers ? `-t${tier}` : ''}" aria-current="${x === cur}" title="${x.date}: ${x.note}">${x.v}${i === vers.length - 1 ? ' · latest' : ''}</a>`)
    .join('');
  const trow = tiers.map((t) => `<a class="vchip" href="#${c.id}-${cur.v}-t${t.tier}" aria-current="${t.tier === tier}" title="${t.note}">${t.name}</a>`).join('');
  const note = tiers.length ? tiers.find((t) => t.tier === tier)?.note : cur.note;
  return `<div class="vrow" aria-label="Versions">${vrow}</div>${trow ? `<div class="vrow" aria-label="Tiers">${trow}</div>` : ''}<p class="info-small">${cur.v} · ${cur.date}: ${note}</p>`;
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
    ${versionChips(c)}
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
  const sc = biome ? S.scale[biome.id] || DEFAULT_SCALE : null;
  stageEl.innerHTML = `
    <div class="stage-row seg" role="group" aria-label="Mode">
      <button type="button" data-mode="wander" aria-pressed="${S.mode === 'wander'}">Wander</button>
      <button type="button" data-mode="hunt" aria-pressed="${S.mode === 'hunt'}">Hunt</button>
      ${biome ? `<button type="button" data-mode="phases" aria-pressed="${S.mode === 'phases'}">Phases</button>` : ''}
    </div>
    ${biome && S.mode === 'phases' ? `
    <div class="stage-row seg" role="group" aria-label="Playback">
      <button type="button" data-play aria-pressed="false" id="st-play">Pause</button>
      ${[0.5, 1, 2, 4].map((v) => `<button type="button" data-speed="${v}" aria-pressed="${S.waveSpeed === v}">${v}×</button>`).join('')}
    </div>
    <div class="stage-wave" id="st-wave"></div>
    <ol class="wave-list">${WAVES[biome.id].map((w, i) => `<li><button type="button" data-wave="${i}"><span class="w-t">${w.t}s</span> ${w.name}<small>${w.spawn.map(([id, n]) => (n > 1 ? n + '× ' : '') + (CARDS.find((c) => c.id === id)?.name || id)).join(', ') || (w.prince ? 'the prince fight' : 'nothing')}</small></button></li>`).join('')}</ol>` : ''}
    <div class="stage-row" hidden>
    </div>
    <div class="stage-row toggles">
      ${[['weak', 'Weak points'], ['labels', 'Labels'], ['prince', 'Prince'], ['roster', 'Base roster'], ['follow', 'Follow'], ['footprints', 'Footprints']].map(([k, l]) => `<label><input type="checkbox" id="st-${k}" data-k="${k}" ${S[k] ? 'checked' : ''}> ${l}</label>`).join('')}
    </div>
    ${biome ? `
    <label class="stage-slider">Arena width <input type="range" id="st-w" min="0.5" max="2.5" step="0.05" value="${sc.w}"><output id="st-w-o">${sc.w.toFixed(2)}×</output></label>
    <label class="stage-slider">Arena height <input type="range" id="st-h" min="0.5" max="2.5" step="0.05" value="${sc.h}"><output id="st-h-o">${sc.h.toFixed(2)}×</output></label>` : ''}
    ${biome && FIGHTS[biome.id] ? `
    <div class="stage-row toggles"><label><input type="checkbox" id="st-fight" data-k="fight" ${S.fight ? 'checked' : ''}> Prince fight (arena and prince as one rig)</label></div>
    ${S.fight ? `<label class="stage-slider">Fight phase <input type="range" id="st-phase" min="0" max="1.999" step="0.01" value="${S.phase[biome.id] ?? 0}"><output>${'·'}</output></label>
    <div class="stage-phase" id="st-phase-o"></div>
    <div class="stage-row toggles"><label><input type="checkbox" id="st-auto" data-k="auto" ${S.auto ? 'checked' : ''}> Play the fight</label></div>` : ''}` : ''}
    <label class="stage-slider">Enemy speed <input type="range" id="st-speed" min="0.3" max="2" step="0.05" value="${S.speed}"><output id="st-speed-o">${S.speed.toFixed(2)}×</output></label>
    <div class="stage-row">
      <button type="button" data-act="reset">Restart scene</button>
      ${biome ? '<button type="button" data-act="unscale">Default size</button>' : ''}
      <button type="button" data-act="export">Export design.json</button>
    </div>
    <p class="stage-note">${S.mode === 'phases' ? 'The waves come for the player; move it with WASD and Space, or leave it standing. Skip to any wave above.' : S.hunt ? 'WASD to move, Space to jump (twice for a double jump). Click the stage first.' : 'Hunt mode drops in a player and the enemies play their mechanic on it.'}</p>`;
}
stageEl.addEventListener('click', (e) => {
  const m = e.target.closest('[data-mode]');
  if (m) {
    S.mode = m.dataset.mode;
    S.hunt = S.mode !== 'wander';
    save();
    rebuild();
    if (S.hunt) canvas.focus();
    return;
  }
  const sp = e.target.closest('[data-speed]');
  if (sp) {
    S.waveSpeed = Number(sp.dataset.speed);
    save();
    for (const b of stageEl.querySelectorAll('[data-speed]')) b.setAttribute('aria-pressed', String(b === sp));
    return;
  }
  if (e.target.closest('[data-play]') && world?.waves) {
    world.playing = !world.playing;
    e.target.closest('[data-play]').textContent = world.playing ? 'Pause' : 'Play';
    return;
  }
  const wv = e.target.closest('[data-wave]');
  if (wv && current?.kind === 'biome') {
    // restart the layer and drop in at that wave, with its enemies
    const i = Number(wv.dataset.wave);
    rebuild(true);
    world.wt = world.waves[i].t - 0.05;
    world.next = i;
    return;
  }
  const act = e.target.closest('[data-act]')?.dataset.act;
  if (act === 'reset') rebuild();
  if (act === 'export') openExport();
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
    if (k === 'prince' || k === 'roster' || k === 'fight') rebuild();
    if (k === 'labels') labels.hidden = !S.labels;
    if (k === 'follow' && !S.follow) controls.enabled = true;
    return;
  }
  if (e.target.id === 'st-w' || e.target.id === 'st-h') rebuild(true); // re-place the enemies on the new floor
});
stageEl.addEventListener('input', (e) => {
  if (e.target.id === 'st-phase' && current?.kind === 'biome') {
    S.phase[current.biome.id] = Number(e.target.value);
    S.auto = false;
    const a = document.getElementById('st-auto');
    if (a) a.checked = false;
    save();
  }
  if (e.target.id === 'st-speed') {
    S.speed = Number(e.target.value);
    document.getElementById('st-speed-o').textContent = `${S.speed.toFixed(2)}×`;
    save();
  }
  if ((e.target.id === 'st-w' || e.target.id === 'st-h') && current?.kind === 'biome') {
    const id = current.biome.id;
    const sc = (S.scale[id] = {...(S.scale[id] || DEFAULT_SCALE)});
    if (e.target.id === 'st-w') sc.w = Number(e.target.value);
    else sc.h = Number(e.target.value);
    document.getElementById(`${e.target.id}-o`).textContent = `${Number(e.target.value).toFixed(2)}×`;
    world?.arenaGroup.scale.set(sc.w, sc.h, sc.w); // live preview; enemies re-place on release
    save();
  }
});

// ------------------------------------------------------------ export
function openExport() {
  const json = JSON.stringify(buildDesign(S), null, 2);
  let dlg = document.getElementById('export');
  if (!dlg) {
    dlg = document.createElement('dialog');
    dlg.id = 'export';
    dlg.className = 'export';
    document.body.append(dlg);
  }
  dlg.innerHTML = `
    <h2>design.json</h2>
    <p>Everything tuned here: arena scales (yours where you changed them, the default ${DEFAULT_SCALE.w}x wide and ${DEFAULT_SCALE.h}x tall elsewhere), wave timelines, prince fight phases and each enemy's behaviour numbers. The Unity bridge imports this file. Commit it to the fork as <code>sims/hub/design.json</code> to make it the team default.</p>
    <textarea readonly id="export-text" spellcheck="false"></textarea>
    <div class="stage-row"><button type="button" id="export-copy">Copy</button><button type="button" id="export-save">Download</button><button type="button" id="export-close">Close</button><span id="export-msg" class="stage-note"></span></div>`;
  dlg.querySelector('#export-text').value = json;
  const msg = dlg.querySelector('#export-msg');
  dlg.querySelector('#export-copy').onclick = () => {
    navigator.clipboard.writeText(json).then(
      () => (msg.textContent = 'Copied.'),
      () => {
        dlg.querySelector('#export-text').select();
        msg.textContent = 'Selected: press Ctrl+C.';
      },
    );
  };
  dlg.querySelector('#export-save').onclick = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([json], {type: 'application/json'}));
    a.download = 'design.json';
    a.click();
    msg.textContent = 'If nothing downloaded (the claude.ai viewer blocks downloads), use Copy.';
  };
  dlg.querySelector('#export-close').onclick = () => dlg.close();
  dlg.showModal();
}
if (q.has('export')) window.DESIGN = buildDesign(DEFAULTS);

// ------------------------------------------------------------ prince console
const consoleEl = document.createElement('section');
consoleEl.className = 'console';
consoleEl.setAttribute('aria-label', 'Prince console');
consoleEl.hidden = true;
viewer.append(consoleEl);
const GHOST = new THREE.MeshBasicMaterial({color: '#8a8496', transparent: true, opacity: 0.07, depthWrite: false});
let isolated = null;
function isolate(sub) {
  if (!world) return;
  world.root.traverse((o) => {
    if (o.isMesh && o.userData.__orig) {
      o.material = o.userData.__orig;
      delete o.userData.__orig;
    }
  });
  isolated = sub;
  if (sub) {
    const keep = new Set();
    for (const obj of sub.objs) obj.traverse((o) => keep.add(o));
    world.root.traverse((o) => {
      if (o.isMesh && !o.isInstancedMesh && !keep.has(o)) {
        o.userData.__orig = o.material;
        o.material = GHOST;
      }
    });
  }
  for (const b of consoleEl.querySelectorAll('[data-sub]')) b.setAttribute('aria-pressed', String(b.dataset.sub === sub?.id));
}
function renderConsole() {
  const F = world?.fight;
  consoleEl.hidden = !F || !!THUMB;
  if (!F) return;
  const b = current.biome;
  consoleEl.innerHTML = `
    <div class="c-head"><span class="c-tag">${String(b.layer).padStart(2, '0')}</span><div><div class="c-eyebrow">Prince · ${b.sin} · rig ${F.version || 'v0'}</div><h2>${b.prince.name}</h2></div></div>
    <div class="c-phase"><div class="c-bar"><i id="c-bar"></i><span style="left:50%"></span></div><div class="c-pname" id="c-pname"></div></div>
    <dl class="c-read" id="c-read"></dl>
    <div class="c-eyebrow">Subsystems · click to isolate</div>
    <ol class="c-subs">${(F.subsystems || []).map((s, i) => `<li><button type="button" data-sub="${s.id}" aria-pressed="false"><span class="c-n">${String(i + 1).padStart(2, '0')}</span><span class="c-sn">${s.name}<small>${s.note}</small></span><span class="c-st" id="c-st-${s.id}"></span></button></li>`).join('')}</ol>`;
}
consoleEl.addEventListener('click', (e) => {
  const b = e.target.closest('[data-sub]');
  if (!b || !world?.fight) return;
  const sub = world.fight.subsystems.find((s) => s.id === b.dataset.sub);
  isolate(isolated?.id === sub.id ? null : sub);
});
let consoleTick = 0;
function updateConsole() {
  const F = world?.fight;
  if (!F || consoleEl.hidden || ++consoleTick % 6) return;
  document.getElementById('c-bar').style.width = `${(world.f / 2) * 100}%`;
  document.getElementById('c-pname').textContent = `Phase ${world.f < 1 ? 1 : 2} · ${F.phases[world.f < 1 ? 0 : 1]}`;
  const rows = [['FIGHT', `${world.f.toFixed(2)} / 2`], ...(F.readout ? F.readout() : [])];
  document.getElementById('c-read').innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
  for (const s of F.subsystems || []) {
    const el = document.getElementById(`c-st-${s.id}`);
    if (el) el.textContent = s.state();
  }
}

// ------------------------------------------------------------ placement by scale
const FLIERS = new Set(['skull', 'puffer', 'shooter', 'diver', 'floater', 'censer', 'worm', 'gilded']);
const NEED = {S: 1, M: 2, L: 3.5, 'S to L': 2, Prince: 0};
const needOf = (c) => NEED[c.size] ?? 2;
/** How far the floor around p stays level (within 0.6 m), out to 6 m. */
function clearanceAt(p) {
  let best = 0;
  for (const r of [1, 2, 3.5, 5, 6.5]) {
    let ok = 0;
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      const y = groundY(p.x + Math.cos(a) * r, p.z + Math.sin(a) * r, p.y + 3);
      if (y != null && Math.abs(y - p.y) < 0.6) ok++;
    }
    if (ok >= 10) best = r;
    else break;
  }
  return best;
}
const RING = new THREE.RingGeometry(0.92, 1, 40).rotateX(-Math.PI / 2);
function footprints() {
  if (!world) return;
  for (const a of world.actors) {
    if (!a.need) continue;
    if (!a.ring) {
      a.ring = new THREE.Mesh(RING, new THREE.MeshBasicMaterial({color: a.flies || a.clear >= a.need ? '#46c27f' : '#e5493b', transparent: true, opacity: 0.85, depthWrite: false}));
      a.ring.scale.setScalar(a.need);
      world.root.add(a.ring);
    }
    a.ring.visible = S.footprints;
    const p = a.g.position.lengthSq() > 0 ? a.g.position : a.home;
    a.ring.position.set(p.x, (groundY(p.x, p.z, p.y + 2) ?? p.y) + 0.05, p.z);
  }
}

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
  isolated = null;
  renderConsole();
  info.innerHTML = infoFor(current);
}

function openProto(p) {
  clearWorld();
  consoleEl.hidden = true;
  current = p;
  canvas.hidden = true;
  stageEl.hidden = true;
  hud.hidden = true;
  iframe.hidden = false;
  if (!iframe.src.endsWith(p.page)) iframe.src = p.page;
  info.innerHTML = `<div class="info-eyebrow">Live prototype</div><h1>${p.name}</h1><p>${p.note}. It runs in its own page: use its panel.</p>`;
}

function route() {
  const raw = decodeURIComponent(location.hash.slice(1)) || 'altar';
  const parsed = byId[raw] ? {id: raw, v: null, tier: null} : parseId(raw);
  const c = byId[parsed.id] || byId.altar;
  SEL = {v: parsed.v, tier: parsed.tier};
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
  if (world.waves && world.playing) {
    world.wt += DT;
    while (world.next < world.waves.length && world.waves[world.next].t <= world.wt) {
      const w = world.waves[world.next];
      w.spawn.forEach(([id, n, tier], k) => {
        for (let j = 0; j < n; j++) {
          if (world.actors.length >= 40) break;
          const card = byId[id];
          const at = world.portals[(world.next * 3 + k + j) % world.portals.length];
          world.actors.push(makeActor(card, world.actorsGroup, at.clone(), world.centre, {tier}));
          world.shots.pool(at.clone(), 2.2, '#c0281c', 1.2); // the portal flash
        }
      });
      world.next++;
    }
  }
  if (world.fight) {
    // the fight clock: in Phases it starts at the prince wave; Auto (or Hunt) plays phase one then two over 70 s
    // and loops; otherwise the slider
    const id = current.biome.id;
    if (world.waves) {
      const tp = world.waves.find((w) => w.prince)?.t ?? 0;
      world.f = world.wt < tp ? 0 : Math.min(1.999, ((world.wt - tp) / PRINCE_FIGHT_SECONDS) * 2);
    } else if (S.auto || S.hunt) world.f = (world.f + DT / 35) % 2;
    else world.f = S.phase[id] ?? 0;
    world.fight.update(ctx, world.f);
    const out = document.getElementById('st-phase-o');
    if (out) out.textContent = world.fight.phases[world.f < 1 ? 0 : 1];
    const sl = document.getElementById('st-phase');
    if (sl && (S.auto || S.hunt) && document.activeElement !== sl) sl.value = world.f.toFixed(2);
  }
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
    // Phases mode plays the clock at 0.5x to 4x: every creature, shot and the fight run faster together
    const rate = world?.waves ? S.waveSpeed : 1;
    acc = Math.min(acc + ((now - last) / 1000) * rate, 0.25 * rate);
    last = now;
    if (world && !canvas.hidden) {
      while (acc >= DT) {
        tick();
        acc -= DT;
      }
      controls.update();
      renderer.render(scene, camera);
      drawLabels();
      updateConsole();
      footprints();
      hud.hidden = !player.S.on;
      if (player.S.on) hud.textContent = `HITS TAKEN ${player.S.hits}`;
      if (world.waves) {
        const el = document.getElementById('st-wave');
        const w = world.waves[Math.max(0, world.next - 1)];
        const nx = world.waves[world.next];
        if (el) el.textContent = `${world.wt.toFixed(1)} s · ${world.next ? w.name : 'waiting'}${nx ? ` · next: ${nx.name} in ${(nx.t - world.wt).toFixed(0)} s` : ''} · ${world.actors.length} alive`;
        for (const b of stageEl.querySelectorAll('[data-wave]')) b.classList.toggle('done', Number(b.dataset.wave) < world.next);
      }
    } else acc = 0;
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
