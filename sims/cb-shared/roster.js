// The Chopping Block roster for the lab's drawer: what each enemy does, its numbers (the Chopping Block definitions and
// the movement model in swarm.js) and whether it is in the lab yet. Health is weak points × health per point; one
// shard does one damage.
import {M} from './swarm.js';

const deg = (r) => Math.round((r * 180) / Math.PI);
const range = (a) => `${a[0]}-${a[1]}`;

export const ROSTER = [
  {
    group: 'Spawners',
    items: [
      {id: 'censer', name: 'Censer', role: 'Spawner', status: 'lab', hp: 10, orbs: 2,
        does: 'Appears at the rim, spins slowly and drifts inward without ever stopping. 3 s after it appears, and every 20 s after that, it releases 10 Ash Motes and a Stray.',
        counter: 'Kill it before the second burst. Every burst you let out stays.',
        data: [['Burst', '10 Ash Motes + 1 Stray'], ['First', '3 s after it appears'], ['Repeat', 'every 20 s'], ['Drift', `${M.censer.drift} m/s inward`]]},
      {id: 'twin', name: 'Twin Censer', role: 'Spawner', status: 'lab', hp: 20, orbs: 3,
        does: 'A heavier Censer with two weak points. Its burst carries a Hound instead of a Stray.',
        counter: 'The Hound is the threat: shoot it as it rises out of the burst.',
        data: [['Burst', '10 Ash Motes + 1 Hound'], ['Weak points', '2 × 10']]},
      {id: 'great', name: 'Great Censer', role: 'Spawner', status: 'lab', hp: 90, orbs: 3,
        does: 'The largest Censer: three weak points, 15 motes and a Warden each burst.',
        counter: 'Commit to it early or the Wardens stack up.',
        data: [['Burst', '15 Ash Motes + 1 Warden'], ['Weak points', '3 × 30']]},
    ],
  },
  {
    group: 'The swarm',
    items: [
      {id: 'mote', name: 'Ash Mote', role: 'Tier 1 chaser', status: 'lab', hp: 1, orbs: 0,
        does: 'Constant speed, capped turn, steered by a loiter field round the player: far out it heads straight at you, near its ring it swings onto a counter-clockwise circle. Stand and it circles you; run and the swarm swirls after you.',
        counter: 'Keep moving and stream shards across the swarm.',
        data: [['Speed', `${range(M.mote.v)} m/s`], ['Turn', `${deg(M.mote.turn)}°/s`], ['Ring', '11-13 m, counter-clockwise'], ['Loop', 'about 3.3 s']]},
      {id: 'stray', name: 'Stray', role: 'Tier 2 wanderer', status: 'lab', hp: 5, orbs: 1,
        does: 'Never chases. Every 1.6-2.5 s it picks a new random point and steers to it at a capped turn, so its path is smooth S-bends across the arena.',
        counter: 'It hits you by accident: watch its line, not its distance.',
        data: [['Speed', `${range(M.stray.v)} m/s`], ['Turn', `${deg(M.stray.turn)}°/s`], ['New point', `every ${range(M.stray.hold)} s`]]},
      {id: 'hound', name: 'Hound', role: 'Tier 3 charger', status: 'lab', hp: 10, orbs: 1,
        does: 'The same rule as the Ash Mote, tight and fast: it charges in straight and circles a standing player at about 6 m, a loop every 1.7 s.',
        counter: 'Kill it on the way in; once it is circling it is hard to track.',
        data: [['Speed', `${range(M.hound.v)} m/s`], ['Turn', `${deg(M.hound.turn)}°/s`], ['Ring', 'about 6 m'], ['Loop', 'about 1.7 s']]},
      {id: 'warden', name: 'Warden', role: 'Tier 4 charger', status: 'lab', hp: 100, orbs: 0,
        does: 'Big and fast with a wide turn: it charges in and circles at about 13 m, sweeping through anything in its path.',
        counter: 'Too tough to burst down at range: keep it in front of you and keep firing.',
        data: [['Speed', `${range(M.warden.v)} m/s`], ['Turn', `${deg(M.warden.turn)}°/s`], ['Ring', 'about 13 m'], ['Loop', 'about 3.2 s']]},
    ],
  },
  {
    group: 'Wyrms',
    items: [
      {id: 'spinewyrm', name: 'Spinewyrm', role: 'Burrowing wyrm', status: 'lab', hp: 75, orbs: 25,
        does: 'Our flying bone centipede (BONEPEDE II) at 4×, about 31 m. Surfaces about 3 s after it spawns, flies idly for 4 s, then chases with a wide 66°/s turn. Burrows again after 15 s up, or when you get close to its head, and surfaces near you a few seconds later. The body rides the head’s path exactly.',
        counter: 'Work down the belly orbs while it flies past; keep away from where it surfaces.',
        data: [['Weak points', '25 orbs × 3'], ['Speed', '16 m/s'], ['Turn', '66°/s'], ['Surfaces', 'about 3 s after spawning'], ['Burrows', 'after 15 s up, or when you reach its head'], ['Under', 'about 3 s']]},
    ],
  },
  {
    group: 'Next',
    items: [
      {id: 'tithe', name: 'Tithe-Taker', role: 'Orb thief', status: 'planned', hp: 25, orbs: 1,
        does: 'Rises at the rim and turns its head to you after 3 s; while it faces you it pulls in loose orbs and lays them back as eggs that hatch into mites after 10 s.',
        counter: 'Shoot the head: it hides for a second when hurt.',
        data: [['Faces you', 'after 3 s'], ['Eggs hatch', 'after 10 s, 5 mites']]},
      {id: 'cantor', name: 'The Cantor', role: 'Boss', status: 'planned', hp: 1500, orbs: 6,
        does: 'Wakes 8.5 s after it appears and every 20 s calls every chaser to it and turns them Fevered. When it dies its Eye drops and keeps calling every 2.5 s.',
        counter: 'Clear the swarm before each call.',
        data: [['Wakes', 'after 8.5 s'], ['Calls', 'every 20 s from 13.5 s']]},
      {id: 'briar', name: 'Briar', role: 'Obstacle', status: 'planned', hp: 120, orbs: 0,
        does: 'Emerges after about 3 s and stays: it takes up floor you need.',
        counter: 'Plan your circle round it.',
        data: [['Emerges', 'about 3 s']]},
    ],
  },
];
export const ALL = ROSTER.flatMap((g) => g.items);
