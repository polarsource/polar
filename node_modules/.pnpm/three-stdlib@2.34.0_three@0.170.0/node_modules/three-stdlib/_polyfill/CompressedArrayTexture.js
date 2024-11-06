import { CompressedTexture, ClampToEdgeWrapping } from "three";
class CompressedArrayTexture extends CompressedTexture {
  constructor(mipmaps, width, height, depth, format, type) {
    super(mipmaps, width, height, format, type);
    this.isCompressedArrayTexture = true;
    this.image.depth = depth;
    this.wrapR = ClampToEdgeWrapping;
  }
}
export {
  CompressedArrayTexture
};
//# sourceMappingURL=CompressedArrayTexture.js.map
