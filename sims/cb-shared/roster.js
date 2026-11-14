// The Chopping Block roster for the lab's drawer: what each enemy does, its numbers (the Chopping Block definitions and
// the movement model in swarm.js) and whether it is in the lab yet. Health is weak points × health per point; one
// shard does one damage.
import {M} from './swarm.js';
import {E} from './elites.js';

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
      {id: 'elder', name: 'Elder Spinewyrm', role: 'Burrowing wyrm, tier 2', status: 'lab', hp: 250, orbs: 50,
        does: 'The same body at 5.5×. It surfaces about 3 s after it spawns and chases at once, slower to turn than the Spinewyrm, and it does not burrow again.',
        counter: 'Keep it on a long circle and strip the belly from behind.',
        data: [['Weak points', '25 orbs × 10'], ['Speed', '14 m/s'], ['Turn', '52°/s'], ['Burrows', 'never']]},
      {id: 'pale', name: 'Pale Spinewyrm', role: 'High circler', status: 'lab', hp: 500, orbs: 10,
        does: 'A pale, half-seen body at 5×. It climbs to about 24 m and circles the arena for good, swallowing any seeking shard that comes near its head.',
        counter: 'Seeking shards are wasted on it: use plain fire.',
        data: [['Weak points', '25 orbs × 20'], ['Circles', '30 m out, 24 m up'], ['Eats', 'seeking shards within 14 m of its head']]},
    ],
  },
  {
    group: 'Tithe-Taker',
    items: [
      {id: 'tithe', name: 'Tithe-Taker', role: 'Orb thief', status: 'lab', hp: 25, orbs: 1,
        does: 'Rises at the rim; its head comes up over 3 s and then faces you. While it faces you it drags loose orbs within 22 m to itself and eats them, and lays one egg per orb, one a second. It jitters about in short dashes. Hit the head and it ducks until a second passes unharmed.',
        counter: 'Shoot the head the moment it is up, before your orbs reach it.',
        data: [['Faces you', 'after 3 s'], ['Pull', `${E.tithe.pullR} m, ${E.tithe.pullV} m/s`], ['Eggs', 'one per orb eaten, 1 s apart'], ['Ducks', '1 s after the last hit']]},
      {id: 'great_tithe', name: 'Great Tithe-Taker', role: 'Orb thief, tier 2', status: 'lab', hp: 200, orbs: 1,
        does: 'The Tithe-Taker at 1.7×: its head takes 9 s to come up, and it has eight times the health.',
        counter: 'It gives you longer before it faces you: use it.',
        data: [['Faces you', 'after 9 s'], ['Health', '200']]},
      {id: 'egg', name: 'Tithe Egg', role: 'Egg', status: 'lab', hp: 3, orbs: 0,
        does: 'Lies where it was laid and swells; 10 s later it hatches 5 mites.',
        counter: 'Three shards each: pop them before they hatch.',
        data: [['Hatches', `after ${E.egg.hatch} s`], ['Into', `${E.egg.mites} mites`]]},
      {id: 'mite', name: 'Tithe Mite', role: 'Swarm', status: 'lab', hp: 3, orbs: 0,
        does: 'Darts at you in bursts: every 0.45-0.8 s it picks a point within 4 m of you and dashes at it, then coasts.',
        counter: 'Low and fast: jump them or sweep the floor.',
        data: [['Dash', `${E.mite.dash} m/s for ${E.mite.dashFor} s`], ['Burst', 'every 0.45-0.8 s'], ['Aim', 'a random point within 4 m of you']]},
    ],
  },
  {
    group: 'The Cantor',
    items: [
      {id: 'cantor', name: 'The Cantor', role: 'Boss', status: 'lab', hp: 1500, orbs: 6,
        does: 'Hangs over the arena and turns slowly counter-clockwise. Wakes 8.5 s after it appears; from 13.5 s, and every 20 s after, it calls: every chaser and wanderer is dragged to it and turns Fevered (far more health, a hot tint). Six weak points round its rim; its body soaks shards.',
        counter: 'Thin the swarm before each call, and work round the rim points between calls.',
        data: [['Weak points', '6 × 250'], ['Wakes', 'after 8.5 s'], ['Calls', 'from 13.5 s, every 20 s, about 2.4 s each'], ['Fevered', 'Ash Mote 10, Stray 20, Hound 100, Warden 300']]},
      {id: 'eye', name: "Cantor's Eye", role: 'Boss remnant', status: 'lab', hp: 2400, orbs: 0,
        does: 'Drops 3.3 s after the Cantor dies and wakes 10 s after; then it watches you and calls every 2.5 s. Kept under fire it is stunned and cannot call.',
        counter: 'Never let up: steady fire keeps it quiet.',
        data: [['Lands', '3.3 s after the death'], ['Wakes', '10 s after the death'], ['Calls', 'every 2.5 s'], ['Stunned', 'while hit in the last 0.3 s']]},
    ],
  },
  {
    group: 'Obstacles',
    items: [
      {id: 'briar', name: 'Briar', role: 'Obstacle', status: 'lab', hp: 120, orbs: 0,
        does: 'Comes up out of the floor after about 3 s and stays: a cluster of spikes you cannot stand in, and it soaks shards low down.',
        counter: 'Plan your circle round it.',
        data: [['Comes up', 'after about 3 s'], ['Footprint', `${E.briar.r} m radius`]]},
    ],
  },
];
export const ALL = ROSTER.flatMap((g) => g.items);
