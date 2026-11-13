// Behaviour kit for the Bestiary stand-ins: an agent that steers on the arena floor or in the air, stepping legs with
// closed-form two-bone IK and planted feet, a phase machine for tell / attack / recover loops, and projectiles.
// Everything advances by a fixed dt from main.js, so a run from the same start and the same inputs is the same run
// (the thumbnails replay Wander mode from t = 0 to a fixed time).
import * as THREE from 'three';
import {twoBone} from '../bonepede-shared/kin.js';

const V3 = THREE.Vector3;
export const tmp = {a: new V3(), b: new V3(), c: new V3()};
export const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
export const angDiff = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));

/**
 * A steering body. fly: keeps its own height; otherwise it sits on ctx.ground(). The group it drives is moved to
 * pos and turned to yaw every update.
 */
export class Agent {
  constructor(group, home, {speed = 3, turn = 3, accel = 8, fly = false, hover = 0} = {}) {
    this.g = group;
    this.home = home.clone();
    this.pos = home.clone();
    this.vel = new V3();
    this.yaw = 0;
    this.speed = speed;
    this.turn = turn;
    this.accel = accel;
    this.fly = fly;
    this.hover = hover;
    this.groundY = home.y;
  }
  /** Move toward target (a Vector3) at up to speed * mul, turning at most turn rad/s. */
  seek(target, dt, mul = 1, stopAt = 0.3) {
    const d = tmp.a.subVectors(target, this.pos);
    if (!this.fly) d.y = 0;
    const dist = d.length();
    const want = dist > stopAt ? Math.min(this.speed * mul, dist * 3) : 0;
    if (dist > 1e-3) this.face(Math.atan2(d.x, d.z), dt, mul);
    const dir = this.fly ? d.normalize() : tmp.b.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    tmp.c.copy(dir).multiplyScalar(want);
    this.vel.lerp(tmp.c, 1 - Math.exp(-this.accel * dt));
    return dist;
  }
  face(yaw, dt, mul = 1) {
    const d = angDiff(this.yaw, yaw);
    this.yaw += clamp(d, -this.turn * mul * dt, this.turn * mul * dt);
  }
  brake(dt, k = 6) {
    this.vel.multiplyScalar(Math.exp(-k * dt));
  }
  step(dt, ctx) {
    // keep a body's width from the other creatures, so chasers fan out instead of stacking on one spot
    if (!this.fly && this.speed > 0) {
      for (const o of ctx.agents) {
        const dx = this.pos.x - o.pos.x;
        const dz = this.pos.z - o.pos.z;
        const d = Math.hypot(dx, dz);
        if (d > 1e-3 && d < 2.2) {
          this.pos.x += (dx / d) * (2.2 - d) * 0.5;
          this.pos.z += (dz / d) * (2.2 - d) * 0.5;
        }
      }
    }
    this.pos.addScaledVector(this.vel, dt);
    // stay inside the arena's reach of home
    const lim = ctx.leash;
    const off = tmp.a.subVectors(this.pos, ctx.centre).setY(0);
    if (off.length() > lim) this.pos.addScaledVector(off.normalize(), lim - off.length());
    if (!this.fly) {
      const gy = ctx.ground(this.pos.x, this.pos.z, this.pos.y + 1.5);
      if (gy != null) this.groundY = gy;
      this.pos.y = this.groundY + this.hover;
    }
    this.g.position.copy(this.pos);
    this.g.rotation.set(0, this.yaw, 0);
  }
  /** Ground direction and distance to a point. */
  to(p) {
    const d = tmp.a.subVectors(p, this.pos);
    return {dist: Math.hypot(d.x, d.z), yaw: Math.atan2(d.x, d.z), dy: d.y};
  }
}

/** A loop of named phases with durations; next() moves on, at(name) tells if we are in it, k is 0..1 through it. */
export class Phases {
  constructor(order, dur) {
    this.order = order;
    this.dur = dur;
    this.i = 0;
    this.t = 0;
  }
  get name() {
    return this.order[this.i];
  }
  get k() {
    return clamp(this.t / (this.dur[this.name] || 1), 0, 1);
  }
  go(name) {
    this.i = this.order.indexOf(name);
    this.t = 0;
  }
  tick(dt) {
    this.t += dt;
    if (this.dur[this.name] != null && this.t >= this.dur[this.name]) {
      this.i = (this.i + 1) % this.order.length;
      this.t = 0;
      return true;
    }
    return false;
  }
}

