var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => {
  __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
import { Pass, FullScreenQuad } from "./Pass.js";
import { UniformsUtils, ShaderMaterial } from "three";
import { FilmShader } from "../shaders/FilmShader.js";
class FilmPass extends Pass {
  constructor(noiseIntensity, scanlinesIntensity, scanlinesCount, grayscale) {
    super();
    __publicField(this, "material");
    __publicField(this, "fsQuad");
    __publicField(this, "uniforms");
    if (FilmShader === void 0)
      console.error("THREE.FilmPass relies on FilmShader");
    const shader = FilmShader;
    this.uniforms = UniformsUtils.clone(shader.uniforms);
    this.material = new ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: shader.vertexShader,
      fragmentShader: shader.fragmentShader
    });
    if (grayscale !== void 0)
      this.uniforms.grayscale.value = grayscale;
    if (noiseIntensity !== void 0)
      this.uniforms.nIntensity.value = noiseIntensity;
    if (scanlinesIntensity !== void 0)
      this.uniforms.sIntensity.value = scanlinesIntensity;
    if (scanlinesCount !== void 0)
      this.uniforms.sCount.value = scanlinesCount;
    this.fsQuad = new FullScreenQuad(this.material);
  }
  render(renderer, writeBuffer, readBuffer, deltaTime) {
    this.uniforms["tDiffuse"].value = readBuffer.texture;
    this.uniforms["time"].value += deltaTime;
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
  FilmPass
};
//# sourceMappingURL=FilmPass.js.map
