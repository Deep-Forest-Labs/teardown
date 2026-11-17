#!/usr/bin/env node
// Social clips of the SLUMBER Bestiary, re-capturable as the site changes. Each shot in tools/social-shots.json is
// rendered frame by frame (virtual clock, seeded Math.random, so the same site gives the same frames), encoded to
// H.264 per size, with a poster, a contact sheet and a manifest.json that records what was captured from what.
//
//   node tools/social.mjs list
//   node tools/social.mjs <shot> [<shot> ...] | all
//        [--base <url | local dir, e.g. teardown-out/dist/hub>] [--only-size 1080x1920|9x16] [--date YYYY-MM-DD]
//        [--out teardown-out/social] [--keep-frames] [--dry-run] [--shots tools/social-shots.json]
//        [any shot parameter as a flag overrides the manifest, e.g. --highlight-start 15 --poster 12]
//   ad hoc, no manifest entry (the flags of the old capture.mjs):
//   node tools/social.mjs --page bonepede2-live [--name x] [--size 1080x1350] [--hide 'css'] [--strip-row FPS] ...
//   node tools/social.mjs --mode stage --layer altar --stage-mode hunt --set follow=0 --preroll 20
//        --cam 30,35,88,0,0,4 --orbit 40 [--phase-from 0.45 --phase-to 1.5 | --phase-keys 't:p,t:p'] ...
//
// Page shots need a page with the SIM contract (?capture, window.SIM = {duration, fps, ready, render(t)}).
// Stage shots drive the Bestiary viewer (index.html#<layer>): its rAF loop runs on the virtual clock and the page's
// own controls are operated. Outputs: <out>/<date>/<shot>-<aspect>-<len>s.mp4 (+ highlight cuts), -poster.png,
// -sheet.png, -activity.json, and manifest.json. Specs and how to add a shot: tools/SOCIAL.md.
import {spawnSync} from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {CHROMIUM, CHROMIUM_ARGS, FFMPEG, FFPROBE, OUT, fromDeps, playwright} from '../paths.mjs';

const TOOL_VERSION = '1.0.0';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const USAGE = 'usage: node tools/social.mjs list | all | <shot> [<shot> ...] [--base url|dir] [--only-size WxH] [--date YYYY-MM-DD] [--out dir] [--keep-frames] [--dry-run]\n' +
  '       node tools/social.mjs --page <name|file.html> | --mode stage [--layer altar] ...   (ad hoc, see tools/SOCIAL.md)';

// ---- arguments: --flag value, except the switches below; bare words are shot names ----
const SWITCHES = new Set(['keep-frames', 'dry-run', 'headed', 'realtime', 'auto', 'show-hud', 'nodirector', 'help']);
const REPEAT = new Set(['set', 'param']);
const TOOL_FLAGS = new Set(['base', 'only-size', 'date', 'out', 'keep-frames', 'dry-run', 'shots', 'help']);
const argv = process.argv.slice(2);
const words = [];
const flags = {};
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (!a.startsWith('--')) { words.push(a); continue; }
  const k = a.slice(2);
  if (SWITCHES.has(k)) flags[k] = true;
  else {
    if (i + 1 >= argv.length) { console.error(`--${k} needs a value\n${USAGE}`); process.exit(1); }
    const v = argv[++i];
    if (REPEAT.has(k)) (flags[k] ||= []).push(v);
    else flags[k] = v;
  }
}
const die = (msg) => { console.error(`${msg}\n${USAGE}`); process.exit(1); };
if (flags.help) { console.log(USAGE); process.exit(0); }

const camel = (k) => k.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
const num = (v) => (v === undefined || v === null || v === '' ? v : Number(v));
const ASPECT = {'1080x1350': '4x5', '1080x1920': '9x16', '1080x1080': '1x1', '1920x1080': '16x9'};

const shotsFile = path.resolve(flags.shots || path.join(ROOT, 'tools', 'social-shots.json'));
const book = JSON.parse(fs.readFileSync(shotsFile, 'utf8'));
const D = book.defaults || {};

// Shot parameters given as flags (everything that is not a tool flag), in manifest form.
function flagParams() {
  const p = {};
  for (const [k, v] of Object.entries(flags)) {
    if (TOOL_FLAGS.has(k)) continue;
    if (k === 'set') p.set = Object.fromEntries(v.map((kv) => kv.split('=')).map(([a, b]) => [a, !['0', 'false', 'off', 'no'].includes(b)]));
    else if (k === 'param') p.param = Object.fromEntries(v.map((kv) => { const [a, ...b] = kv.split('='); return [a, b.join('=')]; }));
    else if (k === 'cam') p.cam = v.split(',').map(Number);
    else if (k === 'size') p.sizes = [v];
    else if (k === 'mode') p.mode = v === 'stage' ? 'stage' : 'page';
    else if (k === 'highlight' || k === 'highlight-start') continue;
    else p[camel(k)] = typeof v === 'string' && v !== '' && !isNaN(v) && !['seed', 'title', 'accent', 'theme', 'tag'].includes(k) ? Number(v) : v;
  }
  if (flags.highlight !== undefined || flags['highlight-start'] !== undefined) {
    p.highlights = Number(flags.highlight) === 0 ? [] : [{length: num(flags.highlight ?? D.highlight ?? 12), start: flags['highlight-start'] ?? 'auto'}];
  }
  return p;
}

