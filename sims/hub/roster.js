// Everything the Bestiary shows, taken from the Slumber Levels board (Nov 11 review). Status:
//   prototype  a live teardown page exists (opens inside the hub)
//   game       built in the Unity project already
//   draft      a whitebox stand-in only
// `kind` picks the whitebox stand-in in standins.js. Sizes: S about 0.7 m, M about 1.8 m, L about 3.5 m.

export const PROTOTYPES = [
  {id: 'proto-bonepede2', name: 'BONEPEDE II', note: 'Flying skull worm with a row of belly weak points', page: 'bonepede2-live.html', thumb: 'thumbs/proto-bonepede2.jpg'},
  {id: 'proto-gilded', name: 'Gilded skull', note: 'Greed elite: a gold shell that opens on a red core', page: 'gilded-live.html', thumb: 'thumbs/proto-gilded.jpg'},
  {id: 'proto-bonepede', name: 'BONEPEDE (crawler)', note: 'The first sketch: a ground centipede, feet never slide', page: 'bonepede-live.html', thumb: 'thumbs/proto-bonepede.jpg'},
];

export const BASE = [
  {id: 'skull', name: 'Swarm skull', role: 'Swarm', size: 'S', verb: 'Swarms and bites', tell: 'Chatter grows as the flock turns', counter: 'Stream across the flock, keep moving', status: 'game', kind: 'swarm'},
  {id: 'puffer', name: 'Puffer skull', role: 'Swarm', size: 'S', verb: 'Swells, then flies in', tell: 'Inflating hiss', counter: 'Pop it at range', status: 'game', kind: 'puffer'},
  {id: 'worm', name: 'Skull worm', role: 'Chaser', size: 'L', verb: 'Coils round and strikes', tell: 'Rattle, then the head rears', counter: 'Shoot the head, sidestep the lunge', status: 'prototype', proto: 'proto-bonepede2', kind: 'wyrm'},
  {id: 'scorpion', name: 'Scorpion', role: 'Chaser', size: 'M', verb: 'Charges in a straight line', tell: 'Plants and scrapes before the charge', counter: 'Sidestep and hit it while it recovers', status: 'game', kind: 'scorpion'},
  {id: 'spawner', name: 'Wandering spawner', role: 'Spawner', size: 'L', verb: 'Wanders and pours skulls', tell: 'Deep pulse before each pour', counter: 'Priority kill', status: 'game', kind: 'spawner'},
  {id: 'quadruped', name: 'Quadruped', role: 'Chaser', size: 'L', verb: 'Stalks on four legs and pounces', tell: 'Crouch and a low growl', counter: 'Back off the pounce line, punish the landing', status: 'game', kind: 'quadruped'},
  {id: 'shooter', name: 'Shooter', role: 'Ranged', size: 'M', verb: 'Keeps its distance and fires dodgeable shots', tell: 'Charge glow before each shot', counter: 'Break line of sight, then close in', status: 'draft', kind: 'shooter'},
];

