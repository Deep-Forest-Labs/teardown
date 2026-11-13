// Fraud and Quire, drawn from fraud.kin.js. Static: the two side ledges and the pit under the archive. From the
// model: every floor tile (true, marked false, falling), the two mirror walls (walls, ramps, then the new floor),
// Quire's pages and spine, and his quill arms solved to the tiles he is writing off.
import * as THREE from 'three';
import {M, mat} from '../fights.js';
import {checks, layout, model, SPEC, STATES} from './fraud.kin.js';
import {stageFight, stageShell} from './shell.js';

export function fraudStage(g, scale = 1) {
  const mats = {
    tile: mat('#6c6470'),
    tileFalse: mat('#9b4b4b', {emissive: new THREE.Color('#5a1a1a'), emissiveIntensity: 0.4}),
    mirror: mat('#8a93a3', {metalness: 0.6, roughness: 0.2}),
    page: mat('#e9e1cf'),
    spine: mat('#2b2422'),
    quill: mat('#1d1a20'),
  };
  const L = layout(scale);
  const sh = stageShell(g, {mats, weakCount: 1, weakR: 1, capacity: Math.max(512, L.nx * L.nz + 64)});
  const {K} = sh;
  const ledgeMat = mat('#4d4650');
  const ledges = [-1, 1].map((sx) => K.add(new THREE.BoxGeometry(SPEC.ledge.w, SPEC.ledge.h, L.depth + 2 * SPEC.ledge.w), ledgeMat, [sx * (L.fieldX + SPEC.ledge.w / 2), SPEC.ledge.h / 2, 0]));
  const pit = K.tag(K.add(new THREE.BoxGeometry(L.fieldX * 2, 0.4, L.depth), mat('#120e14'), [0, -22, 0]), 'nocollide');
  let last = model(0, 0, scale);
  const subsystems = sh.subsystems([
    {id: 'quire', name: 'Quire', note: '30 m open ledger', keys: ['page', 'spine'], state: () => (last.info.arrive < 0.02 ? 'IN THE DARK' : last.info.clauses ? `CLAUSE ${last.info.clause}` : 'THE CONTRACT')},
    {id: 'spine', name: 'Spine · weak point', note: 'opens with the pages; full in phase two', keys: [], state: () => (last.info.pages > 0.9 ? 'OPEN' : 'SHUT')},
    {id: 'quills', name: 'Quill arms ×2', note: 'touch the tiles about to drop', keys: ['quill'], state: () => (last.info.clauses && last.info.inClause < 0.5 ? 'WRITING' : 'LIFTED')},
    {id: 'tiles', name: `Floor tiles ×${L.nx * L.nz}`, note: 'false ones drop; the rest stays one piece', keys: ['tile', 'tileFalse'], state: () => (last.info.clauses ? `${last.info.falseCount} FALSE` : last.info.ramp > 0.99 ? 'FALLING' : 'TRUE')},
    {id: 'mirrors', name: 'Mirror walls ×2', note: 'walls → ramps → the new floor', keys: ['mirror'], state: () => (last.info.lift > 0.99 ? 'FLOOR' : last.info.ramp > 0.99 ? 'RAMPS' : 'WALLS')},
    {id: 'ledges', name: 'Ledges', note: `${SPEC.ledge.h} m; the mirrors hinge on them`, objs: [...ledges, pit], state: () => '-'},
  ]);
  return stageFight({
    states: STATES,
    scale,
    model,
    checks,
    extra: {
      spawn: [last.spawn[0], 0.5, last.spawn[2]],
      killY: -18,
      cam: {target: [0, 6, 0], az: 26, el: 30, dist: L.hingeX * 2.6 + 30},
      subsystems,
      readout: () => [
        ['ATTACK', last.info.clauses ? (last.info.inClause < 0.33 ? 'Writing a clause' : last.info.inClause < 0.5 ? 'Tiles shaking' : 'Tiles dropping') : last.info.ramp > 0.99 && last.info.lift < 0.99 ? 'Get up the ramps' : 'None'],
        ['FLOOR', last.info.lift > 0.99 ? 'Mirrors at ledge height' : last.info.clauses ? `${last.info.falseCount} false` : 'Tiles'],
      ],
      update(ctx, s) {
        last = model(s, ctx.t, scale);
        sh.draw(last, ctx);
      },
    },
  });
}
