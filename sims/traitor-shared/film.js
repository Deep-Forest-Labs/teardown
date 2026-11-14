// RIME TR-6: geometry and film. The Miura sheet (10 × 10 rigid ice plates, rebuilt from θ each frame) lies flush in a
// hole in the ice floor; under it, sunk in dark water, a flesh hull with six folded legs. Folding draws the sheet in
// and corrugates it, opening the hole; the legs swing out onto the ice and stand the hull up with the folded sheet
// on its back; it turns on the target that walked past. Film, 15 s. render(t) is pure.
import * as THREE from 'three';
import {runSim} from '../kit/runtime.js';
import {keyed} from '../kit/util.js';
import {partsKit, twoBone} from '../slumber-kit/parts.js';
import {consoleUI, materials, studio} from '../slumber-kit/studio.js';
import {cell, extent, M, vertices} from './kin.js';

export const DURATION = 15;
const sm = (u) => {
  const x = Math.min(1, Math.max(0, u));
  return x * x * x * (x * (x * 6 - 15) + 10);
};
const TH0 = 0.02;
const TH1 = 1.3;
const thetaAt = (t) => TH0 + (TH1 - TH0) * sm((t - 3.5) / 3.5);
const standAt = (t) => sm((t - 7.2) / 2.3);
const turnAt = (t) => Math.PI * sm((t - 10) / 2.2);
const postZ = (t) => 8 - 14 * Math.min(1, t / 9);
const FLAT = extent(TH0);
const LEG = {L1: 1.3, L2: 1.6};
const HIPS = [-1.3, 0, 1.3].flatMap((z) => [[-1, z], [1, z]]);

function sheetGeometry() {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(M.nx * M.nz * 6 * 3), 3));
  return g;
}
function fillSheet(g, theta) {
  const P = vertices(theta);
  const a = g.attributes.position.array;
  let o = 0;
  const put = (p) => {
    a[o++] = p[0];
    a[o++] = p[1];
    a[o++] = p[2];
  };
  for (let j = 0; j < M.nz; j++) {
    for (let i = 0; i < M.nx; i++) {
      const p = P[j][i];
      const q = P[j][i + 1];
      const r = P[j + 1][i + 1];
      const s = P[j + 1][i];
      put(p), put(s), put(r), put(p), put(r), put(q);
    }
  }
  g.attributes.position.needsUpdate = true;
  g.computeVertexNormals();
  g.computeBoundingSphere();
}

function build(scene) {
  const mat = materials();
  mat.ice = new THREE.MeshStandardMaterial({color: '#d6e9f2', emissive: new THREE.Color('#9cc4d8'), emissiveIntensity: 0.18, roughness: 0.3, side: THREE.DoubleSide, flatShading: true});
  mat.floor = new THREE.MeshStandardMaterial({color: '#e3eef3', roughness: 0.35});
  mat.water = new THREE.MeshStandardMaterial({color: '#1d2a33', roughness: 0.15});
  // ice floor with a hole the size of the flat sheet; dark water below
  const shape = new THREE.Shape();
  shape.absarc(0, 0, 11, 0, Math.PI * 2);
  const hole = new THREE.Path();
  hole.moveTo(-FLAT.w / 2, -FLAT.d / 2);
  hole.lineTo(FLAT.w / 2, -FLAT.d / 2);
  hole.lineTo(FLAT.w / 2, FLAT.d / 2);
  hole.lineTo(-FLAT.w / 2, FLAT.d / 2);
  shape.holes.push(hole);
  const floor = new THREE.Mesh(new THREE.ShapeGeometry(shape, 48).rotateX(-Math.PI / 2), mat.floor);
  floor.position.y = 0.005;
  floor.receiveShadow = true;
  scene.add(floor);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(FLAT.w, FLAT.d).rotateX(-Math.PI / 2), mat.water);
  water.position.y = 0.003; // just under the ice floor, over the studio ground
  scene.add(water);
  const rig = new THREE.Group();
  scene.add(rig);
  const K = partsKit(rig, mat);
  const body = new THREE.Group();
  rig.add(body);
  K.mesh(new THREE.BoxGeometry(1.9, 0.7, 3.6), mat.flesh, body);
  K.mesh(new THREE.BoxGeometry(1.5, 0.12, 3.2).translate(0, 0.4, 0), mat.fleshDeep, body);
  // head: a housing at the front with two bone mandibles
  K.mesh(new THREE.BoxGeometry(1.0, 0.55, 0.6).translate(0, -0.05, 2.05), mat.fleshDeep, body);
  for (const s of [-1, 1]) K.mesh(new THREE.ConeGeometry(0.09, 0.9, 6).rotateX(Math.PI / 2).translate(s * 0.32, -0.2, 2.75), mat.bone, body);
  K.mesh(new THREE.SphereGeometry(0.09, 12, 8).translate(0, 0.08, 2.36), mat.accent, body);
  const sheetGeo = sheetGeometry();
  const sheet = new THREE.Mesh(sheetGeo, mat.ice);
  sheet.castShadow = true;
  sheet.receiveShadow = true;
  rig.add(sheet);
  const legs = HIPS.map(() => ({thigh: K.housing(0.11, 0.1, {stripe: false}), shin: K.housing(0.09, 0.08, {stripe: false, m: mat.bone}), hipD: K.drum(0.13, 0.18), kneeD: K.drum(0.11, 0.16)}));
  return {
    update(t) {
      const th = thetaAt(t);
      const k = standAt(t);
      fillSheet(sheetGeo, th);
      const h = -0.75 + 2.35 * k; // hull centre height
      const yaw = turnAt(t);
      rig.rotation.y = yaw;
      body.position.y = h;
      sheet.position.y = Math.max(0.01, h + 0.46);
      const knees = [];
      legs.forEach((L, n) => {
        const [sx, z] = HIPS[n];
        const hip = [sx * 0.95, h, z];
        const foot = [sx * (1.2 + 1.7 * k), -0.6 * (1 - k), z * (1 + 0.4 * k)];
        const knee = twoBone(hip, foot, LEG.L1, LEG.L2, [sx * 0.4, 1, 0]);
        const vis = k > 0.01;
        for (const p of [L.thigh, L.shin, L.hipD, L.kneeD]) p.visible = vis;
        if (!vis || !knee) return;
        knees.push(knee);
        K.place(L.thigh, hip, knee, [0, 0, 1]);
        K.place(L.shin, knee, foot, [0, 0, 1]);
        K.orient(L.hipD, hip, [0, 0, 1]);
        K.orient(L.kneeD, knee, [0, 0, 1]);
      });
      return {th, k, h, yaw, E: extent(th), C: cell(th)};
    },
  };
}

