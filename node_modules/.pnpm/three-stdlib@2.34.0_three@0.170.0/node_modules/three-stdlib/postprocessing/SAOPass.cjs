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
const SAOShader = require("../shaders/SAOShader.cjs");
const DepthLimitedBlurShader = require("../shaders/DepthLimitedBlurShader.cjs");
const CopyShader = require("../shaders/CopyShader.cjs");
const UnpackDepthRGBAShader = require("../shaders/UnpackDepthRGBAShader.cjs");
class SAOPass extends Pass.Pass {
  constructor(scene, camera, useDepthTexture = false, useNormals = false, resolution = new THREE.Vector2(256, 256)) {
    super();
    this.scene = scene;
    this.camera = camera;
    this.clear = true;
    this.needsSwap = false;
    this.supportsDepthTextureExtension = useDepthTexture;
    this.supportsNormalTexture = useNormals;
    this.originalClearColor = new THREE.Color();
    this._oldClearColor = new THREE.Color();
    this.oldClearAlpha = 1;
    this.params = {
      output: 0,
      saoBias: 0.5,
      saoIntensity: 0.18,
      saoScale: 1,
      saoKernelRadius: 100,
      saoMinResolution: 0,
      saoBlur: true,
      saoBlurRadius: 8,
      saoBlurStdDev: 4,
      saoBlurDepthCutoff: 0.01
    };
    this.resolution = new THREE.Vector2(resolution.x, resolution.y);
    this.saoRenderTarget = new THREE.WebGLRenderTarget(this.resolution.x, this.resolution.y, { type: THREE.HalfFloatType });
    this.blurIntermediateRenderTarget = this.saoRenderTarget.clone();
    this.beautyRenderTarget = this.saoRenderTarget.clone();
    this.normalRenderTarget = new THREE.WebGLRenderTarget(this.resolution.x, this.resolution.y, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      type: THREE.HalfFloatType
    });
    this.depthRenderTarget = this.normalRenderTarget.clone();
    let depthTexture;
    if (this.supportsDepthTextureExtension) {
      depthTexture = new THREE.DepthTexture();
      depthTexture.type = THREE.UnsignedShortType;
      this.beautyRenderTarget.depthTexture = depthTexture;
      this.beautyRenderTarget.depthBuffer = true;
    }
    this.depthMaterial = new THREE.MeshDepthMaterial();
    this.depthMaterial.depthPacking = THREE.RGBADepthPacking;
    this.depthMaterial.blending = THREE.NoBlending;
    this.normalMaterial = new THREE.MeshNormalMaterial();
    this.normalMaterial.blending = THREE.NoBlending;
    this.saoMaterial = new THREE.ShaderMaterial({
      defines: Object.assign({}, SAOShader.SAOShader.defines),
      fragmentShader: SAOShader.SAOShader.fragmentShader,
      vertexShader: SAOShader.SAOShader.vertexShader,
      uniforms: THREE.UniformsUtils.clone(SAOShader.SAOShader.uniforms)
    });
    this.saoMaterial.extensions.derivatives = true;
    this.saoMaterial.defines["DEPTH_PACKING"] = this.supportsDepthTextureExtension ? 0 : 1;
    this.saoMaterial.defines["NORMAL_TEXTURE"] = this.supportsNormalTexture ? 1 : 0;
    this.saoMaterial.defines["PERSPECTIVE_CAMERA"] = this.camera.isPerspectiveCamera ? 1 : 0;
    this.saoMaterial.uniforms["tDepth"].value = this.supportsDepthTextureExtension ? depthTexture : this.depthRenderTarget.texture;
    this.saoMaterial.uniforms["tNormal"].value = this.normalRenderTarget.texture;
    this.saoMaterial.uniforms["size"].value.set(this.resolution.x, this.resolution.y);
    this.saoMaterial.uniforms["cameraInverseProjectionMatrix"].value.copy(this.camera.projectionMatrixInverse);
    this.saoMaterial.uniforms["cameraProjectionMatrix"].value = this.camera.projectionMatrix;
    this.saoMaterial.blending = THREE.NoBlending;
    this.vBlurMaterial = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.clone(DepthLimitedBlurShader.DepthLimitedBlurShader.uniforms),
      defines: Object.assign({}, DepthLimitedBlurShader.DepthLimitedBlurShader.defines),
      vertexShader: DepthLimitedBlurShader.DepthLimitedBlurShader.vertexShader,
      fragmentShader: DepthLimitedBlurShader.DepthLimitedBlurShader.fragmentShader
    });
    this.vBlurMaterial.defines["DEPTH_PACKING"] = this.supportsDepthTextureExtension ? 0 : 1;
    this.vBlurMaterial.defines["PERSPECTIVE_CAMERA"] = this.camera.isPerspectiveCamera ? 1 : 0;
    this.vBlurMaterial.uniforms["tDiffuse"].value = this.saoRenderTarget.texture;
    this.vBlurMaterial.uniforms["tDepth"].value = this.supportsDepthTextureExtension ? depthTexture : this.depthRenderTarget.texture;
    this.vBlurMaterial.uniforms["size"].value.set(this.resolution.x, this.resolution.y);
    this.vBlurMaterial.blending = THREE.NoBlending;
    this.hBlurMaterial = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.clone(DepthLimitedBlurShader.DepthLimitedBlurShader.uniforms),
      defines: Object.assign({}, DepthLimitedBlurShader.DepthLimitedBlurShader.defines),
      vertexShader: DepthLimitedBlurShader.DepthLimitedBlurShader.vertexShader,
      fragmentShader: DepthLimitedBlurShader.DepthLimitedBlurShader.fragmentShader
    });
    this.hBlurMaterial.defines["DEPTH_PACKING"] = this.supportsDepthTextureExtension ? 0 : 1;
    this.hBlurMaterial.defines["PERSPECTIVE_CAMERA"] = this.camera.isPerspectiveCamera ? 1 : 0;
    this.hBlurMaterial.uniforms["tDiffuse"].value = this.blurIntermediateRenderTarget.texture;
    this.hBlurMaterial.uniforms["tDepth"].value = this.supportsDepthTextureExtension ? depthTexture : this.depthRenderTarget.texture;
    this.hBlurMaterial.uniforms["size"].value.set(this.resolution.x, this.resolution.y);
    this.hBlurMaterial.blending = THREE.NoBlending;
    this.materialCopy = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.clone(CopyShader.CopyShader.uniforms),
      vertexShader: CopyShader.CopyShader.vertexShader,
      fragmentShader: CopyShader.CopyShader.fragmentShader,
      blending: THREE.NoBlending
    });
    this.materialCopy.transparent = true;
    this.materialCopy.depthTest = false;
    this.materialCopy.depthWrite = false;
    this.materialCopy.blending = THREE.CustomBlending;
    this.materialCopy.blendSrc = THREE.DstColorFactor;
    this.materialCopy.blendDst = THREE.ZeroFactor;
    this.materialCopy.blendEquation = THREE.AddEquation;
    this.materialCopy.blendSrcAlpha = THREE.DstAlphaFactor;
    this.materialCopy.blendDstAlpha = THREE.ZeroFactor;
    this.materialCopy.blendEquationAlpha = THREE.AddEquation;
    this.depthCopy = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.clone(UnpackDepthRGBAShader.UnpackDepthRGBAShader.uniforms),
      vertexShader: UnpackDepthRGBAShader.UnpackDepthRGBAShader.vertexShader,
      fragmentShader: UnpackDepthRGBAShader.UnpackDepthRGBAShader.fragmentShader,
      blending: THREE.NoBlending
    });
    this.fsQuad = new Pass.FullScreenQuad(null);
  }
  render(renderer, writeBuffer, readBuffer) {
    if (this.renderToScreen) {
      this.materialCopy.blending = THREE.NoBlending;
      this.materialCopy.uniforms["tDiffuse"].value = readBuffer.texture;
      this.materialCopy.needsUpdate = true;
      this.renderPass(renderer, this.materialCopy, null);
    }
    if (this.params.output === 1) {
      return;
    }
    renderer.getClearColor(this._oldClearColor);
    this.oldClearAlpha = renderer.getClearAlpha();
    const oldAutoClear = renderer.autoClear;
    renderer.autoClear = false;
    renderer.setRenderTarget(this.depthRenderTarget);
    renderer.clear();
    this.saoMaterial.uniforms["bias"].value = this.params.saoBias;
    this.saoMaterial.uniforms["intensity"].value = this.params.saoIntensity;
    this.saoMaterial.uniforms["scale"].value = this.params.saoScale;
    this.saoMaterial.uniforms["kernelRadius"].value = this.params.saoKernelRadius;
    this.saoMaterial.uniforms["minResolution"].value = this.params.saoMinResolution;
    this.saoMaterial.uniforms["cameraNear"].value = this.camera.near;
    this.saoMaterial.uniforms["cameraFar"].value = this.camera.far;
    const depthCutoff = this.params.saoBlurDepthCutoff * (this.camera.far - this.camera.near);
    this.vBlurMaterial.uniforms["depthCutoff"].value = depthCutoff;
    this.hBlurMaterial.uniforms["depthCutoff"].value = depthCutoff;
    this.vBlurMaterial.uniforms["cameraNear"].value = this.camera.near;
    this.vBlurMaterial.uniforms["cameraFar"].value = this.camera.far;
    this.hBlurMaterial.uniforms["cameraNear"].value = this.camera.near;
    this.hBlurMaterial.uniforms["cameraFar"].value = this.camera.far;
    this.params.saoBlurRadius = Math.floor(this.params.saoBlurRadius);
    if (this.prevStdDev !== this.params.saoBlurStdDev || this.prevNumSamples !== this.params.saoBlurRadius) {
      DepthLimitedBlurShader.BlurShaderUtils.configure(
        this.vBlurMaterial,
        this.params.saoBlurRadius,
        this.params.saoBlurStdDev,
        new THREE.Vector2(0, 1)
      );
      DepthLimitedBlurShader.BlurShaderUtils.configure(
        this.hBlurMaterial,
        this.params.saoBlurRadius,
        this.params.saoBlurStdDev,
        new THREE.Vector2(1, 0)
      );
      this.prevStdDev = this.params.saoBlurStdDev;
      this.prevNumSamples = this.params.saoBlurRadius;
    }
    renderer.setClearColor(0);
    renderer.setRenderTarget(this.beautyRenderTarget);
    renderer.clear();
    renderer.render(this.scene, this.camera);
    if (!this.supportsDepthTextureExtension) {
      this.renderOverride(renderer, this.depthMaterial, this.depthRenderTarget, 0, 1);
    }
    if (this.supportsNormalTexture) {
      this.renderOverride(renderer, this.normalMaterial, this.normalRenderTarget, 7829503, 1);
    }
    this.renderPass(renderer, this.saoMaterial, this.saoRenderTarget, 16777215, 1);
    if (this.params.saoBlur) {
      this.renderPass(renderer, this.vBlurMaterial, this.blurIntermediateRenderTarget, 16777215, 1);
      this.renderPass(renderer, this.hBlurMaterial, this.saoRenderTarget, 16777215, 1);
    }
    let outputMaterial = this.materialCopy;
    if (this.params.output === 3) {
      if (this.supportsDepthTextureExtension) {
        this.materialCopy.uniforms["tDiffuse"].value = this.beautyRenderTarget.depthTexture;
        this.materialCopy.needsUpdate = true;
      } else {
        this.depthCopy.uniforms["tDiffuse"].value = this.depthRenderTarget.texture;
        this.depthCopy.needsUpdate = true;
        outputMaterial = this.depthCopy;
      }
    } else if (this.params.output === 4) {
      this.materialCopy.uniforms["tDiffuse"].value = this.normalRenderTarget.texture;
      this.materialCopy.needsUpdate = true;
    } else {
      this.materialCopy.uniforms["tDiffuse"].value = this.saoRenderTarget.texture;
      this.materialCopy.needsUpdate = true;
    }
    if (this.params.output === 0) {
      outputMaterial.blending = THREE.CustomBlending;
    } else {
      outputMaterial.blending = THREE.NoBlending;
    }
    this.renderPass(renderer, outputMaterial, this.renderToScreen ? null : readBuffer);
    renderer.setClearColor(this._oldClearColor, this.oldClearAlpha);
    renderer.autoClear = oldAutoClear;
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
    this.beautyRenderTarget.setSize(width, height);
    this.saoRenderTarget.setSize(width, height);
    this.blurIntermediateRenderTarget.setSize(width, height);
    this.normalRenderTarget.setSize(width, height);
    this.depthRenderTarget.setSize(width, height);
    this.saoMaterial.uniforms["size"].value.set(width, height);
    this.saoMaterial.uniforms["cameraInverseProjectionMatrix"].value.copy(this.camera.projectionMatrixInverse);
    this.saoMaterial.uniforms["cameraProjectionMatrix"].value = this.camera.projectionMatrix;
    this.saoMaterial.needsUpdate = true;
    this.vBlurMaterial.uniforms["size"].value.set(width, height);
    this.vBlurMaterial.needsUpdate = true;
    this.hBlurMaterial.uniforms["size"].value.set(width, height);
    this.hBlurMaterial.needsUpdate = true;
  }
  dispose() {
    this.saoRenderTarget.dispose();
    this.blurIntermediateRenderTarget.dispose();
    this.beautyRenderTarget.dispose();
    this.normalRenderTarget.dispose();
    this.depthRenderTarget.dispose();
    this.depthMaterial.dispose();
    this.normalMaterial.dispose();
    this.saoMaterial.dispose();
    this.vBlurMaterial.dispose();
    this.hBlurMaterial.dispose();
    this.materialCopy.dispose();
    this.depthCopy.dispose();
    this.fsQuad.dispose();
  }
}
__publicField(SAOPass, "OUTPUT", {
  Beauty: 1,
  Default: 0,
  SAO: 2,
  Depth: 3,
  Normal: 4
});
exports.SAOPass = SAOPass;
//# sourceMappingURL=SAOPass.cjs.map
