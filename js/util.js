// Shared helpers: math, screen <-> world, textures, labels, particles, cleanup.
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

export const rand = (a, b) => a + Math.random() * (b - a);
export const randi = (a, b) => Math.floor(rand(a, b + 1));
export const pick = (arr) => arr[(Math.random() * arr.length) | 0];
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
export const deadzone = (v, dz) => (Math.abs(v) < dz ? 0 : (v - Math.sign(v) * dz) / (1 - dz));
export const TAU = Math.PI * 2;

// ---------------------------------------------------------------- screen <-> world
const _ray = new THREE.Raycaster();
const _ndc = new THREE.Vector2();
const _v = new THREE.Vector3();

export function ndc(x, y, out = _ndc) {
  return out.set((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1);
}
export function rayFromScreen(camera, x, y, ray = _ray) {
  ray.setFromCamera(ndc(x, y), camera);
  return ray;
}
export function pointAtDistance(camera, x, y, d, out = new THREE.Vector3()) {
  const r = rayFromScreen(camera, x, y);
  return out.copy(r.ray.origin).addScaledVector(r.ray.direction, d);
}
export function pointOnPlane(camera, x, y, plane, out = new THREE.Vector3()) {
  const r = rayFromScreen(camera, x, y);
  return r.ray.intersectPlane(plane, out);
}
export function toScreen(v, camera, out = { x: 0, y: 0, z: 0 }) {
  _v.copy(v).project(camera);
  out.x = ((_v.x + 1) / 2) * innerWidth;
  out.y = ((1 - _v.y) / 2) * innerHeight;
  out.z = _v.z;
  return out;
}
/** Pixel radius of a world-space sphere as seen by a perspective camera. */
export function screenRadius(center, radius, camera) {
  const d = _v.copy(center).applyMatrix4(camera.matrixWorldInverse).z * -1;
  if (d <= 0) return 0;
  const h = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * d;
  return (radius / h) * innerHeight;
}

// ---------------------------------------------------------------- textures
export function canvasTexture(w, h, draw, { srgb = true, repeat } = {}) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  draw(c.getContext("2d"), w, h, c);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}

let _glow = null;
export function glowTexture() {
  if (_glow) return _glow;
  _glow = canvasTexture(128, 128, (g, w, h) => {
    const grd = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    grd.addColorStop(0, "rgba(255,255,255,1)");
    grd.addColorStop(0.25, "rgba(255,255,255,.55)");
    grd.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
  });
  _glow.userData.shared = true;
  return _glow;
}
export function glowSprite(color = 0xffffff, size = 1, opacity = 1) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture(), color, transparent: true, opacity,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  s.scale.setScalar(size);
  return s;
}

/** Text on a sprite. Height in world units = size. */
export function makeLabel(text, { size = 0.4, color = "#ffffff", bg = "rgba(12,8,30,.72)", font = "Unbounded", weight = 800, border = null, pad = 28 } = {}) {
  const fs = 72;
  const meas = document.createElement("canvas").getContext("2d");
  meas.font = `${weight} ${fs}px ${font}, Inter, sans-serif`;
  const lines = String(text).split("\n");
  const tw = Math.max(...lines.map((l) => meas.measureText(l).width));
  const w = Math.ceil(tw + pad * 2), h = Math.ceil(fs * 1.25 * lines.length + pad * 1.2);
  const tex = canvasTexture(w, h, (g) => {
    if (bg) {
      g.fillStyle = bg;
      roundRect(g, 0, 0, w, h, h * 0.28 / lines.length); g.fill();
      if (border) { g.strokeStyle = border; g.lineWidth = 6; g.stroke(); }
    }
    g.font = `${weight} ${fs}px ${font}, Inter, sans-serif`;
    g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = color;
    lines.forEach((l, i) => g.fillText(l, w / 2, pad * 0.6 + fs * 1.25 * (i + 0.5)));
  });
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  s.scale.set((size * w) / h * lines.length, size * lines.length, 1);
  s.userData.aspect = w / h;
  return s;
}
export function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

/** Big inside-out sphere with a vertical gradient. */
export function makeSky(scene, top = "#0a0630", bottom = "#ff3d9a", { radius = 280, horizon = 0.5, stars = 0 } = {}) {
  const tex = canvasTexture(16, 512, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, top); grd.addColorStop(horizon, bottom); grd.addColorStop(1, bottom);
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
  });
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 32, 16),
    new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false, depthWrite: false }),
  );
  sky.renderOrder = -10;
  scene.add(sky);
  if (stars) {
    const pos = new Float32Array(stars * 3);
    for (let i = 0; i < stars; i++) {
      const th = Math.random() * TAU, ph = Math.acos(rand(0.05, 1));
      const r = radius * 0.9;
      pos.set([r * Math.sin(ph) * Math.cos(th), r * Math.cos(ph), r * Math.sin(ph) * Math.sin(th)], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.8 })));
  }
  return sky;
}

let _env = null;
export function getEnv(renderer) {
  if (_env) return _env;
  const pm = new THREE.PMREMGenerator(renderer);
  _env = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  _env.userData.shared = true;
  pm.dispose();
  return _env;
}

export function disposeScene(root) {
  root.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
    for (const m of mats) {
      for (const k in m) {
        const v = m[k];
        if (v && v.isTexture && !v.userData.shared) v.dispose();
      }
      m.dispose();
    }
  });
  if (root.background && root.background.isTexture && !root.background.userData.shared) root.background.dispose();
}

