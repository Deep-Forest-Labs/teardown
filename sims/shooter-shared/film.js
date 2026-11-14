// GUNNER GT-6: geometry and film. A planted tripod (housings and drums), a pan hub, a tilting yoke, the six-barrel
// cluster with its cam ring and sliding bolts, an ammunition drum. Film, 22 s: tracking, firing (one shot each time
// a barrel passes the top), the cluster isolated, the lob at close range. render(t) is pure.
import * as THREE from 'three';
import {runSim} from '../kit/runtime.js';
import {keyed} from '../kit/util.js';
import {partsKit} from '../slumber-kit/parts.js';
import {consoleUI, materials, studio} from '../slumber-kit/studio.js';
import {flightTime, G, pose, shotAt} from './kin.js';

export const DURATION = 22;
const TAU = Math.PI * 2;
const RATE = 2.2; // cluster rad/s while firing
const sm = (u) => {
  const x = Math.min(1, Math.max(0, u));
  return x * x * x * (x * (x * 6 - 15) + 10);
};
// the target (the player): circles at range, then closes in
const targetAt = (t) => {
  const close = sm((t - 15) / 2);
  const r = 13 - 8 * close;
  const a = 0.5 + 0.18 * t;
  return [Math.sin(a) * r, 0.9, Math.cos(a) * r];
};
const firing = (t) => (t > 4 && t < 10.5) || t > 17.5;
const psiAt = (t) => {
  // the cluster spins only while firing: integrate in closed form over the two firing windows
  const w1 = Math.max(0, Math.min(t, 10.5) - 4);
  const w2 = Math.max(0, t - 17.5);
  return RATE * (w1 + w2);
};

