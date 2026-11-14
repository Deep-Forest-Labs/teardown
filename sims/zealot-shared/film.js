// CANTOR ZL-7: geometry and film. A robed flesh column round a tall shaft on a three-wheel omni base (each wheel with
// its rim rollers), the umbrella linkage (ribs from the top notch, stretchers from the runner), translucent ward panels
// between the ribs, bolts leaving the rib tips in turn. Film, 18 s: gliding (diagonal while turning, the wheels at
// their computed speeds), the ward opening over two sheltered mites, chanting bolts, furling. render(t) is pure.
import * as THREE from 'three';
import {runSim} from '../kit/runtime.js';
import {keyed} from '../kit/util.js';
import {partsKit} from '../slumber-kit/parts.js';
import {consoleUI, materials, studio} from '../slumber-kit/studio.js';
import {rib, TAU, wheelSpeeds, Z} from './kin.js';

export const DURATION = 18;
const sm = (u) => {
  const x = Math.min(1, Math.max(0, u));
  return x * x * x * (x * (x * 6 - 15) + 10);
};
const openAt = (t) => keyed([[0, 0], [5, 0], [7, 1], [15, 1], [17, 0], [18, 0]], t, sm);
// body path (pure): glide diagonally while turning until 5 s, then hold
const VX = 0.35;
const VZ = 0.25;
const W = 0.4;
const bodyAt = (t) => {
  const tt = Math.min(t, 5);
  return {x: VX * tt, z: VZ * tt, h: W * tt, moving: t < 5};
};
const BOLTS = [8, 8.7, 9.4, 10.1, 10.8, 11.5, 12.2, 12.9];

