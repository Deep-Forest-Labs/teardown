// Whitebox blockouts of the nine arenas, from the Levels board's concept lines. Rough proxies for talking about
// enemies in place, not the level whiteboxes themselves (those live in the Unity project and on the board).
// Colours follow the board legend: pads orange, lifts yellow, hazards red, edges blue.
// Each returns {group, update(t), spots, prince, cam}: spots are [x, y, z] stands for enemies, prince is the boss
// anchor, cam is {target, az, el, dist}.
import * as THREE from 'three';

export const LEG = {
  floor: '#5d5a63',
  floor2: '#4a4750',
  wall: '#6f6b75',
  pad: '#d9660b',
  lift: '#b59b17',
  hazard: '#c0281c',
  edge: '#3a83c4',
  blood: '#6e1a14',
  gold: '#9a7a2a',
  flesh: '#7a2e2a',
  bile: '#8a5a1a',
  ice: '#9fb8cc',
  fire: '#e0561a',
};

const std = (c, extra = {}) => new THREE.MeshStandardMaterial({color: c, roughness: 0.9, flatShading: true, ...extra});
const glow = (c, o = 0.35) => new THREE.MeshBasicMaterial({color: c, transparent: true, opacity: o, depthWrite: false});

function kit(group) {
  const add = (geo, mat, p = [0, 0, 0], r = [0, 0, 0], shadow = true) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(...p);
    m.rotation.set(...r);
    m.castShadow = shadow;
    m.receiveShadow = true;
    group.add(m);
    return m;
  };
  const ring = (r0, r1, h, mat, y = 0, seg = 64, start = 0, len = Math.PI * 2) => {
    const shape = new THREE.Shape();
    shape.absarc(0, 0, r1, start, start + len, false);
    shape.absarc(0, 0, r0, start + len, start, true);
    const geo = new THREE.ExtrudeGeometry(shape, {depth: h, bevelEnabled: false, curveSegments: seg});
    geo.rotateX(-Math.PI / 2);
    return add(geo, mat, [0, y, 0]);
  };
  const pad = (p) => add(new THREE.CylinderGeometry(0.9, 0.9, 0.25, 12), std(LEG.pad, {emissive: new THREE.Color(LEG.pad), emissiveIntensity: 0.4}), p);
  return {add, ring, pad};
}

const around = (n, r, y, off = 0) => Array.from({length: n}, (_, k) => {
  const a = off + (k / n) * Math.PI * 2;
  return [Math.cos(a) * r, y, Math.sin(a) * r];
});

