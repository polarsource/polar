"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const THREE = require("three");
class MDDLoader extends THREE.Loader {
  constructor(manager) {
    super(manager);
  }
  load(url, onLoad, onProgress, onError) {
    const scope = this;
    const loader = new THREE.FileLoader(this.manager);
    loader.setPath(this.path);
    loader.setResponseType("arraybuffer");
    loader.load(
      url,
      function(data) {
        onLoad(scope.parse(data));
      },
      onProgress,
      onError
    );
  }
  parse(data) {
    const view = new DataView(data);
    const totalFrames = view.getUint32(0);
    const totalPoints = view.getUint32(4);
    let offset = 8;
    const times = new Float32Array(totalFrames);
    const values = new Float32Array(totalFrames * totalFrames).fill(0);
    for (let i = 0; i < totalFrames; i++) {
      times[i] = view.getFloat32(offset);
      offset += 4;
      values[totalFrames * i + i] = 1;
    }
    const track = new THREE.NumberKeyframeTrack(".morphTargetInfluences", times, values);
    const clip = new THREE.AnimationClip("default", times[times.length - 1], [track]);
    const morphTargets = [];
    for (let i = 0; i < totalFrames; i++) {
      const morphTarget = new Float32Array(totalPoints * 3);
      for (let j = 0; j < totalPoints; j++) {
        const stride = j * 3;
        morphTarget[stride + 0] = view.getFloat32(offset);
        offset += 4;
        morphTarget[stride + 1] = view.getFloat32(offset);
        offset += 4;
        morphTarget[stride + 2] = view.getFloat32(offset);
        offset += 4;
      }
      const attribute = new THREE.BufferAttribute(morphTarget, 3);
      attribute.name = "morph_" + i;
      morphTargets.push(attribute);
    }
    return {
      morphTargets,
      clip
    };
  }
}
exports.MDDLoader = MDDLoader;
//# sourceMappingURL=MDDLoader.cjs.map
