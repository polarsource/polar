var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => {
  __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
import { Pass } from "./Pass.js";
import { Color } from "three";
class ClearPass extends Pass {
  constructor(clearColor, clearAlpha) {
    super();
    __publicField(this, "clearColor");
    __publicField(this, "clearAlpha");
    __publicField(this, "_oldClearColor");
    this.needsSwap = false;
    this.clearColor = clearColor !== void 0 ? clearColor : 0;
    this.clearAlpha = clearAlpha !== void 0 ? clearAlpha : 0;
    this._oldClearColor = new Color();
  }
  render(renderer, writeBuffer, readBuffer) {
    let oldClearAlpha;
    if (this.clearColor) {
      renderer.getClearColor(this._oldClearColor);
      oldClearAlpha = renderer.getClearAlpha();
      renderer.setClearColor(this.clearColor, this.clearAlpha);
    }
    renderer.setRenderTarget(this.renderToScreen ? null : readBuffer);
    renderer.clear();
    if (this.clearColor) {
      renderer.setClearColor(this._oldClearColor, oldClearAlpha);
    }
  }
}
export {
  ClearPass
};
//# sourceMappingURL=ClearPass.js.map
