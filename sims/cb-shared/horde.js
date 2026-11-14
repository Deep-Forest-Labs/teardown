// THE CHOPPING BLOCK V2, the horde (no three.js). For the game's own swarm, not the reference: a weak mote, many of
// them, controllable with movement. Each mote steers like a crowd member: it wants to run at the player at a pace the
// player can outrun (so a steady run kites the whole mass), it keeps a small personal space, and it is drawn toward its
// neighbours (so the mass bunches into a tight clump a shotgun or a spell clears in one go). Where they crowd, they climb:
// a mote's height follows how many are packed round it, so the mass heaps up like a pile pouring after you,
// and the higher layers spread out, so it reads as a volume. Inputs: the player's position, time. Units: m, s.

export const H = {
  chase: 10.5, // m/s on the ground: the player runs 16, so a steady run pulls away; standing still, the mass arrives
  accel: 22, // m/s² steering
  space: 0.55, // personal space (m) on the floor plane; the higher layers keep more room (spread)
  spreadPerM: 0.12, // extra personal space per metre of height
  push: 40, // separation strength
  pack: 2.4, // m: neighbours within this count toward the clump
  cohesion: 2.2, // pull toward the local middle
  layer: 0.7, // m per layer: motes stack in floor columns, so the dense middle of the mass stands highest (a mound)
  column: 1.1, // m: the floor column a mote stacks in
  maxH: 11, // the heap's top
  climb: 9, // m/s up or down toward its heap height
  crest: 0.6, // within 6 m of the player the front rears up (a wave breaking over you)
  cell: 2.4, // grid cell for the neighbour search (one ring of cells covers the pack radius)
};

/** A spatial hash of the motes, rebuilt each step: integer cell key -> indices. */
const key = (ix, iz) => (ix + 4096) * 8192 + (iz + 4096);
export function grid(ms) {
  const g = new Map();
  for (let i = 0; i < ms.length; i++) {
    const m = ms[i];
    const k = key(Math.floor(m.p[0] / H.cell), Math.floor(m.p[2] / H.cell));
    let a = g.get(k);
    if (!a) g.set(k, (a = []));
    a.push(i);
  }
  return g;
}

/** Step every horde mote together (they steer off each other). `player` is [x, y, z] (feet). */
export function stepHorde(ms, player, t, dt) {
  const g = grid(ms);
  const P2 = H.pack * H.pack;
  for (const m of ms) {
    if (!m.hv) m.hv = [Math.cos(m.yaw) * 6, 0, Math.sin(m.yaw) * 6];
    // chase: a desired velocity straight at the player at the chase pace
    const dx = player[0] - m.p[0];
    const dz = player[2] - m.p[2];
    const dist = Math.hypot(dx, dz) || 1e-6;
    const wx = (dx / dist) * H.chase;
    const wz = (dz / dist) * H.chase;
    // neighbours: personal space, the local middle, how packed it is round here
    let sx = 0;
    let sz = 0;
    let cx = 0;
    let cz = 0;
    let nc = 0;
    let packed = 0;
    const gx = Math.floor(m.p[0] / H.cell);
    const gz = Math.floor(m.p[2] / H.cell);
    for (let ix = gx - 1; ix <= gx + 1; ix++) {
      for (let iz = gz - 1; iz <= gz + 1; iz++) {
        const cell = g.get(key(ix, iz));
        if (!cell) continue;
        for (let q = 0; q < cell.length; q++) {
          const o = ms[cell[q]];
          if (o === m) continue;
          const ox = m.p[0] - o.p[0];
          const oz = m.p[2] - o.p[2];
          const dd = ox * ox + oz * oz;
          if (dd > P2) continue;
          const d = Math.sqrt(dd) || 1e-6;
          cx += o.p[0];
          cz += o.p[2];
          nc++;
          if (d < 1.4) packed++;
          // personal space on the floor plane, so the crowd keeps a footprint; the higher a mote rides, the more
          // room it keeps (the top of the pile spreads out)
          const room = H.space + H.spreadPerM * (m.p[1] > o.p[1] ? m.p[1] : o.p[1]);
          if (d < room) {
            const f = ((room - d) / room) * H.push;
            sx += (ox / d) * f;
            sz += (oz / d) * f;
          }
        }
      }
    }
    let ax = (wx - m.hv[0]) * (H.accel / H.chase) + sx;
    let az = (wz - m.hv[2]) * (H.accel / H.chase) + sz;
    if (nc) {
      ax += (cx / nc - m.p[0]) * H.cohesion;
      az += (cz / nc - m.p[2]) * H.cohesion;
    }
    m.hv[0] += ax * dt;
    m.hv[2] += az * dt;
    const sp = Math.hypot(m.hv[0], m.hv[2]);
    const cap = H.chase * 1.25;
    if (sp > cap) {
      m.hv[0] *= cap / sp;
      m.hv[2] *= cap / sp;
    }
    m.p[0] += m.hv[0] * dt;
    m.p[2] += m.hv[2] * dt;
    m.yaw = Math.atan2(m.hv[2], m.hv[0]);
    m.packed = packed;
    m.dist = dist;
  }
  // height: a pile. Motes stack in floor columns, lowest first (by who got there first), so a column at the dense
  // middle stands highest and the edges stay low; the front crests as it reaches the player
  const cols = new Map();
  for (const m of ms) {
    const k = key(Math.floor(m.p[0] / H.column), Math.floor(m.p[2] / H.column));
    let a = cols.get(k);
    if (!a) cols.set(k, (a = []));
    a.push(m);
  }
  for (const a of cols.values()) {
    if (a.length > 1) a.sort((x, y) => x.p[1] - y.p[1] || (x.id ?? 0) - (y.id ?? 0));
    for (let layer = 0; layer < a.length; layer++) {
      const m = a[layer];
      const crest = m.dist < 6 ? H.crest * (6 - m.dist) * Math.min(1, a.length / 3) : 0;
      const hTarget = Math.min(H.maxH, 0.45 + layer * H.layer + crest);
      m.p[1] += Math.max(-H.climb * dt, Math.min(H.climb * dt, hTarget - m.p[1]));
    }
  }
}

