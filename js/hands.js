// Webcam + MediaPipe hand tracking, turned into game-ready hands:
// pointer, pinch, gestures (point / pinch / open / fist / peace), depth and velocity.
// Mouse + keyboard act as a fallback "hand" when no camera is used.
import {
  FilesetResolver,
  HandLandmarker,
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14";

const WASM = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";
const MODEL = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

export const TIPS = [4, 8, 12, 16, 20];
export const BONES = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[17,18],[18,19],[19,20],[0,17]];
const REACH = 1.3; // pointer amplification so the screen edges are easy to reach

class OneEuro {
  constructor(minCutoff = 1.7, beta = 6, dCutoff = 1.2) { this.mc = minCutoff; this.b = beta; this.dc = dCutoff; this.x = null; this.dx = 0; }
  static a(cut, dt) { const r = 2 * Math.PI * cut * dt; return r / (r + 1); }
  f(x, dt) {
    if (this.x === null) { this.x = x; return x; }
    const dx = (x - this.x) / dt;
    this.dx += OneEuro.a(this.dc, dt) * (dx - this.dx);
    const cut = this.mc + this.b * Math.abs(this.dx);
    this.x += OneEuro.a(cut, dt) * (x - this.x);
    return this.x;
  }
}

const d3 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

function newHand(id) {
  return {
    id, visible: true, synthetic: false, seen: 0, label: "",
    lm: null, world: null, pts: [],
    ptr: { x: 0, y: 0 }, tip: { x: 0, y: 0 }, palm: { x: 0, y: 0 }, nx: 0.5, ny: 0.5, pnx: 0.5, pny: 0.5,
    depth: 0.5, size: 0.15,
    pinch: false, pinchStart: false, pinchEnd: false, pinchAmt: 0,
    fingers: { thumb: false, index: false, middle: false, ring: false, pinky: false },
    gesture: "none", _cand: "none", _candN: 0,
    vel: { x: 0, y: 0 }, speed: 0, history: [],
    f: { px: new OneEuro(), py: new OneEuro(), tx: new OneEuro(), ty: new OneEuro(), ax: new OneEuro(1.2, 3), ay: new OneEuro(1.2, 3), d: new OneEuro(0.8, 1) },
  };
}

export class Input {
  constructor(video) {
    this.video = video;
    this.hands = [];          // visible hands this frame
    this._tracked = [];       // includes briefly-lost hands
    this.primary = null;
    this.cameraOn = false;
    this.modelReady = false;
    this.locked = false;      // set by UI when a modal / button has focus
    this.keys = new Set();
    this.mouse = { x: innerWidth / 2, y: innerHeight / 2, down: false, right: false, moved: 0, dx: 0, dy: 0, fdx: 0, fdy: 0, wheel: 0 };
    this.mouseHand = newHand(9); this.mouseHand.synthetic = true;
    this._lastVT = -1; this._lastT = 0;
    this._bind();
  }

  _bind() {
    const m = this.mouse;
    addEventListener("pointermove", (e) => {
      if (e.pointerType === "touch" && !m.down) { m.x = e.clientX; m.y = e.clientY; }
      m.dx += e.clientX - m.x; m.dy += e.clientY - m.y;
      m.x = e.clientX; m.y = e.clientY; m.moved = performance.now();
    });
    addEventListener("pointerdown", (e) => {
      m.x = e.clientX; m.y = e.clientY; m.moved = performance.now();
      if (e.button === 2) m.right = true; else m.down = true;
    });
    addEventListener("pointerup", (e) => { if (e.button === 2) m.right = false; else m.down = false; });
    addEventListener("pointercancel", () => { m.down = m.right = false; });
    addEventListener("contextmenu", (e) => e.preventDefault());
    addEventListener("wheel", (e) => { m.wheel += Math.sign(e.deltaY); m.moved = performance.now(); }, { passive: true });
    addEventListener("keydown", (e) => { this.keys.add(e.code); });
    addEventListener("keyup", (e) => { this.keys.delete(e.code); });
    addEventListener("blur", () => { this.keys.clear(); m.down = m.right = false; });
  }

  key(...codes) { return codes.some((c) => this.keys.has(c)); }

