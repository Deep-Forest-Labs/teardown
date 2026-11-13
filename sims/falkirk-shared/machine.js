// The Falkirk Wheel, built from code and posed from kin.js. Every gear is cut with its real tooth count and turned to
// the phase the model solves, so teeth sit in gaps; the caissons hang in the arm eyes on their wheels; the gates, pins
// and seals move with the docking input. Parts are grouped (structure, train, caissons, dock, drive) so the film can
// ghost everything but the group doing the work.
import * as THREE from 'three';
import {D, OFFSETS, pose} from './kin.js';

export const PAL = {
  bg: '#e9e3d8',
  floor: '#ddd5c7',
  white: '#ece8e1',
  bone: '#d9d1c2',
  steel: '#5d6066',
  dark: '#2c2d31',
  accent: '#d0592a',
  water: '#6f8f96',
  concrete: '#bdb5a6',
};
const TAU = Math.PI * 2;

/** A spur gear outline: N teeth on pitch radius r (module r·2/N), an optional bore. Teeth centred at 2πk/N. */
function gearShape(r, N, bore = 0) {
  const m = (2 * r) / N;
  const rt = r + m;
  const rr = r - 1.25 * m;
  const p = TAU / N;
  const s = new THREE.Shape();
  for (let k = 0; k < N; k++) {
    const c = k * p;
    const pts = [
      [rr, c - 0.5 * p],
      [rr, c - 0.27 * p],
      [rt, c - 0.13 * p],
      [rt, c + 0.13 * p],
      [rr, c + 0.27 * p],
    ];
    pts.forEach(([rad, a], i) => (k === 0 && i === 0 ? s.moveTo(rad * Math.cos(a), rad * Math.sin(a)) : s.lineTo(rad * Math.cos(a), rad * Math.sin(a))));
  }
  s.closePath();
  if (bore > 0) {
    const h = new THREE.Path();
    h.absarc(0, 0, bore, 0, TAU, true);
    s.holes.push(h);
  }
  return s;
}

const extrude = (shape, depth, bevel = 0.06) =>
  new THREE.ExtrudeGeometry(shape, {depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 48}).translate(0, 0, -depth / 2);

const annulus = (r0, r1) => {
  const s = new THREE.Shape();
  s.absarc(0, 0, r1, 0, TAU, false);
  const h = new THREE.Path();
  h.absarc(0, 0, r0, 0, TAU, true);
  s.holes.push(h);
  return s;
};

/** The arm plate in its own frame: a hub, two eyes with 8 m holes at (0, ±12), waisted bridges, axe horns. */
function plateShapes() {
  const R = D.caissonR;
  const eyeOuter = D.hole + 1.6;
  const out = [];
  // hub
  const hub = new THREE.Shape();
  hub.absarc(0, 0, 5, 0, TAU, false);
  const bore = new THREE.Path();
  bore.absarc(0, 0, D.axleR + 0.02, 0, TAU, true);
  hub.holes.push(bore);
  out.push(hub);
  for (const sy of [-1, 1]) {
    // eye: the ring the caisson's wheels run inside
    const eye = annulus(D.hole, eyeOuter);
    eye.__offset = [0, sy * R];
    out.push(eye);
    // waisted bridge from the hub to the eye
    const b = new THREE.Shape();
    b.moveTo(-4.6, sy * 1.6);
    b.quadraticCurveTo(-2.5, sy * 6, -5.2, sy * (R - 1.6));
    b.lineTo(5.2, sy * (R - 1.6));
    b.quadraticCurveTo(2.5, sy * 6, 4.6, sy * 1.6);
    b.closePath();
    out.push(b);
    // the axe horn: off the eye's outer edge, sweeping back toward the hub (point-symmetric pair)
    const sx = sy; // top eye's horn on +x, bottom eye's on -x
    const e = (deg) => {
      const a = (deg * Math.PI) / 180;
      return [sx * eyeOuter * Math.cos(a), sy * R + sy * eyeOuter * Math.sin(a)];
    };
    const h = new THREE.Shape();
    const p0 = e(25);
    const p1 = e(-35);
    h.moveTo(...p0);
    h.quadraticCurveTo(sx * 11.2, sy * (R + 1.5), sx * 9.6, sy * (R - 6.2));
    h.quadraticCurveTo(sx * 7.4, sy * (R - 3.4), ...p1);
    h.closePath();
    out.push(h);
  }
  return out;
}

