// FROST LANCER IL-3: geometry and film. A four-legged flesh base carries a stock on a pitch yoke; at the front two
// sinew torsion bundles and their rigid arms, the string solved to the nut; behind, the cranequin: a crank wheel, a
// pinion and the toothed rack whose hook drags the string back. Film, 11 s: span (6.4 crank turns), the catch, the
// lance seated, the aim set to the ballistic solution, release, the flight, the hit, the frozen target sliding on the
// ice until friction stops it. render(t) is pure.
import * as THREE from 'three';
import {runSim} from '../kit/runtime.js';
import {keyed} from '../kit/util.js';
import {partsKit, twoBone} from '../slumber-kit/parts.js';
import {consoleUI, gear, materials, studio} from '../slumber-kit/studio.js';
import {AIM, armAt, B, CRANK_FULL, drawForce, energyAt, FLIGHT, lance, PHI1, rackAt, SLIDE_D, SLIDE_T, SLIDE_V, slide, tip, V, X0, X1} from './kin.js';

export const DURATION = 11;
const sm = (u) => {
  const x = Math.min(1, Math.max(0, u));
  return x * x * x * (x * (x * 6 - 15) + 10);
};
const SPAN = [0.6, 4.6];
const FIRE = 6.6;
const crankAt = (t) => CRANK_FULL * sm((t - SPAN[0]) / (SPAN[1] - SPAN[0]));
const nutAt = (t) => (t >= FIRE ? X0 : rackAt(crankAt(t)));
const aimAt = (t) => AIM * sm((t - 5.2) / 1.0) + (4 * Math.PI) / 180 * (1 - sm((t - 5.2) / 1.0));
const hookUp = (t) => sm((t - SPAN[1]) / 0.4);
const loaded = (t) => sm((t - 4.9) / 0.4);
const LANCE_L = 1.5;

