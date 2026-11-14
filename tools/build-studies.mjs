#!/usr/bin/env node
// Builds the Studies page of the SLUMBER Bestiary into teardown-out/dist/hub/studies.html: every study film as a card
// (what it is built on, the elements worth lifting) and a viewer that plays the film in place. A full document, since
// it is a second page beside the artifact's main page. Usage: node tools/build-studies.mjs (after tools/build-hub.mjs).
import fs from 'node:fs';
import path from 'node:path';
import {DIST} from '../paths.mjs';
import {FILMS} from '../sims/hub/roster.js';
import {STUDY_NOTES} from '../sims/hub/studies.js';

const OUT = path.join(DIST, 'hub');
const css = fs.readFileSync(path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '../sims/hub/style.css'), 'utf8');
const isStage = (f) => f.id.endsWith('-study') || f.id === 'film-altar' || f.id === 'film-falkirk';
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const missing = FILMS.filter((f) => !STUDY_NOTES[f.id]).map((f) => f.id);
if (missing.length) throw new Error(`no notes for ${missing.join(', ')}`);

const card = (f) => {
  const n = STUDY_NOTES[f.id];
  return `
    <article class="s-card" id="${f.id}">
      <button class="s-thumb" data-film="${f.id}" aria-label="Play the ${esc(f.name)} film"><img src="thumbs/${f.id}.jpg" alt="" loading="lazy" width="480" height="300"><span class="s-play">Play film</span></button>
      <div class="s-body">
        <div class="s-eyebrow">${esc(f.note)}</div>
        <h3>${esc(f.name)}</h3>
        <p class="s-machine">${esc(n.machine)}</p>
        ${n.elements.length ? `<div class="s-eh">Worth lifting</div><ul>${n.elements.map((e) => `<li>${esc(e)}</li>`).join('')}</ul>` : ''}
        ${f.for ? `<a class="s-link" href="index.html#${f.for}">Its card in Prototypes</a>` : ''}
      </div>
    </article>`;
};

const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>SLUMBER Studies</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Grenze+Gotisch:wght@700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@500&display=swap">
<style>
${css}
body { overflow: auto }
.s-page { max-width: 1280px; margin: 0 auto; padding: 20px max(16px, env(safe-area-inset-right, 0px)) 60px max(16px, env(safe-area-inset-left, 0px)) }
.s-intro { max-width: 70ch; color: var(--muted); margin: 0 0 8px }
.s-section h2 { font: 700 30px/1.1 var(--display); margin: 28px 0 12px; display: flex; gap: 12px; align-items: baseline }
.s-section h2 small { font: 500 11px var(--mono); letter-spacing: .08em; text-transform: uppercase; color: var(--muted) }
.s-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 380px), 1fr)); gap: 14px }
.s-card { background: var(--panel); border: 1px solid var(--line); border-radius: 6px; overflow: hidden; display: flex; flex-direction: column }
.s-card:target { border-color: var(--gold) }
.s-thumb { position: relative; display: block; padding: 0; border: 0; background: #0d0c11; cursor: pointer }
.s-thumb img { display: block; width: 100%; height: auto; aspect-ratio: 8 / 5; object-fit: cover }
.s-play { position: absolute; right: 10px; bottom: 10px; font: 500 11px var(--mono); letter-spacing: .06em; text-transform: uppercase; color: var(--bg); background: var(--gold); padding: 6px 9px; border-radius: 4px }
.s-body { padding: 12px 14px 14px; display: grid; gap: 6px }
.s-eyebrow { font: 500 10.5px/1.3 var(--mono); letter-spacing: .08em; text-transform: uppercase; color: var(--muted) }
.s-body h3 { margin: 0; font: 700 24px/1.1 var(--display) }
.s-machine { margin: 0; font-size: 13.5px }
.s-eh { font: 500 10.5px var(--mono); letter-spacing: .08em; text-transform: uppercase; color: var(--gold); margin-top: 4px }
.s-body ul { margin: 0; padding-left: 18px; display: grid; gap: 3px; font-size: 13px; color: var(--ink) }
.s-link { font-size: 12.5px; justify-self: start }
.s-viewer { position: fixed; inset: 0; z-index: 30; background: rgba(10, 8, 14, .92); display: grid; grid-template-rows: auto minmax(0, 1fr); padding: max(10px, env(safe-area-inset-top, 0px)) 12px 12px }
.s-vbar { display: flex; align-items: center; gap: 12px; padding: 4px 4px 10px }
.s-vbar h2 { margin: 0; font: 700 24px/1 var(--display); flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap }
.s-vbar button { font: 500 12px var(--mono); letter-spacing: .06em; text-transform: uppercase; color: var(--ink); background: var(--panel-2); border: 1px solid var(--line); border-radius: 4px; padding: 7px 12px; cursor: pointer }
.s-viewer iframe { width: 100%; height: 100%; border: 1px solid var(--line); border-radius: 6px; background: #000 }
</style>
</head>
<body>
<header class="top">
  <div class="brand"><span class="brand-name">SLUMBER</span> <span class="brand-sub">Bestiary</span></div>
  <nav class="topnav" aria-label="Pages"><a href="index.html">Prototypes</a><a href="studies.html" aria-current="page">Studies</a></nav>
  <div class="top-note">Mechanism studies: films, not playable. A source for geometry and stage concepts.</div>
</header>
<main class="s-page">
  <p class="s-intro">Each study is one real machine, its numbers checked in code, mapped onto what a stage or an enemy has to do. They are for picking elements to carry into the prototypes, not designs to build as they are.</p>
  <section class="s-section"><h2>Stage studies <small>${FILMS.filter(isStage).length} films</small></h2><div class="s-grid">${FILMS.filter(isStage).map(card).join('')}</div></section>
  <section class="s-section"><h2>Enemy studies <small>${FILMS.filter((f) => !isStage(f)).length} films</small></h2><div class="s-grid">${FILMS.filter((f) => !isStage(f)).map(card).join('')}</div></section>
</main>
<div class="s-viewer" id="viewer" hidden>
  <div class="s-vbar"><h2 id="vtitle"></h2><button id="vclose">Close</button></div>
  <iframe id="vframe" title="Study film"></iframe>
</div>
<script>
const FILMS = ${JSON.stringify(Object.fromEntries(FILMS.map((f) => [f.id, {name: f.name, page: f.page}])))};
const viewer = document.getElementById('viewer');
const frame = document.getElementById('vframe');
function open(id) {
  const f = FILMS[id];
  if (!f) return;
  document.getElementById('vtitle').textContent = f.name;
  frame.src = f.page;
  viewer.hidden = false;
  document.getElementById('vclose').focus();
}
function close() {
  viewer.hidden = true;
  frame.removeAttribute('src');
}
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-film]');
  if (b) open(b.dataset.film);
});
document.getElementById('vclose').addEventListener('click', close);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !viewer.hidden) close(); });
// a link from a prototype card lands on the study's card
if (location.hash && FILMS[location.hash.slice(1)]) document.getElementById(location.hash.slice(1))?.scrollIntoView({block: 'center'});
</script>
</body>
</html>
`;
fs.writeFileSync(path.join(OUT, 'studies.html'), page);
console.log(`${path.join(OUT, 'studies.html')}  ${(page.length / 1024).toFixed(0)} KB`);
