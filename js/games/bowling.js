// Bowling (cosmic lanes) — pinch to pick up the ball, swing your hand up/forward and release. Real pin physics.
import * as THREE from "three";
import * as CANNON from "cannon-es";
import * as U from "../util.js";
import { lathe } from "../icons.js";

const LW = 0.53, LEN = 18.29, BR = 0.109, PIN_H = 0.38;
const PIN_PROFILE = [[0, 0], [0.026, 0], [0.042, 0.03], [0.06, 0.115], [0.056, 0.17], [0.034, 0.235], [0.024, 0.27], [0.03, 0.31], [0.034, 0.34], [0.026, 0.37], [0, 0.381]];

export default {
  id: "bowling", title: "Bowling", emoji: "🎳", color: "#4d7cff", short: "Cosmic strike",
  desc: "Glow-in-the-dark cosmic bowling with real pin physics. Pick up the ball, swing and roll for strikes.",
  howto: [["↔️", "Move your hand left/right to line up"], ["🤏", "Pinch to pick up the ball"], ["⬆️", "Swing your hand up/forward fast and let go to roll"], ["🌀", "Sideways motion on release adds hook"]],
  help: [["🤏", "Pinch = hold ball"], ["⬆️", "Swing up + release = roll"], ["🌀", "Sideways = hook"], ["⌨️", "Space = straight roll"]],

  create(ctx) {
    const { input, ui, sfx } = ctx;
    const scene = new THREE.Scene();
    scene.environment = ctx.env; scene.environmentIntensity = 0.5;
    scene.background = new THREE.Color(0x04030c);
    scene.fog = new THREE.Fog(0x04030c, 22, 50);
    const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.03, 120);
    const CAM_HOME = new THREE.Vector3(0, 1.15, 2.4);
    camera.position.copy(CAM_HOME); camera.lookAt(0, 0.15, -12);
    ctx.view(scene, camera);
    ctx.bloom(0.95, 0.55, 0.6);
    scene.add(new THREE.HemisphereLight(0x8a7dff, 0x101020, 0.7));
    const deckLight = new THREE.SpotLight(0xffffff, 120, 14, 0.5, 0.5, 1.4);
    deckLight.position.set(0, 3.2, -16.5); deckLight.target.position.set(0, 0, -LEN); deckLight.castShadow = true; deckLight.shadow.mapSize.set(1024, 1024);
    scene.add(deckLight, deckLight.target);
    const front = new THREE.DirectionalLight(0xffffff, 0.8); front.position.set(1, 4, 4); scene.add(front);

    // lane visuals
    const laneTex = U.canvasTexture(256, 2048, (g, w, h) => {
      for (let i = 0; i < 39; i++) { g.fillStyle = `hsl(32,${45 + (i % 3) * 6}%,${62 + (i % 4) * 3}%)`; g.fillRect((i * w) / 39, 0, w / 39 + 1, h); }
      for (let i = 0; i < 40; i++) { g.fillStyle = "rgba(120,70,30,.08)"; g.fillRect(0, Math.random() * h, w, 2); }
      const zToY = (z) => h - ((z + 2.7) / 21) * h; // texture spans z=+2.7 .. -18.3
      g.fillStyle = "#c81e2a"; g.fillRect(0, zToY(0) - 4, w, 8);
      for (let i = 0; i < 7; i++) { const x = ((i + 1) * w) / 8, y = zToY(-4.6 - Math.abs(3 - i) * 0.3); g.beginPath(); g.moveTo(x, y - 24); g.lineTo(x - 9, y + 10); g.lineTo(x + 9, y + 10); g.fill(); }
      for (let i = 0; i < 10; i++) { g.beginPath(); g.arc(((i + 0.5) * w) / 10, zToY(-2), 4, 0, 7); g.fill(); }
    });
    const lane = new THREE.Mesh(new THREE.PlaneGeometry(LW * 2, 21), new THREE.MeshPhysicalMaterial({ map: laneTex, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05 }));
    lane.rotation.x = -Math.PI / 2; lane.position.set(0, 0, -7.8); lane.receiveShadow = true; scene.add(lane);
    const gutterM = new THREE.MeshStandardMaterial({ color: 0x2a2a3a, metalness: 0.8, roughness: 0.3 });
    for (const s of [-1, 1]) {
      const gut = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 21, 16, 1, true, Math.PI / 2, Math.PI), gutterM);
      gut.rotation.x = Math.PI / 2; gut.position.set(s * (LW + 0.12), 0.0, -7.8); scene.add(gut);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.32, 21), new THREE.MeshStandardMaterial({ color: 0x120a28, roughness: 0.4 }));
      cap.position.set(s * (LW + 0.3), 0.05, -7.8); scene.add(cap);
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 21), new THREE.MeshBasicMaterial({ color: s < 0 ? 0x2ef2ff : 0xff3df2, toneMapped: false }));
      strip.position.set(s * (LW + 0.25), 0.22, -7.8); scene.add(strip);
      // neighbouring lanes for atmosphere
      for (const k of [1, 2]) {
        const n = lane.clone(); n.material = lane.material; n.position.x = s * k * 1.7; scene.add(n);
        const ns = strip.clone(); ns.position.x = s * (k * 1.7 + LW + 0.25); scene.add(ns);
      }
    }
    const hood = new THREE.Mesh(new THREE.BoxGeometry(6, 1.2, 1.2), new THREE.MeshStandardMaterial({ color: 0x0c0820, roughness: 0.5 }));
    hood.position.set(0, 1.9, -LEN - 0.4); scene.add(hood);
    const signTex = U.canvasTexture(1024, 256, (g, w, h) => { g.fillStyle = "#0c0820"; g.fillRect(0, 0, w, h); g.font = "900 96px Unbounded, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.shadowColor = "#4d7cff"; g.shadowBlur = 30; g.fillStyle = "#cfe0ff"; g.fillText("COSMIC LANES", w / 2, h / 2); });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 1.1), new THREE.MeshBasicMaterial({ map: signTex, toneMapped: false })); sign.position.set(0, 1.9, -LEN + 0.21); scene.add(sign);
    const backWall = new THREE.Mesh(new THREE.PlaneGeometry(12, 4), new THREE.MeshStandardMaterial({ color: 0x07051a })); backWall.position.set(0, 1, -LEN - 1.5); scene.add(backWall);
    // starfield ceiling
    { const n = 600, p = new Float32Array(n * 3); for (let i = 0; i < n; i++) p.set([U.rand(-8, 8), U.rand(2.6, 4), U.rand(-22, 3)], i * 3); const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(p, 3)); scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0x9ab0ff, size: 0.03 }))); }

    // ball
    const ballTex = U.canvasTexture(512, 256, (g, w, h) => {
      const grd = g.createLinearGradient(0, 0, w, h); grd.addColorStop(0, "#2a0a6a"); grd.addColorStop(0.5, "#6a2cff"); grd.addColorStop(1, "#ff3df2");
      g.fillStyle = grd; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 60; i++) { g.strokeStyle = `rgba(255,255,255,${U.rand(0.05, 0.25)})`; g.lineWidth = U.rand(2, 10); g.beginPath(); g.moveTo(Math.random() * w, Math.random() * h); g.bezierCurveTo(Math.random() * w, Math.random() * h, Math.random() * w, Math.random() * h, Math.random() * w, Math.random() * h); g.stroke(); }
      for (let i = 0; i < 200; i++) { g.fillStyle = "#fff"; g.globalAlpha = Math.random(); g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
      g.globalAlpha = 1; g.fillStyle = "#05030c"; for (const [x, y] of [[250, 110], [280, 100], [266, 140]]) { g.beginPath(); g.arc(x, y, 9, 0, 7); g.fill(); }
    });
    const ballMesh = new THREE.Mesh(new THREE.SphereGeometry(BR, 40, 24), new THREE.MeshPhysicalMaterial({ map: ballTex, roughness: 0.08, clearcoat: 1, emissive: 0x3a10a0, emissiveIntensity: 0.3 }));
    ballMesh.castShadow = true; scene.add(ballMesh);
    const ballGlow = U.glowSprite(0x8a5cff, 0.7, 0.5); scene.add(ballGlow);

    // pins
    const pinGeo = lathe(PIN_PROFILE, 24).translate(0, -PIN_H / 2, 0);
    const pinMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.15, clearcoat: 1, emissive: 0x9fb6ff, emissiveIntensity: 0.15 });
    const stripeMat = new THREE.MeshBasicMaterial({ color: 0xff3d6e, toneMapped: false });
    const SPOTS = [];
    for (let row = 0; row < 4; row++) for (let i = 0; i <= row; i++) SPOTS.push([(i - row / 2) * 0.3048, -LEN - row * 0.264]);

    // physics
    const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) });
    world.allowSleep = true;
    world.solver.iterations = 12;
    const mLane = new CANNON.Material("lane"), mBall = new CANNON.Material("ball"), mPin = new CANNON.Material("pin");
    world.addContactMaterial(new CANNON.ContactMaterial(mBall, mLane, { friction: 0.015, restitution: 0.05 }));
    world.addContactMaterial(new CANNON.ContactMaterial(mPin, mLane, { friction: 0.35, restitution: 0.15 }));
    world.addContactMaterial(new CANNON.ContactMaterial(mBall, mPin, { friction: 0.08, restitution: 0.55 }));
    world.addContactMaterial(new CANNON.ContactMaterial(mPin, mPin, { friction: 0.2, restitution: 0.55 }));
    const box = (hx, hy, hz, x, y, z, mat = mLane) => { const b = new CANNON.Body({ mass: 0, material: mat, shape: new CANNON.Box(new CANNON.Vec3(hx, hy, hz)) }); b.position.set(x, y, z); world.addBody(b); return b; };
    box(LW, 0.1, 10.6, 0, -0.1, -8.6);            // lane + pin deck (z +2 .. -19.2)
    for (const s of [-1, 1]) { box(0.13, 0.05, 10.6, s * (LW + 0.13), -0.15, -8.6); box(0.05, 0.4, 11, s * (LW + 0.31), 0.2, -8.6, mPin); }
    box(1.2, 0.1, 1.0, 0, -0.55, -20.2); box(1.2, 0.8, 0.05, 0, 0, -21.1, mPin);
    const ballBody = new CANNON.Body({ mass: 7, material: mBall, shape: new CANNON.Sphere(BR), linearDamping: 0.01, angularDamping: 0.05 });
    world.addBody(ballBody);
    const pins = SPOTS.map(([x, z]) => {
      const m = new THREE.Mesh(pinGeo, pinMat); m.castShadow = true;
      for (const y of [0.075, 0.095]) { const s = new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.004, 6, 20), stripeMat); s.rotation.x = Math.PI / 2; s.position.y = y; m.add(s); }
      scene.add(m);
      const body = new CANNON.Body({ mass: 1.5, material: mPin, shape: new CANNON.Cylinder(0.035, 0.058, PIN_H, 12), sleepSpeedLimit: 0.05, angularDamping: 0.1 });
      world.addBody(body);
      return { m, body, x, z, standing: true };
    });
    let pinHit = 0;
    for (const p of pins) p.body.addEventListener("collide", (e) => { const v = Math.abs(e.contact.getImpactVelocityAlongNormal()); const now = performance.now(); if (v > 1.2 && now - pinHit > 40) { pinHit = now; sfx.clack(); } });
    ballBody.addEventListener("collide", (e) => { if (e.body.material === mPin && Math.abs(e.contact.getImpactVelocityAlongNormal()) > 2) sfx.crash(); });

    function resetPins(all) {
      for (const p of pins) {
        if (all) p.standing = true;
        if (!p.standing) { if (p.body.world) world.removeBody(p.body); p.m.visible = false; continue; }
        if (!p.body.world) world.addBody(p.body);
        p.body.position.set(p.x, PIN_H / 2 + 0.001, p.z); p.body.quaternion.set(0, 0, 0, 1);
        p.body.velocity.setZero(); p.body.angularVelocity.setZero(); p.body.sleep();
        p.m.visible = true;
      }
    }
    function holdBall(x, y, z) {
      ballBody.type = CANNON.Body.KINEMATIC; ballBody.velocity.setZero(); ballBody.angularVelocity.setZero();
      ballBody.position.set(x, y, z);
    }
    resetPins(true);
    holdBall(0, BR, 0.5);

    // scorecard
    const card = document.createElement("div");
    card.style.cssText = "position:fixed;left:50%;bottom:14px;transform:translateX(-50%);z-index:9;display:flex;gap:4px;pointer-events:none;font:700 13px Inter;";
    document.body.appendChild(card);

    // ---------------------------------------------------------------- state
    let running = false, phase = "ready", phaseT = 0, frame = 0, rollInFrame = 0;
    const rolls = []; // pins per roll
    const frames = Array.from({ length: 10 }, () => []);
    let downBefore = 0, spin = 0, held = false;
    const lookNow = new THREE.Vector3(0, 0.15, -12), _l = new THREE.Vector3();

    function totals() {
      const out = []; let i = 0, sum = 0;
      for (let f = 0; f < 10; f++) {
        if (rolls[i] === undefined) break;
        if (rolls[i] === 10) { if (rolls[i + 2] === undefined) break; sum += 10 + rolls[i + 1] + rolls[i + 2]; i += 1; }
        else { if (rolls[i + 1] === undefined) break; if (rolls[i] + rolls[i + 1] === 10) { if (rolls[i + 2] === undefined) break; sum += 10 + rolls[i + 2]; } else sum += rolls[i] + rolls[i + 1]; i += 2; }
        out.push(sum);
      }
      return out;
    }
    function rawScore() { const t = totals(); return t.length ? t[t.length - 1] : 0; }
    function renderCard() {
      const t = totals();
      card.innerHTML = frames.map((fr, f) => {
        const marks = fr.map((v, k) => {
          const prev = fr[k - 1];
          if (v === 10 && (f === 9 ? prev === undefined || prev === 10 || (k === 2 && fr[0] + fr[1] === 10) : k === 0)) return "X";
          if (k > 0 && prev !== 10 && prev + v === 10) return "/";
          return v === 0 ? "–" : v;
        });
        const cur = f === frame && running;
        return `<div style="min-width:${f === 9 ? 64 : 46}px;padding:5px 6px;border-radius:10px;text-align:center;background:rgba(14,10,38,.72);border:1px solid ${cur ? "#2ef2ff" : "rgba(255,255,255,.14)"};backdrop-filter:blur(8px)"><div style="font-size:10px;color:#b3acd6">${f + 1}</div><div style="letter-spacing:3px;min-height:16px">${marks.join(" ")}</div><div style="font:800 15px Unbounded,Inter;color:#ffc83d">${t[f] ?? ""}</div></div>`;
      }).join("");
    }
    renderCard();

    function release(h) {
      held = false;
      const up = h ? -h.vel.y / innerHeight : 1.6;
      const speed = U.clamp(2.6 + up * 2.4, 2.6, 10.5);
      const side = h ? h.vel.x / innerWidth : 0;
      const ang = U.clamp(side * 0.03, -0.035, 0.035);
      spin = U.clamp(side * 0.9, -1.2, 1.2);
      ballBody.type = CANNON.Body.DYNAMIC; ballBody.mass = 7; ballBody.updateMassProperties();
      ballBody.position.y = Math.max(BR + 0.005, Math.min(ballBody.position.y, BR + 0.08));
      ballBody.velocity.set(Math.sin(ang) * speed, -0.2, -Math.cos(ang) * speed);
      ballBody.angularVelocity.set(-speed / BR, 0, -spin * 6);
      ballBody.wakeUp();
      for (const p of pins) if (p.body.world) p.body.wakeUp();
      phase = "rolling"; phaseT = 0;
      sfx.roll(); sfx.whoosh();
      if (speed > 8) ui.toast(`🚀 ${Math.round(speed * 3.6)} km/h`, 1200);
    }

    function countDown() {
      let down = 0;
      const up = new CANNON.Vec3();
      for (const p of pins) {
        if (!p.standing) { down++; continue; }
        p.body.quaternion.vmult(new CANNON.Vec3(0, 1, 0), up);
        if (up.y < 0.8 || p.body.position.y < 0.1 || p.body.position.z < -LEN - 1.1 || Math.abs(p.body.position.x) > LW + 0.05) { p.standing = false; down++; }
      }
      return down;
    }
    function finishRoll() {
      const down = countDown();
      const knocked = down - downBefore;
      rolls.push(knocked); frames[frame].push(knocked);
      const fr = frames[frame];
      let frameDone = false, resetAll = false;
      if (frame < 9) {
        if (rollInFrame === 0 && knocked === 10) { ui.banner("STRIKE!", "#ffd23f"); sfx.cheer(); frameDone = true; }
        else if (rollInFrame === 1) { if (down === 10) { ui.banner("SPARE!", "#2ef2ff"); sfx.good(); } else if (knocked === 0 && fr[0] === 0) ui.banner("GUTTER", "#b3acd6"); frameDone = true; }
        else if (knocked === 0) ui.toast("Gutter ball 😬");
      } else {
        if (down === 10) { resetAll = true; ui.banner(rollInFrame === 0 || fr[rollInFrame - 1] === 10 ? "STRIKE!" : "SPARE!", "#ffd23f"); sfx.cheer(); }
        const n = fr.length;
        if (n === 3 || (n === 2 && fr[0] + fr[1] < 10)) frameDone = true;
      }
      if (frameDone) { frame++; rollInFrame = 0; downBefore = 0; resetPins(true); }
      else { rollInFrame++; if (resetAll) { downBefore = 0; resetPins(true); } else { downBefore = down; resetPins(false); } }
      renderCard();
      if (frame >= 10) {
        running = false; phase = "over";
        const total = rawScore();
        const strikes = rolls.filter((r) => r === 10).length;
        ctx.end({ title: total >= 200 ? "Bowling legend! 🏆" : "Game complete", score: total, delay: 1500, stats: [["Strikes", strikes], ["Frames", 10]] });
        return;
      }
      phase = "ready"; holdBall(0, BR, 0.5);
    }

    return {
      start() { running = true; ui.toast("Pinch to pick up the ball 🎳"); renderCard(); },
      update(dt) {
        const h = input.primary;
        phaseT += dt;
        if (running && phase === "ready") {
          let x = ballBody.position.x, y = BR, z = 0.5;
          if (h && !input.locked) {
            x = U.lerp(-LW + 0.14, LW - 0.14, U.clamp(((h.synthetic ? h.nx : h.pnx) - 0.25) / 0.5, 0, 1));
            if (h.pinchStart) { held = true; sfx.click(); }
            if (held) { y = 0.3 + (0.5 - h.ny) * 0.3; z = 0.5 + U.clamp(h.ny - 0.5, -0.3, 0.4) * 1.2; if (!h.pinch) release(h); }
          } else if (held) release(null);
          if (input.key("Space") && !held) release({ vel: { x: 0, y: -innerHeight * 2.2 } });
          if (phase === "ready") holdBall(U.damp(ballBody.position.x, x, 14, dt), U.damp(ballBody.position.y, y, 14, dt), U.damp(ballBody.position.z, z, 14, dt));
        }
        if (phase === "rolling") {
          if (ballBody.position.z < -6 && ballBody.position.z > -LEN && ballBody.position.y < BR + 0.02) ballBody.applyForce(new CANNON.Vec3(spin * 9, 0, 0), ballBody.position);
          const stopped = ballBody.velocity.length() < 0.25 && phaseT > 1.5;
          if (ballBody.position.z < -LEN - 1.2 || ballBody.position.y < -0.3 || stopped || phaseT > 8) { phase = "settle"; phaseT = 0; }
        }
        if (phase === "settle" && phaseT > 2.4) finishRoll();
        world.step(1 / 120, dt, 10);

        ballMesh.position.copy(ballBody.position); ballMesh.quaternion.copy(ballBody.quaternion);
        ballGlow.position.copy(ballBody.position);
        for (const p of pins) { p.m.position.copy(p.body.position); p.m.quaternion.copy(p.body.quaternion); }

        // camera follows the ball down the lane
        const follow = phase === "rolling" || phase === "settle";
        const bz = ballBody.position.z;
        const tz = follow ? Math.max(bz + 2.4, -13.5) : CAM_HOME.z;
        camera.position.z = U.damp(camera.position.z, tz, 3, dt);
        camera.position.y = U.damp(camera.position.y, follow ? 0.95 : CAM_HOME.y, 3, dt);
        camera.position.x = U.damp(camera.position.x, follow ? ballBody.position.x * 0.4 : 0, 3, dt);
        _l.set(follow ? ballBody.position.x * 0.3 : 0, 0.15, follow ? Math.min(bz - 4, -LEN) : -12);
        lookNow.lerp(_l, 1 - Math.exp(-4 * dt));
        camera.lookAt(lookNow);
        const standing = pins.filter((p) => p.m.visible).length;
        ui.setStats([
          { label: "SCORE", value: rawScore(), cls: "hot" },
          { label: "FRAME", value: Math.min(frame + 1, 10) },
          { label: "BALL", value: rollInFrame + 1, cls: "cool" },
          { label: "PINS UP", value: standing },
        ]);
      },
      dispose() { card.remove(); },
    };
  },
};
