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
class ShaderPass extends Pass.Pass {
  constructor(shader, textureID = "tDiffuse") {
    super();
    __publicField(this, "textureID");
    __publicField(this, "uniforms");
    __publicField(this, "material");
    __publicField(this, "fsQuad");
    this.textureID = textureID;
    if (shader instanceof THREE.ShaderMaterial) {
      this.uniforms = shader.uniforms;
      this.material = shader;
    } else {
      this.uniforms = THREE.UniformsUtils.clone(shader.uniforms);
      this.material = new THREE.ShaderMaterial({
        defines: Object.assign({}, shader.defines),
        uniforms: this.uniforms,
        vertexShader: shader.vertexShader,
        fragmentShader: shader.fragmentShader
      });
    }
    this.fsQuad = new Pass.FullScreenQuad(this.material);
  }
  render(renderer, writeBuffer, readBuffer) {
    if (this.uniforms[this.textureID]) {
      this.uniforms[this.textureID].value = readBuffer.texture;
    }
    this.fsQuad.material = this.material;
    if (this.renderToScreen) {
      renderer.setRenderTarget(null);
      this.fsQuad.render(renderer);
    } else {
      renderer.setRenderTarget(writeBuffer);
      if (this.clear)
        renderer.clear(renderer.autoClearColor, renderer.autoClearDepth, renderer.autoClearStencil);
      this.fsQuad.render(renderer);
    }
  }
  dispose() {
    this.fsQuad.dispose();
    this.material.dispose();
  }
}
exports.ShaderPass = ShaderPass;
//# sourceMappingURL=ShaderPass.cjs.map
