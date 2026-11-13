// Gluttony and Beelzebub, model only. One quantity is conserved throughout: the flies' mass.
//   0       RUN       a flesh bowl over a bile floor (slows); seven mounds, each a pile of dead flies. No boss.
//   0 → 1   ARRIVAL   the flies lift off the mounds into a swarm over the centre; the mounds shrink by what left
//                     them. The core (Beelzebub) sinks into the middle of the swarm.
//   1 → 2   PHASE 1   kill the flock: what you kill falls as corpses into the bile; as the swarm thins the core is
//                     exposed (weak point).
//   2 → 3   PHASE 2   he eats everything: the swarm and the corpses pour back into the seven footprints and rise as
//                     towers in a climbing spiral (each step a double jump); the bile rises; the core sits on top of
//                     the tallest tower.
// Mass (m³) = mounds + swarm + corpses, the same at every s. Tower footprints are a player-scale spiral; the arena
// scale moves its start radius, not its spacing.
import {seg, v} from './rig.js';

export const SPEC = {
  bowlR: 26,
  bileY: 0.3,
  bileRise: 3.2,
  towers: 7,
  towerR: 3,
  moundR: 6.5, // run mounds are wide and squat; they narrow into towers as they rise
  gapM: 4, // edge to edge between consecutive towers on the climb
  climbStep: 3.5, // height step between consecutive towers (a double jump reaches 4.2 m)
  baseH: 1.2, // what stays of a mound when its flies leave
  firstH: 4.5,
  lift: 0.85, // share of each mound's mass that rises into the swarm
  killShare: 0.8, // share of the swarm killed by the end of phase one
  flyVol: 0.006, // m³ per fly, for the drawn count
  swarm: {y: 15, r: 9},
  doubleJumpH: 4.2,
};
const TAU = Math.PI * 2;

/** Tower footprints along an inward spiral: each next one 2r + gap away from the last. */
export function footprints(scale) {
  const out = [];
  let r = SPEC.bowlR * scale * 0.62;
  let a = 0;
  const step = 2 * SPEC.towerR + SPEC.gapM;
  for (let k = 0; k < SPEC.towers; k++) {
    out.push([Math.sin(a) * r, 0, Math.cos(a) * r]);
    // advance: keep the chord length = step while the radius closes in
    const nextR = Math.max(SPEC.towerR * 1.6, r - step * 0.38);
    const chord = Math.min(step, r + nextR - 1e-3);
    const cosA = (r * r + nextR * nextR - chord * chord) / (2 * r * nextR);
    a += Math.acos(Math.max(-1, Math.min(1, cosA)));
    r = nextR;
  }
  return out;
}

