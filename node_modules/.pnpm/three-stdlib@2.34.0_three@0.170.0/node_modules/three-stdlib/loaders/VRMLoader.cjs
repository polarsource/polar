"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const THREE = require("three");
const GLTFLoader = require("./GLTFLoader.cjs");
class VRMLoader extends THREE.Loader {
  constructor(manager) {
    super(manager);
    this.gltfLoader = new GLTFLoader.GLTFLoader(manager);
  }
  load(url, onLoad, onProgress, onError) {
    const scope = this;
    this.gltfLoader.load(
      url,
      function(gltf) {
        try {
          scope.parse(gltf, onLoad);
        } catch (e) {
          if (onError) {
            onError(e);
          } else {
            console.error(e);
          }
          scope.manager.itemError(url);
        }
      },
      onProgress,
      onError
    );
  }
  setDRACOLoader(dracoLoader) {
    this.gltfLoader.setDRACOLoader(dracoLoader);
    return this;
  }
  parse(gltf, onLoad) {
    onLoad(gltf);
  }
}
exports.VRMLoader = VRMLoader;
//# sourceMappingURL=VRMLoader.cjs.map
