// Prince fights, V1 for layers 2, 4, 6, 7, 8 and 9 (see fights.js for the contract). Each is the arena and its
// prince as one rig posed by the fight value f (0..1 phase one, 1..2 phase two), with the layout changing as the
// fight goes on. V1: the shapes and the layout beats are in; tuning comes from playing them.
import * as THREE from 'three';
import {kit, M, mat, seg} from './fights.js';

const V3 = THREE.Vector3;
const around = (n, r, off = 0) => Array.from({length: n}, (_, k) => {
  const a = off + (k / n) * Math.PI * 2;
  return [Math.cos(a) * r, Math.sin(a) * r];
});
/** A ring sector slab (for tiers that can turn or fall). */
function sector(K, r0, r1, h, a0, len, m, parent) {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, r1, a0, a0 + len, false);
  shape.absarc(0, 0, r0, a0 + len, a0, true);
  const geo = new THREE.ExtrudeGeometry(shape, {depth: h, bevelEnabled: false, curveSegments: 10});
  geo.rotateX(-Math.PI / 2);
  return K.add(geo, m, [0, 0, 0], [0, 0, 0], parent);
}

export const FIGHTS2 = {
  // ------------------------------------------------------------ Layer 2: Belphegor (Sloth)
  void(g) {
    // Three rings of tiers over the abyss. Belphegor, a 40 m sleeper-moth, hangs from a stalk above the top tier.
    // Phase one: it hangs high and sweeps the LOWEST tier with a sleep beam (a turning wedge you must climb out of).
    // Phase two: it sinks to the middle, so the top tier is above its back and its weak points show from there; it
    // sweeps alternate tiers, and the middle ring's segments turn, so the Dash gaps open and close.
    const K = kit(g);
    K.add(new THREE.CylinderGeometry(8, 8, 1.2, 40), M.stone, [0, -0.6, 0]);
    const mid = K.node([0, 4 - 1.2, 0]);
    for (let k = 0; k < 8; k++) sector(K, 10, 16, 1.2, (k / 8) * Math.PI * 2 + 0.06, Math.PI / 4 - 0.12, M.stone2, mid);
    const top = K.node([0, 8 - 1.2, 0]);
    for (let k = 0; k < 12; k++) sector(K, 18, 24, 1.2, (k / 12) * Math.PI * 2 + 0.05, Math.PI / 6 - 0.1, M.stone, top);
    for (const [x, z] of around(4, 6.5, 0.4)) K.tag(K.add(new THREE.CylinderGeometry(0.9, 0.9, 0.25, 12), M.pad, [x, 0.1, z]), 'pad');
    for (const [x, z] of around(6, 15, 0.2)) K.tag(K.add(new THREE.CylinderGeometry(0.9, 0.9, 0.25, 12), M.pad, [x, 4.1, z]), 'pad');
    // the beam: a wedge on the swept tier
    const beamMat = new THREE.MeshBasicMaterial({color: '#9fb8ff', transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false});
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(25, 25, 0.3, 32, 1, true, 0, 0.5), beamMat);
    g.add(beam);
    // Belphegor: a cocoon body, a stalk to the dark above, four wings
    const bel = K.node([0, 34, 0]);
    K.add(new THREE.CapsuleGeometry(5, 18, 4, 12), M.colossus, [0, 0, 0], [0, 0, 0], bel);
    K.add(new THREE.CylinderGeometry(0.8, 0.8, 40, 6), M.colossusDark, [0, 30, 0], [0, 0, 0], bel);
    const face = K.node([0, -12, 2], bel);
    K.add(new THREE.IcosahedronGeometry(3.4, 1), M.bone, [0, 0, 0], [0, 0, 0], face);
    const wings = [0, 1, 2, 3].map((k) => {
      const w = K.node([0, 4, 0], bel);
      w.rotation.y = (k / 4) * Math.PI * 2 + Math.PI / 4;
      K.add(new THREE.BoxGeometry(22, 0.4, 9), M.colossusDark, [11, 0, 0], [0, 0, 0], w);
      return w;
    });
    const back = K.weak(bel, [[0, 10, 4.2], [3, 9, -3], [-3, 9, -3]], 1.0);
    return {
      phases: ['High: it sweeps the lowest tier', 'Low: it sweeps alternate tiers, its back is open from the top tier'],
      spawn: [0, 0.2, 5],
      killY: -12,
      cam: {target: [0, 10, 0], az: 30, el: 26, dist: 92},
      spots: () => [[13, 4, 0], [-21, 8, 3], [0, 8, -21], [5, 0, 4], [-12, 4, -6], [20, 8, -9], [-4, 0, -5], [9, 4, 10]],
      update(ctx, f) {
        const t = ctx.t;
        const p2 = seg(f, 1, 1.2);
        bel.position.y = 34 - p2 * 22 + Math.sin(t * 0.4);
        bel.rotation.y = t * 0.07;
        wings.forEach((w, k) => (w.rotation.z = -0.25 + 0.2 * Math.sin(t * 0.6 + k)));
        face.rotation.x = 0.3;
        // middle ring segments turn in phase two
        mid.rotation.y = p2 * t * 0.25;
        // which tier the beam sweeps: phase one the floor (0 m), phase two alternating 4 m and 8 m
        const tierY = p2 < 0.5 ? 0.15 : Math.floor(t / 6) % 2 ? 4.15 : 8.15;
        const tierR = tierY < 1 ? [0, 8] : tierY < 5 ? [10, 16] : [18, 24];
        beam.position.y = tierY;
        beam.rotation.y = t * 0.9;
        beam.scale.set(tierR[1] / 25, 1, tierR[1] / 25);
        beamMat.opacity = 0.25 + 0.1 * Math.sin(t * 6);
        if (ctx.hunt) {
          const p = ctx.player.pos;
          const r = Math.hypot(p.x, p.z);
          let a = Math.atan2(p.x, p.z) - beam.rotation.y;
          a = ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
          if (Math.abs(p.y - tierY) < 1.2 && r > tierR[0] && r < tierR[1] && a < 0.5) ctx.hurt('sleep');
        }
        back(ctx, () => p2);
      },
    };
  },

  // ------------------------------------------------------------ Layer 4: Beelzebub (Gluttony)
  gluttony(g) {
    // A flesh bowl over a bile floor. Beelzebub is the swarm: a 30 m cloud of flies round a core.
    // Phase one: kill the flock (here: the cloud thins as f runs) until the core is exposed and drops.
    // Phase two: he eats his own horde to grow; the cloud reforms bigger, the mounds rise into towers and the bile
    // rises with them, so the fight climbs the mounds.
    const K = kit(g);
    const pts = [];
    for (let k = 0; k <= 12; k++) pts.push(new THREE.Vector2((k / 12) * 26, Math.pow(k / 12, 3) * 10));
    K.add(new THREE.LatheGeometry(pts, 48), mat('#7a2e2a', {side: THREE.DoubleSide}), [0, -0.2, 0]);
    const bile = K.tag(K.add(new THREE.CylinderGeometry(18, 18, 0.2, 48), mat('#8a5a1a', {emissive: new THREE.Color('#8a5a1a'), emissiveIntensity: 0.2}), [0, 0.3, 0]), 'slow');
    const mounds = [[6, 3, 3.2], [-7, 5, 2.6], [0, -9, 3.6], [10, -6, 2.4], [-10, -5, 3], [-3, 12, 2.8], [12, 8, 2.2]].map(([x, z, s]) => K.add(new THREE.CylinderGeometry(s * 0.7, s, 1, 9), mat('#8c3a33'), [x, 0, z]));
    for (const [x, z] of around(5, 21, 0.3)) K.tag(K.add(new THREE.CylinderGeometry(0.9, 0.9, 0.25, 12), M.pad, [x, 4.3, z]), 'pad');
    const n = 900;
    const flies = new THREE.InstancedMesh(new THREE.BoxGeometry(0.4, 0.22, 0.55), M.colossusDark, n);
    flies.frustumCulled = false;
    flies.castShadow = true;
    g.add(flies);
    const core = K.node([0, 16, 0]);
    K.add(new THREE.IcosahedronGeometry(2.4, 1), M.fleshDark, [0, 0, 0], [0, 0, 0], core);
    const coreWeak = K.weak(core, [[0, 0, 0]], 2.6);
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const v = new V3();
    const s1 = new V3(1, 1, 1);
    return {
      phases: ['He is the swarm: thin the flock to expose the core', 'He eats the horde: towers rise, the bile rises'],
      spawn: [0, 1, 8],
      killY: -25,
      cam: {target: [0, 8, 0], az: 34, el: 28, dist: 78},
      spots: () => [[6, 3.2, 3], [-12, 1, 2], [0, 3.6, -9], [13, 1, 2], [-7, 2.6, 5], [8, 1, -12], [-13, 1, -10], [3, 1, 14]],
      update(ctx, f) {
        const t = ctx.t;
        const p2 = seg(f, 1, 1.3);
        const thin = seg(f, 0.05, 0.85) * (1 - p2); // phase one kills the flock
        const alive = Math.floor(n * (1 - thin * 0.85) * (1 + p2 * 0.0));
        const R = 9 + p2 * 6;
        core.position.y = 16 - thin * 6 + p2 * 2 + Math.sin(t * 0.7);
        core.scale.setScalar(1 + p2 * 0.8);
        for (let i = 0; i < n; i++) {
          if (i >= alive) {
            m4.makeScale(0, 0, 0);
            flies.setMatrixAt(i, m4);
            continue;
          }
          const a = t * (0.35 + (i % 9) * 0.04) + i * 2.399;
          const y = ((i * 0.618) % 1) * 2 - 1;
          const r = (R + 2.5 * Math.sin(t * 0.5 + i)) * Math.sqrt(1 - y * y);
          v.set(Math.cos(a) * r, core.position.y + y * R * 0.8, Math.sin(a) * r);
          if (ctx.hunt && i % 6 === 0) v.lerp(ctx.player.pos.clone().setY(ctx.player.pos.y + 1), 0.15 + 0.15 * Math.sin(t + i));
          e.set(0, -a, 0);
          m4.compose(v, q.setFromEuler(e), s1);
          flies.setMatrixAt(i, m4);
        }
        flies.instanceMatrix.needsUpdate = true;
        // towers and bile in phase two
        mounds.forEach((m, k) => {
          const h = 2 + k * 0.4 + p2 * (5 + (k % 3) * 2.5);
          m.scale.y = h;
          m.position.y = h / 2;
        });
        bile.position.y = 0.3 + p2 * 2.4;
        coreWeak(ctx, () => Math.max(thin, p2 * 0.6));
        if (ctx.hunt && ctx.player.pos.y < bile.position.y + 0.1 && Math.hypot(ctx.player.pos.x, ctx.player.pos.z) < 18 && p2 > 0.5) ctx.hurt('bile');
      },
    };
  },

  // ------------------------------------------------------------ Layer 6: Lilith (Lust)
  lust(g) {
    // A storm terrace ringed by updraft columns, with five petals high above. Lilith, 32 m and winged, stands on a
    // spire at the centre. Phase one: she charms and pulls from the high petals (a pull toward her every few
    // seconds); the petals orbit. Phase two: her mirror swings round her and reflects; shoot only while it is down.
    // The petals tilt and drop toward the floor, and the wind turns harder, so the high ground becomes steps.
    const K = kit(g);
    K.add(new THREE.CylinderGeometry(24, 24, 1, 48), M.stone, [0, -0.5, 0]);
    const cols = around(6, 19, 0.5).map(([x, z]) => K.tag(K.add(new THREE.CylinderGeometry(1.8, 1.8, 30, 16, 1, true), new THREE.MeshBasicMaterial({color: '#cfd8ff', transparent: true, opacity: 0.12, depthWrite: false}), [x, 15, z]), 'updraft'));
    const petals = around(5, 11, 0.1).map(([x, z]) => K.add(new THREE.CylinderGeometry(3.6, 3.6, 0.5, 6), mat('#7d5a73'), [x, 15, z]));
    const spire = K.add(new THREE.CylinderGeometry(2, 3.4, 20, 8), M.stone2, [0, 10, 0]);
    const lil = K.node([0, 20, 0]);
    K.add(new THREE.CapsuleGeometry(2.2, 16, 4, 10), M.colossus, [0, 10, 0], [0, 0, 0], lil);
    K.add(new THREE.IcosahedronGeometry(2.2, 1), M.colossus, [0, 21, 0], [0, 0, 0], lil);
    const wings = [-1, 1].map((sx) => {
      const w = K.node([sx * 2, 16, -1], lil);
      K.add(new THREE.BoxGeometry(18, 0.5, 7), M.colossusDark, [sx * 9, 0, 0], [0, 0, sx * 0.3], w);
      return {w, sx};
    });
    const mirrorPivot = K.node([0, 12, 0], lil);
    K.add(new THREE.CylinderGeometry(6, 6, 0.5, 28), mat('#c3cad6', {metalness: 0.8, roughness: 0.15}), [0, 0, 7], [Math.PI / 2, 0, 0], mirrorPivot);
    const heart = K.weak(lil, [[0, 13, 2.4]], 1.0);
    return {
      phases: ['Charm: she pulls you in from the high petals', 'Mirror: shoot only while the mirror is down; the petals fall to steps'],
      spawn: [0, 0.5, 14],
      killY: -25,
      cam: {target: [0, 12, 0], az: 30, el: 22, dist: 84},
      spots: () => [[3, 0, 8], [9, 15.6, 0], [-8, 0, -3], [-3.4, 15.6, 10.5], [12, 0, -7], [-14, 0, 6], [6, 0, -14], [-5, 0, 15]],
      update(ctx, f) {
        const t = ctx.t;
        const p2 = seg(f, 1, 1.25);
        lil.rotation.y = ctx.hunt ? Math.atan2(ctx.player.pos.x, ctx.player.pos.z) : t * 0.1;
        wings.forEach(({w, sx}) => (w.rotation.z = sx * 0.2 * Math.sin(t * 0.7)));
        petals.forEach((p, k) => {
          const a = 0.1 + (k / 5) * Math.PI * 2 + t * 0.06 * (1 - p2);
          const r = 11 + p2 * 4;
          p.position.set(Math.cos(a) * r, 15 - p2 * (3 + k * 2.2) + 0.4 * Math.sin(t * 0.5 + k), Math.sin(a) * r);
          p.rotation.set(p2 * 0.25 * Math.sin(k), 0, p2 * 0.25 * Math.cos(k));
        });
        cols.forEach((c, k) => (c.position.y = 15 + Math.sin(t * 0.3 + k) * 0.5));
        // mirror: off in phase one; in phase two it circles her, down for 3 s in every 8
        const down = p2 > 0 && t % 8 < 3;
        mirrorPivot.visible = p2 > 0.05;
        mirrorPivot.rotation.y = t * 0.8;
        mirrorPivot.position.y = down ? -20 : 12;
        heart(ctx, () => (p2 < 0.5 ? 0.5 : down ? 1 : 0.1));
        // the charm: a pull toward the spire for 2 s in every 6 (phase one, or both)
        if (ctx.hunt && t % 6 < 2) ctx.pull.add(new V3(-ctx.player.pos.x, 0, -ctx.player.pos.z).normalize().multiplyScalar(14 * (1 - p2 * 0.4)));
        void spire;
      },
    };
  },

  // ------------------------------------------------------------ Layer 7: Amon (Wrath)
  wrath(g) {
    // A burning prison yard with tiered cell blocks on two sides. Amon, a 36 m horned jailer, stands on the top block
    // at the north and sweeps the yard with his eye beam. Phase one: fire floods the low ground in waves.
    // Phase two: the yard floods to the second tier for good, the cells open (their doors fall into bridges across
    // the yard), and he steps down to the upper tier.
    const K = kit(g);
    K.add(new THREE.BoxGeometry(50, 1, 50), M.stone, [0, -0.5, 0]);
    const doors = [];
    for (let tier = 0; tier < 3; tier++) {
      const h = 3 + tier * 3;
      for (const sx of [-1, 1]) {
        K.add(new THREE.BoxGeometry(6, h, 34 - tier * 6), M.wall, [sx * (22 - tier * 6), h / 2, 0]);
        if (tier === 1) for (let d = -1; d <= 1; d++) {
          const hinge = K.node([sx * (22 - 6 - 3.05), h, d * 7]);
          K.add(new THREE.BoxGeometry(0.4, 4, 4.5), M.goldDark, [0, -2, 0], [0, 0, 0], hinge);
          doors.push({hinge, sx});
        }
      }
    }
    K.add(new THREE.BoxGeometry(20, 12, 8), M.wall, [0, 6, -26]); // Amon's block
    for (const [x, z] of [[-13, 9], [13, -9], [-13, -9], [13, 9]]) K.tag(K.add(new THREE.CylinderGeometry(0.9, 0.9, 0.25, 12), M.pad, [x, 0.1, z]), 'pad');
    const fire = K.tag(K.add(new THREE.BoxGeometry(50, 0.2, 50), mat('#e0561a', {emissive: new THREE.Color('#e0561a'), emissiveIntensity: 0.8, transparent: true, opacity: 0.6})), 'fire');
    const amon = K.node([0, 12, -26]);
    K.add(new THREE.BoxGeometry(12, 14, 7), M.colossus, [0, 9, 0], [0, 0, 0], amon);
    const head = K.node([0, 19, 1], amon);
    K.add(new THREE.BoxGeometry(6, 6, 6), M.colossus, [0, 0, 0], [0, 0, 0], head);
    for (const sx of [-1, 1]) K.add(new THREE.ConeGeometry(1, 7, 5), M.colossusDark, [sx * 3.6, 5, 0], [0, 0, -sx * 0.6], head);
    for (const sx of [-1, 1]) K.add(new THREE.BoxGeometry(3, 9, 3), M.colossus, [sx * 3, -3, 0], [0, 0, 0], amon);
    const keys = K.add(new THREE.TorusGeometry(2.4, 0.3, 4, 16), mat('#8f8578', {metalness: 0.6}), [7.5, 4, 2], [0, 0, 0], amon);
    const beam = K.add(new THREE.BoxGeometry(0.5, 0.5, 60), new THREE.MeshBasicMaterial({color: '#ff3a1c', transparent: true, opacity: 0.85}), [0, 0, 30], [0, 0, 0], head);
    beam.castShadow = false;
    const eyes = K.weak(head, [[1.4, 0.6, 3.1], [-1.4, 0.6, 3.1]], 0.7);
    return {
      phases: ['The jailer: fire floods the yard in waves, the beam sweeps', 'The flood: fire holds the second tier, the cells open into bridges'],
      spawn: [0, 0.5, 12],
      killY: -25,
      cam: {target: [0, 7, -4], az: 24, el: 28, dist: 84},
      spots: () => [[0, 0, 6], [19, 3, -6], [-13, 6, 4], [3, 0, -9], [-6, 0, 10], [13, 6, 8], [-19, 3, -10], [8, 0, 13]],
      update(ctx, f) {
        const t = ctx.t;
        const p2 = seg(f, 1, 1.2);
        const wave = Math.max(0.05, 1.6 * Math.sin(t * 0.35) + 0.3);
        fire.position.y = wave * (1 - p2) + 6.2 * p2;
        doors.forEach((d) => (d.hinge.rotation.z = d.sx * p2 * 1.5)); // fall outward into bridges across the gap
        amon.position.set(0, 12 - p2 * 3, -26 + p2 * 6);
        head.rotation.y = ctx.hunt ? Math.atan2(ctx.player.pos.x - amon.position.x, ctx.player.pos.z - amon.position.z) + Math.sin(t * 0.9) * 0.4 : Math.sin(t * 0.35) * 0.9;
        head.rotation.x = 0.42;
        keys.rotation.z = t * 2;
        beam.material.opacity = t % 5 < 3.5 ? 0.85 : 0.15;
        eyes(ctx, () => 0.6 + 0.4 * p2);
      },
    };
  },

  // ------------------------------------------------------------ Layer 8: Quire, the clerk (Fraud)
  fraud(g) {
    // A mirrored archive. Quire is a 30 m open ledger with quill arms that hovers over the floor and writes clauses.
    // Phase one: each clause rewrites the arena: a new set of tiles turns false and drops, and the door pairs swap.
    // Phase two: he reveals the contract and the two mirror walls swing down flat: the mirrors become the real
    // floor, raised either side, and the old floor falls away beneath you.
    const K = kit(g);
    const tiles = [];
    for (let x = -5; x < 5; x++) for (let z = -3; z < 3; z++) tiles.push({m: K.add(new THREE.BoxGeometry(4.2, 0.6, 4.2), M.stone, [x * 4.4 + 2.2, -0.3, z * 4.4 + 2.2]), k: tiles.length, x, z});
    const mirrors = [-1, 1].map((sx) => {
      const hinge = K.node([sx * 22.5, 0, 0]);
      K.add(new THREE.BoxGeometry(0.6, 22, 27), mat('#8a93a3', {metalness: 0.6, roughness: 0.2}), [0, 11, 0], [0, 0, 0], hinge);
      return {hinge, sx};
    });
    const quire = K.node([0, 14, 0]);
    for (const sx of [-1, 1]) K.add(new THREE.BoxGeometry(10, 0.6, 14), mat('#e9e1cf'), [sx * 5.2, 0, 0], [0, 0, sx * 0.22], quire);
    K.add(new THREE.BoxGeometry(0.8, 1.2, 14.4), M.colossusDark, [0, -0.8, 0], [0, 0, 0], quire);
    const quills = [-1, 1].map((sx) => {
      const b = K.node([sx * 10.5, 0.6, -3], quire);
      return {ch: K.chain(b, 5, 2.4, 0.8, 0.3, M.colossusDark), sx};
    });
    const spine = K.weak(quire, [[0, 1, 0]], 1.0);
    return {
      phases: ['Clauses: every few seconds a new set of tiles turns false', 'The contract: the mirrors swing down and become the floor'],
      spawn: [0, 0.5, 8],
      killY: -25,
      cam: {target: [0, 6, 0], az: 26, el: 30, dist: 74},
      spots: () => [[2, 0, 4], [-10, 0, -4], [8, 0, -6], [-4, 0, 7], [13, 0, 5], [-15, 0, 7], [0, 0, -10], [16, 0, -9]],
      update(ctx, f) {
        const t = ctx.t;
        const p2 = seg(f, 1, 1.25);
        const clause = Math.floor(t / 6);
        for (const T of tiles) {
          const fake = (T.x * 7 + T.z * 13 + clause * 5 + 50) % 4 === 0;
          const drop = p2 > 0.5 ? 1 : fake ? Math.min(1, ((t % 6) - 2) / 1) : 0;
          T.m.position.y += ((-0.3 - Math.max(0, drop) * 16) - T.m.position.y) * Math.min(1, ctx.dt * 3);
        }
        mirrors.forEach(({hinge, sx}) => {
          hinge.rotation.z = sx * p2 * (Math.PI / 2);
          hinge.position.y = p2 * 2;
        });
        quire.rotation.y = t * 0.15;
        quire.position.y = 14 + p2 * 6 + Math.sin(t * 0.5);
        quills.forEach(({ch, sx}) => ch.pose((i) => (i ? 0.45 + 0.3 * Math.sin(t * 2.4 + i + sx) : 0.9)));
        spine(ctx, () => 0.6 + 0.4 * p2);
      },
    };
  },

  // ------------------------------------------------------------ Layer 9: The Companion (Treachery)
  treachery(g) {
    // Cocytus, a frozen lake bowl. The Companion, 34 m and pale, fights beside you in phase one: it hovers at your
    // side and turns to face what you face. Phase two: it turns. The lake cracks into floes that drift apart and bob,
    // and it looms over the centre. Its weak point stays hidden: a story beat.
    const K = kit(g);
    const pts = [];
    for (let k = 0; k <= 10; k++) pts.push(new THREE.Vector2((k / 10) * 26, Math.pow(k / 10, 4) * 9));
    K.add(new THREE.LatheGeometry(pts, 48), mat('#c8d6e2', {side: THREE.DoubleSide}), [0, -0.1, 0]);
    K.tag(K.add(new THREE.CylinderGeometry(60, 60, 0.2, 32), mat('#1d2a36', {roughness: 0.2}), [0, -2.5, 0]), 'nocollide'); // black water
    const iceMat = mat('#9fb8cc', {metalness: 0.2, roughness: 0.15});
    const whole = K.tag(K.add(new THREE.CylinderGeometry(19, 19, 0.6, 48), iceMat, [0, -0.25, 0]), 'ice');
    const floes = Array.from({length: 9}, (_, k) => {
      const a = (k / 8) * Math.PI * 2;
      const r = k === 8 ? 0 : 12;
      const m = K.tag(K.add(new THREE.CylinderGeometry(k === 8 ? 6 : 5.6, k === 8 ? 6 : 5.6, 0.6, 6), iceMat, [Math.cos(a) * r, -0.25, Math.sin(a) * r]), 'ice');
      m.visible = false;
      return {m, a, r, k};
    });
    const comp = K.node([8, 6, 8]);
    const ghost = mat('#dfe6ee', {transparent: true, opacity: 0.6, emissive: new THREE.Color('#9fb8cc'), emissiveIntensity: 0.3});
    K.add(new THREE.ConeGeometry(6, 26, 10), ghost, [0, 0, 0], [0, 0, 0], comp);
    K.add(new THREE.IcosahedronGeometry(3.2, 1), ghost, [0, 15, 0], [0, 0, 0], comp);
    K.add(new THREE.BoxGeometry(5, 2.8, 3.2), mat('#1a1d24'), [0, 15, 1.9], [0, 0, 0], comp);
    return {
      phases: ['Beside you: it fights with you', 'It turns: the lake cracks into floes'],
      spawn: [0, 0.5, 6],
      killY: -6,
      cam: {target: [0, 6, 0], az: 30, el: 26, dist: 72},
      spots: () => [[6, 0.2, -4], [-10, 0.2, 6], [0, 0.2, -9], [8, 0.2, 7], [-6, 0.2, -3], [12, 0.2, -9], [-13, 0.2, -9], [2, 0.2, 13]],
      update(ctx, f) {
        const t = ctx.t;
        const p2 = seg(f, 1, 1.2);
        const cracked = p2 > 0.05;
        whole.visible = !cracked;
        whole.userData.tag = cracked ? 'nocollide' : 'ice';
        for (const F of floes) {
          F.m.visible = cracked;
          F.m.userData.tag = cracked ? 'ice' : 'nocollide';
          const r = F.r + p2 * (F.k === 8 ? 0 : 3 + Math.sin(t * 0.2 + F.k) * 1.5);
          const a = F.a + p2 * t * 0.03 * (F.k % 2 ? 1 : -1);
          F.m.position.set(Math.cos(a) * r, -0.25 + Math.sin(t * 0.8 + F.k) * 0.25 * p2, Math.sin(a) * r);
          F.m.rotation.set(Math.sin(t * 0.6 + F.k) * 0.05 * p2, a, Math.cos(t * 0.5 + F.k) * 0.05 * p2);
        }
        // beside the player (phase one), over the centre facing them (phase two)
        const side = ctx.player.pos.clone().add(new V3(9, 6, 7));
        const over = new V3(0, 12, -8);
        comp.position.lerp(p2 > 0 ? over : ctx.hunt ? side : new V3(10, 6, 10), Math.min(1, ctx.dt * 1.2));
        const look = p2 > 0 && ctx.hunt ? ctx.player.pos : ctx.camera.position;
        comp.rotation.y = Math.atan2(look.x - comp.position.x, look.z - comp.position.z) * (p2 > 0 ? 1 : 0.3);
      },
    };
  },
};
