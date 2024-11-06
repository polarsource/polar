"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const THREE = require("three");
function _interopNamespaceDefault(e) {
  const n = Object.create(null, { [Symbol.toStringTag]: { value: "Module" } });
  if (e) {
    for (const k in e) {
      if (k !== "default") {
        const d = Object.getOwnPropertyDescriptor(e, k);
        Object.defineProperty(n, k, d.get ? d : {
          enumerable: true,
          get: () => e[k]
        });
      }
    }
  }
  n.default = e;
  return Object.freeze(n);
}
const THREE__namespace = /* @__PURE__ */ _interopNamespaceDefault(THREE);
function createText(message, height) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  let metrics = null;
  const textHeight = 100;
  context.font = "normal " + textHeight + "px Arial";
  metrics = context.measureText(message);
  const textWidth = metrics.width;
  canvas.width = textWidth;
  canvas.height = textHeight;
  context.font = "normal " + textHeight + "px Arial";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = "#ffffff";
  context.fillText(message, textWidth / 2, textHeight / 2);
  const texture = new THREE__namespace.Texture(canvas);
  texture.needsUpdate = true;
  const material = new THREE__namespace.MeshBasicMaterial({
    color: 16777215,
    side: THREE__namespace.DoubleSide,
    map: texture,
    transparent: true
  });
  const geometry = new THREE__namespace.PlaneGeometry(height * textWidth / textHeight, height);
  const plane = new THREE__namespace.Mesh(geometry, material);
  return plane;
}
exports.createText = createText;
//# sourceMappingURL=Text2D.cjs.map
