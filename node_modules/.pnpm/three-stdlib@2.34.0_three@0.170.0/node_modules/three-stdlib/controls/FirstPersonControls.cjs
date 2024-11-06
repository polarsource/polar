"use strict";
var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => {
  __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const THREE = require("three");
const targetPosition = new THREE.Vector3();
class FirstPersonControls extends THREE.EventDispatcher {
  constructor(object, domElement) {
    super();
    __publicField(this, "object");
    __publicField(this, "domElement");
    __publicField(this, "enabled", true);
    __publicField(this, "movementSpeed", 1);
    __publicField(this, "lookSpeed", 5e-3);
    __publicField(this, "lookVertical", true);
    __publicField(this, "autoForward", false);
    __publicField(this, "activeLook", true);
    __publicField(this, "heightSpeed", false);
    __publicField(this, "heightCoef", 1);
    __publicField(this, "heightMin", 0);
    __publicField(this, "heightMax", 1);
    __publicField(this, "constrainVertical", false);
    __publicField(this, "verticalMin", 0);
    __publicField(this, "verticalMax", Math.PI);
    __publicField(this, "mouseDragOn", false);
    // internals
    __publicField(this, "autoSpeedFactor", 0);
    __publicField(this, "mouseX", 0);
    __publicField(this, "mouseY", 0);
    __publicField(this, "moveForward", false);
    __publicField(this, "moveBackward", false);
    __publicField(this, "moveLeft", false);
    __publicField(this, "moveRight", false);
    __publicField(this, "moveUp", false);
    __publicField(this, "moveDown", false);
    __publicField(this, "viewHalfX", 0);
    __publicField(this, "viewHalfY", 0);
    __publicField(this, "lat", 0);
    __publicField(this, "lon", 0);
    __publicField(this, "lookDirection", new THREE.Vector3());
    __publicField(this, "spherical", new THREE.Spherical());
    __publicField(this, "target", new THREE.Vector3());
    __publicField(this, "connect", (domElement) => {
      domElement.setAttribute("tabindex", "-1");
      domElement.style.touchAction = "none";
      domElement.addEventListener("contextmenu", this.contextmenu);
      domElement.addEventListener("mousemove", this.onMouseMove);
      domElement.addEventListener("mousedown", this.onMouseDown);
      domElement.addEventListener("mouseup", this.onMouseUp);
      this.domElement = domElement;
      window.addEventListener("keydown", this.onKeyDown);
      window.addEventListener("keyup", this.onKeyUp);
      this.handleResize();
    });
    __publicField(this, "dispose", () => {
      var _a, _b, _c, _d;
      (_a = this.domElement) == null ? void 0 : _a.removeEventListener("contextmenu", this.contextmenu);
      (_b = this.domElement) == null ? void 0 : _b.removeEventListener("mousedown", this.onMouseDown);
      (_c = this.domElement) == null ? void 0 : _c.removeEventListener("mousemove", this.onMouseMove);
      (_d = this.domElement) == null ? void 0 : _d.removeEventListener("mouseup", this.onMouseUp);
      window.removeEventListener("keydown", this.onKeyDown);
      window.removeEventListener("keyup", this.onKeyUp);
    });
    __publicField(this, "handleResize", () => {
      if (this.domElement) {
        this.viewHalfX = this.domElement.offsetWidth / 2;
        this.viewHalfY = this.domElement.offsetHeight / 2;
      }
    });
    __publicField(this, "onMouseDown", (event) => {
      var _a;
      (_a = this.domElement) == null ? void 0 : _a.focus();
      if (this.activeLook) {
        switch (event.button) {
          case 0:
            this.moveForward = true;
            break;
          case 2:
            this.moveBackward = true;
            break;
        }
      }
      this.mouseDragOn = true;
    });
    __publicField(this, "onMouseUp", (event) => {
      if (this.activeLook) {
        switch (event.button) {
          case 0:
            this.moveForward = false;
            break;
          case 2:
            this.moveBackward = false;
            break;
        }
      }
      this.mouseDragOn = false;
    });
    __publicField(this, "onMouseMove", (event) => {
      if (this.domElement) {
        this.mouseX = event.pageX - this.domElement.offsetLeft - this.viewHalfX;
        this.mouseY = event.pageY - this.domElement.offsetTop - this.viewHalfY;
      }
    });
    __publicField(this, "onKeyDown", (event) => {
      switch (event.code) {
        case "ArrowUp":
        case "KeyW":
          this.moveForward = true;
          break;
        case "ArrowLeft":
        case "KeyA":
          this.moveLeft = true;
          break;
        case "ArrowDown":
        case "KeyS":
          this.moveBackward = true;
          break;
        case "ArrowRight":
        case "KeyD":
          this.moveRight = true;
          break;
        case "KeyR":
          this.moveUp = true;
          break;
        case "KeyF":
          this.moveDown = true;
          break;
      }
    });
    __publicField(this, "onKeyUp", (event) => {
      switch (event.code) {
        case "ArrowUp":
        case "KeyW":
          this.moveForward = false;
          break;
        case "ArrowLeft":
        case "KeyA":
          this.moveLeft = false;
          break;
        case "ArrowDown":
        case "KeyS":
          this.moveBackward = false;
          break;
        case "ArrowRight":
        case "KeyD":
          this.moveRight = false;
          break;
        case "KeyR":
          this.moveUp = false;
          break;
        case "KeyF":
          this.moveDown = false;
          break;
      }
    });
    __publicField(this, "lookAt", (x, y, z) => {
      if (x instanceof THREE.Vector3) {
        this.target.copy(x);
      } else if (y && z) {
        this.target.set(x, y, z);
      }
      this.object.lookAt(this.target);
      this.setOrientation();
      return this;
    });
    __publicField(this, "update", (delta) => {
      if (!this.enabled)
        return;
      if (this.heightSpeed) {
        const y = THREE.MathUtils.clamp(this.object.position.y, this.heightMin, this.heightMax);
        const heightDelta = y - this.heightMin;
        this.autoSpeedFactor = delta * (heightDelta * this.heightCoef);
      } else {
        this.autoSpeedFactor = 0;
      }
      const actualMoveSpeed = delta * this.movementSpeed;
      if (this.moveForward || this.autoForward && !this.moveBackward) {
        this.object.translateZ(-(actualMoveSpeed + this.autoSpeedFactor));
      }
      if (this.moveBackward)
        this.object.translateZ(actualMoveSpeed);
      if (this.moveLeft)
        this.object.translateX(-actualMoveSpeed);
      if (this.moveRight)
        this.object.translateX(actualMoveSpeed);
      if (this.moveUp)
        this.object.translateY(actualMoveSpeed);
      if (this.moveDown)
        this.object.translateY(-actualMoveSpeed);
      let actualLookSpeed = delta * this.lookSpeed;
      if (!this.activeLook) {
        actualLookSpeed = 0;
      }
      let verticalLookRatio = 1;
      if (this.constrainVertical) {
        verticalLookRatio = Math.PI / (this.verticalMax - this.verticalMin);
      }
      this.lon -= this.mouseX * actualLookSpeed;
      if (this.lookVertical)
        this.lat -= this.mouseY * actualLookSpeed * verticalLookRatio;
      this.lat = Math.max(-85, Math.min(85, this.lat));
      let phi = THREE.MathUtils.degToRad(90 - this.lat);
      const theta = THREE.MathUtils.degToRad(this.lon);
      if (this.constrainVertical) {
        phi = THREE.MathUtils.mapLinear(phi, 0, Math.PI, this.verticalMin, this.verticalMax);
      }
      const position = this.object.position;
      targetPosition.setFromSphericalCoords(1, phi, theta).add(position);
      this.object.lookAt(targetPosition);
    });
    __publicField(this, "contextmenu", (event) => event.preventDefault());
    __publicField(this, "setOrientation", () => {
      this.lookDirection.set(0, 0, -1).applyQuaternion(this.object.quaternion);
      this.spherical.setFromVector3(this.lookDirection);
      this.lat = 90 - THREE.MathUtils.radToDeg(this.spherical.phi);
      this.lon = THREE.MathUtils.radToDeg(this.spherical.theta);
    });
    this.object = object;
    this.domElement = domElement;
    this.setOrientation();
    if (domElement)
      this.connect(domElement);
  }
}
exports.FirstPersonControls = FirstPersonControls;
//# sourceMappingURL=FirstPersonControls.cjs.map
