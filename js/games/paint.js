// Air Painting — pinch to paint glowing 3D strokes in mid-air. Move your hand closer/farther to paint in depth.
import * as THREE from "three";
import * as U from "../util.js";

const MAX = 60000;
const COLORS = ["#ff3d6e", "#ff8a1f", "#ffd23f", "#b6ff3d", "#2ef2a0", "#2ef2ff", "#4d7cff", "#9b5cff", "#ff3df2", "#ffffff", "rainbow"];
const SIZES = [["S", 0.018], ["M", 0.034], ["L", 0.065], ["XL", 0.11]];
const SYM = ["Off", "Mirror", "Kaleido ×6"];

export default {
  id: "paint", title: "Air Painting", emoji: "🎨", color: "#2ef2ff", short: "Paint in 3D space",
  desc: "Paint glowing neon sculptures in the air. Your fingertip is the brush — push your hand toward the camera to paint closer.",
  howto: [["🤏", "Pinch and move to paint"], ["↕️", "Move your hand closer/farther to paint in depth"], ["🎨", "Touch a colour orb on the left to switch colour"], ["✋", "Open palm and sweep sideways to spin your art"]],
  help: [["🤏", "Pinch = paint"], ["↕️", "Closer / farther = depth"], ["🎨", "Touch orbs = colour"], ["✋", "Open palm sweep = spin"], ["🖱️", "Mouse: drag paints, wheel = depth"]],

  create(ctx) {
    const { input, ui, sfx } = ctx;
    const scene = new THREE.Scene();
    scene.environment = ctx.env;
    scene.fog = new THREE.FogExp2(0x070516, 0.045);
    const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.05, 400);
    camera.position.set(0, 1.5, 4.4); camera.lookAt(0, 1.35, 0);
    ctx.view(scene, camera);
    ctx.bloom(1.15, 0.55, 0.15);
    U.makeSky(scene, "#020108", "#1a0f40", { stars: 600, horizon: 0.55 });
    scene.add(new THREE.HemisphereLight(0x9a8cff, 0x110820, 0.6));

    const grid = new THREE.GridHelper(40, 80, 0x5a3dff, 0x2a1a60);
    grid.material.transparent = true; grid.material.opacity = 0.35; scene.add(grid);
    const pad = new THREE.Mesh(new THREE.RingGeometry(1.4, 1.46, 96), new THREE.MeshBasicMaterial({ color: 0x2ef2ff, transparent: true, opacity: 0.5, toneMapped: false }));
    pad.rotation.x = -Math.PI / 2; pad.position.y = 0.01; scene.add(pad);

    const art = new THREE.Group(); art.position.set(0, 1.35, 0); scene.add(art);
    const dabs = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 8), new THREE.MeshBasicMaterial({ toneMapped: false }), MAX);
    dabs.frustumCulled = false;
    dabs.setColorAt(0, new THREE.Color(1, 1, 1));
    dabs.count = 0;
    art.add(dabs);

    // floating colour orbs + size orbs
    const orbs = [];
    COLORS.forEach((c, i) => {
      let mat;
      if (c === "rainbow") {
        const tex = U.canvasTexture(256, 32, (g, w, h) => { const grd = g.createLinearGradient(0, 0, w, 0); for (let k = 0; k <= 6; k++) grd.addColorStop(k / 6, `hsl(${k * 60},100%,60%)`); g.fillStyle = grd; g.fillRect(0, 0, w, h); });
        mat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
      } else mat = new THREE.MeshBasicMaterial({ color: c, toneMapped: false });
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.075, 24, 16), mat);
      scene.add(m);
      orbs.push({ m, kind: "color", value: i });
    });
    SIZES.forEach(([lab, sz], i) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.03 + sz * 0.8, 24, 16), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x444466, roughness: 0.3 }));
      scene.add(m); orbs.push({ m, kind: "size", value: i });
    });
    const selRing = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.008, 8, 40), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }));
    const sizeRing = selRing.clone(); scene.add(selRing, sizeRing);
    function layoutOrbs() {
      const ncol = COLORS.length;
      orbs.forEach((o) => {
        let sx, sy;
        if (o.kind === "color") { sx = innerWidth * 0.07; sy = innerHeight * (0.16 + (o.value / (ncol - 1)) * 0.7); }
        else { sx = innerWidth * 0.5 + (o.value - 1.5) * Math.min(90, innerWidth * 0.09); sy = innerHeight * 0.88; }
        U.pointAtDistance(camera, sx, sy, 2.2, o.m.position);
        o.sx = sx; o.sy = sy;
      });
    }
    layoutOrbs();

    // brushes (one per hand) + depth guides
    const brushes = [0, 1].map(() => {
      const tip = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false, transparent: true, opacity: 0.9 }));
      const glow = U.glowSprite(0xffffff, 0.3, 0.8);
      const shadow = new THREE.Mesh(new THREE.CircleGeometry(1, 24), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.4, depthWrite: false }));
      shadow.rotation.x = -Math.PI / 2;
      const lineGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
      const line = new THREE.Line(lineGeo, new THREE.LineDashedMaterial({ color: 0xffffff, dashSize: 0.05, gapSize: 0.05, transparent: true, opacity: 0.35 }));
      scene.add(tip, glow, shadow, line);
      return { tip, glow, shadow, line, last: null, palmX: null, active: false };
    });

    let colorIdx = 5, sizeIdx = 1, sym = 0, spin = false, hue = 0;
    const strokes = [];
    const _w = new THREE.Vector3(), _l = new THREE.Vector3(), _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _c = new THREE.Color(), _r = new THREE.Vector3();
    let minIdx = MAX, maxIdx = -1;

    function colorNow() {
      if (COLORS[colorIdx] === "rainbow") return _c.setHSL(hue % 1, 1, 0.6);
      return _c.set(COLORS[colorIdx]);
    }
    function putDab(p, size, col) {
      if (dabs.count >= MAX) return;
      const i = dabs.count++;
      _m.compose(p, _q, _s.setScalar(size));
      dabs.setMatrixAt(i, _m); dabs.setColorAt(i, col);
      minIdx = Math.min(minIdx, i); maxIdx = Math.max(maxIdx, i);
    }
    function addDab(local) {
      const size = SIZES[sizeIdx][1];
      const col = colorNow();
      putDab(local, size, col);
      if (sym === 1) putDab(_r.set(-local.x, local.y, local.z), size, col);
      if (sym === 2) for (let k = 1; k < 6; k++) { _r.copy(local).applyAxisAngle(THREE.Object3D.DEFAULT_UP, (k * Math.PI) / 3); putDab(_r, size, col); }
    }
    function flush() {
      if (maxIdx < 0) return;
      dabs.instanceMatrix.clearUpdateRanges(); dabs.instanceColor.clearUpdateRanges();
      dabs.instanceMatrix.addUpdateRange(minIdx * 16, (maxIdx - minIdx + 1) * 16);
      dabs.instanceColor.addUpdateRange(minIdx * 3, (maxIdx - minIdx + 1) * 3);
      dabs.instanceMatrix.needsUpdate = true; dabs.instanceColor.needsUpdate = true;
      minIdx = MAX; maxIdx = -1;
    }

    ui.setTools([
      { id: "undo", label: "↶ Undo", onClick: () => { if (strokes.length) { dabs.count = strokes.pop(); sfx.click(); } } },
      { id: "clear", label: "🗑 Clear", onClick: () => { dabs.count = 0; strokes.length = 0; sfx.whoosh(); } },
      { id: "sym", label: `🦋 Symmetry: ${SYM[sym]}`, onClick: () => { sym = (sym + 1) % SYM.length; ui.setTool("sym", { label: `🦋 Symmetry: ${SYM[sym]}`, on: sym > 0 }); } },
      { id: "spin", label: "🌀 Auto-spin", onClick: () => { spin = !spin; ui.setTool("spin", { on: spin }); } },
      { id: "save", label: "💾 Save picture", onClick: () => {
        const url = ctx.snapshot();
        const a = document.createElement("a"); a.href = url; a.download = `handverse-painting-${Date.now()}.png`; a.click();
        ui.toast("Saved your painting 🎨");
      } },
    ]);

    let running = false;
    return {
      start() { running = true; ui.toast("Pinch to paint ✨"); },
      resize() { layoutOrbs(); },
      update(dt, now) {
        const hands = input.hands;
        // orbs bob + selection rings
        orbs.forEach((o, i) => { o.m.rotation.y += dt; o.m.scale.setScalar(1 + Math.sin(now / 400 + i) * 0.05); });
        const co = orbs.find((o) => o.kind === "color" && o.value === colorIdx), so = orbs.find((o) => o.kind === "size" && o.value === sizeIdx);
        selRing.position.copy(co.m.position); selRing.lookAt(camera.position);
        sizeRing.position.copy(so.m.position); sizeRing.lookAt(camera.position);
        hue += dt * 0.05;

        let painting = false;
        brushes.forEach((b, slot) => {
          const h = hands[slot];
          const show = !!h;
          b.tip.visible = b.glow.visible = b.shadow.visible = b.line.visible = show;
          if (!h) { b.last = null; b.palmX = null; return; }
          // spin the art with an open palm
          if (h.gesture === "open" && !h.synthetic) {
            if (b.palmX !== null) art.rotation.y += ((h.palm.x - b.palmX) / innerWidth) * 6;
            b.palmX = h.palm.x;
            b.last = null;
          } else b.palmX = null;
          const d = 4.9 - h.depth * 2.8;
          U.pointAtDistance(camera, h.ptr.x, h.ptr.y, d, _w);
          const size = SIZES[sizeIdx][1];
          b.tip.position.copy(_w); b.tip.scale.setScalar(Math.max(size, 0.015));
          b.tip.material.color.copy(colorNow());
          b.glow.position.copy(_w); b.glow.scale.setScalar(size * 6 + 0.12); b.glow.material.color.copy(colorNow());
          b.shadow.position.set(_w.x, 0.012, _w.z); b.shadow.scale.setScalar(size * 2 + 0.03);
          const pa = b.line.geometry.attributes.position; pa.setXYZ(0, _w.x, _w.y, _w.z); pa.setXYZ(1, _w.x, 0, _w.z); pa.needsUpdate = true; b.line.computeLineDistances();

          // touching an orb changes colour/size (only when not painting)
          if (!h.pinch || h.pinchStart) {
            for (const o of orbs) {
              if (Math.hypot(h.ptr.x - o.sx, h.ptr.y - o.sy) < 34) {
                if (o.kind === "color" && colorIdx !== o.value) { colorIdx = o.value; sfx.tick(); }
                if (o.kind === "size" && sizeIdx !== o.value) { sizeIdx = o.value; sfx.tick(); }
                b.last = null; h.pinchStart = false; return;
              }
            }
          }
          if (!running || input.locked || !h.pinch) { b.last = null; return; }
          if (h.pinchStart || !b.last) strokes.push(dabs.count);
          painting = true;
          art.worldToLocal(_l.copy(_w));
          if (!b.last) { addDab(_l); b.last = _l.clone(); return; }
          const dist = _l.distanceTo(b.last);
          const step = Math.max(0.004, size * 0.4);
          const n = Math.min(80, Math.floor(dist / step));
          for (let k = 1; k <= n; k++) { addDab(_r.lerpVectors(b.last, _l, k / n).clone()); hue += step * 0.6; }
          if (n > 0) b.last.copy(_l);
        });
        flush();
        if (painting && Math.random() < 0.25) sfx.paint();
        if (spin && !hands.some((h) => h.gesture === "open")) art.rotation.y += dt * 0.4;
        pad.material.opacity = 0.35 + Math.sin(now / 600) * 0.15;
        ui.setStats([
          { label: "BRUSH", value: SIZES[sizeIdx][0], cls: "cool" },
          { label: "INK", value: `${Math.round((dabs.count / MAX) * 100)}%` },
          { label: "STROKES", value: strokes.length },
        ]);
      },
      dispose() {},
    };
  },
};
