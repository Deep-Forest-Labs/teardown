// GLUTTONY study: geometry and film. A flesh bowl on a bile floor; seven fly mounds (repose cones); at the centre the
// leg (boot, belt of buckets, head pulley) with the head house on top (Beelzebub) and a distributor with seven
// downspouts; seven bins on a climbing spiral. Film, 26 s: the lift into a cyclone swarm, the kills dropping as corpses
// round the boot, then everything through the leg into the bins, each tower a double jump above the last.
// render(t) is pure.
import * as THREE from 'three';
import {runSim} from '../kit/runtime.js';
import {keyed} from '../kit/util.js';
import {partsKit} from '../slumber-kit/parts.js';
import {consoleUI, materials, studio} from '../slumber-kit/studio.js';
import {bin, cone, G, MOUND_R, state, TAU, V_TOTAL} from './kin.js';

export const DURATION = 26;
const sm = (u) => {
  const x = Math.min(1, Math.max(0, u));
  return x * x * x * (x * (x * 6 - 15) + 10);
};
const liftAt = (t) => sm((t - 4) / 5);
const killAt = (t) => 0.6 * sm((t - 9) / 6);
const feedAt = (t) => (t - 15) <= 0 ? 0 : Math.min(1, (t - 15) / 10);
const N_FLY = 700;
const UP = new THREE.Vector3(0, 1, 0);
function span(m, a, b) {
  const va = new THREE.Vector3(...a);
  const d = new THREE.Vector3(...b).sub(va);
  m.position.copy(va).addScaledVector(d, 0.5);
  m.scale.set(1, d.length(), 1);
  m.quaternion.setFromUnitVectors(UP, d.normalize());
}
const hash = (i) => {
  const x = Math.sin(i * 127.1) * 43758.5453;
  return x - Math.floor(x);
};