export function buildMachine(scene) {
  const groups = {structure: [], train: [], caissons: [], dock: [], drive: []};
  const mats = {};
  // one material set per group so the film can ghost a group without touching the others
  const matFor = (group, key) => {
    const id = `${group}:${key}`;
    if (!mats[id]) {
      const base = {
        white: new THREE.MeshPhysicalMaterial({color: PAL.white, roughness: 0.5, clearcoat: 0.25, clearcoatRoughness: 0.5}),
        bone: new THREE.MeshStandardMaterial({color: PAL.bone, roughness: 0.7}),
        steel: new THREE.MeshStandardMaterial({color: PAL.steel, roughness: 0.45, metalness: 0.55}),
        dark: new THREE.MeshStandardMaterial({color: PAL.dark, roughness: 0.6, metalness: 0.2}),
        accent: new THREE.MeshStandardMaterial({color: PAL.accent, roughness: 0.5}),
        concrete: new THREE.MeshStandardMaterial({color: PAL.concrete, roughness: 0.9}),
        water: new THREE.MeshStandardMaterial({color: PAL.water, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.78}),
      }[key];
      base.userData.baseOpacity = base.opacity;
      base.userData.baseTransparent = base.transparent;
      mats[id] = base;
    }
    return mats[id];
  };
  const add = (group, geo, key, parent = scene) => {
    const m = new THREE.Mesh(geo, matFor(group, key));
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    groups[group].push(m);
    return m;
  };
  const node = (parent = scene) => {
    const n = new THREE.Group();
    parent.add(n);
    return n;
  };

  // ------------------------------------------------------------ the wheel: axle and two arm plates (turn with α)
  const wheel = node();
  wheel.position.set(0, D.axleY, 0);
  const zA0 = D.zGear - D.gearW - 2.2; // into the machine room, through the drive ring
  const zA1 = D.zDock + 0.95; // through the far bearing
  add('structure', new THREE.CylinderGeometry(D.axleR, D.axleR, zA1 - zA0, 40).rotateX(Math.PI / 2).translate(0, 0, (zA0 + zA1) / 2), 'white', wheel);
  for (const sz of [-1, 1]) {
    const plate = node(wheel);
    plate.position.z = sz * D.zPlate;
    for (const s of plateShapes()) {
      const g = extrude(s, D.plateT, 0.12);
      if (s.__offset) g.translate(s.__offset[0], s.__offset[1], 0);
      add('structure', g, 'white', plate);
    }
    // the rails: a steel band lining each 8 m hole
    for (const sy of [-1, 1]) add('structure', extrude(annulus(D.hole - 0.06, D.hole + 0.02), D.plateT + 0.3, 0).translate(0, sy * D.caissonR, 0), 'steel', plate);
    // flange where the plate grips the axle
    add('structure', extrude(annulus(D.axleR, D.axleR + 0.7), D.plateT + 1.2, 0.05), 'steel', plate);
  }

  // ------------------------------------------------------------ gear train on the machine-room face
  const gearMat = 'steel';
  const sun = add('train', extrude(gearShape(D.ring.r, D.ring.teeth, D.axleR + 0.1), D.gearW, 0.03), gearMat);
  sun.position.set(0, D.axleY, D.zGear);
  sun.rotation.z = (OFFSETS.sun * TAU) / D.ring.teeth;
  const idlers = [0, 1].map(() => {
    const g = add('train', extrude(gearShape(D.idler.r, D.idler.teeth, 0.35), D.gearW, 0.03), gearMat);
    // the idler's stub axle and bearing housing on the arm
    const hub = add('train', new THREE.CylinderGeometry(0.55, 0.55, D.gearW + 0.9, 24).rotateX(Math.PI / 2), 'accent');
    return {g, hub};
  });

  // ------------------------------------------------------------ caissons (level; ride the eyes)
  const T = D.trough;
  const len = 2 * D.zEnd + 0.2; // through both eyes to the end frames
  const trough = new THREE.Shape();
  trough.moveTo(-T.w / 2, T.floor);
  trough.lineTo(T.w / 2, T.floor);
  trough.lineTo(T.w / 2, T.rim);
  trough.lineTo(T.w / 2 - 0.3, T.rim);
  trough.lineTo(T.w / 2 - 0.3, T.floor + 0.3);
  trough.lineTo(-T.w / 2 + 0.3, T.floor + 0.3);
  trough.lineTo(-T.w / 2 + 0.3, T.rim);
  trough.lineTo(-T.w / 2, T.rim);
  trough.closePath();
  const caissons = [0, 1].map(() => {
    const c = node();
    add('caissons', extrude(trough, len, 0.04), 'white', c);
    // ribs every 2 m round the outside
    const rib = new THREE.Shape();
    rib.moveTo(-T.w / 2 - 0.18, T.floor - 0.18);
    rib.lineTo(T.w / 2 + 0.18, T.floor - 0.18);
    rib.lineTo(T.w / 2 + 0.18, T.rim);
    rib.lineTo(T.w / 2, T.rim);
    rib.lineTo(T.w / 2, T.floor);
    rib.lineTo(-T.w / 2, T.floor);
    rib.lineTo(-T.w / 2, T.rim);
    rib.lineTo(-T.w / 2 - 0.18, T.rim);
    rib.closePath();
    const ribGeo = extrude(rib, 0.22, 0.02);
    for (let z = -T.inner / 2 + 1; z <= T.inner / 2 - 1 + 1e-6; z += 2) add('caissons', ribGeo.clone().translate(0, 0, z), 'bone', c);
    // water
    add('caissons', new THREE.BoxGeometry(T.w - 0.62, 0.02, len - 0.6).translate(0, T.water, 0), 'water', c);
    // end frames in the eyes: a ring with four spokes and four wheels on the rail
    for (const z of [-D.zEnd, D.zEnd]) {
      add('caissons', extrude(annulus(D.hole - 0.75, D.hole - 0.3), 0.4, 0.04).translate(0, 0, z), 'bone', c);
      for (let k = 0; k < D.wheelsPerEnd; k++) {
        const a = Math.PI / 4 + (k * TAU) / D.wheelsPerEnd;
        const wr = 0.25;
        const wc = [(D.hole - wr) * Math.cos(a), (D.hole - wr) * Math.sin(a)];
        add('caissons', new THREE.CylinderGeometry(wr, wr, 0.5, 20).rotateX(Math.PI / 2).translate(wc[0], wc[1], z), 'dark', c);
        // spoke from the wheel bracket to the trough corner
        const tc = [Math.sign(wc[0]) * (T.w / 2), Math.sign(wc[1]) > 0 ? T.rim : T.floor];
        const sp = new THREE.Vector3(wc[0] - tc[0], wc[1] - tc[1], 0);
        const spoke = add('caissons', new THREE.BoxGeometry(0.3, sp.length(), 0.3), 'bone', c);
        spoke.position.set((wc[0] + tc[0]) / 2, (wc[1] + tc[1]) / 2, z);
        spoke.rotation.z = Math.atan2(sp.y, sp.x) - Math.PI / 2;
      }
    }
    // the machine-end ring gear (104 teeth, 8 m) on its own spider
    const ring = add('train', extrude(gearShape(D.ring.r, D.ring.teeth, D.ring.r - 0.45), D.gearW, 0.03), gearMat, c);
    ring.position.z = D.zGear;
    for (let k = 0; k < 4; k++) {
      const a = (k * TAU) / 4 + Math.PI / 4;
      const s = add('train', new THREE.BoxGeometry(0.28, D.ring.r - 0.6, 0.28), 'steel', c);
      s.position.set(Math.cos(a) * (D.ring.r - 0.6) * 0.5 + Math.cos(a) * 0.3, Math.sin(a) * (D.ring.r - 0.6) * 0.5, D.zGear);
      s.rotation.z = a - Math.PI / 2;
    }
    // the gate at the dock end, and its ram
    const gate = add('caissons', new THREE.BoxGeometry(D.gate.w, D.gate.h, 0.25), 'accent', c);
    const barrel = add('caissons', new THREE.CylinderGeometry(0.18, 0.18, 1.6, 16), 'dark', c);
    const rod = add('caissons', new THREE.CylinderGeometry(0.09, 0.09, 1, 12), 'steel', c);
    return {c, ring, gate, barrel, rod};
  });

  // ------------------------------------------------------------ machine room (fixed) and the drive: 10 motors
  const FLOOR = D.pitFloor;
  const roomH = D.axleY + 6 - FLOOR;
  const room = add('dock', new THREE.BoxGeometry(11, roomH, 5), 'concrete');
  room.position.set(0, FLOOR + roomH / 2, D.zGear - D.gearW / 2 - 3.6);
  const bearing0 = add('drive', extrude(annulus(D.axleR, D.bearingR + 0.35), 1.2, 0.06), 'dark');
  bearing0.position.set(0, D.axleY, D.zGear - D.gearW - 0.6);
  const driveRing = add('drive', extrude(gearShape(D.bearingR - 0.1, 60, D.axleR - 0.3), 0.6, 0.02), 'steel');
  driveRing.position.set(0, D.axleY, D.zGear - D.gearW - 1.5);
  const motors = [];
  for (let k = 0; k < 10; k++) {
    const a = (k * TAU) / 10;
    const r = D.bearingR - 0.1 + 0.32;
    const m = add('drive', new THREE.CylinderGeometry(0.28, 0.28, 1.3, 18).rotateX(Math.PI / 2), 'accent');
    m.position.set(Math.cos(a) * r, D.axleY + Math.sin(a) * r, D.zGear - D.gearW - 2.4);
    const pin = add('drive', extrude(gearShape(0.26, 8, 0.05), 0.55, 0.01), 'steel');
    pin.position.set(Math.cos(a) * r, D.axleY + Math.sin(a) * r, D.zGear - D.gearW - 1.5);
    motors.push({m, pin, a});
  }
  // the far bearing: a portal over the basin channel, clear of everything that turns
  const zPortal = D.zDock + 0.25;
  for (const sx of [-1, 1]) {
    const legH = D.axleY + 2.5 - FLOOR;
    const leg = add('dock', new THREE.BoxGeometry(1.4, legH, 1.4), 'concrete');
    leg.position.set(sx * 5.2, FLOOR + legH / 2, zPortal + 0.7);
  }
  const beam = add('dock', new THREE.BoxGeometry(11.8, 3, 1.4), 'concrete');
  beam.position.set(0, D.axleY + 1, zPortal + 0.7);
  const bearing1 = add('drive', extrude(annulus(D.axleR, D.bearingR + 0.35), 1.2, 0.06), 'dark');
  bearing1.position.set(0, D.axleY, zPortal + 0.1);

  // ------------------------------------------------------------ the aqueduct at 24 m and the basin channel at 0 m
  const chan = (waterY, z0, length, piers) => {
    const g = node();
    const sec = new THREE.Shape();
    const w = T.w + 0.6;
    const fl = waterY - 2.1;
    sec.moveTo(-w / 2, fl - 0.5);
    sec.lineTo(w / 2, fl - 0.5);
    sec.lineTo(w / 2, waterY + 1);
    sec.lineTo(w / 2 - 0.35, waterY + 1);
    sec.lineTo(w / 2 - 0.35, fl);
    sec.lineTo(-w / 2 + 0.35, fl);
    sec.lineTo(-w / 2 + 0.35, waterY + 1);
    sec.lineTo(-w / 2, waterY + 1);
    sec.closePath();
    const body = add('dock', new THREE.ExtrudeGeometry(sec, {depth: length, bevelEnabled: false}), 'white', g);
    body.position.z = z0;
    const water = add('dock', new THREE.BoxGeometry(w - 0.72, 0.02, length), 'water', g);
    water.position.set(0, waterY, z0 + length / 2);
    if (piers) {
      for (let z = z0 + 9; z < z0 + length; z += 13) {
        const ps = new THREE.Shape();
        const ph = waterY - 2.6;
        ps.moveTo(-w / 2 - 0.4, 0);
        ps.lineTo(w / 2 + 0.4, 0);
        ps.lineTo(w / 2 + 0.4, ph);
        ps.lineTo(-w / 2 - 0.4, ph);
        ps.closePath();
        const hole = new THREE.Path();
        hole.absarc(0, ph - 3.6, 2.6, 0, TAU, true); // the ring cut-out under the deck
        ps.holes.push(hole);
        add('dock', extrude(ps, 1.6, 0.08).translate(0, 0, z), 'white', g);
      }
    }
    // the fixed gate at the dock end, with its ram, and the stow pins and U-seal
    const gate = add('dock', new THREE.BoxGeometry(D.gate.w, D.gate.h, 0.25), 'accent', g);
    const pins = [-1, 1].map(() => add('dock', new THREE.CylinderGeometry(0.16, 0.16, 1.2, 14).rotateX(Math.PI / 2), 'steel', g));
    const seal = add('dock', new THREE.TorusGeometry(T.w / 2 - 0.1, 0.16, 8, 32, Math.PI).rotateZ(Math.PI), 'dark', g);
    return {g, gate, pins, seal, waterY};
  };
  const aqueduct = chan(D.lift, D.zDock, 64, true);
  const basinChan = chan(0, D.zDock, 22, false);
  // basin, docking pit and floor
  const basin = add('dock', new THREE.BoxGeometry(70, 0.02, 90), 'water');
  basin.position.set(0, 0, 0);
  basin.receiveShadow = true;
  const pitL = D.zDock * 2;
  add('dock', new THREE.BoxGeometry(2 * D.pitHalf + 1.6, 0.6, pitL), 'concrete').position.set(0, FLOOR - 0.3, 0);
  for (const sx of [-1, 1]) add('dock', new THREE.BoxGeometry(0.8, -FLOOR - 0.6, pitL), 'concrete').position.set(sx * (D.pitHalf + 0.4), (FLOOR - 0.6) / 2, 0);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({color: PAL.floor, roughness: 0.95}));
  floor.position.y = FLOOR - 0.6;
  floor.receiveShadow = true;
  scene.add(floor);

  // ------------------------------------------------------------ pose
  const v3 = new THREE.Vector3();
  function update(a, ops = {}) {
    const P = pose(a, ops);
    wheel.rotation.z = a;
    const turnsIdler = P.idler + (OFFSETS.idler * TAU) / D.idler.teeth;
    P.caissons.forEach((C, k) => {
      const K = caissons[k];
      K.c.position.set(C.centre[0], C.centre[1], 0);
      K.c.rotation.z = C.spin;
      K.ring.rotation.z = (OFFSETS.ring * TAU) / D.ring.teeth; // relative to the level caisson: fixed
      const I = idlers[k];
      I.g.position.set(C.idler[0], C.idler[1], D.zGear);
      I.g.rotation.z = turnsIdler;
      I.hub.position.set(C.idler[0], C.idler[1], D.zGear + 0.45);
      // gate and ram: the docked caisson (bottom or top, within 2°) opens with the dock input
      const docked = Math.abs(Math.sin(a)) < 0.035;
      const open = docked ? P.gates : 0;
      const gy = T.floor + 0.3 + D.gate.h / 2 + open * (D.gate.h + 0.1);
      K.gate.position.set(0, gy, D.zEnd + 0.2);
      const top = [0, T.rim + 2.9, D.zEnd + 0.2];
      K.barrel.position.set(top[0], top[1] - 0.8, top[2]);
      const rodTop = top[1] - 1.5;
      const rodBot = gy + D.gate.h / 2;
      K.rod.position.set(0, (rodTop + rodBot) / 2, top[2]);
      K.rod.scale.y = Math.max(0.01, rodTop - rodBot);
    });
    for (const M of motors) M.pin.rotation.z = -a * ((D.bearingR - 0.1) / 0.26);
    driveRing.rotation.z = a;
    // dock ends: gates rise with the dock input; stow pins slide in; the seal swells
    for (const ch of [aqueduct, basinChan]) {
      ch.gate.position.set(0, ch.waterY - 2.1 + D.gate.h / 2 + P.gates * (D.gate.h + 0.1), D.zDock + 0.15);
      ch.pins.forEach((p, i) => p.position.set((i ? 1 : -1) * (T.w / 2 + 0.1), ch.waterY + 0.6, D.zDock - P.pins * 0.55 + 0.3));
      ch.seal.position.set(0, ch.waterY - 0.2, D.zDock - 0.15);
      ch.seal.scale.setScalar(0.6 + 0.4 * P.seal);
      ch.seal.visible = P.seal > 0.02;
    }
    void v3;
    return P;
  }

  /** Ghost every group but `keep` (0 = all solid, 1 = others at 8%). */
  function isolate(keep, k) {
    for (const [id, m] of Object.entries(mats)) {
      const g = id.split(':')[0];
      const ghost = keep && !keep.includes(g) ? k : 0;
      const tr = m.userData.baseTransparent || ghost > 0.001;
      if (tr !== m.transparent) m.needsUpdate = true;
      m.transparent = tr;
      m.opacity = (m.userData.baseOpacity ?? 1) * (1 - 0.92 * ghost);
      m.depthWrite = ghost < 0.5;
    }
  }
  return {update, isolate, groups};
}
