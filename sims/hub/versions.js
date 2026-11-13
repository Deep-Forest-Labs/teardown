// Enemy versions and tiers.
// Every enemy type has a history of checkpoints: v0, v1, ... A checkpoint is a frozen builder: once a version is
// listed here its builder is never edited again, so the team can roll back, compare, or fork (v1, v1b) when an idea
// does not work. New work goes in a new version. The drawer shows the latest; the main view lists every version.
//   v0  the first whitebox stand-ins (standins.js, frozen 2026-11-13)
//   v1  more developed rigs (enemies/*.js)
// Tiers: some types come in tiers that share one base behaviour with different numbers (swarmers: tier 1, 2, 3, as
// in the Unity prototype's swarm buckets). Nail tier 1 first, then branch out.
// Each version: {v, kind (a BUILD key), date, note, tiers?: [{tier, name, note}]}.

export const VERSIONS = {
  skull: [
    {v: 'v0', kind: 'swarm', date: '2026-11-13', note: 'A loose flock that streams at the player'},
    {
      v: 'v1',
      kind: 'swarmer',
      date: '2026-11-14',
      note: 'Tiered swarmer on one shared flock behaviour: separation, cohesion, a bite pause, and per-tier mechanics',
      tiers: [
        {tier: 1, name: 'Tier 1 · Skull', note: 'Fodder flock. Dies to one hit. No weak point: impostor-rendered in the game'},
        {tier: 2, name: 'Tier 2 · Shroud', note: 'Bigger, fewer. Rises (the tell) then swoops in a pair. No weak point'},
        {tier: 3, name: 'Tier 3 · Matron', note: 'Heavy and slow. Drops grubs that land and crawl; its cocoon belly is the weak point'},
      ],
    },
    {
      v: 'v2',
      kind: 'skull2',
      date: '2026-11-13',
      note: 'Model-first tier 1: a pure function of time and target. The flock mills on a twisted torus round you (the fish-school vacuole); one skull at a time peels off, cuts through the hole to bite, and rejoins its own slot',
      tiers: [{tier: 1, name: 'Tier 1 · Skull', note: 'Mill, tell (jaw chatter speeds up), strike through the hole. One bite every 0.32 s at most. No weak point'}],
    },
  ],
  worm: [
    // v0 was the ground-crawling BONEPEDE sketch (its own prototype page); the flying rig is the first in the sandbox
    {v: 'v1', kind: 'wyrm', date: '2026-11-13', note: 'BONEPEDE II: flies on its trail, belly weak points, chases, coils and strikes'},
  ],
  gilded: [
    {v: 'v0', kind: 'gilded', date: '2026-11-13', note: 'The Gilded skull prototype rig: volley, vent, plates'},
  ],
};

/** The versions of an enemy (a v0 of its current kind when it has no history yet). */
export const versionsOf = (card) => VERSIONS[card.id] || [{v: 'v0', kind: card.kind, date: '2026-11-13', note: 'First whitebox stand-in'}];
export const latestOf = (card) => versionsOf(card).at(-1);

/** Hash ids: `skull`, `skull-v0`, `skull-v1-t2`. */
export function parseId(raw) {
  const m = /^(.*?)(?:-(v\d+[a-z]?))?(?:-t(\d))?$/.exec(raw);
  return {id: m[1], v: m[2] || null, tier: m[3] ? Number(m[3]) : null};
}