export function model(s, t, scale = 1) {
  const out = {tubes: [], slabs: [], balls: [], weak: [], spots: [], info: {}};
  const F = footprints(scale);
  const area = Math.PI * SPEC.towerR * SPEC.towerR;
  // phase two targets: heights on the climb, which fix how much mass there is (it all came from the mounds)
  const targetH = F.map((_, k) => SPEC.firstH + k * SPEC.climbStep);
  const totalMass = targetH.reduce((a, h) => a + h * area, 0);
  // run state mounds share that mass, lowest at the start of the spiral
  const runH = targetH.map((h) => (h / targetH.reduce((a, b) => a + b, 0)) * (totalMass / area));
  const arrive = seg(s, 0.05, 0.9);
  const kill = seg(s, 1.05, 1.9);
  const eat = seg(s, 2, 2.45);
  // mass bookkeeping
  const lifted = runH.map((h) => Math.max(0, h - SPEC.baseH) * area * SPEC.lift * arrive);
  const swarm0 = lifted.reduce((a, b) => a + b, 0);
  const killed = swarm0 * SPEC.killShare * kill;
  let swarm = swarm0 - killed;
  let corpses = killed;
  const moundMass = runH.map((h, k) => h * area - lifted[k]);
  // eating: the swarm, the corpses and the mounds all go to the towers' targets. Each pile's volume is
  // interpolated (so mass stays exact); its radius narrows from a squat mound to a tower and the height follows
  const radius = SPEC.moundR + (SPEC.towerR - SPEC.moundR) * eat;
  const pileArea = Math.PI * radius * radius;
  const vol = F.map((_, k) => moundMass[k] + (targetH[k] * area - moundMass[k]) * eat);
  const towerH = vol.map((V) => V / pileArea);
  swarm *= 1 - eat;
  corpses *= 1 - eat;
  out.mass = {mounds: vol.reduce((a, b) => a + b, 0), swarm, corpses, total: totalMass};
  const bileY = SPEC.bileY + SPEC.bileRise * eat;
  out.bileY = bileY;
  out.towers = F.map((p, k) => ({p, h: towerH[k], r: radius, top: [p[0], towerH[k], p[2]]}));
  for (const T of out.towers) out.tubes.push({k: 'mound', a: [T.p[0], -0.5, T.p[2]], b: T.top, r: radius, round: true});
  // the swarm: a sphere of flies; its count follows its mass
  const sw = SPEC.swarm;
  const flies = Math.round(swarm / SPEC.flyVol);
  const tallest = out.towers[out.towers.length - 1];
  const coreAt = eat > 0 ? v.lerp([0, sw.y, 0], v.add(tallest.top, [0, 2.6, 0]), eat) : [0, sw.y + 30 * (1 - arrive), 0];
  out.swarm = {c: [0, sw.y, 0], r: sw.r * (0.6 + 0.4 * Math.min(1, swarm / Math.max(1e-6, swarm0))), flies, t};
  out.core = {p: coreAt, r: 2.4, visible: arrive > 0.02};
  if (out.core.visible) out.balls.push({k: 'core', p: coreAt, r: 2.4});
  const exposed = s >= 1 && s < 2 ? Math.min(1, kill * 1.6) : eat > 0.95 ? 1 : 0;
  out.weak.push({id: 'core', p: out.core.visible ? coreAt : [0, -200, 0], open: out.core.visible ? exposed : 0, r: 1.6});
  // spots: on the bowl floor between the towers (phase one) and on tower tops later
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * TAU + 0.2;
    const r = SPEC.bowlR * scale * (k % 2 ? 0.35 : 0.8);
    out.spots.push([Math.sin(a) * r, SPEC.bileY + 0.2, Math.cos(a) * r]);
  }
  out.info = {arrive, kill, eat, flies, bileY, exposed, swarmShare: swarm0 > 0 ? swarm / swarm0 : 0};
  return out;
}

export function checks(s, t, scale = 1) {
  const m = model(s, t, scale);
  const out = [];
  const sum = m.mass.mounds + m.mass.swarm + m.mass.corpses;
  out.push({name: 'mass is conserved', ok: Math.abs(sum - m.mass.total) / m.mass.total < 1e-9, value: (sum / m.mass.total).toFixed(12)});
  if (m.info.eat > 0.999) {
    for (let k = 1; k < m.towers.length; k++) {
      const a = m.towers[k - 1];
      const b = m.towers[k];
      const dh = b.h - a.h;
      const gap = v.dist([a.p[0], 0, a.p[2]], [b.p[0], 0, b.p[2]]) - 2 * SPEC.towerR;
      out.push({name: `climb ${k}: step within a double jump`, ok: dh > 0 && dh <= SPEC.doubleJumpH, value: dh.toFixed(2)});
      out.push({name: `climb ${k}: gap jumpable`, ok: gap >= 1 && gap <= 6, value: gap.toFixed(2)});
    }
    out.push({name: 'towers stand above the bile', ok: m.towers.every((T) => T.h > m.bileY + 0.5), value: Math.min(...m.towers.map((T) => T.h - m.bileY)).toFixed(2)});
    const top = m.towers[m.towers.length - 1].top;
    out.push({name: 'core on the tallest tower', ok: Math.abs(m.core.p[1] - top[1] - 2.6) < 1e-6 && Math.hypot(m.core.p[0] - top[0], m.core.p[2] - top[2]) < 1e-6, value: 'exact'});
  }
  if (s < 0.02) out.push({name: 'no swarm in the run', ok: m.info.flies === 0 && !m.core.visible, value: m.info.flies});
  out.push({name: 'footprints inside the bowl', ok: m.towers.every((T) => Math.hypot(T.p[0], T.p[2]) + SPEC.towerR < SPEC.bowlR * scale * 0.9), value: 'ok'});
  return out;
}

export const STATES = [
  {at: 0, name: 'Run', note: 'A flesh bowl; seven mounds of dead flies over the bile. No boss.'},
  {at: 0.5, name: 'Arrival', note: 'The flies lift off the mounds into a swarm; the core sinks into it.'},
  {at: 1, name: 'Phase 1', note: 'Thin the flock: the dead fall into the bile; the core is exposed as the swarm thins.'},
  {at: 2, name: 'Phase 2', note: 'He eats it all: the mass rises as a spiral of towers; the bile rises; the core tops the climb.'},
];
