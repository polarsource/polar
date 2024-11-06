"use strict";
var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => {
  __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const THREE = require("three");
const STATE = {
  NONE: -1,
  ROTATE: 0,
  DOLLY: 1,
  PAN: 2,
  TOUCH_ROTATE: 3,
  TOUCH_PAN: 4,
  TOUCH_DOLLY_PAN: 5,
  TOUCH_DOLLY_ROTATE: 6
};
class CameraControls extends THREE.EventDispatcher {
  constructor(object, domElement) {
    super();
    __publicField(this, "object");
    __publicField(this, "domElement");
    /** Set to false to disable this control */
    __publicField(this, "enabled", true);
    /** "target" sets the location of focus, where the object orbits around */
    __publicField(this, "target", new THREE.Vector3());
    /** Set to true to enable trackball behavior */
    __publicField(this, "trackball", false);
    /** How far you can dolly in ( PerspectiveCamera only ) */
    __publicField(this, "minDistance", 0);
    /** How far you can dolly out ( PerspectiveCamera only ) */
    __publicField(this, "maxDistance", Infinity);
    // How far you can zoom in and out ( OrthographicCamera only )
    __publicField(this, "minZoom", 0);
    __publicField(this, "maxZoom", Infinity);
    // How far you can orbit vertically, upper and lower limits.
    // Range is 0 to Math.PI radians.
    __publicField(this, "minPolarAngle", 0);
    __publicField(this, "maxPolarAngle", Math.PI);
    // How far you can orbit horizontally, upper and lower limits.
    // If set, must be a sub-interval of the interval [ - Math.PI, Math.PI ].
    __publicField(this, "minAzimuthAngle", -Infinity);
    // radians
    __publicField(this, "maxAzimuthAngle", Infinity);
    // radians
    // Set to true to enable damping (inertia)
    // If damping is enabled, you must call controls.update() in your animation loop
    __publicField(this, "enableDamping", false);
    __publicField(this, "dampingFactor", 0.05);
    /**
     * This option enables dollying in and out; property named as "zoom" for backwards compatibility
     * Set to false to disable zooming
     */
    __publicField(this, "enableZoom", true);
    __publicField(this, "zoomSpeed", 1);
    /** Set to false to disable rotating */
    __publicField(this, "enableRotate", true);
    __publicField(this, "rotateSpeed", 1);
    /** Set to false to disable panning */
    __publicField(this, "enablePan", true);
    __publicField(this, "panSpeed", 1);
    /** if true, pan in screen-space */
    __publicField(this, "screenSpacePanning", false);
    /** pixels moved per arrow key push */
    __publicField(this, "keyPanSpeed", 7);
    /**
     * Set to true to automatically rotate around the target
     * If auto-rotate is enabled, you must call controls.update() in your animation loop
     * auto-rotate is not supported for trackball behavior
     */
    __publicField(this, "autoRotate", false);
    __publicField(this, "autoRotateSpeed", 2);
    // 30 seconds per round when fps is 60
    /** Set to false to disable use of the keys */
    __publicField(this, "enableKeys", true);
    /** The four arrow keys */
    __publicField(this, "keys", { LEFT: "ArrowLeft", UP: "ArrowUp", RIGHT: "ArrowRight", BOTTOM: "ArrowDown" });
    __publicField(this, "mouseButtons");
    /** Touch fingers */
    __publicField(this, "touches", { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN });
    // for reset
    __publicField(this, "target0");
    __publicField(this, "position0");
    __publicField(this, "quaternion0");
    __publicField(this, "zoom0");
    // current position in spherical coordinates
    __publicField(this, "spherical", new THREE.Spherical());
    __publicField(this, "sphericalDelta", new THREE.Spherical());
    __publicField(this, "changeEvent", { type: "change" });
    __publicField(this, "startEvent", { type: "start" });
    __publicField(this, "endEvent", { type: "end" });
    __publicField(this, "state", STATE.NONE);
    __publicField(this, "EPS", 1e-6);
    __publicField(this, "scale", 1);
    __publicField(this, "panOffset", new THREE.Vector3());
    __publicField(this, "zoomChanged", false);
    __publicField(this, "rotateStart", new THREE.Vector2());
    __publicField(this, "rotateEnd", new THREE.Vector2());
    __publicField(this, "rotateDelta", new THREE.Vector2());
    __publicField(this, "panStart", new THREE.Vector2());
    __publicField(this, "panEnd", new THREE.Vector2());
    __publicField(this, "panDelta", new THREE.Vector2());
    __publicField(this, "dollyStart", new THREE.Vector2());
    __publicField(this, "dollyEnd", new THREE.Vector2());
    __publicField(this, "dollyDelta", new THREE.Vector2());
    __publicField(this, "offset", new THREE.Vector3());
    __publicField(this, "lastPosition", new THREE.Vector3());
    __publicField(this, "lastQuaternion", new THREE.Quaternion());
    __publicField(this, "q", new THREE.Quaternion());
    __publicField(this, "v", new THREE.Vector3());
    __publicField(this, "vec", new THREE.Vector3());
    __publicField(this, "quat");
    __publicField(this, "quatInverse");
    __publicField(this, "getPolarAngle", () => this.spherical.phi);
    __publicField(this, "getAzimuthalAngle", () => this.spherical.theta);
    __publicField(this, "saveState", () => {
      this.target0.copy(this.target);
      this.position0.copy(this.object.position);
      this.quaternion0.copy(this.object.quaternion);
      this.zoom0 = this.object.zoom;
    });
    __publicField(this, "reset", () => {
      this.target.copy(this.target0);
      this.object.position.copy(this.position0);
      this.object.quaternion.copy(this.quaternion0);
      this.object.zoom = this.zoom0;
      this.object.updateProjectionMatrix();
      this.dispatchEvent(this.changeEvent);
      this.update();
      this.state = STATE.NONE;
    });
    __publicField(this, "dispose", () => {
      this.domElement.removeEventListener("contextmenu", this.onContextMenu, false);
      this.domElement.removeEventListener("mousedown", this.onMouseDown, false);
      this.domElement.removeEventListener("wheel", this.onMouseWheel, false);
      this.domElement.removeEventListener("touchstart", this.onTouchStart, false);
      this.domElement.removeEventListener("touchend", this.onTouchEnd, false);
      this.domElement.removeEventListener("touchmove", this.onTouchMove, false);
      document.removeEventListener("mousemove", this.onMouseMove, false);
      document.removeEventListener("mouseup", this.onMouseUp, false);
      this.domElement.removeEventListener("keydown", this.onKeyDown, false);
    });
    __publicField(this, "update", () => {
      const position = this.object.position;
      this.offset.copy(position).sub(this.target);
      if (this.trackball) {
        if (this.sphericalDelta.theta) {
          this.vec.set(0, 1, 0).applyQuaternion(this.object.quaternion);
          const factor = this.enableDamping ? this.dampingFactor : 1;
          this.q.setFromAxisAngle(this.vec, this.sphericalDelta.theta * factor);
          this.object.quaternion.premultiply(this.q);
          this.offset.applyQuaternion(this.q);
        }
        if (this.sphericalDelta.phi) {
          this.vec.set(1, 0, 0).applyQuaternion(this.object.quaternion);
          const factor = this.enableDamping ? this.dampingFactor : 1;
          this.q.setFromAxisAngle(this.vec, this.sphericalDelta.phi * factor);
          this.object.quaternion.premultiply(this.q);
          this.offset.applyQuaternion(this.q);
        }
        this.offset.multiplyScalar(this.scale);
        this.offset.clampLength(this.minDistance, this.maxDistance);
      } else {
        this.offset.applyQuaternion(this.quat);
        if (this.autoRotate && this.state === STATE.NONE) {
          this.rotateLeft(this.getAutoRotationAngle());
        }
        this.spherical.setFromVector3(this.offset);
        if (this.enableDamping) {
          this.spherical.theta += this.sphericalDelta.theta * this.dampingFactor;
          this.spherical.phi += this.sphericalDelta.phi * this.dampingFactor;
        } else {
          this.spherical.theta += this.sphericalDelta.theta;
          this.spherical.phi += this.sphericalDelta.phi;
        }
        this.spherical.theta = Math.max(this.minAzimuthAngle, Math.min(this.maxAzimuthAngle, this.spherical.theta));
        this.spherical.phi = Math.max(this.minPolarAngle, Math.min(this.maxPolarAngle, this.spherical.phi));
        this.spherical.makeSafe();
        this.spherical.radius *= this.scale;
        this.spherical.radius = Math.max(this.minDistance, Math.min(this.maxDistance, this.spherical.radius));
        this.offset.setFromSpherical(this.spherical);
        this.offset.applyQuaternion(this.quatInverse);
      }
      if (this.enableDamping === true) {
        this.target.addScaledVector(this.panOffset, this.dampingFactor);
      } else {
        this.target.add(this.panOffset);
      }
      position.copy(this.target).add(this.offset);
      if (this.trackball === false) {
        this.object.lookAt(this.target);
      }
      if (this.enableDamping === true) {
        this.sphericalDelta.theta *= 1 - this.dampingFactor;
        this.sphericalDelta.phi *= 1 - this.dampingFactor;
        this.panOffset.multiplyScalar(1 - this.dampingFactor);
      } else {
        this.sphericalDelta.set(0, 0, 0);
        this.panOffset.set(0, 0, 0);
      }
      this.scale = 1;
      if (this.zoomChanged || this.lastPosition.distanceToSquared(this.object.position) > this.EPS || 8 * (1 - this.lastQuaternion.dot(this.object.quaternion)) > this.EPS) {
        this.dispatchEvent(this.changeEvent);
        this.lastPosition.copy(this.object.position);
        this.lastQuaternion.copy(this.object.quaternion);
        this.zoomChanged = false;
        return true;
      }
      return false;
    });
    __publicField(this, "getAutoRotationAngle", () => 2 * Math.PI / 60 / 60 * this.autoRotateSpeed);
    __publicField(this, "getZoomScale", () => Math.pow(0.95, this.zoomSpeed));
    __publicField(this, "rotateLeft", (angle) => {
      this.sphericalDelta.theta -= angle;
    });
    __publicField(this, "rotateUp", (angle) => {
      this.sphericalDelta.phi -= angle;
    });
    __publicField(this, "panLeft", (distance, objectMatrix) => {
      this.v.setFromMatrixColumn(objectMatrix, 0);
      this.v.multiplyScalar(-distance);
      this.panOffset.add(this.v);
    });
    __publicField(this, "panUp", (distance, objectMatrix) => {
      if (this.screenSpacePanning === true) {
        this.v.setFromMatrixColumn(objectMatrix, 1);
      } else {
        this.v.setFromMatrixColumn(objectMatrix, 0);
        this.v.crossVectors(this.object.up, this.v);
      }
      this.v.multiplyScalar(distance);
      this.panOffset.add(this.v);
    });
    // deltaX and deltaY are in pixels; right and down are positive
    __publicField(this, "pan", (deltaX, deltaY) => {
      const element = this.domElement;
      if (this.object instanceof THREE.PerspectiveCamera) {
        const position = this.object.position;
        this.offset.copy(position).sub(this.target);
        let targetDistance = this.offset.length();
        targetDistance *= Math.tan(this.object.fov / 2 * Math.PI / 180);
        this.panLeft(2 * deltaX * targetDistance / element.clientHeight, this.object.matrix);
        this.panUp(2 * deltaY * targetDistance / element.clientHeight, this.object.matrix);
      } else if (this.object.isOrthographicCamera) {
        this.panLeft(
          deltaX * (this.object.right - this.object.left) / this.object.zoom / element.clientWidth,
          this.object.matrix
        );
        this.panUp(
          deltaY * (this.object.top - this.object.bottom) / this.object.zoom / element.clientHeight,
          this.object.matrix
        );
      } else {
        console.warn("WARNING: CameraControls.js encountered an unknown camera type - pan disabled.");
        this.enablePan = false;
      }
    });
    __publicField(this, "dollyIn", (dollyScale) => {
      if (this.object instanceof THREE.PerspectiveCamera) {
        this.scale /= dollyScale;
      } else if (this.object instanceof THREE.OrthographicCamera) {
        this.object.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.object.zoom * dollyScale));
        this.object.updateProjectionMatrix();
        this.zoomChanged = true;
      } else {
        console.warn("WARNING: CameraControls.js encountered an unknown camera type - dolly/zoom disabled.");
        this.enableZoom = false;
      }
    });
    __publicField(this, "dollyOut", (dollyScale) => {
      if (this.object instanceof THREE.PerspectiveCamera) {
        this.scale *= dollyScale;
      } else if (this.object instanceof THREE.OrthographicCamera) {
        this.object.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.object.zoom / dollyScale));
        this.object.updateProjectionMatrix();
        this.zoomChanged = true;
      } else {
        console.warn("WARNING: CameraControls.js encountered an unknown camera type - dolly/zoom disabled.");
        this.enableZoom = false;
      }
    });
    // event callbacks - update the object state
    __publicField(this, "handleMouseDownRotate", (event) => {
      this.rotateStart.set(event.clientX, event.clientY);
    });
    // TODO: confirm if worthwhile to return the Vector2 instead of void
    __publicField(this, "handleMouseDownDolly", (event) => {
      this.dollyStart.set(event.clientX, event.clientY);
    });
    __publicField(this, "handleMouseDownPan", (event) => {
      this.panStart.set(event.clientX, event.clientY);
    });
    __publicField(this, "handleMouseMoveRotate", (event) => {
      this.rotateEnd.set(event.clientX, event.clientY);
      this.rotateDelta.subVectors(this.rotateEnd, this.rotateStart).multiplyScalar(this.rotateSpeed);
      const element = this.domElement;
      this.rotateLeft(2 * Math.PI * this.rotateDelta.x / element.clientHeight);
      this.rotateUp(2 * Math.PI * this.rotateDelta.y / element.clientHeight);
      this.rotateStart.copy(this.rotateEnd);
      this.update();
    });
    __publicField(this, "handleMouseMoveDolly", (event) => {
      this.dollyEnd.set(event.clientX, event.clientY);
      this.dollyDelta.subVectors(this.dollyEnd, this.dollyStart);
      if (this.dollyDelta.y > 0) {
        this.dollyIn(this.getZoomScale());
      } else if (this.dollyDelta.y < 0) {
        this.dollyOut(this.getZoomScale());
      }
      this.dollyStart.copy(this.dollyEnd);
      this.update();
    });
    __publicField(this, "handleMouseMovePan", (event) => {
      this.panEnd.set(event.clientX, event.clientY);
      this.panDelta.subVectors(this.panEnd, this.panStart).multiplyScalar(this.panSpeed);
      this.pan(this.panDelta.x, this.panDelta.y);
      this.panStart.copy(this.panEnd);
      this.update();
    });
    __publicField(this, "handleMouseWheel", (event) => {
      if (event.deltaY < 0) {
        this.dollyOut(this.getZoomScale());
      } else if (event.deltaY > 0) {
        this.dollyIn(this.getZoomScale());
      }
      this.update();
    });
    __publicField(this, "handleKeyDown", (event) => {
      let needsUpdate = false;
      switch (event.code) {
        case this.keys.UP:
          this.pan(0, this.keyPanSpeed);
          needsUpdate = true;
          break;
        case this.keys.BOTTOM:
          this.pan(0, -this.keyPanSpeed);
          needsUpdate = true;
          break;
        case this.keys.LEFT:
          this.pan(this.keyPanSpeed, 0);
          needsUpdate = true;
          break;
        case this.keys.RIGHT:
          this.pan(-this.keyPanSpeed, 0);
          needsUpdate = true;
          break;
      }
      if (needsUpdate) {
        event.preventDefault();
        this.update();
      }
    });
    __publicField(this, "handleTouchStartRotate", (event) => {
      if (event.touches.length == 1) {
        this.rotateStart.set(event.touches[0].pageX, event.touches[0].pageY);
      } else {
        const x = 0.5 * (event.touches[0].pageX + event.touches[1].pageX);
        const y = 0.5 * (event.touches[0].pageY + event.touches[1].pageY);
        this.rotateStart.set(x, y);
      }
    });
    __publicField(this, "handleTouchStartPan", (event) => {
      if (event.touches.length == 1) {
        this.panStart.set(event.touches[0].pageX, event.touches[0].pageY);
      } else {
        const x = 0.5 * (event.touches[0].pageX + event.touches[1].pageX);
        const y = 0.5 * (event.touches[0].pageY + event.touches[1].pageY);
        this.panStart.set(x, y);
      }
    });
    __publicField(this, "handleTouchStartDolly", (event) => {
      const dx = event.touches[0].pageX - event.touches[1].pageX;
      const dy = event.touches[0].pageY - event.touches[1].pageY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      this.dollyStart.set(0, distance);
    });
    __publicField(this, "handleTouchStartDollyPan", (event) => {
      if (this.enableZoom)
        this.handleTouchStartDolly(event);
      if (this.enablePan)
        this.handleTouchStartPan(event);
    });
    __publicField(this, "handleTouchStartDollyRotate", (event) => {
      if (this.enableZoom)
        this.handleTouchStartDolly(event);
      if (this.enableRotate)
        this.handleTouchStartRotate(event);
    });
    __publicField(this, "handleTouchMoveRotate", (event) => {
      if (event.touches.length == 1) {
        this.rotateEnd.set(event.touches[0].pageX, event.touches[0].pageY);
      } else {
        const x = 0.5 * (event.touches[0].pageX + event.touches[1].pageX);
        const y = 0.5 * (event.touches[0].pageY + event.touches[1].pageY);
        this.rotateEnd.set(x, y);
      }
      this.rotateDelta.subVectors(this.rotateEnd, this.rotateStart).multiplyScalar(this.rotateSpeed);
      const element = this.domElement;
      this.rotateLeft(2 * Math.PI * this.rotateDelta.x / element.clientHeight);
      this.rotateUp(2 * Math.PI * this.rotateDelta.y / element.clientHeight);
      this.rotateStart.copy(this.rotateEnd);
    });
    __publicField(this, "handleTouchMovePan", (event) => {
      if (event.touches.length == 1) {
        this.panEnd.set(event.touches[0].pageX, event.touches[0].pageY);
      } else {
        const x = 0.5 * (event.touches[0].pageX + event.touches[1].pageX);
        const y = 0.5 * (event.touches[0].pageY + event.touches[1].pageY);
        this.panEnd.set(x, y);
      }
      this.panDelta.subVectors(this.panEnd, this.panStart).multiplyScalar(this.panSpeed);
      this.pan(this.panDelta.x, this.panDelta.y);
      this.panStart.copy(this.panEnd);
    });
    __publicField(this, "handleTouchMoveDolly", (event) => {
      const dx = event.touches[0].pageX - event.touches[1].pageX;
      const dy = event.touches[0].pageY - event.touches[1].pageY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      this.dollyEnd.set(0, distance);
      this.dollyDelta.set(0, Math.pow(this.dollyEnd.y / this.dollyStart.y, this.zoomSpeed));
      this.dollyIn(this.dollyDelta.y);
      this.dollyStart.copy(this.dollyEnd);
    });
    __publicField(this, "handleTouchMoveDollyPan", (event) => {
      if (this.enableZoom)
        this.handleTouchMoveDolly(event);
      if (this.enablePan)
        this.handleTouchMovePan(event);
    });
    __publicField(this, "handleTouchMoveDollyRotate", (event) => {
      if (this.enableZoom)
        this.handleTouchMoveDolly(event);
      if (this.enableRotate)
        this.handleTouchMoveRotate(event);
    });
    //
    // event handlers - FSM: listen for events and reset state
    //
    __publicField(this, "onMouseDown", (event) => {
      if (this.enabled === false)
        return;
      event.preventDefault();
      this.domElement.focus ? this.domElement.focus() : window.focus();
      let mouseAction;
      switch (event.button) {
        case 0:
          mouseAction = this.mouseButtons.LEFT;
          break;
        case 1:
          mouseAction = this.mouseButtons.MIDDLE;
          break;
        case 2:
          mouseAction = this.mouseButtons.RIGHT;
          break;
        default:
          mouseAction = -1;
      }
      switch (mouseAction) {
        case THREE.MOUSE.DOLLY:
          if (this.enableZoom === false)
            return;
          this.handleMouseDownDolly(event);
          this.state = STATE.DOLLY;
          break;
        case THREE.MOUSE.ROTATE:
          if (event.ctrlKey || event.metaKey || event.shiftKey) {
            if (this.enablePan === false)
              return;
            this.handleMouseDownPan(event);
            this.state = STATE.PAN;
          } else {
            if (this.enableRotate === false)
              return;
            this.handleMouseDownRotate(event);
            this.state = STATE.ROTATE;
          }
          break;
        case THREE.MOUSE.PAN:
          if (event.ctrlKey || event.metaKey || event.shiftKey) {
            if (this.enableRotate === false)
              return;
            this.handleMouseDownRotate(event);
            this.state = STATE.ROTATE;
          } else {
            if (this.enablePan === false)
              return;
            this.handleMouseDownPan(event);
            this.state = STATE.PAN;
          }
          break;
        default:
          this.state = STATE.NONE;
      }
      if (this.state !== STATE.NONE) {
        document.addEventListener("mousemove", this.onMouseMove, false);
        document.addEventListener("mouseup", this.onMouseUp, false);
        this.dispatchEvent(this.startEvent);
      }
    });
    __publicField(this, "onMouseMove", (event) => {
      if (this.enabled === false)
        return;
      event.preventDefault();
      switch (this.state) {
        case STATE.ROTATE:
          if (this.enableRotate === false)
            return;
          this.handleMouseMoveRotate(event);
          break;
        case STATE.DOLLY:
          if (this.enableZoom === false)
            return;
          this.handleMouseMoveDolly(event);
          break;
        case STATE.PAN:
          if (this.enablePan === false)
            return;
          this.handleMouseMovePan(event);
          break;
      }
    });
    __publicField(this, "onMouseUp", () => {
      if (this.enabled === false)
        return;
      document.removeEventListener("mousemove", this.onMouseMove, false);
      document.removeEventListener("mouseup", this.onMouseUp, false);
      this.dispatchEvent(this.endEvent);
      this.state = STATE.NONE;
    });
    __publicField(this, "onMouseWheel", (event) => {
      if (this.enabled === false || this.enableZoom === false || this.state !== STATE.NONE && this.state !== STATE.ROTATE) {
        return;
      }
      event.preventDefault();
      this.dispatchEvent(this.startEvent);
      this.handleMouseWheel(event);
      this.dispatchEvent(this.endEvent);
    });
    __publicField(this, "onKeyDown", (event) => {
      if (this.enabled === false || this.enableKeys === false || this.enablePan === false)
        return;
      this.handleKeyDown(event);
    });
    __publicField(this, "onTouchStart", (event) => {
      if (this.enabled === false)
        return;
      event.preventDefault();
      switch (event.touches.length) {
        case 1:
          switch (this.touches.ONE) {
            case THREE.TOUCH.ROTATE:
              if (this.enableRotate === false)
                return;
              this.handleTouchStartRotate(event);
              this.state = STATE.TOUCH_ROTATE;
              break;
            case THREE.TOUCH.PAN:
              if (this.enablePan === false)
                return;
              this.handleTouchStartPan(event);
              this.state = STATE.TOUCH_PAN;
              break;
            default:
              this.state = STATE.NONE;
          }
          break;
        case 2:
          switch (this.touches.TWO) {
            case THREE.TOUCH.DOLLY_PAN:
              if (this.enableZoom === false && this.enablePan === false)
                return;
              this.handleTouchStartDollyPan(event);
              this.state = STATE.TOUCH_DOLLY_PAN;
              break;
            case THREE.TOUCH.DOLLY_ROTATE:
              if (this.enableZoom === false && this.enableRotate === false)
                return;
              this.handleTouchStartDollyRotate(event);
              this.state = STATE.TOUCH_DOLLY_ROTATE;
              break;
            default:
              this.state = STATE.NONE;
          }
          break;
        default:
          this.state = STATE.NONE;
      }
      if (this.state !== STATE.NONE) {
        this.dispatchEvent(this.startEvent);
      }
    });
    __publicField(this, "onTouchMove", (event) => {
      if (this.enabled === false)
        return;
      event.preventDefault();
      switch (this.state) {
        case STATE.TOUCH_ROTATE:
          if (this.enableRotate === false)
            return;
          this.handleTouchMoveRotate(event);
          this.update();
          break;
        case STATE.TOUCH_PAN:
          if (this.enablePan === false)
            return;
          this.handleTouchMovePan(event);
          this.update();
          break;
        case STATE.TOUCH_DOLLY_PAN:
          if (this.enableZoom === false && this.enablePan === false)
            return;
          this.handleTouchMoveDollyPan(event);
          this.update();
          break;
        case STATE.TOUCH_DOLLY_ROTATE:
          if (this.enableZoom === false && this.enableRotate === false)
            return;
          this.handleTouchMoveDollyRotate(event);
          this.update();
          break;
        default:
          this.state = STATE.NONE;
      }
    });
    __publicField(this, "onTouchEnd", () => {
      if (this.enabled === false)
        return;
      this.dispatchEvent(this.endEvent);
      this.state = STATE.NONE;
    });
    __publicField(this, "onContextMenu", (event) => {
      if (this.enabled === false)
        return;
      event.preventDefault();
    });
    if (domElement === void 0) {
      console.warn('THREE.CameraControls: The second parameter "domElement" is now mandatory.');
    }
    if (domElement instanceof Document) {
      console.error(
        'THREE.CameraControls: "document" should not be used as the target "domElement". Please use "renderer.domElement" instead.'
      );
    }
    this.object = object;
    this.domElement = domElement;
    this.mouseButtons = {
      LEFT: THREE.MOUSE.ROTATE,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.PAN
    };
    this.target0 = this.target.clone();
    this.position0 = this.object.position.clone();
    this.quaternion0 = this.object.quaternion.clone();
    this.zoom0 = this.object.zoom;
    this.quat = new THREE.Quaternion().setFromUnitVectors(this.object.up, new THREE.Vector3(0, 1, 0));
    this.quatInverse = this.quat.clone().invert();
    this.lastPosition = new THREE.Vector3();
    this.lastQuaternion = new THREE.Quaternion();
    this.domElement.addEventListener("contextmenu", this.onContextMenu, false);
    this.domElement.addEventListener("mousedown", this.onMouseDown, false);
    this.domElement.addEventListener("wheel", this.onMouseWheel, false);
    this.domElement.addEventListener("touchstart", this.onTouchStart, false);
    this.domElement.addEventListener("touchend", this.onTouchEnd, false);
    this.domElement.addEventListener("touchmove", this.onTouchMove, false);
    this.domElement.addEventListener("keydown", this.onKeyDown, false);
    if (this.domElement.tabIndex === -1) {
      this.domElement.tabIndex = 0;
    }
    this.object.lookAt(this.target);
    this.update();
    this.saveState();
  }
  handleMouseUp() {
  }
  handleTouchEnd() {
  }
}
class OrbitControlsExp extends CameraControls {
  constructor(object, domElement) {
    super(object, domElement);
    __publicField(this, "mouseButtons");
    __publicField(this, "touches");
    this.mouseButtons = {
      LEFT: THREE.MOUSE.ROTATE,
      RIGHT: THREE.MOUSE.PAN
    };
    this.touches = {
      ONE: THREE.TOUCH.ROTATE,
      TWO: THREE.TOUCH.DOLLY_PAN
    };
  }
}
class MapControlsExp extends CameraControls {
  constructor(object, domElement) {
    super(object, domElement);
    __publicField(this, "mouseButtons");
    __publicField(this, "touches");
    this.mouseButtons = {
      LEFT: THREE.MOUSE.PAN,
      RIGHT: THREE.MOUSE.ROTATE
    };
    this.touches = {
      ONE: THREE.TOUCH.PAN,
      TWO: THREE.TOUCH.DOLLY_ROTATE
    };
  }
}
class TrackballControlsExp extends CameraControls {
  constructor(object, domElement) {
    super(object, domElement);
    __publicField(this, "trackball");
    __publicField(this, "screenSpacePanning");
    __publicField(this, "autoRotate");
    __publicField(this, "mouseButtons");
    __publicField(this, "touches");
    this.trackball = true;
    this.screenSpacePanning = true;
    this.autoRotate = false;
    this.mouseButtons = {
      LEFT: THREE.MOUSE.ROTATE,
      RIGHT: THREE.MOUSE.PAN
    };
    this.touches = {
      ONE: THREE.TOUCH.ROTATE,
      TWO: THREE.TOUCH.DOLLY_PAN
    };
  }
}
exports.CameraControls = CameraControls;
exports.MapControlsExp = MapControlsExp;
exports.OrbitControlsExp = OrbitControlsExp;
exports.STATE = STATE;
exports.TrackballControlsExp = TrackballControlsExp;
//# sourceMappingURL=CameraControls.cjs.map
