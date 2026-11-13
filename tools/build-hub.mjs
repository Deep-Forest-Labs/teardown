#!/usr/bin/env node
// Builds the SLUMBER Bestiary into teardown-out/dist/hub/:
//   index.html        the artifact page (no doctype/html/head/body: the claude.ai artifact wraps it)
//   index.local.html  the same page wrapped in a full document, for local preview and thumbnails
//   <proto>.html      the live prototype pages it opens (copied from teardown-out/dist)
//   thumbs/           card thumbnails (made by tools/thumbs.mjs)
// Usage: node tools/build-hub.mjs   (build the prototype pages first: node sims/build.mjs bonepede2-live gilded-live bonepede-live)
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {DIST, fromDeps} from '../paths.mjs';

const esbuild = fromDeps('esbuild');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(DIST, 'hub');
fs.mkdirSync(path.join(OUT, 'thumbs'), {recursive: true});

const res = await esbuild.build({
  entryPoints: [path.join(ROOT, 'sims/hub/main.js')],
  bundle: true,
  nodePaths: [path.join(ROOT, 'node_modules')],
  format: 'esm',
  minify: true,
  write: false,
  target: 'es2022',
  legalComments: 'none',
  logLevel: 'warning',
});
const js = res.outputFiles[0].text.replace(/<\/script/g, '<\\/script');
const css = fs.readFileSync(path.join(ROOT, 'sims/hub/style.css'), 'utf8');
const page = `<title>SLUMBER Bestiary</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Grenze+Gotisch:wght@700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@500&display=swap">
<style>
${css}
</style>
<div id="root"></div>
<script type="module">
${js}
</script>
`;
fs.writeFileSync(path.join(OUT, 'index.html'), page);
fs.writeFileSync(path.join(OUT, 'index.local.html'), `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n</head>\n<body>\n${page}</body>\n</html>\n`);
for (const p of ['bonepede2-live', 'gilded-live', 'bonepede-live']) {
  const src = path.join(DIST, `${p}.html`);
  if (!fs.existsSync(src)) throw new Error(`missing ${src}: run node sims/build.mjs ${p}`);
  fs.copyFileSync(src, path.join(OUT, `${p}.html`));
}
console.log(`${path.join(OUT, 'index.html')}  ${(page.length / 1024).toFixed(0)} KB`);
