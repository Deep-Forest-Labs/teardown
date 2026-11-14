#!/usr/bin/env node
// Whitebox capture sheets for the Chopping Block roster, the first step of docs/ART-PIPELINE.md.
//
//   node sims/build.mjs cb-live && node tools/capture-cb.mjs [id ...]
//
// For each enemy: spawning off, Clear, spawn it alone, step the real simulation a fixed time (deterministic, no real
// clock), freeze, then shoot front, side, top and three-quarter with orthographic cameras at the enemy's size-class
// scale beside a 1.8 m figure, plus the in-play first-person view from eye height. Front and side also come out as
// black-on-white silhouette masks: the outline a paintover has to keep. Writes teardown-out/art/<id>/*.png and a sheet
// teardown-out/art/sheets/<id>.png. Set CHROMIUM to a Chrome exe.
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {CHROMIUM, CHROMIUM_ARGS, DIST, OUT, playwright} from '../paths.mjs';

// frame height in metres for each size class: one scale per class, so enemies in a class compare directly
export const CLASS = {S: 6, M: 12, L: 24, XL: 56};
// wait: seconds stepped after spawning (up, awake, surfaced); cls: size class; fp: first-person distance in metres
export const SHOTS = [
  {id: 'censer', name: 'Censer', wait: 1, cls: 'M', fp: 20},
  {id: 'twin', name: 'Twin Censer', wait: 1, cls: 'M', fp: 20},
  {id: 'great', name: 'Great Censer', wait: 1, cls: 'L', fp: 24},
  {id: 'mote', name: 'Ash Mote', wait: 0.4, cls: 'S', fp: 8},
  {id: 'stray', name: 'Stray', wait: 0.4, cls: 'S', fp: 10},
  {id: 'hound', name: 'Hound', wait: 0.4, cls: 'S', fp: 10},
  {id: 'warden', name: 'Warden', wait: 0.6, cls: 'M', fp: 16},
  {id: 'spinewyrm', name: 'Spinewyrm', wait: 6.5, cls: 'XL', fp: 40},
  {id: 'elder', name: 'Elder Spinewyrm', wait: 6, cls: 'XL', fp: 48},
  {id: 'pale', name: 'Pale Spinewyrm', wait: 9, cls: 'XL', fp: 48},
  {id: 'tithe', name: 'Tithe-Taker', wait: 4, cls: 'M', fp: 18},
  {id: 'great_tithe', name: 'Great Tithe-Taker', wait: 10, cls: 'L', fp: 24},
  {id: 'egg', name: 'Tithe Egg', wait: 1, cls: 'S', fp: 6},
  {id: 'mite', name: 'Tithe Mite', wait: 0.2, cls: 'S', fp: 6},
  {id: 'cantor', name: 'The Cantor', wait: 9, cls: 'L', fp: 30},
  {id: 'eye', name: "Cantor's Eye", wait: 0.5, cls: 'M', fp: 16},
  {id: 'briar', name: 'Briar', wait: 4, cls: 'M', fp: 12},
];

const TILE = 900;
const FP = [1600, 900];
const ART = path.join(OUT, 'art');

// Runs in the page: isolate, spawn, step, freeze; then returns what the views need.
function setup({id, wait}) {
  const {S, three: T, scene} = window.CB;
  S.spawn = 'off';
  S.bot = 'stand';
  S.view = 'fp';
  S.paused = true;
  window.CB.clear();
  for (let k = 0; k < 4; k++) window.CB.sim(1 / 120); // the stand bot settles at the origin
  const before = new Set();
  scene.traverse((o) => before.add(o));
  window.CB.spawn(id);
  for (let k = 0; k < Math.round(wait * 120); k++) window.CB.sim(1 / 120);
  window.__stage = [...before].filter((o) => o.isMesh && !o.isInstancedMesh);
  window.__bg = scene.background.clone();
  // the enemy's facing (horizontal): its heading if it has one, else toward the player at the origin
  const ag = window.CB.agents()[0];
  const el = window.CB.elites()[0];
  const wy = window.CB.wyrms()[0];
  let f = null;
  if (ag) f = [Math.cos(ag.yaw), 0, Math.sin(ag.yaw)];
  else if (wy) f = [wy.w.dir[0], 0, wy.w.dir[2]];
  else if (el && el.kind === 'tithe') f = [Math.cos(el.yaw), 0, Math.sin(el.yaw)];
  return {f, n: window.CB.agents().length + window.CB.elites().length + window.CB.wyrms().length + window.CB.censers().length};
}

