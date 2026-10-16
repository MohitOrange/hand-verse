// Renders the tracked hands as glowing 3D skeletons inside the scene, lined up with the camera view.
import * as THREE from "three";
import { BONES } from "./hands.js";
import { glowSprite } from "./util.js";

const UP = new THREE.Vector3(0, 1, 0);
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _d = new THREE.Vector3();
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3();
const _ndc = new THREE.Vector3();

export class Hands3D {
  constructor(scene, { color = 0x5ff0ff, opacity = 0.85, near = 0.55, far = 1.25 } = {}) {
    this.near = near; this.far = far;
    const mat = new THREE.MeshStandardMaterial({
      color, emissive: color, emissiveIntensity: 0.9, roughness: 0.25, metalness: 0.2,
      transparent: true, opacity, depthWrite: false,
    });
    this.mat = mat;
    this.joints = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 12, 8), mat, 42);
    this.bones = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 1, 8, 1).translate(0, 0.5, 0), mat, BONES.length * 2);
    for (const m of [this.joints, this.bones]) { m.frustumCulled = false; m.count = 0; m.renderOrder = 10; scene.add(m); }
    this.tips = [glowSprite(color, 0.06, 0.95), glowSprite(color, 0.06, 0.95)];
    for (const t of this.tips) { t.visible = false; t.renderOrder = 11; scene.add(t); }
    this.world = [[], []]; // world-space joint positions per hand slot
    this.visible = true;
  }

  setColor(c) { this.mat.color.set(c); this.mat.emissive.set(c); for (const t of this.tips) t.material.color.set(c); }

  /** Distance from camera for a hand of normalised depth 0..1 */
  dist(depth) { return this.far + (this.near - this.far) * depth; }

  update(input, camera) {
    let jc = 0, bc = 0, slot = 0;
    for (const t of this.tips) t.visible = false;
    if (!this.visible) { this.joints.count = this.bones.count = 0; return; }
    const tanF = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    for (const h of input.hands) {
      if (!h.lm || slot > 1) continue;
      const D = this.dist(h.depth);
      const worldH = 2 * D * tanF;
      const palmWorld = h.size * worldH;
      const jr = palmWorld * 0.085, br = palmWorld * 0.045;
      const W = this.world[slot]; W.length = 21;
      for (let i = 0; i < 21; i++) {
        const p = h.pts[i];
        _ndc.set((p.x / innerWidth) * 2 - 1, -(p.y / innerHeight) * 2 + 1, 0.5).unproject(camera);
        _d.copy(_ndc).sub(camera.position).normalize();
        const di = D * (1 + (h.lm[i].z || 0) * 1.6);
        W[i] = (W[i] || new THREE.Vector3()).copy(camera.position).addScaledVector(_d, di);
        const r = i % 4 === 0 && i ? jr * 1.15 : jr;
        _m.compose(W[i], _q.identity(), _s.set(r, r, r));
        this.joints.setMatrixAt(jc++, _m);
      }
      for (const [a, b] of BONES) {
        _a.copy(W[a]); _b.copy(W[b]);
        _d.subVectors(_b, _a); const len = _d.length();
        _q.setFromUnitVectors(UP, _d.normalize());
        _m.compose(_a, _q, _s.set(br, len, br));
        this.bones.setMatrixAt(bc++, _m);
      }
      this.tips[slot].visible = true;
      this.tips[slot].position.copy(W[8]);
      this.tips[slot].scale.setScalar(jr * 7);
      slot++;
    }
    this.joints.count = jc; this.bones.count = bc;
    this.joints.instanceMatrix.needsUpdate = true; this.bones.instanceMatrix.needsUpdate = true;
  }
}
