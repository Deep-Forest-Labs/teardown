// FILCH IM-2: geometry and film. A low flesh chassis on six whegs (two tripods 60° apart, three spokes each with a
// foot pad), a loot sack on its back, a head with two optics, the lazy-tong grabber with a two-finger jaw. Film, 16 s:
// scuttling in, the tong shooting out to snatch an orb, the orb into the sack, fleeing at full speed. render(t) pure.
import * as THREE from 'three';
import {runSim} from '../kit/runtime.js';
import {keyed} from '../kit/util.js';
import {partsKit} from '../slumber-kit/parts.js';
import {consoleUI, materials, studio} from '../slumber-kit/studio.js';
import {body, tong, W} from './kin.js';

export const DURATION = 16;
const TAU = Math.PI * 2;
const sm = (u) => {
  const x = Math.min(1, Math.max(0, u));
  return x * x * x * (x * (x * 6 - 15) + 10);
};
// wheg shaft angle in closed form: 4 rad/s until 5 s, stop until 9.5 s, then 14 rad/s (fleeing) after a ramp
const phiAt = (t) => {
  if (t < 5) return 4 * t;
  if (t < 9.5) return 20;
  const u = t - 9.5;
  return 20 + (u < 0.6 ? 14 * (u * u) / (2 * 0.6) : 14 * (0.3 + (u - 0.6)));
};
const extAt = (t) => keyed([[0, 0], [5.4, 0], [6.4, 1], [6.9, 1], [8.0, 0], [16, 0]], t, sm);
const ORB = (() => {
  const B = body(20);
  return [B.x + 0.44 + tong(1).reach + 0.06, B.y + 0.02 - 0.04, 0]; // exactly where the jaw shuts at full stretch
})();

function build(scene) {
  const mat = materials();
  mat.orb = new THREE.MeshStandardMaterial({color: '#8fd4ff', emissive: new THREE.Color('#8fd4ff'), emissiveIntensity: 0.7});
  const root = new THREE.Group();
  scene.add(root);
  const chassis = new THREE.Group();
  root.add(chassis);
  const K = partsKit(chassis, mat);
  K.mesh(new THREE.CapsuleGeometry(0.16, 0.5, 6, 18).rotateZ(Math.PI / 2), mat.flesh, chassis);
  K.mesh(new THREE.BoxGeometry(0.62, 0.05, 0.42), mat.dark, chassis).position.y = -0.06;
  const sack = K.mesh(new THREE.SphereGeometry(0.2, 18, 12).scale(1, 0.85, 1), mat.fleshDeep, chassis);
  sack.position.set(-0.12, 0.24, 0);
  K.mesh(new THREE.TorusGeometry(0.08, 0.015, 6, 16).rotateX(Math.PI / 2).translate(-0.12, 0.42, 0), mat.accent, chassis);
  const head = new THREE.Group();
  head.position.set(0.36, 0.04, 0);
  chassis.add(head);
  K.mesh(new THREE.SphereGeometry(0.11, 16, 12), mat.flesh, head);
  for (const sz of [-1, 1]) {
    K.mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.04, 14).rotateZ(Math.PI / 2).translate(0.09, 0.04, sz * 0.05), mat.bone, head);
    K.mesh(new THREE.CircleGeometry(0.025, 14).rotateY(Math.PI / 2).translate(0.112, 0.04, sz * 0.05), new THREE.MeshPhysicalMaterial({color: '#151416', clearcoat: 1}), head);
  }
  // whegs: three per side; tripod A = front-left, mid-right, back-left
  const whegs = [];
  for (const [x, sz, tri] of [[0.24, -1, 0], [0, 1, 0], [-0.24, -1, 0], [0.24, 1, 1], [0, -1, 1], [-0.24, 1, 1]]) {
    const g = new THREE.Group();
    g.position.set(x, 0, sz * 0.27);
    chassis.add(g);
    K.mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.06, 12).rotateX(Math.PI / 2), mat.dark, g);
    for (let k = 0; k < W.spokes; k++) {
      const a = (k / W.spokes) * TAU;
      const sp = new THREE.Group();
      sp.rotation.z = a;
      g.add(sp);
      K.mesh(new THREE.BoxGeometry(0.035, W.R, 0.03).translate(0, -W.R / 2, 0), mat.bone, sp);
      K.mesh(new THREE.SphereGeometry(0.03, 10, 8).translate(0, -W.R, 0), mat.accent, sp);
    }
    whegs.push({g, tri});
  }
  // the lazy tong from the chin: links in the x-y plane, a jaw at the end
  const tongG = new THREE.Group();
  tongG.position.set(0.44, -0.04, 0);
  chassis.add(tongG);
  const links = Array.from({length: W.cells * 2}, () => K.housing(0.018, 0.012, {stripe: false, m: mat.steel}));
  links.forEach((l) => tongG.add(l));
  const jaw = [-1, 1].map(() => {
    const f = K.mesh(new THREE.BoxGeometry(0.08, 0.015, 0.02), mat.dark, tongG);
    return f;
  });
  const orb = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 12), mat.orb);
  root.add(orb);
  return {
    update(t) {
      const phi = phiAt(t);
      const B = body(phi);
      chassis.position.set(B.x, B.y + 0.02, 0);
      whegs.forEach((w) => (w.g.rotation.z = -(phi + (w.tri ? TAU / 6 : 0))));
      const e = extAt(t);
      const T = tong(e);
      // links: for cell i, the two crossing links (local x forward, y up)
      for (let i = 0; i < W.cells; i++) {
        for (const s of [-1, 1]) {
          const a = [i * T.cell, s * T.half, 0];
          const b = [(i + 1) * T.cell, -s * T.half, 0];
          K.place(links[i * 2 + (s > 0 ? 1 : 0)], a, b, [0, 0, 1]);
        }
      }
      const shut = t > 6.6 ? 1 : 0;
      jaw.forEach((f, i) => {
        f.position.set(T.reach + 0.04, (i ? 1 : -1) * (0.04 - 0.03 * shut), 0);
        f.rotation.z = (i ? -1 : 1) * (0.5 - 0.45 * shut);
      });
      // the orb: on the floor, then in the jaw, then into the sack
      const tipW = [B.x + 0.44 + T.reach + 0.06, B.y + 0.02 - 0.04, 0];
      if (t < 6.6) orb.position.set(...ORB);
      else if (t < 8.2) orb.position.set(...tipW);
      else orb.visible = false;
      return {phi, B, e, T};
    },
  };
}

