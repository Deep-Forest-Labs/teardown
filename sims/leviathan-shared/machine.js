// LEVIATHAN LV-8 geometry, in Pelagos OC-8's part language, posed from kin.js. Plates and shells are flesh; the
// mechanism (cages, gaskets, wheels, drums, the cable core) stays machined. Arm segments are instanced: one unit
// geometry per part and material, scaled by the segment radius (segments keep one aspect, so the scale is uniform).
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {rng} from '../kit/util.js';
import {ARMS, armAngle, N, S, segR, WEB} from './kin.js';

export const PAL = {
  bg: '#efebe4',
  floor: '#e3ddd2',
  flesh: '#c98f84',
  fleshDeep: '#a9665e',
  bone: '#ece5d8',
  steel: '#55585e',
  dark: '#232124',
  accent: '#d24a2a',
  sea: '#5a1414',
};
const A = S.aspect; // unit segment: radius 1, length A along +Y
const TAU = Math.PI * 2;

// ------------------------------------------------------------ unit part geometries
function lathe(profile, seg = 28) {
  const g = new THREE.LatheGeometry(profile.map(([x, y]) => new THREE.Vector2(x, y)), seg);
  g.computeVertexNormals();
  return g;
}
const cylY = (r, h, y, seg = 24) => new THREE.CylinderGeometry(r, r, h, seg).translate(0, y, 0);
const cylX = (r, h, x, y, z, seg = 18) => new THREE.CylinderGeometry(r, r, h, seg).rotateZ(Math.PI / 2).translate(x, y, z);
const box = (w, h, d, x, y, z) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);
const ringY = (r, tube, y) => new THREE.TorusGeometry(r, tube, 8, 36).rotateX(Math.PI / 2).translate(0, y, 0);

function rivetRing(r, y, n, size) {
  const out = [];
  for (let k = 0; k < n; k++) {
    const a = (k / n) * TAU + 0.2;
    out.push(new THREE.SphereGeometry(size, 6, 4).translate(Math.cos(a) * r, y, Math.sin(a) * r));
  }
  return out;
}
function wheels() {
  // two rows (x = ±0.5) of wheel pairs on the up side (+Z), each on a short bracket
  const tyres = [];
  const hubs = [];
  const brackets = [];
  for (const y of [0.75, 1.85]) {
    for (const x of [-0.52, 0.52]) {
      tyres.push(cylX(0.3, 0.2, x, y, 1.02));
      hubs.push(cylX(0.17, 0.24, x, y, 1.02));
      brackets.push(box(0.12, 0.22, 0.32, x * 0.72, y, 0.86));
    }
  }
  return {tyres, hubs, brackets};
}
function shellParts() {
  const c = 0.14;
  const body = lathe([[0.001, 0.08], [0.82, 0.08], [0.95, 0.08 + c], [0.95, A - 0.08 - c], [0.82, A - 0.08], [0.001, A - 0.08]]);
  const W = wheels();
  return {
    flesh: [body],
    accent: [cylY(0.985, 0.07, 0.22), cylY(0.985, 0.07, A - 0.22), box(0.22, 0.34, 0.05, 0.42, A * 0.5, 0.86), ...W.hubs],
    dark: [box(0.06, 0.55, 0.62, 0.95, A * 0.5, -0.1), box(0.06, 0.55, 0.62, -0.95, A * 0.5, -0.1), ...rivetRing(0.955, 0.36, 14, 0.035), ...rivetRing(0.955, A - 0.36, 14, 0.035), ...W.tyres],
    steel: [...W.brackets],
  };
}
function cageParts() {
  const W = wheels();
  const rods = [];
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * TAU + 0.5;
    rods.push(new THREE.CylinderGeometry(0.055, 0.055, A - 0.5, 8).translate(Math.cos(a) * 0.82, A / 2, Math.sin(a) * 0.82));
  }
  return {
    bone: [ringY(0.86, 0.09, 0.25), ringY(0.86, 0.09, A - 0.25), cylY(0.9, 0.12, 0.12), cylY(0.9, 0.12, A - 0.12)],
    steel: [...rods, ...W.brackets],
    dark: [cylY(0.42, A - 0.6, A / 2), ...W.tyres],
    accent: [cylY(0.45, 0.16, A / 2), ...W.hubs],
  };
}
const gasket = () => new THREE.SphereGeometry(0.86, 24, 10).scale(1, 0.13, 1);

