"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const THREE = require("three");
const tempNormal = new THREE.Vector3();
function getUv(faceDirVector, normal, uvAxis, projectionAxis, radius, sideLength) {
  const totArcLength = 2 * Math.PI * radius / 4;
  const centerLength = Math.max(sideLength - 2 * radius, 0);
  const halfArc = Math.PI / 4;
  tempNormal.copy(normal);
  tempNormal[projectionAxis] = 0;
  tempNormal.normalize();
  const arcUvRatio = 0.5 * totArcLength / (totArcLength + centerLength);
  const arcAngleRatio = 1 - tempNormal.angleTo(faceDirVector) / halfArc;
  if (Math.sign(tempNormal[uvAxis]) === 1) {
    return arcAngleRatio * arcUvRatio;
  } else {
    const lenUv = centerLength / (totArcLength + centerLength);
    return lenUv + arcUvRatio + arcUvRatio * (1 - arcAngleRatio);
  }
}
class RoundedBoxGeometry extends THREE.BoxGeometry {
  constructor(width = 1, height = 1, depth = 1, segments = 2, radius = 0.1) {
    segments = segments * 2 + 1;
    radius = Math.min(width / 2, height / 2, depth / 2, radius);
    super(1, 1, 1, segments, segments, segments);
    if (segments === 1)
      return;
    const geometry2 = this.toNonIndexed();
    this.index = null;
    this.attributes.position = geometry2.attributes.position;
    this.attributes.normal = geometry2.attributes.normal;
    this.attributes.uv = geometry2.attributes.uv;
    const position = new THREE.Vector3();
    const normal = new THREE.Vector3();
    const box = new THREE.Vector3(width, height, depth).divideScalar(2).subScalar(radius);
    const positions = this.attributes.position.array;
    const normals = this.attributes.normal.array;
    const uvs = this.attributes.uv.array;
    const faceTris = positions.length / 6;
    const faceDirVector = new THREE.Vector3();
    const halfSegmentSize = 0.5 / segments;
    for (let i = 0, j = 0; i < positions.length; i += 3, j += 2) {
      position.fromArray(positions, i);
      normal.copy(position);
      normal.x -= Math.sign(normal.x) * halfSegmentSize;
      normal.y -= Math.sign(normal.y) * halfSegmentSize;
      normal.z -= Math.sign(normal.z) * halfSegmentSize;
      normal.normalize();
      positions[i + 0] = box.x * Math.sign(position.x) + normal.x * radius;
      positions[i + 1] = box.y * Math.sign(position.y) + normal.y * radius;
      positions[i + 2] = box.z * Math.sign(position.z) + normal.z * radius;
      normals[i + 0] = normal.x;
      normals[i + 1] = normal.y;
      normals[i + 2] = normal.z;
      const side = Math.floor(i / faceTris);
      switch (side) {
        case 0:
          faceDirVector.set(1, 0, 0);
          uvs[j + 0] = getUv(faceDirVector, normal, "z", "y", radius, depth);
          uvs[j + 1] = 1 - getUv(faceDirVector, normal, "y", "z", radius, height);
          break;
        case 1:
          faceDirVector.set(-1, 0, 0);
          uvs[j + 0] = 1 - getUv(faceDirVector, normal, "z", "y", radius, depth);
          uvs[j + 1] = 1 - getUv(faceDirVector, normal, "y", "z", radius, height);
          break;
        case 2:
          faceDirVector.set(0, 1, 0);
          uvs[j + 0] = 1 - getUv(faceDirVector, normal, "x", "z", radius, width);
          uvs[j + 1] = getUv(faceDirVector, normal, "z", "x", radius, depth);
          break;
        case 3:
          faceDirVector.set(0, -1, 0);
          uvs[j + 0] = 1 - getUv(faceDirVector, normal, "x", "z", radius, width);
          uvs[j + 1] = 1 - getUv(faceDirVector, normal, "z", "x", radius, depth);
          break;
        case 4:
          faceDirVector.set(0, 0, 1);
          uvs[j + 0] = 1 - getUv(faceDirVector, normal, "x", "y", radius, width);
          uvs[j + 1] = 1 - getUv(faceDirVector, normal, "y", "x", radius, height);
          break;
        case 5:
          faceDirVector.set(0, 0, -1);
          uvs[j + 0] = getUv(faceDirVector, normal, "x", "y", radius, width);
          uvs[j + 1] = 1 - getUv(faceDirVector, normal, "y", "x", radius, height);
          break;
      }
    }
  }
}
exports.RoundedBoxGeometry = RoundedBoxGeometry;
//# sourceMappingURL=RoundedBoxGeometry.cjs.map
