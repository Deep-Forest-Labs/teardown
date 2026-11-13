// The Altar drum revolve, built from code and posed from kin.js. The drum is a lattice: columns round the wall, a
// ring at every storey, braces in every bay, a diametral truss splitting the two elevator shafts. It rides 70 wheels
// on a fixed rail and is turned by 24 motor pinions on a ring gear. Each elevator deck hangs on ropes over sheaves in
// the wall to a counterweight that rides the other way. The top half disc carries two pins that drop into the
// stage when it is pinned. The basement is cut away at the front so the machine reads.
import * as THREE from 'three';
import {D, pose} from './kin.js';

export const PAL = {bg: '#e9e3d8', floor: '#ddd5c7', white: '#ece8e1', bone: '#d9d1c2', steel: '#5d6066', dark: '#2c2d31', accent: '#d0592a', concrete: '#c4bcae', rope: '#3a3833', load: '#4a3f47'};
const TAU = Math.PI * 2;

const extrude = (shape, depth, bevel = 0.05) => new THREE.ExtrudeGeometry(shape, {depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 64});
/** A flat ring sector lying in the x-z plane at y = 0, thickness t downward. */
function sector(r0, r1, a0, a1, t) {
  const s = new THREE.Shape();
  s.absarc(0, 0, r1, a0, a1, false);
  if (r0 > 0) s.absarc(0, 0, r0, a1, a0, true);
  else s.lineTo(0, 0);
  s.closePath();
  // shape in x-y → lie it flat: rotateX(+90°) sends shape y to world +z and the depth downward
  return extrude(s, t, 0.03).rotateX(Math.PI / 2);
}
/** A box beam from a to b (world points), square section w. */
function beam(a, b, w) {
  const A = new THREE.Vector3(...a);
  const B = new THREE.Vector3(...b);
  const g = new THREE.BoxGeometry(w, A.distanceTo(B), w);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize());
  g.applyQuaternion(q);
  g.translate((A.x + B.x) / 2, (A.y + B.y) / 2, (A.z + B.z) / 2);
  return g;
}
const polar = (r, a, y) => [r * Math.cos(a), y, r * Math.sin(a)]; // matches the sector orientation

