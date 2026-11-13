// MITE MT-1 geometry in the Mellis HB-7 part language, posed from kin.js. Flesh plates over a machined core: an open
// cage thorax so the crank, rods and levers read, veined wings on hinge clips, an angular gripper under the head, a
// banded abdomen with its power cell, rod-and-ball legs. Every moving part sits on points the model solved.
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {rng} from '../kit/util.js';
import {gear, lathe, materials, rod} from '../slumber-kit/studio.js';
import {G, pose} from './kin.js';

const TAU = Math.PI * 2;
const V = (a) => new THREE.Vector3(...a);
/** Wing outline in its own (u along span, v back along chord) plane, and a vein net inside it. */
function wingParts(seed) {
  const r = rng(seed);
  const span = G.wing.span;
  const chord = G.wing.chord;
  const edge = (u) => chord * Math.sin(Math.PI * Math.min(1, u / span) ** 0.8) * (1 - 0.25 * (u / span)); // trailing edge depth
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  for (let k = 1; k <= 24; k++) s.lineTo((span * k) / 24, -0.004 * Math.sin((Math.PI * k) / 24));
  for (let k = 24; k >= 0; k--) s.lineTo((span * k) / 24, -edge((span * k) / 24));
  const membrane = new THREE.ShapeGeometry(s, 24);
  const nodes = [];
  const veins = [];
  const rows = 5;
  const cols = 9;
  const grid = [];
  for (let i = 0; i <= cols; i++) {
    grid.push([]);
    for (let j = 0; j <= rows; j++) {
      const u = (span * (i + 0.1 * (r() - 0.5))) / cols;
      const v = -edge(u) * (j / rows) * (0.92 + 0.06 * r());
      grid[i].push([u, v]);
    }
  }
  for (let i = 0; i <= cols; i++) {
    for (let j = 0; j <= rows; j++) {
      const p = grid[i][j];
      if (i < cols) veins.push(rod([p[0], 0, p[1]], [grid[i + 1][j][0], 0, grid[i + 1][j][1]], 0.0008, 4));
      if (j < rows) veins.push(rod([p[0], 0, p[1]], [grid[i][j + 1][0], 0, grid[i][j + 1][1]], 0.0008, 4));
      if (j > 0 && j < rows && i > 0) nodes.push(new THREE.SphereGeometry(0.0022, 6, 4).translate(p[0], 0, p[1]));
    }
  }
  membrane.rotateX(Math.PI / 2); // shape (u, v) → wing plane (x, z), v back along -z
  return {membrane, veins: mergeGeometries(veins), nodes: mergeGeometries(nodes), spar: rod([0, 0, 0], [span, 0, 0], 0.0055, 10)};
}

