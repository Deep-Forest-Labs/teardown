// AERIE FL-4: geometry and film. A rigid-airship frame (polygon rings and longitudinal girders, instanced), a flesh
// cover over the upper half, gas cells and a ballonet inside, a gondola, four engines with propellers, cruciform fins,
// the trapeze (two arms, a level hook bar) launching a Diver, a suction hose eating orbs. Film, 18 s: drifting, sinking
// (the ballonet fills), the trapeze swinging down, the launch, retract and rise. render(t) is pure.
import * as THREE from 'three';
import {runSim} from '../kit/runtime.js';
import {keyed} from '../kit/util.js';
import {partsKit} from '../slumber-kit/parts.js';
import {consoleUI, materials, studio} from '../slumber-kit/studio.js';
import {altAt, F, rings, SCRIPT, trapeze} from './kin.js';

export const DURATION = 18;
const TAU = Math.PI * 2;
const sm = (u) => {
  const x = Math.min(1, Math.max(0, u));
  return x * x * x * (x * (x * 6 - 15) + 10);
};

function build(scene) {
  const mat = materials();
  mat.cell = new THREE.MeshStandardMaterial({color: '#efe2d6', transparent: true, opacity: 0.35, depthWrite: false, roughness: 0.6});
  mat.orb = new THREE.MeshStandardMaterial({color: '#8fd4ff', emissive: new THREE.Color('#8fd4ff'), emissiveIntensity: 0.7});
  const root = new THREE.Group();
  scene.add(root);
  const ship = new THREE.Group();
  root.add(ship);
  const K = partsKit(ship, mat);
  const R = rings();
  // girders: ring segments and longerons as instanced rods
  const nRod = R.length * F.sides + (R.length - 1) * F.sides;
  const rods = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.035, 0.035, 1, 6), mat.bone, nRod);
  rods.castShadow = true;
  ship.add(rods);
  const M = new THREE.Matrix4();
  const Q = new THREE.Quaternion();
  let n = 0;
  const rod = (a, b) => {
    const A = new THREE.Vector3(...a);
    const B = new THREE.Vector3(...b);
    Q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize());
    rods.setMatrixAt(n++, M.compose(A.clone().add(B).multiplyScalar(0.5), Q, new THREE.Vector3(1, A.distanceTo(B), 1)));
  };
  R.forEach((ring, i) => {
    for (let k = 0; k < F.sides; k++) rod(ring.pts[k], ring.pts[(k + 1) % F.sides]);
    if (i > 0) for (let k = 0; k < F.sides; k++) rod(R[i - 1].pts[k], ring.pts[k]);
  });
  rods.count = n;
  // the cover over the upper half: a lathe of the hull profile, top only
  const prof = [];
  for (let i = 0; i <= 40; i++) {
    const u = i / 40;
    prof.push(new THREE.Vector2(F.radius(u) * 1.02, F.len / 2 - u * F.len));
  }
  const cover = new THREE.LatheGeometry(prof, 40, Math.PI * 0.05, Math.PI * 0.9).rotateZ(Math.PI / 2).rotateY(Math.PI / 2);
  K.mesh(cover, mat.flesh, ship).material.side = THREE.DoubleSide;
  // gas cells between the frames, and the ballonet (scaled by its fill)
  for (let i = 1; i < R.length - 1; i += 2) K.mesh(new THREE.SphereGeometry(R[i].r * 0.85, 20, 14).scale(1, 1, 0.9), mat.cell, ship).position.z = R[i].z;
  const ballonet = K.mesh(new THREE.SphereGeometry(1, 20, 12), mat.fleshDeep, ship);
  ballonet.position.set(0, -1.1, 0);
  // gondola, engines, fins
  K.mesh(new THREE.CapsuleGeometry(0.45, 1.6, 6, 18).rotateX(Math.PI / 2).translate(0, -2.75, 3.2), mat.flesh, ship);
  K.mesh(new THREE.BoxGeometry(0.06, 0.4, 1.4).translate(0, -2.3, 3.2), mat.dark, ship);
  const props = [];
  for (const [x, y, z] of [[2.6, -0.8, 1.5], [-2.6, -0.8, 1.5], [2.3, -0.9, -3.2], [-2.3, -0.9, -3.2]]) {
    K.place(K.housing(0.08, 0.08, {stripe: false, m: mat.steel}), [Math.sign(x) * 1.6, y + 0.3, z], [x, y, z], [0, 1, 0]);
    K.mesh(new THREE.CapsuleGeometry(0.2, 0.6, 4, 14).rotateX(Math.PI / 2).translate(x, y, z), mat.flesh, ship);
    const p = new THREE.Group();
    p.position.set(x, y, z - 0.55);
    ship.add(p);
    for (let k = 0; k < 3; k++) K.mesh(new THREE.BoxGeometry(0.08, 0.7, 0.02).translate(0, 0.35, 0), mat.dark, p).rotation.z = (k * TAU) / 3;
    props.push(p);
  }
  for (let k = 0; k < 4; k++) {
    const fin = K.mesh(new THREE.BoxGeometry(0.06, 1.4, 1.8).translate(0, 1.3, -F.len / 2 + 1.2), mat.flesh, ship);
    fin.rotation.z = (k * Math.PI) / 2;
  }
  // trapeze: two arms (housings) and the hook bar; a diver hangs on the hook
  const arms = [0, 1].map(() => K.housing(0.08, 0.08, {stripe: false, m: mat.bone}));
  const bar = K.housing(0.07, 0.07, {stripe: false, m: mat.dark});
  const hook = K.mesh(new THREE.TorusGeometry(0.14, 0.03, 8, 20, Math.PI * 1.4), mat.accent, ship);
  const diver = new THREE.Group();
  root.add(diver);
  const Kd = partsKit(diver, mat);
  Kd.mesh(new THREE.CapsuleGeometry(0.22, 1.0, 4, 16).rotateX(Math.PI / 2), mat.flesh, diver);
  Kd.mesh(new THREE.BoxGeometry(2.2, 0.05, 0.5).translate(0, 0.05, -0.1), mat.flesh, diver);
  Kd.mesh(new THREE.BoxGeometry(2.0, 0.03, 0.06).translate(0, 0.09, 0.12), mat.accent, diver);
  // suction hose and orbs
  const hose = K.housing(0.12, 0.12, {stripe: false, m: mat.fleshDeep});
  const orbs = [0, 1, 2].map(() => K.mesh(new THREE.SphereGeometry(0.18, 14, 10), mat.orb, root));
  return {
    update(t) {
      const A = altAt(t);
      ship.position.set(0, A.y, t * 0.25);
      ship.rotation.y = 0.05 * Math.sin(t * 0.3);
      ballonet.scale.set(0.9 + 0.5 * A.ballonet, 0.5 + 0.5 * A.ballonet, 1.6 + 1.2 * A.ballonet);
      props.forEach((p, i) => (p.rotation.z = t * (8 + i)));
      const T = trapeze(t);
      F.trapeze.pivots.forEach((p, i) => K.place(arms[i], p, T.ends[i], [1, 0, 0]));
      K.place(bar, T.ends[0], T.ends[1], [0, 1, 0]);
      hook.position.set(...T.hook);
      // the diver: on the hook until the drop, then falls, sweeps out and flies off
      // the ship's transform at any time (pure): used for the hook now and at the drop instant
      const shipAt = (tt) => new THREE.Matrix4().compose(new THREE.Vector3(0, altAt(tt).y, tt * 0.25), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0.05 * Math.sin(tt * 0.3), 0)), new THREE.Vector3(1, 1, 1));
      const tau = t - SCRIPT.drop;
      if (tau < 0) {
        const hw = new THREE.Vector3(...T.hook).applyMatrix4(shipAt(t));
        diver.position.set(hw.x, hw.y - 0.35, hw.z);
      } else {
        const T0 = trapeze(SCRIPT.drop);
        const dp = new THREE.Vector3(...T0.hook).applyMatrix4(shipAt(SCRIPT.drop));
        diver.position.set(dp.x, dp.y - 0.35 - 4.9 * Math.min(tau, 0.5) ** 2 - Math.max(0, tau - 0.5) * 0.4, dp.z + tau * 6);
      }
      diver.rotation.x = tau > 0 ? -0.2 : 0;
      // the hose dangles from the rear belly; orbs rise up it in the drift
      const hoseTop = [0, -2.2, -2.6];
      const hoseEnd = [0.3 * Math.sin(t), -2.2 - (A.y - 0.3), -3.2];
      K.place(hose, hoseTop, hoseEnd, [1, 0, 0]);
      orbs.forEach((o, i) => {
        const u = ((t * 0.35 + i / 3) % 1);
        const p = [0, 1, 2].map((c) => hoseEnd[c] + (hoseTop[c] - hoseEnd[c]) * u);
        o.position.set(p[0], p[1] + A.y, p[2] + t * 0.25);
        o.visible = t < SCRIPT.sink[0] || t > SCRIPT.rise[1] - 1;
      });
      return {A, T};
    },
  };
}

