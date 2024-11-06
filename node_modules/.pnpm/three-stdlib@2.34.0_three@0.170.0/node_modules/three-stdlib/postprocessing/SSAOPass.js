var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => {
  __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
import { DepthTexture, DepthStencilFormat, UnsignedInt248Type, WebGLRenderTarget, NearestFilter, ShaderMaterial, UniformsUtils, NoBlending, MeshNormalMaterial, DstColorFactor, ZeroFactor, AddEquation, DstAlphaFactor, Color, LuminanceFormat, CustomBlending, Vector3, MathUtils, DataTexture, RedFormat, FloatType, RepeatWrapping } from "three";
import { Pass, FullScreenQuad } from "./Pass.js";
import { SimplexNoise } from "../math/SimplexNoise.js";
import { SSAOShader, SSAOBlurShader, SSAODepthShader } from "../shaders/SSAOShader.js";
import { CopyShader } from "../shaders/CopyShader.js";
const _SSAOPass = class extends Pass {
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
    const depthTexture = new DepthTexture();
    depthTexture.format = DepthStencilFormat;
    depthTexture.type = UnsignedInt248Type;
    this.beautyRenderTarget = new WebGLRenderTarget(this.width, this.height);
    this.normalRenderTarget = new WebGLRenderTarget(this.width, this.height, {
      minFilter: NearestFilter,
      magFilter: NearestFilter,
      depthTexture
    });
    this.ssaoRenderTarget = new WebGLRenderTarget(this.width, this.height);
    this.blurRenderTarget = this.ssaoRenderTarget.clone();
    if (SSAOShader === void 0) {
      console.error("THREE.SSAOPass: The pass relies on SSAOShader.");
    }
    this.ssaoMaterial = new ShaderMaterial({
      defines: Object.assign({}, SSAOShader.defines),
      uniforms: UniformsUtils.clone(SSAOShader.uniforms),
      vertexShader: SSAOShader.vertexShader,
      fragmentShader: SSAOShader.fragmentShader,
      blending: NoBlending
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
    this.normalMaterial = new MeshNormalMaterial();
    this.normalMaterial.blending = NoBlending;
    this.blurMaterial = new ShaderMaterial({
      defines: Object.assign({}, SSAOBlurShader.defines),
      uniforms: UniformsUtils.clone(SSAOBlurShader.uniforms),
      vertexShader: SSAOBlurShader.vertexShader,
      fragmentShader: SSAOBlurShader.fragmentShader
    });
    this.blurMaterial.uniforms["tDiffuse"].value = this.ssaoRenderTarget.texture;
    this.blurMaterial.uniforms["resolution"].value.set(this.width, this.height);
    this.depthRenderMaterial = new ShaderMaterial({
      defines: Object.assign({}, SSAODepthShader.defines),
      uniforms: UniformsUtils.clone(SSAODepthShader.uniforms),
      vertexShader: SSAODepthShader.vertexShader,
      fragmentShader: SSAODepthShader.fragmentShader,
      blending: NoBlending
    });
    this.depthRenderMaterial.uniforms["tDepth"].value = this.normalRenderTarget.depthTexture;
    this.depthRenderMaterial.uniforms["cameraNear"].value = this.camera.near;
    this.depthRenderMaterial.uniforms["cameraFar"].value = this.camera.far;
    this.copyMaterial = new ShaderMaterial({
      uniforms: UniformsUtils.clone(CopyShader.uniforms),
      vertexShader: CopyShader.vertexShader,
      fragmentShader: CopyShader.fragmentShader,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blendSrc: DstColorFactor,
      blendDst: ZeroFactor,
      blendEquation: AddEquation,
      blendSrcAlpha: DstAlphaFactor,
      blendDstAlpha: ZeroFactor,
      blendEquationAlpha: AddEquation
    });
    this.fsQuad = new FullScreenQuad(null);
    this.originalClearColor = new Color();
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
      this.noiseTexture.format = LuminanceFormat;
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
        this.copyMaterial.blending = NoBlending;
        this.renderPass(renderer, this.copyMaterial, this.renderToScreen ? null : writeBuffer);
        break;
      case _SSAOPass.OUTPUT.Blur:
        this.copyMaterial.uniforms["tDiffuse"].value = this.blurRenderTarget.texture;
        this.copyMaterial.blending = NoBlending;
        this.renderPass(renderer, this.copyMaterial, this.renderToScreen ? null : writeBuffer);
        break;
      case _SSAOPass.OUTPUT.Beauty:
        this.copyMaterial.uniforms["tDiffuse"].value = this.beautyRenderTarget.texture;
        this.copyMaterial.blending = NoBlending;
        this.renderPass(renderer, this.copyMaterial, this.renderToScreen ? null : writeBuffer);
        break;
      case _SSAOPass.OUTPUT.Depth:
        this.renderPass(renderer, this.depthRenderMaterial, this.renderToScreen ? null : writeBuffer);
        break;
      case _SSAOPass.OUTPUT.Normal:
        this.copyMaterial.uniforms["tDiffuse"].value = this.normalRenderTarget.texture;
        this.copyMaterial.blending = NoBlending;
        this.renderPass(renderer, this.copyMaterial, this.renderToScreen ? null : writeBuffer);
        break;
      case _SSAOPass.OUTPUT.Default:
        this.copyMaterial.uniforms["tDiffuse"].value = this.beautyRenderTarget.texture;
        this.copyMaterial.blending = NoBlending;
        this.renderPass(renderer, this.copyMaterial, this.renderToScreen ? null : writeBuffer);
        this.copyMaterial.uniforms["tDiffuse"].value = this.blurRenderTarget.texture;
        this.copyMaterial.blending = CustomBlending;
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
      const sample = new Vector3();
      sample.x = Math.random() * 2 - 1;
      sample.y = Math.random() * 2 - 1;
      sample.z = Math.random();
      sample.normalize();
      let scale = i / kernelSize;
      scale = MathUtils.lerp(0.1, 1, scale * scale);
      sample.multiplyScalar(scale);
      kernel.push(sample);
    }
  }
  generateRandomKernelRotations() {
    const width = 4, height = 4;
    if (SimplexNoise === void 0) {
      console.error("THREE.SSAOPass: The pass relies on SimplexNoise.");
    }
    const simplex = new SimplexNoise();
    const size = width * height;
    const data = new Float32Array(size);
    for (let i = 0; i < size; i++) {
      const x = Math.random() * 2 - 1;
      const y = Math.random() * 2 - 1;
      const z = 0;
      data[i] = simplex.noise3d(x, y, z);
    }
    this.noiseTexture = new DataTexture(data, width, height, RedFormat, FloatType);
    this.noiseTexture.wrapS = RepeatWrapping;
    this.noiseTexture.wrapT = RepeatWrapping;
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
export {
  SSAOPass
};
//# sourceMappingURL=SSAOPass.js.map
