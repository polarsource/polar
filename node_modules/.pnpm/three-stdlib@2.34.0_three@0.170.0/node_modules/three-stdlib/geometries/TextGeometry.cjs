"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const THREE = require("three");
class TextGeometry extends THREE.ExtrudeGeometry {
  constructor(text, parameters = {}) {
    const {
      bevelEnabled = false,
      bevelSize = 8,
      bevelThickness = 10,
      font,
      height = 50,
      size = 100,
      lineHeight = 1,
      letterSpacing = 0,
      ...rest
    } = parameters;
    if (font === void 0) {
      super();
    } else {
      const shapes = font.generateShapes(text, size, { lineHeight, letterSpacing });
      super(shapes, { ...rest, bevelEnabled, bevelSize, bevelThickness, depth: height });
    }
    this.type = "TextGeometry";
  }
}
exports.TextBufferGeometry = TextGeometry;
exports.TextGeometry = TextGeometry;
//# sourceMappingURL=TextGeometry.cjs.map
