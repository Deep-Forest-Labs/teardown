// RIME TR-6, the traitor, model only. Reference: the Miura-ori fold (Miura 1985; geometry after Schenk & Guest 2013):
// a sheet of identical parallelograms (sides a, b, sector angle γ) with one degree of freedom, the fold angle θ. Flat
// (θ = 0) it lies on the floor as a sheet of ice; folding draws it in both ways at once and lifts it into a deep
// corrugated shell, every plate rigid. The shell is the traitor's back: it lies in the ice, then folds up behind you.
// Unit cell (half-periods): H = a sinθ sinγ, S = b cosθ tanγ / √(1 + cos²θ tan²γ), L = a √(1 − sin²θ sin²γ),
// V = b / √(1 + cos²θ tan²γ). Inputs: θ. Frame: x, z ground, y up; metres.

export const M = {a: 0.6, b: 0.6, gamma: (55 * Math.PI) / 180, nx: 10, nz: 10};

export function cell(theta) {
  const {a, b, gamma: g} = M;
  const st = Math.sin(theta);
  const ct = Math.cos(theta);
  const tg = Math.tan(g);
  const k = Math.sqrt(1 + ct * ct * tg * tg);
  return {H: a * st * Math.sin(g), S: (b * ct * tg) / k, L: a * Math.sqrt(1 - st * st * Math.sin(g) ** 2), V: b / k};
}

/** Vertex (i, j) of the folded sheet, centred on the origin, lowest corners on y = 0. */
export function vertices(theta) {
  const {H, S, L, V} = cell(theta);
  const out = [];
  for (let j = 0; j <= M.nz; j++) {
    const row = [];
    for (let i = 0; i <= M.nx; i++) {
      row.push([(i - M.nx / 2) * S, j % 2 ? H : 0, (j - M.nz / 2) * L + (i % 2 ? V : 0) - V / 2]);
    }
    out.push(row);
  }
  return out;
}
/** Footprint and height of the folded sheet. */
export function extent(theta) {
  const {H, S, L, V} = cell(theta);
  return {w: M.nx * S, d: M.nz * L + V, h: H};
}

export function checks(theta) {
  const out = [];
  const P = vertices(theta);
  const d = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
  let eA = 0;
  let eB = 0;
  let plan = 0;
  let ang = 0;
  for (let j = 0; j < M.nz; j++) {
    for (let i = 0; i < M.nx; i++) {
      const p = P[j][i];
      const q = P[j][i + 1];
      const r = P[j + 1][i + 1];
      const s = P[j + 1][i];
      eB = Math.max(eB, Math.abs(d(p, q) - M.b), Math.abs(d(s, r) - M.b));
      eA = Math.max(eA, Math.abs(d(p, s) - M.a), Math.abs(d(q, r) - M.a));
      // the plate stays flat: the fourth corner lies on the plane of the other three
      const u = q.map((x, k) => x - p[k]);
      const v = s.map((x, k) => x - p[k]);
      const w = r.map((x, k) => x - p[k]);
      const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
      plan = Math.max(plan, Math.abs((n[0] * w[0] + n[1] * w[1] + n[2] * w[2]) / Math.hypot(...n)));
      // the sector angle stays γ
      const cg = (u[0] * v[0] + u[1] * v[1] + u[2] * v[2]) / (Math.hypot(...u) * Math.hypot(...v));
      ang = Math.max(ang, Math.abs(Math.acos(Math.abs(cg)) - M.gamma));
    }
  }
  out.push({name: 'every a-edge keeps its length', ok: eA < 1e-9, value: eA.toExponential(1)});
  out.push({name: 'every b-edge keeps its length', ok: eB < 1e-9, value: eB.toExponential(1)});
  out.push({name: 'every plate stays flat (rigid fold)', ok: plan < 1e-9, value: plan.toExponential(1)});
  out.push({name: 'every plate keeps its sector angle γ', ok: ang < 1e-9, value: ang.toExponential(1)});
  return out;
}
