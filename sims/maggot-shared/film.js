// GLUTTON MG-1: geometry and film. Flesh barrel segments with dark gasket rings and accent bands, a head with a
// toothed grinder ring and a ring of mandible teeth; corpses on the floor ahead. Film, 20 s: crawling, eating the first
// corpse (a new telescopic stage slides out, the body steps up a size), two more meals, the gait close up.
// The distance crawled is integrated once at load (speed ∝ size) so render(t) stays pure.
import * as THREE from 'three';
import {runSim} from '../kit/runtime.js';
import {keyed} from '../kit/util.js';
import {gear, consoleUI, materials, studio} from '../slumber-kit/studio.js';
import {G} from './kin.js';

export const DURATION = 20;
const sm = (u) => {
  const x = Math.min(1, Math.max(0, u));
  return x * x * x * (x * (x * 6 - 15) + 10);
};
const MEALS = [5, 10, 15]; // a meal starts at these times; growth takes 1.4 s
const mealsAt = (t) => MEALS.reduce((m, tm) => m + sm((t - tm) / 1.4), 0);
const sizeAt = (t) => 1 + G.sizeStep * mealsAt(t);
// distance crawled: ∫ A·s(t)·ω dt, tabulated
const DT = 1 / 240;
const DIST = [0];
for (let k = 1; k <= DURATION / DT + 2; k++) DIST.push(DIST[k - 1] + G.A * sizeAt((k - 0.5) * DT) * G.w * DT);
const distAt = (t) => {
  const u = Math.min(Math.max(t, 0), DURATION) / DT;
  const n = Math.floor(u);
  return DIST[n] + (DIST[n + 1] - DIST[n]) * (u - n);
};
const boundary = (j, t) => {
  const s = sizeAt(t);
  return distAt(t) - j * G.L * s + G.A * s * Math.sin(G.w * t + j * G.phi);
};
// corpses lie where the head will be when each meal starts
const CORPSES = MEALS.map((tm) => boundary(0, tm) + 0.25);

function build(scene) {
  const mat = materials();
  const root = new THREE.Group();
  scene.add(root);
  const add = (geo, m, p = root) => {
    const o = new THREE.Mesh(geo, m);
    o.castShadow = true;
    o.receiveShadow = true;
    p.add(o);
    return o;
  };
  const MAXN = G.baseSegs + 4;
  // one unit barrel per segment (radius 1, length 1 along +x), scaled each frame
  const barrel = new THREE.LatheGeometry([[0.001, -0.5], [0.8, -0.5], [1, -0.32], [1, 0.32], [0.8, 0.5], [0.001, 0.5]].map(([r, y]) => new THREE.Vector2(r, y)), 28).rotateZ(-Math.PI / 2);
  const segs = Array.from({length: MAXN}, (_, i) => ({
    body: add(barrel, i % 2 ? mat.flesh : mat.fleshDeep),
    gasket: add(new THREE.TorusGeometry(1, 0.06, 6, 28).rotateY(Math.PI / 2), mat.dark),
    band: add(new THREE.TorusGeometry(1, 0.035, 6, 28).rotateY(Math.PI / 2), mat.accent),
  }));
  // head: a cone with the grinder ring and mandible teeth
  const head = new THREE.Group();
  root.add(head);
  // the mouth: a flared collar open to the front, the grinder turning inside its rim
  add(new THREE.CylinderGeometry(1.05, 0.85, 0.7, 28, 1, true).rotateZ(-Math.PI / 2).translate(0.35, 0, 0), mat.flesh, head).material.side = THREE.DoubleSide;
  add(new THREE.TorusGeometry(1.03, 0.07, 8, 32).rotateY(Math.PI / 2).translate(0.7, 0, 0), mat.accent, head);
  const grinder = add(gear(0.62, 18, 0.18, 0.55), mat.bone, head);
  grinder.rotation.y = Math.PI / 2;
  grinder.position.x = 0.5;
  for (let k = 0; k < 8; k++) {
    const tooth = add(new THREE.ConeGeometry(0.1, 0.4, 6).rotateZ(-Math.PI / 2), mat.dark, head);
    const a = (k / 8) * Math.PI * 2;
    tooth.position.set(0.72, Math.cos(a) * 0.82, Math.sin(a) * 0.82);
    tooth.rotation.set(a, 0, -0.5);
  }
  const corpses = CORPSES.map(() => add(new THREE.DodecahedronGeometry(0.32, 0), mat.fleshDeep));
  return {
    update(t) {
      const s = sizeAt(t);
      const m = mealsAt(t);
      const nFull = G.baseSegs + Math.floor(m + 1e-9);
      const frac = m - Math.floor(m + 1e-9);
      const n = nFull + (frac > 1e-3 ? 1 : 0);
      const xs = Array.from({length: n + 1}, (_, j) => boundary(j, t));
      segs.forEach((S, j) => {
        const vis = j < n;
        S.body.visible = S.gasket.visible = S.band.visible = vis;
        if (!vis) return;
        let len = xs[j] - xs[j + 1];
        let x0 = xs[j + 1];
        if (j === n - 1 && frac > 1e-3) {
          // the newest stage slides out of the last one
          x0 += (1 - frac) * len;
          len *= frac;
        }
        const r = G.r * s * (1 + (0.6 * (G.L * s - (xs[j] - xs[j + 1]))) / (G.L * s)) * (j === n - 1 ? 0.85 : 1);
        S.body.position.set(x0 + len / 2, r, 0);
        S.body.scale.set(len, r, r);
        S.gasket.position.set(x0, r, 0);
        S.gasket.scale.setScalar(r * 0.93);
        S.band.position.set(x0 + len / 2, r, 0);
        S.band.scale.setScalar(r * 1.0);
      });
      const r0 = G.r * s * 1.05;
      head.position.set(xs[0], r0, 0);
      head.scale.setScalar(r0);
      grinder.rotation.x = t * 4;
      corpses.forEach((c, i) => {
        const eaten = sm((t - MEALS[i]) / 0.8);
        c.visible = eaten < 0.98;
        c.position.set(CORPSES[i], 0.28 * (1 - eaten), 0);
        c.scale.setScalar(1 - eaten);
      });
      return {s, m, n, head: xs[0]};
    },
  };
}

