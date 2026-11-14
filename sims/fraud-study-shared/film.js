// FRAUD study: geometry and film. Two piers (the ledges) with towers and the high walkways; between them the archive
// floor of trapdoor tiles over a pit; on each pier a bascule leaf (mirror faced) on its trunnion, its tail carrying the
// counterweight and a toothed quadrant turned by a pinion in the pier. Film, 26 s: the raised leaves as mirror walls,
// clauses dropping tiles (always leaving one piece), the leaves lowered past level onto the floor, the floor falling
// middle-out, the leaves rising to meet mid-room. render(t) is pure.
import * as THREE from 'three';
import {runSim} from '../kit/runtime.js';
import {keyed} from '../kit/util.js';
import {partsKit} from '../slumber-kit/parts.js';
import {consoleUI, gear, materials, studio} from '../slumber-kit/studio.js';
import {B, CLAUSES, pinionTurns, RAMP, TAU, tileCentre} from './kin.js';

export const DURATION = 26;
const sm = (u) => {
  const x = Math.min(1, Math.max(0, u));
  return x * x * x * (x * (x * 6 - 15) + 10);
};
const angAt = (t) => B.raised + (-RAMP - B.raised) * sm((t - 17) / 3) + RAMP * sm((t - 22.5) / 2.5);
const CLAUSE_T = (c) => 10.2 + 1.3 * c;
const DEPTH = B.nz * B.tile;

function build(scene) {
  const mat = materials();
  mat.mirror = new THREE.MeshPhysicalMaterial({color: '#cfd8de', emissive: new THREE.Color('#9fb0bc'), emissiveIntensity: 0.3, metalness: 0.2, roughness: 0.12, clearcoat: 1});
  mat.pier = new THREE.MeshStandardMaterial({color: '#b9b0a6', roughness: 0.85});
  mat.tile = new THREE.MeshStandardMaterial({color: '#d6ccb8', roughness: 0.8});
  mat.pit = new THREE.MeshStandardMaterial({color: '#1d1a1c', roughness: 1});
  const root = new THREE.Group();
  scene.add(root);
  const K = partsKit(root, mat);
  const half = B.span / 2;
  K.mesh(new THREE.PlaneGeometry(B.span, DEPTH).rotateX(-Math.PI / 2).translate(0, 0.01, 0), mat.pit, root);
  // piers: a deck at ledge height on outer walls, open toward the room below the deck so the tail shows
  const leaves = [-1, 1].map((s) => {
    const cx = s * (half + 5);
    K.mesh(new THREE.BoxGeometry(10, 0.8, DEPTH + 4).translate(cx, B.ledgeH - 0.4, 0), mat.pier, root);
    K.mesh(new THREE.BoxGeometry(1.2, B.ledgeH, DEPTH + 4).translate(s * (half + 9.4), B.ledgeH / 2, 0), mat.pier, root);
    for (const z of [-(DEPTH / 2 + 1.4), DEPTH / 2 + 1.4]) {
      K.mesh(new THREE.BoxGeometry(10, B.ledgeH, 1.2).translate(cx, B.ledgeH / 2, z), mat.pier, root);
      K.mesh(new THREE.BoxGeometry(6, 26, 6).translate(s * (half + 4), B.ledgeH + 13, z), mat.pier, root); // towers
    }
    // the leaf on its trunnion
    const pivot = new THREE.Group();
    pivot.position.set(s * half, B.ledgeH, 0);
    root.add(pivot);
    K.mesh(new THREE.BoxGeometry(B.leaf, 0.8, DEPTH - 0.4).translate((-s * B.leaf) / 2, 0, 0), mat.fleshDeep, pivot);
    K.mesh(new THREE.BoxGeometry(B.leaf - 0.2, 0.06, DEPTH - 0.8).translate((-s * B.leaf) / 2, -0.43, 0), mat.mirror, pivot); // the underside faces the room when raised
    // tail: counterweight and the toothed quadrant behind the trunnion
    K.mesh(new THREE.BoxGeometry(4.5, 3, DEPTH - 2).translate(s * 2.6, -1.8, 0), mat.dark, pivot);
    for (const z of [-DEPTH / 3, DEPTH / 3]) {
      const q = K.mesh(new THREE.TorusGeometry(B.quadR, 0.18, 6, 32, Math.PI / 2).rotateZ(s > 0 ? -Math.PI / 2 : Math.PI), mat.accent, pivot);
      q.position.z = z;
    }
    K.orient(K.drum(0.5, DEPTH - 0.4), [s * half, B.ledgeH, 0], [0, 0, 1]);
    const pinions = [-DEPTH / 3, DEPTH / 3].map((z) => {
      const p = K.mesh(gear(B.pinR, 12, 0.3), mat.steel, root);
      p.position.set(s * half, B.ledgeH - B.quadR - B.pinR, z);
      return p;
    });
    return {s, pivot, pinions};
  });
  // the high walkways between the towers
  for (const z of [-(DEPTH / 2 + 1.4), DEPTH / 2 + 1.4]) K.mesh(new THREE.BoxGeometry(B.span + 8, 1.6, 3).translate(0, B.ledgeH + 22, z), mat.pier, root);
  // tiles
  const dropT = new Map();
  CLAUSES.forEach((c, k) => c.forEach(([i, j]) => dropT.set(`${i},${j}`, CLAUSE_T(k))));
  const tiles = [];
  for (let i = 0; i < B.nx; i++) {
    for (let j = 0; j < B.nz; j++) {
      const [x, z] = tileCentre(i, j);
      const m = K.mesh(new THREE.BoxGeometry(B.tile - 0.12, 0.4, B.tile - 0.12), mat.tile, root);
      m.position.set(x, 0.2, z);
      tiles.push({m, x, z, t0: dropT.get(`${i},${j}`) ?? 20 + (Math.abs(x) / half) * 2.2});
    }
  }
  return {
    update(t) {
      const a = angAt(t);
      for (const L of leaves) {
        L.pivot.rotation.z = -L.s * a;
        for (const p of L.pinions) p.rotation.z = L.s * pinionTurns(a) * TAU;
      }
      let gone = 0;
      for (const T of tiles) {
        const f = Math.max(0, t - T.t0);
        T.m.position.y = 0.2 - 4.9 * f * f;
        T.m.rotation.x = 0.4 * f;
        T.m.visible = T.m.position.y > -30;
        if (f > 0) gone++;
      }
      return {a, gone};
    },
  };
}

