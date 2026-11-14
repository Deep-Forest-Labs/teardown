// THE CHOPPING BLOCK V2, the horde (no three.js). For the game's own swarm, not the reference: a weak mote, many of
// them, controllable with movement. The horde flies. Each mote is a flock member in 3D: it chases the player at a pace
// the player can outrun (so a steady run kites the whole mass), keeps a little room round itself in every direction,
// and is drawn to its neighbours (so the mass bunches into a clump a shotgun or a spell clears in one go). Far from the
// player each mote cruises at its own height, high up, and rolling waves run through the mass toward the player, so it
// reads as a billowing volume in the air (the skull avalanche). Closing in, it dives: the front pours down onto the
// player and the back of the mass stays up. Only the nearest motes pursue (H.pursuers): past that number the rest drift
// up into a high, loose cloud that trails behind, wispy over the player's head and out of the kiting line. A fresh mote
// is flung high out of its censer first. Every height is over the player's feet, so whatever height the player
// reaches, the horde reaches too. Heights change by steering, never by snapping. Inputs: player, time. m, s.

export const H = {
  chase: 10.5, // m/s across the floor: the player runs 16, so a steady run pulls away; standing still, the mass arrives
  accel: 22, // m/s² steering across the floor
  space: 0.75, // m: the room a mote keeps in 3D (bodies may still overlap a little)
  spreadPerM: 0.09, // extra room per metre of height: the high part of the mass spreads out into a volume
  push: 40, // separation strength
  pack: 3.2, // m: neighbours within this count toward the clump
  cohesion: 1.6, // pull toward the local middle (3D)
  cruiseLo: 3, // m: the lowest cruise height
  cruiseHi: 16, // m: the highest
  waveAmp: 2.6, // m: rolling waves through the mass
  waveLen: 14, // m between wave crests, along the distance to the player
  waveSpeed: 9, // m/s the waves roll toward the player
  diveFar: 24, // m: inside this the mote starts down
  diveNear: 7, // m: by here it is at the player's height
  liftK: 5, // 1/s² vertical spring toward its wanted height
  liftDamp: 3.2, // 1/s vertical damping (smooth, no bounce)
  climbMax: 9, // m/s vertical speed cap
  pursuers: 140, // only this many (the nearest) chase and dive; the rest trail high
  trailLo: 13, // m over the player's feet: the trailing cloud's floor
  trailHi: 28, // and its top
  trailBack: 16, // m: a trailer keeps back this far across the floor
  trailPace: 0.8, // of chase: it trails, it does not catch up
  trailRoom: 2.2, // m of extra room each: the trailing cloud is loose and wispy
  trailCohesion: 0.35, // of cohesion: a loose cloud
  launch: 1.8, // s: a fresh mote is flung up first
  launchUp: 22, // m over the player's feet it is flung to (plus up to 10 more)
  launchV: 20, // m/s it leaves the censer upward
  cell: 3.2, // grid cell for the neighbour search (one ring of cells covers the pack radius)
};

/** A spatial hash of the motes on the floor plane, rebuilt each step: integer cell key -> indices. */
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

const smooth = (a, b, x) => {
  const u = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return u * u * (3 - 2 * u);
};
// a fixed per-mote number in [0, 1) from its id
const hash01 = (n) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

/** The height a mote wants: flung high when fresh; a trailer high in the loose cloud; a pursuer at its cruise height
 *  plus the rolling wave far out and the player's height up close. All over the player's feet. */
export function wantHeight(m, dist, playerY, t, trail = false) {
  const u = hash01(m.id ?? 0);
  const wave = H.waveAmp * Math.sin(((dist + H.waveSpeed * t) / H.waveLen) * Math.PI * 2 + u * 1.3);
  if (m.born != null && t - m.born < H.launch) return playerY + H.launchUp + 10 * u;
  if (trail) return playerY + H.trailLo + (H.trailHi - H.trailLo) * u + wave;
  const cruise = H.cruiseLo + (H.cruiseHi - H.cruiseLo) * Math.pow(u, 0.8);
  const near = playerY + 0.9 + u * 1.6; // the dive lands round the player's body, a little spread
  const s = smooth(H.diveNear, H.diveFar, dist);
  return Math.max(0.45, near + (playerY + cruise + wave - near) * s);
}

