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
const DigitalGlitch = require("../shaders/DigitalGlitch.cjs");
class GlitchPass extends Pass.Pass {
  constructor(dt_size = 64) {
    super();
    __publicField(this, "material");
    __publicField(this, "fsQuad");
    __publicField(this, "goWild");
    __publicField(this, "curF");
    __publicField(this, "randX");
    __publicField(this, "uniforms");
    this.uniforms = THREE.UniformsUtils.clone(DigitalGlitch.DigitalGlitch.uniforms);
    this.uniforms["tDisp"].value = this.generateHeightmap(dt_size);
    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: DigitalGlitch.DigitalGlitch.vertexShader,
      fragmentShader: DigitalGlitch.DigitalGlitch.fragmentShader
    });
    this.fsQuad = new Pass.FullScreenQuad(this.material);
    this.goWild = false;
    this.curF = 0;
    this.generateTrigger();
  }
  render(renderer, writeBuffer, readBuffer) {
    if (renderer.capabilities.isWebGL2 === false)
      this.uniforms["tDisp"].value.format = THREE.LuminanceFormat;
    this.uniforms["tDiffuse"].value = readBuffer.texture;
    this.uniforms["seed"].value = Math.random();
    this.uniforms["byp"].value = 0;
    if (this.curF % this.randX == 0 || this.goWild == true) {
      this.uniforms["amount"].value = Math.random() / 30;
      this.uniforms["angle"].value = THREE.MathUtils.randFloat(-Math.PI, Math.PI);
      this.uniforms["seed_x"].value = THREE.MathUtils.randFloat(-1, 1);
      this.uniforms["seed_y"].value = THREE.MathUtils.randFloat(-1, 1);
      this.uniforms["distortion_x"].value = THREE.MathUtils.randFloat(0, 1);
      this.uniforms["distortion_y"].value = THREE.MathUtils.randFloat(0, 1);
      this.curF = 0;
      this.generateTrigger();
    } else if (this.curF % this.randX < this.randX / 5) {
      this.uniforms["amount"].value = Math.random() / 90;
      this.uniforms["angle"].value = THREE.MathUtils.randFloat(-Math.PI, Math.PI);
      this.uniforms["distortion_x"].value = THREE.MathUtils.randFloat(0, 1);
      this.uniforms["distortion_y"].value = THREE.MathUtils.randFloat(0, 1);
      this.uniforms["seed_x"].value = THREE.MathUtils.randFloat(-0.3, 0.3);
      this.uniforms["seed_y"].value = THREE.MathUtils.randFloat(-0.3, 0.3);
    } else if (this.goWild == false) {
      this.uniforms["byp"].value = 1;
    }
    this.curF++;
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
  generateTrigger() {
    this.randX = THREE.MathUtils.randInt(120, 240);
  }
  generateHeightmap(dt_size) {
    const data_arr = new Float32Array(dt_size * dt_size);
    const length = dt_size * dt_size;
    for (let i = 0; i < length; i++) {
      const val = THREE.MathUtils.randFloat(0, 1);
      data_arr[i] = val;
    }
    const texture = new THREE.DataTexture(data_arr, dt_size, dt_size, THREE.RedFormat, THREE.FloatType);
    texture.needsUpdate = true;
    return texture;
  }
}
exports.GlitchPass = GlitchPass;
//# sourceMappingURL=GlitchPass.cjs.map