// One render job per shot x size: defaults < defaults.<mode> < shot < size override < flags.
function jobsFor(name, shot, over) {
  const mode = over.mode || shot.mode || (shot.layer || shot.stageMode ? 'stage' : 'page');
  const {sizes: dSizes, page: dPage, stage: dStage, ...dRest} = D;
  const merged = {...dRest, ...(mode === 'stage' ? dStage : dPage), ...shot, ...over, mode};
  let sizes = merged.sizes || dSizes || ['1080x1350'];
  if (Array.isArray(sizes)) sizes = Object.fromEntries(sizes.map((s) => [s, {}]));
  const only = flags['only-size'];
  return Object.entries(sizes)
    .filter(([s]) => !only || only === s || only === ASPECT[s])
    .map(([size, sOver]) => {
      const j = {...merged, ...sOver, ...over, size, name};
      delete j.sizes;
      delete j.description;
      j.base = flags.base || j.base || 'https://deep-forest-labs.github.io/teardown/';
      if (typeof j.hide === 'string') j.hide = j.hide ? [j.hide] : []; // --hide '' clears the default rules
      j.highlights ??= [{length: j.highlight ?? 12, start: 'auto'}];
      delete j.highlight;
      j.aspect = j.tag || ASPECT[size] || size;
      return j;
    });
}

