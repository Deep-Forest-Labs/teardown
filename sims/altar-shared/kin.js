// The Altar: the Olivier drum revolve, model only (no three.js). See MAPPING.md for the sources and the rule.
// Inputs, all keyed by the film: drum angle θ, top-deck angle ψ, and the two elevator decks' heights.
// Frame: y up, stage level y = 0, drum axis on the y axis. In the drum's own frame elevator A covers angles 0..π
// and elevator B π..2π; the top half disc covers ψ..ψ+π in the world.

export const K = 2.5; // game scale on the real machine
export const D = {
  R: 6 * K, // 12 m drum (LSI 2017)
  wall: 0.4 * K, // EST
  gap: 0.04 * K, // running clearance, EST
  storey: 3.5 * K, // EST
  drop: 3, // storeys below stage (theatrecrafts / LSI)
  storeys: 5, // ArtsJournal 2013
  deckT: 0.25 * K,
  topT: 0.25 * K,
  wheels: 70, // LSI 2017
  motors: 24, // LSI 2017
  loadLimit: 5, // tonnes per elevator (LSI 2017)
  cwH: 1.2 * K, // counterweight block height, EST
  stageW: 6 * K, // fixed stage ring around the drum, EST
};
D.elevR = D.R - D.wall - D.gap;
D.H = D.storey * D.storeys; // drum height
D.travel = D.storey * D.drop; // elevator travel
D.sheaveY = -D.topT - 0.3 * K; // sheaves just under the top deck, in the wall
D.cwFloor = -D.H + 0.4 * K;
// rope length: deck at stage (0) ↔ counterweight resting at the bottom of its guide
D.rope = D.sheaveY - 0 + (D.sheaveY - (D.cwFloor + D.cwH));

const TAU = Math.PI * 2;
export const wrap = (a) => ((((a + Math.PI) % TAU) + TAU) % TAU) - Math.PI;

/** How much of a half disc starting at angle a overlaps the top half disc starting at ψ (radians of arc, 0..π). */
export const overlap = (a, psi) => Math.PI - Math.abs(wrap(psi - a));

/** Everything's placement for one set of inputs. */
export function pose({theta, psi, hA, hB}) {
  const elev = [
    {id: 'A', a: theta, h: hA},
    {id: 'B', a: theta + Math.PI, h: hB},
  ].map((E) => {
    const ov = overlap(E.a, psi);
    // counterweight in the wall at the middle of the elevator's half, riding opposite the deck (1:1)
    const mid = E.a + Math.PI / 2;
    const cwTop = 2 * D.sheaveY - D.rope - E.h; // rope: (sheave - deck) + (sheave - cwTop) = rope
    return {...E, ov, mid, cw: {y0: cwTop - D.cwH, y1: cwTop, a: mid}, maxUp: ov < 1e-3 ? 0 : -D.topT - 0.02};
  });
  return {theta, psi, elev};
}

export function checks(inp) {
  const P = pose(inp);
  const out = [];
  for (const E of P.elev) {
    // the rule: a deck may only reach stage level in the open half; otherwise it stays under the top deck
    out.push({name: `elevator ${E.id} never hits the top deck`, ok: E.h <= E.maxUp + 1e-6, value: `h ${E.h.toFixed(3)} max ${E.maxUp.toFixed(3)} overlap ${E.ov.toFixed(3)}`});
    out.push({name: `elevator ${E.id} within its travel`, ok: E.h <= 1e-6 && E.h >= -D.travel - 1e-6, value: E.h.toFixed(3)});
    // the rope holds its length and the counterweight stays in its guide
    const len = D.sheaveY - E.h + (D.sheaveY - E.cw.y1);
    out.push({name: 'rope length holds', ok: Math.abs(len - D.rope) < 1e-9, value: len.toFixed(4)});
    out.push({name: 'counterweight stays in its guide', ok: E.cw.y0 >= D.cwFloor - 1e-6 && E.cw.y1 <= D.sheaveY - 0.2, value: `${E.cw.y0.toFixed(2)}..${E.cw.y1.toFixed(2)}`});
    // the deck clears the drum wall
    out.push({name: 'deck clears the drum wall', ok: D.elevR + D.gap <= D.R - D.wall + 1e-9, value: (D.R - D.wall - D.elevR).toFixed(3)});
  }
  // the counterweight never meets its own deck: the deck is in the shaft, the weight in the wall
  out.push({name: 'counterweights sit in the wall, outside the decks', ok: D.R - D.wall / 2 > D.elevR, value: (D.R - D.wall / 2 - D.elevR).toFixed(3)});
  // a full drop reaches the basement, three floors down
  out.push({name: 'travel is three storeys', ok: Math.abs(D.travel - 3 * D.storey) < 1e-9, value: D.travel.toFixed(2)});
  return out;
}
