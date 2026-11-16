// The V2 horde on a hub arena: the swarm behaviours from the Chopping Block V2 page (../cb-shared), scaled to this
// floor. Censers come in from past the rim on the "Our waves" clock (a Censer every wave, a Twin every 3rd, a Great
// every 6th; 10 s apart for the first three, then 20 s) and pour four times the motes of the 1:1 study. The motes
// fly as one horde (horde.js): flung high out of the censer, the nearest 140 chase and dive, the rest trail high in
// a loose cloud. Strays wander, Hounds and Wardens circle and charge on the loiter field (swarm.js). The chase pace is
// set under this stage's run speed, so a steady run kites the horde here too. No three.js state outside this module.
import * as THREE from 'three';
import {stepHorde} from '../cb-shared/horde.js';
import {burst, M, newMote, newStray, rnd, step} from '../cb-shared/swarm.js';

export const HORDE = {
  moteMul: 4, // motes per burst against the 1:1 study
  pour: 0.3, // s between the copies of one mote (a burst pours out over about 1.6 s)
  maxMotes: 1200, // a burst past this skips its motes (keeps the hub light)
  maxCensers: 6,
  chaseOfRun: 0.66, // the horde's chase pace as a share of the player's run (V2: 10.5 of 16)
  studyR: 47.5, // the Chopping Block floor the censer numbers were measured on
};

// bodies: the V2 page's stand-ins (a sphere stretched along its heading, two eyes)
const LOOK = {
  mote: {r: 0.42, len: 1, color: '#d8cfc0', eye: 0.12, max: HORDE.maxMotes},
  stray: {r: 0.8, len: 1.1, color: '#6e332d', eye: 0.2, max: 40},
  hound: {r: 0.55, len: 1.9, color: '#c0281c', eye: 0.14, max: 40},
  warden: {r: 1.7, len: 1.3, color: '#8f8578', eye: 0.35, max: 20},
};
const CENSER = {censer: {size: 1, color: '#9c4436'}, twin: {size: 1.25, color: '#a8533a'}, great: {size: 1.7, color: '#7a2e2a'}};

/**
 * @param parent  group the meshes go in
 * @param o       {R: floor radius (m), floorY: floor top (m), run: the player's run speed (m/s)}
 */
