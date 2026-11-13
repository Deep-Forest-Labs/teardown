// Whitebox stand-ins with a mechanic each. BUILD[kind](g, K) returns update(ctx); the group g is placed and turned
// by the creature's own Agent. In Wander mode they patrol their stand; in Hunt mode they play their verb against the
// player: tells before attacks, a recover window where the weak point opens, ranged shots that can be dodged.
// Weak points are red orbs (dfl-kit/weakpoint.js) and hide with the stage toggle. Tier 1 swarmers have none: they are
// impostor-rendered in the game and too many mechanics would be heavy there.
// The skull worm and the Gilded skull use their real prototype rigs.
import * as THREE from 'three';
import {createBody as createWyrmBody} from '../bonepede2-shared/body.js';
import {createTrail} from '../bonepede2-shared/trail.js';
import {pose as wyrmPose} from '../bonepede2-shared/wyrm.js';
import {createWeakpoints} from '../dfl-kit/weakpoint.js';
import {createSkull, PLATES} from '../gilded-shared/skull.js';
import {Agent, angDiff, clamp, createLegs, lead, Phases} from './agent.js';

const V3 = THREE.Vector3;
const COL = {body: '#d8cfc0', dark: '#3a3036', mid: '#8f8578', prince: '#a69c90', princeDark: '#4a3f47', glow: '#ff3a1c'};
const mat = (c, extra = {}) => new THREE.MeshStandardMaterial({color: c, roughness: 0.85, flatShading: true, ...extra});
const M = {body: mat(COL.body), dark: mat(COL.dark), mid: mat(COL.mid), prince: mat(COL.prince), princeDark: mat(COL.princeDark)};

function parts(group) {
  const mesh = (geo, m, p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1], parent = group) => {
    const o = new THREE.Mesh(geo, m);
    o.position.set(...p);
    o.rotation.set(...r);
    o.scale.set(...s);
    o.castShadow = true;
    o.receiveShadow = true;
    parent.add(o);
    return o;
  };
  return {
    mesh,
    box: (w, h, d, m, p, r, parent) => mesh(new THREE.BoxGeometry(w, h, d), m, p, r, undefined, parent),
    sph: (rad, m, p, s, parent) => mesh(new THREE.IcosahedronGeometry(rad, 1), m, p, undefined, s, parent),
    cone: (rad, h, m, p, r, parent) => mesh(new THREE.ConeGeometry(rad, h, 5), m, p, r, undefined, parent),
    cyl: (r0, r1, h, m, p, r, parent) => mesh(new THREE.CylinderGeometry(r0, r1, h, 7), m, p, r, undefined, parent),
    node: (p = [0, 0, 0], parent = group) => {
      const n = new THREE.Group();
      n.position.set(...p);
      parent.add(n);
      return n;
    },
  };
}

/** Weak points at fixed local positions on `parent`. Returns set(ctx, open 0..1, hit 0..1); hidden by the toggle. */
function weakSpots(parent, pts, r = 0.14) {
  const before = new Set(parent.children);
  const w = createWeakpoints(parent, pts.length, r);
  const m4 = new THREE.Matrix4();
  const meshes = parent.children.filter((c) => !before.has(c)); // only the weak point's own meshes
  return (ctx, open = 1, hit = 0) => {
    for (const m of meshes) m.visible = ctx.showWeak;
    if (!ctx.showWeak) return;
    w.face(ctx.camera);
    pts.forEach((p, i) => w.set(i, m4.makeTranslation(...p), {open, hit, pulse: 0.5 + 0.5 * Math.sin(ctx.t * 5 + i)}));
    w.commit();
  };
}

/** A tapered chain of n boxes from a node, each link turned by bend(i) about X and twist(i) about Y. */
function chain(P, parent, n, len, w0, w1, m) {
  const links = [];
  let p = parent;
  for (let i = 0; i < n; i++) {
    const k = i / (n - 1);
    const w = w0 + (w1 - w0) * k;
    const j = P.node([0, i === 0 ? 0 : len, 0], p);
    P.box(w, len * 1.05, w, m, [0, len / 2, 0], undefined, j);
    links.push(j);
    p = j;
  }
  return {links, pose: (bend, twist = () => 0) => links.forEach((j, i) => j.rotation.set(bend(i), twist(i), 0))};
}

/** Where a creature heads: the player in Hunt mode, otherwise a slow figure-of-eight round its stand. */
const wanderAt = (a, t, r = 3, seed = 0) => new V3(a.home.x + Math.sin(t * 0.23 + seed) * r, a.home.y, a.home.z + Math.sin(t * 0.46 + seed * 1.7) * r * 0.6);
const hunting = (ctx) => ctx.hunt && ctx.player.on;
const ppos = (ctx, up = 0) => ctx.player.pos.clone().setY(ctx.player.pos.y + up);