// Runs in the page: bounds of everything new or instanced, then one camera. view: front|side|top|q3|fp; mask: silhouette.
function shoot({view, H, aspect, fpDist, mask, f0}) {
  const {S, three: T, scene} = window.CB;
  const box = new T.Box3();
  const gb = new T.Box3();
  const m4 = new T.Matrix4();
  const visible = (o) => {
    for (let p = o; p; p = p.parent) if (!p.visible) return false;
    return true;
  };
  const stage = new Set(window.__stage);
  for (const o of scene.children.filter((x) => x.userData.capture)) scene.remove(o); // last view's figure and grid
  scene.updateMatrixWorld(true);
  scene.traverse((o) => {
    if (!o.isMesh || stage.has(o) || o.userData.capture || !visible(o)) return;
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    if (o.isInstancedMesh) {
      for (let i = 0; i < o.count; i++) {
        o.getMatrixAt(i, m4);
        box.union(gb.copy(o.geometry.boundingBox).applyMatrix4(m4.premultiply(o.matrixWorld)));
      }
    } else box.union(gb.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld));
  });
  const c = box.getCenter(new T.Vector3());
  const size = box.getSize(new T.Vector3());
  // facing: given, else toward the origin (the player)
  let f = f0 ? new T.Vector3(...f0) : new T.Vector3(-c.x, 0, -c.z);
  if (f.lengthSq() < 1e-6) f.set(0, 0, 1);
  f.normalize();
  const up = new T.Vector3(0, 1, 0);
  const left = new T.Vector3().crossVectors(up, f).normalize();
  // capture props: a 1.8 m figure and a metre grid behind the enemy, removed before the next shot
  const D = 300;
  let cam;
  let dir;
  if (view === 'fp') {
    const at = new T.Vector3(c.x, 0, c.z).addScaledVector(f, fpDist);
    cam = new T.PerspectiveCamera(80, aspect, 0.05, 400);
    cam.position.set(at.x, 1.7, at.z);
    cam.lookAt(c);
  } else {
    dir = {front: f.clone(), side: left.clone(), top: up.clone(), q3: f.clone().multiplyScalar(Math.SQRT1_2).addScaledVector(left, Math.SQRT1_2).multiplyScalar(Math.cos(Math.PI / 6)).addScaledVector(up, Math.sin(Math.PI / 6))}[view];
    cam = new T.OrthographicCamera((-H / 2) * aspect, (H / 2) * aspect, H / 2, -H / 2, 1, 2 * D);
    cam.position.copy(c).addScaledVector(dir, D);
    if (view === 'top') cam.up.copy(f);
    cam.lookAt(c);
  }
  cam.updateMatrixWorld();
  const mat = (col) => new T.MeshStandardMaterial({color: col, roughness: 0.8, flatShading: true});
  if (view !== 'fp' && !mask) {
    // the figure stands beside the enemy on the camera's right, feet level with the enemy's lowest point
    const right = new T.Vector3().setFromMatrixColumn(cam.matrixWorld, 0);
    const halfR = Math.abs(size.x * right.x) / 2 + Math.abs(size.y * right.y) / 2 + Math.abs(size.z * right.z) / 2;
    const fig = new T.Group();
    fig.userData.capture = true;
    const skin = mat('#2f6f8f');
    const add = (g, p) => {
      const m = new T.Mesh(g, skin);
      m.position.set(...p);
      fig.add(m);
    };
    add(new T.CapsuleGeometry(0.17, 0.7, 4, 10), [0, 1.22, 0]); // torso
    add(new T.SphereGeometry(0.12, 12, 8), [0, 1.68, 0]); // head
    for (const s of [-1, 1]) add(new T.CapsuleGeometry(0.075, 0.72, 4, 8), [s * 0.1, 0.44, 0]); // legs
    for (const s of [-1, 1]) add(new T.CapsuleGeometry(0.055, 0.62, 4, 8), [s * 0.25, 1.15, 0]); // arms
    const off = halfR + Math.max(0.6, H * 0.06);
    const at = c.clone().addScaledVector(right, off);
    // frame the pair: slide the camera right by half the figure's offset, so a small enemy's figure stays in shot
    cam.position.addScaledVector(right, Math.min((off + 0.35) / 2, Math.max(0, (H * aspect) / 2 - halfR - H * 0.02)));
    cam.updateMatrixWorld();
    if (view === 'top') fig.position.copy(at).setY(box.min.y);
    else fig.position.set(at.x, box.min.y, at.z);
    fig.lookAt(fig.position.clone().add(f));
    scene.add(fig);
    // grid behind: 1 m cells for S/M frames, 5 m for L/XL
    const cell = H > 15 ? 5 : 1;
    const n = Math.ceil((H * aspect * 1.2) / cell / 2) * 2;
    const grid = new T.GridHelper(n * cell, n, '#8d8798', '#6c6776');
    grid.userData.capture = true;
    const back = c.clone().addScaledVector(dir, -(Math.max(size.x, size.y, size.z) / 2 + 2));
    grid.position.copy(back);
    // grid lines run along the image's right and up: the helper's Y faces the camera, its X is the camera's right
    grid.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(right, dir, right.clone().cross(dir)));
    // snap the grid so a line sits on the enemy's lowest point (the figure's feet)
    if (view !== 'top') grid.position.y = box.min.y + Math.round((grid.position.y - box.min.y) / cell) * cell;
    scene.add(grid);
  }
  for (const o of window.__stage) o.visible = view === 'fp';
  scene.background = mask ? new T.Color('#ffffff') : view === 'fp' ? window.__bg : new T.Color('#55515d');
  scene.overrideMaterial = mask ? new T.MeshBasicMaterial({color: '#000000'}) : null;
  S.cam = cam;
  return {c: c.toArray().map((x) => +x.toFixed(2)), size: size.toArray().map((x) => +x.toFixed(2))};
}

