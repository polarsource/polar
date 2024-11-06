"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const THREE = require("three");
class CompressedArrayTexture extends THREE.CompressedTexture {
  constructor(mipmaps, width, height, depth, format, type) {
    super(mipmaps, width, height, format, type);
    this.isCompressedArrayTexture = true;
    this.image.depth = depth;
    this.wrapR = THREE.ClampToEdgeWrapping;
  }
}
exports.CompressedArrayTexture = CompressedArrayTexture;
//# sourceMappingURL=CompressedArrayTexture.cjs.map
