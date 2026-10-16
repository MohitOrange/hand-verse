// Handverse — boot, renderer, scene switching between the room and the games.
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { Input } from "./hands.js";
import { UI } from "./ui.js";
import { sfx, unlockAudio, setMuted, isMuted, startAmbient, stopAmbient } from "./audio.js";
import * as U from "./util.js";
import { Hands3D } from "./hand3d.js";
import { createLobby } from "./lobby.js";
import { GAMES } from "./games/index.js";

const $ = (id) => document.getElementById(id);
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

// ---------------------------------------------------------------- renderer
const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
let quality = store.get("hv_quality", isMobile ? "low" : "high");
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(devicePixelRatio, quality === "high" ? 1.5 : 1));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
$("stage").appendChild(renderer.domElement);

const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(new THREE.Scene(), new THREE.PerspectiveCamera());
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.7, 0.5, 0.8);
composer.addPass(renderPass); composer.addPass(bloom); composer.addPass(new OutputPass());

const video = $("video");
const input = new Input(video);
const ui = new UI(input);
const bests = store.get("hv_bests", {});
const view = { scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera() };
let videoTex = null, arOn = false;

function coverVideo() {
  if (!videoTex) return;
  const va = input.videoAspect, sa = innerWidth / innerHeight;
  if (sa > va) { const ry = va / sa; videoTex.repeat.set(-1, ry); videoTex.offset.set(1, (1 - ry) / 2); }
  else { const rx = sa / va; videoTex.repeat.set(-rx, 1); videoTex.offset.set((1 + rx) / 2, 0); }
}

// ---------------------------------------------------------------- shared context handed to every game
const ctx = {
  THREE, U, renderer, input, ui, sfx, startAmbient, stopAmbient,
  env: U.getEnv(renderer),
  get W() { return innerWidth; }, get H() { return innerHeight; },
  hands3d: (scene, opts) => new Hands3D(scene, opts),
  view(scene, camera) {
    view.scene = scene; view.camera = camera;
    renderPass.scene = scene; renderPass.camera = camera;
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
    if (arOn) scene.background = ctx.videoTexture();
  },
  bloom(strength = 0.7, radius = 0.5, threshold = 0.8) { bloom.strength = strength; bloom.radius = radius; bloom.threshold = threshold; },
  videoTexture() {
    if (!videoTex) {
      videoTex = new THREE.VideoTexture(video);
      videoTex.colorSpace = THREE.SRGBColorSpace;
      videoTex.wrapS = THREE.RepeatWrapping;
      videoTex.userData.shared = true;
      coverVideo();
    }
    return videoTex;
  },
  /** Use the live webcam as the scene background (true AR). Returns false when no camera. */
  ar(on, scene = view.scene) {
    arOn = on && input.cameraOn;
    if (arOn) { scene.background = ctx.videoTexture(); coverVideo(); ui.togglePip(false, false); }
    return arOn;
  },
  best: (id) => bests[id] || 0,
  end: (res) => finish(res),
  snapshot() { draw(); return renderer.domElement.toDataURL("image/png"); },
};

function draw() {
  if (quality === "high") composer.render();
  else renderer.render(view.scene, view.camera);
}

addEventListener("resize", () => {
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
  view.camera.aspect = innerWidth / innerHeight; view.camera.updateProjectionMatrix();
  coverVideo();
  active?.inst.resize?.();
});

// ---------------------------------------------------------------- flow: intro → room ⇄ games
let mode = "intro";
let active = null; // { def, inst, ended }
let lobby = null;

function enterRoom() {
  $("intro").classList.add("hidden");
  ui.showHud(true);
  if (!lobby) lobby = createLobby(ctx, GAMES, (def) => launch(def));
  mode = "lobby";
  arOn = false;
  ui.showBack(false);
  lobby.enter();
  if (input.cameraOn) ui.toast("✋ Raise your hand — open palm to walk, pinch to grab", 4000);
  else ui.toast("🖱️ Mouse mode: drag to look, WASD to walk, click to grab", 4000);
}

async function launch(def) {
  sfx.whoosh();
  disposeActive();
  if (mode === "lobby") lobby.leave();
  mode = "game";
  arOn = false;
  ui.setTitle(`${def.emoji} ${def.title}`);
  ui.showBack(true);
  ui.setStats([]); ui.setHelp(def.help || []); ui.setTools([]);
  active = { def, inst: def.create(ctx), ended: false };
  const choice = await ui.howTo(def, bests[def.id]);
  if (!active || active.def !== def) return;
  if (choice === "start") { sfx.good(); active.inst.start?.(); }
  else if (choice === "back") backToRoom();
}