function build(scene) {
  const mat = materials();
  mat.shot = new THREE.MeshStandardMaterial({color: '#ff4a1c', emissive: new THREE.Color('#ff4a1c'), emissiveIntensity: 0.9});
  const root = new THREE.Group();
  scene.add(root);
  const K = partsKit(root, mat);
  const legs = Array.from({length: G.legs}, () => ({hip: K.drum(0.16, 0.24), thigh: K.housing(0.2, 0.18), knee: K.drum(0.14, 0.22), shank: K.housing(0.15, 0.14), foot: K.mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.12, 20), mat.dark, root)}));
  // hub and pan ring
  const hub = new THREE.Group();
  hub.position.set(...G.hub);
  root.add(hub);
  K.mesh(new THREE.CylinderGeometry(0.62, 0.7, 0.4, 32).translate(0, -0.2, 0), mat.flesh, hub);
  K.mesh(new THREE.TorusGeometry(0.66, 0.025, 8, 48).rotateX(Math.PI / 2), mat.accent, hub);
  const pan = new THREE.Group();
  hub.add(pan);
  K.mesh(new THREE.CylinderGeometry(0.5, 0.55, 0.12, 32).translate(0, 0.06, 0), mat.dark, pan);
  for (const sx of [-1, 1]) K.mesh(new THREE.BoxGeometry(0.1, 0.5, 0.3).translate(sx * 0.32, 0.3, G.pivot[2]), mat.fleshDeep, pan);
  // the tilting gun: pivot at the yoke, cluster along local +z
  const gun = new THREE.Group();
  gun.position.set(0, G.pivot[1], G.pivot[2]);
  pan.add(gun);
  K.mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.72, 16).rotateZ(Math.PI / 2), mat.steel, gun); // trunnion
  const receiver = K.mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.5, 28).rotateX(Math.PI / 2).translate(0, 0, 0.05), mat.flesh, gun);
  void receiver;
  K.mesh(new THREE.TorusGeometry(0.24, 0.018, 8, 36).translate(0, 0, 0.3), mat.accent, gun);
  // the cam ring: a tilted accent ring the bolts' followers ride (the track that opens and closes them)
  K.mesh(new THREE.TorusGeometry(0.2, 0.015, 8, 36).rotateY(0.18), mat.accent, gun).position.z = -0.1;
  // ammunition drum on the left
  K.mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.2, 28).rotateZ(Math.PI / 2).translate(-0.4, 0, 0), mat.flesh, gun);
  K.mesh(new THREE.TorusGeometry(0.26, 0.015, 8, 32).rotateY(Math.PI / 2).translate(-0.51, 0, 0), mat.dark, gun);
  const cluster = new THREE.Group();
  gun.add(cluster);
  const bolts = [];
  for (let i = 0; i < G.barrels; i++) {
    const a = (i / G.barrels) * TAU;
    const x = Math.sin(a) * G.clusterR;
    const y = Math.cos(a) * G.clusterR;
    K.mesh(new THREE.CylinderGeometry(0.035, 0.035, G.barrelL, 12).rotateX(Math.PI / 2).translate(x, y, G.barrelL / 2 + 0.1), mat.bone, cluster);
    K.mesh(new THREE.TorusGeometry(0.036, 0.008, 6, 14).translate(x, y, G.barrelL + 0.1), mat.dark, cluster);
    bolts.push(K.mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.3, 10).rotateX(Math.PI / 2).translate(x, y, 0), mat.steel, cluster));
  }
  for (const z of [0.35, 0.8, G.barrelL + 0.02]) K.mesh(new THREE.CylinderGeometry(G.clusterR + 0.06, G.clusterR + 0.06, 0.05, 24, 1, false).rotateX(Math.PI / 2).translate(0, 0, z), z > 1 ? mat.accent : mat.dark, cluster);
  const shots = Array.from({length: 24}, () => K.mesh(new THREE.SphereGeometry(0.11, 14, 10), mat.shot, root));
  return {
    update(t) {
      const target = targetAt(t);
      const psi = psiAt(t);
      const P = pose(psi, target, t);
      P.legs.forEach((L, i) => {
        const g = legs[i];
        const side = [Math.cos(L.a + Math.PI / 2), 0, Math.sin(L.a + Math.PI / 2)];
        K.orient(g.hip, L.hip, side);
        K.place(g.thigh, L.hip, L.knee, [0, 1, 0], 0.3);
        K.orient(g.knee, L.knee, side);
        K.place(g.shank, L.knee, L.foot, [0, 1, 0], 0.24);
        g.foot.position.set(L.foot[0], 0.06, L.foot[2]);
      });
      pan.rotation.y = P.pan;
      gun.rotation.x = -P.el;
      cluster.rotation.z = -psi;
      bolts.forEach((b, i) => (b.position.z = -0.15 + G.bolt * P.bolts[i]));
      // shots: one each time a barrel reached the top (ψ a multiple of 60°), fired along the aim of that moment
      const step = TAU / G.barrels;
      let n = 0;
      for (let k = Math.floor(psi / step); k >= 1 && n < shots.length; k--) {
        // find the firing time of shot k (ψ = k·step) by inverting the closed-form ψ(t)
        const need = k * step;
        const w1 = 6.5 * RATE;
        const tk = need <= w1 ? 4 + need / RATE : 17.5 + (need - w1) / RATE;
        const Pk = pose(need, targetAt(tk), tk);
        const p = shotAt(Pk, tk, t);
        if (!p) continue;
        shots[n].position.set(...p);
        shots[n].visible = true;
        n++;
      }
      for (let i = n; i < shots.length; i++) shots[i].visible = false;
      return {P, target};
    },
  };
}

