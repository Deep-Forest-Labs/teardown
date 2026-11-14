// THE CHOPPING BLOCK, live page: a 50 m disc; censers drift in from the rim and release a burst every 20 s; Ash Motes,
// Hounds and Wardens on the loiter rule and Strays on their waypoints (swarm.js); shards to shoot them. A drawer of the
// roster on the left (roster.js) with each enemy's data and a spawn button; controls on the right. Two views: first
// person (click to look, WASD, Space, hold to fire) and top-down with trails, the view of the reference captures. Bot
// players: stand, run a circle, or the expert (circle-strafes, reverses when a charger is ahead, shoots spawners first).
import * as THREE from 'three';
import {burst, M, newMote, newStray, newWyrm, rnd, step, stepWyrm, TAU} from './swarm.js';
import {createTrail} from '../bonepede2-shared/trail.js';
import {CFG as WCFG, pose} from '../bonepede2-shared/wyrm.js';
import {createBody} from '../bonepede2-shared/body.js';
import {ALL, ROSTER} from './roster.js';
import {materials} from '../slumber-kit/studio.js';

const DT = 1 / 120;
const PLAYER = {run: 12, jump: 6.5, g: 18, eye: 1.7};
const SHARD = {speed: 120, life: 0.34, rate: 15, spread: (2.5 * Math.PI) / 180}; // about 40 m of reach
const TRAIL = 90; // samples per agent (every 2 steps → 1.5 s)
const HP = {mote: 1, stray: 5, hound: 10, warden: 100};
const WS = 4; // the Spinewyrm is BONEPEDE II's body at 4× (about 31 m)
const WHP = 3; // per belly orb
// how each kind is drawn: body radius, stretch along its heading, material, eye size, instance cap
const LOOK = {
  mote: {r: 0.42, len: 1, mat: 'bone', eye: 0.12, max: 500},
  stray: {r: 0.8, len: 1.1, mat: 'fleshDeep', eye: 0.2, max: 40},
  hound: {r: 0.55, len: 1.9, mat: 'accent', eye: 0.14, max: 40},
  warden: {r: 1.7, len: 1.3, mat: 'steel', eye: 0.35, max: 20},
};