// ------------------------------------------------------------ the mantle: petals, cap, optics, core
const THETA0 = 0.3;
const THETA1 = 1.62; // the hinge circle sits at the floor
function petalGeo(R, k, n) {
  const gap = 0.035;
  const p0 = (k / n) * TAU + gap;
  const len = TAU / n - 2 * gap;
  return new THREE.SphereGeometry(R, 20, 14, p0, len, THETA0, THETA1 - THETA0);
}
function coreGeo(seed = 7) {
  const r = rng(seed);
  const tubes = [];
  for (let k = 0; k < 120; k++) {
    const pts = [];
    let p = new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).normalize().multiplyScalar(0.6 + r() * 1.6);
    for (let j = 0; j < 5; j++) {
      pts.push(p.clone());
      p = p.add(new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).multiplyScalar(1.6)).clampLength(0.4, 2.8);
    }
    tubes.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.07 + r() * 0.08, 6));
  }
  const tags = [];
  for (let k = 0; k < 26; k++) {
    const d = new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).normalize().multiplyScalar(2.2 + r() * 0.6);
    tags.push(new THREE.BoxGeometry(0.3, 0.14, 0.22).translate(d.x, d.y, d.z));
  }
  return {cable: mergeGeometries(tubes), tags: mergeGeometries(tags)};
}
function gearShape(r, n) {
  const s = new THREE.Shape();
  const m = (2 * r) / n;
  for (let k = 0; k < n; k++) {
    const c = (k / n) * TAU;
    const p = TAU / n;
    const pts = [[r - 1.25 * m, c - 0.5 * p], [r - 1.25 * m, c - 0.25 * p], [r + m, c - 0.12 * p], [r + m, c + 0.12 * p], [r - 1.25 * m, c + 0.25 * p]];
    pts.forEach(([rad, a], i) => (k === 0 && i === 0 ? s.moveTo(rad * Math.cos(a), rad * Math.sin(a)) : s.lineTo(rad * Math.cos(a), rad * Math.sin(a))));
  }
  s.closePath();
  const h = new THREE.Path();
  h.absarc(0, 0, r * 0.35, 0, TAU, true);
  s.holes.push(h);
  return s;
}

