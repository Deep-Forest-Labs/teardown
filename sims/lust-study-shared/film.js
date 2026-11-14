// LUST study: geometry and film. A storm terrace ringed by eight updraft columns; a spire carrying the bloom (a cup at
// 14 m) and a mast above it with the six cylinder bases; six wedge petals hinged on the cup's rim, each on its own
// cylinder (barrel and rod drawn); Lilith on the central ram. Every petal is driven by its cylinder length and its
// angle comes from the law-of-cosines solve. Film, 24 s. render(t) is pure.
import * as THREE from 'three';
import {runSim} from '../kit/runtime.js';
import {keyed} from '../kit/util.js';
import {partsKit} from '../slumber-kit/parts.js';
import {consoleUI, materials, studio} from '../slumber-kit/studio.js';
import {cylLen, L, LEN, petalPt, phiFor, STAIR, STAIR_LEN, TAU} from './kin.js';

export const DURATION = 24;
const sm = (u) => {
  const x = Math.min(1, Math.max(0, u));
  return x * x * x * (x * (x * 6 - 15) + 10);
};
const lenAt = (k, t) => {
  const open = LEN.shut + (LEN.open - LEN.shut) * sm((t - 4) / 5);
  return open + (STAIR_LEN[k] - LEN.open) * sm((t - 15 - 0.7 * k) / 3);
};
const lilithAt = (t) => sm((t - 7) / 3);
const UP = new THREE.Vector3(0, 1, 0);
function span(m, a, b) {
  const va = new THREE.Vector3(...a);
  const d = new THREE.Vector3(...b).sub(va);
  m.position.copy(va).addScaledVector(d, 0.5);
  m.scale.set(1, d.length(), 1);
  m.quaternion.setFromUnitVectors(UP, d.normalize());
}

function build(scene) {
  const mat = materials();
  mat.updraft = new THREE.MeshStandardMaterial({color: '#b9d4e6', transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide});
  mat.terrace = new THREE.MeshStandardMaterial({color: '#bfb6c4', roughness: 0.8});
  const root = new THREE.Group();
  scene.add(root);
  const K = partsKit(root, mat);
  K.mesh(new THREE.CylinderGeometry(40, 40, 0.6, 64).translate(0, -0.3, 0), mat.terrace, root);
  // spire, cup, mast
  K.mesh(new THREE.CylinderGeometry(1.4, 2.4, L.Hb, 20).translate(0, L.Hb / 2, 0), mat.fleshDeep, root);
  K.mesh(new THREE.CylinderGeometry(L.rb + 0.2, 1.6, 1.4, 24, 1, true).translate(0, L.Hb - 0.4, 0), mat.flesh, root).material.side = THREE.DoubleSide;
  K.mesh(new THREE.CylinderGeometry(0.35, 0.5, L.cylBase[1] - L.Hb + 1.2, 10).translate(0, (L.cylBase[1] + L.Hb) / 2 + 0.6, 0), mat.steel, root);
  K.mesh(new THREE.TorusGeometry(L.cylBase[0], 0.18, 8, 24).rotateX(Math.PI / 2).translate(0, L.cylBase[1], 0), mat.steel, root);
  // petals
  const half = Math.tan(Math.PI / L.n) * 0.94;
  // a petal: widens like its 60° wedge to mid-length, then tapers to 40 % at the tip, so the shut bud closes
  const shape = new THREE.Shape();
  const w = (x) => (L.rb + Math.min(x, L.Lp * 0.5)) * half * (x <= L.Lp * 0.5 ? 1 : 1 - 0.6 * ((x - L.Lp * 0.5) / (L.Lp * 0.5)) ** 1.5);
  const N = 14;
  shape.moveTo(0, -w(0));
  for (let i = 1; i <= N; i++) shape.lineTo((i / N) * L.Lp, -w((i / N) * L.Lp));
  shape.quadraticCurveTo(L.Lp + 1.2, 0, L.Lp, w(L.Lp));
  for (let i = N - 1; i >= 0; i--) shape.lineTo((i / N) * L.Lp, w((i / N) * L.Lp));
  shape.closePath();
  const petalGeo = new THREE.ExtrudeGeometry(shape, {depth: 0.4, bevelEnabled: false}).rotateX(Math.PI / 2).translate(0, 0.2, 0);
  const petals = Array.from({length: L.n}, (_, k) => {
    const a = (k / L.n) * TAU;
    const yaw = new THREE.Group();
    yaw.position.set(L.rb * Math.cos(a), L.Hb, L.rb * Math.sin(a));
    yaw.rotation.y = -a;
    root.add(yaw);
    const pitch = new THREE.Group();
    yaw.add(pitch);
    K.mesh(petalGeo, mat.flesh, pitch);
    K.mesh(new THREE.BoxGeometry(L.Lp, 0.25, 0.6).translate(L.Lp / 2, 0.45, 0), mat.fleshDeep, pitch); // the rib
    const barrel = K.mesh(new THREE.CylinderGeometry(0.28, 0.28, 1, 10), mat.steel, root);
    const rod = K.mesh(new THREE.CylinderGeometry(0.12, 0.12, 1, 8), mat.accent, root);
    return {a, pitch, barrel, rod};
  });
  // Lilith on the ram
  const lil = new THREE.Group();
  root.add(lil);
  K.mesh(new THREE.LatheGeometry([[0, 0], [0.9, 0.2], [0.7, 2.4], [0.45, 3.2], [0.55, 3.6], [0, 3.8]].map(([r, y]) => new THREE.Vector2(r, y)), 20), mat.flesh, lil);
  K.mesh(new THREE.SphereGeometry(0.45, 16, 12).translate(0, 4.2, 0), mat.fleshDeep, lil);
  const ram = K.mesh(new THREE.CylinderGeometry(0.3, 0.3, 1, 10), mat.steel, root);
  // updrafts
  const drafts = Array.from({length: L.updrafts}, (_, i) => {
    const a = (i / L.updrafts) * TAU + Math.PI / L.updrafts;
    const g = new THREE.Group();
    g.position.set(L.updraftR * Math.cos(a), 0, L.updraftR * Math.sin(a));
    root.add(g);
    K.mesh(new THREE.CylinderGeometry(2.4, 2.4, 30, 20, 1, true).translate(0, 15, 0), mat.updraft, g);
    K.mesh(new THREE.CylinderGeometry(2.8, 2.8, 0.6, 20), mat.dark, g);
    const fan = new THREE.Group();
    fan.position.y = 0.5;
    g.add(fan);
    for (let b = 0; b < 4; b++) K.mesh(new THREE.BoxGeometry(4.4, 0.1, 0.6).rotateY((b / 4) * Math.PI), mat.steel, fan);
    return fan;
  });
  return {
    update(t) {
      const out = [];
      petals.forEach((p, k) => {
        const len = lenAt(k, t);
        const phi = phiFor(len);
        p.pitch.rotation.z = phi;
        const end2 = petalPt(phi, L.rodE);
        const base = [L.cylBase[0] * Math.cos(p.a), L.cylBase[1], L.cylBase[0] * Math.sin(p.a)];
        const end = [end2[0] * Math.cos(p.a), end2[1], end2[0] * Math.sin(p.a)];
        const d = [end[0] - base[0], end[1] - base[1], end[2] - base[2]];
        const dl = Math.hypot(...d);
        const bl = Math.min(dl - 0.3, LEN.shut * 0.95);
        const mid = base.map((v, i) => v + (d[i] / dl) * bl);
        span(p.barrel, base, mid);
        span(p.rod, mid.map((v, i) => v - (d[i] / dl) * 0.2), end);
        out.push({len, phi});
      });
      const ly = L.Hb - 5 + 6 * lilithAt(t);
      lil.position.y = ly;
      span(ram, [0, L.Hb - 6, 0], [0, ly + 0.01, 0]);
      drafts.forEach((f, i) => (f.rotation.y = t * 9 * (i % 2 ? 1 : -1)));
      return out;
    },
  };
}

