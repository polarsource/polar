"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const THREE = require("three");
const LineSegmentsGeometry = require("./LineSegmentsGeometry.cjs");
const LineMaterial = require("./LineMaterial.cjs");
const _start = new THREE.Vector3();
const _end = new THREE.Vector3();
const _viewport = new THREE.Vector4();
class Wireframe extends THREE.Mesh {
  constructor(geometry = new LineSegmentsGeometry.LineSegmentsGeometry(), material = new LineMaterial.LineMaterial({ color: Math.random() * 16777215 })) {
    super(geometry, material);
    this.isWireframe = true;
    this.type = "Wireframe";
  }
  // for backwards-compatibility, but could be a method of LineSegmentsGeometry...
  computeLineDistances() {
    const geometry = this.geometry;
    const instanceStart = geometry.attributes.instanceStart;
    const instanceEnd = geometry.attributes.instanceEnd;
    const lineDistances = new Float32Array(2 * instanceStart.count);
    for (let i = 0, j = 0, l = instanceStart.count; i < l; i++, j += 2) {
      _start.fromBufferAttribute(instanceStart, i);
      _end.fromBufferAttribute(instanceEnd, i);
      lineDistances[j] = j === 0 ? 0 : lineDistances[j - 1];
      lineDistances[j + 1] = lineDistances[j] + _start.distanceTo(_end);
    }
    const instanceDistanceBuffer = new THREE.InstancedInterleavedBuffer(lineDistances, 2, 1);
    geometry.setAttribute("instanceDistanceStart", new THREE.InterleavedBufferAttribute(instanceDistanceBuffer, 1, 0));
    geometry.setAttribute("instanceDistanceEnd", new THREE.InterleavedBufferAttribute(instanceDistanceBuffer, 1, 1));
    return this;
  }
  onBeforeRender(renderer) {
    const uniforms = this.material.uniforms;
    if (uniforms && uniforms.resolution) {
      renderer.getViewport(_viewport);
      this.material.uniforms.resolution.value.set(_viewport.z, _viewport.w);
    }
  }
}
exports.Wireframe = Wireframe;
//# sourceMappingURL=Wireframe.cjs.map