// Runs in the page: the exploded part plate. Every distinct rigid part of the frozen whitebox (one per instanced part
// type, one per distinct mesh), oriented and sized as in the pose, laid out in a row at true scale with a gap. It is
// the paintover template: one image that carries every part, so one generation can return every part.
function explode({aspect}) {
  const {S, three: T, scene} = window.CB;
  for (const o of scene.children.filter((x) => x.userData.capture)) scene.remove(o);
  const stage = new Set(window.__stage);
  const visible = (o) => {
    for (let p = o; p; p = p.parent) if (!p.visible) return false;
    return true;
  };
  scene.updateMatrixWorld(true);
  const seen = new Map();
  const m4 = new T.Matrix4();
  const pos = new T.Vector3();
  const q = new T.Quaternion();
  const sc = new T.Vector3();
  scene.traverse((o) => {
    if (!o.isMesh || stage.has(o) || o.userData.capture || !visible(o)) return;
    if (o.isInstancedMesh && !o.count) return;
    const key = o.geometry.type + JSON.stringify(o.geometry.parameters || o.geometry.uuid) + (o.material.uuid || '');
    if (seen.has(key)) return seen.get(key).n++;
    if (o.isInstancedMesh) o.getMatrixAt(0, m4).premultiply(o.matrixWorld);
    else m4.copy(o.matrixWorld);
    m4.decompose(pos, q, sc);
    seen.set(key, {o, q: q.clone(), s: sc.clone(), n: o.isInstancedMesh ? o.count : 1});
  });
  const plate = new T.Group();
  plate.userData.capture = true;
  const parts = [...seen.values()];
  const boxes = parts.map(({o, q, s}) => {
    const m = new T.Mesh(o.geometry, o.material);
    m.quaternion.copy(q);
    m.scale.copy(s);
    m.updateMatrixWorld();
    const b = new T.Box3().setFromObject(m);
    return {m, b, size: b.getSize(new T.Vector3())};
  });
  // rows: largest first, wrap to a width that gives a roughly square-ish plate at the canvas aspect
  const order = boxes.map((b, i) => i).sort((a, b) => boxes[b].size.y * boxes[b].size.x - boxes[a].size.y * boxes[a].size.x);
  const area = boxes.reduce((s, b) => s + (b.size.x + 0.4) * (b.size.y + 0.4), 0);
  const rowW = Math.max(Math.sqrt(area * aspect) * 1.15, ...boxes.map((b) => b.size.x));
  const gap = Math.max(0.15, Math.sqrt(area) * 0.06);
  let x = 0;
  let y = 0;
  let rowH = 0;
  const placed = [];
  for (const i of order) {
    const {m, b, size} = boxes[i];
    if (x > 0 && x + size.x > rowW) {
      x = 0;
      y -= rowH + gap * 2.2;
      rowH = 0;
    }
    const c = b.getCenter(new T.Vector3());
    m.position.set(x + size.x / 2 - c.x, y - size.y / 2 - c.y + 1000, -c.z);
    plate.add(m);
    placed.push({i, x0: x, x1: x + size.x, y0: y - size.y, y1: y});
    x += size.x + gap;
    rowH = Math.max(rowH, size.y);
  }
  scene.add(plate);
  const all = new T.Box3().setFromObject(plate);
  const ctr = all.getCenter(new T.Vector3());
  const sz = all.getSize(new T.Vector3());
  const H = Math.max(sz.y + gap * 4, (sz.x + gap * 2) / aspect) * 1.08;
  const cam = new T.OrthographicCamera((-H / 2) * aspect, (H / 2) * aspect, H / 2, -H / 2, 1, 2000);
  cam.position.set(ctr.x, ctr.y, 500);
  cam.lookAt(ctr);
  cam.updateMatrixWorld();
  cam.updateProjectionMatrix();
  for (const o of window.__stage) o.visible = false;
  // hide the posed enemy; only the plate shows
  window.__hidden = [];
  scene.traverse((o) => {
    if (o.isMesh && !stage.has(o) && !o.userData.capture && o.visible && !plate.children.includes(o)) {
      o.visible = false;
      window.__hidden.push(o);
    }
  });
  scene.background = new T.Color('#55515d');
  scene.overrideMaterial = null;
  S.cam = cam;
  const px = (v) => {
    const p = v.clone().project(cam);
    return [(p.x + 1) / 2, (1 - p.y) / 2];
  };
  return placed.map(({i, x0, x1, y1}) => {
    const p = parts[i];
    const sz3 = boxes[i].size;
    return {
      at: px(new T.Vector3((x0 + x1) / 2, y1 + 1000, 0)),
      label: `P${placed.findIndex((z) => z.i === i) + 1}`,
      kind: p.o.geometry.type.replace('Geometry', '').toLowerCase(),
      n: p.n,
      size: [sz3.x, sz3.y, sz3.z].map((v) => +v.toFixed(2)),
    };
  });
}
function unexplode() {
  const {scene} = window.CB;
  for (const o of scene.children.filter((x) => x.userData.capture)) scene.remove(o);
  for (const o of window.__hidden || []) o.visible = true;
  window.__hidden = [];
}

