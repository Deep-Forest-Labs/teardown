// Swarm skull v1: one shared flock behaviour, three tiers (the Unity prototype has swarmer tiers 1, 2 and 3).
// The base is a boids flock that seeks a target with separation and cohesion, caps its speed, and bites with a
// shared pause (only the two nearest bites land per tick in the game; here one bite per pause). Tiers change the
// numbers and add one mechanic each:
//   T1 Skull   28 fodder skulls, fast, no weak point (impostors in the game: keep it light)
//   T2 Shroud   8 bigger skulls that rise above the player (the tell) and swoop in pairs, then climb out
//   T3 Matron   one heavy cocoon-bodied flier that circles and drops grubs which land and crawl at you;
//               its cocoon belly is the weak point
import * as THREE from 'three';
import {createWeakpoints} from '../../dfl-kit/weakpoint.js';

const V3 = THREE.Vector3;
const mat = (c, extra = {}) => new THREE.MeshStandardMaterial({color: c, roughness: 0.85, flatShading: true, ...extra});

export const TIERS = {
  1: {count: 28, size: 0.28, speed: 9, wanderSpeed: 4, accel: 2.2, sep: 0.8, bite: 0.8, color: '#d8cfc0', jaw: 0.08},
  2: {count: 8, size: 0.6, speed: 7, wanderSpeed: 3, accel: 1.6, sep: 1.8, bite: 1.2, color: '#c9bfae', jaw: 0.16, swoop: {rise: 5, period: 4.5, dive: 16}},
  3: {count: 1, size: 1.4, speed: 3, wanderSpeed: 2, accel: 1, sep: 0, bite: 1.6, color: '#b9ab98', jaw: 0.3, grubs: {every: 5, count: 3, speed: 2.4, life: 9}},
};

/** One skull body: cranium, brow, sockets and a hinged jaw. Returns {root, jaw}. */
function skullBody(size, color) {
  const root = new THREE.Group();
  const bone = mat(color);
  const dark = mat('#1a1214');
  const s = size;
  const c = new THREE.Mesh(new THREE.IcosahedronGeometry(s, 1), bone);
  c.scale.set(1, 0.85, 1.1);
  const brow = new THREE.Mesh(new THREE.BoxGeometry(s * 1.5, s * 0.25, s * 0.5), bone);
  brow.position.set(0, s * 0.35, s * 0.7);
  for (const sx of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.BoxGeometry(s * 0.42, s * 0.32, s * 0.2), dark);
    eye.position.set(sx * s * 0.38, s * 0.12, s * 0.95);
    root.add(eye);
  }
  const jaw = new THREE.Group();
  jaw.position.set(0, -s * 0.45, s * 0.2);
  const jm = new THREE.Mesh(new THREE.BoxGeometry(s * 1.1, s * 0.3, s * 1.0), bone);
  jm.position.set(0, -s * 0.12, s * 0.35);
  jaw.add(jm);
  for (const o of [c, brow, jm]) o.castShadow = true;
  root.add(c, brow, jaw);
  return {root, jaw};
}

