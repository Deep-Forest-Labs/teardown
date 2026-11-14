// FRAUD as one machine: a double-leaf bascule bridge, after Tower Bridge (London, 1894), model only (no three.js).
// Reference: two counterweighted leaves pivot on trunnions in the piers; raised, each stands near vertical; lowered,
// they meet mid-span. Each leaf is turned by pinions on a toothed quadrant fixed to its tail (originally hydraulic
// engines): leaf angle = pinion angle × r_pinion / R_quadrant. The bascule span is about 61 m, so a leaf is half that.
// Mapping onto the stage (v2): the archive floor lies between the two piers (the ledges); the raised leaves are the two
// tall mirror walls. PHASE 1: clauses drop floor tiles (trapdoors); the order is fixed at load so what is left is
// always one connected piece. PHASE 2: the leaves lower past level until their tips rest on the floor (ramps up to
// the ledges), the old floor falls away from the middle out, then the leaves rise to level and meet mid-room, a ledge
// height above the pit. Quire (the ledger) is not modelled in this study. Numbers: span real at scale K; ledge
// height, quadrant and pinion EST. Frame: y up, floor y = 0, the room across x.

export const K = 0.5;
export const B = {
  span: 61 * K, // bascule span (real, about 61 m)
  ledgeH: 6,
  raised: (86 * Math.PI) / 180, // Tower Bridge leaves open to about 86° (real)
  quadR: 3.2, // quadrant radius (EST)
  pinR: 0.4, // pinion radius (EST)
  nx: 8,
  nz: 6,
  clause: 3, // tiles per clause
};
B.leaf = B.span / 2;
B.tile = B.span / B.nx;
const TAU = Math.PI * 2;
/** The angle below level at which a lowered leaf's tip rests on the floor. */
export const RAMP = Math.asin(B.ledgeH / B.leaf);
/** Leaf on side s (−1 west, +1 east): pivot at the ledge edge, angle a above level (negative below). */
export function leafTip(s, a) {
  const px = s * B.leaf;
  return [px - s * B.leaf * Math.cos(a), B.ledgeH + B.leaf * Math.sin(a)];
}
export const pinionTurns = (a) => ((a * B.quadR) / B.pinR) / TAU;

// the floor tiles and a drop order that never leaves an island
const key = (i, j) => i * B.nz + j;
function connected(alive) {
  const cells = [];
  for (let i = 0; i < B.nx; i++) for (let j = 0; j < B.nz; j++) if (alive[key(i, j)]) cells.push([i, j]);
  if (cells.length === 0) return true;
  const seen = new Set([key(...cells[0])]);
  const q = [cells[0]];
  while (q.length) {
    const [i, j] = q.pop();
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const a = i + di;
      const b = j + dj;
      if (a < 0 || b < 0 || a >= B.nx || b >= B.nz || !alive[key(a, b)] || seen.has(key(a, b))) continue;
      seen.add(key(a, b));
      q.push([a, b]);
    }
  }
  return seen.size === cells.length;
}
const rand = (s) => {
  const x = Math.sin(s * 91.7 + 13.1) * 43758.5453;
  return x - Math.floor(x);
};
/** Clauses: the tiles each one drops, fixed at load. The columns under the lowered leaves' tips are never dropped. */
// the tile columns the lowered tips land in
const LANDING = [-1, 1].map((s) => Math.floor((leafTip(s, -RAMP)[0] + B.span / 2) / B.tile));
export const CLAUSES = (() => {
  const alive = Array(B.nx * B.nz).fill(true);
  const out = [];
  let seed = 1;
  for (let c = 0; c < 5; c++) {
    const drop = [];
    let tries = 0;
    while (drop.length < B.clause && tries < 400) {
      tries++;
      const i = 1 + Math.floor(rand(seed++) * (B.nx - 2));
      const j = Math.floor(rand(seed++) * B.nz);
      if (!alive[key(i, j)]) continue;
      if (LANDING.includes(i)) continue;
      alive[key(i, j)] = false;
      if (connected(alive)) drop.push([i, j]);
      else alive[key(i, j)] = true;
    }
    out.push(drop);
  }
  return out;
})();
export const tileCentre = (i, j) => [-B.span / 2 + (i + 0.5) * B.tile, (j - B.nz / 2 + 0.5) * B.tile];

export function checks(a) {
  const out = [];
  const L = leafTip(-1, 0);
  const R = leafTip(1, 0);
  out.push({name: 'level, the two leaves meet mid-room', ok: Math.abs(L[0]) < 1e-9 && Math.abs(R[0]) < 1e-9 && Math.abs(L[1] - B.ledgeH) < 1e-9, value: L[0].toFixed(3)});
  const T = leafTip(1, -RAMP);
  out.push({name: 'lowered past level, the tip rests on the floor', ok: Math.abs(T[1]) < 1e-9, value: ((RAMP * 180) / Math.PI).toFixed(2)});
  out.push({name: 'the ramp lands on a tile that never drops', ok: CLAUSES.flat().every(([i]) => Math.abs(tileCentre(i, 0)[0] - T[0]) > B.tile / 2) && CLAUSES.flat().every(([i]) => Math.abs(tileCentre(i, 0)[0] + T[0]) > B.tile / 2), value: T[0].toFixed(2)});
  const tip = leafTip(1, a);
  out.push({name: 'a leaf keeps its length', ok: Math.abs(Math.hypot(tip[0] - B.leaf, tip[1] - B.ledgeH) - B.leaf) < 1e-9, value: B.leaf.toFixed(2)});
  const alive = Array(B.nx * B.nz).fill(true);
  for (const c of CLAUSES) {
    for (const [i, j] of c) alive[key(i, j)] = false;
    out.push({name: 'after each clause the floor is one connected piece', ok: connected(alive), value: c.length});
  }
  return out;
}
export {TAU};
