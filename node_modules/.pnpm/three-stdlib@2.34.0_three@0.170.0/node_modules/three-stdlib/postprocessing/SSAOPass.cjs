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
const SimplexNoise = require("../math/SimplexNoise.cjs");
const SSAOShader = require("../shaders/SSAOShader.cjs");
const CopyShader = require("../shaders/CopyShader.cjs");
const _SSAOPass = class extends Pass.Pass {
  constructor(scene, camera, width, height) {
    super();
    this.width = width !== void 0 ? width : 512;
    this.height = height !== void 0 ? height : 512;
    this.clear = true;
    this.camera = camera;
    this.scene = scene;
    this.kernelRadius = 8;
    this.kernelSize = 32;
    this.kernel = [];
    this.noiseTexture = null;
    this.output = 0;
    this.minDistance = 5e-3;
    this.maxDistance = 0.1;
    this._visibilityCache = /* @__PURE__ */ new Map();
    this.generateSampleKernel();
    this.generateRandomKernelRotations();
    const depthTexture = new THREE.DepthTexture();
    depthTexture.format = THREE.DepthStencilFormat;
    depthTexture.type = THREE.UnsignedInt248Type;
    this.beautyRenderTarget = new THREE.WebGLRenderTarget(this.width, this.height);
    this.normalRenderTarget = new THREE.WebGLRenderTarget(this.width, this.height, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      depthTexture
    });
    this.ssaoRenderTarget = new THREE.WebGLRenderTarget(this.width, this.height);
    this.blurRenderTarget = this.ssaoRenderTarget.clone();
    if (SSAOShader.SSAOShader === void 0) {
      console.error("THREE.SSAOPass: The pass relies on SSAOShader.");
    }
    this.ssaoMaterial = new THREE.ShaderMaterial({
      defines: Object.assign({}, SSAOShader.SSAOShader.defines),
      uniforms: THREE.UniformsUtils.clone(SSAOShader.SSAOShader.uniforms),
      vertexShader: SSAOShader.SSAOShader.vertexShader,
      fragmentShader: SSAOShader.SSAOShader.fragmentShader,
      blending: THREE.NoBlending
    });
    this.ssaoMaterial.uniforms["tDiffuse"].value = this.beautyRenderTarget.texture;
    this.ssaoMaterial.uniforms["tNormal"].value = this.normalRenderTarget.texture;
    this.ssaoMaterial.uniforms["tDepth"].value = this.normalRenderTarget.depthTexture;
    this.ssaoMaterial.uniforms["tNoise"].value = this.noiseTexture;
    this.ssaoMaterial.uniforms["kernel"].value = this.kernel;
    this.ssaoMaterial.uniforms["cameraNear"].value = this.camera.near;
    this.ssaoMaterial.uniforms["cameraFar"].value = this.camera.far;
    this.ssaoMaterial.uniforms["resolution"].value.set(this.width, this.height);
    this.ssaoMaterial.uniforms["cameraProjectionMatrix"].value.copy(this.camera.projectionMatrix);
    this.ssaoMaterial.uniforms["cameraInverseProjectionMatrix"].value.copy(this.camera.projectionMatrixInverse);
    this.normalMaterial = new THREE.MeshNormalMaterial();
    this.normalMaterial.blending = THREE.NoBlending;
    this.blurMaterial = new THREE.ShaderMaterial({
      defines: Object.assign({}, SSAOShader.SSAOBlurShader.defines),
      uniforms: THREE.UniformsUtils.clone(SSAOShader.SSAOBlurShader.uniforms),
      vertexShader: SSAOShader.SSAOBlurShader.vertexShader,
      fragmentShader: SSAOShader.SSAOBlurShader.fragmentShader
    });
    this.blurMaterial.uniforms["tDiffuse"].value = this.ssaoRenderTarget.texture;
    this.blurMaterial.uniforms["resolution"].value.set(this.width, this.height);
    this.depthRenderMaterial = new THREE.ShaderMaterial({
      defines: Object.assign({}, SSAOShader.SSAODepthShader.defines),
      uniforms: THREE.UniformsUtils.clone(SSAOShader.SSAODepthShader.uniforms),
      vertexShader: SSAOShader.SSAODepthShader.vertexShader,
      fragmentShader: SSAOShader.SSAODepthShader.fragmentShader,
      blending: THREE.NoBlending
    });
    this.depthRenderMaterial.uniforms["tDepth"].value = this.normalRenderTarget.depthTexture;
    this.depthRenderMaterial.uniforms["cameraNear"].value = this.camera.near;
    this.depthRenderMaterial.uniforms["cameraFar"].value = this.camera.far;
    this.copyMaterial = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.clone(CopyShader.CopyShader.uniforms),
      vertexShader: CopyShader.CopyShader.vertexShader,
      fragmentShader: CopyShader.CopyShader.fragmentShader,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blendSrc: THREE.DstColorFactor,
      blendDst: THREE.ZeroFactor,
      blendEquation: THREE.AddEquation,
      blendSrcAlpha: THREE.DstAlphaFactor,
      blendDstAlpha: THREE.ZeroFactor,
      blendEquationAlpha: THREE.AddEquation
    });
    this.fsQuad = new Pass.FullScreenQuad(null);
    this.originalClearColor = new THREE.Color();
  }
  dispose() {
    this.beautyRenderTarget.dispose();
    this.normalRenderTarget.dispose();
    this.ssaoRenderTarget.dispose();
    this.blurRenderTarget.dispose();
    this.normalMaterial.dispose();
    this.blurMaterial.dispose();
    this.copyMaterial.dispose();
    this.depthRenderMaterial.dispose();
    this.fsQuad.dispose();
  }
  render(renderer, writeBuffer) {
    if (renderer.capabilities.isWebGL2 === false)
      this.noiseTexture.format = THREE.LuminanceFormat;
    renderer.setRenderTarget(this.beautyRenderTarget);
    renderer.clear();
    renderer.render(this.scene, this.camera);
    this.overrideVisibility();
    this.renderOverride(renderer, this.normalMaterial, this.normalRenderTarget, 7829503, 1);
    this.restoreVisibility();
    this.ssaoMaterial.uniforms["kernelRadius"].value = this.kernelRadius;
    this.ssaoMaterial.uniforms["minDistance"].value = this.minDistance;
    this.ssaoMaterial.uniforms["maxDistance"].value = this.maxDistance;
    this.renderPass(renderer, this.ssaoMaterial, this.ssaoRenderTarget);
    this.renderPass(renderer, this.blurMaterial, this.blurRenderTarget);
    switch (this.output) {
      case _SSAOPass.OUTPUT.SSAO:
        this.copyMaterial.uniforms["tDiffuse"].value = this.ssaoRenderTarget.texture;
        this.copyMaterial.blending = THREE.NoBlending;
        this.renderPass(renderer, this.copyMaterial, this.renderToScreen ? null : writeBuffer);
        break;
      case _SSAOPass.OUTPUT.Blur:
        this.copyMaterial.uniforms["tDiffuse"].value = this.blurRenderTarget.texture;
        this.copyMaterial.blending = THREE.NoBlending;
        this.renderPass(renderer, this.copyMaterial, this.renderToScreen ? null : writeBuffer);
        break;
      case _SSAOPass.OUTPUT.Beauty:
        this.copyMaterial.uniforms["tDiffuse"].value = this.beautyRenderTarget.texture;
        this.copyMaterial.blending = THREE.NoBlending;
        this.renderPass(renderer, this.copyMaterial, this.renderToScreen ? null : writeBuffer);
        break;
      case _SSAOPass.OUTPUT.Depth:
        this.renderPass(renderer, this.depthRenderMaterial, this.renderToScreen ? null : writeBuffer);
        break;
      case _SSAOPass.OUTPUT.Normal:
        this.copyMaterial.uniforms["tDiffuse"].value = this.normalRenderTarget.texture;
        this.copyMaterial.blending = THREE.NoBlending;
        this.renderPass(renderer, this.copyMaterial, this.renderToScreen ? null : writeBuffer);
        break;
      case _SSAOPass.OUTPUT.Default:
        this.copyMaterial.uniforms["tDiffuse"].value = this.beautyRenderTarget.texture;
        this.copyMaterial.blending = THREE.NoBlending;
        this.renderPass(renderer, this.copyMaterial, this.renderToScreen ? null : writeBuffer);
        this.copyMaterial.uniforms["tDiffuse"].value = this.blurRenderTarget.texture;
        this.copyMaterial.blending = THREE.CustomBlending;
        this.renderPass(renderer, this.copyMaterial, this.renderToScreen ? null : writeBuffer);
        break;
      default:
        console.warn("THREE.SSAOPass: Unknown output type.");
    }
  }
  renderPass(renderer, passMaterial, renderTarget, clearColor, clearAlpha) {
    renderer.getClearColor(this.originalClearColor);
    const originalClearAlpha = renderer.getClearAlpha();
    const originalAutoClear = renderer.autoClear;
    renderer.setRenderTarget(renderTarget);
    renderer.autoClear = false;
    if (clearColor !== void 0 && clearColor !== null) {
      renderer.setClearColor(clearColor);
      renderer.setClearAlpha(clearAlpha || 0);
      renderer.clear();
    }
    this.fsQuad.material = passMaterial;
    this.fsQuad.render(renderer);
    renderer.autoClear = originalAutoClear;
    renderer.setClearColor(this.originalClearColor);
    renderer.setClearAlpha(originalClearAlpha);
  }
  renderOverride(renderer, overrideMaterial, renderTarget, clearColor, clearAlpha) {
    renderer.getClearColor(this.originalClearColor);
    const originalClearAlpha = renderer.getClearAlpha();
    const originalAutoClear = renderer.autoClear;
    renderer.setRenderTarget(renderTarget);
    renderer.autoClear = false;
    clearColor = overrideMaterial.clearColor || clearColor;
    clearAlpha = overrideMaterial.clearAlpha || clearAlpha;
    if (clearColor !== void 0 && clearColor !== null) {
      renderer.setClearColor(clearColor);
      renderer.setClearAlpha(clearAlpha || 0);
      renderer.clear();
    }
    this.scene.overrideMaterial = overrideMaterial;
    renderer.render(this.scene, this.camera);
    this.scene.overrideMaterial = null;
    renderer.autoClear = originalAutoClear;
    renderer.setClearColor(this.originalClearColor);
    renderer.setClearAlpha(originalClearAlpha);
  }
  setSize(width, height) {
    this.width = width;
    this.height = height;
    this.beautyRenderTarget.setSize(width, height);
    this.ssaoRenderTarget.setSize(width, height);
    this.normalRenderTarget.setSize(width, height);
    this.blurRenderTarget.setSize(width, height);
    this.ssaoMaterial.uniforms["resolution"].value.set(width, height);
    this.ssaoMaterial.uniforms["cameraProjectionMatrix"].value.copy(this.camera.projectionMatrix);
    this.ssaoMaterial.uniforms["cameraInverseProjectionMatrix"].value.copy(this.camera.projectionMatrixInverse);
    this.blurMaterial.uniforms["resolution"].value.set(width, height);
  }
  generateSampleKernel() {
    const kernelSize = this.kernelSize;
    const kernel = this.kernel;
    for (let i = 0; i < kernelSize; i++) {
      const sample = new THREE.Vector3();
      sample.x = Math.random() * 2 - 1;
      sample.y = Math.random() * 2 - 1;
      sample.z = Math.random();
      sample.normalize();
      let scale = i / kernelSize;
      scale = THREE.MathUtils.lerp(0.1, 1, scale * scale);
      sample.multiplyScalar(scale);
      kernel.push(sample);
    }
  }
  generateRandomKernelRotations() {
    const width = 4, height = 4;
    if (SimplexNoise.SimplexNoise === void 0) {
      console.error("THREE.SSAOPass: The pass relies on SimplexNoise.");
    }
    const simplex = new SimplexNoise.SimplexNoise();
    const size = width * height;
    const data = new Float32Array(size);
    for (let i = 0; i < size; i++) {
      const x = Math.random() * 2 - 1;
      const y = Math.random() * 2 - 1;
      const z = 0;
      data[i] = simplex.noise3d(x, y, z);
    }
    this.noiseTexture = new THREE.DataTexture(data, width, height, THREE.RedFormat, THREE.FloatType);
    this.noiseTexture.wrapS = THREE.RepeatWrapping;
    this.noiseTexture.wrapT = THREE.RepeatWrapping;
    this.noiseTexture.needsUpdate = true;
  }
  overrideVisibility() {
    const scene = this.scene;
    const cache = this._visibilityCache;
    scene.traverse(function(object) {
      cache.set(object, object.visible);
      if (object.isPoints || object.isLine)
        object.visible = false;
    });
  }
  restoreVisibility() {
    const scene = this.scene;
    const cache = this._visibilityCache;
    scene.traverse(function(object) {
      const visible = cache.get(object);
      object.visible = visible;
    });
    cache.clear();
  }
};
let SSAOPass = _SSAOPass;
__publicField(SSAOPass, "OUTPUT", {
  Default: 0,
  SSAO: 1,
  Blur: 2,
  Beauty: 3,
  Depth: 4,
  Normal: 5
});
exports.SSAOPass = SSAOPass;
//# sourceMappingURL=SSAOPass.cjs.map
