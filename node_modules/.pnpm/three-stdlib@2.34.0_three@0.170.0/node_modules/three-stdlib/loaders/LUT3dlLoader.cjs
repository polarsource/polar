"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const THREE = require("three");
const Data3DTexture = require("../_polyfill/Data3DTexture.cjs");
class LUT3dlLoader extends THREE.Loader {
  load(url, onLoad, onProgress, onError) {
    const loader = new THREE.FileLoader(this.manager);
    loader.setPath(this.path);
    loader.setResponseType("text");
    loader.load(
      url,
      (text) => {
        try {
          onLoad(this.parse(text));
        } catch (e) {
          if (onError) {
            onError(e);
          } else {
            console.error(e);
          }
          this.manager.itemError(url);
        }
      },
      onProgress,
      onError
    );
  }
  parse(str) {
    str = str.replace(/^#.*?(\n|\r)/gm, "").replace(/^\s*?(\n|\r)/gm, "").trim();
    const lines = str.split(/[\n\r]+/g);
    const gridLines = lines[0].trim().split(/\s+/g).map((e) => parseFloat(e));
    const gridStep = gridLines[1] - gridLines[0];
    const size = gridLines.length;
    for (let i = 1, l = gridLines.length; i < l; i++) {
      if (gridStep !== gridLines[i] - gridLines[i - 1]) {
        throw new Error("LUT3dlLoader: Inconsistent grid size not supported.");
      }
    }
    const dataArray = new Array(size * size * size * 4);
    let index = 0;
    let maxOutputValue = 0;
    for (let i = 1, l = lines.length; i < l; i++) {
      const line = lines[i].trim();
      const split = line.split(/\s/g);
      const r = parseFloat(split[0]);
      const g = parseFloat(split[1]);
      const b = parseFloat(split[2]);
      maxOutputValue = Math.max(maxOutputValue, r, g, b);
      const bLayer = index % size;
      const gLayer = Math.floor(index / size) % size;
      const rLayer = Math.floor(index / (size * size)) % size;
      const pixelIndex = bLayer * size * size + gLayer * size + rLayer;
      dataArray[4 * pixelIndex + 0] = r;
      dataArray[4 * pixelIndex + 1] = g;
      dataArray[4 * pixelIndex + 2] = b;
      dataArray[4 * pixelIndex + 3] = 1;
      index += 1;
    }
    const bits = Math.ceil(Math.log2(maxOutputValue));
    const maxBitValue = Math.pow(2, bits);
    for (let i = 0, l = dataArray.length; i < l; i += 4) {
      const r = dataArray[i + 0];
      const g = dataArray[i + 1];
      const b = dataArray[i + 2];
      dataArray[i + 0] = 255 * r / maxBitValue;
      dataArray[i + 1] = 255 * g / maxBitValue;
      dataArray[i + 2] = 255 * b / maxBitValue;
    }
    const data = new Uint8Array(dataArray);
    const texture = new THREE.DataTexture();
    texture.image.data = data;
    texture.image.width = size;
    texture.image.height = size * size;
    texture.format = THREE.RGBAFormat;
    texture.type = THREE.UnsignedByteType;
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearFilter;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.generateMipmaps = false;
    texture.needsUpdate = true;
    const texture3D = new Data3DTexture.Data3DTexture();
    texture3D.image.data = data;
    texture3D.image.width = size;
    texture3D.image.height = size;
    texture3D.image.depth = size;
    texture3D.format = THREE.RGBAFormat;
    texture3D.type = THREE.UnsignedByteType;
    texture3D.magFilter = THREE.LinearFilter;
    texture3D.minFilter = THREE.LinearFilter;
    texture3D.wrapS = THREE.ClampToEdgeWrapping;
    texture3D.wrapT = THREE.ClampToEdgeWrapping;
    texture3D.wrapR = THREE.ClampToEdgeWrapping;
    texture3D.generateMipmaps = false;
    texture3D.needsUpdate = true;
    return {
      size,
      texture,
      texture3D
    };
  }
}
exports.LUT3dlLoader = LUT3dlLoader;
//# sourceMappingURL=LUT3dlLoader.cjs.map
