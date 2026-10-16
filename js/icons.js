// Small procedural 3D models shown above each game station in the room (about 0.6 units tall).
import * as THREE from "three";

const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.1, ...o });
const glow = (color, i = 1.2) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: i, roughness: 0.4 });

export function lathe(points, seg = 32) {
  return new THREE.LatheGeometry(points.map(([x, y]) => new THREE.Vector2(x, y)), seg);
}
export const PIECE_PROFILES = {
  p: [[0, 0], [0.32, 0], [0.32, 0.06], [0.22, 0.12], [0.12, 0.42], [0.18, 0.47], [0.1, 0.52], [0.17, 0.62], [0.16, 0.72], [0.08, 0.79], [0, 0.8]],
  r: [[0, 0], [0.36, 0], [0.36, 0.08], [0.26, 0.14], [0.2, 0.7], [0.29, 0.76], [0.29, 0.98], [0, 0.98]],
  b: [[0, 0], [0.34, 0], [0.34, 0.07], [0.22, 0.14], [0.13, 0.6], [0.22, 0.66], [0.13, 0.72], [0.19, 0.9], [0.12, 1.04], [0.05, 1.1], [0.06, 1.14], [0, 1.18]],
  q: [[0, 0], [0.38, 0], [0.38, 0.08], [0.26, 0.15], [0.14, 0.78], [0.26, 0.84], [0.16, 0.9], [0.27, 1.16], [0.2, 1.2], [0.08, 1.26], [0.06, 1.32], [0, 1.34]],
  k: [[0, 0], [0.38, 0], [0.38, 0.08], [0.26, 0.15], [0.15, 0.82], [0.27, 0.88], [0.17, 0.94], [0.25, 1.18], [0.12, 1.24], [0, 1.24]],
  n: [[0, 0], [0.34, 0], [0.34, 0.08], [0.24, 0.14], [0.2, 0.3], [0, 0.3]],
};

/** Chess piece mesh (used by the chess game and the room icon). */
export function chessPiece(type, mat) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(lathe(PIECE_PROFILES[type]), mat));
  if (type === "k") {
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.3, 0.07).translate(0, 1.36, 0), mat));
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.07, 0.07).translate(0, 1.4, 0), mat));
  }
  if (type === "q") {
    for (let i = 0; i < 8; i++) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), mat);
      const a = (i / 8) * Math.PI * 2; s.position.set(Math.cos(a) * 0.24, 1.2, Math.sin(a) * 0.24); g.add(s);
    }
  }
  if (type === "r") {
    for (let i = 0; i < 6; i++) {
      const s = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.12, 0.11), mat);
      const a = (i / 6) * Math.PI * 2; s.position.set(Math.cos(a) * 0.22, 1.03, Math.sin(a) * 0.22); s.rotation.y = -a; g.add(s);
    }
  }
  if (type === "n") {
    const sh = new THREE.Shape();
    sh.moveTo(-0.2, 0); sh.lineTo(0.22, 0); sh.lineTo(0.2, 0.35); sh.quadraticCurveTo(0.18, 0.62, 0.02, 0.8);
    sh.lineTo(-0.06, 0.92); sh.lineTo(-0.1, 0.78); sh.quadraticCurveTo(-0.3, 0.72, -0.36, 0.56);
    sh.lineTo(-0.3, 0.48); sh.quadraticCurveTo(-0.16, 0.5, -0.08, 0.46); sh.quadraticCurveTo(-0.22, 0.3, -0.2, 0);
    const head = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.2, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04, bevelSegments: 3 }).translate(0, 0.26, -0.1), mat);
    g.add(head);
  }
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

export function soccerBallMaterial() {
  const c = document.createElement("canvas"); c.width = 512; c.height = 256;
  const g = c.getContext("2d"); g.fillStyle = "#fafafa"; g.fillRect(0, 0, 512, 256);
  g.fillStyle = "#111";
  const spots = [[64, 64], [192, 64], [320, 64], [448, 64], [0, 190], [128, 190], [256, 190], [384, 190], [512, 190], [128, 0], [384, 0], [256, 256]];
  for (const [x, y] of spots) {
    g.beginPath();
    for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2 - Math.PI / 2; g.lineTo(x + Math.cos(a) * 30, y + Math.sin(a) * 30); }
    g.closePath(); g.fill();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshStandardMaterial({ map: t, roughness: 0.45 });
}

export function ghostMesh(color = 0xeef4ff, opacity = 0.9) {
  const g = new THREE.Group();
  const pts = [];
  for (let i = 0; i <= 12; i++) { const a = (i / 12) * Math.PI / 2; pts.push(new THREE.Vector2(Math.sin(a) * 0.5, 0.5 + Math.cos(a) * 0.5)); }
  pts.push(new THREE.Vector2(0.52, 0.0), new THREE.Vector2(0.56, -0.5));
  const body = new THREE.Mesh(new THREE.LatheGeometry(pts, 32), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.35, transparent: true, opacity, roughness: 0.8, side: THREE.DoubleSide }));
  body.name = "body";
  g.add(body);
  const eyeM = new THREE.MeshBasicMaterial({ color: 0x120018 });
  for (const x of [-0.17, 0.17]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.085, 16, 12), eyeM); e.scale.set(1, 1.4, 0.5); e.position.set(x, 0.62, 0.45); g.add(e);
  }
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 12), eyeM); m.scale.set(1.3, 1.6, 0.5); m.position.set(0, 0.38, 0.48); g.add(m);
  return g;
}

