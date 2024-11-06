"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const THREE = require("three");
const XRHandPrimitiveModel = require("./XRHandPrimitiveModel.cjs");
const XRHandMeshModel = require("./XRHandMeshModel.cjs");
class XRHandModel extends THREE.Object3D {
  constructor(controller) {
    super();
    this.controller = controller;
    this.motionController = null;
    this.envMap = null;
    this.mesh = null;
  }
  updateMatrixWorld(force) {
    super.updateMatrixWorld(force);
    if (this.motionController) {
      this.motionController.updateMesh();
    }
  }
}
class XRHandModelFactory {
  constructor() {
    this.path = null;
  }
  setPath(path) {
    this.path = path;
    return this;
  }
  createHandModel(controller, profile) {
    const handModel = new XRHandModel(controller);
    controller.addEventListener("connected", (event) => {
      const xrInputSource = event.data;
      if (xrInputSource.hand && !handModel.motionController) {
        handModel.xrInputSource = xrInputSource;
        if (profile === void 0 || profile === "spheres") {
          handModel.motionController = new XRHandPrimitiveModel.XRHandPrimitiveModel(
            handModel,
            controller,
            this.path,
            xrInputSource.handedness,
            { primitive: "sphere" }
          );
        } else if (profile === "boxes") {
          handModel.motionController = new XRHandPrimitiveModel.XRHandPrimitiveModel(
            handModel,
            controller,
            this.path,
            xrInputSource.handedness,
            { primitive: "box" }
          );
        } else if (profile === "mesh") {
          handModel.motionController = new XRHandMeshModel.XRHandMeshModel(handModel, controller, this.path, xrInputSource.handedness);
        }
      }
    });
    controller.addEventListener("disconnected", () => {
    });
    return handModel;
  }
}
exports.XRHandModelFactory = XRHandModelFactory;
//# sourceMappingURL=XRHandModelFactory.cjs.map
