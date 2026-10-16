// Football penalty shootout — take a shot (aim + flick your hand), then be the goalkeeper with your hands as gloves.
import * as THREE from "three";
import * as U from "../util.js";
import { soccerBallMaterial } from "../icons.js";

const G = 9.81, GW = 3.66, GH = 2.44, R = 0.11, ROUNDS = 5;

export default {
  id: "football", title: "Football", emoji: "⚽", color: "#2ef2a0", short: "Penalty shootout",
  desc: "A floodlit penalty shootout. Score past the keeper, then become the keeper and save with your bare hands.",
  howto: [["🎯", "Shooting: point to aim inside the goal"], ["💥", "Flick your hand upward fast (or pinch) to kick"], ["🧤", "Keeping: both hands become gloves — block the ball"], ["🏆", "5 shots each — win the shootout!"]],
  help: [["🎯", "Point to aim"], ["💥", "Flick up / pinch = kick"], ["🧤", "Your hands are gloves when saving"]],

  create(ctx) {
    const { input, ui, sfx } = ctx;
    const scene = new THREE.Scene();
    scene.environment = ctx.env; scene.environmentIntensity = 0.4;
    scene.fog = new THREE.Fog(0x070a24, 60, 160);
    const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.05, 500);
    ctx.view(scene, camera);
    ctx.bloom(0.7, 0.5, 0.85);
    U.makeSky(scene, "#010210", "#14205a", { stars: 300 });
    const { dir } = U.addLights(scene, { ambient: 0.7, sky: 0xcfe0ff, ground: 0x103010, sun: 2.4, sunPos: [-12, 30, 20] });
    dir.shadow.camera.left = dir.shadow.camera.bottom = -20; dir.shadow.camera.right = dir.shadow.camera.top = 20;

    // pitch with stripes and penalty-box lines
    const pitchTex = U.canvasTexture(1024, 1024, (g, w, h) => {
      for (let i = 0; i < 12; i++) { g.fillStyle = i % 2 ? "#2f8a34" : "#2a7a2f"; g.fillRect(0, (i * h) / 12, w, h / 12 + 1); }
      g.strokeStyle = "rgba(255,255,255,.9)"; g.lineWidth = 5;
      const sx = w / 60, sz = h / 60; // 60m x 60m texture, goal line at z=0 → y = 10*sz
      const X = (x) => w / 2 + x * sx, Z = (z) => (10 + z) * sz;
      g.beginPath(); g.moveTo(0, Z(0)); g.lineTo(w, Z(0)); g.stroke();
      g.strokeRect(X(-20.16), Z(0), 40.32 * sx, 16.5 * sz);
      g.strokeRect(X(-9.16), Z(0), 18.32 * sx, 5.5 * sz);
      g.beginPath(); g.arc(X(0), Z(11), 9.15 * sx, 0.2 * Math.PI, 0.8 * Math.PI); g.stroke();
      g.fillStyle = "#fff"; g.beginPath(); g.arc(X(0), Z(11), 6, 0, Math.PI * 2); g.fill();
    });
    const pitch = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshStandardMaterial({ map: pitchTex, roughness: 0.95 }));
    pitch.rotation.x = -Math.PI / 2; pitch.position.set(0, 0, 20); pitch.receiveShadow = true; scene.add(pitch);
    const outer = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: 0x1f5a24, roughness: 1 }));
    outer.rotation.x = -Math.PI / 2; outer.position.y = -0.01; scene.add(outer);

    // goal + net
    const postMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3, emissive: 0x333333 });
    const goal = new THREE.Group();
    for (const x of [-GW, GW]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, GH, 16), postMat); p.position.set(x, GH / 2, 0); goal.add(p); }
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, GW * 2 + 0.12, 16), postMat); bar.rotation.z = Math.PI / 2; bar.position.y = GH; goal.add(bar);
    const netMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.28 });
    const netPts = [];
    const D = 2;
    for (let x = -GW; x <= GW + 0.01; x += 0.2) { netPts.push(x, 0, -D, x, GH, -D); netPts.push(x, GH, 0, x, GH, -D); }
    for (let y = 0; y <= GH + 0.01; y += 0.2) { netPts.push(-GW, y, -D, GW, y, -D); for (const x of [-GW, GW]) netPts.push(x, y, 0, x, y, -D); }
    for (let z = 0; z >= -D; z -= 0.2) { netPts.push(-GW, GH, z, GW, GH, z); for (const x of [-GW, GW]) netPts.push(x, 0, z, x, GH, z); }
    const ng = new THREE.BufferGeometry(); ng.setAttribute("position", new THREE.Float32BufferAttribute(netPts, 3));
    goal.add(new THREE.LineSegments(ng, netMat));
    U.shadowAll(goal, true, false); scene.add(goal);

    // stands + crowd
    const crowdN = 2400;
    const crowd = new THREE.InstancedMesh(new THREE.BoxGeometry(0.45, 0.7, 0.3), new THREE.MeshStandardMaterial({ roughness: 0.9 }), crowdN);
    const crowdBase = [];
    {
      const m = new THREE.Matrix4(), c = new THREE.Color();
      for (let i = 0; i < crowdN; i++) {
        const side = i % 3; let x, z, y;
        const row = Math.floor(Math.random() * 14), t = Math.random();
        if (side === 0) { x = U.rand(-30, 30); z = -9 - row * 0.9; }
        else { x = (side === 1 ? -1 : 1) * (26 + row * 0.9); z = U.rand(-6, 40); }
        y = 0.8 + row * 0.6;
        crowdBase.push([x, y, z, Math.random() * 6]);
        m.makeTranslation(x, y, z); crowd.setMatrixAt(i, m);
        crowd.setColorAt(i, c.setHSL(t < 0.5 ? 0.6 : 0.0 + Math.random() * 0.1, 0.7, U.rand(0.35, 0.65)));
      }
    }
    scene.add(crowd);
    const standMat = new THREE.MeshStandardMaterial({ color: 0x1a1f3a, roughness: 0.9 });
    const st1 = new THREE.Mesh(new THREE.BoxGeometry(70, 10, 1), standMat); st1.position.set(0, 4, -22); scene.add(st1);
    for (const [x, z] of [[-45, -25], [45, -25], [-45, 45], [45, 45]]) { const lamp = U.glowSprite(0xffffff, 22, 0.9); lamp.position.set(x, 36, z); scene.add(lamp); }
    const ad = U.canvasTexture(2048, 128, (g, w, h) => { const grd = g.createLinearGradient(0, 0, w, 0); grd.addColorStop(0, "#ff3df2"); grd.addColorStop(0.5, "#2ef2ff"); grd.addColorStop(1, "#b6ff3d"); g.fillStyle = grd; g.fillRect(0, 0, w, h); g.fillStyle = "#0a0620"; g.font = "900 78px Unbounded, sans-serif"; g.textBaseline = "middle"; for (let x = 20; x < w; x += 680) g.fillText("HANDVERSE  ⚽", x, h / 2); });
    const board = new THREE.Mesh(new THREE.PlaneGeometry(40, 1.1), new THREE.MeshBasicMaterial({ map: ad, toneMapped: false })); board.position.set(0, 0.55, -6.5); scene.add(board);

    // people
    function person(color) {
      const p = new THREE.Group();
      const kit = new THREE.MeshStandardMaterial({ color, roughness: 0.6 });
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.26, 0.7, 4, 10), kit); body.position.y = 1.1; p.add(body);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 14, 10), new THREE.MeshStandardMaterial({ color: 0xc28a62 })); head.position.y = 1.78; p.add(head);
      const legs = new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 0.55, 4, 8), new THREE.MeshStandardMaterial({ color: 0x111111 })); legs.position.y = 0.42; p.add(legs);
      const arms = [];
      for (const s of [-1, 1]) { const a = new THREE.Group(); a.position.set(s * 0.32, 1.45, 0); const m = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.5, 4, 8), kit); m.position.y = -0.3; a.add(m); const gl = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), new THREE.MeshStandardMaterial({ color: 0xb6ff3d, emissive: 0x335500 })); gl.position.y = -0.62; a.add(gl); p.add(a); arms.push(a); }
      p.userData.arms = arms;
      U.shadowAll(p, true, false); scene.add(p); return p;
    }
    const keeper = person(0xffd23f);
    const striker = person(0xff3d6e);

    // ball
    const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(R, 3), soccerBallMaterial()); ball.castShadow = true; scene.add(ball);
    const ballShadow = new THREE.Mesh(new THREE.CircleGeometry(R * 1.1, 20), new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: 0.4, depthWrite: false }));
    ballShadow.rotation.x = -Math.PI / 2; scene.add(ballShadow);
    const trail = new U.Particles(scene, 800);

    // aim reticle (on the goal plane) and gloves
    const reticle = new THREE.Group();
    reticle.add(new THREE.Mesh(new THREE.RingGeometry(0.22, 0.28, 40), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false, transparent: true, opacity: 0.9, depthTest: false })));
    reticle.add(new THREE.Mesh(new THREE.CircleGeometry(0.05, 16), new THREE.MeshBasicMaterial({ color: 0xff3df2, toneMapped: false, depthTest: false })));
    reticle.renderOrder = 20; reticle.children.forEach((c) => (c.renderOrder = 20)); scene.add(reticle);
    function glove(color) {
      const g = new THREE.Group();
      const m = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.4, roughness: 0.5, transparent: true, opacity: 0.92 });
      const palm = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.32, 0.1), m); g.add(palm);
      for (let i = 0; i < 4; i++) { const f = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.14, 4, 8), m); f.position.set(-0.105 + i * 0.07, 0.25, 0); g.add(f); }
      const th = new THREE.Mesh(new THREE.CapsuleGeometry(0.04, 0.12, 4, 8), m); th.position.set(-0.19, 0.02, 0.02); th.rotation.z = 0.9; g.add(th);
      const glow = U.glowSprite(color, 1.1, 0.35); g.add(glow);
      g.visible = false; scene.add(g); return g;
    }
    const gloves = [glove(0xb6ff3d), glove(0x2ef2ff)];

    // ---------------------------------------------------------------- state
    let running = false, mode = "shoot", phase = "aim", phaseT = 0;
    let round = 0, myGoals = 0, cpuGoals = 0, saves = 0;
    const results = []; // per kick: {who, goal}
    const v = new THREE.Vector3(), acc = new THREE.Vector3();
    const aim = new THREE.Vector3(0, 1.2, 0);
    const goalPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    const keeperDive = { from: new THREE.Vector3(), to: new THREE.Vector3(), t: 0, delay: 0, active: false };
    let inNet = false, done = false;

    function setMode(m) {
      mode = m; phase = m === "shoot" ? "aim" : "runup"; phaseT = 0; inNet = false; done = false; keeperDive.active = false;
      ball.position.set(0, R, 11); v.set(0, 0, 0); acc.set(0, 0, 0);
      keeper.position.set(0, 0, 0.35); keeper.rotation.set(0, 0, 0); keeper.visible = m === "shoot";
      keeper.userData.arms.forEach((a) => (a.rotation.z = 0));
      striker.visible = m === "save";
      striker.position.set(U.rand(-1.5, 1.5), 0, 14); striker.lookAt(0, 0, 11);
      reticle.visible = m === "shoot";
      if (m === "shoot") { camera.position.set(0, 1.65, 15.6); camera.lookAt(0, 1.15, 0); }
      else { camera.position.set(0, 1.3, -1.7); camera.lookAt(0, 1.0, 11); }
      ui.banner(m === "shoot" ? "YOUR SHOT" : "SAVE IT!", m === "shoot" ? "#ff3df2" : "#b6ff3d");
    }

    function launchTo(target, T, curve = 0) {
      acc.set(curve, -G, 0);
      v.copy(target).sub(ball.position).addScaledVector(acc, -0.5 * T * T).divideScalar(T);
      phase = "flight"; phaseT = 0;
      sfx.kick();
    }

    function keeperReact(target) {
      const guessRight = Math.random() < 0.58;
      const gx = guessRight ? target.x : U.rand(-3, 3);
      keeperDive.from.copy(keeper.position);
      keeperDive.to.set(U.clamp(gx * 0.9, -2.9, 2.9), U.clamp(target.y - 1.0, 0, 1.3), 0.35);
      keeperDive.t = 0; keeperDive.delay = U.rand(0.12, 0.26); keeperDive.active = true;
    }
    function keeperBlocks() {
      // keeper modelled as a fat line from feet to raised glove
      const ang = keeper.rotation.z;
      const feet = keeper.position.clone();
      const top = feet.clone().add(new THREE.Vector3(-Math.sin(ang) * 2.3, Math.cos(ang) * 2.3, 0));
      const cp = new THREE.Vector3(); new THREE.Line3(feet, top).closestPointToPoint(ball.position, true, cp);
      return cp.distanceTo(ball.position) < 0.42;
    }

    function result(goal, who) {
      if (done) return; done = true;
      phase = "result"; phaseT = 0;
      results.push({ who, goal });
      if (who === "me") { if (goal) { myGoals++; ui.banner("GOAL!", "#ffd23f"); sfx.cheer(); } else { ui.banner(keeperSaved ? "SAVED!" : "MISSED!", "#ff3d6e"); sfx.bad(); } }
      else { if (goal) { cpuGoals++; ui.banner("GOAL…", "#ff3d6e"); sfx.bad(); } else { saves++; ui.banner(keeperSaved ? "WHAT A SAVE!" : "MISSED!", "#b6ff3d"); sfx.cheer(); } }
    }
    let keeperSaved = false;

    const _sp = new THREE.Vector3();
    setMode("shoot");

    return {
      start() { running = true; setMode("shoot"); },
      update(dt, now) {
        const hands = input.hands, h = input.primary;
        phaseT += dt;
        // crowd bounce
        const m4 = new THREE.Matrix4(), excite = phase === "result" ? 1 : 0.15;
        for (let i = 0; i < crowdN; i += 1) {
          const [x, y, z, s] = crowdBase[i];
          m4.makeTranslation(x, y + Math.max(0, Math.sin(now / 1000 * 8 + s)) * 0.25 * excite, z);
          crowd.setMatrixAt(i, m4);
        }
        crowd.instanceMatrix.needsUpdate = true;

        if (mode === "shoot") {
          if (h && phase === "aim" && !input.locked) {
            const p = U.pointOnPlane(camera, h.ptr.x, h.ptr.y, goalPlane, _sp);
            if (p) { p.x = U.clamp(p.x, -5.5, 5.5); p.y = U.clamp(p.y, 0.12, 3.6); aim.lerp(p, 0.5); }
            reticle.position.set(aim.x, aim.y, 0.05);
            const inside = Math.abs(aim.x) < GW && aim.y < GH;
            reticle.children[0].material.color.set(inside ? 0xffffff : 0xff3d6e);
            if (running) {
              const flick = !h.synthetic && h.vel.y < -innerHeight * 1.5;
              if (h.pinchStart || flick) {
                const power = flick ? U.clamp(-h.vel.y / innerHeight / 4, 0.4, 1) : 0.7;
                const curve = flick ? U.clamp(h.vel.x / innerWidth * 2.5, -4, 4) : 0;
                const T = 0.9 - power * 0.35;
                const tgt = aim.clone(); tgt.z = -0.3;
                launchTo(tgt, T, curve);
                keeperSaved = false;
                keeperReact(aim);
              }
            }
          }
          if (keeperDive.active) {
            keeperDive.t += dt;
            const k = U.clamp((keeperDive.t - keeperDive.delay) / 0.42, 0, 1), e = 1 - (1 - k) ** 3;
            keeper.position.lerpVectors(keeperDive.from, keeperDive.to, e);
            const dx = keeperDive.to.x - keeperDive.from.x;
            keeper.rotation.z = -Math.sign(dx) * Math.min(1.2, Math.abs(dx) * 0.45) * e;
            keeper.userData.arms.forEach((a) => (a.rotation.z = Math.PI * 0.9 * e * (dx > 0 ? 1 : -1)));
          } else if (phase === "aim") {
            keeper.position.x = Math.sin(now / 700) * 0.5;
          }
        } else {
          // keeper mode: up to two gloves
          gloves.forEach((g, i) => {
            const hh = hands[i];
            g.visible = !!hh;
            if (!hh) return;
            const tx = -(hh.nx - 0.5) * 9.4, ty = (1 - hh.ny) * 3.1;
            g.position.lerp(_sp.set(tx, ty, 0.25), 0.7);
            g.rotation.z = (hh.nx - 0.5) * 0.6;
            g.scale.setScalar(hands.length === 1 ? 1.4 : 1);
          });
          if (phase === "runup") {
            const k = Math.min(1, phaseT / 1.1);
            striker.position.lerpVectors(striker.position, new THREE.Vector3(0.3, 0, 11.6), k * 0.15);
            if (phaseT > 1.2 && running) {
              const tgt = new THREE.Vector3(U.rand(-3.3, 3.3), U.rand(0.25, 2.2), -0.3);
              const T = U.rand(0.62, 0.9) - round * 0.03;
              keeperSaved = false;
              launchTo(tgt, T, U.rand(-2.5, 2.5));
            }
          }
        }

        // ball flight
        if (phase === "flight" || phase === "result") {
          const sub = 4;
          for (let i = 0; i < sub; i++) {
            const pz = ball.position.z;
            v.addScaledVector(acc, dt / sub);
            ball.position.addScaledVector(v, dt / sub);
            if (ball.position.y < R) { ball.position.y = R; v.y = Math.abs(v.y) * 0.5; v.x *= 0.9; v.z *= 0.9; }
            if (phase !== "flight") { if (inNet && ball.position.z < -D + 0.3) { v.multiplyScalar(0.2); } continue; }
            acc.x *= 0.995;
            // saves
            if (mode === "shoot" && keeperBlocks()) { keeperSaved = true; v.set(U.rand(-4, 4), U.rand(2, 5), 7); acc.set(0, -G, 0); sfx.hit(); result(false, "me"); continue; }
            if (mode === "save" && ball.position.z < 0.6) {
              for (const g of gloves) {
                if (g.visible && g.position.distanceTo(ball.position) < 0.34 * g.scale.x + R) {
                  keeperSaved = true; v.set(U.rand(-5, 5), U.rand(3, 6), 9); acc.set(0, -G, 0); sfx.hit(); trail.burst(ball.position, 0xb6ff3d, 50, 5, { size: 0.2 });
                  result(false, "cpu"); break;
                }
              }
              if (phase !== "flight") continue;
            }
            // crossing the goal line
            if (pz >= 0 && ball.position.z < 0) {
              const x = Math.abs(ball.position.x), y = ball.position.y;
              const nearPost = (Math.abs(x - GW) < R + 0.06 && y < GH) || (Math.abs(y - GH) < R + 0.06 && x < GW);
              if (nearPost) { v.z = -v.z * 0.6; v.x *= 0.5; sfx.clack(); ui.toast("Off the woodwork! 😱"); result(false, mode === "shoot" ? "me" : "cpu"); }
              else if (x < GW && y < GH) { inNet = true; acc.set(0, -G, 0); result(true, mode === "shoot" ? "me" : "cpu"); }
              else result(false, mode === "shoot" ? "me" : "cpu");
            }
          }
          if (phase === "flight" && (ball.position.z < -4 || phaseT > 3)) result(false, mode === "shoot" ? "me" : "cpu");
          if (Math.hypot(v.x, v.y, v.z) > 6 && phase === "flight") trail.burst(ball.position, 0xffffff, 1, 0.2, { size: 0.12, life: 0.3, gravity: 0 });
          ball.rotation.x -= v.z * dt * 3; ball.rotation.z += v.x * dt * 3;
        }
        if (phase === "result" && phaseT > 2.0) {
          if (mode === "shoot") setMode("save");
          else {
            round++;
            const left = ROUNDS - round;
            const over = round < ROUNDS ? myGoals > cpuGoals + left || cpuGoals > myGoals + left : myGoals !== cpuGoals;
            if (!over) { if (round >= ROUNDS) ui.toast("Sudden death! ⚡"); setMode("shoot"); }
            else {
              running = false;
              const win = myGoals > cpuGoals;
              ctx.end({ title: win ? "🏆 You win the shootout!" : "Lost the shootout", subtitle: `You ${myGoals} – ${cpuGoals} CPU · ${saves} saves`, score: myGoals * 2 + saves, stats: [["Goals", myGoals], ["Saves", saves], ["Rounds", round]] });
              phase = "over";
            }
          }
        }
        ballShadow.position.set(ball.position.x, 0.01, ball.position.z);
        trail.update(dt);
        const dots = (who) => results.filter((r) => r.who === who).map((r) => (r.goal ? "●" : "○")).join("") || "–";
        ui.setStats([
          { label: "YOU", value: `${myGoals}`, cls: "hot" },
          { label: "CPU", value: `${cpuGoals}`, cls: "warn" },
          { label: "ROUND", value: `${Math.min(round + 1, ROUNDS)}/${ROUNDS}` },
          { label: "KICKS", value: `${dots("me")} · ${dots("cpu")}`, cls: "cool" },
        ]);
      },
      dispose() {},
    };
  },
};