const BEATS = [
  {t: 0, mode: 'DRIFTING', cap: 'FL-4 · A RIGID FRAME OF RINGS AND GIRDERS · ITS HOSE DRINKS THE ORBS'},
  {t: 2, mode: 'SINKING', cap: 'THE BALLONET TAKES IN AIR AND IT SINKS TO LAUNCH HEIGHT'},
  {t: 7, mode: 'TRAPEZE', cap: 'THE TRAPEZE SWINGS DOWN ON A PARALLELOGRAM · THE HOOK BAR STAYS LEVEL'},
  {t: 9.4, mode: 'LAUNCH', cap: 'THE DIVER DROPS FROM THE HOOK, SWEEPS OUT AND FLIES'},
  {t: 10.4, mode: 'RISING', cap: 'THE TRAPEZE FOLDS BACK · THE BALLONET EMPTIES AND IT RISES'},
];
const CAM = [
  [0, [0, 8, 0, 60, 10, 26]],
  [6.6, [0, 6.5, 1.6, 80, 8, 24]],
  [7.4, [0, 3.6, 1.9, 100, 6, 11]],
  [9.2, [0, 3.2, 2.3, 110, 4, 11]],
  [10.2, [0, 3.2, 4.5, 80, 6, 14]],
  [18, [0, 8, 4.5, 40, 12, 28]],
];

