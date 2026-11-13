// The Altar's operating script: drum angle, top-deck angle and the two decks' heights as pure functions of t.
// Run, Arrival, Phase 1, Phase 2 (see MAPPING.md). The checks sweep this whole script.
import {D} from './kin.js';

export const DURATION = 30;
export const STATES = [
  {t: 0, name: 'RUN', cap: 'RUN · TOP DECK PINNED, THE DRUM INDEXES · A BRIDGE RISES IN THE OPEN HALF'},
  {t: 9, name: 'ARRIVAL', cap: 'ARRIVAL · B DROPS THREE FLOORS AND BRINGS THE PRINCE UP'},
  {t: 15, name: 'PHASE 1', cap: 'PHASE 1 · TOP DECK FREE: THE WHOLE DRUM IS A TURNTABLE'},
  {t: 21, name: 'PHASE 2', cap: 'PHASE 2 · PINNED AGAIN: THE PRINCE MUST SINK BEFORE EVERY HALF TURN'},
];
const sm = (u) => {
  const x = Math.min(1, Math.max(0, u));
  return x * x * x * (x * (x * 6 - 15) + 10);
};
const span = (t, a, b) => sm((t - a) / (b - a));
const REST = -D.storey; // a deck waiting under the top deck, or a pit in the open half
const PSI_RUN = Math.PI; // top deck covers π..2π: the open half is 0..π
const P1_RATE = 0.6; // rad/s while it is a turntable

/** A dwell from c: rise, hold, sink (to REST). */
const dwell = (t, c, len = 3) => REST + (0 - REST) * Math.min(span(t, c, c + 0.8), 1 - span(t, c + len - 0.8, c + len));

export function opsAt(t) {
  let theta;
  let psi = PSI_RUN;
  let hA = REST;
  let hB = REST;
  let prince = 0; // 0 none, 1 on deck B
  if (t < 9) {
    // two index cycles: dwell 3 s (A then B in the open half), then a half turn in 1.5 s
    const k = Math.floor(t / 4.5);
    const c = k * 4.5;
    theta = k * Math.PI + Math.PI * span(t, c + 3, c + 4.5);
    const open = k % 2 === 0 ? 'A' : 'B';
    const h = dwell(t, c);
    if (open === 'A') hA = h;
    else hB = h;
  } else if (t < 15) {
    // half turn to bring B into the open half, then the full three-floor drop and back up with the prince
    theta = 2 * Math.PI + Math.PI * span(t, 9, 10.5);
    const down = span(t, 10.5, 12);
    const up = span(t, 12.5, 15);
    hB = REST + (-D.travel - REST) * down + (0 - -D.travel) * up;
    prince = t >= 12 ? 1 : 0;
  } else if (t < 21) {
    // unpinned: the top deck turns with the drum, B stays up with the prince
    theta = 3 * Math.PI + P1_RATE * (t - 15) * span(t, 15, 16.2);
    psi = theta - 2 * Math.PI; // the open half stays over B (B starts at θ + π)
    hB = 0;
    prince = 1;
  } else {
    // pinned where phase 1 left it; index in half turns. B sinks, turn, A bridges, turn, B rises
    const th1 = 3 * Math.PI + P1_RATE * 6; // exactly where phase 1 left the drum
    psi = th1 - 2 * Math.PI;
    theta = th1 + Math.PI * span(t, 22.8, 24.3) + Math.PI * span(t, 27, 28.5);
    hB = REST + (0 - REST) * Math.max(1 - span(t, 22, 22.8), span(t, 28.5, 29.3));
    hA = t > 24.3 && t < 27.5 ? dwell(t, 24.3, 2.7) : REST;
    prince = 1;
  }
  return {theta, psi, hA, hB, prince};
}

export const stateAt = (t) => [...STATES].reverse().find((s) => t >= s.t);
