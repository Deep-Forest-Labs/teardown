// THE RUINS study: geometry and film. Courtyard, four granite pillars, the gallery ring of slabs on posts; north, the
// castello (a timber tower of four posts, braced, with a head beam of sheaves) round Belial's obelisk; eight capstans
// at its foot; ropes from the head to the obelisk and to each pillar top. Film, 26 s: the raise, the pillars lowered
// outward onto the gallery edge, the rig hauled up the causeway and rolled round the gallery on rollers, slabs
// dropping behind it. render(t) is pure.
import * as THREE from 'three';
import {runSim} from '../kit/runtime.js';
import {keyed} from '../kit/util.js';
import {partsKit} from '../slumber-kit/parts.js';
import {consoleUI, materials, studio} from '../slumber-kit/studio.js';
import {belialTop, CAUSEWAY, pillar, pillarTop, R, REST, rigAt, rollers, slabAng, TAU} from './kin.js';

export const DURATION = 26;
const sm = (u) => {
  const x = Math.min(1, Math.max(0, u));
  return x * x * x * (x * (x * 6 - 15) + 10);
};
const raiseAt = (t) => (Math.PI / 2) * sm((t - 4) / 6);
const fallAt = (k, t) => REST * sm((t - 10 - 1.5 * k) / 2.4);
const U_END = CAUSEWAY + 0.45 * TAU * R.galMid;
const uAt = (t) => U_END * sm((t - 17) / 9);
const STEP = TAU / R.slabs;
const UP = new THREE.Vector3(0, 1, 0);
function span(m, a, b) {
  const va = new THREE.Vector3(...a);
  const d = new THREE.Vector3(...b).sub(va);
  m.position.copy(va).addScaledVector(d, 0.5);
  m.scale.set(1, d.length(), 1);
  m.quaternion.setFromUnitVectors(UP, d.normalize());
}
function annulus(r0, r1, a0, a1, th) {
  const s = new THREE.Shape();
  s.absarc(0, 0, r1, a0, a1, false);
  s.absarc(0, 0, r0, a1, a0, true);
  return new THREE.ExtrudeGeometry(s, {depth: th, bevelEnabled: false, curveSegments: 10}).rotateX(Math.PI / 2);
}
function obelisk(K, mat, parent, L, w) {
  K.mesh(new THREE.BoxGeometry(w, L * 0.9, w).translate(0, L * 0.45, 0), mat, parent);
  K.mesh(new THREE.ConeGeometry(w * 0.72, L * 0.1, 4).rotateY(Math.PI / 4).translate(0, L * 0.95, 0), mat, parent);
}