export function run() {
  runSim({duration: DURATION, fps: 60, theme: 'light', hud: {enabled: false}, director: {enabled: false}, watermark: ''}, ({canvas, capture}) => {
    const st = studio(canvas, {capture, shadow: 14, fog: [60, 180]});
    const fl = build(st.scene);
    const ui = consoleUI(document.getElementById('app'), {code: 'FL-4', eyebrow: 'VOID SPAWNER · DRIFTS, EATS ORBS, LAUNCHES DIVERS', title: 'Aerie FL-4'});
    return {
      resize: st.resize,
      render(t) {
        const S = fl.update(t);
        const [x, y, z, az, el, dist] = keyed(CAM, t, sm);
        st.aim([x, y, z + t * 0.25], az, el, dist);
        st.render();
        const bi = BEATS.reduce((k, b, i) => (t >= b.t ? i : k), 0);
        ui.set({
          cap: BEATS[bi].cap,
          n: bi + 1,
          mode: BEATS[bi].mode,
          right: `ALT ${S.A.y.toFixed(1)} m`,
          rows: [
            ['FRAME', `${F.frames} rings × ${F.sides} sides`],
            ['BALLONET', `${Math.round(S.A.ballonet * 100)}%`],
            ['TRAPEZE', `${((S.T.ang * 180) / Math.PI).toFixed(0)}°`],
            ['HOOK BAR', 'LEVEL'],
          ],
          barsTitle: 'BALLONET',
          bars: [['AIR', S.A.ballonet]],
          subs: [
            ['Frame · girders', 'RIGID', false],
            ['Ballonet', S.A.ballonet > 0.05 ? 'FILLED' : 'EMPTY', bi === 1 || bi === 4],
            ['Trapeze', S.T.down > 0.95 ? 'DOWN' : S.T.down > 0.02 ? 'SWINGING' : 'STOWED', bi === 2],
            ['Diver', t >= 9.4 ? 'LAUNCHED' : 'ON HOOK', bi === 3],
            ['Suction hose', 'DRINKING', bi === 0],
          ],
        });
        return {};
      },
    };
  });
}
