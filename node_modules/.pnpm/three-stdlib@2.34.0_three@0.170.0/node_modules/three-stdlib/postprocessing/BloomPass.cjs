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
const ConvolutionShader = require("../shaders/ConvolutionShader.cjs");
class BloomPass extends Pass.Pass {
  constructor(strength = 1, kernelSize = 25, sigma = 4, resolution = 256) {
    super();
    __publicField(this, "renderTargetX");
    __publicField(this, "renderTargetY");
    __publicField(this, "materialCombine");
    __publicField(this, "materialConvolution");
    __publicField(this, "fsQuad");
    __publicField(this, "combineUniforms");
    __publicField(this, "convolutionUniforms");
    __publicField(this, "blurX", new THREE.Vector2(1953125e-9, 0));
    __publicField(this, "blurY", new THREE.Vector2(0, 1953125e-9));
    this.renderTargetX = new THREE.WebGLRenderTarget(resolution, resolution);
    this.renderTargetX.texture.name = "BloomPass.x";
    this.renderTargetY = new THREE.WebGLRenderTarget(resolution, resolution);
    this.renderTargetY.texture.name = "BloomPass.y";
    this.combineUniforms = THREE.UniformsUtils.clone(CombineShader.uniforms);
    this.combineUniforms["strength"].value = strength;
    this.materialCombine = new THREE.ShaderMaterial({
      uniforms: this.combineUniforms,
      vertexShader: CombineShader.vertexShader,
      fragmentShader: CombineShader.fragmentShader,
      blending: THREE.AdditiveBlending,
      transparent: true
    });
    if (ConvolutionShader.ConvolutionShader === void 0)
      console.error("BloomPass relies on ConvolutionShader");
    const convolutionShader = ConvolutionShader.ConvolutionShader;
    this.convolutionUniforms = THREE.UniformsUtils.clone(convolutionShader.uniforms);
    this.convolutionUniforms["uImageIncrement"].value = this.blurX;
    this.convolutionUniforms["cKernel"].value = ConvolutionShader.ConvolutionShader.buildKernel(sigma);
    this.materialConvolution = new THREE.ShaderMaterial({
      uniforms: this.convolutionUniforms,
      vertexShader: convolutionShader.vertexShader,
      fragmentShader: convolutionShader.fragmentShader,
      defines: {
        KERNEL_SIZE_FLOAT: kernelSize.toFixed(1),
        KERNEL_SIZE_INT: kernelSize.toFixed(0)
      }
    });
    this.needsSwap = false;
    this.fsQuad = new Pass.FullScreenQuad(this.materialConvolution);
  }
  render(renderer, writeBuffer, readBuffer, deltaTime, maskActive) {
    if (maskActive)
      renderer.state.buffers.stencil.setTest(false);
    this.fsQuad.material = this.materialConvolution;
    this.convolutionUniforms["tDiffuse"].value = readBuffer.texture;
    this.convolutionUniforms["uImageIncrement"].value = this.blurX;
    renderer.setRenderTarget(this.renderTargetX);
    renderer.clear();
    this.fsQuad.render(renderer);
    this.convolutionUniforms["tDiffuse"].value = this.renderTargetX.texture;
    this.convolutionUniforms["uImageIncrement"].value = this.blurY;
    renderer.setRenderTarget(this.renderTargetY);
    renderer.clear();
    this.fsQuad.render(renderer);
    this.fsQuad.material = this.materialCombine;
    this.combineUniforms["tDiffuse"].value = this.renderTargetY.texture;
    if (maskActive)
      renderer.state.buffers.stencil.setTest(true);
    renderer.setRenderTarget(readBuffer);
    if (this.clear)
      renderer.clear();
    this.fsQuad.render(renderer);
  }
}
const CombineShader = {
  uniforms: {
    tDiffuse: {
      value: null
    },
    strength: {
      value: 1
    }
  },
  vertexShader: (
    /* glsl */
    `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
  }`
  ),
  fragmentShader: (
    /* glsl */
    `
  uniform float strength;
  uniform sampler2D tDiffuse;
  varying vec2 vUv;
  void main() {
    vec4 texel = texture2D( tDiffuse, vUv );
    gl_FragColor = strength * texel;
  }`
  )
};
exports.BloomPass = BloomPass;
//# sourceMappingURL=BloomPass.cjs.map