export function buildMite(parent, {detail = true} = {}) {
  const mat = materials();
  const root = new THREE.Group();
  parent.add(root);
  const groups = {};
  const part = (name) => {
    const g = new THREE.Group();
    root.add(g);
    g.userData.home = new THREE.Vector3();
    groups[name] = g;
    return g;
  };
  const add = (g, geo, m) => {
    const o = new THREE.Mesh(geo, m);
    o.castShadow = true;
    o.receiveShadow = true;
    g.add(o);
    return o;
  };
  const T = G.thorax;
  // ---------------------------------------------------------- thorax: an open cage with a dorsal flesh shield
  const thorax = part('thorax');
  for (const z of [-T.len / 2, T.len / 2]) add(thorax, new THREE.TorusGeometry(T.r, 0.012, 8, 40).translate(0, 0, z), mat.bone);
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * TAU + TAU / 16;
    if (Math.sin(a) > 0.5) continue; // the top is the shield
    add(thorax, rod([Math.cos(a) * T.r, Math.sin(a) * T.r, -T.len / 2], [Math.cos(a) * T.r, Math.sin(a) * T.r, T.len / 2], 0.007), mat.steel);
  }
  const shield = new THREE.CylinderGeometry(T.r + 0.008, T.r + 0.008, T.len + 0.02, 32, 1, true, -0.95, 1.9).rotateX(Math.PI / 2).rotateZ(Math.PI / 2);
  add(thorax, shield, mat.flesh);
  for (const z of [-T.len / 2 - 0.006, T.len / 2 + 0.006]) add(thorax, new THREE.TorusGeometry(T.r + 0.004, 0.0045, 8, 48).translate(0, 0, z), mat.accent);
  // hinge clips (dark capsules on the hinge axis, z) on posts from the cage
  for (const sx of [-1, 1]) {
    add(thorax, new THREE.CapsuleGeometry(0.013, 0.05, 4, 12).rotateX(Math.PI / 2).translate(sx * G.hinge.x, G.hinge.y, G.hinge.z), mat.dark);
    add(thorax, rod([sx * G.hinge.x, G.hinge.y, G.hinge.z - 0.03], [sx * T.r * 0.62, T.r * 0.78, G.hinge.z - 0.03], 0.006), mat.steel);
  }
  // ---------------------------------------------------------- drive: crank gear, pin, two rods, two levers (posed)
  const drive = part('drive');
  const crankGear = add(drive, gear(0.04, 18, 0.016, 0.3), mat.dark);
  crankGear.position.set(G.crank.c[0], G.crank.c[1], -0.01);
  const motor = add(drive, new THREE.CylinderGeometry(0.026, 0.026, 0.07, 20).rotateX(Math.PI / 2), mat.accent);
  motor.position.set(G.crank.c[0], G.crank.c[1], -0.055);
  const pin = add(drive, new THREE.CylinderGeometry(0.006, 0.006, 0.04, 10).rotateX(Math.PI / 2), mat.steel);
  const rods = [0, 1].map(() => add(drive, new THREE.CylinderGeometry(0.0045, 0.0045, 1, 8), mat.bone));
  const levers = [0, 1].map(() => add(drive, new THREE.BoxGeometry(1, 0.011, 0.014), mat.steel));
  // ---------------------------------------------------------- wings (each rotates about its hinge axis)
  const wings = [-1, 1].map((sx) => {
    const g = part(sx < 0 ? 'wingL' : 'wingR');
    const pivot = new THREE.Group();
    g.add(pivot);
    const W = wingParts(sx < 0 ? 11 : 12);
    const inner = new THREE.Group();
    inner.scale.x = sx; // the left wing is the right one mirrored
    pivot.add(inner);
    add(inner, W.membrane, mat.membrane).castShadow = false;
    if (detail) {
      add(inner, W.veins, mat.dark);
      add(inner, W.nodes, mat.dark);
    }
    add(inner, W.spar, mat.dark);
    pivot.position.set(sx * G.hinge.x, G.hinge.y, G.hinge.z);
    return {g, pivot, sx};
  });
  // ---------------------------------------------------------- head: capsule, two optics, the gripper underneath
  const head = part('head');
  const H = G.head;
  add(head, lathe([[0.001, -0.06], [0.06, -0.06], [H.r, -0.02], [H.r, 0.03], [0.06, 0.07], [0.001, 0.08]], 32).rotateX(Math.PI / 2).translate(0, 0.005, H.z), mat.flesh);
  add(head, new THREE.TorusGeometry(H.r + 0.001, 0.004, 8, 40).translate(0, 0.005, H.z - 0.035), mat.accent);
  for (const sx of [-1, 1]) {
    const e = new THREE.Group();
    e.position.set(sx * 0.062, 0.045, H.z + 0.02);
    e.lookAt(sx * 0.4, 0.12, H.z + 0.25);
    head.add(e);
    add(e, new THREE.CylinderGeometry(0.02, 0.022, 0.03, 24).rotateX(Math.PI / 2), mat.bone);
    add(e, new THREE.TorusGeometry(0.017, 0.0035, 8, 24).translate(0, 0, 0.015), mat.accent);
    add(e, new THREE.CircleGeometry(0.015, 24).translate(0, 0, 0.0155), new THREE.MeshPhysicalMaterial({color: '#141315', roughness: 0.08, clearcoat: 1}));
  }
  const jaw = part('jaw');
  const J = G.jaw;
  const rail = add(jaw, new THREE.BoxGeometry(0.012, 0.01, 0.06), mat.dark);
  rail.position.set(0, J.pivot[1] - 0.008, (J.slide[0] + J.slide[1]) / 2 - 0.01);
  const slider = add(jaw, new THREE.BoxGeometry(0.022, 0.016, 0.02), mat.accent);
  const toggles = [0, 1].map(() => add(jaw, new THREE.CylinderGeometry(0.004, 0.004, 1, 8), mat.steel));
  const blade = (() => {
    const s = new THREE.Shape();
    s.moveTo(0, -0.008);
    s.quadraticCurveTo(J.blade * 0.6, -0.016, J.blade, 0);
    s.quadraticCurveTo(J.blade * 0.55, 0.012, 0, 0.009);
    s.closePath();
    return new THREE.ExtrudeGeometry(s, {depth: 0.012, bevelEnabled: true, bevelSize: 0.002, bevelThickness: 0.002, bevelSegments: 1}).translate(0, 0, -0.006).rotateX(Math.PI / 2);
  })();
  const mandibles = [-1, 1].map(() => {
    const g = new THREE.Group();
    jaw.add(g);
    add(g, blade, mat.bone);
    add(g, new THREE.BoxGeometry(J.lever, 0.01, 0.01).translate(J.lever / 2, 0, 0), mat.steel).userData.lever = true;
    add(g, new THREE.CylinderGeometry(0.008, 0.008, 0.022, 14), mat.dark);
    return g;
  });
  // ---------------------------------------------------------- abdomen: banded segments, gaskets, the power cell
  const abdomen = part('abdomen');
  const A = G.abdomen;
  const nSeg = 4;
  for (let i = 0; i < nSeg; i++) {
    const z0 = A.z0 + ((A.z1 - A.z0) * i) / nSeg;
    const z1 = A.z0 + ((A.z1 - A.z0) * (i + 1)) / nSeg;
    const r0 = A.r * (1 - 0.16 * i);
    const r1 = A.r * (1 - 0.16 * (i + 1));
    const len = z0 - z1;
    add(abdomen, lathe([[0.001, 0], [r0 * 0.9, 0], [r0, 0.008], [r1 + (r0 - r1) * 0.2, len - 0.008], [r1 * 0.9, len], [0.001, len]], 32).rotateX(-Math.PI / 2).translate(0, -0.01 - i * 0.012, z0), mat.flesh);
    add(abdomen, new THREE.TorusGeometry(r0 * 0.9, 0.0045, 6, 36).translate(0, -0.01 - i * 0.012, z0 - 0.002), mat.dark);
    if (i === 1) add(abdomen, new THREE.TorusGeometry(r0 * 0.985, 0.0035, 6, 40).translate(0, -0.01 - i * 0.012, z0 - len * 0.5), mat.accent);
  }
  add(abdomen, new THREE.BoxGeometry(0.03, 0.03, 0.05).translate(0, -0.06, A.z1 + 0.01), mat.accent);
  add(abdomen, new THREE.BoxGeometry(0.034, 0.034, 0.01).translate(0, -0.06, A.z1 - 0.016), mat.dark);
  // ---------------------------------------------------------- legs (posed): femur, tibia, ball joints, claw
  const legs = part('legs');
  const legParts = Array.from({length: 6}, () => ({
    femur: add(legs, new THREE.CylinderGeometry(0.006, 0.008, 1, 8), mat.bone),
    tibia: add(legs, new THREE.CylinderGeometry(0.0045, 0.006, 1, 8), mat.bone),
    balls: [0, 1].map(() => add(legs, new THREE.SphereGeometry(0.011, 10, 8), mat.dark)),
    claw: add(legs, new THREE.ConeGeometry(0.006, 0.025, 8), mat.dark),
  }));

  // explode directions (teardown): away from the body centre
  const EX = {thorax: [0, 0.18, 0], drive: [0, -0.02, -0.05], wingL: [-0.2, 0.2, 0], wingR: [0.2, 0.2, 0], head: [0, 0.06, 0.18], jaw: [0, -0.12, 0.2], abdomen: [0, 0.02, -0.22], legs: [0, -0.18, 0]};
  for (const [k, v] of Object.entries(EX)) groups[k].userData.ex = V(v);

  const setRod = (m, a, b) => {
    const A2 = V(a);
    const B2 = V(b);
    m.position.copy(A2).add(B2).multiplyScalar(0.5);
    m.scale.set(1, Math.max(1e-4, A2.distanceTo(B2)), 1);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B2.sub(A2).normalize());
  };
  function update(theta, bite, {explode = 0} = {}) {
    const P = pose(theta, bite);
    for (const g of Object.values(groups)) g.position.copy(g.userData.ex).multiplyScalar(explode);
    crankGear.rotation.z = -theta;
    const z = G.hinge.z;
    pin.position.set(P.pin[0], P.pin[1], z);
    P.wings.forEach((W, k) => {
      setRod(rods[k], [P.pin[0], P.pin[1], z], [W.L[0], W.L[1], z]);
      levers[k].position.set((W.H[0] + W.L[0]) / 2, (W.H[1] + W.L[1]) / 2, z);
      levers[k].scale.x = G.lever;
      levers[k].rotation.z = W.lam;
      const w = wings[k];
      // the wing plane holds the span along its local x; turn it about the hinge axis (z) to the solved angle
      w.pivot.rotation.z = W.sx > 0 ? Math.atan2(W.dir[1], W.dir[0]) : Math.atan2(W.dir[1], W.dir[0]) - Math.PI;
    });
    const y = J.pivot[1];
    slider.position.set(0, y, P.zs);
    P.jaws.forEach((Jw, k) => {
      setRod(toggles[k], [Jw.S[0], y, Jw.S[1]], [Jw.T[0], y, Jw.T[1]]);
      const g = mandibles[k];
      g.position.set(Jw.Pv[0], y, Jw.Pv[1]);
      // blade along its local +x in the x-z plane: rotate about y so +x points along the blade angle
      g.rotation.y = -Jw.bladeAng;
      g.children.find((c) => c.userData.lever).rotation.y = Jw.sx > 0 ? -(Jw.mu - Jw.bladeAng) : -(Math.PI - Jw.mu - Jw.bladeAng);
    });
    P.legs.forEach((L, k) => {
      const lp = legParts[k];
      setRod(lp.femur, L.hip, L.knee);
      setRod(lp.tibia, L.knee, L.foot);
      lp.balls[0].position.set(...L.hip);
      lp.balls[1].position.set(...L.knee);
      lp.claw.position.set(...L.foot);
    });
    return P;
  }
  return {root, update, groups, mat};
}