// ---------------------------------------------------------------- checks
function makeHorde(n, at, spread, seed = 1) {
  const ms = [];
  for (let i = 0; i < n; i++) {
    const a = ((Math.sin(i * 12.9898 + seed) * 43758.5453) % 1) * Math.PI * 2;
    const r = spread * Math.sqrt(Math.abs((Math.sin(i * 78.233 + seed) * 12345.678) % 1));
    ms.push({id: i, p: [at[0] + r * Math.cos(a), 0.45, at[2] + r * Math.sin(a)], yaw: 0});
  }
  return ms;
}
export function checks() {
  const out = [];
  const dt = 1 / 60;
  // 1. kiteable: a player running a steady 16 m/s pulls away from the mass
  {
    const ms = makeHorde(200, [-30, 0, 0], 8);
    const path = (t) => [-5 + 16 * t, 0, 0];
    let gap0 = null;
    let gap1 = null;
    for (let t = 0; t < 4; t += dt) {
      stepHorde(ms, path(t), t, dt);
      const lead = Math.max(...ms.map((m) => m.p[0]));
      if (t > 0.5 && gap0 === null) gap0 = path(t)[0] - lead;
      gap1 = path(t)[0] - lead;
    }
    out.push({name: 'kiteable: a steady 16 m/s run pulls away from the mass', ok: gap1 > gap0 + 10, value: `${gap0.toFixed(1)} → ${gap1.toFixed(1)} m`});
  }
  // 2. it clumps: a scattered 300 chasing a standing player packs into a tight mass
  {
    const ms = makeHorde(300, [0, 0, 30], 25);
    let nn0 = null;
    for (let t = 0; t < 6; t += dt) {
      stepHorde(ms, [0, 0, 0], t, dt);
      if (nn0 === null) nn0 = meanNN(ms);
    }
    const nn = meanNN(ms);
    out.push({name: 'it clumps: neighbours close up as it closes in (mean nearest under 1.1 m)', ok: nn < 1.1 && nn < nn0, value: `${nn0.toFixed(2)} → ${nn.toFixed(2)} m`});
    // 3. it heaps: packed, the mass climbs over itself (top over 3 m) and the upper layers have more room
    const top = Math.max(...ms.map((m) => m.p[1]));
    out.push({name: 'pinned on a standing player it piles up (top over 3 m)', ok: top > 3, value: top.toFixed(1)});
    // 4. nobody stacks inside another
    let minD = Infinity;
    for (let i = 0; i < ms.length; i++) for (let j = i + 1; j < ms.length; j++) minD = Math.min(minD, Math.hypot(ms[i].p[0] - ms[j].p[0], ms[i].p[1] - ms[j].p[1], ms[i].p[2] - ms[j].p[2]));
    // bodies may overlap a little (Rob wants the overlap); they never sit on the same spot
    out.push({name: 'no two motes on the same spot (over 0.15 m apart)', ok: minD > 0.15, value: minD.toFixed(2)});
  }
  // 3. kited at a jog it pours after you as a mound: a tall middle, low edges
  {
    const ms = makeHorde(400, [-10, 0, 0], 10, 3);
    const path = (t) => [12 + 9 * t, 0, 4 * Math.sin(t * 0.6)];
    for (let t = 0; t < 6; t += dt) stepHorde(ms, path(t), t, dt);
    const hi = ms.filter((m) => m.p[1] > 2).length;
    const lo = ms.filter((m) => m.p[1] < 1).length;
    out.push({name: 'chasing a jogging player it is a mound: a high middle, low edges', ok: hi > 20 && lo > 60, value: `${lo} low, ${hi} over 2 m, top ${Math.max(...ms.map((m) => m.p[1])).toFixed(1)}`});
  }
  return out;
}
function meanNN(ms) {
  let s = 0;
  for (let i = 0; i < ms.length; i++) {
    let b = Infinity;
    for (let j = 0; j < ms.length; j++) if (i !== j) b = Math.min(b, Math.hypot(ms[i].p[0] - ms[j].p[0], ms[i].p[1] - ms[j].p[1], ms[i].p[2] - ms[j].p[2]));
    s += b;
  }
  return s / ms.length;
}
