"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const THREE = require("three");
const lottie = require("../libs/lottie.cjs");
class LottieLoader extends THREE.Loader {
  setQuality(value) {
    this._quality = value;
  }
  load(url, onLoad, onProgress, onError) {
    const quality = this._quality || 1;
    const texture = new THREE.CanvasTexture();
    texture.minFilter = THREE.NearestFilter;
    const loader = new THREE.FileLoader(this.manager);
    loader.setPath(this.path);
    loader.setWithCredentials(this.withCredentials);
    loader.load(
      url,
      function(text) {
        const data = JSON.parse(text);
        const container = document.createElement("div");
        container.style.width = data.w + "px";
        container.style.height = data.h + "px";
        document.body.appendChild(container);
        const animation = lottie.loadAnimation({
          container,
          animType: "canvas",
          loop: true,
          autoplay: true,
          animationData: data,
          rendererSettings: { dpr: quality }
        });
        texture.animation = animation;
        texture.image = animation.container;
        animation.addEventListener("enterFrame", function() {
          texture.needsUpdate = true;
        });
        container.style.display = "none";
        if (onLoad !== void 0) {
          onLoad(texture);
        }
      },
      onProgress,
      onError
    );
    return texture;
  }
}
exports.LottieLoader = LottieLoader;
//# sourceMappingURL=LottieLoader.cjs.map
