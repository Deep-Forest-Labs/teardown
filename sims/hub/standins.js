// Whitebox stand-ins for every enemy and prince: chunky primitives that move the way the board's verb says, with
// red weak points where the design has them. Each builder returns {group, update(t, ctx)}; ctx.camera faces the
// weak point halos. All motion is a pure function of t, so thumbnails are repeatable.
// The skull worm and the Gilded skull use their real prototype rigs.
import * as THREE from 'three';
import {createBody as createWyrmBody} from '../bonepede2-shared/body.js';
import {createTrail} from '../bonepede2-shared/trail.js';
import {pose as wyrmPose} from '../bonepede2-shared/wyrm.js';
import {createWeakpoints} from '../dfl-kit/weakpoint.js';
import {createSkull} from '../gilded-shared/skull.js';
import {stateAt as gildedState} from '../gilded-shared/film.js';

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

/** Weak points at fixed local positions on `parent`; update(t, camera, open = 1). */
function weakSpots(parent, pts, r = 0.14) {
  const w = createWeakpoints(parent, pts.length, r);
  const m4 = new THREE.Matrix4();
  return (t, camera, open = 1) => {
    w.face(camera);
    pts.forEach((p, i) => w.set(i, m4.makeTranslation(...p), {open, pulse: 0.5 + 0.5 * Math.sin(t * 5 + i)}));
    w.commit();
  };
}

/** A tapered chain of n boxes from the node's origin, each link turned by bend(i) about X and twist(i) about Y. */
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

const tri = (x) => 1 - Math.abs(((x % 2) + 2) % 2 - 1) * 2; // -1..1 triangle wave