/**
 * Stepping legs. defs: [{hip: [x,y,z] in the body's frame, rest: [x,z] foot offset in the body's frame, group 0|1}].
 * Feet stay planted in the world until they drift past `stride` from their rest point; then the leg steps (one
 * gait group at a time) with a lifted arc. Femur and tibia are drawn as stretched meshes in the parent's space.
 */
export function createLegs(parent, body, defs, {femur = 0.7, tibia = 0.9, stride = 0.9, stepTime = 0.22, lift = 0.35, thick = 0.07, mat, tipMat, pole = 0.6} = {}) {
  const legs = defs.map((d) => {
    const f = new THREE.Mesh(new THREE.BoxGeometry(thick, 1, thick), mat);
    const t = new THREE.Mesh(new THREE.ConeGeometry(thick * 0.8, 1, 4), tipMat || mat);
    f.castShadow = t.castShadow = true;
    parent.add(f, t);
    return {...d, f, t, foot: new V3(), from: new V3(), to: new V3(), stepping: false, s: 0, init: false};
  });
  const hipW = new V3();
  const rest = new V3();
  const up = new V3(0, 1, 0);
  const place = (mesh, a, b) => {
    tmp.a.subVectors(b, a);
    const L = tmp.a.length();
    mesh.position.copy(a).addScaledVector(tmp.a, 0.5);
    mesh.quaternion.setFromUnitVectors(up, tmp.a.multiplyScalar(1 / (L || 1)));
    mesh.scale.set(1, L, 1);
  };
  const toLocal = (v) => parent.worldToLocal(v);
  return {
    legs,
    /** Call after the body moved. ctx.ground gives the floor height. Returns how many feet are down. */
    update(dt, ctx, speedHint = 1) {
      body.updateMatrixWorld(true);
      let down = 0;
      const busy = [0, 0];
      for (const L of legs) if (L.stepping) busy[L.group]++;
      for (const L of legs) {
        hipW.set(...L.hip).applyMatrix4(body.matrixWorld);
        rest.set(L.rest[0], 0, L.rest[1]).applyMatrix4(body.matrixWorld);
        const gy = ctx.ground(rest.x, rest.z, hipW.y + 1) ?? hipW.y - femur - tibia;
        rest.y = gy;
        if (!L.init) {
          L.foot.copy(rest);
          L.init = true;
        }
        if (L.stepping) {
          L.s += dt / (stepTime / Math.max(0.6, speedHint));
          const k = clamp(L.s, 0, 1);
          L.foot.lerpVectors(L.from, L.to, k * k * (3 - 2 * k));
          L.foot.y += lift * Math.sin(Math.PI * k);
          if (k >= 1) L.stepping = false;
        } else {
          down++;
          const other = 1 - L.group;
          if (L.foot.distanceTo(rest) > stride && busy[other] === 0) {
            L.stepping = true;
            L.s = 0;
            L.from.copy(L.foot);
            // land a little past the rest point, in the direction of travel
            L.to.copy(rest).addScaledVector(tmp.a.subVectors(rest, L.foot).setY(0).normalize(), stride * 0.45);
            L.to.y = ctx.ground(L.to.x, L.to.z, hipW.y + 1) ?? rest.y;
            busy[L.group]++;
          }
        }
        // IK in world space, drawn in the parent's space
        const poleW = tmp.b.copy(hipW).sub(body.getWorldPosition(tmp.c)).setY(0).normalize().multiplyScalar(pole).add(up);
        const {knee, foot} = twoBone(hipW.toArray(), L.foot.toArray(), femur, tibia, poleW.toArray());
        const kW = toLocal(new V3(...knee));
        const fW = toLocal(new V3(...foot));
        const hL = toLocal(hipW.clone());
        place(L.f, hL, kW);
        place(L.t, kW, fW);
      }
      return down;
    },
    reset() {
      for (const L of legs) L.init = L.stepping = false;
    },
  };
}

