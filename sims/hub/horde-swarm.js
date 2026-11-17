// The V2 horde on a hub arena: the swarm behaviours from the Chopping Block V2 page (../cb-shared), scaled to this
// floor. Censers come in from past the rim on the "Our waves" clock (a Censer every wave, a Twin every 3rd, a Great
// every 6th; 10 s apart for the first three, then 20 s) and pour four times the motes of the 1:1 study. The motes
// fly as one horde (horde.js): flung high out of the censer, the nearest 140 chase and dive, the rest trail high in
// a loose cloud. Strays wander, Hounds and Wardens circle and charge on the loiter field (swarm.js). The chase pace is
// set under this stage's run speed, so a steady run kites the horde here too. Every 4th wave a Spinewyrm surfaces:
// the study's wyrm (stepWyrm, BONEPEDE II body) at a size scaled to this floor, flying high and swooping, its segments
// shot off one by one. The hub's Wandering spawner and Skull worm are these censers and this wyrm when the horde is on.
// The Disc spider is the study's Tithe-Taker (elites.js): it straddles the rim and jitters about one spot, its head
// rises over 3 s, ducks for a second when hit (it can always be hurt: the head while up, the body while ducked), and
// while facing you it pulls every loose orb in, eats it and lays one egg per orb; an egg hatches into 5 mites after
// 10 s, and mites dart at you in bursts. The card's own rule rides on top: every tenth orb it swallows births a
// Spinewyrm. Kills drop orbs (the study's table); orbs fall, drift to a player within 6 m and are picked up at 1.5 m.
// The Censer elite is the Thurible CN-2 study given a behaviour (censer-shared/elite.js): it stalks to a standoff ring,
// and each cycle its bowl swings wider (the tell) before the quick-return arm throws burning blood that lands on you,
// led by your run; the blood pools where it lands and burns while you stand in it. The bowl is its weak point.
import * as THREE from 'three';
import {stepHorde} from '../cb-shared/horde.js';
import {burst, M, newMote, newStray, newWyrm, rnd, step, stepWyrm, WYRMS} from '../cb-shared/swarm.js';
import {createTrail} from '../bonepede2-shared/trail.js';
import {CFG as WCFG, pose} from '../bonepede2-shared/wyrm.js';
import {createBody} from '../bonepede2-shared/body.js';
import {E, eggHatched, newEgg, newMite, newTithe, stepMite, stepTithe} from '../cb-shared/elites.js';
import {bowlWorld, CN, newThurible, poolR, stepShot, stepThurible} from '../censer-shared/elite.js';
import {buildMachine} from '../censer-shared/machine.js';
import {partsKit} from '../slumber-kit/parts.js';
import {materials} from '../slumber-kit/studio.js';

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
// hit points: the V2 swarm tiers, the study's censers
const HP = {mote: 1, stray: 2, hound: 4, warden: 40};
const CENSER = {censer: {size: 1, color: '#9c4436'}, twin: {size: 1.25, color: '#a8533a'}, great: {size: 1.7, color: '#7a2e2a'}};

/** Distance from point c to the segment q -> p. */
function segD(q, p, c) {
  const d = [p[0] - q[0], p[1] - q[1], p[2] - q[2]];
  const L = d[0] * d[0] + d[1] * d[1] + d[2] * d[2] || 1e-9;
  const u = Math.max(0, Math.min(1, ((c[0] - q[0]) * d[0] + (c[1] - q[1]) * d[1] + (c[2] - q[2]) * d[2]) / L));
  return Math.hypot(q[0] + d[0] * u - c[0], q[1] + d[1] * u - c[1], q[2] + d[2] * u - c[2]);
}

