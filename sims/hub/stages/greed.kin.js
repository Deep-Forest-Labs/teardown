// Greed and Mammon, model only. Stage value s from 0 to 3:
//   0       RUN       a vault: the floor (0 m), terrace one (3 m), terrace two (6 m). Twelve lifts ride the gap
//                     between the terraces in counterweighted pairs: each pair hangs from one cable over a pulley
//                     above the vault, so one rises as its partner sinks, and both dwell level with a terrace top.
//   0 → 1   ARRIVAL   Mammon, a 44 m bust, rises beyond the north rim; his arms reach over the terraces.
//   1 → 2   PHASE 1   his hands steal the orbs one by one into the hoard that hangs from his chest (weak point).
//   2 → 3   PHASE 2   he cuts the cables: the lifts lock into a rising spiral of air-dash steps; the floor and
//                     terraces plate in gold and burn; he leans in until his heart (weak point) is an air-dash from
//                     the top lift.
import {fabrik, seg, v} from './rig.js';

export const SPEC = {
  floorR: 10,
  t1: {r0: 12, r1: 17, top: 3},
  t2: {r0: 20, r1: 25, top: 6},
  lifts: 12, // at least; more on big arenas
  gapM: 3.6,
  maxTop: 15,
  liftW: 2.6,
  pulleyY: 30,
  dwell: 0.3, // share of each cycle a lift waits at each end
  cycle: 9, // seconds per round trip
  lockStep: 1.7, // height step between consecutive locked lifts (at most)
  arm: {links: 9, linkL: 6},
  bust: {w: 30, h: 26, d: 14},
  dashM: 12.5,
  jumpM: 1.8,
  orbs: 10,
};
const TAU = Math.PI * 2;

export function layout(scale) {
  const r = (x) => x * scale;
  // the lift gap between the terraces is a fixed width (a lift must fit); the terraces scale around it
  const t1 = [r(SPEC.t1.r0), r(SPEC.t1.r1)];
  const t2 = [t1[1] + SPEC.gapM, t1[1] + SPEC.gapM + r(SPEC.t2.r1 - SPEC.t2.r0)];
  const liftR = (t1[1] + t2[0]) / 2;
  // enough lifts that neighbours are an air-dash apart, in pairs
  const lifts = Math.max(12, 2 * Math.ceil((2 * Math.PI * liftR) / 9 / 2));
  const lockStep = Math.min(SPEC.lockStep, (SPEC.maxTop - SPEC.t1.top) / (lifts / 2));
  return {floorR: r(SPEC.floorR), t1, t2, liftR, lifts, lockStep, north: -(t2[1] + 8)};
}

/** A lift's height for its pair phase u (0..1 round trip), dwelling at the two terrace tops. */
function liftHeight(u) {
  const d = SPEC.dwell / 2;
  const lo = SPEC.t1.top;
  const hi = SPEC.t2.top;
  const k = u < d ? 0 : u < 0.5 - d ? (u - d) / (0.5 - 2 * d) : u < 0.5 + d ? 1 : u < 1 - d ? 1 - (u - 0.5 - d) / (0.5 - 2 * d) : 0;
  const sm = k * k * (3 - 2 * k);
  return lo + (hi - lo) * sm;
}