const BEATS = [
  {t: 0, mode: 'CRAWLING', cap: 'MG-1 · A PERISTALTIC WAVE RUNS BACK ALONG IT · NO SEGMENT EVER SLIDES BACK'},
  {t: 5, mode: 'FEEDING', cap: 'IT EATS A CORPSE · A NEW TELESCOPIC STAGE SLIDES OUT AND IT STEPS UP A SIZE'},
  {t: 10, mode: 'FEEDING', cap: 'EVERY MEAL ANOTHER STAGE · BIGGER, FASTER, HARDER TO KILL'},
  {t: 15, mode: 'FEEDING', cap: 'THREE MEALS IN, ITS GIRTH AND REACH ARE HALF AGAIN WHAT THEY WERE'},
];

export function run() {
  runSim({duration: DURATION, fps: 60, theme: 'light', hud: {enabled: false}, director: {enabled: false}, watermark: ''}, ({canvas, capture}) => {
    const st = studio(canvas, {capture, shadow: 7, fog: [30, 100]});
    const mg = build(st.scene);
    const ui = consoleUI(document.getElementById('app'), {code: 'MG-1', eyebrow: 'GLUTTONY ELITE · EATS CORPSES, GROWS A SIZE EACH TIME', title: 'Glutton MG-1'});
    return {
      resize: st.resize,
      render(t) {
        const S = mg.update(t);
        const cx = S.head - 1.6 * S.s;
        st.aim([cx, 0.5 * S.s, 0], 35 + t * 3, 18, 7 + 2.5 * S.s);
        st.render();
        const bi = BEATS.reduce((k, b, i) => (t >= b.t ? i : k), 0);
        ui.set({
          cap: BEATS[bi].cap,
          n: bi + 1,
          mode: BEATS[bi].mode,
          right: `CRAWLED ${distAt(t).toFixed(1)} m`,
          rows: [
            ['SIZE', `${S.s.toFixed(2)}×`],
            ['STAGES', `${S.n}`],
            ['MEALS', `${Math.floor(S.m + 1e-9)}`],
            ['SPEED', `${(G.A * S.s * G.w).toFixed(2)} m/s`],
          ],
          barsTitle: 'GROWTH',
          bars: [['SIZE', (S.s - 1) / (3 * G.sizeStep)]],
          subs: [
            ['Peristaltic wave', 'RUNNING', bi === 0],
            ['Grinder ring', 'TURNING', bi > 0],
            ['Telescopic stages', S.m - Math.floor(S.m + 1e-9) > 1e-3 ? 'EXTENDING' : 'LOCKED', S.m - Math.floor(S.m + 1e-9) > 1e-3],
          ],
        });
        void keyed;
        return {};
      },
    };
  });
}