const BEATS = [
  {t: 0, mode: 'SCUTTLING', cap: 'IM-2 · SIX WHEGS, TWO TRIPODS 60° APART · EACH ROLLS ON ITS SPOKE TIP'},
  {t: 5.2, mode: 'SNATCH', cap: 'A LAZY-TONG GRABBER SHOOTS OUT, SHUTS ON THE ORB AND REELS IT IN'},
  {t: 8.2, mode: 'POCKETED', cap: 'INTO THE SACK'},
  {t: 9.5, mode: 'FLEEING', cap: 'IT BOLTS AT THREE AND A HALF TIMES THE SPEED · CATCH IT OR LOSE IT'},
];

export function run() {
  runSim({duration: DURATION, fps: 60, theme: 'light', hud: {enabled: false}, director: {enabled: false}, watermark: ''}, ({canvas, capture}) => {
    const st = studio(canvas, {capture, shadow: 3, fog: [15, 60]});
    const im = build(st.scene);
    const ui = consoleUI(document.getElementById('app'), {code: 'IM-2', eyebrow: 'GREED ELITE · SNATCHES ORBS AND CREDITS, THEN FLEES', title: 'Filch IM-2'});
    return {
      resize: st.resize,
      render(t) {
        const S = im.update(t);
        const cx = S.B.x + 0.3;
        const close = Math.min(sm((t - 5) / 0.6), 1 - sm((t - 8.4) / 0.6));
        st.aim([cx, 0.2, 0], 60 - 30 * close + (t > 9.5 ? (t - 9.5) * 6 : 0), 12 + 6 * close, 3.2 - 1.4 * close + (t > 9.5 ? (t - 9.5) * 0.9 : 0));
        st.render();
        const bi = BEATS.reduce((k, b, i) => (t >= b.t ? i : k), 0);
        ui.set({
          cap: BEATS[bi].cap,
          n: bi + 1,
          mode: BEATS[bi].mode,
          right: `RAN ${S.B.x.toFixed(1)} m`,
          rows: [
            ['WHEG', `${Math.round(((S.phi * 180) / Math.PI) % 360)}°`],
            ['CARRYING', `TRIPOD ${S.B.carry}`],
            ['BOB', `${((W.R - S.B.y) * 100).toFixed(1)} cm`],
            ['TONG', `${(S.T.reach * 100).toFixed(0)} cm`],
          ],
          barsTitle: 'REACH',
          bars: [['TONG', S.e]],
          subs: [
            ['Whegs ×6', t > 9.5 ? 'BOLTING' : t < 5 ? 'ROLLING' : 'HOLD', bi === 0 || bi === 3],
            ['Lazy tong', S.e > 0.02 ? 'EXTENDED' : 'STOWED', bi === 1],
            ['Sack', t > 8.2 ? '1 ORB' : 'EMPTY', bi === 2],
          ],
        });
        return {};
      },
    };
  });
}
