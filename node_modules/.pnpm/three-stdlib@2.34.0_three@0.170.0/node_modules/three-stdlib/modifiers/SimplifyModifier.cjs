"use strict";
var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => {
  __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const THREE = require("three");
const BufferGeometryUtils = require("../utils/BufferGeometryUtils.cjs");
const cb = new THREE.Vector3();
const ab = new THREE.Vector3();
function pushIfUnique(array, object) {
  if (array.indexOf(object) === -1)
    array.push(object);
}
function removeFromArray(array, object) {
  const k = array.indexOf(object);
  if (k > -1)
    array.splice(k, 1);
}
class Vertex {
  constructor(v, id) {
    __publicField(this, "position");
    __publicField(this, "id");
    __publicField(this, "faces");
    __publicField(this, "neighbors");
    __publicField(this, "collapseCost");
    __publicField(this, "collapseNeighbor");
    __publicField(this, "minCost", 0);
    __publicField(this, "totalCost", 0);
    __publicField(this, "costCount", 0);
    this.position = v;
    this.id = id;
    this.faces = [];
    this.neighbors = [];
    this.collapseCost = 0;
    this.collapseNeighbor = null;
  }
  addUniqueNeighbor(vertex) {
    pushIfUnique(this.neighbors, vertex);
  }
  removeIfNonNeighbor(n) {
    const neighbors = this.neighbors;
    const faces = this.faces;
    const offset = neighbors.indexOf(n);
    if (offset === -1)
      return;
    for (let i = 0; i < faces.length; i++) {
      if (faces[i].hasVertex(n))
        return;
    }
    neighbors.splice(offset, 1);
  }
}
class Triangle {
  constructor(v1, v2, v3, a, b, c) {
    __publicField(this, "a");
    __publicField(this, "b");
    __publicField(this, "c");
    __publicField(this, "v1");
    __publicField(this, "v2");
    __publicField(this, "v3");
    __publicField(this, "normal", new THREE.Vector3());
    this.a = a;
    this.b = b;
    this.c = c;
    this.v1 = v1;
    this.v2 = v2;
    this.v3 = v3;
    this.computeNormal();
    v1.faces.push(this);
    v1.addUniqueNeighbor(v2);
    v1.addUniqueNeighbor(v3);
    v2.faces.push(this);
    v2.addUniqueNeighbor(v1);
    v2.addUniqueNeighbor(v3);
    v3.faces.push(this);
    v3.addUniqueNeighbor(v1);
    v3.addUniqueNeighbor(v2);
  }
  computeNormal() {
    const vA = this.v1.position;
    const vB = this.v2.position;
    const vC = this.v3.position;
    cb.subVectors(vC, vB);
    ab.subVectors(vA, vB);
    cb.cross(ab).normalize();
    this.normal.copy(cb);
  }
  hasVertex(v) {
    return v === this.v1 || v === this.v2 || v === this.v3;
  }
  replaceVertex(oldv, newv) {
    if (oldv === this.v1)
      this.v1 = newv;
    else if (oldv === this.v2)
      this.v2 = newv;
    else if (oldv === this.v3)
      this.v3 = newv;
    removeFromArray(oldv.faces, this);
    newv.faces.push(this);
    oldv.removeIfNonNeighbor(this.v1);
    this.v1.removeIfNonNeighbor(oldv);
    oldv.removeIfNonNeighbor(this.v2);
    this.v2.removeIfNonNeighbor(oldv);
    oldv.removeIfNonNeighbor(this.v3);
    this.v3.removeIfNonNeighbor(oldv);
    this.v1.addUniqueNeighbor(this.v2);
    this.v1.addUniqueNeighbor(this.v3);
    this.v2.addUniqueNeighbor(this.v1);
    this.v2.addUniqueNeighbor(this.v3);
    this.v3.addUniqueNeighbor(this.v1);
    this.v3.addUniqueNeighbor(this.v2);
    this.computeNormal();
  }
}
class SimplifyModifier {
  constructor() {
    __publicField(this, "computeEdgeCollapseCost", (u, v) => {
      const edgelength = v.position.distanceTo(u.position);
      let curvature = 0;
      const sideFaces = [];
      let i, il = u.faces.length, face, sideFace;
      for (i = 0; i < il; i++) {
        face = u.faces[i];
        if (face.hasVertex(v)) {
          sideFaces.push(face);
        }
      }
      for (i = 0; i < il; i++) {
        let minCurvature = 1;
        face = u.faces[i];
        for (let j = 0; j < sideFaces.length; j++) {
          sideFace = sideFaces[j];
          const dotProd = face.normal.dot(sideFace.normal);
          minCurvature = Math.min(minCurvature, (1.001 - dotProd) / 2);
        }
        curvature = Math.max(curvature, minCurvature);
      }
      const borders = 0;
      if (sideFaces.length < 2) {
        curvature = 1;
      }
      const amt = edgelength * curvature + borders;
      return amt;
    });
    __publicField(this, "computeEdgeCostAtVertex", (v) => {
      if (v.neighbors.length === 0) {
        v.collapseNeighbor = null;
        v.collapseCost = -0.01;
        return;
      }
      v.collapseCost = 1e5;
      v.collapseNeighbor = null;
      for (let i = 0; i < v.neighbors.length; i++) {
        const collapseCost = this.computeEdgeCollapseCost(v, v.neighbors[i]);
        if (!v.collapseNeighbor) {
          v.collapseNeighbor = v.neighbors[i];
          v.collapseCost = collapseCost;
          v.minCost = collapseCost;
          v.totalCost = 0;
          v.costCount = 0;
        }
        v.costCount++;
        v.totalCost += collapseCost;
        if (collapseCost < v.minCost) {
          v.collapseNeighbor = v.neighbors[i];
          v.minCost = collapseCost;
        }
      }
      v.collapseCost = v.totalCost / v.costCount;
    });
    __publicField(this, "removeFace", (f, faces) => {
      removeFromArray(faces, f);
      if (f.v1)
        removeFromArray(f.v1.faces, f);
      if (f.v2)
        removeFromArray(f.v2.faces, f);
      if (f.v3)
        removeFromArray(f.v3.faces, f);
      const vs = [f.v1, f.v2, f.v3];
      let v1, v2;
      for (let i = 0; i < 3; i++) {
        v1 = vs[i];
        v2 = vs[(i + 1) % 3];
        if (!v1 || !v2)
          continue;
        v1.removeIfNonNeighbor(v2);
        v2.removeIfNonNeighbor(v1);
      }
    });
    __publicField(this, "collapse", (vertices, faces, u, v) => {
      if (!v) {
        this.removeVertex(u, vertices);
        return;
      }
      let i;
      const tmpVertices = [];
      for (i = 0; i < u.neighbors.length; i++) {
        tmpVertices.push(u.neighbors[i]);
      }
      for (i = u.faces.length - 1; i >= 0; i--) {
        if (u.faces[i].hasVertex(v)) {
          this.removeFace(u.faces[i], faces);
        }
      }
      for (i = u.faces.length - 1; i >= 0; i--) {
        u.faces[i].replaceVertex(u, v);
      }
      this.removeVertex(u, vertices);
      for (i = 0; i < tmpVertices.length; i++) {
        this.computeEdgeCostAtVertex(tmpVertices[i]);
      }
    });
    __publicField(this, "minimumCostEdge", (vertices) => {
      let least = vertices[0];
      for (let i = 0; i < vertices.length; i++) {
        if (vertices[i].collapseCost < least.collapseCost) {
          least = vertices[i];
        }
      }
      return least;
    });
    __publicField(this, "modify", (geometry, count) => {
      geometry = geometry.clone();
      const attributes = geometry.attributes;
      for (let name in attributes) {
        if (name !== "position")
          geometry.deleteAttribute(name);
      }
      geometry = BufferGeometryUtils.mergeVertices(geometry);
      const vertices = [];
      const faces = [];
      const positionAttribute = geometry.getAttribute("position");
      for (let i = 0; i < positionAttribute.count; i++) {
        const v = new THREE.Vector3().fromBufferAttribute(positionAttribute, i);
        const vertex = new Vertex(v, i);
        vertices.push(vertex);
      }
      const geomIndex = geometry.getIndex();
      if (geomIndex !== null) {
        for (let i = 0; i < geomIndex.count; i += 3) {
          const a = geomIndex.getX(i);
          const b = geomIndex.getX(i + 1);
          const c = geomIndex.getX(i + 2);
          const triangle = new Triangle(vertices[a], vertices[b], vertices[c], a, b, c);
          faces.push(triangle);
        }
      } else {
        for (let i = 0; i < positionAttribute.count; i += 3) {
          const a = i;
          const b = i + 1;
          const c = i + 2;
          const triangle = new Triangle(vertices[a], vertices[b], vertices[c], a, b, c);
          faces.push(triangle);
        }
      }
      for (let i = 0, il = vertices.length; i < il; i++) {
        this.computeEdgeCostAtVertex(vertices[i]);
      }
      let nextVertex;
      let z = count;
      while (z--) {
        nextVertex = this.minimumCostEdge(vertices);
        if (!nextVertex) {
          console.log("THREE.SimplifyModifier: No next vertex");
          break;
        } else {
          this.collapse(vertices, faces, nextVertex, nextVertex.collapseNeighbor);
        }
      }
      const simplifiedGeometry = new THREE.BufferGeometry();
      const position = [];
      let index = [];
      for (let i = 0; i < vertices.length; i++) {
        const vertex = vertices[i].position;
        position.push(vertex.x, vertex.y, vertex.z);
      }
      for (let i = 0; i < faces.length; i++) {
        const face = faces[i];
        const a = vertices.indexOf(face.v1);
        const b = vertices.indexOf(face.v2);
        const c = vertices.indexOf(face.v3);
        index.push(a, b, c);
      }
      simplifiedGeometry.setAttribute("position", new THREE.Float32BufferAttribute(position, 3));
      simplifiedGeometry.setIndex(index);
      return simplifiedGeometry;
    });
  }
  removeVertex(v, vertices) {
    console.assert(v.faces.length === 0);
    while (v.neighbors.length) {
      const n = v.neighbors.pop();
      removeFromArray(n.neighbors, v);
    }
    removeFromArray(vertices, v);
  }
}
exports.SimplifyModifier = SimplifyModifier;
//# sourceMappingURL=SimplifyModifier.cjs.map
