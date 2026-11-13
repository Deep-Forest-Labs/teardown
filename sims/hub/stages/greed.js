// Greed and Mammon, drawn from greed.kin.js. Static: the vault floor and the two terraces (they plate in gold and
// burn in phase two). From the model: the twelve-plus counterweighted lifts and their cables and pulley, Mammon
// (bust, crown, arms solved to his targets, hands), the hoard and his heart, the orbs (carried in his hands).
import * as THREE from 'three';
import {M, mat} from '../fights.js';
import {checks, layout, model, SPEC, STATES} from './greed.kin.js';
import {stageFight, stageShell} from './shell.js';

export function greedStage(g, scale = 1) {
  const mats = {
    lift: mat('#b59b17', {emissive: new THREE.Color('#b59b17'), emissiveIntensity: 0.25}),
    cable: mat('#2a2430'),
    pulley: mat('#8f8578', {metalness: 0.5}),
    gold: mat('#c9a227', {metalness: 0.5, roughness: 0.45}),
    goldDark: mat('#8a6a17', {metalness: 0.4, roughness: 0.55}),
    eyes: mat('#ff6a3a', {emissive: new THREE.Color('#ff3a1c'), emissiveIntensity: 0.8}),
    hoard: mat('#d6b44a', {metalness: 0.5}),
    orb: mat('#8fd4ff', {emissive: new THREE.Color('#8fd4ff'), emissiveIntensity: 0.7}),
  };
  const sh = stageShell(g, {mats, weakCount: 2, weakR: 1.1});
  const {K} = sh;
  const L = layout(scale);
  const floorMat = mat('#5d5a63');
  const terraceMat = mat('#7d6324');
  const base = {floor: new THREE.Color('#5d5a63'), terrace: new THREE.Color('#7d6324'), gold: new THREE.Color('#e0b43a')};
  const floor = K.add(new THREE.CylinderGeometry(L.floorR, L.floorR, 1, 10), floorMat, [0, -0.5, 0]);
  const apron = K.ring(L.floorR - 0.01, L.t1[0], 0.01, floorMat, -0.01);
  const t1 = K.ring(L.t1[0], L.t1[1], SPEC.t1.top, terraceMat, 0);
  const t2 = K.ring(L.t2[0], L.t2[1], SPEC.t2.top, terraceMat, 0);
  const pit = K.ring(L.t1[1], L.t2[0], 0.2, mat('#1a1216'), -6); // the lift shaft bottom
  for (const [x, z] of [[1, 1], [-1, -1]]) K.tag(K.add(new THREE.CylinderGeometry(0.9, 0.9, 0.25, 12), M.pad, [x * L.floorR * 0.5, 0.12, z * L.floorR * 0.5]), 'pad');
  let last = model(0, 0, scale);
  const subsystems = sh.subsystems([
    {id: 'mammon', name: 'Mammon', note: '44 m bust beyond the north rim', keys: ['gold', 'goldDark', 'eyes'], state: () => (last.info.arrive < 0.02 ? 'BELOW' : last.info.lean > 0.5 ? 'LEANING IN' : 'RISEN')},
    {id: 'hoard', name: 'Hoard · weak point', note: 'his hands fill it with your orbs', keys: ['hoard'], state: () => `${last.info.stolen} / ${SPEC.orbs} ORBS`},
    {id: 'heart', name: 'Heart · weak point', note: 'an air-dash from the top lift in phase two', keys: [], state: () => (last.info.lean > 0.9 ? 'OPEN' : 'OUT OF REACH')},
    {id: 'lifts', name: `Lifts ×${L.lifts}`, note: 'counterweighted pairs; lock into a spiral', keys: ['lift'], state: () => (last.info.gold > 0.99 ? 'LOCKED' : 'CYCLING')},
    {id: 'cables', name: 'Cables and pulley', note: 'one cable per pair', keys: ['cable', 'pulley'], state: () => (last.info.gold > 0.05 ? 'CUT' : 'RUNNING')},
    {id: 'orbs', name: `Mana orbs ×${SPEC.orbs}`, note: 'on the north terraces', keys: ['orb'], state: () => `${SPEC.orbs - last.info.stolen} LEFT`},
    {id: 'floor', name: 'Floor and terraces', note: 'plate in gold in phase two', objs: [floor, apron, t1, t2, pit], state: () => (last.info.gold > 0.95 ? 'GOLD · BURNS' : 'STONE')},
  ]);
  return stageFight({
    states: STATES,
    scale,
    model,
    checks,
    extra: {
      spawn: [0, 0.5, L.floorR * 0.6],
      killY: -25,
      cam: {target: [0, 8, L.north * 0.35], az: 24, el: 26, dist: L.t2[1] * 2.6 + 40},
      subsystems,
      readout: () => [
        ['ATTACK', last.info.steal > 0 && last.info.steal < 1 ? 'Stealing the orbs' : last.info.gold > 0.95 ? 'The floor burns' : 'None'],
        ['STOLEN', `${last.info.stolen} / ${SPEC.orbs}`],
        ['LIFTS', last.info.gold > 0.99 ? 'Locked spiral' : 'Counterweighted'],
      ],
      update(ctx, s) {
        last = model(s, ctx.t, scale);
        for (const o of last.orbs) if (o.visible) last.balls.push({k: 'orb', p: o.p, r: 0.45});
        sh.draw(last, ctx);
        const k = last.info.gold;
        floorMat.color.copy(base.floor).lerp(base.gold, k);
        terraceMat.color.copy(base.terrace).lerp(base.gold, k);
        floorMat.emissive.copy(base.gold).multiplyScalar(k * 0.25);
        terraceMat.emissive.copy(base.gold).multiplyScalar(k * 0.25);
        const tag = k > 0.95 ? 'hazard' : undefined;
        for (const m of [floor, apron, t1, t2]) m.userData.tag = tag;
        if (ctx.hunt && s >= 1 && ctx.ringTimer(4)) {
          // coin rain from his eyes toward the player
          const from = new THREE.Vector3(0, last.heart[1] + 18, last.heart[2]);
          for (let j = -2; j <= 2; j++) {
            const d = ctx.player.pos.clone().sub(from).normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), j * 0.06);
            ctx.shots.fire('coin', from, d.multiplyScalar(26), {gravity: 6, life: 4});
          }
        }
      },
    },
  });
}