// arena: the blockout in arenas.js. elites: [melee, ranged] (Void has three). prince: the boss stand-in.
export const BIOMES = [
  {
    id: 'altar', layer: 1, name: 'The Altar', sin: 'Sacrifice', move: 'Run and jump', arena: 'altar',
    concept: 'The approved disc, with a bleeding rim and a sunken blood channel. Spiders circle the rim.',
    elites: [
      {id: 'spider', name: 'Disc spider', role: 'Elite melee', size: 'M', verb: 'Circles the rim and swallows orbs', tell: 'Skitter, and its belly glows as it fills', counter: 'Kill it before ten swallows birth a worm', status: 'game', kind: 'spider'},
      {id: 'censer', name: 'Censer', role: 'Elite ranged', size: 'M', verb: 'Lobs arcs of burning blood that pool', tell: 'Chain clink as it winds up', counter: 'Leave the pool, shoot the swinging censer', status: 'draft', kind: 'censer'},
    ],
    prince: {id: 'leviathan', name: 'Leviathan, the Skull Squid', role: 'Prince', size: 'Prince', verb: 'Rises from the centre pool and fires rings', tell: 'The pool boils before it surfaces', counter: 'Below half health it fans and spirals; kill the escort worms', status: 'game', kind: 'p-leviathan'},
  },
  {
    id: 'void', layer: 2, name: 'The Void', sin: 'Sloth', move: 'Dash', arena: 'void',
    concept: 'Three rings of one-way tiers over an abyss. Pads lift you a tier; outer gaps are a running Dash wide. Fall off and you die.',
    elites: [
      {id: 'diver', name: 'Diver', role: 'Elite melee', size: 'M', verb: 'Marks your tier, then dives', tell: 'A ring on your tier and a falling shriek', counter: 'Change tier. Stepping sideways is not enough', status: 'draft', kind: 'diver'},
      {id: 'percher', name: 'Percher', role: 'Elite ranged', size: 'M', verb: 'Holds the high perches and fires down', tell: 'Glint at the perch', counter: 'Jetpack above it', status: 'draft', kind: 'percher'},
      {id: 'floater', name: 'Floater', role: 'Spawner', size: 'M', verb: 'Drifts, eats orbs, spawns Divers', tell: 'Gulp sound per orb', counter: 'Kill it early', status: 'draft', kind: 'floater'},
    ],
    prince: {id: 'belphegor', name: 'Belphegor', role: 'Prince', size: 'Prince', verb: 'Hangs at the top tier and sweeps the lowest', tell: 'Its sweep line crawls across a tier first', counter: 'Weak points show only from above', status: 'draft', kind: 'p-belphegor'},
  },
  {
    id: 'ruins', layer: 3, name: 'The Ruins', sin: 'Pride', move: 'Ground Slam', arena: 'ruins',
    concept: 'A fallen temple courtyard. Pillars carry launch pads to a ring gallery. Cracked tiles break under a slam into a crypt ring.',
    elites: [
      {id: 'sentinel', name: 'Statue sentinel', role: 'Elite melee', size: 'L', verb: 'Walks you down, and takes damage only from behind', tell: 'Stone grind, and its eyes light when it turns', counter: 'Flank it, or jump-pad over it', status: 'draft', kind: 'sentinel'},
      {id: 'zealot', name: 'Zealot', role: 'Elite ranged', size: 'M', verb: 'Shields the enemies near it and chants bolts', tell: 'Chanting, and a halo on the shielded', counter: 'Kill the zealot first', status: 'draft', kind: 'zealot'},
    ],
    prince: {id: 'belial', name: 'Belial', role: 'Prince', size: 'Prince', verb: 'Shielded on the dais until humbled', tell: 'A pillar glows while it feeds the shield', counter: 'Break his four pillars, then he walks the gallery', status: 'draft', kind: 'p-belial'},
  },
  {
    id: 'gluttony', layer: 4, name: 'Gluttony', sin: 'Gluttony', move: 'Double jump', arena: 'gluttony',
    concept: 'A flesh bowl. Mounds rise from a bile floor, spaced for double jumps. Corpses pile into mounds that feed the horde.',
    elites: [
      {id: 'maggot', name: 'Maggot', role: 'Elite melee', size: 'S to L', verb: 'Eats corpses and grows a size each time', tell: 'Wet chewing, and it swells', counter: 'Kill it while it is small, clear corpses', status: 'draft', kind: 'maggot'},
      {id: 'bloater', name: 'Bloater', role: 'Elite ranged', size: 'M', verb: 'Spits bile arcs, then bursts in a cloud', tell: 'Gurgle and a swelling belly', counter: 'Kill it at range, away from the crowd', status: 'draft', kind: 'bloater'},
    ],
    prince: {id: 'beelzebub', name: 'Beelzebub', role: 'Prince', size: 'Prince', verb: 'He is the swarm: kill the flock to expose the core', tell: 'The swarm tightens round the core', counter: 'He eats his own horde to grow; keep the flock thin', status: 'draft', kind: 'p-beelzebub'},
  },
  {
    id: 'greed', layer: 5, name: 'Greed', sin: 'Greed', move: 'Air dash', arena: 'greed',
    concept: 'A vault of stacked coin terraces. Vault lifts ride between terraces on a cycle. Gaps between lifts are air-dash wide.',
    elites: [
      {id: 'imp', name: 'Imp thief', role: 'Elite melee', size: 'S', verb: 'Snatches orbs and credits, then flees', tell: 'Giggle and a coin jingle', counter: 'Chase it down and the loot drops back', status: 'draft', kind: 'imp'},
      {id: 'gilded', name: 'Gilded skull', role: 'Elite ranged', size: 'M', verb: 'Armored, fires coin volleys', tell: 'Metal ring before each volley', counter: 'Break the plating, then the core. It pays big', status: 'prototype', proto: 'proto-gilded', kind: 'gilded'},
    ],
    prince: {id: 'mammon', name: 'Mammon', role: 'Prince', size: 'Prince', verb: 'Steals the mana orbs into his hoard', tell: 'Orbs stream toward the hoard', counter: 'Break the hoard to take them back; then dash the locked lifts', status: 'draft', kind: 'p-mammon'},
  },
  {
    id: 'lust', layer: 6, name: 'Lust', sin: 'Lust', move: 'Updraft glide', arena: 'lust',
    concept: 'An open storm terrace ringed by updraft columns. Winds sweep the floor in a rotating direction.',
    elites: [
      {id: 'twins', name: 'Twins', role: 'Elite melee', size: 'M', verb: 'Move as a pair. Kill one and the other enrages', tell: 'Matched whispers', counter: 'Damage both evenly', status: 'draft', kind: 'twins'},
      {id: 'siren', name: 'Siren', role: 'Elite ranged', size: 'M', verb: 'Sings a pull beam that drags you in', tell: 'A rising note, and the screen tints', counter: 'Break line of sight or dash out', status: 'draft', kind: 'siren'},
    ],
    prince: {id: 'lilith', name: 'Lilith', role: 'Prince', size: 'Prince', verb: 'Charms and pulls from the high petals', tell: 'Her mirror turns toward you', counter: 'Shoot only while her mirror is down', status: 'draft', kind: 'p-lilith'},
  },
  {
    id: 'wrath', layer: 7, name: 'Wrath', sin: 'Wrath', move: 'Everything', arena: 'wrath',
    concept: 'A burning prison yard with tiered cell blocks. Fire floods the low ground in waves, so the fight moves up.',
    elites: [
      {id: 'berserker', name: 'Berserker', role: 'Elite melee', size: 'L', verb: 'Grows faster as it takes damage', tell: 'Roar, and it glows hotter', counter: 'Burst it down, never chip it', status: 'draft', kind: 'berserker'},
      {id: 'orobas', name: 'Orobas', role: 'Elite ranged', size: 'L', verb: 'Sweeps a beam across the arena', tell: 'The beam line shows before it fires', counter: 'Jump the sweep', status: 'game', kind: 'orobas'},
    ],
    prince: {id: 'amon', name: 'Amon', role: 'Prince', size: 'Prince', verb: 'Jailer on the top block, beam sweeps', tell: 'Keys rattle as the yard floods', counter: 'Climb with the fire; the cells open on phase two', status: 'draft', kind: 'p-amon'},
  },
  {
    id: 'fraud', layer: 8, name: 'Fraud', sin: 'Fraud', move: 'Jetpack', arena: 'fraud',
    concept: 'A mirrored archive. Some floor tiles are false and drop away. Teleport doors pair up and swap partners each round.',
    elites: [
      {id: 'mimic', name: 'Mimic', role: 'Elite melee', size: 'S', verb: 'Poses as a mana orb or pickup, then bites', tell: 'The orb shimmers wrong and does not bob', counter: 'Shoot suspect orbs', status: 'draft', kind: 'mimic'},
      {id: 'liar', name: 'False prophet', role: 'Elite ranged', size: 'M', verb: 'Casts decoy copies of itself and fires from one', tell: 'Only the real one casts a shadow', counter: 'Find the shadow', status: 'draft', kind: 'liar'},
    ],
    prince: {id: 'quire', name: 'Quire, the clerk', role: 'Prince', size: 'Prince', verb: 'Writes clauses that rewrite the arena', tell: 'The quill scratches before a clause lands', counter: 'Read the contract; the mirrors become the real arena', status: 'draft', kind: 'p-quire'},
  },
  {
    id: 'treachery', layer: 9, name: 'Treachery', sin: 'Treachery', move: 'Ice slide', arena: 'treachery',
    concept: 'Cocytus: a frozen lake bowl. Ice keeps your momentum. Traitors are frozen into the lake and thaw. Frozen kills shatter.',
    elites: [
      {id: 'traitor', name: 'Traitor', role: 'Elite melee', size: 'M', verb: 'Frozen in the ice, thaws behind you', tell: 'Cracking ice', counter: 'Shatter the frozen ones before they thaw', status: 'draft', kind: 'traitor'},
      {id: 'lancer', name: 'Ice lancer', role: 'Elite ranged', size: 'M', verb: 'Throws freezing lances. A frozen player slides', tell: 'Frost breath', counter: 'Keep moving, and use the slide', status: 'draft', kind: 'lancer'},
    ],
    prince: {id: 'companion', name: 'The Companion', role: 'Prince', size: 'Prince', verb: 'Fights beside you, then turns', tell: 'It stops answering', counter: 'The lake cracks into floes; keep your footing', status: 'draft', kind: 'p-companion'},
  },
];

/** Every card id → its entry and where it lives. */
export function allCards() {
  const out = [];
  for (const p of PROTOTYPES) out.push({...p, group: 'proto', kind: 'proto'});
  for (const e of BASE) out.push({...e, group: 'base'});
  for (const b of BIOMES) {
    out.push({id: b.id, name: b.name, group: b.id, kind: 'biome', biome: b, status: 'draft'});
    for (const e of b.elites) out.push({...e, group: b.id});
    out.push({...b.prince, group: b.id});
  }
  return out;
}
