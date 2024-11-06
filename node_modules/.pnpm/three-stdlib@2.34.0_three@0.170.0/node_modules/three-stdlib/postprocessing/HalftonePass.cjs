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
const HalftoneShader = require("../shaders/HalftoneShader.cjs");
class HalftonePass extends Pass.Pass {
  constructor(width, height, params) {
    super();
    __publicField(this, "material");
    __publicField(this, "fsQuad");
    __publicField(this, "uniforms");
    if (HalftoneShader.HalftoneShader === void 0) {
      console.error("THREE.HalftonePass requires HalftoneShader");
    }
    this.uniforms = THREE.UniformsUtils.clone(HalftoneShader.HalftoneShader.uniforms);
    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      fragmentShader: HalftoneShader.HalftoneShader.fragmentShader,
      vertexShader: HalftoneShader.HalftoneShader.vertexShader
    });
    this.uniforms.width.value = width;
    this.uniforms.height.value = height;
    for (const key in params) {
      if (params.hasOwnProperty(key) && this.uniforms.hasOwnProperty(key)) {
        this.uniforms[key].value = params[key];
      }
    }
    this.fsQuad = new Pass.FullScreenQuad(this.material);
  }
  render(renderer, writeBuffer, readBuffer) {
    this.material.uniforms["tDiffuse"].value = readBuffer.texture;
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
  setSize(width, height) {
    this.uniforms.width.value = width;
    this.uniforms.height.value = height;
  }
}
exports.HalftonePass = HalftonePass;
//# sourceMappingURL=HalftonePass.cjs.map
