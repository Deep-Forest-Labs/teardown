// The bone centipede's geometry: rigid parts only, one InstancedMesh per part type, posed every frame from kin.js.
// Solid colour blocks with flat shading so the silhouette reads under a pixel filter: bone plates over dried flesh,
// spine spikes, three-bone legs with a dark spike tibia, a skull head with forcipule fangs.
import * as THREE from 'three';
import {CFG} from './kin.js';

export const COL = {
  bone: '#d6c9ab',
  boneDark: '#a8987a',
  flesh: '#5a1c16',
  fleshDark: '#3c1210',
  claw: '#231816',
  socket: '#0d0707',
  hero: '#e8b04a',
  print: '#b08a5c',
};

const flat = (c, extra = {}) => new THREE.MeshStandardMaterial({color: c, roughness: 0.82, metalness: 0, flatShading: true, ...extra});

// unit parts along +Y, centred, so tube() can stretch them between two points
const cyl = (rt, rb, seg = 6) => new THREE.CylinderGeometry(rt, rb, 1, seg, 1);

export function createBody(scene) {
  const group = new THREE.Group();
  scene.add(group);
  const nLegs = CFG.N * 2;

  const mats = {
    bone: flat(COL.bone),
    boneDark: flat(COL.boneDark),
    flesh: flat(COL.flesh),
    claw: flat(COL.claw),
    socket: flat(COL.socket, {roughness: 1}),
    hero: flat(COL.hero, {emissive: new THREE.Color(COL.hero), emissiveIntensity: 0.25}),
    print: new THREE.MeshBasicMaterial({color: COL.print, transparent: true, opacity: 0.75, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2}),
  };

  const inst = (geo, mat, n) => {
    const m = new THREE.InstancedMesh(geo, mat, n);
    m.castShadow = true;
    m.receiveShadow = true;
    m.frustumCulled = false;
    group.add(m);
    return m;
  };
  // trunk
  const plateGeo = new THREE.CylinderGeometry(0.5, 0.5, 1, 6, 1).rotateX(Math.PI / 2); // hexagonal plate along +Z
  const plates = inst(plateGeo, mats.bone, CFG.N);
  const keels = inst(new THREE.BoxGeometry(1, 1, 1), mats.boneDark, CFG.N);
  const flesh = inst(new THREE.BoxGeometry(1, 1, 1), mats.flesh, CFG.N);
  const spikes = inst(new THREE.ConeGeometry(0.5, 1, 4), mats.boneDark, CFG.N * 2);
  // legs (hero leg drawn by its own meshes so it can take the accent)
  const coxae = inst(cyl(0.05, 0.065), mats.boneDark, nLegs);
  const femurs = inst(cyl(0.045, 0.06), mats.bone, nLegs);
  const knees = inst(new THREE.IcosahedronGeometry(0.075, 0), mats.boneDark, nLegs);
  const tibias = inst(new THREE.ConeGeometry(0.055, 1, 5), mats.claw, nLegs); // tip at +Y
  const hero = {
    coxa: inst(cyl(0.05, 0.065), mats.hero, 1),
    femur: inst(cyl(0.045, 0.06), mats.hero, 1),
    knee: inst(new THREE.IcosahedronGeometry(0.075, 0), mats.hero, 1),
    tibia: inst(new THREE.ConeGeometry(0.055, 1, 5), mats.hero, 1),
  };
  // trailing legs: the last pair sweeps back, long and spiked, as in Scolopendra
  const trail = inst(new THREE.ConeGeometry(0.05, 1, 5), mats.bone, 2);
  // footprints under planted feet
  const prints = new THREE.InstancedMesh(new THREE.CircleGeometry(0.09, 8).rotateX(-Math.PI / 2), mats.print, nLegs * 3);
  prints.frustumCulled = false;
  prints.renderOrder = 1;
  group.add(prints);

  // head: a skull with brow, sockets, jaw, forcipules and antennae
  const head = new THREE.Group();
  group.add(head);
  const skull = new THREE.Group(); // the skull reads at play scale only a little oversized
  skull.scale.setScalar(1.35);
  head.add(skull);
  const part = (geo, mat, p, s = [1, 1, 1], r = [0, 0, 0]) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(...p);
    m.scale.set(...s);
    m.rotation.set(...r);
    m.castShadow = true;
    skull.add(m);
    return m;
  };
  part(new THREE.IcosahedronGeometry(0.3, 0), mats.bone, [0, 0.05, 0.02], [1.15, 0.72, 1.3]);
  part(new THREE.BoxGeometry(0.5, 0.08, 0.16), mats.boneDark, [0, 0.2, 0.2], [1, 1, 1], [0.25, 0, 0]);
  const eyeL = part(new THREE.BoxGeometry(0.11, 0.08, 0.06), mats.socket, [0.12, 0.12, 0.33]);
  const eyeR = part(new THREE.BoxGeometry(0.11, 0.08, 0.06), mats.socket, [-0.12, 0.12, 0.33]);
  part(new THREE.BoxGeometry(0.36, 0.1, 0.3), mats.boneDark, [0, -0.13, 0.12]);
  // teeth row
  for (let k = 0; k < 6; k++) part(new THREE.ConeGeometry(0.025, 0.09, 4), mats.bone, [-0.13 + k * 0.052, -0.06, 0.3], [1, 1, 1], [Math.PI, 0, 0]);
  const fang = (side) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.13, -0.12, 0.25);
    skull.add(pivot);
    const base = new THREE.Mesh(cyl(0.04, 0.06), mats.flesh);
    base.scale.set(1, 0.22, 1);
    base.position.set(0, 0, 0.1);
    base.rotation.set(Math.PI / 2, 0, 0);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.3, 4), mats.claw);
    tip.position.set(-side * 0.08, 0, 0.3);
    tip.rotation.order = 'YXZ';
    tip.rotation.set(Math.PI / 2, -side * 0.9, 0); // curves in toward the midline
    base.castShadow = tip.castShadow = true;
    pivot.add(base, tip);
    return pivot;
  };
  const fangL = fang(1);
  const fangR = fang(-1);
  const antenna = (side) => {
    const m = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.9, 4), mats.boneDark);
    m.castShadow = true;
    m.position.set(side * 0.16, 0.2, 0.62);
    m.rotation.order = 'YXZ';
    m.rotation.set(Math.PI / 2 - 0.45, side * 0.45, 0);
    skull.add(m);
    return m;
  };
  antenna(1);
  antenna(-1);

  // ------------------------------------------------------------ pose helpers
  const M = new THREE.Matrix4();
  const Q = new THREE.Quaternion();
  const V = new THREE.Vector3();
  const A = new THREE.Vector3();
  const B = new THREE.Vector3();
  const S = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0);
  const X = new THREE.Vector3();
  const Y = new THREE.Vector3();
  const Z = new THREE.Vector3();
  const tube = (mesh, i, a, b, r = 1) => {
    A.set(a[0], a[1], a[2]);
    B.set(b[0], b[1], b[2]);
    V.subVectors(B, A);
    const L = V.length();
    Q.setFromUnitVectors(UP, V.multiplyScalar(1 / (L || 1)));
    S.set(r, L, r);
    M.compose(A.add(B).multiplyScalar(0.5), Q, S);
    mesh.setMatrixAt(i, M);
  };
  /** Matrix from a forward axis and a side axis at p, scaled by s. */
  const frame = (p, fwd, side, s) => {
    Z.set(fwd[0], fwd[1], fwd[2]).normalize();
    if (side) {
      X.set(side[0], side[1], side[2]);
      X.addScaledVector(Z, -Z.dot(X)).normalize();
    } else X.crossVectors(UP, Z).normalize();
    Y.crossVectors(Z, X);
    M.makeBasis(X, Y, Z);
    M.scale(S.set(s[0], s[1], s[2]));
    M.setPosition(p[0], p[1], p[2]);
    return M;
  };
  const point = (mesh, i, p, s = 1) => {
    M.makeScale(s, s, s);
    M.setPosition(p[0], p[1], p[2]);
    mesh.setMatrixAt(i, M);
  };
  const hide = (mesh, i) => {
    M.makeScale(0, 0, 0);
    mesh.setMatrixAt(i, M);
  };

  /** ops.hero = {seg, side} or null, ops.prints true to draw footprints. */
  const update = (P, ops = {}) => {
    const H = ops.hero;
    for (const sg of P.segs) {
      const w = sg.w;
      const width = CFG.halfW * 2 * w;
      plates.setMatrixAt(sg.i, frame(add3(sg.pos, [0, 0.08, 0]), sg.fwd, sg.n, [width * 1.25, 0.16, CFG.spacing * 1.08]));
      keels.setMatrixAt(sg.i, frame(add3(sg.pos, [0, 0.17, -0.02]), sg.fwd, sg.n, [width * 0.28, 0.08, CFG.spacing * 0.8]));
      flesh.setMatrixAt(sg.i, frame(add3(sg.pos, [0, -0.04, 0]), sg.fwd, sg.n, [width * 0.8, 0.2, CFG.spacing * 0.95]));
      // two spikes per plate, raking back and out
      for (const side of [1, -1]) {
        const base = add3(add3(sg.pos, mul3(sg.n, side * width * 0.42)), [0, 0.15, 0]);
        const tip = add3(add3(base, mul3(sg.fwd, -0.16)), add3(mul3(sg.n, side * 0.08), [0, 0.17 * (0.6 + 0.4 * w), 0]));
        tube(spikes, sg.i * 2 + (side > 0 ? 0 : 1), base, mul3(add3(tip, mul3(base, -1)), 0.7).map((v, j) => v + base[j]), 0.1 * w + 0.03);
      }
    }
    let k = 0;
    let pk = 0;
    for (const L of P.legs) {
      const isHero = H && L.seg === H.seg && L.side === H.side;
      if (isHero) {
        hide(coxae, k);
        hide(femurs, k);
        hide(knees, k);
        hide(tibias, k);
        tube(hero.coxa, 0, L.hip, L.coxaEnd);
        tube(hero.femur, 0, L.coxaEnd, L.knee);
        point(hero.knee, 0, L.knee);
        tube(hero.tibia, 0, L.knee, L.foot);
      } else {
        tube(coxae, k, L.hip, L.coxaEnd);
        tube(femurs, k, L.coxaEnd, L.knee);
        point(knees, k, L.knee);
        tube(tibias, k, L.knee, L.foot);
      }
      if (ops.prints && L.stance) point(prints, pk++, [L.foot[0], 0.004, L.foot[2]], 1);
      k++;
    }
    for (const m of Object.values(hero)) m.visible = !!H;
    while (pk < prints.count) hide(prints, pk++);
    prints.visible = !!ops.prints;
    // trailing legs from the last segment
    const last = P.segs[P.segs.length - 1];
    for (const side of [1, -1]) {
      const base = add3(last.pos, mul3(last.n, side * CFG.halfW * last.w));
      const tip = add3(add3(add3(base, mul3(last.fwd, -1.05)), mul3(last.n, side * 0.42)), [0, -0.12, 0]);
      tube(trail, side > 0 ? 0 : 1, base, tip, 1.4);
    }
    // head
    const hd = P.head;
    frame(hd.pos, hd.fwd, hd.n, [1, 1, 1]);
    head.matrixAutoUpdate = false;
    head.matrix.copy(M);
    const open = hd.fangs;
    fangL.rotation.y = -0.15 + open * 0.75;
    fangR.rotation.y = 0.15 - open * 0.75;
    eyeL.scale.y = eyeR.scale.y = 1 + open * 0.4;
    for (const m of [plates, keels, flesh, spikes, coxae, femurs, knees, tibias, trail, prints, ...Object.values(hero)]) m.instanceMatrix.needsUpdate = true;
  };
  return {group, update, mats};
}

const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul3 = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
