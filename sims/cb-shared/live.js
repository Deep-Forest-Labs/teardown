// THE CHOPPING BLOCK, live page: a 50 m disc; censers drift in from the rim and release a burst every 20 s; Ash Motes,
// Hounds and Wardens on the loiter rule and Strays on their waypoints (swarm.js); shards to shoot them. A drawer of the
// roster on the left (roster.js) with each enemy's data and a spawn button; controls on the right. Two views: first
// person (click to look, WASD, Space, hold to fire) and top-down with trails, the view of the reference captures. Bot
// players: stand, run a circle, or the expert (circle-strafes, reverses when a charger is ahead, shoots spawners first).
import * as THREE from 'three';
import {arenaAt, burst, M, newCenserState, newMote, newStray, newWyrm, rnd, step, stepCenser, stepWyrm, TAU, WYRMS} from './swarm.js';
import {createTrail} from '../bonepede2-shared/trail.js';
import {briarUp, callPull, cantorAwake, cantorCalling, E, eggHatched, eyeCalling, eyeLanded, eyeStunned, newBriar, newCantor, newEgg, newEye, newMite, newTithe, pushOut, stepCantor, stepEye, stepMite, stepTithe} from './elites.js';
import {CFG as WCFG, pose} from '../bonepede2-shared/wyrm.js';
import {createBody} from '../bonepede2-shared/body.js';
import {ALL, ROSTER} from './roster.js';
import {materials} from '../slumber-kit/studio.js';
import {stepHorde} from './horde.js';

const DT = 1 / 120;
const PLAYER = {run: 16, jump: 6.5, g: 18, eye: 1.7}; // about 16 m/s running in the captures
const SHARD = {speed: 120, life: 0.34, rate: 15, spread: (2.5 * Math.PI) / 180}; // about 40 m of reach
const TRAIL = 90; // samples per agent (every 2 steps → 1.5 s)
const HP = {mote: 1, stray: 5, hound: 10, warden: 100};
// V2 (the game's own swarm, Rob's horde): four times the motes per burst, weaker swarm tiers, motes that move as a horde
const V2 = {moteMul: 4, hp: {mote: 1, stray: 2, hound: 4, warden: 40}, moteMax: 2600};
// the wyrms are BONEPEDE II's body at a per-variant scale (swarm.js WYRMS)
// power tiers (Chopping Block player data): rapid shards per second and seeking shards per second by tier
const TIERS = {rapid: [20, 40, 80, 106.666], seek: [0, 0, 40, 40], shotgun: [10, 20, 40, 60], seekShotgun: [0, 0, 20, 30], storeFor4: 150};
// seeking damage: 1 to the Cantor and its Eye, 30 to a Great Censer, 10 to the rest; plain shards do 1
const dmgOf = (s, kind) => (!s.seek ? 1 : kind === 'cantor' || kind === 'eye' ? 1 : kind === 'great' ? 30 : 10);
// the reference table's ids → the lab's spawn ids
const TABLE_IDS = {censer: 'censer', twin_censer: 'twin', great_censer: 'great', spinewyrm: 'spinewyrm', elder_spinewyrm: 'elder', pale_spinewyrm: 'pale', cantor: 'cantor', tithe_taker: 'tithe', great_tithe_taker: 'great_tithe', briar: 'briar'};
const ORBS = {mote: 0, stray: 1, hound: 1, warden: 0, censer: 1, twin: 2, great: 3, tithe: 1, cantor: 6}; // wyrms: WYRMS[v].orbsPerPoint
const ORB = {fall: 9, magnet: 6, pull: 14, take: 1.5};
// how each kind is drawn: body radius, stretch along its heading, material, eye size, instance cap
const LOOK = {
  mote: {r: 0.42, len: 1, mat: 'bone', eye: 0.12, max: 500},
  stray: {r: 0.8, len: 1.1, mat: 'fleshDeep', eye: 0.2, max: 40},
  hound: {r: 0.55, len: 1.9, mat: 'accent', eye: 0.14, max: 40},
  warden: {r: 1.7, len: 1.3, mat: 'steel', eye: 0.35, max: 20},
};

