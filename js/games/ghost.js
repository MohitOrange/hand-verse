// Ghost Room — a haunted room in the dark. Your hand is a flashlight: hold the beam on ghosts to banish them.
import * as THREE from "three";
import * as U from "../util.js";
import { ghostMesh } from "../icons.js";

const RS = 12, RH = 4;

export default {
  id: "ghost", title: "Ghost Room", emoji: "👻", color: "#9b5cff", short: "Flashlight ghost hunt",
  desc: "The lights are out and the room is haunted. Your hand is a flashlight — find the ghosts and burn them away before they reach you.",
  howto: [["🔦", "Point your hand to aim the flashlight"], ["👻", "Hold the beam on a ghost to banish it"], ["🤏", "Pinch for a UV blast (uses energy, burns 3× faster)"], ["↔️", "Point near the screen edges (or open palm) to turn around"]],
  help: [["🔦", "Aim = flashlight"], ["🤏", "Pinch = UV blast"], ["↔️", "Screen edge / palm = turn"], ["❤️", "Don't let them touch you"]],

  create(ctx) {
    const { input, ui, sfx } = ctx;
    const scene = new THREE.Scene();
    scene.environment = ctx.env; scene.environmentIntensity = 0.05;
    scene.background = new THREE.Color(0x020106);
    scene.fog = new THREE.FogExp2(0x020106, 0.09);
    const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.05, 60);
    camera.position.set(0, 1.6, 0);
    scene.add(camera);
    ctx.view(scene, camera);
    ctx.bloom(0.9, 0.6, 0.55);
    ctx.startAmbient("ghost");

    const hemi = new THREE.HemisphereLight(0x4050a0, 0x100510, 0.06); scene.add(hemi);
    const moon = new THREE.DirectionalLight(0x6a88ff, 0.25); moon.position.set(-6, 5, -10); scene.add(moon);

    // flashlight
    const torch = new THREE.SpotLight(0xfff1d6, 260, 22, 0.3, 0.45, 1.4);
    torch.castShadow = true; torch.shadow.mapSize.set(1024, 1024); torch.shadow.bias = -0.0008;
    torch.position.set(0.25, -0.25, 0); camera.add(torch); scene.add(torch.target);
    const coneMat = new THREE.MeshBasicMaterial({ color: 0xfff1d6, transparent: true, opacity: 0.06, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const cone = new THREE.Mesh(new THREE.ConeGeometry(2.1, 7, 32, 1, true).translate(0, -3.5, 0).rotateX(Math.PI / 2), coneMat);
    camera.add(cone);
    const torchBody = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.045, 0.28, 16).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.8, roughness: 0.3 }));
    camera.add(torchBody);

    // room
    const woodTex = U.canvasTexture(512, 512, (g, w, h) => {
      for (let i = 0; i < 8; i++) { g.fillStyle = `hsl(25,35%,${12 + (i % 3) * 2}%)`; g.fillRect(0, (i * h) / 8, w, h / 8 - 2); }
      for (let i = 0; i < 2000; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.25})`; g.fillRect(Math.random() * w, Math.random() * h, U.rand(2, 30), 1); }
    }, { repeat: [4, 4] });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(RS, RS), new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.8 }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
    const paper = U.canvasTexture(512, 512, (g, w, h) => {
      g.fillStyle = "#2a1e2e"; g.fillRect(0, 0, w, h);
      g.fillStyle = "rgba(120,80,110,.25)";
      for (let y = 0; y < h; y += 64) for (let x = (y / 64) % 2 ? 32 : 0; x < w; x += 64) { g.beginPath(); g.ellipse(x + 16, y + 16, 9, 16, 0, 0, Math.PI * 2); g.fill(); }
      for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.3})`; g.fillRect(Math.random() * w, 0, U.rand(4, 20), h); }
    }, { repeat: [5, 2] });
    const wallMat = new THREE.MeshStandardMaterial({ map: paper, roughness: 0.9 });
    [[0, -RS / 2, 0], [0, RS / 2, Math.PI], [-RS / 2, 0, Math.PI / 2], [RS / 2, 0, -Math.PI / 2]].forEach(([x, z, r]) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(RS, RH), wallMat); m.position.set(x, RH / 2, z); m.rotation.y = r; m.receiveShadow = true; scene.add(m);
    });
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(RS, RS), new THREE.MeshStandardMaterial({ color: 0x120a12 })); ceil.rotation.x = Math.PI / 2; ceil.position.y = RH; scene.add(ceil);

    // window with moon
    const winTex = U.canvasTexture(512, 512, (g, w, h) => {
      const grd = g.createLinearGradient(0, 0, 0, h); grd.addColorStop(0, "#060a2a"); grd.addColorStop(1, "#1a2050"); g.fillStyle = grd; g.fillRect(0, 0, w, h);
      g.fillStyle = "#e8eeff"; g.shadowColor = "#9ab0ff"; g.shadowBlur = 60; g.beginPath(); g.arc(w * 0.6, h * 0.35, 60, 0, Math.PI * 2); g.fill(); g.shadowBlur = 0;
      g.fillStyle = "#05030a"; for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(i * 100, h); g.lineTo(i * 100 + 30, h * U.rand(0.55, 0.75)); g.lineTo(i * 100 + 60, h); g.fill(); }
    });
    const win = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.2), new THREE.MeshBasicMaterial({ map: winTex, fog: false }));
    win.position.set(0, 2.1, -RS / 2 + 0.02); scene.add(win);
    const frameM = new THREE.MeshStandardMaterial({ color: 0x1a0f0a, roughness: 0.7 });
    for (const [w, h, x, y] of [[2.4, 0.1, 0, 3.2], [2.4, 0.1, 0, 1.0], [0.1, 2.3, -1.15, 2.1], [0.1, 2.3, 1.15, 2.1], [0.06, 2.2, 0, 2.1], [2.2, 0.06, 0, 2.1]]) { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.08), frameM); b.position.set(x, y, -RS / 2 + 0.05); scene.add(b); }

    // furniture for spooky shadows
    const dark = new THREE.MeshStandardMaterial({ color: 0x2a1a12, roughness: 0.8 });
    const furn = new THREE.Group();
    const add = (geo, x, y, z, m = dark) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); furn.add(o); return o; };
    add(new THREE.BoxGeometry(2, 0.08, 1), 2.6, 0.8, -2.5); for (const [x, z] of [[1.7, -2.1], [3.5, -2.1], [1.7, -2.9], [3.5, -2.9]]) add(new THREE.BoxGeometry(0.08, 0.8, 0.08), x, 0.4, z);
    add(new THREE.BoxGeometry(0.5, 1.0, 0.5), 2.6, 0.5, -1.4); add(new THREE.BoxGeometry(0.5, 1.1, 0.06), 2.6, 1.1, -1.18);
    const shelf = add(new THREE.BoxGeometry(2.4, 2.8, 0.45), -RS / 2 + 0.3, 1.4, 1.5); shelf.rotation.y = Math.PI / 2;
    for (let i = 0; i < 26; i++) add(new THREE.BoxGeometry(0.08, U.rand(0.25, 0.4), 0.3), -RS / 2 + 0.55, 0.45 + Math.floor(i / 9) * 0.9, 0.4 + (i % 9) * 0.25, new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(Math.random(), 0.4, 0.2) }));
    const clock = add(new THREE.BoxGeometry(0.6, 2.4, 0.4), RS / 2 - 0.35, 1.2, 2.5);
    add(new THREE.CylinderGeometry(0.2, 0.2, 0.05, 24).rotateZ(Math.PI / 2), RS / 2 - 0.58, 2.0, 2.5, new THREE.MeshStandardMaterial({ color: 0xd8c8a0 }));
    const portraitTex = U.canvasTexture(256, 320, (g, w, h) => { g.fillStyle = "#1a1210"; g.fillRect(0, 0, w, h); g.fillStyle = "#3a2a20"; g.beginPath(); g.ellipse(w / 2, h * 0.42, 60, 80, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = "#ff2040"; g.beginPath(); g.arc(w / 2 - 22, h * 0.38, 6, 0, 7); g.arc(w / 2 + 22, h * 0.38, 6, 0, 7); g.fill(); });
    for (const [x, z, r] of [[-2.5, -RS / 2 + 0.04, 0], [RS / 2 - 0.04, -1.5, -Math.PI / 2], [-1, RS / 2 - 0.04, Math.PI]]) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.15), new THREE.MeshStandardMaterial({ map: portraitTex, emissive: 0x220000, emissiveMap: portraitTex, emissiveIntensity: 0.6 }));
      p.position.set(x, 2.2, z); p.rotation.y = r; furn.add(p);
    }
    U.shadowAll(furn); scene.add(furn);

    // candles
    const candles = [[2.2, 0.84, -2.5], [3.0, 0.84, -2.6], [-RS / 2 + 0.6, 2.85, 1.0]].map(([x, y, z]) => {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.18, 10), new THREE.MeshStandardMaterial({ color: 0xf0e6d0 })); c.position.set(x, y + 0.09, z); scene.add(c);
      const flame = U.glowSprite(0xffa040, 0.25, 0.95); flame.position.set(x, y + 0.22, z); scene.add(flame);
      const l = new THREE.PointLight(0xff9a40, 3, 5, 1.8); l.position.set(x, y + 0.3, z); scene.add(l);
      return { l, flame, seed: Math.random() * 10 };
    });

    // dust motes
    const dustN = 400, dpos = new Float32Array(dustN * 3);
    for (let i = 0; i < dustN; i++) dpos.set([U.rand(-5, 5), U.rand(0.2, 3.6), U.rand(-5, 5)], i * 3);
    const dg = new THREE.BufferGeometry(); dg.setAttribute("position", new THREE.BufferAttribute(dpos, 3));
    const dust = new THREE.Points(dg, new THREE.PointsMaterial({ color: 0xffffff, size: 0.02, transparent: true, opacity: 0.5 })); scene.add(dust);

    const particles = new U.Particles(scene, 2500);
    const texts = new U.FloatTexts(scene);

    // off-screen ghost indicators
    const arrows = document.createElement("div");
    arrows.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:8";
    document.body.appendChild(arrows);

    // ---------------------------------------------------------------- state
    let running = false, score = 0, lives = 3, wave = 0, toSpawn = 0, spawnT = 0, killed = 0;
    let yaw = 0, pitch = 0, energy = 1, lightning = 8, flashT = 0, scareT = 0;
    let ghosts = [];
    const aimDir = new THREE.Vector3(0, 0, -1), _v = new THREE.Vector3(), _p = new THREE.Vector3();

    function nextWave() {
      wave++; toSpawn = 2 + wave * 2; spawnT = 1.2;
      ui.banner(`WAVE ${wave}`, "#9b5cff");
      sfx.ghost();
    }
    function spawnGhost(boss = false) {
      const m = ghostMesh(boss ? 0xffd6f0 : 0xdfe8ff, 0.1);
      const body = m.getObjectByName("body");
      const eyes = [U.glowSprite(0xff2040, 0.18, 0.9), U.glowSprite(0xff2040, 0.18, 0.9)];
      eyes[0].position.set(-0.17, 0.62, 0.5); eyes[1].position.set(0.17, 0.62, 0.5); m.add(...eyes);
      const s = boss ? 1.6 : U.rand(0.75, 1.0); m.scale.setScalar(s);
      const a = yaw + Math.PI + U.rand(-2.2, 2.2), d = U.rand(4.2, 5.2);
      m.position.set(Math.sin(a) * d, U.rand(1.0, 2.2), Math.cos(a) * d);
      scene.add(m);
      ghosts.push({ m, body, eyes, hp: boss ? 4 : 1, maxHp: boss ? 4 : 1, boss, speed: (boss ? 0.45 : U.rand(0.55, 0.9)) + wave * 0.05, phase: Math.random() * 6, lit: 0, state: "in", t: 0, side: U.rand(-1, 1), baseScale: s, dead: false });
    }
    function banish(g) {
      g.state = "out"; g.t = 0; killed++;
      const pts = (g.boss ? 500 : 100) * (1 + Math.floor(wave / 3));
      score += pts;
      texts.spawn(`+${pts}`, g.m.position.clone().add(_v.set(0, 0.8, 0)), { color: "#c9a8ff", size: 0.35 });
      particles.burst(g.m.position, 0xc9a8ff, 70, 3.5, { size: 0.25, gravity: 1.5, life: 1.2 });
      sfx.vanish();
    }
    function scare(g) {
      g.state = "scare"; g.t = 0;
      lives--; scareT = 0.9;
      sfx.scare(); ui.flash("#ff0030", 0.6, 700);
    }

    function setArrows() {
      let html = "";
      for (const g of ghosts) {
        if (g.state === "out") continue;
        const sp = U.toScreen(g.m.position, camera);
        const onScreen = sp.z < 1 && sp.x > 0 && sp.x < innerWidth && sp.y > 0 && sp.y < innerHeight;
        if (onScreen) continue;
        _v.copy(g.m.position).sub(camera.position).applyQuaternion(camera.quaternion.clone().invert());
        const ang = Math.atan2(_v.x, -_v.z);
        const cx = innerWidth / 2 + Math.sin(ang) * (innerWidth / 2 - 40), cy = innerHeight / 2 - Math.cos(ang) * (innerHeight / 2 - 60);
        html += `<div style="position:absolute;left:${cx}px;top:${U.clamp(cy, 70, innerHeight - 40)}px;transform:translate(-50%,-50%) rotate(${ang}rad);color:#ff3d6e;font:900 28px Inter;text-shadow:0 0 12px #ff3d6e">▲</div>`;
      }
      if (arrows._h !== html) { arrows.innerHTML = html; arrows._h = html; }
    }

    return {
      start() { running = true; nextWave(); },
      update(dt, now) {
        const h = input.primary;
        const tt = now / 1000;
        // turning: palm steer, screen edges, keys
        let turn = 0;
        if (input.key("KeyA", "ArrowLeft")) turn += 1;
        if (input.key("KeyD", "ArrowRight")) turn -= 1;
        if (h && !input.locked) {
          if (h.gesture === "open" && !h.synthetic) turn -= U.deadzone(h.pnx - 0.5, 0.08) * 4;
          else { if (h.nx < 0.1) turn += (0.1 - h.nx) * 18; if (h.nx > 0.9) turn -= (h.nx - 0.9) * 18; }
        }
        yaw += turn * 1.6 * dt;
        camera.rotation.set(pitch, yaw, 0, "YXZ");
        camera.updateMatrixWorld();

        // aim the torch at the pointer
        if (h) {
          U.rayFromScreen(camera, h.ptr.x, h.ptr.y);
          _p.copy(U.rayFromScreen(camera, h.ptr.x, h.ptr.y).ray.direction);
          aimDir.lerp(_p, 0.5).normalize();
        }
        torch.target.position.copy(camera.position).addScaledVector(aimDir, 6);
        const local = aimDir.clone().applyQuaternion(camera.quaternion.clone().invert());
        cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), local);
        cone.position.set(0.25, -0.25, 0);
        torchBody.quaternion.copy(cone.quaternion); torchBody.position.set(0.28, -0.3, -0.25);
        const uv = running && h?.pinch && energy > 0.02 && !input.locked;
        energy = U.clamp(energy + (uv ? -0.35 : 0.12) * dt, 0, 1);
        torch.color.set(uv ? 0xb070ff : 0xfff1d6); coneMat.color.set(uv ? 0xb070ff : 0xfff1d6);
        torch.intensity = (uv ? 420 : 260) * (0.92 + Math.random() * 0.08);
        coneMat.opacity = uv ? 0.12 : 0.055;

        // ghosts
        if (running) {
          if (toSpawn > 0) { spawnT -= dt; if (spawnT <= 0) { spawnGhost(wave % 3 === 0 && toSpawn === 1); toSpawn--; spawnT = U.rand(1.0, 2.2) - Math.min(0.6, wave * 0.05); } }
          else if (!ghosts.some((g) => g.state !== "out")) nextWave();
        }
        const cosCone = Math.cos(torch.angle * 0.95);
        for (const g of ghosts) {
          g.t += dt;
          const m = g.m;
          _v.copy(m.position).add(_p.set(0, 0.5 * g.baseScale, 0)).sub(camera.position);
          const dist = _v.length();
          const inBeam = running && _v.normalize().dot(aimDir) > cosCone && dist < 12;
          if (g.state === "in") { g.body.material.opacity = Math.min(0.12, g.t * 0.2); if (g.t > 0.8) g.state = "float"; }
          if (g.state === "float") {
            const dir = _p.copy(camera.position).sub(m.position); dir.y = 0; dir.normalize();
            const side = new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar(Math.sin(tt * 1.3 + g.phase) * 0.8 * g.side);
            const sp = g.speed * (inBeam ? 0.25 : 1);
            m.position.addScaledVector(dir, sp * dt).addScaledVector(side, dt);
            m.position.y = 1.0 + Math.sin(tt * 2 + g.phase) * 0.25 + (g.boss ? 0.3 : 0);
            m.lookAt(camera.position.x, m.position.y, camera.position.z);
            g.lit = U.damp(g.lit, inBeam ? 1 : 0, 8, dt);
            g.body.material.opacity = 0.1 + g.lit * 0.75 + (flashT > 0 ? 0.6 : 0);
            g.body.material.emissiveIntensity = 0.35 + g.lit * 1.2;
            if (inBeam) {
              g.hp -= dt * (uv ? 3 : 1);
              m.position.x += (Math.random() - 0.5) * 0.04; m.position.z += (Math.random() - 0.5) * 0.04;
              if (Math.random() < dt * 3) sfx.zap();
              if (Math.random() < 0.5) particles.burst(m.position.clone().add(_p.set(0, 0.6 * g.baseScale, 0)), uv ? 0xb070ff : 0xfff1d6, 1, 1.2, { size: 0.12, gravity: 1, life: 0.6 });
              if (g.hp <= 0) banish(g);
            } else g.hp = Math.min(g.maxHp, g.hp + dt * 0.15);
            m.scale.setScalar(g.baseScale * (1 + (1 - g.hp / g.maxHp) * -0.3));
            const flat = Math.hypot(m.position.x - camera.position.x, m.position.z - camera.position.z);
            if (flat < 1.15 && g.state === "float") scare(g);
            if (Math.random() < dt * 0.08) sfx.ghost();
          } else if (g.state === "out") {
            m.scale.multiplyScalar(1 - dt * 3); m.rotation.y += dt * 12; m.position.y += dt * 1.5;
            g.body.material.opacity = Math.max(0, g.body.material.opacity - dt * 1.5);
            if (g.t > 0.7) g.dead = true;
          } else if (g.state === "scare") {
            _p.copy(camera.position).addScaledVector(camera.getWorldDirection(_v), 0.6); _p.y -= 0.5 * g.baseScale;
            m.position.lerp(_p, 0.3); m.lookAt(camera.position);
            g.body.material.opacity = 0.95; m.scale.setScalar(g.baseScale * (1 + g.t));
            if (g.t > 0.6) g.dead = true;
          }
          for (const e of g.eyes) e.material.opacity = g.state === "out" ? 0 : 0.6 + 0.4 * Math.sin(tt * 6 + g.phase);
        }
        ghosts = ghosts.filter((g) => { if (!g.dead) return true; scene.remove(g.m); return false; });
        if (running && lives <= 0) {
          running = false;
          ctx.end({ title: "The ghosts got you…", subtitle: `Survived to wave ${wave}`, score, stats: [["Ghosts banished", killed], ["Wave", wave]] });
        }

        // atmosphere
        for (const c of candles) { const f = 0.75 + Math.sin(tt * 13 + c.seed) * 0.12 + Math.random() * 0.13; c.l.intensity = 3 * f; c.flame.scale.setScalar(0.22 * f); }
        lightning -= dt;
        if (lightning < 0) { lightning = U.rand(9, 16); flashT = 0.18; ui.flash("#a8b8ff", 0.35, 500); setTimeout(() => sfx.thunder(), 400); }
        flashT = Math.max(0, flashT - dt);
        hemi.intensity = flashT > 0 ? 1.4 : 0.06;
        scareT = Math.max(0, scareT - dt);
        camera.position.set((Math.random() - 0.5) * scareT * 0.15, 1.6 + (Math.random() - 0.5) * scareT * 0.15, 0);
        dust.rotation.y += dt * 0.02;
        particles.update(dt); texts.update(dt);
        setArrows();
        ui.setStats([
          { label: "SCORE", value: score, cls: "hot" },
          { label: "LIVES", value: "❤️".repeat(Math.max(0, lives)) || "–", cls: "warn" },
          { label: "WAVE", value: wave },
          { label: "UV", value: `${Math.round(energy * 100)}%`, cls: "cool" },
        ]);
      },
      dispose() { arrows.remove(); ctx.stopAmbient(); },
    };
  },
};
