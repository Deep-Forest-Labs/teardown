// THE CHOPPING BLOCK, live page: a 50 m disc, censers that drift in from the rim and release a burst every 20 s, Ash
// Motes on the loiter field and Strays on their waypoints (swarm.js), shards to shoot them with. Two views: first
// person (click to look, WASD, Space, hold the mouse to fire) and top-down with trails (the same view as the reference
// captures, for side-by-side checks). Bot players stand or run a circle so the flow can be compared without playing.
import * as THREE from 'three';
import {burst, M, newMote, newStray, rnd, step, TAU, wrapPi} from './swarm.js';
import {materials, PAL} from '../slumber-kit/studio.js';

const DT = 1 / 120;
const PLAYER = {run: 12, jump: 6.5, g: 18, eye: 1.7};
const SHARD = {speed: 120, life: 0.6, rate: 15, spread: (1.5 * Math.PI) / 180};
const TRAIL = 90; // samples kept per agent for the trail (every 2 steps → 1.5 s)

export function runLive() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <canvas id="cv" tabindex="0"></canvas>
    <aside class="cb-panel" id="panel"></aside>
    <div class="cb-hud" id="hud"></div>
    <div class="cb-cross" id="cross"></div>`;
  const css = document.createElement('style');
  css.textContent = `
    html, body { margin: 0; height: 100%; overflow: hidden; background: #15141b; font: 13px/1.45 Inter, system-ui, sans-serif; color: #ebe5dc }
    #app { position: fixed; inset: 0 }
    #cv { position: absolute; inset: 0; width: 100%; height: 100%; display: block; outline: none }
    .cb-panel { position: absolute; right: 12px; top: 12px; width: min(300px, calc(100% - 24px)); max-height: calc(100% - 24px); overflow: auto; background: rgba(29,27,36,.94); border: 1px solid #34303d; border-radius: 6px; padding: 10px 12px; display: grid; gap: 8px }
    .cb-nav { display: flex; gap: 4px }
    .cb-nav a { font: 600 10.5px 'JetBrains Mono', monospace; letter-spacing: .06em; text-transform: uppercase; color: #a39cac; text-decoration: none; padding: 5px 7px; border-radius: 4px; border: 1px solid transparent }
    .cb-nav a[aria-current="page"] { color: #ebe5dc; border-color: #34303d; background: #26232f }
    .cb-panel h1 { margin: 0; font: 700 20px/1.1 Inter, sans-serif; letter-spacing: .01em }
    .cb-panel h2 { margin: 4px 0 0; font: 600 10.5px/1 'JetBrains Mono', monospace; letter-spacing: .1em; text-transform: uppercase; color: #a39cac }
    .cb-panel p { margin: 0; color: #a39cac; font-size: 12px }
    .cb-seg { display: flex; gap: 4px; flex-wrap: wrap }
    .cb-seg button, .cb-btn { flex: 1; font: 600 11px 'JetBrains Mono', monospace; letter-spacing: .04em; text-transform: uppercase; color: #ebe5dc; background: #26232f; border: 1px solid #34303d; border-radius: 4px; padding: 6px 8px; cursor: pointer; white-space: nowrap }
    .cb-seg button[aria-pressed="true"] { background: #e0b43a; color: #15141b; border-color: #e0b43a }
    .cb-row { display: grid; grid-template-columns: 7.5em 1fr 3.2em; gap: 8px; align-items: center; color: #a39cac; font-size: 12px }
    .cb-row input { width: 100% }
    .cb-row output { font: 600 11px 'JetBrains Mono', monospace; color: #ebe5dc; text-align: right }
    .cb-stats { display: grid; grid-template-columns: 1fr auto; gap: 2px 8px; font: 500 11.5px 'JetBrains Mono', monospace }
    .cb-stats span:nth-child(odd) { color: #a39cac }
    .cb-hud { position: absolute; left: 12px; top: 12px; font: 600 12px 'JetBrains Mono', monospace; letter-spacing: .06em; background: rgba(21,20,27,.8); border: 1px solid #34303d; border-radius: 4px; padding: 6px 10px }
    .cb-cross { position: absolute; left: 50%; top: 50%; width: 10px; height: 10px; margin: -5px 0 0 -5px; border: 2px solid rgba(255,255,255,.8); border-radius: 50%; pointer-events: none }
    @media (max-width: 760px) { .cb-panel { top: auto; bottom: 12px; max-height: 45% } }`;
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
  scene.fog = fog;
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
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(M.arenaR, M.arenaR, 2, 96).translate(0, -1, 0), mat.disc);
  disc.receiveShadow = true;
  scene.add(disc);
  for (const r of [12, 24, 36, 48]) {
    const band = new THREE.Mesh(new THREE.RingGeometry(r - 0.15, r + 0.15, 96).rotateX(-Math.PI / 2).translate(0, 0.01, 0), mat.band);
    scene.add(band);
  }
  // instanced agents
  const MAXM = 400;
  const moteBody = new THREE.InstancedMesh(new THREE.SphereGeometry(0.42, 12, 8), mat.bone, MAXM);
  const moteEye = new THREE.InstancedMesh(new THREE.SphereGeometry(0.12, 6, 4), mat.eye, MAXM * 2);
  const MAXS = 40;
  const strayBody = new THREE.InstancedMesh(new THREE.SphereGeometry(0.8, 14, 10), mat.fleshDeep, MAXS);
  const strayEye = new THREE.InstancedMesh(new THREE.SphereGeometry(0.2, 6, 4), mat.eye, MAXS * 2);
  for (const m of [moteBody, strayBody]) m.castShadow = true;
  for (const m of [moteBody, moteEye, strayBody, strayEye]) m.frustumCulled = false; // instances spread far from the mesh origin
  scene.add(moteBody, moteEye, strayBody, strayEye);
  const MAXSH = 200;
  const shardMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.05, 0.05, 1.6, 5).rotateX(Math.PI / 2), mat.shard, MAXSH);
  shardMesh.frustumCulled = false;
  scene.add(shardMesh);
  // trails (top-down)
  const trailGeo = new THREE.BufferGeometry();
  const trailPos = new Float32Array((MAXM + MAXS) * TRAIL * 3);
  const trailCol = new Float32Array((MAXM + MAXS) * TRAIL * 3);
  trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPos, 3));
  trailGeo.setAttribute('color', new THREE.BufferAttribute(trailCol, 3));
  const trails = new THREE.Points(trailGeo, new THREE.PointsMaterial({size: 2.2, sizeAttenuation: false, vertexColors: true}));
  trails.frustumCulled = false;
  scene.add(trails);
  // player marker (top-down) and censers
  const marker = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.3, 20), new THREE.MeshBasicMaterial({color: '#ffffff'}));
  scene.add(marker);
  const censerGeo = new THREE.LatheGeometry([[0, -1.6], [1.2, -1.2], [1.9, 0], [1.4, 1.2], [0.5, 1.8], [0, 1.9]].map(([r, y]) => new THREE.Vector2(r, y)), 20);

  // ---------------------------------------------------------------- state
  const S = {view: 'fp', bot: 'you', model: 'field', t: 0, kills: 0, hits: 0, closest: Infinity};
  const player = {p: [0, 0, 0], vy: 0, yaw: 0, pitch: 0, onGround: true, fire: false, cool: 0};
  let agents = [];
  let shards = [];
  let censers = [];
  let nid = 1;
  const keys = new Set();
  const hist = new Map();

  function addCenser(ang = rnd(nid * 3) * TAU) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(censerGeo, mat.flesh);
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
    censers.push({g, p: [r * Math.cos(ang), M.censer.height, r * Math.sin(ang)], born: S.t, nextBurst: S.t + M.censer.first, queue: [], hp: 40, seed: nid++});
  }
  function release(c) {
    for (const [dt, kind] of burst(c.seed * 7 + Math.floor(S.t))) c.queue.push([S.t + dt, kind]);
  }
  function clearAll() {
    for (const c of censers) scene.remove(c.g);
    censers = [];
    agents = [];
    shards = [];
    hist.clear();
  }

  // ---------------------------------------------------------------- panel
  const panel = document.getElementById('panel');
  const seg = (name, opts) => `<div class="cb-seg" data-seg="${name}">${opts.map(([v, l]) => `<button data-v="${v}" aria-pressed="${S[name] === v}">${l}</button>`).join('')}</div>`;
  const slider = (id, label, min, max, st, val) => `<label class="cb-row">${label}<input id="${id}" type="range" min="${min}" max="${max}" step="${st}" value="${val}"><output id="${id}-o">${val}</output></label>`;
  panel.innerHTML = `
    <nav class="cb-nav"><a href="index.html">Prototypes</a><a href="studies.html">Studies</a><a href="cb-live.html" aria-current="page">Chopping Block</a></nav>
    <h1>The Chopping Block</h1>
    <p>Movement lab for the base swarm. <b>Ash Motes</b> fly at a constant speed with a capped turn, steered by a loiter field round the player: far out they head at you, near 11-13 m they swing onto a counter-clockwise ring. Nothing scripts the circle: stand and you get circled, run and the swarm swirls after you. <b>Strays</b> pick a new random point every 1.6-2.5 s. Numbers from the Chopping Block reference spec.</p>
    <h2>View</h2>${seg('view', [['fp', 'First person'], ['top', 'Top down']])}
    <h2>Player</h2>${seg('bot', [['you', 'You'], ['stand', 'Stand'], ['circle', 'Run circle'], ['eight', 'Figure 8']])}
    <h2>Ash Mote rule</h2>${seg('model', [['field', 'Loiter field'], ['pursuit', 'Plain pursuit']])}
    ${slider('sv', 'Speed m/s', 14, 32, 0.5, 23)}
    ${slider('st', 'Turn °/s', 60, 240, 5, Math.round((M.mote.turn * 180) / Math.PI))}
    ${slider('sr', 'Ring m', 6, 20, 0.5, 11.5)}
    <h2>Spawn</h2>
    <div class="cb-seg"><button class="cb-btn" id="b-censer">Censer</button><button class="cb-btn" id="b-burst">Burst now</button></div>
    <div class="cb-seg"><button class="cb-btn" id="b-stray">Stray</button><button class="cb-btn" id="b-clear">Clear</button></div>
    <h2>Now</h2><div class="cb-stats" id="stats"></div>
    <p>First person: click the view to look, WASD to move, Space to jump, hold the mouse to fire, Esc to free the mouse. Top down: WASD moves you; holding the mouse fires at the nearest mote.</p>`;
  panel.addEventListener('click', (e) => {
    const b = e.target.closest('[data-seg] button');
    if (!b) return;
    const name = b.parentElement.dataset.seg;
    S[name] = b.dataset.v;
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
  document.getElementById('b-censer').onclick = () => addCenser();
  document.getElementById('b-burst').onclick = () => {
    if (!censers.length) addCenser();
    release(censers[censers.length - 1]);
  };
  document.getElementById('b-stray').onclick = () => agents.push(newStray(nid++, [rnd(nid) * 30 - 15, 5, rnd(nid + 1) * 30 - 15], S.t));
  document.getElementById('b-clear').onclick = clearAll;

  // ---------------------------------------------------------------- input
  canvas.addEventListener('click', () => {
    if (S.view === 'fp' && document.pointerLockElement !== canvas) canvas.requestPointerLock();
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

  // ---------------------------------------------------------------- simulation
  function playerStep(dt) {
    if (S.bot === 'stand') {
      player.p = [0, 0, 0];
      return;
    }
    if (S.bot === 'circle' || S.bot === 'eight') {
      const w = PLAYER.run / 18;
      const a = S.t * w;
      player.p = S.bot === 'circle' ? [18 * Math.cos(a), 0, 18 * Math.sin(a)] : [22 * Math.sin(a), 0, 14 * Math.sin(2 * a)];
      return;
    }
    let f = 0;
    let s = 0;
    if (keys.has('KeyW')) f += 1;
    if (keys.has('KeyS')) f -= 1;
    if (keys.has('KeyD')) s += 1;
    if (keys.has('KeyA')) s -= 1;
    const yaw = S.view === 'top' ? -Math.PI / 2 : player.yaw;
    // forward is -z rotated by yaw (three's camera convention)
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
    const r = Math.hypot(player.p[0], player.p[2]);
    if (r > M.arenaR - 1) {
      player.p[0] *= (M.arenaR - 1) / r;
      player.p[2] *= (M.arenaR - 1) / r;
    }
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
    if (S.view === 'fp') {
      const cp = Math.cos(player.pitch);
      return [-Math.sin(player.yaw) * cp, Math.sin(player.pitch), -Math.cos(player.yaw) * cp];
    }
    // top down: at the nearest mote
    let best = null;
    let bd = Infinity;
    for (const a of agents) {
      const d = Math.hypot(a.p[0] - player.p[0], a.p[1] - player.p[1] - PLAYER.eye, a.p[2] - player.p[2]);
      if (d < bd) {
        bd = d;
        best = a;
      }
    }
    if (!best) return null;
    const v = [best.p[0] - player.p[0], best.p[1] - player.p[1] - PLAYER.eye, best.p[2] - player.p[2]];
    const l = Math.hypot(...v);
    return v.map((x) => x / l);
  }
  function sim(dt) {
    S.t += dt;
    playerStep(dt);
    const pl = [player.p[0], player.p[1], player.p[2]];
    // censers drift inward and spin; release on their schedule
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
        const top = [c.p[0], c.p[1] + 2, c.p[2]];
        agents.push(kind === 'mote' ? newMote(nid++, top, [pl[0], pl[2]], S.t) : newStray(nid++, top, S.t));
        return false;
      });
    }
    // live tuning reaches every mote; plain pursuit switches the field off
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
      if (d < (a.kind === 'mote' ? 0.9 : 1.3)) {
        S.hits++;
        a.alive = false;
      }
    }
    S.closest = closest;
    // shards
    player.cool -= dt;
    if (player.fire && player.cool <= 0) {
      const dir = aimDir();
      if (dir) {
        player.cool = 1 / SHARD.rate;
        const j = (k) => (rnd(nid * 11 + k + S.t * 1000) - 0.5) * SHARD.spread;
        const d = [dir[0] + j(1), dir[1] + j(2), dir[2] + j(3)];
        shards.push({p: [pl[0], pl[1] + PLAYER.eye - 0.2, pl[2]], d, t: S.t});
      }
    }
    for (const s of shards) {
      for (let k = 0; k < 3; k++) s.p[k] += s.d[k] * SHARD.speed * dt;
      for (const a of agents) {
        if (!a.alive) continue;
        const r = a.kind === 'mote' ? 0.7 : 1.1;
        if (Math.hypot(a.p[0] - s.p[0], a.p[1] - s.p[1], a.p[2] - s.p[2]) < r) {
          a.alive = false;
          s.dead = true;
          S.kills++;
          break;
        }
      }
      for (const c of censers) {
        if (Math.hypot(c.p[0] - s.p[0], c.p[1] - s.p[1], c.p[2] - s.p[2]) < 2.2) {
          c.hp--;
          s.dead = true;
        }
      }
    }
    shards = shards.filter((s) => !s.dead && S.t - s.t < SHARD.life);
    for (const c of censers) if (c.hp <= 0) scene.remove(c.g);
    censers = censers.filter((c) => c.hp > 0);
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
    let nm = 0;
    let ns = 0;
    for (const ag of agents) {
      Q.setFromAxisAngle(UPV, -ag.yaw);
      M4.compose(tmp.set(...ag.p), Q, new THREE.Vector3(1, 1, 1));
      const eyeOff = ag.kind === 'mote' ? [0.36, 0.1, 0.14] : [0.7, 0.2, 0.3];
      const body = ag.kind === 'mote' ? moteBody : strayBody;
      const eye = ag.kind === 'mote' ? moteEye : strayEye;
      const i = ag.kind === 'mote' ? nm++ : ns++;
      if ((ag.kind === 'mote' && i >= MAXM) || (ag.kind === 'stray' && i >= MAXS)) continue;
      body.setMatrixAt(i, M4);
      for (const sd of [-1, 1]) {
        const e = new THREE.Vector3(eyeOff[0], eyeOff[1], sd * eyeOff[2]).applyQuaternion(Q).add(tmp);
        eye.setMatrixAt(i * 2 + (sd > 0 ? 1 : 0), new THREE.Matrix4().makeTranslation(e.x, e.y, e.z));
      }
    }
    moteBody.count = Math.min(nm, MAXM);
    moteEye.count = Math.min(nm, MAXM) * 2;
    strayBody.count = Math.min(ns, MAXS);
    strayEye.count = Math.min(ns, MAXS) * 2;
    for (const m of [moteBody, moteEye, strayBody, strayEye]) m.instanceMatrix.needsUpdate = true;
    shardMesh.count = Math.min(shards.length, MAXSH);
    shards.slice(0, MAXSH).forEach((s, i) => {
      Q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(...s.d));
      shardMesh.setMatrixAt(i, M4.compose(tmp.set(...s.p), Q, new THREE.Vector3(1, 1, 1)));
    });
    shardMesh.instanceMatrix.needsUpdate = true;
    // trails: blue (old) → yellow (now), top-down only
    trails.visible = S.view === 'top';
    if (trails.visible) {
      if (frame % 2 === 0) {
        for (const ag of agents) {
          if (!hist.has(ag.id)) hist.set(ag.id, []);
          const hh = hist.get(ag.id);
          hh.push([ag.p[0], 0.05, ag.p[2]]);
          if (hh.length > TRAIL) hh.shift();
        }
        for (const id of [...hist.keys()]) if (!agents.some((x) => x.id === id)) hist.delete(id);
      }
      let o = 0;
      for (const hh of hist.values()) {
        hh.forEach((q, k) => {
          if (o >= trailPos.length) return;
          const u = k / TRAIL;
          trailPos.set(q, o);
          trailCol.set([0.24 + 0.76 * u, 0.47 + 0.4 * u, 1 - 0.9 * u], o);
          o += 3;
        });
      }
      trailGeo.setDrawRange(0, o / 3);
      trailGeo.attributes.position.needsUpdate = true;
      trailGeo.attributes.color.needsUpdate = true;
    }
    marker.visible = S.view === 'top';
    marker.position.set(player.p[0], 0.2, player.p[2]);
    document.getElementById('cross').style.display = S.view === 'fp' ? 'block' : 'none';
    let cam = ortho;
    if (S.view === 'fp') {
      cam = persp;
      persp.position.set(player.p[0], player.p[1] + PLAYER.eye, player.p[2]);
      if (S.bot !== 'you') {
        // bots: look where they run
        const nx = S.bot === 'circle' ? -Math.sin((S.t * PLAYER.run) / 18) : Math.cos((S.t * PLAYER.run) / 18);
        const ms = agents.filter((x) => x.kind === 'mote');
        const cx = ms.length ? ms.reduce((a, x) => a + x.p[0], 0) / ms.length : 0;
        const cz = ms.length ? ms.reduce((a, x) => a + x.p[2], 0) / ms.length : -1;
        player.yaw = S.bot === 'stand' ? Math.atan2(-(cx - player.p[0]), -(cz - player.p[2])) : Math.atan2(-nx, -(S.bot === 'circle' ? Math.cos((S.t * PLAYER.run) / 18) : Math.cos((2 * S.t * PLAYER.run) / 18)));
      }
      persp.rotation.set(player.pitch, player.yaw, 0, 'YXZ');
    }
    scene.fog = S.view === 'fp' ? fog : null; // the top-down camera sits 200 m up, past the fog
    renderer.render(scene, cam);
    const motes = agents.filter((x) => x.kind === 'mote').length;
    document.getElementById('hud').textContent = `${S.view === 'fp' ? 'FIRST PERSON' : 'TOP DOWN'} · ${motes} MOTES · ${agents.length - motes} STRAYS · ${censers.length} CENSERS`;
    document.getElementById('stats').innerHTML = [
      ['Time', `${S.t.toFixed(1)} s`],
      ['Kills', S.kills],
      ['Hits taken', S.hits],
      ['Closest', Number.isFinite(S.closest) ? `${S.closest.toFixed(1)} m` : '-'],
      ['Next burst', censers.length ? `${Math.max(0, Math.min(...censers.map((c) => c.nextBurst)) - S.t).toFixed(1)} s` : '-'],
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
  // start: one censer, standing bot in top-down, so the page shows the flow before anyone touches it
  addCenser(Math.PI * 0.6);
  S.view = 'top';
  S.bot = 'stand';
  for (const b of panel.querySelectorAll('[data-seg] button')) b.setAttribute('aria-pressed', S[b.parentElement.dataset.seg] === b.dataset.v ? 'true' : 'false');
  requestAnimationFrame(tick);
  window.CB = {S, agents: () => agents, sim, M};
}
