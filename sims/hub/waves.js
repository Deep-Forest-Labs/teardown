// Wave timelines for Phases mode, one per layer, built from the board's pacing rules (Levels board, Nov 11):
// open slow (first enemy within 3 s, singles 5 to 15 s apart), introduce one new thing at a time, pairs on a steady
// pulse, a breather before a spike, each new tier opens with an elite, elites arrive with or after an emitter, and the
// prince closes it. V1 compresses a layer into about 95 s so a whole run can be watched; times are in seconds.
// Each wave: {t, name, spawn: [[enemyId, count]], note}. The last wave has prince: true and starts the fight.
import {BIOMES} from './roster.js';

export const PRINCE_FIGHT_SECONDS = 70; // phase one then phase two, played from the prince wave

export function wavesFor(biome) {
  const [melee, ranged, third] = biome.elites.map((e) => e.id);
  return [
    {t: 2, name: 'Opening', spawn: [['skull', 1]], note: 'One flock, inside 3 s'},
    {t: 11, name: 'Single', spawn: [['puffer', 1]], note: 'One new thing, alone'},
    {t: 22, name: 'Pairs', spawn: [['skull', 1], ['scorpion', 1]], note: 'A known enemy beside a new one'},
    {t: 34, name: 'Emitter', spawn: [['spawner', 1]], note: 'An emitter before the first elite'},
    {t: 42, name: 'First elite', spawn: [[melee, 1]], note: 'A new tier opens with an elite, after the emitter'},
    {t: 56, name: 'Pressure', spawn: [['worm', 1], ['skull', 1], ...(third ? [[third, 1]] : [])], note: 'The pulse tightens'},
    {t: 68, name: 'Breather', spawn: [], note: 'Quiet before the spike'},
    {t: 76, name: 'Second elite', spawn: [[ranged, 1], ['quadruped', 1], ['shooter', 1]], note: 'The spike'},
    {t: 95, name: 'Prince', spawn: [], prince: true, note: 'The fight: phase one, then phase two'},
  ];
}

export const WAVES = Object.fromEntries(BIOMES.map((b) => [b.id, wavesFor(b)]));
