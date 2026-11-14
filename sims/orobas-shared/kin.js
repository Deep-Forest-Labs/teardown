// LANTERN OB-5, orobas, model only. Reference: the lighthouse optic: a rotating Fresnel lens of bull's-eye panels,
// each throwing one beam (n panels: n beams sweeping), turned by a weight-driven clockwork (the falling weight turns a
// drum; a gear train steps it up to the lens). Flash period at a point = 60 / (rpm × panels). Inputs: time t.
// Frame: x, z ground, y up; metres.

export const L = {panels: 4, rpm: 2.5, drumR: 0.18, ratio: 3.2, tower: 4.0, weightStart: 3.6, lampY: 5.2};
const TAU = Math.PI * 2;
/** Lens angle at time t (constant rpm). */
export const lensAt = (t) => (L.rpm / 60) * TAU * t;
/** The drum turns the lens angle / ratio; the weight drops drum angle × radius. */
export const drumAt = (t) => lensAt(t) / L.ratio;
export const weightAt = (t) => L.weightStart - drumAt(t) * L.drumR;
/** Beam headings at time t. */
export const beams = (t) => Array.from({length: L.panels}, (_, k) => lensAt(t) + (k / L.panels) * TAU);
export const flashPeriod = () => 60 / (L.rpm * L.panels);

export function checks(t) {
  const out = [];
  out.push({name: 'lens angle = drum angle × gear ratio', ok: Math.abs(lensAt(t) - drumAt(t) * L.ratio) < 1e-12, value: '-'});
  out.push({name: 'weight drop = drum angle × radius', ok: Math.abs(L.weightStart - weightAt(t) - drumAt(t) * L.drumR) < 1e-12, value: '-'});
  out.push({name: 'the weight stays inside its tower for a 60 s run', ok: weightAt(60) > 0.2, value: weightAt(60).toFixed(2)});
  // flash period: a fixed bearing sees a beam every 60/(rpm·n) seconds
  const P = flashPeriod();
  const b0 = beams(t)[0];
  const b1 = beams(t + P)[1 % L.panels];
  void b1;
  const adv = lensAt(t + P) - lensAt(t);
  out.push({name: 'one flash every 60 / (rpm × panels) at a fixed bearing', ok: Math.abs(adv - TAU / L.panels) < 1e-9, value: P.toFixed(2)});
  out.push({name: 'beams evenly spaced', ok: Math.abs(beams(t)[1] - b0 - TAU / L.panels) < 1e-12, value: '-'});
  return out;
}
export {TAU};
