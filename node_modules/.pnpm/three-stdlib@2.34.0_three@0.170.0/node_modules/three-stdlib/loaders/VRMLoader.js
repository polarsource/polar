import { Loader } from "three";
import { GLTFLoader } from "./GLTFLoader.js";
class VRMLoader extends Loader {
  constructor(manager) {
    super(manager);
    this.gltfLoader = new GLTFLoader(manager);
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
export {
  VRMLoader
};
//# sourceMappingURL=VRMLoader.js.map
