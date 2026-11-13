#!/usr/bin/env node
// Review sheet for a stage or enemy, the teardown way: clean stills (no UI) at chosen stage values and times, tiled
// with labels, so a whole fight can be read at once. Usage:
//   CHROMIUM=<chrome.exe> node tools/review.mjs <id> "<s>@<t>[@az,el,dist[,x,y,z]]; ..." [out.png] [--cols 3] [--size 960x540]
// e.g. node tools/review.mjs altar "0@4; 0.5@4; 1.4@6; 2.45@2.1; 2.45@2.1@20,30,60" teardown-out/review-altar.png
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {CHROMIUM, CHROMIUM_ARGS, DIST, FFMPEG, playwright} from '../paths.mjs';
import {execFileSync} from 'node:child_process';

const [id, list, outArg] = process.argv.slice(2);
const opt = (k, d) => {
  const i = process.argv.indexOf(`--${k}`);
  return i < 0 ? d : process.argv[i + 1];
};
const [W, H] = opt('size', '960x540').split('x').map(Number);
const cols = Number(opt('cols', 3));
const out = path.resolve(outArg || `teardown-out/review-${id}.png`);
const shots = list.split(';').map((x) => x.trim()).filter(Boolean).map((x) => {
  const [s, t, ...cam] = x.split('@');
  return {s: Number(s), t: Number(t ?? 3), cam: cam.join('@')};
});
const {chromium} = playwright();
const browser = await chromium.launch({executablePath: CHROMIUM, args: CHROMIUM_ARGS});
const page = await browser.newPage({viewport: {width: W, height: H}});
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const tmp = fs.mkdtempSync(path.join(path.dirname(out), 'review-'));
const files = [];
for (const [i, sh] of shots.entries()) {
  const url = `${pathToFileURL(path.join(DIST, 'hub', 'index.local.html')).href}?thumb=${encodeURIComponent(id)}&t=${sh.t}&s=${sh.s}${sh.cam ? `&cam=${sh.cam}` : ''}`;
  await page.goto(url);
  await page.waitForFunction(() => window.THUMB_READY === true, null, {timeout: 60000});
  // label the tile
  await page.evaluate((txt) => {
    const d = document.createElement('div');
    d.textContent = txt;
    d.style.cssText = 'position:fixed;left:10px;top:8px;font:600 16px monospace;color:#fff;background:rgba(0,0,0,.6);padding:3px 7px;z-index:99';
    document.body.append(d);
  }, `s=${sh.s} t=${sh.t}${sh.cam ? ' cam' : ''}`);
  const f = path.join(tmp, `${String(i).padStart(3, '0')}.png`);
  await page.screenshot({path: f});
  files.push(f);
}
await browser.close();
const rows = Math.ceil(files.length / cols);
execFileSync(FFMPEG, ['-v', 'error', '-y', '-i', path.join(tmp, '%03d.png'), '-vf', `tile=${cols}x${rows}:padding=4:color=white`, '-frames:v', '1', out]);
fs.rmSync(tmp, {recursive: true});
if (errors.length) console.log('page errors:', errors.slice(0, 5));
console.log(`→ ${out}`);
