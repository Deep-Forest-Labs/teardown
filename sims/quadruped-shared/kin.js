// STALKER QD-4, the quadruped, model only. Reference: real legged robots (Boston Dynamics Spot: hip abduction,
// hip and knee pitch per leg, knees bent back; MIT Cheetah: crouch-and-leap). Scaled ×2.5 from Spot's proportions.
// Input: stage time t through a script: stalk (a slow trot), crouch, pounce (a ballistic leap), land. Pure in t.
// Frame: x right, y up, z forward; metres.
import {dist3, twoBone} from '../slumber-kit/parts.js';

export const Q = {
  body: [0.6, 0.45, 2.2], // w, h, l
  hipX: 0.34,
  hipZ: 0.85,
  thigh: 0.88,
  shank: 0.88,
  standY: 1.38,
  stride: 0.55,
  lift: 0.18,
  leap: {dist: 6, apex: 2.2},
};
const TAU = Math.PI * 2;
const sm = (x) => {
  const u = Math.min(1, Math.max(0, x));
  return u * u * (3 - 2 * u);
};
// script times
export const SCRIPT = {stalk: [0, 9], crouch: [9, 10.6], leap: [10.6, 11.9], land: [11.9, 13.2], end: 16};
const STALK_V = 0.42; // m/s
const DUTY = 0.62;
const legPhase = {FL: 0, BR: 0, FR: 0.5, BL: 0.5}; // trot: diagonal pairs

/** Body origin (centre) and pitch at time t. */
export function bodyAt(t) {
  const [s0, s1] = SCRIPT.stalk;
  const zStalk = STALK_V * (Math.min(t, s1) - s0);
  let y = Q.standY + 0.03 * Math.sin((zStalk / Q.stride) * TAU * 2) * (t < s1 ? 1 : 0);
  let z = zStalk;
  let pitch = 0;
  const [c0, c1] = SCRIPT.crouch;
  const [l0, l1] = SCRIPT.leap;
  const [d0, d1] = SCRIPT.land;
  if (t >= c0 && t < l0) {
    const k = sm((t - c0) / (c1 - c0));
    y -= 0.42 * k;
    pitch = -0.12 * k; // nose down, haunches loaded
  } else if (t >= l0 && t < l1) {
    // ballistic: from the crouch height to the landing crouch, apex above stand
    const u = (t - l0) / (l1 - l0);
    const y0 = Q.standY - 0.42;
    const yA = Q.standY + Q.leap.apex;
    y = y0 + (yA - y0) * 4 * u * (1 - u) * 1 + (0 - 0) * u;
    z = zStalk + Q.leap.dist * u;
    pitch = 0.25 * Math.cos(Math.PI * u) - 0.05;
  } else if (t >= l1) {
    const k = 1 - sm((t - d0) / (d1 - d0));
    y = Q.standY - 0.5 * k;
    z = zStalk + Q.leap.dist;
    pitch = 0.08 * k;
  }
  return {p: [0, y, z], pitch};
}

/** Where foot id ends up when the stalk stops: in stance it stays; mid-swing it lands at the next step. */
function settle(id) {
  const sx = id[1] === 'L' ? -1 : 1;
  const sz = id[0] === 'F' ? 1 : -1;
  const wEnd = STALK_V * (SCRIPT.stalk[1] - SCRIPT.stalk[0]);
  const cyc = wEnd / Q.stride + legPhase[id];
  const n = Math.floor(cyc);
  const u = cyc - n;
  const m = u < DUTY ? n : n + 1;
  return {p: [sx * (Q.hipX + 0.12), 0, sz * Q.hipZ + (m - legPhase[id]) * Q.stride + Q.stride * DUTY * 0.5], wLand: (m - legPhase[id]) * Q.stride, swinging: u >= DUTY};
}

