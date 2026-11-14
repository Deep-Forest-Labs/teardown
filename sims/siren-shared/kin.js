// LURE SR-4, the siren, model only. References: the mechanical siren (an air-raid siren: a rotor with ports chops the
// air against a stator; the pitch is rpm × ports / 60), the harpoon and winch (a drum reels the cable: reeled length =
// drum angle × radius), and the level-wind (a diamond-thread reversing screw drives a carriage that lays one cable
// pitch across the drum per drum turn, back and forth). Inputs: time t (the script). Frame: x right, y up, z forward.

export const S = {
  ports: 10,
  drum: {r: 0.22, width: 0.6},
  pitch: 0.025, // cable diameter: the level-wind's advance per drum turn
  harpoon: {v: 18, up: 0.18},
  muzzle: [0, 2.2, 0.6],
  g: 9.81,
};
const TAU = Math.PI * 2;
const sm = (x) => {
  const u = Math.min(1, Math.max(0, x));
  return u * u * (3 - 2 * u);
};
export const SCRIPT = {wind: [0, 4], fire: 4.2, hook: 0, reel: [6.4, 12]};
/** Siren rotor rpm: winds up over the tell. */
export const rpmAt = (t) => 600 + 2400 * sm((t - SCRIPT.wind[0]) / (SCRIPT.wind[1] - SCRIPT.wind[0])) * (1 - sm((t - SCRIPT.reel[1]) / 1));
export const pitchHz = (rpm) => (rpm * S.ports) / 60;
/** The harpoon's flight to the target, the paid-out length at the hook. */
export function harpoon(target) {
  const dx = Math.hypot(target[0] - S.muzzle[0], target[2] - S.muzzle[2]);
  const v = S.harpoon.v;
  const dy = target[1] - S.muzzle[1];
  const disc = v ** 4 - S.g * (S.g * dx * dx + 2 * dy * v * v);
  const el = Math.atan((v * v - Math.sqrt(Math.max(0, disc))) / (S.g * dx));
  const T = dx / (v * Math.cos(el));
  const az = Math.atan2(target[0] - S.muzzle[0], target[2] - S.muzzle[2]);
  return {el, az, T, at: (tau) => [S.muzzle[0] + Math.sin(az) * Math.cos(el) * v * tau, S.muzzle[1] + Math.sin(el) * v * tau - 0.5 * S.g * tau * tau, S.muzzle[2] + Math.cos(az) * Math.cos(el) * v * tau], dist: Math.hypot(dx, dy)};
}
/** Drum angle while reeling: the cable shortens by r·θ. Reel from the hooked length to 1.2 m. */
export function reel(t, L0) {
  const [a, b] = SCRIPT.reel;
  const k = sm((t - a) / (b - a));
  const L = L0 + (1.2 - L0) * k;
  return {L, theta: (L0 - L) / S.drum.r};
}
/** Level-wind carriage x for drum angle θ: one pitch per turn, reversing at the drum's flanges (a triangle wave). */
export function levelWind(theta) {
  const travel = S.drum.width - S.pitch;
  const s = (theta / TAU) * S.pitch; // distance laid
  const m = ((s % (2 * travel)) + 2 * travel) % (2 * travel);
  return -travel / 2 + (m < travel ? m : 2 * travel - m);
}

export function checks(t, target) {
  const out = [];
  const f = pitchHz(rpmAt(t));
  out.push({name: 'siren pitch = rpm × ports / 60', ok: Math.abs(f - (rpmAt(t) * S.ports) / 60) < 1e-9, value: f.toFixed(1)});
  const H = harpoon(target);
  const land = H.at(H.T);
  out.push({name: 'the harpoon reaches the target', ok: Math.hypot(land[0] - target[0], land[1] - target[1], land[2] - target[2]) < 1e-6, value: Math.hypot(land[0] - target[0], land[1] - target[1], land[2] - target[2]).toExponential(1)});
  const R = reel(t, H.dist);
  out.push({name: 'reeled cable = drum angle × radius', ok: Math.abs(H.dist - R.L - R.theta * S.drum.r) < 1e-9, value: '-'});
  // the level-wind stays between the flanges and advances one pitch per turn away from a reversal
  const x = levelWind(R.theta);
  out.push({name: 'level-wind stays between the flanges', ok: Math.abs(x) <= (S.drum.width - S.pitch) / 2 + 1e-12, value: x.toFixed(4)});
  const x2 = levelWind(R.theta + TAU);
  const adv = Math.abs(x2 - x);
  const nearEnd = Math.abs(Math.abs(x) - (S.drum.width - S.pitch) / 2) < S.pitch * 1.01 || Math.abs(Math.abs(x2) - (S.drum.width - S.pitch) / 2) < S.pitch * 1.01;
  if (!nearEnd) out.push({name: 'level-wind advances one pitch per drum turn', ok: Math.abs(adv - S.pitch) < 1e-9, value: adv.toFixed(5)});
  return out;
}
export {TAU};
