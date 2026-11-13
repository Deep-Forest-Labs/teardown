// Fraud and Quire, model only: a mirrored archive. Stage value s from 0 to 3:
//   0       RUN       a tiled archive floor between two raised ledges, each carrying a tall mirror wall. No boss.
//   0 → 1   ARRIVAL   Quire, a 30 m open ledger, drops from the dark and opens his pages over the floor.
//   1 → 2   PHASE 1   clauses: every 6 s he writes a clause and a set of tiles turns false and drops; his quills
//                     touch the tiles about to go (the tell). Stranded islands go with them, so the floor that is
//                     left is always one connected piece.
//   2 → 3   PHASE 2   the contract: the mirror walls fold inward past level until their tips rest on the floor
//                     (ramps up to the ledges), the old floor falls away from the middle out, then the walls lift to
//                     level. Their length is the half-width, so the two mirrors meet exactly mid-room as the new
//                     floor, a ledge-height above the pit.
import {fabrik, seg, v} from './rig.js';

export const SPEC = {
  cell: 4.4,
  tileGap: 0.2,
  nx: 10, // tiles across, at scale 1 (kept even)
  nz: 6,
  ledge: {w: 3, h: 6},
  wallT: 0.6,
  clauseEvery: 6,
  falseShare: 4, // one tile in four turns false per clause
  quire: {page: [10, 0.6, 14], hover: 11, quill: {links: 6, linkL: 3}},
  maxRamp: 35, // degrees
};

export function layout(scale) {
  const nx = Math.max(4, 2 * Math.round((SPEC.nx * scale) / 2));
  const nz = Math.max(4, 2 * Math.round((SPEC.nz * scale) / 2));
  const fieldX = (nx * SPEC.cell) / 2;
  const fieldZ = (nz * SPEC.cell) / 2;
  const hingeX = fieldX + SPEC.ledge.w;
  const wallL = hingeX; // folded level, the two walls meet at x = 0
  // ramps: folded past level until the tip rests on the floor (y = 0): ledge.h + wallL·cos θ = 0
  const thRamp = Math.acos(-SPEC.ledge.h / wallL);
  return {nx, nz, fieldX, fieldZ, hingeX, wallL, thRamp, depth: nz * SPEC.cell};
}

// a deterministic hash for clause patterns
const hash = (x, z, c) => {
  let h = Math.imul(x + 1, 73856093) ^ Math.imul(z + 1, 19349663) ^ Math.imul(c + 7, 83492791);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) % 1000;
};

/** Which tiles are false under clause c. Stranded islands fall too, so what stays is one connected piece. */
export function clauseFalse(L, c) {
  const {nx, nz} = L;
  const id = (i, j) => i * nz + j;
  const fake = new Uint8Array(nx * nz);
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) fake[id(i, j)] = hash(i, j, c) % SPEC.falseShare === 0 ? 1 : 0;
  // label the true tiles' pieces; the largest piece stays, the rest fall with the clause
  const comp = new Int32Array(nx * nz).fill(-1);
  const sizes = [];
  for (let k0 = 0; k0 < nx * nz; k0++) {
    if (fake[k0] || comp[k0] >= 0) continue;
    const c = sizes.length;
    let n = 0;
    const stack = [[Math.floor(k0 / nz), k0 % nz]];
    comp[k0] = c;
    while (stack.length) {
      const [i, j] = stack.pop();
      n++;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const a = i + di;
        const b = j + dj;
        if (a < 0 || b < 0 || a >= nx || b >= nz || fake[id(a, b)] || comp[id(a, b)] >= 0) continue;
        comp[id(a, b)] = c;
        stack.push([a, b]);
      }
    }
    sizes.push(n);
  }
  const big = sizes.indexOf(Math.max(...sizes));
  const seen = comp.map((c) => (c === big ? 1 : 0));
  for (let k = 0; k < nx * nz; k++) if (!seen[k]) fake[k] = 1;
  return fake;
}

export const tileCentre = (L, i, j) => [(i - L.nx / 2 + 0.5) * SPEC.cell, 0, (j - L.nz / 2 + 0.5) * SPEC.cell];

