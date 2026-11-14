// THE VOID study: geometry and film. The stepped dish (three flat tiers, the sphere's own panels as the risers between
// them), three tall towers, the triangular platform (Belphegor) on its main cables, the azimuth arm and dome under it,
// the feed beam to the floor, and in phase 2 the tie-downs reeling every other outer platform up into a ramp while the
// centre disc splits and the platform sinks. Film, 24 s. render(t) is pure.
import * as THREE from 'three';
import {runSim} from '../kit/runtime.js';
import {keyed} from '../kit/util.js';
import {partsKit} from '../slumber-kit/parts.js';
import {consoleUI, materials, studio} from '../slumber-kit/studio.js';
import {A, corner, DECK_HIGH, DECK_LOW, dome, FOCUS_Y, outer, RAMP_MAX, rAt, sag, TAU, tieCorner, TIERS, tower} from './kin.js';

export const DURATION = 24;
const sm = (u) => {
  const x = Math.min(1, Math.max(0, u));
  return x * x * x * (x * (x * 6 - 15) + 10);
};
const HANG = 3; // the arm's lowest point hangs this far under the deck
const DECK_FOCUS = FOCUS_Y + HANG;
const deckAt = (t) => DECK_HIGH + (DECK_FOCUS - DECK_HIGH) * sm((t - 4) / 5) + (DECK_LOW - DECK_FOCUS) * sm((t - 18) / 4);
const phiAt = (t) => TAU * 0.16 * Math.max(0, t - 9);
const zetaAt = (t) => (t < 9 ? 0 : A.zMax * Math.sin((t - 9) * 1.1) * sm((t - 9) / 1.2));
const splitAt = (t) => 4 * sm((t - 15) / 2);
const rampAt = (t) => RAMP_MAX * sm((t - 16) / 4);
const tieAt = (t) => sm((t - 15) / 1);
const STAGES = [
  {t: 0, s: 'RUN', cap: 'THE VOID · A SPHERICAL DISH, STEPPED: ITS RISE GIVES THE 4 M AND 8 M TIERS'},
  {t: 4, s: 'ARRIVAL', cap: 'BELPHEGOR IS THE PLATFORM · IT LOWERS ON ITS CABLES TO THE FOCUS, HALF THE RADIUS UP'},
  {t: 9, s: 'PHASE 1', cap: 'THE ARM TURNS, THE DOME RIDES IT TO 20° · THE BEAM CROSSES THE SPHERE CENTRE AND STAYS ON THE FLOOR TIER'},
  {t: 15, s: 'PHASE 2', cap: 'SIX TIE-DOWNS REEL IN: EVERY OTHER OUTER PLATFORM RISES INTO A RAMP · THE CENTRE SPLITS, IT SINKS'},
];

function annulus(r0, r1, a0, a1, h, th = 0.5) {
  const s = new THREE.Shape();
  s.absarc(0, 0, r1, a0, a1, false);
  s.absarc(0, 0, r0, a1, a0, true);
  return new THREE.ExtrudeGeometry(s, {depth: th, bevelEnabled: false, curveSegments: 24}).rotateX(Math.PI / 2).translate(0, h, 0);
}
function cable(mat, parent) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1, 6), mat);
  parent.add(m);
  return m;
}
const UP = new THREE.Vector3(0, 1, 0);
function span(m, a, b) {
  const va = new THREE.Vector3(...a);
  const vb = new THREE.Vector3(...b);
  const d = vb.clone().sub(va);
  m.position.copy(va).addScaledVector(d, 0.5);
  m.scale.set(1, d.length(), 1);
  m.quaternion.setFromUnitVectors(UP, d.normalize());
}