function build(scene) {
  const mat = materials();
  mat.bile = new THREE.MeshStandardMaterial({color: '#b98a34', roughness: 0.25, metalness: 0.1});
  mat.fly = new THREE.MeshStandardMaterial({color: '#3a2b2a', roughness: 0.7});
  mat.ghost = new THREE.MeshStandardMaterial({color: '#9a9590', roughness: 0.5, metalness: 0.4, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false});
  const root = new THREE.Group();
  scene.add(root);
  const K = partsKit(root, mat);
  // the bowl and the bile
  const prof = [];
  for (let k = 0; k <= 16; k++) {
    const r = 26 + (k / 16) * 6;
    prof.push(new THREE.Vector2(r, ((r - 26) / 6) ** 2 * 7));
  }
  K.mesh(new THREE.LatheGeometry(prof, 72), mat.flesh, root).material.side = THREE.DoubleSide;
  K.mesh(new THREE.CircleGeometry(26.2, 72).rotateX(-Math.PI / 2).translate(0, 0.02, 0), mat.bile, root);
  // mounds (repose cones, scaled by their volume)
  const mounds = Array.from({length: G.bins}, (_, k) => {
    const m = K.mesh(new THREE.ConeGeometry(1, 1, 32).translate(0, 0.5, 0), mat.fly, root);
    m.position.set(...bin(k).c);
    return m;
  });
  // bins: hoops and staves (ghost) round the fly column, and a cap deck
  const bins = Array.from({length: G.bins}, (_, k) => {
    const B = bin(k);
    const g = new THREE.Group();
    g.position.set(...B.c);
    root.add(g);
    const wall = K.mesh(new THREE.CylinderGeometry(G.binR + 0.08, G.binR + 0.08, 1, 24, 1, true).translate(0, 0.5, 0), mat.ghost, g);
    const col = K.mesh(new THREE.CylinderGeometry(G.binR, G.binR, 1, 24).translate(0, 0.5, 0), mat.fly, g);
    const cap = K.mesh(new THREE.CylinderGeometry(G.binR + 0.25, G.binR + 0.25, 0.25, 24), mat.steel, g);
    const spout = K.mesh(new THREE.CylinderGeometry(0.16, 0.16, 1, 8), mat.steel, root);
    span(spout, [0, G.headDeck - 0.5, 0], [B.c[0] * 0.92, B.H + 1.2, B.c[2] * 0.92]);
    return {B, wall, col, cap, spout};
  });
  // the leg: two casings, boot, head pulley, buckets
  for (const x of [-0.45, 0.45]) K.mesh(new THREE.BoxGeometry(0.6, G.legH + 1, 0.6).translate(x, (G.legH + 1) / 2 - 0.5, 0), mat.steel, root);
  K.mesh(new THREE.BoxGeometry(2.2, 1.2, 1.6).translate(0, 0.6, 0), mat.dark, root);
  const head = new THREE.Group();
  head.position.y = G.headDeck;
  root.add(head);
  K.mesh(new THREE.BoxGeometry(4.2, 3, 4.2).translate(0, 1.5, 0), mat.flesh, head);
  K.mesh(new THREE.ConeGeometry(3.2, 1.6, 4).rotateY(Math.PI / 4).translate(0, 3.8, 0), mat.fleshDeep, head);
  const eye = K.mesh(new THREE.SphereGeometry(0.45, 16, 12).translate(0, 1.6, 2.15), mat.accent, head);
  const dist = new THREE.Group();
  dist.position.y = G.headDeck - 0.4;
  root.add(dist);
  K.mesh(new THREE.BoxGeometry(0.4, 0.4, 3.4).translate(0, 0, 1.7), mat.accent, dist);
  const buckets = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 0.25, 0.35), mat.dark, Math.round((2 * G.legH) / G.bucketPitch));
  root.add(buckets);
  // flies in the swarm, corpses round the boot
  const flies = new THREE.InstancedMesh(new THREE.SphereGeometry(0.18, 6, 4), mat.fly, N_FLY);
  const dead = new THREE.InstancedMesh(new THREE.SphereGeometry(0.22, 6, 4), mat.fly, N_FLY);
  root.add(flies, dead);
  const M4 = new THREE.Matrix4();
  return {
    update(t) {
      const S = state(liftAt(t), killAt(t), feedAt(t));
      S.mounds.forEach((v, k) => {
        const c = cone(v);
        mounds[k].scale.set(Math.max(c.r, 1e-3), Math.max(c.h, 1e-3), Math.max(c.r, 1e-3));
        mounds[k].visible = v > 1e-3;
      });
      let filling = 0;
      bins.forEach((b, k) => {
        const h = S.bins[k].h;
        const show = t >= 14.5;
        b.wall.visible = b.cap.visible = b.spout.visible = show;
        b.wall.scale.y = Math.max(0.01, b.B.H) * sm((t - 14.5) / 0.8);
        b.col.visible = h > 1e-3;
        b.col.scale.y = Math.max(h, 1e-3);
        b.cap.position.y = Math.max(h, 0.12);
        if (h > 1e-3 && h < b.B.H - 1e-6) filling = k;
        if (h >= b.B.H - 1e-6) filling = Math.min(G.bins - 1, k + 1);
      });
      dist.rotation.y = -bin(filling).a + Math.PI / 2;
      // buckets round the loop (up one side, down the other)
      const loop = 2 * G.legH;
      for (let i = 0; i < buckets.count; i++) {
        const s = (((i * G.bucketPitch + G.beltV * t) % loop) + loop) % loop;
        const up = s < G.legH;
        M4.makeTranslation(up ? 0.45 : -0.45, up ? s : loop - s, 0.42);
        buckets.setMatrixAt(i, M4);
      }
      buckets.instanceMatrix.needsUpdate = true;
      // the cyclone: count by volume
      const nS = Math.round((N_FLY * S.swarm) / V_TOTAL);
      for (let i = 0; i < N_FLY; i++) {
        if (i < nS) {
          const r = 3 + hash(i) * 8;
          const w = 1.6 / Math.sqrt(r);
          const a = hash(i + 7) * TAU + w * t;
          M4.makeTranslation(r * Math.cos(a), 9 + hash(i + 3) * 9 + Math.sin(t * 2 + i) * 0.4, r * Math.sin(a));
        } else M4.makeScale(0, 0, 0);
        flies.setMatrixAt(i, M4);
      }
      flies.instanceMatrix.needsUpdate = true;
      const nD = Math.round((N_FLY * S.corpses) / V_TOTAL);
      for (let i = 0; i < N_FLY; i++) {
        if (i < nD) {
          const r = 1.6 + hash(i + 11) * 6;
          const a = hash(i + 13) * TAU;
          M4.makeTranslation(r * Math.cos(a), 0.2, r * Math.sin(a));
        } else M4.makeScale(0, 0, 0);
        dead.setMatrixAt(i, M4);
      }
      dead.instanceMatrix.needsUpdate = true;
      eye.material.emissiveIntensity = S.swarm / V_TOTAL < 0.5 ? 1 : 0.2;
      return S;
    },
  };
}