export function model(s, t, scale = 1) {
  const L = layout(scale);
  const out = {tubes: [], slabs: [], balls: [], weak: [], spots: [], info: {}, L};
  const arrive = seg(s, 0.05, 0.9);
  const steal = seg(s, 1.05, 1.9);
  const gold = seg(s, 2, 2.3);
  const lean = seg(s, 2.1, 2.5);
  const n = L.lifts;
  // lifts: pair k with k + n/2 on one cable; in phase two they lock along a spiral that rises toward the north
  out.lifts = [];
  const pulley = [0, SPEC.pulleyY, 0];
  for (let k = 0; k < n; k++) {
    const a = (k / n) * TAU;
    const dir = [Math.sin(a), 0, Math.cos(a)];
    const pair = k % (n / 2);
    const u = ((t / SPEC.cycle + pair / (n / 2)) % 1 + (k >= n / 2 ? 0.5 : 0)) % 1;
    const running = liftHeight(u);
    // the climb starts in the south (k = 0) and goes both ways round to the north
    const order = Math.min(k, n - k); // 0 .. n/2
    const locked = SPEC.t1.top + order * L.lockStep;
    const h = running + (locked - running) * gold;
    const p = v.add(v.mul(dir, L.liftR), [0, h, 0]);
    out.lifts.push({k, a, dir, h, running, p, u, order});
    out.slabs.push({k: 'lift', p: v.add(p, [0, -0.25, 0]), up: [0, 1, 0], fwd: dir, s: [SPEC.liftW, 0.5, SPEC.liftW]});
    // the cable: up from the lift to the rim of the pulley (gone once cut)
    if (gold < 0.05) out.tubes.push({k: 'cable', a: v.add(p, [0, 0.1, 0]), b: v.add(pulley, v.mul(dir, 2)), r: 0.08});
  }
  out.pulley = pulley;
  if (gold < 0.05) out.balls.push({k: 'pulley', p: pulley, r: 2.2});
  // Mammon: a bust beyond the north rim, rising in the arrival, leaning in during phase two
  const Bu = SPEC.bust;
  const rise = -60 * (1 - arrive);
  const tiltX = lean * 0.35;
  let bustC = [0, Bu.h / 2 + 4 + rise, L.north - Bu.d / 2];
  // phase two: solve the lean so his heart sits 7 m out from the top (north) lift and 1.5 m above it
  {
    const fwd0 = [0, -Math.sin(tiltX), Math.cos(tiltX)];
    const up0 = [0, Math.cos(tiltX), Math.sin(tiltX)];
    const heartRaw = v.add(bustC, v.add(v.mul(fwd0, Bu.d / 2 + 0.3), v.mul(up0, 2)));
    const topH = SPEC.t1.top + (n / 2) * L.lockStep;
    const want = [0, topH + 1.5, -(L.liftR + 7)];
    bustC = v.add(bustC, v.mul(v.sub(want, heartRaw), lean));
  }
  const fwd = [0, -Math.sin(tiltX), Math.cos(tiltX)];
  const up = [0, Math.cos(tiltX), Math.sin(tiltX)];
  out.slabs.push({k: 'gold', p: bustC, up, fwd, s: [Bu.w, Bu.h, Bu.d]});
  const headC = v.add(bustC, v.mul(up, Bu.h / 2 + 6));
  out.slabs.push({k: 'gold', p: headC, up, fwd, s: [12, 11, 11]});
  for (const sx of [-1, 1]) for (let c = 0; c < 6; c++) out.slabs.push({k: 'goldDark', p: v.add(headC, [sx * 8, 6 + c * 1.25, 0]), up: [0, 1, 0], fwd: [0, 0, 1], s: [6 - c * 0.6, 1.1, 6 - c * 0.6]});
  out.slabs.push({k: 'eyes', p: v.add(headC, v.add(v.mul(fwd, 5.6), [0, 1, 0])), up, fwd, s: [8, 1.3, 0.5]});
  // hoard below the chest; heart on the chest
  const hoard = v.add(bustC, v.add(v.mul(fwd, Bu.d / 2 + 4.5), v.mul(up, -Bu.h / 2 + 2)));
  const heart = v.add(bustC, v.add(v.mul(fwd, Bu.d / 2 + 0.3), v.mul(up, 2)));
  out.hoard = hoard;
  out.heart = heart;
  // orbs on the terraces; stolen in turn, alternating hands
  const orbs = [];
  for (let k = 0; k < SPEC.orbs; k++) {
    // the north side, within reach; even orbs on his left (x < 0), odd on his right, so each hand keeps to its side
    const a = Math.PI + (k % 2 ? -1 : 1) * (0.15 + (Math.floor(k / 2) / (SPEC.orbs / 2 - 1)) * 0.6);
    const onT2 = k % 2 === 0 || L.t1[1] > 30; // on a huge arena the inner terrace is out of his reach
    const r = onT2 ? (L.t2[0] + L.t2[1]) / 2 : (L.t1[0] + L.t1[1]) / 2;
    orbs.push([Math.sin(a) * r, (onT2 ? SPEC.t2.top : SPEC.t1.top) + 0.8, Math.cos(a) * r]);
  }
  const fill = steal * SPEC.orbs; // how many have been taken so far (fractional: the one in flight)
  const hands = [];
  for (const sd of [-1, 1]) {
    const shoulder = v.add(bustC, v.add([sd * (Bu.w / 2 + 1), 0, 0], v.mul(up, Bu.h / 2 - 3)));
    // this hand's current orb: odd orbs for the right hand, even for the left
    let target = v.add(shoulder, v.add([sd * 6, -10, 0], v.mul(fwd, 18)));
    let carrying = -1;
    if (steal > 0 && steal < 1) {
      const idx = Math.floor(fill);
      const mine = idx % 2 === (sd > 0 ? 1 : 0) ? idx : idx + 1 < SPEC.orbs ? idx + 1 : -1;
      if (mine >= 0) {
        const u = mine === idx ? fill - idx : 0;
        // reach out (0..0.45), grab, carry back to the hoard (0.45..1)
        target = u < 0.45 ? v.lerp(hoard, orbs[mine], seg(u, 0, 0.45)) : v.lerp(orbs[mine], hoard, seg(u, 0.45, 1));
        if (u >= 0.45) carrying = mine;
      }
    }
    if (gold > 0) target = v.lerp(target, v.add(L.lifts ? [0, 0, 0] : [0, 0, 0], [sd * 10, SPEC.t1.top + 1, -L.liftR * 0.4]), gold * 0.6);
    const pole = v.add(shoulder, [sd * 20, 25, 10]);
    const pts = fabrik(shoulder, target, SPEC.arm.links, SPEC.arm.linkL, pole, 96);
    hands.push({sd, pts, target, carrying});
    for (let i = 0; i < SPEC.arm.links; i++) out.tubes.push({k: 'gold', a: pts[i], b: pts[i + 1], r: 1.9 - i * 0.18, round: true});
    out.slabs.push({k: 'goldDark', p: pts[SPEC.arm.links], up: [0, 1, 0], fwd: v.norm(v.sub(pts[SPEC.arm.links], pts[SPEC.arm.links - 1])), s: [5, 2.2, 5]});
  }
  out.hands = hands;
  out.orbs = orbs.map((p, k) => {
    const taken = k < Math.floor(fill);
    const inHand = hands.find((h) => h.carrying === k);
    return {k, p: inHand ? inHand.pts[SPEC.arm.links] : taken ? hoard : p, visible: !taken || !!inHand};
  });
  out.balls.push({k: 'hoard', p: hoard, r: 3 + 2.5 * steal});
  out.weak.push({id: 'hoard', p: v.add(hoard, v.mul(fwd, 3 + 2.5 * steal)), open: s >= 1 && gold < 0.5 ? 1 : 0, r: 1.1});
  out.weak.push({id: 'heart', p: heart, open: lean, r: 1.2});
  // spots on the floor and terraces
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * TAU + 0.2;
    const ring = k % 3;
    const r = ring === 0 ? L.floorR * 0.6 : ring === 1 ? (L.t1[0] + L.t1[1]) / 2 : (L.t2[0] + L.t2[1]) / 2;
    const y = ring === 0 ? 0 : ring === 1 ? SPEC.t1.top : SPEC.t2.top;
    out.spots.push([Math.sin(a) * r, y + 0.2, Math.cos(a) * r]);
  }
  out.info = {arrive, steal, gold, lean, stolen: Math.floor(fill)};
  return out;
}