async function finish(res = {}) {
  if (!active || active.ended) return;
  active.ended = true;
  const id = active.def.id;
  let isBest = false;
  if (!res.noBest && typeof res.score === "number") {
    if (res.score > (bests[id] || 0)) { bests[id] = res.score; store.set("hv_bests", bests); isBest = res.score > 0; }
  }
  const def = active.def;
  await new Promise((r) => setTimeout(r, res.delay ?? 900));
  if (!active || active.def !== def) return;
  const choice = await ui.gameOver({ ...res, best: res.noBest ? null : bests[id], isBest });
  if (!active || active.def !== def) return;
  if (choice === "again") {
    disposeActive();
    ui.setStats([]); ui.setTools([]);
    active = { def, inst: def.create(ctx), ended: false };
    sfx.good();
    active.inst.start?.();
  } else if (choice === "room") backToRoom();
}

function disposeActive() {
  if (!active) return;
  try { active.inst.dispose?.(); } catch (e) { console.error(e); }
  if (view.scene && view.scene !== lobby?.scene) U.disposeScene(view.scene);
  active = null;
  stopAmbient();
  ui.setTools([]); ui.setStats([]); ui.joystick(false); ui.hideCursor = false;
  ctx.bloom(); renderer.toneMappingExposure = 1.05;
}

function backToRoom() {
  ui.cancelModal();
  disposeActive();
  mode = "lobby"; arOn = false;
  ui.showBack(false);
  ui.togglePip(ui.pipPref, false);
  lobby.enter();
}

$("btnBack").onclick = () => { if (mode === "game") backToRoom(); };
$("btnMenu").onclick = () => {
  if (mode === "intro") return;
  ui.openMenu(GAMES, bests, (def) => launch(def));
};
$("btnSound").onclick = () => { setMuted(!isMuted()); $("btnSound").textContent = isMuted() ? "🔇" : "🔊"; };
$("btnSound").textContent = isMuted() ? "🔇" : "🔊";
const qBtn = $("menuQuality");
const qLabel = () => (qBtn.textContent = `Graphics: ${quality === "high" ? "High (glow)" : "Fast"}`);
qLabel();
qBtn.onclick = () => {
  quality = quality === "high" ? "low" : "high";
  store.set("hv_quality", quality); qLabel();
  renderer.setPixelRatio(Math.min(devicePixelRatio, quality === "high" ? 1.5 : 1));
  composer.setPixelRatio?.(renderer.getPixelRatio());
  composer.setSize(innerWidth, innerHeight);
};
addEventListener("keydown", (e) => {
  if (e.code === "Escape") { if (ui.modal === "menu") ui.cancelModal(); else if (mode === "game") backToRoom(); }
  if (e.code === "KeyM" && mode !== "intro") $("btnMenu").click();
});

// intro screen
$("introGames").innerHTML = GAMES.map((g) => `<span>${g.emoji} ${g.title}</span>`).join("");

$("startMouse").onclick = () => { unlockAudio(); enterRoom(); };
$("startCam").onclick = async () => {
  unlockAudio();
  const err = $("err"); err.textContent = "";
  if (!navigator.mediaDevices?.getUserMedia) {
    err.textContent = "This browser can't open the camera here. Use Chrome or Edge over https:// — or play with the mouse.";
    return;
  }
  const btn = $("startCam"); btn.disabled = true; btn.textContent = "Starting…";
  $("bootList").classList.remove("hidden");
  const set = (id, cls) => { const li = $(id); li.className = cls; };
  set("bootCam", "wait");
  try { await input.startCamera(); set("bootCam", "ok"); }
  catch (e) {
    console.error(e); set("bootCam", "");
    err.textContent = "Camera was blocked. Allow camera access in the address bar and try again — or play with the mouse.";
    btn.disabled = false; btn.textContent = "▶ Start with camera"; return;
  }
  set("bootModel", "wait");
  $("bootHint").textContent = "Loading the hand-tracking AI (first time can take a few seconds)…";
  try { await input.loadModel(); set("bootModel", "ok"); }
  catch (e) {
    console.error(e); set("bootModel", "");
    err.textContent = "Couldn't load hand tracking (check your internet). Starting with the mouse instead.";
    await new Promise((r) => setTimeout(r, 1800));
  }
  ui.togglePip(true);
  enterRoom();
};

// ---------------------------------------------------------------- main loop
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  input.update(now);
  if (mode === "intro") {
    if (input.hands.some((h) => !h.synthetic)) $("bootHand").className = "ok";
    return;
  }
  ui.update(dt, now);
  try {
    if (mode === "lobby") lobby.update(dt, now);
    else if (active) active.inst.update(dt, now);
  } catch (e) { console.error(e); }
  draw();
}
requestAnimationFrame(frame);

// tiny debug hook for automated tests
window.__hv = { ctx, GAMES, view, launch: (id) => launch(GAMES.find((g) => g.id === id)), get mode() { return mode; }, get active() { return active; }, get lobby() { return lobby; }, enterRoom };