/** Simple ballistic projectiles with an impact callback. */
export function createShots(parent) {
  const live = [];
  const geo = {
    bolt: new THREE.IcosahedronGeometry(0.22, 0),
    coin: new THREE.CylinderGeometry(0.12, 0.12, 0.03, 8),
    blob: new THREE.IcosahedronGeometry(0.35, 0),
    lance: new THREE.ConeGeometry(0.08, 1.8, 4),
  };
  const mat = {
    bolt: new THREE.MeshBasicMaterial({color: '#ff4a24'}),
    coin: new THREE.MeshStandardMaterial({color: '#e8c75a', metalness: 0.6, roughness: 0.35, flatShading: true}),
    blob: new THREE.MeshStandardMaterial({color: '#8a1a10', emissive: new THREE.Color('#c0281c'), emissiveIntensity: 0.5, flatShading: true}),
    lance: new THREE.MeshStandardMaterial({color: '#bfe1f2', emissive: new THREE.Color('#9fd0ff'), emissiveIntensity: 0.6, flatShading: true}),
  };
  const decals = [];
  const decalGeo = new THREE.CircleGeometry(1, 16).rotateX(-Math.PI / 2);
  return {
    fire(kind, from, vel, {gravity = 0, life = 4, onHit = null, radius = 0.5} = {}) {
      const m = new THREE.Mesh(geo[kind], mat[kind]);
      m.castShadow = true;
      m.position.copy(from);
      parent.add(m);
      live.push({m, vel: vel.clone(), gravity, life, onHit, radius, kind});
    },
    /** A floor pool that fades; hurts while it lasts if ctx.hurtAt checks it. */
    pool(at, r, color, life = 4) {
      const m = new THREE.Mesh(decalGeo, new THREE.MeshBasicMaterial({color, transparent: true, opacity: 0.7, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2}));
      m.position.copy(at).setY(at.y + 0.03);
      m.scale.setScalar(r);
      parent.add(m);
      decals.push({m, life, max: life, r});
    },
    pools: decals,
    update(dt, ctx) {
      for (let i = live.length - 1; i >= 0; i--) {
        const s = live[i];
        s.vel.y -= s.gravity * dt;
        s.m.position.addScaledVector(s.vel, dt);
        if (s.kind === 'lance') s.m.quaternion.setFromUnitVectors(new V3(0, 1, 0), s.vel.clone().normalize());
        else s.m.rotation.x += dt * 8;
        s.life -= dt;
        const gy = ctx.ground(s.m.position.x, s.m.position.z, s.m.position.y + 0.5);
        const hitGround = gy != null && s.m.position.y <= gy + 0.05;
        const hitPlayer = ctx.player.on && s.m.position.distanceTo(ctx.player.pos) < s.radius + 0.5 && Math.abs(s.m.position.y - (ctx.player.pos.y + 0.9)) < 1.2;
        if (hitPlayer) ctx.hurt(s.kind);
        if (s.life <= 0 || hitGround || hitPlayer) {
          if ((hitGround || hitPlayer) && s.onHit) s.onHit(s.m.position.clone());
          parent.remove(s.m);
          live.splice(i, 1);
        }
      }
      for (let i = decals.length - 1; i >= 0; i--) {
        const d = decals[i];
        d.life -= dt;
        d.m.material.opacity = 0.7 * clamp(d.life / d.max, 0, 1);
        if (ctx.player.on && d.m.position.distanceTo(tmp.a.copy(ctx.player.pos).setY(d.m.position.y)) < d.r && Math.abs(ctx.player.pos.y - d.m.position.y) < 0.5) ctx.hurt('pool');
        if (d.life <= 0) {
          parent.remove(d.m);
          decals.splice(i, 1);
        }
      }
    },
  };
}

/** Lead a moving target: where to aim a shot of `speed` from `from`. */
export function lead(from, target, targetVel, speed) {
  const t = from.distanceTo(target) / speed;
  return target.clone().addScaledVector(targetVel, t * 0.8);
}
