// RAGER BK-8, the berserker, model only. Reference: Watt's centrifugal governor. Two flyballs on arms of length l
// swing out as the spindle turns: a conical pendulum, cos θ = g / (ω²·l); their links lift a sleeve that sets the
// engine's throttle. Every hit it takes knocks the governor's setpoint up, so the engine settles faster: it grows
// faster as it takes damage. It walks on the sentinel's biped legs (sentinel-shared/kin.js), stride rate tied to the
// engine. Inputs: hits h (0..4), time. Frame: x across, y up, z forward; metres.
import {B, pose as bipedPose} from '../sentinel-shared/kin.js';

export const W = {l: 0.38, link: 0.24, armTop: 0.08, g: 9.81, setpoints: [5.5, 6.5, 7.5, 8.5, 9.5]}; // spindle rad/s per hits: the balls climb ~31° → 73°
/** Flyball arm angle from the spindle for spindle speed ω (the conical pendulum); 0 when too slow to lift. */
export const armAngle = (w) => {
  const c = W.g / (w * w * W.l);
  return c >= 1 ? 0 : Math.acos(c);
};
/** Sleeve lift: the link from the arm's midpoint to the sleeve, solved. */
export function sleeve(w) {
  const th = armAngle(w);
  const mid = [Math.sin(th) * W.l * 0.5, -Math.cos(th) * W.l * 0.5]; // (r, y) from the top pivot
  // the sleeve sits on the spindle (r = 0) at the point the link reaches: y = mid.y − sqrt(link² − mid.r²)
  const y = mid[1] - Math.sqrt(W.link * W.link - mid[0] * mid[0]);
  return {th, mid, y, lift: y - (-W.l * 0.5 - W.link)};
}
/** Engine speed after h hits (blended over half a second after each). */
export const speedAt = (hitsSmooth) => {
  const k = Math.min(W.setpoints.length - 1, Math.floor(hitsSmooth));
  const f = hitsSmooth - k;
  const a = W.setpoints[k];
  const b = W.setpoints[Math.min(W.setpoints.length - 1, k + 1)];
  return a + (b - a) * f;
};
export const STRIDE_PER_RAD = 0.035; // walk metres per spindle radian
export {B, bipedPose};

export function checks(w) {
  const out = [];
  const S = sleeve(w);
  const lhs = w * w * W.l * Math.cos(S.th);
  out.push({name: 'conical pendulum: ω²·l·cos θ = g', ok: S.th === 0 || Math.abs(lhs - W.g) < 1e-9, value: lhs.toFixed(6)});
  out.push({name: 'sleeve link length exact', ok: Math.abs(Math.hypot(S.mid[0], S.mid[1] - S.y) - W.link) < 1e-12, value: '-'});
  out.push({name: 'the balls fly out further at higher speed', ok: armAngle(w + 0.1) >= armAngle(w), value: '-'});
  out.push({name: 'arms stay under 75°', ok: S.th < (75 * Math.PI) / 180, value: ((S.th * 180) / Math.PI).toFixed(1)});
  return out;
}
