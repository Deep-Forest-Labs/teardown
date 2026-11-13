// Lust and Lilith, drawn from lust.kin.js. Static: the storm terrace, wind markers, the updraft columns. From the
// model: the spire, the six petals (bud, platforms, then a spiral stair), Lilith, her wings and her mirror.
import * as THREE from 'three';
import {M, mat} from '../fights.js';
import {checks, model, SPEC, STATES} from './lust.kin.js';
import {stageFight, stageShell} from './shell.js';

export function lustStage(g, scale = 1) {
  const mats = {
    spire: mat('#4a4750'),
    petal: mat('#7d5a73'),
    lilith: mat('#a69c90'),
    wing: mat('#4a3f47'),
    mirror: mat('#c3cad6', {metalness: 0.8, roughness: 0.15}),
  };
  const sh = stageShell(g, {mats, weakCount: 1, weakR: 1});
  const {K} = sh;
  const R = SPEC.terraceR * scale;
  K.add(new THREE.CylinderGeometry(R, R, 1, 56), M.stone, [0, -0.5, 0]);
  const m0 = model(0, 0, scale);
  const cols = m0.updrafts.map((u) => K.tag(K.add(new THREE.CylinderGeometry(1.8, 1.8, u.top, 16, 1, true), new THREE.MeshBasicMaterial({color: '#cfd8ff', transparent: true, opacity: 0.12, depthWrite: false}), [u.p[0], u.top / 2, u.p[2]], [0, 0, 0], g), 'updraft'));
  const wind = new THREE.Group();
  for (let k = 0; k < 12; k++) {
    const m = new THREE.Mesh(new THREE.ConeGeometry(0.4, 2.2, 3), new THREE.MeshBasicMaterial({color: '#ffffff', transparent: true, opacity: 0.22}));
    const a = (k / 12) * Math.PI * 2;
    m.position.set(Math.cos(a) * R * 0.55, 0.6, Math.sin(a) * R * 0.55);
    m.rotation.set(0, -a, Math.PI / 2);
    wind.add(m);
  }
  g.add(wind);
  let last = m0;
  const subsystems = sh.subsystems([
    {id: 'lilith', name: 'Lilith', note: '22 m, winged, in the bloom', keys: ['lilith', 'wing'], state: () => (last.info.rise < 0.02 ? 'IN THE BUD' : 'IN THE BLOOM')},
    {id: 'heart', name: 'Heart · weak point', note: 'open while the mirror is down', keys: [], state: () => (last.mirror.p2 > 0 ? (last.mirror.down ? 'OPEN' : 'COVERED') : 'GUARDED')},
    {id: 'mirror', name: 'Mirror', note: 'circles her in phase two', keys: ['mirror'], state: () => (last.mirror.p2 < 0.05 ? 'STOWED' : last.mirror.down ? 'DOWN' : 'UP')},
    {id: 'petals', name: 'Petals ×6', note: 'bud → platforms → spiral stair', keys: ['petal'], state: () => (last.info.droop > 0.95 ? 'STAIR' : last.info.open > 0.95 ? 'OPEN' : 'BUD')},
    {id: 'spire', name: 'Spire', note: `${SPEC.spire.h} m`, keys: ['spire'], state: () => '-'},
    {id: 'updrafts', name: 'Updraft columns ×6', note: 'carry you to the petals', objs: cols, state: () => 'LIFTING'},
  ]);
  return stageFight({
    states: STATES,
    scale,
    model,
    checks,
    extra: {
      spawn: [0, 0.5, R * 0.6],
      killY: -25,
      cam: {target: [0, 9, 0], az: 30, el: 22, dist: R * 2.4 + 36},
      subsystems,
      readout: () => [
        ['ATTACK', last.info.p2 > 0 ? 'Mirror reflects' : last.info.rise > 0.9 ? 'Charm pull every 6 s' : 'None'],
        ['PETALS', last.info.droop > 0.95 ? 'Spiral stair' : last.info.open > 0.95 ? 'High platforms' : 'Bud'],
      ],
      update(ctx, s) {
        last = model(s, ctx.t, scale);
        sh.draw(last, ctx);
        wind.rotation.y = ctx.t * (0.35 + last.info.p2 * 0.4);
        if (ctx.hunt && s >= 1 && ctx.t % 6 < 2) ctx.pull.add(new THREE.Vector3(-ctx.player.pos.x, 0, -ctx.player.pos.z).normalize().multiplyScalar(14 * (1 - last.info.p2 * 0.4)));
      },
    },
  });
}