export function createHordeSwarm(parent, {R, floorY, run}) {
  const k = R / HORDE.studyR; // the censer distances scale with the floor; bodies and speeds stay real size
  const g = new THREE.Group();
  parent.add(g);
  const meshes = {};
  for (const [kind, L] of Object.entries(LOOK)) {
    const body = new THREE.InstancedMesh(new THREE.SphereGeometry(L.r, 10, 7).scale(L.len, 1, 1), new THREE.MeshStandardMaterial({color: L.color, roughness: 0.85, flatShading: true}), L.max);
    const eye = new THREE.InstancedMesh(new THREE.SphereGeometry(L.eye, 4, 3), new THREE.MeshBasicMaterial({color: '#ff3b1f'}), L.max * 2);
    body.castShadow = true;
    body.frustumCulled = eye.frustumCulled = false; // instances spread far from the mesh origin
    body.count = eye.count = 0;
    g.add(body, eye);
    meshes[kind] = {body, eye, L};
  }
  const agents = [];
  const censers = [];
  let nid = 1;
  let T = 0;
  let wave = 0;
  let nextWave = 1;
  const motes = () => agents.reduce((n, a) => n + (a.kind === 'mote'), 0);

  function addCenser(type) {
    if (censers.length >= HORDE.maxCensers) return;
    const ang = rnd(nid * 7 + 1) * Math.PI * 2;
    const r0 = R + 14;
    const C = CENSER[type];
    const m = new THREE.Group();
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(1.4 * C.size, 1.4 * C.size, 0.5 * C.size, 14), new THREE.MeshStandardMaterial({color: C.color, roughness: 0.8, flatShading: true}));
    disc.castShadow = true;
    m.add(disc);
    for (let s = 0; s < 8; s++) {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.16 * C.size, 1.2 * C.size, 5), new THREE.MeshStandardMaterial({color: '#2a1c1a', flatShading: true}));
      const a = (s / 8) * Math.PI * 2;
      spike.position.set(Math.cos(a) * 1.8 * C.size, 0, Math.sin(a) * 1.8 * C.size);
      spike.rotation.z = -Math.PI / 2;
      spike.rotation.y = -a;
      m.add(spike);
    }
    g.add(m);
    censers.push({id: nid++, type, size: C.size, p: [r0 * Math.cos(ang), floorY + M.censer.height, r0 * Math.sin(ang)], born: T, next: T + M.censer.first, settled: false, goal: null, queue: [], mesh: m, roll: 0});
  }

  function release(c) {
    for (const [dt, kind] of burst(c.id * 7 + Math.floor(T), c.type)) {
      if (kind === 'mote') {
        if (motes() + c.queue.length >= HORDE.maxMotes) continue;
        for (let q = 0; q < HORDE.moteMul; q++) c.queue.push([T + dt + q * HORDE.pour + rnd(nid++) * 0.2, kind]);
      } else c.queue.push([T + dt, kind]);
    }
  }

  function spawnAgent(kind, at, pl) {
    const a = kind === 'stray' ? newStray(nid++, at, T) : newMote(nid++, at, [pl[0], pl[2]], T, kind);
    if (kind === 'stray') a.lastN = -1;
    agents.push(a);
  }

  function stepCenser(c, dt) {
    const r = Math.hypot(c.p[0], c.p[2]);
    const settle = M.censer.settle * k;
    if (!c.settled && r <= settle + 0.5) c.settled = true;
    let tx;
    let tz;
    let v;
    if (!c.settled) {
      [tx, tz, v] = [0, 0, M.censer.drift]; // straight in over the rim
    } else {
      // then a slow wander between wanderIn and wanderOut (scaled)
      const gr = Math.hypot(...(c.goal || [0, 0]));
      if (!c.goal || Math.hypot(c.goal[0] - c.p[0], c.goal[1] - c.p[2]) < 0.5 || gr < M.censer.wanderIn * k) {
        const a = rnd(c.id * 13 + Math.floor(T)) * Math.PI * 2;
        const rr = (M.censer.wanderIn + (M.censer.wanderOut - M.censer.wanderIn) * rnd(c.id * 29 + Math.floor(T))) * k;
        c.goal = [rr * Math.cos(a), rr * Math.sin(a)];
      }
      [tx, tz, v] = [c.goal[0], c.goal[1], M.censer.wander];
    }
    const dx = tx - c.p[0];
    const dz = tz - c.p[2];
    const d = Math.hypot(dx, dz) || 1;
    c.p[0] += (dx / d) * v * dt;
    c.p[2] += (dz / d) * v * dt;
    c.roll += M.censer.roll * dt;
    c.mesh.position.set(...c.p);
    c.mesh.rotation.set(Math.sin(c.roll) * 0.25, c.roll * 0.6, 0);
    if (T >= c.next) {
      release(c);
      c.next += M.censer.every;
    }
    const top = [c.p[0], c.p[1] + 2 * c.size, c.p[2]];
    c.queue = c.queue.filter(([at, kind]) => (T < at ? true : (spawnAgent(kind, top, c.pl), false)));
  }

  function draw() {
    const n = {mote: 0, stray: 0, hound: 0, warden: 0};
    for (const ag of agents) {
      const G = meshes[ag.kind];
      const i = n[ag.kind]++;
      if (i >= G.L.max) continue;
      const c = Math.cos(ag.yaw);
      const sn = Math.sin(ag.yaw);
      const B = G.body.instanceMatrix.array;
      const o = i * 16;
      B[o] = c; B[o + 1] = 0; B[o + 2] = sn; B[o + 3] = 0;
      B[o + 4] = 0; B[o + 5] = 1; B[o + 6] = 0; B[o + 7] = 0;
      B[o + 8] = -sn; B[o + 9] = 0; B[o + 10] = c; B[o + 11] = 0;
      B[o + 12] = ag.p[0]; B[o + 13] = ag.p[1]; B[o + 14] = ag.p[2]; B[o + 15] = 1;
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
    }
  }

  return {
    group: g,
    counts: () => ({motes: motes(), others: agents.length - motes(), censers: censers.length, wave}),
    /** ctx: the hub's per-tick context (dt, hunt, player, hurt, speedMul). */
    update(ctx) {
      const dt = ctx.dt * (ctx.speedMul ?? 1);
      T += dt;
      // the target: the player in Hunt and Phases; in Wander a lure that circles half way out
      const on = ctx.hunt && ctx.player.on;
      const pp = ctx.player.pos;
      const pl = on ? [pp.x, pp.y, pp.z] : [0.5 * R * Math.cos(T * 0.25), floorY, 0.5 * R * Math.sin(T * 0.25)];
      // Our waves
      if (T >= nextWave) {
        wave++;
        addCenser(wave % 6 === 0 ? 'great' : wave % 3 === 0 ? 'twin' : 'censer');
        nextWave = T + (wave < 3 ? 10 : 20);
      }
      for (const c of censers) {
        c.pl = pl;
        stepCenser(c, dt);
      }
      const horde = [];
      for (const a of agents) {
        if (a.kind === 'mote' && T - a.born > a.rise) horde.push(a);
        else {
          step(a, pl, T, dt);
          // a Stray's waypoints are picked on the study's floor: bring each new one onto this floor
          if (a.kind === 'stray' && a.n !== a.lastN) {
            a.lastN = a.n;
            a.goal = [a.goal[0] * k, floorY + a.goal[1], a.goal[2] * k];
          }
        }
      }
      if (horde.length) stepHorde(horde, pl, T, dt, {chase: run * HORDE.chaseOfRun, floor: floorY + 0.45});
      // contact: a body that reaches the player bites once and is gone
      for (const a of agents) {
        const d = Math.hypot(a.p[0] - pl[0], a.p[1] - pl[1] - 1, a.p[2] - pl[2]);
        if (on && d < LOOK[a.kind].r * LOOK[a.kind].len + 0.5) {
          ctx.hurt();
          a.alive = false;
        }
        if (Math.hypot(a.p[0], a.p[2]) > R * 3) a.alive = false;
      }
      for (let i = agents.length - 1; i >= 0; i--) if (!agents[i].alive) agents.splice(i, 1);
      draw();
    },
  };
}
