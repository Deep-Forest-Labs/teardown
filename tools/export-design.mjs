#!/usr/bin/env node
// Writes the team-default design export (schema v1, sims/hub/DESIGN-DATA.md) from the built hub:
//   sims/hub/design.json            the committed default the Unity bridge imports
//   teardown-out/dist/hub/design.json  published next to the page
// Usage: CHROMIUM=<chrome.exe> node tools/export-design.mjs   (after tools/build-hub.mjs)
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {CHROMIUM, CHROMIUM_ARGS, DIST, playwright} from '../paths.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const {chromium} = playwright();
const browser = await chromium.launch({executablePath: CHROMIUM, args: CHROMIUM_ARGS});
const page = await browser.newPage({viewport: {width: 800, height: 500}});
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(pathToFileURL(path.join(DIST, 'hub', 'index.local.html')).href + '?export=1#altar');
await page.waitForFunction(() => window.DESIGN, null, {timeout: 30000});
const design = await page.evaluate(() => window.DESIGN);
await browser.close();
if (errors.length) throw new Error(errors.join('\n'));
const json = JSON.stringify(design, null, 2) + '\n';
fs.writeFileSync(path.join(ROOT, 'sims/hub/design.json'), json);
fs.writeFileSync(path.join(DIST, 'hub/design.json'), json);
console.log(`design.json: ${Object.keys(design.arenas).length} arenas, ${Object.keys(design.enemies).length} enemies, ${(json.length / 1024).toFixed(0)} KB`);
