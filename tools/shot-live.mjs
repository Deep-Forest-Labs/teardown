#!/usr/bin/env node
// Screenshots a live page after letting it run: node tools/shot-live.mjs <page.html> <out.png> <seconds> [js-before]
// The page runs in real time in headless Chrome (CHROMIUM); js-before runs once after load (set a view, a bot...).
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {CHROMIUM, CHROMIUM_ARGS, DIST, playwright} from '../paths.mjs';

const [page, out, secs, js] = process.argv.slice(2);
const {chromium} = playwright();
const browser = await chromium.launch({executablePath: CHROMIUM, args: CHROMIUM_ARGS});
const p = await browser.newPage({viewport: {width: 1600, height: 900}});
p.on('pageerror', (e) => console.error('pageerror', e.message));
await p.goto(pathToFileURL(path.join(DIST, page)).href);
await p.waitForTimeout(500);
if (js) await p.evaluate(js);
await p.waitForTimeout(+secs * 1000);
await p.screenshot({path: out});
console.log(await p.evaluate(() => JSON.stringify({t: window.CB?.S.t.toFixed(1), n: window.CB?.agents().length, c: window.CB?.censers?.().length, kills: window.CB?.S.kills, hits: window.CB?.S.hits, wave: window.CB?.S.wave})));
await browser.close();
