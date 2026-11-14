// GLUTTONY as one machine: a country grain elevator, model only (no three.js).
// Reference: the bucket-elevator grain elevator (the leg: a belt of buckets between a boot pulley and a head pulley;
// at the head a rotating distributor sends the grain down one of several spouts to its bin). Grain is a granular
// solid: a free pile is a cone at its angle of repose (wheat about 27°); in a bin it fills as a column, h = V/(πr²).
// Mapping onto the stage (v2): the flies are the grain and their volume is conserved. RUN: seven fly mounds, each a
// cone at the repose angle. ARRIVAL: an air lift pulls them off the mounds into a cyclone over the centre (the
// swarm), round the head house (Beelzebub). PHASE 1: what you kill drops as corpses round the boot. PHASE 2: the
// swarm and the corpses go down into the boot; the leg lifts them; the distributor turns to each of seven bins in
// turn, and the bins fill into towers on a climbing spiral, a double jump each; the head house is a jump above the
// tallest. Numbers: repose angle and belt speed real; layout EST (stage). Frame: y up, bowl floor y = 0.

export const G = {
  repose: (27 * Math.PI) / 180, // wheat, angle of repose (real, about 25–28°)
  bins: 7,
  binR: 1.4,
  step: 2.5, // tower height step: a double jump
  spiralR0: 10,
  spiralDr: 2,
  spiralDa: (52 * Math.PI) / 180,
  legH: 21, // head pulley height
  headDeck: 20, // the head house deck: a jump above the tallest bin
  beltV: 3, // bucket belt speed, m/s (real range 2.5–3.5)
  bucketPitch: 0.6,
};
const TAU = Math.PI * 2;
/** Bin k: centre on the spiral and its full height. */
export const bin = (k) => {
  const a = k * G.spiralDa;
  const r = G.spiralR0 + k * G.spiralDr;
  return {c: [r * Math.cos(a), 0, r * Math.sin(a)], a, r, H: G.step * (k + 1)};
};
export const binV = (k) => Math.PI * G.binR * G.binR * bin(k).H;
export const V_TOTAL = Array.from({length: G.bins}, (_, k) => binV(k)).reduce((a, b) => a + b, 0);
// the run: seven equal mounds, each a cone at the repose angle holding a seventh of everything
export const MOUND_V = V_TOTAL / G.bins;
export const MOUND_R = Math.cbrt((3 * MOUND_V) / (Math.PI * Math.tan(G.repose)));
/** A cone at the repose angle holding volume v: its radius and height. */
export const cone = (v) => {
  const r = Math.cbrt((3 * Math.max(0, v)) / (Math.PI * Math.tan(G.repose)));
  return {r, h: r * Math.tan(G.repose)};
};

/**
 * Where the volume is for the three stage fractions: lift (mounds → swarm), kill (swarm → corpses) and feed
 * (swarm + corpses → bins, through the leg; bins fill in spiral order).
 */
export function state(lift, kill, feed) {
  const mound = MOUND_V * (1 - lift);
  const lifted = V_TOTAL * lift;
  const poolBeforeFeed = lifted; // swarm + corpses
  const fed = poolBeforeFeed * feed;
  const remain = poolBeforeFeed - fed;
  const swarm = remain * (1 - kill);
  const corpses = remain * kill;
  const bins = [];
  let left = fed;
  for (let k = 0; k < G.bins; k++) {
    const v = Math.min(left, binV(k));
    bins.push({v, h: v / (Math.PI * G.binR * G.binR)});
    left -= v;
  }
  return {mounds: Array.from({length: G.bins}, () => mound), swarm, corpses, bins};
}
export const total = (S) => S.mounds.reduce((a, b) => a + b, 0) + S.swarm + S.corpses + S.bins.reduce((a, b) => a + b.v, 0);
/** Filling time for the whole lot through the leg, with buckets of volume vb every pitch at belt speed. */
export const legRate = (vb) => (vb * G.beltV) / G.bucketPitch;

export function checks(lift, kill, feed) {
  const out = [];
  const S = state(lift, kill, feed);
  out.push({name: 'volume conserved: mounds + swarm + corpses + bins', ok: Math.abs(total(S) - V_TOTAL) < 1e-9, value: total(S).toFixed(3)});
  const M = cone(MOUND_V);
  out.push({name: 'a full mound is a cone at the repose angle', ok: Math.abs(M.h / M.r - Math.tan(G.repose)) < 1e-12, value: `${M.r.toFixed(2)} × ${M.h.toFixed(2)} m`});
  for (let k = 0; k + 1 < G.bins; k++) {
    const a = bin(k).c;
    const b = bin(k + 1).c;
    out.push({name: 'neighbouring mounds do not overlap', ok: Math.hypot(a[0] - b[0], a[2] - b[2]) >= 2 * MOUND_R - 1e-9, value: Math.hypot(a[0] - b[0], a[2] - b[2]).toFixed(2)});
    out.push({name: 'each tower is one double jump above the last', ok: Math.abs(bin(k + 1).H - bin(k).H - G.step) < 1e-12, value: G.step});
  }
  out.push({name: 'the head house is a jump above the tallest tower', ok: G.headDeck - bin(G.bins - 1).H <= G.step && G.headDeck > bin(G.bins - 1).H, value: (G.headDeck - bin(G.bins - 1).H).toFixed(1)});
  out.push({name: 'a bin never overfills', ok: S.bins.every((b, k) => b.v <= binV(k) + 1e-9), value: '-'});
  return out;
}
export {TAU};