function build(scene) {
  const mat = materials();
  mat.ward = new THREE.MeshStandardMaterial({color: '#e2a99b', transparent: true, opacity: 0.32, side: THREE.DoubleSide, depthWrite: false, emissive: new THREE.Color('#ff6a4a'), emissiveIntensity: 0.15});
  mat.bolt = new THREE.MeshStandardMaterial({color: '#ffd3a8', emissive: new THREE.Color('#ff8a3a'), emissiveIntensity: 1});
  const root = new THREE.Group();
  scene.add(root);
  const body = new THREE.Group();
  root.add(body);
  const K = partsKit(body, mat);
  // shaft and robe
  K.mesh(new THREE.CylinderGeometry(0.07, 0.07, Z.top + 0.4, 14).translate(0, (Z.top + 0.4) / 2, 0), mat.bone, body);
  K.mesh(new THREE.LatheGeometry([[0.0, 0.3], [0.62, 0.32], [0.55, 0.9], [0.42, 1.5], [0.36, 1.95], [0.0, 2.0]].map(([r, y]) => new THREE.Vector2(r, y)), 32), mat.flesh, body);
  for (const y of [0.6, 1.1, 1.6]) K.mesh(new THREE.TorusGeometry(0.62 - (y - 0.3) * 0.17, 0.02, 6, 36).rotateX(Math.PI / 2).translate(0, y, 0), mat.accent, body);
  // the head: a hooded pod with one large optic
  K.mesh(new THREE.SphereGeometry(0.26, 20, 14).scale(1, 1.2, 1).translate(0, 2.25, 0.05), mat.fleshDeep, body);
  K.mesh(new THREE.CircleGeometry(0.09, 20).translate(0, 2.27, 0.32), new THREE.MeshPhysicalMaterial({color: '#151416', clearcoat: 1}), body);
  K.mesh(new THREE.TorusGeometry(0.1, 0.015, 8, 20).translate(0, 2.27, 0.32), mat.accent, body);
  // omni base: three wheels at 120°, each with rim rollers
  const wheels = [0, 1, 2].map((k) => {
    const a = (k / 3) * TAU;
    const g = new THREE.Group();
    g.position.set(Math.cos(a) * Z.wheels.R, Z.wheels.r, Math.sin(a) * Z.wheels.R);
    g.rotation.y = -a; // its axle points radially
    body.add(g);
    const spin = new THREE.Group();
    g.add(spin);
    K.mesh(new THREE.CylinderGeometry(Z.wheels.r * 0.7, Z.wheels.r * 0.7, 0.08, 20).rotateZ(Math.PI / 2), mat.dark, spin);
    for (let j = 0; j < 10; j++) {
      const r = K.mesh(new THREE.CapsuleGeometry(0.035, 0.08, 4, 8).rotateX(Math.PI / 2), mat.bone, spin);
      const b = (j / 10) * TAU;
      r.position.set(0, Math.cos(b) * Z.wheels.r * 0.88, Math.sin(b) * Z.wheels.r * 0.88);
      r.rotation.x = b;
    }
    return {spin, a};
  });
  K.mesh(new THREE.CylinderGeometry(0.66, 0.66, 0.08, 36).translate(0, 0.32, 0), mat.dark, body);
  // the umbrella: notch ring, runner ring, ribs, stretchers, panels
  K.mesh(new THREE.TorusGeometry(Z.notchR, 0.04, 8, 24).rotateX(Math.PI / 2).translate(0, Z.top, 0), mat.dark, body);
  const runner = K.mesh(new THREE.TorusGeometry(Z.runnerR + 0.02, 0.05, 8, 24).rotateX(Math.PI / 2), mat.accent, body);
  const ribs = Array.from({length: Z.ribs}, () => ({rib: K.housing(0.06, 0.05, {stripe: false, m: mat.bone}), str: K.housing(0.04, 0.04, {stripe: false, m: mat.steel}), tip: K.mesh(new THREE.SphereGeometry(0.06, 10, 8), mat.accent, body)}));
  const panelGeo = new THREE.BufferGeometry();
  panelGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(Z.ribs * 9), 3));
  const panels = K.mesh(panelGeo, mat.ward, body);
  panels.castShadow = false;
  const bolts = BOLTS.map(() => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8), mat.bolt);
    root.add(m);
    return m;
  });
  return {
    update(t) {
      const B = bodyAt(t);
      body.position.set(B.x, 0, B.z);
      body.rotation.y = -B.h;
      // wheels turn at the speeds the omni kinematics give for this motion (rim speed / radius)
      const s = B.moving ? wheelSpeeds(VX, VZ, W, B.h) : [0, 0, 0];
      const tt = Math.min(t, 5);
      wheels.forEach((Wh, k) => (Wh.spin.rotation.x = (s[k] * tt) / Z.wheels.r));
      const o = openAt(t);
      const R = rib(o);
      runner.position.y = R.Rn[1];
      const pos = panelGeo.attributes.position;
      const tips = [];
      for (let k = 0; k < Z.ribs; k++) {
        const a = (k / Z.ribs) * TAU;
        const c = Math.cos(a);
        const sn = Math.sin(a);
        const W3 = (p) => [p[0] * c, p[1], p[0] * sn];
        K.place(ribs[k].rib, W3(R.T), W3(R.tip), [0, 1, 0]);
        K.place(ribs[k].str, W3(R.Rn), W3(R.S), [0, 1, 0]);
        ribs[k].tip.position.set(...W3(R.tip));
        tips.push(W3(R.tip));
      }
      for (let k = 0; k < Z.ribs; k++) {
        const a = tips[k];
        const b = tips[(k + 1) % Z.ribs];
        pos.setXYZ(k * 3, 0, Z.top + 0.05, 0);
        pos.setXYZ(k * 3 + 1, ...a);
        pos.setXYZ(k * 3 + 2, ...b);
      }
      pos.needsUpdate = true;
      panelGeo.computeVertexNormals();
      panelGeo.computeBoundingSphere();
      // bolts: each leaves a rib tip in turn, arcing out toward the target ring
      BOLTS.forEach((tb, i) => {
        const tau = t - tb;
        bolts[i].visible = tau >= 0 && tau < 1.6 && o > 0.9;
        if (!bolts[i].visible) return;
        const k = i % Z.ribs;
        const a = (k / Z.ribs) * TAU - B.h;
        const r0 = R.tip[0];
        const r = r0 + tau * 7;
        bolts[i].position.set(B.x + Math.cos(a) * r, R.tip[1] + tau * 1.5 - 2.4 * tau * tau, B.z + Math.sin(a) * r);
      });
      return {o, R, s};
    },
  };
}

