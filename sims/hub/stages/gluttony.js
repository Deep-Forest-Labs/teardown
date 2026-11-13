// Gluttony and Beelzebub, drawn from gluttony.kin.js. Static: the flesh bowl. From the model: the bile (rises in
// phase two and burns once it has), the seven mounds that become towers, the swarm (its fly count follows its
// mass), the core. Some flies peel off the swarm at the player while it hunts.
import * as THREE from 'three';
import {mat} from '../fights.js';
import {checks, model, SPEC, STATES} from './gluttony.kin.js';
import {stageFight, stageShell} from './shell.js';

const MAX_FLIES = 2400;

export function gluttonyStage(g, scale = 1) {
  const mats = {mound: mat('#8c3a33'), core: mat('#5a2a26', {emissive: new THREE.Color('#7a1a12'), emissiveIntensity: 0.3})};
  const sh = stageShell(g, {mats, weakCount: 1, weakR: 1.6});
  const {K} = sh;
  const R = SPEC.bowlR * scale;
  const pts = [];
  for (let k = 0; k <= 14; k++) pts.push(new THREE.Vector2((k / 14) * R, Math.pow(k / 14, 3) * 11));
  K.add(new THREE.LatheGeometry(pts, 56), mat('#7a2e2a', {side: THREE.DoubleSide}), [0, -0.3, 0]);
  const bileMat = mat('#8a5a1a', {emissive: new THREE.Color('#8a5a1a'), emissiveIntensity: 0.2});
  const bile = K.tag(K.add(new THREE.CylinderGeometry(R * 0.86, R * 0.86, 0.2, 56), bileMat, [0, SPEC.bileY, 0]), 'slow');
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2 + 0.3;
    K.tag(K.add(new THREE.CylinderGeometry(0.9, 0.9, 0.25, 12), mat('#d9660b', {emissive: new THREE.Color('#d9660b'), emissiveIntensity: 0.4}), [Math.sin(a) * R * 0.8, 4.4, Math.cos(a) * R * 0.8]), 'pad');
  }
  const flies = new THREE.InstancedMesh(new THREE.BoxGeometry(0.42, 0.22, 0.55), mat('#2a1c20'), MAX_FLIES);
  flies.frustumCulled = false;
  flies.castShadow = true;
  g.add(flies);
  const M4 = new THREE.Matrix4();
  const Q = new THREE.Quaternion();
  const E = new THREE.Euler();
  const P = new THREE.Vector3();
  const S1 = new THREE.Vector3(1, 1, 1);
  let last = model(0, 0, scale);
  let biteT = 0;
  const subsystems = sh.subsystems([
    {id: 'swarm', name: 'The swarm', note: 'its count is its mass', objs: [flies], state: () => `${last.info.flies} FLIES`},
    {id: 'core', name: 'Core · weak point', note: 'exposed as the swarm thins', keys: ['core'], state: () => (last.info.exposed > 0.9 ? 'EXPOSED' : last.core.visible ? 'HIDDEN' : '-')},
    {id: 'towers', name: 'Mounds → towers ×7', note: 'a climbing spiral in phase two', keys: ['mound'], state: () => `${last.towers[last.towers.length - 1].h.toFixed(1)} M TOP`},
    {id: 'bile', name: 'Bile', note: 'slows; rises and burns in phase two', objs: [bile], state: () => `${last.bileY.toFixed(1)} M`},
  ]);
  return stageFight({
    states: STATES,
    scale,
    model,
    checks,
    extra: {
      spawn: [0, 1, R * 0.5],
      killY: -25,
      cam: {target: [0, 8, 0], az: 34, el: 28, dist: R * 2.4 + 30},
      subsystems,
      readout: () => [
        ['SWARM', `${Math.round(last.info.swarmShare * 100)} % of its peak`],
        ['MASS', `${last.mass.total.toFixed(0)} m³ conserved`],
        ['BILE', `${last.bileY.toFixed(1)} m`],
      ],
      update(ctx, s) {
        const t = ctx.t;
        last = model(s, t, scale);
        sh.draw(last, ctx);
        bile.position.y = last.bileY;
        bile.userData.tag = last.info.eat > 0.6 ? 'hazard' : 'slow';
        bileMat.emissiveIntensity = 0.2 + last.info.eat * 0.4;
        // flies on a golden spiral round the swarm centre, turning; a share peels toward the player
        const n = Math.min(MAX_FLIES, last.info.flies);
        const c = last.swarm.c;
        const hunt = ctx.hunt && ctx.player.on && s >= 1 && s < 2;
        for (let i = 0; i < MAX_FLIES; i++) {
          if (i >= n) {
            M4.makeScale(0, 0, 0);
            flies.setMatrixAt(i, M4);
            continue;
          }
          const y = 1 - (2 * (i + 0.5)) / n;
          const rr = Math.sqrt(1 - y * y) * last.swarm.r * (1 + 0.15 * Math.sin(t * 0.7 + i));
          const a = i * 2.399963 + t * (0.4 + (i % 7) * 0.04);
          P.set(c[0] + Math.cos(a) * rr, c[1] + y * last.swarm.r, c[2] + Math.sin(a) * rr);
          if (hunt && i % 9 === 0) P.lerp(ctx.player.pos.clone().setY(ctx.player.pos.y + 1), 0.35 + 0.25 * Math.sin(t + i));
          E.set(0, -a, 0);
          M4.compose(P, Q.setFromEuler(E), S1);
          flies.setMatrixAt(i, M4);
        }
        flies.instanceMatrix.needsUpdate = true;
        biteT -= ctx.dt;
        if (hunt && biteT <= 0 && n > 0 && ctx.player.pos.distanceTo(new THREE.Vector3(...c)) < last.swarm.r + 6) {
          ctx.hurt('flies');
          biteT = 1.2;
        }
      },
    },
  });
}
