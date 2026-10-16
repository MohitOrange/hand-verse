// Cricket — the bat follows your hand. Swing fast as the ball arrives. Upward swings loft it for sixes.
import * as THREE from "three";
import * as U from "../util.js";

const G = 9.81, BALL_R = 0.036, BOUNDARY = 66, PITCH_CENTER = new THREE.Vector3(0, 0, -10);
const BAT_Z = -0.95, MAX_BALLS = 18, MAX_WKTS = 3;

export default {
  id: "cricket", title: "Cricket", emoji: "🏏", color: "#b6ff3d", short: "Smash sixes",
  desc: "Night match under the floodlights. Your hand holds the bat — time your swing and smash the ball to the boundary.",
  howto: [["✋", "Hold your hand up — the bat follows it"], ["💨", "Swing fast just as the ball reaches you"], ["⬆️", "Swing upward to loft it (six!), sideways to place it"], ["🎯", "Miss and it may hit the stumps — 3 wickets and you're out"]],
  help: [["✋", "Bat follows your hand"], ["💨", "Swing fast to hit"], ["⬆️", "Swing up = lofted shot"]],

  create(ctx) {
    const { input, ui, sfx } = ctx;
    const scene = new THREE.Scene();
    scene.environment = ctx.env; scene.environmentIntensity = 0.4;
    scene.fog = new THREE.Fog(0x0a1030, 90, 220);
    const camera = new THREE.PerspectiveCamera(52, innerWidth / innerHeight, 0.05, 600);
    const CAM_HOME = new THREE.Vector3(0, 1.45, 1.9), LOOK_HOME = new THREE.Vector3(0, 0.75, -12);
    camera.position.copy(CAM_HOME); camera.lookAt(LOOK_HOME);
    ctx.view(scene, camera);
    ctx.bloom(0.7, 0.5, 0.85);
    U.makeSky(scene, "#02030f", "#1b2a6a", { stars: 400, horizon: 0.5 });
    const { dir } = U.addLights(scene, { ambient: 0.6, sky: 0xbfd0ff, ground: 0x203020, sun: 2.2, sunPos: [10, 30, 12] });
    dir.shadow.camera.left = dir.shadow.camera.bottom = -25; dir.shadow.camera.right = dir.shadow.camera.top = 25; dir.target.position.set(0, 0, -10); scene.add(dir.target);

    // ground
    const grass = U.canvasTexture(1024, 1024, (g, w, h) => {
      for (let i = 0; i < 16; i++) { g.fillStyle = i % 2 ? "#2f7a2c" : "#2a6e27"; g.fillRect(0, (i * h) / 16, w, h / 16 + 1); }
      for (let i = 0; i < 9000; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.08})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
    }, { repeat: [6, 6] });
    const field = new THREE.Mesh(new THREE.CircleGeometry(80, 96), new THREE.MeshStandardMaterial({ map: grass, roughness: 0.95 }));
    field.rotation.x = -Math.PI / 2; field.position.copy(PITCH_CENTER); field.receiveShadow = true; scene.add(field);
    const pitchTex = U.canvasTexture(256, 1024, (g, w, h) => {
      g.fillStyle = "#c9b27a"; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 4000; i++) { g.fillStyle = `rgba(90,60,20,${Math.random() * 0.15})`; g.fillRect(Math.random() * w, Math.random() * h, 3, 3); }
      g.fillStyle = "#fff";
      for (const y of [0.06, 0.94]) { g.fillRect(0, h * y, w, 5); }
      for (const y of [0.0, 1.0]) { g.fillRect(0, h * y - 3, w, 4); }
    });
    const pitch = new THREE.Mesh(new THREE.PlaneGeometry(3.05, 22.5), new THREE.MeshStandardMaterial({ map: pitchTex, roughness: 0.9 }));
    pitch.rotation.x = -Math.PI / 2; pitch.position.set(0, 0.005, -10.06); pitch.receiveShadow = true; scene.add(pitch);
    const rope = new THREE.Mesh(new THREE.TorusGeometry(BOUNDARY, 0.12, 8, 200), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x6688ff, emissiveIntensity: 0.6 }));
    rope.rotation.x = Math.PI / 2; rope.position.set(PITCH_CENTER.x, 0.1, PITCH_CENTER.z); scene.add(rope);

    // stands + crowd lights
    const stand = new THREE.Mesh(new THREE.CylinderGeometry(105, 82, 26, 96, 1, true), new THREE.MeshStandardMaterial({ color: 0x141a3a, side: THREE.BackSide, roughness: 0.9 }));
    stand.position.set(PITCH_CENTER.x, 10, PITCH_CENTER.z); scene.add(stand);
    {
      const n = 3500, pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, t = Math.random(); const r = 84 + t * 19, y = 1 + t * 22;
        pos.set([PITCH_CENTER.x + Math.cos(a) * r, y, PITCH_CENTER.z + Math.sin(a) * r], i * 3);
        const c = new THREE.Color().setHSL(Math.random(), 0.7, U.rand(0.4, 0.8)); col.set([c.r, c.g, c.b], i * 3);
      }
      const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setAttribute("color", new THREE.BufferAttribute(col, 3));
      scene.add(new THREE.Points(g, new THREE.PointsMaterial({ size: 0.9, vertexColors: true })));
    }
    for (const [x, z] of [[-70, -70], [70, -70], [-70, 50], [70, 50]]) {
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 1, 45, 8), new THREE.MeshStandardMaterial({ color: 0x333a55 }));
      tower.position.set(x, 22, z); scene.add(tower);
      const lamp = U.glowSprite(0xffffff, 26, 0.95); lamp.position.set(x, 46, z); scene.add(lamp);
      const box = new THREE.Mesh(new THREE.BoxGeometry(6, 4, 1), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false })); box.position.set(x, 46, z); box.lookAt(0, 0, -10); scene.add(box);
    }

    // stumps
    const stumpMat = new THREE.MeshStandardMaterial({ color: 0xf3e6c8, roughness: 0.5 });
    function makeStumps(z) {
      const g = new THREE.Group(); const parts = [];
      for (let i = -1; i <= 1; i++) {
        const s = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.71, 10), stumpMat); s.position.set(i * 0.1, 0.355, 0); s.castShadow = true; g.add(s); parts.push(s);
      }
      for (const x of [-0.05, 0.05]) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.11, 6), stumpMat); b.rotation.z = Math.PI / 2; b.position.set(x, 0.72, 0); g.add(b); parts.push(b); }
      g.position.z = z; scene.add(g);
      return { g, parts, home: parts.map((p) => ({ p: p.position.clone(), r: p.rotation.clone() })), fly: null };
    }
    const myStumps = makeStumps(0), farStumps = makeStumps(-20.12);

    // bowler + fielders
    const kit = new THREE.MeshStandardMaterial({ color: 0x1e5aff, roughness: 0.7 }), skin = new THREE.MeshStandardMaterial({ color: 0x8d5a3b, roughness: 0.8 });
    function person(color = kit) {
      const p = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.75, 4, 10), color); body.position.y = 1.05; p.add(body);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 14, 10), skin); head.position.y = 1.72; p.add(head);
      const legs = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.55, 4, 8), new THREE.MeshStandardMaterial({ color: 0xf2f2f2 })); legs.position.y = 0.42; p.add(legs);
      const arm = new THREE.Group(); arm.position.set(0.25, 1.45, 0);
      const a = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.55, 4, 8), color); a.position.y = -0.33; arm.add(a); p.add(arm);
      p.userData.arm = arm;
      U.shadowAll(p, true, false);
      scene.add(p); return p;
    }
    const bowler = person(new THREE.MeshStandardMaterial({ color: 0xff3d6e }));
    const fielders = [[-28, -22], [30, -26], [-42, -48], [40, -55], [0, -62], [-20, -5], [24, -2], [-52, -12], [55, -18]].map(([x, z]) => {
      const f = person(); f.position.set(x, 0, z); f.lookAt(0, 0, 0); return { m: f, home: new THREE.Vector3(x, 0, z) };
    });
    const keeper = person(new THREE.MeshStandardMaterial({ color: 0x2ef2a0 })); keeper.position.set(0.4, 0, 3.2); keeper.lookAt(0, 0, -20); keeper.visible = false;

    // bat
    const bat = new THREE.Group();
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.6, 0.045), new THREE.MeshStandardMaterial({ color: 0xf0d49a, roughness: 0.5, emissive: 0x3a2a10, emissiveIntensity: 0.6 }));
    blade.position.y = -0.62; bat.add(blade);
    const spine = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.5, 0.03), new THREE.MeshStandardMaterial({ color: 0xd6b27a })); spine.position.set(0, -0.6, -0.03); bat.add(spine);
    const sticker = new THREE.Mesh(new THREE.PlaneGeometry(0.09, 0.2), new THREE.MeshBasicMaterial({ color: 0xff3d6e })); sticker.position.set(0, -0.5, 0.024); bat.add(sticker);
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.02, 0.32, 12), new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 })); handle.position.y = -0.16; bat.add(handle);
    bat.scale.setScalar(1.3);
    U.shadowAll(bat, true, false); scene.add(bat);
    const batTrail = new U.Particles(scene, 400);

    // ball
    const ball = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 20, 14), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x6688ff, emissiveIntensity: 0.25, roughness: 0.35 }));
    ball.castShadow = true; scene.add(ball);
    const ballGlow = U.glowSprite(0xaaccff, 0.35, 0.6); ball.add(ballGlow);
    const ballShadow = new THREE.Mesh(new THREE.CircleGeometry(0.05, 16), new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: 0.35, depthWrite: false })); ballShadow.rotation.x = -Math.PI / 2; scene.add(ballShadow);
    const particles = new U.Particles(scene, 1500);
    const texts = new U.FloatTexts(scene);

    // ---------------------------------------------------------------- state
    let running = false, phase = "wait", phaseT = 0;
    let runs = 0, wkts = 0, balls = 0, lastShot = "–", level = 0, fours = 0, sixes = 0;
    const v = new THREE.Vector3();
    let bounced = false, hit = false, inPlay = 0, release = new THREE.Vector3();
    const plan = { speed: 22, bounceZ: -5, x0: 0, bx: 0 };
    const batPos = new THREE.Vector3(0, 1.1, BAT_Z), batPrev = new THREE.Vector3();
    let batTilt = 0, batSwing = 0, chaser = null;
    const camTarget = new THREE.Vector3(), lookTarget = LOOK_HOME.clone(), lookNow = LOOK_HOME.clone();
    const batPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -BAT_Z);

    function resetStumps(s) { s.fly = null; s.parts.forEach((p, i) => { p.position.copy(s.home[i].p); p.rotation.copy(s.home[i].r); }); }
    function nextBall() {
      phase = "runup"; phaseT = 0; hit = false; bounced = false; inPlay = 0;
      level = Math.floor(balls / 6);
      plan.speed = U.rand(19, 24) + level * 2.2;
      plan.bounceZ = U.rand(-8, -3.2);
      plan.x0 = U.rand(-0.35, 0.35);
      plan.bx = U.rand(-0.3, 0.3);
      bowler.position.set(plan.x0 + 0.4, 0, -30); bowler.lookAt(0, 0, 0);
      ball.visible = false;
      for (const f of fielders) f.m.position.copy(f.home);
      chaser = null;
      resetStumps(myStumps);
    }
    function bowl() {
      phase = "flight";
      release.set(plan.x0, 2.15, -18.6);
      ball.position.copy(release);
      const dz = plan.bounceZ - release.z, dx = plan.bx - release.x;
      const dh = Math.hypot(dx, dz), t1 = dh / plan.speed;
      v.set((dx / dh) * plan.speed, (BALL_R - release.y + 0.5 * G * t1 * t1) / t1, (dz / dh) * plan.speed);
      ball.visible = true;
      sfx.whoosh();
    }
    function endDelivery(text, color, r = 0, out = false) {
      if (phase === "done") return;
      phase = "done"; phaseT = 0;
      balls++;
      runs += r;
      if (out) wkts++;
      lastShot = out ? "OUT" : String(r);
      ui.banner(text, color);
      if (out) { sfx.bad(); } else if (r >= 4) { sfx.cheer(); } else if (r > 0) sfx.coin();
      if (r === 4) fours++; if (r === 6) sixes++;
    }

    function physics(dt) {
      v.y -= G * dt;
      ball.position.addScaledVector(v, dt);
      if (ball.position.y < BALL_R) {
        ball.position.y = BALL_R;
        if (!hit && !bounced) { v.y = -v.y * 0.62; v.z *= 0.92; v.x += U.rand(-0.9, 0.9); bounced = true; sfx.thud(); }
        else if (hit) {
          if (!bounced) { bounced = true; }
          v.y = Math.abs(v.y) > 1.5 ? -v.y * 0.35 : 0;
          const f = Math.max(0, 1 - 1.6 * dt); v.x *= f; v.z *= f;
        } else v.y = -v.y * 0.4;
      }
    }

    function tryHit(h) {
      // segment of the blade in world space
      const top = new THREE.Vector3(0, -0.32, 0).applyMatrix4(bat.matrixWorld);
      const bot = new THREE.Vector3(0, -0.95, 0).applyMatrix4(bat.matrixWorld);
      const seg = new THREE.Line3(top, bot), cp = new THREE.Vector3();
      seg.closestPointToPoint(ball.position, true, cp);
      if (cp.distanceTo(ball.position) > 0.17) return false;
      const sp = h ? h.speed / innerHeight : batSwing * 3;
      hit = true; bounced = false; inPlay = 0;
      if (sp < 0.9) {
        v.set(U.rand(-1, 1), 1.2, U.rand(2, 5) * -1);
        sfx.thud(); lastShot = "block"; texts.spawn("Blocked", ball.position.clone().add(new THREE.Vector3(0, 0.4, 0)), { size: 0.18 });
        return true;
      }
      const power = U.clamp(sp / 3, 0.35, 1.35);
      const speed = 17 + power * 24;
      const vx = h ? h.vel.x : 0, vy = h ? h.vel.y : -1;
      const hs = (h ? h.speed : 1) + 1;
      const angH = U.clamp((vx / hs) * 1.25 + (ball.position.x - cp.x) * 4, -1.45, 1.45);
      const loft = vy < 0 ? U.clamp((-vy / hs) * 0.85, 0.12, 0.85) : U.rand(0.03, 0.12);
      v.set(Math.sin(angH) * Math.cos(loft) * speed, Math.sin(loft) * speed, -Math.cos(angH) * Math.cos(loft) * speed);
      sfx.bat();
      particles.burst(ball.position, 0xffe7a0, 30, 4, { size: 0.08, life: 0.4 });
      // nearest fielder chases
      let best = null, bd = 1e9;
      const land = new THREE.Vector3(ball.position.x + v.x * 2, 0, ball.position.z + v.z * 2);
      for (const f of fielders) { const d = f.m.position.distanceTo(land); if (d < bd) { bd = d; best = f; } }
      chaser = best;
      return true;
    }

    function updateStumps(s, dt) {
      if (!s.fly) return;
      s.parts.forEach((p, i) => { const f = s.fly[i]; f.v.y -= G * dt; p.position.addScaledVector(f.v, dt); p.rotation.x += f.r * dt; if (p.position.y < 0.02) { p.position.y = 0.02; f.v.multiplyScalar(0.5); f.v.y = Math.abs(f.v.y) * 0.3; } });
    }

    nextBall(); phase = "wait";

    return {
      start() { running = true; nextBall(); },
      update(dt, now) {
        const h = input.primary;
        // --- bat follows the hand on a vertical plane in front of the stumps
        if (h && !input.locked) {
          const p = U.pointOnPlane(camera, h.ptr.x, h.ptr.y + innerHeight * 0.05, batPlane);
          if (p) { p.x = U.clamp(p.x, -1.4, 1.4); p.y = U.clamp(p.y, 0.55, 2.0); batPos.lerp(p, 0.8); }
        }
        batPrev.copy(bat.position);
        bat.position.copy(batPos);
        batSwing = bat.position.distanceTo(batPrev) / Math.max(dt, 0.001) / 10;
        const tiltT = U.clamp(-(h?.vel.x || 0) / innerWidth * 0.9, -1.25, 1.25);
        batTilt = U.damp(batTilt, tiltT, 14, dt);
        bat.rotation.set(-0.25 - U.clamp((h?.speed || 0) / innerHeight * 0.12, 0, 0.6), 0, batTilt);
        bat.updateMatrixWorld();
        if (h && h.speed / innerHeight > 1.1 && Math.random() < 0.6) batTrail.burst(new THREE.Vector3(0, -0.65, 0).applyMatrix4(bat.matrixWorld), 0xb6ff3d, 1, 0.2, { size: 0.12, life: 0.25, gravity: 0 });

        if (running) {
          phaseT += dt;
          if (phase === "runup") {
            bowler.position.z = -30 + Math.min(1, phaseT / 1.6) * 11;
            bowler.userData.arm.rotation.x = phaseT > 1.2 ? -(phaseT - 1.2) * 9 : Math.sin(phaseT * 10) * 0.6;
            if (phaseT > 1.75) bowl();
          } else if (phase === "flight") {
            inPlay += dt;
            const sub = 5;
            for (let i = 0; i < sub && phase === "flight"; i++) {
              const prevZ = ball.position.z;
              physics(dt / sub);
              if (!hit) {
                if (ball.position.z > BAT_Z - 0.35 && ball.position.z < BAT_Z + 0.35) tryHit(h);
                if (!hit && prevZ < 0 && ball.position.z >= 0) {
                  if (Math.abs(ball.position.x) < 0.13 && ball.position.y < 0.74) {
                    myStumps.fly = myStumps.parts.map(() => ({ v: new THREE.Vector3(U.rand(-1.5, 1.5), U.rand(2, 4), U.rand(2, 5)), r: U.rand(-10, 10) }));
                    sfx.crash(); endDelivery("BOWLED!", "#ff3d6e", 0, true);
                  }
                }
                if (!hit && ball.position.z > 3) endDelivery("Dot ball", "#b3acd6", 0);
              } else {
                const d = Math.hypot(ball.position.x - PITCH_CENTER.x, ball.position.z - PITCH_CENTER.z);
                if (d > BOUNDARY) {
                  if (!bounced) { endDelivery("SIX!", "#ffd23f", 6); particles.burst(ball.position, 0xffd23f, 120, 14, { size: 1.2, life: 1.5 }); }
                  else endDelivery("FOUR!", "#2ef2ff", 4);
                  break;
                }
                // catches
                if (!bounced && ball.position.y < 2.3 && v.y < 0) {
                  for (const f of fielders) {
                    if (Math.hypot(f.m.position.x - ball.position.x, f.m.position.z - ball.position.z) < 1.5) {
                      if (Math.random() < 0.75) endDelivery("CAUGHT!", "#ff3d6e", 0, true);
                      else { ui.toast("Dropped catch! 😅"); v.multiplyScalar(0.3); bounced = true; }
                      break;
                    }
                  }
                }
                const hs = Math.hypot(v.x, v.z);
                if (chaser && bounced && chaser.m.position.distanceTo(new THREE.Vector3(ball.position.x, 0, ball.position.z)) < 1.2) {
                  const dist = Math.hypot(ball.position.x, ball.position.z);
                  endDelivery(...runsFor(dist));
                } else if (bounced && hs < 0.6) endDelivery(...runsFor(Math.hypot(ball.position.x, ball.position.z)));
              }
            }
            if (hit && chaser && phase === "flight") {
              const tgt = new THREE.Vector3(ball.position.x, 0, ball.position.z);
              const dd = tgt.clone().sub(chaser.m.position); dd.y = 0;
              const l = dd.length(); if (l > 0.01) { chaser.m.position.addScaledVector(dd, Math.min(1, (7.5 * dt) / l)); chaser.m.lookAt(tgt); }
            }
          } else if (phase === "done") {
            if (phaseT > 1.8) {
              if (wkts >= MAX_WKTS || balls >= MAX_BALLS) {
                running = false;
                ctx.end({ title: wkts >= MAX_WKTS ? "All out!" : "Innings over", subtitle: `${runs}/${wkts} in ${Math.floor(balls / 6)}.${balls % 6} overs`, score: runs, label: "RUNS", stats: [["Fours", fours], ["Sixes", sixes], ["Strike rate", balls ? Math.round((runs / balls) * 100) : 0]] });
              } else nextBall();
            }
          }
        }
        function runsFor(dist) {
          const r = dist < 12 ? 0 : dist < 26 ? 1 : dist < 42 ? 2 : 3;
          return [r === 0 ? "No run" : r === 1 ? "1 run" : `${r} runs`, r ? "#ffffff" : "#b3acd6", r];
        }
        updateStumps(myStumps, dt);

        // camera: follow big hits
        if (hit && ball.visible) {
          camTarget.set(ball.position.x * 0.25, 4 + Math.min(10, ball.position.length() * 0.12), 6);
          lookTarget.copy(ball.position);
        } else { camTarget.copy(CAM_HOME); lookTarget.copy(LOOK_HOME); }
        camera.position.lerp(camTarget, 1 - Math.exp(-3 * dt));
        lookNow.lerp(lookTarget, 1 - Math.exp(-6 * dt));
        camera.lookAt(lookNow);

        ballShadow.visible = ball.visible;
        ballShadow.position.set(ball.position.x, 0.01, ball.position.z);
        ball.rotation.x += dt * 20;
        particles.update(dt); batTrail.update(dt); texts.update(dt);
        ui.setStats([
          { label: "RUNS", value: runs, cls: "hot" },
          { label: "WICKETS", value: `${wkts}/${MAX_WKTS}`, cls: wkts >= 2 ? "warn" : "" },
          { label: "OVERS", value: `${Math.floor(balls / 6)}.${balls % 6}/${MAX_BALLS / 6}` },
          { label: "LAST", value: lastShot, cls: "cool" },
        ]);
      },
      dispose() {},
    };
  },
};
