#!/usr/bin/env node
// Runs every stage's interlock checks across its states, through time, at several arena scales, and prints a
// summary. Exit code 1 when any check fails. Usage: node tools/check-stages.mjs [stageId ...]
import {readdirSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'sims', 'hub', 'stages');
const want = process.argv.slice(2);
const files = readdirSync(DIR).filter((f) => f.endsWith('.kin.js') && (!want.length || want.includes(f.replace('.kin.js', ''))));
let bad = 0;
for (const f of files) {
  const mod = await import(pathToFileURL(path.join(DIR, f)).href);
  const fails = new Map();
  let n = 0;
  for (const scale of [0.7, 1, 1.4, 2.5]) {
    for (let s = 0; s <= 3.0001; s += 0.05) {
      for (const t of [0, 0.7, 1.4, 2.1, 2.8, 3.5, 4.2, 6.3, 9.1, 13.3]) {
        for (const c of mod.checks(s, t, scale)) {
          n++;
          if (!c.ok) {
            const key = c.name.replace(/\d+/g, '#');
            if (!fails.has(key)) fails.set(key, {count: 0, example: `${c.name} = ${c.value} at s ${s.toFixed(2)} t ${t} scale ${scale}`});
            fails.get(key).count++;
          }
        }
      }
    }
  }
  const id = f.replace('.kin.js', '');
  if (!fails.size) console.log(`${id}: ${n} checks, all pass`);
  else {
    bad++;
    console.log(`${id}: ${n} checks, ${[...fails.values()].reduce((a, b) => a + b.count, 0)} fail`);
    for (const [, v] of fails) console.log(`  ${v.count}x  ${v.example}`);
  }
}
process.exit(bad ? 1 : 0);
