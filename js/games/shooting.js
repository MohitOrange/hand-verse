// Neon Shooting Gallery — aim with your finger, pinch (thumb tap) to fire, make a fist to reload.
import * as THREE from "three";
import * as U from "../util.js";

const TIME = 60, MAG = 10;

export default {
  id: "shooting", title: "Shooting Gallery", emoji: "🎯", color: "#ff3d6e", short: "Finger-gun blaster",
  desc: "A neon carnival gallery. Your finger is the blaster: aim at targets, bottles, drones and the golden UFO — but never shoot the blue friends!",
  howto: [["👉", "Point at a target to aim"], ["🤏", "Tap thumb to index finger to fire"], ["✊", "Make a fist to reload (10 shots)"], ["🙂", "Blue smiley targets are friends: −50"]],
  help: [["👉", "Aim"], ["🤏", "Thumb tap = fire"], ["✊", "Fist = reload"], ["🖱️", "Mouse: click fire · right-click reload"]],

  create(ctx) {
    const { input, ui, sfx } = ctx;
    const scene = new THREE.Scene();
    scene.environment = ctx.env; scene.environmentIntensity = 0.3;
    scene.background = new THREE.Color(0x05030f);
    scene.fog = new THREE.Fog(0x05030f, 20, 45);
    const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.03, 120);
    camera.position.set(0, 1.6, 0); camera.lookAt(0, 1.7, -10);
    scene.add(camera);
    ctx.view(scene, camera);
    ctx.bloom(1.0, 0.55, 0.6);
    scene.add(new THREE.HemisphereLight(0x8a7dff, 0x1a0820, 0.8));
    const key = new THREE.DirectionalLight(0xffffff, 1.2); key.position.set(3, 8, 4); scene.add(key);

    // gallery
    const gridTex = U.canvasTexture(512, 512, (g, w, h) => { g.fillStyle = "#000"; g.fillRect(0, 0, w, h); g.strokeStyle = "#ff3df2"; g.lineWidth = 3; g.strokeRect(0, 0, w, h); }, { repeat: [14, 40] });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 40), new THREE.MeshStandardMaterial({ color: 0x0a0618, emissive: 0xffffff, emissiveMap: gridTex, emissiveIntensity: 0.35, roughness: 0.3, metalness: 0.5 }));
    floor.rotation.x = -Math.PI / 2; floor.position.z = -18; scene.add(floor);
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x0d0822, roughness: 0.6 });
    const env = [];
    for (const x of [-7, 7]) { const w = new THREE.Mesh(new THREE.PlaneGeometry(40, 8), wallMat); w.position.set(x, 4, -18); w.rotation.y = x < 0 ? Math.PI / 2 : -Math.PI / 2; scene.add(w); env.push(w); }
    const signTex = U.canvasTexture(2048, 512, (g, w, h) => {
      g.fillStyle = "#07041a"; g.fillRect(0, 0, w, h);
      g.font = "900 190px Unbounded, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
      g.shadowColor = "#ff3df2"; g.shadowBlur = 40; g.fillStyle = "#ffd6fb"; g.fillText("NEON GALLERY", w / 2, h / 2);
    });
    const back = new THREE.Mesh(new THREE.PlaneGeometry(14, 8), new THREE.MeshStandardMaterial({ color: 0x0d0822, emissive: 0xffffff, emissiveMap: signTex, emissiveIntensity: 0.9 }));
    back.position.set(0, 4, -32); scene.add(back); env.push(back, floor);
    const neon = (c) => new THREE.MeshBasicMaterial({ color: c, toneMapped: false });
    for (const y of [0.4, 6.5]) for (const x of [-6.95, 6.95]) { const s = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 40), neon(y < 1 ? 0x2ef2ff : 0xff3df2)); s.position.set(x, y, -18); scene.add(s); }
    for (let z = -4; z > -32; z -= 4) for (const x of [-6.9, 6.9]) { const s = new THREE.Mesh(new THREE.BoxGeometry(0.05, 6, 0.05), neon(0x8a7dff)); s.position.set(x, 3.5, z); scene.add(s); }
    const counter = new THREE.Mesh(new THREE.BoxGeometry(9, 0.9, 0.7), new THREE.MeshStandardMaterial({ color: 0x1a0f3a, roughness: 0.4, metalness: 0.4 }));
    counter.position.set(0, 0.45, -1.4); scene.add(counter);
    const cEdge = new THREE.Mesh(new THREE.BoxGeometry(9, 0.04, 0.04), neon(0xffd23f)); cEdge.position.set(0, 0.92, -1.06); scene.add(cEdge);
    const RAILS = [{ z: -8, y: 1.15, dir: 1 }, { z: -14, y: 1.9, dir: -1 }, { z: -21, y: 2.8, dir: 1 }];
    for (const r of RAILS) { const m = new THREE.Mesh(new THREE.BoxGeometry(14, 0.06, 0.06), neon(0xff3d6e)); m.position.set(0, r.y - 0.75, r.z); scene.add(m); }
    // shelves for bottles
    for (const x of [-5.2, 5.2]) { const sh = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.08, 0.6), new THREE.MeshStandardMaterial({ color: 0x3a2a1a })); sh.position.set(x, 1.6, -10); scene.add(sh); env.push(sh); }

    // gun (barrel along +z so lookAt aims it)
    const gun = new THREE.Group();
    const gm = new THREE.MeshStandardMaterial({ color: 0x20203a, metalness: 0.8, roughness: 0.25 });
    const gGlow = new THREE.MeshBasicMaterial({ color: 0x2ef2ff, toneMapped: false });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.32), gm); gun.add(body);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.26, 16).rotateX(Math.PI / 2), gm); barrel.position.z = 0.24; gun.add(barrel);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 0.08), gm); grip.position.set(0, -0.11, -0.08); grip.rotation.x = -0.3; gun.add(grip);
    const coil = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.008, 8, 24), gGlow); coil.position.z = 0.2; gun.add(coil);
    const coil2 = coil.clone(); coil2.position.z = 0.28; gun.add(coil2);
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.015, 0.26), gGlow); strip.position.y = 0.05; gun.add(strip);
    const muzzle = new THREE.Object3D(); muzzle.position.z = 0.38; gun.add(muzzle);
    const flash = U.glowSprite(0x8fffff, 0.4, 1); flash.position.z = 0.4; flash.visible = false; gun.add(flash);
    const flashLight = new THREE.PointLight(0x8fffff, 0, 6, 2); flashLight.position.z = 0.45; gun.add(flashLight);
    const GUN_HOME = new THREE.Vector3(0.28, -0.28, -0.6);
    gun.position.copy(GUN_HOME); camera.add(gun);

    // crosshair
    const cross = document.createElement("div");
    cross.innerHTML = `<svg width="64" height="64" viewBox="0 0 64 64" style="overflow:visible"><circle cx="32" cy="32" r="18" fill="none" stroke="currentColor" stroke-width="3"/><path d="M32 4v14M32 46v14M4 32h14M46 32h14" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><circle cx="32" cy="32" r="3" fill="currentColor"/></svg>`;
    cross.style.cssText = "position:fixed;left:0;top:0;margin:-32px 0 0 -32px;z-index:40;pointer-events:none;color:#2ef2ff;filter:drop-shadow(0 0 6px currentColor)";
    document.body.appendChild(cross);
    ui.hideCursor = true;

    const particles = new U.Particles(scene, 3000);
    const texts = new U.FloatTexts(scene);
    const tracers = [];

    // ---------------------------------------------------------------- targets
    const targets = [];
    const ringCols = [0xffffff, 0xff3d6e, 0xffffff, 0xff3d6e, 0xffd23f];
    const smileTex = U.canvasTexture(256, 256, (g, w, h) => {
      g.fillStyle = "#2e7bff"; g.beginPath(); g.arc(w / 2, h / 2, w / 2, 0, 7); g.fill();
      g.fillStyle = "#fff"; g.beginPath(); g.arc(w * 0.36, h * 0.4, 18, 0, 7); g.arc(w * 0.64, h * 0.4, 18, 0, 7); g.fill();
      g.strokeStyle = "#fff"; g.lineWidth = 14; g.lineCap = "round"; g.beginPath(); g.arc(w / 2, h * 0.52, 62, 0.2 * Math.PI, 0.8 * Math.PI); g.stroke();
    });
    function makeBoard(friend) {
      const root = new THREE.Group(); const R = U.rand(0.42, 0.62); const hits = [];
      if (friend) {
        const d = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 0.06, 40).rotateX(Math.PI / 2), [new THREE.MeshStandardMaterial({ color: 0x2e7bff }), new THREE.MeshStandardMaterial({ map: smileTex, emissive: 0x2244aa, emissiveIntensity: 0.4 }), new THREE.MeshStandardMaterial({ color: 0x2e7bff })]);
        root.add(d); hits.push(d);
      } else ringCols.forEach((c, i) => {
        const r = R * (1 - i * 0.2);
        const d = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.05 + i * 0.012, 40).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: i === 4 ? 0.8 : 0.12, roughness: 0.4 }));
        root.add(d); hits.push(d);
      });
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.75, 8), new THREE.MeshStandardMaterial({ color: 0x888899, metalness: 0.8 })); post.position.y = -R - 0.3; root.add(post);
      return { root, hits, R };
    }
    function spawnBoard() {
      const rail = U.pick(RAILS), friend = Math.random() < 0.16;
      const { root, hits, R } = makeBoard(friend);
      const dir = rail.dir * (Math.random() < 0.5 ? 1 : -1);
      root.position.set(-dir * 8, rail.y, rail.z);
      root.rotation.x = -Math.PI / 2;
      scene.add(root);
      const t = { kind: friend ? "friend" : "board", root, hits, R, dir, speed: U.rand(1.6, 3.2) + elapsed * 0.03, state: "up", t: 0 };
      hits.forEach((m) => (m.userData.t = t)); targets.push(t);
    }
    const bottleGeo = new THREE.LatheGeometry([[0, 0], [0.09, 0], [0.1, 0.02], [0.1, 0.24], [0.06, 0.32], [0.035, 0.36], [0.035, 0.46], [0.04, 0.47], [0, 0.47]].map(([x, y]) => new THREE.Vector2(x, y)), 20);
    function spawnBottles() {
      for (const sx of [-5.2, 5.2]) for (let i = 0; i < 4; i++) {
        const c = U.pick([0x2ef2a0, 0xff8a1f, 0x2ef2ff, 0xb6ff3d]);
        const m = new THREE.Mesh(bottleGeo, new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.05, transparent: true, opacity: 0.75, clearcoat: 1, emissive: c, emissiveIntensity: 0.25 }));
        m.position.set(sx - 0.9 + i * 0.6, 1.64, -10); scene.add(m);
        const t = { kind: "bottle", root: m, hits: [m], state: "idle", t: 0, color: c }; m.userData.t = t; targets.push(t);
      }
    }
    function spawnDrone() {
      const root = new THREE.Group();
      const core = new THREE.Mesh(new THREE.SphereGeometry(0.22, 24, 16), new THREE.MeshStandardMaterial({ color: 0x111122, emissive: 0xff3df2, emissiveIntensity: 1.2, metalness: 0.6, roughness: 0.2 }));
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.04, 8, 32), new THREE.MeshStandardMaterial({ color: 0x8a7dff, metalness: 0.9, roughness: 0.2 })); ring.rotation.x = Math.PI / 2;
      root.add(core, ring, U.glowSprite(0xff3df2, 1.3, 0.5));
      scene.add(root);
      const t = { kind: "drone", root, hits: [core, ring], state: "fly", t: 0, z: U.rand(-11, -18), amp: U.rand(3, 5.5), w: U.rand(0.5, 0.9), ph: Math.random() * 6 };
      t.hits.forEach((m) => (m.userData.t = t)); targets.push(t);
    }
    function spawnUfo() {
      const root = new THREE.Group();
      const disc = new THREE.Mesh(new THREE.SphereGeometry(0.7, 32, 12), new THREE.MeshStandardMaterial({ color: 0xffcc33, metalness: 1, roughness: 0.2, emissive: 0xff8800, emissiveIntensity: 0.3 })); disc.scale.y = 0.28;
      const dome = new THREE.Mesh(new THREE.SphereGeometry(0.32, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshPhysicalMaterial({ color: 0x9ff, transparent: true, opacity: 0.6, roughness: 0 })); dome.position.y = 0.1;
      root.add(disc, dome, U.glowSprite(0xffd23f, 2.4, 0.5));
      const dir = Math.random() < 0.5 ? 1 : -1;
      root.position.set(-dir * 12, 5.2, -22); scene.add(root);
      const t = { kind: "ufo", root, hits: [disc, dome], state: "fly", t: 0, dir };
      t.hits.forEach((m) => (m.userData.t = t)); targets.push(t);
      sfx.laser();
    }
    spawnBottles();

    // ---------------------------------------------------------------- state
    let running = false, timeLeft = TIME, elapsed = 0, score = 0, ammo = MAG, reloading = 0;
    let shots = 0, hitsN = 0, bulls = 0, streak = 0, fistT = 0, spawnT = 0.5, droneT = 8, ufoT = 12, recoil = 0;
    const ray = new THREE.Raycaster();
    const _a = { x: 0, y: 0 }, _w = new THREE.Vector3(), _q = new THREE.Vector3(), aimPoint = new THREE.Vector3(0, 1.6, -20);

    function hitTargets() { const list = []; for (const t of targets) if (t.state !== "dead" && t.state !== "falling") list.push(...t.hits); return list; }

    function fire(h) {
      if (reloading > 0) return;
      if (ammo <= 0) { sfx.empty(); ui.toast("Out of ammo — make a fist ✊ to reload"); return; }
      ammo--; shots++; recoil = 1;
      sfx.shoot();
      flash.visible = true; flashLight.intensity = 30;
      setTimeout(() => { flash.visible = false; flashLight.intensity = 0; }, 60);
      const p = h.synthetic ? h.ptr : input.past(h, 110, _a);
      U.rayFromScreen(camera, p.x, p.y, ray);
      const hits = ray.intersectObjects(hitTargets(), false);
      const envHit = ray.intersectObjects(env, false)[0];
      muzzle.getWorldPosition(_w);
      let end;
      if (hits.length) {
        const hit = hits[0], t = hit.object.userData.t;
        end = hit.point.clone();
        hitsN++; streak++;
        let pts = 0, label = "", col = "#ffffff";
        if (t.kind === "board") {
          const lp = t.root.worldToLocal(hit.point.clone());
          const r = Math.hypot(lp.x, lp.y) / t.R;
          pts = r < 0.22 ? 100 : r < 0.45 ? 50 : r < 0.7 ? 25 : 10;
          if (pts === 100) { bulls++; label = "BULLSEYE! "; col = "#ffd23f"; sfx.good(); }
          t.state = "falling"; t.t = 0; sfx.hit();
          particles.burst(hit.point, 0xffffff, 25, 4, { size: 0.12 });
        } else if (t.kind === "friend") {
          pts = -50; label = "FRIEND! "; col = "#4d7cff"; streak = 0; sfx.bad(); ui.flash("#2e7bff", 0.35);
          t.state = "falling"; t.t = 0;
        } else if (t.kind === "bottle") {
          pts = 20; sfx.glass(); t.state = "dead"; scene.remove(t.root);
          particles.burst(t.root.position.clone().add(_q.set(0, 0.25, 0)), t.color, 45, 4.5, { size: 0.1, gravity: -9 });
        } else if (t.kind === "drone") {
          pts = 40; sfx.boom(); t.state = "dead"; scene.remove(t.root);
          particles.burst(t.root.position, 0xff3df2, 80, 7, { size: 0.25 });
        } else if (t.kind === "ufo") {
          pts = 150; label = "UFO! "; col = "#ffd23f"; sfx.boom(); sfx.coin(); t.state = "dead"; scene.remove(t.root);
          particles.burst(t.root.position, 0xffd23f, 150, 9, { size: 0.35 });
        }
        const mult = pts > 0 && streak >= 5 ? 2 : 1;
        score = Math.max(0, score + pts * mult);
        texts.spawn(`${label}${pts > 0 ? "+" : ""}${pts * mult}${mult > 1 ? " ×2" : ""}`, hit.point.clone().add(_q.set(0, 0.4, 0)), { color: col, size: pts >= 100 ? 0.45 : 0.32 });
        if (streak === 5) ui.banner("ON FIRE ×2", "#ff8a1f");
      } else {
        streak = 0;
        end = envHit ? envHit.point.clone() : ray.ray.origin.clone().addScaledVector(ray.ray.direction, 40);
        if (envHit) particles.burst(envHit.point, 0x2ef2ff, 12, 2, { size: 0.08, life: 0.4 });
      }
      const g = new THREE.BufferGeometry().setFromPoints([_w.clone(), end]);
      const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0x8fffff, transparent: true, opacity: 1, toneMapped: false }));
      scene.add(l); tracers.push({ l, t: 0 });
      if (ammo === 0) { ui.banner("RELOAD ✊", "#2ef2ff"); }
    }
    function reload() {
      if (reloading > 0 || ammo === MAG) return;
      reloading = 0.7; sfx.reload();
    }

    return {
      start() { running = true; ui.toast("Tap thumb to finger to shoot 🔫"); },
      update(dt, now) {
        const h = input.primary;
        if (h) { cross.style.transform = `translate(${h.ptr.x}px, ${h.ptr.y}px)`; cross.style.display = ""; } else cross.style.display = "none";
        if (h) U.pointAtDistance(camera, h.ptr.x, h.ptr.y, 20, aimPoint);
        gun.lookAt(aimPoint);
        if (h) {
          // colour the crosshair when it's over something shootable
          U.rayFromScreen(camera, h.ptr.x, h.ptr.y, ray);
          const over = ray.intersectObjects(hitTargets(), false)[0];
          cross.style.color = over ? (over.object.userData.t.kind === "friend" ? "#4d7cff" : "#ffd23f") : "#2ef2ff";
        }
        if (running) {
          timeLeft -= dt; elapsed += dt;
          if (h && !input.locked) {
            if (h.pinchStart || (h.synthetic && input.key("Space") && !this._sp)) fire(h);
            this._sp = input.key("Space");
            if (h.gesture === "fist" && !h.synthetic) { fistT += dt; if (fistT > 0.12) reload(); } else fistT = 0;
            if (input.key("KeyR") || (h.synthetic && input.mouse.right)) reload();
          }
          spawnT -= dt;
          if (spawnT <= 0) { if (targets.filter((t) => t.kind === "board" || t.kind === "friend").length < 6) spawnBoard(); spawnT = Math.max(0.5, 1.3 - elapsed / 60); }
          droneT -= dt; if (droneT <= 0) { spawnDrone(); droneT = U.rand(5, 9); }
          ufoT -= dt; if (ufoT <= 0) { spawnUfo(); ufoT = U.rand(10, 16); }
          if (!targets.some((t) => t.kind === "bottle" && t.state !== "dead")) spawnBottles();
          if (timeLeft <= 0) {
            running = false; timeLeft = 0; sfx.whistle();
            ctx.end({ title: "Time's up!", score, stats: [["Hits", `${hitsN}/${shots}`], ["Accuracy", shots ? `${Math.round((hitsN / shots) * 100)}%` : "–"], ["Bullseyes", bulls]] });
          }
        }
        if (reloading > 0) { reloading -= dt; if (reloading <= 0) { ammo = MAG; sfx.click(); } }
        recoil = Math.max(0, recoil - dt * 8);
        gun.position.set(GUN_HOME.x, GUN_HOME.y - (reloading > 0 ? Math.sin((reloading / 0.7) * Math.PI) * 0.25 : 0), GUN_HOME.z + recoil * 0.07);
        gun.rotateX(-recoil * 0.25);
        if (reloading > 0) gun.rotateZ(Math.sin((reloading / 0.7) * Math.PI) * 1.2);
        coil.material.color.setHSL(0.5, 1, ammo ? 0.6 : 0.15);

        const tt = now / 1000;
        for (const t of targets) {
          t.t += dt;
          if (t.kind === "board" || t.kind === "friend") {
            if (t.state === "up") { t.root.rotation.x = Math.min(0, -Math.PI / 2 + t.t * 6); if (t.root.rotation.x >= 0) t.state = "move"; }
            if (t.state === "up" || t.state === "move") { t.root.position.x += t.dir * t.speed * dt; if (Math.abs(t.root.position.x) > 8.5) { t.state = "dead"; scene.remove(t.root); } }
            if (t.state === "falling") { t.root.rotation.x = Math.max(-Math.PI / 2, -t.t * 6); if (t.t > 0.6) { t.state = "dead"; scene.remove(t.root); } }
          } else if (t.kind === "drone" && t.state === "fly") {
            t.root.position.set(Math.sin(tt * t.w + t.ph) * t.amp, 2.8 + Math.sin(tt * t.w * 2.3 + t.ph) * 1.0, t.z);
            t.root.rotation.y += dt * 3;
            if (t.t > 14) { t.state = "dead"; scene.remove(t.root); }
          } else if (t.kind === "ufo" && t.state === "fly") {
            t.root.position.x += t.dir * 6.5 * dt; t.root.position.y = 5.2 + Math.sin(tt * 4) * 0.2; t.root.rotation.y += dt * 4;
            if (Math.abs(t.root.position.x) > 13) { t.state = "dead"; scene.remove(t.root); }
          }
        }
        for (let i = targets.length - 1; i >= 0; i--) if (targets[i].state === "dead") targets.splice(i, 1);
        for (const tr of tracers) { tr.t += dt; tr.l.material.opacity = Math.max(0, 1 - tr.t / 0.09); }
        for (let i = tracers.length - 1; i >= 0; i--) if (tracers[i].t > 0.09) { scene.remove(tracers[i].l); tracers[i].l.geometry.dispose(); tracers[i].l.material.dispose(); tracers.splice(i, 1); }
        particles.update(dt); texts.update(dt);
        ui.setStats([
          { label: "SCORE", value: score, cls: "hot" },
          { label: "TIME", value: Math.ceil(timeLeft), cls: timeLeft < 10 ? "warn" : "" },
          { label: "AMMO", value: reloading > 0 ? "…" : "▮".repeat(ammo) || "0", cls: ammo < 3 ? "warn" : "cool" },
          { label: "STREAK", value: streak },
        ]);
      },
      dispose() { cross.remove(); ui.hideCursor = false; },
    };
  },
};
