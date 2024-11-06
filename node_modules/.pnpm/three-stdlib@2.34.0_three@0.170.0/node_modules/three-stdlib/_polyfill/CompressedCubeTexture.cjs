"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const THREE = require("three");
class CompressedCubeTexture extends THREE.CompressedTexture {
  constructor(images, format, type) {
    super(void 0, images[0].width, images[0].height, format, type, THREE.CubeReflectionMapping);
    this.isCompressedCubeTexture = true;
    this.isCubeTexture = true;
    this.image = images;
  }
}
exports.CompressedCubeTexture = CompressedCubeTexture;
//# sourceMappingURL=CompressedCubeTexture.cjs.map
