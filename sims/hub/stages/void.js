// The Void and Belphegor, drawn from void.kin.js. Static: the abyss far below, the centre halves (slide apart),
// the middle ring (turns as one piece) with its pads. From the model each frame: the outer platforms (pulled in and
// tilted into ramps in phase two), Belphegor's body, cord, mask and six hook-legs, and the sleep beam.
import * as THREE from 'three';
import {M, mat} from '../fights.js';
import {checks, model, SPEC, STATES} from './void.kin.js';
import {stageFight, stageShell} from './shell.js';

export function voidStage(g, scale = 1) {
  const mats = {
    tier: mat('#5d5a63'),
    hooked: mat('#6a5f6e'),
    body: mat('#a69c90'),
    mask: mat('#e4dccb'),
    cord: mat('#2a2430'),
    leg: mat('#4a3f47'),
    joint: mat('#8f8578'),
    hook: mat('#1c1418'),
  };
  const sh = stageShell(g, {mats, weakCount: 3, weakR: 0.9});
  const {K} = sh;
  const sc = scale;
  K.tag(K.add(new THREE.CylinderGeometry(120, 120, 0.2, 48), mat('#0b0a10'), [0, -40, 0], [0, 0, 0], g), 'nocollide');
  // centre: two half discs on x
  const halves = [-1, 1].map((sx) => {
    const n = K.node([0, 0, 0]);
    const geo = new THREE.CylinderGeometry(SPEC.centreR * sc, SPEC.centreR * sc, SPEC.thick, 32, 1, false, sx > 0 ? 0 : Math.PI, Math.PI);
    K.add(geo, M.stone, [0, -SPEC.thick / 2, 0], [0, 0, 0], n);
    K.tag(K.add(new THREE.CylinderGeometry(0.9, 0.9, 0.25, 12), M.pad, [sx * SPEC.centreR * sc * 0.55, 0.12, 0], [0, 0, 0], n), 'pad');
    return {n, sx};
  });
  // middle ring: 8 segments with gaps, turning as one
  const mid = K.node([0, 0, 0]);
  const md = SPEC.mid;
  const r = ((md.r0 + md.r1) / 2) * sc;
  const gapA = md.gapM / r;
  const segA = (Math.PI * 2) / md.segs - gapA;
  for (let k = 0; k < md.segs; k++) {
    const a0 = (k / md.segs) * Math.PI * 2 + gapA / 2;
    const shape = new THREE.Shape();
    shape.absarc(0, 0, md.r1 * sc, a0, a0 + segA, false);
    shape.absarc(0, 0, md.r0 * sc, a0 + segA, a0, true);
    const geo = new THREE.ExtrudeGeometry(shape, {depth: SPEC.thick, bevelEnabled: false, curveSegments: 10});
    geo.rotateX(-Math.PI / 2);
    K.add(geo, mats.tier, [0, md.y - SPEC.thick, 0], [0, 0, 0], mid);
    if (k % 2 === 0) {
      const am = a0 + segA / 2;
      K.tag(K.add(new THREE.CylinderGeometry(0.9, 0.9, 0.25, 12), M.pad, [Math.cos(am) * r, md.y + 0.12, -Math.sin(am) * r], [0, 0, 0], mid), 'pad');
    }
  }
  // the beam: an open wedge, re-sized to the tier it sweeps
  const beamMat = new THREE.MeshBasicMaterial({color: '#9fb8ff', transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false});
  const beam = new THREE.Mesh(new THREE.RingGeometry(0, 1, 32, 1, 0, 0.5).rotateX(-Math.PI / 2), beamMat);
  g.add(beam);
  let last = model(0, 0, sc);
  const subsystems = sh.subsystems([
    {id: 'body', name: 'Belphegor', note: '28 m sleeper-moth on a cord', keys: ['body', 'mask', 'cord'], state: () => (last.info.arrive < 0.02 ? 'IN THE DARK' : last.info.sink > 0.98 ? 'SUNK' : `${last.info.bodyY.toFixed(0)} M UP`)},
    {id: 'back', name: 'Back · weak points ×3', note: 'a jump above the ramps in phase two', keys: [], state: () => (last.info.p2 > 0.9 ? 'REACHABLE' : 'OUT OF REACH')},
    {id: 'legs', name: 'Hook-legs ×6', note: '11 links, 55 m, hook every other platform', keys: ['leg', 'joint', 'hook'], state: () => (last.info.hooked > 0.99 ? (last.info.p2 > 0 ? 'PULLING' : 'HOOKED') : 'FOLDED')},
    {id: 'outer', name: 'Outer platforms ×12', note: 'Dash-wide gaps; hooked ones become ramps', keys: ['tier', 'hooked'], state: () => (last.info.p2 > 0.5 ? 'RAMPS' : 'LEVEL')},
    {id: 'mid', name: 'Middle ring', note: 'turns in phase one', objs: [mid], state: () => `${((last.info.midTurn * 180) / Math.PI).toFixed(0)}°`},
    {id: 'centre', name: 'Centre halves', note: 'split open for the body', objs: halves.map((h) => h.n), state: () => (last.centre.half > 0.1 ? 'OPEN' : 'SHUT')},
    {id: 'beam', name: 'Sleep beam', note: 'sweeps one tier', objs: [beam], state: () => (last.beam.on ? `TIER ${last.beam.tier}` : 'OFF')},
  ]);
  return stageFight({
    states: STATES,
    scale: sc,
    model,
    checks,
    extra: {
      spawn: [SPEC.centreR * sc * 0.4, 0.5, 0],
      killY: -12,
      cam: {target: [0, 8, 0], az: 30, el: 26, dist: SPEC.outer.r1 * sc * 2.6 + 34},
      subsystems,
      readout: () => [
        ['ATTACK', last.beam.on ? `Sleep beam on tier ${last.beam.tier}` : last.info.arrive > 0.02 ? 'Lowering' : 'None'],
        ['BODY', `${last.info.bodyY.toFixed(1)} m`],
        ['MIDDLE', `${((last.info.midTurn * 180) / Math.PI).toFixed(0)}°`],
      ],
      update(ctx, s) {
        last = model(s, ctx.t, sc);
        sh.draw(last, ctx);
        halves.forEach((h) => (h.n.position.x = h.sx * last.centre.half));
        mid.rotation.y = last.mid.turn;
        beam.visible = last.beam.on;
        beam.position.y = last.beam.y;
        beam.rotation.y = last.beam.angle;
        beam.scale.set(last.beam.r1, 1, last.beam.r1);
        beamMat.opacity = 0.25 + 0.1 * Math.sin(ctx.t * 6);
        if (ctx.hunt && last.beam.on) {
          const p = ctx.player.pos;
          const rr = Math.hypot(p.x, p.z);
          // RingGeometry sweeps from +x counter-clockwise; the mesh turns by angle about y
          let a = Math.atan2(-p.z, p.x) - last.beam.angle;
          a = ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
          if (Math.abs(p.y - last.beam.y) < 1.4 && rr > last.beam.r0 && rr < last.beam.r1 && a < 0.5) ctx.hurt('sleep');
        }
      },
    },
  });
}