/** The distance inside which the nearest `n` motes sit (a 0.5 m histogram, no sort). */
const BINS = new Uint32Array(512);
function pursueRadius(ms, player, n) {
  if (ms.length <= n) return Infinity;
  BINS.fill(0);
  for (const m of ms) {
    const d = Math.hypot(player[0] - m.p[0], player[2] - m.p[2]);
    BINS[Math.min(511, (d * 2) | 0)]++;
  }
  let c = 0;
  for (let b = 0; b < 512; b++) {
    c += BINS[b];
    if (c >= n) return (b + 1) / 2;
  }
  return Infinity;
}

/** Step every horde mote together (they steer off each other). `player` is [x, y, z] (feet). */
export function stepHorde(ms, player, t, dt) {
  const g = grid(ms);
  const P2 = H.pack * H.pack;
  const R = pursueRadius(ms, player, H.pursuers);
  for (const m of ms) {
    if (!m.hv) m.hv = [Math.cos(m.yaw) * 6, H.launchV, Math.sin(m.yaw) * 6];
    const dx = player[0] - m.p[0];
    const dz = player[2] - m.p[2];
    const dist = Math.hypot(dx, dz) || 1e-6;
    // a little hysteresis so a mote on the edge of the pursuing pack does not flicker between roles
    const trail = (m.trail = m.trail ? dist > R - 1.5 : dist > R + 1.5);
    // a trailer holds back: it eases in at a slower pace and backs off inside trailBack across the floor
    const pace = trail ? H.chase * H.trailPace * (2 * smooth(H.trailBack - 6, H.trailBack + 6, dist) - 1) : H.chase;
    const wx = (dx / dist) * pace;
    const wz = (dz / dist) * pace;
    let sx = 0;
    let sy = 0;
    let sz = 0;
    let cx = 0;
    let cy = 0;
    let cz = 0;
    let nc = 0;
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
          const oy = m.p[1] - o.p[1];
          const oz = m.p[2] - o.p[2];
          const dd = ox * ox + oy * oy + oz * oz;
          if (dd > P2) continue;
          const d = Math.sqrt(dd) || 1e-6;
          cx += o.p[0];
          cy += o.p[1];
          cz += o.p[2];
          nc++;
          const room = H.space + H.spreadPerM * (m.p[1] > o.p[1] ? m.p[1] : o.p[1]) + (trail ? H.trailRoom : 0);
          if (d < room) {
            const f = ((room - d) / room) * H.push;
            sx += (ox / d) * f;
            sy += (oy / d) * f;
            sz += (oz / d) * f;
          }
        }
      }
    }
    let ax = (wx - m.hv[0]) * (H.accel / H.chase) + sx;
    let az = (wz - m.hv[2]) * (H.accel / H.chase) + sz;
    let ay = (wantHeight(m, dist, player[1], t, trail) - m.p[1]) * H.liftK - m.hv[1] * H.liftDamp + sy;
    if (nc) {
      const k = trail ? H.cohesion * H.trailCohesion : H.cohesion;
      ax += (cx / nc - m.p[0]) * k;
      ay += (cy / nc - m.p[1]) * k * 0.5;
      az += (cz / nc - m.p[2]) * k;
    }
    m.hv[0] += ax * dt;
    m.hv[1] += ay * dt;
    m.hv[2] += az * dt;
    const sp = Math.hypot(m.hv[0], m.hv[2]);
    const cap = H.chase * 1.25;
    if (sp > cap) {
      m.hv[0] *= cap / sp;
      m.hv[2] *= cap / sp;
    }
    const vmax = m.born != null && t - m.born < H.launch ? H.launchV : H.climbMax;
    m.hv[1] = Math.max(-H.climbMax, Math.min(vmax, m.hv[1]));
    m.p[0] += m.hv[0] * dt;
    m.p[1] += m.hv[1] * dt;
    m.p[2] += m.hv[2] * dt;
    if (m.p[1] < 0.45) {
      m.p[1] = 0.45;
      if (m.hv[1] < 0) m.hv[1] = 0;
    }
    m.yaw = Math.atan2(m.hv[2], m.hv[0]);
    m.dist = dist;
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
    const nn = meanNN(ms.filter((m) => !m.trail));
    out.push({name: 'the pursuers clump: neighbours close up as they close in (mean nearest under 1.1 m)', ok: nn < 1.1 && nn < nn0, value: `${nn0.toFixed(2)} → ${nn.toFixed(2)} m`});
    // 4. nobody stacks inside another
    let minD = Infinity;
    for (let i = 0; i < ms.length; i++) for (let j = i + 1; j < ms.length; j++) minD = Math.min(minD, Math.hypot(ms[i].p[0] - ms[j].p[0], ms[i].p[1] - ms[j].p[1], ms[i].p[2] - ms[j].p[2]));
    // bodies may overlap a little (Rob wants the overlap); they never sit on the same spot
    out.push({name: 'no two motes on the same spot (over 0.15 m apart)', ok: minD > 0.15, value: minD.toFixed(2)});
  }
  // it flies: chasing a jogging player from 40 m back, the mass is up in the air, high and deep in height
  {
    const ms = makeHorde(400, [-40, 0, 0], 10, 3);
    const path = (t) => [10 + 9 * t, 0, 4 * Math.sin(t * 0.6)];
    for (let t = 0; t < 3; t += dt) stepHorde(ms, path(t), t, dt);
    const ys = ms.map((m) => m.p[1]).sort((x, y) => x - y);
    const med = ys[ys.length >> 1];
    const spread = ys[Math.floor(ys.length * 0.9)] - ys[Math.floor(ys.length * 0.1)];
    out.push({name: 'far out the horde flies: median height over 5 m, over 4 m deep', ok: med > 5 && spread > 4, value: `median ${med.toFixed(1)} m, 10-90% ${spread.toFixed(1)} m`});
  }
  // it dives: on a standing player the front comes down to body height while the back stays up
  {
    const ms = makeHorde(400, [0, 0, 40], 20, 5);
    for (let t = 0; t < 2.8; t += dt) stepHorde(ms, [0, 0, 0], t, dt);
    const near = ms.filter((m) => m.dist < 5);
    const far = ms.filter((m) => m.dist > 18);
    const avg = (a) => a.reduce((q, m) => q + m.p[1], 0) / (a.length || 1);
    out.push({name: 'it dives: the front pours down round the player (under 3.5 m), the back still up', ok: near.length > 5 && avg(near) < 3.5 && far.length > 5 && avg(far) > 5, value: `front ${avg(near).toFixed(1)} m (${near.length}), back ${avg(far).toFixed(1)} m (${far.length})`});
  }
  // smooth: no mote's height jumps more than 0.25 m in one 60 Hz step
  {
    const ms = makeHorde(300, [-30, 0, 0], 12, 7);
    let worst = 0;
    for (let t = 0; t < 4; t += dt) {
      const y0 = ms.map((m) => m.p[1]);
      stepHorde(ms, [10 * Math.sin(t), 0, 6 * Math.cos(t * 0.7)], t, dt);
      ms.forEach((m, k) => (worst = Math.max(worst, Math.abs(m.p[1] - y0[k]))));
    }
    out.push({name: 'heights move smoothly (under 0.25 m a step)', ok: worst < 0.25, value: worst.toFixed(3)});
  }
  // past the pursuer count the rest trail: high over the player and held back off the kiting line
  {
    const ms = makeHorde(600, [-30, 0, 0], 14, 9);
    for (let t = 0; t < 8; t += dt) stepHorde(ms, [0, 0, 0], t, dt);
    const tr = ms.filter((m) => m.trail);
    const pu = ms.filter((m) => !m.trail);
    const avgY = tr.reduce((q, m) => q + m.p[1], 0) / (tr.length || 1);
    const close = tr.filter((m) => m.dist < 8).length;
    out.push({name: `only about ${H.pursuers} pursue; the rest trail high (over 10 m) and stay off the player`, ok: Math.abs(pu.length - H.pursuers) < 30 && avgY > 10 && close < tr.length * 0.05, value: `${pu.length} pursue, ${tr.length} trail at ${avgY.toFixed(1)} m, ${close} trailers within 8 m`});
  }
  // a fresh mote is flung high out of its censer
  {
    const ms = makeHorde(50, [0, 0, 30], 2, 11).map((m) => ({...m, born: 0}));
    let top = 0;
    for (let t = 0; t < 1.8; t += dt) {
      stepHorde(ms, [0, 0, 0], t, dt);
      top = Math.max(top, ms.reduce((q, m) => q + m.p[1], 0) / ms.length);
    }
    out.push({name: 'a fresh mote is flung high (average over 15 m)', ok: top > 15, value: top.toFixed(1)});
  }
  // whatever height the player is at, the pursuing front reaches it
  {
    const ms = makeHorde(100, [0, 0, 20], 6, 13);
    for (let t = 0; t < 4; t += dt) stepHorde(ms, [0, 6, 0], t, dt);
    const near = ms.filter((m) => m.dist < 4);
    const avg = near.reduce((q, m) => q + m.p[1], 0) / (near.length || 1);
    out.push({name: 'the front reaches a player 6 m up', ok: near.length > 3 && avg > 6, value: `${avg.toFixed(1)} m (${near.length})`});
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
