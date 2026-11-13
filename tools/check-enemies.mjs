#!/usr/bin/env node
// Runs every enemy kin file's checks over a sweep of time and target positions. Exits 1 on any failure.
// Usage: node tools/check-enemies.mjs [id]   (ids are the kin file names in sims/hub/enemies, e.g. skull)
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const DIR = path.resolve('sims/hub/enemies');
const only = process.argv[2];
let bad = 0;
for (const f of fs.readdirSync(DIR).filter((f) => f.endsWith('.kin.js'))) {
  const id = f.replace('.kin.js', '');
  if (only && only !== id) continue;
  const kin = await import(pathToFileURL(path.join(DIR, f)).href);
  const fails = new Map();
  let n = 0;
  for (const P of [[0, 0, 0], [12, 3, -7]]) {
    for (let t = 0; t < 40; t += 0.037) {
      for (const c of kin.checks(t, P)) {
        n++;
        if (!c.ok) {
          const e = fails.get(c.name) || {count: 0, first: `${c.value} at t ${t.toFixed(3)} P ${P}`};
          e.count++;
          fails.set(c.name, e);
        }
      }
    }
  }
  const nf = [...fails.values()].reduce((a, e) => a + e.count, 0);
  bad += nf;
  console.log(`${id}: ${n} checks, ${nf ? `${nf} fail` : 'all pass'}`);
  for (const [name, e] of fails) console.log(`  ${e.count}x  ${name} = ${e.first}`);
}
process.exit(bad ? 1 : 0);
