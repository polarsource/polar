"use strict";
var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => {
  __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const THREE = require("three");
const Pass = require("./Pass.cjs");
class RenderPass extends Pass.Pass {
  constructor(scene, camera, overrideMaterial, clearColor, clearAlpha = 0) {
    super();
    __publicField(this, "scene");
    __publicField(this, "camera");
    __publicField(this, "overrideMaterial");
    __publicField(this, "clearColor");
    __publicField(this, "clearAlpha");
    __publicField(this, "clearDepth", false);
    __publicField(this, "_oldClearColor", new THREE.Color());
    this.scene = scene;
    this.camera = camera;
    this.overrideMaterial = overrideMaterial;
    this.clearColor = clearColor;
    this.clearAlpha = clearAlpha;
    this.clear = true;
    this.needsSwap = false;
  }
  render(renderer, writeBuffer, readBuffer) {
    let oldAutoClear = renderer.autoClear;
    renderer.autoClear = false;
    let oldClearAlpha;
    let oldOverrideMaterial = null;
    if (this.overrideMaterial !== void 0) {
      oldOverrideMaterial = this.scene.overrideMaterial;
      this.scene.overrideMaterial = this.overrideMaterial;
    }
    if (this.clearColor) {
      renderer.getClearColor(this._oldClearColor);
      oldClearAlpha = renderer.getClearAlpha();
      renderer.setClearColor(this.clearColor, this.clearAlpha);
    }
    if (this.clearDepth) {
      renderer.clearDepth();
    }
    renderer.setRenderTarget(this.renderToScreen ? null : readBuffer);
    if (this.clear)
      renderer.clear(renderer.autoClearColor, renderer.autoClearDepth, renderer.autoClearStencil);
    renderer.render(this.scene, this.camera);
    if (this.clearColor) {
      renderer.setClearColor(this._oldClearColor, oldClearAlpha);
    }
    if (this.overrideMaterial !== void 0) {
      this.scene.overrideMaterial = oldOverrideMaterial;
    }
    renderer.autoClear = oldAutoClear;
  }
}
exports.RenderPass = RenderPass;
//# sourceMappingURL=RenderPass.cjs.map