// ---------------------------------------------------------------- particles
const PVERT = `
attribute float psize; attribute float palpha; attribute vec3 pcolor;
varying vec3 vC; varying float vA;
void main(){
  vC = pcolor; vA = palpha;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = psize * (420.0 / -mv.z);
  gl_Position = projectionMatrix * mv;
}`;
const PFRAG = `
uniform sampler2D map; varying vec3 vC; varying float vA;
void main(){
  vec4 t = texture2D(map, gl_PointCoord);
  if (vA * t.a < 0.01) discard;
  gl_FragColor = vec4(vC * 1.6, t.a * vA);
}`;

export class Particles {
  constructor(scene, max = 3000) {
    this.max = max; this.i = 0;
    this.p = new Float32Array(max * 3);
    this.v = new Float32Array(max * 3);
    this.c = new Float32Array(max * 3);
    this.s = new Float32Array(max);
    this.a = new Float32Array(max);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.grav = new Float32Array(max);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(this.p, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute("pcolor", new THREE.BufferAttribute(this.c, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute("psize", new THREE.BufferAttribute(this.s, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute("palpha", new THREE.BufferAttribute(this.a, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo = g;
    this.points = new THREE.Points(g, new THREE.ShaderMaterial({
      uniforms: { map: { value: glowTexture() } },
      vertexShader: PVERT, fragmentShader: PFRAG,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    this.points.frustumCulled = false;
    scene.add(this.points);
  }
  burst(pos, color, n = 30, speed = 3, { size = 0.25, life = 0.9, gravity = -6, spread = 1, up = 0 } = {}) {
    const col = new THREE.Color(color);
    for (let k = 0; k < n; k++) {
      const i = this.i; this.i = (this.i + 1) % this.max;
      const th = Math.random() * TAU, ph = Math.acos(rand(-1, 1));
      const sp = speed * rand(0.3, 1);
      this.p[i * 3] = pos.x; this.p[i * 3 + 1] = pos.y; this.p[i * 3 + 2] = pos.z;
      this.v[i * 3] = Math.sin(ph) * Math.cos(th) * sp * spread;
      this.v[i * 3 + 1] = Math.cos(ph) * sp + up;
      this.v[i * 3 + 2] = Math.sin(ph) * Math.sin(th) * sp * spread;
      const h = rand(-0.06, 0.06);
      const cc = col.clone().offsetHSL(h, 0, rand(-0.1, 0.15));
      this.c[i * 3] = cc.r; this.c[i * 3 + 1] = cc.g; this.c[i * 3 + 2] = cc.b;
      this.s[i] = size * rand(0.5, 1.3);
      this.life[i] = this.maxLife[i] = life * rand(0.6, 1.2);
      this.grav[i] = gravity;
      this.a[i] = 1;
    }
  }
  update(dt) {
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) { if (this.a[i]) this.a[i] = 0; continue; }
      this.life[i] -= dt;
      this.v[i * 3 + 1] += this.grav[i] * dt;
      this.v[i * 3] *= 0.985; this.v[i * 3 + 2] *= 0.985;
      this.p[i * 3] += this.v[i * 3] * dt;
      this.p[i * 3 + 1] += this.v[i * 3 + 1] * dt;
      this.p[i * 3 + 2] += this.v[i * 3 + 2] * dt;
      this.a[i] = Math.max(0, this.life[i] / this.maxLife[i]);
    }
    for (const k of ["position", "pcolor", "psize", "palpha"]) this.geo.attributes[k].needsUpdate = true;
  }
}

/** Floating 3D text popups ("+10", "SIX!") that rise and fade. */
export class FloatTexts {
  constructor(scene) { this.scene = scene; this.items = []; }
  spawn(text, pos, { color = "#ffffff", size = 0.5, life = 1, rise = 1.2, bg = null } = {}) {
    const s = makeLabel(text, { size, color, bg, font: "Unbounded" });
    s.position.copy(pos);
    s.material.depthTest = false; s.renderOrder = 20;
    this.scene.add(s);
    this.items.push({ s, life, max: life, rise, base: s.scale.clone() });
  }
  update(dt) {
    for (const it of this.items) {
      it.life -= dt;
      it.s.position.y += it.rise * dt;
      const k = it.life / it.max;
      it.s.material.opacity = Math.min(1, k * 2.5);
      const pop = 1 + Math.max(0, (k - 0.8) * 2);
      it.s.scale.copy(it.base).multiplyScalar(pop);
    }
    this.items = this.items.filter((it) => {
      if (it.life > 0) return true;
      this.scene.remove(it.s); it.s.material.map.dispose(); it.s.material.dispose();
      return false;
    });
  }
}

/** Standard light rig. */
export function addLights(scene, { ambient = 0.35, sky = 0x8899ff, ground = 0x221133, sun = 1.6, sunPos = [6, 12, 6], shadow = true, sunColor = 0xffffff } = {}) {
  const hemi = new THREE.HemisphereLight(sky, ground, ambient * 2);
  scene.add(hemi);
  const dir = new THREE.DirectionalLight(sunColor, sun);
  dir.position.set(...sunPos);
  if (shadow) {
    dir.castShadow = true;
    dir.shadow.mapSize.set(1024, 1024);
    const c = dir.shadow.camera; c.left = c.bottom = -14; c.right = c.top = 14; c.near = 0.5; c.far = 60;
    dir.shadow.bias = -0.0005;
  }
  scene.add(dir);
  return { hemi, dir };
}

export function shadowAll(root, cast = true, receive = true) {
  root.traverse((o) => { if (o.isMesh) { o.castShadow = cast; o.receiveShadow = receive; } });
  return root;
}

export const PALETTE = ["#ff3d6e", "#ff8a1f", "#ffd23f", "#b6ff3d", "#2ef2a0", "#2ef2ff", "#4d7cff", "#9b5cff", "#ff3df2"];
