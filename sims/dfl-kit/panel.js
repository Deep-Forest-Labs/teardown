// A small controls panel for the live sketch pages: sliders, buttons and a key hint, bottom right. Plus click picking
// against a list of meshes (InstancedMesh hits report their instance id).
import * as THREE from 'three';

export function createPanel(app) {
  const panel = document.createElement('div');
  panel.style.cssText =
    'position:absolute;right:40px;bottom:40px;width:320px;padding:14px 16px;background:rgba(20,16,20,.85);border:1px solid #3a3133;color:#e8dcc4;font:13px "JetBrains Mono",monospace;display:grid;gap:8px;pointer-events:auto;z-index:5';
  app.append(panel);
  const row = () => {
    const r = document.createElement('div');
    r.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px';
    panel.append(r);
    return r;
  };
  let btnRow = null;
  return {
    el: panel,
    slider(label, min, max, step, get, set) {
      const r = document.createElement('label');
      r.style.cssText = 'display:grid;grid-template-columns:96px 1fr 44px;gap:8px;align-items:center';
      const out = document.createElement('span');
      const inp = Object.assign(document.createElement('input'), {type: 'range', min, max, step, value: get()});
      const show = () => (out.textContent = Number(get()).toFixed(2));
      inp.addEventListener('input', () => {
        set(Number(inp.value));
        show();
      });
      show();
      r.append(label, inp, out);
      panel.append(r);
      btnRow = null;
    },
    button(label, fn) {
      if (!btnRow) btnRow = row();
      const b = document.createElement('button');
      b.textContent = label;
      b.style.cssText = 'font:inherit;color:#e8dcc4;background:#2a2226;border:1px solid #5a4a48;border-radius:3px;padding:5px 9px;cursor:pointer';
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        fn();
      });
      btnRow.append(b);
      return b;
    },
    note(text) {
      const n = document.createElement('div');
      n.style.cssText = 'opacity:.7;line-height:1.55';
      n.textContent = text;
      panel.append(n);
      btnRow = null;
    },
  };
}

/** Calls onPick(hit or null, ray) for a click (not a drag); hit is the nearest of the meshes ({object, instanceId, point}). */
export function onClickPick(canvas, camera, meshes, onPick) {
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let down = null;
  canvas.addEventListener('pointerdown', (e) => (down = [e.clientX, e.clientY]));
  canvas.addEventListener('pointerup', (e) => {
    if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5) return;
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const list = meshes();
    // instances move every frame: refresh the cached bounds three uses to skip a whole InstancedMesh
    for (const m of list) if (m.isInstancedMesh) m.computeBoundingSphere();
    const hits = ray.intersectObjects(list, true);
    onPick(hits[0] ?? null, ray);
  });
}
