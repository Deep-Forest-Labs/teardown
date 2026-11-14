// SWEEPER DV-2: geometry and film. A segmented flesh fuselage with gaskets and a nose optic, plated wings on glove
// pivots, a screw jack per wing (barrel and rod between the anchor and the wing-root horn), fins. It flies nose along
// its velocity, banked by its turn. Film, 14 s: circling and marking the player, the sweep (jacks isolated), the dive
// through the mark, the pull-out. render(t) is pure.
import * as THREE from 'three';
import {runSim} from '../kit/runtime.js';
import {keyed} from '../kit/util.js';
import {partsKit} from '../slumber-kit/parts.js';
import {consoleUI, materials, studio} from '../slumber-kit/studio.js';
import {D, pathAt, SCRIPT, sweepAt, wingJack} from './kin.js';

export const DURATION = 14;
const sm = (u) => {
  const x = Math.min(1, Math.max(0, u));
  return x * x * x * (x * (x * 6 - 15) + 10);
};

function wingGeo() {
  // tapered plated planform in its own frame: span along +x, chord back along -z, leading edge swept a little
  const {span, root, tip} = D.wing;
  const s = new THREE.Shape();
  s.moveTo(0, 0.1);
  s.lineTo(span, -0.25);
  s.lineTo(span, -0.25 - tip);
  s.lineTo(0, -root + 0.1);
  s.closePath();
  return new THREE.ExtrudeGeometry(s, {depth: 0.07, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 2}).rotateX(Math.PI / 2).translate(0, 0.035, 0);
}

function build(scene) {
  const mat = materials();
  mat.beam = new THREE.MeshBasicMaterial({color: '#ff3a1c', transparent: true, opacity: 0.55});
  const root = new THREE.Group();
  scene.add(root);
  const K = partsKit(root, mat);
  const craft = new THREE.Group(); // the airframe, posed as a whole
  root.add(craft);
  const K2 = partsKit(craft, mat);
  // fuselage: three flesh capsule segments with dark gaskets, a nose optic, a tail cone
  [[0.55, 0.36, 0.7], [-0.15, 0.4, 0.8], [-0.95, 0.3, 0.7]].forEach(([z, r, l]) => {
    K2.mesh(new THREE.CapsuleGeometry(r, l, 6, 24).rotateX(Math.PI / 2).translate(0, 0, z), mat.flesh, craft);
  });
  for (const z of [0.18, -0.55]) K2.mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.06, 28).rotateX(Math.PI / 2).translate(0, 0, z), mat.dark, craft);
  K2.mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.12, 24).rotateX(Math.PI / 2).translate(0, 0.05, 1.12), mat.bone, craft);
  K2.mesh(new THREE.TorusGeometry(0.14, 0.02, 8, 24).translate(0, 0.05, 1.18), mat.accent, craft);
  K2.mesh(new THREE.CircleGeometry(0.12, 24).translate(0, 0.05, 1.185), new THREE.MeshPhysicalMaterial({color: '#141315', clearcoat: 1, roughness: 0.06}), craft);
  for (const sx of [-1, 1]) K2.mesh(new THREE.BoxGeometry(0.04, 0.5, 0.45).translate(sx * 0.18, 0.32, -1.25).rotateZ(sx * 0.35), mat.fleshDeep, craft);
  // wings on their gloves, each with its jack
  const wings = [-1, 1].map((sx) => {
    const piv = new THREE.Group();
    craft.add(piv);
    piv.position.set(sx * D.pivotX, 0, D.pivotZ);
    const w = K2.mesh(wingGeo(), mat.flesh, piv);
    w.scale.x = sx;
    // ribs: dark lines across the chord, an accent edge
    for (let k = 1; k <= 5; k++) K2.mesh(new THREE.BoxGeometry(0.02, 0.09, 0.6 - k * 0.05).translate(sx * (k * D.wing.span) / 6, 0.035, -0.32 - k * 0.04), mat.dark, piv);
    K2.mesh(new THREE.BoxGeometry(D.wing.span, 0.03, 0.04).translate((sx * D.wing.span) / 2, 0.06, 0.08 - 0.17), mat.accent, piv).rotation.y = 0;
    K2.mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.16, 20), mat.dark, piv); // glove pivot drum
    return {piv, sx, barrel: K2.housing(0.08, 0.08, {stripe: false, m: mat.dark}), rod: K2.housing(0.045, 0.045, {stripe: false, m: mat.steel})};
  });
  const beam = K.mesh(new THREE.CylinderGeometry(0.04, 0.04, 1, 8), mat.beam, root);
  const mark = K.mesh(new THREE.RingGeometry(0.6, 0.8, 32).rotateX(-Math.PI / 2), mat.beam, root);
  return {
    update(t) {
      const p = pathAt(t);
      const q = pathAt(t + 0.01);
      const r = pathAt(t - 0.01);
      const v = new THREE.Vector3(q[0] - r[0], q[1] - r[1], q[2] - r[2]).normalize();
      const acc = new THREE.Vector3(q[0] - 2 * p[0] + r[0], q[1] - 2 * p[1] + r[1], q[2] - 2 * p[2] + r[2]);
      craft.position.set(...p);
      // nose along velocity; bank into the turn (the sideways part of the acceleration)
      const up0 = new THREE.Vector3(0, 1, 0).addScaledVector(acc.clone().addScaledVector(v, -acc.dot(v)), 900).normalize();
      const xAx = new THREE.Vector3().crossVectors(up0, v).normalize();
      const yAx = new THREE.Vector3().crossVectors(v, xAx);
      craft.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(xAx, yAx, v));
      const s = sweepAt(t);
      wings.forEach((W) => {
        W.piv.rotation.y = W.sx * ((s - 20) * Math.PI) / 180;
        const J = wingJack(W.sx, s);
        const mid = J.anchor.map((a, i) => a + (J.horn[i] - a) * 0.55);
        K2.place(W.barrel, J.anchor, mid, [0, 1, 0]);
        K2.place(W.rod, mid, J.horn, [0, 1, 0]);
      });
      const marking = t < SCRIPT.mark[1];
      beam.visible = marking;
      mark.visible = t < SCRIPT.dive[1];
      if (marking) {
        const a = new THREE.Vector3(...p);
        const b = new THREE.Vector3(...D.target);
        beam.position.copy(a).add(b).multiplyScalar(0.5);
        beam.scale.y = a.distanceTo(b);
        beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
      }
      mark.position.set(D.target[0], 0.02, D.target[2]);
      return {p, s};
    },
  };
}

