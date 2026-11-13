// The shared shell every model-first stage uses: a rig for the moving parts, weak points from the model's list,
// subsystems that isolate by rig material, and the fight contract main.js reads (range 0..3, states, checks,
// console readout). A stage supplies its kin (model, checks, STATES), its static parts and its mechanics.
import * as THREE from 'three';
import {createWeakpoints} from '../../dfl-kit/weakpoint.js';
import {kit} from '../fights.js';
import {createRig} from './rig.js';

export function stageShell(g, {mats, weakCount, weakR = 0.6, capacity = 512}) {
  const K = kit(g);
  const rigGroup = new THREE.Group();
  g.add(rigGroup);
  const rig = createRig(rigGroup, mats, capacity);
  const before = new Set(g.children);
  const weak = createWeakpoints(g, Math.max(1, weakCount), weakR);
  const weakMeshes = g.children.filter((c) => !before.has(c));
  for (const c of weakMeshes) c.userData.keepVisible = true;
  const m4 = new THREE.Matrix4();
  const pools = (keys) => keys.map((k) => Object.values(rig.pools).find((p) => p.m.userData.rigKey === k)?.m).filter(Boolean);
  return {
    K,
    rig,
    /** Draw the model's moving parts and its weak points. */
    draw(m, ctx) {
      rig.draw(m);
      for (const w of weakMeshes) w.visible = ctx.showWeak;
      if (!ctx.showWeak) return;
      weak.face(ctx.camera);
      (m.weak || []).forEach((w, i) => i < weakCount && weak.set(i, m4.makeTranslation(...w.p), {open: w.open, pulse: 0.5 + 0.5 * Math.sin(ctx.t * 5 + i)}));
      weak.commit();
    },
    /** Subsystems: each {id, name, note, keys (rig materials), objs (static parts), state()}. */
    subsystems(list) {
      for (const s of list) s.objs = [...(s.objs || []), ...pools(s.keys || [])];
      return list;
    },
  };
}

/** The fight contract for a v2 stage. */
export function stageFight({states, scale, model, checks, extra}) {
  return {
    version: 'v2',
    range: 3,
    ownsScale: true,
    states,
    phases: states.map((s) => s.name),
    stateAt: (s) => [...states].reverse().find((x) => s >= x.at - 1e-6) || states[0],
    checks: (s, t) => checks(s, t, scale),
    spots: () => model(0, 0, scale).spots,
    ...extra,
  };
}
