// TREACHERY study: geometry and film. A lake in a snow bowl, cut into a centre disc and four rings of floes (1 m slabs
// floating with 8.3 cm showing); outboard motors set in the ring cuts; the Companion as a stack of pale rings. Film,
// 28 s: the whole lake, the Companion rising, the carousel turning, then the rings drifting out and counter-turning on
// their motors, and dives that hold a floe under. render(t) is pure.
import * as THREE from 'three';
import {runSim} from '../kit/runtime.js';
import {keyed} from '../kit/util.js';
import {partsKit} from '../slumber-kit/parts.js';
import {consoleUI, materials, studio} from '../slumber-kit/studio.js';
import {floe, FREEBOARD, innerGap, pushForce, T, TAU} from './kin.js';

export const DURATION = 28;
const sm = (u) => {
  const x = Math.min(1, Math.max(0, u));
  return x * x * x * (x * (x * 6 - 15) + 10);
};
const driftAt = (t) => sm((t - 16) / 3);
const turnAt = (k, t) => T.together * Math.max(0, Math.min(t, 16) - 10) + (k % 2 ? 1 : -1) * T.omega * Math.max(0, t - 17) * sm((t - 17) / 2);
const riseAt = (t) => sm((t - 4) / 5);
// dives: every 8 s from 19 s, on a ring-two floe; 1 s down, 3 s held, 1 s up
const DIVES = [19, 27].filter((d) => d < 28);
function diveAt(t) {
  for (const [i, d] of DIVES.entries()) {
    const u = t - d;
    if (u >= -1 && u <= T.diveHold + 1) return {i, j: (3 + 4 * i) % T.rings[2].n, f: sm(u + 1) * (1 - sm(u - T.diveHold)), u};
  }
  return null;
}

function build(scene) {
  const mat = materials();
  mat.ice = new THREE.MeshStandardMaterial({color: '#dbeef6', emissive: new THREE.Color('#9cc4d8'), emissiveIntensity: 0.12, roughness: 0.35});
  mat.water = new THREE.MeshStandardMaterial({color: '#13212b', roughness: 0.1, metalness: 0.2});
  mat.snow = new THREE.MeshStandardMaterial({color: '#eef3f5', roughness: 0.9, side: THREE.BackSide});
  mat.wraith = new THREE.MeshStandardMaterial({color: '#e7eef3', emissive: new THREE.Color('#b9d6ea'), emissiveIntensity: 0.4, transparent: true, opacity: 0.8});
  const root = new THREE.Group();
  scene.add(root);
  const K = partsKit(root, mat);
  K.mesh(new THREE.CircleGeometry(40, 72).rotateX(-Math.PI / 2).translate(0, 0.03, 0), mat.water, root); // clear of the studio ground (no depth fight)
  const prof = [];
  for (let i = 0; i <= 12; i++) {
    const r = 36 + i;
    prof.push(new THREE.Vector2(r, ((r - 36) / 12) ** 2 * 9));
  }
  K.mesh(new THREE.LatheGeometry(prof, 72), mat.snow, root);
  // floes
  const floes = [];
  T.rings.forEach((R, k) => {
    for (let j = 0; j < R.n; j++) {
      const s = new THREE.Shape();
      const h = Math.PI / R.n - (R.n > 1 ? 0.004 : 0);
      if (R.n === 1) s.absarc(0, 0, R.r1 - 0.05, 0, TAU, false);
      else {
        s.absarc(0, 0, R.r1 - 0.05, -h, h, false);
        s.absarc(0, 0, R.r0 + 0.05, h, -h, true);
      }
      const geo = new THREE.ExtrudeGeometry(s, {depth: T.thick, bevelEnabled: false, curveSegments: 24}).rotateX(Math.PI / 2).translate(0, FREEBOARD, 0);
      const g = new THREE.Group();
      root.add(g);
      K.mesh(geo, mat.ice, g);
      let motor = null;
      if (k > 0 && j === 0) {
        motor = new THREE.Group();
        motor.position.set(R.r0 + 0.6, FREEBOARD, 0);
        g.add(motor);
        K.mesh(new THREE.BoxGeometry(0.6, 0.9, 0.5).translate(0, 0.45, 0), mat.dark, motor);
        K.mesh(new THREE.BoxGeometry(0.15, 1.4, 0.15).translate(-0.55, -0.4, 0), mat.steel, motor);
        const prop = new THREE.Group();
        prop.position.set(-0.55, -1.1, 0);
        motor.add(prop);
        for (let b = 0; b < 3; b++) K.mesh(new THREE.BoxGeometry(0.06, 0.5, 0.12).rotateX((b / 3) * TAU), mat.accent, prop);
        motor.userData.prop = prop;
      }
      floes.push({k, j, g, motor});
    }
  });
  // the Companion: a stack of pale rings
  const comp = new THREE.Group();
  root.add(comp);
  for (let i = 0; i < 7; i++) {
    const r = 1.6 - i * 0.16;
    K.mesh(new THREE.TorusGeometry(r, 0.18, 10, 32).rotateX(Math.PI / 2).translate(0, i * 0.7, 0), mat.wraith, comp);
  }
  K.mesh(new THREE.SphereGeometry(0.35, 14, 10).translate(0, 1.2, 0), mat.accent, comp);
  return {
    update(t) {
      const dr = driftAt(t);
      const dv = diveAt(t);
      for (const F of floes) {
        const f = floe(F.k, F.j, dr, turnAt(F.k, t));
        F.g.rotation.y = -f.a;
        F.g.position.set(f.off[0], 0, f.off[1]);
        const isDive = dv && F.k === 2 && F.j === dv.j;
        F.g.position.y = isDive ? -(T.thick + 0.3) * dv.f : 0;
        if (F.motor) {
          F.motor.visible = t > 16;
          F.motor.userData.prop.rotation.x = t * 30;
        }
      }
      // the Companion: rises at the centre, circles in phase 1, dives on a floe in phase 2
      const rise = riseAt(t);
      let p = [0, -8 + 12 * rise, 0];
      if (t > 10) {
        const a = (t - 10) * 0.5;
        p = [9 * Math.cos(a), 4, 9 * Math.sin(a)];
      }
      if (dv) {
        const f = floe(2, dv.j, dr, turnAt(2, t));
        const target = [f.rMid * Math.cos(f.a), 1.4 - (T.thick + 0.3) * dv.f, f.rMid * Math.sin(f.a)];
        const k = sm(dv.u + 1);
        p = p.map((v, i) => v + (target[i] - v) * k);
      }
      comp.position.set(...p);
      comp.rotation.y = t * 0.8;
      return {dr, dv, rise};
    },
  };
}

