// Auto move and auto shoot for the Bestiary player in Hunt and Phases: the Chopping Block's expert player
// (../cb-shared/bot.js) driving this stage's player. Two separate switches:
//   auto move   the bot's strafe, kite and hop drive the player (WASD still works when it is off)
//   auto shoot  the bot's target pick, 20 rad/s hand and firing cone, with the study's guns: a stream of shards
//               (120 m/s, 0.34 s, so about 40 m of reach) and a shotgun burst inside 12 m. The gun's tier climbs with
//               the horde's wave like the power curve does in a run: rapid 20, 40, 80, 107 a second; shotgun 10, 20,
//               40, 60 shards.
// Shots hit the horde (hit points) and flash on anything else they meet.
import * as THREE from 'three';
import {BOT, botHop, botMove, botSlew, botTarget, newBot} from '../cb-shared/bot.js';

const TIERS = {rapid: [20, 40, 80, 106.666], shotgun: [10, 20, 40, 60]};
const SPREAD = (2.5 * Math.PI) / 180;
const MAXSH = 600;
const EYE = 1.6;
const rnd = (n) => {
  const s = Math.sin(n * 12.9898) * 43758.5453;
  return s - Math.floor(s);
};

export function createAutoplay(parent) {
  const bot = newBot();
  const shards = [];
  const mesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.05, 0.05, 1.6, 5).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({color: '#ffd27a'}), MAXSH);
  mesh.frustumCulled = false;
  mesh.count = 0;
  parent.add(mesh);
  const M4 = new THREE.Matrix4();
  const Q = new THREE.Quaternion();
  const Z = new THREE.Vector3(0, 0, 1);
  const D = new THREE.Vector3();
  const P = new THREE.Vector3();
  const ONE = new THREE.Vector3(1, 1, 1);
  let cool = 0;
  let shotCool = 0;
  let n = 0;
  let fired = 0;

  return {
    stats: () => ({fired}),
    /**
     * w: {dt, t, player (hub player state), move, shoot, horde (or null), floorR, threats: [{p}]}
     * Sets player.autoMove / player.autoJump for the player's own update to use.
     */
    update(w) {
      const {dt, t, player} = w;
      const pp = player.pos;
      const feet = [pp.x, pp.y, pp.z];
      const tg = w.horde ? w.horde.targets() : {censers: [], agents: []};
      // move
      if (w.move && player.on) {
        const [mx, mz] = botMove(bot, {p: feet, t, dt, floorR: w.floorR, censers: tg.censers, threats: w.threats, agents: tg.agents});
        player.autoMove = new THREE.Vector3(mx, 0, mz);
        player.autoJump = botHop(bot, feet, tg.agents, player.grounded, player.vel.y, player.jumps < 2);
      } else {
        player.autoMove = null;
        player.autoJump = false;
      }
      // shoot
      cool -= dt;
      shotCool -= dt;
      if (w.shoot && player.on) {
        const tier = Math.max(1, Math.min(4, 1 + Math.floor(((w.horde?.counts().wave || 1) - 1) / 3)));
        const eye = [pp.x, pp.y + EYE, pp.z];
        const pick = botTarget({eye, censers: tg.censers, agents: tg.agents, extra: [...(tg.extra || []), ...(w.extra || [])]});
        if (pick) {
          const {dir, on} = botSlew(bot, pick.aim, dt);
          if (on && pick.dist < BOT.shotgunIn) {
            if (shotCool <= 0) {
              shotCool = 0.35;
              const fresh = pick.aim.map((x) => x / (Math.hypot(...pick.aim) || 1));
              for (let k = 0; k < TIERS.shotgun[tier - 1]; k++) {
                const j = (q) => (rnd(n++ * 13 + q) - 0.5) * 0.14;
                shards.push({p: [...eye], d: [fresh[0] + j(1), fresh[1] + j(2), fresh[2] + j(3)], t});
              }
              fired++;
            }
          } else if (on) {
            const rate = TIERS.rapid[tier - 1];
            if (cool < -0.1) cool = 0;
            while (cool <= 0) {
              cool += 1 / rate;
              const j = (q) => (rnd(n++ * 11 + q) - 0.5) * SPREAD;
              shards.push({p: [...eye], d: [dir[0] + j(1), dir[1] + j(2), dir[2] + j(3)], t});
              fired++;
            }
          }
        }
      }
      if (cool < 0) cool = 0;
      // fly the shards; the first body each step passes through takes it
      let j = 0;
      for (const s of shards) {
        const q = [...s.p];
        const l = Math.hypot(...s.d) || 1;
        for (let k = 0; k < 3; k++) s.p[k] += (s.d[k] / l) * BOT.shardSpeed * dt;
        const hit = w.horde?.hit(q, s.p, 1);
        if (!hit && t - s.t < BOT.shardLife) shards[j++] = s;
      }
      shards.length = j;
      // draw
      const cnt = Math.min(shards.length, MAXSH);
      for (let i = 0; i < cnt; i++) {
        const s = shards[i];
        D.set(...s.d).normalize();
        Q.setFromUnitVectors(Z, D);
        M4.compose(P.set(...s.p), Q, ONE);
        mesh.setMatrixAt(i, M4);
      }
      mesh.count = cnt;
      mesh.instanceMatrix.needsUpdate = true;
    },
  };
}