export const BUILD = {
  swarm(g) {
    const P = parts(g);
    const n = 28;
    const skulls = Array.from({length: n}, () => P.sph(0.28, M.body, [0, 0, 0], [1, 0.85, 1.1]));
    return (t) => skulls.forEach((s, i) => {
      const a = t * 0.9 + i * 0.7;
      s.position.set(Math.cos(a) * (2 + (i % 4) * 0.4) + Math.sin(t * 0.5) * 1.5, 2.6 + Math.sin(a * 1.3 + i) * 0.9, Math.sin(a) * (1.6 + (i % 3) * 0.5));
    });
  },
  puffer(g) {
    const P = parts(g);
    const b = P.sph(0.35, M.body, [0, 2.2, 0]);
    const spikes = Array.from({length: 10}, (_, k) => P.cone(0.06, 0.3, M.dark, [0, 0, 0], [0, 0, 0], b));
    spikes.forEach((s, k) => {
      const a = k * 2.4;
      const y = ((k % 5) / 4) * 2 - 1;
      const r = Math.sqrt(1 - y * y);
      s.position.set(Math.cos(a) * r * 0.36, y * 0.36, Math.sin(a) * r * 0.36);
      s.lookAt(s.position.clone().multiplyScalar(3));
      s.rotateX(Math.PI / 2);
    });
    return (t) => {
      const u = (t % 4) / 4;
      b.scale.setScalar(u < 0.6 ? 1 + u * 1.4 : 1.84);
      b.position.set(u < 0.6 ? 0 : (u - 0.6) * 14, 2.2, 0);
    };
  },
  wyrm(g) {
    // the trail is laid forward in time as t advances (and from -10 s so the body exists at t = 0)
    const trail = createTrail({minStep: 0.015});
    const body = createWyrmBody(g);
    const path = (tau) => [5 * Math.sin(0.5 * tau), 3.4 + 1.2 * Math.sin(0.9 * tau + 1), 4 * Math.sin(1.0 * tau)];
    let tau = -10;
    const step = 1 / 120;
    return (t, c) => {
      while (tau < t) {
        trail.push(path(tau));
        tau += step;
      }
      const P = wyrmPose(trail, trail.length, t * 5.2);
      body.update(P, c.camera, (i) => ({open: 1, pulse: 0.5 + 0.5 * Math.sin(t * 5 - i * 0.55)}), 0.5 + 0.5 * Math.sin(t * 2.3));
    };
  },
  scorpion(g) {
    const P = parts(g);
    const root = P.node([0, 0.5, 0]);
    P.box(1.1, 0.45, 1.6, M.body, [0, 0, 0], undefined, root);
    for (const sx of [-1, 1]) {
      for (let k = 0; k < 3; k++) P.box(0.9, 0.08, 0.08, M.dark, [sx * 0.85, -0.25, -0.4 + k * 0.4], [0, 0, sx * 0.5], root);
      P.box(0.25, 0.25, 0.7, M.mid, [sx * 0.45, 0, 1.1], [0, sx * 0.3, 0], root);
    }
    const tailBase = P.node([0, 0.2, -0.8], root);
    const tail = chain(P, tailBase, 6, 0.32, 0.3, 0.14, M.body);
    const wp = weakSpots(tail.links[5], [[0, 0.4, 0]], 0.12);
    return (t, c) => {
      const u = (t % 5) / 5;
      const charge = u < 0.3 ? 0 : u < 0.55 ? (u - 0.3) / 0.25 : 1 - (u - 0.55) / 0.45;
      root.position.x = -4 + 8 * charge;
      root.rotation.y = u < 0.55 ? Math.PI / 2 : -Math.PI / 2;
      root.position.y = 0.5 + (u < 0.3 ? 0.04 * Math.sin(t * 30) : 0);
      tail.pose((i) => -0.5 - 0.15 * i + 0.1 * Math.sin(t * 3 + i));
      wp(t, c.camera);
    };
  },
  spawner(g) {
    const P = parts(g);
    const root = P.node();
    for (let k = 0; k < 5; k++) P.sph(1.1 - k * 0.15, M.mid, [0, 0.9 + k * 0.85, 0], [1, 0.8, 1], root);
    const mouth = weakSpots(root, [[0, 4.6, 0]], 0.3);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.06, 4, 32), new THREE.MeshBasicMaterial({color: COL.glow, transparent: true}));
    ring.rotation.x = Math.PI / 2;
    root.add(ring);
    return (t, c) => {
      root.position.set(Math.cos(t * 0.2) * 3, 0, Math.sin(t * 0.2) * 3);
      const u = (t % 3) / 3;
      ring.scale.setScalar(1 + u * 5);
      ring.material.opacity = 1 - u;
      ring.position.y = 0.2;
      mouth(t, c.camera);
    };
  },
  quadruped(g) {
    const P = parts(g);
    const root = P.node([0, 1.5, 0]);
    P.box(1.2, 0.8, 2.6, M.body, [0, 0, 0], undefined, root);
    P.box(0.7, 0.6, 0.8, M.mid, [0, 0.2, 1.6], undefined, root);
    const legs = [[0.55, 1.0], [-0.55, 1.0], [0.55, -1.0], [-0.55, -1.0]].map(([x, z]) => {
      const hip = P.node([x, -0.3, z], root);
      P.box(0.22, 1.3, 0.22, M.dark, [0, -0.6, 0], undefined, hip);
      return hip;
    });
    const wp = weakSpots(root, [[0, 0.5, -1.0]], 0.15);
    return (t, c) => {
      const u = (t % 6) / 6;
      const crouch = u > 0.6 && u < 0.75 ? Math.sin(((u - 0.6) / 0.15) * Math.PI) : 0;
      const pounce = u >= 0.75 && u < 0.9 ? Math.sin(((u - 0.75) / 0.15) * Math.PI) : 0;
      root.position.set(Math.sin(t * 0.3) * 4, 1.5 - crouch * 0.5 + pounce * 2.2, Math.cos(t * 0.3) * 2);
      root.rotation.y = t * 0.3 + Math.PI / 2;
      legs.forEach((l, i) => (l.rotation.x = 0.5 * Math.sin(t * 4 + (i === 0 || i === 3 ? 0 : Math.PI))));
      wp(t, c.camera);
    };
  },
  shooter(g) {
    const P = parts(g);
    const root = P.node([0, 3, 0]);
    P.mesh(new THREE.OctahedronGeometry(0.7), M.body, [0, 0, 0], [0, 0, 0], [1, 1.5, 1], root);
    const eye = weakSpots(root, [[0, 0.1, 0.62]], 0.16);
    return (t, c) => {
      root.position.set(Math.sin(t * 0.4) * 2, 3 + 0.3 * Math.sin(t * 1.3), 0);
      root.rotation.y = Math.sin(t * 0.4) * 0.5;
      const u = (t % 2.5) / 2.5;
      eye(t, c.camera, u > 0.7 ? 1 : 0.4);
    };
  },
  spider(g) {
    const P = parts(g);
    const root = P.node([0, 0.6, 0]);
    P.mesh(new THREE.CylinderGeometry(0.9, 1.0, 0.45, 8), M.body, [0, 0, 0], undefined, undefined, root);
    const legs = Array.from({length: 8}, (_, k) => {
      const a = (k / 8) * Math.PI * 2 + 0.2;
      const hip = P.node([Math.cos(a) * 0.85, 0, Math.sin(a) * 0.85], root);
      hip.rotation.y = -a;
      P.box(1.0, 0.1, 0.1, M.dark, [0.5, 0.25, 0], [0, 0, 0.5], hip);
      P.box(0.1, 0.9, 0.1, M.dark, [0.95, -0.15, 0], undefined, hip);
      return hip;
    });
    const mouths = weakSpots(root, [[0.35, 0.1, 0.9], [-0.35, 0.1, 0.9]], 0.14);
    return (t, c) => {
      const a = t * 0.5;
      root.position.set(Math.cos(a) * 3, 0.6, Math.sin(a) * 3);
      root.rotation.y = -a;
      legs.forEach((l, k) => (l.position.y = 0.08 * Math.max(0, Math.sin(t * 8 + k * 1.6))));
      mouths(t, c.camera);
    };
  },
  censer(g) {
    const P = parts(g);
    const hook = P.node([0, 6.5, 0]);
    P.box(0.5, 0.2, 0.5, M.dark, [0, 0, 0], undefined, hook);
    const ch = chain(P, hook, 7, 0.45, 0.08, 0.08, M.dark);
    ch.links[0].rotation.x = Math.PI; // hang down
    const cage = P.node([0, 0.45, 0], ch.links[6]);
    P.mesh(new THREE.OctahedronGeometry(0.6), M.mid, [0, 0.5, 0], undefined, [1, 1.2, 1], cage);
    const coals = weakSpots(cage, [[0, 0.5, 0]], 0.2);
    return (t, c) => {
      const sw = 0.6 * Math.sin(t * 1.4);
      ch.links[0].rotation.set(Math.PI + sw, 0, 0.2 * Math.sin(t * 0.7));
      for (let i = 1; i < 7; i++) ch.links[i].rotation.set(0.06 * Math.sin(t * 1.4 - i * 0.4), 0, 0);
      coals(t, c.camera);
    };
  },
  diver(g) {
    const P = parts(g);
    const root = P.node();
    P.cone(0.5, 1.8, M.body, [0, 0, 0], [Math.PI, 0, 0], root);
    for (const sx of [-1, 1]) P.box(1.4, 0.08, 0.6, M.mid, [sx * 0.7, 0.4, 0], [0, 0, sx * 0.4], root);
    const mark = new THREE.Mesh(new THREE.RingGeometry(1.6, 2, 32), new THREE.MeshBasicMaterial({color: COL.glow, transparent: true, side: THREE.DoubleSide}));
    mark.rotation.x = -Math.PI / 2;
    mark.position.y = 0.05;
    g.add(mark);
    return (t) => {
      const u = (t % 5) / 5;
      const dive = u > 0.65 ? (u - 0.65) / 0.35 : 0;
      root.position.set(Math.cos(t) * 3 * (1 - dive), 9 - dive * dive * 8.4, Math.sin(t) * 3 * (1 - dive));
      root.rotation.set(0, t, dive * 0.4);
      mark.material.opacity = u > 0.35 ? 0.9 : 0;
    };
  },
  percher(g) {
    const P = parts(g);
    const root = P.node();
    P.box(0.9, 1.6, 0.9, M.body, [0, 0.8, 0], undefined, root);
    P.box(1.2, 0.5, 1.2, M.mid, [0, 1.75, 0], undefined, root);
    const eye = weakSpots(root, [[0, 1.4, 0.5]], 0.15);
    return (t, c) => {
      root.rotation.y = Math.sin(t * 0.6) * 0.8;
      root.rotation.x = 0.25;
      eye(t, c.camera, (t % 3) / 3 > 0.75 ? 1 : 0.5);
    };
  },
  floater(g) {
    const P = parts(g);
    const root = P.node([0, 5, 0]);
    P.sph(1.4, M.body, [0, 0, 0], [1, 0.85, 1], root);
    const tend = [0, 1, 2, 3, 4].map((k) => {
      const a = (k / 5) * Math.PI * 2;
      const b = P.node([Math.cos(a) * 0.8, -0.9, Math.sin(a) * 0.8], root);
      const c = chain(P, b, 6, 0.4, 0.12, 0.05, M.dark);
      c.links[0].rotation.x = Math.PI;
      return c;
    });
    const gut = weakSpots(root, [[0, -0.5, 1.1]], 0.2);
    return (t, c) => {
      root.position.set(Math.sin(t * 0.25) * 3, 5 + 0.5 * Math.sin(t * 0.7), Math.cos(t * 0.3) * 2);
      tend.forEach((ch, k) => ch.links.forEach((l, i) => i && l.rotation.set(0.25 * Math.sin(t * 1.5 + k + i * 0.6), 0, 0)));
      gut(t, c.camera);
    };
  },
  sentinel(g) {
    const P = parts(g);
    const root = P.node();
    P.box(1.4, 1.6, 0.9, M.mid, [0, 2.4, 0], undefined, root);
    P.box(0.8, 0.8, 0.8, M.mid, [0, 3.6, 0], undefined, root);
    const legs = [-0.4, 0.4].map((x) => {
      const h = P.node([x, 1.6, 0], root);
      P.box(0.45, 1.6, 0.45, M.mid, [0, -0.8, 0], undefined, h);
      return h;
    });
    for (const sx of [-1, 1]) P.box(0.4, 1.5, 0.4, M.mid, [sx * 0.95, 2.3, 0], undefined, root);
    const back = weakSpots(root, [[0, 2.5, -0.5]], 0.18);
    return (t, c) => {
      const z = tri(t * 0.12) * 4;
      root.position.set(0, 0, z);
      root.rotation.y = Math.sin(t * 0.12 * Math.PI) >= 0 ? 0 : Math.PI;
      legs.forEach((l, i) => (l.rotation.x = 0.35 * Math.sin(t * 2.5 + i * Math.PI)));
      back(t, c.camera);
    };
  },
  zealot(g) {
    const P = parts(g);
    const root = P.node();
    P.cone(0.7, 2.2, M.body, [0, 1.1, 0], undefined, root);
    P.sph(0.3, M.mid, [0, 2.4, 0], undefined, root);
    const halo = P.mesh(new THREE.TorusGeometry(0.45, 0.05, 4, 24), mat('#e8d27a', {emissive: new THREE.Color('#e8d27a'), emissiveIntensity: 0.6}), [0, 2.85, 0], [Math.PI / 2, 0, 0], undefined, root);
    const bubble = new THREE.Mesh(new THREE.SphereGeometry(3.2, 20, 12), new THREE.MeshBasicMaterial({color: '#e8d27a', transparent: true, opacity: 0.08, depthWrite: false}));
    bubble.position.y = 1.2;
    root.add(bubble);
    return (t) => {
      halo.rotation.z = t;
      bubble.scale.setScalar(1 + 0.05 * Math.sin(t * 2));
    };
  },
  maggot(g) {
    const P = parts(g);
    const root = P.node([0, 0.4, 0]);
    const segs = Array.from({length: 7}, (_, k) => P.sph(0.42 - k * 0.03, mat('#e4d6c2'), [0, 0, -k * 0.5], [1, 0.8, 1], root));
    return (t) => {
      const grow = 0.6 + 0.8 * ((t % 9) / 9);
      root.scale.setScalar(grow);
      segs.forEach((s, k) => (s.position.y = 0.12 * Math.max(0, Math.sin(t * 3 - k * 0.7))));
      root.position.set(Math.sin(t * 0.2) * 2, 0.4 * grow, 0);
      root.rotation.y = Math.cos(t * 0.2) * 0.8;
    };
  },
  bloater(g) {
    const P = parts(g);
    const root = P.node([0, 2.2, 0]);
    const belly = P.sph(1.3, mat('#b98a6a'), [0, 0, 0], undefined, root);
    P.sph(0.45, M.body, [0, 0.9, 0.9], undefined, root);
    const wp = weakSpots(root, [[0, -0.2, 1.3]], 0.2);
    return (t, c) => {
      const u = (t % 4) / 4;
      belly.scale.setScalar(1 + 0.25 * u);
      root.position.y = 2.2 + 0.2 * Math.sin(t);
      wp(t, c.camera);
    };
  },
  imp(g) {
    const P = parts(g);
    const root = P.node();
    P.sph(0.35, M.body, [0, 0.5, 0], [1, 1.2, 1], root);
    P.cone(0.08, 0.3, M.dark, [0.15, 0.95, 0], [0, 0, -0.3], root);
    P.cone(0.08, 0.3, M.dark, [-0.15, 0.95, 0], [0, 0, 0.3], root);
    P.sph(0.3, mat('#d6b44a', {metalness: 0.4}), [0, 0.6, -0.4], undefined, root); // the sack
    return (t) => {
      const a = t * 1.4;
      root.position.set(Math.cos(a) * 3.5, Math.abs(Math.sin(t * 6)) * 0.6, Math.sin(a) * 3.5);
      root.rotation.y = -a;
    };
  },
  gilded(g) {
    const skull = createSkull(g);
    return (t, c) => {
      const s = gildedState(t % 8.2); // the shut, volley and vent loop from the film
      s.broken = s.broken.map(() => null);
      s.core = {...s.core, open: s.open, dead: 0};
      s.coins = s.coins.filter((q) => q.p[1] > 0.03);
      skull.update(s, c.camera);
    };
  },
  twins(g) {
    const P = parts(g);
    const a = P.node();
    const b = P.node();
    for (const n of [a, b]) {
      P.mesh(new THREE.CapsuleGeometry(0.4, 1.2, 2, 8), M.body, [0, 1.1, 0], undefined, undefined, n);
      P.sph(0.3, M.mid, [0, 2.1, 0], undefined, n);
    }
    const tether = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1, 4), new THREE.MeshBasicMaterial({color: COL.glow}));
    g.add(tether);
    return (t) => {
      const c = [Math.sin(t * 0.3) * 2, 0, 0];
      const r = 1.6;
      a.position.set(c[0] + Math.cos(t * 1.2) * r, 0, Math.sin(t * 1.2) * r);
      b.position.set(c[0] - Math.cos(t * 1.2) * r, 0, -Math.sin(t * 1.2) * r);
      const mid = a.position.clone().add(b.position).multiplyScalar(0.5);
      tether.position.set(mid.x, 1.4, mid.z);
      tether.scale.y = a.position.distanceTo(b.position);
      tether.lookAt(a.position.x, 1.4, a.position.z);
      tether.rotateX(Math.PI / 2);
    };
  },
  siren(g) {
    const P = parts(g);
    const root = P.node();
    P.mesh(new THREE.CapsuleGeometry(0.3, 2.4, 2, 8), M.body, [0, 1.6, 0], undefined, undefined, root);
    const beam = P.mesh(new THREE.ConeGeometry(1.8, 9, 16, 1, true), new THREE.MeshBasicMaterial({color: '#d996c9', transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false}), [0, 2.6, 4.5], [-Math.PI / 2, 0, 0], undefined, root);
    beam.castShadow = false;
    return (t) => {
      root.rotation.y = Math.sin(t * 0.4) * 0.8;
      beam.material.opacity = 0.08 + 0.15 * Math.max(0, Math.sin(t * 1.5));
    };
  },
  berserker(g) {
    const P = parts(g);
    const root = P.node();
    const hot = mat('#c9b7a8', {emissive: new THREE.Color('#e0561a'), emissiveIntensity: 0});
    P.box(2.0, 1.8, 1.3, hot, [0, 2.4, 0], undefined, root);
    P.box(0.9, 0.8, 0.9, hot, [0, 3.6, 0.3], undefined, root);
    for (const sx of [-1, 1]) P.box(0.7, 2.0, 0.7, hot, [sx * 1.35, 2.1, 0.2], undefined, root);
    for (const sx of [-1, 1]) P.box(0.7, 1.5, 0.7, hot, [sx * 0.55, 0.75, 0], undefined, root);
    return (t) => {
      const u = (t % 6) / 6;
      hot.emissiveIntensity = u * 1.2;
      root.position.set(Math.sin(t * 0.25 * (1 + u)) * 3, Math.abs(Math.sin(t * 3 * (1 + u))) * 0.15, 0);
    };
  },
  orobas(g) {
    const P = parts(g);
    const root = P.node();
    P.box(1.6, 3.2, 1.6, M.mid, [0, 1.6, 0], undefined, root);
    const head = P.node([0, 3.6, 0], root);
    P.box(1.2, 1.0, 2.2, M.body, [0, 0, 0.4], undefined, head);
    const beam = P.box(0.12, 0.12, 22, new THREE.MeshBasicMaterial({color: COL.glow, transparent: true}), [0, 0, 12], undefined, head);
    beam.castShadow = false;
    return (t) => {
      head.rotation.y = Math.sin(t * 0.5) * 1.3;
      const u = (t % 4) / 4;
      beam.material.opacity = u < 0.4 ? 0.25 : 1;
      beam.scale.x = beam.scale.y = u < 0.4 ? 0.4 : 1.6;
    };
  },
  mimic(g) {
    const P = parts(g);
    const root = P.node([0, 1, 0]);
    const orbMat = mat('#8fd4ff', {emissive: new THREE.Color('#8fd4ff'), emissiveIntensity: 0.6});
    const top = P.mesh(new THREE.SphereGeometry(0.35, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), orbMat, [0, 0, 0], undefined, undefined, root);
    const bot = P.mesh(new THREE.SphereGeometry(0.35, 12, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), orbMat, [0, 0, 0], undefined, undefined, root);
    for (let k = 0; k < 6; k++) P.cone(0.04, 0.14, M.body, [Math.cos(k) * 0.25, -0.04, Math.sin(k) * 0.25], [Math.PI, 0, 0], top);
    return (t) => {
      const u = (t % 4) / 4;
      const bite = u > 0.75 ? Math.sin(((u - 0.75) / 0.25) * Math.PI) : 0;
      top.rotation.x = -bite * 0.9;
      bot.rotation.x = bite * 0.4;
      root.position.y = 1; // a real orb bobs; this one does not
    };
  },
  liar(g) {
    const P = parts(g);
    const copies = [0, 1, 2].map((k) => {
      const n = P.node();
      const robe = P.cone(0.6, 2.2, M.body, [0, 1.1, 0], undefined, n);
      const head = P.sph(0.3, M.mid, [0, 2.4, 0], undefined, n);
      robe.castShadow = head.castShadow = k === 0; // only the real one casts a shadow
      return n;
    });
    return (t) => copies.forEach((n, k) => {
      const a = t * 0.3 + (k / 3) * Math.PI * 2;
      n.position.set(Math.cos(a) * 2.5, 0, Math.sin(a) * 2.5);
    });
  },
  traitor(g) {
    const P = parts(g);
    const fig = P.node();
    P.mesh(new THREE.CapsuleGeometry(0.4, 1.1, 2, 8), M.body, [0, 1.0, 0], undefined, undefined, fig);
    P.sph(0.3, M.mid, [0, 1.95, 0], undefined, fig);
    const ice = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.6, 1.6), new THREE.MeshStandardMaterial({color: '#bfe1f2', transparent: true, opacity: 0.55, roughness: 0.1}));
    ice.position.y = 1.2;
    g.add(ice);
    return (t) => {
      const u = (t % 7) / 7;
      const thaw = u > 0.5 ? Math.min(1, (u - 0.5) / 0.2) : 0;
      ice.scale.set(1 - thaw * 0.9, 1 - thaw * 0.95, 1 - thaw * 0.9);
      ice.position.y = 1.2 * (1 - thaw);
      fig.position.z = thaw * 2;
      fig.rotation.y = thaw * Math.PI;
    };
  },
  lancer(g) {
    const P = parts(g);
    const root = P.node();
    P.mesh(new THREE.CapsuleGeometry(0.35, 1.6, 2, 8), M.body, [0, 1.2, 0], undefined, undefined, root);
    const lance = P.cone(0.08, 2.4, mat('#bfe1f2', {emissive: new THREE.Color('#9fd0ff'), emissiveIntensity: 0.5}), [0, 0, 0], [Math.PI / 2, 0, 0]);
    return (t) => {
      const u = (t % 3) / 3;
      const f = u > 0.4 ? (u - 0.4) / 0.6 : 0;
      lance.position.set(0, 2.2 + 2 * Math.sin(f * Math.PI) - f * 2, f * 12);
      lance.rotation.x = Math.PI / 2 + (f - 0.5) * 0.6;
    };
  },

  // ------------------------------------------------------------ princes (12 to 30 m, aerial)
  'p-leviathan'(g) {
    const P = parts(g);
    const root = P.node();
    P.sph(3.2, M.prince, [0, 0, 0], [1.1, 0.9, 1.2], root);
    for (const sx of [-1, 1]) P.box(1.4, 1.0, 0.6, M.princeDark, [sx * 1.3, 0.6, 2.9], undefined, root);
    const arms = Array.from({length: 8}, (_, k) => {
      const a = (k / 8) * Math.PI * 2;
      const b = P.node([Math.cos(a) * 2.2, -2.2, Math.sin(a) * 2.2], root);
      b.rotation.y = -a + Math.PI / 2;
      return chain(P, b, 12, 0.9, 0.9, 0.18, M.prince);
    });
    const wp = weakSpots(root, [[1.3, 0.6, 3.25], [-1.3, 0.6, 3.25], [0, 2.6, 1.5]], 0.45);
    return (t, c) => {
      root.position.y = 1.5 * Math.sin(t * 0.4);
      arms.forEach((ch, k) => ch.pose((i) => Math.PI + (i === 0 ? 0.6 : 0.12 + 0.12 * Math.sin(t * 1.1 + k + i * 0.35)), () => 0));
      wp(t, c.camera);
    };
  },
  'p-belphegor'(g) {
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
    return (t, c) => {
      root.rotation.y = t * 0.08;
      wings.forEach(({w, sx}) => (w.rotation.z = sx * (-0.6 + 0.25 * Math.sin(t * 0.5))));
      top(t, c.camera);
    };
  },
  'p-belial'(g) {
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
    return (t, c) => {
      shield.material.opacity = 0.07 + 0.05 * Math.sin(t * 2);
      wp(t, c.camera, 0.4);
    };
  },
  'p-beelzebub'(g) {
    const n = 500;
    const flies = new THREE.InstancedMesh(new THREE.BoxGeometry(0.35, 0.2, 0.5), M.princeDark, n);
    flies.frustumCulled = false;
    flies.castShadow = true;
    g.add(flies);
    const core = weakSpots(g, [[0, 0, 0]], 1.2);
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const v = new THREE.Vector3();
    const s1 = new THREE.Vector3(1, 1, 1);
    return (t, c) => {
      for (let i = 0; i < n; i++) {
        const a = t * (0.4 + (i % 7) * 0.05) + i * 2.399;
        const y = ((i * 0.618) % 1) * 2 - 1;
        const r = (5 + 2 * Math.sin(t * 0.6 + i)) * Math.sqrt(1 - y * y);
        v.set(Math.cos(a) * r, y * 6, Math.sin(a) * r);
        e.set(0, -a, 0);
        m4.compose(v, q.setFromEuler(e), s1);
        flies.setMatrixAt(i, m4);
      }
      flies.instanceMatrix.needsUpdate = true;
      core(t, c.camera);
    };
  },
  'p-mammon'(g) {
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
    return (t, c) => {
      root.position.y = Math.sin(t * 0.5);
      arms.forEach(({ch, sx}) => ch.links.forEach((l, i) => i && (l.rotation.z = sx * 0.15 * Math.sin(t + i))));
      hoard.scale.y = 0.8 + 0.1 * Math.sin(t * 1.3);
      wp(t, c.camera);
    };
  },
  'p-lilith'(g) {
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
    return (t, c) => {
      wings.forEach(({w, sx}) => (w.rotation.z = sx * 0.2 * Math.sin(t * 0.8)));
      const up = Math.sin(t * 0.4) > 0;
      mirror.position.y = up ? 1 : -9;
      wp(t, c.camera, up ? 0.2 : 1);
    };
  },
  'p-amon'(g) {
    const P = parts(g);
    const root = P.node();
    P.box(6, 6, 4, M.prince, [0, 0, 0], undefined, root);
    P.box(3, 3, 3, M.prince, [0, 4.4, 0.5], undefined, root);
    for (const sx of [-1, 1]) P.cone(0.6, 4, M.princeDark, [sx * 1.8, 7, 0.5], [0, 0, -sx * 0.6], root);
    const ring = P.mesh(new THREE.TorusGeometry(1.4, 0.18, 4, 16), mat('#8f8578', {metalness: 0.6}), [3.6, -1.5, 1.5], undefined, undefined, root);
    const beam = P.box(0.3, 0.3, 40, new THREE.MeshBasicMaterial({color: COL.glow, transparent: true, opacity: 0.8}), [0, 4.6, 20], undefined, root);
    beam.castShadow = false;
    const wp = weakSpots(root, [[0.8, 4.8, 2.05], [-0.8, 4.8, 2.05]], 0.4);
    return (t, c) => {
      root.rotation.y = Math.sin(t * 0.35) * 0.9;
      root.rotation.x = 0.35;
      ring.rotation.z = t * 2;
      wp(t, c.camera);
    };
  },
  'p-quire'(g) {
    const P = parts(g);
    const root = P.node();
    const page = mat('#e9e1cf');
    for (const sx of [-1, 1]) P.box(7, 0.4, 9, page, [sx * 3.6, 0, 0], [0, 0, sx * 0.25], root);
    P.box(0.6, 0.8, 9.2, M.princeDark, [0, -0.6, 0], undefined, root);
    const quills = [-1, 1].map((sx) => {
      const b = P.node([sx * 7.4, 0.5, -2], root);
      const ch = chain(P, b, 5, 1.6, 0.5, 0.2, M.princeDark);
      return {ch, sx};
    });
    const wp = weakSpots(root, [[0, 0.8, 0]], 0.6);
    return (t, c) => {
      root.rotation.y = t * 0.12;
      quills.forEach(({ch, sx}) => ch.pose((i) => (i ? 0.4 + 0.3 * Math.sin(t * 2.4 + i + sx) : 0.9), () => 0));
      wp(t, c.camera);
    };
  },
  'p-companion'(g) {
    const P = parts(g);
    const root = P.node();
    const ghost = mat('#dfe6ee', {transparent: true, opacity: 0.55, emissive: new THREE.Color('#9fb8cc'), emissiveIntensity: 0.25});
    P.cone(3, 12, ghost, [0, 0, 0], undefined, root);
    P.sph(1.5, ghost, [0, 7, 0], undefined, root);
    P.box(2.4, 1.3, 1.6, mat('#1a1d24'), [0, 7, 0.9], undefined, root); // the hood's dark
    return (t) => {
      root.position.y = Math.sin(t * 0.5) * 0.8;
      root.rotation.y = Math.sin(t * 0.2) * 0.3;
    };
  },
};
