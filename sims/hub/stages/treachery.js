// Treachery and the Companion, drawn from treachery.kin.js. Static: the bowl and the black water. Each floe is its
// own mesh (a ring sector cut from the lake, shut at first); the model moves them. From the model: the Companion's
// spine of rings, its head and face.
import * as THREE from 'three';
import {mat} from '../fights.js';
import {checks, layout, model, SPEC, STATES} from './treachery.kin.js';
import {stageFight, stageShell} from './shell.js';

export function treacheryStage(g, scale = 1) {
  const mats = {
    ghost: mat('#dfe6ee', {transparent: true, opacity: 0.7, emissive: new THREE.Color('#9fb8cc'), emissiveIntensity: 0.35}),
    face: mat('#1a1d24'),
  };
  const sh = stageShell(g, {mats, weakCount: 1, weakR: 1});
  const {K} = sh;
  const L = layout(scale);
  const bowlPts = [new THREE.Vector2(0, -4), new THREE.Vector2(L.flatR, -4)];
  for (let k = 1; k <= 10; k++) bowlPts.push(new THREE.Vector2(L.flatR + (k / 10) * (L.rimR - L.flatR), -4 + Math.pow(k / 10, 2) * (SPEC.bowlH + 4)));
  const bowl = K.add(new THREE.LatheGeometry(bowlPts, 64), mat('#c8d6e2', {side: THREE.DoubleSide}), [0, 0, 0]);
  const water = K.tag(K.add(new THREE.CylinderGeometry(L.flatR + 0.5, L.flatR + 0.5, 0.2, 64), mat('#1d2a36', {roughness: 0.2}), [0, SPEC.water, 0]), 'nocollide');
  const iceMat = mat('#9fb8cc', {metalness: 0.2, roughness: 0.15});
  let last = model(0, 0, scale);
  const floeMeshes = last.floes.map((F) => {
    const sh2 = new THREE.Shape();
    if (F.ring === 0) sh2.absarc(0, 0, F.r1, 0, Math.PI * 2, false);
    else {
      sh2.absarc(0, 0, F.r1, F.a0, F.a1, false);
      sh2.absarc(0, 0, F.r0, F.a1, F.a0, true);
    }
    const geo = new THREE.ExtrudeGeometry(sh2, {depth: 0.6, bevelEnabled: false, curveSegments: 24});
    geo.rotateX(Math.PI / 2); // shape (x, y) → world (x, z); extruded downward from y = 0
    const m = new THREE.Mesh(geo, iceMat);
    m.userData.tag = 'ice';
    g.add(m);
    return m;
  });
  const subsystems = sh.subsystems([
    {id: 'comp', name: 'The Companion', note: '34 m wraith of stacked rings', keys: ['ghost', 'face'], state: () => (last.info.form < 0.02 ? 'NOT YET' : last.info.p2 > 0.5 ? (last.info.dive > 0.5 ? 'DIVING' : 'TURNED') : 'BESIDE YOU')},
    {id: 'heart', name: 'Heart · weak point', note: 'shows only while it dives', keys: [], state: () => (last.info.dive > 0.5 ? 'OPEN' : 'HIDDEN')},
    {id: 'floes', name: `Floes ×${last.floes.length}`, note: 'the lake, cut on its seams; drift in phase two', objs: floeMeshes, state: () => (last.info.drift > 0.99 ? 'DRIFTING' : last.info.drift > 0 ? 'BREAKING' : 'WHOLE')},
    {id: 'bowl', name: 'Bowl and black water', note: 'the water kills', objs: [bowl, water], state: () => '-'},
  ]);
  return stageFight({
    states: STATES,
    scale,
    model,
    checks,
    extra: {
      spawn: [0, 0.5, L.radii[0] * 0.5],
      killY: -3,
      cam: {target: [0, 5, 0], az: 30, el: 28, dist: L.rimR * 2.2 + 20},
      subsystems,
      readout: () => [
        ['ATTACK', last.info.dive > 0.5 ? 'Pushing a floe under' : last.info.p2 > 0.5 ? 'Turned' : last.info.form > 0.9 ? 'Fights beside you' : 'None'],
        ['LAKE', last.info.drift > 0.99 ? 'Floes adrift' : 'Whole'],
      ],
      update(ctx, s) {
        last = model(s, ctx.t, scale);
        sh.draw(last, ctx);
        last.floes.forEach((F, i) => {
          const m = floeMeshes[i];
          m.rotation.y = -F.spin;
          m.position.set(F.off[0], 0.05 + F.off[1], F.off[2]);
          m.userData.tag = F.top < -0.2 ? 'nocollide' : 'ice';
        });
        if (ctx.hunt && ctx.player.pos.y < -0.8) ctx.hurt('cold');
      },
    },
  });
}