function build(scene) {
  const mat = materials();
  mat.panel = new THREE.MeshStandardMaterial({color: '#8d8a86', roughness: 0.55, metalness: 0.3, side: THREE.DoubleSide});
  mat.tier = new THREE.MeshStandardMaterial({color: '#c9c2b6', roughness: 0.8});
  mat.cable = new THREE.MeshStandardMaterial({color: '#2b2a2c', roughness: 0.6});
  mat.beam = new THREE.MeshBasicMaterial({color: '#b9a8ff', transparent: true, opacity: 0.35, depthWrite: false});
  const root = new THREE.Group();
  scene.add(root);
  const K = partsKit(root, mat);
  // the dish's own panels: the risers between the tiers, each running from one tier's edge up the bowl to the next
  for (let k = 0; k < 2; k++) {
    const a = TIERS[k];
    const b = TIERS[k + 1];
    const prof = [new THREE.Vector2(a.rOut, a.h), new THREE.Vector2(a.rOut, a.h + 0.2)];
    for (let j = 0; j <= 8; j++) {
      const r = a.rOut + ((b.rIn - a.rOut) * j) / 8;
      prof.push(new THREE.Vector2(r, Math.max(a.h + 0.2, Math.min(b.h, sag(r)))));
    }
    prof.push(new THREE.Vector2(b.rIn, b.h - 0.5));
    K.mesh(new THREE.LatheGeometry(prof, 72), mat.panel, root);
  }
  // floor tier: the centre disc in two halves (they slide apart along x)
  const halves = [-1, 1].map((s) => {
    const g = K.mesh(annulus(0, TIERS[0].rOut, s > 0 ? -Math.PI / 2 : Math.PI / 2, s > 0 ? Math.PI / 2 : (3 * Math.PI) / 2, TIERS[0].h + 0.01), mat.tier, root);
    return {g, s};
  });
  // middle ring: eight segments
  for (let k = 0; k < A.midN; k++) {
    const a0 = (k / A.midN) * TAU + 0.03;
    K.mesh(annulus(TIERS[1].rIn, TIERS[1].rOut, a0, a0 + TAU / A.midN - 0.06, TIERS[1].h), mat.tier, root);
  }
  // outer ring: twelve platforms with dash gaps; the hooked ones pivot on their outer edge
  const outers = [];
  for (let k = 0; k < A.outerN; k++) {
    const half = TAU / A.outerN / 2 - 0.05;
    const L = TIERS[2].rOut - TIERS[2].rIn;
    const pivot = new THREE.Group();
    root.add(pivot);
    const geo = annulus(TIERS[2].rIn, TIERS[2].rOut, -half, half, 0).translate(-TIERS[2].rOut, 0, 0);
    K.mesh(geo, A.hooked.includes(k) ? mat.fleshDeep : mat.tier, pivot);
    outers.push({k, pivot, L, hooked: A.hooked.includes(k)});
  }
  // towers and their main cables
  const towers = [0, 1, 2].map((k) => {
    const p = tower(k);
    K.mesh(new THREE.BoxGeometry(2.2, p[1], 2.2).translate(p[0], p[1] / 2, p[2]), mat.dark, root);
    const back = [p[0] * 1.35, 0, p[2] * 1.35];
    span(cable(mat.cable, root), p, back); // backstay
    return {p, main: [cable(mat.cable, root), cable(mat.cable, root)]};
  });
  // the platform (Belphegor): a triangular truss deck, the azimuth arm under it, the dome on the arm
  const deck = new THREE.Group();
  root.add(deck);
  const r = A.side / Math.sqrt(3);
  const tri = new THREE.Shape();
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * TAU + Math.PI / 2;
    const x = r * Math.cos(a);
    const z = r * Math.sin(a);
    if (k === 0) tri.moveTo(x, -z);
    else tri.lineTo(x, -z);
  }
  K.mesh(new THREE.ExtrudeGeometry(tri, {depth: 1.6, bevelEnabled: false}).rotateX(-Math.PI / 2), mat.flesh, deck);
  for (let k = 0; k < 3; k++) {
    const c0 = corner(k, 0);
    const c1 = corner((k + 1) % 3, 0);
    const beam = K.mesh(new THREE.BoxGeometry(0.6, 0.6, 1), mat.fleshDeep, deck);
    span(beam, [c0[0], 1.9, c0[2]], [c1[0], 1.9, c1[2]]);
    beam.scale.set(1, 1, 1);
    const len = Math.hypot(c1[0] - c0[0], c1[2] - c0[2]);
    beam.geometry = new THREE.BoxGeometry(0.6, len, 0.6);
  }
  const armG = new THREE.Group();
  root.add(armG);
  const armR = A.Rs * A.armR;
  const arc = [];
  for (let k = -12; k <= 12; k++) {
    const z = (k / 12) * (A.zMax + 0.08);
    arc.push(new THREE.Vector3(Math.sin(z) * armR, -Math.cos(z) * armR, 0));
  }
  K.mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(arc), 48, 0.35, 8), mat.steel, armG);
  const domeM = K.mesh(new THREE.SphereGeometry(1.3, 20, 14), mat.bone, root);
  const beamM = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 1.6, 1, 20, 1, true), mat.beam);
  scene.add(beamM);
  const spot = new THREE.Mesh(new THREE.CircleGeometry(1.6, 28).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({color: '#8f7cff', transparent: true, opacity: 0.6}));
  scene.add(spot);
  const ties = A.hooked.map((k) => ({k, m: cable(mat.accent, root)}));
  return {
    update(t) {
      const y = deckAt(t);
      const yArm = y - HANG;
      const phi = phiAt(t);
      const zeta = zetaAt(t);
      deck.position.y = y;
      for (const T of towers) {
        const k = towers.indexOf(T);
        span(T.main[0], T.p, corner(k, y + 1.6));
        span(T.main[1], T.p, corner((k + 1) % 3, y + 1.6));
      }
      armG.position.set(0, A.Rs + (yArm - FOCUS_Y), 0);
      armG.rotation.y = -phi;
      const D = dome(phi, zeta, yArm);
      domeM.position.set(...D.p);
      // the beam: from the dome along u to the tier it lands on (the floor tier in phase 1)
      const sp = (() => {
        const tt = (TIERS[0].h - D.p[1]) / D.u[1];
        return [D.p[0] + D.u[0] * tt, TIERS[0].h + 0.03, D.p[2] + D.u[2] * tt];
      })();
      span(beamM, D.p, sp);
      beamM.visible = t >= 9;
      spot.visible = t >= 9;
      spot.position.set(...sp);
      const sx = splitAt(t);
      for (const h of halves) h.g.position.x = h.s * sx;
      const al = rampAt(t);
      for (const o of outers) {
        const O = outer(o.k, o.hooked ? al : 0);
        o.pivot.position.set(...O.hinge);
        o.pivot.rotation.set(0, -O.a, o.hooked ? -al : 0, 'YXZ');
      }
      const tk = tieAt(t);
      for (const T of ties) {
        T.m.visible = tk > 0.01;
        const e = outer(T.k, al).edge;
        span(T.m, corner(tieCorner(T.k), y), e);
      }
      return {y, phi, zeta, sp, sx, al};
    },
  };
}

