import { Texture, NearestFilter, ClampToEdgeWrapping } from "three";
class Data3DTexture extends Texture {
  constructor(data = null, width = 1, height = 1, depth = 1) {
    super(null);
    this.isData3DTexture = true;
    this.image = { data, width, height, depth };
    this.magFilter = NearestFilter;
    this.minFilter = NearestFilter;
    this.wrapR = ClampToEdgeWrapping;
    this.generateMipmaps = false;
    this.flipY = false;
    this.unpackAlignment = 1;
  }
}
export {
  Data3DTexture
};
//# sourceMappingURL=Data3DTexture.js.map