const STAGES = [
  {t: 0, s: 'RUN', cap: 'LUST · A STORM TERRACE, EIGHT UPDRAFTS · AT THE CENTRE A SHUT BUD ON A SPIRE'},
  {t: 4, s: 'ARRIVAL', cap: 'SIX CYLINDERS EXTEND TOGETHER · THE PETALS SWING LEVEL INTO HIGH PLATFORMS · LILITH RISES ON THE RAM'},
  {t: 10, s: 'PHASE 1', cap: 'EACH PETAL IS A RIGID BLADE ON ONE HINGE · ITS CYLINDER SETS THE ANGLE (LAW OF COSINES), AFTER CALATRAVA'},
  {t: 15, s: 'PHASE 2', cap: 'SIX DIFFERENT CYLINDER LENGTHS: THE PETALS DROOP SO THEIR TIPS CLIMB 2 M EACH, 4 M TO THE BLOOM'},
];
const CAM = [
  [0, [0, 10, 0, 30, 22, 70]],
  [9.6, [0, 12, 0, 80, 26, 62]],
  [10.4, [0, 16, 0, 110, 28, 26]],
  [14.6, [0, 16, 0, 160, 28, 26]],
  [15.4, [0, 9, 0, 170, 16, 58]],
  [24, [0, 9, 0, 290, 18, 58]],
];

export function run() {
  runSim({duration: DURATION, fps: 60, theme: 'light', hud: {enabled: false}, director: {enabled: false}, watermark: ''}, ({canvas, capture}) => {
    const st = studio(canvas, {capture, shadow: 40, fog: [110, 300]});
    st.camera.far = 1500;
    st.camera.updateProjectionMatrix();
    const v = build(st.scene);
    const ui = consoleUI(document.getElementById('app'), {code: 'LS-6', eyebrow: 'STAGE STUDY · LAYER 6 · LUST · AFTER CALATRAVA’S BRISE SOLEIL', title: 'Lust'});
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
          right: `PETAL 1 · ${((S[0].phi * 180) / Math.PI).toFixed(1)}°`,
          rows: S.map((p, k) => [`CYL ${k + 1}`, `${p.len.toFixed(2)} m → ${((p.phi * 180) / Math.PI).toFixed(1)}°`]),
          barsTitle: 'TIP HEIGHT',
          bars: S.map((p, k) => [`${k + 1}`, Math.max(0, petalPt(p.phi, L.Lp)[1]) / (L.Hb + L.Lp)]),
          subs: [
            ['Bud · six petals', bi === 0 ? 'SHUT' : bi === 3 ? 'STAIRCASE' : 'OPEN', bi !== 2],
            ['Cylinders ×6', bi === 1 || bi === 3 ? 'MOVING' : 'HELD', bi === 2],
            ['Lilith · ram', lilithAt(t) > 0.99 ? 'UP' : lilithAt(t) > 0 ? 'RISING' : 'BELOW', bi === 1],
          ],
        });
        return {};
      },
    };
  });
}