function build(scene) {
  const mat = materials();
  mat.granite = new THREE.MeshStandardMaterial({color: '#a9796a', roughness: 0.75});
  mat.stone = new THREE.MeshStandardMaterial({color: '#cfc4b2', roughness: 0.85});
  mat.timber = new THREE.MeshStandardMaterial({color: '#7a5a3f', roughness: 0.9});
  mat.rope = new THREE.MeshStandardMaterial({color: '#4a3a2c', roughness: 0.95});
  mat.crypt = new THREE.MeshStandardMaterial({color: '#2a2422', roughness: 1});
  const root = new THREE.Group();
  scene.add(root);
  const K = partsKit(root, mat);
  K.mesh(new THREE.RingGeometry(R.galIn - 0.5, R.galOut + 0.5, 72).rotateX(-Math.PI / 2).translate(0, 0.02, 0), mat.crypt, root);
  // cracked slam tiles
  for (let i = -2; i < 2; i++) for (let j = -2; j < 2; j++) K.mesh(new THREE.BoxGeometry(1.9, 0.12, 1.9).translate(i * 2 + 1, 0.06, j * 2 + 1), (i + j) % 2 ? mat.stone : mat.fleshDeep, root);
  // gallery: slabs on posts
  const slabs = [];
  for (let k = 0; k < R.slabs; k++) {
    const a = slabAng(k);
    const g = new THREE.Group();
    root.add(g);
    K.mesh(annulus(R.galIn, R.galOut, a - STEP / 2 + 0.01, a + STEP / 2 - 0.01, 0.5).translate(0, R.galH, 0), mat.stone, g);
    for (const r of [R.galIn + 0.7, R.galOut - 0.7]) K.mesh(new THREE.BoxGeometry(0.6, R.galH - 0.5, 0.6).translate(r * Math.cos(a), (R.galH - 0.5) / 2, r * Math.sin(a)), mat.stone, root);
    slabs.push({g, a});
  }
  // pillars: pivot on the outer edge of the footing
  const pillars = [0, 1, 2, 3].map((k) => {
    const P = pillar(k);
    const yaw = new THREE.Group();
    yaw.position.set(...P.base);
    yaw.rotation.y = -P.a;
    root.add(yaw);
    const tilt = new THREE.Group();
    yaw.add(tilt);
    const body = new THREE.Group();
    body.position.x = -R.pillarW / 2;
    tilt.add(body);
    obelisk(K, mat.granite, body, R.pillarL, R.pillarW);
    K.mesh(new THREE.BoxGeometry(R.pillarW + 0.8, 0.6, R.pillarW + 0.8).translate(-R.pillarW / 2, 0.3, 0), mat.stone, yaw);
    return {k, tilt, rope: K.mesh(new THREE.CylinderGeometry(0.06, 0.06, 1, 5), mat.rope, root)};
  });
  // the earth causeway Fontana built for the move: from Belial's pit up to the gallery
  {
    const L = Math.hypot(CAUSEWAY, R.galH);
    const cw = K.mesh(new THREE.BoxGeometry(2 * R.castelloHalf + 2, 0.6, L + 2), mat.stone, root);
    cw.position.set(0, R.galH / 2 - 0.3, -(R.belialR + R.galMid) / 2);
    cw.rotation.x = Math.atan2(R.galH, CAUSEWAY);
  }
  // the rig: sledge, rollers, castello, capstans, Belial
  const rig = new THREE.Group();
  root.add(rig);
  const Kr = partsKit(rig, mat);
  const H = R.castelloH;
  const c = R.castelloHalf;
  for (const [x, z] of [[-c, -c], [c, -c], [-c, c], [c, c]]) Kr.mesh(new THREE.BoxGeometry(0.45, H, 0.45).translate(x, H / 2 + 0.9, z), mat.timber, rig);
  for (let y = 4; y < H; y += 4.2) {
    for (const s of [-1, 1]) {
      Kr.mesh(new THREE.BoxGeometry(2 * c, 0.25, 0.25).translate(0, y + 0.9, s * c), mat.timber, rig);
      Kr.mesh(new THREE.BoxGeometry(0.25, 0.25, 2 * c).translate(s * c, y + 0.9, 0), mat.timber, rig);
    }
  }
  Kr.mesh(new THREE.BoxGeometry(2 * c + 1, 0.6, 0.8).translate(0, H + 1.2, 0), mat.timber, rig);
  Kr.mesh(new THREE.BoxGeometry(2 * c + 1.2, 0.35, 6).translate(0, 0.75, 0), mat.timber, rig); // sledge
  const rolls = Array.from({length: R.rollerN}, () => Kr.mesh(new THREE.CylinderGeometry(R.rollerR, R.rollerR, 2 * c + 0.6, 12).rotateZ(Math.PI / 2), mat.timber, rig));
  const caps = Array.from({length: 4}, (_, i) => {
    const a = (i / 4) * TAU + TAU / 8;
    const g = new THREE.Group();
    g.position.set(Math.cos(a) * (c + 1.6), 1.6, Math.sin(a) * (c + 1.6));
    rig.add(g);
    Kr.mesh(new THREE.CylinderGeometry(0.4, 0.4, 1.2, 12), mat.timber, g);
    Kr.mesh(new THREE.BoxGeometry(2.6, 0.12, 0.12).translate(0, 0.4, 0), mat.timber, g);
    Kr.mesh(new THREE.BoxGeometry(0.12, 0.12, 2.6).translate(0, 0.4, 0), mat.timber, g);
    return g;
  });
  const bel = new THREE.Group();
  bel.position.y = 0.95;
  rig.add(bel);
  obelisk(Kr, mat.flesh, bel, R.belialL, 1.5);
  const face = Kr.mesh(new THREE.SphereGeometry(0.35, 14, 10).translate(0, R.belialL * 0.9, 0.78), mat.accent, bel);
  const belRope = K.mesh(new THREE.CylinderGeometry(0.07, 0.07, 1, 5), mat.rope, root);
  return {
    update(t) {
      const u = uAt(t);
      const g = rigAt(u);
      rig.position.set(...g.p);
      const ahead = rigAt(u + 0.05);
      rig.rotation.y = Math.atan2(ahead.p[0] - g.p[0], ahead.p[2] - g.p[2]) || 0;
      const th = raiseAt(t);
      bel.rotation.x = -(Math.PI / 2 - th);
      for (const [i, r] of rollers(u).entries()) {
        rolls[i].position.set(0, R.rollerR, r.rel);
        rolls[i].rotation.x = r.spin;
      }
      caps.forEach((cp, i) => (cp.rotation.y = (i % 2 ? -1 : 1) * (th * 3 + t * 0.2 * (t > 10 && t < 17 ? 4 : 0) + u * 0.3)));
      rig.updateMatrixWorld();
      const head = new THREE.Vector3(0, H + 1.2, 0).applyMatrix4(rig.matrixWorld).toArray();
      const btop = new THREE.Vector3(0, R.belialL * 0.92, 0).applyMatrix4(bel.matrixWorld).toArray();
      span(belRope, head, btop);
      belRope.visible = t < 10.5;
      for (const p of pillars) {
        const f = fallAt(p.k, t);
        p.tilt.rotation.z = -f;
        span(p.rope, head, pillarTop(p.k, f));
        p.rope.visible = t >= 10 && t < 17.5;
      }
      // slabs drop once the rig is two and a half slabs past them
      const travelled = u > CAUSEWAY ? (u - CAUSEWAY) / R.galMid : 0;
      for (const s of slabs) {
        const behind = (((-Math.PI / 2 + travelled - s.a) % TAU) + TAU) % TAU;
        const f = travelled > behind ? sm((behind - 2.5 * STEP) / STEP) : 0;
        s.g.position.y = -(R.galH - 0.2) * f;
        s.g.rotation.z = 0.15 * f;
      }
      face.material.emissiveIntensity = t > 17 ? 1 : 0.3;
      return {th, u, g, fall: fallAt(3, t)};
    },
  };
}