export function buildMachine(scene) {
  const groups = {};
  const mats = {};
  const matFor = (group, key) => {
    const id = `${group}:${key}`;
    if (!mats[id]) {
      const m = {
        white: () => new THREE.MeshPhysicalMaterial({color: PAL.white, roughness: 0.5, clearcoat: 0.25, clearcoatRoughness: 0.5}),
        bone: () => new THREE.MeshStandardMaterial({color: PAL.bone, roughness: 0.7}),
        steel: () => new THREE.MeshStandardMaterial({color: PAL.steel, roughness: 0.45, metalness: 0.55}),
        dark: () => new THREE.MeshStandardMaterial({color: PAL.dark, roughness: 0.6, metalness: 0.2}),
        accent: () => new THREE.MeshStandardMaterial({color: PAL.accent, roughness: 0.5}),
        concrete: () => new THREE.MeshStandardMaterial({color: PAL.concrete, roughness: 0.9}),
        rope: () => new THREE.MeshStandardMaterial({color: PAL.rope, roughness: 0.8}),
        load: () => new THREE.MeshStandardMaterial({color: PAL.load, roughness: 0.7}),
      }[key]();
      m.userData.base = {opacity: m.opacity, transparent: m.transparent};
      mats[id] = m;
    }
    return mats[id];
  };
  const add = (group, geo, key, parent = scene) => {
    const m = new THREE.Mesh(geo, matFor(group, key));
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    (groups[group] ||= []).push(m);
    return m;
  };
  const node = (parent = scene) => {
    const n = new THREE.Group();
    parent.add(n);
    return n;
  };
  const R = D.R;
  const rW = R - D.wall / 2; // wall centreline

  // ------------------------------------------------------------ stage, basement (cut away at the front), pit
  const CUT0 = -Math.PI * 0.35; // the cutaway opens the front quarter toward the camera
  const CUT1 = Math.PI * 0.35 - Math.PI; // (angles in the sector frame)
  void CUT1;
  add('stage', sector(R + 0.08, R + D.stageW, Math.PI * 0.15, Math.PI * 1.85, 0.6), 'white');
  for (let k = 1; k <= D.drop + 1; k++) {
    const y = -k * D.storey;
    const slab = add('stage', sector(R + 0.08, R + D.stageW, Math.PI * 0.62, Math.PI * 1.38, 0.5), 'concrete');
    slab.position.y = y;
  }
  const pitFloor = add('stage', new THREE.CylinderGeometry(R + D.stageW, R + D.stageW, 0.8, 64), 'concrete');
  pitFloor.position.y = -D.H - 1.2;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(600, 600).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({color: PAL.floor, roughness: 0.95}));
  floor.position.y = -D.H - 1.6;
  floor.receiveShadow = true;
  scene.add(floor);
  void CUT0;

  // ------------------------------------------------------------ fixed drive: rail, 24 motors on the ring gear
  const railY = -D.H - 0.8;
  add('drive', sector(rW - 0.5, rW + 0.5, 0, TAU, 0.3), 'steel').position.y = railY;
  const pinions = [];
  for (let k = 0; k < D.motors; k++) {
    const a = (k / D.motors) * TAU;
    const m = add('drive', new THREE.CylinderGeometry(0.35, 0.35, 1.1, 18), 'accent');
    m.position.set(...polar(R + 0.55, a, -D.H + 0.4));
    const p = add('drive', new THREE.CylinderGeometry(0.28, 0.28, 0.5, 10), 'steel');
    p.position.set(...polar(R + 0.3, a, -D.H - 0.2));
    pinions.push(p);
  }

  // ------------------------------------------------------------ the drum (turns by θ)
  const drum = node();
  const COLS = 24;
  for (let k = 0; k < COLS; k++) {
    const a = (k / COLS) * TAU;
    add('drum', beam(polar(rW, a, -D.H), polar(rW, a, 0), 0.32), 'white', drum);
    // braces in every bay, alternating
    const b = ((k + 1) / COLS) * TAU;
    for (let s = 0; s < D.storeys; s++) {
      const y0 = -D.H + s * D.storey;
      const y1 = y0 + D.storey;
      add('drum', beam(polar(rW, a, k % 2 ? y0 : y1), polar(rW, b, k % 2 ? y1 : y0), 0.14), 'bone', drum);
    }
  }
  for (let s = 0; s <= D.storeys; s++) {
    const ring = add('drum', sector(rW - 0.22, rW + 0.22, 0, TAU, 0.3), 'white', drum);
    ring.position.y = -D.H + s * D.storey + (s === 0 ? 0.3 : 0);
  }
  // the diametral truss between the two shafts (along the drum's 0..π line)
  for (let s = 0; s < D.storeys; s++) {
    const y0 = -D.H + s * D.storey;
    const y1 = y0 + D.storey;
    add('drum', beam(polar(rW, 0, y1), polar(rW, Math.PI, y1), 0.26), 'white', drum);
    add('drum', beam(polar(rW, 0, y0), polar(0, 0, y1), 0.14), 'bone', drum);
    add('drum', beam(polar(0, 0, y1), polar(rW, Math.PI, y0), 0.14), 'bone', drum);
  }
  // base: the ring gear and the 70 wheels on the rail
  add('drum', new THREE.TorusGeometry(R + 0.05, 0.18, 6, 96).rotateX(Math.PI / 2), 'steel', drum).position.y = -D.H - 0.2;
  for (let k = 0; k < D.wheels; k++) {
    const a = (k / D.wheels) * TAU;
    const w = add('drum', new THREE.CylinderGeometry(0.3, 0.3, 0.32, 14).rotateZ(Math.PI / 2), 'dark', drum);
    w.position.set(...polar(rW, a, railY + 0.45));
    w.rotation.y = a;
  }

  // ------------------------------------------------------------ elevators: decks, ropes, sheaves, counterweights
  const elev = ['A', 'B'].map((id, k) => {
    const g = node(drum);
    const a0 = k * Math.PI;
    const deck = node(g);
    add('elevators', sector(0, D.elevR, a0 + 0.004, a0 + Math.PI - 0.004, D.deckT), 'white', deck);
    // under-deck girders: radial beams every 30°, and an edge ring
    for (let j = 0; j <= 6; j++) {
      const a = a0 + (j / 6) * Math.PI;
      add('elevators', beam(polar(0.3, a, -D.deckT - 0.35), polar(D.elevR - 0.1, a, -D.deckT - 0.35), 0.4), 'bone', deck);
    }
    const mid = a0 + Math.PI / 2;
    // the sheave in the wall at the top, the counterweight in its guide below it
    const sheave = add('elevators', new THREE.CylinderGeometry(0.7, 0.7, 0.35, 24).rotateZ(Math.PI / 2), 'steel', g);
    sheave.position.set(...polar(rW, mid, D.sheaveY));
    sheave.rotation.y = mid;
    const cw = add('elevators', new THREE.BoxGeometry(0.9, D.cwH, 0.9), 'dark', g);
    const ropeDeck = add('elevators', new THREE.CylinderGeometry(0.06, 0.06, 1, 6), 'rope', g);
    const ropeCw = add('elevators', new THREE.CylinderGeometry(0.06, 0.06, 1, 6), 'rope', g);
    // the guide rails the counterweight rides
    for (const off of [-0.07, 0.07]) add('elevators', beam(polar(rW, mid + off, -D.H), polar(rW, mid + off, D.sheaveY), 0.12), 'steel', g);
    return {g, deck, sheave, cw, ropeDeck, ropeCw, mid, a0};
  });

  // ------------------------------------------------------------ the top half disc (turns by ψ) and its pins
  const top = node();
  add('top', sector(0, D.elevR, 0.004, Math.PI - 0.004, D.topT), 'white', top);
  add('top', sector(D.elevR - 0.5, D.elevR, 0.004, Math.PI - 0.004, D.topT + 0.12), 'accent', top);
  // pins on arms reaching over the fixed stage: pinned, they drop into sockets in the stage
  const PIN_R = D.R + 0.7;
  const pins = [0.12, Math.PI - 0.12].map((a) => {
    add('top', beam(polar(D.elevR - 0.6, a, 0.12), polar(PIN_R + 0.4, a, 0.12), 0.5), 'steel', top);
    const p = add('top', new THREE.CylinderGeometry(0.32, 0.32, 1.4, 16), 'accent', top);
    p.userData.a = a;
    return p;
  });
  for (const a of [0.12, Math.PI - 0.12, Math.PI + 0.12, TAU - 0.12]) add('stage', new THREE.CylinderGeometry(0.42, 0.42, 0.1, 16), 'dark').position.set(...polar(PIN_R, a, 0.02));

  // ------------------------------------------------------------ the load on deck B (placeholder for the prince)
  const load = node(elev[1].deck);
  add('load', new THREE.CylinderGeometry(4.2, 5, 5.5, 32, 1, false, 0, Math.PI).rotateY(Math.PI / 2), 'load', load).position.set(...polar(D.elevR * 0.42, Math.PI * 1.5, 2.75));
  add('load', new THREE.TorusGeometry(4.6, 0.2, 8, 48, Math.PI).rotateX(Math.PI / 2).rotateY(Math.PI / 2), 'accent', load).position.set(...polar(D.elevR * 0.42, Math.PI * 1.5, 0.4));

  // ------------------------------------------------------------ pose
  const v = new THREE.Vector3();
  const setRope = (m, a, b) => {
    const A = new THREE.Vector3(...a);
    const B = new THREE.Vector3(...b);
    m.position.copy(A).add(B).multiplyScalar(0.5);
    m.scale.y = Math.max(0.01, A.distanceTo(B));
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.sub(A).normalize());
  };
  function update(ops) {
    const P = pose(ops);
    drum.rotation.y = P.theta;
    top.rotation.y = P.psi;
    pinned = ops.pinned ?? 1;
    pins.forEach((p) => p.position.set(...polar(PIN_R, p.userData.a, 0.12 + 0.75 - 0.6 * pinned)));
    for (const pp of pinions) pp.rotation.y = -P.theta * ((R + 0.05) / 0.28);
    P.elev.forEach((E, k) => {
      const L = elev[k];
      L.deck.position.y = E.h;
      const cwMid = (E.cw.y0 + E.cw.y1) / 2;
      L.cw.position.set(...polar(rW, L.mid, cwMid));
      L.cw.rotation.y = L.mid;
      const sTop = D.sheaveY + 0.7;
      setRope(L.ropeDeck, polar(D.elevR - 0.4, L.mid, E.h), polar(rW - 0.7, L.mid, sTop));
      setRope(L.ropeCw, polar(rW, L.mid, sTop), polar(rW, L.mid, E.cw.y1));
    });
    load.visible = (ops.prince ?? 0) > 0;
    void v;
    return P;
  }
  let pinned = 1;
  function isolate(keep, k) {
    for (const [id, m] of Object.entries(mats)) {
      const g = id.split(':')[0];
      const ghost = keep && !keep.includes(g) ? k : 0;
      const tr = m.userData.base.transparent || ghost > 0.001;
      if (tr !== m.transparent) m.needsUpdate = true;
      m.transparent = tr;
      m.opacity = m.userData.base.opacity * (1 - 0.92 * ghost);
      m.depthWrite = ghost < 0.5;
    }
  }
  return {update, isolate, groups};
}