const CAM = [
  [0, [0, 6, 0, 30, 28, 105]],
  [3.8, [0, 10, 0, 50, 22, 110]],
  [8.6, [0, 14, 0, 70, 18, 95]],
  [9.4, [0, 8, 0, 85, 34, 70]],
  [14.6, [0, 8, 0, 130, 34, 70]],
  [15.4, [0, 9, 0, 150, 16, 78]],
  [24, [0, 9, 0, 205, 14, 80]],
];

export function run() {
  runSim({duration: DURATION, fps: 60, theme: 'light', hud: {enabled: false}, director: {enabled: false}, watermark: ''}, ({canvas, capture}) => {
    const st = studio(canvas, {capture, shadow: 60, fog: [160, 420]});
    st.camera.far = 2000;
    st.camera.updateProjectionMatrix();
    const v = build(st.scene);
    const ui = consoleUI(document.getElementById('app'), {code: 'VD-2', eyebrow: 'STAGE STUDY · LAYER 2 · SLOTH · AFTER THE ARECIBO TELESCOPE', title: 'The Void'});
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
          right: `DECK ${S.y.toFixed(1)} m`,
          rows: [
            ['DISH R', `${A.Rs.toFixed(1)} m (265 m real)`],
            ['TIERS', `0 · 4 · 8 m at r ${TIERS[1].rIn.toFixed(1)}, ${TIERS[2].rIn.toFixed(1)}`],
            ['FOCUS', `${FOCUS_Y.toFixed(1)} m`],
            ['ARM φ', `${Math.round(((S.phi * 180) / Math.PI) % 360)}°`],
            ['DOME ζ', `${((S.zeta * 180) / Math.PI).toFixed(1)}°`],
            ['RAMPS', `${((S.al * 180) / Math.PI).toFixed(1)}° / ${((RAMP_MAX * 180) / Math.PI).toFixed(1)}°`],
          ],
          barsTitle: 'STAGE',
          bars: [['LOWER', 1 - (S.y - DECK_LOW) / (DECK_HIGH - DECK_LOW)], ['SPLIT', S.sx / 4], ['RAMPS', S.al / RAMP_MAX]],
          subs: [
            ['Dish · tiers', 'STEPPED', bi === 0],
            ['Platform · Belphegor', bi === 0 ? 'IN THE DARK' : bi === 1 ? 'LOWERING' : bi === 2 ? 'AT FOCUS' : 'SINKING', bi === 1],
            ['Arm · dome · beam', t >= 9 ? 'SWEEPING' : 'PARKED', bi === 2],
            ['Tie-downs ×6', t >= 15 ? 'REELING' : 'SLACK', bi === 3],
          ],
        });
        return {};
      },
    };
  });
}