export function buildMachine(scene) {
  const mat = {
    flesh: new THREE.MeshPhysicalMaterial({color: PAL.flesh, roughness: 0.55, sheen: 0.7, sheenColor: new THREE.Color('#ffb3a2'), sheenRoughness: 0.5, clearcoat: 0.25, clearcoatRoughness: 0.45}),
    fleshDeep: new THREE.MeshPhysicalMaterial({color: PAL.fleshDeep, roughness: 0.6, sheen: 0.6, sheenColor: new THREE.Color('#ff9a8a'), clearcoat: 0.2}),
    bone: new THREE.MeshStandardMaterial({color: PAL.bone, roughness: 0.5}),
    steel: new THREE.MeshStandardMaterial({color: PAL.steel, roughness: 0.4, metalness: 0.6}),
    dark: new THREE.MeshStandardMaterial({color: PAL.dark, roughness: 0.55, metalness: 0.2}),
    accent: new THREE.MeshStandardMaterial({color: PAL.accent, roughness: 0.45, emissive: new THREE.Color(PAL.accent), emissiveIntensity: 0}),
    sea: new THREE.MeshPhysicalMaterial({color: PAL.sea, roughness: 0.12, clearcoat: 1, transparent: true, opacity: 0.92}),
    glass: new THREE.MeshPhysicalMaterial({color: '#151416', roughness: 0.08, metalness: 0.3, clearcoat: 1}),
  };
  const groups = {arms: [], web: [], mantle: [], core: [], body: []};
  const addMesh = (g, geo, m, parent = scene) => {
    const o = new THREE.Mesh(geo, m);
    o.castShadow = true;
    o.receiveShadow = true;
    parent.add(o);
    groups[g].push(o);
    return o;
  };

  // ------------------------------------------------------------ arms (instanced)
  const count = ARMS * Math.ceil(N / 2);
  const inst = (parts) =>
    Object.entries(parts).map(([key, list]) => {
      const m = new THREE.InstancedMesh(mergeGeometries(list), mat[key], count);
      m.castShadow = true;
      m.receiveShadow = true;
      m.frustumCulled = false;
      scene.add(m);
      groups.arms.push(m);
      return m;
    });
  const shells = inst(shellParts());
  const cages = inst(cageParts());
  const gaskets = new THREE.InstancedMesh(gasket(), mat.dark, ARMS * (N + 1));
  gaskets.castShadow = true;
  gaskets.frustumCulled = false;
  scene.add(gaskets);
  groups.arms.push(gaskets);
  // root actuators: a 3-axis servo drum where each arm meets the mantle
  const roots = [];
  for (let k = 0; k < ARMS; k++) {
    const g = new THREE.Group();
    scene.add(g);
    addMesh('arms', new THREE.CylinderGeometry(1.45, 1.45, 1.5, 32).rotateX(Math.PI / 2), mat.bone, g);
    addMesh('arms', new THREE.TorusGeometry(1.46, 0.09, 8, 40), mat.accent, g).position.z = 0.55;
    addMesh('arms', new THREE.TorusGeometry(1.46, 0.09, 8, 40), mat.accent, g).position.z = -0.55;
    addMesh('arms', new THREE.CylinderGeometry(0.5, 0.5, 1.8, 16).rotateX(Math.PI / 2), mat.steel, g);
    roots.push(g);
  }

  // ------------------------------------------------------------ web plates (rebuilt from their corners each frame)
  const plateMeshes = [];
  const T = 0.32; // plate thickness
  for (let k = 0; k < ARMS; k++) {
    for (let i = 0; i < WEB; i++) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(36 * 3), 3));
      const m = addMesh('web', geo, mat.flesh);
      // a raised inset panel on every plate, in the deeper flesh tone
      const inset = new THREE.BufferGeometry();
      inset.setAttribute('position', new THREE.BufferAttribute(new Float32Array(36 * 3), 3));
      m.userData.inset = addMesh('web', inset, mat.fleshDeep);
      plateMeshes.push(m);
    }
  }
  const rivets = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.09, 0.09, 0.06, 8), mat.dark, ARMS * WEB * 12);
  const hinges = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.16, 0.16, 1, 12), mat.bone, ARMS * WEB * 4);
  for (const m of [rivets, hinges]) {
    m.frustumCulled = false;
    m.castShadow = true;
    scene.add(m);
    groups.web.push(m);
  }

  // ------------------------------------------------------------ mantle dome: petals, cap, optics; the core inside
  const R = S.crownR;
  const petals = [];
  for (let k = 0; k < S.petals; k++) {
    // three.js sphere angle φ maps to my compass angle m = φ - π/2 (x = sin m, z = cos m)
    const mid = ((k + 0.5) / S.petals) * TAU - Math.PI / 2;
    // hinge on the floor circle; the petal geometry is moved so the hinge point is the pivot's origin
    const hx = R * Math.sin(THETA1) * Math.sin(mid);
    const hz = R * Math.sin(THETA1) * Math.cos(mid);
    const hy = R * Math.cos(THETA1);
    const pivot = new THREE.Group();
    pivot.position.set(hx, hy, hz);
    scene.add(pivot);
    const geo = petalGeo(R, k, S.petals).translate(-hx, -hy, -hz);
    addMesh('mantle', geo, mat.flesh, pivot);
    // rivets along the petal's edges and a seam band
    const rv = [];
    for (let j = 1; j < 9; j++) {
      const th = THETA0 + ((THETA1 - THETA0) * j) / 9;
      for (const e of [0.06, TAU / S.petals - 0.06]) {
        const ph = (k / S.petals) * TAU + e - Math.PI / 2;
        rv.push(new THREE.SphereGeometry(0.07, 6, 4).translate(R * 1.005 * Math.sin(th) * Math.sin(ph) - hx, R * 1.005 * Math.cos(th) - hy, R * 1.005 * Math.sin(th) * Math.cos(ph) - hz));
      }
    }
    addMesh('mantle', mergeGeometries(rv), mat.dark, pivot);
    pivot.userData.axis = new THREE.Vector3(Math.cos(mid), 0, -Math.sin(mid)); // tangent: the petal swings outward about it
    petals.push(pivot);
  }
  const cap = new THREE.Group();
  scene.add(cap);
  addMesh('mantle', new THREE.CylinderGeometry(R * Math.sin(THETA0) + 0.15, R * Math.sin(THETA0) + 0.35, 0.45, 32), mat.bone, cap);
  addMesh('mantle', new THREE.TorusGeometry(R * Math.sin(THETA0) + 0.2, 0.07, 8, 40).rotateX(Math.PI / 2), mat.accent, cap).position.y = -0.1;
  // two optics on the dome, Pelagos-style: drum, accent ring, glass lens, a geared iris that turns
  const eyes = [];
  for (const az of [-0.35, 0.35]) {
    const g = new THREE.Group();
    const th = 1.02;
    const n = new THREE.Vector3(Math.sin(th) * Math.sin(az), Math.cos(th), Math.sin(th) * Math.cos(az));
    g.position.copy(n.clone().multiplyScalar(R * 0.92));
    g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
    scene.add(g);
    addMesh('mantle', new THREE.CylinderGeometry(1.15, 1.25, 1.2, 36).rotateX(Math.PI / 2).translate(0, 0, 0.5), mat.bone, g);
    addMesh('mantle', new THREE.TorusGeometry(0.98, 0.12, 10, 48).translate(0, 0, 1.12), mat.accent, g);
    addMesh('mantle', new THREE.CircleGeometry(0.9, 40).translate(0, 0, 1.11), mat.glass, g);
    const iris = addMesh('mantle', new THREE.ExtrudeGeometry(gearShape(0.62, 18), {depth: 0.08, bevelEnabled: false}).translate(0, 0, 1.13), mat.dark, g);
    eyes.push({g, iris});
    // it rides the petal it sits on: find that petal
    const k = Math.floor(((((az + Math.PI / 2) % TAU) + TAU) % TAU) / (TAU / S.petals));
    g.userData.petal = k;
  }
  // re-parent the optics to their petals so they open with them
  for (const E of eyes) {
    const P = petals[E.g.userData.petal];
    P.attach(E.g);
  }
  const core = new THREE.Group();
  scene.add(core);
  const C = coreGeo();
  addMesh('core', C.cable, mat.dark, core);
  addMesh('core', C.tags, mat.accent, core);
  addMesh('core', new THREE.TorusGeometry(2.4, 0.22, 12, 64).rotateX(Math.PI / 2), mat.accent, core);

  // ------------------------------------------------------------ underside and the stretched torso
  addMesh('body', new THREE.SphereGeometry(R * 0.98, 40, 20, 0, TAU, Math.PI / 2, Math.PI / 2), mat.dark).position.y = -0.2;
  const torsoTop = -R * 0.85;
  const torsoLen = torsoTop - S.torso.bottom;
  addMesh('body', new THREE.CylinderGeometry(S.torso.r * 0.55, S.torso.r * 0.5, torsoLen, 40).translate(0, torsoTop - torsoLen / 2, 0), mat.flesh);
  for (let y = torsoTop - 2; y > S.torso.bottom; y -= 3.4) addMesh('body', new THREE.TorusGeometry(S.torso.r * 0.555, 0.14, 8, 40).rotateX(Math.PI / 2).translate(0, y, 0), mat.dark);
  const sea = new THREE.Mesh(new THREE.CircleGeometry(40, 96).rotateX(-Math.PI / 2), mat.sea); // a pool under the arena, studio beyond
  sea.position.y = S.sea;
  sea.receiveShadow = true;
  scene.add(sea);

  // ------------------------------------------------------------ pose
  const M4 = new THREE.Matrix4();
  const X = new THREE.Vector3();
  const Yv = new THREE.Vector3();
  const Zv = new THREE.Vector3();
  const Q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  function update(M, {apart = 0, apartArm = 2} = {}) {
    let ns = 0;
    let nc = 0;
    let ng = 0;
    for (const Arm of M.arms) {
      const ex = Arm.k === apartArm ? apart : 0;
      for (let i = 0; i < N; i++) {
        const J = Arm.joints[i];
        Yv.set(...J.dir);
        Zv.set(...J.up);
        X.crossVectors(Yv, Zv);
        const r = J.r;
        // pulled apart along its own chain (Pelagos "ARM APART"): each segment slides out by i·gap
        const off = ex * i * 0.9;
        M4.makeBasis(X.clone().multiplyScalar(r), Yv.clone().multiplyScalar(r), Zv.clone().multiplyScalar(r));
        M4.setPosition(J.P[0] + J.dir[0] * off, J.P[1] + J.dir[1] * off, J.P[2] + J.dir[2] * off);
        const list = i % 2 ? cages : shells;
        const n = i % 2 ? nc++ : ns++;
        for (const m of list) m.setMatrixAt(n, M4);
        // gasket at the joint
        Q.setFromUnitVectors(up, Yv);
        const gr = Math.min(r, i ? Arm.joints[i - 1].r : r);
        M4.compose(new THREE.Vector3(J.P[0] + J.dir[0] * (off - ex * 0.45), J.P[1] + J.dir[1] * (off - ex * 0.45), J.P[2] + J.dir[2] * (off - ex * 0.45)), Q, new THREE.Vector3(gr, gr * (1 + ex * 2), gr));
        gaskets.setMatrixAt(ng++, M4);
      }
      // root actuator: axis tangential, at the root
      const g = roots[Arm.k];
      const J0 = Arm.joints[0];
      g.position.set(J0.P[0] - Arm.u[0] * 0.6, J0.P[1], J0.P[2] - Arm.u[2] * 0.6);
      g.rotation.set(0, -armAngle(Arm.k) + Math.PI / 2, 0);
    }
    for (const m of [...shells, ...cages]) {
      m.count = m === shells[0] || shells.includes(m) ? ns : nc;
      m.instanceMatrix.needsUpdate = true;
    }
    gaskets.count = ng;
    gaskets.instanceMatrix.needsUpdate = true;
    // web plates
    let nr = 0;
    let nh = 0;
    M.plates.forEach((P, idx) => {
      const [a, b, c, d] = P.c.map((p) => new THREE.Vector3(...p));
      const n = new THREE.Vector3().crossVectors(b.clone().sub(a), d.clone().sub(a)).normalize();
      if (n.y < 0) n.negate();
      const lo = (v) => v.clone().addScaledVector(n, -T);
      const [a2, b2, c2, d2] = [a, b, c, d].map(lo);
      const tri = [a, b, c, a, c, d, a2, c2, b2, a2, d2, c2, a, a2, b2, a, b2, b, b, b2, c2, b, c2, c, c, c2, d2, c, d2, d, d, d2, a2, d, a2, a];
      const pos = plateMeshes[idx].geometry.attributes.position;
      tri.forEach((v, j) => pos.setXYZ(j, v.x, v.y, v.z));
      pos.needsUpdate = true;
      plateMeshes[idx].geometry.computeVertexNormals();
      plateMeshes[idx].geometry.computeBoundingSphere();
      // the inset: the plate's own quad shrunk about its centre, 0.14 m proud
      const cen = a.clone().add(b).add(c).add(d).multiplyScalar(0.25);
      const sh = (v) => cen.clone().lerp(v, 0.78).addScaledVector(n, 0.14);
      const [ia, ib, ic, id] = [a, b, c, d].map(sh);
      const [ja, jb, jc, jd] = [ia, ib, ic, id].map((v) => v.clone().addScaledVector(n, -0.16));
      const it = [ia, ib, ic, ia, ic, id, ja, jc, jb, ja, jd, jc, ia, ja, jb, ia, jb, ib, ib, jb, jc, ib, jc, ic, ic, jc, jd, ic, jd, id, id, jd, ja, id, ja, ia];
      const ip = plateMeshes[idx].userData.inset.geometry;
      it.forEach((v, j) => ip.attributes.position.setXYZ(j, v.x, v.y, v.z));
      ip.attributes.position.needsUpdate = true;
      ip.computeVertexNormals();
      ip.computeBoundingSphere();
      // rivets along both arm edges, inset; hinge knuckles on the edges
      Q.setFromUnitVectors(up, n);
      for (const [e0, e1] of [[a, d], [b, c]]) {
        const inward = (e0 === a ? b : a).clone().sub(e0).normalize().multiplyScalar(0.35);
        for (let j = 0; j < 6 && nr < rivets.count; j++) {
          const p = e0.clone().lerp(e1, (j + 0.5) / 6).add(inward).addScaledVector(n, 0.03);
          rivets.setMatrixAt(nr++, M4.compose(p, Q, new THREE.Vector3(1, 1, 1)));
        }
        const hq = new THREE.Quaternion().setFromUnitVectors(up, e1.clone().sub(e0).normalize());
        for (const f of [0.25, 0.75]) {
          const p = e0.clone().lerp(e1, f).addScaledVector(n, -T * 0.5);
          hinges.setMatrixAt(nh++, M4.compose(p, hq, new THREE.Vector3(1, e1.distanceTo(e0) * 0.3, 1)));
        }
      }
    });
    rivets.count = nr;
    hinges.count = nh;
    rivets.instanceMatrix.needsUpdate = true;
    hinges.instanceMatrix.needsUpdate = true;
    // mantle: petals swing outward about their floor hinges; the cap lifts; the core rises and swells
    petals.forEach((P) => P.setRotationFromAxisAngle(P.userData.axis, 1.15 * M.open)); // + swings the top outward
    cap.position.y = R + 0.1 + 5.5 * M.open;
    cap.rotation.y = M.open * 0.6;
    core.position.y = -0.6 + 3.2 * M.core;
    core.scale.setScalar(0.82 + 0.18 * M.core);
    core.rotation.y = M.t * 0.15;
    for (const E of eyes) E.iris.rotation.z = M.t * 0.8 * M.eyes;
    mat.accent.emissiveIntensity = 0.0 + 0.35 * M.eyes;
  }

  function isolate(keep, k) {
    for (const [g, list] of Object.entries(groups)) {
      const ghost = keep && !keep.includes(g) ? k : 0;
      for (const o of list) {
        o.visible = ghost < 0.97;
      }
    }
  }
  return {update, isolate, groups, mat};
}