// orbs: the study's drop table and pickup (wyrms drop orbsPerPoint for each segment shot off)
const ORBS = {mote: 0, stray: 1, hound: 1, warden: 0, censer: 1, twin: 2, great: 3, tithe: 1, thurible: 2};
const ORB = {fall: 9, magnet: 6, pull: 14, take: 1.5, life: 40};
const SPAWN_EVERY = 10; // orbs a Disc spider swallows for each Spinewyrm it births (the card's rule)

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
  const GRID = new Map();
  // drop the dead in place (no splice per death)
  const compact = () => {
    let j = 0;
    for (let i = 0; i < agents.length; i++) if (agents[i].alive) agents[j++] = agents[i];
    agents.length = j;
  };
  const censers = [];
  const wyrms = [];
  const tithes = [];
  const eggs = [];
  const mites = [];
  let orbs = [];
  let picked = 0;
  const ts = Math.max(0.6, Math.min(1, k)); // the study's Tithe-Taker is 15-20 m across on a 47.5 m floor
  const orbMesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.28, 0), new THREE.MeshBasicMaterial({color: '#7fe0ff'}), 300);
  const eggMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.45, 10, 8).scale(1, 1.3, 1), new THREE.MeshStandardMaterial({color: '#d9c7a0', roughness: 0.6, flatShading: true}), 80);
  const miteMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.32, 8, 6).scale(1.4, 0.7, 1), new THREE.MeshStandardMaterial({color: '#6e332d', roughness: 0.85, flatShading: true}), 160);
  for (const m of [orbMesh, eggMesh, miteMesh]) {
    m.frustumCulled = false;
    m.count = 0;
    g.add(m);
  }
  function dropOrbs(p, n) {
    for (let i = 0; i < n; i++) orbs.push({p: [p[0] + (rnd(nid * 3 + i) - 0.5) * 2, Math.max(floorY + 0.5, p[1]), p[2] + (rnd(nid * 5 + i) - 0.5) * 2], born: T, taken: false});
    nid++;
  }
  function addTithe(great = false) {
    const e = newTithe(nid++, T, rnd(nid * 19) * Math.PI * 2, great, R + 2.5 * ts);
    e.scale *= ts;
    e.p[1] = floorY;
    const look = new THREE.Group();
    const part = (geo, color, pos = [0, 0, 0], parentObj = look) => {
      const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({color, roughness: 0.85, flatShading: true}));
      mesh.position.set(...pos);
      mesh.castShadow = true;
      parentObj.add(mesh);
      return mesh;
    };
    part(new THREE.SphereGeometry(2.2, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2).scale(1.3, 0.7, 1), '#5a2622');
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const leg = part(new THREE.ConeGeometry(0.22, 2.6, 5).rotateZ(Math.PI / 2.6), '#1a1214', [Math.cos(a) * 2.4, 0.4, Math.sin(a) * 2.2]);
      leg.rotation.y = -a;
    }
    look.userData.neck = part(new THREE.CylinderGeometry(0.35, 0.5, 1, 8).translate(0, 0.5, 0), '#8c4a42', [0, 1, 0]);
    look.userData.head = part(new THREE.SphereGeometry(0.85, 14, 10), '#8c4a42', [0, E.tithe.headY, 0]);
    part(new THREE.SphereGeometry(0.28, 8, 6), '#ff3b1f', [0.7, 0.1, 0], look.userData.head);
    look.scale.setScalar(e.scale);
    g.add(look);
    e.g = look;
    e.births = 0;
    tithes.push(e);
  }
  // the Censer elites (Thurible CN-2), their shots in flight and the pools they leave
  const thuribles = [];
  const blood = [];
  const pools = [];
  let cnMat = null;
  const bloodMat = new THREE.MeshStandardMaterial({color: '#8a0f12', emissive: new THREE.Color('#ff3a1c'), emissiveIntensity: 0.35, roughness: 0.25});
  const shotMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.2, 12, 8), bloodMat, 40);
  const poolMesh = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 32).rotateX(-Math.PI / 2), bloodMat, 40);
  for (const m of [shotMesh, poolMesh]) {
    m.frustumCulled = false;
    m.count = 0;
    g.add(m);
  }
  function addThurible() {
    if (!cnMat) {
      cnMat = materials();
      cnMat.blood = bloodMat;
    }
    // it walks in from the rim
    const ang = rnd(nid * 23) * Math.PI * 2;
    const at = [(R - 2) * Math.cos(ang), floorY, (R - 2) * Math.sin(ang)];
    const m = newThurible(nid++, at, T, ang + Math.PI);
    const look = new THREE.Group();
    g.add(look);
    m.machine = buildMachine(look, partsKit(look, cnMat), cnMat);
    look.traverse((o) => o.isMesh && (o.castShadow = true));
    m.g = look;
    thuribles.push(m);
  }
  const titheHeadP = (e) => [e.p[0], e.p[1] + E.tithe.headY * e.scale, e.p[2]];
  const titheBodyP = (e) => [e.p[0], e.p[1] + 0.9 * e.scale, e.p[2]];
  const wsOf = (v) => WYRMS[v].scale * Math.max(0.55, Math.min(1, k)); // the study's wyrm is 60 m long on a 47.5 m floor
  let nid = 1;
  let T = 0;
  let wave = 0;
  let nextWave = 1;
  let kills = 0;
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
    censers.push({id: nid++, type, size: C.size, hp: M.censers[type].hp, r: 2 * C.size, p: [r0 * Math.cos(ang), floorY + M.censer.height, r0 * Math.sin(ang)], born: T, next: T + M.censer.first, settled: false, goal: null, queue: [], mesh: m, roll: 0});
  }

  function addWyrm(variant = 'spinewyrm') {
    const ang = rnd(nid * 9) * Math.PI * 2;
    const r0 = R - 3 - 4 * rnd(nid * 11); // it first comes up near the edge
    const at = [r0 * Math.cos(ang), floorY, r0 * Math.sin(ang)];
    const w = newWyrm(nid++, at, T, variant);
    const WS = wsOf(variant);
    const wrap = new THREE.Group();
    wrap.scale.setScalar(WS);
    g.add(wrap);
    const body = createBody(wrap);
    const trail = createTrail({minStep: 0.015});
    for (let y = -20; y <= w.head[1]; y += 0.05) trail.push([at[0] / WS, y / WS, at[2] / WS]);
    wyrms.push({w, ws: WS, wrap, body, trail, hp: Array(WCFG.N).fill(WYRMS[variant].hpPer), hitT: Array(WCFG.N).fill(-9), deadT: Array(WCFG.N).fill(null), phase: 0, P: null, lastHit: -9});
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
    a.hp = HP[kind];
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
    counts: () => ({motes: motes(), others: agents.length - motes(), censers: censers.length, wyrms: wyrms.length, tithes: tithes.length, thuribles: thuribles.length, pools: pools.length, eggs: eggs.length, mites: mites.length, orbs: orbs.length, picked, wave, kills}),
    /** Bring one in now: a censer type (censer, twin, great) or a wyrm (spinewyrm, elder, pale). */
    spawn(id) {
      if (WYRMS[id]) addWyrm(id);
      else if (CENSER[id]) addCenser(id);
      else if (id === 'tithe' || id === 'great_tithe') addTithe(id === 'great_tithe');
      else if (id === 'thurible') addThurible();
    },
    /** What a shooter can aim at: the censers and the swarm, as live references. */
    targets: () => {
      // a wyrm's live segments, scored like the study's bot does (distance x 0.6)
      const extra = [];
      for (const y of wyrms) {
        if (!y.P || y.w.state === 'under') continue;
        y.P.segs.forEach((sg, i) => {
          if (y.deadT[i] == null) extra.push({p: sg.p.map((x) => x * y.ws), v: y.w.dir.map((x) => x * y.w.V.speed), score: 0.6});
        });
      }
      for (const e of tithes) extra.push({p: e.head > 0.5 ? titheHeadP(e) : titheBodyP(e), score: 0.5}); // the head, or the body while it ducks
      for (const e of eggs) extra.push({p: e.p, score: 0.7});
      for (const m of thuribles) extra.push({p: bowlWorld(m), score: 0.5}); // the swinging bowl
      for (const e of mites) extra.push({p: e.p, score: 0.6});
      return {censers, agents, extra};
    },
    /**
     * A shot's step from q to p (x, y, z arrays) with `dmg`: the first body it passes through takes the damage.
     * Returns true when it hit. Bodies are tested only near the step (the floor grid built in update()).
     */
    hit(q, p, dmg) {
      for (const c of censers) {
        if (c.hp > 0 && segD(q, p, c.p) < c.r) {
          c.hp -= dmg;
          if (c.hp <= 0) {
            kills++;
            dropOrbs(c.p, ORBS[c.type]);
          }
          return true;
        }
      }
      for (const e of tithes) {
        if (!e.alive) continue;
        // it can always be hurt: the head while it is up, the body while it ducks (ducking only stops it eating)
        const headHit = e.head >= 0.5 && segD(q, p, titheHeadP(e)) < 1.2 * e.scale;
        const bodyHit = segD(q, p, titheBodyP(e)) < 2.3 * e.scale;
        if (headHit || bodyHit) {
          e.lastHit = T;
          e.hp -= dmg;
          if (e.hp <= 0) {
            e.alive = false;
            kills++;
            dropOrbs([e.p[0], e.p[1] + 2, e.p[2]], ORBS.tithe);
          }
          return true;
        }
      }
      for (const m of thuribles) {
        if (!m.alive) continue;
        // the bowl is the weak point; the tower soaks shards
        if (segD(q, p, bowlWorld(m)) < CN.bowlR) {
          m.hp -= dmg;
          m.hitT = T;
          if (m.hp <= 0) {
            m.alive = false;
            kills++;
            dropOrbs([m.p[0], m.p[1] + 2, m.p[2]], ORBS.thurible);
          }
          return true;
        }
        if (segD(q, p, [m.p[0], m.p[1] + 2, m.p[2]]) < CN.bodyR) return true;
      }
      for (const list of [eggs, mites]) {
        for (const e of list) {
          if (e.alive && segD(q, p, e.p) < 0.7) {
            e.hp -= dmg;
            if (e.hp <= 0) {
              e.alive = false;
              kills++;
            }
            return true;
          }
        }
      }
      for (const y of wyrms) {
        if (!y.P || y.w.state === 'under') continue;
        for (let i = 0; i < y.P.segs.length; i++) {
          if (y.deadT[i] != null) continue;
          const c = y.P.segs[i].p;
          if (segD(q, p, [c[0] * y.ws, c[1] * y.ws, c[2] * y.ws]) < 0.4 * y.ws * y.P.segs[i].w) {
            y.hitT[i] = T;
            y.hp[i] -= dmg;
            if (y.hp[i] <= 0) {
              y.deadT[i] = T;
              y.orbAcc = (y.orbAcc ?? 0) + WYRMS[y.w.variant].orbsPerPoint;
              const n = Math.floor(y.orbAcc);
              y.orbAcc -= n;
              dropOrbs(c.map((x) => x * y.ws), n);
            }
            return true;
          }
        }
      }
      const x0 = Math.floor((Math.min(q[0], p[0]) - 2.5) / 4);
      const x1 = Math.floor((Math.max(q[0], p[0]) + 2.5) / 4);
      const z0 = Math.floor((Math.min(q[2], p[2]) - 2.5) / 4);
      const z1 = Math.floor((Math.max(q[2], p[2]) + 2.5) / 4);
      for (let ix = x0; ix <= x1; ix++) {
        for (let iz = z0; iz <= z1; iz++) {
          const b = GRID.get(((ix + 512) << 10) | (iz + 512));
          if (!b) continue;
          for (const a of b) {
            if (!a.alive) continue;
            if (segD(q, p, a.p) < LOOK[a.kind].r * LOOK[a.kind].len + 0.2) {
              a.hp -= dmg;
              if (a.hp <= 0) {
                a.alive = false;
                kills++;
                dropOrbs(a.p, ORBS[a.kind] || 0);
              }
              return true;
            }
          }
        }
      }
      return false;
    },
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
        if (wave % 4 === 0) addWyrm();
        nextWave = T + (wave < 3 ? 10 : 20);
      }
      for (const c of censers) {
        c.pl = pl;
        stepCenser(c, dt);
      }
      // the wyrms: the head moves, the body rides its trail (local units are world / WS)
      for (const y of wyrms) {
        stepWyrm(y.w, [pl[0], pl[1] + 1.6, pl[2]], T, dt, R);
        y.trail.push(y.w.head.map((x) => x / y.ws));
        y.phase += 9 * dt;
        y.P = pose(y.trail, y.trail.length, y.phase);
        if (on && y.w.state !== 'under' && T - y.lastHit > 1 && Math.hypot(y.w.head[0] - pl[0], y.w.head[1] - pl[1] - 1, y.w.head[2] - pl[2]) < 2) {
          ctx.hurt(); // one hit per contact, not one per frame
          y.lastHit = T;
        }
      }
      for (let i = wyrms.length - 1; i >= 0; i--) {
        const y = wyrms[i];
        if (!y.deadT.slice(0, WCFG.N - 1).every((d) => d != null)) continue;
        g.remove(y.wrap);
        wyrms.splice(i, 1);
        kills++;
      }
      // the Censer elites: stalk, wind, throw; shots fly and pool; pools burn
      const pv = on ? [ctx.player.vel.x, 0, ctx.player.vel.z] : [0, 0, 0];
      for (const m of thuribles) stepThurible(m, {p: pl, v: pv}, T, dt, R, (s) => blood.push(s));
      for (const s of blood) {
        if (s.done) continue;
        if (on && Math.hypot(s.p[0] - pl[0], s.p[1] - pl[1] - 1, s.p[2] - pl[2]) < CN.shotR + 0.6) {
          ctx.hurt(); // a direct hit
          s.done = true;
        } else if (stepShot(s, dt, floorY)) {
          s.done = true;
          pools.push({p: [s.p[0], floorY + 0.02, s.p[2]], born: T});
        }
      }
      for (let i = blood.length - 1; i >= 0; i--) if (blood[i].done) blood.splice(i, 1);
      for (let i = pools.length - 1; i >= 0; i--) if (T - pools[i].born > CN.pool.life) pools.splice(i, 1);
      if (on && pl[1] < floorY + 0.6) for (const q of pools) if (Math.hypot(q.p[0] - pl[0], q.p[2] - pl[2]) < poolR(T - q.born)) ctx.hurt('fire');
      for (let i = thuribles.length - 1; i >= 0; i--) {
        if (thuribles[i].alive) continue;
        g.remove(thuribles[i].g);
        thuribles.splice(i, 1);
      }
      // the Disc spiders (Tithe-Takers), their eggs and mites
      const feet = [pl[0], pl[1], pl[2]];
      for (const e of tithes) {
        stepTithe(e, feet, orbs, T, dt, (p, t) => eggs.push(newEgg(nid++, [p[0], floorY + 0.4, p[2]], t)), R - 1.5);
        e.p[1] = floorY;
        // the card's rule: every tenth orb it swallows births a Spinewyrm
        if (Math.floor(e.eaten / SPAWN_EVERY) > e.births) {
          e.births++;
          addWyrm('spinewyrm');
        }
      }
      for (const egg of eggs) {
        if (!egg.alive || !eggHatched(egg, T)) continue;
        egg.alive = false;
        for (let i = 0; i < E.egg.mites; i++) mites.push(newMite(nid++, [egg.p[0] + Math.cos(i) * 0.8, 0, egg.p[2] + Math.sin(i) * 0.8], T));
      }
      for (const m of mites) {
        if (!m.alive) continue;
        stepMite(m, feet, T, dt);
        m.p[1] = floorY + 0.3;
        if (on && Math.hypot(m.p[0] - pl[0], m.p[2] - pl[2]) < 0.9 && pl[1] < floorY + 1) {
          ctx.hurt();
          m.alive = false;
        }
      }
      for (let i = tithes.length - 1; i >= 0; i--) {
        if (tithes[i].alive) continue;
        g.remove(tithes[i].g);
        tithes.splice(i, 1);
      }
      for (const list of [eggs, mites]) {
        let j = 0;
        for (const e of list) if (e.alive) list[j++] = e;
        list.length = j;
      }
      // orbs: fall, drift to a player within 6 m, picked up at 1.5 m (an orb a spider is pulling is its, not yours)
      for (const o of orbs) {
        if (o.taken) continue;
        o.p[1] = Math.max(floorY + 0.35, o.p[1] - ORB.fall * dt);
        if (!on) continue;
        const dx = pl[0] - o.p[0];
        const dz = pl[2] - o.p[2];
        const d = Math.hypot(dx, dz);
        if (d < ORB.take) {
          o.taken = true;
          picked++;
        } else if (d < ORB.magnet && !o.pulled) {
          o.p[0] += (dx / d) * ORB.pull * dt;
          o.p[2] += (dz / d) * ORB.pull * dt;
        }
        o.pulled = false;
      }
      orbs = orbs.filter((o) => !o.taken && T - o.born < ORB.life);
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
      compact();
      // dead censers go; the swarm on a 4 m floor grid for shots
      for (let i = censers.length - 1; i >= 0; i--) {
        if (censers[i].hp > 0) continue;
        g.remove(censers[i].mesh);
        censers.splice(i, 1);
      }
      GRID.clear();
      for (const a of agents) {
        const key = ((Math.floor(a.p[0] / 4) + 512) << 10) | (Math.floor(a.p[2] / 4) + 512);
        let b = GRID.get(key);
        if (!b) GRID.set(key, (b = []));
        b.push(a);
      }
      draw();
      const MX = new THREE.Matrix4();
      const QY = new THREE.Quaternion();
      const UP = new THREE.Vector3(0, 1, 0);
      const PV = new THREE.Vector3();
      const SV = new THREE.Vector3(1, 1, 1);
      let n = 0;
      for (const o of orbs) {
        if (n >= 300) break;
        orbMesh.setMatrixAt(n++, MX.makeTranslation(o.p[0], o.p[1] + 0.15 * Math.sin(T * 4 + o.born), o.p[2]));
      }
      orbMesh.count = n;
      n = 0;
      for (const e of eggs) {
        if (n >= 80) break;
        const sw = 1 + 0.12 * Math.sin((T - e.born) * (2 + (T - e.born)));
        eggMesh.setMatrixAt(n++, MX.compose(PV.set(...e.p), QY.identity(), SV.set(sw, sw, sw)));
      }
      eggMesh.count = n;
      n = 0;
      for (const m of mites) {
        if (n >= 160) break;
        QY.setFromAxisAngle(UP, -(m.yaw || 0));
        miteMesh.setMatrixAt(n++, MX.compose(PV.set(...m.p), QY, SV.set(1, 1, 1)));
      }
      miteMesh.count = n;
      for (const m of [orbMesh, eggMesh, miteMesh]) m.instanceMatrix.needsUpdate = true;
      for (const e of tithes) {
        e.g.position.set(...e.p);
        e.g.rotation.y = -e.yaw;
        e.g.userData.neck.scale.y = Math.max(0.05, e.head * (E.tithe.headY - 1));
        e.g.userData.head.position.y = 1 + e.head * (E.tithe.headY - 1);
      }
      for (const m of thuribles) {
        m.g.position.set(...m.p);
        m.g.rotation.y = m.yaw;
        const a = m.swingA || 0;
        m.machine.pose(m.theta, T, {a, p: [0, 3.3 - 1.1 * Math.cos(a), -0.6 + 1.1 * Math.sin(a)]});
        m.machine.load.visible = m.phase !== 'rest' && m.thrownAt == null; // the cup is loaded until it throws
      }
      n = 0;
      for (const s of blood) {
        if (n >= 40) break;
        shotMesh.setMatrixAt(n++, MX.makeTranslation(s.p[0], s.p[1], s.p[2]));
      }
      shotMesh.count = n;
      n = 0;
      for (const q of pools) {
        if (n >= 40) break;
        const r = poolR(T - q.born);
        poolMesh.setMatrixAt(n++, MX.compose(PV.set(...q.p), QY.identity(), SV.set(r, 1, r)));
      }
      poolMesh.count = n;
      shotMesh.instanceMatrix.needsUpdate = poolMesh.instanceMatrix.needsUpdate = true;
      for (const y of wyrms) {
        if (!y.P) continue;
        y.wrap.visible = y.w.state !== 'under' || y.w.head[1] > floorY - 12;
        const ws = (i) => ({open: 1, hit: T - y.hitT[i] < 0.12 ? 1 - (T - y.hitT[i]) / 0.12 : 0, dead: y.deadT[i] == null ? 0 : Math.min(1, (T - y.deadT[i]) / 0.1), pulse: 0.5 + 0.5 * Math.sin(T * 5 - i * 0.55)});
        y.body.update(y.P, ctx.camera, ws, 0.5 + 0.5 * Math.sin(T * 2.3));
      }
    },
  };
}