if (words[0] === 'list') {
  for (const [n, s] of Object.entries(book.shots)) {
    const sizes = Array.isArray(s.sizes) ? s.sizes : Object.keys(s.sizes || {});
    const hl = (s.highlights || []).map((h) => `${h.length}s@${h.start}`).join(' ');
    console.log(`${n.padEnd(14)} ${(s.mode || 'page').padEnd(6)} ${(s.page || `#${s.layer}`).padEnd(16)} ${sizes.join(',').padEnd(20)} hl ${hl || '-'}\n${' '.repeat(15)}${s.description || ''}`);
  }
  process.exit(0);
}

let jobs = [];
const over = flagParams();
if (words.length) {
  const names = words.includes('all') ? Object.keys(book.shots) : words;
  for (const n of names) {
    if (!book.shots[n]) die(`unknown shot: ${n} (node tools/social.mjs list)`);
    jobs.push(...jobsFor(n, book.shots[n], over));
  }
} else if (flags.page || flags.url || flags.mode === 'stage') {
  const name = flags.name || (flags.mode === 'stage' ? `${flags.layer || 'altar'}-stage` : path.basename(flags.page || new URL(flags.url).pathname, '.html').replace(/-live$/, ''));
  jobs = jobsFor(name, {}, over).map((j) => ({...j, adhoc: true}));
  const {name: _n, ...keep} = over;
  console.log(`ad hoc shot; to keep it, add to ${path.relative(ROOT, shotsFile)} "shots":\n  "${name}": ${JSON.stringify({description: '', ...keep})}`);
} else die('nothing to capture');
if (!jobs.length) die('no sizes left after --only-size');

const today = new Date();
const date = flags.date || `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) die(`--date wants YYYY-MM-DD, got ${date}`);
const OUTDIR = path.resolve(flags.out || path.join(OUT, 'social'), date);

// ---- the page URL for a job; a local base or page file is served from 127.0.0.1 ----
const servers = new Map();
async function serve(root) {
  if (servers.has(root)) return servers.get(root);
  const types = {'.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
    '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
    '.woff2': 'font/woff2', '.glb': 'model/gltf-binary', '.wasm': 'application/wasm'};
  const server = http.createServer((req, res) => {
    let p = path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, 'index.html');
    if (!p.startsWith(root) || !fs.existsSync(p)) return res.writeHead(404).end();
    res.writeHead(200, {'content-type': types[path.extname(p)] || 'application/octet-stream'});
    fs.createReadStream(p).pipe(res);
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const href = `http://127.0.0.1:${server.address().port}/`;
  servers.set(root, href);
  servers.set(href, server);
  return href;
}
function pageOf(j) {
  if (j.url) return {kind: 'url', href: j.url};
  const pg = j.page || (j.mode === 'stage' ? j.stagePage || 'index' : undefined);
  if (!pg) die(`${j.name}: needs page, url or mode stage`);
  const file = pg.endsWith('.html') ? pg : `${pg}.html`;
  if (pg.endsWith('.html') && fs.existsSync(pg)) return {kind: 'local', root: path.dirname(path.resolve(pg)), file: path.basename(pg)};
  if (/^https?:\/\//.test(j.base)) return {kind: 'remote', href: new URL(file, j.base).href, file};
  const root = path.resolve(j.base);
  if (!fs.existsSync(path.join(root, file))) die(`${j.name}: missing ${path.join(root, file)} (build it first: tools/build-hub.mjs)`);
  return {kind: 'local', root, file};
}
async function urlOf(j) {
  const pg = pageOf(j);
  const base = pg.kind === 'local' ? new URL(pg.file, await serve(pg.root)).href : pg.href;
  const u = new URL(base);
  if (j.mode !== 'stage') {
    u.searchParams.set('capture', '');
    // The -live pages default to duration 3600 / fps 60, so pin the clip length unless told otherwise.
    u.searchParams.set('duration', String(j.duration ?? 30));
    for (const k of ['seed', 'theme', 'accent', 'title']) if (j[k] !== undefined) u.searchParams.set(k, String(j[k]));
    if (j.nodirector) u.searchParams.set('nodirector', '');
  }
  for (const [k, v] of Object.entries(j.param || {})) u.searchParams.set(k, String(v));
  u.search = u.searchParams.toString().replace(/=(&|$)/g, '$1');
  if (j.mode === 'stage' && !u.hash) u.hash = j.layer || 'altar';
  return {href: u.href, pg};
}

// ---- provenance: which version of the site was captured ----
const git = (args, cwd = ROOT) => {
  const r = spawnSync('git', args, {cwd, encoding: 'utf8'});
  return r.status === 0 ? r.stdout.trim() : null;
};
const blobSha = (buf) => crypto.createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${buf.length}\0`), buf])).digest('hex');
async function siteOf(pg) {
  if (pg.kind === 'local') {
    const f = path.join(pg.root, pg.file);
    const buf = fs.readFileSync(f);
    return {source: 'local', file: f, mtime: fs.statSync(f).mtime.toISOString(), blob: blobSha(buf),
      repoCommit: git(['rev-parse', 'HEAD']), repoDirty: !!git(['status', '--porcelain'])};
  }
  const s = {source: 'remote', url: pg.href};
  try {
    const r = await fetch(pg.href, {cache: 'no-store'});
    const buf = Buffer.from(await r.arrayBuffer());
    Object.assign(s, {status: r.status, lastModified: r.headers.get('last-modified'), etag: r.headers.get('etag'), blob: blobSha(buf)});
    // The live site is gh-pages: find the commit whose copy of this file has the same blob (local ref, no fetch).
    if (pg.file && git(['rev-parse', '--verify', '-q', 'origin/gh-pages'])) {
      for (const c of (git(['log', '--format=%H %cI', 'origin/gh-pages', '--', pg.file]) || '').split('\n').filter(Boolean)) {
        const [h, when] = c.split(' ');
        if (git(['rev-parse', `${h}:${pg.file}`]) === s.blob) { s.ghPagesCommit = h; s.ghPagesDate = when; break; }
      }
      if (!s.ghPagesCommit) s.ghPagesCommit = `no match in local origin/gh-pages (${git(['rev-parse', '--short', 'origin/gh-pages'])}); git fetch and re-run to resolve`;
    }
  } catch (e) {
    s.error = e.message;
  }
  return s;
}

function ff(a) {
  const r = spawnSync(FFMPEG, ['-loglevel', 'error', '-y', ...a], {stdio: 'inherit'});
  if (r.status !== 0) throw new Error(`ffmpeg failed: ${a.join(' ')}`);
}
function probe(f) {
  const r = spawnSync(FFPROBE, ['-v', 'error', '-select_streams', 'v:0', '-count_frames', '-show_entries',
    'stream=codec_name,profile,pix_fmt,width,height,r_frame_rate,nb_read_frames,bit_rate:format=duration,size', '-of', 'json', f], {encoding: 'utf8'});
  const j = JSON.parse(r.stdout || '{}');
  const s = j.streams?.[0] || {};
  return {codec: s.codec_name, profile: s.profile, pixFmt: s.pix_fmt, width: s.width, height: s.height, fps: s.r_frame_rate,
    frames: +s.nb_read_frames, duration: +j.format?.duration, bytes: +j.format?.size, bitRate: +s.bit_rate,
    sha256: crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')};
}

// ---- dry run: print the resolved plan ----
if (flags['dry-run']) {
  for (const j of jobs) {
    const pg = pageOf(j);
    const where = pg.kind === 'local' ? `${path.join(pg.root, pg.file)} (served locally)` : pg.href;
    const N = Math.round(((j.to ?? j.duration ?? 30) - (j.from ?? 0)));
    console.log(`\n${j.name} ${j.aspect}  [${j.mode}]  ${where}${j.mode === 'stage' ? `#${j.layer || 'altar'}` : ''}`);
    const {name, aspect, base, ...params} = j;
    console.log(`  params  ${JSON.stringify(params)}`);
    console.log(`  →       ${path.join(OUTDIR, `${j.name}-${j.aspect}-${N}s.mp4`)}`);
    for (const h of j.highlights) console.log(`          ${j.name}-${j.aspect}-${h.length}s.mp4  (from ${h.start})`);
    console.log(`          ${j.name}-${j.aspect}-poster.png  -sheet.png  -activity.json  manifest.json`);
  }
  process.exit(0);
}

// ---- the capture engine (ported from the standalone capture.mjs; the determinism logic is unchanged) ----
function loadChromium() {
  try { return playwright().chromium; } catch {}
  try { return fromDeps('playwright-core').chromium; } catch {}
  die('playwright is not installed: run npm install in the repo root');
}
const chromium = loadChromium();

async function launch(j) {
  // Real GPU. On macOS the ANGLE Metal backend (what the approved clips used); --gl swiftshader for a software fallback.
  const gl = j.gl || (process.platform === 'darwin' ? 'metal' : 'default');
  const args = [...CHROMIUM_ARGS, ...(gl === 'metal' ? ['--use-angle=metal'] : gl === 'swiftshader' ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : [])];
  const headless = !j.headed;
  // CHROMIUM=<path> wins; else system Google Chrome (no Playwright download needed); else Playwright's own Chromium.
  // --browser bundled skips Chrome.
  if (CHROMIUM) return chromium.launch({executablePath: CHROMIUM, headless, args});
  if (j.browser !== 'bundled') {
    try { return await chromium.launch({channel: j.channel || 'chrome', headless, args}); } catch (e) {
      console.warn(`system Chrome unavailable (${e.message.split('\n')[0]}); trying Playwright's Chromium`);
    }
  }
  return chromium.launch({headless, args});
}

