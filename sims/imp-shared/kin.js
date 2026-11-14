// FILCH IM-2, the imp thief, model only. References: whegs (Case Western's Whegs, RHex): three-spoked wheel-legs that
// roll like a rimless wheel, the touching spoke tip the pivot; two tripods of whegs 60° apart. And the lazy-tong
// grabber (a reacher toy): a scissor chain that shoots out to snatch an orb and pulls it back.
// Inputs: wheg angle φ (all whegs on one shaft per side), tong extension e (0..1). Frame: x forward, y up; metres.

export const W = {R: 0.22, spokes: 3, hubY: 0.22, cells: 4, link: 0.2, thClosed: (78 * Math.PI) / 180, thOpen: (18 * Math.PI) / 180};
const SEG = (Math.PI * 2) / W.spokes;
/** One wheg rolling on its spokes: hub height and the body advance for wheg angle φ (and the tripod offset). */
export function wheg(phi, off = 0) {
  const a = phi + off;
  const k = Math.floor((a + SEG / 2) / SEG); // the spoke now on the ground
  const local = a - k * SEG; // its angle from straight down, in [-SEG/2, SEG/2)
  // the hub swings about the planted tip: height R·cos(local), advance from the tip R·sin(local)
  const chord = 2 * W.R * Math.sin(SEG / 2);
  return {hubY: W.R * Math.cos(local), x: k * chord + W.R * Math.sin(local), tipX: k * chord, local, k};
}
/** Body: two tripods 60° apart, one rigid frame. The carrying wheg swings from −30° to +30° about its planted tip over
 * each 60° of the shaft, so the body advances exactly R per step: x = n·R + R·sin(local). Continuous by construction;
 * each new tip plants wherever it touches down (tip = x − R·sin(local)). */
export function body(phi) {
  const A = wheg(phi, 0);
  const B = wheg(phi, SEG / 2);
  const carry = A.hubY >= B.hubY ? A : B;
  const STEP = SEG / 2; // 60°
  const n = Math.floor((phi + STEP / 2) / STEP);
  const x = n * W.R + W.R * Math.sin(carry.local);
  return {A, B, y: carry.hubY, x, carry: carry === A ? 'A' : 'B', tipX: x - W.R * Math.sin(carry.local), n};
}
/** The lazy tong: reach and pin points for extension e. */
export function tong(e) {
  const th = W.thClosed + (W.thOpen - W.thClosed) * e;
  const cell = W.link * Math.cos(th);
  const half = (W.link / 2) * Math.sin(th);
  return {th, reach: W.cells * cell, half, cell};
}

export function checks(phi, e) {
  const out = [];
  const B = body(phi);
  // the planted tip does not move along the ground while it carries (a pivot, no slip)
  const B2 = body(phi + 1e-5);
  if (B.n === B2.n) out.push({name: 'the planted spoke tip never slides', ok: Math.abs(B2.tipX - B.tipX) < 1e-9, value: (B2.tipX - B.tipX).toExponential(1)});
  // the body never jumps (handovers between tripods included)
  out.push({name: 'the body moves continuously', ok: Math.abs(B2.x - B.x) < 1e-3, value: (B2.x - B.x).toExponential(1)});
  out.push({name: 'the body never drops below the lower tripod’s hub', ok: B.y >= Math.min(B.A.hubY, B.B.hubY) - 1e-12, value: B.y.toFixed(4)});
  // with two tripods 60° apart the body rides between R·cos 30° and R: a bob under 14% of R
  out.push({name: 'bob under 14% of the spoke (two tripods)', ok: W.R - B.y <= 0.14 * W.R + 1e-12, value: ((W.R - B.y) / W.R).toFixed(3)});
  const T = tong(e);
  out.push({name: 'tong links exact', ok: Math.abs(Math.hypot(T.cell, 2 * T.half) - W.link) < 1e-12, value: '-'});
  if (e > 0.999) out.push({name: 'extended, the tong reaches ≥ 0.6 m', ok: T.reach >= 0.6, value: T.reach.toFixed(3)});
  return out;
}