export function checks(s, t, scale = 1) {
  const m = model(s, t, scale);
  const out = [];
  const n = m.L.lifts;
  if (m.info.gold < 0.001) {
    for (let k = 0; k < n / 2; k++) {
      const sum = m.lifts[k].h + m.lifts[k + n / 2].h;
      out.push({name: `pair ${k}: counterweighted`, ok: Math.abs(sum - (SPEC.t1.top + SPEC.t2.top)) < 1e-9, value: sum.toFixed(6)});
    }
    for (const Lf of m.lifts) {
      const atEnd = Math.abs(Lf.h - SPEC.t1.top) < 1e-9 || Math.abs(Lf.h - SPEC.t2.top) < 1e-9;
      const between = Lf.h > SPEC.t1.top - 1e-9 && Lf.h < SPEC.t2.top + 1e-9;
      out.push({name: `lift ${Lf.k}: between the terrace tops`, ok: between, value: Lf.h.toFixed(3)});
      void atEnd;
    }
    // each lift dwells exactly level with a terrace top for boarding
    const dwellLo = model(s, 0, scale).lifts[0].h;
    out.push({name: 'lift dwells level with terrace one', ok: Math.abs(dwellLo - SPEC.t1.top) < 1e-9 || Math.abs(dwellLo - SPEC.t2.top) < 1e-9, value: dwellLo.toFixed(4)});
  }
  // the lift ring sits in the gap between the terraces, clear of both
  const L = m.L;
  out.push({name: 'lifts clear of both terraces', ok: L.liftR - SPEC.liftW / 2 > L.t1[1] + 0.2 && L.liftR + SPEC.liftW / 2 < L.t2[0] - 0.2, value: (L.t2[0] - L.t1[1] - SPEC.liftW).toFixed(2)});
  if (m.info.gold > 0.999) {
    // the locked spiral: neighbours a jump apart in height and an air-dash apart in distance
    for (let k = 0; k < n; k++) {
      const a = m.lifts[k];
      const b = m.lifts[(k + 1) % n];
      const dh = Math.abs(a.h - b.h);
      const gap = v.dist(a.p, b.p) - SPEC.liftW;
      out.push({name: `locked ${k}: step a jump`, ok: dh <= SPEC.jumpM, value: dh.toFixed(2)});
      out.push({name: `locked ${k}: gap an air-dash`, ok: gap <= SPEC.dashM && gap > 1, value: gap.toFixed(2)});
    }
    if (m.info.lean > 0.999) {
      const top = m.lifts.reduce((a, b) => (b.h > a.h ? b : a));
      const d = v.dist(top.p, m.heart);
      out.push({name: 'heart an air-dash from the top lift', ok: d <= SPEC.dashM + 1 && m.heart[1] - top.h < SPEC.jumpM + 2, value: d.toFixed(2)});
    }
  }
  for (const h of m.hands) {
    let lenErr = 0;
    for (let i = 0; i < SPEC.arm.links; i++) lenErr = Math.max(lenErr, Math.abs(v.dist(h.pts[i], h.pts[i + 1]) - SPEC.arm.linkL));
    out.push({name: 'arm links exact', ok: lenErr < 1e-6, value: lenErr.toExponential(1)});
    if (m.info.steal > 0 && m.info.steal < 1) out.push({name: 'hand reaches its orb or the hoard', ok: v.dist(h.pts[SPEC.arm.links], h.target) < 0.1, value: v.dist(h.pts[SPEC.arm.links], h.target).toFixed(3)});
  }
  if (s < 0.02) out.push({name: 'no boss in the run', ok: m.hoard[1] < -10, value: m.hoard[1].toFixed(1)});
  return out;
}

export const STATES = [
  {at: 0, name: 'Run', note: 'A vault of terraces; twelve counterweighted lifts. No boss.'},
  {at: 0.5, name: 'Arrival', note: 'Mammon rises beyond the north rim; his arms reach over the terraces.'},
  {at: 1, name: 'Phase 1', note: 'His hands steal the orbs into the hoard (weak point); break it to get them back.'},
  {at: 2, name: 'Phase 2', note: 'Cables cut: the lifts lock into an air-dash spiral; the floor burns gold; he leans in, heart open.'},
];