function build(scene) {
  const mat = materials();
  mat.ice = new THREE.MeshStandardMaterial({color: '#cfe7f3', emissive: new THREE.Color('#8fc3dc'), emissiveIntensity: 0.4, roughness: 0.2});
  mat.floor = new THREE.MeshStandardMaterial({color: '#e3eef3', roughness: 0.3});
  mat.string = new THREE.MeshStandardMaterial({color: '#3b2a24', roughness: 0.9});
  const root = new THREE.Group();
  scene.add(root);
  const K = partsKit(root, mat);
  // base: body and four legs (standing)
  K.mesh(new THREE.BoxGeometry(1.4, 0.8, 1.7).translate(0, 1.35, 0), mat.flesh, root);
  K.mesh(new THREE.CylinderGeometry(0.14, 0.18, 0.5, 16).translate(0, 1.95, 0), mat.fleshDeep, root);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const hip = [sx * 0.6, 1.2, sz * 0.65];
    const foot = [sx * 1.4, 0.04, sz * 1.25];
    const knee = twoBone(hip, foot, 0.9, 1.1, [sx, 1, 0]);
    K.orient(K.drum(0.14, 0.18), hip, [0, 0, 1]);
    K.place(K.housing(0.13, 0.12), hip, knee, [0, 0, 1], 0.14);
    K.orient(K.drum(0.12, 0.16), knee, [0, 0, 1]);
    K.place(K.housing(0.11, 0.1, {m: mat.bone}), knee, foot, [0, 0, 1], 0.12);
  }
  // yoke and the stock (bow group pitched about x at launch height)
  for (const s of [-1, 1]) K.mesh(new THREE.BoxGeometry(0.05, 0.3, 0.2).translate(s * 0.12, 2.05, 0), mat.dark, root);
  const bow = new THREE.Group();
  bow.position.y = B.launchY;
  root.add(bow);
  const Kb = partsKit(bow, mat);
  Kb.mesh(new THREE.BoxGeometry(0.14, 0.12, 2.3).translate(0, -0.1, -0.45), mat.fleshDeep, bow);
  Kb.mesh(new THREE.BoxGeometry(0.06, 0.02, 2.0).translate(0, -0.03, -0.3), mat.dark, bow); // the groove
  for (const s of [-1, 1]) {
    Kb.mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.42, 16).translate(s * B.w, 0, 0), mat.fleshDeep, bow);
    for (const y of [-0.2, 0.2]) Kb.mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.05, 16).translate(s * B.w, y, 0), mat.steel, bow);
  }
  const arms = [-1, 1].map(() => Kb.housing(0.05, 0.05, {stripe: false, m: mat.bone}));
  const strings = [-1, 1].map(() => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 1, 6), mat.string);
    bow.add(m);
    return m;
  });
  Kb.orient(Kb.drum(0.04, 0.12), [0, 0.02, -X1], [1, 0, 0]); // the nut (catch)
  // cranequin behind the stock end
  const CZ = -1.45;
  Kb.mesh(new THREE.BoxGeometry(0.2, 0.22, 0.3).translate(0, -0.05, CZ), mat.steel, bow);
  const wheel = Kb.mesh(new THREE.TorusGeometry(0.16, 0.015, 8, 28).rotateY(Math.PI / 2), mat.accent, bow);
  wheel.position.set(0.17, -0.05, CZ);
  const spoke = Kb.mesh(new THREE.BoxGeometry(0.01, 0.32, 0.02), mat.accent, bow);
  spoke.position.copy(wheel.position);
  const handle = Kb.mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.12, 8).rotateZ(Math.PI / 2), mat.dark, bow);
  const pinion = Kb.mesh(gear(B.rp, 10, 0.03), mat.steel, bow);
  pinion.position.set(0.12, -0.05, CZ);
  pinion.rotation.y = Math.PI / 2;
  const rack = new THREE.Group();
  bow.add(rack);
  Kb.mesh(new THREE.BoxGeometry(0.04, 0.04, 1.0).translate(0, 0.04, -0.5), mat.steel, rack);
  for (let k = 0; k < 18; k++) Kb.mesh(new THREE.BoxGeometry(0.045, 0.012, 0.018).translate(0, 0.066, -0.05 - k * 0.055), mat.dark, rack);
  const hook = new THREE.Group();
  rack.add(hook);
  Kb.mesh(new THREE.BoxGeometry(0.16, 0.03, 0.04).translate(0, 0.03, 0.02), mat.dark, hook);
  // the lance
  const lanceG = new THREE.Group();
  scene.add(lanceG);
  const Kl = partsKit(lanceG, mat);
  Kl.mesh(new THREE.CylinderGeometry(0.03, 0.03, LANCE_L, 8).rotateX(Math.PI / 2).translate(0, 0, LANCE_L / 2), mat.ice, lanceG);
  Kl.mesh(new THREE.ConeGeometry(0.06, 0.3, 6).rotateX(Math.PI / 2).translate(0, 0, LANCE_L + 0.15), mat.ice, lanceG);
  for (const r of [0, Math.PI / 2]) Kl.mesh(new THREE.BoxGeometry(0.01, 0.14, 0.2).rotateZ(r).translate(0, 0, 0.12), mat.ice, lanceG);
  // target on an ice patch
  const ice = new THREE.Mesh(new THREE.CircleGeometry(4, 40).rotateX(-Math.PI / 2), mat.floor);
  ice.position.set(0, 0.004, B.target.d + 1);
  ice.receiveShadow = true;
  scene.add(ice);
  const postMat = new THREE.MeshStandardMaterial({color: '#cfc6b6', roughness: 0.8, emissive: new THREE.Color('#8fc3dc'), emissiveIntensity: 0});
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.35, 1.8, 20).translate(0, 0.9, 0), postMat);
  post.castShadow = true;
  scene.add(post);
  const base = new THREE.Color('#cfc6b6');
  const frost = new THREE.Color('#d8eef8');
  return {
    update(t) {
      const x = nutAt(t);
      const phi = armAt(x);
      const pitch = aimAt(t);
      bow.rotation.x = -pitch;
      [-1, 1].forEach((s, i) => {
        const tp = tip(phi);
        const tipL = [s * tp[0], 0, tp[1]];
        Kb.place(arms[i], [s * B.w, 0, 0], tipL, [0, 1, 0]);
        const nut = [0, 0, -x];
        const m = strings[i];
        const d = [nut[0] - tipL[0], 0, nut[2] - tipL[2]];
        const L = Math.hypot(d[0], d[2]);
        m.position.set((nut[0] + tipL[0]) / 2, 0, (nut[2] + tipL[2]) / 2);
        m.scale.set(1, L, 1);
        m.rotation.set(Math.PI / 2, 0, 0);
        m.rotation.y = Math.atan2(d[0], d[2]);
        m.rotation.order = 'YXZ';
      });
      const c = crankAt(t);
      const rackZ = t >= SPAN[1] ? -X1 : -rackAt(c);
      rack.position.z = rackZ;
      hook.rotation.x = -1.1 * hookUp(t);
      const ang = c; // the crank wheel turns with the crank
      spoke.rotation.x = ang;
      handle.position.set(0.22, -0.05 + 0.16 * Math.cos(ang), CZ + 0.16 * Math.sin(ang));
      pinion.rotation.z = c / B.ratio;
      // the lance: seated on the stock, then flying, then stuck in the target as it slides
      const tau = t - FIRE;
      const sl = slide(tau - FLIGHT);
      if (tau < 0) {
        lanceG.visible = loaded(t) > 0.01;
        const nock = new THREE.Vector3(0, 0.0, -X1 - 0.6 * (1 - loaded(t)));
        bow.updateMatrixWorld();
        lanceG.position.copy(nock.applyMatrix4(bow.matrixWorld));
        lanceG.rotation.set(-pitch, 0, 0);
      } else {
        lanceG.visible = true;
        const L = lance(tau);
        // L.z is the tip; the lance is tracked by its nock, and the tip buries 0.35 m into the target
        lanceG.position.set(0, L.y, L.z - LANCE_L - 0.3 + (L.hit ? 0.35 + sl : 0));
        lanceG.rotation.set(-L.pitch, 0, 0);
      }
      post.position.set(0, 0, B.target.d + 0.3 + sl);
      const fz = tau >= FLIGHT ? sm((tau - FLIGHT) / 0.6) : 0;
      postMat.color.copy(base).lerp(frost, fz);
      postMat.emissiveIntensity = 0.35 * fz;
      return {x, phi, pitch, c, tau, sl};
    },
  };
}