export function model(s, t, scale = 1) {
  const L = layout(scale);
  const out = {tubes: [], slabs: [], balls: [], weak: [], spots: [], info: {}, L};
  const arrive = seg(s, 0.1, 0.9);
  const pages = seg(s, 0.6, 1);
  const ramp = seg(s, 2, 2.2);
  const lift = seg(s, 2.6, 2.85);
  // walls: angle from vertical; 0 standing, thRamp as ramps, π/2 level as the new floor
  const th = ramp * L.thRamp + lift * (Math.PI / 2 - L.thRamp);
  out.walls = [];
  for (const sx of [-1, 1]) {
    const hinge = [sx * L.hingeX, SPEC.ledge.h, 0];
    const dir = [-sx * Math.sin(th), Math.cos(th), 0];
    const n = [sx * Math.cos(th), Math.sin(th), 0]; // the mirror face that ends up on top
    const tip = v.add(hinge, v.mul(dir, L.wallL));
    out.walls.push({sx, hinge, dir, n, tip});
    // the top face lies on the hinge line, so the floor it makes sits exactly at ledge height
    out.slabs.push({k: 'mirror', p: v.add(v.lerp(hinge, tip, 0.5), v.mul(n, -SPEC.wallT / 2)), up: n, fwd: dir, s: [L.depth + 2 * SPEC.ledge.w, SPEC.wallT, L.wallL]});
  }
  // tiles: clauses in phase one; in phase two the whole floor falls from the middle out, after the ramps land
  const spawnTile = [L.nx / 2, L.nz - 1];
  const clause = Math.floor(t / SPEC.clauseEvery);
  const inClause = (t % SPEC.clauseEvery) / SPEC.clauseEvery; // 0..1 through this clause
  const clauses = s >= 1 && s < 2.4;
  const fake = clauses ? clauseFalse(L, clause) : null;
  out.tiles = [];
  const maxD = Math.hypot(L.fieldX, L.fieldZ);
  for (let i = 0; i < L.nx; i++) {
    for (let j = 0; j < L.nz; j++) {
      const c = tileCentre(L, i, j);
      const isFake = fake ? fake[i * L.nz + j] === 1 : false;
      // a false tile shakes from 1/3 of the clause and drops from 1/2; it is back for the next clause
      const clauseDrop = isFake ? seg(inClause, 0.5, 0.75) : 0;
      const fall = seg(s, 2.25 + (Math.hypot(c[0], c[2]) / maxD) * 0.2, 2.4 + (Math.hypot(c[0], c[2]) / maxD) * 0.2);
      const y = -Math.max(clauseDrop, fall) * 18;
      const shake = isFake && inClause > 0.33 && inClause < 0.5 ? Math.sin(t * 60 + i) * 0.08 : 0;
      out.tiles.push({i, j, p: [c[0] + shake, y - 0.3, c[2]], fake: isFake, gone: y < -1});
      out.slabs.push({k: isFake && inClause > 0.33 ? 'tileFalse' : 'tile', p: [c[0] + shake, y - 0.3, c[2]], up: [0, 1, 0], fwd: [0, 0, 1], s: [SPEC.cell - SPEC.tileGap, 0.6, SPEC.cell - SPEC.tileGap]});
    }
  }
  // Quire: drops from the dark, hovers over the clause, rises over the new floor in phase two
  const Q = SPEC.quire;
  const falseTiles = out.tiles.filter((T) => T.fake);
  const centroid = falseTiles.length ? v.mul(falseTiles.reduce((a, T) => v.add(a, T.p), [0, 0, 0]), 1 / falseTiles.length) : [0, 0, 0];
  const over = clauses ? [centroid[0] * 0.5, 0, centroid[2] * 0.5] : [0, 0, 0];
  const hoverY = Q.hover + seg(s, 2.6, 3) * (SPEC.ledge.h + 6);
  const qc = [over[0], 90 * (1 - arrive) + hoverY + Math.sin(t * 0.5) * 0.6, over[2]];
  const yaw = t * 0.12;
  const fwd = [Math.sin(yaw), 0, Math.cos(yaw)];
  const right = [Math.cos(yaw), 0, -Math.sin(yaw)];
  const open = 0.15 + 0.85 * pages; // page tilt opens toward flat
  for (const sx of [-1, 1]) {
    const tilt = (1 - open) * 1.2 + 0.22 * open; // radians up from flat
    const pageDir = v.add(v.mul(right, sx * Math.cos(tilt)), [0, Math.sin(tilt), 0]);
    out.slabs.push({k: 'page', p: v.add(qc, v.mul(pageDir, Q.page[0] / 2 + 0.2)), up: v.norm(v.add(v.mul(right, -sx * Math.sin(tilt)), [0, Math.cos(tilt), 0])), fwd, s: [Q.page[0], Q.page[1], Q.page[2]]});
  }
  out.slabs.push({k: 'spine', p: v.add(qc, [0, -0.8, 0]), up: [0, 1, 0], fwd, s: [0.8, 1.2, Q.page[2] + 0.4]});
  // quills: from the outer page edges, each writes the false tile nearest it (the tell)
  out.quills = [];
  for (const sx of [-1, 1]) {
    const base = v.add(qc, v.add(v.mul(right, sx * (Q.page[0] + 0.4)), [0, 0.6, 0]));
    let target = v.add(base, [0, -Q.quill.links * Q.quill.linkL * 0.6, 0]);
    if (clauses && falseTiles.length && inClause < 0.5) {
      let best = Infinity;
      for (const T of falseTiles) {
        const d = v.dist(T.p, base);
        if (d < best) {
          best = d;
          target = [T.p[0], 0.05, T.p[2]];
        }
      }
    }
    const pts = fabrik(base, target, Q.quill.links, Q.quill.linkL, v.add(base, v.mul(right, sx * 6)), 48);
    out.quills.push({sx, pts, target});
    for (let i = 0; i < Q.quill.links; i++) out.tubes.push({k: 'quill', a: pts[i], b: pts[i + 1], r: 0.3 + 0.2 * (1 - i / Q.quill.links), round: true});
  }
  out.weak.push({id: 'spine', p: v.add(qc, [0, 0.2, 0]), open: s >= 2.6 ? 1 : s >= 1 ? 0.5 * pages : 0, r: 1});
  out.quire = {qc};
  for (let k = 0; k < 8; k++) {
    const c = tileCentre(L, (k * 3 + 1) % L.nx, (k * 5 + 2) % L.nz);
    out.spots.push([c[0], 0.2, c[2]]);
  }
  out.spawn = tileCentre(L, ...spawnTile);
  out.info = {arrive, pages, ramp, lift, th, clause, inClause, clauses, falseCount: falseTiles.length};
  return out;
}