const STAGES = [
  {t: 0, s: 'RUN', cap: 'THE RUINS · A COURTYARD, FOUR GRANITE PILLARS, A GALLERY RING · NORTH, A TIMBER TOWER OVER A FALLEN OBELISK'},
  {t: 4, s: 'ARRIVAL', cap: 'BELIAL IS THE OBELISK · CAPSTANS HAUL IT UP INSIDE THE CASTELLO, FONTANA 1586'},
  {t: 10, s: 'PHASE 1', cap: 'EACH PILLAR IS LOWERED OUTWARD ON ITS ROPE UNTIL IT RESTS ON THE GALLERY EDGE: A 34° RAMP'},
  {t: 17, s: 'PHASE 2', cap: 'THE RIG IS HAULED UP THE CAUSEWAY AND ROLLED ROUND THE GALLERY · ROLLERS RUN AT HALF ITS SPEED'},
];
const CAM = [
  [0, [0, 5, -6, 20, 30, 78]],
  [3.8, [0, 8, -12, 40, 22, 66]],
  [9.6, [0, 10, -22, 75, 14, 52]],
  [10.4, [0, 4, 0, 30, 40, 70]],
  [16.6, [0, 4, 0, 330, 34, 72]],
];

export function run() {
  runSim({duration: DURATION, fps: 60, theme: 'light', hud: {enabled: false}, director: {enabled: false}, watermark: ''}, ({canvas, capture}) => {
    const st = studio(canvas, {capture, shadow: 40, fog: [120, 320]});
    st.camera.far = 1500;
    st.camera.updateProjectionMatrix();
    const v = build(st.scene);
    const ui = consoleUI(document.getElementById('app'), {code: 'RU-3', eyebrow: 'STAGE STUDY · LAYER 3 · PRIDE · AFTER FONTANA’S OBELISK', title: 'The Ruins'});
    return {
      resize: st.resize,
      render(t) {
        const S = v.update(t);
        if (t < 17) {
          const [x, y, z, az, el, dist] = keyed(CAM, t, sm);
          st.aim([x, y, z], az, el, dist);
        } else {
          const k = sm((t - 17) / 1.2);
          st.aim([S.g.p[0] * k, 6 + 4 * k, S.g.p[2] * k + (1 - k) * 0], 330 - 30 * k + (t - 17) * 8, 34 - 10 * k, 72 - 22 * k);
        }
        st.render();
        const bi = STAGES.reduce((k, b, i) => (t >= b.t ? i : k), 0);
        ui.set({
          cap: STAGES[bi].cap,
          n: bi + 1,
          mode: STAGES[bi].s,
          right: `${S.g.onGallery ? 'ON THE GALLERY' : 'NORTH'}`,
          rows: [
            ['OBELISK', `${R.belialL.toFixed(1)} m (25.3 m real)`],
            ['RAISE', `${((S.th * 180) / Math.PI).toFixed(0)}°`],
            ['PILLAR', `${((S.fall * 180) / Math.PI).toFixed(1)}° / ${((REST * 180) / Math.PI).toFixed(1)}°`],
            ['RIG', `${S.u.toFixed(1)} m`],
            ['ROLLERS', `${(S.u / 2).toFixed(1)} m`],
          ],
          barsTitle: 'STAGE',
          bars: [['RAISE', S.th / (Math.PI / 2)], ['LOWER', S.fall / REST], ['ROLL', S.u / U_END]],
          subs: [
            ['Castello · capstans', bi === 1 ? 'HAULING' : bi === 2 ? 'PAYING OUT' : 'HELD', bi === 1 || bi === 2],
            ['Pillars ×4', S.fall > 0.01 ? 'LOWERED' : 'STANDING', bi === 2],
            ['Rollers · slabs', bi === 3 ? 'ROLLING' : '-', bi === 3],
          ],
        });
        return {};
      },
    };
  });
}
