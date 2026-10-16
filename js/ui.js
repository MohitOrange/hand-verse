// DOM layer: hand cursor that can click buttons (pinch or hover-dwell), HUD, cards, toasts, camera preview.
import { BONES } from "./hands.js";
import { sfx } from "./audio.js";

const $ = (id) => document.getElementById(id);
const DWELL = 1.1;
const GESTURE_ICON = { point: "☝️", pinch: "🤏", open: "✋", fist: "✊", peace: "✌️", other: "🖐", none: "·" };

export class UI {
  constructor(input) {
    this.input = input;
    this.cursor = $("cursor"); this.prog = $("cursorProg");
    this.hover = null; this.dwell = 0;
    this.modal = null; this._resolve = null;
    this._stats = ""; this._toastT = 0; this._pip = false;
    this.pipCtx = $("pipCanvas").getContext("2d");
    $("htStart").onclick = () => this._close("start");
    $("htBack").onclick = () => this._close("back");
    $("ovAgain").onclick = () => this._close("again");
    $("ovRoom").onclick = () => this._close("room");
    $("btnPip").onclick = () => this.togglePip();
    this.pipPref = false;
  }

  // ---------------------------------------------------------------- per frame
  update(dt) {
    const h = this.input.primary;
    const c = this.cursor;
    if (!h) { c.classList.add("hidden"); this._setHover(null); }
    else {
      c.classList.toggle("hidden", !!this.hideCursor && !this.modal && !this.hover);
      c.style.transform = `translate(${h.ptr.x}px, ${h.ptr.y}px)`;
      c.classList.toggle("pinch", h.pinch);
      const el = document.elementFromPoint(h.ptr.x, h.ptr.y);
      let target = el && el.closest("[data-hand]");
      if (target && (target.disabled || target.closest(".hidden"))) target = null;
      if (this.modal && target && !target.closest(".modal")) target = null; // only modal buttons while a modal is open
      this._setHover(target);
      if (target && !h.synthetic) {
        if (h.pinchStart) { this._click(target); h.pinchStart = false; }
        else if (target.dataset.hand === "dwell" || this.modal) {
          this.dwell += dt;
          if (this.dwell >= DWELL) { this._click(target); this.dwell = -0.6; }
        }
      }
      const p = Math.max(0, this.dwell) / DWELL;
      this.prog.style.strokeDashoffset = String(151 * (1 - p));
      if (target) target.style.setProperty("--dwell", p.toFixed(3));
      c.classList.toggle("over", !!target);
    }
    this.input.locked = !!this.modal || !!this.hover;
    $("gestureChip").textContent = h ? (h.synthetic ? "🖱️" : GESTURE_ICON[h.gesture] || "·") : "·";
    if (this._pip) this._drawPip();
  }

  _setHover(el) {
    if (el === this.hover) return;
    if (this.hover) { this.hover.classList.remove("hand-hover"); this.hover.style.removeProperty("--dwell"); }
    this.hover = el; this.dwell = 0;
    if (el) { el.classList.add("hand-hover"); if (!this.input.primary?.synthetic) sfx.hover(); }
  }
  _click(el) { sfx.click(); el.click(); }

  // ---------------------------------------------------------------- HUD
  showHud(on = true) { $("hud").classList.toggle("hidden", !on); }
  setTitle(t) { $("hudTitle").textContent = t; }
  showBack(on) { $("btnBack").classList.toggle("hidden", !on); }
  setStats(list) {
    const html = list.map((s) => `<div class="stat ${s.cls || ""}"><small>${s.label}</small><b>${s.value}</b></div>`).join("");
    if (html !== this._stats) { $("hudStats").innerHTML = html; this._stats = html; }
  }
  setHelp(items) {
    const el = $("help");
    if (!items || !items.length) { el.classList.add("hidden"); return; }
    el.innerHTML = items.map(([e, t]) => `<div><em>${e}</em><span>${t}</span></div>`).join("");
    el.classList.remove("hidden");
  }
  setTools(tools) {
    const el = $("tools");
    if (!tools || !tools.length) { el.classList.add("hidden"); el.innerHTML = ""; return; }
    el.innerHTML = "";
    for (const t of tools) {
      const b = document.createElement("button");
      b.className = "chip-btn" + (t.on ? " on" : "");
      b.dataset.hand = t.dwell === false ? "pinch" : "dwell";
      b.textContent = t.label; b.id = "tool-" + t.id;
      b.onclick = () => t.onClick(b);
      el.appendChild(b);
    }
    el.classList.remove("hidden");
  }
  setTool(id, { label, on } = {}) {
    const b = $("tool-" + id); if (!b) return;
    if (label !== undefined) b.textContent = label;
    if (on !== undefined) b.classList.toggle("on", on);
  }
  joystick(active, dx = 0, dy = 0) {
    const j = $("joy");
    j.classList.toggle("hidden", !active);
    if (active) j.firstElementChild.style.transform = `translate(${dx * 34}px, ${dy * 34}px)`;
  }

