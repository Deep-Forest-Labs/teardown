#!/usr/bin/env node
// Renders every Bestiary card thumbnail into teardown-out/dist/hub/thumbs/<id>.jpg (480 x 300).
// Hub cards come from index.local.html?thumb=<id>&t=<s>; prototype cards from their film pages at a chosen time.
// Usage: CHROMIUM=<chrome.exe> node tools/thumbs.mjs   (after tools/build-hub.mjs and node sims/build.mjs <films>)
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {CHROMIUM, CHROMIUM_ARGS, DIST, playwright} from '../paths.mjs';
import {allCards} from '../sims/hub/roster.js';

const HUB = path.join(DIST, 'hub');
const OUT = path.join(HUB, 'thumbs');
fs.mkdirSync(OUT, {recursive: true});
const {chromium} = playwright();
const browser = await chromium.launch({executablePath: CHROMIUM, args: CHROMIUM_ARGS});
const page = await browser.newPage({viewport: {width: 480, height: 300}});

const FILMS = {'proto-bonepede2': ['bonepede2-film', 6.2], 'proto-gilded': ['gilded-film', 5.6], 'proto-bonepede': ['bonepede-film', 10.6]};
let n = 0;
for (const c of allCards()) {
  const file = path.join(OUT, `${c.id}.jpg`);
  if (FILMS[c.id]) {
    const [film, t] = FILMS[c.id];
    await page.setViewportSize({width: 1280, height: 800});
    await page.goto(pathToFileURL(path.join(DIST, `${film}.html`)).href + '?capture');
    await page.waitForFunction(() => window.SIM && window.SIM.ready);
    await page.evaluate((x) => window.SIM.render(x), t);
    await page.screenshot({path: file, type: 'jpeg', quality: 82, clip: {x: 240, y: 100, width: 800, height: 500}});
    await page.setViewportSize({width: 480, height: 300});
    // shrink to 480 x 300 through a canvas, so every thumb is the same size
    const big = fs.readFileSync(file).toString('base64');
    const small = await page.evaluate(async (b64) => {
      const img = new Image();
      img.src = 'data:image/jpeg;base64,' + b64;
      await img.decode();
      const cv = document.createElement('canvas');
      cv.width = 480;
      cv.height = 300;
      cv.getContext('2d').drawImage(img, 0, 0, 480, 300);
      return cv.toDataURL('image/jpeg', 0.82).split(',')[1];
    }, big);
    fs.writeFileSync(file, Buffer.from(small, 'base64'));
  } else {
    const t = c.kind === 'biome' ? 4 : 2.6;
    await page.goto(pathToFileURL(path.join(HUB, 'index.local.html')).href + `?thumb=${encodeURIComponent(c.id)}&t=${t}`);
    await page.waitForFunction(() => window.THUMB_READY === true, null, {timeout: 20000});
    await page.screenshot({path: file, type: 'jpeg', quality: 82});
  }
  n++;
}
await browser.close();
console.log(`${n} thumbs → ${OUT}`);
