// Neon Run — endless runner. Hand left/right = lane, flick up = jump, flick down (or fist) = slide.
import * as THREE from "three";
import * as U from "../util.js";

const LANES = [-2.2, 0, 2.2], GRAV = 26, JUMP_V = 9.2;

export default {
  id: "runner", title: "Neon Run", emoji: "🏃", color: "#ffd23f", short: "Endless runner",
  desc: "Sprint through a synthwave city. Dodge barriers, trains and laser gates — how far can you go?",
  howto: [["↔️", "Move your hand left / centre / right to change lane"], ["⬆️", "Flick your hand up quickly (or pinch) to jump"], ["⬇️", "Flick down or make a fist to slide under bars"], ["🪙", "Grab coins · 🛡 shields save you once"]],
  help: [["↔️", "Hand position = lane"], ["⬆️", "Flick up / pinch = jump"], ["⬇️", "Flick down / fist = slide"], ["⌨️", "Arrows / WASD also work"]],

  create(ctx) {
    const { input, ui, sfx } = ctx;
    const scene = new THREE.Scene();
    scene.environment = ctx.env; scene.environmentIntensity = 0.5;
    scene.fog = new THREE.Fog(0x1a0636, 40, 150);
    const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 500);
    camera.position.set(0, 3.6, 6.8); camera.lookAt(0, 1.2, -8);
    ctx.view(scene, camera);
    ctx.bloom(1.0, 0.6, 0.55);
    U.makeSky(scene, "#0a0230", "#ff3d9a", { horizon: 0.52, stars: 250 });
    scene.add(new THREE.HemisphereLight(0xff9ad6, 0x2a0a50, 1.0));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6); sun.position.set(4, 12, 8); sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024); Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 10, bottom: -10, near: 1, far: 40 });
    scene.add(sun);

    // synthwave sun
    const sunTex = U.canvasTexture(512, 512, (g, w, h) => {
      const grd = g.createLinearGradient(0, 0, 0, h); grd.addColorStop(0, "#ffe66b"); grd.addColorStop(0.6, "#ff5aa0"); grd.addColorStop(1, "#b02cff");
      g.fillStyle = grd; g.beginPath(); g.arc(w / 2, h / 2, w / 2, 0, 7); g.fill();
      g.globalCompositeOperation = "destination-out";
      for (let i = 0; i < 9; i++) { const y = h * 0.55 + i * 24; g.fillRect(0, y, w, 4 + i * 1.6); }
    });
    const sunMesh = new THREE.Mesh(new THREE.PlaneGeometry(130, 130), new THREE.MeshBasicMaterial({ map: sunTex, transparent: true, fog: false, toneMapped: false, depthWrite: false }));
    sunMesh.position.set(0, 30, -320); scene.add(sunMesh);

    // ground grid + road
    const gridTex = U.canvasTexture(256, 256, (g, w, h) => { g.fillStyle = "#12052a"; g.fillRect(0, 0, w, h); g.strokeStyle = "#ff3df2"; g.lineWidth = 6; g.strokeRect(0, 0, w, h); }, { repeat: [60, 60] });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), new THREE.MeshStandardMaterial({ map: gridTex, emissive: 0xffffff, emissiveMap: gridTex, emissiveIntensity: 0.35, roughness: 0.8 }));
    ground.rotation.x = -Math.PI / 2; ground.position.set(0, -0.02, -200); scene.add(ground);
    const roadTex = U.canvasTexture(512, 512, (g, w, h) => {
      g.fillStyle = "#1a1030"; g.fillRect(0, 0, w, h);
      g.fillStyle = "#2ef2ff"; for (const x of [w / 3, (2 * w) / 3]) for (let y = 0; y < h; y += 128) g.fillRect(x - 4, y, 8, 70);
      g.fillStyle = "#ff3df2"; g.fillRect(0, 0, 10, h); g.fillRect(w - 10, 0, 10, h);
    }, { repeat: [1, 40] });
    const road = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 400), new THREE.MeshStandardMaterial({ map: roadTex, emissive: 0xffffff, emissiveMap: roadTex, emissiveIntensity: 0.25, roughness: 0.35, metalness: 0.4 }));
    road.rotation.x = -Math.PI / 2; road.position.set(0, 0, -190); road.receiveShadow = true; scene.add(road);

    // buildings (recycled)
    const winTex = U.canvasTexture(128, 256, (g, w, h) => {
      g.fillStyle = "#0a0420"; g.fillRect(0, 0, w, h);
      for (let y = 8; y < h; y += 16) for (let x = 8; x < w; x += 16) if (Math.random() < 0.45) { g.fillStyle = U.pick(["#ff3df2", "#2ef2ff", "#ffd23f", "#8a7dff"]); g.globalAlpha = U.rand(0.5, 1); g.fillRect(x, y, 8, 9); g.globalAlpha = 1; }
    });
    winTex.wrapS = winTex.wrapT = THREE.RepeatWrapping;
    const bGeo = new THREE.BoxGeometry(1, 1, 1);
    const buildings = [];
    for (let i = 0; i < 46; i++) {
      const m = new THREE.Mesh(bGeo, new THREE.MeshStandardMaterial({ color: 0x0d0628, emissive: 0xffffff, emissiveMap: winTex, emissiveIntensity: 0.8, roughness: 0.6 }));
      scene.add(m); buildings.push(m);
      placeBuilding(m, -i * 9);
    }
    function placeBuilding(m, z) {
      const side = Math.random() < 0.5 ? -1 : 1;
      const w = U.rand(3, 7), h = U.rand(6, 30), d = U.rand(4, 9);
      m.scale.set(w, h, d);
      m.position.set(side * U.rand(7.5, 18), h / 2, z);
    }

    // player robot
    const player = new THREE.Group();
    const suit = new THREE.MeshStandardMaterial({ color: 0xf2f2ff, metalness: 0.5, roughness: 0.25 });
    const glowM = new THREE.MeshBasicMaterial({ color: 0x2ef2ff, toneMapped: false });
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.5, 6, 12), suit); torso.position.y = 1.15; player.add(torso);
    const chest = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.05), glowM); chest.position.set(0, 1.3, -0.32); player.add(chest);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 24, 16), suit); head.position.y = 1.85; player.add(head);
    const visor = new THREE.Mesh(new THREE.SphereGeometry(0.2, 24, 12, 0, Math.PI * 2, Math.PI * 0.35, Math.PI * 0.3), glowM); visor.position.set(0, 1.86, -0.08); visor.rotation.x = -Math.PI / 2; player.add(visor);
    const limb = (x, y, len, r) => { const g = new THREE.Group(); g.position.set(x, y, 0); const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 4, 8), suit); m.position.y = -len / 2 - r; g.add(m); player.add(g); return g; };
    const legL = limb(-0.17, 0.75, 0.42, 0.11), legR = limb(0.17, 0.75, 0.42, 0.11), armL = limb(-0.42, 1.45, 0.38, 0.08), armR = limb(0.42, 1.45, 0.38, 0.08);
    const shieldBubble = new THREE.Mesh(new THREE.SphereGeometry(1.15, 32, 20), new THREE.MeshBasicMaterial({ color: 0x2ef2ff, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    shieldBubble.position.y = 1.1; shieldBubble.visible = false; player.add(shieldBubble);
    U.shadowAll(player, true, false); scene.add(player);
    const trail = new U.Particles(scene, 1500);
    const texts = new U.FloatTexts(scene);

    // obstacles & pickups
    const neon = (c) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.9, roughness: 0.3, metalness: 0.3 });
    const stripeTex = U.canvasTexture(256, 64, (g, w, h) => { g.fillStyle = "#ff3d6e"; g.fillRect(0, 0, w, h); g.fillStyle = "#1a0820"; for (let x = -h; x < w; x += 48) { g.beginPath(); g.moveTo(x, h); g.lineTo(x + 24, h); g.lineTo(x + 24 + h, 0); g.lineTo(x + h, 0); g.fill(); } });
    const OB = {
      low: () => { const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.6, 0.3), new THREE.MeshStandardMaterial({ map: stripeTex, emissive: 0xff3d6e, emissiveIntensity: 0.4 })); b.position.y = 0.45; g.add(b); for (const x of [-0.85, 0.85]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.45, 0.1), neon(0xffffff)); l.position.set(x, 0.22, 0); g.add(l); } return { g, box: [-0.95, 0.95, 0, 0.75, -0.2, 0.2] }; },
      high: () => { const g = new THREE.Group(); const bar = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.22, 0.22), neon(0x2ef2ff)); bar.position.y = 1.55; g.add(bar); const laser = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.03, 0.03), new THREE.MeshBasicMaterial({ color: 0xff3df2, toneMapped: false })); laser.position.y = 1.25; g.add(laser); for (const x of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.6, 0.12), neon(0x8a7dff)); p.position.set(x, 1.3, 0); g.add(p); } return { g, box: [-1, 1, 1.05, 2.6, -0.15, 0.15] }; },
      block: () => { const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.BoxGeometry(1.9, 2.4, 2.4), new THREE.MeshStandardMaterial({ color: 0x241050, emissive: 0x8a7dff, emissiveIntensity: 0.25, metalness: 0.5, roughness: 0.3 })); b.position.y = 1.2; g.add(b); const e = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.08, 2.45), neon(0xffd23f)); e.position.y = 2.4; g.add(e); return { g, box: [-0.95, 0.95, 0, 2.4, -1.2, 1.2] }; },
      train: () => { const g = new THREE.Group(); const L = 11; const b = new THREE.Mesh(new THREE.BoxGeometry(2.0, 2.7, L), new THREE.MeshStandardMaterial({ color: 0xdedcff, metalness: 0.7, roughness: 0.25 })); b.position.y = 1.4; g.add(b); for (const y of [1.0, 2.0]) { const s = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.12, L), neon(y > 1.5 ? 0xff3df2 : 0x2ef2ff)); s.position.y = y; g.add(s); } const front = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.8, 0.05), neon(0xffd23f)); front.position.set(0, 1.9, L / 2 + 0.01); g.add(front); return { g, box: [-1, 1, 0, 2.7, -L / 2, L / 2] }; },
    };
    const coinGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.08, 24).rotateX(Math.PI / 2);
    const coinMat = new THREE.MeshStandardMaterial({ color: 0xffd23f, metalness: 1, roughness: 0.2, emissive: 0xff9900, emissiveIntensity: 0.45 });
    let things = [];

    function addObstacle(type, lane, z) {
      const o = OB[type](); o.g.position.set(LANES[lane], 0, z); U.shadowAll(o.g, true, false); scene.add(o.g);
      things.push({ kind: "ob", type, lane, g: o.g, box: o.box });
    }
    function addCoin(lane, z, y = 0.9) {
      const m = new THREE.Mesh(coinGeo, coinMat); m.position.set(LANES[lane], y, z); scene.add(m);
      things.push({ kind: "coin", lane, g: m });
    }
    function addShield(lane, z) {
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.4, 1), neon(0x2ef2ff)); m.position.set(LANES[lane], 1.1, z); m.add(U.glowSprite(0x2ef2ff, 2, 0.6)); scene.add(m);
      things.push({ kind: "shield", lane, g: m });
    }
    let spawnZ = -30;
    function spawnRow(z) {
      const pat = Math.random();
      const lanes = [0, 1, 2].sort(() => Math.random() - 0.5);
      if (pat < 0.25) { addObstacle("train", lanes[0], z - 5.5); if (Math.random() < 0.5) addObstacle("block", lanes[1], z); }
      else if (pat < 0.5) { addObstacle(U.pick(["low", "high"]), lanes[0], z); addObstacle(U.pick(["low", "high", "block"]), lanes[1], z); }
      else if (pat < 0.75) { const t = U.pick(["low", "high"]); for (const l of [0, 1, 2]) addObstacle(t, l, z); }
      else addObstacle(U.pick(["low", "high", "block"]), lanes[0], z);
      // coins in a free-ish lane
      const cl = lanes[2];
      const arc = Math.random() < 0.3;
      for (let i = 0; i < 6; i++) addCoin(cl, z + 6 - i * 1.6, arc ? 0.9 + Math.sin((i / 5) * Math.PI) * 1.6 : 0.9);
      if (Math.random() < 0.06) addShield(cl, z + 9);
    }

    // ---------------------------------------------------------------- state
    let running = false, dead = false, deadT = 0;
    let speed = 14, dist = 0, coins = 0, lane = 1, px = 0, py = 0, vy = 0, sliding = 0, shield = 0, runT = 0, laneCool = 0;
    let fistWas = false;

    function jump() { if (py <= 0.001 && !dead) { vy = JUMP_V; sliding = 0; sfx.jump(); } }
    function slide() { if (!dead) { sliding = 0.75; if (py > 0) vy = -14; sfx.slide(); } }
    function setLane(l) { l = U.clamp(l, 0, 2); if (l !== lane) { lane = l; sfx.tick(); } }

    function crash() {
      if (shield > 0) { shield = 0; shieldBubble.visible = false; sfx.glass(); ui.banner("SHIELD!", "#2ef2ff"); invuln = 1.0; return; }
      dead = true; deadT = 0; sfx.crash(); ui.flash("#ff3d6e", 0.5); ui.banner("CRASH!", "#ff3d6e");
      trail.burst(player.position.clone().add(new THREE.Vector3(0, 1, 0)), 0xff3df2, 120, 8, { size: 0.3 });
    }
    let invuln = 0;

    const keysPrev = new Set();
    const pressed = (code) => input.keys.has(code) && !keysPrev.has(code);

    return {
      start() { running = true; ui.toast("Run! ↔️ move hand to change lanes"); },
      update(dt, now) {
        const h = input.primary;
        // controls
        if (running && !dead && !input.locked) {
          if (pressed("ArrowLeft") || pressed("KeyA")) setLane(lane - 1);
          if (pressed("ArrowRight") || pressed("KeyD")) setLane(lane + 1);
          if (pressed("ArrowUp") || pressed("KeyW") || pressed("Space")) jump();
          if (pressed("ArrowDown") || pressed("KeyS")) slide();
          if (h) {
            const x = h.synthetic ? h.nx : h.pnx;
            const want = x < 0.38 ? 0 : x > 0.62 ? 2 : 1;
            if (want !== lane && laneCool <= 0) { setLane(want); laneCool = 0.08; }
            if (!h.synthetic) {
              if (h.vel.y < -innerHeight * 1.3 || h.pinchStart) jump();
              if (h.vel.y > innerHeight * 1.4) slide();
              const fist = h.gesture === "fist";
              if (fist && !fistWas) slide();
              fistWas = fist;
            } else if (h.pinchStart) jump();
          }
        }
        keysPrev.clear(); for (const k of input.keys) keysPrev.add(k);
        laneCool -= dt;

        if (running && !dead) {
          speed = Math.min(36, 14 + runT * 0.32);
          runT += dt; dist += speed * dt;
        }
        const mv = running && !dead ? speed * dt : 0;

        // physics
        vy -= GRAV * dt; py += vy * dt; if (py < 0) { py = 0; vy = 0; }
        sliding = Math.max(0, sliding - dt);
        px = U.damp(px, LANES[lane], 16, dt);
        invuln = Math.max(0, invuln - dt);

        // world scroll
        road.material.map.offset.y += mv / 10; road.material.emissiveMap.offset.y = road.material.map.offset.y;
        gridTex.offset.y += mv / 10;
        for (const b of buildings) { b.position.z += mv; if (b.position.z > 20) placeBuilding(b, b.position.z - 46 * 9); }
        spawnZ += mv;
        while (spawnZ > -120) { spawnRow(spawnZ - 100); spawnZ -= U.rand(16, 26) - Math.min(6, runT * 0.05); }
        const ph = sliding > 0 ? 0.85 : 1.8, half = 0.38;
        for (const t of things) {
          t.g.position.z += mv;
          if (t.kind === "coin") { t.g.rotation.y += dt * 5; }
          if (t.kind === "shield") t.g.rotation.y += dt * 2;
          if (t.dead || dead) continue;
          const z = t.g.position.z;
          if (t.kind === "ob") {
            const [x0, x1, y0, y1, z0, z1] = t.box;
            const ox = t.g.position.x;
            if (px + half > ox + x0 && px - half < ox + x1 && py + ph > y0 && py < y1 && 0.35 > z + z0 && -0.35 < z + z1 && invuln <= 0) crash();
          } else if (Math.abs(z) < 0.8 && Math.abs(t.g.position.x - px) < 0.9 && Math.abs(t.g.position.y - (py + 1)) < 1.3) {
            t.dead = true; scene.remove(t.g);
            if (t.kind === "coin") { coins++; sfx.coin(); trail.burst(t.g.position, 0xffd23f, 10, 3, { size: 0.15, life: 0.4 }); }
            else { shield = 1; shieldBubble.visible = true; sfx.good(); ui.banner("SHIELD UP", "#2ef2ff"); }
          }
        }
        things = things.filter((t) => { if (t.g.position.z > 18 || t.dead) { if (!t.dead) scene.remove(t.g); return false; } return true; });

        // player animation
        player.position.set(px, py, 0);
        if (!dead) {
          const cyc = now / 1000 * (speed * 0.75);
          const air = py > 0.01;
          const s = sliding > 0 ? 0 : air ? 0.4 : 1;
          legL.rotation.x = Math.sin(cyc) * 0.9 * s; legR.rotation.x = -Math.sin(cyc) * 0.9 * s;
          armL.rotation.x = -Math.sin(cyc) * 0.8 * s; armR.rotation.x = Math.sin(cyc) * 0.8 * s;
          if (air) { legL.rotation.x = -0.6; legR.rotation.x = 0.3; }
          player.rotation.x = sliding > 0 ? -1.1 : 0;
          player.position.y = py + (sliding > 0 ? -0.25 : Math.abs(Math.sin(cyc)) * 0.06);
          player.rotation.z = (LANES[lane] - px) * -0.12;
          if (running && Math.random() < 0.7) trail.burst(new THREE.Vector3(px, py + 0.2, 0.3), 0x2ef2ff, 1, 0.5, { size: 0.18, life: 0.35, gravity: 0 });
        } else {
          deadT += dt;
          player.rotation.x = Math.min(Math.PI / 2, deadT * 5); player.position.y = Math.max(0.3, py);
          if (deadT > 1.3 && running) {
            running = false;
            const score = Math.floor(dist) + coins * 10;
            ctx.end({ title: "Wiped out!", subtitle: `${Math.floor(dist)} m · ${coins} coins`, score, stats: [["Distance", `${Math.floor(dist)} m`], ["Coins", coins], ["Top speed", `${Math.round(speed * 3.6)} km/h`]] });
          }
        }
        shieldBubble.material.opacity = 0.14 + Math.sin(now / 150) * 0.06;
        // camera
        camera.position.x = U.damp(camera.position.x, px * 0.55, 6, dt);
        camera.position.y = U.damp(camera.position.y, 3.6 + py * 0.3, 6, dt);
        camera.lookAt(px * 0.6, 1.2 + py * 0.2, -8);
        if (dead && deadT < 0.4) camera.position.x += (Math.random() - 0.5) * 0.3;
        camera.fov = 62 + (speed - 14) * 0.35; camera.updateProjectionMatrix();
        sun.position.set(px + 4, 12, 8); sun.target.position.set(px, 0, -2); sun.target.updateMatrixWorld();
        trail.update(dt); texts.update(dt);
        ui.setStats([
          { label: "SCORE", value: Math.floor(dist) + coins * 10, cls: "hot" },
          { label: "COINS", value: coins, cls: "hot" },
          { label: "SPEED", value: `${Math.round(speed * 3.6)}`, cls: "cool" },
          { label: "SHIELD", value: shield ? "🛡" : "–" },
        ]);
      },
      dispose() {},
    };
  },
};
