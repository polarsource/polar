var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => {
  __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
import { UniformsUtils, WebGLRenderTarget, LinearFilter, NearestFilter, RGBAFormat, ShaderMaterial, MeshBasicMaterial } from "three";
import { Pass, FullScreenQuad } from "./Pass.js";
import { AfterimageShader } from "../shaders/AfterimageShader.js";
class AfterimagePass extends Pass {
  constructor(damp = 0.96, shader = AfterimageShader) {
    super();
    __publicField(this, "shader");
    __publicField(this, "uniforms");
    __publicField(this, "textureComp");
    __publicField(this, "textureOld");
    __publicField(this, "shaderMaterial");
    __publicField(this, "compFsQuad");
    __publicField(this, "copyFsQuad");
    this.shader = shader;
    this.uniforms = UniformsUtils.clone(shader.uniforms);
    this.uniforms["damp"].value = damp;
    this.textureComp = new WebGLRenderTarget(window.innerWidth, window.innerHeight, {
      minFilter: LinearFilter,
      magFilter: NearestFilter,
      format: RGBAFormat
    });
    this.textureOld = new WebGLRenderTarget(window.innerWidth, window.innerHeight, {
      minFilter: LinearFilter,
      magFilter: NearestFilter,
      format: RGBAFormat
    });
    this.shaderMaterial = new ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: this.shader.vertexShader,
      fragmentShader: this.shader.fragmentShader
    });
    this.compFsQuad = new FullScreenQuad(this.shaderMaterial);
    let material = new MeshBasicMaterial();
    this.copyFsQuad = new FullScreenQuad(material);
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
export {
  AfterimagePass
};
//# sourceMappingURL=AfterimagePass.js.map
