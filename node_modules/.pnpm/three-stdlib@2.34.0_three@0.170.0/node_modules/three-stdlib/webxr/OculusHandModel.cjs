"use strict";
var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => {
  __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const THREE = require("three");
const XRHandMeshModel = require("./XRHandMeshModel.cjs");
const TOUCH_RADIUS = 0.01;
const POINTING_JOINT = "index-finger-tip";
class OculusHandModel extends THREE.Object3D {
  constructor(controller, leftModelPath, rightModelPath) {
    super();
    __publicField(this, "controller");
    __publicField(this, "motionController");
    __publicField(this, "envMap");
    __publicField(this, "mesh");
    __publicField(this, "xrInputSource");
    this.controller = controller;
    this.motionController = null;
    this.envMap = null;
    this.mesh = null;
    this.xrInputSource = null;
    controller.addEventListener("connected", (event) => {
      const xrInputSource = event.data;
      if (xrInputSource.hand && !this.motionController) {
        this.xrInputSource = xrInputSource;
        this.motionController = new XRHandMeshModel.XRHandMeshModel(
          this,
          controller,
          void 0,
          xrInputSource.handedness,
          xrInputSource.handedness === "left" ? leftModelPath : rightModelPath
        );
      }
    });
    controller.addEventListener("disconnected", () => {
      this.dispose();
    });
  }
  updateMatrixWorld(force) {
    super.updateMatrixWorld(force);
    if (this.motionController) {
      this.motionController.updateMesh();
    }
  }
  getPointerPosition() {
    const indexFingerTip = this.controller.joints[POINTING_JOINT];
    if (indexFingerTip) {
      return indexFingerTip.position;
    } else {
      return null;
    }
  }
  intersectBoxObject(boxObject) {
    const pointerPosition = this.getPointerPosition();
    if (pointerPosition) {
      const indexSphere = new THREE.Sphere(pointerPosition, TOUCH_RADIUS);
      const box = new THREE.Box3().setFromObject(boxObject);
      return indexSphere.intersectsBox(box);
    } else {
      return false;
    }
  }
  checkButton(button) {
    if (this.intersectBoxObject(button)) {
      button.onPress();
    } else {
      button.onClear();
    }
    if (button.isPressed()) {
      button.whilePressed();
    }
  }
  dispose() {
    this.clear();
    this.motionController = null;
  }
}
exports.OculusHandModel = OculusHandModel;
//# sourceMappingURL=OculusHandModel.cjs.map
