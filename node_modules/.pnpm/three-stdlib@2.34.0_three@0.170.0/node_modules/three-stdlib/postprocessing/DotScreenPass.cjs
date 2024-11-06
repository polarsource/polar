"use strict";
var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => {
  __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const Pass = require("./Pass.cjs");
const THREE = require("three");
const DotScreenShader = require("../shaders/DotScreenShader.cjs");
class DotScreenPass extends Pass.Pass {
  constructor(center, angle, scale) {
    super();
    __publicField(this, "material");
    __publicField(this, "fsQuad");
    __publicField(this, "uniforms");
    if (DotScreenShader.DotScreenShader === void 0)
      console.error("THREE.DotScreenPass relies on THREE.DotScreenShader");
    const shader = DotScreenShader.DotScreenShader;
    this.uniforms = THREE.UniformsUtils.clone(shader.uniforms);
    if (center !== void 0)
      this.uniforms["center"].value.copy(center);
    if (angle !== void 0)
      this.uniforms["angle"].value = angle;
    if (scale !== void 0)
      this.uniforms["scale"].value = scale;
    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: shader.vertexShader,
      fragmentShader: shader.fragmentShader
    });
    this.fsQuad = new Pass.FullScreenQuad(this.material);
  }
  render(renderer, writeBuffer, readBuffer) {
    this.uniforms["tDiffuse"].value = readBuffer.texture;
    this.uniforms["tSize"].value.set(readBuffer.width, readBuffer.height);
    if (this.renderToScreen) {
      renderer.setRenderTarget(null);
      this.fsQuad.render(renderer);
    } else {
      renderer.setRenderTarget(writeBuffer);
      if (this.clear)
        renderer.clear();
      this.fsQuad.render(renderer);
    }
  }
}
exports.DotScreenPass = DotScreenPass;
//# sourceMappingURL=DotScreenPass.cjs.map
