"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const THREE = require("three");
const ConvexHull = require("../math/ConvexHull.cjs");
class ConvexGeometry extends THREE.BufferGeometry {
  constructor(points = []) {
    super();
    const vertices = [];
    const normals = [];
    const convexHull = new ConvexHull.ConvexHull().setFromPoints(points);
    const faces = convexHull.faces;
    for (let i = 0; i < faces.length; i++) {
      const face = faces[i];
      let edge = face.edge;
      do {
        const point = edge.head().point;
        vertices.push(point.x, point.y, point.z);
        normals.push(face.normal.x, face.normal.y, face.normal.z);
        edge = edge.next;
      } while (edge !== face.edge);
    }
    this.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    this.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  }
}
exports.ConvexGeometry = ConvexGeometry;
//# sourceMappingURL=ConvexGeometry.cjs.map