export const ARENAS = {
  altar(g) {
    const {add, ring} = kit(g);
    add(new THREE.CylinderGeometry(20, 20.5, 1, 64), std(LEG.floor), [0, -0.5, 0]);
    ring(19, 20.6, 0.6, std(LEG.blood), 0); // bleeding rim
    ring(11.2, 12.4, 0.05, std(LEG.blood, {emissive: new THREE.Color(LEG.hazard), emissiveIntensity: 0.25}), -0.02); // sunken channel
    const pool = add(new THREE.CylinderGeometry(4, 4, 0.1, 32), std(LEG.hazard, {emissive: new THREE.Color(LEG.hazard), emissiveIntensity: 0.5}), [0, 0.02, 0]);
    return {
      update: (t) => (pool.material.emissiveIntensity = 0.4 + 0.2 * Math.sin(t * 2)),
      spots: [[16, 0, 0], [-7, 3.5, 9], [6, 0, -9], [-10, 0, -6], [9, 0, 10], [-14, 0, 4], [3, 0, 14], [12, 0, -13]],
      prince: [0, 9, 0],
      cam: {target: [0, 4, 0], az: 35, el: 32, dist: 52},
    };
  },
  void(g) {
    const {add, ring, pad} = kit(g);
    add(new THREE.CylinderGeometry(8, 8, 1.2, 40), std(LEG.floor), [0, -0.6, 0]);
    for (let k = 0; k < 8; k++) ring(10, 16, 1.2, std(LEG.floor2), 4 - 1.2, 16, (k / 8) * Math.PI * 2 + 0.06, Math.PI / 4 - 0.12);
    for (let k = 0; k < 12; k++) ring(18, 24, 1.2, std(LEG.floor), 8 - 1.2, 12, (k / 12) * Math.PI * 2 + 0.05, Math.PI / 6 - 0.1);
    for (const r of [8, 16, 24]) ring(r - 0.15, r, 0.05, glow(LEG.edge, 0.8), r === 8 ? 0.01 : r === 16 ? 4.01 : 8.01);
    for (const p of around(4, 7, 0.1, 0.4)) pad(p);
    for (const p of around(6, 15, 4.1, 0.2)) pad(p);
    add(new THREE.CylinderGeometry(40, 40, 0.2, 48), std('#0b0a10'), [0, -30, 0], [0, 0, 0], false); // the abyss floor far below
    return {
      update: () => {},
      spots: [[13, 4, 0], [-21, 8, 3], [0, 7, -12], [5, 0, 4], [-12, 4, -6], [20, 8, -9], [-4, 0, -5], [9, 4, 10]],
      prince: [0, 22, 0],
      cam: {target: [0, 6, 0], az: 30, el: 30, dist: 62},
    };
  },
  ruins(g) {
    const {add, ring, pad} = kit(g);
    add(new THREE.BoxGeometry(42, 1, 42), std(LEG.floor), [0, -0.5, 0]);
    for (let x = -2; x <= 2; x++) for (let z = -2; z <= 2; z++) if ((x + z) % 2 === 0) add(new THREE.BoxGeometry(3.6, 0.05, 3.6), std('#3e3b44'), [x * 4, 0.02, z * 4]); // cracked tiles
    for (const p of around(8, 13, 0)) {
      add(new THREE.CylinderGeometry(1.4, 1.6, 10, 8), std(LEG.wall), [p[0], 5, p[2]]);
      pad([p[0], 10.15, p[2]]);
    }
    ring(16, 19, 0.8, std(LEG.floor2), 9.4, 48); // ring gallery
    for (const p of around(16, 17.5, 0, 0.2)) add(new THREE.BoxGeometry(0.8, 9.4, 0.8), std(LEG.wall), [p[0], 4.7, p[2]]);
    add(new THREE.BoxGeometry(8, 2, 8), std(LEG.wall), [0, 1, -10]); // the dais
    return {
      update: () => {},
      spots: [[0, 2, -6], [10, 0, 8], [-17.5, 10.2, 2], [6, 0, -3], [-8, 0, 7], [14, 0, -14], [-5, 0, -14], [3, 0, 12]],
      prince: [0, 14, -10],
      cam: {target: [0, 5, 0], az: 30, el: 30, dist: 56},
    };
  },
  gluttony(g) {
    const {add, pad} = kit(g);
    const pts = [];
    for (let k = 0; k <= 12; k++) {
      const r = (k / 12) * 22;
      pts.push(new THREE.Vector2(r, 0.002 * r * r * r * 0.12));
    }
    pts.push(new THREE.Vector2(22.5, 9));
    add(new THREE.LatheGeometry(pts, 48), std(LEG.flesh, {side: THREE.DoubleSide}), [0, -0.2, 0]);
    const bile = add(new THREE.CylinderGeometry(15, 15, 0.1, 48), std(LEG.bile, {emissive: new THREE.Color(LEG.bile), emissiveIntensity: 0.15}), [0, 0.3, 0]);
    const mounds = [];
    for (const [x, z, s] of [[5, 3, 3], [-6, 5, 2.4], [0, -8, 3.4], [9, -6, 2.2], [-9, -5, 2.8], [-3, 11, 2.6], [11, 8, 2]]) mounds.push(add(new THREE.SphereGeometry(s, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), std('#8c3a33'), [x, 0, z]));
    for (const p of around(5, 20, 3.5, 0.3)) pad(p);
    return {
      update: (t) => {
        mounds.forEach((m, k) => m.scale.setScalar(1 + 0.08 * Math.sin(t * 0.7 + k)));
        bile.material.emissiveIntensity = 0.12 + 0.05 * Math.sin(t);
      },
      spots: [[5, 3.2, 3], [-9, 0.5, 2], [0, 3.6, -8], [12, 0.5, 2], [-6, 2.6, 5], [8, 0.5, -11], [-12, 0.5, -10], [3, 0.5, 13]],
      prince: [0, 13, 0],
      cam: {target: [0, 4, 0], az: 40, el: 34, dist: 52},
    };
  },
  greed(g) {
    const {add, ring} = kit(g);
    add(new THREE.CylinderGeometry(10, 10, 1, 8), std(LEG.floor), [0, -0.5, 0]);
    ring(12, 17, 3, std(LEG.gold), 0, 8);
    ring(19, 24, 6, std('#7d6324'), 0, 8);
    const lifts = around(6, 18, 0, 0.26).map((p) => add(new THREE.BoxGeometry(2.6, 0.5, 2.6), std(LEG.lift, {emissive: new THREE.Color(LEG.lift), emissiveIntensity: 0.25}), p));
    for (const p of around(4, 14.5, 3, 0.8)) add(new THREE.ConeGeometry(1.6, 1.8, 7), std('#d6b44a', {metalness: 0.5, roughness: 0.4}), [p[0], 3.9, p[2]]); // treasure piles
    return {
      update: (t) => lifts.forEach((l, k) => (l.position.y = 3 + 3 * Math.sin(t * 0.6 + k * 1.05))),
      spots: [[4, 0, 3], [-14.5, 3, 3], [0, 0, -6], [21, 6, 2], [-6, 0, 4], [10, 3, -9], [-21, 6, -5], [6, 0, 8]],
      prince: [0, 14, 0],
      cam: {target: [0, 4, 0], az: 30, el: 32, dist: 56},
    };
  },
  lust(g) {
    const {add, ring} = kit(g);
    add(new THREE.CylinderGeometry(20, 20, 1, 48), std(LEG.floor), [0, -0.5, 0]);
    for (const p of around(6, 16, 0, 0.5)) add(new THREE.CylinderGeometry(1.6, 1.6, 26, 16, 1, true), glow('#cfd8ff', 0.12), [p[0], 13, p[2]], [0, 0, 0], false);
    const petals = around(5, 9, 14, 0.1).map((p, k) => add(new THREE.CylinderGeometry(3.2, 3.2, 0.4, 6), std('#7d5a73'), p, [0.25 * Math.sin(k), 0, 0.25 * Math.cos(k)]));
    const wind = new THREE.Group();
    for (let k = 0; k < 10; k++) {
      const m = new THREE.Mesh(new THREE.ConeGeometry(0.4, 2.2, 3), glow('#ffffff', 0.25));
      const a = (k / 10) * Math.PI * 2;
      m.position.set(Math.cos(a) * 11, 0.6, Math.sin(a) * 11);
      m.rotation.set(0, -a, Math.PI / 2);
      wind.add(m);
    }
    g.add(wind);
    ring(19.6, 20, 0.05, glow(LEG.edge, 0.7), 0.01);
    return {
      update: (t) => {
        wind.rotation.y = t * 0.35;
        petals.forEach((p, k) => (p.position.y = 14 + 0.4 * Math.sin(t * 0.5 + k)));
      },
      spots: [[3, 0, 6], [9, 14.6, 0], [-6, 0, -3], [-2.8, 14.6, 8.6], [10, 0, -6], [-12, 0, 6], [5, 0, -12], [-4, 0, 13]],
      prince: [0, 22, 0],
      cam: {target: [0, 7, 0], az: 30, el: 26, dist: 58},
    };
  },
  wrath(g) {
    const {add} = kit(g);
    add(new THREE.BoxGeometry(44, 1, 44), std(LEG.floor), [0, -0.5, 0]);
    for (let tier = 0; tier < 3; tier++) {
      const h = 3 + tier * 3;
      for (const sx of [-1, 1]) add(new THREE.BoxGeometry(6, h, 30 - tier * 6), std(LEG.wall), [sx * (19 - tier * 6), h / 2, 0]);
    }
    const fire = add(new THREE.BoxGeometry(44, 0.2, 44), std(LEG.fire, {emissive: new THREE.Color(LEG.fire), emissiveIntensity: 0.8, transparent: true, opacity: 0.7}), [0, 0, 0], [0, 0, 0], false);
    return {
      update: (t) => (fire.position.y = Math.max(0.05, 1.4 * Math.sin(t * 0.35) + 0.2)),
      spots: [[0, 0, 4], [19, 3, -6], [-13, 6, 4], [3, 0, -8], [-6, 0, 9], [13, 6, 8], [-19, 3, -10], [8, 0, 12]],
      prince: [0, 16, -2],
      cam: {target: [0, 5, 0], az: 25, el: 32, dist: 58},
    };
  },
  fraud(g) {
    const {add} = kit(g);
    const tiles = [];
    for (let x = -5; x < 5; x++) for (let z = -3; z < 3; z++) {
      const fake = (x * 7 + z * 13 + 50) % 5 === 0;
      tiles.push({m: add(new THREE.BoxGeometry(4.2, 0.6, 4.2), std(fake ? '#55525c' : LEG.floor), [x * 4.4 + 2.2, -0.3, z * 4.4 + 2.2]), fake, k: tiles.length});
    }
    for (const sx of [-1, 1]) add(new THREE.BoxGeometry(0.6, 12, 27), std('#8a93a3', {metalness: 0.6, roughness: 0.2}), [sx * 22.5, 6, 0]); // mirror walls
    const doorCols = [LEG.pad, LEG.edge, LEG.lift, '#8a2357'];
    around(8, 14, 0, 0.2).forEach((p, k) => {
      const mat = std(doorCols[k % 4], {emissive: new THREE.Color(doorCols[k % 4]), emissiveIntensity: 0.4});
      add(new THREE.BoxGeometry(0.5, 4.2, 0.5), mat, [p[0] - 1, 2.1, p[2] * 0.7]);
      add(new THREE.BoxGeometry(0.5, 4.2, 0.5), mat, [p[0] + 1, 2.1, p[2] * 0.7]);
      add(new THREE.BoxGeometry(2.5, 0.5, 0.5), mat, [p[0], 4.2, p[2] * 0.7]);
    });
    return {
      update: (t) => tiles.filter((x) => x.fake).forEach((x) => (x.m.position.y = -0.3 - Math.max(0, Math.sin(t * 0.6 + x.k)) * 6)),
      spots: [[2, 0, 4], [-10, 0, -4], [8, 0, -6], [-4, 0, 7], [13, 0, 5], [-15, 0, 7], [0, 0, -10], [16, 0, -9]],
      prince: [0, 15, 0],
      cam: {target: [0, 4, 0], az: 28, el: 34, dist: 54},
    };
  },
  treachery(g) {
    const {add} = kit(g);
    const pts = [];
    for (let k = 0; k <= 10; k++) pts.push(new THREE.Vector2((k / 10) * 22, Math.pow(k / 10, 4) * 7));
    add(new THREE.LatheGeometry(pts, 48), std('#c8d6e2', {side: THREE.DoubleSide}), [0, -0.1, 0]);
    add(new THREE.CylinderGeometry(17, 17, 0.12, 48), std(LEG.ice, {metalness: 0.2, roughness: 0.15, transparent: true, opacity: 0.85}), [0, 0.05, 0]);
    for (const [x, z, a] of [[6, -4, 0.3], [-8, 3, 1.2], [2, 9, 2], [-4, -10, 0.8], [11, 6, 2.6], [-12, -7, 1.9]]) add(new THREE.CapsuleGeometry(0.4, 1.1, 2, 6), std('#35414e'), [x, -0.5, z], [Math.PI / 2, a, 0], false); // frozen in the lake
    return {
      update: () => {},
      spots: [[6, 0.1, -4], [-10, 0.1, 6], [0, 0.1, -9], [8, 0.1, 7], [-6, 0.1, -3], [12, 0.1, -9], [-13, 0.1, -9], [2, 0.1, 13]],
      prince: [0, 12, 0],
      cam: {target: [0, 3, 0], az: 32, el: 30, dist: 50},
    };
  },
};

/** A 1.8 m player ghost for scale. */
export function playerMarker() {
  const g = new THREE.Group();
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 1.2, 2, 8), new THREE.MeshStandardMaterial({color: '#5fd4c8', emissive: new THREE.Color('#5fd4c8'), emissiveIntensity: 0.35, flatShading: true}));
  m.position.y = 0.9;
  m.castShadow = true;
  g.add(m);
  return g;
}
