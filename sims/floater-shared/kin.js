// AERIE FL-4, the floater, model only. References: the rigid airship (polygonal ring frames joined by longitudinal
// girders, gas cells inside; ballonets take in air to sink and expel it to rise) and the USS Macon's trapeze, which
// swung down below the hull on a parallelogram to launch and recover its Sparrowhawk planes; a parallelogram keeps
// the hook bar level through the swing. Here the trapeze launches Divers; a suction hose eats orbs.
// Inputs: time t (drift altitude and the scripted launch). Frame: x across, y up, z along the hull (nose +z); metres.

export const F = {
  len: 14,
  frames: 11,
  sides: 13,
  radius: (u) => 2.4 * Math.sin(Math.PI * (0.06 + 0.88 * u)) ** 0.6, // hull section radius along u ∈ [0,1]
  trapeze: {pivots: [[0, -2.3, 0.6], [0, -2.3, -0.6]], arm: 2.0, hookZ: 0.6}, // parallelogram: two arms, hook bar
  ballonet: {max: 1.0},
  alt: [9, 7.2],
};
const TAU = Math.PI * 2;
const sm = (x) => {
  const u = Math.min(1, Math.max(0, x));
  return u * u * (3 - 2 * u);
};
export const SCRIPT = {sink: [2, 6], swing: [7, 9], drop: 9.4, retract: [10.4, 12.4], rise: [13, 16]};

/** Altitude: drifts at the high level, sinks to launch, rises after. The ballonet fills as it sinks. */
export function altAt(t) {
  const k = sm((t - SCRIPT.sink[0]) / (SCRIPT.sink[1] - SCRIPT.sink[0])) * (1 - sm((t - SCRIPT.rise[0]) / (SCRIPT.rise[1] - SCRIPT.rise[0])));
  return {y: F.alt[0] + (F.alt[1] - F.alt[0]) * k + 0.15 * Math.sin(t * 0.6), ballonet: k};
}
/** Trapeze angle from straight back-up (stowed, 0) to hanging down (π/2), and its parallelogram points. */
export function trapeze(t) {
  const down = sm((t - SCRIPT.swing[0]) / (SCRIPT.swing[1] - SCRIPT.swing[0])) * (1 - sm((t - SCRIPT.retract[0]) / (SCRIPT.retract[1] - SCRIPT.retract[0])));
  const ang = (Math.PI / 2) * down; // 0: arms folded flat along the hull (toward -z), π/2: hanging straight down
  const T = F.trapeze;
  const dir = [0, -Math.sin(ang), -Math.cos(ang)];
  const a = T.pivots.map((p) => [p[0] + dir[0] * T.arm, p[1] + dir[1] * T.arm, p[2] + dir[2] * T.arm]);
  return {ang, down, ends: a, hook: [(a[0][0] + a[1][0]) / 2, (a[0][1] + a[1][1]) / 2 - 0.25, (a[0][2] + a[1][2]) / 2]};
}
/** The hull's frame rings (u along the length), each a polygon. */
export function rings() {
  const out = [];
  for (let i = 0; i < F.frames; i++) {
    const u = i / (F.frames - 1);
    const z = F.len / 2 - u * F.len;
    const r = F.radius(u);
    out.push({u, z, r, pts: Array.from({length: F.sides}, (_, k) => [Math.cos((k / F.sides) * TAU) * r, Math.sin((k / F.sides) * TAU) * r, z])});
  }
  return out;
}

export function checks(t) {
  const out = [];
  const T = trapeze(t);
  const d3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  // parallelogram: both arms their length; the hook bar between the arm ends keeps its length and stays level
  F.trapeze.pivots.forEach((p, i) => out.push({name: 'trapeze arms exact', ok: Math.abs(d3(p, T.ends[i]) - F.trapeze.arm) < 1e-12, value: '-'}));
  const bar = d3(T.ends[0], T.ends[1]);
  const pv = d3(F.trapeze.pivots[0], F.trapeze.pivots[1]);
  out.push({name: 'hook bar keeps the pivots’ spacing (a parallelogram)', ok: Math.abs(bar - pv) < 1e-12, value: bar.toFixed(4)});
  out.push({name: 'hook bar stays level through the swing', ok: Math.abs(T.ends[0][1] - T.ends[1][1]) < 1e-12, value: (T.ends[0][1] - T.ends[1][1]).toExponential(1)});
  // stowed, the trapeze lies inside the hull's lower radius; down, the hook clears the hull
  const A = altAt(t);
  if (T.down < 1e-6) out.push({name: 'stowed trapeze inside the hull line', ok: Math.hypot(T.hook[0], T.hook[1]) < F.radius(0.5) + 0.3, value: Math.hypot(T.hook[0], T.hook[1]).toFixed(2)});
  if (T.down > 0.999) out.push({name: 'deployed hook hangs clear below the hull', ok: -T.hook[1] > F.radius(0.5) + 1, value: (-T.hook[1]).toFixed(2)});
  // ballonet and altitude agree: fuller ballonet, lower ship
  const B = altAt(t + 0.05);
  const dy = B.y - A.y - 0.15 * (Math.sin((t + 0.05) * 0.6) - Math.sin(t * 0.6));
  const db = B.ballonet - A.ballonet;
  out.push({name: 'ballonet fills as it sinks, empties as it rises', ok: Math.abs(db) < 1e-9 || Math.sign(dy) === -Math.sign(db), value: `${db.toFixed(3)} / ${dy.toFixed(3)}`});
  out.push({name: 'ballonet within its volume', ok: A.ballonet >= 0 && A.ballonet <= F.ballonet.max, value: A.ballonet.toFixed(2)});
  return out;
}
