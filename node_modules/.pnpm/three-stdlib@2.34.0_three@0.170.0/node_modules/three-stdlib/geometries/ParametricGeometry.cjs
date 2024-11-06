"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const THREE = require("three");
class ParametricGeometry extends THREE.BufferGeometry {
  constructor(func = (u, v, target) => target.set(u, v, Math.cos(u) * Math.sin(v)), slices = 8, stacks = 8) {
    super();
    this.type = "ParametricGeometry";
    this.parameters = {
      func,
      slices,
      stacks
    };
    const indices = [];
    const vertices = [];
    const normals = [];
    const uvs = [];
    const EPS = 1e-5;
    const normal = new THREE.Vector3();
    const p0 = new THREE.Vector3(), p1 = new THREE.Vector3();
    const pu = new THREE.Vector3(), pv = new THREE.Vector3();
    const sliceCount = slices + 1;
    for (let i = 0; i <= stacks; i++) {
      const v = i / stacks;
      for (let j = 0; j <= slices; j++) {
        const u = j / slices;
        func(u, v, p0);
        vertices.push(p0.x, p0.y, p0.z);
        if (u - EPS >= 0) {
          func(u - EPS, v, p1);
          pu.subVectors(p0, p1);
        } else {
          func(u + EPS, v, p1);
          pu.subVectors(p1, p0);
        }
        if (v - EPS >= 0) {
          func(u, v - EPS, p1);
          pv.subVectors(p0, p1);
        } else {
          func(u, v + EPS, p1);
          pv.subVectors(p1, p0);
        }
        normal.crossVectors(pu, pv).normalize();
        normals.push(normal.x, normal.y, normal.z);
        uvs.push(u, v);
      }
    }
    for (let i = 0; i < stacks; i++) {
      for (let j = 0; j < slices; j++) {
        const a = i * sliceCount + j;
        const b = i * sliceCount + j + 1;
        const c = (i + 1) * sliceCount + j + 1;
        const d = (i + 1) * sliceCount + j;
        indices.push(a, b, d);
        indices.push(b, c, d);
      }
    }
    this.setIndex(indices);
    this.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    this.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
    this.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  }
}
exports.ParametricGeometry = ParametricGeometry;
//# sourceMappingURL=ParametricGeometry.cjs.map
