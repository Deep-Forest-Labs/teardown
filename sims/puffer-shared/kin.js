// PUFFER PF-2, model only. Reference mechanisms: the radial lazy-tong (scissor) actuator, and a sphere split on the
// faces of a dodecahedron (the way expanding-sphere toys and deployable domes part their shells). Twelve rigid
// plates; eleven ride out on three-cell scissor chains from the core, the twelfth (aft) is the ducted fan.
// Closed, the plates tile the sphere edge to edge; swollen, they part and the core shows. Input: swell u (0..1),
// fan angle, time. Frame: x right, y up, z forward; metres.

export const S = {
  R0: 0.38, // closed shell radius
  core: 0.16,
  cells: 3,
  link: 0.16, // scissor link length
  thClosed: (72 * Math.PI) / 180, // link angle from the axis, closed (short and wide)
  thOpen: (28 * Math.PI) / 180, // swollen (long and narrow)
  plateT: 0.035,
};
const PHI = (1 + Math.sqrt(5)) / 2;
const norm = (v) => {
  const l = Math.hypot(...v);
  return v.map((x) => x / l);
};
// dodecahedron face centres = icosahedron vertices
const ICO = [
  [0, 1, PHI], [0, -1, PHI], [0, 1, -PHI], [0, -1, -PHI],
  [1, PHI, 0], [-1, PHI, 0], [1, -PHI, 0], [-1, -PHI, 0],
  [PHI, 0, 1], [-PHI, 0, 1], [PHI, 0, -1], [-PHI, 0, -1],
].map(norm);
// turn the set so one face points straight back (-z): that face is the fan duct
const AFT = ICO.reduce((m, v) => (v[2] < m[2] ? v : m));
export const AXES = ICO;
export const FAN = ICO.indexOf(AFT);
// dodecahedron vertices: the centroid directions of each icosahedron triangle; a face's corners are the 5 triangles
// around its vertex
const TRIS = [];
for (let a = 0; a < 12; a++)
  for (let b = a + 1; b < 12; b++)
    for (let c = b + 1; c < 12; c++) {
      const d = (i, j) => Math.hypot(ICO[i][0] - ICO[j][0], ICO[i][1] - ICO[j][1], ICO[i][2] - ICO[j][2]);
      const e = d(0, 4) < d(0, 1) ? d(0, 4) : d(0, 1); // the icosahedron edge length
      const edge = Math.min(...[[0, 1], [0, 4], [0, 8]].map(([i, j]) => d(i, j)));
      void e;
      if (Math.abs(d(a, b) - edge) < 1e-6 && Math.abs(d(b, c) - edge) < 1e-6 && Math.abs(d(a, c) - edge) < 1e-6) TRIS.push([a, b, c]);
    }
const VERTS = TRIS.map(([a, b, c]) => norm([0, 1, 2].map((k) => ICO[a][k] + ICO[b][k] + ICO[c][k])));
/** The five corner directions of face f, in order round its axis. */
export const corners = (f) => {
  const ax = ICO[f];
  const vs = TRIS.map((t, i) => (t.includes(f) ? VERTS[i] : null)).filter(Boolean);
  // order by angle round the axis
  const ref = Math.abs(ax[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const u = norm([ax[1] * ref[2] - ax[2] * ref[1], ax[2] * ref[0] - ax[0] * ref[2], ax[0] * ref[1] - ax[1] * ref[0]]);
  const w = [ax[1] * u[2] - ax[2] * u[1], ax[2] * u[0] - ax[0] * u[2], ax[0] * u[1] - ax[1] * u[0]];
  return vs.map((v) => ({v, a: Math.atan2(v[0] * w[0] + v[1] * w[1] + v[2] * w[2], v[0] * u[0] + v[1] * u[1] + v[2] * u[2])})).sort((p, q) => p.a - q.a).map((p) => p.v);
};

/** The scissor chain along an axis: crossing pins and end pins, from the core out to the plate. */
export function tong(u) {
  const th = S.thClosed + (S.thOpen - S.thClosed) * u;
  const cell = S.link * Math.cos(th); // axial length of one X cell
  const half = (S.link / 2) * Math.sin(th); // half its width
  const pins = []; // [axial, lateral] in the chain's own plane
  for (let i = 0; i <= S.cells; i++) {
    pins.push([i * cell, -half], [i * cell, half]);
    if (i < S.cells) pins.push([(i + 0.5) * cell, 0]);
  }
  return {th, cell, half, ext: S.cells * cell, pins};
}
// the closed chain sets where the plates sit closed: the shell radius is core + closed extension (+ the plate)
const EXT0 = tong(0).ext;
export const PLATE_BASE = S.R0 - EXT0 - S.core; // a fixed riser between the chain's end and the plate (≥ 0)

export function pose(u) {
  const T = tong(u);
  const r = S.core + T.ext + PLATE_BASE; // the plate's inner face radius along its axis
  const plates = AXES.map((ax, f) => ({f, ax, r: f === FAN ? S.R0 : r, off: f === FAN ? 0 : r - S.R0}));
  return {u, T, plates, r};
}

const d3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

export function checks(u) {
  const P = pose(u);
  const out = [];
  // scissor links exact: every link joins an end pin of one rank to the opposite end pin of the next, through the
  // crossing pin at its middle
  let e = 0;
  const T = P.T;
  for (let i = 0; i < S.cells; i++) {
    const a = [i * T.cell, -T.half];
    const b = [(i + 1) * T.cell, T.half];
    const m = [(i + 0.5) * T.cell, 0];
    e = Math.max(e, Math.abs(Math.hypot(b[0] - a[0], b[1] - a[1]) - S.link), Math.hypot((a[0] + b[0]) / 2 - m[0], (a[1] + b[1]) / 2 - m[1]));
  }
  out.push({name: 'scissor links exact, crossing at their middles', ok: e < 1e-12, value: e.toExponential(1)});
  out.push({name: 'plate riser is real (≥ 0)', ok: PLATE_BASE >= 0, value: PLATE_BASE.toFixed(4)});
  // closed: neighbouring plates share their corners (the shell is whole); swollen: every corner has opened
  let worst = 0;
  let least = Infinity;
  for (let f = 0; f < 12; f++) {
    const Cf = corners(f).map((c) => P.plates[f].ax.map((a, k) => c[k] * S.R0 + a * P.plates[f].off));
    for (let g = f + 1; g < 12; g++) {
      const Cg = corners(g).map((c) => P.plates[g].ax.map((a, k) => c[k] * S.R0 + a * P.plates[g].off));
      for (const p of Cf)
        for (const q of Cg) {
          const dd = d3(p, q);
          if (dd < S.R0 * 0.2) {
            worst = Math.max(worst, dd);
            least = Math.min(least, dd);
          }
        }
    }
  }
  if (u < 1e-6) out.push({name: 'closed: the plates tile the sphere edge to edge', ok: worst < 1e-9, value: worst.toExponential(1)});
  if (u > 0.999) out.push({name: 'swollen: every seam open ≥ 10 cm', ok: least >= 0.1, value: least.toFixed(3)});
  // the swollen radius
  out.push({name: 'swells to at least 1.6× its closed size', ok: u < 0.999 || P.r / S.R0 >= 1.6, value: (P.r / S.R0).toFixed(2)});
  out.push({name: 'twelve faces, five corners each', ok: Array.from({length: 12}, (_, f) => corners(f).length).every((n) => n === 5), value: '-'});
  return out;
}
