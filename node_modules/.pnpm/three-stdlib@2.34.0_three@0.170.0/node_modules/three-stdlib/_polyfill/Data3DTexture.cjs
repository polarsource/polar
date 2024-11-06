"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const THREE = require("three");
class Data3DTexture extends THREE.Texture {
  constructor(data = null, width = 1, height = 1, depth = 1) {
    super(null);
    this.isData3DTexture = true;
    this.image = { data, width, height, depth };
    this.magFilter = THREE.NearestFilter;
    this.minFilter = THREE.NearestFilter;
    this.wrapR = THREE.ClampToEdgeWrapping;
    this.generateMipmaps = false;
    this.flipY = false;
    this.unpackAlignment = 1;
  }
}
exports.Data3DTexture = Data3DTexture;
//# sourceMappingURL=Data3DTexture.cjs.map
