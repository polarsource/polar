import { CompressedTexture, CubeReflectionMapping } from "three";
class CompressedCubeTexture extends CompressedTexture {
  constructor(images, format, type) {
    super(void 0, images[0].width, images[0].height, format, type, CubeReflectionMapping);
    this.isCompressedCubeTexture = true;
    this.isCubeTexture = true;
    this.image = images;
  }
}
export {
  CompressedCubeTexture
};
//# sourceMappingURL=CompressedCubeTexture.js.map
