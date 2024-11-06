"use strict";
var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => {
  __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const THREE = require("three");
const _euler = new THREE.Euler(0, 0, 0, "YXZ");
const _vector = new THREE.Vector3();
const _changeEvent = { type: "change" };
const _lockEvent = { type: "lock" };
const _unlockEvent = { type: "unlock" };
const _PI_2 = Math.PI / 2;
class PointerLockControls extends THREE.EventDispatcher {
  constructor(camera, domElement) {
    super();
    __publicField(this, "camera");
    __publicField(this, "domElement");
    __publicField(this, "isLocked");
    __publicField(this, "minPolarAngle");
    __publicField(this, "maxPolarAngle");
    __publicField(this, "pointerSpeed");
    __publicField(this, "onMouseMove", (event) => {
      if (!this.domElement || this.isLocked === false)
        return;
      const movementX = event.movementX || event.mozMovementX || event.webkitMovementX || 0;
      const movementY = event.movementY || event.mozMovementY || event.webkitMovementY || 0;
      _euler.setFromQuaternion(this.camera.quaternion);
      _euler.y -= movementX * 2e-3 * this.pointerSpeed;
      _euler.x -= movementY * 2e-3 * this.pointerSpeed;
      _euler.x = Math.max(_PI_2 - this.maxPolarAngle, Math.min(_PI_2 - this.minPolarAngle, _euler.x));
      this.camera.quaternion.setFromEuler(_euler);
      this.dispatchEvent(_changeEvent);
    });
    __publicField(this, "onPointerlockChange", () => {
      if (!this.domElement)
        return;
      if (this.domElement.ownerDocument.pointerLockElement === this.domElement) {
        this.dispatchEvent(_lockEvent);
        this.isLocked = true;
      } else {
        this.dispatchEvent(_unlockEvent);
        this.isLocked = false;
      }
    });
    __publicField(this, "onPointerlockError", () => {
      console.error("THREE.PointerLockControls: Unable to use Pointer Lock API");
    });
    __publicField(this, "connect", (domElement) => {
      this.domElement = domElement || this.domElement;
      if (!this.domElement)
        return;
      this.domElement.ownerDocument.addEventListener("mousemove", this.onMouseMove);
      this.domElement.ownerDocument.addEventListener("pointerlockchange", this.onPointerlockChange);
      this.domElement.ownerDocument.addEventListener("pointerlockerror", this.onPointerlockError);
    });
    __publicField(this, "disconnect", () => {
      if (!this.domElement)
        return;
      this.domElement.ownerDocument.removeEventListener("mousemove", this.onMouseMove);
      this.domElement.ownerDocument.removeEventListener("pointerlockchange", this.onPointerlockChange);
      this.domElement.ownerDocument.removeEventListener("pointerlockerror", this.onPointerlockError);
    });
    __publicField(this, "dispose", () => {
      this.disconnect();
    });
    __publicField(this, "getObject", () => {
      return this.camera;
    });
    __publicField(this, "direction", new THREE.Vector3(0, 0, -1));
    __publicField(this, "getDirection", (v) => {
      return v.copy(this.direction).applyQuaternion(this.camera.quaternion);
    });
    __publicField(this, "moveForward", (distance) => {
      _vector.setFromMatrixColumn(this.camera.matrix, 0);
      _vector.crossVectors(this.camera.up, _vector);
      this.camera.position.addScaledVector(_vector, distance);
    });
    __publicField(this, "moveRight", (distance) => {
      _vector.setFromMatrixColumn(this.camera.matrix, 0);
      this.camera.position.addScaledVector(_vector, distance);
    });
    __publicField(this, "lock", () => {
      if (this.domElement)
        this.domElement.requestPointerLock();
    });
    __publicField(this, "unlock", () => {
      if (this.domElement)
        this.domElement.ownerDocument.exitPointerLock();
    });
    this.camera = camera;
    this.domElement = domElement;
    this.isLocked = false;
    this.minPolarAngle = 0;
    this.maxPolarAngle = Math.PI;
    this.pointerSpeed = 1;
    if (domElement)
      this.connect(domElement);
  }
}
exports.PointerLockControls = PointerLockControls;
//# sourceMappingURL=PointerLockControls.cjs.map
