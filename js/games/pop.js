// Pop the Balls — AR: glossy balls float up over your camera feed; touch them with any fingertip.
import * as THREE from "three";
import * as U from "../util.js";
import { TIPS } from "../hands.js";

const COLORS = [0xff3d6e, 0xff8a1f, 0xffd23f, 0xb6ff3d, 0x2ef2a0, 0x2ef2ff, 0x4d7cff, 0x9b5cff, 0xff3df2];
const TIME = 60;

export default {
  id: "pop", title: "Pop the Balls", emoji: "🎈", color: "#ff3df2", short: "AR bubble popping",
  desc: "Colourful balls float up over your live camera. Pop them with any fingertip — both hands count!",
  howto: [["☝️", "Touch a ball with any fingertip to pop it"], ["⚡", "Pop quickly in a row for combo multipliers"], ["⭐", "Golden balls: +5 and +2 seconds"], ["💣", "Spiky black bombs cost you 5 points"]],
  help: [["🖐", "Any fingertip pops"], ["⭐", "Gold = bonus time"], ["💣", "Avoid bombs"]],

  create(ctx) {
    const { input, ui, sfx } = ctx;
    const scene = new THREE.Scene();
    scene.environment = ctx.env;
    const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 600);
    camera.position.set(0, 0, 10);
    ctx.view(scene, camera);
    const ar = ctx.ar(true);
    if (!ar) U.makeSky(scene, "#05021a", "#3a1470", { stars: 300 });
    ctx.bloom(ar ? 0.45 : 0.9, 0.4, ar ? 0.92 : 0.6);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x443366, 1.2));
    const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(-4, 6, 8); scene.add(key);

    const particles = new U.Particles(scene, 3000);
    const texts = new U.FloatTexts(scene);
    const hands3d = ar ? null : ctx.hands3d(scene, { color: 0xffffff, opacity: 0.6, near: 6, far: 8.5 });
    const tipSprites = Array.from({ length: 10 }, () => { const s = U.glowSprite(0xffffff, 0.35, 0.9); s.visible = false; s.renderOrder = 5; scene.add(s); return s; });

    const sphere = new THREE.SphereGeometry(1, 40, 24);
    const mats = COLORS.map((c) => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.06, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.05, emissive: c, emissiveIntensity: 0.18, envMapIntensity: 1.6 }));
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xffcc33, metalness: 1, roughness: 0.18, emissive: 0xff9900, emissiveIntensity: 0.3, envMapIntensity: 2 });
    const bombMat = new THREE.MeshStandardMaterial({ color: 0x1a1a22, metalness: 0.6, roughness: 0.3 });
    const spikeGeo = new THREE.ConeGeometry(0.14, 0.45, 8);
    const ringGeo = new THREE.RingGeometry(0.92, 1, 48);

    const halfH = Math.tan(THREE.MathUtils.degToRad(25)) * 10;
    let balls = [], rings = [];
    let running = false, timeLeft = TIME, score = 0, popped = 0, combo = 1, bestCombo = 1, lastPop = 0, spawnT = 0, elapsed = 0, shake = 0;

    function spawn() {
      const halfW = halfH * camera.aspect;
      const r0 = Math.random();
      const type = elapsed > 6 && r0 < 0.1 ? "bomb" : r0 > 0.93 ? "gold" : "ball";
      const r = type === "gold" ? 0.42 : type === "bomb" ? 0.55 : U.rand(0.42, 0.78);
      const z = U.rand(-1.5, 1.5);
      const m = new THREE.Mesh(sphere, type === "gold" ? goldMat : type === "bomb" ? bombMat : U.pick(mats));
      m.scale.setScalar(r);
      if (type === "bomb") {
        for (let i = 0; i < 14; i++) {
          const s = new THREE.Mesh(spikeGeo, bombMat);
          const dir = new THREE.Vector3().randomDirection();
          s.position.copy(dir).multiplyScalar(1.05); s.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir); m.add(s);
        }
        const core = U.glowSprite(0xff2040, 3.2, 0.7); m.add(core); m.userData.core = core;
      }
      if (type === "gold") { const g = U.glowSprite(0xffcc33, 3.4, 0.6); m.add(g); }
      m.position.set(U.rand(-halfW * 0.85, halfW * 0.85), -halfH - r - 0.5, z);
      scene.add(m);
      balls.push({ m, r, type, vy: U.rand(1.7, 2.7) + elapsed * 0.035, phase: Math.random() * 6, wob: U.rand(0.2, 0.6), hue: m.material.color?.getHex?.() ?? 0xffffff, dead: false });
    }

    function pop(b, now) {
      b.dead = true;
      scene.remove(b.m);
      const col = b.type === "bomb" ? 0xff3030 : b.m.material.color.getHex();
      particles.burst(b.m.position, col, b.type === "bomb" ? 80 : 45, b.type === "bomb" ? 9 : 6, { size: b.r * 0.9, life: 0.8, gravity: -5 });
      const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: col, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
      ring.position.copy(b.m.position); ring.scale.setScalar(b.r); scene.add(ring);
      rings.push({ m: ring, t: 0, r: b.r });
      if (b.type === "bomb") {
        score = Math.max(0, score - 5); combo = 1;
        sfx.boom(); ui.flash("#ff2040", 0.55); ui.banner("BOOM  −5", "#ff3d6e"); shake = 0.5;
        texts.spawn("−5", b.m.position, { color: "#ff3d6e", size: 0.7 });
        return;
      }
      combo = now - lastPop < 700 ? Math.min(combo + 1, 8) : 1;
      lastPop = now; bestCombo = Math.max(bestCombo, combo);
      const base = b.type === "gold" ? 5 : 1;
      const pts = base * combo;
      score += pts; popped++;
      if (b.type === "gold") { timeLeft += 2; sfx.coin(); texts.spawn(`+${pts}  ⏱+2`, b.m.position, { color: "#ffd23f", size: 0.6 }); }
      else texts.spawn(combo > 1 ? `+${pts} ×${combo}` : `+${pts}`, b.m.position, { color: "#ffffff", size: combo > 2 ? 0.6 : 0.45 });
      sfx.pop(1.4 - b.r * 0.6 + combo * 0.05);
      if (combo === 5) ui.banner("COMBO ×5!", "#2ef2ff");
    }

    const _sp = { x: 0, y: 0, z: 0 };
    const tips = [];
    return {
      start() { running = true; },
      update(dt, now) {
        if (running) {
          timeLeft -= dt; elapsed += dt;
          spawnT -= dt;
          if (spawnT <= 0) { spawn(); if (Math.random() < Math.min(0.5, elapsed / 60)) spawn(); spawnT = Math.max(0.28, 0.85 - elapsed / 80); }
          if (timeLeft <= 0) { running = false; timeLeft = 0; sfx.whistle(); ctx.end({ title: "Time's up!", score, stats: [["Popped", popped], ["Best combo", `×${bestCombo}`]] }); }
        }
        // fingertips (exact camera alignment so your real fingers pop the balls)
        tips.length = 0;
        for (const h of input.hands) {
          if (h.lm) for (const i of TIPS) tips.push(h.pts[i]);
          else tips.push(h.ptr);
        }
        tipSprites.forEach((s, i) => {
          const p = tips[i];
          s.visible = !!p;
          if (p) U.pointAtDistance(camera, p.x, p.y, 7, s.position);
        });
        if (hands3d) hands3d.update(input, camera);

        for (const b of balls) {
          b.m.position.y += b.vy * dt;
          b.m.position.x += Math.sin(now / 1000 * 1.3 + b.phase) * b.wob * dt;
          b.m.rotation.y += dt * 0.6;
          if (b.m.userData.core) b.m.userData.core.material.opacity = 0.4 + 0.4 * Math.sin(now / 90);
          if (running && !input.locked) {
            U.toScreen(b.m.position, camera, _sp);
            const rp = U.screenRadius(b.m.position, b.r, camera) * 1.05;
            for (const t of tips) { if ((t.x - _sp.x) ** 2 + (t.y - _sp.y) ** 2 < rp * rp) { pop(b, now); break; } }
          }
          if (b.m.position.y > halfH + 2) { b.dead = true; scene.remove(b.m); }
        }
        balls = balls.filter((b) => !b.dead);
        for (const r of rings) {
          r.t += dt; const k = r.t / 0.35;
          r.m.scale.setScalar(r.r * (1 + k * 1.6)); r.m.material.opacity = Math.max(0, 1 - k);
          r.m.lookAt(camera.position);
        }
        rings = rings.filter((r) => { if (r.t < 0.35) return true; scene.remove(r.m); r.m.material.dispose(); return false; });
        particles.update(dt); texts.update(dt);
        shake = Math.max(0, shake - dt);
        camera.position.x = (Math.random() - 0.5) * shake * 0.6; camera.position.y = (Math.random() - 0.5) * shake * 0.6;
        ui.setStats([
          { label: "SCORE", value: score, cls: "hot" },
          { label: "TIME", value: Math.ceil(timeLeft), cls: timeLeft < 10 ? "warn" : "" },
          { label: "COMBO", value: `×${combo}`, cls: "cool" },
        ]);
      },
      dispose() {},
    };
  },
};