const STAGES = [
  {t: 0, s: 'RUN', cap: 'GLUTTONY · SEVEN MOUNDS OF DEAD FLIES, EACH A CONE AT THE REPOSE ANGLE OF GRAIN, 27°'},
  {t: 4, s: 'ARRIVAL', cap: 'AN AIR LIFT PULLS THEM OFF THE MOUNDS INTO A CYCLONE ROUND THE HEAD HOUSE · THE MOUNDS SHRINK BY WHAT LEFT'},
  {t: 9, s: 'PHASE 1', cap: 'WHAT YOU KILL DROPS ROUND THE BOOT · AS THE SWARM THINS THE HEAD HOUSE IS EXPOSED'},
  {t: 15, s: 'PHASE 2', cap: 'THE LEG LIFTS IT ALL · THE DISTRIBUTOR FILLS SEVEN BINS IN TURN, h = V/πr², A DOUBLE JUMP EACH'},
];
const CAM = [
  [0, [0, 8, 0, 30, 26, 74]],
  [8.6, [0, 10, 0, 60, 22, 62]],
  [14.6, [0, 8, 0, 110, 24, 60]],
  [26, [0, 10, 0, 220, 20, 62]],
];

export function run() {
  runSim({duration: DURATION, fps: 60, theme: 'light', hud: {enabled: false}, director: {enabled: false}, watermark: ''}, ({canvas, capture}) => {
    const st = studio(canvas, {capture, shadow: 36, fog: [110, 300]});
    st.camera.far = 1500;
    st.camera.updateProjectionMatrix();
    const v = build(st.scene);
    const ui = consoleUI(document.getElementById('app'), {code: 'GL-4', eyebrow: 'STAGE STUDY · LAYER 4 · GLUTTONY · AFTER THE GRAIN ELEVATOR', title: 'Gluttony'});
    return {
      resize: st.resize,
      render(t) {
        const S = v.update(t);
        const [x, y, z, az, el, dist] = keyed(CAM, t, sm);
        st.aim([x, y, z], az, el, dist);
        st.render();
        const bi = STAGES.reduce((k, b, i) => (t >= b.t ? i : k), 0);
        const pct = (v) => `${((100 * v) / V_TOTAL).toFixed(0)} %`;
        ui.set({
          cap: STAGES[bi].cap,
          n: bi + 1,
          mode: STAGES[bi].s,
          right: `${V_TOTAL.toFixed(0)} m³ OF FLIES`,
          rows: [
            ['MOUNDS', pct(S.mounds.reduce((a, b) => a + b, 0))],
            ['SWARM', pct(S.swarm)],
            ['CORPSES', pct(S.corpses)],
            ['BINS', pct(S.bins.reduce((a, b) => a + b.v, 0))],
            ['MOUND', `r ${MOUND_R.toFixed(2)} m at 27°`],
            ['BELT', `${G.beltV} m/s`],
          ],
          barsTitle: 'TOWERS',
          bars: S.bins.map((b, k) => [`${k + 1}`, b.h / bin(k).H]),
          subs: [
            ['Mounds ×7', bi === 0 ? 'FULL' : 'EMPTYING', bi === 0 || bi === 1],
            ['Cyclone · head house', bi === 2 ? 'EXPOSED' : bi === 1 ? 'FILLING' : '-', bi === 2],
            ['Leg · distributor · bins', bi === 3 ? `BIN ${Math.min(7, S.bins.filter((b) => b.v > 0).length)}` : 'IDLE', bi === 3],
          ],
        });
        return {};
      },
    };
  });
}