const STAGES = [
  {t: 0, s: 'RUN', cap: 'TREACHERY · A FROZEN LAKE, ALREADY CUT INTO A DISC AND FOUR RINGS OF FLOES · 1 M OF ICE SHOWS 8.3 CM'},
  {t: 4, s: 'ARRIVAL', cap: 'THE COMPANION FORMS OUT OF THE COLD AT THE CENTRE'},
  {t: 10, s: 'PHASE 1', cap: 'THE LAKE IS AN ICE CAROUSEL · IT TURNS AS ONE WHILE THE COMPANION CIRCLES WITH YOU'},
  {t: 16, s: 'PHASE 2', cap: 'RING k DRIFTS OUT k GAPS AND THE RINGS COUNTER-TURN ON THEIR MOTORS · A DIVE HOLDS A FLOE UNDER: 46 kN'},
];
const CAM = [
  [0, [0, 0, 0, 30, 38, 82]],
  [9.6, [0, 2, 0, 60, 30, 70]],
  [15.6, [0, 0, 0, 100, 44, 74]],
  [18.6, [0, 0, 0, 120, 50, 80]],
  [28, [0, 0, 0, 170, 40, 70]],
];

export function run() {
  runSim({duration: DURATION, fps: 60, theme: 'light', hud: {enabled: false}, director: {enabled: false}, watermark: ''}, ({canvas, capture}) => {
    const st = studio(canvas, {capture, shadow: 44, fog: [120, 320]});
    st.camera.near = 1; // depth precision for the water against the studio ground at 80 m
    st.camera.far = 1500;
    st.camera.updateProjectionMatrix();
    const v = build(st.scene);
    const ui = consoleUI(document.getElementById('app'), {code: 'TR-9', eyebrow: 'STAGE STUDY · LAYER 9 · TREACHERY · AFTER THE FINNISH ICE CAROUSEL', title: 'Treachery'});
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
          right: S.dv && S.dv.f > 0.5 ? `HOLDING FLOE UNDER · ${(pushForce(2) / 1000).toFixed(0)} kN` : `DRIFT ${(S.dr * 100).toFixed(0)} %`,
          rows: [
            ['ICE', `${T.rhoI} kg/m³ on ${T.rhoW}`],
            ['FREEBOARD', `${(FREEBOARD * 100).toFixed(1)} cm of ${T.thick} m`],
            ['RING GAP', `${(S.dr * T.gap).toFixed(2)} m`],
            ['FLOE GAP', `ring 4: ${innerGap(4, S.dr * 4 * T.gap).toFixed(2)} m`],
            ['PUSH', `${(pushForce(2) / 1000).toFixed(1)} kN to hold under`],
          ],
          barsTitle: 'STAGE',
          bars: [['RISE', S.rise], ['DRIFT', S.dr], ['DIVE', S.dv ? S.dv.f : 0]],
          subs: [
            ['Floes ×49', bi === 3 ? 'DRIFTING' : bi === 2 ? 'TURNING' : 'FROZEN', bi >= 2],
            ['Motors ×4', t > 16 ? 'RUNNING' : '-', bi === 3],
            ['Companion', S.dv ? 'DIVING' : bi === 1 ? 'FORMING' : bi === 2 ? 'BESIDE YOU' : bi === 3 ? 'TURNED' : '-', bi === 1 || !!S.dv],
          ],
        });
        return {};
      },
    };
  });
}