const BEATS = [
  {t: 0, mode: 'MARKING', cap: 'DV-2 · IT CIRCLES HIGH AND HOLDS A BEAM ON YOUR TIER (THE TELL)'},
  {t: 7, mode: 'SWEEP', cap: 'F-14 SWEEP · SCREW JACKS SWING THE WINGS FROM 20° TO 68° ON THEIR GLOVES'},
  {t: 8.6, mode: 'DIVE', cap: 'IT DIVES ON A CURVE THROUGH THE MARK, 1.2 M OVER IT'},
  {t: 10.8, mode: 'PULL OUT', cap: 'WINGS SPREAD AGAIN AND IT CLIMBS AWAY ALONG THE SAME LINE'},
];

export function run() {
  runSim({duration: DURATION, fps: 60, theme: 'light', hud: {enabled: false}, director: {enabled: false}, watermark: ''}, ({canvas, capture}) => {
    const st = studio(canvas, {capture, shadow: 14, fog: [60, 180]});
    const dv = build(st.scene);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.35, 1.8, 20).translate(0, 0.9, 0), new THREE.MeshStandardMaterial({color: '#cfc6b6', roughness: 0.8}));
    post.position.set(D.target[0], 0, D.target[2]);
    post.castShadow = true;
    st.scene.add(post);
    const ui = consoleUI(document.getElementById('app'), {code: 'DV-2', eyebrow: 'VOID ELITE · MARKS YOUR TIER, THEN DIVES', title: 'Sweeper DV-2'});
    return {
      resize: st.resize,
      render(t) {
        const S = dv.update(t);
        // camera: wide on the circle; on the craft for the sweep; low by the mark for the dive
        const wide = [D.target[0], 9.5, D.target[2], 40 + t * 4, 16, 44];
        const onCraft = [S.p[0], S.p[1], S.p[2], 70 + t * 10, 12, 7];
        const low = [D.target[0], 2.5, D.target[2], 120, 6, 16];
        const k1 = Math.min(sm((t - 6.8) / 0.6), 1 - sm((t - 8.4) / 0.4));
        const k2 = sm((t - 8.6) / 0.6);
        const cam = wide.map((w, i) => w + (onCraft[i] - w) * k1);
        const cam2a = cam.map((c, i) => c + (low[i] - c) * k2);
        // the pull-out follows the craft away
        const k3 = sm((t - 10.9) / 0.9);
        const follow = [S.p[0], S.p[1], S.p[2], 140, 10, 16];
        const cam2 = cam2a.map((c, i) => c + (follow[i] - c) * k3);
        st.aim(cam2.slice(0, 3), cam2[3], cam2[4], cam2[5]);
        st.render();
        const bi = BEATS.reduce((k, b, i) => (t >= b.t ? i : k), 0);
        const J = wingJack(1, S.s);
        const v = Math.hypot(...[0, 1, 2].map((i) => pathAt(t + 0.01)[i] - pathAt(t - 0.01)[i])) / 0.02;
        ui.set({
          cap: BEATS[bi].cap,
          n: bi + 1,
          mode: BEATS[bi].mode,
          right: `ALT ${S.p[1].toFixed(1)} m`,
          rows: [
            ['SWEEP', `${S.s.toFixed(1)}°`],
            ['JACK', `${(J.len * 1000).toFixed(0)} mm`],
            ['SPEED', `${v.toFixed(1)} m/s`],
            ['TO MARK', `${Math.hypot(S.p[0] - D.target[0], S.p[2] - D.target[2]).toFixed(1)} m`],
          ],
          barsTitle: 'SWEEP',
          bars: [['WING', (S.s - 20) / 48]],
          subs: [
            ['Marker beam', t < SCRIPT.mark[1] ? 'ON YOU' : 'OFF', bi === 0],
            ['Wings · gloves', S.s > 60 ? 'SWEPT' : 'SPREAD', bi === 1],
            ['Screw jacks ×2', Math.abs(sweepAt(t + 0.05) - S.s) > 0.01 ? 'DRIVING' : 'HOLD', bi === 1],
            ['Airframe', bi === 2 ? 'DIVING' : 'FLYING', bi === 2],
          ],
        });
        void keyed;
        return {};
      },
    };
  });
}
