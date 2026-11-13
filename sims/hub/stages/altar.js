// The Altar and Leviathan, drawn from altar.kin.js. Static parts (the sea, the disc and its lip) are built once;
// everything that moves comes from the model each frame through the rig, so tentacles meet the rim and the disc
// exactly where the model solved them. The tentacles and iris are solid: a stuck arm is a ridge you can walk on.
// Mechanics wired here: ring volleys while the eyes are open, slam hits, a downhill slide when the disc tilts.
import * as THREE from 'three';
import {createWeakpoints} from '../../dfl-kit/weakpoint.js';
import {kit, M, mat} from '../fights.js';
import {checks, model, SPEC, STATES} from './altar.kin.js';
import {createRig} from './rig.js';

const V3 = THREE.Vector3;

export function altarStage(g, scale = 1) {
  const K = kit(g);
  const R = SPEC.discR * scale;
  const mats = {
    fleshA: mat('#8c4a42'),
    fleshB: mat('#6e332d'),
    knuckle: mat('#b98f7f'),
    claw: mat('#2a1c1a'),
    bone: mat('#cdbf9f'),
    plate: mat('#8f8578'),
    socket: mat('#120a0a', {roughness: 1}),
    iris: mat('#a8987a'),
    notch: mat('#4a4750'),
  };
  // the sea and its ripples
  const sea = K.tag(K.add(new THREE.CylinderGeometry(R * 3 + 40, R * 3 + 40, 0.4, 72), M.blood, [0, SPEC.seaY, 0]), 'nocollide');
  const ripples = [0, 1, 2].map(() => {
    const r = new THREE.Mesh(new THREE.TorusGeometry(1, 0.12, 3, 64), new THREE.MeshBasicMaterial({color: '#a3271a', transparent: true, depthWrite: false}));
    r.rotation.x = Math.PI / 2;
    g.add(r);
    return r;
  });
  // the disc: tilted as one piece by the model
  const disc = K.node([0, 0, 0]);
  K.ring(SPEC.poolR, R, SPEC.discThick, M.stone, SPEC.discTop - SPEC.discThick, disc);
  K.ring(R - 0.6, R + 0.6, SPEC.discThick + SPEC.lip, M.stone2, SPEC.discTop - SPEC.discThick, disc); // the lip
  K.ring(SPEC.poolR - 0.6, SPEC.poolR, SPEC.discThick + 0.3, mats.iris, SPEC.discTop - SPEC.discThick, disc); // pool lip
  for (const r of [SPEC.poolR + 2.5, (SPEC.poolR + R) / 2, R - 3]) K.ring(r - 0.12, r + 0.12, 0.04, mats.socket, SPEC.discTop + 0.01, disc);
  const channel = K.ring(SPEC.poolR + 4.6, SPEC.poolR + 5.4, 0.05, mat('#5a120d', {emissive: new THREE.Color('#a3271a'), emissiveIntensity: 0.4}), SPEC.discTop, disc);
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + Math.PI / 8;
    const r = (SPEC.poolR + R) / 2;
    K.tag(K.add(new THREE.CylinderGeometry(0.9, 0.9, 0.25, 12), M.pad, [Math.sin(a) * r, SPEC.discTop + 0.12, Math.cos(a) * r], [0, 0, 0], disc), 'pad');
  }
  // moving parts
  const rigGroup = new THREE.Group();
  g.add(rigGroup);
  const rig = createRig(rigGroup, mats, 512);
  const weakN = 2 + SPEC.notches;
  const before = new Set(g.children);
  const weak = createWeakpoints(g, weakN, 0.6);
  for (const c of g.children) if (!before.has(c)) c.userData.keepVisible = true;
  const weakMeshes = g.children.filter((c) => !before.has(c));
  const m4 = new THREE.Matrix4();
  let last = model(0, 0, scale);
  const Q = new THREE.Quaternion();
  const pools = (keys) => keys.map((k) => Object.values(rig.pools).find((p) => p.m.userData.rigKey === k)?.m).filter(Boolean);
  rig.draw(last);

  const subsystems = [
    {id: 'skull', name: 'Skull and mantle', note: '14 m skull, rises through the iris', objs: [], keys: ['bone', 'plate', 'socket'], state: () => (last.info.skullUp > 0.9 ? 'SURFACED' : last.info.skullUp > 0.02 ? 'MOVING' : 'BELOW')},
    {id: 'eyes', name: 'Eyes · weak points', note: 'open while surfaced', objs: [], keys: ['socket'], state: () => (last.weak[last.weak.length - 1].open ? 'OPEN' : 'SHUT')},
    {id: 'arms', name: 'Tentacles ×8', note: '15 links, 37.5 m, drape over the lip', objs: [], keys: ['fleshA', 'fleshB', 'knuckle', 'claw'], state: () => (last.info.grip < 0.01 ? 'UNDER THE SEA' : last.info.p2 > 0 ? `${last.info.stuck} STUCK` : 'GRIPPING')},
    {id: 'iris', name: 'Bone iris ×8 plates', note: 'seals the pool; slides under the disc', objs: [], keys: ['iris'], state: () => `${Math.round(last.info.irisOpen * 100)} % OPEN`},
    {id: 'notches', name: 'Rim grips ×8', note: 'where the arms hold the disc', objs: [], keys: ['notch'], state: () => (last.info.grip > 0.99 ? 'HELD' : 'EMPTY')},
    {id: 'disc', name: 'Disc', note: `ring ${SPEC.poolR} to ${R.toFixed(0)} m, dips to slams`, objs: [disc], state: () => `TILT ${last.info.tiltDeg.toFixed(1)}°`},
    {id: 'sea', name: 'Blood sea', note: `kills below ${SPEC.seaY + 2} m`, objs: [sea, ...ripples], state: () => (last.info.arrive > 0.02 && last.info.arrive < 0.99 ? 'BOILING' : 'STILL')},
  ];
  for (const s of subsystems) s.objs.push(...pools(s.keys || []));

  return {
    version: 'v2',
    range: 3,
    ownsScale: true,
    states: STATES,
    phases: STATES.map((s) => s.name),
    stateAt: (s) => [...STATES].reverse().find((x) => s >= x.at - 1e-6) || STATES[0],
    spawn: [0, SPEC.discTop + 1, (SPEC.poolR + R) / 2],
    killY: SPEC.seaY + 2,
    cam: {target: [0, 3, 0], az: 30, el: 24, dist: R * 2.6 + 30},
    spots: () => model(0, 0, scale).spots,
    checks: (s, t) => checks(s, t, scale),
    subsystems,
    readout: () => [
      ['STATE', STATES.slice().reverse().find((x) => last.s >= x.at - 1e-6).name],
      ['ATTACK', last.info.skullUp > 0.9 ? 'Ring volley every 3 s' : last.info.p2 > 0 ? 'Tentacle slams in pairs' : last.info.arrive > 0.02 ? 'Arriving' : 'None'],
      ['TILT', `${last.info.tiltDeg.toFixed(1)}°`],
      ['IRIS', `${last.info.aperture.toFixed(1)} m`],
    ],
    update(ctx, s) {
      const t = ctx.t;
      last = model(s, t, scale);
      last.s = s;
      rig.draw(last);
      // disc tilt
      Q.setFromAxisAngle(new V3(...last.tilt.axis), last.tilt.angle);
      disc.quaternion.copy(Q);
      // weak points
      for (const m of weakMeshes) m.visible = ctx.showWeak;
      if (ctx.showWeak) {
        weak.face(ctx.camera);
        last.weak.forEach((w, i) => weak.set(i, m4.makeTranslation(...w.p), {open: w.open, pulse: 0.5 + 0.5 * Math.sin(t * 5 + i)}));
        weak.commit();
      }
      // sea
      const boil = last.info.arrive > 0.02 && last.info.arrive < 0.99 ? 1 : 0;
      sea.position.y = SPEC.seaY + 0.3 * Math.sin(t * 0.4) + boil * 0.4 * Math.sin(t * 7);
      ripples.forEach((r, i) => {
        const u = (t * (0.12 + boil * 0.3) + i / 3) % 1;
        r.scale.setScalar(R + 4 + u * (R * 2 + 20));
        r.position.y = sea.position.y + 0.25;
        r.material.opacity = 0.5 * (1 - u) * (0.4 + boil);
      });
      channel.material.emissiveIntensity = 0.3 + 0.15 * Math.sin(t * 2);
      if (!ctx.hunt) return;
      // ring volleys while surfaced
      if (last.info.skullUp > 0.9 && ctx.ringTimer(3)) {
        const c = new V3(...last.skull.c);
        for (let k = 0; k < 18; k++) {
          const d = new V3(Math.cos((k / 18) * Math.PI * 2), -0.06, Math.sin((k / 18) * Math.PI * 2));
          ctx.shots.fire('bolt', c.clone().add(new V3(0, 2, 0)), d.multiplyScalar(9), {life: 4});
        }
      }
      // a slam lands: anything under the arm's line is hit
      for (const arm of last.arms) {
        if (!arm.isStuck) continue;
        const p = ctx.player.pos;
        for (let i = SPEC.rimLinks; i < SPEC.arm.links; i++) {
          const a = arm.pts[i];
          if (Math.hypot(p.x - a[0], p.z - a[2]) < 1.6 && p.y < a[1] + 0.5 && p.y > a[1] - 2.5) {
            ctx.hurt('slam');
            break;
          }
        }
      }
      // the tilt: the player slides downhill
      if (last.tilt.angle > 0.01) {
        const ax = last.tilt.axis;
        const down = new V3(-ax[2], 0, ax[0]); // the dip direction (axis = up × dip)
        ctx.pull.addScaledVector(down, 40 * Math.sin(last.tilt.angle));
      }
    },
  };
}
