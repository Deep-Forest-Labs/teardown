// A stand-in player for the Bestiary sandbox, with SLUMBER's numbers from Player.asset (via the Levels board): run
// 12 m/s, jump 1.8 m at gravity -18, a double jump. WASD moves relative to the camera, Space jumps.
// Arena meshes tagged in arenas.js act on it: pad (launch), updraft (lift), hazard (hurts), slow (bile), ice (keeps
// momentum). Falling below killY respawns it.
import * as THREE from 'three';

export const PLAYER = {speed: 12, gravity: 18, jump: 1.8, doubleJump: 2.4, padPower: 19, height: 1.8};

export function createPlayer(parent) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({color: '#5fd4c8', emissive: new THREE.Color('#5fd4c8'), emissiveIntensity: 0.35, flatShading: true});
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 1.16, 2, 10), mat);
  body.position.y = 0.9;
  body.castShadow = true;
  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 0.3), new THREE.MeshStandardMaterial({color: '#0f2f2c'}));
  nose.position.set(0, 1.5, 0.3);
  g.add(body, nose);
  parent.add(g);
  const keys = new Set();
  const typing = (e) => /input|textarea|select/i.test(e.target?.tagName || '');
  addEventListener('keydown', (e) => {
    if (typing(e)) return;
    keys.add(e.code);
    if (e.code === 'Space') e.preventDefault();
  });
  addEventListener('keyup', (e) => keys.delete(e.code));
  addEventListener('blur', () => keys.clear());

  const S = {
    on: false,
    pos: new THREE.Vector3(),
    vel: new THREE.Vector3(),
    yaw: 0,
    grounded: false,
    jumps: 0,
    spawn: new THREE.Vector3(),
    hurtT: 0,
    hits: 0,
    jumpHeld: false,
    g,
  };
  const fwd = new THREE.Vector3();
  const right = new THREE.Vector3();
  const want = new THREE.Vector3();
  return {
    S,
    spawnAt(p) {
      S.spawn.copy(p);
      S.pos.copy(p);
      S.vel.set(0, 0, 0);
      g.position.copy(p);
    },
    setOn(on) {
      S.on = on;
      g.visible = on;
    },
    hurt() {
      if (S.hurtT > 0) return;
      S.hurtT = 0.6;
      S.hits++;
    },
    update(dt, ctx) {
      g.visible = S.on || ctx.showMarker;
      if (!S.on) {
        g.position.copy(S.pos);
        return;
      }
      // input relative to the camera's ground heading
      ctx.camera.getWorldDirection(fwd).setY(0).normalize();
      right.crossVectors(fwd, new THREE.Vector3(0, 1, 0));
      want.set(0, 0, 0);
      if (keys.has('KeyW') || keys.has('ArrowUp')) want.add(fwd);
      if (keys.has('KeyS') || keys.has('ArrowDown')) want.sub(fwd);
      if (keys.has('KeyD') || keys.has('ArrowRight')) want.add(right);
      if (keys.has('KeyA') || keys.has('ArrowLeft')) want.sub(right);
      if (want.lengthSq() > 0) want.normalize();
      const under = ctx.surface(S.pos.x, S.pos.z, S.pos.y + 0.5);
      const ice = under?.tag === 'ice';
      const slow = under?.tag === 'slow' ? 0.5 : 1;
      const accel = S.grounded ? (ice ? 3 : 14) : 4;
      const tx = want.x * PLAYER.speed * slow;
      const tz = want.z * PLAYER.speed * slow;
      S.vel.x += (tx - S.vel.x) * (1 - Math.exp(-accel * dt));
      S.vel.z += (tz - S.vel.z) * (1 - Math.exp(-accel * dt));
      if (want.lengthSq() > 0) S.yaw = Math.atan2(want.x, want.z);
      // jump and double jump
      const jump = keys.has('Space');
      if (jump && !S.jumpHeld) {
        if (S.grounded) {
          S.vel.y = Math.sqrt(2 * PLAYER.gravity * PLAYER.jump);
          S.jumps = 1;
        } else if (S.jumps < 2) {
          S.vel.y = Math.sqrt(2 * PLAYER.gravity * PLAYER.doubleJump);
          S.jumps = 2;
        }
      }
      S.jumpHeld = jump;
      // updrafts lift, gravity pulls
      S.vel.y -= PLAYER.gravity * dt;
      if (ctx.inUpdraft(S.pos)) S.vel.y = Math.max(S.vel.y, 7);
      // pulls from enemies (siren)
      if (ctx.pull.lengthSq() > 0) S.vel.addScaledVector(ctx.pull, dt);
      S.pos.addScaledVector(S.vel, dt);
      const ground = ctx.surface(S.pos.x, S.pos.z, S.pos.y + 0.6);
      S.grounded = false;
      if (ground && S.pos.y <= ground.y + 0.02 && S.vel.y <= 0) {
        S.pos.y = ground.y;
        S.vel.y = 0;
        S.grounded = true;
        S.jumps = 0;
        if (ground.tag === 'pad') {
          S.vel.y = PLAYER.padPower;
          S.grounded = false;
        }
        if (ground.tag === 'hazard') ctx.hurt('hazard');
      }
      if (ctx.hazardAt(S.pos)) ctx.hurt('fire');
      if (S.pos.y < ctx.killY) this.spawnAt(S.spawn);
      S.hurtT = Math.max(0, S.hurtT - dt);
      body.material.emissive.set(S.hurtT > 0 ? '#ff2a14' : '#5fd4c8');
      body.material.emissiveIntensity = S.hurtT > 0 ? 1.2 : 0.35;
      g.position.copy(S.pos);
      g.rotation.y = S.yaw;
    },
  };
}