export function runLive() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <canvas id="cv" tabindex="0"></canvas>
    <nav class="cb-drawer" id="drawer" aria-label="Chopping Block roster"></nav>
    <section class="cb-info" id="info" aria-live="polite"></section>
    <aside class="cb-panel" id="panel"></aside>
    <div class="cb-hud" id="hud"></div>
    <div class="cb-cross" id="cross"></div>`;
  const css = document.createElement('style');
  css.textContent = `
    html, body { margin: 0; height: 100%; overflow: hidden; background: #15141b; font: 13px/1.45 Inter, system-ui, sans-serif; color: #ebe5dc }
    #app { position: fixed; inset: 0 }
    #cv { position: absolute; inset: 0; width: 100%; height: 100%; display: block; outline: none }
    .cb-drawer, .cb-panel, .cb-info { position: absolute; background: rgba(29,27,36,.94); border: 1px solid #34303d; border-radius: 6px }
    .cb-drawer { left: 12px; top: 12px; bottom: 12px; width: 250px; overflow: auto; padding: 8px 10px; display: grid; gap: 2px; align-content: start }
    .cb-drawer h2, .cb-panel h2 { margin: 8px 0 4px; font: 600 10.5px/1 'JetBrains Mono', monospace; letter-spacing: .1em; text-transform: uppercase; color: #a39cac }
    .cb-card { display: grid; grid-template-columns: 1fr auto; gap: 0 8px; text-align: left; background: none; border: 1px solid transparent; border-radius: 5px; padding: 6px 8px; color: #ebe5dc; cursor: pointer; font: inherit }
    .cb-card:hover { background: #26232f }
    .cb-card[aria-current="true"] { background: #26232f; border-color: #e0b43a }
    .cb-card b { font-weight: 600 }
    .cb-card small { grid-column: 1; color: #a39cac; font-size: 11.5px }
    .cb-chip { grid-row: 1 / span 2; grid-column: 2; align-self: center; font: 600 9.5px 'JetBrains Mono', monospace; letter-spacing: .08em; text-transform: uppercase; padding: 3px 5px; border-radius: 3px; border: 1px solid currentColor }
    .cb-chip.lab { color: #e0b43a } .cb-chip.planned { color: #a39cac }
    .cb-info { left: 274px; bottom: 12px; width: min(420px, calc(100% - 600px)); max-height: 46%; overflow: auto; padding: 12px 14px }
    .cb-info h1 { margin: 0 0 4px; font: 700 22px/1.1 Inter, sans-serif; display: flex; gap: 10px; align-items: center }
    .cb-info .cb-role { font: 600 10.5px 'JetBrains Mono', monospace; letter-spacing: .08em; text-transform: uppercase; color: #a39cac }
    .cb-info p { margin: 6px 0 }
    .cb-info dl { display: grid; grid-template-columns: 7em 1fr; gap: 2px 10px; margin: 6px 0; font-size: 12.5px }
    .cb-info dt { color: #a39cac; font: 600 10.5px/1.9 'JetBrains Mono', monospace; text-transform: uppercase; letter-spacing: .06em }
    .cb-info dd { margin: 0 }
    .cb-panel { right: 12px; top: 12px; width: min(290px, calc(100% - 24px)); max-height: calc(100% - 24px); overflow: auto; padding: 10px 12px; display: grid; gap: 6px }
    .cb-panel h1 { margin: 0; font: 700 20px/1.1 Inter, sans-serif }
    .cb-panel p { margin: 0; color: #a39cac; font-size: 12px }
    .cb-nav { display: flex; gap: 4px; flex-wrap: wrap }
    .cb-nav a { font: 600 10.5px 'JetBrains Mono', monospace; letter-spacing: .06em; text-transform: uppercase; color: #a39cac; text-decoration: none; padding: 5px 7px; border-radius: 4px; border: 1px solid transparent }
    .cb-nav a[aria-current="page"] { color: #ebe5dc; border-color: #34303d; background: #26232f }
    .cb-seg { display: flex; gap: 4px; flex-wrap: wrap }
    .cb-seg button, .cb-btn { flex: 1; font: 600 11px 'JetBrains Mono', monospace; letter-spacing: .04em; text-transform: uppercase; color: #ebe5dc; background: #26232f; border: 1px solid #34303d; border-radius: 4px; padding: 6px 8px; cursor: pointer; white-space: nowrap }
    .cb-seg button[aria-pressed="true"] { background: #e0b43a; color: #15141b; border-color: #e0b43a }
    .cb-btn.go { background: #e0b43a; color: #15141b; border-color: #e0b43a; flex: 0 0 auto }
    .cb-row { display: grid; grid-template-columns: 7em 1fr 3.2em; gap: 8px; align-items: center; color: #a39cac; font-size: 12px }
    .cb-row input { width: 100% }
    .cb-row output { font: 600 11px 'JetBrains Mono', monospace; color: #ebe5dc; text-align: right }
    .cb-stats { display: grid; grid-template-columns: 1fr auto; gap: 2px 8px; font: 500 11.5px 'JetBrains Mono', monospace }
    .cb-stats span:nth-child(odd) { color: #a39cac }
    .cb-hud { position: absolute; left: 50%; top: 12px; transform: translateX(-50%); font: 600 12px 'JetBrains Mono', monospace; letter-spacing: .06em; background: rgba(21,20,27,.8); border: 1px solid #34303d; border-radius: 4px; padding: 6px 10px; white-space: nowrap }
    .cb-cross { position: absolute; left: 50%; top: 50%; width: 10px; height: 10px; margin: -5px 0 0 -5px; border: 2px solid rgba(255,255,255,.8); border-radius: 50%; pointer-events: none }
    @media (max-width: 900px) { .cb-drawer { display: none } .cb-info { left: 12px; width: calc(100% - 24px); max-height: 30% } .cb-panel { max-height: 50% } .cb-hud { display: none } }`;
  document.head.appendChild(css);

  // ---------------------------------------------------------------- scene
  const canvas = document.getElementById('cv');
  const renderer = new THREE.WebGLRenderer({canvas, antialias: true});
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#2a2630');
  const fog = new THREE.Fog('#2a2630', 70, 160);
  scene.add(new THREE.HemisphereLight('#fff3e2', '#3a3036', 1.2));
  const sun = new THREE.DirectionalLight('#ffe9d2', 2.2);
  sun.position.set(30, 60, 20);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, {left: -60, right: 60, top: 60, bottom: -60, near: 1, far: 200});
  scene.add(sun);
  const mat = materials();
  mat.disc = new THREE.MeshStandardMaterial({color: '#bdb2a4', roughness: 0.9});
  mat.band = new THREE.MeshStandardMaterial({color: '#a99d8f', roughness: 0.9});
  mat.eye = new THREE.MeshBasicMaterial({color: '#ff3b1f'});
  mat.shard = new THREE.MeshBasicMaterial({color: '#ffd6a0'});
  scene.add(Object.assign(new THREE.Mesh(new THREE.CylinderGeometry(M.arenaR, M.arenaR, 2, 96).translate(0, -1, 0), mat.disc), {receiveShadow: true}));
  for (const r of [12, 24, 36, 48]) scene.add(new THREE.Mesh(new THREE.RingGeometry(r - 0.15, r + 0.15, 96).rotateX(-Math.PI / 2).translate(0, 0.01, 0), mat.band));
  const meshes = {};
  for (const [kind, L] of Object.entries(LOOK)) {
    const body = new THREE.InstancedMesh(new THREE.SphereGeometry(L.r, 14, 10).scale(L.len, 1, 1), mat[L.mat], L.max);
    const eye = new THREE.InstancedMesh(new THREE.SphereGeometry(L.eye, 6, 4), mat.eye, L.max * 2);
    body.castShadow = true;
    body.frustumCulled = eye.frustumCulled = false; // instances spread far from the mesh origin
    scene.add(body, eye);
    meshes[kind] = {body, eye, L};
  }
  const MAXSH = 200;
  const shardMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.05, 0.05, 1.6, 5).rotateX(Math.PI / 2), mat.shard, MAXSH);
  shardMesh.frustumCulled = false;
  scene.add(shardMesh);
  const NTR = 700;
  const trailGeo = new THREE.BufferGeometry();
  const trailPos = new Float32Array(NTR * TRAIL * 3);
  const trailCol = new Float32Array(NTR * TRAIL * 3);
  trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPos, 3));
  trailGeo.setAttribute('color', new THREE.BufferAttribute(trailCol, 3));
  const trails = new THREE.Points(trailGeo, new THREE.PointsMaterial({size: 2.2, sizeAttenuation: false, vertexColors: true}));
  trails.frustumCulled = false;
  scene.add(trails);
  const marker = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.3, 20), new THREE.MeshBasicMaterial({color: '#ffffff'}));
  scene.add(marker);
  const censerGeo = new THREE.LatheGeometry([[0, -1.6], [1.2, -1.2], [1.9, 0], [1.4, 1.2], [0.5, 1.8], [0, 1.9]].map(([r, y]) => new THREE.Vector2(r, y)), 20);

  // ---------------------------------------------------------------- state
  const S = {view: 'top', bot: 'expert', model: 'field', waves: true, t: 0, kills: 0, hits: 0, closest: Infinity, sel: 'mote', nextWave: 1, wave: 0};
  const player = {p: [0, 0, 0], vy: 0, yaw: 0, pitch: 0, onGround: true, fire: false, cool: 0, dir: 1, flipAt: 9, aim: null};
  let agents = [];
  let shards = [];
  let censers = [];
  let wyrms = [];
  let nid = 1;
  const keys = new Set();
  const hist = new Map();

  function addCenser(type = 'censer', ang = rnd(nid * 3) * TAU) {
    const C = M.censers[type];
    const g = new THREE.Group();
    g.scale.setScalar(C.size);
    const body = new THREE.Mesh(censerGeo, type === 'great' ? mat.fleshDeep : mat.flesh);
    body.castShadow = true;
    g.add(body);
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * TAU;
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.06, 3.2, 6).translate(0, -1.6, 0), mat.fleshDeep);
      arm.position.set(Math.cos(a) * 1.3, -1.3, Math.sin(a) * 1.3);
      arm.rotation.z = Math.cos(a) * 0.3;
      arm.rotation.x = -Math.sin(a) * 0.3;
      g.add(arm);
    }
    scene.add(g);
    const r = M.arenaR * 0.95;
    censers.push({type, g, p: [r * Math.cos(ang), M.censer.height * C.size, r * Math.sin(ang)], nextBurst: S.t + M.censer.first, queue: [], hp: C.hp, seed: nid++, r: 2.2 * C.size});
  }
  function release(c) {
    for (const [dt, kind] of burst(c.seed * 7 + Math.floor(S.t), c.type)) c.queue.push([S.t + dt, kind]);
  }
  function spawnAgent(kind, at) {
    const a = kind === 'stray' ? newStray(nid++, at, S.t) : newMote(nid++, at, [player.p[0], player.p[2]], S.t, kind);
    a.hp = HP[kind];
    agents.push(a);
  }
  function addWyrm() {
    const ang = rnd(nid * 9) * TAU;
    const at = [30 * Math.cos(ang), 0, 30 * Math.sin(ang)];
    const w = newWyrm(nid++, at, S.t);
    const wrap = new THREE.Group();
    wrap.scale.setScalar(WS);
    scene.add(wrap);
    const body = createBody(wrap);
    const trail = createTrail({minStep: 0.015});
    for (let y = -20; y <= w.head[1]; y += 0.05) trail.push([at[0] / WS, y / WS, at[2] / WS]);
    wyrms.push({w, wrap, body, trail, hp: Array(WCFG.N).fill(WHP), hitT: Array(WCFG.N).fill(-9), deadT: Array(WCFG.N).fill(null), phase: 0, P: null});
  }
  function spawnById(id) {
    if (id === 'spinewyrm') return addWyrm();
    if (M.censers[id]) return addCenser(id);
    if (!HP[id]) return;
    const ang = rnd(nid * 7) * TAU;
    spawnAgent(id, [M.arenaR * 0.85 * Math.cos(ang), 6, M.arenaR * 0.85 * Math.sin(ang)]);
  }
  function clearAll() {
    for (const c of censers) scene.remove(c.g);
    for (const y of wyrms) scene.remove(y.wrap);
    wyrms = [];
    censers = [];
    agents = [];
    shards = [];
    hist.clear();
    S.wave = 0;
    S.nextWave = S.t + 1;
  }

  // ---------------------------------------------------------------- drawer and info
  const drawer = document.getElementById('drawer');
  drawer.innerHTML = ROSTER.map((g) => `<h2>${g.group}</h2>${g.items.map((e) => `
    <button class="cb-card" data-id="${e.id}" aria-current="${e.id === S.sel}"><b>${e.name}</b><span class="cb-chip ${e.status}">${e.status === 'lab' ? 'In lab' : 'Planned'}</span><small>${e.role}</small></button>`).join('')}`).join('');
  const info = document.getElementById('info');
  function showInfo() {
    const e = ALL.find((x) => x.id === S.sel);
    info.innerHTML = `
      <div class="cb-role">${e.role}</div>
      <h1>${e.name} ${e.status === 'lab' ? `<button class="cb-btn go" id="b-spawn">Spawn</button>` : '<span class="cb-chip planned" style="grid-row:auto">Planned</span>'}</h1>
      <p>${e.does}</p>
      <dl><dt>Health</dt><dd>${e.hp}</dd><dt>Orbs</dt><dd>${e.orbs}</dd>${e.data.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}<dt>Counter</dt><dd>${e.counter}</dd></dl>`;
    const b = document.getElementById('b-spawn');
    if (b) b.onclick = () => spawnById(e.id);
    for (const c of drawer.querySelectorAll('.cb-card')) c.setAttribute('aria-current', c.dataset.id === S.sel ? 'true' : 'false');
  }
  drawer.addEventListener('click', (ev) => {
    const c = ev.target.closest('.cb-card');
    if (!c) return;
    S.sel = c.dataset.id;
    showInfo();
  });
  showInfo();

  // ---------------------------------------------------------------- panel
  const panel = document.getElementById('panel');
  const seg = (name, opts) => `<div class="cb-seg" data-seg="${name}">${opts.map(([v, l]) => `<button data-v="${v}" aria-pressed="${String(S[name]) === v}">${l}</button>`).join('')}</div>`;
  const slider = (id, label, min, max, st, val) => `<label class="cb-row">${label}<input id="${id}" type="range" min="${min}" max="${max}" step="${st}" value="${val}"><output id="${id}-o">${val}</output></label>`;
  panel.innerHTML = `
    <nav class="cb-nav"><a href="index.html">Prototypes</a><a href="studies.html">Studies</a><a href="cb-live.html" aria-current="page">Chopping Block</a></nav>
    <h1>The Chopping Block</h1>
    <p>Movement lab for the base swarm. Every chaser follows one rule with its own numbers: constant speed, capped turn, a loiter field round the player. Nothing scripts the circle or the charge. Pick an enemy on the left for its data.</p>
    <h2>View</h2>${seg('view', [['fp', 'First person'], ['top', 'Top down']])}
    <h2>Player</h2>${seg('bot', [['expert', 'Expert bot'], ['you', 'You'], ['stand', 'Stand'], ['circle', 'Circle']])}
    <h2>Spawning</h2>${seg('waves', [['true', 'Waves on'], ['false', 'Waves off']])}
    <div class="cb-seg"><button class="cb-btn" id="b-burst">Burst now</button><button class="cb-btn" id="b-clear">Clear</button></div>
    <h2>Ash Mote rule</h2>${seg('model', [['field', 'Loiter field'], ['pursuit', 'Plain pursuit']])}
    ${slider('sv', 'Speed m/s', 14, 32, 0.5, 23)}
    ${slider('st', 'Turn °/s', 60, 240, 5, Math.round((M.mote.turn * 180) / Math.PI))}
    ${slider('sr', 'Ring m', 6, 20, 0.5, 11.5)}
    <h2>Now</h2><div class="cb-stats" id="stats"></div>
    <p>First person: click the view to look, WASD, Space to jump, hold to fire, Esc frees the mouse. Top down: WASD moves you; holding the mouse fires at the nearest enemy. The expert bot circle-strafes, turns back when a charger is ahead, and shoots censers first, then chargers, then the closest motes.</p>`;
  panel.addEventListener('click', (e) => {
    const b = e.target.closest('[data-seg] button');
    if (!b) return;
    const name = b.parentElement.dataset.seg;
    S[name] = name === 'waves' ? b.dataset.v === 'true' : b.dataset.v;
    for (const x of b.parentElement.children) x.setAttribute('aria-pressed', x === b ? 'true' : 'false');
    if (name === 'view' && S.view === 'top' && document.pointerLockElement) document.exitPointerLock();
  });
  const tune = {v: 23, turn: M.mote.turn, ring: 11.5};
  for (const [id, k, f] of [['sv', 'v', (x) => x], ['st', 'turn', (x) => (x * Math.PI) / 180], ['sr', 'ring', (x) => x]]) {
    const el = document.getElementById(id);
    el.addEventListener('input', () => {
      tune[k] = f(+el.value);
      document.getElementById(`${id}-o`).textContent = el.value;
    });
  }
  document.getElementById('b-burst').onclick = () => {
    if (!censers.length) addCenser();
    release(censers[censers.length - 1]);
  };
  document.getElementById('b-clear').onclick = clearAll;

  // ---------------------------------------------------------------- input
  canvas.addEventListener('click', () => {
    if (S.view === 'fp' && S.bot === 'you' && document.pointerLockElement !== canvas) canvas.requestPointerLock();
  });
  addEventListener('mousemove', (e) => {
    if (document.pointerLockElement !== canvas) return;
    player.yaw -= e.movementX * 0.0022;
    player.pitch = Math.max(-1.45, Math.min(1.45, player.pitch - e.movementY * 0.0022));
  });
  canvas.addEventListener('mousedown', () => (player.fire = true));
  addEventListener('mouseup', () => (player.fire = false));
  addEventListener('keydown', (e) => {
    keys.add(e.code);
    if (e.code === 'Space') e.preventDefault();
  });
  addEventListener('keyup', (e) => keys.delete(e.code));

  // ---------------------------------------------------------------- the expert bot
  // Moves: circle-strafes round the arena centre at about 18 m, breathing in and out; turns back when a charger is ahead
  // on its line or every 8-12 s. Shoots: censers first (they make more), then chargers inside 25 m, then the nearest
  // mote inside 22 m; leads the target by the shard's flight time; the aim turns at a capped rate, like a hand.
  function threatAhead(dirx, dirz) {
    for (const a of agents) {
      if (a.kind !== 'hound' && a.kind !== 'warden') continue;
      const dx = a.p[0] - player.p[0];
      const dz = a.p[2] - player.p[2];
      const d = Math.hypot(dx, dz);
      if (d < 12 && (dx * dirx + dz * dirz) / d > 0.5) return true;
    }
    return false;
  }
  function expertMove(dt) {
    const ang = Math.atan2(player.p[2], player.p[0]);
    const r = Math.hypot(player.p[0], player.p[2]);
    const want = 18 + 5 * Math.sin(S.t * 0.37);
    const tx = -Math.sin(ang) * player.dir;
    const tz = Math.cos(ang) * player.dir;
    const radial = Math.max(-1, Math.min(1, (want - r) / 4));
    let mx = tx + Math.cos(ang) * radial;
    let mz = tz + Math.sin(ang) * radial;
    const l = Math.hypot(mx, mz) || 1;
    mx /= l;
    mz /= l;
    if (S.t > player.flipAt || threatAhead(mx, mz)) {
      player.dir *= -1;
      player.flipAt = S.t + 8 + 4 * rnd(Math.floor(S.t));
    }
    player.p[0] += mx * PLAYER.run * dt;
    player.p[2] += mz * PLAYER.run * dt;
  }
  function expertTarget() {
    const eye = [player.p[0], player.p[1] + PLAYER.eye, player.p[2]];
    const dist = (p) => Math.hypot(p[0] - eye[0], p[1] - eye[1], p[2] - eye[2]);
    let best = null;
    let bs = Infinity;
    for (const c of censers) {
      const d = dist(c.p);
      const s = d < 30 ? d * 0.4 : Infinity; // in reach only: spawners at the rim have to come in
      if (s < bs) [best, bs] = [{p: c.p, v: [0, 0, 0]}, s];
    }
    for (const a of agents) {
      const d = dist(a.p);
      const w = a.kind === 'hound' || a.kind === 'warden' ? (d < 25 ? d * 0.3 : Infinity) : a.kind === 'stray' ? (d < 15 ? d : Infinity) : d < 22 ? d * 1.2 : Infinity;
      if (w < bs) [best, bs] = [{p: a.p, v: [Math.cos(a.yaw) * a.v, 0, Math.sin(a.yaw) * a.v]}, w];
    }
    for (const y of wyrms) {
      if (!y.P || y.w.state === 'under') continue;
      y.P.segs.forEach((sg, i) => {
        if (y.deadT[i] != null) return;
        const p = sg.p.map((x) => x * WS);
        const d = dist(p);
        const sc = d < 35 ? d * 0.6 : Infinity;
        if (sc < bs) [best, bs] = [{p, v: y.w.dir.map((x) => x * 16)}, sc];
      });
    }
    if (!best) return null;
    const tf = dist(best.p) / SHARD.speed;
    return [best.p[0] + best.v[0] * tf - eye[0], best.p[1] - eye[1], best.p[2] + best.v[2] * tf - eye[2]];
  }

  // ---------------------------------------------------------------- simulation
  function playerStep(dt) {
    if (S.bot === 'stand') {
      player.p = [0, 0, 0];
      return;
    }
    if (S.bot === 'circle') {
      const a = (S.t * PLAYER.run) / 18;
      player.p = [18 * Math.cos(a), 0, 18 * Math.sin(a)];
      return;
    }
    if (S.bot === 'expert') return expertMove(dt);
    let f = 0;
    let s = 0;
    if (keys.has('KeyW')) f += 1;
    if (keys.has('KeyS')) f -= 1;
    if (keys.has('KeyD')) s += 1;
    if (keys.has('KeyA')) s -= 1;
    const yaw = S.view === 'top' ? 0 : player.yaw;
    const fx = -Math.sin(yaw);
    const fz = -Math.cos(yaw);
    const rx = Math.cos(yaw);
    const rz = -Math.sin(yaw);
    let mx = fx * f + rx * s;
    let mz = fz * f + rz * s;
    const ml = Math.hypot(mx, mz) || 1;
    mx /= ml;
    mz /= ml;
    const mv = f || s ? PLAYER.run : 0;
    player.p[0] += mx * mv * dt;
    player.p[2] += mz * mv * dt;
    if (keys.has('Space') && player.onGround) {
      player.vy = PLAYER.jump;
      player.onGround = false;
    }
    player.vy -= PLAYER.g * dt;
    player.p[1] = Math.max(0, player.p[1] + player.vy * dt);
    if (player.p[1] === 0) {
      player.vy = 0;
      player.onGround = true;
    }
  }
  function aimDir() {
    let v = null;
    if (S.bot === 'expert') v = expertTarget();
    else if (S.view === 'fp' && S.bot === 'you') {
      const cp = Math.cos(player.pitch);
      return [-Math.sin(player.yaw) * cp, Math.sin(player.pitch), -Math.cos(player.yaw) * cp];
    } else {
      let bd = Infinity;
      for (const a of agents) {
        const w = [a.p[0] - player.p[0], a.p[1] - player.p[1] - PLAYER.eye, a.p[2] - player.p[2]];
        const d = Math.hypot(...w);
        if (d < bd) [v, bd] = [w, d];
      }
    }
    if (!v) return null;
    const l = Math.hypot(...v);
    const want = v.map((x) => x / l);
    if (S.bot !== 'expert') return want;
    // the bot's hand: the aim turns toward the target at a capped rate and only fires once it is on
    const cur = player.hand || want;
    const dot = Math.max(-1, Math.min(1, cur[0] * want[0] + cur[1] * want[1] + cur[2] * want[2]));
    const ang = Math.acos(dot);
    const maxA = 7 / SHARD.rate; // about 7 rad/s between shots
    const u = ang > maxA ? maxA / ang : 1;
    const mix = cur.map((x, i) => x + (want[i] - x) * u);
    const ml = Math.hypot(...mix) || 1;
    player.hand = mix.map((x) => x / ml);
    return ang < 0.15 ? player.hand : (player.cool = 1 / SHARD.rate, null);
  }
  function waves() {
    if (!S.waves || S.t < S.nextWave) return;
    S.wave++;
    // our own schedule for the lab (not the reference's): a Censer every wave, a Twin every 3rd, a Great every 6th
    addCenser(S.wave % 6 === 0 ? 'great' : S.wave % 3 === 0 ? 'twin' : 'censer');
    if (S.wave % 4 === 0) addWyrm();
    S.nextWave = S.t + (S.wave < 3 ? 10 : 20);
  }
  function sim(dt) {
    S.t += dt;
    waves();
    playerStep(dt);
    const r0 = Math.hypot(player.p[0], player.p[2]);
    if (r0 > M.arenaR - 1) {
      player.p[0] *= (M.arenaR - 1) / r0;
      player.p[2] *= (M.arenaR - 1) / r0;
    }
    const pl = [player.p[0], player.p[1], player.p[2]];
    for (const c of censers) {
      const r = Math.hypot(c.p[0], c.p[2]);
      if (r > 4) {
        c.p[0] -= (c.p[0] / r) * M.censer.drift * dt;
        c.p[2] -= (c.p[2] / r) * M.censer.drift * dt;
      }
      c.g.position.set(c.p[0], c.p[1] + 0.4 * Math.sin(S.t * 1.3 + c.seed), c.p[2]);
      c.g.rotation.y += M.censer.spin * dt;
      if (S.t >= c.nextBurst) {
        release(c);
        c.nextBurst += M.censer.every;
      }
      c.queue = c.queue.filter(([at, kind]) => {
        if (S.t < at) return true;
        spawnAgent(kind, [c.p[0], c.p[1] + 2 * c.g.scale.x, c.p[2]]);
        return false;
      });
    }
    // the Spinewyrm: the head moves, the body rides its trail (local units are world / WS)
    for (const y of wyrms) {
      stepWyrm(y.w, [pl[0], pl[1] + PLAYER.eye, pl[2]], S.t, dt);
      y.trail.push(y.w.head.map((x) => x / WS));
      y.phase += 9 * dt;
      y.P = pose(y.trail, y.trail.length, y.phase);
      if (y.w.state !== 'under' && S.t - (y.lastHit ?? -9) > 1 && Math.hypot(y.w.head[0] - pl[0], y.w.head[1] - pl[1] - 1, y.w.head[2] - pl[2]) < 2) {
        S.hits++; // one hit per contact, not one per frame
        y.lastHit = S.t;
      }
    }
    M.mote.turn = tune.turn;
    let closest = Infinity;
    for (const a of agents) {
      if (a.kind === 'mote') {
        a.v = tune.v * (a.vj ?? (a.vj = 0.92 + 0.16 * rnd(a.id * 3)));
        a.R = S.model === 'pursuit' ? 0.001 : tune.ring * (a.rj ?? (a.rj = 0.9 + 0.2 * rnd(a.id * 5)));
      }
      step(a, pl, S.t, dt);
      const d = Math.hypot(a.p[0] - pl[0], a.p[1] - pl[1] - 1, a.p[2] - pl[2]);
      closest = Math.min(closest, d);
      if (d < LOOK[a.kind].r + 0.5) {
        S.hits++;
        a.alive = false;
      }
    }
    S.closest = closest;
    player.cool -= dt;
    const firing = S.bot === 'expert' || player.fire;
    if (firing && player.cool <= 0) {
      const dir = aimDir();
      player.aim = dir;
      if (dir) {
        player.cool = 1 / SHARD.rate;
        const j = (k) => (rnd(nid * 11 + k + S.t * 1000) - 0.5) * SHARD.spread;
        shards.push({p: [pl[0], pl[1] + PLAYER.eye - 0.2, pl[2]], d: [dir[0] + j(1), dir[1] + j(2), dir[2] + j(3)], t: S.t});
      }
    }
    for (const s of shards) {
      for (let k = 0; k < 3; k++) s.p[k] += s.d[k] * SHARD.speed * dt;
      for (const a of agents) {
        if (!a.alive) continue;
        if (Math.hypot(a.p[0] - s.p[0], a.p[1] - s.p[1], a.p[2] - s.p[2]) < LOOK[a.kind].r * LOOK[a.kind].len + 0.2) {
          s.dead = true;
          if (--a.hp <= 0) {
            a.alive = false;
            S.kills++;
          }
          break;
        }
      }
      if (s.dead) continue;
      for (const y of wyrms) {
        if (!y.P || y.w.state === 'under') continue;
        for (let i = 0; i < y.P.segs.length && !s.dead; i++) {
          if (y.deadT[i] != null) continue;
          const q = y.P.segs[i].p;
          if (Math.hypot(q[0] * WS - s.p[0], q[1] * WS - s.p[1], q[2] * WS - s.p[2]) < 0.4 * WS * y.P.segs[i].w) {
            s.dead = true;
            y.hitT[i] = S.t;
            if (--y.hp[i] <= 0) y.deadT[i] = S.t;
          }
        }
      }
      if (s.dead) continue;
      for (const c of censers) {
        if (Math.hypot(c.p[0] - s.p[0], c.p[1] - s.p[1], c.p[2] - s.p[2]) < c.r) {
          c.hp--;
          s.dead = true;
          break;
        }
      }
    }
    shards = shards.filter((s) => !s.dead && S.t - s.t < SHARD.life);
    for (const c of censers) {
      if (c.hp <= 0) {
        scene.remove(c.g);
        S.kills++;
      }
    }
    censers = censers.filter((c) => c.hp > 0);
    for (const y of wyrms) {
      if (y.deadT.slice(0, WCFG.N - 1).every((d) => d != null)) {
        scene.remove(y.wrap);
        y.gone = true;
        S.kills++;
      }
    }
    wyrms = wyrms.filter((y) => !y.gone);
    agents = agents.filter((a) => a.alive && Math.hypot(a.p[0], a.p[2]) < M.arenaR * 2.5);
  }

  // ---------------------------------------------------------------- draw
  const persp = new THREE.PerspectiveCamera(80, 1, 0.05, 400);
  const ortho = new THREE.OrthographicCamera(-60, 60, 60, -60, 1, 400);
  ortho.position.set(0, 200, 0);
  ortho.up.set(0, 0, -1);
  ortho.lookAt(0, 0, 0);
  const M4 = new THREE.Matrix4();
  const Q = new THREE.Quaternion();
  const UPV = new THREE.Vector3(0, 1, 0);
  const ONE = new THREE.Vector3(1, 1, 1);
  const tmp = new THREE.Vector3();
  let frame = 0;
  function draw() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    persp.aspect = w / h;
    persp.updateProjectionMatrix();
    const a = w / h;
    Object.assign(ortho, a > 1 ? {left: -58 * a, right: 58 * a, top: 58, bottom: -58} : {left: -58, right: 58, top: 58 / a, bottom: -58 / a});
    ortho.updateProjectionMatrix();
    const n = {mote: 0, stray: 0, hound: 0, warden: 0};
    for (const ag of agents) {
      const G = meshes[ag.kind];
      const i = n[ag.kind]++;
      if (i >= G.L.max) continue;
      Q.setFromAxisAngle(UPV, -ag.yaw);
      M4.compose(tmp.set(...ag.p), Q, ONE);
      G.body.setMatrixAt(i, M4);
      for (const sd of [-1, 1]) {
        const e = new THREE.Vector3(G.L.r * G.L.len * 0.85, G.L.r * 0.25, sd * G.L.r * 0.35).applyQuaternion(Q).add(tmp);
        G.eye.setMatrixAt(i * 2 + (sd > 0 ? 1 : 0), new THREE.Matrix4().makeTranslation(e.x, e.y, e.z));
      }
    }
    for (const [kind, G] of Object.entries(meshes)) {
      G.body.count = Math.min(n[kind], G.L.max);
      G.eye.count = G.body.count * 2;
      G.body.instanceMatrix.needsUpdate = G.eye.instanceMatrix.needsUpdate = true;
    }
    shardMesh.count = Math.min(shards.length, MAXSH);
    shards.slice(0, MAXSH).forEach((s, i) => {
      Q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(...s.d).normalize());
      shardMesh.setMatrixAt(i, M4.compose(tmp.set(...s.p), Q, ONE));
    });
    shardMesh.instanceMatrix.needsUpdate = true;
    trails.visible = S.view === 'top';
    if (trails.visible) {
      if (frame % 2 === 0) {
        for (const ag of agents) {
          if (!hist.has(ag.id)) hist.set(ag.id, []);
          const hh = hist.get(ag.id);
          hh.push([ag.p[0], 0.05, ag.p[2]]);
          if (hh.length > TRAIL) hh.shift();
        }
        const live = new Set(agents.map((x) => x.id));
        for (const id of [...hist.keys()]) if (!live.has(id)) hist.delete(id);
      }
      let o = 0;
      for (const hh of hist.values()) {
        for (let k = 0; k < hh.length && o < trailPos.length; k++) {
          const u = k / TRAIL;
          trailPos.set(hh[k], o);
          trailCol.set([0.24 + 0.76 * u, 0.47 + 0.4 * u, 1 - 0.9 * u], o);
          o += 3;
        }
      }
      trailGeo.setDrawRange(0, o / 3);
      trailGeo.attributes.position.needsUpdate = trailGeo.attributes.color.needsUpdate = true;
    }
    marker.visible = S.view === 'top';
    marker.position.set(player.p[0], 0.2, player.p[2]);
    document.getElementById('cross').style.display = S.view === 'fp' ? 'block' : 'none';
    let cam = ortho;
    if (S.view === 'fp') {
      cam = persp;
      persp.position.set(player.p[0], player.p[1] + PLAYER.eye, player.p[2]);
      if (S.bot !== 'you') {
        // bots look where they shoot (or at the swarm's middle); the view turns at a capped rate
        let d = player.aim;
        if (!d) {
          const ms = agents.length ? agents : [{p: [0, 2, -1]}];
          const c = ms.reduce((s, x) => [s[0] + x.p[0] / ms.length, s[1] + x.p[1] / ms.length, s[2] + x.p[2] / ms.length], [0, 0, 0]);
          d = [c[0] - player.p[0], c[1] - player.p[1] - PLAYER.eye, c[2] - player.p[2]];
        }
        const wantYaw = Math.atan2(-d[0], -d[2]);
        const wantPitch = Math.atan2(d[1], Math.hypot(d[0], d[2]));
        const dy = ((wantYaw - player.yaw + Math.PI * 3) % TAU) - Math.PI;
        player.yaw += Math.max(-0.12, Math.min(0.12, dy));
        player.pitch += Math.max(-0.08, Math.min(0.08, wantPitch - player.pitch));
      }
      persp.rotation.set(player.pitch, player.yaw, 0, 'YXZ');
    }
    for (const y of wyrms) {
      if (!y.P) continue;
      y.wrap.visible = y.w.state !== 'under' || y.w.head[1] > -12;
      const ws = (i) => ({open: 1, hit: S.t - y.hitT[i] < 0.12 ? 1 - (S.t - y.hitT[i]) / 0.12 : 0, dead: y.deadT[i] == null ? 0 : Math.min(1, (S.t - y.deadT[i]) / 0.1), pulse: 0.5 + 0.5 * Math.sin(S.t * 5 - i * 0.55)});
      y.body.update(y.P, cam, ws, 0.5 + 0.5 * Math.sin(S.t * 2.3));
    }
    scene.fog = S.view === 'fp' ? fog : null; // the top-down camera sits 200 m up, past the fog
    renderer.render(scene, cam);
    const count = (k) => agents.filter((x) => x.kind === k).length;
    document.getElementById('hud').textContent = `${S.view === 'fp' ? 'FIRST PERSON' : 'TOP DOWN'} · ${count('mote')} MOTES · ${count('stray')} STRAYS · ${count('hound')} HOUNDS · ${count('warden')} WARDENS · ${wyrms.length} WYRMS · ${censers.length} CENSERS`;
    document.getElementById('stats').innerHTML = [
      ['Time', `${S.t.toFixed(1)} s`],
      ['Wave', S.waves ? S.wave : 'off'],
      ['Kills', S.kills],
      ['Hits taken', S.hits],
      ['Closest', Number.isFinite(S.closest) ? `${S.closest.toFixed(1)} m` : '-'],
    ].map(([k, v]) => `<span>${k}</span><span>${v}</span>`).join('');
  }

  // ---------------------------------------------------------------- loop
  let last = performance.now();
  let acc = 0;
  function tick(now) {
    acc += Math.min(0.1, (now - last) / 1000);
    last = now;
    while (acc >= DT) {
      sim(DT);
      acc -= DT;
    }
    draw();
    frame++;
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
  window.CB = {S, agents: () => agents, censers: () => censers, wyrms: () => wyrms, sim, M, spawn: (id) => spawnById(id)};
}