/** Foot of leg id at time t: trotting feet stay planted; crouch keeps them; in the leap they tuck; land re-plants. */
export function footAt(id, t) {
  const sx = id[1] === 'L' ? -1 : 1;
  const sz = id[0] === 'F' ? 1 : -1;
  const home = (zBody) => [sx * (Q.hipX + 0.12), 0, zBody + sz * Q.hipZ];
  const [s0, s1] = SCRIPT.stalk;
  const St = settle(id);
  // the gait runs on past the stop for a swinging foot until it lands; the body has stopped
  const tt = t < s1 ? t : St.swinging ? Math.min(t, s0 + St.wLand / STALK_V) : s1;
  const w = STALK_V * (tt - s0);
  const cyc = w / Q.stride + legPhase[id];
  const n = Math.floor(cyc);
  const u = cyc - n;
  const land = (n - legPhase[id]) * Q.stride + Q.stride * DUTY * 0.5;
  let p;
  let stance = true;
  if (u < DUTY) p = [home(0)[0], 0, home(0)[2] + land];
  else {
    const s = (u - DUTY) / (1 - DUTY);
    p = [home(0)[0], Q.lift * Math.sin(Math.PI * s), home(0)[2] + land + Q.stride * sm(s)];
    stance = false;
  }
  if (t >= SCRIPT.stalk[1] && t < SCRIPT.leap[0]) {
    // stop: a foot still finishing its swing keeps swinging until it lands, then it holds there
    if (!(St.swinging && tt < s0 + St.wLand / STALK_V)) {
      p = St.p;
      stance = true;
    }
  }
  if (t >= SCRIPT.leap[0]) {
    const B = bodyAt(t);
    const zL = STALK_V * (s1 - s0) + Q.leap.dist;
    if (t < SCRIPT.leap[1]) {
      const u2 = (t - SCRIPT.leap[0]) / (SCRIPT.leap[1] - SCRIPT.leap[0]);
      const PUSH = RELEASE[id]; // push-off: the foot stays planted until its leg is 97% extended
      const planted = St.p;
      // tucked under the body, forelegs reaching forward late in the leap
      const tuck = [home(0)[0], B.p[1] - 1.05 + 0.25 * Math.sin(Math.PI * u2), B.p[2] + sz * (Q.hipZ + (sz > 0 ? 0.35 * u2 : -0.3))];
      if (u2 < PUSH) {
        p = planted;
        stance = true;
      } else {
        const k = sm((u2 - PUSH) / 0.2);
        // dragged: the foot hangs from the hip at 97% reach toward where it was planted; blend from there to the tuck
        // (both inside the reach sphere round the hip, and a sphere is convex, so the blend stays reachable)
        const off = rotX([sx * Q.hipX, -0.1, sz * Q.hipZ], B.pitch);
        const hip = [B.p[0] + off[0], B.p[1] + off[1], B.p[2] + off[2]];
        const dd = dist3(hip, planted);
        const r = Math.min(1, (0.97 * (Q.thigh + Q.shank)) / dd);
        const dragged = [0, 1, 2].map((c) => hip[c] + (planted[c] - hip[c]) * r);
        p = [0, 1, 2].map((c) => dragged[c] + (tuck[c] - dragged[c]) * k);
        const landSpot = [home(0)[0], 0, STALK_V * (s1 - s0) + Q.leap.dist + sz * (Q.hipZ + 0.1)];
        const kl = sm((u2 - 0.75) / 0.25);
        p = [0, 1, 2].map((c) => p[c] + (landSpot[c] - p[c]) * kl);
        // stay inside the leg's reach round the hip
        const dl = dist3(hip, p);
        if (dl > 0.97 * (Q.thigh + Q.shank)) p = [0, 1, 2].map((c) => hip[c] + ((p[c] - hip[c]) * 0.97 * (Q.thigh + Q.shank)) / dl);
        p[1] = Math.max(p[1], 0);
        p[1] = Math.max(p[1], 0.06 * k);
        stance = false;
      }
    } else p = [home(0)[0], 0, zL + sz * (Q.hipZ + 0.1)];
  }
  return {p, stance};
}