const frames = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

const sheetHtml = (s, info, img) => `<!doctype html><meta charset="utf-8"><style>
  body { margin: 0; background: #1b1a20; color: #ebe5dc; font: 15px/1.4 Inter, system-ui, sans-serif; width: 2760px }
  header { display: flex; align-items: baseline; gap: 24px; padding: 22px 28px 10px }
  h1 { margin: 0; font-size: 34px } .k { color: #a39cac; font: 600 13px 'JetBrains Mono', monospace; letter-spacing: .08em; text-transform: uppercase }
  .row { display: flex; gap: 12px; padding: 0 28px 12px } figure { margin: 0; position: relative } img { display: block }
  figcaption { position: absolute; left: 10px; top: 8px; font: 600 13px 'JetBrains Mono', monospace; letter-spacing: .08em; text-transform: uppercase; background: rgba(20,19,24,.75); padding: 4px 8px; border-radius: 3px }
  .t img { width: ${TILE}px; height: ${TILE}px } .fp img { width: ${FP[0]}px; height: ${FP[1]}px } .m img { width: 460px; height: 460px; border: 1px solid #34303d }
  .notes { width: 1080px; display: grid; gap: 8px; align-content: start; font-size: 17px }
  .notes b { color: #e0b43a }
</style>
<header><h1>${s.name}</h1><span class="k">whitebox capture · ${s.id} · class ${s.cls}: frame ${CLASS[s.cls]} m tall · grid ${CLASS[s.cls] > 15 ? 5 : 1} m · figure 1.8 m</span></header>
<div class="row">
  <figure class="t"><img src="${img.front}"><figcaption>Front</figcaption></figure>
  <figure class="t"><img src="${img.side}"><figcaption>Side (left)</figcaption></figure>
  <figure class="t"><img src="${img.q3}"><figcaption>Three-quarter (30° up)</figcaption></figure>
</div>
<div class="row">
  <figure class="t"><img src="${img.top}"><figcaption>Top (front up)</figcaption></figure>
  <figure class="fp"><img src="${img.fp}"><figcaption>In play · first person · ${s.fp} m · 80° FOV</figcaption></figure>
</div>
<div class="row">
  <figure class="m"><img src="${img.front_mask}"><figcaption>Silhouette front</figcaption></figure>
  <figure class="m"><img src="${img.side_mask}"><figcaption>Silhouette side</figcaption></figure>
  <div class="notes"><div><b>Bounds</b> ${info.size.join(' × ')} m (x · y · z, world)</div><div><b>Centre</b> ${info.c.join(', ')} m; the figure's feet sit level with the enemy's lowest point (${(info.c[1] - info.size[1] / 2).toFixed(1)} m up)</div><div><b>Pose</b> lab state ${s.wait} s after spawning, frozen</div><div><b>Source</b> sims/cb-shared (live lab whitebox, not final art)</div></div>
</div>`;

