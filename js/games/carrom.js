// Carrom — slide the striker along your baseline, pinch and pull back like a slingshot, release to strike.
import * as THREE from "three";
import * as U from "../util.js";

const A = 3.7;              // half size of the playing surface
const PR = 0.24, PIN = A - 0.26; // pocket radius + centre
const CR = 0.16, SR = 0.21; // coin / striker radius
const BASE_Z = A - 1.0, BASE_X = 2.25;
const FRICTION = 2.6, STRIKES = 15;

export default {
  id: "carrom", title: "Carrom", emoji: "🎱", color: "#ff8a1f", short: "Flick & pocket",
  desc: "Classic carrom board under a warm lamp. Slingshot the striker to sink white, black and the red queen.",
  howto: [["↔️", "Move your hand left/right to slide the striker on the baseline"], ["🤏", "Pinch, then pull your hand back toward you to aim and charge"], ["👐", "Release to strike — pocket a coin and you shoot again"], ["👑", "White 10 · Black 5 · Queen 50 · Striker in pocket −10"]],
  help: [["↔️", "Move = place striker"], ["🤏", "Pinch + pull back = aim/power"], ["👐", "Release = strike"]],

  create(ctx) {
    const { input, ui, sfx } = ctx;
    const scene = new THREE.Scene();
    scene.environment = ctx.env; scene.environmentIntensity = 0.5;
    scene.background = new THREE.Color(0x0a0610);
    const camera = new THREE.PerspectiveCamera(48, innerWidth / innerHeight, 0.1, 100);
    camera.position.set(0, 9.6, 6.6); camera.lookAt(0, 0, 0.55);
    ctx.view(scene, camera);
    ctx.bloom(0.5, 0.5, 0.85);
    scene.add(new THREE.HemisphereLight(0xffe2c0, 0x201018, 0.55));
    const lamp = new THREE.SpotLight(0xffd8a0, 420, 30, 0.75, 0.55, 1.5);
    lamp.position.set(0, 10, 0.5); lamp.castShadow = true; lamp.shadow.mapSize.set(2048, 2048); lamp.shadow.bias = -0.0003; scene.add(lamp);
    const shade = new THREE.Mesh(new THREE.ConeGeometry(1.2, 0.9, 32, 1, true), new THREE.MeshStandardMaterial({ color: 0x1a3a2a, side: THREE.DoubleSide, roughness: 0.6 }));
    shade.position.set(0, 10.4, 0.5); scene.add(shade);
    for (let i = 0; i < 18; i++) { const b = U.glowSprite(new THREE.Color().setHSL(U.rand(0.02, 0.12), 0.9, 0.6), U.rand(1, 3), 0.25); b.position.set(U.rand(-25, 25), U.rand(-6, 8), U.rand(-30, -14)); scene.add(b); }

    // board
    const boardTex = U.canvasTexture(1024, 1024, (g, w, h) => {
      g.fillStyle = "#f2d9a6"; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 120; i++) { g.strokeStyle = `rgba(160,110,50,${U.rand(0.04, 0.12)})`; g.lineWidth = U.rand(1, 3); g.beginPath(); const y = Math.random() * h; g.moveTo(0, y); g.bezierCurveTo(w / 3, y + U.rand(-10, 10), (2 * w) / 3, y + U.rand(-10, 10), w, y); g.stroke(); }
      const k = w / (2 * A), X = (x) => w / 2 + x * k, Z = (z) => h / 2 + z * k;
      g.strokeStyle = "#3a1a10"; g.lineWidth = 3;
      // centre circles
      for (const r of [0.6, 1.6]) { g.beginPath(); g.arc(X(0), Z(0), r * k, 0, 7); g.stroke(); }
      g.fillStyle = "#c81e2a"; g.beginPath(); g.arc(X(0), Z(0), 0.18 * k, 0, 7); g.fill();
      // baselines on 4 sides
      for (let s = 0; s < 4; s++) {
        g.save(); g.translate(w / 2, h / 2); g.rotate((s * Math.PI) / 2);
        const zz = BASE_Z * k;
        g.lineWidth = 3; g.beginPath(); g.moveTo(-BASE_X * k, zz - 0.16 * k); g.lineTo(BASE_X * k, zz - 0.16 * k); g.moveTo(-BASE_X * k, zz + 0.16 * k); g.lineTo(BASE_X * k, zz + 0.16 * k); g.stroke();
        for (const sx of [-1, 1]) { g.fillStyle = "#c81e2a"; g.beginPath(); g.arc(sx * BASE_X * k, zz, 0.16 * k, 0, 7); g.fill(); g.stroke(); }
        g.restore();
      }
      // diagonal arrows
      g.lineWidth = 2;
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { g.beginPath(); g.moveTo(X(sx * 1.2), Z(sz * 1.2)); g.lineTo(X(sx * 2.75), Z(sz * 2.75)); g.stroke(); g.beginPath(); g.arc(X(sx * 2.9), Z(sz * 2.9), 0.18 * k, 0, 7); g.stroke(); }
      // pockets
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { g.fillStyle = "#120806"; g.beginPath(); g.arc(X(sx * PIN), Z(sz * PIN), PR * k, 0, 7); g.fill(); }
    });
    const top = new THREE.Mesh(new THREE.BoxGeometry(2 * A, 0.2, 2 * A), [0, 0, 1, 0, 0, 0].map((i) => (i ? new THREE.MeshPhysicalMaterial({ map: boardTex, roughness: 0.25, clearcoat: 0.8, clearcoatRoughness: 0.15 }) : new THREE.MeshStandardMaterial({ color: 0x3a1a0c }))));
    top.position.y = -0.1; top.receiveShadow = true; scene.add(top);
    const woodM = new THREE.MeshStandardMaterial({ color: 0x4a200c, roughness: 0.35, metalness: 0.1 });
    for (const [w, d, x, z] of [[2 * A + 1.2, 0.6, 0, -A - 0.3], [2 * A + 1.2, 0.6, 0, A + 0.3], [0.6, 2 * A, -A - 0.3, 0], [0.6, 2 * A, A + 0.3, 0]]) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, 0.32, d), woodM); b.position.set(x, 0.06, z); b.castShadow = b.receiveShadow = true; scene.add(b);
    }
    const legM = new THREE.MeshStandardMaterial({ color: 0x2a1208 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshStandardMaterial({ color: 0x140a10, roughness: 0.9 })); floor.rotation.x = -Math.PI / 2; floor.position.y = -4; scene.add(floor);
    for (const [x, z] of [[-A, -A], [A, -A], [-A, A], [A, A]]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.4, 4, 0.4), legM); l.position.set(x, -2.1, z); scene.add(l); }

    // coins
    const coinTex = (base, ring) => U.canvasTexture(128, 128, (g, w) => { g.fillStyle = base; g.beginPath(); g.arc(64, 64, 64, 0, 7); g.fill(); g.strokeStyle = ring; g.lineWidth = 5; for (const r of [48, 30]) { g.beginPath(); g.arc(64, 64, r, 0, 7); g.stroke(); } });
    const coinMats = {
      w: [new THREE.MeshStandardMaterial({ color: 0xf2ead8, roughness: 0.4 }), new THREE.MeshStandardMaterial({ map: coinTex("#f6eedc", "#c9b89a"), roughness: 0.3 })],
      b: [new THREE.MeshStandardMaterial({ color: 0x1a1414, roughness: 0.4 }), new THREE.MeshStandardMaterial({ map: coinTex("#1e1818", "#5a4a4a"), roughness: 0.3 })],
      q: [new THREE.MeshStandardMaterial({ color: 0xc81e2a, roughness: 0.3 }), new THREE.MeshStandardMaterial({ map: coinTex("#d42230", "#ff8a8a"), roughness: 0.25, emissive: 0x400000 })],
      s: [new THREE.MeshStandardMaterial({ color: 0xe8f4ff, roughness: 0.25, metalness: 0.2 }), new THREE.MeshStandardMaterial({ map: coinTex("#eaf6ff", "#2ef2ff"), roughness: 0.2, emissive: 0x0a3040, emissiveIntensity: 0.6 })],
    };
    const coinGeo = new THREE.CylinderGeometry(CR, CR, 0.08, 32), strGeo = new THREE.CylinderGeometry(SR, SR, 0.09, 40);
    const disc = (kind) => { const m = new THREE.Mesh(kind === "s" ? strGeo : coinGeo, [coinMats[kind][0], coinMats[kind][1], coinMats[kind][0]]); m.castShadow = true; m.receiveShadow = true; scene.add(m); return m; };
    let coins = [];
    function rack() {
      for (const c of coins) scene.remove(c.m);
      coins = [];
      const add = (kind, x, z) => coins.push({ kind, m: disc(kind), x, z, vx: 0, vz: 0, r: CR, mass: 1, in: false, fall: 0 });
      add("q", 0, 0);
      for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; add(i % 2 ? "b" : "w", Math.cos(a) * CR * 2.05, Math.sin(a) * CR * 2.05); }
      for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2 + Math.PI / 12; add(i % 2 ? "w" : "b", Math.cos(a) * CR * 4.0, Math.sin(a) * CR * 4.0); }
    }
    rack();
    const striker = { kind: "s", m: disc("s"), x: 0, z: BASE_Z, vx: 0, vz: 0, r: SR, mass: 2.4, in: false, fall: 0 };

    // aim visuals
    const aimLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineDashedMaterial({ color: 0x2ef2ff, dashSize: 0.12, gapSize: 0.08, toneMapped: false }));
    const bounceLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineDashedMaterial({ color: 0x2ef2ff, dashSize: 0.08, gapSize: 0.1, transparent: true, opacity: 0.4, toneMapped: false }));
    aimLine.visible = bounceLine.visible = false; scene.add(aimLine, bounceLine);
    const powerRing = new THREE.Mesh(new THREE.RingGeometry(SR + 0.04, SR + 0.09, 48, 1, Math.PI / 2, 0.01), new THREE.MeshBasicMaterial({ color: 0xffd23f, toneMapped: false, side: THREE.DoubleSide }));
    powerRing.rotation.x = -Math.PI / 2; scene.add(powerRing);
    const glow = U.glowSprite(0x2ef2ff, 0.9, 0.5); scene.add(glow);
    const particles = new U.Particles(scene, 600);
    const texts = new U.FloatTexts(scene);

    // ---------------------------------------------------------------- state
    let running = false, phase = "place", strikes = STRIKES, score = 0, pocketedThisTurn = [], foul = false;
    let anchor = null, power = 0, dirX = 0, dirZ = -1;
    const counts = { w: 0, b: 0, q: 0 };
    const pockets = [[-PIN, -PIN], [PIN, -PIN], [-PIN, PIN], [PIN, PIN]];

    function overlapAt(x) { return coins.some((c) => !c.in && Math.hypot(c.x - x, c.z - BASE_Z) < CR + SR + 0.01); }
    function shoot() {
      const sp = 3 + power * 15;
      striker.vx = dirX * sp; striker.vz = dirZ * sp;
      phase = "moving"; pocketedThisTurn = []; foul = false;
      aimLine.visible = bounceLine.visible = false;
      sfx.clack(); sfx.whoosh();
    }

    function step(dt) {
      const all = [...coins.filter((c) => !c.in), ...(striker.in ? [] : [striker])];
      for (const b of all) {
        const sp = Math.hypot(b.vx, b.vz);
        if (sp > 0) { const ns = Math.max(0, sp - FRICTION * dt); b.vx *= ns / sp; b.vz *= ns / sp; }
        b.x += b.vx * dt; b.z += b.vz * dt;
        const lim = A - b.r;
        if (b.x < -lim) { b.x = -lim; b.vx = Math.abs(b.vx) * 0.78; if (Math.abs(b.vx) > 1) sfx.thud(); }
        if (b.x > lim) { b.x = lim; b.vx = -Math.abs(b.vx) * 0.78; if (Math.abs(b.vx) > 1) sfx.thud(); }
        if (b.z < -lim) { b.z = -lim; b.vz = Math.abs(b.vz) * 0.78; if (Math.abs(b.vz) > 1) sfx.thud(); }
        if (b.z > lim) { b.z = lim; b.vz = -Math.abs(b.vz) * 0.78; if (Math.abs(b.vz) > 1) sfx.thud(); }
        for (const [px, pz] of pockets) {
          if (Math.hypot(b.x - px, b.z - pz) < PR - b.r * 0.25) {
            b.in = true; b.fall = 0; b.vx = (px - b.x) * 3; b.vz = (pz - b.z) * 3;
            pocketedThisTurn.push(b); sfx.coin();
            particles.burst(new THREE.Vector3(px, 0.1, pz), b.kind === "q" ? 0xff3d6e : b.kind === "w" ? 0xffffff : b.kind === "s" ? 0x2ef2ff : 0x8a7dff, 25, 2.5, { size: 0.2, gravity: 2 });
            break;
          }
        }
      }
      for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
        const a = all[i], b = all[j]; if (a.in || b.in) continue;
        const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz), min = a.r + b.r;
        if (d >= min || d === 0) continue;
        const nx = dx / d, nz = dz / d;
        const overlap = (min - d) / 2; a.x -= nx * overlap; a.z -= nz * overlap; b.x += nx * overlap; b.z += nz * overlap;
        const rv = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz;
        if (rv > 0) continue;
        const e = 0.9, jimp = (-(1 + e) * rv) / (1 / a.mass + 1 / b.mass);
        a.vx -= (jimp / a.mass) * nx; a.vz -= (jimp / a.mass) * nz; b.vx += (jimp / b.mass) * nx; b.vz += (jimp / b.mass) * nz;
        if (Math.abs(rv) > 0.6) sfx.clack();
      }
    }

    function settle() {
      let gained = 0, keep = false;
      for (const c of pocketedThisTurn) {
        if (c.kind === "s") { foul = true; continue; }
        const pts = c.kind === "q" ? 50 : c.kind === "w" ? 10 : 5;
        gained += pts; counts[c.kind]++; keep = true;
        texts.spawn(`+${pts}`, new THREE.Vector3(c.x, 0.6, c.z), { color: c.kind === "q" ? "#ff3d6e" : "#ffd23f", size: 0.4 });
      }
      if (foul) {
        gained -= 10; ui.banner("FOUL −10", "#ff3d6e"); sfx.bad();
        striker.in = false; striker.m.visible = true;
      } else if (keep) ui.banner(pocketedThisTurn.some((c) => c.kind === "q") ? "QUEEN! 👑" : gained >= 20 ? "DOUBLE!" : "POCKETED!", "#ffd23f");
      score = Math.max(0, score + gained);
      if (!keep || foul) strikes--;
      else sfx.good();
      const left = coins.filter((c) => !c.in).length;
      if (left === 0 || strikes <= 0) {
        running = false; phase = "over";
        const bonus = left === 0 ? strikes * 20 : 0;
        score += bonus;
        ctx.end({ title: left === 0 ? "Board cleared! 🎉" : "Out of strikes", subtitle: bonus ? `+${bonus} bonus for strikes left` : `${19 - left} of 19 coins pocketed`, score, stats: [["White", counts.w], ["Black", counts.b], ["Queen", counts.q ? "✔" : "✘"]] });
        return;
      }
      striker.x = 0; striker.z = BASE_Z; striker.vx = striker.vz = 0;
      phase = "place";
    }

    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), _p = new THREE.Vector3();
    return {
      start() { running = true; ui.toast("Slide the striker, then pinch & pull back 🎯"); },
      update(dt) {
        const h = input.primary;
        if (running && h && !input.locked) {
          if (phase === "place") {
            const p = U.pointOnPlane(camera, h.ptr.x, h.ptr.y, plane, _p);
            if (p) striker.x = U.damp(striker.x, U.clamp(p.x, -BASE_X, BASE_X), 14, dt);
            striker.z = BASE_Z;
            if (h.pinchStart && !overlapAt(striker.x)) { phase = "aim"; anchor = { x: h.ptr.x, y: h.ptr.y }; power = 0; }
            else if (h.pinchStart) ui.toast("Striker is touching a coin — slide it a little");
          } else if (phase === "aim") {
            const dx = h.ptr.x - anchor.x, dy = h.ptr.y - anchor.y;
            const len = Math.hypot(dx, dy);
            power = U.clamp(len / (innerHeight * 0.32), 0, 1);
            if (len > 8) { dirX = -dx / len; dirZ = -dy / len; }
            if (!h.pinch) { if (power > 0.06) shoot(); else phase = "place"; }
          }
        }
        if (phase === "moving") {
          for (let i = 0; i < 10; i++) step(dt / 10);
          const moving = [...coins, striker].some((b) => !b.in && Math.hypot(b.vx, b.vz) > 0.03);
          if (!moving) settle();
        }
        // aim visuals
        const aiming = phase === "aim";
        aimLine.visible = bounceLine.visible = aiming && power > 0.02;
        if (aiming) {
          const L = 1 + power * 5;
          let ex = striker.x + dirX * L, ez = striker.z + dirZ * L;
          const pa = aimLine.geometry.attributes.position; pa.setXYZ(0, striker.x, 0.06, striker.z);
          // first wall bounce preview
          const lim = A - SR; let bx = ex, bz = ez, rx = dirX, rz = dirZ, hitT = 1;
          const tx = dirX > 0 ? (lim - striker.x) / dirX : dirX < 0 ? (-lim - striker.x) / dirX : Infinity;
          const tz = dirZ > 0 ? (lim - striker.z) / dirZ : dirZ < 0 ? (-lim - striker.z) / dirZ : Infinity;
          const tw = Math.min(tx, tz);
          if (tw < L) { ex = striker.x + dirX * tw; ez = striker.z + dirZ * tw; if (tx < tz) rx = -dirX; else rz = -dirZ; bx = ex + rx * (L - tw); bz = ez + rz * (L - tw); hitT = 0; }
          pa.setXYZ(1, ex, 0.06, ez); pa.needsUpdate = true; aimLine.computeLineDistances();
          bounceLine.visible = hitT === 0;
          const pb = bounceLine.geometry.attributes.position; pb.setXYZ(0, ex, 0.06, ez); pb.setXYZ(1, bx, 0.06, bz); pb.needsUpdate = true; bounceLine.computeLineDistances();
          aimLine.material.color.setHSL(0.5 - power * 0.5, 1, 0.6);
        }
        powerRing.visible = aiming;
        if (aiming) { powerRing.geometry.dispose(); powerRing.geometry = new THREE.RingGeometry(SR + 0.04, SR + 0.09, 48, 1, Math.PI / 2, -Math.PI * 2 * Math.max(0.01, power)); powerRing.position.set(striker.x, 0.07, striker.z); powerRing.material.color.setHSL(0.15 - power * 0.15, 1, 0.55); }
        glow.position.set(striker.x, 0.1, striker.z); glow.visible = phase === "place" || aiming;
        glow.material.color.set(phase === "place" && overlapAt(striker.x) ? 0xff3d6e : 0x2ef2ff);

        // sync meshes (falling into pockets)
        for (const b of [...coins, striker]) {
          if (b.in) {
            b.fall += dt; b.x += b.vx * dt * 0.3; b.z += b.vz * dt * 0.3;
            b.m.position.set(b.x, 0.04 - b.fall * 2, b.z); b.m.visible = b.fall < 0.5;
          } else { b.m.position.set(b.x, 0.04, b.z); b.m.visible = true; }
          b.m.rotation.y += Math.hypot(b.vx, b.vz) * dt * 0.5;
        }
        particles.update(dt); texts.update(dt);
        ui.setStats([
          { label: "SCORE", value: score, cls: "hot" },
          { label: "STRIKES", value: strikes, cls: strikes <= 3 ? "warn" : "" },
          { label: "LEFT", value: coins.filter((c) => !c.in).length },
          { label: "POWER", value: phase === "aim" ? `${Math.round(power * 100)}%` : "–", cls: "cool" },
        ]);
      },
      dispose() {},
    };
  },
};
