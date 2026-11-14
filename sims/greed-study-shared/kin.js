// GREED as one machine: a water-balance lift, after the Lynton & Lynmouth Cliff Railway (1890), model only.
// Reference: two cars joined by one cable over a sheave at the top; each car carries a water tank. The top car takes on
// water until it outweighs the bottom car and runs down, hauling its partner up; at the bottom it dumps the water.
// No engine: the water does the work, and the brakes hold each car on its rails (they also grip if a cable fails).
// Mapping onto the stage (v2): the vault's twelve lifts are six water-balance pairs. Their cables run over one central
// headframe, so partners are opposite each other on the ring and their heights always sum to the same total (one
// cable, fixed length): one dwells at terrace one (3 m) while its partner dwells at terrace two (6 m). Mammon is the
// water tower to the north whose tank feeds every car (his heart). PHASE 2: the pairs are driven to lock heights that
// climb 3 → 6 m round the ring both ways (the cable rule allows it), the brakes set, the cables are cut; Mammon leans
// in until his tank is an air dash from the top lift. Numbers: layout EST (stage); masses EST. Frame: y up, north −z.

export const W = {
  t1: 3, // terrace one top
  t2: 6, // terrace two top
  r: 18, // the lift ring (between the terraces)
  n: 12,
  carM: 3000, // car with passengers, kg (EST)
  water: 1600, // ballast that tips a pair, kg (EST)
  g: 9.81,
  brakeA: 1.5, // the governor's braking, m/s² (EST)
  dash: 3.5, // air dash reach
  towerR: 34, // Mammon's base (north)
  towerH: 19, // to the tank centre: about the pivot's distance from the top lift, so a lean can reach it (EST)
  carDeck: 1, // the car deck sits this far over its cable point
};
const TAU = Math.PI * 2;
W.sum = W.t1 + W.t2; // heights of a pair always sum to this
/** Lift k's angle (lift 6 is due north). */
export const liftAng = (k) => Math.PI / 2 + (k / W.n) * TAU;
export const liftPos = (k) => [W.r * Math.cos(liftAng(k)), W.r * Math.sin(liftAng(k))];
export const partner = (k) => (k + W.n / 2) % W.n;

// one run: the heavier car accelerates at a = Δm·g / (total mass), then the governor brakes it to a stop
export const ACC = (W.water * W.g) / (2 * W.carM + W.water);
export const TRAVEL = W.t2 - W.t1;
/** Time to cover the travel under accelerate-then-brake. */
export const RUN_T = (() => {
  // accelerate a1 to v, brake a2 from v: d = v²/2a1 + v²/2a2
  const v = Math.sqrt((2 * TRAVEL) / (1 / ACC + 1 / W.brakeA));
  return v / ACC + v / W.brakeA;
})();
/** Distance covered τ seconds into a run. */
export function runX(tau) {
  const v = Math.sqrt((2 * TRAVEL) / (1 / ACC + 1 / W.brakeA));
  const t1 = v / ACC;
  if (tau <= 0) return 0;
  if (tau <= t1) return 0.5 * ACC * tau * tau;
  const tb = Math.min(tau - t1, v / W.brakeA);
  return 0.5 * ACC * t1 * t1 + v * tb - 0.5 * W.brakeA * tb * tb;
}
export const FILL_T = 1.5; // filling the top car's tank
export const CYCLE = FILL_T + RUN_T + 1.2; // fill, run, dwell
/** Height of lift k (0..5; its partner is W.sum minus this) in the running vault. */
export function cycleH(k, t) {
  const tt = t + k * 0.9;
  const c = Math.floor(tt / CYCLE);
  const tau = tt - c * CYCLE - FILL_T;
  const x = Math.min(TRAVEL, runX(tau));
  const goingUp = c % 2 === 0;
  return goingUp ? W.t1 + x : W.t2 - x;
}
/** Lock heights for lifts 0..5 so the ring climbs 3 → 6 m both ways round. */
export const lockH = (k) => W.t1 + (k / (W.n / 2)) * TRAVEL; // lift 0 (south) at 3 … lift 5 at 5.5; lift 6 (north) at 6
/** All twelve heights for given heights of lifts 0..5. */
export const ring = (h6) => Array.from({length: W.n}, (_, k) => (k < W.n / 2 ? h6[k] : W.sum - h6[k - W.n / 2]));

/** Mammon's lean β (from vertical, toward the centre) that brings his tank within a dash of the top lift. */
export const TOP = (() => {
  const h = ring(Array.from({length: 6}, (_, k) => lockH(k)));
  let best = 0;
  for (let k = 1; k < W.n; k++) if (h[k] > h[best]) best = k;
  return {k: best, h: h[best]};
})();
export function tank(beta) {
  return [0, W.towerH * Math.cos(beta), -W.towerR + W.towerH * Math.sin(beta)];
}
export const LEAN = (() => {
  const [x, z] = liftPos(TOP.k);
  const deck = [x, TOP.h + W.carDeck, z];
  const f = (b) => {
    const p = tank(b);
    return Math.hypot(p[0] - deck[0], p[1] - deck[1], p[2] - deck[2]) - W.dash;
  };
  // the first lean (scanning down from upright) at which the tank comes within a dash, refined by bisection
  let lo = 0;
  let hi = 0;
  for (let b = 0; b <= Math.PI / 2; b += 1e-3) {
    if (f(b) <= 0) {
      hi = b;
      break;
    }
    lo = b;
  }
  for (let i = 0; i < 60; i++) {
    const m = (lo + hi) / 2;
    if (f(m) > 0) lo = m;
    else hi = m;
  }
  return (lo + hi) / 2;
})();

export function checks(t, lockK) {
  const out = [];
  const h6 = Array.from({length: 6}, (_, k) => cycleH(k, t) * (1 - lockK) + lockH(k) * lockK);
  const h = ring(h6);
  for (let k = 0; k < 6; k++) out.push({name: 'one cable: a pair’s heights always sum to t1 + t2', ok: Math.abs(h[k] + h[partner(k)] - W.sum) < 1e-9, value: (h[k] + h[partner(k)]).toFixed(3)});
  out.push({name: 'every car stays between the terraces', ok: h.every((y) => y >= W.t1 - 1e-9 && y <= W.t2 + 1e-9), value: '-'});
  out.push({name: 'a run ends exactly at the other terrace', ok: Math.abs(runX(RUN_T) - TRAVEL) < 1e-9, value: RUN_T.toFixed(2)});
  const L = ring(Array.from({length: 6}, (_, k) => lockH(k)));
  let climb = true;
  for (let k = 0; k < W.n; k++) if (Math.abs(L[k] - L[(k + 1) % W.n]) > 0.51) climb = false;
  out.push({name: 'locked, neighbouring lifts differ by at most 0.5 m (a climb both ways)', ok: climb, value: '-'});
  const [x, z] = liftPos(TOP.k);
  const p = tank(LEAN);
  out.push({name: 'leaning, the tank is an air dash from the top lift', ok: Math.abs(Math.hypot(p[0] - x, p[1] - TOP.h - W.carDeck, p[2] - z) - W.dash) < 1e-9, value: ((LEAN * 180) / Math.PI).toFixed(1)});
  out.push({name: 'lifts are an air dash apart round the ring', ok: 2 * W.r * Math.sin(Math.PI / W.n) > 8, value: (2 * W.r * Math.sin(Math.PI / W.n)).toFixed(2)});
  return out;
}
export {TAU};
