// Swarm skull v2 tier 1, drawn from skull.kin.js. The builder keeps only one piece of state, the flock's centre: it
// trails the player (or sits at home when wandering) so the ring lags behind a player who runs, and a player who
// keeps moving drags the hole with them while the strikes land behind. Everything else is the pure model.
import * as THREE from 'three';
import {createRig} from '../stages/rig.js';
import {drawList, model, SPEC} from './skull.kin.js';

const mat = (c, extra = {}) => new THREE.MeshStandardMaterial({color: c, roughness: 0.85, flatShading: true, ...extra});

export function buildSkull2(g, K) {
  g.position.set(0, 0, 0); // the flock lives in world space
  const rig = createRig(g, {bone: mat('#d8cfc0'), socket: mat('#1a1214')}, SPEC.n * 4 + 8);
  const centre = K.home.clone();
  let biteT = 0;
  let t = 0;
  return (ctx) => {
    t += ctx.dt * ctx.speedMul;
    const hunt = ctx.hunt && ctx.player.on;
    const want = hunt ? ctx.player.pos : K.home;
    // the centre trails its target at most 6 m/s: run and the hole lags, stop and it closes round you
    const step = want.clone().sub(centre);
    const max = 6 * ctx.dt * ctx.speedMul;
    if (step.length() > max) step.setLength(max);
    centre.add(step);
    const gy = ctx.ground(centre.x, centre.z, centre.y + 2);
    const P = [centre.x, gy ?? centre.y, centre.z];
    const m = model(t, P);
    rig.draw(drawList(m));
    biteT -= ctx.dt;
    if (hunt && biteT <= 0 && m.biting.length) {
      const b = new THREE.Vector3(...m.skulls[m.biting[0]].p);
      if (b.distanceTo(ctx.player.pos.clone().setY(ctx.player.pos.y + SPEC.biteY)) < SPEC.biteR) {
        ctx.hurt('bite');
        biteT = 0.8;
      }
    }
  };
}