export const BUILD = {
  // ------------------------------------------------------------ base roster
  swarm(g, K) {
    // tier 1: no weak points. A loose flock that circles its stand, or streams at the player and bites in passing.
    const P = parts(g);
    const n = 28;
    const mats = mat(COL.body);
    const s = Array.from({length: n}, (_, i) => {
      const m = P.sph(0.28, mats, [0, 0, 0], [1, 0.85, 1.1]);
      return {m, p: K.home.clone().add(new V3(Math.cos(i) * 2, 2.5 + (i % 3) * 0.4, Math.sin(i) * 2)), v: new V3()};
    });
    g.position.set(0, 0, 0); // the flock lives in world space
    const acc = new V3();
    const tgt = new V3();
    let biteT = 0;
    return (ctx) => {
      biteT -= ctx.dt;
      s.forEach((k, i) => {
        if (hunting(ctx)) tgt.copy(ctx.player.pos).add(new V3(Math.sin(ctx.t * 2 + i) * 1.5, 1.2 + Math.sin(i) * 0.5, Math.cos(ctx.t * 2 + i) * 1.5));
        else tgt.set(K.home.x + Math.cos(ctx.t * 0.9 + i * 0.7) * (2 + (i % 4) * 0.4), K.home.y + 2.6 + Math.sin(ctx.t * 1.2 + i) * 0.9, K.home.z + Math.sin(ctx.t * 0.9 + i * 0.7) * 2);
        acc.subVectors(tgt, k.p).multiplyScalar(2.2);
        // separation from two neighbours keeps it a flock, not a blob
        for (const j of [(i + 1) % n, (i + 7) % n]) {
          const d = k.p.distanceTo(s[j].p);
          if (d < 0.8) acc.addScaledVector(k.p.clone().sub(s[j].p).normalize(), (0.8 - d) * 30);
        }
        k.v.addScaledVector(acc, ctx.dt).clampLength(0, hunting(ctx) ? 9 : 4);
        k.p.addScaledVector(k.v, ctx.dt);
        k.m.position.copy(k.p);
        k.m.lookAt(k.p.clone().add(k.v));
        if (hunting(ctx) && biteT <= 0 && k.p.distanceTo(ppos(ctx, 0.9)) < 0.9) {
          ctx.hurt('bite');
          biteT = 0.8;
        }
      });
    };
  },
  puffer(g, K) {
    // tier 1: no weak point. Drifts in, swells (the tell), then launches itself at you and pops.
    const P = parts(g);
    const b = P.sph(0.35, M.body, [0, 0, 0]);
    for (let k = 0; k < 10; k++) {
      const a = k * 2.4;
      const y = ((k % 5) / 4) * 2 - 1;
      const r = Math.sqrt(1 - y * y);
      const s = P.cone(0.06, 0.3, M.dark, [Math.cos(a) * r * 0.36, y * 0.36, Math.sin(a) * r * 0.36], [0, 0, 0], b);
      s.lookAt(s.position.clone().multiplyScalar(3));
      s.rotateX(Math.PI / 2);
    }
    const a = new Agent(g, K.home.clone().setY(K.home.y + 2.4), {speed: 3, fly: true});
    const ph = new Phases(['drift', 'swell', 'launch', 'pop'], {drift: 2.5, swell: 1.1, launch: 0.9, pop: 0.6});
    const dir = new V3();
    return (ctx) => {
      ph.tick(ctx.dt);
      const tgt = hunting(ctx) ? ppos(ctx, 1.2) : wanderAt(a, ctx.t, 3).setY(a.home.y);
      if (ph.name === 'drift') a.seek(hunting(ctx) ? tgt.clone().add(new V3(0, 2, 0)).addScaledVector(dir.subVectors(a.pos, tgt).setY(0).normalize(), 7) : tgt, ctx.dt);
      else if (ph.name === 'swell') {
        a.brake(ctx.dt);
        dir.subVectors(tgt, a.pos).normalize();
      } else if (ph.name === 'launch') {
        a.vel.copy(dir).multiplyScalar(14);
        if (hunting(ctx) && a.pos.distanceTo(ppos(ctx, 0.9)) < 1) {
          ctx.hurt('puffer');
          ph.go('pop');
        }
      } else a.brake(ctx.dt, 12);
      const sw = ph.name === 'swell' ? 1 + ph.k * 0.9 : ph.name === 'launch' ? 1.9 : ph.name === 'pop' ? 1.9 * (1 - ph.k) + 0.001 : 1;
      b.scale.setScalar(sw);
      a.step(ctx.dt, ctx);
      if (ph.name === 'pop' && ph.k > 0.95) a.pos.copy(a.home);
    };
  },
  wyrm(g, K) {
    // the BONEPEDE II rig: in Hunt mode the head chases you, coils round you, rears and strikes
    const trail = createTrail({minStep: 0.015});
    const body = createWyrmBody(g);
    g.position.set(0, 0, 0);
    const head = K.home.clone().setY(K.home.y + 3.4);
    let dir = new V3(0, 0, 1);
    for (let z = -12; z <= 0; z += 0.05) trail.push([head.x, head.y, head.z + z]);
    let phase = 0;
    let coil = 0;
    const want = new V3();
    return (ctx) => {
      const hunt = hunting(ctx);
      if (hunt) {
        const pp = ppos(ctx, 1.4);
        const d = head.distanceTo(pp);
        coil = d < 4 ? coil + ctx.dt : Math.max(0, coil - ctx.dt);
        // close in, then wrap: aim at a point circling the player
        const a = ctx.t * 2.2;
        want.copy(pp).add(d < 6 ? new V3(Math.sin(a) * 2.2, 0.6 * Math.sin(a * 0.5), Math.cos(a) * 2.2) : new V3());
        if (coil > 2.5) {
          want.copy(pp); // strike
          if (d < 1.2) {
            ctx.hurt('worm');
            coil = 0;
          }
        }
      } else want.set(K.home.x + 5 * Math.sin(0.5 * ctx.t), K.home.y + 3.4 + 1.2 * Math.sin(0.9 * ctx.t + 1), K.home.z + 4 * Math.sin(1.0 * ctx.t));
      const to = want.clone().sub(head).normalize();
      const ang = dir.angleTo(to);
      const maxA = (hunt ? 3.2 : 2.2) * ctx.dt;
      if (ang > 1e-4) dir = dir.clone().lerp(to, Math.min(1, maxA / ang)).normalize();
      const sp = (hunt ? (coil > 2.5 ? 9 : 5.5) : 3.6) * ctx.speedMul;
      head.addScaledVector(dir, sp * ctx.dt);
      const gy = ctx.ground(head.x, head.z, head.y + 2);
      head.y = Math.max(head.y, (gy ?? -50) + 0.6);
      trail.push(head.toArray());
      phase += 5.2 * ctx.dt;
      const P = wyrmPose(trail, trail.length, phase);
      body.weak.mesh.visible = ctx.showWeak;
      body.update(P, ctx.camera, (i) => ({open: ctx.showWeak ? 1 : 0, pulse: 0.5 + 0.5 * Math.sin(ctx.t * 5 - i * 0.55)}), coil > 1.5 ? 1 : 0.4 + 0.3 * Math.sin(ctx.t * 2.3));
    };
  },
  scorpion(g, K) {
    // plants and scrapes (tell), charges in a straight line, then recovers with its stinger down: the weak window
    const P = parts(g);
    const body = P.node([0, 0.75, 0]);
    P.box(1.1, 0.45, 1.6, M.body, [0, 0, 0], undefined, body);
    for (const sx of [-1, 1]) P.box(0.25, 0.25, 0.7, M.mid, [sx * 0.45, 0, 1.1], [0, sx * 0.3, 0], body);
    const tailBase = P.node([0, 0.2, -0.8], body);
    const tail = chain(P, tailBase, 6, 0.32, 0.3, 0.14, M.body);
    const sting = weakSpots(tail.links[5], [[0, 0.4, 0]], 0.13);
    const legs = createLegs(g.parent, body, [-1, 1].flatMap((sx) => [0.5, 0, -0.5].map((z, k) => ({hip: [sx * 0.5, -0.1, z], rest: [sx * 1.25, z * 1.3], group: (k + (sx > 0 ? 1 : 0)) % 2}))), {femur: 0.6, tibia: 0.75, stride: 0.55, stepTime: 0.16, lift: 0.25, thick: 0.07, mat: M.dark});
    const a = new Agent(g, K.home, {speed: 3.2, turn: 2.6});
    const ph = new Phases(['stalk', 'scrape', 'charge', 'recover'], {stalk: 2.6, scrape: 1.0, charge: 1.0, recover: 1.6});
    const aim = new V3();
    return (ctx) => {
      ph.tick(ctx.dt);
      const hunt = hunting(ctx);
      const tgt = hunt ? ctx.player.pos : wanderAt(a, ctx.t, 4);
      if (ph.name === 'stalk') a.seek(tgt, ctx.dt, ctx.speedMul, hunt ? 9 : 0.5);
      else if (ph.name === 'scrape') {
        a.brake(ctx.dt);
        a.face(a.to(tgt).yaw, ctx.dt, 2);
        aim.copy(tgt);
      } else if (ph.name === 'charge') {
        a.vel.set(Math.sin(a.yaw), 0, Math.cos(a.yaw)).multiplyScalar(16 * ctx.speedMul);
        if (hunt && a.pos.distanceTo(ctx.player.pos) < 1.4) ctx.hurt('charge');
      } else a.brake(ctx.dt, 5);
      a.step(ctx.dt, ctx);
      body.position.y = 0.75 + (ph.name === 'scrape' ? 0.05 * Math.sin(ctx.t * 40) : 0) - (ph.name === 'recover' ? 0.25 : 0);
      const rec = ph.name === 'recover';
      tail.pose((i) => (rec ? 0.1 : -0.5 - 0.15 * i + 0.1 * Math.sin(ctx.t * 3 + i)));
      sting(ctx, rec ? 1 : 0.15);
      legs.update(ctx.dt, ctx, a.vel.length() / 3);
    };
  },
  spawner(g, K) {
    // a slow wanderer that pours skulls on a pulse; its crown mouth is the priority kill and is always open
    const P = parts(g);
    const root = P.node();
    for (let k = 0; k < 5; k++) P.sph(1.1 - k * 0.15, M.mid, [0, 0.9 + k * 0.85, 0], [1, 0.8, 1], root);
    const mouth = weakSpots(root, [[0, 4.6, 0]], 0.3);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.06, 4, 32), new THREE.MeshBasicMaterial({color: COL.glow, transparent: true}));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.2;
    root.add(ring);
    const minis = Array.from({length: 6}, () => ({m: P.sph(0.22, M.body, [0, -50, 0], undefined, g.parent), p: new V3(), v: new V3(), life: 0}));
    const a = new Agent(g, K.home, {speed: 0.9, turn: 1});
    let pulse = 0;
    return (ctx) => {
      a.seek(wanderAt(a, ctx.t, 3), ctx.dt, ctx.speedMul);
      a.step(ctx.dt, ctx);
      pulse += ctx.dt;
      const u = (pulse % 4) / 4;
      ring.scale.setScalar(1 + u * 5);
      ring.material.opacity = 1 - u;
      if (pulse >= 4) {
        pulse -= 4;
        minis.forEach((m, k) => {
          m.p.copy(a.pos).add(new V3(0, 4.6, 0));
          m.v.set(Math.cos(k) * 3, 4, Math.sin(k) * 3);
          m.life = 5;
        });
      }
      for (const m of minis) {
        if (m.life <= 0) {
          m.m.position.y = -50;
          continue;
        }
        m.life -= ctx.dt;
        if (hunting(ctx)) m.v.lerp(ppos(ctx, 1).sub(m.p).normalize().multiplyScalar(6), ctx.dt * 2);
        else m.v.y -= 3 * ctx.dt;
        m.p.addScaledVector(m.v, ctx.dt);
        m.m.position.copy(m.p);
        if (hunting(ctx) && m.p.distanceTo(ppos(ctx, 0.9)) < 0.8) {
          ctx.hurt('skull');
          m.life = 0;
        }
      }
      mouth(ctx, 1);
    };
  },
  quadruped(g, K) {
    // stalks at a distance, crouches and growls (tell), pounces; the landing opens the spine orb (punish it)
    const P = parts(g);
    const body = P.node([0, 1.5, 0]);
    P.box(1.2, 0.8, 2.6, M.body, [0, 0, 0], undefined, body);
    const head = P.node([0, 0.25, 1.55], body);
    P.box(0.7, 0.6, 0.8, M.mid, [0, 0, 0.2], undefined, head);
    const spine = weakSpots(body, [[0, 0.5, -0.6]], 0.16);
    const legs = createLegs(g.parent, body, [[0.55, 1.0, 0], [-0.55, 1.0, 1], [0.55, -1.0, 1], [-0.55, -1.0, 0]].map(([x, z, gr]) => ({hip: [x, -0.3, z], rest: [x * 1.5, z * 1.05], group: gr})), {femur: 0.85, tibia: 0.95, stride: 0.95, stepTime: 0.24, lift: 0.4, thick: 0.18, mat: M.dark});
    const a = new Agent(g, K.home, {speed: 4.2, turn: 2.4});
    const ph = new Phases(['stalk', 'crouch', 'pounce', 'land'], {stalk: 3.5, crouch: 0.8, pounce: 0.7, land: 1.4});
    const from = new V3();
    const to = new V3();
    let bodyY = 1.5;
    return (ctx) => {
      ph.tick(ctx.dt);
      const hunt = hunting(ctx);
      const tgt = hunt ? ctx.player.pos : wanderAt(a, ctx.t, 5, 1);
      if (ph.name === 'stalk') {
        if (hunt) {
          // circle at 9 m: seek a point on the ring beside the player
          const o = a.to(ctx.player.pos);
          const ring = ctx.player.pos.clone().add(new V3(-Math.sin(o.yaw + 0.6) * 9, 0, -Math.cos(o.yaw + 0.6) * 9));
          a.seek(ring, ctx.dt, ctx.speedMul);
        } else a.seek(tgt, ctx.dt, 0.6 * ctx.speedMul);
        bodyY += (1.5 - bodyY) * ctx.dt * 6;
        from.copy(a.pos);
      } else if (ph.name === 'crouch') {
        a.brake(ctx.dt);
        a.face(a.to(tgt).yaw, ctx.dt, 2);
        bodyY += (1.0 - bodyY) * ctx.dt * 8;
        from.copy(a.pos);
        to.copy(tgt);
      } else if (ph.name === 'pounce') {
        const k = ph.k;
        a.pos.lerpVectors(from, to, k).setY(a.groundY);
        a.vel.set(0, 0, 0);
        bodyY = 1.5 + Math.sin(Math.PI * k) * 2.6;
        if (hunt && k > 0.7 && a.pos.distanceTo(ctx.player.pos) < 1.8) ctx.hurt('pounce');
      } else {
        a.brake(ctx.dt);
        bodyY += (1.1 - bodyY) * ctx.dt * 8;
      }
      a.step(ctx.dt, ctx);
      body.position.y = bodyY;
      head.rotation.x = ph.name === 'crouch' ? 0.35 : 0;
      spine(ctx, ph.name === 'land' ? 1 : 0.1);
      legs.update(ctx.dt, ctx, ph.name === 'pounce' ? 3 : a.vel.length() / 3);
    };
  },
  shooter(g, K) {
    // keeps 12 to 16 m away and strafes; the eye charges (tell and weak window), then fires a dodgeable bolt
    const P = parts(g);
    const root = P.node([0, 0, 0]);
    P.mesh(new THREE.OctahedronGeometry(0.7), M.body, [0, 0, 0], [0, 0, 0], [1, 1.5, 1], root);
    const eye = weakSpots(root, [[0, 0.1, 0.62]], 0.16);
    const a = new Agent(g, K.home.clone().setY(K.home.y + 3), {speed: 4, fly: true, turn: 3});
    const ph = new Phases(['move', 'charge', 'fire'], {move: 2.2, charge: 0.8, fire: 0.3});
    return (ctx) => {
      ph.tick(ctx.dt);
      const hunt = hunting(ctx);
      if (hunt) {
        const o = a.to(ctx.player.pos);
        const r = clamp(o.dist, 12, 16);
        const side = Math.sin(ctx.t * 0.5) > 0 ? 0.5 : -0.5;
        const want = ctx.player.pos.clone().add(new V3(-Math.sin(o.yaw + side) * r, 3.5, -Math.cos(o.yaw + side) * r));
        if (ph.name === 'move') a.seek(want, ctx.dt, ctx.speedMul);
        else a.brake(ctx.dt);
        a.face(o.yaw, ctx.dt, 2);
        if (ph.name === 'fire' && ph.t < ctx.dt * 1.5) {
          const from = a.pos.clone().add(new V3(0, 0, 0));
          const at = lead(from, ppos(ctx, 0.9), ctx.player.vel, 18);
          ctx.shots.fire('bolt', from, at.sub(from).normalize().multiplyScalar(18), {life: 3});
        }
      } else a.seek(wanderAt(a, ctx.t, 3, 2).setY(a.home.y + 0.3 * Math.sin(ctx.t)), ctx.dt);
      a.step(ctx.dt, ctx);
      root.rotation.z = -a.vel.x * 0.05;
      eye(ctx, ph.name === 'charge' ? 0.4 + 0.6 * ph.k : 0.15, ph.name === 'fire' ? 1 : 0);
    };
  },

  // ------------------------------------------------------------ elites
  spider(g, K) {
    // circles the disc rim; in Hunt mode it races along the rim to your bearing. Two mouths are the only weak points.
    const P = parts(g);
    const body = P.node([0, 0.75, 0]);
    P.mesh(new THREE.CylinderGeometry(0.9, 1.0, 0.45, 8), M.body, [0, 0, 0], undefined, undefined, body);
    const mouths = weakSpots(body, [[0.35, 0.1, 0.9], [-0.35, 0.1, 0.9]], 0.14);
    const legs = createLegs(g.parent, body, Array.from({length: 8}, (_, k) => {
      const ang = (k / 8) * Math.PI * 2 + Math.PI / 8;
      return {hip: [Math.sin(ang) * 0.8, 0, Math.cos(ang) * 0.8], rest: [Math.sin(ang) * 1.9, Math.cos(ang) * 1.9], group: k % 2};
    }), {femur: 0.95, tibia: 1.05, stride: 0.7, stepTime: 0.12, lift: 0.35, thick: 0.08, mat: M.dark});
    const a = new Agent(g, K.home, {speed: 5, turn: 5});
    const R = Math.hypot(K.home.x - K.centre.x, K.home.z - K.centre.z) || 6;
    let ang = Math.atan2(K.home.x - K.centre.x, K.home.z - K.centre.z);
    return (ctx) => {
      let dAng = 0.25;
      if (hunting(ctx)) {
        const pa = Math.atan2(ctx.player.pos.x - K.centre.x, ctx.player.pos.z - K.centre.z);
        dAng = clamp(angDiff(ang, pa) * 2, -0.9, 0.9);
      }
      ang += dAng * ctx.dt * ctx.speedMul;
      const tgt = new V3(K.centre.x + Math.sin(ang) * R, a.pos.y, K.centre.z + Math.cos(ang) * R);
      a.seek(tgt, ctx.dt, 1.5 * ctx.speedMul, 0.05);
      a.step(ctx.dt, ctx);
      if (hunting(ctx) && a.pos.distanceTo(ctx.player.pos) < 1.8) ctx.hurt('spider');
      mouths(ctx, 1);
      legs.update(ctx.dt, ctx, a.vel.length() / 2);
    };
  },
  censer(g, K) {
    // a swinging censer on a chain that follows you overhead and lobs burning blood that pools on the floor
    const P = parts(g);
    const hook = P.node([0, 6.5, 0]);
    P.box(0.5, 0.2, 0.5, M.dark, [0, 0, 0], undefined, hook);
    const ch = chain(P, hook, 7, 0.45, 0.08, 0.08, M.dark);
    const cage = P.node([0, 0.45, 0], ch.links[6]);
    P.mesh(new THREE.OctahedronGeometry(0.6), M.mid, [0, 0.5, 0], undefined, [1, 1.2, 1], cage);
    const coals = weakSpots(cage, [[0, 0.5, 0]], 0.2);
    const a = new Agent(g, K.home, {speed: 2.5, fly: true});
    let lob = 0;
    return (ctx) => {
      const hunt = hunting(ctx);
      a.seek(hunt ? ctx.player.pos.clone().setY(a.home.y).add(new V3(4, 0, 0)) : wanderAt(a, ctx.t, 2), ctx.dt, ctx.speedMul, 1);
      a.step(ctx.dt, ctx);
      const sw = 0.65 * Math.sin(ctx.t * 1.4);
      ch.links[0].rotation.set(Math.PI + sw - a.vel.x * 0.05, 0, 0.2 * Math.sin(ctx.t * 0.7));
      for (let i = 1; i < 7; i++) ch.links[i].rotation.set(0.06 * Math.sin(ctx.t * 1.4 - i * 0.4), 0, 0);
      lob += ctx.dt;
      if (hunt && lob > 2.8 && Math.abs(Math.sin(ctx.t * 1.4)) > 0.95) {
        lob = 0;
        const from = cage.getWorldPosition(new V3());
        const at = ppos(ctx);
        const T = 1.2;
        const v = new V3((at.x - from.x) / T, (at.y - from.y + 0.5 * 9.8 * T * T) / T, (at.z - from.z) / T);
        ctx.shots.fire('blob', from, v, {gravity: 9.8, life: 3, onHit: (p) => ctx.shots.pool(p.setY(ctx.ground(p.x, p.z, p.y + 1) ?? p.y), 1.6, '#8a1a10', 4)});
      }
      coals(ctx, 0.5 + 0.5 * Math.abs(Math.sin(ctx.t * 1.4)));
    };
  },
  diver(g, K) {
    // circles high, marks your tier with a ring (tell), then dives to the mark; it lies stunned and open after
    const P = parts(g);
    const root = P.node();
    P.cone(0.5, 1.8, M.body, [0, 0, 0], [Math.PI, 0, 0], root);
    const wings = [-1, 1].map((sx) => {
      const w = P.node([sx * 0.2, 0.4, 0], root);
      P.box(1.4, 0.08, 0.6, M.mid, [sx * 0.7, 0, 0], undefined, w);
      return {w, sx};
    });
    const back = weakSpots(root, [[0, 0.5, -0.3]], 0.15);
    const mark = new THREE.Mesh(new THREE.RingGeometry(1.6, 2, 32), new THREE.MeshBasicMaterial({color: COL.glow, transparent: true, side: THREE.DoubleSide}));
    mark.rotation.x = -Math.PI / 2;
    g.parent.add(mark);
    const a = new Agent(g, K.home.clone().setY(K.home.y + 9), {speed: 6, fly: true, turn: 3});
    const ph = new Phases(['circle', 'mark', 'dive', 'stunned', 'rise'], {circle: 3, mark: 1.4, dive: 0.7, stunned: 1.6, rise: 1.2});
    const spot = new V3();
    const from = new V3();
    return (ctx) => {
      ph.tick(ctx.dt);
      const centre = hunting(ctx) ? ctx.player.pos : a.home;
      const high = (ctx.ground(centre.x, centre.z, centre.y + 2) ?? centre.y) + 9;
      if (ph.name === 'circle' || ph.name === 'mark' || ph.name === 'rise') {
        a.seek(new V3(centre.x + Math.cos(ctx.t) * 4, high, centre.z + Math.sin(ctx.t) * 4), ctx.dt, ctx.speedMul);
        if (ph.name === 'mark') spot.copy(centre).setY(ctx.ground(centre.x, centre.z, centre.y + 1) ?? centre.y);
        from.copy(a.pos);
      } else if (ph.name === 'dive') {
        a.pos.lerpVectors(from, spot, ph.k * ph.k);
        a.vel.set(0, 0, 0);
        if (ph.k > 0.85 && hunting(ctx) && ctx.player.pos.distanceTo(spot) < 2 && Math.abs(ctx.player.pos.y - spot.y) < 1) ctx.hurt('dive');
      } else a.brake(ctx.dt, 10);
      a.step(ctx.dt, ctx);
      root.rotation.x = ph.name === 'dive' ? 0 : -Math.PI / 2 + 0.4;
      wings.forEach(({w, sx}) => (w.rotation.z = sx * (ph.name === 'dive' ? 1.1 : 0.3 * Math.sin(ctx.t * 10))));
      mark.visible = ph.name === 'mark' || ph.name === 'dive';
      mark.position.copy(spot).setY(spot.y + 0.05);
      mark.material.opacity = ph.name === 'mark' ? 0.4 + 0.5 * Math.abs(Math.sin(ctx.t * 8)) : 0.9;
      back(ctx, ph.name === 'stunned' ? 1 : 0.1);
    };
  },
  percher(g, K) {
    // holds the high perch, tracks you, glints (tell) and fires down; jetpack above it to reach its eye on top
    const P = parts(g);
    const root = P.node();
    P.box(0.9, 1.6, 0.9, M.body, [0, 0.8, 0], undefined, root);
    const head = P.node([0, 1.75, 0], root);
    P.box(1.2, 0.5, 1.2, M.mid, [0, 0, 0], undefined, head);
    const eye = weakSpots(head, [[0, 0.3, 0]], 0.15);
    const a = new Agent(g, K.home, {speed: 0, turn: 2});
    let shot = 0;
    return (ctx) => {
      const tgt = hunting(ctx) ? ctx.player.pos : wanderAt(a, ctx.t, 8);
      a.face(a.to(tgt).yaw, ctx.dt);
      a.step(ctx.dt, ctx);
      head.rotation.x = clamp(-a.to(tgt).dy * 0.05, -0.6, 0.6);
      shot += ctx.dt;
      if (hunting(ctx) && shot > 2.6) {
        shot = 0;
        const from = head.getWorldPosition(new V3());
        ctx.shots.fire('bolt', from, lead(from, ppos(ctx, 0.9), ctx.player.vel, 22).sub(from).normalize().multiplyScalar(22), {life: 3});
      }
      eye(ctx, 1, shot > 2.2 ? 1 : 0);
    };
  },
  floater(g, K) {
    // drifts, gulps orbs (mana stand-ins drift to it), and drops Divers; the gut is the weak point
    const P = parts(g);
    const root = P.node();
    P.sph(1.4, M.body, [0, 0, 0], [1, 0.85, 1], root);
    const tend = [0, 1, 2, 3, 4].map((k) => {
      const ang = (k / 5) * Math.PI * 2;
      const b = P.node([Math.cos(ang) * 0.8, -0.9, Math.sin(ang) * 0.8], root);
      const c = chain(P, b, 6, 0.4, 0.12, 0.05, M.dark);
      c.links[0].rotation.x = Math.PI;
      return c;
    });
    const gut = weakSpots(root, [[0, -0.5, 1.1]], 0.2);
    const a = new Agent(g, K.home.clone().setY(K.home.y + 5), {speed: 1.4, fly: true});
    return (ctx) => {
      a.seek(hunting(ctx) ? ctx.player.pos.clone().add(new V3(5, 5, 5)) : wanderAt(a, ctx.t, 3, 3).setY(a.home.y + 0.5 * Math.sin(ctx.t * 0.7)), ctx.dt, ctx.speedMul);
      a.step(ctx.dt, ctx);
      tend.forEach((c, k) => c.links.forEach((l, i) => i && l.rotation.set(0.25 * Math.sin(ctx.t * 1.5 + k + i * 0.6) - a.vel.x * 0.04, 0, a.vel.z * 0.04)));
      root.scale.y = 0.85 + 0.08 * Math.sin(ctx.t * 3);
      gut(ctx, 1);
    };
  },
  sentinel(g, K) {
    // walks you down and turns slowly; it takes damage only from behind, so its weak point is on its back
    const P = parts(g);
    const body = P.node([0, 2.4, 0]);
    P.box(1.4, 1.6, 0.9, M.mid, [0, 0, 0], undefined, body);
    P.box(0.8, 0.8, 0.8, M.mid, [0, 1.2, 0], undefined, body);
    for (const sx of [-1, 1]) P.box(0.4, 1.5, 0.4, M.mid, [sx * 0.95, -0.1, 0], undefined, body);
    const eyes = P.box(0.5, 0.1, 0.05, mat('#ff6a3a', {emissive: new THREE.Color('#ff3a1c'), emissiveIntensity: 0}), [0, 1.3, 0.42], undefined, body);
    const back = weakSpots(body, [[0, 0.1, -0.5]], 0.18);
    const legs = createLegs(g.parent, body, [{hip: [0.4, -0.8, 0], rest: [0.45, 0], group: 0}, {hip: [-0.4, -0.8, 0], rest: [-0.45, 0], group: 1}], {femur: 0.85, tibia: 0.85, stride: 0.6, stepTime: 0.42, lift: 0.3, thick: 0.38, mat: M.mid});
    const a = new Agent(g, K.home, {speed: 1.6, turn: 0.7});
    let prevYaw = 0;
    return (ctx) => {
      a.seek(hunting(ctx) ? ctx.player.pos : wanderAt(a, ctx.t, 4), ctx.dt, ctx.speedMul, 1.6);
      a.step(ctx.dt, ctx);
      const turning = Math.abs(angDiff(prevYaw, a.yaw)) / Math.max(ctx.dt, 1e-4);
      prevYaw = a.yaw;
      eyes.material.emissiveIntensity = turning > 0.3 ? 2.5 : 0.3;
      body.position.y = 2.4 + 0.06 * Math.abs(Math.sin(ctx.t * 4));
      if (hunting(ctx) && a.pos.distanceTo(ctx.player.pos) < 2) ctx.hurt('stone');
      back(ctx, 1);
      legs.update(ctx.dt, ctx, a.vel.length());
    };
  },
  zealot(g, K) {
    // stays behind the others and shields the two nearest with a halo; chants bolts. No weak point: kill it first.
    const P = parts(g);
    const root = P.node();
    P.cone(0.7, 2.2, M.body, [0, 1.1, 0], undefined, root);
    P.sph(0.3, M.mid, [0, 2.4, 0], undefined, root);
    const gold = mat('#e8d27a', {emissive: new THREE.Color('#e8d27a'), emissiveIntensity: 0.6});
    const halo = P.mesh(new THREE.TorusGeometry(0.45, 0.05, 4, 24), gold, [0, 2.85, 0], [Math.PI / 2, 0, 0], undefined, root);
    const shields = [0, 1].map(() => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), new THREE.MeshBasicMaterial({color: '#e8d27a', transparent: true, opacity: 0.14, depthWrite: false}));
      g.parent.add(m);
      return m;
    });
    const a = new Agent(g, K.home, {speed: 2.4});
    let chant = 0;
    return (ctx) => {
      // keep the allies between you and the player
      const allies = ctx.agents.filter((x) => x !== a && x.pos);
      allies.sort((p, q) => p.pos.distanceTo(a.pos) - q.pos.distanceTo(a.pos));
      let want = wanderAt(a, ctx.t, 2);
      if (hunting(ctx) && allies[0]) want = allies[0].pos.clone().add(allies[0].pos.clone().sub(ctx.player.pos).setY(0).normalize().multiplyScalar(4));
      a.seek(want, ctx.dt, ctx.speedMul, 1);
      a.step(ctx.dt, ctx);
      halo.rotation.z = ctx.t;
      shields.forEach((s, k) => {
        const al = allies[k];
        s.visible = !!al;
        if (al) {
          s.position.copy(al.pos).setY(al.pos.y + 1.4);
          s.scale.setScalar(2.4 + 0.1 * Math.sin(ctx.t * 3));
        }
      });
      chant += ctx.dt;
      if (hunting(ctx) && chant > 3) {
        chant = 0;
        const from = a.pos.clone().setY(a.pos.y + 2.4);
        ctx.shots.fire('bolt', from, ppos(ctx, 0.9).sub(from).normalize().multiplyScalar(14), {life: 3});
      }
    };
  },
  maggot(g, K) {
    // eats corpses and grows a size each time; no weak point, just kill it small
    const P = parts(g);
    const root = P.node([0, 0, 0]);
    const segs = Array.from({length: 7}, (_, k) => P.sph(0.42 - k * 0.03, mat('#e4d6c2'), [0, 0.4, -k * 0.5], [1, 0.8, 1], root));
    const corpses = Array.from({length: 3}, (_, k) => {
      const m = P.box(0.8, 0.3, 1.2, mat('#5a2a24'), [0, -50, 0], undefined, g.parent);
      return {m, p: K.home.clone().add(new V3(Math.cos(k * 2.1) * 5, 0, Math.sin(k * 2.1) * 5)), eaten: false};
    });
    const a = new Agent(g, K.home, {speed: 1.2, turn: 1.5});
    let size = 0.6;
    return (ctx) => {
      const food = corpses.find((c) => !c.eaten);
      const tgt = hunting(ctx) ? ctx.player.pos : food ? food.p : wanderAt(a, ctx.t, 3);
      a.seek(tgt, ctx.dt, ctx.speedMul, 0.3);
      a.step(ctx.dt, ctx);
      for (const c of corpses) {
        c.p.y = ctx.ground(c.p.x, c.p.z, c.p.y + 2) ?? c.p.y;
        c.m.position.copy(c.p).setY(c.eaten ? -50 : c.p.y + 0.15);
        if (!c.eaten && a.pos.distanceTo(c.p) < 0.8 * size + 0.5) {
          c.eaten = true;
          size = Math.min(2, size + 0.45);
        }
      }
      if (corpses.every((c) => c.eaten)) {
        corpses.forEach((c) => (c.eaten = false));
        size = 0.6;
      }
      root.scale.setScalar(size);
      segs.forEach((s, k) => (s.position.y = 0.4 + 0.12 * Math.max(0, Math.sin(ctx.t * 3 - k * 0.7))));
      if (hunting(ctx) && a.pos.distanceTo(ctx.player.pos) < size + 0.4) ctx.hurt('maggot');
    };
  },
  bloater(g, K) {
    // spits bile arcs from range; its belly swells over time and bursts in a cloud if you let it get close
    const P = parts(g);
    const root = P.node([0, 2.2, 0]);
    const belly = P.sph(1.3, mat('#b98a6a'), [0, 0, 0], undefined, root);
    P.sph(0.45, M.body, [0, 0.9, 0.9], undefined, root);
    const wp = weakSpots(root, [[0, -0.2, 1.3]], 0.2);
    const a = new Agent(g, K.home, {speed: 1.6, hover: 0});
    let spit = 0;
    return (ctx) => {
      const hunt = hunting(ctx);
      const o = a.to(ctx.player.pos);
      a.seek(hunt ? ctx.player.pos.clone().add(new V3(-Math.sin(o.yaw) * 9, 0, -Math.cos(o.yaw) * 9)) : wanderAt(a, ctx.t, 3), ctx.dt, ctx.speedMul, 1);
      if (hunt) a.face(o.yaw, ctx.dt);
      a.step(ctx.dt, ctx);
      spit += ctx.dt;
      belly.scale.setScalar(1 + 0.25 * ((spit % 3) / 3));
      root.position.y = 2.2 + 0.2 * Math.sin(ctx.t);
      if (hunt && spit > 3) {
        spit = 0;
        const from = a.pos.clone().setY(a.pos.y + 3);
        const at = ppos(ctx);
        const T = 1.1;
        ctx.shots.fire('blob', from, new V3((at.x - from.x) / T, (at.y - from.y + 4.9 * T * T) / T, (at.z - from.z) / T), {gravity: 9.8, life: 3, onHit: (p) => ctx.shots.pool(p.setY(ctx.ground(p.x, p.z, p.y + 1) ?? p.y), 1.4, '#7a5a1a', 3)});
      }
      wp(ctx, 1);
    };
  },
  imp(g, K) {
    // sprints in, snatches (your mana, here a hit) and flees with the sack glowing; corner it and the loot drops back
    const P = parts(g);
    const body = P.node([0, 0, 0]);
    P.sph(0.35, M.body, [0, 0.5, 0], [1, 1.2, 1], body);
    P.cone(0.08, 0.3, M.dark, [0.15, 0.95, 0], [0, 0, -0.3], body);
    P.cone(0.08, 0.3, M.dark, [-0.15, 0.95, 0], [0, 0, 0.3], body);
    const sack = P.sph(0.3, mat('#d6b44a', {metalness: 0.4, emissive: new THREE.Color('#e0b43a'), emissiveIntensity: 0}), [0, 0.6, -0.4], undefined, body);
    const a = new Agent(g, K.home, {speed: 9, turn: 7});
    let loot = false;
    let flee = 0;
    return (ctx) => {
      if (hunting(ctx)) {
        if (!loot) {
          if (a.seek(ctx.player.pos, ctx.dt, ctx.speedMul, 0.4) < 0.9) {
            loot = true;
            flee = 6;
            ctx.hurt('steal');
          }
        } else {
          flee -= ctx.dt;
          const away = a.pos.clone().add(a.pos.clone().sub(ctx.player.pos).setY(0).normalize().multiplyScalar(6));
          a.seek(away, ctx.dt, 1.15 * ctx.speedMul);
          if (flee <= 0 || a.pos.distanceTo(ctx.player.pos) < 1.2) loot = false; // caught (or it got away and comes back)
        }
      } else {
        const ang = ctx.t * 1.4;
        a.seek(a.home.clone().add(new V3(Math.cos(ang) * 3.5, 0, Math.sin(ang) * 3.5)), ctx.dt, 0.5);
      }
      a.step(ctx.dt, ctx);
      body.position.y = Math.abs(Math.sin(ctx.t * 9)) * 0.35;
      sack.material.emissiveIntensity = loot ? 1 : 0;
    };
  },
  gilded(g, K) {
    // the Gilded skull rig: faces you, rattles and fires its coin volley at you, vents open to show the core
    const skull = createSkull(g);
    const a = new Agent(g, K.home, {speed: 2, fly: true, turn: 1.4});
    const ph = new Phases(['shut', 'tell', 'volley', 'vent', 'close'], {shut: 2.4, tell: 0.8, volley: 1.0, vent: 3.0, close: 0.6});
    let open = 0;
    return (ctx) => {
      ph.tick(ctx.dt);
      const hunt = hunting(ctx);
      const tgt = hunt ? ctx.player.pos : wanderAt(a, ctx.t, 2);
      a.seek(hunt ? ctx.player.pos.clone().add(a.pos.clone().sub(ctx.player.pos).setY(0).normalize().multiplyScalar(8)).setY(a.home.y) : tgt.setY(a.home.y), ctx.dt, ctx.speedMul, 1);
      a.face(a.to(hunt ? ctx.player.pos : ctx.camera.position).yaw, ctx.dt);
      a.step(ctx.dt, ctx);
      const want = ph.name === 'vent' ? 1 : 0;
      open += Math.sign(want - open) * Math.min(Math.abs(want - open), ctx.dt / 0.5);
      const tell = ph.name === 'tell' ? ph.k : 0;
      const jaw = ph.name === 'volley' ? 1 : 0;
      if (hunt && ph.name === 'volley' && ph.t < ctx.dt * 1.5) {
        const from = a.pos.clone().add(new V3(Math.sin(a.yaw) * 0.6, 2.05, Math.cos(a.yaw) * 0.6));
        for (let k = -3; k <= 3; k++) {
          const d = ppos(ctx, 0.9).sub(from).normalize();
          d.applyAxisAngle(new V3(0, 1, 0), k * 0.12);
          ctx.shots.fire('coin', from, d.multiplyScalar(13).add(new V3(0, 1.5, 0)), {gravity: 4, life: 2.5});
        }
      }
      skull.update({t: ctx.t, origin: [0, 2.3 + 0.15 * Math.sin(1.3 * ctx.t), 0], yaw: 0, open, jaw, tell, broken: PLATES.map(() => null), core: {open: ctx.showWeak ? open : 0, hit: 0, dead: 0, pulse: 0.5 + 0.5 * Math.sin(ctx.t * 6)}, coins: []}, ctx.camera);
      skull.core.mesh.visible = ctx.showWeak;
    };
  },
  twins(g, K) {
    // a tethered pair that circles you from opposite sides; the tether is the danger. Weak points: none (damage both)
    const P = parts(g);
    const pair = [0, 1].map(() => {
      const n = P.node([0, 0, 0], g.parent);
      P.mesh(new THREE.CapsuleGeometry(0.4, 1.2, 2, 8), M.body, [0, 1.1, 0], undefined, undefined, n);
      P.sph(0.3, M.mid, [0, 2.1, 0], undefined, n);
      return n;
    });
    const tether = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1, 4), new THREE.MeshBasicMaterial({color: COL.glow}));
    g.parent.add(tether);
    const a = new Agent(g, K.home, {speed: 4});
    return (ctx) => {
      const hunt = hunting(ctx);
      const c = hunt ? ctx.player.pos.clone() : a.home.clone().add(new V3(Math.sin(ctx.t * 0.3) * 2, 0, 0));
      a.seek(c, ctx.dt, ctx.speedMul, 0.2);
      a.step(ctx.dt, ctx);
      const r = hunt ? 3 + 1.5 * Math.sin(ctx.t * 0.8) : 1.6;
      const ang = ctx.t * (hunt ? 1.6 : 1.2);
      pair.forEach((n, k) => {
        const s = k ? -1 : 1;
        n.position.set(a.pos.x + s * Math.cos(ang) * r, 0, a.pos.z + s * Math.sin(ang) * r);
        n.position.y = ctx.ground(n.position.x, n.position.z, a.pos.y + 2) ?? a.pos.y;
        n.lookAt(a.pos.x, n.position.y, a.pos.z);
      });
      const A = pair[0].position;
      const B = pair[1].position;
      tether.position.set((A.x + B.x) / 2, (A.y + B.y) / 2 + 1.4, (A.z + B.z) / 2);
      tether.scale.y = A.distanceTo(B);
      tether.lookAt(A.x, A.y + 1.4, A.z);
      tether.rotateX(Math.PI / 2);
      if (hunt) {
        // distance from the player to the tether segment
        const ab = B.clone().sub(A);
        const k = clamp(ctx.player.pos.clone().sub(A).dot(ab) / ab.lengthSq(), 0, 1);
        if (A.clone().addScaledVector(ab, k).distanceTo(ctx.player.pos.clone().setY(A.y)) < 0.5) ctx.hurt('tether');
      }
    };
  },
  siren(g, K) {
    // sings a pull beam: a rising tell, then a cone that drags you in; the throat is open while it sings
    const P = parts(g);
    const root = P.node();
    P.mesh(new THREE.CapsuleGeometry(0.3, 2.4, 2, 8), M.body, [0, 1.6, 0], undefined, undefined, root);
    const beam = P.mesh(new THREE.ConeGeometry(1.8, 12, 16, 1, true), new THREE.MeshBasicMaterial({color: '#d996c9', transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false}), [0, 2.6, 6], [-Math.PI / 2, 0, 0], undefined, root);
    beam.castShadow = false;
    const throat = weakSpots(root, [[0, 2.4, 0.32]], 0.13);
    const a = new Agent(g, K.home, {speed: 1.5, turn: 1.4});
    const ph = new Phases(['idle', 'rise', 'sing'], {idle: 2.5, rise: 1.0, sing: 2.5});
    return (ctx) => {
      ph.tick(ctx.dt);
      const hunt = hunting(ctx);
      const o = a.to(ctx.player.pos);
      if (hunt) {
        a.seek(o.dist < 10 ? a.pos.clone().add(a.pos.clone().sub(ctx.player.pos).setY(0).normalize()) : a.pos, ctx.dt, ctx.speedMul);
        a.face(o.yaw, ctx.dt);
      } else a.face(Math.sin(ctx.t * 0.4) * 0.8, ctx.dt);
      a.step(ctx.dt, ctx);
      const singing = ph.name === 'sing';
      beam.material.opacity = singing ? 0.22 + 0.08 * Math.sin(ctx.t * 12) : ph.name === 'rise' ? 0.06 * ph.k : 0.02;
      if (hunt && singing && o.dist < 13 && Math.abs(angDiff(a.yaw, o.yaw)) < 0.25) ctx.pull.add(a.pos.clone().sub(ctx.player.pos).setY(0).normalize().multiplyScalar(26));
      throat(ctx, singing ? 1 : 0.15);
    };
  },
  berserker(g, K) {
    // charges at you and gets faster and hotter as the fight goes on; no weak point: burst it, never chip it
    const P = parts(g);
    const body = P.node([0, 2.4, 0]);
    const hot = mat('#c9b7a8', {emissive: new THREE.Color('#e0561a'), emissiveIntensity: 0});
    P.box(2.0, 1.8, 1.3, hot, [0, 0, 0], undefined, body);
    P.box(0.9, 0.8, 0.9, hot, [0, 1.2, 0.3], undefined, body);
    const arms = [-1, 1].map((sx) => {
      const n = P.node([sx * 1.35, 0.6, 0.2], body);
      P.box(0.7, 2.0, 0.7, hot, [0, -0.9, 0], undefined, n);
      return {n, sx};
    });
    const legs = createLegs(g.parent, body, [{hip: [0.55, -0.9, 0], rest: [0.65, 0], group: 0}, {hip: [-0.55, -0.9, 0], rest: [-0.65, 0], group: 1}], {femur: 0.8, tibia: 0.8, stride: 0.7, stepTime: 0.28, lift: 0.35, thick: 0.6, mat: hot});
    const a = new Agent(g, K.home, {speed: 3.5, turn: 2.5});
    let rage = 0;
    return (ctx) => {
      const hunt = hunting(ctx);
      rage = hunt ? Math.min(1, rage + ctx.dt * 0.08) : Math.max(0, rage - ctx.dt * 0.2);
      a.seek(hunt ? ctx.player.pos : wanderAt(a, ctx.t, 4), ctx.dt, (1 + rage * 1.4) * ctx.speedMul, 1.2);
      a.step(ctx.dt, ctx);
      hot.emissiveIntensity = rage * 1.3;
      arms.forEach(({n, sx}) => (n.rotation.x = Math.sin(ctx.t * (4 + rage * 6) + (sx > 0 ? 0 : Math.PI)) * 0.8));
      if (hunt && a.pos.distanceTo(ctx.player.pos) < 1.8) ctx.hurt('smash');
      legs.update(ctx.dt, ctx, a.vel.length() / 2);
    };
  },
  orobas(g, K) {
    // turns to you, shows the beam line (tell), then sweeps a low beam across the arena: jump it. Weak point: the head.
    const P = parts(g);
    const root = P.node();
    P.box(1.6, 3.2, 1.6, M.mid, [0, 1.6, 0], undefined, root);
    const head = P.node([0, 3.6, 0], root);
    P.box(1.2, 1.0, 2.2, M.body, [0, 0, 0.4], undefined, head);
    const wp = weakSpots(head, [[0, 0.55, 0.2]], 0.18);
    const beam = P.box(0.12, 0.12, 30, new THREE.MeshBasicMaterial({color: COL.glow, transparent: true}), [0, -2.8, 15], undefined, head);
    beam.castShadow = false;
    const a = new Agent(g, K.home, {speed: 0, turn: 1.5});
    const ph = new Phases(['track', 'line', 'sweep'], {track: 2, line: 1, sweep: 2.2});
    let sweep0 = 0;
    return (ctx) => {
      ph.tick(ctx.dt);
      const hunt = hunting(ctx);
      const o = a.to(hunt ? ctx.player.pos : wanderAt(a, ctx.t, 8));
      if (ph.name === 'track') {
        a.face(o.yaw - 0.9, ctx.dt);
        sweep0 = a.yaw;
      } else if (ph.name === 'sweep') a.yaw = sweep0 + ph.k * 1.8;
      a.step(ctx.dt, ctx);
      beam.material.opacity = ph.name === 'line' ? 0.3 : ph.name === 'sweep' ? 1 : 0;
      beam.scale.x = beam.scale.y = ph.name === 'sweep' ? 2.2 : 0.6;
      if (hunt && ph.name === 'sweep') {
        const by = a.pos.y + 0.8;
        const along = Math.abs(angDiff(a.yaw, o.yaw));
        if (along < 0.06 && o.dist < 30 && ctx.player.pos.y < by + 0.2 && ctx.player.pos.y + 1.8 > by) ctx.hurt('beam');
      }
      wp(ctx, 1);
    };
  },
  mimic(g, K) {
    // sits as a mana orb that does not bob; when you come close it opens and lunges. The open mouth is the weak point.
    const P = parts(g);
    const root = P.node([0, 1, 0]);
    const orbMat = mat('#8fd4ff', {emissive: new THREE.Color('#8fd4ff'), emissiveIntensity: 0.6});
    const top = P.mesh(new THREE.SphereGeometry(0.35, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), orbMat, [0, 0, 0], undefined, undefined, root);
    const bot = P.mesh(new THREE.SphereGeometry(0.35, 12, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), orbMat, [0, 0, 0], undefined, undefined, root);
    for (let k = 0; k < 6; k++) P.cone(0.04, 0.14, M.body, [Math.cos(k) * 0.25, -0.04, Math.sin(k) * 0.25], [Math.PI, 0, 0], top);
    const tongue = weakSpots(root, [[0, 0, 0]], 0.12);
    const a = new Agent(g, K.home, {speed: 10, turn: 8});
    let bite = 0;
    return (ctx) => {
      const near = hunting(ctx) && a.pos.distanceTo(ctx.player.pos) < 4;
      bite = near ? Math.min(1, bite + ctx.dt * 3) : Math.max(0, bite - ctx.dt);
      if (near) a.seek(ctx.player.pos, ctx.dt, ctx.speedMul, 0.6);
      else a.seek(a.home, ctx.dt, 0.2);
      a.step(ctx.dt, ctx);
      top.rotation.x = -bite * 0.9 * (0.6 + 0.4 * Math.abs(Math.sin(ctx.t * 14)));
      bot.rotation.x = bite * 0.4;
      if (near && bite > 0.8 && a.pos.distanceTo(ctx.player.pos) < 1) ctx.hurt('mimic');
      tongue(ctx, bite);
    };
  },
  liar(g, K) {
    // three copies circle you; only the real one casts a shadow, and only it fires. Its chest is the weak point.
    const P = parts(g);
    const copies = [0, 1, 2].map((k) => {
      const n = P.node([0, 0, 0], g.parent);
      const robe = P.cone(0.6, 2.2, M.body, [0, 1.1, 0], undefined, n);
      const head = P.sph(0.3, M.mid, [0, 2.4, 0], undefined, n);
      robe.castShadow = head.castShadow = k === 0;
      return n;
    });
    const chest = weakSpots(copies[0], [[0, 1.5, 0.38]], 0.14);
    const a = new Agent(g, K.home, {speed: 3});
    let shot = 0;
    return (ctx) => {
      const hunt = hunting(ctx);
      a.seek(hunt ? ctx.player.pos : a.home, ctx.dt, ctx.speedMul, 0.2);
      a.step(ctx.dt, ctx);
      const r = hunt ? 7 : 2.5;
      copies.forEach((n, k) => {
        const ang = ctx.t * 0.3 + (k / 3) * Math.PI * 2;
        n.position.set(a.pos.x + Math.cos(ang) * r, 0, a.pos.z + Math.sin(ang) * r);
        n.position.y = ctx.ground(n.position.x, n.position.z, a.pos.y + 3) ?? a.pos.y;
        n.lookAt(hunt ? ctx.player.pos.x : a.pos.x, n.position.y, hunt ? ctx.player.pos.z : a.pos.z);
      });
      shot += ctx.dt;
      if (hunt && shot > 2.2) {
        shot = 0;
        const from = copies[0].position.clone().setY(copies[0].position.y + 1.6);
        ctx.shots.fire('bolt', from, ppos(ctx, 0.9).sub(from).normalize().multiplyScalar(15), {life: 3});
      }
      chest(ctx, 1);
    };
  },
  traitor(g, K) {
    // frozen in the ice; when you turn your back it thaws and comes for you. No weak point: shatter it while frozen.
    const P = parts(g);
    const fig = P.node();
    P.mesh(new THREE.CapsuleGeometry(0.4, 1.1, 2, 8), M.body, [0, 1.0, 0], undefined, undefined, fig);
    P.sph(0.3, M.mid, [0, 1.95, 0], undefined, fig);
    const ice = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.6, 1.6), new THREE.MeshStandardMaterial({color: '#bfe1f2', transparent: true, opacity: 0.55, roughness: 0.1}));
    ice.position.y = 1.2;
    g.add(ice);
    const a = new Agent(g, K.home, {speed: 5, turn: 4});
    let thaw = 0;
    return (ctx) => {
      const hunt = hunting(ctx);
      let back = false;
      if (hunt) {
        // the player's back is to it when the camera looks away from it
        const look = ctx.camera.getWorldDirection(new V3()).setY(0).normalize();
        const toIt = a.pos.clone().sub(ctx.player.pos).setY(0).normalize();
        back = look.dot(toIt) < 0;
      } else back = Math.sin(ctx.t * 0.9) > 0.6;
      thaw = clamp(thaw + (back ? 0.4 : -0.15) * ctx.dt, 0, 1);
      if (thaw >= 1 && hunt) a.seek(ctx.player.pos, ctx.dt, ctx.speedMul, 0.8);
      else a.brake(ctx.dt);
      a.step(ctx.dt, ctx);
      ice.scale.set(1 - thaw * 0.9, 1 - thaw * 0.95, 1 - thaw * 0.9);
      ice.position.y = 1.2 * (1 - thaw);
      fig.position.y = thaw >= 1 ? 0.1 * Math.abs(Math.sin(ctx.t * 8)) : 0;
      if (hunt && thaw >= 1 && a.pos.distanceTo(ctx.player.pos) < 1.2) ctx.hurt('traitor');
    };
  },
  lancer(g, K) {
    // keeps range and throws freezing lances in an arc, leading your run; no weak point
    const P = parts(g);
    const root = P.node();
    P.mesh(new THREE.CapsuleGeometry(0.35, 1.6, 2, 8), M.body, [0, 1.2, 0], undefined, undefined, root);
    const arm = P.node([0.45, 1.9, 0], root);
    P.cone(0.08, 2.0, mat('#bfe1f2', {emissive: new THREE.Color('#9fd0ff'), emissiveIntensity: 0.5}), [0, 0.6, 0], undefined, arm);
    const a = new Agent(g, K.home, {speed: 3, turn: 3});
    let thr = 0;
    return (ctx) => {
      const hunt = hunting(ctx);
      const o = a.to(ctx.player.pos);
      if (hunt) {
        a.seek(o.dist < 11 ? a.pos.clone().add(a.pos.clone().sub(ctx.player.pos).setY(0).normalize().multiplyScalar(3)) : a.pos, ctx.dt, ctx.speedMul);
        a.face(o.yaw, ctx.dt);
      } else a.seek(wanderAt(a, ctx.t, 3), ctx.dt);
      a.step(ctx.dt, ctx);
      thr += ctx.dt;
      arm.rotation.x = thr > 2 ? -1.2 * ((thr - 2) / 0.6) : 0;
      if (hunt && thr > 2.6) {
        thr = 0;
        const from = arm.getWorldPosition(new V3());
        const at = lead(from, ppos(ctx, 0.9), ctx.player.vel, 16);
        const T = from.distanceTo(at) / 16;
        ctx.shots.fire('lance', from, new V3((at.x - from.x) / T, (at.y - from.y + 3 * T * T) / T, (at.z - from.z) / T), {gravity: 6, life: 3, onHit: (p) => ctx.shots.pool(p.setY(ctx.ground(p.x, p.z, p.y + 1) ?? p.y), 1.5, '#bfe1f2', 3)});
      }
    };
  },

  // ------------------------------------------------------------ princes (12 to 30 m, aerial). They track the player.
  'p-leviathan'(g, K) {
    // rises and sinks over its pool; eight tentacles reach for the player (tip IK on a chain), rings of shots
    const P = parts(g);
    const root = P.node();
    P.sph(3.2, M.prince, [0, 0, 0], [1.1, 0.9, 1.2], root);
    for (const sx of [-1, 1]) P.box(1.4, 1.0, 0.6, M.princeDark, [sx * 1.3, 0.6, 2.9], undefined, root);
    const arms = Array.from({length: 8}, (_, k) => {
      const ang = (k / 8) * Math.PI * 2;
      const b = P.node([Math.cos(ang) * 2.2, -2.2, Math.sin(ang) * 2.2], root);
      return {b, ch: chain(P, b, 12, 0.9, 0.9, 0.18, M.prince), ang};
    });
    const wp = weakSpots(root, [[1.3, 0.6, 3.25], [-1.3, 0.6, 3.25], [0, 2.6, 1.5]], 0.45);
    const a = new Agent(g, K.home, {speed: 0, fly: true, turn: 0.6});
    let ring = 0;
    return (ctx) => {
      const hunt = hunting(ctx);
      if (hunt) a.face(a.to(ctx.player.pos).yaw, ctx.dt);
      a.pos.y = a.home.y + 1.5 * Math.sin(ctx.t * 0.4);
      a.step(ctx.dt, ctx);
      for (const {b, ch, ang} of arms) {
        // aim the arm's base at the player (or hang), then curl the chain with a travelling wave
        if (hunt) {
          const bw = b.getWorldPosition(new V3());
          const d = ctx.player.pos.clone().sub(bw);
          b.rotation.set(0, 0, 0);
          b.lookAt(bw.clone().add(d));
          b.rotateX(Math.PI / 2 + 0.2);
        } else b.rotation.set(Math.PI + 0.6 * Math.cos(ang) * 0, 0, 0);
        ch.pose((i) => (i === 0 ? (hunt ? 0 : 0.6) : 0.1 + 0.12 * Math.sin(ctx.t * 1.1 + ang * 3 + i * 0.35)), () => 0);
      }
      ring += ctx.dt;
      if (hunt && ring > 3) {
        ring = 0;
        for (let k = 0; k < 16; k++) {
          const d = new V3(Math.cos((k / 16) * Math.PI * 2), -0.25, Math.sin((k / 16) * Math.PI * 2)).normalize();
          ctx.shots.fire('bolt', a.pos.clone(), d.multiplyScalar(10), {life: 4});
        }
      }
      wp(ctx, 1);
    };
  },
  'p-belphegor'(g, K) {
    const P = parts(g);
    const root = P.node();
    P.mesh(new THREE.CapsuleGeometry(2.6, 9, 4, 10), M.prince, [0, -2, 0], undefined, undefined, root);
    P.cyl(0.4, 0.4, 14, M.princeDark, [0, 10, 0], undefined, root);
    const wings = [-1, 1].map((sx) => {
      const w = P.node([sx * 2, 1, 0], root);
      P.box(11, 0.3, 6, M.princeDark, [sx * 5.5, 0, 0], undefined, w);
      return {w, sx};
    });
    const top = weakSpots(root, [[0, 4.2, 1.2], [1.5, 3.5, -1], [-1.5, 3.5, -1]], 0.5);
    const a = new Agent(g, K.home, {speed: 0, fly: true, turn: 0.3});
    return (ctx) => {
      a.face(hunting(ctx) ? a.to(ctx.player.pos).yaw : ctx.t * 0.08, ctx.dt);
      a.step(ctx.dt, ctx);
      wings.forEach(({w, sx}) => (w.rotation.z = sx * (-0.6 + 0.25 * Math.sin(ctx.t * 0.5))));
      top(ctx, 1);
    };
  },
  'p-belial'(g, K) {
    const P = parts(g);
    const root = P.node([0, -12, 0]);
    P.box(5, 8, 3, M.prince, [0, 6, 0], undefined, root);
    P.box(2.6, 2.6, 2.6, M.prince, [0, 11.4, 0], undefined, root);
    for (let k = 0; k < 5; k++) P.cone(0.35, 1.8, mat('#d6b44a', {metalness: 0.5}), [-1.2 + k * 0.6, 13.4, 0], undefined, root);
    for (const sx of [-1, 1]) P.box(1.4, 6, 1.4, M.prince, [sx * 3.4, 6, 0], undefined, root);
    const shield = new THREE.Mesh(new THREE.SphereGeometry(8, 24, 16), new THREE.MeshBasicMaterial({color: '#e8d27a', transparent: true, opacity: 0.1, depthWrite: false}));
    shield.position.y = 7;
    root.add(shield);
    const wp = weakSpots(root, [[0, 11.6, 1.35]], 0.5);
    const a = new Agent(g, K.home, {speed: 0, fly: true, turn: 0.4});
    return (ctx) => {
      if (hunting(ctx)) a.face(a.to(ctx.player.pos).yaw, ctx.dt);
      a.step(ctx.dt, ctx);
      shield.material.opacity = 0.07 + 0.05 * Math.sin(ctx.t * 2);
      wp(ctx, 0.4);
    };
  },
  'p-beelzebub'(g, K) {
    const n = 500;
    const flies = new THREE.InstancedMesh(new THREE.BoxGeometry(0.35, 0.2, 0.5), M.princeDark, n);
    flies.frustumCulled = false;
    flies.castShadow = true;
    g.add(flies);
    const core = weakSpots(g, [[0, 0, 0]], 1.2);
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const v = new V3();
    const s1 = new V3(1, 1, 1);
    const a = new Agent(g, K.home, {speed: 1.5, fly: true});
    return (ctx) => {
      const hunt = hunting(ctx);
      a.seek(hunt ? ctx.player.pos.clone().setY(a.home.y) : a.home, ctx.dt, ctx.speedMul, 2);
      a.step(ctx.dt, ctx);
      // the swarm thins as it reaches for you: the core shows
      const reach = hunt ? clamp(1 - a.to(ctx.player.pos).dist / 20, 0, 1) : 0;
      for (let i = 0; i < n; i++) {
        const ang = ctx.t * (0.4 + (i % 7) * 0.05) + i * 2.399;
        const y = ((i * 0.618) % 1) * 2 - 1;
        const r = (5 + 2 * Math.sin(ctx.t * 0.6 + i) + reach * 4) * Math.sqrt(1 - y * y);
        v.set(Math.cos(ang) * r, y * 6, Math.sin(ang) * r);
        if (hunt && i % 5 === 0) v.lerp(ctx.player.pos.clone().sub(a.pos).setY(ctx.player.pos.y - a.pos.y + 1), 0.25 + 0.2 * Math.sin(ctx.t + i));
        e.set(0, -ang, 0);
        m4.compose(v, q.setFromEuler(e), s1);
        flies.setMatrixAt(i, m4);
      }
      flies.instanceMatrix.needsUpdate = true;
      core(ctx, 0.3 + 0.7 * reach);
    };
  },
  'p-mammon'(g, K) {
    const P = parts(g);
    const root = P.node();
    const gold = mat('#c9a227', {metalness: 0.5, roughness: 0.45});
    P.box(7, 6, 4.5, gold, [0, 0, 0], undefined, root);
    P.box(3, 2.4, 2.6, gold, [0, 4.2, 0.5], undefined, root);
    for (const sx of [-1, 1]) for (let k = 0; k < 5; k++) P.cyl(1.4 - k * 0.15, 1.4 - k * 0.15, 0.5, gold, [sx * 4.2, 3.2 + k * 0.55, 0], undefined, root);
    const arms = [-1, 1].map((sx) => {
      const b = P.node([sx * 4.6, 1.5, 0], root);
      const ch = chain(P, b, 6, 1.4, 0.9, 0.6, gold);
      ch.links[0].rotation.z = sx * 2.4;
      return {ch, sx};
    });
    const hoard = P.sph(2.6, mat('#d6b44a', {metalness: 0.5}), [0, -6, 3], [1.2, 0.8, 1.2], root);
    const wp = weakSpots(root, [[0, 0, 2.3], [0, -6, 5.1]], 0.6);
    const a = new Agent(g, K.home, {speed: 0, fly: true, turn: 0.5});
    return (ctx) => {
      if (hunting(ctx)) a.face(a.to(ctx.player.pos).yaw, ctx.dt);
      a.pos.y = a.home.y + Math.sin(ctx.t * 0.5);
      a.step(ctx.dt, ctx);
      arms.forEach(({ch, sx}) => ch.links.forEach((l, i) => i && (l.rotation.z = sx * 0.15 * Math.sin(ctx.t + i))));
      hoard.scale.y = 0.8 + 0.1 * Math.sin(ctx.t * 1.3);
      wp(ctx, 1);
    };
  },
  'p-lilith'(g, K) {
    const P = parts(g);
    const root = P.node();
    P.mesh(new THREE.CapsuleGeometry(1.4, 9, 4, 10), M.prince, [0, 0, 0], undefined, undefined, root);
    P.sph(1.2, M.prince, [0, 6.4, 0], undefined, root);
    const wings = [-1, 1].map((sx) => {
      const w = P.node([sx * 1.2, 3, -0.6], root);
      P.box(9, 0.3, 4, M.princeDark, [sx * 4.5, 0, 0], [0, 0, sx * 0.3], w);
      return {w, sx};
    });
    const mirror = P.mesh(new THREE.CylinderGeometry(3.2, 3.2, 0.3, 24), mat('#c3cad6', {metalness: 0.8, roughness: 0.15}), [0, 1, 4], [Math.PI / 2, 0, 0], undefined, root);
    const wp = weakSpots(root, [[0, 3, 1.5]], 0.5);
    const a = new Agent(g, K.home, {speed: 0, fly: true, turn: 0.6});
    return (ctx) => {
      if (hunting(ctx)) a.face(a.to(ctx.player.pos).yaw, ctx.dt);
      a.step(ctx.dt, ctx);
      wings.forEach(({w, sx}) => (w.rotation.z = sx * 0.2 * Math.sin(ctx.t * 0.8)));
      const up = Math.sin(ctx.t * 0.4) > 0;
      mirror.position.y = up ? 1 : -9;
      wp(ctx, up ? 0.2 : 1);
    };
  },
  'p-amon'(g, K) {
    const P = parts(g);
    const root = P.node();
    P.box(6, 6, 4, M.prince, [0, 0, 0], undefined, root);
    P.box(3, 3, 3, M.prince, [0, 4.4, 0.5], undefined, root);
    for (const sx of [-1, 1]) P.cone(0.6, 4, M.princeDark, [sx * 1.8, 7, 0.5], [0, 0, -sx * 0.6], root);
    const ring = P.mesh(new THREE.TorusGeometry(1.4, 0.18, 4, 16), mat('#8f8578', {metalness: 0.6}), [3.6, -1.5, 1.5], undefined, undefined, root);
    const beam = P.box(0.3, 0.3, 40, new THREE.MeshBasicMaterial({color: COL.glow, transparent: true, opacity: 0.8}), [0, 4.6, 20], [0.35, 0, 0], root);
    beam.castShadow = false;
    const wp = weakSpots(root, [[0.8, 4.8, 2.05], [-0.8, 4.8, 2.05]], 0.4);
    const a = new Agent(g, K.home, {speed: 0, fly: true, turn: 0.5});
    return (ctx) => {
      a.face(hunting(ctx) ? a.to(ctx.player.pos).yaw + Math.sin(ctx.t * 0.8) * 0.5 : Math.sin(ctx.t * 0.35) * 0.9, ctx.dt);
      a.step(ctx.dt, ctx);
      ring.rotation.z = ctx.t * 2;
      wp(ctx, 1);
    };
  },
  'p-quire'(g, K) {
    const P = parts(g);
    const root = P.node();
    const page = mat('#e9e1cf');
    for (const sx of [-1, 1]) P.box(7, 0.4, 9, page, [sx * 3.6, 0, 0], [0, 0, sx * 0.25], root);
    P.box(0.6, 0.8, 9.2, M.princeDark, [0, -0.6, 0], undefined, root);
    const quills = [-1, 1].map((sx) => {
      const b = P.node([sx * 7.4, 0.5, -2], root);
      return {ch: chain(P, b, 5, 1.6, 0.5, 0.2, M.princeDark), sx};
    });
    const wp = weakSpots(root, [[0, 0.8, 0]], 0.6);
    const a = new Agent(g, K.home, {speed: 0, fly: true, turn: 0.4});
    return (ctx) => {
      a.face(hunting(ctx) ? a.to(ctx.player.pos).yaw : ctx.t * 0.12, ctx.dt);
      a.step(ctx.dt, ctx);
      quills.forEach(({ch, sx}) => ch.pose((i) => (i ? 0.4 + 0.3 * Math.sin(ctx.t * 2.4 + i + sx) : 0.9), () => 0));
      wp(ctx, 1);
    };
  },
  'p-companion'(g, K) {
    const P = parts(g);
    const root = P.node();
    const ghost = mat('#dfe6ee', {transparent: true, opacity: 0.55, emissive: new THREE.Color('#9fb8cc'), emissiveIntensity: 0.25});
    P.cone(3, 12, ghost, [0, 0, 0], undefined, root);
    P.sph(1.5, ghost, [0, 7, 0], undefined, root);
    P.box(2.4, 1.3, 1.6, mat('#1a1d24'), [0, 7, 0.9], undefined, root);
    const a = new Agent(g, K.home, {speed: 2, fly: true, turn: 0.8});
    return (ctx) => {
      // it keeps beside you, a little ahead, until it turns
      const hunt = hunting(ctx);
      a.seek(hunt ? ctx.player.pos.clone().add(new V3(6, a.home.y - ctx.player.pos.y, 6)) : a.home, ctx.dt, ctx.speedMul, 1);
      a.pos.y += (a.home.y + Math.sin(ctx.t * 0.5) * 0.8 - a.pos.y) * ctx.dt;
      a.face(hunt ? a.to(ctx.player.pos).yaw : Math.sin(ctx.t * 0.2) * 0.3, ctx.dt);
      a.step(ctx.dt, ctx);
    };
  },
};