/** A light flock body for the swarm shot: capsule body, two wing planes; instanced. */
export function buildFlock(parent, n) {
  const mat = materials();
  const body = new THREE.InstancedMesh(mergeGeometries([new THREE.CapsuleGeometry(0.09, 0.18, 4, 12).rotateX(Math.PI / 2).translate(0, -0.02, -0.17), new THREE.SphereGeometry(0.1, 14, 10), new THREE.SphereGeometry(0.08, 12, 8).translate(0, 0.005, 0.17)]), mat.flesh, n);
  const wing = new THREE.InstancedMesh(new THREE.CircleGeometry(0.22, 20).scale(1, 0.38, 1).translate(0.22, -0.05, 0).rotateX(-Math.PI / 2), mat.membrane, n * 2);
  for (const m of [body, wing]) {
    m.frustumCulled = false;
    parent.add(m);
  }
  body.castShadow = true;
  const M = new THREE.Matrix4();
  const Mw = new THREE.Matrix4();
  const Q = new THREE.Quaternion();
  return {
    set(i, p, fwd, flap) {
      const f = V(fwd).normalize();
      Q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), f);
      M.compose(V(p), Q, new THREE.Vector3(1, 1, 1));
      body.setMatrixAt(i, M);
      for (const sx of [-1, 1]) {
        Mw.makeRotationZ(sx * flap).premultiply(new THREE.Matrix4().makeScale(sx, 1, 1));
        Mw.setPosition(sx * 0.07, 0.1, 0.02);
        wing.setMatrixAt(i * 2 + (sx > 0 ? 1 : 0), M.clone().multiply(Mw));
      }
    },
    commit(count) {
      body.count = count;
      wing.count = count * 2;
      body.instanceMatrix.needsUpdate = true;
      wing.instanceMatrix.needsUpdate = true;
    },
  };
}
