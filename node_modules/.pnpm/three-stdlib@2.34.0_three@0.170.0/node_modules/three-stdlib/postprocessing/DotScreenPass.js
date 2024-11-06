var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => {
  __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
import { Pass, FullScreenQuad } from "./Pass.js";
import { UniformsUtils, ShaderMaterial } from "three";
import { DotScreenShader } from "../shaders/DotScreenShader.js";
class DotScreenPass extends Pass {
  constructor(center, angle, scale) {
    super();
    __publicField(this, "material");
    __publicField(this, "fsQuad");
    __publicField(this, "uniforms");
    if (DotScreenShader === void 0)
      console.error("THREE.DotScreenPass relies on THREE.DotScreenShader");
    const shader = DotScreenShader;
    this.uniforms = UniformsUtils.clone(shader.uniforms);
    if (center !== void 0)
      this.uniforms["center"].value.copy(center);
    if (angle !== void 0)
      this.uniforms["angle"].value = angle;
    if (scale !== void 0)
      this.uniforms["scale"].value = scale;
    this.material = new ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: shader.vertexShader,
      fragmentShader: shader.fragmentShader
    });
    this.fsQuad = new FullScreenQuad(this.material);
  }
  render(renderer, writeBuffer, readBuffer) {
    this.uniforms["tDiffuse"].value = readBuffer.texture;
    this.uniforms["tSize"].value.set(readBuffer.width, readBuffer.height);
    if (this.renderToScreen) {
      renderer.setRenderTarget(null);
      this.fsQuad.render(renderer);
    } else {
      renderer.setRenderTarget(writeBuffer);
      if (this.clear)
        renderer.clear();
      this.fsQuad.render(renderer);
    }
  }
}
export {
  DotScreenPass
};
//# sourceMappingURL=DotScreenPass.js.map