const BEATS = [
  {t: 0, mode: 'TRACKING', cap: 'GT-6 · A PLANTED TRIPOD, A PAN HUB, A TILTING SIX-BARREL CLUSTER'},
  {t: 4, mode: 'FIRING', cap: 'ONE SHOT EACH TIME A BARREL PASSES THE TOP · AIMED BY BALLISTICS · DODGEABLE'},
  {t: 10.5, mode: 'CLUSTER', cap: 'THE CAM RING DRIVES EACH BOLT · ONE CLOSED AT THE FIRING POSITION'},
  {t: 15, mode: 'LOB', cap: 'CLOSE IN, THE LOW ARC IS TOO FAST TO DODGE · IT LOBS (THE OTHER ROOT)'},
];
const CAM = [
  [0, [0, 1.8, 3, 140, 14, 13]],
  [3.6, [0, 1.8, 3, 120, 14, 13]],
  [10.2, [0, 1.6, 5, 60, 22, 20]],
  [11, [0, 2.7, 0.6, 210, 14, 2.6]],
  [14.6, [0, 2.7, 0.6, 240, 18, 2.6]],
  [15.4, [0, 2.4, 0, 100, 24, 16]],
  [22, [0, 3, 0, 70, 26, 18]],
];

export function run() {
  runSim({duration: DURATION, fps: 60, theme: 'light', hud: {enabled: false}, director: {enabled: false}, watermark: ''}, ({canvas, capture}) => {
    const st = studio(canvas, {capture, shadow: 9, fog: [40, 140]});
    const gt = build(st.scene);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.35, 1.8, 20).translate(0, 0.9, 0), new THREE.MeshStandardMaterial({color: '#cfc6b6', roughness: 0.8}));
    post.castShadow = true;
    st.scene.add(post);
    const ui = consoleUI(document.getElementById('app'), {code: 'GT-6', eyebrow: 'RANGED · KEEPS ITS DISTANCE', title: 'Gunner GT-6'});
    return {
      resize: st.resize,
      render(t) {
        const {P, target} = gt.update(t);
        post.position.set(target[0], 0, target[2]);
        let [x, y, z, az, el, dist] = keyed(CAM, t, sm);
        // the cluster beat rides with the gun: aimed at the barrels' middle, from the gun's right side
        const k = Math.min(sm((t - 10.4) / 0.6), 1 - sm((t - 14.6) / 0.6));
        if (k > 0) {
          const c = [0, 1, 2].map((i) => P.pivot[i] + P.dir[i] * 0.7);
          const azG = (P.pan * 180) / Math.PI + 75;
          [x, y, z, az, el, dist] = [x + (c[0] - x) * k, y + (c[1] - y) * k, z + (c[2] - z) * k, az + (azG - az) * k, el + (16 - el) * k, dist + (2.4 - dist) * k];
        }
        st.aim([x, y, z], az, el, dist);
        st.render();
        const bi = BEATS.reduce((k, b, i) => (t >= b.t ? i : k), 0);
        const range = Math.hypot(target[0], target[2]);
        ui.set({
          cap: BEATS[bi].cap,
          n: bi + 1,
          mode: BEATS[bi].mode,
          right: `RANGE ${range.toFixed(1)} m`,
          rows: [
            ['PAN', `${(((P.pan * 180) / Math.PI + 360) % 360).toFixed(1)}°`],
            ['ELEVATION', `${((P.el * 180) / Math.PI).toFixed(1)}°`],
            ['MUZZLE', `${G.muzzleV} m/s`],
            ['FLIGHT', `${flightTime(P).toFixed(2)} s`],
            ['CLUSTER', `${(((psiAt(t) * 180) / Math.PI) % 360).toFixed(0)}°`],
          ],
          barsTitle: 'BOLTS',
          bars: P.bolts.map((b, i) => [`B${i + 1}`, b]),
          subs: [
            ['Tripod ×3', 'PLANTED', false],
            ['Pan · tilt', 'TRACKING', bi === 0],
            ['Cluster ×6', firing(t) ? 'SPINNING' : 'HOLD', firing(t)],
            ['Cam · bolts', 'CYCLING', bi === 2],
            ['Arc', P.el > 0.8 ? 'LOB' : 'DIRECT', bi === 3],
          ],
        });
        return {};
      },
    };
  });
}
