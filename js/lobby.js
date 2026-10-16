// The 3D room: walk with an open palm, grab & throw toys with a pinch, point at a station to enter a game.
import * as THREE from "three";
import * as CANNON from "cannon-es";
import * as U from "./util.js";
import { makeIcon } from "./icons.js";
import { Hands3D } from "./hand3d.js";
import { startAmbient, stopAmbient, ambientOn } from "./audio.js";

const RW = 20, RD = 20, RH = 5.6, EYE = 1.6, RING = 6.6;
const DWELL = 1.4;

export function createLobby(ctx, games, onLaunch) {
  const { input, ui, sfx } = ctx;
  const scene = new THREE.Scene();
  scene.environment = ctx.env;
  scene.environmentIntensity = 0.45;
  scene.background = new THREE.Color(0x0a0720);
  scene.fog = new THREE.Fog(0x0a0720, 18, 40);
  const camera = new THREE.PerspectiveCamera(68, innerWidth / innerHeight, 0.03, 150);
  const player = { pos: new THREE.Vector3(0, EYE, 2.4), yaw: 0, pitch: -0.06, bob: 0 };

  // ---------------------------------------------------------------- lights
  const hemi = new THREE.HemisphereLight(0xa08cff, 0x1a0f30, 0.55);
  scene.add(hemi);
  const main = new THREE.SpotLight(0xfff0e0, 55, 30, 1.0, 0.6, 1.6);
  main.position.set(0, RH - 0.2, 0); main.target.position.set(0, 0, 0);
  main.castShadow = true; main.shadow.mapSize.set(1024, 1024); main.shadow.bias = -0.0004;
  scene.add(main, main.target);
  const corner = [[-8, -8, 0xff3df2], [8, -8, 0x2ef2ff], [-8, 8, 0x2ef2ff], [8, 8, 0xff3df2]].map(([x, z, c]) => {
    const l = new THREE.PointLight(c, 18, 16, 1.6); l.position.set(x, 3.5, z); scene.add(l); return l;
  });
  const disco = [0xff3d6e, 0x2ef2ff, 0xb6ff3d].map((c) => {
    const s = new THREE.SpotLight(c, 0, 30, 0.35, 0.4, 1.2); s.position.set(0, RH - 0.6, 0); scene.add(s, s.target); return s;
  });

  // ---------------------------------------------------------------- room shell
  const floorTex = U.canvasTexture(1024, 1024, (g, w, h) => {
    g.fillStyle = "#120c2a"; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      g.fillStyle = (i + j) % 2 ? "#151032" : "#110b28"; g.fillRect(i * w / 4 + 3, j * h / 4 + 3, w / 4 - 6, h / 4 - 6);
    }
  }, { repeat: [5, 5] });
  const floorGlow = U.canvasTexture(1024, 1024, (g, w, h) => {
    g.fillStyle = "#000"; g.fillRect(0, 0, w, h);
    g.strokeStyle = "#5a3dff"; g.lineWidth = 4;
    for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * w / 4, 0); g.lineTo(i * w / 4, h); g.stroke(); g.beginPath(); g.moveTo(0, i * h / 4); g.lineTo(w, i * h / 4); g.stroke(); }
  }, { repeat: [5, 5] });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(RW, RD), new THREE.MeshStandardMaterial({ map: floorTex, emissiveMap: floorGlow, emissive: 0xffffff, emissiveIntensity: 0.3, roughness: 0.16, metalness: 0.35 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);

  const wallTex = U.canvasTexture(512, 512, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, 0, h); grd.addColorStop(0, "#1a1240"); grd.addColorStop(1, "#2b1650");
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    g.strokeStyle = "rgba(255,255,255,.05)"; g.lineWidth = 3;
    for (let x = 0; x <= w; x += w / 4) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
  }, { repeat: [5, 1] });
  const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.75, metalness: 0.05 });
  const walls = [
    [0, RH / 2, -RD / 2, 0], [0, RH / 2, RD / 2, Math.PI], [-RW / 2, RH / 2, 0, Math.PI / 2], [RW / 2, RH / 2, 0, -Math.PI / 2],
  ].map(([x, y, z, ry]) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(RW, RH), wallMat); m.position.set(x, y, z); m.rotation.y = ry; m.receiveShadow = true; scene.add(m); return m;
  });
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(RW, RD), new THREE.MeshStandardMaterial({ color: 0x0c0820, roughness: 0.9 }));
  ceil.rotation.x = Math.PI / 2; ceil.position.y = RH; scene.add(ceil);

  // neon strips
  const neonMat = (c) => new THREE.MeshBasicMaterial({ color: c, toneMapped: false });
  const strip = (w, h, d, x, y, z, c) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), neonMat(c)); m.position.set(x, y, z); scene.add(m); return m; };
  const strips = [
    strip(RW, 0.05, 0.05, 0, 0.08, -RD / 2 + 0.05, 0xff3df2), strip(RW, 0.05, 0.05, 0, 0.08, RD / 2 - 0.05, 0x2ef2ff),
    strip(0.05, 0.05, RD, -RW / 2 + 0.05, 0.08, 0, 0x2ef2ff), strip(0.05, 0.05, RD, RW / 2 - 0.05, 0.08, 0, 0xff3df2),
    strip(RW, 0.04, 0.04, 0, RH - 0.1, -RD / 2 + 0.05, 0x8a7dff), strip(RW, 0.04, 0.04, 0, RH - 0.1, RD / 2 - 0.05, 0x8a7dff),
    strip(0.04, 0.04, RD, -RW / 2 + 0.05, RH - 0.1, 0, 0x8a7dff), strip(0.04, 0.04, RD, RW / 2 - 0.05, RH - 0.1, 0, 0x8a7dff),
  ];
  for (const x of [-6.5, 6.5]) strips.push(strip(0.06, RH - 0.4, 0.06, x, RH / 2, -RD / 2 + 0.06, 0x2ef2ff));
  const ringLight = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.06, 12, 96), neonMat(0xffffff));
  ringLight.rotation.x = Math.PI / 2; ringLight.position.y = RH - 0.25; scene.add(ringLight);

  // window with a night skyline
  const cityTex = U.canvasTexture(2048, 768, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, "#050322"); grd.addColorStop(0.55, "#2a0f5a"); grd.addColorStop(0.85, "#ff3d9a"); grd.addColorStop(1, "#ff8a3d");
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.8})`; g.fillRect(Math.random() * w, Math.random() * h * 0.5, 2, 2); }
    g.fillStyle = "#fff6e0"; g.shadowColor = "#fff"; g.shadowBlur = 50; g.beginPath(); g.arc(w * 0.78, h * 0.22, 46, 0, Math.PI * 2); g.fill(); g.shadowBlur = 0;
    for (let layer = 0; layer < 2; layer++) {
      let x = 0;
      while (x < w) {
        const bw = U.rand(40, 120), bh = U.rand(h * 0.2, h * (layer ? 0.55 : 0.75));
        g.fillStyle = layer ? "#0b0620" : "#160c38"; g.fillRect(x, h - bh, bw, bh);
        for (let wy = h - bh + 10; wy < h - 6; wy += 16) for (let wx = x + 6; wx < x + bw - 6; wx += 12) {
          if (Math.random() < 0.35) { g.fillStyle = U.pick(["#ffd23f", "#2ef2ff", "#ff3df2", "#fff2c0"]); g.globalAlpha = U.rand(0.4, 0.95); g.fillRect(wx, wy, 6, 8); g.globalAlpha = 1; }
        }
        x += bw + U.rand(2, 18);
      }
    }
  });
  const win = new THREE.Mesh(new THREE.PlaneGeometry(11, 3.6), new THREE.MeshBasicMaterial({ map: cityTex, fog: false, toneMapped: false }));
  win.position.set(0, 2.7, -RD / 2 + 0.02); scene.add(win);
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x0a0618, roughness: 0.4, metalness: 0.6 });
  for (const [w, h, x, y] of [[11.4, 0.18, 0, 4.55], [11.4, 0.18, 0, 0.85], [0.18, 3.8, -5.6, 2.7], [0.18, 3.8, 5.6, 2.7], [0.1, 3.6, -1.85, 2.7], [0.1, 3.6, 1.85, 2.7]]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.12), frameMat); m.position.set(x, y, -RD / 2 + 0.06); scene.add(m);
  }

  // rug
  const rugTex = U.canvasTexture(1024, 1024, (g, w) => {
    const c = w / 2;
    for (let r = c; r > 0; r -= 40) { g.fillStyle = (r / 40) % 2 ? "#2a1a5a" : "#33206e"; g.beginPath(); g.arc(c, c, r, 0, Math.PI * 2); g.fill(); }
    g.strokeStyle = "rgba(46,242,255,.6)"; g.lineWidth = 6; g.beginPath(); g.arc(c, c, c - 20, 0, Math.PI * 2); g.stroke();
  });
  const rug = new THREE.Mesh(new THREE.CircleGeometry(3.4, 64), new THREE.MeshStandardMaterial({ map: rugTex, roughness: 0.95 }));
  rug.rotation.x = -Math.PI / 2; rug.position.y = 0.005; rug.receiveShadow = true; scene.add(rug);

  // furniture
  const sofaMat = new THREE.MeshStandardMaterial({ color: 0x3d2a8a, roughness: 0.85 });
  const sofa = new THREE.Group();
  const box = (w, h, d, x, y, z, m = sofaMat) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); sofa.add(b); return b; };
  box(3.2, 0.45, 1.1, 0, 0.3, 0); box(3.2, 0.9, 0.3, 0, 0.75, -0.42); box(0.3, 0.7, 1.1, -1.6, 0.5, 0); box(0.3, 0.7, 1.1, 1.6, 0.5, 0);
  box(0.9, 0.35, 0.25, -0.8, 0.65, -0.2, new THREE.MeshStandardMaterial({ color: 0xff3df2, roughness: 0.8 }));
  box(0.9, 0.35, 0.25, 0.8, 0.65, -0.2, new THREE.MeshStandardMaterial({ color: 0x2ef2ff, roughness: 0.8 }));
  sofa.position.set(-6.8, 0, 7.9); sofa.rotation.y = Math.PI * 0.82; U.shadowAll(sofa); scene.add(sofa);
  const plant = (x, z) => {
    const p = new THREE.Group();
    p.add(new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.24, 0.6, 20), new THREE.MeshStandardMaterial({ color: 0xf2efe8, roughness: 0.4 })));
    p.children[0].position.y = 0.3;
    for (let i = 0; i < 7; i++) {
      const l = new THREE.Mesh(new THREE.IcosahedronGeometry(U.rand(0.22, 0.38), 0), new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(U.rand(0.28, 0.38), 0.6, U.rand(0.25, 0.4)), flatShading: true }));
      l.position.set(U.rand(-0.25, 0.25), U.rand(0.8, 1.6), U.rand(-0.25, 0.25)); p.add(l);
    }
    p.position.set(x, 0, z); U.shadowAll(p); scene.add(p);
  };
  plant(-9, -9); plant(9, -9); plant(9, 9);

  // magic mirror: the live webcam inside the room
  const mirrorGroup = new THREE.Group();
  let mirrorTex = null;
  const mirrorMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
  const mirror = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 2.025), mirrorMat);
  mirrorGroup.add(mirror);
  const mf = new THREE.Mesh(new THREE.BoxGeometry(3.9, 2.3, 0.1), new THREE.MeshStandardMaterial({ color: 0xffc83d, metalness: 0.9, roughness: 0.25 }));
  mf.position.z = -0.06; mirrorGroup.add(mf);
  const mirrorLabel = U.makeLabel("MAGIC MIRROR", { size: 0.22, bg: null, color: "#ffc83d" });
  mirrorLabel.position.set(0, 1.4, 0); mirrorGroup.add(mirrorLabel);
  mirrorGroup.position.set(RW / 2 - 0.08, 2.6, -2.5); mirrorGroup.rotation.y = -Math.PI / 2; scene.add(mirrorGroup);
  function refreshMirror() {
    if (input.cameraOn && !mirrorTex) {
      mirrorTex = new THREE.VideoTexture(input.video); mirrorTex.colorSpace = THREE.SRGBColorSpace;
      mirrorTex.wrapS = THREE.RepeatWrapping; mirrorTex.repeat.x = -1; mirrorTex.offset.x = 1;
      mirrorMat.map = mirrorTex; mirrorMat.needsUpdate = true;
    } else if (!input.cameraOn && !mirrorMat.map) {
      mirrorMat.map = U.canvasTexture(512, 288, (g, w, h) => { g.fillStyle = "#120c2a"; g.fillRect(0, 0, w, h); g.fillStyle = "#b3acd6"; g.font = "600 26px Inter"; g.textAlign = "center"; g.fillText("Turn on the camera to see yourself", w / 2, h / 2); });
      mirrorMat.needsUpdate = true;
    }
  }

  // wall controls: mood + music
  const controls = [];
  function wallButton(label, color, y, onPress) {
    const g = new THREE.Group();
    const plate = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.7, 0.08), new THREE.MeshStandardMaterial({ color: 0x140e30, roughness: 0.3, metalness: 0.5, emissive: color, emissiveIntensity: 0.15 }));
    g.add(plate);
    const lab = U.makeLabel(label, { size: 0.24, bg: null, color: "#fff" }); lab.position.z = 0.06; g.add(lab);
    g.position.set(-RW / 2 + 0.06, y, -3.2); g.rotation.y = Math.PI / 2; scene.add(g);
    const c = { kind: "control", mesh: plate, group: g, label: lab, color, onPress, setLabel(t) { g.remove(c.label); c.label.material.map.dispose(); c.label = U.makeLabel(t, { size: 0.24, bg: null }); c.label.position.z = 0.06; g.add(c.label); } };
    plate.userData.target = c; controls.push(c);
    return c;
  }
  const MOODS = ["Neon", "Sunset", "Disco"];
  let mood = 0;
  const moodBtn = wallButton("💡 MOOD: NEON", 0xff3df2, 2.2, () => setMood((mood + 1) % MOODS.length));
  const musicBtn = wallButton("🎵 MUSIC: OFF", 0x2ef2ff, 1.3, () => {
    if (ambientOn()) stopAmbient(); else startAmbient("room");
    musicBtn.setLabel(`🎵 MUSIC: ${ambientOn() ? "ON" : "OFF"}`);
  });

  const discoBall = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 3), new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 1, roughness: 0.05, flatShading: true, envMapIntensity: 2.5 }));
  discoBall.position.set(0, RH - 1.1, 0); discoBall.visible = false; scene.add(discoBall);
  function setMood(m) {
    mood = m;
    moodBtn.setLabel(`💡 MOOD: ${MOODS[m].toUpperCase()}`);
    const disc = m === 2;
    discoBall.visible = disc;
    for (const d of disco) d.intensity = disc ? 160 : 0;
    main.intensity = disc ? 12 : m === 1 ? 50 : 55;
    main.color.set(m === 1 ? 0xffb070 : 0xfff0e0);
    hemi.color.set(m === 1 ? 0xff9a5a : 0xa08cff); hemi.intensity = disc ? 0.25 : 0.55;
    corner.forEach((l, i) => { l.color.set(m === 1 ? (i % 2 ? 0xff8a3d : 0xff3d6e) : (i % 3 ? 0x2ef2ff : 0xff3df2)); l.intensity = disc ? 8 : 18; });
    const bg = m === 1 ? 0x24102a : m === 2 ? 0x05030f : 0x0a0720;
    scene.background.set(bg); scene.fog.color.set(bg);
    if (disc && !ambientOn()) { startAmbient("room"); musicBtn.setLabel("🎵 MUSIC: ON"); }
  }

  // ---------------------------------------------------------------- physics
  const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) });
  world.broadphase = new CANNON.SAPBroadphase(world);
  world.allowSleep = true;
  const pmat = new CANNON.Material("p");
  world.defaultContactMaterial.friction = 0.35;
  world.defaultContactMaterial.restitution = 0.45;
  const plane = (pos, axis, ang) => { const b = new CANNON.Body({ mass: 0, shape: new CANNON.Plane(), material: pmat }); b.position.set(...pos); b.quaternion.setFromAxisAngle(new CANNON.Vec3(...axis), ang); world.addBody(b); };
  plane([0, 0, 0], [1, 0, 0], -Math.PI / 2);
  plane([0, RH, 0], [1, 0, 0], Math.PI / 2);
  plane([0, 0, -RD / 2], [0, 1, 0], 0);
  plane([0, 0, RD / 2], [0, 1, 0], Math.PI);
  plane([-RW / 2, 0, 0], [0, 1, 0], Math.PI / 2);
  plane([RW / 2, 0, 0], [0, 1, 0], -Math.PI / 2);

  // ---------------------------------------------------------------- game stations
  const stations = [];
  const beamTex = U.canvasTexture(8, 256, (g, w, h) => {
    const grd = g.createLinearGradient(0, h, 0, 0); grd.addColorStop(0, "rgba(255,255,255,.55)"); grd.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
  });
  games.forEach((def, i) => {
    const a = (i / games.length) * Math.PI * 2;
    const g = new THREE.Group();
    g.position.set(Math.sin(a) * RING, 0, -Math.cos(a) * RING);
    g.lookAt(0, 0, 0);
    const col = new THREE.Color(def.color);
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.68, 0.9, 48), new THREE.MeshStandardMaterial({ color: 0x15102e, roughness: 0.2, metalness: 0.7 }));
    ped.position.y = 0.45; ped.castShadow = ped.receiveShadow = true; g.add(ped);
    const top = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.03, 10, 64), new THREE.MeshBasicMaterial({ color: col, toneMapped: false }));
    top.rotation.x = Math.PI / 2; top.position.y = 0.9; g.add(top);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.85, 0.98, 64), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.55, toneMapped: false, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.012; g.add(ring);
    const prog = new THREE.Mesh(new THREE.RingGeometry(1.02, 1.16, 64, 1, Math.PI / 2, -Math.PI * 2), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false, side: THREE.DoubleSide }));
    prog.rotation.x = -Math.PI / 2; prog.position.y = 0.014; prog.geometry.setDrawRange(0, 0); g.add(prog);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 3.4, 48, 1, true), new THREE.MeshBasicMaterial({ map: beamTex, color: col, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    beam.position.y = 1.7; g.add(beam);
    const icon = makeIcon(def.id); icon.position.y = 1.55; U.shadowAll(icon, true, false); g.add(icon);
    const halo = U.glowSprite(col, 1.4, 0.25); halo.position.y = 1.55; g.add(halo);
    const label = U.makeLabel(`${def.emoji} ${def.title}`, { size: 0.32, border: def.color });
    label.position.y = 2.35; g.add(label);
    const hit = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 2.8, 12), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.y = 1.4; g.add(hit);
    scene.add(g);
    const st = { kind: "station", def, group: g, hit, icon, ring, prog, beam, label, halo, best: null, hover: 0, seed: Math.random() * 10 };
    hit.userData.target = st;
    stations.push(st);
    const body = new CANNON.Body({ mass: 0, shape: new CANNON.Cylinder(0.62, 0.68, 0.9, 16), material: pmat });
    body.position.set(g.position.x, 0.45, g.position.z); world.addBody(body);
  });
  function refreshBests() {
    for (const st of stations) {
      if (st.best) { st.group.remove(st.best); st.best.material.map.dispose(); st.best = null; }
      const b = ctx.best(st.def.id);
      if (b) { st.best = U.makeLabel(`BEST ${b}`, { size: 0.16, color: "#ffc83d" }); st.best.position.y = 2.05; st.group.add(st.best); }
    }
  }

  // ---------------------------------------------------------------- toys
  const toys = [];
  function addToy(mesh, shape, mass, pos) {
    mesh.castShadow = true; mesh.receiveShadow = true;
    scene.add(mesh);
    const body = new CANNON.Body({ mass, shape, material: pmat, linearDamping: 0.08, angularDamping: 0.2, sleepSpeedLimit: 0.15 });
    body.position.set(...pos);
    world.addBody(body);
    const t = { kind: "toy", mesh, body, home: pos.slice(), lastHit: 0 };
    mesh.userData.target = t;
    body.addEventListener("collide", (e) => {
      const v = Math.abs(e.contact.getImpactVelocityAlongNormal());
      const now = performance.now();
      if (v > 2.2 && now - t.lastHit > 120) { t.lastHit = now; mass > 1 ? sfx.thud() : sfx.clack(); }
    });
    toys.push(t);
    return t;
  }
  const ballCols = [0xff3d6e, 0xffd23f, 0x2ef2ff, 0xb6ff3d, 0xff3df2, 0x8a7dff];
  ballCols.forEach((c, i) => {
    const r = 0.2 + (i % 3) * 0.04;
    const a = (i / ballCols.length) * Math.PI * 2 + 0.3;
    addToy(new THREE.Mesh(new THREE.SphereGeometry(r, 32, 20), new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.1, emissive: c, emissiveIntensity: 0.06 })),
      new CANNON.Sphere(r), 0.5, [Math.cos(a) * 2.2, r + 0.4, Math.sin(a) * 2.2 - 0.6]);
  });
  const beachTex = U.canvasTexture(512, 256, (g, w, h) => { const cs = ["#ff3d6e", "#ffffff", "#2ef2ff", "#ffffff", "#ffd23f", "#ffffff"]; cs.forEach((c, i) => { g.fillStyle = c; g.fillRect((i * w) / cs.length, 0, w / cs.length + 1, h); }); });
  addToy(new THREE.Mesh(new THREE.SphereGeometry(0.5, 40, 24), new THREE.MeshStandardMaterial({ map: beachTex, roughness: 0.35 })), new CANNON.Sphere(0.5), 0.35, [2.4, 1, -2.2]);
  const cubeCols = [0xff8a1f, 0x4d7cff, 0xb6ff3d, 0xff3df2, 0x2ef2ff, 0xffd23f];
  let ci = 0;
  for (let row = 0; row < 3; row++) for (let k = 0; k < 3 - row; k++) {
    const s = 0.42;
    addToy(new THREE.Mesh(new THREE.BoxGeometry(s, s, s), new THREE.MeshStandardMaterial({ color: cubeCols[ci++ % cubeCols.length], roughness: 0.3, metalness: 0.15 })),
      new CANNON.Box(new CANNON.Vec3(s / 2, s / 2, s / 2)), 0.6, [-2.6 + k * (s + 0.01) + row * s / 2, s / 2 + row * s + 0.001, -1.4]);
  }

  // ---------------------------------------------------------------- pointer, reticle, laser
  const hands3d = new Hands3D(scene, { color: 0x6ff3ff });
  const reticle = new THREE.Group();
  const rRing = new THREE.Mesh(new THREE.RingGeometry(0.07, 0.095, 40), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false, side: THREE.DoubleSide, depthTest: false }));
  const rDot = new THREE.Mesh(new THREE.CircleGeometry(0.025, 20), new THREE.MeshBasicMaterial({ color: 0x2ef2ff, toneMapped: false, side: THREE.DoubleSide, depthTest: false }));
  reticle.add(rRing, rDot); reticle.renderOrder = 30; rRing.renderOrder = rDot.renderOrder = 30; scene.add(reticle);
  const laserGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
  const laser = new THREE.Line(laserGeo, new THREE.LineBasicMaterial({ color: 0x6ff3ff, transparent: true, opacity: 0.6, toneMapped: false }));
  laser.frustumCulled = false; scene.add(laser);

  const targets = [...stations.map((s) => s.hit), ...toys.map((t) => t.mesh), ...controls.map((c) => c.mesh)];
  const ray = new THREE.Raycaster();
  const grabs = new Map(); // hand id -> { toy, dist, depth0 }
  let hovered = null, dwellT = 0, launching = false;
  const _n = new THREE.Vector3(), _tgt = new THREE.Vector3(), _fwd = new THREE.Vector3();

  function pick(h) {
    U.rayFromScreen(camera, h.ptr.x, h.ptr.y, ray);
    ray.far = 30;
    const hits = ray.intersectObjects(targets, false);
    return hits[0] || null;
  }

  function grab(h, toy, dist) {
    for (const g of grabs.values()) if (g.toy === toy) return;
    grabs.set(h.id, { toy, dist: U.clamp(dist, 0.9, 7), depth0: h.depth });
    toy.body.wakeUp();
    toy.mesh.material.emissiveIntensity = 0.6;
    sfx.click();
  }
  function release(id) {
    const g = grabs.get(id); if (!g) return;
    grabs.delete(id);
    g.toy.body.velocity.scale(1.2, g.toy.body.velocity);
    g.toy.mesh.material.emissiveIntensity = 0.06;
    if (g.toy.body.velocity.length() > 4) sfx.whoosh();
  }

  function launch(st) {
    if (launching) return;
    launching = true;
    st.prog.geometry.setDrawRange(0, 0);
    onLaunch(st.def);
  }

  // ---------------------------------------------------------------- update
  function update(dt, now) {
    const hands = input.hands;
    const primary = input.primary;

    // --- movement
    let fwd = 0, strafe = 0, turn = 0;
    if (input.key("KeyW", "ArrowUp")) fwd += 1;
    if (input.key("KeyS", "ArrowDown")) fwd -= 1;
    if (input.key("KeyA", "ArrowLeft")) turn += 1;
    if (input.key("KeyD", "ArrowRight")) turn -= 1;
    if (input.key("KeyQ")) strafe -= 1;
    if (input.key("KeyE")) strafe += 1;
    const steer = !input.locked && hands.find((h) => h.gesture === "open" && !grabs.has(h.id));
    if (steer && !steer.synthetic) {
      const dx = U.clamp(U.deadzone(steer.pnx - 0.5, 0.09) / 0.32, -1, 1);
      const dy = U.clamp(U.deadzone(steer.pny - 0.5, 0.08) / 0.3, -1, 1);
      turn -= dx * 1.1; fwd -= dy;
      ui.joystick(true, dx, dy);
    } else ui.joystick(false);
    const m = input.mouse;
    if (primary?.synthetic && m.down && !grabs.size && !hovered) { player.yaw -= m.fdx * 0.005; player.pitch = U.clamp(player.pitch - m.fdy * 0.003, -0.9, 0.7); }
    player.yaw += turn * 1.7 * dt;
    _fwd.set(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
    const speed = 3.4;
    player.pos.addScaledVector(_fwd, fwd * speed * dt);
    player.pos.x += Math.cos(player.yaw) * strafe * speed * dt;
    player.pos.z -= Math.sin(player.yaw) * strafe * speed * dt;
    player.pos.x = U.clamp(player.pos.x, -RW / 2 + 0.6, RW / 2 - 0.6);
    player.pos.z = U.clamp(player.pos.z, -RD / 2 + 0.6, RD / 2 - 0.6);
    for (const st of stations) {
      const p = st.group.position, dx = player.pos.x - p.x, dz = player.pos.z - p.z, d = Math.hypot(dx, dz);
      if (d < 1.15 && d > 0.001) { player.pos.x = p.x + (dx / d) * 1.15; player.pos.z = p.z + (dz / d) * 1.15; }
    }
    const moving = Math.abs(fwd) + Math.abs(strafe) > 0.05;
    player.bob += moving ? dt * 9 : 0;
    camera.position.set(player.pos.x, EYE + (moving ? Math.sin(player.bob) * 0.035 : 0), player.pos.z);
    camera.rotation.set(player.pitch, player.yaw, 0, "YXZ");
    camera.updateMatrixWorld();

    // --- hands: grab / point / pinch
    hovered = null;
    let hoverHit = null;
    for (const h of hands) {
      const g = grabs.get(h.id);
      if (g) {
        if (!h.pinch) { release(h.id); continue; }
        const d = U.clamp(g.dist + (h.depth - g.depth0) * 5, 0.8, 8);
        U.pointAtDistance(camera, h.ptr.x, h.ptr.y, d, _tgt);
        _tgt.y = Math.max(_tgt.y, 0.3);
        const b = g.toy.body;
        const vx = (_tgt.x - b.position.x) * 14, vy = (_tgt.y - b.position.y) * 14, vz = (_tgt.z - b.position.z) * 14;
        const vl = Math.hypot(vx, vy, vz), k = vl > 22 ? 22 / vl : 1;
        b.velocity.set(vx * k, vy * k, vz * k);
        b.angularVelocity.scale(0.9, b.angularVelocity);
        continue;
      }
      if (h.gesture === "open" && !h.synthetic) continue;
      if (input.locked) continue;
      const hit = pick(h);
      const tg = hit?.object.userData.target;
      if (h === primary) { hovered = tg || null; hoverHit = hit; }
      if (h.pinchStart && tg) {
        if (tg.kind === "toy") grab(h, tg, hit.distance);
        else if (tg.kind === "station") launch(tg);
        else if (tg.kind === "control") { sfx.click(); tg.onPress(); }
      }
    }
    for (const id of [...grabs.keys()]) if (!hands.some((h) => h.id === id)) release(id);

    // dwell on a station by pointing
    if (hovered?.kind === "station" && primary && !primary.synthetic && (primary.gesture === "point" || primary.gesture === "other" || primary.gesture === "peace")) {
      dwellT += dt;
      const p = Math.min(1, dwellT / DWELL);
      hovered.prog.geometry.setDrawRange(0, Math.floor(p * 64) * 6);
      if (p >= 1) launch(hovered);
    } else {
      if (dwellT > 0) for (const st of stations) st.prog.geometry.setDrawRange(0, 0);
      dwellT = 0;
    }

    // reticle + laser
    if (hoverHit && !grabs.size) {
      reticle.visible = true;
      reticle.position.copy(hoverHit.point);
      _n.copy(hoverHit.face?.normal || _n.set(0, 0, 1)).transformDirection(hoverHit.object.matrixWorld);
      reticle.lookAt(_tgt.copy(hoverHit.point).add(_n));
      reticle.position.addScaledVector(_n, 0.01);
      const s = 0.6 + hoverHit.distance * 0.18; reticle.scale.setScalar(s);
      rDot.material.color.set(hovered?.kind === "station" ? hovered.def.color : hovered?.kind === "toy" ? 0xffd23f : 0x2ef2ff);
    } else reticle.visible = false;
    hands3d.update(input, camera);
    const tip = primary?.lm && hands3d.world[0][8];
    if (tip && reticle.visible) {
      laser.visible = true;
      const pa = laserGeo.attributes.position;
      pa.setXYZ(0, tip.x, tip.y, tip.z); pa.setXYZ(1, hoverHit.point.x, hoverHit.point.y, hoverHit.point.z); pa.needsUpdate = true;
    } else laser.visible = false;

    // --- physics
    world.step(1 / 60, dt, 4);
    for (const t of toys) {
      t.mesh.position.copy(t.body.position); t.mesh.quaternion.copy(t.body.quaternion);
      if (t.body.position.y < -2) { t.body.position.set(...t.home); t.body.velocity.setZero(); }
    }

    // --- animation
    const tt = now / 1000;
    for (const st of stations) {
      const hv = hovered === st ? 1 : 0;
      st.hover = U.damp(st.hover, hv, 10, dt);
      st.icon.rotation.y += dt * (0.6 + st.hover * 2);
      st.icon.position.y = 1.55 + Math.sin(tt * 1.6 + st.seed) * 0.08;
      st.icon.scale.setScalar(1 + st.hover * 0.35);
      st.ring.material.opacity = 0.45 + st.hover * 0.5 + Math.sin(tt * 3 + st.seed) * 0.08;
      st.beam.material.opacity = 0.12 + st.hover * 0.3;
      st.halo.material.opacity = 0.18 + st.hover * 0.45;
      st.label.scale.setScalar(1);
      const sc = 0.32 * (1 + st.hover * 0.25);
      st.label.scale.set(sc * st.label.userData.aspect, sc, 1);
    }
    ringLight.material.color.setHSL((tt * 0.05) % 1, 0.6, 0.75);
    if (discoBall.visible) {
      discoBall.rotation.y += dt * 0.6;
      disco.forEach((s, i) => { const a = tt * (0.6 + i * 0.25) + i * 2.1; s.target.position.set(Math.cos(a) * 6, 0, Math.sin(a) * 6); });
      strips.forEach((s, i) => s.material.color.setHSL((tt * 0.3 + i * 0.12) % 1, 1, 0.55));
    }
  }

  function enter() {
    launching = false; dwellT = 0;
    ctx.view(scene, camera);
    ctx.bloom(0.55, 0.45, 0.88);
    ui.setTitle("🏠 Your Room");
    ui.setStats([]);
    ui.setTools([]);
    ui.setHelp([
      ["☝️", "Point at a game and hold, or pinch, to play"],
      ["🤏", "Pinch a ball or cube to grab — move hand closer/farther to push/pull — release to throw"],
      ["✋", "Open palm: move it up to walk, down to back up, left/right to turn"],
      ["⌨️", "WASD / arrows walk · M games menu"],
    ]);
    refreshMirror();
    refreshBests();
    for (const st of stations) st.prog.geometry.setDrawRange(0, 0);
  }
  function leave() {
    for (const id of [...grabs.keys()]) release(id);
    ui.joystick(false);
    ui.setHelp([]);
    stopAmbient();
    musicBtn.setLabel("🎵 MUSIC: OFF");
  }

  return { scene, camera, update, enter, leave, stations, player, grabs };
}
