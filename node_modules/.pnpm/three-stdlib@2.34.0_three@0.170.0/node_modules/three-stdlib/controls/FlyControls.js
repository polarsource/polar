var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => {
  __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
import { EventDispatcher, Quaternion, Vector3 } from "three";
function contextmenu(event) {
  event.preventDefault();
}
class FlyControls extends EventDispatcher {
  constructor(object, domElement) {
    super();
    __publicField(this, "object");
    __publicField(this, "domElement", null);
    __publicField(this, "movementSpeed", 1);
    __publicField(this, "rollSpeed", 5e-3);
    __publicField(this, "dragToLook", false);
    __publicField(this, "autoForward", false);
    __publicField(this, "changeEvent", { type: "change" });
    __publicField(this, "EPS", 1e-6);
    __publicField(this, "tmpQuaternion", new Quaternion());
    __publicField(this, "mouseStatus", 0);
    __publicField(this, "movementSpeedMultiplier", 1);
    __publicField(this, "moveState", {
      up: 0,
      down: 0,
      left: 0,
      right: 0,
      forward: 0,
      back: 0,
      pitchUp: 0,
      pitchDown: 0,
      yawLeft: 0,
      yawRight: 0,
      rollLeft: 0,
      rollRight: 0
    });
    __publicField(this, "moveVector", new Vector3(0, 0, 0));
    __publicField(this, "rotationVector", new Vector3(0, 0, 0));
    __publicField(this, "keydown", (event) => {
      if (event.altKey) {
        return;
      }
      switch (event.code) {
        case "ShiftLeft":
        case "ShiftRight":
          this.movementSpeedMultiplier = 0.1;
          break;
        case "KeyW":
          this.moveState.forward = 1;
          break;
        case "KeyS":
          this.moveState.back = 1;
          break;
        case "KeyA":
          this.moveState.left = 1;
          break;
        case "KeyD":
          this.moveState.right = 1;
          break;
        case "KeyR":
          this.moveState.up = 1;
          break;
        case "KeyF":
          this.moveState.down = 1;
          break;
        case "ArrowUp":
          this.moveState.pitchUp = 1;
          break;
        case "ArrowDown":
          this.moveState.pitchDown = 1;
          break;
        case "ArrowLeft":
          this.moveState.yawLeft = 1;
          break;
        case "ArrowRight":
          this.moveState.yawRight = 1;
          break;
        case "KeyQ":
          this.moveState.rollLeft = 1;
          break;
        case "KeyE":
          this.moveState.rollRight = 1;
          break;
      }
      this.updateMovementVector();
      this.updateRotationVector();
    });
    __publicField(this, "keyup", (event) => {
      switch (event.code) {
        case "ShiftLeft":
        case "ShiftRight":
          this.movementSpeedMultiplier = 1;
          break;
        case "KeyW":
          this.moveState.forward = 0;
          break;
        case "KeyS":
          this.moveState.back = 0;
          break;
        case "KeyA":
          this.moveState.left = 0;
          break;
        case "KeyD":
          this.moveState.right = 0;
          break;
        case "KeyR":
          this.moveState.up = 0;
          break;
        case "KeyF":
          this.moveState.down = 0;
          break;
        case "ArrowUp":
          this.moveState.pitchUp = 0;
          break;
        case "ArrowDown":
          this.moveState.pitchDown = 0;
          break;
        case "ArrowLeft":
          this.moveState.yawLeft = 0;
          break;
        case "ArrowRight":
          this.moveState.yawRight = 0;
          break;
        case "KeyQ":
          this.moveState.rollLeft = 0;
          break;
        case "KeyE":
          this.moveState.rollRight = 0;
          break;
      }
      this.updateMovementVector();
      this.updateRotationVector();
    });
    __publicField(this, "pointerdown", (event) => {
      if (this.dragToLook) {
        this.mouseStatus++;
      } else {
        switch (event.button) {
          case 0:
            this.moveState.forward = 1;
            break;
          case 2:
            this.moveState.back = 1;
            break;
        }
        this.updateMovementVector();
      }
    });
    __publicField(this, "pointermove", (event) => {
      if (!this.dragToLook || this.mouseStatus > 0) {
        const container = this.getContainerDimensions();
        const halfWidth = container.size[0] / 2;
        const halfHeight = container.size[1] / 2;
        this.moveState.yawLeft = -(event.pageX - container.offset[0] - halfWidth) / halfWidth;
        this.moveState.pitchDown = (event.pageY - container.offset[1] - halfHeight) / halfHeight;
        this.updateRotationVector();
      }
    });
    __publicField(this, "pointerup", (event) => {
      if (this.dragToLook) {
        this.mouseStatus--;
        this.moveState.yawLeft = this.moveState.pitchDown = 0;
      } else {
        switch (event.button) {
          case 0:
            this.moveState.forward = 0;
            break;
          case 2:
            this.moveState.back = 0;
            break;
        }
        this.updateMovementVector();
      }
      this.updateRotationVector();
    });
    __publicField(this, "lastQuaternion", new Quaternion());
    __publicField(this, "lastPosition", new Vector3());
    __publicField(this, "update", (delta) => {
      const moveMult = delta * this.movementSpeed;
      const rotMult = delta * this.rollSpeed;
      this.object.translateX(this.moveVector.x * moveMult);
      this.object.translateY(this.moveVector.y * moveMult);
      this.object.translateZ(this.moveVector.z * moveMult);
      this.tmpQuaternion.set(this.rotationVector.x * rotMult, this.rotationVector.y * rotMult, this.rotationVector.z * rotMult, 1).normalize();
      this.object.quaternion.multiply(this.tmpQuaternion);
      if (this.lastPosition.distanceToSquared(this.object.position) > this.EPS || 8 * (1 - this.lastQuaternion.dot(this.object.quaternion)) > this.EPS) {
        this.dispatchEvent(this.changeEvent);
        this.lastQuaternion.copy(this.object.quaternion);
        this.lastPosition.copy(this.object.position);
      }
    });
    __publicField(this, "updateMovementVector", () => {
      const forward = this.moveState.forward || this.autoForward && !this.moveState.back ? 1 : 0;
      this.moveVector.x = -this.moveState.left + this.moveState.right;
      this.moveVector.y = -this.moveState.down + this.moveState.up;
      this.moveVector.z = -forward + this.moveState.back;
    });
    __publicField(this, "updateRotationVector", () => {
      this.rotationVector.x = -this.moveState.pitchDown + this.moveState.pitchUp;
      this.rotationVector.y = -this.moveState.yawRight + this.moveState.yawLeft;
      this.rotationVector.z = -this.moveState.rollRight + this.moveState.rollLeft;
    });
    __publicField(this, "getContainerDimensions", () => {
      if (this.domElement != document && !(this.domElement instanceof Document)) {
        return {
          size: [this.domElement.offsetWidth, this.domElement.offsetHeight],
          offset: [this.domElement.offsetLeft, this.domElement.offsetTop]
        };
      } else {
        return {
          size: [window.innerWidth, window.innerHeight],
          offset: [0, 0]
        };
      }
    });
    // https://github.com/mrdoob/three.js/issues/20575
    __publicField(this, "connect", (domElement) => {
      this.domElement = domElement;
      if (!(domElement instanceof Document)) {
        domElement.setAttribute("tabindex", -1);
      }
      this.domElement.addEventListener("contextmenu", contextmenu);
      this.domElement.addEventListener("pointermove", this.pointermove);
      this.domElement.addEventListener("pointerdown", this.pointerdown);
      this.domElement.addEventListener("pointerup", this.pointerup);
      window.addEventListener("keydown", this.keydown);
      window.addEventListener("keyup", this.keyup);
    });
    __publicField(this, "dispose", () => {
      this.domElement.removeEventListener("contextmenu", contextmenu);
      this.domElement.removeEventListener("pointermove", this.pointermove);
      this.domElement.removeEventListener("pointerdown", this.pointerdown);
      this.domElement.removeEventListener("pointerup", this.pointerup);
      window.removeEventListener("keydown", this.keydown);
      window.removeEventListener("keyup", this.keyup);
    });
    this.object = object;
    if (domElement !== void 0)
      this.connect(domElement);
    this.updateMovementVector();
    this.updateRotationVector();
  }
}
export {
  FlyControls
};
//# sourceMappingURL=FlyControls.js.map
