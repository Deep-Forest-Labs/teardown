// The Ruins and Belial, drawn from ruins.kin.js. Static: the courtyard, its cracked slam tiles, the gallery's posts
// and slabs (slabs drop when the model says they crumble), corner pads. From the model: the four pillars (standing,
// falling, resting as ramps), the throne, Belial (legs by two-bone IK on planted feet), the chains, the shield.
import * as THREE from 'three';
import {M, mat} from '../fights.js';
import {checks, layout, model, SPEC, STATES} from './ruins.kin.js';
import {stageFight, stageShell} from './shell.js';

export function ruinsStage(g, scale = 1) {
  const mats = {
    pillar: mat('#6f6b75'),
    throne: mat('#4a4750'),
    colossus: mat('#a69c90'),
    colossusDark: mat('#4a3f47'),
    gold: mat('#c9a227', {metalness: 0.5, roughness: 0.45}),
    chain: mat('#e8d27a', {emissive: new THREE.Color('#e8d27a'), emissiveIntensity: 0.4}),
  };
  const sh = stageShell(g, {mats, weakCount: 5, weakR: 0.7});
  const {K} = sh;
  const L = layout(scale);
  const side = SPEC.court * scale;
  K.add(new THREE.BoxGeometry(side, 1, side), M.stone, [0, -0.5, 0]);
  for (let x = -2; x <= 2; x++) for (let z = -2; z <= 2; z++) if ((x + z) % 2 === 0 && Math.hypot(x, z) * 3.6 < L.rb + 1) K.add(new THREE.BoxGeometry(3.4, 0.05, 3.4), mat('#3e3b44'), [x * 3.6, 0.02, z * 3.6]); // slam tiles
  // gallery: posts and slabs, one node per slab so it can fall
  const nS = SPEC.gallery.slabs;
  const slabs = Array.from({length: nS}, (_, k) => {
    const am = ((k + 0.5) / nS) * Math.PI * 2;
    const n = K.node([0, 0, 0]);
    n.rotation.y = am;
    const len = 2 * L.mid * Math.sin(Math.PI / nS) * 1.02;
    K.add(new THREE.BoxGeometry(len, SPEC.gallery.thick, L.r1 - L.r0), M.stone2, [0, L.height, L.mid], [0, 0, 0], n);
    K.add(new THREE.BoxGeometry(0.9, L.height, 0.9), mats.pillar, [0, L.height / 2, L.mid], [0, 0, 0], n);
    return n;
  });
  for (const [x, z] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) K.tag(K.add(new THREE.CylinderGeometry(0.9, 0.9, 0.25, 12), M.pad, [x * (L.r0 - 2.5) * 0.7, 0.12, z * (L.r0 - 2.5) * 0.7]), 'pad');
  const shield = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 18), new THREE.MeshBasicMaterial({color: '#e8d27a', transparent: true, opacity: 0.1, depthWrite: false}));
  g.add(shield);
  let last = model(0, 0, scale);
  const subsystems = sh.subsystems([
    {id: 'belial', name: 'Belial', note: '34 m colossus; walks on planted feet', keys: ['colossus', 'colossusDark', 'gold'], state: () => (last.info.arrive < 0.02 ? 'IN THE CRYPT' : last.info.stand >= 1 ? `WALKING ${last.info.travelDeg.toFixed(0)}°` : 'SEATED')},
    {id: 'face', name: 'Face · weak point', note: 'open in phase two', keys: [], state: () => (last.info.p2 > 0.9 ? 'OPEN' : 'SHIELDED')},
    {id: 'pillars', name: 'Great pillars ×4', note: 'cracked bases; fall into ramps', keys: ['pillar'], state: () => `${last.info.standing} STANDING`},
    {id: 'chains', name: 'Chains and shield', note: 'the shield shrinks with each chain', keys: ['chain'], objs: [shield], state: () => `${(last.shield.r).toFixed(1)} M`},
    {id: 'gallery', name: `Gallery ×${nS} slabs`, note: `${L.height.toFixed(1)} m up; crumbles behind him`, objs: slabs, state: () => `${last.galleryDrop.filter((d) => d.drop === 0).length} / ${nS}`},
    {id: 'throne', name: 'Throne', note: 'rises from the crypt', keys: ['throne'], state: () => (last.info.arrive > 0.99 ? 'RAISED' : 'BELOW')},
  ]);
  return stageFight({
    states: STATES,
    scale,
    model,
    checks,
    extra: {
      spawn: [0, 0.5, L.r0 - 3],
      killY: -25,
      cam: {target: [0, 8, -L.r1 * 0.3], az: 24, el: 26, dist: L.r1 * 3.2 + 40},
      subsystems,
      readout: () => [
        ['ATTACK', last.info.stand >= 1 ? 'Stomps as he walks' : last.info.arrive > 0.99 ? 'Shielded' : 'None'],
        ['PILLARS', `${last.info.standing} / 4 standing`],
        ['GALLERY', `${last.info.height.toFixed(1)} m up`],
      ],
      update(ctx, s) {
        last = model(s, ctx.t, scale);
        sh.draw(last, ctx);
        slabs.forEach((n, k) => {
          const d = last.galleryDrop[k].drop;
          n.position.y = -d * 14;
          n.visible = d < 0.99;
        });
        shield.visible = last.shield.r > 0.5;
        shield.position.set(...last.shield.c);
        shield.scale.setScalar(Math.max(0.001, last.shield.r));
        shield.material.opacity = 0.08 + 0.04 * Math.sin(ctx.t * 2);
        if (ctx.hunt && last.info.stand >= 1) {
          for (const f of last.feet) {
            if (f.planted && ctx.player.pos.distanceTo(new THREE.Vector3(...f.p)) < 2.6) ctx.hurt('stomp');
          }
        }
      },
    },
  });
}
