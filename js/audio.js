// Synthesised sound effects + a little ambient music. No audio files.
let ctx = null, master = null;
let muted = false;
try { muted = localStorage.getItem("hv_muted") === "1"; } catch {}

export function unlockAudio() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = muted ? 0 : 0.8; master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") ctx.resume();
}
export function setMuted(m) {
  muted = m;
  try { localStorage.setItem("hv_muted", m ? "1" : "0"); } catch {}
  if (master) master.gain.value = m ? 0 : 0.8;
}
export const isMuted = () => muted;

function noise(dur, { freq = 2000, q = 1, gain = 0.3, type = "bandpass", attack = 0.002, sweep = 0 } = {}) {
  if (!ctx) return;
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource(); src.buffer = buf;
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(40, freq + sweep), ctx.currentTime + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(gain, ctx.currentTime + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
  src.connect(f).connect(g).connect(master);
  src.start();
}

function tone(freq, dur, { type = "sine", gain = 0.2, slide = 0, attack = 0.005, delay = 0 } = {}) {
  if (!ctx) return;
  const t0 = ctx.currentTime + delay;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(master);
  o.start(t0); o.stop(t0 + dur + 0.05);
}

const r = (a, b) => a + Math.random() * (b - a);

export const sfx = {
  click() { tone(880, 0.06, { type: "triangle", gain: 0.12 }); tone(1320, 0.05, { type: "sine", gain: 0.06, delay: 0.03 }); },
  hover() { tone(1400, 0.03, { gain: 0.03 }); },
  tick() { tone(1000, 0.03, { gain: 0.035 }); },
  whoosh() { noise(0.35, { freq: 600, q: 0.8, gain: 0.25, sweep: 2400, attack: 0.08 }); },
  pop(pitch = 1) { tone(520 * pitch, 0.12, { type: "sine", gain: 0.25, slide: 700 * pitch }); noise(0.07, { freq: 3000, gain: 0.15 }); },
  coin() { tone(988, 0.08, { type: "square", gain: 0.06 }); tone(1319, 0.18, { type: "square", gain: 0.06, delay: 0.07 }); },
  good() { [0, 4, 7, 12].forEach((s, i) => tone(523 * 2 ** (s / 12), 0.16, { type: "triangle", gain: 0.1, delay: i * 0.07 })); },
  bad() { tone(260, 0.3, { type: "sawtooth", gain: 0.08, slide: -150 }); },
  hit() { noise(0.12, { freq: 1800, q: 1.5, gain: 0.5 }); tone(180, 0.15, { type: "sine", gain: 0.3, slide: -80 }); },
  bat() { noise(0.09, { freq: 2600, q: 3, gain: 0.6 }); tone(660, 0.08, { type: "triangle", gain: 0.25 }); },
  kick() { tone(150, 0.18, { gain: 0.5, slide: -90 }); noise(0.06, { freq: 900, gain: 0.3 }); },
  thud() { tone(90, 0.2, { gain: 0.4, slide: -40 }); },
  shoot() { noise(0.18, { freq: 1500, q: 0.6, gain: 0.5, sweep: -1200 }); tone(1800, 0.12, { type: "square", gain: 0.06, slide: -1500 }); },
  laser() { tone(1600, 0.18, { type: "sawtooth", gain: 0.07, slide: -1300 }); },
  empty() { tone(300, 0.05, { type: "square", gain: 0.06 }); },
  reload() { noise(0.05, { freq: 2500, gain: 0.2 }); tone(500, 0.05, { type: "square", gain: 0.05, delay: 0.12 }); noise(0.05, { freq: 3000, gain: 0.2, attack: 0.002 }); },
  glass() { for (let i = 0; i < 5; i++) tone(r(2500, 5000), r(0.1, 0.35), { type: "sine", gain: 0.05, delay: i * 0.02 }); noise(0.2, { freq: 5000, gain: 0.2 }); },
  boom() { noise(1.0, { freq: 200, q: 0.5, gain: 0.8, type: "lowpass", sweep: -150 }); tone(70, 0.7, { gain: 0.5, slide: -40 }); },
  crash() { noise(0.5, { freq: 1200, q: 0.4, gain: 0.5, sweep: -800 }); for (let i = 0; i < 6; i++) tone(r(300, 900), 0.15, { type: "triangle", gain: 0.08, delay: r(0, 0.25) }); },
  roll() { noise(1.6, { freq: 160, q: 1, gain: 0.25, type: "lowpass", attack: 0.2 }); },
  clack() { tone(r(1800, 2400), 0.04, { type: "triangle", gain: 0.12 }); noise(0.03, { freq: 4000, gain: 0.08 }); },
  jump() { tone(300, 0.2, { type: "square", gain: 0.06, slide: 500 }); },
  slide() { noise(0.3, { freq: 900, gain: 0.15, sweep: -600 }); },
  ghost() { tone(r(180, 260), 1.2, { type: "sine", gain: 0.12, slide: r(-80, 80), attack: 0.3 }); tone(r(300, 360), 1.0, { type: "triangle", gain: 0.04, attack: 0.3 }); },
  zap() { tone(r(900, 1300), 0.25, { type: "sawtooth", gain: 0.05, slide: -600 }); noise(0.2, { freq: 6000, gain: 0.08 }); },
  vanish() { tone(400, 0.6, { type: "sine", gain: 0.15, slide: 1600 }); noise(0.5, { freq: 3000, gain: 0.12, sweep: 4000 }); },
  scare() { noise(0.9, { freq: 1200, q: 0.3, gain: 0.9, attack: 0.01 }); tone(220, 0.8, { type: "sawtooth", gain: 0.3, slide: 600 }); tone(233, 0.8, { type: "sawtooth", gain: 0.3, slide: 620 }); },
  thunder() { noise(2.2, { freq: 120, q: 0.4, gain: 0.7, type: "lowpass", attack: 0.05, sweep: -60 }); },
  cheer() { noise(1.6, { freq: 1500, q: 0.3, gain: 0.25, attack: 0.15 }); [0, 4, 7].forEach((s, i) => tone(392 * 2 ** (s / 12), 0.4, { type: "triangle", gain: 0.06, delay: 0.1 + i * 0.1 })); },
  whistle() { tone(2300, 0.25, { type: "sine", gain: 0.12 }); tone(2350, 0.4, { type: "sine", gain: 0.1, delay: 0.3 }); },
  paint() { noise(0.05, { freq: r(1500, 3000), gain: 0.02 }); },
  move() { tone(520, 0.05, { type: "triangle", gain: 0.08 }); noise(0.05, { freq: 1200, gain: 0.08 }); },
};

// ---------------------------------------------------------------- ambient loops
let loop = null;
export function startAmbient(kind = "room") {
  if (!ctx) return;
  stopAmbient();
  const out = ctx.createGain(); out.gain.value = 0; out.connect(master);
  out.gain.linearRampToValueAtTime(kind === "ghost" ? 0.5 : 0.25, ctx.currentTime + 2);
  const nodes = [];
  if (kind === "ghost") {
    for (const f of [55, 58.3, 82.4]) {
      const o = ctx.createOscillator(); o.type = "sine"; o.frequency.value = f;
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07 + Math.random() * 0.1;
      const lg = ctx.createGain(); lg.gain.value = 3; lfo.connect(lg).connect(o.frequency);
      const g = ctx.createGain(); g.gain.value = 0.18; o.connect(g).connect(out);
      o.start(); lfo.start(); nodes.push(o, lfo);
    }
    loop = { out, nodes, timer: null };
    return;
  }
  // gentle arpeggio pad for the room
  const scale = [0, 3, 7, 10, 12, 15, 19];
  const root = 220;
  const pad = ctx.createOscillator(); pad.type = "triangle"; pad.frequency.value = root / 2;
  const pg = ctx.createGain(); pg.gain.value = 0.05; pad.connect(pg).connect(out); pad.start(); nodes.push(pad);
  let step = 0;
  const timer = setInterval(() => {
    if (!ctx) return;
    const s = scale[(step * 3 + (step >> 3)) % scale.length];
    const t = ctx.currentTime;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = "sine"; o.frequency.value = root * 2 ** (s / 12);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.12, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
    o.connect(g).connect(out); o.start(t); o.stop(t + 1);
    step++;
  }, 300);
  loop = { out, nodes, timer };
}
export function stopAmbient() {
  if (!loop || !ctx) return;
  const l = loop; loop = null;
  clearInterval(l.timer);
  l.out.gain.cancelScheduledValues(ctx.currentTime);
  l.out.gain.setValueAtTime(l.out.gain.value, ctx.currentTime);
  l.out.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.6);
  setTimeout(() => { l.nodes.forEach((n) => { try { n.stop(); } catch {} }); l.out.disconnect(); }, 800);
}
export const ambientOn = () => !!loop;