export function buildSwarmer(g, K) {
  const tier = K.tier || 1;
  const T = TIERS[tier];
  g.position.set(0, 0, 0); // a flock lives in world space
  const parent = g;
  const boids = Array.from({length: T.count}, (_, i) => {
    const {root, jaw} = skullBody(T.size, T.color);
    parent.add(root);
    const p = K.home.clone().add(new V3(Math.cos(i * 2.4) * 2, 2.5 + (i % 3) * 0.5, Math.sin(i * 2.4) * 2));
    return {root, jaw, p, v: new V3(), i, swoop: 0};
  });
  // T3: the cocoon belly (weak point) and its grubs
  let belly = null;
  const grubs = [];
  if (tier === 3) {
    const b = boids[0];
    const cocoon = new THREE.Mesh(new THREE.CapsuleGeometry(T.size * 0.7, T.size * 1.2, 3, 8), mat('#7a6a5a'));
    cocoon.position.set(0, -T.size * 1.1, -T.size * 0.4);
    cocoon.rotation.x = 0.5;
    cocoon.castShadow = true;
    b.root.add(cocoon);
    const before = new Set(b.root.children);
    const w = createWeakpoints(b.root, 1, T.size * 0.35);
    const meshes = b.root.children.filter((c) => !before.has(c));
    const m4 = new THREE.Matrix4().makeTranslation(0, -T.size * 1.4, 0.3);
    belly = (ctx) => {
      for (const m of meshes) m.visible = ctx.showWeak;
      if (!ctx.showWeak) return;
      w.face(ctx.camera);
      w.set(0, m4, {open: 1, pulse: 0.5 + 0.5 * Math.sin(ctx.t * 5)});
      w.commit();
    };
    for (let k = 0; k < 9; k++) {
      const gm = new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 0.4, 2, 6), mat('#e4d6c2'));
      gm.rotation.x = Math.PI / 2;
      gm.castShadow = true;
      gm.visible = false;
      parent.add(gm);
      grubs.push({m: gm, p: new V3(), v: new V3(), life: 0, landed: false});
    }
  }
  const acc = new V3();
  const tgt = new V3();
  let biteT = 0;
  let dropT = 0;
  return (ctx) => {
    const hunt = ctx.hunt && ctx.player.on;
    const pp = ctx.player.pos;
    biteT -= ctx.dt;
    const n = boids.length;
    const centre = new V3();
    for (const b of boids) centre.add(b.p);
    centre.multiplyScalar(1 / n);
    for (const b of boids) {
      const i = b.i;
      // where this skull wants to be
      if (hunt) {
        if (T.swoop) {
          // rise above the player for most of the period (the tell), then a pair dives
          const ph = ((ctx.t + Math.floor(i / 2) * 1.1) % T.swoop.period) / T.swoop.period;
          b.swoop = ph > 0.72 ? 1 : 0;
          tgt.copy(pp).add(b.swoop ? new V3(0, 1, 0) : new V3(Math.sin(ctx.t + i) * 4, T.swoop.rise + (i % 2), Math.cos(ctx.t + i) * 4));
        } else if (tier === 3) tgt.copy(pp).add(new V3(Math.sin(ctx.t * 0.4) * 9, 7, Math.cos(ctx.t * 0.4) * 9));
        else tgt.copy(pp).add(new V3(Math.sin(ctx.t * 2 + i) * 1.5, 1.2 + Math.sin(i) * 0.5, Math.cos(ctx.t * 2 + i) * 1.5));
      } else {
        const r = 2 + (i % 4) * 0.4 + T.size * 2;
        tgt.set(K.home.x + Math.cos(ctx.t * 0.9 + i * 0.7) * r, K.home.y + 2.6 + T.size * 2 + Math.sin(ctx.t * 1.2 + i) * 0.9, K.home.z + Math.sin(ctx.t * 0.9 + i * 0.7) * r);
      }
      acc.subVectors(tgt, b.p).multiplyScalar(T.accel);
      // shared flock rules: separation from two neighbours, a little cohesion
      if (T.sep > 0) {
        for (const j of [(i + 1) % n, (i + 7) % n]) {
          if (j === i) continue;
          const d = b.p.distanceTo(boids[j].p);
          if (d < T.sep) acc.addScaledVector(b.p.clone().sub(boids[j].p).normalize(), (T.sep - d) * 30);
        }
        acc.addScaledVector(centre.clone().sub(b.p), 0.2);
      }
      const cap = hunt ? (b.swoop ? T.swoop.dive : T.speed) : T.wanderSpeed;
      b.v.addScaledVector(acc, ctx.dt).clampLength(0, cap * ctx.speedMul);
      b.p.addScaledVector(b.v, ctx.dt);
      const gy = ctx.ground(b.p.x, b.p.z, b.p.y + 1);
      if (gy != null) b.p.y = Math.max(b.p.y, gy + T.size);
      b.root.position.copy(b.p);
      if (b.v.lengthSq() > 0.01) b.root.lookAt(b.p.clone().add(b.v));
      b.jaw.rotation.x = T.jaw + T.jaw * Math.sin(ctx.t * 12 + i);
      if (hunt && biteT <= 0 && b.p.distanceTo(pp.clone().setY(pp.y + 0.9)) < T.size + 0.7) {
        ctx.hurt('bite');
        biteT = T.bite;
      }
    }
    // T3: drop grubs that fall, land and crawl at the player
    if (tier === 3) {
      dropT += ctx.dt;
      if (dropT >= T.grubs.every) {
        dropT = 0;
        let made = 0;
        for (const gr of grubs) {
          if (gr.life > 0 || made >= T.grubs.count) continue;
          gr.p.copy(boids[0].p).add(new V3((made - 1) * 0.6, -T.size * 1.6, 0));
          gr.v.set((made - 1) * 1.2, 0, 0);
          gr.life = T.grubs.life;
          gr.landed = false;
          gr.m.visible = true;
          made++;
        }
      }
      for (const gr of grubs) {
        if (gr.life <= 0) continue;
        gr.life -= ctx.dt;
        const gy = ctx.ground(gr.p.x, gr.p.z, gr.p.y + 1);
        if (!gr.landed) {
          gr.v.y -= 9.8 * ctx.dt;
          gr.p.addScaledVector(gr.v, ctx.dt);
          if (gy == null || gr.p.y < -30) gr.life = 0; // fell into the abyss: lost
          else if (gr.p.y <= gy + 0.15) {
            gr.landed = true;
            gr.p.y = gy + 0.15;
          }
        } else {
          const to = (hunt ? pp.clone() : K.home.clone()).sub(gr.p).setY(0);
          if (to.length() > 0.3) gr.p.addScaledVector(to.normalize(), T.grubs.speed * ctx.dt);
          gr.p.y = (gy ?? gr.p.y) + 0.15;
          gr.m.rotation.z = Math.atan2(to.x, to.z);
          if (hunt && gr.p.distanceTo(pp) < 0.7) {
            ctx.hurt('grub');
            gr.life = 0;
          }
        }
        gr.m.position.copy(gr.p);
        gr.m.visible = gr.life > 0;
      }
      belly(ctx);
    }
  };
}