const BEATS = [
  {t: 0, mode: 'GLIDING', cap: 'ZL-7 · THREE OMNI WHEELS · IT SLIDES SIDEWAYS WHILE IT TURNS'},
  {t: 5, mode: 'WARDING', cap: 'THE RUNNER CLIMBS THE SHAFT AND THE STRETCHERS OPEN THE RIBS: A WARD OVER ITS ALLIES'},
  {t: 8, mode: 'CHANTING', cap: 'BOLTS LEAVE THE RIB TIPS IN TURN'},
  {t: 15, mode: 'FURLING', cap: 'THE RUNNER DROPS AND THE RIBS HANG STRAIGHT'},
];
const CAM = [
  [0, [0.9, 1.6, 0.6, 50, 14, 10]],
  [4.8, [1.75, 2.2, 1.25, 70, 16, 11]],
  [7.6, [1.75, 2.6, 1.25, 80, 28, 12]],
  [15, [1.75, 2.6, 1.25, 120, 26, 12]],
  [18, [1.75, 2.2, 1.25, 140, 16, 10]],
];

export function run() {
  runSim({duration: DURATION, fps: 60, theme: 'light', hud: {enabled: false}, director: {enabled: false}, watermark: ''}, ({canvas, capture}) => {
    const st = studio(canvas, {capture, shadow: 7, fog: [30, 110]});
    const ze = build(st.scene);
    // two sheltered mites under the ward (simple bodies)
    const m = materials();
    for (const [x, z] of [[1.0, 2.6], [2.9, 0.4]]) {
      const b = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.3, 4, 12).rotateX(Math.PI / 2), m.flesh);
      b.position.set(x, 1.0, z);
      b.castShadow = true;
      st.scene.add(b);
    }
    const ui = consoleUI(document.getElementById('app'), {code: 'ZL-7', eyebrow: 'RUINS ELITE · SHIELDS ITS ALLIES, CHANTS BOLTS', title: 'Cantor ZL-7'});
    return {
      resize: st.resize,
      render(t) {
        const S = ze.update(t);
        const [x, y, z, az, el, dist] = keyed(CAM, t, sm);
        st.aim([x, y, z], az, el, dist);
        st.render();
        const bi = BEATS.reduce((k, b, i) => (t >= b.t ? i : k), 0);
        ui.set({
          cap: BEATS[bi].cap,
          n: bi + 1,
          mode: BEATS[bi].mode,
          right: `WARD ${(S.R.tip[0] * 2).toFixed(1)} m`,
          rows: [
            ['RUNNER', `${S.R.Rn[1].toFixed(2)} m`],
            ['RIB DROOP', `${((S.R.droop * 180) / Math.PI).toFixed(0)}°`],
            ['WHEEL A', `${S.s[0].toFixed(2)} m/s`],
            ['WHEEL B', `${S.s[1].toFixed(2)} m/s`],
            ['WHEEL C', `${S.s[2].toFixed(2)} m/s`],
          ],
          barsTitle: 'WARD',
          bars: [['OPEN', S.o]],
          subs: [
            ['Omni base ×3', t < 5 ? 'DRIVING' : 'HOLD', bi === 0],
            ['Runner · stretchers', S.o > 0.02 && S.o < 0.98 ? 'MOVING' : 'LOCKED', bi === 1 || bi === 3],
            ['Ward', S.o > 0.9 ? 'RAISED' : 'FURLED', bi === 1],
            ['Bolts', bi === 2 ? 'CHANTING' : '-', bi === 2],
          ],
        });
        return {};
      },
    };
  });
}
