var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => {
  __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
import { EventDispatcher, MOUSE, Vector3, Vector2, Quaternion } from "three";
class TrackballControls extends EventDispatcher {
  constructor(object, domElement) {
    super();
    __publicField(this, "enabled", true);
    __publicField(this, "screen", { left: 0, top: 0, width: 0, height: 0 });
    __publicField(this, "rotateSpeed", 1);
    __publicField(this, "zoomSpeed", 1.2);
    __publicField(this, "panSpeed", 0.3);
    __publicField(this, "noRotate", false);
    __publicField(this, "noZoom", false);
    __publicField(this, "noPan", false);
    __publicField(this, "staticMoving", false);
    __publicField(this, "dynamicDampingFactor", 0.2);
    __publicField(this, "minDistance", 0);
    __publicField(this, "maxDistance", Infinity);
    __publicField(this, "keys", [
      "KeyA",
      "KeyS",
      "KeyD"
      /*D*/
    ]);
    __publicField(this, "mouseButtons", {
      LEFT: MOUSE.ROTATE,
      MIDDLE: MOUSE.DOLLY,
      RIGHT: MOUSE.PAN
    });
    __publicField(this, "object");
    __publicField(this, "domElement");
    __publicField(this, "cursorZoom", false);
    __publicField(this, "target", new Vector3());
    __publicField(this, "mousePosition", new Vector2());
    // internals
    __publicField(this, "STATE", {
      NONE: -1,
      ROTATE: 0,
      ZOOM: 1,
      PAN: 2,
      TOUCH_ROTATE: 3,
      TOUCH_ZOOM_PAN: 4
    });
    __publicField(this, "EPS", 1e-6);
    __publicField(this, "lastZoom", 1);
    __publicField(this, "lastPosition", new Vector3());
    __publicField(this, "cursorVector", new Vector3());
    __publicField(this, "targetVector", new Vector3());
    __publicField(this, "_state", this.STATE.NONE);
    __publicField(this, "_keyState", this.STATE.NONE);
    __publicField(this, "_eye", new Vector3());
    __publicField(this, "_movePrev", new Vector2());
    __publicField(this, "_moveCurr", new Vector2());
    __publicField(this, "_lastAxis", new Vector3());
    __publicField(this, "_lastAngle", 0);
    __publicField(this, "_zoomStart", new Vector2());
    __publicField(this, "_zoomEnd", new Vector2());
    __publicField(this, "_touchZoomDistanceStart", 0);
    __publicField(this, "_touchZoomDistanceEnd", 0);
    __publicField(this, "_panStart", new Vector2());
    __publicField(this, "_panEnd", new Vector2());
    __publicField(this, "target0");
    __publicField(this, "position0");
    __publicField(this, "up0");
    __publicField(this, "zoom0");
    // events
    __publicField(this, "changeEvent", { type: "change" });
    __publicField(this, "startEvent", { type: "start" });
    __publicField(this, "endEvent", { type: "end" });
    __publicField(this, "onScreenVector", new Vector2());
    __publicField(this, "getMouseOnScreen", (pageX, pageY) => {
      this.onScreenVector.set(
        (pageX - this.screen.left) / this.screen.width,
        (pageY - this.screen.top) / this.screen.height
      );
      return this.onScreenVector;
    });
    __publicField(this, "onCircleVector", new Vector2());
    __publicField(this, "getMouseOnCircle", (pageX, pageY) => {
      this.onCircleVector.set(
        (pageX - this.screen.width * 0.5 - this.screen.left) / (this.screen.width * 0.5),
        (this.screen.height + 2 * (this.screen.top - pageY)) / this.screen.width
        // screen.width intentional
      );
      return this.onCircleVector;
    });
    __publicField(this, "axis", new Vector3());
    __publicField(this, "quaternion", new Quaternion());
    __publicField(this, "eyeDirection", new Vector3());
    __publicField(this, "objectUpDirection", new Vector3());
    __publicField(this, "objectSidewaysDirection", new Vector3());
    __publicField(this, "moveDirection", new Vector3());
    __publicField(this, "angle", 0);
    __publicField(this, "rotateCamera", () => {
      this.moveDirection.set(this._moveCurr.x - this._movePrev.x, this._moveCurr.y - this._movePrev.y, 0);
      this.angle = this.moveDirection.length();
      if (this.angle) {
        this._eye.copy(this.object.position).sub(this.target);
        this.eyeDirection.copy(this._eye).normalize();
        this.objectUpDirection.copy(this.object.up).normalize();
        this.objectSidewaysDirection.crossVectors(this.objectUpDirection, this.eyeDirection).normalize();
        this.objectUpDirection.setLength(this._moveCurr.y - this._movePrev.y);
        this.objectSidewaysDirection.setLength(this._moveCurr.x - this._movePrev.x);
        this.moveDirection.copy(this.objectUpDirection.add(this.objectSidewaysDirection));
        this.axis.crossVectors(this.moveDirection, this._eye).normalize();
        this.angle *= this.rotateSpeed;
        this.quaternion.setFromAxisAngle(this.axis, this.angle);
        this._eye.applyQuaternion(this.quaternion);
        this.object.up.applyQuaternion(this.quaternion);
        this._lastAxis.copy(this.axis);
        this._lastAngle = this.angle;
      } else if (!this.staticMoving && this._lastAngle) {
        this._lastAngle *= Math.sqrt(1 - this.dynamicDampingFactor);
        this._eye.copy(this.object.position).sub(this.target);
        this.quaternion.setFromAxisAngle(this._lastAxis, this._lastAngle);
        this._eye.applyQuaternion(this.quaternion);
        this.object.up.applyQuaternion(this.quaternion);
      }
      this._movePrev.copy(this._moveCurr);
    });
    __publicField(this, "zoomCamera", () => {
      let factor;
      if (this._state === this.STATE.TOUCH_ZOOM_PAN) {
        factor = this._touchZoomDistanceStart / this._touchZoomDistanceEnd;
        this._touchZoomDistanceStart = this._touchZoomDistanceEnd;
        if (this.object.isPerspectiveCamera) {
          this._eye.multiplyScalar(factor);
        } else if (this.object.isOrthographicCamera) {
          this.object.zoom /= factor;
          this.object.updateProjectionMatrix();
        } else {
          console.warn("THREE.TrackballControls: Unsupported camera type");
        }
      } else {
        factor = 1 + (this._zoomEnd.y - this._zoomStart.y) * this.zoomSpeed;
        if (Math.abs(factor - 1) > this.EPS && factor > 0) {
          if (this.object.isPerspectiveCamera) {
            if (factor > 1 && this._eye.length() >= this.maxDistance - this.EPS) {
              factor = 1;
            }
            this._eye.multiplyScalar(factor);
          } else if (this.object.isOrthographicCamera) {
            if (factor > 1 && this.object.zoom < this.maxDistance * this.maxDistance) {
              factor = 1;
            }
            this.object.zoom /= factor;
          } else {
            console.warn("THREE.TrackballControls: Unsupported camera type");
          }
        }
        if (this.staticMoving) {
          this._zoomStart.copy(this._zoomEnd);
        } else {
          this._zoomStart.y += (this._zoomEnd.y - this._zoomStart.y) * this.dynamicDampingFactor;
        }
        if (this.cursorZoom) {
          this.targetVector.copy(this.target).project(this.object);
          let worldPos = this.cursorVector.set(this.mousePosition.x, this.mousePosition.y, this.targetVector.z).unproject(this.object);
          this.target.lerpVectors(worldPos, this.target, factor);
        }
        if (this.object.isOrthographicCamera) {
          this.object.updateProjectionMatrix();
        }
      }
    });
    __publicField(this, "mouseChange", new Vector2());
    __publicField(this, "objectUp", new Vector3());
    __publicField(this, "pan", new Vector3());
    __publicField(this, "panCamera", () => {
      if (!this.domElement)
        return;
      this.mouseChange.copy(this._panEnd).sub(this._panStart);
      if (this.mouseChange.lengthSq() > this.EPS) {
        if (this.object.isOrthographicCamera) {
          const orthoObject = this.object;
          const scale_x = (orthoObject.right - orthoObject.left) / this.object.zoom;
          const scale_y = (orthoObject.top - orthoObject.bottom) / this.object.zoom;
          this.mouseChange.x *= scale_x;
          this.mouseChange.y *= scale_y;
        } else {
          this.mouseChange.multiplyScalar(this._eye.length() * this.panSpeed);
        }
        this.pan.copy(this._eye).cross(this.object.up).setLength(this.mouseChange.x);
        this.pan.add(this.objectUp.copy(this.object.up).setLength(this.mouseChange.y));
        this.object.position.add(this.pan);
        this.target.add(this.pan);
        if (this.staticMoving) {
          this._panStart.copy(this._panEnd);
        } else {
          this._panStart.add(
            this.mouseChange.subVectors(this._panEnd, this._panStart).multiplyScalar(this.dynamicDampingFactor)
          );
        }
      }
    });
    __publicField(this, "checkDistances", () => {
      if (!this.noZoom || !this.noPan) {
        if (this._eye.lengthSq() > this.maxDistance * this.maxDistance) {
          this.object.position.addVectors(this.target, this._eye.setLength(this.maxDistance));
          this._zoomStart.copy(this._zoomEnd);
        }
        if (this._eye.lengthSq() < this.minDistance * this.minDistance) {
          this.object.position.addVectors(this.target, this._eye.setLength(this.minDistance));
          this._zoomStart.copy(this._zoomEnd);
        }
      }
    });
    __publicField(this, "handleResize", () => {
      if (!this.domElement)
        return;
      const box = this.domElement.getBoundingClientRect();
      const d = this.domElement.ownerDocument.documentElement;
      this.screen.left = box.left + window.pageXOffset - d.clientLeft;
      this.screen.top = box.top + window.pageYOffset - d.clientTop;
      this.screen.width = box.width;
      this.screen.height = box.height;
    });
    __publicField(this, "update", () => {
      this._eye.subVectors(this.object.position, this.target);
      if (!this.noRotate) {
        this.rotateCamera();
      }
      if (!this.noZoom) {
        this.zoomCamera();
      }
      if (!this.noPan) {
        this.panCamera();
      }
      this.object.position.addVectors(this.target, this._eye);
      if (this.object.isPerspectiveCamera) {
        this.checkDistances();
        this.object.lookAt(this.target);
        if (this.lastPosition.distanceToSquared(this.object.position) > this.EPS) {
          this.dispatchEvent(this.changeEvent);
          this.lastPosition.copy(this.object.position);
        }
      } else if (this.object.isOrthographicCamera) {
        this.object.lookAt(this.target);
        if (this.lastPosition.distanceToSquared(this.object.position) > this.EPS || this.lastZoom !== this.object.zoom) {
          this.dispatchEvent(this.changeEvent);
          this.lastPosition.copy(this.object.position);
          this.lastZoom = this.object.zoom;
        }
      } else {
        console.warn("THREE.TrackballControls: Unsupported camera type");
      }
    });
    __publicField(this, "reset", () => {
      this._state = this.STATE.NONE;
      this._keyState = this.STATE.NONE;
      this.target.copy(this.target0);
      this.object.position.copy(this.position0);
      this.object.up.copy(this.up0);
      this.object.zoom = this.zoom0;
      this.object.updateProjectionMatrix();
      this._eye.subVectors(this.object.position, this.target);
      this.object.lookAt(this.target);
      this.dispatchEvent(this.changeEvent);
      this.lastPosition.copy(this.object.position);
      this.lastZoom = this.object.zoom;
    });
    __publicField(this, "keydown", (event) => {
      if (this.enabled === false)
        return;
      window.removeEventListener("keydown", this.keydown);
      if (this._keyState !== this.STATE.NONE) {
        return;
      } else if (event.code === this.keys[this.STATE.ROTATE] && !this.noRotate) {
        this._keyState = this.STATE.ROTATE;
      } else if (event.code === this.keys[this.STATE.ZOOM] && !this.noZoom) {
        this._keyState = this.STATE.ZOOM;
      } else if (event.code === this.keys[this.STATE.PAN] && !this.noPan) {
        this._keyState = this.STATE.PAN;
      }
    });
    __publicField(this, "onPointerDown", (event) => {
      if (this.enabled === false)
        return;
      switch (event.pointerType) {
        case "mouse":
        case "pen":
          this.onMouseDown(event);
          break;
      }
    });
    __publicField(this, "onPointerMove", (event) => {
      if (this.enabled === false)
        return;
      switch (event.pointerType) {
        case "mouse":
        case "pen":
          this.onMouseMove(event);
          break;
      }
    });
    __publicField(this, "onPointerUp", (event) => {
      if (this.enabled === false)
        return;
      switch (event.pointerType) {
        case "mouse":
        case "pen":
          this.onMouseUp();
          break;
      }
    });
    __publicField(this, "keyup", () => {
      if (this.enabled === false)
        return;
      this._keyState = this.STATE.NONE;
      window.addEventListener("keydown", this.keydown);
    });
    __publicField(this, "onMouseDown", (event) => {
      if (!this.domElement)
        return;
      if (this._state === this.STATE.NONE) {
        switch (event.button) {
          case this.mouseButtons.LEFT:
            this._state = this.STATE.ROTATE;
            break;
          case this.mouseButtons.MIDDLE:
            this._state = this.STATE.ZOOM;
            break;
          case this.mouseButtons.RIGHT:
            this._state = this.STATE.PAN;
            break;
        }
      }
      const state = this._keyState !== this.STATE.NONE ? this._keyState : this._state;
      if (state === this.STATE.ROTATE && !this.noRotate) {
        this._moveCurr.copy(this.getMouseOnCircle(event.pageX, event.pageY));
        this._movePrev.copy(this._moveCurr);
      } else if (state === this.STATE.ZOOM && !this.noZoom) {
        this._zoomStart.copy(this.getMouseOnScreen(event.pageX, event.pageY));
        this._zoomEnd.copy(this._zoomStart);
      } else if (state === this.STATE.PAN && !this.noPan) {
        this._panStart.copy(this.getMouseOnScreen(event.pageX, event.pageY));
        this._panEnd.copy(this._panStart);
      }
      this.domElement.ownerDocument.addEventListener("pointermove", this.onPointerMove);
      this.domElement.ownerDocument.addEventListener("pointerup", this.onPointerUp);
      this.dispatchEvent(this.startEvent);
    });
    __publicField(this, "onMouseMove", (event) => {
      if (this.enabled === false)
        return;
      const state = this._keyState !== this.STATE.NONE ? this._keyState : this._state;
      if (state === this.STATE.ROTATE && !this.noRotate) {
        this._movePrev.copy(this._moveCurr);
        this._moveCurr.copy(this.getMouseOnCircle(event.pageX, event.pageY));
      } else if (state === this.STATE.ZOOM && !this.noZoom) {
        this._zoomEnd.copy(this.getMouseOnScreen(event.pageX, event.pageY));
      } else if (state === this.STATE.PAN && !this.noPan) {
        this._panEnd.copy(this.getMouseOnScreen(event.pageX, event.pageY));
      }
    });
    __publicField(this, "onMouseUp", () => {
      if (!this.domElement)
        return;
      if (this.enabled === false)
        return;
      this._state = this.STATE.NONE;
      this.domElement.ownerDocument.removeEventListener("pointermove", this.onPointerMove);
      this.domElement.ownerDocument.removeEventListener("pointerup", this.onPointerUp);
      this.dispatchEvent(this.endEvent);
    });
    __publicField(this, "mousewheel", (event) => {
      if (this.enabled === false)
        return;
      if (this.noZoom === true)
        return;
      event.preventDefault();
      switch (event.deltaMode) {
        case 2:
          this._zoomStart.y -= event.deltaY * 0.025;
          break;
        case 1:
          this._zoomStart.y -= event.deltaY * 0.01;
          break;
        default:
          this._zoomStart.y -= event.deltaY * 25e-5;
          break;
      }
      this.mousePosition.x = event.offsetX / this.screen.width * 2 - 1;
      this.mousePosition.y = -(event.offsetY / this.screen.height) * 2 + 1;
      this.dispatchEvent(this.startEvent);
      this.dispatchEvent(this.endEvent);
    });
    __publicField(this, "touchstart", (event) => {
      if (this.enabled === false)
        return;
      event.preventDefault();
      switch (event.touches.length) {
        case 1:
          this._state = this.STATE.TOUCH_ROTATE;
          this._moveCurr.copy(this.getMouseOnCircle(event.touches[0].pageX, event.touches[0].pageY));
          this._movePrev.copy(this._moveCurr);
          break;
        default:
          this._state = this.STATE.TOUCH_ZOOM_PAN;
          const dx = event.touches[0].pageX - event.touches[1].pageX;
          const dy = event.touches[0].pageY - event.touches[1].pageY;
          this._touchZoomDistanceEnd = this._touchZoomDistanceStart = Math.sqrt(dx * dx + dy * dy);
          const x = (event.touches[0].pageX + event.touches[1].pageX) / 2;
          const y = (event.touches[0].pageY + event.touches[1].pageY) / 2;
          this._panStart.copy(this.getMouseOnScreen(x, y));
          this._panEnd.copy(this._panStart);
          break;
      }
      this.dispatchEvent(this.startEvent);
    });
    __publicField(this, "touchmove", (event) => {
      if (this.enabled === false)
        return;
      event.preventDefault();
      switch (event.touches.length) {
        case 1:
          this._movePrev.copy(this._moveCurr);
          this._moveCurr.copy(this.getMouseOnCircle(event.touches[0].pageX, event.touches[0].pageY));
          break;
        default:
          const dx = event.touches[0].pageX - event.touches[1].pageX;
          const dy = event.touches[0].pageY - event.touches[1].pageY;
          this._touchZoomDistanceEnd = Math.sqrt(dx * dx + dy * dy);
          const x = (event.touches[0].pageX + event.touches[1].pageX) / 2;
          const y = (event.touches[0].pageY + event.touches[1].pageY) / 2;
          this._panEnd.copy(this.getMouseOnScreen(x, y));
          break;
      }
    });
    __publicField(this, "touchend", (event) => {
      if (this.enabled === false)
        return;
      switch (event.touches.length) {
        case 0:
          this._state = this.STATE.NONE;
          break;
        case 1:
          this._state = this.STATE.TOUCH_ROTATE;
          this._moveCurr.copy(this.getMouseOnCircle(event.touches[0].pageX, event.touches[0].pageY));
          this._movePrev.copy(this._moveCurr);
          break;
      }
      this.dispatchEvent(this.endEvent);
    });
    __publicField(this, "contextmenu", (event) => {
      if (this.enabled === false)
        return;
      event.preventDefault();
    });
    // https://github.com/mrdoob/three.js/issues/20575
    __publicField(this, "connect", (domElement) => {
      if (domElement === document) {
        console.error(
          'THREE.OrbitControls: "document" should not be used as the target "domElement". Please use "renderer.domElement" instead.'
        );
      }
      this.domElement = domElement;
      this.domElement.addEventListener("contextmenu", this.contextmenu);
      this.domElement.addEventListener("pointerdown", this.onPointerDown);
      this.domElement.addEventListener("wheel", this.mousewheel);
      this.domElement.addEventListener("touchstart", this.touchstart);
      this.domElement.addEventListener("touchend", this.touchend);
      this.domElement.addEventListener("touchmove", this.touchmove);
      this.domElement.ownerDocument.addEventListener("pointermove", this.onPointerMove);
      this.domElement.ownerDocument.addEventListener("pointerup", this.onPointerUp);
      window.addEventListener("keydown", this.keydown);
      window.addEventListener("keyup", this.keyup);
      this.handleResize();
    });
    __publicField(this, "dispose", () => {
      if (!this.domElement)
        return;
      this.domElement.removeEventListener("contextmenu", this.contextmenu);
      this.domElement.removeEventListener("pointerdown", this.onPointerDown);
      this.domElement.removeEventListener("wheel", this.mousewheel);
      this.domElement.removeEventListener("touchstart", this.touchstart);
      this.domElement.removeEventListener("touchend", this.touchend);
      this.domElement.removeEventListener("touchmove", this.touchmove);
      this.domElement.ownerDocument.removeEventListener("pointermove", this.onPointerMove);
      this.domElement.ownerDocument.removeEventListener("pointerup", this.onPointerUp);
      window.removeEventListener("keydown", this.keydown);
      window.removeEventListener("keyup", this.keyup);
    });
    this.object = object;
    this.target0 = this.target.clone();
    this.position0 = this.object.position.clone();
    this.up0 = this.object.up.clone();
    this.zoom0 = this.object.zoom;
    if (domElement !== void 0)
      this.connect(domElement);
    this.update();
  }
}
export {
  TrackballControls
};
//# sourceMappingURL=TrackballControls.js.map