  async startCamera() {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false,
    });
    this.video.srcObject = stream;
    await this.video.play();
    await new Promise((r) => (this.video.videoWidth ? r() : (this.video.onloadedmetadata = r)));
    this.cameraOn = true;
  }

  async loadModel() {
    const fileset = await FilesetResolver.forVisionTasks(WASM);
    const make = (delegate) => HandLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MODEL, delegate },
      runningMode: "VIDEO", numHands: 2,
      minHandDetectionConfidence: 0.55, minHandPresenceConfidence: 0.5, minTrackingConfidence: 0.5,
    });
    try { this.lmk = await make("GPU"); } catch (e) { console.warn("GPU failed, using CPU", e); this.lmk = await make("CPU"); }
    this.modelReady = true;
  }

  get videoAspect() { return (this.video.videoWidth || 1280) / (this.video.videoHeight || 720); }

  /** Camera-normalised (u,v) → exact screen pixels, mirrored, with "cover" fit (matches the AR background). */
  map(u, v, out = { x: 0, y: 0 }) {
    const vw = this.video.videoWidth || 1280, vh = this.video.videoHeight || 720;
    const s = Math.max(innerWidth / vw, innerHeight / vh);
    const dw = vw * s, dh = vh * s;
    out.x = (innerWidth - dw) / 2 + (1 - u) * dw;
    out.y = (innerHeight - dh) / 2 + v * dh;
    return out;
  }

  update(now) {
    const dt = Math.max(0.001, Math.min(0.1, (now - this._lastT) / 1000)); this._lastT = now;
    for (const h of this._tracked) { h.pinchStart = h.pinchEnd = false; }
    this.mouseHand.pinchStart = this.mouseHand.pinchEnd = false;

    const v = this.video;
    if (this.lmk && v.readyState >= 2 && v.currentTime !== this._lastVT) {
      const fdt = this._lastVT < 0 ? 1 / 30 : Math.max(1 / 120, Math.min(0.2, v.currentTime - this._lastVT));
      this._lastVT = v.currentTime;
      let res;
      try { res = this.lmk.detectForVideo(v, now); } catch (e) { res = null; }
      if (res) this._ingest(res, now, fdt);
    }
    // drop hands lost for a while
    this._tracked = this._tracked.filter((h) => {
      if (now - h.seen < 160) return true;
      if (h.pinch) { h.pinch = false; h.pinchEnd = true; }
      return false;
    });
    this.hands = this._tracked.filter((h) => now - h.seen < 160);

    // mouse fallback hand
    const m = this.mouse;
    const useMouse = !this.hands.length && (!this.cameraOn || now - m.moved < 2500 || m.down);
    if (useMouse) this._mouseUpdate(now, dt);
    else if (this.mouseHand.pinch) { this.mouseHand.pinch = false; }

    this.hands.sort((a, b) => a.id - b.id);
    this.primary = this.hands[0] || null;
    m.fdx = m.dx; m.fdy = m.dy; m.dx = m.dy = 0;
  }

  _mouseUpdate(now, dt) {
    const h = this.mouseHand, m = this.mouse;
    h.visible = true; h.seen = now;
    const was = h.pinch;
    h.pinch = m.down;
    h.pinchStart = h.pinch && !was; h.pinchEnd = !h.pinch && was;
    h.pinchAmt = h.pinch ? 1 : 0;
    const px = h.ptr.x, py = h.ptr.y;
    h.ptr.x = h.tip.x = h.palm.x = m.x; h.ptr.y = h.tip.y = h.palm.y = m.y;
    h.nx = h.pnx = m.x / innerWidth; h.ny = h.pny = m.y / innerHeight;
    if (m.wheel) { h.depth = Math.max(0, Math.min(1, h.depth - m.wheel * 0.05)); m.wheel = 0; }
    const vx = (h.ptr.x - px) / dt, vy = (h.ptr.y - py) / dt;
    h.vel.x += (vx - h.vel.x) * 0.5; h.vel.y += (vy - h.vel.y) * 0.5;
    h.speed = Math.hypot(h.vel.x, h.vel.y);
    h.history.push({ x: h.ptr.x, y: h.ptr.y, t: now });
    while (h.history.length && now - h.history[0].t > 400) h.history.shift();
    const g = this.key("Space") || m.right ? "open" : this.key("KeyF") ? "fist" : h.pinch ? "pinch" : "point";
    h.gesture = g;
    h.fingers.index = g !== "fist";
    this.hands = [h];
  }

  _ingest(res, now, dt) {
    const lms = res.landmarks || [], wls = res.worldLandmarks || [];
    const used = new Set();
    for (let i = 0; i < lms.length; i++) {
      const lm = lms[i];
      // match to an existing hand by palm position
      const cx = (lm[0].x + lm[9].x) / 2, cy = (lm[0].y + lm[9].y) / 2;
      let best = null, bd = 0.28;
      for (const h of this._tracked) {
        if (used.has(h)) continue;
        const d = Math.hypot(h._cx - cx, h._cy - cy);
        if (d < bd) { bd = d; best = h; }
      }
      if (!best) {
        const ids = new Set(this._tracked.map((h) => h.id));
        let id = 0; while (ids.has(id)) id++;
        best = newHand(id); this._tracked.push(best);
      }
      used.add(best);
      best._cx = cx; best._cy = cy;
      best.label = res.handednesses?.[i]?.[0]?.categoryName === "Left" ? "Right" : "Left"; // selfie view flip
      this._analyse(best, lm, wls[i] || lm, now, dt);
    }
  }

  _analyse(h, lm, wl, now, dt) {
    h.seen = now; h.lm = lm; h.world = wl;
    h.pts = lm.map((p) => this.map(p.x, p.y, { x: 0, y: 0 }));
    for (let i = 0; i < 21; i++) h.pts[i].z = lm[i].z;

    // ---- fingers (world landmarks are metric and rotation-robust)
    const W = wl, w0 = W[0];
    const ext = (tip, pip) => d3(W[tip], w0) > d3(W[pip], w0) * 1.12;
    const palmLen = d3(W[0], W[9]) || 0.09;
    h.fingers.index = ext(8, 6);
    h.fingers.middle = ext(12, 10);
    h.fingers.ring = ext(16, 14);
    h.fingers.pinky = ext(20, 18);
    h.fingers.thumb = d3(W[4], W[9]) > palmLen * 0.75 && d3(W[4], W[5]) > palmLen * 0.45;

    // ---- pinch with hysteresis
    const pd = d3(W[4], W[8]);
    const was = h.pinch;
    if (!was && pd < 0.034) h.pinch = true;
    else if (was && pd > 0.055) h.pinch = false;
    h.pinchStart = h.pinch && !was; h.pinchEnd = !h.pinch && was;
    h.pinchAmt = Math.max(0, Math.min(1, (0.09 - pd) / 0.06));

    // ---- gesture with a 3-frame debounce
    const f = h.fingers, n = f.index + f.middle + f.ring + f.pinky;
    let g = "other";
    if (h.pinch) g = "pinch";
    else if (n >= 4) g = "open";
    else if (n === 0) g = "fist";
    else if (f.index && !f.middle && !f.ring && !f.pinky) g = "point";
    else if (f.index && f.middle && !f.ring && !f.pinky) g = "peace";
    if (g === h._cand) h._candN++; else { h._cand = g; h._candN = 1; }
    if (h._candN >= 3 || g === "pinch" || h.gesture === "none") h.gesture = g;

    // ---- points
    const tip = this.map(lm[8].x, lm[8].y);
    const pu = (lm[0].x + lm[5].x + lm[9].x + lm[13].x + lm[17].x) / 5;
    const pv = (lm[0].y + lm[5].y + lm[9].y + lm[13].y + lm[17].y) / 5;
    const palm = this.map(pu, pv);
    // While pinching, the index tip dips toward the thumb; aim from between the knuckle and tip instead.
    const aimSrc = h.pinch || h.gesture === "fist" ? this.map((lm[5].x + lm[6].x) / 2, (lm[5].y + lm[6].y) / 2) : tip;
    h.tip.x = h.f.tx.f(tip.x, dt); h.tip.y = h.f.ty.f(tip.y, dt);
    h.palm.x = h.f.ax.f(palm.x, dt); h.palm.y = h.f.ay.f(palm.y, dt);
    const cx = innerWidth / 2, cy = innerHeight / 2;
    const ax = Math.max(0, Math.min(innerWidth, cx + (aimSrc.x - cx) * REACH));
    const ay = Math.max(0, Math.min(innerHeight, cy + (aimSrc.y - cy) * REACH));
    const px = h.ptr.x, py = h.ptr.y, first = h.history.length === 0;
    h.ptr.x = h.f.px.f(ax, dt); h.ptr.y = h.f.py.f(ay, dt);
    h.nx = h.ptr.x / innerWidth; h.ny = h.ptr.y / innerHeight;
    h.pnx = h.palm.x / innerWidth; h.pny = h.palm.y / innerHeight;

    // ---- depth from apparent hand size (bigger = closer)
    const a = this.map(lm[0].x, lm[0].y), b = this.map(lm[9].x, lm[9].y), c = this.map(lm[5].x, lm[5].y), e = this.map(lm[17].x, lm[17].y);
    const size = (Math.hypot(a.x - b.x, a.y - b.y) + Math.hypot(c.x - e.x, c.y - e.y)) / 2 / innerHeight;
    h.size = size;
    h.depth = h.f.d.f(Math.max(0, Math.min(1, (size - 0.07) / 0.2)), dt);

    // ---- velocity
    if (!first) {
      const vx = (h.ptr.x - px) / dt, vy = (h.ptr.y - py) / dt;
      h.vel.x += (vx - h.vel.x) * 0.55; h.vel.y += (vy - h.vel.y) * 0.55;
      h.speed = Math.hypot(h.vel.x, h.vel.y);
    }
    h.history.push({ x: h.ptr.x, y: h.ptr.y, t: now });
    while (h.history.length && now - h.history[0].t > 400) h.history.shift();
  }

  /** Pointer position roughly `ms` ago (useful to aim before a pinch moved the finger). */
  past(h, ms, out = { x: 0, y: 0 }) {
    const t = performance.now() - ms;
    let p = h.history[0] || h.ptr;
    for (const q of h.history) { if (q.t <= t) p = q; else break; }
    out.x = p.x; out.y = p.y; return out;
  }
}