const only = process.argv.slice(2);
const list = only.length ? SHOTS.filter((s) => only.includes(s.id)) : SHOTS;
const {chromium} = playwright();
const browser = await chromium.launch({executablePath: CHROMIUM, args: CHROMIUM_ARGS});
const page = await browser.newPage({viewport: {width: TILE, height: TILE}});
page.on('pageerror', (e) => console.error('pageerror', e.message));
await page.goto(pathToFileURL(path.join(DIST, 'cb-live.html')).href);
await page.addStyleTag({content: '.cb-drawer,.cb-panel,.cb-info,.cb-hud,.cb-cross{display:none!important}'});
await page.waitForTimeout(600);
fs.mkdirSync(path.join(ART, 'sheets'), {recursive: true});
const sheet = await browser.newPage({viewport: {width: 2760, height: 1200}});
for (const s of list) {
  const dir = path.join(ART, s.id);
  fs.mkdirSync(dir, {recursive: true});
  const {f, n} = await page.evaluate(setup, s);
  if (!n) throw new Error(`${s.id}: nothing spawned`);
  const img = {};
  let info;
  for (const [view, mask] of [['front'], ['side'], ['q3'], ['top'], ['front', true], ['side', true], ['fp']]) {
    const vp = view === 'fp' ? FP : [TILE, TILE];
    await page.setViewportSize({width: vp[0], height: vp[1]});
    const r = await page.evaluate(shoot, {view, H: CLASS[s.cls], aspect: vp[0] / vp[1], fpDist: s.fp, mask: !!mask, f0: f});
    if (view === 'front' && !mask) info = r;
    await page.evaluate(frames);
    const key = mask ? `${view}_mask` : view;
    const file = path.join(dir, `${key}.png`);
    await page.locator('#cv').screenshot({path: file});
    img[key] = 'data:image/png;base64,' + fs.readFileSync(file).toString('base64');
  }
  // the exploded part plate (the paintover template), with part ids drawn over each cell
  await page.setViewportSize({width: FP[0], height: FP[1]});
  const parts = await page.evaluate(explode, {aspect: FP[0] / FP[1]});
  await page.evaluate(frames);
  const pfile = path.join(dir, 'parts.png');
  await page.locator('#cv').screenshot({path: pfile});
  await page.evaluate(unexplode);
  fs.writeFileSync(path.join(dir, 'parts.json'), JSON.stringify(parts, null, 1));
  await sheet.setViewportSize({width: FP[0], height: FP[1] + 100});
  await sheet.setContent(`<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#1b1a20;color:#ebe5dc;font:15px Inter,system-ui,sans-serif}
    header{padding:14px 20px 0;height:56px;box-sizing:border-box}h1{display:inline;margin:0 16px 0 0;font-size:26px}.k{color:#a39cac;font:600 12px 'JetBrains Mono',monospace;letter-spacing:.08em;text-transform:uppercase}
    .p{position:relative;width:${FP[0]}px;height:${FP[1]}px}.p img{display:block}.l{position:absolute;transform:translate(-50%,-100%);font:600 12px 'JetBrains Mono',monospace;background:rgba(20,19,24,.8);padding:2px 6px;border-radius:3px;white-space:nowrap}
    ol.legend{list-style:none;margin:0;padding:10px 20px;columns:4;font:12.5px/1.7 'JetBrains Mono',monospace}ol.legend b{color:#e0b43a}footer{padding:8px 20px;color:#a39cac;font:12px 'JetBrains Mono',monospace}</style>
    <header><h1>${s.name}</h1><span class="k">exploded whitebox parts · true scale · count = instances in the pose</span></header>
    <div class="p"><img src="data:image/png;base64,${fs.readFileSync(pfile).toString('base64')}">${parts.map((p) => `<div class="l" style="left:${p.at[0] * 100}%;top:calc(${p.at[1] * 100}% - 4px)">${p.label}</div>`).join('')}</div>
    <ol class="legend">${parts.map((p) => `<li><b>${p.label}</b> ${p.kind} ×${p.n} · ${p.size.join(' × ')} m</li>`).join('')}</ol>
    <footer>Whitebox primitives as the lab draws them today. The part list in docs/art/PARTS.md names the parts the art will have.</footer>`);
  await sheet.waitForTimeout(150);
  await sheet.screenshot({path: path.join(ART, 'sheets', `${s.id}_parts.png`), fullPage: true});
  await sheet.setViewportSize({width: 2760, height: 1200});
  fs.writeFileSync(path.join(dir, 'bounds.json'), JSON.stringify({...info, class: s.cls, frameM: CLASS[s.cls], wait: s.wait, facing: f}, null, 1));
  await sheet.setContent(sheetHtml(s, info, img));
  await sheet.waitForTimeout(150);
  await sheet.screenshot({path: path.join(ART, 'sheets', `${s.id}.png`), fullPage: true});
  console.log(s.id, 'bounds', info.size.join(' x '), 'm');
}
await browser.close();
