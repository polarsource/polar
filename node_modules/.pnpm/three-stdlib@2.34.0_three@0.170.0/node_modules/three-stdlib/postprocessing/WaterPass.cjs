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
class WaterPass extends Pass.Pass {
  constructor() {
    super();
    __publicField(this, "material");
    __publicField(this, "fsQuad");
    __publicField(this, "factor");
    __publicField(this, "time");
    __publicField(this, "uniforms");
    this.uniforms = {
      tex: { value: null },
      time: { value: 0 },
      factor: { value: 0 },
      resolution: { value: new THREE.Vector2(64, 64) }
    };
    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: `
      varying vec2 vUv;
      void main(){  
        vUv = uv; 
        vec4 modelViewPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * modelViewPosition;
      }`,
      fragmentShader: `
      uniform float time;
      uniform float factor;
      uniform vec2 resolution;
      uniform sampler2D tex;
      varying vec2 vUv;
      void main() {  
        vec2 uv1 = vUv;
        vec2 uv = gl_FragCoord.xy/resolution.xy;
        float frequency = 6.0 * factor;
        float amplitude = 0.015 * factor;
        float x = uv1.y * frequency + time * .7; 
        float y = uv1.x * frequency + time * .3;
        uv1.x += cos(x+y) * amplitude * cos(y);
        uv1.y += sin(x-y) * amplitude * cos(y);
        vec4 rgba = texture2D(tex, uv1);
        gl_FragColor = rgba;
      }`
    });
    this.fsQuad = new Pass.FullScreenQuad(this.material);
    this.factor = 0;
    this.time = 0;
  }
  render(renderer, writeBuffer, readBuffer) {
    this.uniforms["tex"].value = readBuffer.texture;
    this.uniforms["time"].value = this.time;
    this.uniforms["factor"].value = this.factor;
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
exports.WaterPass = WaterPass;
//# sourceMappingURL=WaterPass.cjs.map
