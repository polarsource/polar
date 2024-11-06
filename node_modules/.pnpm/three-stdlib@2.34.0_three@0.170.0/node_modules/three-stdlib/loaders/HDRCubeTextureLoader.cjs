"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const THREE = require("three");
const RGBELoader = require("./RGBELoader.cjs");
class HDRCubeTextureLoader extends THREE.Loader {
  constructor(manager) {
    super(manager);
    this.hdrLoader = new RGBELoader.RGBELoader();
    this.type = THREE.HalfFloatType;
  }
  load(urls, onLoad, onProgress, onError) {
    if (typeof urls === "string") {
      urls = [urls];
    } else if (!Array.isArray(urls)) {
      console.warn("THREE.HDRCubeTextureLoader signature has changed. Use .setDataType() instead.");
      this.setDataType(urls);
      urls = onLoad;
      onLoad = onProgress;
      onProgress = onError;
      onError = arguments[4];
    }
    const texture = new THREE.CubeTexture();
    texture.type = this.type;
    switch (texture.type) {
      case THREE.FloatType:
      case THREE.HalfFloatType:
        if ("colorSpace" in texture)
          texture.colorSpace = "srgb-linear";
        else
          texture.encoding = 3e3;
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.generateMipmaps = false;
        break;
    }
    const scope = this;
    let loaded = 0;
    function loadHDRData(i, onLoad2, onProgress2, onError2) {
      new THREE.FileLoader(scope.manager).setPath(scope.path).setResponseType("arraybuffer").setWithCredentials(scope.withCredentials).load(
        urls[i],
        function(buffer) {
          loaded++;
          const texData = scope.hdrLoader.parse(buffer);
          if (!texData)
            return;
          if (texData.data !== void 0) {
            const dataTexture = new THREE.DataTexture(texData.data, texData.width, texData.height);
            dataTexture.type = texture.type;
            if ("colorSpace" in dataTexture)
              dataTexture.colorSpace = texture.SRGBColorSpace;
            else
              dataTexture.encoding = texture.encoding;
            dataTexture.format = texture.format;
            dataTexture.minFilter = texture.minFilter;
            dataTexture.magFilter = texture.magFilter;
            dataTexture.generateMipmaps = texture.generateMipmaps;
            texture.images[i] = dataTexture;
          }
          if (loaded === 6) {
            texture.needsUpdate = true;
            if (onLoad2)
              onLoad2(texture);
          }
        },
        onProgress2,
        onError2
      );
    }
    for (let i = 0; i < urls.length; i++) {
      loadHDRData(i, onLoad, onProgress, onError);
    }
    return texture;
  }
  setDataType(value) {
    this.type = value;
    this.hdrLoader.setDataType(value);
    return this;
  }
}
exports.HDRCubeTextureLoader = HDRCubeTextureLoader;
//# sourceMappingURL=HDRCubeTextureLoader.cjs.map
