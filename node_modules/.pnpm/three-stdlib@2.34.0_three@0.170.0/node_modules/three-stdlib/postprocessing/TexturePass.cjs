"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const THREE = require("three");
const Pass = require("./Pass.cjs");
const CopyShader = require("../shaders/CopyShader.cjs");
class TexturePass extends Pass.Pass {
  constructor(map, opacity) {
    super();
    const shader = CopyShader.CopyShader;
    this.map = map;
    this.opacity = opacity !== void 0 ? opacity : 1;
    this.uniforms = THREE.UniformsUtils.clone(shader.uniforms);
    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: shader.vertexShader,
      fragmentShader: shader.fragmentShader,
      depthTest: false,
      depthWrite: false,
      premultipliedAlpha: true
    });
    this.needsSwap = false;
    this.fsQuad = new Pass.FullScreenQuad(null);
  }
  render(renderer, writeBuffer, readBuffer) {
    const oldAutoClear = renderer.autoClear;
    renderer.autoClear = false;
    this.fsQuad.material = this.material;
    this.uniforms["opacity"].value = this.opacity;
    this.uniforms["tDiffuse"].value = this.map;
    this.material.transparent = this.opacity < 1;
    renderer.setRenderTarget(this.renderToScreen ? null : readBuffer);
    if (this.clear)
      renderer.clear();
    this.fsQuad.render(renderer);
    renderer.autoClear = oldAutoClear;
  }
  dispose() {
    this.material.dispose();
    this.fsQuad.dispose();
  }
}
exports.TexturePass = TexturePass;
//# sourceMappingURL=TexturePass.cjs.map
