"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const THREE = require("three");
const Pass = require("./Pass.cjs");
const CopyShader = require("../shaders/CopyShader.cjs");
class SSAARenderPass extends Pass.Pass {
  constructor(scene, camera, clearColor, clearAlpha) {
    super();
    this.scene = scene;
    this.camera = camera;
    this.sampleLevel = 4;
    this.unbiased = true;
    this.clearColor = clearColor !== void 0 ? clearColor : 0;
    this.clearAlpha = clearAlpha !== void 0 ? clearAlpha : 0;
    this._oldClearColor = new THREE.Color();
    const copyShader = CopyShader.CopyShader;
    this.copyUniforms = THREE.UniformsUtils.clone(copyShader.uniforms);
    this.copyMaterial = new THREE.ShaderMaterial({
      uniforms: this.copyUniforms,
      vertexShader: copyShader.vertexShader,
      fragmentShader: copyShader.fragmentShader,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      premultipliedAlpha: true,
      blending: THREE.AdditiveBlending
    });
    this.fsQuad = new Pass.FullScreenQuad(this.copyMaterial);
  }
  dispose() {
    if (this.sampleRenderTarget) {
      this.sampleRenderTarget.dispose();
      this.sampleRenderTarget = null;
    }
    this.copyMaterial.dispose();
    this.fsQuad.dispose();
  }
  setSize(width, height) {
    if (this.sampleRenderTarget)
      this.sampleRenderTarget.setSize(width, height);
  }
  render(renderer, writeBuffer, readBuffer) {
    if (!this.sampleRenderTarget) {
      this.sampleRenderTarget = new THREE.WebGLRenderTarget(readBuffer.width, readBuffer.height, { type: THREE.HalfFloatType });
      this.sampleRenderTarget.texture.name = "SSAARenderPass.sample";
    }
    const jitterOffsets = _JitterVectors[Math.max(0, Math.min(this.sampleLevel, 5))];
    const autoClear = renderer.autoClear;
    renderer.autoClear = false;
    renderer.getClearColor(this._oldClearColor);
    const oldClearAlpha = renderer.getClearAlpha();
    const baseSampleWeight = 1 / jitterOffsets.length;
    const roundingRange = 1 / 32;
    this.copyUniforms["tDiffuse"].value = this.sampleRenderTarget.texture;
    const viewOffset = {
      fullWidth: readBuffer.width,
      fullHeight: readBuffer.height,
      offsetX: 0,
      offsetY: 0,
      width: readBuffer.width,
      height: readBuffer.height
    };
    const originalViewOffset = Object.assign({}, this.camera.view);
    if (originalViewOffset.enabled)
      Object.assign(viewOffset, originalViewOffset);
    for (let i = 0; i < jitterOffsets.length; i++) {
      const jitterOffset = jitterOffsets[i];
      if (this.camera.setViewOffset) {
        this.camera.setViewOffset(
          viewOffset.fullWidth,
          viewOffset.fullHeight,
          viewOffset.offsetX + jitterOffset[0] * 0.0625,
          viewOffset.offsetY + jitterOffset[1] * 0.0625,
          // 0.0625 = 1 / 16
          viewOffset.width,
          viewOffset.height
        );
      }
      let sampleWeight = baseSampleWeight;
      if (this.unbiased) {
        const uniformCenteredDistribution = -0.5 + (i + 0.5) / jitterOffsets.length;
        sampleWeight += roundingRange * uniformCenteredDistribution;
      }
      this.copyUniforms["opacity"].value = sampleWeight;
      renderer.setClearColor(this.clearColor, this.clearAlpha);
      renderer.setRenderTarget(this.sampleRenderTarget);
      renderer.clear();
      renderer.render(this.scene, this.camera);
      renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
      if (i === 0) {
        renderer.setClearColor(0, 0);
        renderer.clear();
      }
      this.fsQuad.render(renderer);
    }
    if (this.camera.setViewOffset && originalViewOffset.enabled) {
      this.camera.setViewOffset(
        originalViewOffset.fullWidth,
        originalViewOffset.fullHeight,
        originalViewOffset.offsetX,
        originalViewOffset.offsetY,
        originalViewOffset.width,
        originalViewOffset.height
      );
    } else if (this.camera.clearViewOffset) {
      this.camera.clearViewOffset();
    }
    renderer.autoClear = autoClear;
    renderer.setClearColor(this._oldClearColor, oldClearAlpha);
  }
}
const _JitterVectors = [
  [
    [0, 0]
  ],
  [
    [4, 4],
    [-4, -4]
  ],
  [
    [-2, -6],
    [6, -2],
    [-6, 2],
    [2, 6]
  ],
  [
    [1, -3],
    [-1, 3],
    [5, 1],
    [-3, -5],
    [-5, 5],
    [-7, -1],
    [3, 7],
    [7, -7]
  ],
  [
    [1, 1],
    [-1, -3],
    [-3, 2],
    [4, -1],
    [-5, -2],
    [2, 5],
    [5, 3],
    [3, -5],
    [-2, 6],
    [0, -7],
    [-4, -6],
    [-6, 4],
    [-8, 0],
    [7, -4],
    [6, 7],
    [-7, -8]
  ],
  [
    [-4, -7],
    [-7, -5],
    [-3, -5],
    [-5, -4],
    [-1, -4],
    [-2, -2],
    [-6, -1],
    [-4, 0],
    [-7, 1],
    [-1, 2],
    [-6, 3],
    [-3, 3],
    [-7, 6],
    [-3, 6],
    [-5, 7],
    [-1, 7],
    [5, -7],
    [1, -6],
    [6, -5],
    [4, -4],
    [2, -3],
    [7, -2],
    [1, -1],
    [4, -1],
    [2, 1],
    [6, 2],
    [0, 4],
    [4, 4],
    [2, 5],
    [7, 5],
    [5, 6],
    [3, 7]
  ]
];
exports.SSAARenderPass = SSAARenderPass;
//# sourceMappingURL=SSAARenderPass.cjs.map
