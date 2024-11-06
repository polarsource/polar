"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const THREE = require("three");
class LightProbeGenerator {
  // https://www.ppsloan.org/publications/StupidSH36.pdf
  static fromCubeTexture(cubeTexture) {
    let totalWeight = 0;
    const coord = new THREE.Vector3();
    const dir = new THREE.Vector3();
    const color = new THREE.Color();
    const shBasis = [0, 0, 0, 0, 0, 0, 0, 0, 0];
    const sh = new THREE.SphericalHarmonics3();
    const shCoefficients = sh.coefficients;
    for (let faceIndex = 0; faceIndex < 6; faceIndex++) {
      const image = cubeTexture.image[faceIndex];
      const width = image.width;
      const height = image.height;
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      context.drawImage(image, 0, 0, width, height);
      const imageData = context.getImageData(0, 0, width, height);
      const data = imageData.data;
      const imageWidth = imageData.width;
      const pixelSize = 2 / imageWidth;
      for (let i = 0, il = data.length; i < il; i += 4) {
        color.setRGB(data[i] / 255, data[i + 1] / 255, data[i + 2] / 255);
        if ("colorSpace" in cubeTexture) {
          if (cubeTexture.colorSpace === "srgb") {
            color.convertSRGBToLinear();
          }
        } else if (cubeTexture.encoding === 3001) {
          color.convertSRGBToLinear();
        }
        const pixelIndex = i / 4;
        const col = -1 + (pixelIndex % imageWidth + 0.5) * pixelSize;
        const row = 1 - (Math.floor(pixelIndex / imageWidth) + 0.5) * pixelSize;
        switch (faceIndex) {
          case 0:
            coord.set(-1, row, -col);
            break;
          case 1:
            coord.set(1, row, col);
            break;
          case 2:
            coord.set(-col, 1, -row);
            break;
          case 3:
            coord.set(-col, -1, row);
            break;
          case 4:
            coord.set(-col, row, 1);
            break;
          case 5:
            coord.set(col, row, -1);
            break;
        }
        const lengthSq = coord.lengthSq();
        const weight = 4 / (Math.sqrt(lengthSq) * lengthSq);
        totalWeight += weight;
        dir.copy(coord).normalize();
        THREE.SphericalHarmonics3.getBasisAt(dir, shBasis);
        for (let j = 0; j < 9; j++) {
          shCoefficients[j].x += shBasis[j] * color.r * weight;
          shCoefficients[j].y += shBasis[j] * color.g * weight;
          shCoefficients[j].z += shBasis[j] * color.b * weight;
        }
      }
    }
    const norm = 4 * Math.PI / totalWeight;
    for (let j = 0; j < 9; j++) {
      shCoefficients[j].x *= norm;
      shCoefficients[j].y *= norm;
      shCoefficients[j].z *= norm;
    }
    return new THREE.LightProbe(sh);
  }
  static fromCubeRenderTarget(renderer, cubeRenderTarget) {
    let totalWeight = 0;
    const coord = new THREE.Vector3();
    const dir = new THREE.Vector3();
    const color = new THREE.Color();
    const shBasis = [0, 0, 0, 0, 0, 0, 0, 0, 0];
    const sh = new THREE.SphericalHarmonics3();
    const shCoefficients = sh.coefficients;
    for (let faceIndex = 0; faceIndex < 6; faceIndex++) {
      const imageWidth = cubeRenderTarget.width;
      const data = new Uint8Array(imageWidth * imageWidth * 4);
      renderer.readRenderTargetPixels(cubeRenderTarget, 0, 0, imageWidth, imageWidth, data, faceIndex);
      const pixelSize = 2 / imageWidth;
      for (let i = 0, il = data.length; i < il; i += 4) {
        color.setRGB(data[i] / 255, data[i + 1] / 255, data[i + 2] / 255);
        if ("colorSpace" in cubeRenderTarget.texture) {
          if (cubeRenderTarget.texture.colorSpace === "srgb") {
            color.convertSRGBToLinear();
          }
        } else if (cubeRenderTarget.texture.encoding === 3001) {
          color.convertSRGBToLinear();
        }
        const pixelIndex = i / 4;
        const col = -1 + (pixelIndex % imageWidth + 0.5) * pixelSize;
        const row = 1 - (Math.floor(pixelIndex / imageWidth) + 0.5) * pixelSize;
        switch (faceIndex) {
          case 0:
            coord.set(1, row, -col);
            break;
          case 1:
            coord.set(-1, row, col);
            break;
          case 2:
            coord.set(col, 1, -row);
            break;
          case 3:
            coord.set(col, -1, row);
            break;
          case 4:
            coord.set(col, row, 1);
            break;
          case 5:
            coord.set(-col, row, -1);
            break;
        }
        const lengthSq = coord.lengthSq();
        const weight = 4 / (Math.sqrt(lengthSq) * lengthSq);
        totalWeight += weight;
        dir.copy(coord).normalize();
        THREE.SphericalHarmonics3.getBasisAt(dir, shBasis);
        for (let j = 0; j < 9; j++) {
          shCoefficients[j].x += shBasis[j] * color.r * weight;
          shCoefficients[j].y += shBasis[j] * color.g * weight;
          shCoefficients[j].z += shBasis[j] * color.b * weight;
        }
      }
    }
    const norm = 4 * Math.PI / totalWeight;
    for (let j = 0; j < 9; j++) {
      shCoefficients[j].x *= norm;
      shCoefficients[j].y *= norm;
      shCoefficients[j].z *= norm;
    }
    return new THREE.LightProbe(sh);
  }
}
exports.LightProbeGenerator = LightProbeGenerator;
//# sourceMappingURL=LightProbeGenerator.cjs.map
