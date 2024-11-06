var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => {
  __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
import { Object3D, Mesh, SphereGeometry, MeshBasicMaterial } from "three";
import { GLTFLoader } from "../loaders/GLTFLoader.js";
import { MotionControllerConstants, fetchProfile, MotionController } from "../libs/MotionControllers.js";
const DEFAULT_PROFILES_PATH = "https://cdn.jsdelivr.net/npm/@webxr-input-profiles/assets@1.0/dist/profiles";
const DEFAULT_PROFILE = "generic-trigger";
const applyEnvironmentMap = (envMap, obj) => {
  obj.traverse((child) => {
    if (child instanceof Mesh && "envMap" in child.material) {
      child.material.envMap = envMap;
      child.material.needsUpdate = true;
    }
  });
};
class XRControllerModel extends Object3D {
  constructor() {
    super();
    __publicField(this, "envMap");
    __publicField(this, "motionController");
    this.motionController = null;
    this.envMap = null;
  }
  setEnvironmentMap(envMap) {
    if (this.envMap == envMap) {
      return this;
    }
    this.envMap = envMap;
    applyEnvironmentMap(this.envMap, this);
    return this;
  }
  /**
   * Polls data from the XRInputSource and updates the model's components to match
   * the real world data
   */
  updateMatrixWorld(force) {
    super.updateMatrixWorld(force);
    if (!this.motionController)
      return;
    this.motionController.updateFromGamepad();
    Object.values(this.motionController.components).forEach((component) => {
      Object.values(component.visualResponses).forEach((visualResponse) => {
        const { valueNode, minNode, maxNode, value, valueNodeProperty } = visualResponse;
        if (!valueNode)
          return;
        if (valueNodeProperty === MotionControllerConstants.VisualResponseProperty.VISIBILITY && typeof value === "boolean") {
          valueNode.visible = value;
        } else if (valueNodeProperty === MotionControllerConstants.VisualResponseProperty.TRANSFORM && minNode && maxNode && typeof value === "number") {
          valueNode.quaternion.slerpQuaternions(minNode.quaternion, maxNode.quaternion, value);
          valueNode.position.lerpVectors(minNode.position, maxNode.position, value);
        }
      });
    });
  }
}
function findNodes(motionController, scene) {
  Object.values(motionController.components).forEach((component) => {
    const { type, touchPointNodeName, visualResponses } = component;
    if (type === MotionControllerConstants.ComponentType.TOUCHPAD && touchPointNodeName) {
      component.touchPointNode = scene.getObjectByName(touchPointNodeName);
      if (component.touchPointNode) {
        const sphereGeometry = new SphereGeometry(1e-3);
        const material = new MeshBasicMaterial({ color: 255 });
        const sphere = new Mesh(sphereGeometry, material);
        component.touchPointNode.add(sphere);
      } else {
        console.warn(`Could not find touch dot, ${component.touchPointNodeName}, in touchpad component ${component.id}`);
      }
    }
    Object.values(visualResponses).forEach((visualResponse) => {
      const { valueNodeName, minNodeName, maxNodeName, valueNodeProperty } = visualResponse;
      if (valueNodeProperty === MotionControllerConstants.VisualResponseProperty.TRANSFORM && minNodeName && maxNodeName) {
        visualResponse.minNode = scene.getObjectByName(minNodeName);
        visualResponse.maxNode = scene.getObjectByName(maxNodeName);
        if (!visualResponse.minNode) {
          console.warn(`Could not find ${minNodeName} in the model`);
          return;
        }
        if (!visualResponse.maxNode) {
          console.warn(`Could not find ${maxNodeName} in the model`);
          return;
        }
      }
      visualResponse.valueNode = scene.getObjectByName(valueNodeName);
      if (!visualResponse.valueNode) {
        console.warn(`Could not find ${valueNodeName} in the model`);
      }
    });
  });
}
function addAssetSceneToControllerModel(controllerModel, scene) {
  findNodes(controllerModel.motionController, scene);
  if (controllerModel.envMap) {
    applyEnvironmentMap(controllerModel.envMap, scene);
  }
  controllerModel.add(scene);
}
class XRControllerModelFactory {
  constructor(gltfLoader = null) {
    __publicField(this, "gltfLoader");
    __publicField(this, "path");
    __publicField(this, "_assetCache");
    this.gltfLoader = gltfLoader;
    this.path = DEFAULT_PROFILES_PATH;
    this._assetCache = {};
    if (!this.gltfLoader) {
      this.gltfLoader = new GLTFLoader();
    }
  }
  createControllerModel(controller) {
    const controllerModel = new XRControllerModel();
    let scene = null;
    const onConnected = (event) => {
      const xrInputSource = event.data;
      if (xrInputSource.targetRayMode !== "tracked-pointer" || !xrInputSource.gamepad)
        return;
      fetchProfile(xrInputSource, this.path, DEFAULT_PROFILE).then(({ profile, assetPath }) => {
        if (!assetPath) {
          throw new Error("no asset path");
        }
        controllerModel.motionController = new MotionController(xrInputSource, profile, assetPath);
        const assetUrl = controllerModel.motionController.assetUrl;
        const cachedAsset = this._assetCache[assetUrl];
        if (cachedAsset) {
          scene = cachedAsset.scene.clone();
          addAssetSceneToControllerModel(controllerModel, scene);
        } else {
          if (!this.gltfLoader) {
            throw new Error("GLTFLoader not set.");
          }
          this.gltfLoader.setPath("");
          this.gltfLoader.load(
            controllerModel.motionController.assetUrl,
            (asset) => {
              if (!controllerModel.motionController) {
                console.warn("motionController gone while gltf load, bailing...");
                return;
              }
              this._assetCache[assetUrl] = asset;
              scene = asset.scene.clone();
              addAssetSceneToControllerModel(controllerModel, scene);
            },
            () => {
            },
            () => {
              throw new Error(`Asset ${assetUrl} missing or malformed.`);
            }
          );
        }
      }).catch((err) => {
        console.warn(err);
      });
    };
    controller.addEventListener("connected", onConnected);
    const onDisconnected = () => {
      controller.removeEventListener("connected", onConnected);
      controller.removeEventListener("disconnected", onDisconnected);
      controllerModel.motionController = null;
      if (scene) {
        controllerModel.remove(scene);
      }
      scene = null;
    };
    controller.addEventListener("disconnected", onDisconnected);
    return controllerModel;
  }
}
export {
  XRControllerModelFactory
};
//# sourceMappingURL=XRControllerModelFactory.js.map
