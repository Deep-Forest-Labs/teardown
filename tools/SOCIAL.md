# Social clips

`tools/social.mjs` renders the SLUMBER Bestiary to social video, frame by frame, from a manifest of named shots
(`tools/social-shots.json`). Every frame is drawn at a known time on a virtual clock with a seeded `Math.random`, so
the same site gives the same frames: re-run a shot after the site changes and you get the same camera, the same
timing, the new creature. That is what makes "then vs now" posts cheap.

## Prerequisites

- `npm install` in the repo root (playwright, nothing else is used).
- Google Chrome installed. It is the default browser (no `npx playwright install` needed) and what the approved
  clips were made on. `CHROMIUM=<path>` uses another binary; `--browser bundled` uses Playwright's Chromium.
- `ffmpeg` and `ffprobe` on PATH (or `FFMPEG` / `FFPROBE`).
- A real GPU. On macOS the ANGLE Metal backend is used; `--gl swiftshader` is the software fallback (slow, and its
  frames differ from GPU frames).

## Commands

```
npm run social -- list                       # the shots in the manifest
node tools/social.mjs list
node tools/social.mjs bonepede2              # one shot, every size it lists
node tools/social.mjs bonepede2 altar-fight  # several
node tools/social.mjs all                    # everything
node tools/social.mjs all --dry-run          # print the resolved plan, render nothing
```

Options: `--base <url|dir>` (default the live site; a folder such as `teardown-out/dist/hub` is served locally,
so a build can be filmed before it is published), `--only-size 1080x1920` or `--only-size 9x16`,
`--date YYYY-MM-DD` (output folder, default today), `--out <dir>` (default `teardown-out/social`),
`--keep-frames` (keep the PNG frames), `--shots <file>` (another manifest). Any shot parameter can also be given
as a flag to override the manifest for one run, e.g. `node tools/social.mjs gilded --highlight-start 4 --poster 9`.

Ad hoc, without a manifest entry, with the same flags (handy for finding a shot before saving it); the tool prints
the JSON to paste into the manifest:

```
node tools/social.mjs --page gilded-live --name gilded-test --highlight-start 6
node tools/social.mjs --mode stage --layer altar --stage-mode hunt --set follow=0 --preroll 20 \
  --cam 30,35,88,0,0,4 --orbit 40 --name altar-test --dry-run
```

Ad hoc page shots inherit `defaults.page` (the hide and strip rules); `--hide ''` clears them.

## Adding a shot

Add an entry under `"shots"`. Keys are the flag names in camelCase (`--highlight-start` lives in `highlights`).

| key | |
|---|---|
| `description` | one line, shown by `list` |
| `mode` | `page` (a page with the SIM contract: `?capture`, `window.SIM.render(t)`) or `stage` (the Bestiary viewer, `index.html#<layer>`) |
| `page` | page mode: page name on the base (`bonepede2-live`) or a path to a local `.html` |
| `layer`, `stageMode`, `set` | stage mode: layer hash, mode button (`wander`, `hunt`, `phases`), toggles (`weak labels prince roster follow footprints fight`) as `{"follow": false}` |
| `preroll` | stage: seconds simulated before frame 0, so enemies have spread out |
| `cam`, `orbit` | stage: `[az, el, dist, tx, ty, tz]` (degrees, metres; target optional) and degrees of orbit over the clip |
| `phaseFrom`/`phaseTo` or `phaseKeys` | stage: the Fight phase slider swept over the clip, or `"t:phase,t:phase"` keys |
| `hide`, `css`, `stripRow`, `stripIn` | selectors to hide, extra CSS, a `LABEL <b>value</b>` row to strip from `[data-read]` |
| `sizes` | `["1080x1350"]`, or `{"1080x1350": {}, "1080x1920": {"cam": [...]}}` with per-size overrides |
| `highlights` | `[{"start": 14.4, "length": 12}]`; `start: "auto"` picks the window with the most motion; `[]` for none |
| `poster` | seconds, or `auto` (middle of the first highlight) |
| `duration`, `fps`, `from`, `to`, `crf`, `seed`, `param`, `rngSeed`, `dpr`, `tag` | as the flags; defaults in `"defaults"` |

`defaults` holds the base URL, fps, crf, duration, default sizes, and `page` / `stage` blocks merged into every
shot of that mode. Precedence: defaults < defaults.page|stage < shot < size override < command-line flag.

Finding a stage camera: open the live page, put the stage in the mode you want and orbit to a view you like. The
camera is three.js OrbitControls; `az` is the angle around +y from +z, `el` the elevation, `dist` the distance to the
target. Then iterate cheaply with a short ad hoc run: `--to 2 --highlight 0 --sheet 6` and read the poster. Finding a
phase: the Fight phase slider shows its range (logged as `phase-range=0..N` on every stage run); sweep it once with
`--phase-from 0 --phase-to <N>` and read the contact sheet, whose tile times are printed.

## Output

```
teardown-out/social/<YYYY-MM-DD>/
  <shot>-<aspect>-<len>s.mp4        full clip (e.g. altar-fight-4x5-30s.mp4)
  <shot>-<aspect>-<hl>s.mp4         each highlight cut (a second one of the same length gets -t<start>)
  <shot>-<aspect>-poster.png        one full-resolution frame
  <shot>-<aspect>-sheet.png         24 frames, 6 across, row-major
  <shot>-<aspect>-activity.json     per-frame luma mean/std/motion (drives highlight auto)
  manifest.json                     one entry per clip file, accumulated over the day's runs
```

Each manifest entry records the resolved shot parameters, the URL, the site version (for the live site: the
`gh-pages` commit whose copy of the page matches what was served, found in the local `origin/gh-pages` ref, plus
Last-Modified and ETag; for a local base: the file's blob hash and the repo commit), the GPU, the Chrome version,
the tool version, and ffprobe facts with a sha256. `teardown-out/` is git-ignored, so no media gets committed.

## Encoding

H.264 High, yuv420p, CRF 16, preset slow, `+faststart`, 30 fps constant, no audio. Sizes 1080x1350 (4:5, feed) and
1080x1920 (9:16, reels/stories/shorts) at device pixel ratio 1; 1920x1080 (16:9) for the `-film` pages, whose
cameras and panels are composed for a wide frame. Frames are lossless PNG screenshots before encoding.
