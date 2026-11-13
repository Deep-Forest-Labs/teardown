// The design export: everything the Bestiary has tuned, in one JSON document (schema v1, see DESIGN-DATA.md).
// The Unity bridge reads it: arena scale for the next blockouts, wave timelines for round data, each enemy's
// behaviour numbers (read from its live rig: agent speeds and the tell / attack / recover timings), weak points,
// and the prince fight phases. Default arena scale leans big, per Luke (Nov 13).
import * as THREE from 'three';
import {REG} from './agent.js';
import {FIGHTS} from './fights.js';
import {FIGHTS2} from './fights2.js';
import {PLAYER} from './player.js';
import {BASE, BIOMES, WEAK} from './roster.js';
import {BUILD} from './standins.js';
import {PRINCE_FIGHT_SECONDS, WAVES} from './waves.js';

export const DEFAULT_SCALE = {w: 1.4, h: 1.2};
const ALL_FIGHTS = {...FIGHTS, ...FIGHTS2};
const r2 = (x) => Math.round(x * 100) / 100;

/** Build a creature off screen and read its agents and phase timings. */
function readRig(card) {
  const parent = new THREE.Group();
  const g = new THREE.Group();
  parent.add(g);
  REG.cur = {agents: [], phases: []};
  BUILD[card.kind](g, {home: new THREE.Vector3(), centre: new THREE.Vector3()});
  const rec = REG.cur;
  REG.cur = null;
  parent.clear();
  return {
    agents: rec.agents.map((a) => ({speed: r2(a.speed), turnRate: r2(a.turn), accel: r2(a.accel), flies: a.fly, hover: r2(a.hover)})),
    timings: rec.phases.map((p) => Object.fromEntries(p.order.map((n) => [n, r2(p.dur[n] ?? 0)]))),
  };
}

export function buildDesign(S) {
  const enemies = {};
  const cards = [...BASE, ...BIOMES.flatMap((b) => [...b.elites, b.prince])];
  for (const c of cards) {
    enemies[c.id] = {
      name: c.name,
      role: c.role,
      size: c.size,
      status: c.status,
      home: BIOMES.find((b) => b.elites.some((e) => e.id === c.id) || b.prince.id === c.id)?.id ?? 'every layer',
      verb: c.verb,
      tell: c.tell,
      counter: c.counter,
      weakPoint: WEAK[c.id] ?? null,
      ...readRig(c),
    };
  }
  const arenas = {};
  for (const b of BIOMES) {
    const sc = S.scale?.[b.id] || DEFAULT_SCALE;
    const F = ALL_FIGHTS[b.id] ? ALL_FIGHTS[b.id](new THREE.Group()) : null;
    arenas[b.id] = {
      layer: b.layer,
      name: b.name,
      sin: b.sin,
      teaches: b.move,
      scale: {w: r2(sc.w), h: r2(sc.h)},
      scaleIsDefault: !S.scale?.[b.id],
      prince: b.prince.id,
      fight: F ? {phases: F.phases, secondsPerPlay: PRINCE_FIGHT_SECONDS, killY: F.killY, spawn: F.spawn, spawnSpots: F.spots(0)} : null,
      waves: WAVES[b.id].map((w) => ({t: w.t, name: w.name, spawn: w.spawn.map(([enemy, count]) => ({enemy, count})), prince: !!w.prince, note: w.note})),
    };
  }
  return {
    schema: 'slumber-bestiary-design',
    version: 1,
    units: {length: 'm', time: 's', angle: 'rad'},
    source: 'https://deep-forest-labs.github.io/teardown/',
    note: 'Spawn spots and spawns are in unscaled arena units: multiply x and z by scale.w and y by scale.h.',
    player: {runSpeed: PLAYER.speed, gravity: PLAYER.gravity, jumpHeight: PLAYER.jump, doubleJumpHeight: PLAYER.doubleJump, padLaunchSpeed: PLAYER.padPower, height: PLAYER.height},
    tuning: {enemySpeedMultiplier: r2(S.speed ?? 1)},
    defaults: {arenaScale: DEFAULT_SCALE},
    arenas,
    enemies,
  };
}