async function render(j) {
  const [W, H] = j.size.split('x').map(Number);
  const dpr = Number(j.dpr ?? 1);
  const STAGE = j.mode === 'stage';
  const fps = Number(j.fps ?? 30);
  const {href, pg} = await urlOf(j);
  const site = await siteOf(pg);
  fs.mkdirSync(OUTDIR, {recursive: true});
  const stem = `${j.name}-${j.aspect}`;
  const framesDir = path.join(OUTDIR, `.frames-${stem}`);
  fs.rmSync(framesDir, {recursive: true, force: true});
  fs.mkdirSync(framesDir, {recursive: true});

  const browser = await launch(j);
  const browserVersion = browser.version();
  const page = await browser.newPage({viewport: {width: W, height: H}, deviceScaleFactor: dpr});
  page.on('console', (m) => m.type() === 'error' && console.error('[page]', m.text()));
  page.on('pageerror', (e) => console.error('[page error]', e.message));
  await page.addInitScript(() => (window.__CAPTURE = true));
  // Determinism: the sims step some state from performance.now() deltas and Math.random(), so a plain render(t) loop
  // drifts with wall-clock screenshot timing. Pin both: a virtual clock set to t before each render, and a seeded PRNG.
  if (!j.realtime) {
    await page.addInitScript((seed) => {
      let s = seed >>> 0;
      Math.random = () => {
        s = (s + 0x6d2b79f5) | 0;
        let t = Math.imul(s ^ (s >>> 15), 1 | s);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
      window.__vt = 0;
      performance.now = () => window.__vt;
      const epoch = 1.7e12;
      Date.now = () => epoch + window.__vt;
    }, Number(j.rngSeed ?? 12345));
  }
  if (STAGE) {
    if (j.realtime) throw new Error('stage mode needs the virtual clock; drop --realtime');
    // The stage page runs requestAnimationFrame(ts) → fixed 1/60 s sim steps from ts deltas. Queue the callbacks and
    // fire them only from __stageTick(), so every output frame is exactly one rAF at a known virtual time. Also catch
    // the OrbitControls instance (first object to assign .enableDamping) to place the camera exactly.
    await page.addInitScript(() => {
      let q = [], id = 0;
      window.requestAnimationFrame = (cb) => (q.push([++id, cb]), id);
      window.cancelAnimationFrame = (k) => { q = q.filter(([i]) => i !== k); };
      window.__stageTick = (ms) => {
        window.__vt += ms;
        const run = q; q = [];
        for (const [, cb] of run) cb(window.__vt);
        return run.length;
      };
      // The page only preserves the drawing buffer in ?thumb mode; the per-frame stats need to read it back.
      const gc = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type, attrs) {
        return gc.call(this, type, /webgl/.test(type) ? {...attrs, preserveDrawingBuffer: true} : attrs);
      };
      Object.defineProperty(Object.prototype, 'enableDamping', {
        configurable: true,
        set(v) {
          if (!window.__controls && this.object && this.target) window.__controls = this;
          Object.defineProperty(this, 'enableDamping', {value: v, writable: true, enumerable: true, configurable: true});
        },
      });
    });
  }
  console.log(`\n${stem}: loading ${href}`);
  await page.goto(href, {waitUntil: 'load', timeout: 120000});
  if (STAGE) await page.waitForFunction(() => window.__controls && document.querySelector('#stage [data-mode]'), null, {timeout: 120000});
  else await page.waitForFunction(() => window.SIM && window.SIM.ready, null, {timeout: 120000});
  await page.evaluate(() => document.fonts.ready);
  // hide: selectors made invisible; css: extra rules.
  if (j.hide?.length) await page.addStyleTag({content: `${j.hide.join(', ')}{visibility:hidden!important}`});
  if (j.css) await page.addStyleTag({content: j.css});
  // stripRow 'FPS' removes that "LABEL <b>value</b>" row from the [data-read] stats block (stripIn targets another
  // container). The page rewrites the block's innerHTML every frame, so a MutationObserver re-strips.
  if (j.stripRow) {
    await page.evaluate(([label, sel]) => {
      const re = new RegExp(`(<br>)?\\s*${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*<b[^>]*>.*?</b>`, 'g');
      const strip = (el) => { const h = el.innerHTML; const n = h.replace(re, ''); if (n !== h) el.innerHTML = n; };
      const run = () => document.querySelectorAll(sel).forEach(strip);
      new MutationObserver(run).observe(document.body, {childList: true, subtree: true, characterData: true});
      run();
    }, [j.stripRow, j.stripIn || '[data-read]']);
  }
  const info = await page.evaluate(() => {
    const c = document.createElement('canvas').getContext('webgl2');
    const ext = c && c.getExtension('WEBGL_debug_renderer_info');
    return {duration: window.SIM?.duration, fps: window.SIM?.fps, webgl2: !!c, gpu: ext ? c.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unknown'};
  });
  if (STAGE) info.duration = Number(j.duration ?? 30);
  console.log(`gpu: ${info.gpu}  chrome ${browserVersion}  webgl2: ${info.webgl2}  ${STAGE ? 'stage' : 'SIM'}.duration=${info.duration} SIM.fps=${info.fps}`);
  if (!info.webgl2) throw new Error('WebGL2 unavailable: retry with --gl swiftshader or --headed');

  const from = Number(j.from ?? 0);
  const to = Number(j.to ?? info.duration);
  const N = Math.round((to - from) * fps);

  // ---- stage: put the page in the requested state through its own controls ----
  // phaseAt(t): Fight phase slider value at clip time t (piecewise linear keys, or from→to over the clip).
  let phaseAt = null, camAt = null;
  if (STAGE) {
    const keys = j.phaseKeys
      ? String(j.phaseKeys).split(',').map((kv) => kv.split(':').map(Number))
      : j.phaseFrom !== undefined ? [[0, Number(j.phaseFrom)], [info.duration, Number(j.phaseTo ?? j.phaseFrom)]] : null;
    if (keys) {
      phaseAt = (t) => {
        if (t <= keys[0][0]) return keys[0][1];
        for (let k = 1; k < keys.length; k++) {
          const [t1, v1] = keys[k], [t0, v0] = keys[k - 1];
          if (t <= t1) return v0 + (v1 - v0) * ((t - t0) / (t1 - t0));
        }
        return keys.at(-1)[1];
      };
    }
    if (j.cam) {
      const [az, el, dist, tx, ty, tz] = j.cam.map(Number);
      const orbit = Number(j.orbit ?? 0);
      camAt = (t) => ({az: az + (orbit * t) / info.duration, el, dist, target: tx === undefined ? null : [tx, ty, tz]});
    }
    const sets = Object.fromEntries(Object.entries(j.set || {}).map(([k, v]) => [k, v === true || v === 1 || (typeof v === 'string' && !['0', 'false', 'off', 'no'].includes(v))]));
    const state = await page.evaluate(async ({mode, sets, wave, waveSpeed, enemySpeed, auto, hud, phase0}) => {
      const tick = () => window.__stageTick(1000 / 60);
      const $ = (s) => document.querySelector(s);
      const click = async (s) => { const b = $(s); if (!b) throw new Error(`stage control not found: ${s}`); b.click(); tick(); };
      if (mode) await click(`#stage [data-mode="${mode}"]`);
      for (const [k, v] of Object.entries(sets)) {
        const c = $(`#stage input[data-k="${k}"]`);
        if (!c) throw new Error(`stage toggle not found: ${k}`);
        if (c.checked !== v) { c.checked = v; c.dispatchEvent(new Event('change', {bubbles: true})); tick(); }
      }
      if (waveSpeed) await click(`#stage [data-speed="${waveSpeed}"]`);
      if (wave !== null) await click(`#stage [data-wave="${wave}"]`);
      if (enemySpeed) { const s = $('#st-speed'); s.value = enemySpeed; s.dispatchEvent(new Event('input', {bubbles: true})); }
      const ph = $('#st-phase');
      if (ph) ph.step = 'any'; // the slider snaps to 0.01; a smooth sweep needs continuous values
      if (phase0 !== null) {
        if (!ph) throw new Error('no Fight phase slider on this layer (needs a prince fight rig and the "fight" toggle on)');
        ph.value = phase0; ph.dispatchEvent(new Event('input', {bubbles: true}));
      }
      if (auto) { const a = $('#st-auto'); if (a && !a.checked) { a.checked = true; a.dispatchEvent(new Event('change', {bubbles: true})); } }
      if (!hud) {
        // Strip every panel: the page's own thumb-mode CSS (header, drawer, info, labels, hint, one-column grid) plus
        // the stage panel, prince console and hunt HUD. The canvas then takes the whole viewport.
        document.body.classList.add('thumb-mode', 'drawer-closed');
        const st = document.createElement('style');
        st.textContent = '#stage,.console,#hud,.hint,#labels,.top,.drawer,.info{display:none!important}' +
          '.shell,.viewer{position:fixed!important;inset:0!important;margin:0!important;border:0!important;padding:0!important}' +
          '#gl{position:absolute!important;inset:0!important;width:100%!important;height:100%!important}' +
          '*,*:focus,*:focus-visible{outline:none!important;box-shadow:none!important}';
        document.activeElement?.blur?.();
        document.head.append(st);
      }
      dispatchEvent(new Event('resize'));
      tick();
      const gl = $('#gl');
      return {range: ph ? Number(ph.max) : null, canvas: [gl.width, gl.height], client: [gl.clientWidth, gl.clientHeight],
        phaseText: $('#st-phase-o')?.textContent || null, mode: $('#stage [data-mode][aria-pressed="true"]')?.dataset.mode};
    }, {mode: j.stageMode, sets, wave: j.wave ?? null, waveSpeed: j.waveSpeed, enemySpeed: j.enemySpeed, auto: !!j.auto,
      hud: !!j.showHud, phase0: phaseAt ? phaseAt(0) : null});
    console.log(`stage: mode=${state.mode} canvas=${state.canvas.join('x')} css=${state.client.join('x')} phase-range=0..${state.range}  ${state.phaseText || ''}`);
    if (state.canvas[0] !== W * dpr || state.canvas[1] !== H * dpr) console.warn(`warning: canvas ${state.canvas.join('x')} does not fill the ${W * dpr}x${H * dpr} frame`);
  }

  // One stage frame: set slider + camera for clip time t, then advance the virtual clock dtMs and fire one rAF.
  const stageFrame = (t, dtMs) => page.evaluate(([t, dtMs, ph, cam]) => {
    if (ph !== null) {
      const s = document.getElementById('st-phase');
      if (s) { s.value = ph; s.dispatchEvent(new Event('input', {bubbles: true})); }
    }
    if (cam) {
      const c = window.__controls, r = Math.PI / 180;
      if (cam.target) c.target.set(...cam.target);
      const T = c.target;
      c.object.position.set(T.x + cam.dist * Math.cos(cam.el * r) * Math.sin(cam.az * r), T.y + cam.dist * Math.sin(cam.el * r),
        T.z + cam.dist * Math.cos(cam.el * r) * Math.cos(cam.az * r));
      c.update();
    }
    return window.__stageTick(dtMs);
  }, [t, dtMs, phaseAt ? phaseAt(t) : null, camAt ? camAt(t) : null]);

  // Pre-roll (stage): run the sim at the starting state so enemies have spread out, then fast-forward to from.
  if (STAGE) {
    const pre = Number(j.preroll ?? 0);
    for (let k = 0; k < Math.round(pre * fps); k++) await stageFrame(0, 1000 / fps);
    for (let k = 0; k < Math.round(from * fps); k++) await stageFrame(k / fps, 1000 / fps);
  }

  // Per-frame stats from the WebGL canvas: mean luma, spread, and mean abs difference vs the previous frame on a 54x68 thumbnail.
  await page.evaluate(([w, h]) => {
    const t = document.createElement('canvas');
    t.width = w; t.height = h;
    const ctx = t.getContext('2d', {willReadFrequently: true});
    let prev = null;
    window.__stats = () => {
      const src = [...document.querySelectorAll('canvas')].sort((a, b) => b.width * b.height - a.width * a.height)[0];
      ctx.drawImage(src, 0, 0, w, h);
      const d = ctx.getImageData(0, 0, w, h).data;
      const y = new Float32Array(w * h);
      let s = 0, s2 = 0, diff = 0;
      for (let i = 0; i < y.length; i++) {
        y[i] = 0.2126 * d[4 * i] + 0.7152 * d[4 * i + 1] + 0.0722 * d[4 * i + 2];
        s += y[i]; s2 += y[i] * y[i];
        if (prev) diff += Math.abs(y[i] - prev[i]);
      }
      prev = y;
      const mean = s / y.length;
      return {mean, std: Math.sqrt(Math.max(0, s2 / y.length - mean * mean)), diff: diff / y.length};
    };
  }, [54, 68]);

  const stats = [];
  let prevHash = null, same = 0;
  const t0 = Date.now();
  for (let i = 0; i < N; i++) {
    const t = from + i / fps;
    if (STAGE) {
      if (!(await stageFrame(t, 1000 / fps))) throw new Error(`stage: no requestAnimationFrame pending at t=${t}`);
    } else await page.evaluate((x) => { window.__vt = x * 1000; window.SIM.render(x); }, t);
    const s = await page.evaluate(() => window.__stats());
    const buf = await page.screenshot({type: 'png'});
    fs.writeFileSync(path.join(framesDir, `${String(i).padStart(5, '0')}.png`), buf);
    const h = crypto.createHash('sha1').update(buf).digest('hex');
    if (h === prevHash) same++;
    prevHash = h;
    stats.push({i, t: +t.toFixed(4), ...Object.fromEntries(Object.entries(s).map(([k, v]) => [k, +v.toFixed(3)]))});
    if (i % fps === 0) process.stdout.write(`\r${stem}: ${i}/${N} frames  ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  }
  console.log(`\r${stem}: ${N}/${N} frames  ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  await browser.close();

  // Sanity checks: blank/black canvas, frozen animation.
  const dark = stats.filter((s) => s.mean < 2 && s.std < 1).length;
  const flat = stats.filter((s) => s.std < 1).length;
  console.log(`checks: identical-consecutive=${same}/${N - 1}  near-black=${dark}  flat=${flat}`);
  if (dark > N * 0.5 || flat > N * 0.5) throw new Error('canvas mostly blank: WebGL likely failed; try --gl swiftshader or --headed');
  if (same > (N - 1) * 0.5) throw new Error('frames mostly identical: SIM.render(t) not advancing');
  const activity = path.join(OUTDIR, `${stem}-activity.json`);
  fs.writeFileSync(activity, JSON.stringify({url: href, fps, from, to, gpu: info.gpu,
    ...(STAGE ? {phase: phaseAt ? stats.map((s) => +phaseAt(s.t).toFixed(4)) : null} : {}), stats}));

  const crf = String(j.crf ?? 16);
  const enc = (start, count, out) =>
    ff(['-framerate', String(fps), '-start_number', String(start), '-i', path.join(framesDir, '%05d.png'), '-frames:v', String(count),
      '-c:v', 'libx264', '-preset', 'slow', '-crf', crf, '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-r', String(fps),
      '-movflags', '+faststart', out]);
  const clips = [];
  const full = path.join(OUTDIR, `${stem}-${Math.round(N / fps)}s.mp4`);
  enc(0, N, full);
  clips.push({file: full, kind: 'full', window: [from, to]});

  // Contact sheet: evenly spaced frames, row-major.
  const sheetN = Number(j.sheet ?? 24);
  const pick = Array.from({length: sheetN}, (_, k) => Math.floor((k * N) / sheetN));
  const sheetDir = path.join(framesDir, 'sheet');
  fs.mkdirSync(sheetDir, {recursive: true});
  pick.forEach((f, k) => fs.copyFileSync(path.join(framesDir, `${String(f).padStart(5, '0')}.png`), path.join(sheetDir, `${String(k).padStart(3, '0')}.png`)));
  const cols = Number(j.cols ?? 6);
  const sheet = path.join(OUTDIR, `${stem}-sheet.png`);
  ff(['-framerate', '1', '-i', path.join(sheetDir, '%03d.png'), '-vf',
    `scale=270:${2 * Math.round((270 * H) / W / 2)},tile=${cols}x${Math.ceil(sheetN / cols)}:padding=4:color=0x333333`, '-frames:v', '1', sheet]);
  console.log(`sheet times (row-major): ${pick.map((f) => (from + f / fps).toFixed(1)).join(' ')}`);

  // Highlights: each {length, start}; start 'auto' picks the window with the highest summed motion.
  const used = new Set();
  let firstHl = null;
  for (const hl of j.highlights) {
    const len = Number(hl.length);
    if (!(len > 0 && len < N / fps)) continue;
    const L = Math.round(len * fps);
    let hlStart = 0;
    if (hl.start === undefined || hl.start === 'auto') {
      let best = -1, acc = 0;
      for (let i = 0; i < N; i++) {
        acc += stats[i].diff;
        if (i >= L) acc -= stats[i - L].diff;
        if (i >= L - 1 && acc > best) (best = acc), (hlStart = i - L + 1);
      }
    } else hlStart = Math.round(Number(hl.start) * fps);
    let cut = `${stem}-${len}s`;
    if (used.has(cut)) cut += `-t${(hlStart / fps).toFixed(1)}`;
    used.add(cut);
    cut = path.join(OUTDIR, `${cut}.mp4`);
    enc(hlStart, L, cut);
    clips.push({file: cut, kind: 'highlight', window: [+(from + hlStart / fps).toFixed(3), +(from + (hlStart + L) / fps).toFixed(3)]});
    firstHl ??= {hlStart, L};
    console.log(`highlight: ${(hlStart / fps).toFixed(2)}–${((hlStart + L) / fps).toFixed(2)} s`);
  }

  // Poster: explicit time, else the middle of the first highlight (else of the clip).
  const pt = j.poster ?? 'auto';
  const pf = pt === 'auto' ? Math.min(N - 1, firstHl ? firstHl.hlStart + Math.round(firstHl.L / 2) : Math.round(N / 2)) : Math.round(Number(pt) * fps);
  const poster = path.join(OUTDIR, `${stem}-poster.png`);
  fs.copyFileSync(path.join(framesDir, `${String(pf).padStart(5, '0')}.png`), poster);
  console.log(`poster: frame ${pf} (t=${(pf / fps).toFixed(2)} s)`);

  // Verify with ffprobe, record, then drop the frames.
  let ok = true;
  const {name, aspect, base, adhoc, ...params} = j;
  const tool = {name: 'tools/social.mjs', version: TOOL_VERSION, repoCommit: git(['rev-parse', 'HEAD']),
    blob: blobSha(fs.readFileSync(fileURLToPath(import.meta.url))), shotsFile: path.relative(ROOT, shotsFile)};
  const record = {};
  for (const c of clips) {
    const p = probe(c.file);
    const good = p.codec === 'h264' && p.pixFmt === 'yuv420p' && p.frames > 0;
    ok &&= good;
    console.log(`${good ? 'OK ' : 'BAD'} ${path.basename(c.file)}  ${p.width}x${p.height} ${p.fps} ${p.frames} frames  ${p.duration.toFixed(2)} s  ${(p.bytes / 1e6).toFixed(1)} MB`);
    record[path.basename(c.file)] = {shot: name, adhoc: !!adhoc, size: j.size, aspect, kind: c.kind, window: c.window,
      poster: path.basename(poster), sheet: path.basename(sheet), activity: path.basename(activity),
      params: {...params, base: j.base}, url: href, site, gpu: info.gpu, browser: `chrome ${browserVersion}`, tool,
      renderedAt: new Date().toISOString(), ffprobe: p};
  }
  if (ok && !flags['keep-frames']) fs.rmSync(framesDir, {recursive: true, force: true});
  else console.log(`frames kept in ${framesDir}`);
  if (!ok) throw new Error(`${stem}: ffprobe check failed`);
  return record;
}

// manifest.json accumulates across runs on the same date: one entry per clip file, replaced when re-rendered.
const mPath = path.join(OUTDIR, 'manifest.json');
let failed = 0;
for (const j of jobs) {
  try {
    const rec = await render(j);
    const m = fs.existsSync(mPath) ? JSON.parse(fs.readFileSync(mPath, 'utf8')) : {date, clips: {}};
    Object.assign(m.clips, rec);
    m.updated = new Date().toISOString();
    fs.writeFileSync(mPath, JSON.stringify(m, null, 2) + '\n');
  } catch (e) {
    failed++;
    console.error(`\n${j.name} ${j.aspect}: ${e.message}`);
  }
}
for (const v of servers.values()) if (typeof v !== 'string') v.close();
console.log(`\n${jobs.length - failed}/${jobs.length} renders → ${OUTDIR}`);
process.exit(failed ? 1 : 0);
