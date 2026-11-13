// Leviathan, the Skull Squid: the Altar fight, v1 detail pass (aiming at the teardown flagship's level of parts).
// Same fight as v0 (fights.js altar), built out: a plated skull on a squid mantle with fins, sockets, tusks and a
// hinged toothed jaw; eight ridged tentacles with sucker rows and hooked tips that grip notches in the disc's rim;
// a layered disc with rune rings and a blood channel; ripples on the blood sea. Subsystems feed the prince console.
//   Phase one: the skull surfaces through the centre pool and fires rings of shots; its eyes are open.
//   Phase two: the skull sinks; pairs of tentacles tower and slam across the disc, which tilts toward each slam;
//   a slammed tentacle lies stuck for a moment with its tip suckers open.
import * as THREE from 'three';
import {kit, M, mat, seg} from '../fights.js';

const V3 = THREE.Vector3;

export function leviathan(g) {
  const K = kit(g);
  const st = {attack: 'Dormant', slamming: '-', eyes: 'SHUT', tips: 0, tilt: 0};
  const bone = mat('#cdbf9f');
  const boneDark = mat('#a8987a');
  const plate = mat('#8f8578');
  const socket = mat('#120a0a', {roughness: 1});
  const fleshA = mat('#8c4a42');
  const fleshB = mat('#6e332d');
  const sucker = mat('#c98b7c');
  const claw = mat('#2a1c1a');

  // ------------------------------------------------------------ the sea
  const sea = K.tag(K.add(new THREE.CylinderGeometry(80, 80, 0.4, 72), M.blood, [0, -8, 0]), 'nocollide');
  const ripples = [0, 1, 2].map(() => {
    const r = new THREE.Mesh(new THREE.TorusGeometry(1, 0.12, 3, 64), new THREE.MeshBasicMaterial({color: '#a3271a', transparent: true, depthWrite: false}));
    r.rotation.x = Math.PI / 2;
    g.add(r);
    return r;
  });

  // ------------------------------------------------------------ the disc
  const tilt = K.node([0, 0, 0]);
  const disc = K.ring(7, 20, 1.6, M.stone, -1.6, tilt);
  K.ring(19.3, 20.8, 2.2, M.stone2, -1.8, tilt); // the raised lip
  for (const r of [10, 14, 17]) K.ring(r - 0.12, r + 0.12, 0.04, socket, 0.01, tilt); // rune rings
  const channel = K.ring(11.6, 12.4, 0.05, mat('#5a120d', {emissive: new THREE.Color('#a3271a'), emissiveIntensity: 0.4}), 0.0, tilt);
  K.ring(6.6, 7.4, 0.5, boneDark, -0.4, tilt); // the pool's bone lip
  for (let k = 0; k < 16; k++) {
    // rune marks on the middle ring
    const a = (k / 16) * Math.PI * 2;
    K.add(new THREE.BoxGeometry(0.25, 0.04, 1.2), socket, [Math.sin(a) * 15.5, 0.02, Math.cos(a) * 15.5], [0, a, 0], tilt);
  }
  for (let k = 0; k < 8; k++) {
    // grip notches where the tentacles hold the rim
    const a = (k / 8) * Math.PI * 2;
    K.add(new THREE.BoxGeometry(2.4, 0.6, 1.4), M.stone2, [Math.sin(a) * 20.2, 0.5, Math.cos(a) * 20.2], [0, a, 0], tilt);
  }
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
    K.tag(K.add(new THREE.CylinderGeometry(0.9, 0.9, 0.25, 12), M.pad, [Math.cos(a) * 14, 0.1, Math.sin(a) * 14], [0, 0, 0], tilt), 'pad');
  }

  // ------------------------------------------------------------ the skull on its mantle
  const body = K.node([0, -16, 0]);
  const mantle = K.add(new THREE.ConeGeometry(6.5, 16, 10), fleshB, [0, -9, -3], [-0.35, 0, 0], body);
  const fins = [-1, 1].map((sx) => K.add(new THREE.BoxGeometry(9, 0.6, 5), fleshA, [sx * 6, -13, -5], [0.2, 0, sx * 0.5], body));
  const skull = K.node([0, 0, 0], body);
  const cranium = K.add(new THREE.IcosahedronGeometry(7, 2), bone, [0, 0, 0], [0, 0, 0], skull);
  cranium.scale.set(1, 0.85, 1.1);
  // armour plates over the crown, two rows
  for (let row = 0; row < 2; row++) {
    for (let k = 0; k < 5; k++) {
      const a = -0.9 + k * 0.45;
      const el = 0.55 + row * 0.35;
      const p = new V3(Math.sin(a) * Math.cos(el), Math.sin(el), Math.cos(a) * Math.cos(el)).multiplyScalar(6.4);
      const m = K.add(new THREE.BoxGeometry(2.6, 0.5, 2.2), plate, p.toArray(), [0, 0, 0], skull);
      m.quaternion.setFromUnitVectors(new V3(0, 1, 0), p.clone().normalize()); // lies flat on the crown
    }
  }
  K.add(new THREE.BoxGeometry(9.5, 1.3, 2.4), boneDark, [0, 2.6, 6.3], [0.35, 0, 0], skull); // brow ridge
  const sockets = [-1, 1].map((sx) => K.add(new THREE.BoxGeometry(3.4, 2.4, 2.2), socket, [sx * 2.8, 1.1, 6.6], [0, sx * 0.2, 0], skull));
  K.add(new THREE.ConeGeometry(1.1, 2.4, 3), socket, [0, -0.9, 7.4], [Math.PI / 2 + 0.3, 0, 0], skull); // nasal cavity
  for (let k = 0; k < 12; k++) K.add(new THREE.ConeGeometry(0.32, 1.3, 4), bone, [-3.3 + k * 0.6, -2.6, 6.4 - Math.abs(k - 5.5) * 0.12], [Math.PI, 0, 0], skull);
  for (const sx of [-1, 1]) K.add(new THREE.ConeGeometry(0.8, 6, 6), bone, [sx * 5.4, -2.4, 4.4], [Math.PI / 2 + 0.6, sx * 0.4, 0], skull); // tusks
  for (let k = 0; k < 12; k++) K.add(new THREE.IcosahedronGeometry(0.4 + (k % 3) * 0.15, 0), boneDark, [Math.sin(k * 2.1) * 6, 2 + Math.cos(k * 1.7) * 3, -2 + Math.sin(k * 3.1) * 4], [0, 0, 0], skull); // barnacles
  const jaw = K.node([0, -3.6, 1.6], skull);
  K.add(new THREE.BoxGeometry(9, 1.8, 7.5), bone, [0, -0.9, 2.4], [0, 0, 0], jaw);
  for (let k = 0; k < 12; k++) K.add(new THREE.ConeGeometry(0.3, 1.2, 4), bone, [-3.3 + k * 0.6, 0.5, 5.6 - Math.abs(k - 5.5) * 0.12], [0, 0, 0], jaw);
  const eyes = K.weak(skull, [[2.8, 1.1, 7.8], [-2.8, 1.1, 7.8]], 1.0);

  // ------------------------------------------------------------ eight tentacles
  const arms = Array.from({length: 8}, (_, k) => {
    const a = (k / 8) * Math.PI * 2;
    const base = K.node([Math.sin(a) * 23.5, -9, Math.cos(a) * 23.5]);
    base.rotation.y = a + Math.PI; // +Z toward the centre
    const pivot = K.node([0, 0, 0], base);
    const n = 16;
    const len = 2.2;
    const links = [];
    let p = pivot;
    for (let i = 0; i < n; i++) {
      const w = 2.6 + (0.5 - 2.6) * (i / (n - 1));
      const j = K.node([0, i === 0 ? 0 : len, 0], p);
      K.add(new THREE.BoxGeometry(w, len * 1.06, w), i % 2 ? fleshA : fleshB, [0, len / 2, 0], [0, 0, 0], j);
      K.add(new THREE.BoxGeometry(w * 0.25, len * 0.8, w * 0.35), boneDark, [0, len / 2, -w * 0.6], [0, 0, 0], j); // dorsal ridge
      for (const sx of [-1, 1]) K.add(new THREE.CylinderGeometry(w * 0.22, w * 0.26, w * 0.12, 8), sucker, [sx * w * 0.24, len / 2, w * 0.52], [Math.PI / 2, 0, 0], j);
      links.push(j);
      p = j;
    }
    K.add(new THREE.ConeGeometry(0.35, 1.6, 5), claw, [0, 2.6, 0.2], [0.4, 0, 0], links[n - 1]); // hooked tip
    const tip = K.weak(links[n - 1], [[0, 1.4, 0.5], [0, 0.4, 0.5]], 0.45);
    const pose = (bend) => links.forEach((j, i) => j.rotation.set(bend(i), 0, 0));
    return {a, base, pivot, links, pose, tip, k};
  });
  const slamOf = (k, t, f) => {
    const p2 = seg(f, 1, 1.15);
    if (p2 <= 0) return 0;
    const slot = Math.floor(t / 5) % 4;
    if (k % 4 !== slot) return 0;
    const u = (t % 5) / 5;
    return p2 * (u < 0.35 ? -0.6 * (u / 0.35) : u < 0.45 ? -0.6 + 2.2 * ((u - 0.35) / 0.1) : u < 0.8 ? 1.6 : 1.6 * (1 - (u - 0.8) / 0.2));
  };

  return {
    version: 'v1',
    phases: ['Surfaced: the skull fires rings', 'Below half: tentacles slam and tilt the disc'],
    spawn: [0, 1, 12],
    killY: -6,
    cam: {target: [0, 4, 0], az: 30, el: 24, dist: 80},
    spots: () => [[15, 0.2, 2], [-8, 0.2, 12], [6, 0.2, -12], [-12, 0.2, -6], [10, 0.2, 11], [-15, 0.2, 3], [3, 0.2, 15], [12, 0.2, -11]],
    subsystems: [
      {id: 'skull', name: 'Skull and mantle', note: '14 m skull on a squid body', objs: [body], state: () => st.skull},
      {id: 'eyes', name: 'Eyes · weak points', note: 'open while surfaced', objs: [...sockets], state: () => st.eyes},
      {id: 'jaw', name: 'Jaw', note: '24 teeth, hinged', objs: [jaw], state: () => st.jaw},
      {id: 'arms', name: 'Tentacles ×8', note: '16 links, 35 m, sucker rows', objs: arms.map((A) => A.base), state: () => st.slamming},
      {id: 'tips', name: 'Tip suckers · weak points', note: 'open while a slam is stuck', objs: arms.map((A) => A.links[15]), state: () => `${st.tips} OPEN`},
      {id: 'disc', name: 'Disc', note: 'ring 7 to 20 m, tilts to slams', objs: [tilt], state: () => `TILT ${st.tilt.toFixed(1)}°`},
      {id: 'sea', name: 'Blood sea', note: 'kills below -6 m', objs: [sea, ...ripples], state: () => 'RISING'},
    ],
    readout: () => [
      ['ATTACK', st.attack],
      ['EYES', st.eyes],
      ['TILT', `${st.tilt.toFixed(1)}°`],
    ],
    update(ctx, f) {
      const t = ctx.t;
      const up = seg(f, 0, 0.12) * (1 - seg(f, 0.95, 1.1));
      body.position.y = -16 + up * (18 + Math.sin(t * 0.6) * 1.2);
      body.rotation.y = ctx.hunt ? Math.atan2(ctx.player.pos.x, ctx.player.pos.z) * 0.5 : Math.sin(t * 0.2) * 0.3;
      fins.forEach((fin, i) => (fin.rotation.z = (i ? 1 : -1) * (0.5 + 0.2 * Math.sin(t * 1.2))));
      mantle.rotation.x = -0.35 + 0.05 * Math.sin(t * 0.9);
      const bite = Math.max(0, Math.sin(t * 1.3));
      jaw.rotation.x = 0.3 * bite;
      eyes(ctx, () => up);
      st.skull = up > 0.8 ? 'SURFACED' : up > 0.05 ? 'RISING' : 'SUBMERGED';
      st.eyes = up > 0.8 ? 'OPEN' : 'SHUT';
      st.jaw = bite > 0.6 ? 'BITE' : 'OPEN';
      st.attack = up > 0.8 ? 'Ring volley every 3 s' : f >= 1 ? 'Tentacle slams in pairs' : 'Surfacing';
      if (ctx.hunt && up > 0.8 && ctx.ringTimer(3)) {
        for (let k = 0; k < 18; k++) {
          const d = new V3(Math.cos((k / 18) * Math.PI * 2), -0.08, Math.sin((k / 18) * Math.PI * 2));
          ctx.shots.fire('bolt', body.position.clone().add(new V3(0, 2, 0)), d.multiplyScalar(9), {life: 3});
        }
      }
      let tiltX = 0;
      let tiltZ = 0;
      let open = 0;
      const slamming = [];
      for (const A of arms) {
        const s = slamOf(A.k, t, f);
        const wave = (i) => 0.05 * Math.sin(t * 1.3 + A.k + i * 0.4);
        A.pivot.rotation.x = s;
        A.pose((i) => (s > 0.2 ? 0.02 + wave(i) * 0.4 : i < 4 ? wave(i) : i < 9 ? 0.2 + wave(i) : 0.32 + wave(i)));
        const stuck = s > 1.5;
        if (stuck) open += 2;
        if (s > 0.2 || s < -0.2) slamming.push(A.k + 1);
        A.tip(ctx, () => (stuck ? 1 : 0));
        if (s > 1.2) {
          tiltX += Math.cos(A.a) * 0.06;
          tiltZ -= Math.sin(A.a) * 0.06;
        }
        if (ctx.hunt && s > 1.4 && s < 1.6) {
          const dirx = -Math.sin(A.a);
          const dirz = -Math.cos(A.a);
          const px = ctx.player.pos.x - Math.sin(A.a) * 20;
          const pz = ctx.player.pos.z - Math.cos(A.a) * 20;
          const along = px * dirx + pz * dirz;
          const across = Math.abs(px * dirz - pz * dirx);
          if (along > 0 && along < 34 && across < 2.5 && ctx.player.pos.y < 3) ctx.hurt('slam');
        }
      }
      st.tips = open;
      st.slamming = slamming.length ? `SLAM ${slamming.join(' + ')}` : 'GRIPPING';
      tilt.rotation.x += (tiltX - tilt.rotation.x) * Math.min(1, ctx.dt * 2);
      tilt.rotation.z += (tiltZ - tilt.rotation.z) * Math.min(1, ctx.dt * 2);
      st.tilt = (Math.hypot(tilt.rotation.x, tilt.rotation.z) * 180) / Math.PI;
      sea.position.y = -8 + 0.3 * Math.sin(t * 0.4);
      ripples.forEach((r, i) => {
        const u = ((t * 0.12 + i / 3) % 1);
        r.scale.setScalar(24 + u * 50);
        r.position.y = sea.position.y + 0.25;
        r.material.opacity = 0.5 * (1 - u);
      });
      channel.material.emissiveIntensity = 0.3 + 0.15 * Math.sin(t * 2);
      void disc;
    },
  };
}
