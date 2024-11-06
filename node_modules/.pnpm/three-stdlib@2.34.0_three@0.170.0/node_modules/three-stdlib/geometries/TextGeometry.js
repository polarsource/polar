import { ExtrudeGeometry } from "three";
class TextGeometry extends ExtrudeGeometry {
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
export {
  TextGeometry as TextBufferGeometry,
  TextGeometry
};
//# sourceMappingURL=TextGeometry.js.map
