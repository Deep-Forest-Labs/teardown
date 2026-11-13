// Wrath and Amon, drawn from wrath.kin.js. Static: the yard floor, the stepped east and west cell blocks, the north
// block he climbs onto, the fire sheet (its height comes from the model). From the model: Amon (torso, head, horns,
// arms solved to the block's edge), his eye beam, the six tier-two cell doors that fall as drawbridges.
import * as THREE from 'three';
import {M, mat} from '../fights.js';
import {checks, layout, model, SPEC, STATES} from './wrath.kin.js';
import {stageFight, stageShell} from './shell.js';

export function wrathStage(g, scale = 1) {
  const mats = {
    door: mat('#6b4a32'),
    colossus: mat('#5a4f4a'),
    colossusDark: mat('#2b2422'),
    beam: new THREE.MeshBasicMaterial({color: '#ff5a2a', transparent: true, opacity: 0.8}),
  };
  const sh = stageShell(g, {mats, weakCount: 2, weakR: 0.7});
  const {K} = sh;
  const L = layout(scale);
  const outer = L.faces[2] + SPEC.tiers[2].w;
  const floor = K.add(new THREE.BoxGeometry(outer * 2, 1, L.depth), M.stone, [0, -0.5, 0]);
  const blockMat = mat('#4d4650');
  const blocks = [];
  for (const sx of [-1, 1]) {
    SPEC.tiers.forEach((T, k) => {
      const w = outer - L.faces[k];
      blocks.push(K.add(new THREE.BoxGeometry(w, T.h, L.depth), blockMat, [sx * (L.faces[k] + w / 2), T.h / 2, 0]));
    });
  }
  const NB = SPEC.northBlock;
  const north = K.add(new THREE.BoxGeometry(NB.w, NB.h, NB.d), blockMat, [0, NB.h / 2, L.north]);
  // the fire: one sheet across the whole yard; the model sets its height
  const fireMat = new THREE.MeshBasicMaterial({color: '#ff6a1c', transparent: true, opacity: 0.55, depthWrite: false});
  const fire = K.tag(K.add(new THREE.BoxGeometry(outer * 2, 0.3, L.depth), fireMat, [0, 0, 0]), 'nocollide');
  let last = model(0, 0, scale);
  const subsystems = sh.subsystems([
    {id: 'amon', name: 'Amon', note: '36 m jailer on the north block', keys: ['colossus', 'colossusDark'], state: () => (last.info.arrive < 0.02 ? 'BEHIND THE WALL' : last.info.arrive < 0.99 ? 'CLIMBING' : 'ON THE BLOCK')},
    {id: 'eyes', name: 'Eyes · weak points', note: 'open while he beams', keys: [], state: () => (last.info.beamOn ? 'OPEN' : 'SHUT')},
    {id: 'beam', name: 'Eye beam', note: 'sweeps the yard from phase one', keys: ['beam'], state: () => (last.info.beamOn ? 'SWEEPING' : 'COOLING')},
    {id: 'doors', name: `Cell doors ×${SPEC.doors * 2}`, note: 'tier two; fall as drawbridges that meet mid-yard', keys: ['door'], state: () => (last.info.doorsDown > 0.99 ? 'BRIDGES' : last.info.doorsDown > 0 ? 'FALLING' : 'SHUT')},
    {id: 'fire', name: 'Fire', note: `waves; floods to ${SPEC.floodY} m in phase two`, objs: [fire], state: () => `${last.fireY.toFixed(1)} M`},
    {id: 'blocks', name: 'Cell blocks', note: `three tiers, ${SPEC.tiers.map((T) => T.h).join(' / ')} m`, objs: [...blocks, north, floor], state: () => '-'},
  ]);
  return stageFight({
    states: STATES,
    scale,
    model,
    checks,
    extra: {
      spawn: [0, 0.5, L.depth * 0.3],
      killY: -25,
      cam: {target: [0, 6, L.north * 0.3], az: 28, el: 26, dist: outer * 2.4 + 30},
      subsystems,
      readout: () => [
        ['ATTACK', last.info.beamOn ? 'Eye beam sweep' : last.info.p2 > 0.95 ? 'The yard is flooded' : 'Fire waves'],
        ['FIRE', `${last.fireY.toFixed(1)} m`],
        ['DOORS', last.info.doorsDown > 0.99 ? 'Bridges across the flood' : 'Shut'],
      ],
      update(ctx, s) {
        last = model(s, ctx.t, scale);
        sh.draw(last, ctx);
        fire.position.y = last.fireY - 0.15;
        fireMat.opacity = 0.45 + 0.15 * Math.sin(ctx.t * 6);
        if (!ctx.hunt) return;
        const p = ctx.player.pos;
        // the fire burns anyone below its surface who is not on a tier or a bridge
        if (p.y < last.fireY - 0.2) ctx.hurt('fire');
        if (last.beam.on) {
          const o = new THREE.Vector3(...last.beam.from);
          const d = new THREE.Vector3(...last.beam.dir);
          const along = p.clone().sub(o).dot(d);
          if (along > 0 && p.clone().sub(o).sub(d.multiplyScalar(along)).length() < 1.6) ctx.hurt('beam');
        }
      },
    },
  });
}