const STAGES = [
  {t: 0, s: 'RUN', cap: 'FRAUD · AN ARCHIVE FLOOR BETWEEN TWO PIERS · THE MIRROR WALLS ARE A RAISED DOUBLE BASCULE, AFTER TOWER BRIDGE'},
  {t: 4, s: 'ARRIVAL', cap: 'EACH LEAF RIDES A TRUNNION · A PINION ON ITS TOOTHED QUADRANT TURNS IT; THE TAIL CARRIES THE COUNTERWEIGHT'},
  {t: 10, s: 'PHASE 1', cap: 'CLAUSES DROP THE TRAPDOORS · THE ORDER IS FIXED SO THE FLOOR LEFT IS ALWAYS ONE PIECE'},
  {t: 17, s: 'PHASE 2', cap: 'THE LEAVES LOWER PAST LEVEL ONTO THE FLOOR (RAMPS), THE FLOOR FALLS MIDDLE OUT, THEY RISE AND MEET MID-ROOM'},
];
const CAM = [
  [0, [0, 8, 0, 25, 26, 66]],
  [3.8, [0, 8, 0, 40, 22, 62]],
  [4.6, [0, 8, 0, 60, 20, 58]],
  [9.4, [0, 8, 0, 95, 18, 56]],
  [10.2, [0, 2, 0, 15, 48, 52]],
  [16.6, [0, 2, 0, 345, 48, 52]],
  [17.4, [0, 3, 0, 5, 42, 58]],
  [26, [0, 3, 0, 345, 46, 58]],
];

export function run() {
  runSim({duration: DURATION, fps: 60, theme: 'light', hud: {enabled: false}, director: {enabled: false}, watermark: ''}, ({canvas, capture}) => {
    const st = studio(canvas, {capture, shadow: 40, fog: [110, 300]});
    st.camera.far = 1500;
    st.camera.updateProjectionMatrix();
    const v = build(st.scene);
    const ui = consoleUI(document.getElementById('app'), {code: 'FR-8', eyebrow: 'STAGE STUDY · LAYER 8 · FRAUD · AFTER TOWER BRIDGE', title: 'Fraud'});
    return {
      resize: st.resize,
      render(t) {
        const S = v.update(t);
        const [x, y, z, az, el, dist] = keyed(CAM, t, sm);
        st.aim([x, y, z], az, el, dist);
        st.render();
        const bi = STAGES.reduce((k, b, i) => (t >= b.t ? i : k), 0);
        ui.set({
          cap: STAGES[bi].cap,
          n: bi + 1,
          mode: STAGES[bi].s,
          right: `LEAVES ${((S.a * 180) / Math.PI).toFixed(1)}°`,
          rows: [
            ['SPAN', `${B.span.toFixed(1)} m (61 m real)`],
            ['LEAF', `${B.leaf.toFixed(2)} m`],
            ['RAISED', '86°'],
            ['RAMP', `−${((RAMP * 180) / Math.PI).toFixed(1)}°`],
            ['PINION', `${pinionTurns(S.a).toFixed(2)} turns`],
            ['TILES', `${B.nx * B.nz - S.gone} / ${B.nx * B.nz}`],
          ],
          barsTitle: 'STAGE',
          bars: [['LEAF', (S.a + RAMP) / (B.raised + RAMP)], ['FLOOR', 1 - S.gone / (B.nx * B.nz)]],
          subs: [
            ['Bascule leaves ×2', bi === 3 ? 'MOVING' : 'RAISED', bi === 1 || bi === 3],
            ['Trapdoors', bi === 2 ? 'DROPPING' : bi === 3 ? 'FALLING' : 'SHUT', bi === 2],
            ['Quire', 'NOT MODELLED', false],
          ],
        });
        return {};
      },
    };
  });
}
