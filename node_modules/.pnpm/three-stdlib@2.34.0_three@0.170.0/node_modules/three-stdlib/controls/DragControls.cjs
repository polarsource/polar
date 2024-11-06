"use strict";
var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => {
  __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const THREE = require("three");
class DragControls extends THREE.EventDispatcher {
  constructor(_objects, _camera, _domElement) {
    super();
    __publicField(this, "enabled", true);
    __publicField(this, "transformGroup", false);
    __publicField(this, "_objects");
    __publicField(this, "_camera");
    __publicField(this, "_domElement");
    __publicField(this, "_plane", new THREE.Plane());
    __publicField(this, "_raycaster", new THREE.Raycaster());
    __publicField(this, "_mouse", new THREE.Vector2());
    __publicField(this, "_offset", new THREE.Vector3());
    __publicField(this, "_intersection", new THREE.Vector3());
    __publicField(this, "_worldPosition", new THREE.Vector3());
    __publicField(this, "_inverseMatrix", new THREE.Matrix4());
    __publicField(this, "_intersections", []);
    __publicField(this, "_selected", null);
    __publicField(this, "_hovered", null);
    __publicField(this, "activate", () => {
      this._domElement.addEventListener("pointermove", this.onPointerMove);
      this._domElement.addEventListener("pointerdown", this.onPointerDown);
      this._domElement.addEventListener("pointerup", this.onPointerCancel);
      this._domElement.addEventListener("pointerleave", this.onPointerCancel);
      this._domElement.addEventListener("touchmove", this.onTouchMove);
      this._domElement.addEventListener("touchstart", this.onTouchStart);
      this._domElement.addEventListener("touchend", this.onTouchEnd);
    });
    __publicField(this, "deactivate", () => {
      this._domElement.removeEventListener("pointermove", this.onPointerMove);
      this._domElement.removeEventListener("pointerdown", this.onPointerDown);
      this._domElement.removeEventListener("pointerup", this.onPointerCancel);
      this._domElement.removeEventListener("pointerleave", this.onPointerCancel);
      this._domElement.removeEventListener("touchmove", this.onTouchMove);
      this._domElement.removeEventListener("touchstart", this.onTouchStart);
      this._domElement.removeEventListener("touchend", this.onTouchEnd);
      this._domElement.style.cursor = "";
    });
    // TODO: confirm if this can be removed?
    __publicField(this, "dispose", () => this.deactivate());
    __publicField(this, "getObjects", () => this._objects);
    __publicField(this, "getRaycaster", () => this._raycaster);
    __publicField(this, "onMouseMove", (event) => {
      const rect = this._domElement.getBoundingClientRect();
      this._mouse.x = (event.clientX - rect.left) / rect.width * 2 - 1;
      this._mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      this._raycaster.setFromCamera(this._mouse, this._camera);
      if (this._selected && this.enabled) {
        if (this._raycaster.ray.intersectPlane(this._plane, this._intersection)) {
          this._selected.position.copy(this._intersection.sub(this._offset).applyMatrix4(this._inverseMatrix));
        }
        this.dispatchEvent({ type: "drag", object: this._selected });
        return;
      }
      this._intersections.length = 0;
      this._raycaster.setFromCamera(this._mouse, this._camera);
      this._raycaster.intersectObjects(this._objects, true, this._intersections);
      if (this._intersections.length > 0) {
        const object = this._intersections[0].object;
        this._plane.setFromNormalAndCoplanarPoint(
          this._camera.getWorldDirection(this._plane.normal),
          this._worldPosition.setFromMatrixPosition(object.matrixWorld)
        );
        if (this._hovered !== object) {
          this.dispatchEvent({ type: "hoveron", object });
          this._domElement.style.cursor = "pointer";
          this._hovered = object;
        }
      } else {
        if (this._hovered !== null) {
          this.dispatchEvent({ type: "hoveroff", object: this._hovered });
          this._domElement.style.cursor = "auto";
          this._hovered = null;
        }
      }
    });
    __publicField(this, "onMouseDown", () => {
      this._intersections.length = 0;
      this._raycaster.setFromCamera(this._mouse, this._camera);
      this._raycaster.intersectObjects(this._objects, true, this._intersections);
      if (this._intersections.length > 0) {
        this._selected = this.transformGroup === true ? this._objects[0] : this._intersections[0].object;
        if (this._raycaster.ray.intersectPlane(this._plane, this._intersection) && this._selected.parent) {
          this._inverseMatrix.copy(this._selected.parent.matrixWorld).invert();
          this._offset.copy(this._intersection).sub(this._worldPosition.setFromMatrixPosition(this._selected.matrixWorld));
        }
        this._domElement.style.cursor = "move";
        this.dispatchEvent({ type: "dragstart", object: this._selected });
      }
    });
    __publicField(this, "onMouseCancel", () => {
      if (this._selected) {
        this.dispatchEvent({ type: "dragend", object: this._selected });
        this._selected = null;
      }
      this._domElement.style.cursor = this._hovered ? "pointer" : "auto";
    });
    __publicField(this, "onPointerMove", (event) => {
      switch (event.pointerType) {
        case "mouse":
        case "pen":
          this.onMouseMove(event);
          break;
      }
    });
    __publicField(this, "onPointerDown", (event) => {
      switch (event.pointerType) {
        case "mouse":
        case "pen":
          this.onMouseDown();
          break;
      }
    });
    __publicField(this, "onPointerCancel", (event) => {
      switch (event.pointerType) {
        case "mouse":
        case "pen":
          this.onMouseCancel();
          break;
      }
    });
    __publicField(this, "onTouchMove", (event) => {
      event.preventDefault();
      const newEvent = event.changedTouches[0];
      const rect = this._domElement.getBoundingClientRect();
      this._mouse.x = (newEvent.clientX - rect.left) / rect.width * 2 - 1;
      this._mouse.y = -((newEvent.clientY - rect.top) / rect.height) * 2 + 1;
      this._raycaster.setFromCamera(this._mouse, this._camera);
      if (this._selected && this.enabled) {
        if (this._raycaster.ray.intersectPlane(this._plane, this._intersection)) {
          this._selected.position.copy(this._intersection.sub(this._offset).applyMatrix4(this._inverseMatrix));
        }
        this.dispatchEvent({ type: "drag", object: this._selected });
        return;
      }
    });
    __publicField(this, "onTouchStart", (event) => {
      event.preventDefault();
      const newEvent = event.changedTouches[0];
      const rect = this._domElement.getBoundingClientRect();
      this._mouse.x = (newEvent.clientX - rect.left) / rect.width * 2 - 1;
      this._mouse.y = -((newEvent.clientY - rect.top) / rect.height) * 2 + 1;
      this._intersections.length = 0;
      this._raycaster.setFromCamera(this._mouse, this._camera);
      this._raycaster.intersectObjects(this._objects, true, this._intersections);
      if (this._intersections.length > 0) {
        this._selected = this.transformGroup === true ? this._objects[0] : this._intersections[0].object;
        this._plane.setFromNormalAndCoplanarPoint(
          this._camera.getWorldDirection(this._plane.normal),
          this._worldPosition.setFromMatrixPosition(this._selected.matrixWorld)
        );
        if (this._raycaster.ray.intersectPlane(this._plane, this._intersection) && this._selected.parent) {
          this._inverseMatrix.copy(this._selected.parent.matrixWorld).invert();
          this._offset.copy(this._intersection).sub(this._worldPosition.setFromMatrixPosition(this._selected.matrixWorld));
        }
        this._domElement.style.cursor = "move";
        this.dispatchEvent({ type: "dragstart", object: this._selected });
      }
    });
    __publicField(this, "onTouchEnd", (event) => {
      event.preventDefault();
      if (this._selected) {
        this.dispatchEvent({ type: "dragend", object: this._selected });
        this._selected = null;
      }
      this._domElement.style.cursor = "auto";
    });
    this._objects = _objects;
    this._camera = _camera;
    this._domElement = _domElement;
    this.activate();
  }
}
exports.DragControls = DragControls;
//# sourceMappingURL=DragControls.cjs.map
