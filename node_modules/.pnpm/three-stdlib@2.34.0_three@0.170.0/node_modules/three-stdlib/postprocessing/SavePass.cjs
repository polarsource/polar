"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const THREE = require("three");
const Pass = require("./Pass.cjs");
const CopyShader = require("../shaders/CopyShader.cjs");
class SavePass extends Pass.Pass {
  constructor(renderTarget) {
    super();
    if (CopyShader.CopyShader === void 0)
      console.error("THREE.SavePass relies on CopyShader");
    const shader = CopyShader.CopyShader;
    this.textureID = "tDiffuse";
    this.uniforms = THREE.UniformsUtils.clone(shader.uniforms);
    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: shader.vertexShader,
      fragmentShader: shader.fragmentShader,
      blending: THREE.NoBlending
    });
    this.renderTarget = renderTarget;
    if (this.renderTarget === void 0) {
      this.renderTarget = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight);
      this.renderTarget.texture.name = "SavePass.rt";
    }
    this.needsSwap = false;
    this.fsQuad = new Pass.FullScreenQuad(this.material);
  }
  render(renderer, writeBuffer, readBuffer) {
    if (this.uniforms[this.textureID]) {
      this.uniforms[this.textureID].value = readBuffer.texture;
    }
    renderer.setRenderTarget(this.renderTarget);
    if (this.clear)
      renderer.clear();
    this.fsQuad.render(renderer);
  }
}
exports.SavePass = SavePass;
//# sourceMappingURL=SavePass.cjs.map
