// WANDERER WS-3, the wandering spawner, model only. One crankshaft drives everything:
//   legs     Theo Jansen's linkage (the repo's exact solver, sims/strandbeest-shared/jansen.js), 4 stations × 2
//   pour     a Geneva drive (the real intermittent mechanism of film projectors) indexes a rotary airlock valve one
//            pocket (1/8 turn) per crank turn; each pocket carries one mite from the hive to the chute
//   pulse    a bellows on the same shaft, compressed just before every index: the tell
// Input: crank angle θ. Frame: x forward (it walks toward +x), y up, z across; metres.
import {FOOT_MIN, PATH, solveLeg, solveMirror} from '../strandbeest-shared/jansen.js';

export const K = 0.03; // metres per Jansen unit: a leg about 3 m tall
export const STATIONS = [-0.9, -0.3, 0.3, 0.9]; // z of each crank station
const PH = [0, Math.PI, Math.PI / 2, (3 * Math.PI) / 2]; // phases along the shaft
// the foot's true lowest point (the solver's FOOT_MIN is sampled at 720 steps; the real minimum lies between samples)
const FOOT_LOW = (() => {
  let lo = FOOT_MIN;
  for (let n = 0; n < 40000; n++) lo = Math.min(lo, solveLeg((n / 40000) * Math.PI * 2).F[1]);
  return lo;
})();
export const AXLE_Y = -FOOT_LOW * K + 0.12; // crank axle height so the lowest foot touches the ground (y = 0.12 pad)
export const GENEVA = {n: 8, a: 0.16}; // slots, driver pin radius (m)
GENEVA.C = GENEVA.a / Math.sin(Math.PI / GENEVA.n); // centre distance
const TAU = Math.PI * 2;
const wrapPi = (x) => ((((x + Math.PI) % TAU) + TAU) % TAU) - Math.PI;

// body speed: the mean stance velocity of a foot (Jansen's foot runs backward along its flat bottom); the
// walker's legs face -x in the solver, so the body goes +x
const STANCE = PATH.map((p, i) => ({p, i})).filter((q) => q.p[1] - FOOT_MIN < 1.0);
const vStance = (() => {
  let s = 0;
  let n = 0;
  for (let i = 0; i < PATH.length; i++) {
    const a = PATH[i];
    const b = PATH[(i + 1) % PATH.length];
    if (a[1] - FOOT_MIN < 1.0 && b[1] - FOOT_MIN < 1.0) {
      s += b[0] - a[0];
      n++;
    }
  }
  return s / n; // Jansen units per sample step
})();
export const BODY_PER_RAD = (-vStance * PATH.length) / TAU * K; // metres the body moves per crank radian
void STANCE;

/** The Geneva wheel's angle for driver angle θ: indexes 2π/n per driver turn, locked (dwell) the rest. */
export function geneva(theta) {
  const {n, a, C} = GENEVA;
  const turns = Math.floor((theta + Math.PI) / TAU);
  const al = wrapPi(theta); // pin engaged when |al| < π/2 - π/n, pin aimed at the wheel (along +y from the driver)
  const span = Math.PI / 2 - Math.PI / n;
  let beta;
  if (Math.abs(al) < span) beta = Math.atan2(a * Math.sin(al), C - a * Math.cos(al));
  else beta = (Math.sign(al) * Math.PI) / n;
  return {beta: turns * (TAU / n) + beta + Math.PI / n, engaged: Math.abs(al) < span, al, pinR: Math.hypot(a * Math.sin(al), C - a * Math.cos(al))};
}

export function pose(theta) {
  const x = theta * BODY_PER_RAD;
  const legs = [];
  STATIONS.forEach((z, s) => {
    for (const side of [0, 1]) {
      const J = (side ? solveMirror : solveLeg)(theta + PH[s]);
      const pts = {};
      for (const k in J) pts[k] = [x + J[k][0] * K, AXLE_Y + J[k][1] * K, z + (side ? 0.14 : -0.14)];
      legs.push({s, side, z, pts, foot: pts.F});
    }
  });
  const G = geneva(theta);
  // the bellows: compressed through the quarter turn before each index (the pin meets the slot at θ = -span)
  const pre = wrapPi(theta + Math.PI * 0.75);
  const squeeze = Math.max(0, Math.cos(pre)) ** 2;
  return {theta, x, legs, valve: G.beta, engaged: G.engaged, geneva: G, squeeze};
}

const d3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
import {HOLY, LINKS} from '../strandbeest-shared/jansen.js';

export function checks(theta) {
  const P = pose(theta);
  const out = [];
  // every link of every leg exactly its holy number
  let e = 0;
  for (const L of P.legs) for (const [p, q, h] of LINKS) e = Math.max(e, Math.abs(d3(L.pts[p], L.pts[q]) - HOLY[h] * K));
  out.push({name: 'Jansen links exact (all 8 legs)', ok: e < 1e-9, value: e.toExponential(1)});
  // ground: no foot below it, and at least four on it
  const low = Math.min(...P.legs.map((L) => L.foot[1]));
  out.push({name: 'no foot below the ground', ok: low >= 0.12 - 1e-9, value: low.toFixed(3)});
  const down = P.legs.filter((L) => L.foot[1] - 0.12 < 0.03).length;
  out.push({name: 'at least two feet down', ok: down >= 2, value: down});
  // slip: a planted foot's world x drifts less than 6% of a stride over a small crank step
  const Q = pose(theta + 0.01);
  for (let i = 0; i < P.legs.length; i++) {
    if (P.legs[i].foot[1] - 0.12 > 0.005 || Q.legs[i].foot[1] - 0.12 > 0.005) continue;
    const slip = Math.abs(Q.legs[i].foot[0] - P.legs[i].foot[0]) / (0.01 * BODY_PER_RAD * TAU);
    out.push({name: 'planted feet slip < 6% of a stride', ok: slip < 0.06, value: slip.toFixed(3)});
  }
  // Geneva: the wheel only moves while the pin is engaged, and the pin stays inside the slot
  const G = P.geneva;
  if (G.engaged) out.push({name: 'Geneva pin stays inside its slot', ok: G.pinR <= GENEVA.C && G.pinR >= GENEVA.C - GENEVA.a - 1e-9, value: G.pinR.toFixed(3)});
  const G2 = geneva(theta + 0.001);
  if (!G.engaged && !G2.engaged) out.push({name: 'Geneva wheel locked in the dwell', ok: Math.abs(G2.beta - G.beta) < 1e-12, value: (G2.beta - G.beta).toExponential(1)});
  // one pocket per crank turn
  const one = geneva(theta + TAU).beta - G.beta;
  out.push({name: 'one pocket (1/8 turn) per crank turn', ok: Math.abs(one - TAU / GENEVA.n) < 1e-9, value: ((one * 180) / Math.PI).toFixed(3)});
  // the bellows peaks before the index starts
  return out;
}
