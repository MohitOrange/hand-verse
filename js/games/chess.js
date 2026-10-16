// Chess — pinch a piece to pick it up, move it over a glowing square and release to drop it. You play white.
import * as THREE from "three";
import * as U from "../util.js";
import * as E from "./chess-engine.js";
import { chessPiece } from "../icons.js";

const LEVELS = ["Easy", "Normal", "Hard"];
const sqPos = (i, y = 0) => new THREE.Vector3((i & 7) - 3.5, y, (i >> 3) - 3.5);

export default {
  id: "chess", title: "Chess", emoji: "♟️", color: "#ffc83d", short: "vs the computer",
  desc: "A marble chessboard on a table in front of you. Pick pieces up with a pinch and play against the computer.",
  howto: [["🤏", "Point at one of your white pieces and pinch to lift it"], ["✨", "Glowing dots show where it can go"], ["👐", "Move over a square and let go to drop it"], ["🧠", "Change difficulty or undo with the buttons on the right"]],
  help: [["🤏", "Pinch = pick up"], ["👐", "Release = drop"], ["🖱️", "Mouse: drag or click-click"]],

  create(ctx) {
    const { input, ui, sfx } = ctx;
    const scene = new THREE.Scene();
    scene.environment = ctx.env; scene.environmentIntensity = 0.6;
    scene.background = new THREE.Color(0x0b0714);
    scene.fog = new THREE.Fog(0x0b0714, 16, 40);
    const camera = new THREE.PerspectiveCamera(44, innerWidth / innerHeight, 0.1, 100);
    const camBase = new THREE.Vector3(0, 11.2, 9.6);
    camera.position.copy(camBase); camera.lookAt(0, 0, 0.7);
    ctx.view(scene, camera);
    ctx.bloom(0.55, 0.5, 0.82);
    scene.add(new THREE.HemisphereLight(0xffeedd, 0x221133, 0.7));
    const lamp = new THREE.SpotLight(0xfff0d8, 400, 40, 0.65, 0.5, 1.6);
    lamp.position.set(1.5, 12, 3); lamp.castShadow = true; lamp.shadow.mapSize.set(2048, 2048); lamp.shadow.bias = -0.0004; scene.add(lamp);
    const rim = new THREE.DirectionalLight(0x8a7dff, 0.8); rim.position.set(-6, 4, -8); scene.add(rim);

    // table + board
    const tableTex = U.canvasTexture(1024, 1024, (g, w, h) => {
      g.fillStyle = "#2a160c"; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 300; i++) { g.strokeStyle = `rgba(${U.randi(60, 90)},${U.randi(30, 45)},${U.randi(15, 25)},${U.rand(0.2, 0.5)})`; g.lineWidth = U.rand(1, 4); g.beginPath(); const y = Math.random() * h; g.moveTo(0, y); g.bezierCurveTo(w / 3, y + U.rand(-30, 30), (2 * w) / 3, y + U.rand(-30, 30), w, y + U.rand(-20, 20)); g.stroke(); }
    }, { repeat: [3, 3] });
    const table = new THREE.Mesh(new THREE.CylinderGeometry(11, 11, 0.4, 64), new THREE.MeshStandardMaterial({ map: tableTex, roughness: 0.45, metalness: 0.05 }));
    table.position.y = -0.55; table.receiveShadow = true; scene.add(table);
    const boardTex = U.canvasTexture(1024, 1024, (g, w, h) => {
      const s = w / 8;
      for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
        const light = (r + c) % 2 === 0;
        g.fillStyle = light ? "#efe6d8" : "#5b3a7a"; g.fillRect(c * s, r * s, s, s);
        for (let k = 0; k < 6; k++) { g.strokeStyle = light ? "rgba(160,140,120,.18)" : "rgba(255,255,255,.08)"; g.lineWidth = U.rand(1, 3); g.beginPath(); g.moveTo(c * s + U.rand(0, s), r * s); g.bezierCurveTo(c * s + U.rand(0, s), r * s + s / 3, c * s + U.rand(0, s), r * s + (2 * s) / 3, c * s + U.rand(0, s), r * s + s); g.stroke(); }
      }
    });
    const board = new THREE.Mesh(new THREE.BoxGeometry(8, 0.3, 8), [null, null, new THREE.MeshPhysicalMaterial({ map: boardTex, roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.1 }), null, null, null].map((m) => m || new THREE.MeshStandardMaterial({ color: 0x24123a, roughness: 0.3 })));
    board.position.y = -0.15; board.receiveShadow = true; scene.add(board);
    const frameTex = U.canvasTexture(1024, 1024, (g, w, h) => {
      g.fillStyle = "#1a0d24"; g.fillRect(0, 0, w, h);
      g.fillStyle = "#ffc83d"; g.font = "700 34px Unbounded, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
      const m = w * 0.06, s = (w - 2 * m) / 8;
      for (let i = 0; i < 8; i++) { g.fillText("abcdefgh"[i], m + s * (i + 0.5), h - m / 2); g.fillText(String(8 - i), m / 2, m + s * (i + 0.5)); }
    });
    const frame = new THREE.Mesh(new THREE.BoxGeometry(8.96, 0.28, 8.96), new THREE.MeshStandardMaterial({ map: frameTex, roughness: 0.35, metalness: 0.3 }));
    frame.position.y = -0.17; frame.receiveShadow = true; scene.add(frame);

    // pieces
    const whiteMat = new THREE.MeshPhysicalMaterial({ color: 0xf6efe2, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.08, sheen: 0.3 });
    const blackMat = new THREE.MeshPhysicalMaterial({ color: 0x18121f, roughness: 0.18, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.05, sheen: 1, sheenColor: new THREE.Color(0x8a5cff) });
    const SCALE = 0.62;
    let st = E.initial();
    const meshes = new Map(); // square -> group
    const captured = { w: 0, b: 0 };
    function makePiece(p) {
      const g = chessPiece(p.toLowerCase(), p === p.toUpperCase() ? whiteMat : blackMat);
      g.scale.setScalar(SCALE);
      if (p.toLowerCase() === "n") g.rotation.y = p === p.toUpperCase() ? -Math.PI / 2 : Math.PI / 2;
      scene.add(g); return g;
    }
    function syncAll() {
      for (const g of meshes.values()) scene.remove(g);
      meshes.clear();
      st.b.forEach((p, i) => { if (p) { const g = makePiece(p); g.position.copy(sqPos(i)); meshes.set(i, g); } });
    }
    syncAll();

    // highlights
    const dotGeo = new THREE.CircleGeometry(0.16, 24), ringGeo = new THREE.RingGeometry(0.36, 0.46, 32);
    const hlMat = new THREE.MeshBasicMaterial({ color: 0x2ef2ff, transparent: true, opacity: 0.85, toneMapped: false, depthWrite: false });
    const capMat = new THREE.MeshBasicMaterial({ color: 0xff3d6e, transparent: true, opacity: 0.9, toneMapped: false, depthWrite: false });
    const hints = new THREE.Group(); scene.add(hints);
    const hover = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.18, depthWrite: false })); hover.rotation.x = -Math.PI / 2; hover.position.y = 0.012; scene.add(hover);
    const lastMv = [0, 1].map(() => { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.98, 0.98), new THREE.MeshBasicMaterial({ color: 0xffc83d, transparent: true, opacity: 0.25, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.position.y = 0.011; m.visible = false; scene.add(m); return m; });
    const checkGlow = U.glowSprite(0xff2040, 1.6, 0.9); checkGlow.visible = false; scene.add(checkGlow);
    const handCursor = U.glowSprite(0x2ef2ff, 0.5, 0.9); scene.add(handCursor);
    const particles = new U.Particles(scene, 800);

    function showHints(from) {
      hints.clear();
      for (const m of legalNow) if (m.from === from) {
        const h = new THREE.Mesh(m.cap ? ringGeo : dotGeo, m.cap ? capMat : hlMat); h.rotation.x = -Math.PI / 2; h.position.copy(sqPos(m.to, 0.015)); hints.add(h);
      }
    }

    // ---------------------------------------------------------------- state
    let running = false, level = 1, phase = "you"; // you | ai | anim | over
    let legalNow = E.legal(st);
    let held = null; // { from, g }
    let selected = -1;
    const history = [];
    const anims = [];
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const _p = new THREE.Vector3();
    let thinkT = 0, statusText = "Your move";

    function squareAt(x, y) {
      const p = U.pointOnPlane(camera, x, y, plane, _p);
      if (!p) return -1;
      const c = Math.floor(p.x + 4), r = Math.floor(p.z + 4);
      return c >= 0 && c < 8 && r >= 0 && r < 8 ? r * 8 + c : -1;
    }

    function animate(g, to, onDone, arc = 0.8) {
      anims.push({ g, from: g.position.clone(), to: to.clone(), t: 0, dur: 0.42, arc, onDone });
    }
    function apply(m, byAi) {
      const undo = E.make(st, m);
      history.push({ m, undo });
      const g = meshes.get(m.from);
      meshes.delete(m.from);
      const capSq = m.ep ? undo.capSq : m.to;
      const victim = meshes.get(capSq);
      if (victim) {
        meshes.delete(capSq);
        const side = byAi ? "w" : "b"; // colour of the captured piece
        const n = captured[side]++;
        const tgt = new THREE.Vector3(side === "b" ? 5 + (n % 2) * 0.6 : -5 - (n % 2) * 0.6, 0, -3.5 + Math.floor(n / 2) * 0.7);
        particles.burst(sqPos(m.to, 0.4), byAi ? 0xff3d6e : 0x2ef2ff, 30, 3, { size: 0.2 });
        animate(victim, tgt, null, 1.6);
        sfx.hit();
      } else sfx.move();
      if (m.castle) {
        const row = byAi ? 0 : 7;
        const rf = row * 8 + (m.castle === "K" ? 7 : 0), rt = row * 8 + (m.castle === "K" ? 5 : 3);
        const rook = meshes.get(rf); meshes.delete(rf); meshes.set(rt, rook); animate(rook, sqPos(rt), null, 0.5);
      }
      meshes.set(m.to, g);
      if (m.promo) { scene.remove(g); const q = makePiece(m.promo); q.position.copy(g.position); meshes.set(m.to, q); animate(q, sqPos(m.to)); }
      else animate(g, sqPos(m.to), null, byAi ? 0.8 : 0.2);
      lastMv[0].position.copy(sqPos(m.from, 0.011)); lastMv[1].position.copy(sqPos(m.to, 0.011)); lastMv.forEach((l) => (l.visible = true));
      legalNow = E.legal(st);
      afterMove();
    }
    function afterMove() {
      const s = E.status(st);
      const chk = E.inCheck(st);
      checkGlow.visible = chk;
      if (chk) { checkGlow.position.copy(sqPos(E.kingSq(st, st.turn), 0.6)); }
      if (s === "mate") {
        phase = "over";
        const win = st.turn === "b";
        ui.banner(win ? "CHECKMATE!" : "CHECKMATE", win ? "#ffd23f" : "#ff3d6e");
        if (win) sfx.cheer(); else sfx.bad();
        ctx.end({ title: win ? "♛ You win!" : "Checkmate — computer wins", subtitle: `${LEVELS[level]} · ${st.full} moves`, score: win ? Math.max(10, 120 - st.full) * (level + 1) : 0, delay: 1800, stats: [["Moves", st.full], ["Level", LEVELS[level]]] });
        return;
      }
      if (s === "stalemate" || s === "draw") { phase = "over"; ui.banner("DRAW", "#b3acd6"); ctx.end({ title: "Draw", score: 10, delay: 1500 }); return; }
      if (chk) { ui.banner("CHECK!", "#ff3d6e"); sfx.bad(); }
      if (st.turn === "b") { phase = "ai"; thinkT = 0.5; statusText = "Computer is thinking…"; }
      else { phase = "you"; statusText = "Your move"; }
    }

    function tryDrop(from, to) {
      const m = legalNow.find((x) => x.from === from && x.to === to);
      if (m) { apply(m, false); return true; }
      return false;
    }

    ui.setTools([
      { id: "lvl", label: `🧠 ${LEVELS[level]}`, onClick: () => { level = (level + 1) % 3; ui.setTool("lvl", { label: `🧠 ${LEVELS[level]}` }); } },
      { id: "undo", label: "↶ Undo", onClick: () => {
        if (phase !== "you" || history.length < 2) return;
        for (let k = 0; k < 2; k++) { const { m, undo } = history.pop(); E.unmake(st, m, undo); }
        legalNow = E.legal(st); syncAll(); captured.w = captured.b = 0; lastMv.forEach((l) => (l.visible = false)); checkGlow.visible = E.inCheck(st); sfx.click();
      } },
      { id: "new", label: "♻ New game", onClick: () => { st = E.initial(); legalNow = E.legal(st); history.length = 0; captured.w = captured.b = 0; syncAll(); phase = "you"; lastMv.forEach((l) => (l.visible = false)); checkGlow.visible = false; sfx.whoosh(); } },
    ]);

    return {
      start() { running = true; ui.toast("You're white — pinch a piece to move ♟️"); },
      update(dt, now) {
        const h = input.primary;
        // camera sway
        camera.position.set(camBase.x + Math.sin(now / 4000) * 0.3, camBase.y, camBase.z);
        camera.lookAt(0, 0, 0.7);
        let sq = -1;
        if (h) {
          sq = squareAt(h.ptr.x, h.ptr.y);
          const p = U.pointOnPlane(camera, h.ptr.x, h.ptr.y, plane, _p);
          handCursor.visible = !!p; if (p) handCursor.position.set(p.x, 0.08, p.z);
          handCursor.material.color.set(h.pinch ? 0xff3df2 : 0x2ef2ff);
        }
        hover.visible = sq >= 0;
        if (sq >= 0) hover.position.copy(sqPos(sq, 0.012));

        if (running && phase === "you" && h && !input.locked) {
          const mine = (i) => st.b[i] && st.b[i] === st.b[i].toUpperCase();
          if (h.pinchStart && sq >= 0) {
            if (selected >= 0 && selected !== sq && legalNow.some((m) => m.from === selected && m.to === sq)) { tryDrop(selected, sq); selected = -1; hints.clear(); }
            else if (mine(sq)) { held = { from: sq, g: meshes.get(sq) }; selected = -1; showHints(sq); sfx.click(); }
          }
          if (held) {
            const p = U.pointOnPlane(camera, h.ptr.x, h.ptr.y, plane, _p);
            if (p) held.g.position.lerp(_p.set(p.x, 0.9, p.z), 0.45);
            held.g.rotation.z = Math.sin(now / 200) * 0.06;
            if (h.pinchEnd || !h.pinch) {
              const from = held.from, g = held.g; held = null; g.rotation.z = 0;
              if (sq === from) { animate(g, sqPos(from), null, 0.1); selected = from; }
              else if (!tryDrop(from, sq)) { animate(g, sqPos(from), null, 0.3); hints.clear(); sfx.empty(); }
              else hints.clear();
            }
          }
        } else if (held && (!h || input.locked)) { animate(held.g, sqPos(held.from), null, 0.3); held = null; hints.clear(); }

        if (phase === "ai") {
          thinkT -= dt;
          if (thinkT <= 0 && !anims.length) {
            const m = E.bestMove(st, level + 1);
            if (m) apply(m, true);
          }
        }
        for (const a of anims) {
          a.t += dt; const k = Math.min(1, a.t / a.dur), e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
          a.g.position.lerpVectors(a.from, a.to, e); a.g.position.y += Math.sin(k * Math.PI) * a.arc;
          if (k >= 1 && !a.done) { a.done = true; if (a.arc >= 0.5) sfx.clack(); a.onDone?.(); }
        }
        for (let i = anims.length - 1; i >= 0; i--) if (anims[i].done) anims.splice(i, 1);
        hints.children.forEach((c, i) => c.scale.setScalar(1 + Math.sin(now / 200 + i) * 0.12));
        checkGlow.material.opacity = 0.6 + Math.sin(now / 120) * 0.3;
        particles.update(dt);
        const myMat = st.b.reduce((s, p) => s + (p ? (p === p.toUpperCase() ? 1 : -1) * E.VAL[p.toLowerCase()] : 0), 0);
        ui.setStats([
          { label: "TURN", value: phase === "ai" ? "🤖" : phase === "over" ? "–" : "You", cls: "cool" },
          { label: "MOVE", value: st.full },
          { label: "MATERIAL", value: (myMat > 0 ? "+" : "") + Math.round(myMat / 100), cls: myMat >= 0 ? "hot" : "warn" },
          { label: "LEVEL", value: LEVELS[level] },
        ]);
      },
      dispose() {},
    };
  },
};