export function checks(s, t, scale = 1) {
  const m = model(s, t, scale);
  const {L} = m;
  const out = [];
  if (m.info.clauses) {
    // the floor that is left connects (the flood fill guarantees it; check it anyway, independently)
    const keep = m.tiles.filter((T) => !T.fake);
    const key = (T) => `${T.i},${T.j}`;
    const set = new Set(keep.map(key));
    const seen = new Set([key(keep[0])]);
    const st = [keep[0]];
    while (st.length) {
      const T = st.pop();
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const k = `${T.i + di},${T.j + dj}`;
        if (set.has(k) && !seen.has(k)) {
          seen.add(k);
          st.push({i: T.i + di, j: T.j + dj});
        }
      }
    }
    out.push({name: 'clause: the true floor stays connected', ok: seen.size === keep.length, value: `${seen.size}/${keep.length}`});
    out.push({name: 'clause: at least 55% of the floor stays', ok: keep.length >= 0.55 * m.tiles.length, value: `${keep.length}/${m.tiles.length}`});
  }
  if (m.info.ramp > 0.999 && m.info.lift < 0.001) {
    for (const W of m.walls) {
      out.push({name: 'ramp: tip rests on the floor', ok: Math.abs(W.tip[1]) < 0.05, value: W.tip[1].toFixed(3)});
      const deg = (Math.asin(SPEC.ledge.h / L.wallL) * 180) / Math.PI;
      out.push({name: `ramp: walkable (≤ ${SPEC.maxRamp}°)`, ok: deg <= SPEC.maxRamp, value: deg.toFixed(1)});
      out.push({name: 'ramp: tip lands on the tile field', ok: Math.abs(W.tip[0]) < L.fieldX, value: W.tip[0].toFixed(2)});
    }
  }
  if (m.info.lift > 0.999) {
    const gap = v.dist(m.walls[0].tip, m.walls[1].tip);
    out.push({name: 'contract: mirrors meet mid-room', ok: gap < 0.05, value: gap.toFixed(3)});
    out.push({name: 'contract: new floor at ledge height', ok: Math.abs(m.walls[0].tip[1] - SPEC.ledge.h) < 0.05, value: m.walls[0].tip[1].toFixed(3)});
    out.push({name: 'contract: Quire above the new floor', ok: m.quire.qc[1] - SPEC.ledge.h > 8, value: (m.quire.qc[1] - SPEC.ledge.h).toFixed(1)});
  }
  if (m.info.ramp < 0.001) for (const W of m.walls) out.push({name: 'walls stand on their ledges', ok: Math.abs(W.tip[1] - SPEC.ledge.h - L.wallL) < 1e-6, value: '-'});
  for (const q of m.quills) {
    let e = 0;
    for (let i = 0; i < SPEC.quire.quill.links; i++) e = Math.max(e, Math.abs(v.dist(q.pts[i], q.pts[i + 1]) - SPEC.quire.quill.linkL));
    out.push({name: 'quill links exact', ok: e < 1e-6, value: e.toExponential(1)});
  }
  if (s < 0.02) out.push({name: 'no boss in the run', ok: m.quire.qc[1] > 60, value: m.quire.qc[1].toFixed(1)});
  return out;
}

export const STATES = [
  {at: 0, name: 'Run', note: 'A tiled archive between two mirror walls. No boss.'},
  {at: 0.5, name: 'Arrival', note: 'Quire drops from the dark and opens his pages.'},
  {at: 1, name: 'Phase 1', note: 'Clauses: his quills mark tiles, then they drop; the rest always connects.'},
  {at: 2, name: 'Phase 2', note: 'The mirrors fold into ramps, the floor falls, the mirrors lift and meet as the new floor.'},
];