export function runLive(opts = {}) {
  const IS_V2 = !!opts.v2;
  if (IS_V2) LOOK.mote.max = V2.moteMax;
  const HPX = IS_V2 ? V2.hp : HP;
  // opts.table: {entries: [{t, enemy}], power: [{t, tier, seeking}], swarm: [[t, motes]], loopStart}, the reference timeline under our ids (sims/cb-shared/reference-table.json)
  const TABLE = opts.table || null;
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
    .cb-x { float: right; font: 600 16px/1 'JetBrains Mono', monospace; color: #a39cac; background: none; border: 1px solid #34303d; border-radius: 4px; width: 26px; height: 26px; cursor: pointer }
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
    .cb-jumps { display: grid; grid-template-columns: 1fr 1fr; gap: 4px }
    .cb-jumps .cb-btn { text-align: left; font-size: 10.5px; padding: 5px 6px; white-space: normal }
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
  mat.orb = new THREE.MeshStandardMaterial({color: '#7fe3d4', emissive: new THREE.Color('#3fd8c4'), emissiveIntensity: 1.2});
  mat.call = new THREE.MeshBasicMaterial({color: '#ff6a3a', transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false});
  mat.egg = new THREE.MeshStandardMaterial({color: '#ece5d8', roughness: 0.5});
  mat.cantor = new THREE.MeshPhysicalMaterial({color: '#c98f84', roughness: 0.55, sheen: 0.6, emissive: new THREE.Color('#ff4a1a'), emissiveIntensity: 0});
  const disc = Object.assign(new THREE.Mesh(new THREE.CylinderGeometry(M.arenaR, M.arenaR, 2, 96).translate(0, -1, 0), mat.disc), {receiveShadow: true});
  scene.add(disc);
  const bands = [12, 24, 36, 48].map((r) => {
    const m = new THREE.Mesh(new THREE.RingGeometry(r - 0.15, r + 0.15, 96).rotateX(-Math.PI / 2).translate(0, 0.01, 0), mat.band);
    m.userData.r = r;
    scene.add(m);
    return m;
  });
  const meshes = {};
  for (const [kind, L] of Object.entries(LOOK)) {
    const body = new THREE.InstancedMesh(new THREE.SphereGeometry(L.r, 10, 7).scale(L.len, 1, 1), mat[L.mat], L.max);
    const eye = new THREE.InstancedMesh(new THREE.SphereGeometry(L.eye, 4, 3), mat.eye, L.max * 2);
    body.castShadow = true;
    body.frustumCulled = eye.frustumCulled = false; // instances spread far from the mesh origin
    for (let i = 0; i < L.max; i++) body.setColorAt(i, new THREE.Color(1, 1, 1)); // fevered ones are tinted
    scene.add(body, eye);
    meshes[kind] = {body, eye, L, tint: new Uint8Array(L.max)};
  }
  const orbMesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.28, 0), mat.orb, 300);
  const miteMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.32, 8, 6).scale(1.4, 0.7, 1), mat.fleshDeep, 120);
  const eggMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.45, 10, 8).scale(1, 1.3, 1), mat.egg, 60);
  for (const m of [orbMesh, miteMesh, eggMesh]) {
    m.frustumCulled = false;
    m.castShadow = true;
    scene.add(m);
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
  // the player's glow: a warm light on the floor round them, and a halo you can find in a crowd from above
  const glow = new THREE.PointLight('#ffb070', 60, 16, 1.6);
  scene.add(glow);
  const halo = new THREE.Group();
  halo.add(new THREE.Mesh(new THREE.CircleGeometry(3.2, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({color: '#ffb070', transparent: true, opacity: 0.28, depthWrite: false})));
  halo.add(new THREE.Mesh(new THREE.RingGeometry(3.0, 3.4, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({color: '#ffd9a8', transparent: true, opacity: 0.9, depthWrite: false})));
  halo.add(new THREE.Mesh(new THREE.CircleGeometry(0.6, 20).rotateX(-Math.PI / 2).translate(0, 0.01, 0), new THREE.MeshBasicMaterial({color: '#ffffff'})));
  scene.add(halo);
  const censerGeo = new THREE.LatheGeometry([[0, -1.6], [1.2, -1.2], [1.9, 0], [1.4, 1.2], [0.5, 1.8], [0, 1.9]].map(([r, y]) => new THREE.Vector2(r, y)), 20);

  // ---------------------------------------------------------------- state
  const S = {view: 'top', bot: IS_V2 ? 'kite' : 'expert', model: 'field', spawn: TABLE && !IS_V2 ? 'table' : 'waves', ti: 0, ff: false, t: 0, kills: 0, hits: 0, closest: Infinity, sel: 'mote', nextWave: 1, wave: 0};
  const player = {p: [0, 0, 0], vy: 0, yaw: 0, pitch: 0, onGround: true, fire: false, cool: 0, dir: 1, flipAt: 9, aim: null};
  let agents = [];
  let shards = [];
  let censers = [];
  let wyrms = [];
  let elites = [];
  let orbs = [];
  let nid = 1;
  const keys = new Set();
  const hist = new Map();

  function addCenser(type = 'censer', ang = rnd(nid * 3) * TAU) {
    const C = M.censers[type];
    // g: position and heading (+x along its travel); roll: about that axis; g2: the lathe laid along +x, head forward
    const g0 = new THREE.Group();
    const roll = new THREE.Group();
    const g = new THREE.Group();
    g0.add(roll);
    roll.add(g);
    g.rotation.z = -Math.PI / 2;
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
    scene.add(g0);
    const st = newCenserState(nid, ang, S.t);
    st.p[1] = M.censer.height * C.size;
    censers.push({...st, type, g: g0, rollG: roll, size: C.size, nextBurst: S.t + M.censer.first, queue: [], hp: C.hp, seed: nid++, r: 2.2 * C.size});
  }
  function release(c) {
    for (const [dt, kind] of burst(c.seed * 7 + Math.floor(S.t), c.type)) {
      if (IS_V2 && kind === 'mote') {
        // four times the motes, poured out over 1.6 s instead of 0.7 s
        for (let k = 0; k < V2.moteMul; k++) c.queue.push([S.t + dt + k * 0.3 + rnd(nid++) * 0.2, kind]);
      } else c.queue.push([S.t + dt, kind]);
    }
  }
  function spawnAgent(kind, at) {
    const a = kind === 'stray' ? newStray(nid++, at, S.t) : newMote(nid++, at, [player.p[0], player.p[2]], S.t, kind);
    a.hp = HPX[kind];
    agents.push(a);
  }
  function dropOrbs(p, n) {
    for (let k = 0; k < n; k++) orbs.push({p: [p[0] + (rnd(nid * 3 + k) - 0.5) * 2, Math.max(0.5, p[1]), p[2] + (rnd(nid * 5 + k) - 0.5) * 2], born: S.t, taken: false});
    nid++;
  }
  function eliteLook(e) {
    const g = new THREE.Group();
    const part = (geo, m, pos = [0, 0, 0], parent = g) => {
      const mesh = new THREE.Mesh(geo, m);
      mesh.position.set(...pos);
      mesh.castShadow = true;
      parent.add(mesh);
      return mesh;
    };
    if (e.kind === 'tithe') {
      part(new THREE.SphereGeometry(2.2, 18, 12, 0, TAU, 0, Math.PI / 2).scale(1.3, 0.7, 1), mat.fleshDeep);
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * TAU;
        const leg = part(new THREE.ConeGeometry(0.22, 2.6, 5).rotateZ(Math.PI / 2.6), mat.dark, [Math.cos(a) * 2.4, 0.4, Math.sin(a) * 2.2]);
        leg.rotation.y = -a;
      }
      g.userData.neck = part(new THREE.CylinderGeometry(0.35, 0.5, 1, 8).translate(0, 0.5, 0), mat.flesh, [0, 1, 0]);
      g.userData.head = part(new THREE.SphereGeometry(0.85, 14, 10), mat.flesh, [0, E.tithe.headY, 0]);
      part(new THREE.SphereGeometry(0.28, 8, 6), mat.eye, [0.7, 0.1, 0], g.userData.head);
      g.scale.setScalar(e.scale || 1);
    } else if (e.kind === 'cantor') {
      part(new THREE.LatheGeometry([[0, -3], [3.4, -2.2], [5, 0], [4.2, 1.8], [2, 3.2], [0, 3.6]].map(([r, y]) => new THREE.Vector2(r, y)), 28), mat.cantor);
      for (let k = 0; k < 10; k++) {
        const a = (k / 10) * TAU;
        const t = part(new THREE.CylinderGeometry(0.4, 0.08, 6, 6).translate(0, -3, 0), mat.fleshDeep, [Math.cos(a) * 3, -2, Math.sin(a) * 3]);
        t.rotation.set(Math.sin(a) * 0.35, 0, -Math.cos(a) * 0.35);
      }
      g.userData.points = Array.from({length: E.cantor.points}, (_, k) => part(new THREE.SphereGeometry(0.75, 12, 8), mat.accent, [Math.cos((k / E.cantor.points) * TAU) * 4.9, 0.3, Math.sin((k / E.cantor.points) * TAU) * 4.9]));
      g.userData.ring = part(new THREE.TorusGeometry(1, 0.08, 6, 48).rotateX(Math.PI / 2), mat.call);
      g.scale.setScalar(E.cantor.scale);
    } else if (e.kind === 'eye') {
      part(new THREE.SphereGeometry(2, 20, 14), mat.bone);
      g.userData.iris = part(new THREE.SphereGeometry(0.9, 14, 10), mat.accent, [1.6, 0, 0]);
      g.userData.ring = part(new THREE.TorusGeometry(1, 0.08, 6, 48).rotateX(Math.PI / 2), mat.call);
    } else if (e.kind === 'briar') {
      for (let k = 0; k < 9; k++) {
        const a = (k / 9) * TAU + k;
        const h = 3 + (k % 3);
        const sp = part(new THREE.ConeGeometry(0.35, h, 5).translate(0, h / 2, 0), k % 2 ? mat.dark : mat.fleshDeep, [Math.cos(a) * 0.4 * (k % 3), 0, Math.sin(a) * 0.4 * (k % 3)]);
        sp.rotation.set(Math.sin(a) * 0.4, 0, Math.cos(a) * 0.4);
      }
    }
    scene.add(g);
    return g;
  }
  function addElite(e) {
    if (e.kind !== 'egg' && e.kind !== 'mite') e.g = eliteLook(e);
    elites.push(e);
    return e;
  }
  function addWyrm(variant = 'spinewyrm') {
    const ang = rnd(nid * 9) * TAU;
    const r0 = arenaAt(S.t) - 7 * rnd(nid * 11); // it first comes up near the current edge
    const at = [r0 * Math.cos(ang), 0, r0 * Math.sin(ang)];
    const w = newWyrm(nid++, at, S.t, variant);
    const WS = WYRMS[variant].scale;
    const wrap = new THREE.Group();
    wrap.scale.setScalar(WS);
    scene.add(wrap);
    const body = createBody(wrap);
    const trail = createTrail({minStep: 0.015});
    for (let y = -20; y <= w.head[1]; y += 0.05) trail.push([at[0] / WS, y / WS, at[2] / WS]);
    if (variant === 'pale') body.group.traverse((o) => o.material && (o.material = o.material.clone(), o.material.transparent = true, o.material.opacity = 0.55));
    wyrms.push({w, ws: WS, wrap, body, trail, hp: Array(WCFG.N).fill(WYRMS[variant].hpPer), hitT: Array(WCFG.N).fill(-9), deadT: Array(WCFG.N).fill(null), phase: 0, P: null});
  }
  function spawnById(id) {
    if (id === 'spinewyrm' || id === 'elder' || id === 'pale') return addWyrm(id);
    if (id === 'tithe') return addElite(newTithe(nid++, S.t, undefined, false, arenaAt(S.t) + 2.5));
    if (id === 'great_tithe') return addElite(newTithe(nid++, S.t, undefined, true, arenaAt(S.t) + 2.5));
    if (id === 'twin' || id === 'great' || id === 'censer') return addCenser(id);
    if (id === 'cantor') return addElite(newCantor(nid++, S.t));
    if (id === 'briar') {
      const a = rnd(nid * 13) * TAU;
      const r = 14 + 18 * rnd(nid * 17);
      return addElite(newBriar(nid++, [r * Math.cos(a), 0, r * Math.sin(a)], S.t));
    }
    if (id === 'egg') return addElite(newEgg(nid++, [player.p[0] + 12, 0.4, player.p[2]], S.t));
    if (id === 'mite') return addElite(newMite(nid++, [player.p[0] + 15, 0, player.p[2]], S.t));
    if (id === 'eye') return addElite(newEye(nid++, [0, 0, -12], S.t - E.cantor.eyeWake + 1));
    if (M.censers[id]) return addCenser(id);
    if (!HP[id]) return;
    const ang = rnd(nid * 7) * TAU;
    spawnAgent(id, [M.arenaR * 0.85 * Math.cos(ang), 6, M.arenaR * 0.85 * Math.sin(ang)]);
  }
  function clearAll() {
    for (const c of censers) scene.remove(c.g);
    for (const y of wyrms) scene.remove(y.wrap);
    for (const e of elites) if (e.g) scene.remove(e.g);
    wyrms = [];
    elites = [];
    orbs = [];
    censers = [];
    agents = [];
    shards = [];
    hist.clear();
    S.wave = 0;
    S.nextWave = S.t + 1;
    S.ti = 0;
    S.spent = 0;
    S.pendingEyes = [];
  }

  // ---------------------------------------------------------------- drawer and info
  const drawer = document.getElementById('drawer');
  drawer.innerHTML = ROSTER.map((g) => `<h2>${g.group}</h2>${g.items.map((e) => `
    <button class="cb-card" data-id="${e.id}" aria-current="${e.id === S.sel}"><b>${e.name}</b><span class="cb-chip ${e.status}">${e.status === 'lab' ? 'In lab' : 'Planned'}</span><small>${e.role}</small></button>`).join('')}`).join('');
  const info = document.getElementById('info');
  function showInfo() {
    const e = ALL.find((x) => x.id === S.sel);
    info.hidden = false;
    info.innerHTML = `
      <button class="cb-x" id="info-x" aria-label="Close">×</button>
      <div class="cb-role">${e.role}</div>
      <h1>${e.name} ${e.status === 'lab' ? `<button class="cb-btn go" id="b-spawn">Spawn</button>` : '<span class="cb-chip planned" style="grid-row:auto">Planned</span>'}</h1>
      <p>${e.does}</p>
      <dl><dt>Health</dt><dd>${e.hp}</dd><dt>Orbs</dt><dd>${e.orbs}</dd>${e.data.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}<dt>Counter</dt><dd>${e.counter}</dd></dl>`;
    document.getElementById('info-x').onclick = () => (info.hidden = true); // the card can be closed to see the arena
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
  const fmt = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
  // the jump list: where each kind first appears in the table, plus the start and the endless loop
  const JUMPS = [];
  if (TABLE) {
    const NAMES = {censer: 'Censers', twin_censer: 'Twin Censers', great_censer: 'Great Censer', spinewyrm: 'Spinewyrm', elder_spinewyrm: 'Elder Spinewyrm', pale_spinewyrm: 'Pale Spinewyrm', cantor: 'The Cantor', tithe_taker: 'Tithe-Takers', great_tithe_taker: 'Great Tithe-Taker', briar: 'Briars'};
    const seen = new Set();
    JUMPS.push([0, 'Start']);
    for (const e of TABLE.entries) {
      if (seen.has(e.enemy) || !NAMES[e.enemy] || e.t > TABLE.loopStart) continue;
      seen.add(e.enemy);
      if (e.t > 5) JUMPS.push([Math.floor(e.t) + 2, NAMES[e.enemy]]); // land just after it appears
    }
    JUMPS.push([Math.floor(TABLE.loopStart) - 1, 'Endless loop']);
    JUMPS.sort((a, b) => a[0] - b[0]);
  }
  const seg = (name, opts) => `<div class="cb-seg" data-seg="${name}">${opts.map(([v, l]) => `<button data-v="${v}" aria-pressed="${String(S[name]) === v}">${l}</button>`).join('')}</div>`;
  const slider = (id, label, min, max, st, val) => `<label class="cb-row">${label}<input id="${id}" type="range" min="${min}" max="${max}" step="${st}" value="${val}"><output id="${id}-o">${val}</output></label>`;
  panel.innerHTML = `
    <nav class="cb-nav"><a href="index.html">Prototypes</a><a href="studies.html">Studies</a><a href="cb-live.html"${IS_V2 ? '' : ' aria-current="page"'}>Chopping Block</a><a href="cb-v2.html"${IS_V2 ? ' aria-current="page"' : ''}>V2 horde</a></nav>
    <h1>The Chopping Block${IS_V2 ? ' V2' : ''}</h1>
    ${IS_V2
    ? '<p>Our own swarm on the same spawning: four times the motes, weaker swarm tiers, and motes that move as a horde. It chases slower than you run, so a steady run kites it; it packs into a clump a shotgun clears. Fresh motes are flung high out of the censers; the nearest 140 chase and dive onto you, and the rest drift up into a high, wispy cloud trailing behind, out of your running line. It reaches whatever height you jump to. Double jump (Space twice) to get over the front. The 1:1 study stays on its own page.</p>'
    : '<p>Movement lab for the base swarm. Every chaser follows one rule with its own numbers: constant speed, capped turn, a loiter field round the player. Nothing scripts the circle or the charge. Pick an enemy on the left for its data.</p>'}
    <h2>View</h2>${seg('view', [['fp', 'First person'], ['top', 'Top down']])}
    <h2>Player</h2>${seg('bot', [...(IS_V2 ? [['kite', 'Kite (no fire)']] : []), ['expert', 'Expert bot'], ['you', 'You'], ['stand', 'Stand'], ['circle', 'Circle']])}
    <h2>Spawning</h2>${seg('spawn', [...(TABLE ? [['table', 'Reference table']] : []), ['waves', 'Our waves'], ['off', 'Off']])}
    ${TABLE ? `<h2>Jump to</h2><div class="cb-jumps">${JUMPS.map(([t, label]) => `<button class="cb-btn" data-jump="${t}">${fmt(t)} ${label}</button>`).join('')}</div>` : ''}
    <div class="cb-seg"><button class="cb-btn" id="b-burst">Burst now</button><button class="cb-btn" id="b-clear">Clear</button></div>
    <h2>Ash Mote rule</h2>${seg('model', [['field', 'Loiter field'], ['pursuit', 'Plain pursuit']])}
    ${slider('sv', 'Speed m/s', 14, 32, 0.5, 23)}
    ${slider('st', 'Turn °/s', 60, 240, 5, Math.round((M.mote.turn * 180) / Math.PI))}
    ${slider('sr', 'Ring m', 6, 20, 0.5, 11.5)}
    <h2>Now</h2><div class="cb-stats" id="stats"></div>
    <p>First person: click the view to look, WASD, Space to jump, hold to fire, Esc frees the mouse. Top down: WASD moves you; holding the mouse fires at the nearest enemy. The expert bot circle-strafes, turns back when a charger is ahead, and shoots censers first, then chargers, then the closest motes.</p>`;
  panel.addEventListener('click', (e) => {
    const j = e.target.closest('[data-jump]');
    if (j) {
      S.spawn = 'table';
      for (const x of panel.querySelectorAll('[data-seg=spawn] button')) x.setAttribute('aria-pressed', x.dataset.v === 'table' ? 'true' : 'false');
      jumpTo(+j.dataset.jump);
      return;
    }
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
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 2) player.shotgun = true;
    else player.fire = true;
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  addEventListener('mouseup', () => (player.fire = false));
  addEventListener('keydown', (e) => {
    keys.add(e.code);
    if (e.code === 'KeyF') player.shotgun = true;
    if (e.code === 'Space') {
      e.preventDefault();
      if (!e.repeat && S.bot === 'you') jump();
    }
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
  // the strafing circle is centred partway toward the nearest big threat (a spawner or an elite), so it closes to range
  function strafeCentre() {
    let best = null;
    let bd = Infinity;
    for (const c of censers) {
      const d = Math.hypot(c.p[0] - player.p[0], c.p[2] - player.p[2]);
      if (d < bd) [best, bd] = [c.p, d];
    }
    for (const e of elites) {
      if (e.kind !== 'tithe' && e.kind !== 'cantor' && e.kind !== 'eye') continue;
      const d = Math.hypot(e.p[0] - player.p[0], e.p[2] - player.p[2]);
      if (d < bd) [best, bd] = [e.p, d];
    }
    if (!best) return [0, 0];
    const c = [best[0] * 0.55, best[2] * 0.55];
    const r = Math.hypot(c[0], c[1]);
    const lim = Math.max(0, arenaAt(S.t) - 26);
    return r > lim ? [(c[0] * lim) / r, (c[1] * lim) / r] : c;
  }
  function expertMove(dt) {
    const sc = strafeCentre();
    player.centre = player.centre ? player.centre.map((x, i) => x + (sc[i] - x) * Math.min(1, dt * 0.6)) : sc;
    const rx = player.p[0] - player.centre[0];
    const rz = player.p[2] - player.centre[1];
    const ang = Math.atan2(rz, rx);
    const r = Math.hypot(rx, rz);
    const want = Math.min(18 + 5 * Math.sin(S.t * 0.37), arenaAt(S.t) - 8 - Math.hypot(...player.centre)); // stay on the floor
    const tx = -Math.sin(ang) * player.dir;
    const tz = Math.cos(ang) * player.dir;
    const radial = Math.max(-1, Math.min(1, (want - r) / 4));
    let mx = tx + Math.cos(ang) * radial;
    let mz = tz + Math.sin(ang) * radial;
    const l = Math.hypot(mx, mz) || 1;
    mx /= l;
    mz /= l;
    // V2: kite the horde. When its mass is within 14 m, run straight away from it (bending along the floor's edge)
    if (IS_V2) {
      const ms = agents.filter((x) => x.kind === 'mote' && Math.hypot(x.p[0] - player.p[0], x.p[2] - player.p[2]) < 14);
      if (ms.length > 5) {
        const c = ms.reduce((q, x) => [q[0] + x.p[0] / ms.length, q[1] + x.p[2] / ms.length], [0, 0]);
        let ax = player.p[0] - c[0];
        let az = player.p[2] - c[1];
        const r = Math.hypot(player.p[0], player.p[2]);
        const edge = arenaAt(S.t) - 6;
        if (r > edge * 0.7) {
          // near the edge: turn along it (keep the floor under you) toward the side away from the mass
          const tx = -player.p[2] / r;
          const tz = player.p[0] / r;
          const side = tx * ax + tz * az >= 0 ? 1 : -1;
          const k = Math.min(1, (r - edge * 0.7) / (edge * 0.3));
          ax = ax * (1 - k) + tx * side * k * 2 - (player.p[0] / r) * k;
          az = az * (1 - k) + tz * side * k * 2 - (player.p[2] / r) * k;
        }
        const al = Math.hypot(ax, az) || 1;
        mx = ax / al;
        mz = az / al;
      }
    }
    if (S.t > player.flipAt || threatAhead(mx, mz)) {
      player.dir *= -1;
      player.flipAt = S.t + 8 + 4 * rnd(Math.floor(S.t));
    }
    player.p[0] += mx * PLAYER.run * dt;
    player.p[2] += mz * PLAYER.run * dt;
    player.moveDir = [mx, mz];
  }
  function expertTarget() {
    const eye = [player.p[0], player.p[1] + PLAYER.eye, player.p[2]];
    const REACH = SHARD.speed * SHARD.life * 0.92;
    const dist = (p) => {
      const d = Math.hypot(p[0] - eye[0], p[1] - eye[1], p[2] - eye[2]);
      return d < REACH ? d : Infinity; // out of reach is not a target
    };
    let best = null;
    let bs = Infinity;
    for (const c of censers) {
      const d = dist(c.p);
      const s = d < 30 ? d * 0.4 : Infinity; // in reach only: spawners at the rim have to come in
      if (s < bs) [best, bs] = [{p: c.p, v: [0, 0, 0]}, s];
    }
    // the swarm is swept, not picked off: three or more motes within 18 m make one target, their middle, led by their
    // mean velocity; a lone mote is a target only further out, where the aim can follow it
    // a swarm circling you has its middle on you, so aim at the fullest 30° slice of it instead
    const near = agents.filter((a) => a.kind === 'mote' && dist(a.p) < 18);
    if (near.length >= 3) {
      const bins = Array.from({length: 12}, () => []);
      for (const a of near) bins[Math.floor(((Math.atan2(a.p[2] - eye[2], a.p[0] - eye[0]) + Math.PI) / TAU) * 12) % 12].push(a);
      const full = bins.reduce((m, b) => (b.length > m.length ? b : m), []);
      if (full.length >= 2) {
        const c = [0, 0, 0];
        const v = [0, 0, 0];
        for (const a of full) {
          for (let k = 0; k < 3; k++) c[k] += a.p[k] / full.length;
          v[0] += (Math.cos(a.yaw) * a.v) / full.length;
          v[2] += (Math.sin(a.yaw) * a.v) / full.length;
        }
        const w = 6 - Math.min(3, full.length * 0.4);
        if (w < bs) [best, bs] = [{p: c, v}, w];
      }
    }
    for (const a of agents) {
      const d = dist(a.p);
      const w = a.kind === 'hound' || a.kind === 'warden' ? (d < 25 ? d * 0.3 : Infinity) : a.kind === 'stray' ? (d < 15 ? d : Infinity) : near.length < 3 && d > 6 && d < 22 ? d * 1.2 : Infinity;
      if (w < bs) [best, bs] = [{p: a.p, v: [Math.cos(a.yaw) * a.v, 0, Math.sin(a.yaw) * a.v]}, w];
    }
    for (const e of elites) {
      let p = e.p;
      let w = Infinity;
      const d0 = dist(p);
      if (e.kind === 'tithe') {
        p = e.head > 0.5 ? [e.p[0], E.tithe.headY * e.scale, e.p[2]] : [e.p[0], 0.9 * e.scale, e.p[2]]; // the head, or the body while it ducks
        w = dist(p) * 0.5;
      }
      else if (e.kind === 'egg') w = d0 < 25 ? d0 * 0.7 : Infinity;
      else if (e.kind === 'mite') w = d0 < 15 ? d0 * 0.6 : Infinity;
      else if (e.kind === 'eye' && eyeLanded(e, S.t)) w = d0 * 0.45;
      else if (e.kind === 'cantor' && e.g) {
        // the live weak point nearest the shooter (the far ones are behind the body, which soaks shards)
        e.g.userData.points.forEach((m, k) => {
          if (e.hp[k] <= 0) return;
          const q = m.getWorldPosition(new THREE.Vector3()).toArray();
          const wq = dist(q) < 40 ? dist(q) * 0.8 : Infinity;
          if (wq < w) [p, w] = [q, wq];
        });
      }
      if (w < bs) [best, bs] = [{p, v: [0, 0, 0]}, w];
    }
    for (const y of wyrms) {
      if (!y.P || y.w.state === 'under') continue;
      y.P.segs.forEach((sg, i) => {
        if (y.deadT[i] != null) return;
        const p = sg.p.map((x) => x * y.ws);
        const d = dist(p);
        const sc = d < 35 ? d * 0.6 : Infinity;
        if (sc < bs) [best, bs] = [{p, v: y.w.dir.map((x) => x * 16)}, sc];
      });
    }
    if (!best) return null;
    player.aimDist = dist(best.p);
    const tf = dist(best.p) / SHARD.speed;
    if (!Number.isFinite(tf)) return null;
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
    if (S.bot === 'expert' || S.bot === 'kite') {
      // the kite bot moves and hops exactly like the expert but never fires, so the horde builds up to its full volume
      expertMove(dt);
      if (IS_V2) expertHop();
      return verticalStep(dt);
    }
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
    verticalStep(dt);
  }
  // a jump, and a second one in the air (a double jump)
  function jump() {
    if (player.onGround) {
      player.vy = PLAYER.jump;
      player.onGround = false;
      player.airJumps = 1;
    } else if (player.airJumps > 0) {
      player.vy = PLAYER.jump;
      player.airJumps--;
    }
  }
  function verticalStep(dt) {
    player.vy -= PLAYER.g * dt;
    player.p[1] = Math.max(0, player.p[1] + player.vy * dt);
    if (player.p[1] === 0) {
      player.vy = 0;
      player.onGround = true;
    }
  }
  // the bot hops the front of the horde: a jump when motes are close ahead on its line, the second at the top
  function expertHop() {
    let threat = false;
    const dir = player.moveDir || [1, 0];
    for (const a of agents) {
      if (a.kind !== 'mote') continue;
      const dx = a.p[0] - player.p[0];
      const dz = a.p[2] - player.p[2];
      const d = Math.hypot(dx, dz);
      if (d < 4 && a.p[1] < player.p[1] + 2.2 && (dx * dir[0] + dz * dir[1]) / (d || 1) > 0.2) {
        threat = true;
        break;
      }
    }
    if (threat && (player.onGround || (player.vy < 0.5 && player.airJumps > 0))) jump();
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
    const cur = player.hand && player.hand.every(Number.isFinite) ? player.hand : want;
    const dot = Math.max(-1, Math.min(1, cur[0] * want[0] + cur[1] * want[1] + cur[2] * want[2]));
    const ang = Math.acos(dot);
    const maxA = 20 / SHARD.rate; // about 20 rad/s: a quick flick, like a strong player
    const u = ang > maxA ? maxA / ang : 1;
    const mix = cur.map((x, i) => x + (want[i] - x) * u);
    const ml = Math.hypot(...mix) || 1;
    player.hand = mix.map((x) => x / ml);
    return ang < 0.07 ? player.hand : (player.cool = 1 / SHARD.rate, null); // fire once on target (about 4°)
  }
  // seeking shards turn toward the nearest live target at a capped rate
  // distance from a point to the shard's path this step (from s.q to s.p)
  function segD(s, c) {
    const q = s.q || s.p;
    const d = [s.p[0] - q[0], s.p[1] - q[1], s.p[2] - q[2]];
    const L = d[0] * d[0] + d[1] * d[1] + d[2] * d[2] || 1e-9;
    const u = Math.max(0, Math.min(1, ((c[0] - q[0]) * d[0] + (c[1] - q[1]) * d[1] + (c[2] - q[2]) * d[2]) / L));
    return Math.hypot(q[0] + d[0] * u - c[0], q[1] + d[1] * u - c[1], q[2] + d[2] * u - c[2]);
  }
  function seekTurn(s, dt) {
    let best = null;
    let bd = 30;
    const consider = (p) => {
      const d = Math.hypot(p[0] - s.p[0], p[1] - s.p[1], p[2] - s.p[2]);
      if (d < bd) [best, bd] = [p, d];
    };
    const pale = wyrms.find((y) => y.w.variant === 'pale' && y.w.state !== 'under');
    if (pale) {
      best = pale.w.head;
      bd = Math.hypot(best[0] - s.p[0], best[1] - s.p[1], best[2] - s.p[2]) || 1;
      const want = [best[0] - s.p[0], best[1] - s.p[1], best[2] - s.p[2]].map((x) => x / bd);
      s.d = want; // every seeking shard goes to the Pale
      return;
    }
    for (const a of agents) consider(a.p);
    for (const c of censers) consider(c.p);
    for (const e of elites) if (e.kind !== 'briar') consider(e.kind === 'tithe' ? [e.p[0], E.tithe.headY * e.scale, e.p[2]] : e.p);
    if (!best) return;
    const want = [best[0] - s.p[0], best[1] - s.p[1], best[2] - s.p[2]].map((x) => x / bd);
    const k = Math.min(1, 9 * dt);
    const d = s.d.map((x, i) => x + (want[i] - x) * k);
    const l = Math.hypot(...d) || 1;
    s.d = d.map((x) => x / l);
  }
  // the power tier: the reference player's curve by time when the table runs; otherwise by orbs collected
  // seeking shards come from a store: after tier 3 every orb goes into it, and firing them spends it; tier 4 at 150 stored.
  // With the table running, the reference player's store over time stands in for it (less what the lab has spent).
  function curveAt(t, key) {
    const c = TABLE.power;
    if (t <= c[0].t) return c[0][key];
    for (let i = 1; i < c.length; i++) if (t <= c[i].t) return c[i - 1][key] + ((c[i][key] - c[i - 1][key]) * (t - c[i - 1].t)) / (c[i].t - c[i - 1].t);
    return c[c.length - 1][key];
  }
  function tierNow() {
    if (TABLE && S.spawn === 'table') {
      let tier = 1;
      for (const q of TABLE.power) if (S.t >= q.t) tier = q.tier;
      S.store = Math.max(0, Math.round(curveAt(S.t, 'seeking')) - (S.spent || 0));
      return tier;
    }
    const o = S.orbs || 0;
    S.store = Math.max(0, (S.stored || 0) - (S.spent || 0));
    return o >= 70 && (S.stored || 0) >= TIERS.storeFor4 ? 4 : o >= 70 ? 3 : o >= 10 ? 2 : 1;
  }
  function runTable() {
    while (S.ti < TABLE.entries.length && TABLE.entries[S.ti].t <= S.t) {
      const id = TABLE_IDS[TABLE.entries[S.ti].enemy];
      if (id) spawnById(id);
      S.ti++;
    }
  }
  // a jump's lead-in: the player moves but does not shoot; instead each enemy dies at a steady rate set by how long a
  // strong player leaves it alive (mean seconds, EST), so what is still about when you land is a believable crowd
  const LIFE = {mote: 9, stray: 10, hound: 6, warden: 18, censer: 10, twin: 12, great: 25, tithe: 15, great_tithe: 30, egg: 6, mite: 4, spinewyrm: 20, elder: 35, pale: 60};
  const LEAD = 75;
  function leadInCull(dt) {
    let k = 0;
    const dies = (life, id) => life && rnd(id * 7.31 + Math.floor(S.t * 120) * 0.013 + k++) < dt / life;
    for (const a of agents) if (dies(LIFE[a.kind], a.id)) a.alive = false;
    // spawners and elites under 20 s old are left alone, so a jump always shows what just arrived
    for (const c of censers) if (S.t - c.born > 20 && dies(LIFE[c.type], c.seed)) c.hp = 0;
    for (const e of elites) if (!(e.kind === 'tithe' && S.t - e.born < 20) && dies(LIFE[e.kind === 'tithe' && e.great ? 'great_tithe' : e.kind], e.id)) e.alive = false;
    for (const y of wyrms) if (dies(LIFE[y.w.variant], y.w.id)) y.deadT.fill(S.t);
  }
  /** The swarm size the captures show at run time t (median eye dots, scaled to motes), if the build carries it. */
  function swarmAt(t) {
    const c = TABLE && TABLE.swarm;
    if (!c || !c.length) return null;
    if (t <= c[0][0]) return c[0][1];
    for (let i = 1; i < c.length; i++) if (t <= c[i][0]) return c[i - 1][1] + ((c[i][1] - c[i - 1][1]) * (t - c[i - 1][0])) / (c[i][0] - c[i - 1][0]);
    return c[c.length - 1][1];
  }
  /** Top the Ash Motes up (or thin them) to the captured swarm size, placing new ones already circling the player. */
  function matchSwarm(T) {
    const want = swarmAt(T);
    if (want == null) return;
    const motes = agents.filter((a) => a.kind === 'mote');
    const n = Math.round(want * (IS_V2 ? V2.moteMul : 1));
    for (let i = n; i < motes.length; i++) motes[i].alive = false;
    for (let i = motes.length; i < n; i++) {
      const a = rnd(nid * 3.7) * TAU;
      const r = 10 + 8 * rnd(nid * 5.3);
      const at = [player.p[0] + r * Math.cos(a), 3, player.p[2] + r * Math.sin(a)];
      spawnAgent('mote', at);
      const m = agents[agents.length - 1];
      m.born = S.t - 5; // already out of the censer
      m.yaw = a - Math.PI / 2;
    }
    agents = agents.filter((a) => a.alive);
  }
  /** Jump to time T: clear, run a lead-in before T with the cull above, then match the swarm to the captures. */
  function jumpTo(T) {
    clearAll();
    S.t = Math.max(0, T - LEAD);
    S.ti = TABLE.entries.findIndex((e) => e.t >= S.t - 1e-6);
    if (S.ti < 0) S.ti = TABLE.entries.length;
    player.p = [0, 0, 0];
    S.ff = true;
    const bot = S.bot;
    S.bot = 'expert';
    let n = 0;
    while (S.t < T && n++ < LEAD * 120 + 10) {
      sim(DT);
      leadInCull(DT);
    }
    matchSwarm(T);
    S.holdFire = T + 4; // the bot holds fire for 4 s after a jump, so you can see what is there
    S.bot = bot;
    S.ff = false;
    S.hits = 0;
  }
  function waves() {
    if (S.spawn === 'table') return runTable();
    if (S.spawn !== 'waves' || S.t < S.nextWave) return;
    S.wave++;
    // our own schedule for the lab (not the reference's): a Censer every wave, a Twin every 3rd, a Great every 6th
    addCenser(S.wave % 6 === 0 ? 'great' : S.wave % 3 === 0 ? 'twin' : 'censer');
    if (S.wave % 4 === 0) addWyrm();
    if (S.wave === 5 || S.wave === 10) addElite(newTithe(nid++, S.t));
    if (S.wave === 7) for (let k = 0; k < 3; k++) spawnById('briar');
    if (S.wave === 8) addElite(newCantor(nid++, S.t));
    S.nextWave = S.t + (S.wave < 3 ? 10 : 20);
  }
  function sim(dt) {
    S.t += dt;
    waves();
    playerStep(dt);
    const r0 = Math.hypot(player.p[0], player.p[2]);
    if (r0 > arenaAt(S.t) + 0.5) {
      // off the floor: a fall. The lab counts it and puts you back in the middle
      if (!S.ff) {
        S.hits++;
        S.falls = (S.falls || 0) + 1;
      }
      player.p = [0, 0, 0];
    }
    const pl = [player.p[0], player.p[1], player.p[2]];
    for (const c of censers) {
      stepCenser(c, S.t, dt);
      c.g.position.set(c.p[0], c.p[1] + 0.4 * Math.sin(S.t * 1.3 + c.seed), c.p[2]);
      c.g.rotation.y = -c.heading;
      c.rollG.rotation.x = c.roll;
      if (S.t >= c.nextBurst) {
        release(c);
        c.nextBurst += M.censer.every;
      }
      c.queue = c.queue.filter(([at, kind]) => {
        if (S.t < at) return true;
        spawnAgent(kind, [c.p[0], c.p[1] + 2 * c.size, c.p[2]]);
        return false;
      });
    }
    // the Spinewyrm: the head moves, the body rides its trail (local units are world / WS)
    for (const y of wyrms) {
      stepWyrm(y.w, [pl[0], pl[1] + PLAYER.eye, pl[2]], S.t, dt);
      y.trail.push(y.w.head.map((x) => x / y.ws));
      y.phase += 9 * dt;
      y.P = pose(y.trail, y.trail.length, y.phase);
      if (y.w.state !== 'under' && S.t - (y.lastHit ?? -9) > 1 && Math.hypot(y.w.head[0] - pl[0], y.w.head[1] - pl[1] - 1, y.w.head[2] - pl[2]) < 2) {
        S.hits++; // one hit per contact, not one per frame
        y.lastHit = S.t;
      }
    }
    // the rest of the roster
    for (const pe of S.pendingEyes || []) if (!pe.done && S.t >= pe.at) {
      pe.done = true;
      addElite(newEye(nid++, pe.p, pe.died));
    }
    let caller = null;
    for (const e of elites) {
      if (e.kind === 'tithe') stepTithe(e, pl, orbs, S.t, dt, (p, t) => addElite(newEgg(nid++, p, t)), arenaAt(S.t) - 1.5);
      else if (e.kind === 'egg' && eggHatched(e, S.t)) {
        e.alive = false;
        for (let k = 0; k < E.egg.mites; k++) addElite(newMite(nid++, [e.p[0] + Math.cos(k) * 0.8, 0, e.p[2] + Math.sin(k) * 0.8], S.t));
      } else if (e.kind === 'mite') {
        stepMite(e, pl, S.t, dt);
        if (Math.hypot(e.p[0] - pl[0], e.p[2] - pl[2]) < 0.9 && pl[1] < 1) {
          S.hits++;
          e.alive = false;
        }
      } else if (e.kind === 'cantor') {
        stepCantor(e, S.t, dt);
        if (cantorCalling(e, S.t)) caller = e.p;
      } else if (e.kind === 'eye') {
        stepEye(e, S.t);
        e.p[1] = eyeLanded(e, S.t) ? 2 : E.cantor.hover - (E.cantor.hover - 2) * Math.min(1, (S.t - e.died) / E.cantor.eyeDrop);
        if (eyeCalling(e, S.t)) caller = e.p;
      } else if (e.kind === 'briar') {
        const q = pushOut(e, player.p, S.t);
        player.p[0] = q[0];
        player.p[2] = q[2];
      }
    }
    // orbs: fall, magnet to the player, picked up
    for (const o of orbs) {
      if (o.taken) continue;
      o.p[1] = Math.max(0.35, o.p[1] - ORB.fall * dt);
      const dx = pl[0] - o.p[0];
      const dz = pl[2] - o.p[2];
      const d = Math.hypot(dx, dz);
      if (d < ORB.take) {
        o.taken = true;
        if ((S.orbs || 0) >= 70) S.stored = (S.stored || 0) + 1; // after tier 3 orbs fill the seeking store
        else S.orbs = (S.orbs || 0) + 1;
      } else if (d < ORB.magnet && !o.pulled) {
        o.p[0] += (dx / d) * ORB.pull * dt;
        o.p[2] += (dz / d) * ORB.pull * dt;
      }
      o.pulled = false;
    }
    orbs = orbs.filter((o) => !o.taken && S.t - o.born < 40);
    S.calling = !!caller;
    M.mote.turn = tune.turn;
    let closest = Infinity;
    const horde = [];
    for (const a of agents) {
      if (a.kind === 'mote') {
        a.v = tune.v * (a.vj ?? (a.vj = 0.92 + 0.16 * rnd(a.id * 3)));
        a.R = S.model === 'pursuit' ? 0.001 : tune.ring * (a.rj ?? (a.rj = 0.9 + 0.2 * rnd(a.id * 5)));
      }
      if (caller) callPull(a, caller, dt); // a call drags every chaser and wanderer in; on arrival it turns Fevered
      else if (IS_V2 && a.kind === 'mote' && S.t - a.born > a.rise) horde.push(a); // stepped together below
      else step(a, pl, S.t, dt);
      const d = Math.hypot(a.p[0] - pl[0], a.p[1] - pl[1] - 1, a.p[2] - pl[2]);
      closest = Math.min(closest, d);
      if (d < LOOK[a.kind].r + 0.5 && !S.ff) {
        S.hits++;
        a.alive = false;
      }
    }
    S.hordeAcc = (S.hordeAcc || 0) + dt;
    if (horde.length && S.hordeAcc >= 1 / 60 - 1e-9) {
      // the horde steps at 60 Hz (every other lab step): plenty for a crowd, half the cost
      stepHorde(horde, pl, S.t, S.hordeAcc);
      S.hordeAcc = 0;
      for (const a of horde) {
        const d = Math.hypot(a.p[0] - pl[0], a.p[1] - pl[1] - 1, a.p[2] - pl[2]);
        closest = Math.min(closest, d);
        if (d < LOOK.mote.r + 0.5 && !S.ff) {
          S.hits++;
          a.alive = false;
        }
      }
    }
    S.closest = closest;
    player.cool -= dt;
    player.seekCool = (player.seekCool ?? 0) - dt;
    S.tier = tierNow();
    SHARD.rate = TIERS.rapid[S.tier - 1];
    const firing = !S.ff && S.t >= (S.holdFire ?? 0) && (S.bot === 'expert' || player.fire); // no fire in a jump's lead-in: the cull stands in for it
    player.shotCool = (player.shotCool ?? 0) - dt;
    const tapped = firing && (player.shotgun || (S.bot === 'expert' && player.aim && (player.aimDist ?? 99) < 12));
    if (firing && !tapped && player.shotCool <= 0) {
      while (player.cool <= 0) {
        const dir = aimDir();
        player.aim = dir;
        if (!dir) break;
        player.cool += 1 / SHARD.rate;
        const j = (k) => (rnd(nid++ * 11 + k) - 0.5) * SHARD.spread;
        shards.push({p: [pl[0], pl[1] + PLAYER.eye - 0.2, pl[2]], d: [dir[0] + j(1), dir[1] + j(2), dir[2] + j(3)], t: S.t, dmg: 1});
      }
      const sr = TIERS.seek[S.tier - 1];
      if (sr > 0 && player.aim) {
        while (player.seekCool <= 0 && S.store > 0) {
          player.seekCool += 1 / sr;
          S.store--;
          S.spent = (S.spent || 0) + 1;
          shards.push({p: [pl[0], pl[1] + PLAYER.eye, pl[2]], d: [...player.aim], t: S.t, seek: true});
        }
      }
    }
    if (tapped) {
      // the shotgun: a burst per tap (the bot taps it when a target is within 12 m); the stream waits for its cooldown
      player.aim = aimDir() || player.aim; // a fresh aim for every burst (the stream's last aim may be stale)
      const onTarget = !!aimDir();
      if (player.shotCool <= 0 && player.aim && onTarget) {
        player.shotgun = false;
        player.shotCool = 0.35;
        const n = TIERS.shotgun[S.tier - 1];
        for (let k = 0; k < n; k++) {
          const j = (q) => (rnd(nid++ * 13 + q) - 0.5) * 0.14;
          shards.push({p: [pl[0], pl[1] + PLAYER.eye - 0.2, pl[2]], d: [player.aim[0] + j(1), player.aim[1] + j(2), player.aim[2] + j(3)], t: S.t});
        }
        const ns = Math.min(TIERS.seekShotgun[S.tier - 1], S.store);
        for (let k = 0; k < ns; k++) shards.push({p: [pl[0], pl[1] + PLAYER.eye, pl[2]], d: [...player.aim], t: S.t, seek: true});
        S.store -= ns;
        S.spent = (S.spent || 0) + ns;
      }
    }
    if (player.cool < 0) player.cool = 0;
    if (player.seekCool < 0) player.seekCool = 0;
    // the agents on a 4 m floor grid, so a shard tests only the few near its path (thousands of motes in V2)
    const AG = new Map();
    if (shards.length) {
      for (let i = 0; i < agents.length; i++) {
        const k = ((Math.floor(agents[i].p[0] / 4) + 512) << 10) | (Math.floor(agents[i].p[2] / 4) + 512);
        let b = AG.get(k);
        if (!b) AG.set(k, (b = []));
        b.push(i);
      }
    }
    const near = [];
    for (const s of shards) {
      if (s.seek) seekTurn(s, dt);
      s.q = [...s.p]; // where it was: hits are tested along the whole step, so a 1 m step cannot skip a small target
      for (let k = 0; k < 3; k++) s.p[k] += s.d[k] * SHARD.speed * dt;
      // cells under the step, padded by the biggest reach (a Warden, 2.4 m); lowest index first, as the full scan had it
      near.length = 0;
      const x0 = Math.floor((Math.min(s.q[0], s.p[0]) - 2.5) / 4);
      const x1 = Math.floor((Math.max(s.q[0], s.p[0]) + 2.5) / 4);
      const z0 = Math.floor((Math.min(s.q[2], s.p[2]) - 2.5) / 4);
      const z1 = Math.floor((Math.max(s.q[2], s.p[2]) + 2.5) / 4);
      for (let ix = x0; ix <= x1; ix++) for (let iz = z0; iz <= z1; iz++) {
        const b = AG.get(((ix + 512) << 10) | (iz + 512));
        if (b) for (const i of b) near.push(i);
      }
      if (near.length > 1) near.sort((x, y) => x - y);
      for (const ni of near) {
        const a = agents[ni];
        if (!a.alive) continue;
        if (segD(s, a.p) < LOOK[a.kind].r * LOOK[a.kind].len + 0.2) {
          s.dead = true;
          a.hp -= dmgOf(s, a.kind);
          if (a.hp <= 0) {
            a.alive = false;
            S.kills++;
            dropOrbs(a.p, ORBS[a.kind] || 0);
          }
          break;
        }
      }
      if (s.dead) continue;
      for (const e of elites) {
        if (!e.alive || s.dead) continue;
        if (e.kind === 'tithe') {
          // it can always be hurt: the head while it is up, the body while it ducks (ducking only stops it eating orbs)
          const headHit = e.head >= 0.5 && segD(s, [e.p[0], E.tithe.headY * e.scale, e.p[2]]) < 1.2 * e.scale;
          const bodyHit = segD(s, [e.p[0], 0.9 * e.scale, e.p[2]]) < 2.3 * e.scale;
          if (headHit || bodyHit) {
            s.dead = true;
            e.lastHit = S.t;
            e.hp -= dmgOf(s, e.kind);
            if (e.hp <= 0) {
              e.alive = false;
              S.kills++;
              dropOrbs([e.p[0], 2, e.p[2]], ORBS.tithe);
            }
          }
        } else if (e.kind === 'egg' || e.kind === 'mite') {
          if (segD(s, e.p) < 0.7) {
            s.dead = true;
            e.hp -= dmgOf(s, e.kind);
            if (e.hp <= 0) {
              e.alive = false;
              S.kills++;
            }
          }
        } else if (e.kind === 'briar') {
          if (briarUp(e, S.t) > 0.5 && Math.hypot(e.p[0] - s.p[0], e.p[2] - s.p[2]) < E.briar.r && s.p[1] < 4.5) {
            s.dead = true;
            e.hp -= dmgOf(s, e.kind);
            if (e.hp <= 0) e.alive = false;
          }
        } else if (e.kind === 'eye') {
          if (eyeLanded(e, S.t) && segD(s, e.p) < 2.1) {
            s.dead = true;
            e.lastHit = S.t;
            e.hp -= dmgOf(s, e.kind);
            if (e.hp <= 0) e.alive = false;
          }
        } else if (e.kind === 'cantor' && e.g) {
          e.g.userData.points.forEach((m, k) => {
            if (s.dead || e.hp[k] <= 0) return;
            const v = new THREE.Vector3();
            m.getWorldPosition(v);
            if (segD(s, v.toArray()) < 1.1 * E.cantor.scale) {
              s.dead = true;
              e.hp[k] -= dmgOf(s, 'cantor');
              if (e.hp[k] <= 0) m.visible = false;
            }
          });
          if (!s.dead && Math.hypot(e.p[0] - s.p[0], e.p[1] - s.p[1], e.p[2] - s.p[2]) < 4.6 * E.cantor.scale) s.dead = true; // the body soaks shards
          if (e.hp.every((h) => h <= 0)) {
            e.alive = false;
            S.kills++;
            dropOrbs(e.p, ORBS.cantor);
            addElite(newEye(nid++, e.p, S.t)); // it falls for 3.32 s and can only be hit once it has landed
          }
        }
      }
      if (s.dead) continue;
      for (const y of wyrms) {
        if (!y.P || y.w.state === 'under') continue;
        if (s.seek && y.w.variant === 'pale' && Math.hypot(y.w.head[0] - s.p[0], y.w.head[1] - s.p[1], y.w.head[2] - s.p[2]) < 4) {
          s.dead = true; // the Pale swallows seeking shards
          break;
        }
        if (s.seek && y.w.variant === 'pale') continue; // seeking shards pass through its body
        for (let i = 0; i < y.P.segs.length && !s.dead; i++) {
          if (y.deadT[i] != null) continue;
          const q = y.P.segs[i].p;
          if (segD(s, [q[0] * y.ws, q[1] * y.ws, q[2] * y.ws]) < 0.4 * y.ws * y.P.segs[i].w) {
            s.dead = true;
            y.hitT[i] = S.t;
            y.hp[i] -= dmgOf(s, 'wyrm');
            if (y.hp[i] <= 0) {
              y.deadT[i] = S.t;
              y.orbAcc = (y.orbAcc ?? 0) + WYRMS[y.w.variant].orbsPerPoint;
              const n = Math.floor(y.orbAcc);
              y.orbAcc -= n;
              dropOrbs(q.map((x) => x * y.ws), n);
            }
          }
        }
      }
      if (s.dead) continue;
      for (const c of censers) {
        if (segD(s, c.p) < c.r) {
          c.hp -= dmgOf(s, c.type);
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
        dropOrbs(c.p, ORBS[c.type]);
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
    for (const e of elites) if (!e.alive && e.g) scene.remove(e.g);
    elites = elites.filter((e) => e.alive);
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
  const WHITE = new THREE.Color(1, 1, 1);
  const FEVER = new THREE.Color(1, 0.38, 0.3);
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
      // a yaw about +y and a translation, written straight into the instance buffers (no allocation per mote)
      const c = Math.cos(ag.yaw);
      const sn = Math.sin(ag.yaw);
      const B = G.body.instanceMatrix.array;
      const o = i * 16;
      B[o] = c; B[o + 1] = 0; B[o + 2] = sn; B[o + 3] = 0;
      B[o + 4] = 0; B[o + 5] = 1; B[o + 6] = 0; B[o + 7] = 0;
      B[o + 8] = -sn; B[o + 9] = 0; B[o + 10] = c; B[o + 11] = 0;
      B[o + 12] = ag.p[0]; B[o + 13] = ag.p[1]; B[o + 14] = ag.p[2]; B[o + 15] = 1;
      if (ag.fevered || ag.wasFevered) {
        G.body.setColorAt(i, ag.fevered ? FEVER : WHITE);
        ag.wasFevered = ag.fevered;
      } else if (G.tint[i]) G.body.setColorAt(i, WHITE);
      G.tint[i] = ag.fevered ? 1 : 0;
      const fx = G.L.r * G.L.len * 0.85;
      const fy = G.L.r * 0.25;
      const E = G.eye.instanceMatrix.array;
      for (let sd = -1; sd <= 1; sd += 2) {
        const sz = sd * G.L.r * 0.35;
        const q = (i * 2 + (sd > 0 ? 1 : 0)) * 16;
        E[q] = 1; E[q + 1] = 0; E[q + 2] = 0; E[q + 3] = 0;
        E[q + 4] = 0; E[q + 5] = 1; E[q + 6] = 0; E[q + 7] = 0;
        E[q + 8] = 0; E[q + 9] = 0; E[q + 10] = 1; E[q + 11] = 0;
        E[q + 12] = ag.p[0] + fx * c - sz * sn; E[q + 13] = ag.p[1] + fy; E[q + 14] = ag.p[2] + fx * sn + sz * c; E[q + 15] = 1;
      }
    }
    for (const [kind, G] of Object.entries(meshes)) {
      G.body.count = Math.min(n[kind], G.L.max);
      G.eye.count = G.body.count * 2;
      G.body.instanceMatrix.needsUpdate = G.eye.instanceMatrix.needsUpdate = true;
      if (G.body.instanceColor) G.body.instanceColor.needsUpdate = true;
    }
    let no = 0;
    for (const o of orbs) {
      if (no >= 300) break;
      orbMesh.setMatrixAt(no++, M4.compose(tmp.set(o.p[0], o.p[1] + 0.15 * Math.sin(S.t * 4 + o.born), o.p[2]), Q.identity(), ONE));
    }
    orbMesh.count = no;
    orbMesh.instanceMatrix.needsUpdate = true;
    let nmi = 0;
    let neg = 0;
    for (const e of elites) {
      if (e.kind === 'mite' && nmi < 120) {
        Q.setFromAxisAngle(UPV, -(e.yaw || 0));
        miteMesh.setMatrixAt(nmi++, M4.compose(tmp.set(...e.p), Q, ONE));
      } else if (e.kind === 'egg' && neg < 60) {
        const sw = 1 + 0.12 * Math.sin((S.t - e.born) * (2 + (S.t - e.born)));
        eggMesh.setMatrixAt(neg++, M4.compose(tmp.set(...e.p), Q.identity(), new THREE.Vector3(sw, sw, sw)));
      } else if (e.g) {
        e.g.position.set(...e.p);
        if (e.kind === 'tithe') {
          e.g.rotation.y = -e.yaw;
          const h = e.head;
          e.g.userData.neck.scale.y = Math.max(0.05, h * (E.tithe.headY - 1));
          e.g.userData.head.position.y = 1 + h * (E.tithe.headY - 1);
        } else if (e.kind === 'cantor') {
          e.g.position.y = e.p[1] + 0.5 * Math.sin(S.t * 0.8);
          e.g.rotation.y = -e.spin;
          const on = cantorCalling(e, S.t);
          const u = on ? ((S.t - e.born - E.cantor.firstCall) % E.cantor.every) / E.cantor.call : 0;
          e.g.userData.ring.visible = on;
          e.g.userData.ring.scale.setScalar(4 + 26 * u);
          mat.cantor.emissiveIntensity = cantorAwake(e, S.t) ? (on ? 0.5 : 0.08) : 0;
        } else if (e.kind === 'eye') {
          const look = Math.atan2(player.p[2] - e.p[2], player.p[0] - e.p[0]);
          e.g.rotation.y = -look;
          e.g.userData.iris.material = eyeStunned(e, S.t) ? mat.dark : mat.accent;
          const on = eyeCalling(e, S.t);
          e.g.userData.ring.visible = on;
          e.g.userData.ring.scale.setScalar(on ? 3 + 20 * (1 - (e.callEnd - S.t) / 1.2) : 1);
        } else if (e.kind === 'briar') {
          e.g.scale.set(1, Math.max(0.01, briarUp(e, S.t)), 1);
        }
      }
    }
    miteMesh.count = nmi;
    eggMesh.count = neg;
    miteMesh.instanceMatrix.needsUpdate = eggMesh.instanceMatrix.needsUpdate = true;
    shardMesh.count = Math.min(shards.length, MAXSH);
    shards.slice(0, MAXSH).forEach((s, i) => {
      Q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(...s.d).normalize());
      shardMesh.setMatrixAt(i, M4.compose(tmp.set(...s.p), Q, ONE));
    });
    shardMesh.instanceMatrix.needsUpdate = true;
    trails.visible = S.view === 'top' && !IS_V2; // too many motes for trails in V2
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
    const sc = arenaAt(S.t) / M.arenaR;
    disc.scale.set(sc, 1, sc);
    for (const b of bands) b.visible = b.userData.r < arenaAt(S.t) - 0.5; // rings past the edge go with the floor
    halo.visible = S.view === 'top' && !S.cam;
    halo.position.set(player.p[0], 0.05, player.p[2]);
    glow.position.set(player.p[0], player.p[1] + 1.4, player.p[2]);
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
    if (S.cam) cam = S.cam; // the art capture's orbit cameras (tools/capture-cb.mjs)
    for (const y of wyrms) {
      if (!y.P) continue;
      y.wrap.visible = y.w.state !== 'under' || y.w.head[1] > -12;
      const ws = (i) => ({open: 1, hit: S.t - y.hitT[i] < 0.12 ? 1 - (S.t - y.hitT[i]) / 0.12 : 0, dead: y.deadT[i] == null ? 0 : Math.min(1, (S.t - y.deadT[i]) / 0.1), pulse: 0.5 + 0.5 * Math.sin(S.t * 5 - i * 0.55)});
      y.body.update(y.P, cam, ws, 0.5 + 0.5 * Math.sin(S.t * 2.3));
    }
    scene.fog = S.view === 'fp' && !S.cam ? fog : null; // the top-down camera sits 200 m up, past the fog
    renderer.render(scene, cam);
    const count = (k) => agents.filter((x) => x.kind === k).length;
    document.getElementById('hud').textContent = `${S.view === 'fp' ? 'FIRST PERSON' : 'TOP DOWN'} · ${count('mote')} MOTES · ${count('stray')} STRAYS · ${count('hound')} HOUNDS · ${count('warden')} WARDENS · ${wyrms.length} WYRMS · ${censers.length} CENSERS · ${elites.filter((e) => ['tithe', 'cantor', 'eye', 'briar'].includes(e.kind)).length} ELITES`;
    document.getElementById('stats').innerHTML = [
      ['Time', `${fmt(S.t)} (${S.t.toFixed(1)} s)`],
      ['Spawning', S.spawn === 'table' ? `table ${S.ti}/${TABLE.entries.length}` : S.spawn === 'waves' ? `wave ${S.wave}` : 'off'],
      ['Tier', `${S.tier ?? 1} · ${Math.round(SHARD.rate)}/s`],
      ['Seeking store', `${S.store ?? 0}`],
      ['Floor', `${arenaAt(S.t).toFixed(1)} m`],
      ['Kills', S.kills],
      ['Orbs', S.orbs || 0],
      ['Loose orbs', orbs.length],
      ['Call', S.calling ? 'NOW' : '-'],
      ['Hits taken', S.hits],
      ['Closest', Number.isFinite(S.closest) ? `${S.closest.toFixed(1)} m` : '-'],
    ].map(([k, v]) => `<span>${k}</span><span>${v}</span>`).join('');
  }

  // ---------------------------------------------------------------- loop
  let last = performance.now();
  let acc = 0;
  function tick(now) {
    acc = Math.min(acc + (now - last) / 1000, 5 * DT);
    last = now;
    if (S.paused) acc = 0; // the art capture freezes the pose
    while (acc >= DT) {
      sim(DT);
      acc -= DT;
    }
    draw();
    frame++;
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
  window.CB = {S, player, shards: () => shards, aimDir: () => aimDir(), jumpTo: (t) => TABLE && jumpTo(t), agents: () => agents, censers: () => censers, wyrms: () => wyrms, elites: () => elites, orbs: () => orbs, sim, M, spawn: (id) => spawnById(id), clear: clearAll, three: THREE, scene};
}