// each leg's release moment in the leap: the first u where its hip is 97% of the leg's reach from the planted foot
const RELEASE = {};
export function computeRelease() {
  for (const id of ['FL', 'FR', 'BL', 'BR']) {
    const sx = id[1] === 'L' ? -1 : 1;
    const sz = id[0] === 'F' ? 1 : -1;
    const planted = settle(id).p;
    let u = 0;
    for (; u < 0.5; u += 0.0005) {
      const B = bodyAt(SCRIPT.leap[0] + u * (SCRIPT.leap[1] - SCRIPT.leap[0]));
      const off = rotX([sx * Q.hipX, -0.1, sz * Q.hipZ], B.pitch);
      const hip = [B.p[0] + off[0], B.p[1] + off[1], B.p[2] + off[2]];
      if (dist3(hip, planted) > 0.97 * (Q.thigh + Q.shank)) break;
    }
    RELEASE[id] = u;
  }
}
const rotX = (v, a) => [v[0], v[1] * Math.cos(a) - v[2] * Math.sin(a), v[1] * Math.sin(a) + v[2] * Math.cos(a)];
export function pose(t) {
  const B = bodyAt(t);
  const legs = ['FL', 'FR', 'BL', 'BR'].map((id) => {
    const sx = id[1] === 'L' ? -1 : 1;
    const sz = id[0] === 'F' ? 1 : -1;
    const off = rotX([sx * Q.hipX, -0.1, sz * Q.hipZ], B.pitch);
    const hip = [B.p[0] + off[0], B.p[1] + off[1], B.p[2] + off[2]];
    const F = footAt(id, t);
    // knees bend back (toward -z): the pole points back and a little out
    const knee = twoBone(hip, F.p, Q.thigh, Q.shank, [sx * 0.15, 0, -1]);
    return {id, sx, sz, hip, knee, foot: F.p, stance: F.stance};
  });
  return {t, body: B, legs};
}

export function checks(t) {
  const P = pose(t);
  const out = [];
  for (const L of P.legs) {
    out.push({name: 'legs reach their feet', ok: !!L.knee, value: L.knee ? 'ok' : `${dist3(L.hip, L.foot).toFixed(2)} m`});
    if (!L.knee) continue;
    out.push({name: 'leg links exact', ok: Math.abs(dist3(L.hip, L.knee) - Q.thigh) < 1e-9 && Math.abs(dist3(L.knee, L.foot) - Q.shank) < 1e-9, value: '-'});
    out.push({name: 'knees bend back', ok: L.knee[2] < (L.hip[2] + L.foot[2]) / 2 + 1e-6, value: (L.knee[2] - (L.hip[2] + L.foot[2]) / 2).toFixed(3)});
    out.push({name: 'feet on or above the ground', ok: L.foot[1] >= -1e-9, value: L.foot[1].toFixed(3)});
  }
  const later = pose(t + 0.004);
  P.legs.forEach((L, i) => {
    if (L.stance && later.legs[i].stance) out.push({name: 'planted feet never slide', ok: dist3(L.foot, later.legs[i].foot) < 1e-9, value: dist3(L.foot, later.legs[i].foot).toExponential(1)});
  });
  // nothing teleports: every foot moves less than 8 cm in 4 ms (20 m/s; the leap itself peaks near 9 m/s)
  P.legs.forEach((L, i) => out.push({name: 'feet move continuously', ok: dist3(L.foot, later.legs[i].foot) < 0.08, value: dist3(L.foot, later.legs[i].foot).toFixed(3)}));
  const inLeap = t > SCRIPT.leap[0] + 0.35 && t < SCRIPT.leap[1] - 0.05; // after the push-off
  if (inLeap) out.push({name: 'all four feet off the ground in the leap', ok: P.legs.every((L) => L.foot[1] > 0.05), value: Math.min(...P.legs.map((L) => L.foot[1])).toFixed(2)});
  if (t < SCRIPT.stalk[1]) out.push({name: 'two feet down in the trot', ok: P.legs.filter((L) => L.stance).length >= 2, value: P.legs.filter((L) => L.stance).length});
  return out;
}
computeRelease();
