import { Matrix4, Vector3, SphereGeometry, BoxGeometry, MeshStandardMaterial, InstancedMesh, DynamicDrawUsage } from "three";
const _matrix = new Matrix4();
const _vector = new Vector3();
class XRHandPrimitiveModel {
  constructor(handModel, controller, path, handedness, options) {
    this.controller = controller;
    this.handModel = handModel;
    this.envMap = null;
    let geometry;
    if (!options || !options.primitive || options.primitive === "sphere") {
      geometry = new SphereGeometry(1, 10, 10);
    } else if (options.primitive === "box") {
      geometry = new BoxGeometry(1, 1, 1);
    }
    const material = new MeshStandardMaterial();
    this.handMesh = new InstancedMesh(geometry, material, 30);
    this.handMesh.instanceMatrix.setUsage(DynamicDrawUsage);
    this.handMesh.castShadow = true;
    this.handMesh.receiveShadow = true;
    this.handModel.add(this.handMesh);
    this.joints = [
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
  }
  updateMesh() {
    const defaultRadius = 8e-3;
    const joints = this.controller.joints;
    let count = 0;
    for (let i = 0; i < this.joints.length; i++) {
      const joint = joints[this.joints[i]];
      if (joint.visible) {
        _vector.setScalar(joint.jointRadius || defaultRadius);
        _matrix.compose(joint.position, joint.quaternion, _vector);
        this.handMesh.setMatrixAt(i, _matrix);
        count++;
      }
    }
    this.handMesh.count = count;
    this.handMesh.instanceMatrix.needsUpdate = true;
  }
}
export {
  XRHandPrimitiveModel
};
//# sourceMappingURL=XRHandPrimitiveModel.js.map
