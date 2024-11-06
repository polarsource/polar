"use strict";
var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => {
  __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const THREE = require("three");
class Pass {
  constructor() {
    // if set to true, the pass is processed by the composer
    __publicField(this, "enabled", true);
    // if set to true, the pass indicates to swap read and write buffer after rendering
    __publicField(this, "needsSwap", true);
    // if set to true, the pass clears its buffer before rendering
    __publicField(this, "clear", false);
    // if set to true, the result of the pass is rendered to screen. This is set automatically by EffectComposer.
    __publicField(this, "renderToScreen", false);
  }
  setSize(width, height) {
  }
  render(renderer, writeBuffer, readBuffer, deltaTime, maskActive) {
    console.error("THREE.Pass: .render() must be implemented in derived pass.");
  }
  dispose() {
  }
}
class FullScreenQuad {
  constructor(material) {
    __publicField(this, "camera", new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1));
    __publicField(this, "geometry", new THREE.PlaneGeometry(2, 2));
    __publicField(this, "mesh");
    this.mesh = new THREE.Mesh(this.geometry, material);
  }
  get material() {
    return this.mesh.material;
  }
  set material(value) {
    this.mesh.material = value;
  }
  dispose() {
    this.mesh.geometry.dispose();
  }
  render(renderer) {
    renderer.render(this.mesh, this.camera);
  }
}
exports.FullScreenQuad = FullScreenQuad;
exports.Pass = Pass;
//# sourceMappingURL=Pass.cjs.map
