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
const AfterimageShader = require("../shaders/AfterimageShader.cjs");
class AfterimagePass extends Pass.Pass {
  constructor(damp = 0.96, shader = AfterimageShader.AfterimageShader) {
    super();
    __publicField(this, "shader");
    __publicField(this, "uniforms");
    __publicField(this, "textureComp");
    __publicField(this, "textureOld");
    __publicField(this, "shaderMaterial");
    __publicField(this, "compFsQuad");
    __publicField(this, "copyFsQuad");
    this.shader = shader;
    this.uniforms = THREE.UniformsUtils.clone(shader.uniforms);
    this.uniforms["damp"].value = damp;
    this.textureComp = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.NearestFilter,
      format: THREE.RGBAFormat
    });
    this.textureOld = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.NearestFilter,
      format: THREE.RGBAFormat
    });
    this.shaderMaterial = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: this.shader.vertexShader,
      fragmentShader: this.shader.fragmentShader
    });
    this.compFsQuad = new Pass.FullScreenQuad(this.shaderMaterial);
    let material = new THREE.MeshBasicMaterial();
    this.copyFsQuad = new Pass.FullScreenQuad(material);
  }
  render(renderer, writeBuffer, readBuffer) {
    this.uniforms["tOld"].value = this.textureOld.texture;
    this.uniforms["tNew"].value = readBuffer.texture;
    renderer.setRenderTarget(this.textureComp);
    this.compFsQuad.render(renderer);
    this.copyFsQuad.material.map = this.textureComp.texture;
    if (this.renderToScreen) {
      renderer.setRenderTarget(null);
      this.copyFsQuad.render(renderer);
    } else {
      renderer.setRenderTarget(writeBuffer);
      if (this.clear)
        renderer.clear();
      this.copyFsQuad.render(renderer);
    }
    let temp = this.textureOld;
    this.textureOld = this.textureComp;
    this.textureComp = temp;
  }
  setSize(width, height) {
    this.textureComp.setSize(width, height);
    this.textureOld.setSize(width, height);
  }
}
exports.AfterimagePass = AfterimagePass;
//# sourceMappingURL=AfterimagePass.cjs.map
