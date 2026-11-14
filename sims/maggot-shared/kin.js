// GLUTTON MG-1, the maggot, model only. References: peristaltic crawling (earthworms, MIT's Meshworm): a wave of
// segment stretching runs back along the body; and the telescopic cylinder (nested stages, like a dump-truck hoist):
// every corpse it eats slides out one more stage and the body steps up a size. Each segment boundary moves as
// x_j = v·t − j·L + A·sin(ωt + jφ); with v = A·ω no boundary ever slides backward (each one stops, then goes).
// Inputs: time t and meals eaten m (0..3). Frame: x forward (it crawls +x), y up; metres.

export const G = {
  L: 0.42, // rest segment length at size 1
  A: 0.07, // stretch amplitude at size 1
  w: 2.4, // wave rad/s
  phi: 0.7, // phase step per segment
  r: 0.3, // girth at size 1
  baseSegs: 7,
  sizeStep: 0.22, // each meal grows it this fraction
};
export const sizeOf = (m) => 1 + G.sizeStep * m;
export const segsOf = (m) => G.baseSegs + Math.floor(m);

/** Boundary j's x at time t for size s: the head is j = 0. */
export function boundary(j, t, s) {
  const v = G.A * s * G.w; // the crawl speed that keeps every boundary from sliding back
  return v * t - j * G.L * s + G.A * s * Math.sin(G.w * t + j * G.phi);
}
export function body(t, m) {
  const s = sizeOf(Math.floor(m)) + (sizeOf(Math.floor(m) + 1) - sizeOf(Math.floor(m))) * (m - Math.floor(m));
  const n = segsOf(m) + (m - Math.floor(m) > 0 ? 1 : 0);
  const xs = Array.from({length: n + 1}, (_, j) => boundary(j, t, s));
  // girth bulges where a segment is short (it anchors there), thins where it is long
  const segs = [];
  for (let j = 0; j < n; j++) {
    const len = xs[j] - xs[j + 1];
    const r = G.r * s * (1 + 0.6 * (G.L * s - len) / (G.L * s));
    // the newest stage slides out of the last one while it grows (telescoping)
    const ext = j === n - 1 && m - Math.floor(m) > 0 ? m - Math.floor(m) : 1;
    segs.push({x0: xs[j + 1] + (1 - ext) * len, x1: xs[j], len: len * ext, r: r * (j === n - 1 ? 0.85 : 1)});
  }
  return {s, n, xs, segs};
}

export function checks(t, m) {
  const out = [];
  const s = sizeOf(Math.floor(m));
  const n = segsOf(Math.floor(m));
  const dt = 1e-4;
  let back = 0;
  for (let j = 0; j <= n; j++) back = Math.min(back, (boundary(j, t + dt, s) - boundary(j, t, s)) / dt);
  out.push({name: 'no boundary ever slides backward', ok: back >= -1e-6, value: back.toFixed(6)});
  const B = body(t, Math.floor(m));
  const minLen = Math.min(...B.segs.map((q) => q.len));
  out.push({name: 'segments never collapse (≥ 50% of rest)', ok: minLen >= 0.5 * G.L * s, value: (minLen / (G.L * s)).toFixed(3)});
  out.push({name: 'segments never overstretch (≤ 150% of rest)', ok: Math.max(...B.segs.map((q) => q.len)) <= 1.5 * G.L * s, value: (Math.max(...B.segs.map((q) => q.len)) / (G.L * s)).toFixed(3)});
  // telescoping: each new stage nests inside the last (smaller girth), and sizes step up per meal
  out.push({name: 'each meal steps the size up', ok: sizeOf(Math.floor(m) + 1) > s, value: (sizeOf(Math.floor(m) + 1) / s).toFixed(3)});
  return out;
}
