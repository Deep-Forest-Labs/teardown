// Prince fights: the arena and its prince as one rig, posed by a single fight value f from 0 to 2
// (0..1 = phase one, 1..2 = phase two). The layout changes with f: tentacles become the rim and slam the disc,
// pillars fall into ramps, the gallery crumbles behind a walking colossus, the floor plates in gold. Every pose is a
// function of f and t, so the stage slider can scrub a fight and Hunt mode can play it.
// FIGHTS[biomeId](group) -> {phases: [names], spots(f) -> [[x,y,z]], spawn, cam, update(ctx, f)}
// Princes are 30 to 60 m. Units are metres; the player is 1.8 m.
import * as THREE from 'three';
import {createWeakpoints} from '../dfl-kit/weakpoint.js';

const V3 = THREE.Vector3;
export const mat = (c, extra = {}) => new THREE.MeshStandardMaterial({color: c, roughness: 0.85, flatShading: true, ...extra});
export const smooth = (x) => {
  const k = Math.min(1, Math.max(0, x));
  return k * k * (3 - 2 * k);
};
export const seg = (f, a, b) => smooth((f - a) / (b - a)); // 0..1 as f runs from a to b

export function kit(group) {
  const add = (geo, m, p = [0, 0, 0], r = [0, 0, 0], parent = group) => {
    const o = new THREE.Mesh(geo, m);
    o.position.set(...p);
    o.rotation.set(...r);
    o.castShadow = true;
    o.receiveShadow = true;
    parent.add(o);
    return o;
  };
  const node = (p = [0, 0, 0], parent = group) => {
    const n = new THREE.Group();
    n.position.set(...p);
    parent.add(n);
    return n;
  };
  const tag = (o, t) => ((o.userData.tag = t), o);
  const ring = (r0, r1, h, m, y = 0, parent = group, segs = 64) => {
    const shape = new THREE.Shape();
    shape.absarc(0, 0, r1, 0, Math.PI * 2, false);
    const hole = new THREE.Path();
    hole.absarc(0, 0, r0, 0, Math.PI * 2, true);
    shape.holes.push(hole);
    const geo = new THREE.ExtrudeGeometry(shape, {depth: h, bevelEnabled: false, curveSegments: segs});
    geo.rotateX(-Math.PI / 2);
    return add(geo, m, [0, y, 0], [0, 0, 0], parent);
  };
  /** A tapered chain of n boxes along +Y from parent; pose(bend(i)) turns each joint about its X. */
  const chain = (parent, n, len, w0, w1, m) => {
    const links = [];
    let p = parent;
    for (let i = 0; i < n; i++) {
      const w = w0 + (w1 - w0) * (i / (n - 1));
      const j = node([0, i === 0 ? 0 : len, 0], p);
      add(new THREE.BoxGeometry(w, len * 1.06, w), m, [0, len / 2, 0], [0, 0, 0], j);
      links.push(j);
      p = j;
    }
    return {links, tip: links[n - 1], pose: (bend, twist = () => 0) => links.forEach((j, i) => j.rotation.set(bend(i), twist(i), 0))};
  };
  /** Weak points at local positions on a parent; set(ctx, open, list of indices to open or all). */
  const weak = (parent, pts, r) => {
    const before = new Set(parent.children);
    const w = createWeakpoints(parent, pts.length, r);
    const meshes = parent.children.filter((c) => !before.has(c));
    const m4 = new THREE.Matrix4();
    return (ctx, openOf) => {
      for (const m of meshes) m.visible = ctx.showWeak;
      if (!ctx.showWeak) return;
      w.face(ctx.camera);
      pts.forEach((p, i) => w.set(i, m4.makeTranslation(...p), {open: openOf(i), pulse: 0.5 + 0.5 * Math.sin(ctx.t * 4 + i)}));
      w.commit();
    };
  };
  return {add, node, tag, ring, chain, weak};
}