const BEATS = [
  {t: 0, mode: 'FROZEN', cap: 'TR-6 · A PATCH OF ICE · 100 RIGID PLATES IN A MIURA FOLD, LYING FLAT'},
  {t: 3.5, mode: 'THAWING', cap: 'ONE FOLD ANGLE DRAWS THE SHEET IN BOTH WAYS AND LIFTS IT · NO PLATE BENDS'},
  {t: 7.2, mode: 'RISING', cap: 'SIX LEGS SWING OUT OF THE WATER · THE FOLDED SHEET IS ITS BACK'},
  {t: 10, mode: 'BEHIND YOU', cap: 'IT TURNS ON WHAT WALKED PAST'},
];
const CAM = [
  [0, [0, 0, 0, 30, 46, 17]],
  [3.4, [0, 0, 0, 50, 42, 15]],
  [7, [0, 0.4, 0, 70, 30, 13]],
  [10, [0, 1.2, 0, 110, 16, 13]],
  [15, [0, 1.2, -1.5, 150, 14, 14]],
];

export function run() {
  runSim({duration: DURATION, fps: 60, theme: 'light', hud: {enabled: false}, director: {enabled: false}, watermark: ''}, ({canvas, capture}) => {
    const st = studio(canvas, {capture, shadow: 10, fog: [40, 120]});
    const tr = build(st.scene);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.35, 1.8, 20).translate(0, 0.9, 0), new THREE.MeshStandardMaterial({color: '#cfc6b6', roughness: 0.8}));
    post.castShadow = true;
    st.scene.add(post);
    const ui = consoleUI(document.getElementById('app'), {code: 'TR-6', eyebrow: 'TREACHERY · FROZEN IN THE ICE, THAWS BEHIND YOU', title: 'Rime TR-6'});
    return {
      resize: st.resize,
      render(t) {
        const S = tr.update(t);
        post.position.set(3.6, 0, postZ(t));
        const [x, y, z, az, el, dist] = keyed(CAM, t, sm);
        st.aim([x, y, z], az, el, dist);
        st.render();
        const bi = BEATS.reduce((k, b, i) => (t >= b.t ? i : k), 0);
        ui.set({
          cap: BEATS[bi].cap,
          n: bi + 1,
          mode: BEATS[bi].mode,
          right: `θ ${((S.th * 180) / Math.PI).toFixed(0)}°`,
          rows: [
            ['PLATES', `${M.nx * M.nz}`],
            ['SECTOR γ', `${((M.gamma * 180) / Math.PI).toFixed(0)}°`],
            ['FOOTPRINT', `${S.E.w.toFixed(2)} × ${S.E.d.toFixed(2)} m`],
            ['RIDGE H', `${S.C.H.toFixed(2)} m`],
            ['HULL', `${S.h.toFixed(2)} m`],
          ],
          barsTitle: 'FOLD',
          bars: [['θ', S.th / TH1], ['STAND', S.k]],
          subs: [
            ['Miura sheet', S.th > 0.1 ? 'FOLDING' : 'FLAT', bi === 1],
            ['Legs ×6', S.k > 0.95 ? 'STANDING' : S.k > 0 ? 'RISING' : 'FOLDED', bi === 2],
            ['Head', bi === 3 ? 'TURNING' : 'DOWN', bi === 3],
          ],
        });
        return {};
      },
    };
  });
}
