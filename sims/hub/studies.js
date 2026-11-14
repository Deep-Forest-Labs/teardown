// The Studies page: what each study film is built on, and the elements in it worth lifting into a stage or an enemy.
// The elements are a starting point for discussion, not decisions. Ids match FILMS in roster.js.

export const STUDY_NOTES = {
  // stages
  'film-altar': {
    machine: 'The Olivier drum revolve (National Theatre): a drum turning, two elevator decks, a top half disc.',
    elements: ['Two decks that sink and rise inside a turning drum: a floor that reconfigures under the player', 'Counterweights you can see riding in the wall', 'One turning ring carrying everything else'],
  },
  'film-void-study': {
    machine: 'The Arecibo telescope: a 305 m spherical dish, a platform hung by cables from three towers, a turning arm and dome, tie-downs.',
    elements: ['Tiers taken from the dish’s own curve: the steps come out at 4 m and 8 m on their own', 'Belphegor as a platform hanging on cables from three towers', 'The feed beam through the sphere centre as the sleep beam: its reach is fixed by the 20° arm', 'Tie-down cables that reel outer platforms up into ramps', 'The 2020 collapse: the platform falling through the dish as phase 2'],
  },
  'film-ruins-study': {
    machine: 'Fontana’s move of the Vatican obelisk (1586): a timber castello, capstans, ropes, a sledge on rollers, an earth causeway.',
    elements: ['Pillars lowered on ropes onto the gallery edge as 34° ramps', 'The timber tower round Belial: a cage he stands in', 'Rollers running at half the load’s speed, carried round from back to front', 'Slabs dropping behind the rig, never under it'],
  },
  'film-gluttony-study': {
    machine: 'A country grain elevator: piles at the angle of repose, a bucket elevator leg, a turning distributor, bins.',
    elements: ['Fly mounds as true repose cones (27°): they shrink exactly by what leaves them', 'A cyclone swarm round a head house on a tall leg', 'The distributor spout swinging to each bin in turn: the tell for which tower grows next', 'Towers that fill to double-jump heights (h = V/πr²), with the total volume conserved'],
  },
  'film-greed-study': {
    machine: 'The Lynton & Lynmouth water-balance cliff railway: two cars on one cable, the top car takes on water and runs down.',
    elements: ['Lift pairs whose heights always sum to the same total: readable, predictable timing', 'Water ballast filling as the tell before a pair moves', 'One central headframe carrying every cable', 'Lock heights that climb both ways round the ring to the top lift', 'Mammon as the water tower feeding the cars, his tank the heart'],
  },
  'film-lust-study': {
    machine: 'Calatrava’s Burke Brise Soleil (Milwaukee Art Museum): steel blades on hinges, each swung by a hydraulic cylinder.',
    elements: ['A bud that opens into six high platforms', 'Each petal on its own cylinder, so it can stop at any angle', 'Petal tips set at staggered angles as a spiral staircase to the bloom', 'Lilith rising on the central ram', 'Fans at the foot of the updraft columns'],
  },
  'film-wrath-study': {
    machine: 'The Panama Canal locks: a chamber filled and drained through culverts, mitre gates, locomotives on rack inclines.',
    elements: ['The fire as a lock’s fill: fast at first, then slowing (Torricelli), so the waves have a natural rhythm', 'Mitre gates meeting mid-yard with walkways on top', 'Amon as the towing locomotive climbing the rack incline', 'Galleries cantilevered off the cell-block walls'],
  },
  'film-fraud-study': {
    machine: 'Tower Bridge: two counterweighted bascule leaves on trunnions, turned by pinions on toothed quadrants.',
    elements: ['The mirror walls as raised bascule leaves', 'Leaves lowered past level onto the floor as ramps, then raised to meet mid-room as the new floor', 'Trapdoor tiles dropped in an order that always leaves one connected floor', 'Towers and high walkways framing the room'],
  },
  'film-treachery-study': {
    machine: 'The Finnish ice carousel: a disc cut out of a frozen lake and turned on the water by outboard motors.',
    elements: ['A lake already cut into rings, with the seams shut until phase 2', 'Floes at true freeboard: 8.3 cm of a 1 m slab shows', 'Rings drifting out by their own number of gaps and counter-turning', 'Motors set in the cuts', 'Dives that hold a floe under against its buoyancy'],
  },
  'film-falkirk': {machine: 'The Falkirk Wheel: the first reference study, where one input drives everything.', elements: ['Gondolas kept level by a fixed gear train while the wheel turns']},
  // enemies
  'film-leviathan': {machine: 'Pelagos OC-8 from the teardown repo, turned over: the arms lie flat as the floor, plates between them, the mantle as the dome.', elements: ['Arms whose curl comes from one shrinking-segment rule', 'Plates riding the arm segments as the arena floor']},
  'film-mite': {machine: 'The teardown repo’s Mellis HB-7 flapping-wing drone.', elements: []},
  'film-puffer': {machine: 'Radial lazy-tong (scissor) actuators and a sphere split on the faces of a dodecahedron.', elements: []},
  'film-scorpion': {machine: 'The teardown repo’s Telson SC-8 robotic scorpion.', elements: []},
  'film-spawner': {machine: 'Jansen’s linkage, a Geneva drive indexing a rotary airlock, a bellows on the same shaft.', elements: []},
  'film-quadruped': {machine: 'Real legged robots (Boston Dynamics Spot proportions).', elements: []},
  'film-shooter': {machine: 'The Gatling gun (a cam track cycling six barrels) and plain ballistics.', elements: []},
  'film-spider': {machine: 'Joe Klann’s walking linkage (US patent 6,260,862).', elements: []},
  'film-censer': {machine: 'The Whitworth quick-return mechanism.', elements: []},
  'film-diver': {machine: 'The F-14’s variable-sweep wing on a screw jack.', elements: []},
  'film-percher': {machine: 'Bird-inspired perching graspers (Stanford’s SNAG).', elements: []},
  'film-floater': {machine: 'The rigid airship: ring frames, a ballonet, the USS Macon’s trapeze.', elements: []},
  'film-sentinel': {machine: 'Heavy humanoid walkers (Atlas proportions).', elements: []},
  'film-zealot': {machine: 'The umbrella mechanism and the kiwi omni drive.', elements: []},
  'film-maggot': {machine: 'Peristaltic crawling (earthworms, MIT’s Meshworm) and telescopic stages.', elements: []},
  'film-bloater': {machine: 'The peristaltic roller pump.', elements: []},
  'film-imp': {machine: 'Whegs (Case Western, RHex) and the lazy-tong grabber.', elements: []},
  'film-gild': {machine: 'The orange-peel grab and a pitching-machine coin launcher.', elements: []},
  'film-twins': {machine: 'The open differential.', elements: []},
  'film-siren': {machine: 'The mechanical siren with a level-wind.', elements: []},
  'film-berserker': {machine: 'Watt’s centrifugal governor.', elements: []},
  'film-orobas': {machine: 'The lighthouse optic: a rotating Fresnel lens on weight-driven clockwork.', elements: []},
  'film-mimic': {machine: 'The crank-rocker four-bar (Grashof).', elements: []},
  'film-liar': {machine: 'Plane-mirror reflection (Pepper’s ghost).', elements: []},
  'film-traitor': {machine: 'The Miura-ori rigid fold.', elements: []},
  'film-lancer': {machine: 'The cranequin and the ballista’s torsion arms.', elements: []},
};
