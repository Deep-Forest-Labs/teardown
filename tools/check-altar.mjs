#!/usr/bin/env node
// Sweeps the Altar's operating script through the machine's checks, plus continuity: no input may jump between
// two samples 5 ms apart (the machine has no teleport). Exits 1 on any failure.
import {checks} from '../sims/altar-shared/kin.js';
import {DURATION, opsAt} from '../sims/altar-shared/script.js';

const fails = new Map();
let n = 0;
const note = (name, ok, value, t) => {
  n++;
  if (ok) return;
  const e = fails.get(name) || {count: 0, first: `${value} at t ${t.toFixed(3)}`};
  e.count++;
  fails.set(name, e);
};
const dt = 0.005;
let prev = opsAt(0);
for (let t = 0; t <= DURATION + 1e-9; t += dt) {
  const o = opsAt(t);
  for (const c of checks(o)) note(c.name, c.ok, c.value, t);
  // limits per 5 ms: 0.6 rad/s plus the fastest half turn (π in 1.5 s, peak about 1.9·π/1.5) and the fastest deck move
  for (const [k, lim] of [['theta', 0.025], ['psi', 0.025], ['hA', 0.4], ['hB', 0.4]]) note(`${k} continuous`, Math.abs(o[k] - prev[k]) <= lim, Math.abs(o[k] - prev[k]).toFixed(4), t);
  prev = o;
}
const bad = [...fails.values()].reduce((a, e) => a + e.count, 0);
console.log(`altar: ${n} checks, ${bad ? `${bad} fail` : 'all pass'}`);
for (const [name, e] of fails) console.log(`  ${e.count}x  ${name} = ${e.first}`);
process.exit(bad ? 1 : 0);