  toast(text, ms = 2200) {
    const t = $("toast"); t.textContent = text; t.classList.add("show");
    clearTimeout(this._toastT); this._toastT = setTimeout(() => t.classList.remove("show"), ms);
  }
  banner(text, color = "#ffffff") {
    const b = $("banner"); b.textContent = text; b.style.color = color;
    b.classList.remove("show"); void b.offsetWidth; b.classList.add("show");
  }
  flash(color = "#ffffff", strength = 0.8, ms = 350) {
    const f = $("flash");
    f.style.transition = "none"; f.style.background = color; f.style.opacity = String(strength);
    void f.offsetWidth; f.style.transition = `opacity ${ms}ms ease-out`; f.style.opacity = "0";
  }

  // ---------------------------------------------------------------- modals
  _open(id) { this._closeAll(); this.modal = id; $(id).classList.remove("hidden"); return new Promise((r) => (this._resolve = r)); }
  _close(v) {
    if (!this.modal) return;
    $(this.modal).classList.add("hidden");
    this.modal = null;
    const r = this._resolve; this._resolve = null; r && r(v);
  }
  _closeAll() { for (const id of ["howto", "over", "menu"]) $(id).classList.add("hidden"); if (this._resolve) { const r = this._resolve; this._resolve = null; this.modal = null; r(null); } }
  cancelModal(v = null) { this._close(v); }

  howTo(def, best) {
    $("htEmoji").textContent = def.emoji;
    $("htTitle").textContent = def.title;
    $("htDesc").textContent = def.desc;
    $("htList").innerHTML = def.howto.map(([e, t]) => `<li><em>${e}</em><span>${t}</span></li>`).join("");
    $("htBest").textContent = best ? `Your best: ${best}` : "";
    return this._open("howto");
  }
  gameOver(res) {
    $("ovTitle").textContent = res.title || "Game over";
    $("ovSub").textContent = res.subtitle || "";
    $("ovLabel").textContent = res.label || "SCORE";
    $("ovScore").textContent = res.scoreText ?? res.score ?? 0;
    const best = $("ovBest");
    best.className = "ov-best" + (res.isBest ? " new" : "");
    best.textContent = res.isBest ? "★ NEW BEST ★" : res.best != null ? `Best: ${res.best}` : "";
    $("ovStats").innerHTML = (res.stats || []).map(([k, v]) => `<span>${k} <b>${v}</b></span>`).join("");
    if (res.isBest) sfx.good();
    return this._open("over");
  }
  openMenu(games, bests, onPick) {
    const grid = $("menuGrid");
    grid.innerHTML = "";
    for (const g of games) {
      const b = document.createElement("button");
      b.className = "game-card"; b.dataset.hand = "dwell"; b.style.setProperty("--c", g.color);
      b.innerHTML = `<em>${g.emoji}</em><b>${g.title}</b><small>${bests[g.id] ? "Best " + bests[g.id] : g.short}</small>`;
      b.onclick = () => { this._close("pick"); onPick(g); };
      grid.appendChild(b);
    }
    $("menuClose").onclick = () => this._close("close");
    return this._open("menu");
  }

  // ---------------------------------------------------------------- camera preview
  togglePip(on = !this._pip, remember = true) {
    this._pip = on && this.input.cameraOn;
    if (remember) this.pipPref = this._pip;
    $("pip").classList.toggle("hidden", !this._pip);
  }
  _drawPip() {
    const cv = $("pipCanvas"), g = this.pipCtx;
    const w = cv.clientWidth, h = cv.clientHeight;
    if (cv.width !== w) { cv.width = w; cv.height = h; }
    g.clearRect(0, 0, w, h);
    const vw = this.input.video.videoWidth || 1280, vh = this.input.video.videoHeight || 720;
    const s = Math.max(w / vw, h / vh), dw = vw * s, dh = vh * s, ox = (w - dw) / 2, oy = (h - dh) / 2;
    for (const hand of this.input.hands) {
      if (!hand.lm) continue;
      const P = hand.lm.map((p) => [ox + (1 - p.x) * dw, oy + p.y * dh]);
      g.strokeStyle = hand.pinch ? "#ff3df2" : "#2ef2ff"; g.lineWidth = 2;
      g.beginPath();
      for (const [a, b] of BONES) { g.moveTo(...P[a]); g.lineTo(...P[b]); }
      g.stroke();
      g.fillStyle = "#fff";
      for (const p of P) { g.beginPath(); g.arc(p[0], p[1], 2, 0, Math.PI * 2); g.fill(); }
    }
  }
}