export const M = {
  stone: mat('#5d5a63'),
  stone2: mat('#4a4750'),
  wall: mat('#6f6b75'),
  flesh: mat('#8c4a42'),
  fleshDark: mat('#5a2a26'),
  bone: mat('#cdbf9f'),
  gold: mat('#c9a227', {metalness: 0.5, roughness: 0.45}),
  goldDark: mat('#8a6a17', {metalness: 0.4, roughness: 0.55}),
  blood: mat('#5a120d', {emissive: new THREE.Color('#7a140c'), emissiveIntensity: 0.35, roughness: 0.4}),
  pad: mat('#d9660b', {emissive: new THREE.Color('#d9660b'), emissiveIntensity: 0.4}),
  lift: mat('#b59b17', {emissive: new THREE.Color('#b59b17'), emissiveIntensity: 0.25}),
  colossus: mat('#a69c90'),
  colossusDark: mat('#4a3f47'),
};

export const FIGHTS = {
  // ------------------------------------------------------------ Layer 1: Leviathan, the Skull Squid
  altar(g) {
    // The disc floats on a blood sea. Leviathan's eight tentacles rise out of the sea and grip the rim: they are the
    // arena's wall. Phase one: the skull surfaces through the centre pool and fires rings; its eyes are open.
    // Phase two (below half health): the skull sinks, two tentacles at a time tower and slam across the disc, which
    // tilts toward each slam; a slammed tentacle lies stuck for a moment with its tip suckers open.
    const K = kit(g);
    const sea = K.tag(K.add(new THREE.CylinderGeometry(70, 70, 0.4, 64), M.blood, [0, -8, 0]), 'nocollide');
    const tilt = K.node([0, 0, 0]);
    const disc = K.ring(7, 20, 1.6, M.stone, -1.6, tilt);
    K.ring(6.6, 7.2, 0.2, M.blood, -0.15, tilt);
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
      K.tag(K.add(new THREE.CylinderGeometry(0.9, 0.9, 0.25, 12), M.pad, [Math.cos(a) * 14, 0.1, Math.sin(a) * 14], [0, 0, 0], tilt), 'pad');
    }
    // the skull: 14 m across, in the pool under the disc
    const skull = K.node([0, -14, 0]);
    K.add(new THREE.IcosahedronGeometry(7, 1), M.bone, [0, 0, 0], [0, 0, 0], skull).scale.set(1, 0.85, 1.1);
    for (const sx of [-1, 1]) K.add(new THREE.BoxGeometry(3.2, 2.2, 1.4), M.fleshDark, [sx * 2.8, 1.4, 6.6], [0, 0, 0], skull);
    const jaw = K.node([0, -3.5, 2], skull);
    K.add(new THREE.BoxGeometry(9, 2, 7), M.bone, [0, -1, 2], [0, 0, 0], jaw);
    const eyes = K.weak(skull, [[2.8, 1.4, 7.4], [-2.8, 1.4, 7.4]], 1.0);
    // eight tentacles, 16 links of 2.2 m (35 m), rooted in the sea outside the rim, facing in
    const arms = Array.from({length: 8}, (_, k) => {
      const a = (k / 8) * Math.PI * 2;
      const base = K.node([Math.sin(a) * 23, -9, Math.cos(a) * 23]);
      base.rotation.y = a + Math.PI; // +Z toward the centre
      const pivot = K.node([0, 0, 0], base); // tips the whole arm in toward the disc
      const ch = K.chain(pivot, 16, 2.2, 2.6, 0.5, M.flesh);
      const tip = K.weak(ch.tip, [[0, 1.4, 0.5], [0, 0.4, 0.5]], 0.45);
      return {a, base, pivot, ch, tip, k};
    });
    // phase two: pairs of opposite arms slam in turn; each slam lasts 5 s of the fight clock
    const slamOf = (k, t, f) => {
      const p2 = seg(f, 1, 1.15);
      if (p2 <= 0) return 0;
      const slot = Math.floor(t / 5) % 4; // which pair is slamming
      if (k % 4 !== slot) return 0;
      const u = (t % 5) / 5;
      // tower (0..0.35), slam (0.35..0.45), stuck (0.45..0.8), pull back (0.8..1)
      return p2 * (u < 0.35 ? -0.6 * (u / 0.35) : u < 0.45 ? -0.6 + 2.2 * ((u - 0.35) / 0.1) : u < 0.8 ? 1.6 : 1.6 * (1 - (u - 0.8) / 0.2));
    };
    const pw = new V3();
    return {
      phases: ['Surfaced: the skull fires rings', 'Below half: tentacles slam and tilt the disc'],
      spawn: [0, 1, 12],
      killY: -6,
      cam: {target: [0, 4, 0], az: 30, el: 26, dist: 78},
      spots: () => [[15, 0.2, 2], [-8, 0.2, 12], [6, 0.2, -12], [-12, 0.2, -6], [10, 0.2, 11], [-15, 0.2, 3], [3, 0.2, 15], [12, 0.2, -11]],
      update(ctx, f) {
        const t = ctx.t;
        // skull: up through the pool in phase one, down in phase two
        const up = seg(f, 0, 0.12) * (1 - seg(f, 0.95, 1.1));
        skull.position.y = -14 + up * (16 + Math.sin(t * 0.6) * 1.2);
        jaw.rotation.x = 0.25 * Math.max(0, Math.sin(t * 1.3));
        eyes(ctx, () => up);
        if (ctx.hunt && up > 0.8 && ctx.ringTimer(3)) {
          for (let k = 0; k < 18; k++) {
            const d = new V3(Math.cos((k / 18) * Math.PI * 2), -0.08, Math.sin((k / 18) * Math.PI * 2));
            ctx.shots.fire('bolt', skull.position.clone().add(new V3(0, 2, 0)), d.multiplyScalar(9), {life: 3});
          }
        }
        // tentacles: grip the rim (curl over it), or slam in phase two
        let tiltX = 0;
        let tiltZ = 0;
        for (const A of arms) {
          const s = slamOf(A.k, t, f);
          const wave = (i) => 0.05 * Math.sin(t * 1.3 + A.k + i * 0.4);
          // grip: rise 10 m, then curl inward over the rim; slam: the pivot swings the whole arm in
          A.pivot.rotation.x = s;
          A.ch.pose((i) => (s > 0.2 ? 0.02 + wave(i) * 0.4 : i < 4 ? wave(i) : i < 9 ? 0.2 + wave(i) : 0.32 + wave(i)));
          const stuck = s > 1.5;
          A.tip(ctx, () => (stuck ? 1 : 0));
          if (s > 1.2) {
            tiltX += Math.cos(A.a) * 0.06;
            tiltZ -= Math.sin(A.a) * 0.06;
          }
          if (ctx.hunt && s > 1.4 && s < 1.6) {
            // the slam line: a strip from the rim toward the centre along the arm's bearing
            const dirx = -Math.sin(A.a);
            const dirz = -Math.cos(A.a);
            const px = ctx.player.pos.x - Math.sin(A.a) * 20;
            const pz = ctx.player.pos.z - Math.cos(A.a) * 20;
            const along = px * dirx + pz * dirz;
            const across = Math.abs(px * dirz - pz * dirx);
            if (along > 0 && along < 34 && across < 2.5 && ctx.player.pos.y < 3) ctx.hurt('slam');
          }
        }
        tilt.rotation.x += (tiltX - tilt.rotation.x) * Math.min(1, ctx.dt * 2);
        tilt.rotation.z += (tiltZ - tilt.rotation.z) * Math.min(1, ctx.dt * 2);
        sea.position.y = -8 + 0.3 * Math.sin(t * 0.4);
        void pw;
        void disc;
      },
    };
  },

  // ------------------------------------------------------------ Layer 3: Belial
  ruins(g) {
    // Belial sits on his throne north of the courtyard, 34 m tall, behind a shield fed by four great pillars.
    // Phase one: break the pillars; each one falls inward and becomes a ramp up to the ring gallery. The shield
    // shrinks with each. Phase two: he stands and walks the gallery ring; the gallery crumbles behind him, so the
    // fight drops back to the courtyard. His face is the weak point, open in phase two.
    const K = kit(g);
    K.add(new THREE.BoxGeometry(46, 1, 46), M.stone, [0, -0.5, 0]);
    // gallery: 20 segments so they can fall
    const gallery = Array.from({length: 20}, (_, k) => {
      const a = (k / 20) * Math.PI * 2;
      const n = K.node([0, 0, 0]);
      n.rotation.y = a;
      const slab = K.add(new THREE.BoxGeometry(3.2, 0.8, 5.8), M.stone2, [0, 9.8, 17.5], [0, 0, 0], n);
      const post = K.add(new THREE.BoxGeometry(0.9, 9.4, 0.9), M.wall, [0, 4.7, 17.5], [0, 0, 0], n);
      return {n, slab, post, a};
    });
    // four great pillars on the diagonals, 3 m wide and 15 m tall, chained to the shield
    const pillars = [0, 1, 2, 3].map((k) => {
      const a = Math.PI / 4 + (k / 4) * Math.PI * 2;
      const base = K.node([Math.sin(a) * 11, 0, Math.cos(a) * 11]);
      base.rotation.y = a + Math.PI; // falls toward its own outside, so the top lands on the gallery
      const body = K.add(new THREE.BoxGeometry(3, 15, 3), M.wall, [0, 7.5, 0], [0, 0, 0], base);
      const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1, 4), new THREE.MeshBasicMaterial({color: '#e8d27a'}));
      (g.parent || g).add(chain); // placed in world units, so it lives outside the scaled arena group
      return {a, base, body, chain, k};
    });
    // the colossus
    const belial = K.node([0, 0, -31]);
    const hips = K.node([0, 9, 0], belial);
    const torso = K.node([0, 0, 0], hips);
    K.add(new THREE.BoxGeometry(12, 14, 6), M.colossus, [0, 8, 0], [0, 0, 0], torso);
    const head = K.node([0, 17.5, 0.5], torso);
    K.add(new THREE.BoxGeometry(5, 5, 5), M.colossus, [0, 0, 0], [0, 0, 0], head);
    for (let c = 0; c < 5; c++) K.add(new THREE.ConeGeometry(0.6, 3, 5), M.gold, [-2.4 + c * 1.2, 3.6, 0], [0, 0, 0], head);
    const face = K.weak(head, [[0, 0.2, 2.6]], 0.9);
    const legs = [-1, 1].map((sx) => {
      const n = K.node([sx * 3.4, 0, 0], hips);
      K.add(new THREE.BoxGeometry(3.4, 9, 3.4), M.colossus, [0, -4.5, 0], [0, 0, 0], n);
      return n;
    });
    const arms = [-1, 1].map((sx) => {
      const n = K.node([sx * 7.6, 13, 0], torso);
      K.add(new THREE.BoxGeometry(2.8, 12, 2.8), M.colossus, [0, -6, 0], [0, 0, 0], n);
      return n;
    });
    const throne = K.add(new THREE.BoxGeometry(18, 10, 10), M.stone2, [0, 5, -34]);
    const shield = new THREE.Mesh(new THREE.SphereGeometry(16, 28, 18), new THREE.MeshBasicMaterial({color: '#e8d27a', transparent: true, opacity: 0.1, depthWrite: false}));
    g.add(shield);
    return {
      phases: ['Shielded: break the four pillars into ramps', 'Humbled: he walks the gallery and it crumbles'],
      subsystems: [
        {id: 'belial', name: 'Belial', note: '34 m colossus', objs: [belial], state: () => (hips.position.y > 8.5 ? 'WALKING' : 'SEATED')},
        {id: 'face', name: 'Face · weak point', note: 'open in phase two', objs: [head], state: () => (hips.position.y > 8.5 ? 'OPEN' : 'SHIELDED')},
        {id: 'shield', name: 'Shield', note: 'fed by the pillars', objs: [shield], state: () => `${Math.round(shield.scale.x * 100)} %`},
        {id: 'pillars', name: 'Great pillars ×4', note: 'fall into ramps', objs: pillars.map((P) => P.base), state: () => `${pillars.filter((P) => P.base.rotation.x > -0.5).length} STANDING`},
        {id: 'gallery', name: 'Gallery ring', note: '20 segments at 10 m', objs: gallery.map((s) => s.n), state: () => `${gallery.filter((s) => s.n.position.y > -1).length} / 20`},
        {id: 'throne', name: 'Throne', note: 'north dais', objs: [throne], state: () => '-'},
      ],
      spawn: [0, 0.5, 10],
      killY: -25,
      cam: {target: [0, 8, -6], az: 24, el: 24, dist: 92},
      spots: () => [[0, 0, -6], [10, 0, 6], [-8, 0, 7], [6, 0, -3], [-6, 0, -8], [13, 0, -12], [-13, 0, -13], [3, 0, 12]],
      update(ctx, f) {
        const t = ctx.t;
        // pillars fall at f = 0.2, 0.45, 0.7, 0.95
        let standing = 0;
        for (const P of pillars) {
          const fall = seg(f, 0.2 + P.k * 0.25 - 0.08, 0.2 + P.k * 0.25);
          P.base.rotation.x = -fall * 1.08; // tips over toward the gallery
          if (fall < 0.5) standing++;
          // chain from the pillar top to the shield
          const top = P.body.localToWorld(new V3(0, 7.5, 0));
          const to = belial.localToWorld(new V3(0, 16, 0));
          P.chain.visible = fall < 0.05;
          P.chain.position.copy(top).lerp(to, 0.5);
          P.chain.scale.y = top.distanceTo(to);
          P.chain.lookAt(to);
          P.chain.rotateX(Math.PI / 2);
        }
        // the shield shrinks with each pillar, gone in phase two
        shield.position.copy(belial.position).setY(16);
        shield.scale.setScalar((0.4 + 0.6 * (standing / 4)) * (1 - seg(f, 0.95, 1.05)) + 0.001);
        shield.material.opacity = 0.08 + 0.04 * Math.sin(t * 2);
        // phase one: seated (hips low, knees forward); phase two: stands and walks the gallery ring
        const p2 = seg(f, 1, 1.1);
        const walk = Math.max(0, f - 1.1) / 0.9; // 0..1 round the ring
        const ang = Math.PI + walk * Math.PI * 1.6; // from the north, clockwise most of the way round
        const R = p2 > 0 ? 17.5 + (1 - p2) * 13.5 : 31;
        belial.position.set(Math.sin(ang) * R, p2 * 1, Math.cos(ang) * R);
        belial.rotation.y = ang + Math.PI / 2;
        hips.position.y = 9 - (1 - p2) * 3;
        torso.rotation.x = (1 - p2) * 0.15;
        legs.forEach((l, i) => (l.rotation.x = p2 > 0 && walk > 0 ? 0.35 * Math.sin(t * 1.4 + i * Math.PI) : -(1 - p2) * 1.2));
        arms.forEach((a, i) => (a.rotation.x = p2 * 0.3 * Math.sin(t * 1.4 + i * Math.PI + Math.PI)));
        head.rotation.y = ctx.hunt ? Math.atan2(ctx.player.pos.x - belial.position.x, ctx.player.pos.z - belial.position.z) - belial.rotation.y : 0;
        throne.visible = true;
        face(ctx, () => p2);
        // the gallery crumbles behind him: segments he has passed drop away
        for (const s of gallery) {
          const passed = p2 > 0 && ((s.a - ang + Math.PI * 4) % (Math.PI * 2)) > Math.PI * 1.75;
          const gone = passed && walk > 0.05 ? 1 : 0;
          s.n.position.y += ((gone ? -14 : 0) - s.n.position.y) * Math.min(1, ctx.dt * 1.5);
        }
        if (ctx.hunt && p2 > 0 && ctx.player.pos.distanceTo(belial.position) < 5) ctx.hurt('stomp');
      },
    };
  },

  // ------------------------------------------------------------ Layer 5: Mammon
  greed(g) {
    // Mammon is a colossal bust beyond the north rim, 46 m wide; the vault is the inside of his hoard. His arms reach
    // over the terraces. Phase one: his hands sweep the terraces and steal the orbs into the hoard that hangs from his
    // chest; break the hoard to take them back. Phase two: he plates the arena in gold. The floor and terraces become
    // a hazard; the lifts lock at staggered heights and you air-dash between them. The weak point moves to his heart.
    const K = kit(g);
    const floorMat = mat('#5d5a63');
    const terraceMat = mat('#7d6324');
    const plate = new THREE.Color('#e0b43a');
    const base = {floor: new THREE.Color('#5d5a63'), terrace: new THREE.Color('#7d6324')};
    const floor = K.add(new THREE.CylinderGeometry(10, 10, 1, 8), floorMat, [0, -0.5, 0]);
    const t1 = K.ring(12, 17, 3, terraceMat, 0, g, 8);
    const t2 = K.ring(19, 24, 6, terraceMat, 0, g, 8);
    const lifts = Array.from({length: 6}, (_, k) => {
      const a = (k / 6) * Math.PI * 2 + 0.26;
      return {m: K.tag(K.add(new THREE.BoxGeometry(2.8, 0.5, 2.8), M.lift, [Math.cos(a) * 18, 3, Math.sin(a) * 18]), 'lift'), k, lock: 1.5 + (k % 3) * 2.2};
    });
    const orbs = Array.from({length: 14}, (_, k) => {
      const a = k * 2.399;
      const r = 4 + (k % 4) * 4.5;
      const o = K.add(new THREE.IcosahedronGeometry(0.35, 0), mat('#8fd4ff', {emissive: new THREE.Color('#8fd4ff'), emissiveIntensity: 0.7}), [0, 0, 0]);
      return {o, home: new V3(Math.cos(a) * r, r < 11 ? 0.8 : r < 18 ? 3.8 : 6.8, Math.sin(a) * r), k};
    });
    // the colossus
    const mam = K.node([0, 0, -40]);
    K.add(new THREE.BoxGeometry(46, 30, 18), M.gold, [0, 18, 0], [0, 0, 0], mam);
    const head = K.node([0, 38, 2], mam);
    K.add(new THREE.BoxGeometry(14, 12, 12), M.gold, [0, 0, 0], [0, 0, 0], head);
    for (const sx of [-1, 1]) for (let c = 0; c < 6; c++) K.add(new THREE.CylinderGeometry(3.4 - c * 0.35, 3.4 - c * 0.35, 1.2, 10), M.goldDark, [sx * 9, 5 + c * 1.3, 0], [0, 0, 0], head);
    const eyes = K.add(new THREE.BoxGeometry(9, 1.4, 0.6), mat('#ff6a3a', {emissive: new THREE.Color('#ff3a1c'), emissiveIntensity: 0.6}), [0, 1, 6.1], [0, 0, 0], head);
    const hoard = K.node([0, 6, 12], mam);
    const sack = K.add(new THREE.IcosahedronGeometry(5.5, 1), mat('#d6b44a', {metalness: 0.5}), [0, 0, 0], [0, 0, 0], hoard);
    const hoardWeak = K.weak(hoard, [[0, 0, 5.6]], 1.0);
    const heartWeak = K.weak(mam, [[0, 20, 9.2]], 1.2);
    const arms = [-1, 1].map((sx) => {
      const sh = K.node([sx * 25, 28, 4], mam);
      const ch = K.chain(sh, 7, 5, 4, 2.4, M.gold);
      const hand = K.add(new THREE.BoxGeometry(6, 2.5, 6), M.goldDark, [0, 5.5, 0], [0, 0, 0], ch.tip);
      return {sh, ch, hand, sx};
    });
    return {
      phases: ['The thief: his hands steal the orbs into the hoard', 'Gold: the floor plates over, lifts lock, dash between them'],
      subsystems: [
        {id: 'mammon', name: 'Mammon', note: '46 m bust beyond the rim', objs: [mam], state: () => (floor.userData.tag === 'hazard' ? 'GILDING' : 'STEALING')},
        {id: 'arms', name: 'Arms ×2', note: 'sweep the terraces', objs: arms.map((A) => A.sh), state: () => 'SWEEPING'},
        {id: 'hoard', name: 'Hoard · weak point', note: 'break it to get the orbs back', objs: [hoard], state: () => `${Math.round(sack.scale.x * 100)} % FULL`},
        {id: 'orbs', name: 'Mana orbs ×14', note: 'stolen into the hoard', objs: orbs.map((O) => O.o), state: () => `${orbs.filter((O) => O.o.visible).length} LEFT`},
        {id: 'lifts', name: 'Vault lifts ×6', note: 'lock in phase two', objs: lifts.map((L) => L.m), state: () => (floor.userData.tag === 'hazard' ? 'LOCKED' : 'CYCLING')},
        {id: 'floor', name: 'Floor and terraces', note: 'plate in gold', objs: [floor, t1, t2], state: () => (floor.userData.tag === 'hazard' ? 'GOLD · HURTS' : 'STONE')},
      ],
      spawn: [0, 0.5, 6],
      killY: -25,
      cam: {target: [0, 10, -10], az: 28, el: 26, dist: 98},
      spots: () => [[4, 0, 3], [-14.5, 3, 3], [0, 0, -6], [21, 6, 2], [-6, 0, 4], [10, 3, -9], [-21, 6, -5], [6, 0, 8]],
      update(ctx, f) {
        const t = ctx.t;
        const p2 = seg(f, 1, 1.25);
        // floor and terraces plate over in phase two: colour and the hazard tag
        floorMat.color.copy(base.floor).lerp(plate, p2);
        terraceMat.color.copy(base.terrace).lerp(plate, p2);
        floorMat.emissive.copy(plate).multiplyScalar(p2 * 0.25);
        terraceMat.emissive.copy(plate).multiplyScalar(p2 * 0.25);
        const hot = p2 > 0.95 ? 'hazard' : undefined;
        for (const m of [floor, t1, t2]) m.userData.tag = hot;
        // lifts cycle in phase one, lock at staggered heights in phase two
        for (const L of lifts) {
          const cyc = 3 + 3 * Math.sin(t * 0.6 + L.k * 1.05);
          L.m.position.y = cyc + (L.lock + 6 - cyc) * p2;
        }
        // arms: sweep the terraces in phase one (left and right in turn), slam the floor in phase two
        arms.forEach(({sh, ch, sx}, i) => {
          const u = (t * 0.25 + i * 0.5) % 1;
          const sweep = Math.sin(u * Math.PI * 2);
          sh.rotation.set(1.35 - p2 * 0.2 + 0.15 * Math.max(0, Math.sin(u * Math.PI * 2 + 1)), sx * (-0.35 + 0.3 * sweep), 0);
          ch.pose((k) => (k === 0 ? 0 : 0.12 + 0.05 * Math.sin(t + k)));
        });
        // orbs drift from their spots into the hoard during phase one; hitting the hoard (weak) gives them back
        const steal = seg(f, 0.1, 0.9) * (1 - p2);
        const hp = hoard.getWorldPosition(new V3());
        for (const O of orbs) {
          const k = Math.min(1, Math.max(0, steal * 1.6 - (O.k / orbs.length) * 0.6));
          O.o.position.copy(O.home).lerp(hp, k);
          O.o.position.y += Math.sin(t * 2 + O.k) * 0.2;
          O.o.visible = k < 0.98;
        }
        sack.scale.setScalar(0.6 + 0.5 * steal);
        hoardWeak(ctx, () => (p2 < 0.5 ? 1 : 0));
        heartWeak(ctx, () => p2);
        eyes.material.emissiveIntensity = 0.5 + p2 * 1.5;
        head.rotation.y = ctx.hunt ? Math.atan2(ctx.player.pos.x - mam.position.x, ctx.player.pos.z - mam.position.z) * 0.6 : Math.sin(t * 0.2) * 0.2;
        if (ctx.hunt && ctx.ringTimer(4)) {
          // coin rain toward the player from his head
          const from = head.getWorldPosition(new V3());
          for (let k = -2; k <= 2; k++) {
            const d = ctx.player.pos.clone().sub(from).normalize().applyAxisAngle(new V3(0, 1, 0), k * 0.06);
            ctx.shots.fire('coin', from, d.multiplyScalar(26), {gravity: 6, life: 4});
          }
        }
      },
    };
  },
};
