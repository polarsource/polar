var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => {
  __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
import { GLTFLoader } from "../loaders/GLTFLoader.js";
const DEFAULT_HAND_PROFILE_PATH = "https://cdn.jsdelivr.net/npm/@webxr-input-profiles/assets@1.0/dist/profiles/generic-hand/";
class XRHandMeshModel {
  constructor(handModel, controller, path = DEFAULT_HAND_PROFILE_PATH, handedness, customModelPath) {
    __publicField(this, "controller");
    __publicField(this, "handModel");
    __publicField(this, "bones");
    this.controller = controller;
    this.handModel = handModel;
    this.bones = [];
    const loader = new GLTFLoader();
    if (!customModelPath)
      loader.setPath(path);
    loader.load(customModelPath != null ? customModelPath : `${handedness}.glb`, (gltf) => {
      const object = gltf.scene.children[0];
      this.handModel.add(object);
      const mesh = object.getObjectByProperty("type", "SkinnedMesh");
      mesh.frustumCulled = false;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      const joints = [
        "wrist",
        "thumb-metacarpal",
        "thumb-phalanx-proximal",
        "thumb-phalanx-distal",
        "thumb-tip",
        "index-finger-metacarpal",
        "index-finger-phalanx-proximal",
        "index-finger-phalanx-intermediate",
        "index-finger-phalanx-distal",
        "index-finger-tip",
        "middle-finger-metacarpal",
        "middle-finger-phalanx-proximal",
        "middle-finger-phalanx-intermediate",
        "middle-finger-phalanx-distal",
        "middle-finger-tip",
        "ring-finger-metacarpal",
        "ring-finger-phalanx-proximal",
        "ring-finger-phalanx-intermediate",
        "ring-finger-phalanx-distal",
        "ring-finger-tip",
        "pinky-finger-metacarpal",
        "pinky-finger-phalanx-proximal",
        "pinky-finger-phalanx-intermediate",
        "pinky-finger-phalanx-distal",
        "pinky-finger-tip"
      ];
      joints.forEach((jointName) => {
        const bone = object.getObjectByName(jointName);
        if (bone !== void 0) {
          bone.jointName = jointName;
        } else {
          console.warn(`Couldn't find ${jointName} in ${handedness} hand mesh`);
        }
        this.bones.push(bone);
      });
    });
  }
  updateMesh() {
    const XRJoints = this.controller.joints;
    for (let i = 0; i < this.bones.length; i++) {
      const bone = this.bones[i];
      if (bone) {
        const XRJoint = XRJoints[bone.jointName];
        if (XRJoint.visible) {
          const position = XRJoint.position;
          bone.position.copy(position);
          bone.quaternion.copy(XRJoint.quaternion);
        }
      }
    }
  }
}
export {
  XRHandMeshModel
};
//# sourceMappingURL=XRHandMeshModel.js.map