const BEATS = [
  {t: 0, mode: 'SPANNING', cap: 'IL-3 · A CRANEQUIN: CRANK → PINION → RACK · THE HOOK DRAGS THE STRING TO THE NUT'},
  {t: 4.6, mode: 'LOADED', cap: 'THE ARMS TWIST THEIR SINEW BUNDLES · 1.6 KJ STORED · THE LANCE SEATS'},
  {t: 5.2, mode: 'AIMING', cap: 'ELEVATION FROM THE BALLISTIC SOLUTION FOR 20 M'},
  {t: FIRE, mode: 'LOOSED', cap: 'v = √(2ηE/m) · THE ARC LANDS ON THE TARGET'},
  {t: FIRE + FLIGHT + 0.1, mode: 'FROZEN', cap: 'MOMENTUM PASSES TO THE TARGET · IT SLIDES ON THE ICE UNTIL FRICTION STOPS IT'},
];
const CAM = [
  [0, [0, B.launchY, -1.1, 115, 20, 3.4]],
  [4.4, [0, B.launchY, -0.8, 140, 18, 3.6]],
  [5.2, [0, B.launchY, 0.5, 150, 16, 7]],
  [6.5, [0, 2, 3, 155, 12, 11]],
  [7.0, [0, 1.6, B.target.d - 2, 230, 10, 7]],
  [11, [0, 1.2, B.target.d + 0.8, 270, 12, 6.5]],
];

export function run() {
  runSim({duration: DURATION, fps: 60, theme: 'light', hud: {enabled: false}, director: {enabled: false}, watermark: ''}, ({canvas, capture}) => {
    const st = studio(canvas, {capture, shadow: 26, fog: [50, 160]});
    const il = build(st.scene);
    const ui = consoleUI(document.getElementById('app'), {code: 'IL-3', eyebrow: 'TREACHERY · THROWS FREEZING LANCES, A FROZEN PLAYER SLIDES', title: 'Frost Lancer IL-3'});
    return {
      resize: st.resize,
      render(t) {
        const S = il.update(t);
        const [x, y, z, az, el, dist] = keyed(CAM, t, sm);
        st.aim([x, y, z], az, el, dist);
        st.render();
        const bi = BEATS.reduce((k, b, i) => (t >= b.t ? i : k), 0);
        const E = t >= FIRE ? 0 : energyAt(S.x);
        ui.set({
          cap: BEATS[bi].cap,
          n: bi + 1,
          mode: BEATS[bi].mode,
          right: t >= FIRE ? `${V.toFixed(1)} m/s` : `${(E / 1000).toFixed(2)} kJ`,
          rows: [
            ['CRANK', `${(S.c / (2 * Math.PI)).toFixed(1)} turns`],
            ['DRAW', `${((S.x - X0) * 1000).toFixed(0)} / ${(B.stroke * 1000).toFixed(0)} mm`],
            ['ARMS', `${((S.phi * 180) / Math.PI).toFixed(1)}°`],
            ['FORCE', t >= FIRE ? '-' : `${(drawForce(Math.max(S.x, X0 + 1e-4)).F / 1000).toFixed(1)} kN`],
            ['AIM', `${((S.pitch * 180) / Math.PI).toFixed(1)}°`],
            ['SLIDE', `${S.sl.toFixed(2)} / ${SLIDE_D.toFixed(2)} m`],
          ],
          barsTitle: 'ENERGY',
          bars: [['E', E / B.E], ['SLIDE', S.sl / SLIDE_D]],
          subs: [
            ['Cranequin', t < SPAN[1] ? 'WINDING' : 'HELD', bi === 0],
            ['Torsion arms', t >= FIRE ? 'SPENT' : `${((PHI1 * 180) / Math.PI).toFixed(0)}° MAX`, bi === 1 || bi === 3],
            ['Target', S.tau >= FLIGHT ? `FROZEN · ${SLIDE_V.toFixed(2)} m/s` : '-', bi === 4],
          ],
        });
        return {};
      },
    };
  });
}
