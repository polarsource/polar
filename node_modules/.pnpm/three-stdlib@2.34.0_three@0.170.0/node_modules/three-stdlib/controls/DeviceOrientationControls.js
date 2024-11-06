var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => {
  __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
import { EventDispatcher, Vector3, Euler, Quaternion, MathUtils } from "three";
class DeviceOrientationControls extends EventDispatcher {
  // radians
  constructor(object) {
    super();
    __publicField(this, "object");
    __publicField(this, "changeEvent", { type: "change" });
    __publicField(this, "EPS", 1e-6);
    __publicField(this, "enabled", true);
    __publicField(this, "deviceOrientation", { alpha: 0, beta: 0, gamma: 0 });
    __publicField(this, "screenOrientation", 0);
    __publicField(this, "alphaOffset", 0);
    __publicField(this, "onDeviceOrientationChangeEvent", (event) => {
      this.deviceOrientation = event;
    });
    __publicField(this, "onScreenOrientationChangeEvent", () => {
      this.screenOrientation = window.orientation || 0;
    });
    // The angles alpha, beta and gamma form a set of intrinsic Tait-Bryan angles of type Z-X'-Y''
    __publicField(this, "zee", new Vector3(0, 0, 1));
    __publicField(this, "euler", new Euler());
    __publicField(this, "q0", new Quaternion());
    __publicField(this, "q1", new Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5)));
    // - PI/2 around the x-axis
    __publicField(this, "setObjectQuaternion", (quaternion, alpha, beta, gamma, orient) => {
      this.euler.set(beta, alpha, -gamma, "YXZ");
      quaternion.setFromEuler(this.euler);
      quaternion.multiply(this.q1);
      quaternion.multiply(this.q0.setFromAxisAngle(this.zee, -orient));
    });
    __publicField(this, "connect", () => {
      this.onScreenOrientationChangeEvent();
      if (window.DeviceOrientationEvent !== void 0 && // @ts-ignore
      typeof window.DeviceOrientationEvent.requestPermission === "function") {
        window.DeviceOrientationEvent.requestPermission().then((response) => {
          if (response == "granted") {
            window.addEventListener("orientationchange", this.onScreenOrientationChangeEvent);
            window.addEventListener("deviceorientation", this.onDeviceOrientationChangeEvent);
          }
        }).catch((error) => {
          console.error("THREE.DeviceOrientationControls: Unable to use DeviceOrientation API:", error);
        });
      } else {
        window.addEventListener("orientationchange", this.onScreenOrientationChangeEvent);
        window.addEventListener("deviceorientation", this.onDeviceOrientationChangeEvent);
      }
      this.enabled = true;
    });
    __publicField(this, "disconnect", () => {
      window.removeEventListener("orientationchange", this.onScreenOrientationChangeEvent);
      window.removeEventListener("deviceorientation", this.onDeviceOrientationChangeEvent);
      this.enabled = false;
    });
    __publicField(this, "lastQuaternion", new Quaternion());
    __publicField(this, "update", () => {
      if (this.enabled === false)
        return;
      const device = this.deviceOrientation;
      if (device) {
        const alpha = device.alpha ? MathUtils.degToRad(device.alpha) + this.alphaOffset : 0;
        const beta = device.beta ? MathUtils.degToRad(device.beta) : 0;
        const gamma = device.gamma ? MathUtils.degToRad(device.gamma) : 0;
        const orient = this.screenOrientation ? MathUtils.degToRad(this.screenOrientation) : 0;
        this.setObjectQuaternion(this.object.quaternion, alpha, beta, gamma, orient);
        if (8 * (1 - this.lastQuaternion.dot(this.object.quaternion)) > this.EPS) {
          this.lastQuaternion.copy(this.object.quaternion);
          this.dispatchEvent(this.changeEvent);
        }
      }
    });
    __publicField(this, "dispose", () => this.disconnect());
    this.object = object;
    this.object.rotation.reorder("YXZ");
    this.connect();
  }
}
export {
  DeviceOrientationControls
};
//# sourceMappingURL=DeviceOrientationControls.js.map