export function makeIcon(id) {
  const g = new THREE.Group();
  switch (id) {
    case "pop": {
      const cols = [0xff3d6e, 0xffd23f, 0x2ef2ff, 0xb6ff3d, 0xff3df2, 0x8a7dff];
      cols.forEach((c, i) => {
        const s = new THREE.Mesh(new THREE.SphereGeometry(0.12 + (i % 3) * 0.03, 24, 16), std(c, { roughness: 0.1, metalness: 0.2, emissive: c, emissiveIntensity: 0.25 }));
        const a = (i / cols.length) * Math.PI * 2; s.position.set(Math.cos(a) * 0.2, Math.sin(a * 2) * 0.12, Math.sin(a) * 0.2); g.add(s);
      });
      break;
    }
    case "paint": {
      const curve = new THREE.CatmullRomCurve3([[-0.3, -0.2, 0], [-0.1, 0.2, 0.1], [0.1, -0.1, -0.1], [0.3, 0.25, 0]].map((p) => new THREE.Vector3(...p)));
      g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 60, 0.04, 10), glow(0xff3df2, 1.6)));
      const c2 = new THREE.CatmullRomCurve3([[-0.25, 0.25, -0.1], [0, -0.25, 0.1], [0.28, 0.0, 0.05]].map((p) => new THREE.Vector3(...p)));
      g.add(new THREE.Mesh(new THREE.TubeGeometry(c2, 60, 0.035, 10), glow(0x2ef2ff, 1.6)));
      const brush = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 0.45, 12), std(0xffc83d));
      brush.position.set(0.3, 0.1, 0.15); brush.rotation.z = -0.8; g.add(brush);
      break;
    }
    case "cricket": {
      const bat = new THREE.Group();
      bat.add(new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.5, 0.05), std(0xe8c88a)));
      const h = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.25, 10), std(0x222222)); h.position.y = 0.37; bat.add(h);
      bat.rotation.z = 0.5; bat.position.x = -0.08; g.add(bat);
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.08, 20, 14), std(0xc81e2a, { roughness: 0.3 })); ball.position.set(0.22, 0.12, 0.05); g.add(ball);
      for (let i = -1; i <= 1; i++) { const st = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.45, 8), std(0xf3e6c8)); st.position.set(0.2 + i * 0.06, -0.15, -0.15); g.add(st); }
      break;
    }
    case "football": {
      g.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.26, 3), soccerBallMaterial()));
      break;
    }
    case "ghost": {
      const gh = ghostMesh(0xdfe8ff, 0.85); gh.scale.setScalar(0.5); gh.position.y = -0.1; g.add(gh);
      break;
    }
    case "shooting": {
      const cols = [0xff3d6e, 0xffffff, 0xff3d6e, 0xffffff, 0xffd23f];
      cols.forEach((c, i) => {
        const r = 0.32 - i * 0.065;
        const d = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.04 + i * 0.01, 40), std(c, { emissive: c, emissiveIntensity: i === 4 ? 1 : 0.15 }));
        d.rotation.x = Math.PI / 2; g.add(d);
      });
      break;
    }
    case "runner": {
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.2, 6, 12), glow(0x2ef2ff, 0.5)); body.position.y = 0.05; body.rotation.z = -0.3; g.add(body);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.08, 16, 12), std(0xffffff)); head.position.set(0.08, 0.27, 0); g.add(head);
      for (let i = 0; i < 3; i++) { const a = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.14, 3), glow(0xb6ff3d, 1.4)); a.rotation.z = -Math.PI / 2; a.position.set(-0.2 - i * 0.12, 0.0, 0); g.add(a); }
      break;
    }
    case "chess": {
      const k = chessPiece("k", std(0xf4eadc, { roughness: 0.25 })); k.scale.setScalar(0.42); k.position.set(-0.1, -0.3, 0); g.add(k);
      const n = chessPiece("n", std(0x1c1a24, { roughness: 0.2, metalness: 0.3 })); n.scale.setScalar(0.42); n.position.set(0.17, -0.3, 0.05); g.add(n);
      break;
    }
    case "carrom": {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.04, 0.56), std(0xf0d6a8)); b.rotation.x = 0.5; g.add(b);
      const frame = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.05, 0.64), std(0x5a2d12)); frame.position.y = -0.02; b.add(frame);
      const cols = [0xffffff, 0x222222, 0xff2244, 0xffffff, 0x222222];
      cols.forEach((c, i) => { const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.025, 20), std(c)); coin.position.set(Math.cos(i) * 0.1, 0.035, Math.sin(i) * 0.1); b.add(coin); });
      break;
    }
    case "bowling": {
      const pinProfile = [[0, 0], [0.05, 0], [0.08, 0.1], [0.09, 0.2], [0.05, 0.33], [0.045, 0.38], [0.06, 0.44], [0.04, 0.5], [0, 0.52]];
      const pinM = std(0xffffff, { roughness: 0.2 });
      for (let i = 0; i < 3; i++) {
        const p = new THREE.Mesh(lathe(pinProfile, 20), pinM); p.position.set(-0.05 + i * 0.12, -0.3, -0.05 - (i % 2) * 0.08); g.add(p);
        const s = new THREE.Mesh(new THREE.TorusGeometry(0.048, 0.01, 6, 20), std(0xff3d6e)); s.rotation.x = Math.PI / 2; s.position.set(p.position.x, 0.05, p.position.z); g.add(s);
      }
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.16, 24, 16), std(0x6a3dff, { roughness: 0.1, metalness: 0.3 })); ball.position.set(-0.2, -0.14, 0.15); g.add(ball);
      break;
    }
  }
  return g;
}
