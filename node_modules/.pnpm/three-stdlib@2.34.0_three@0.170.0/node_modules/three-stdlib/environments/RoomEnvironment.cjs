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
function RoomEnvironment() {
  const scene = new THREE__namespace.Scene();
  const geometry = new THREE__namespace.BoxGeometry();
  geometry.deleteAttribute("uv");
  const roomMaterial = new THREE__namespace.MeshStandardMaterial({ side: THREE__namespace.BackSide });
  const boxMaterial = new THREE__namespace.MeshStandardMaterial();
  const mainLight = new THREE__namespace.PointLight(16777215, 5, 28, 2);
  mainLight.position.set(0.418, 16.199, 0.3);
  scene.add(mainLight);
  const room = new THREE__namespace.Mesh(geometry, roomMaterial);
  room.position.set(-0.757, 13.219, 0.717);
  room.scale.set(31.713, 28.305, 28.591);
  scene.add(room);
  const box1 = new THREE__namespace.Mesh(geometry, boxMaterial);
  box1.position.set(-10.906, 2.009, 1.846);
  box1.rotation.set(0, -0.195, 0);
  box1.scale.set(2.328, 7.905, 4.651);
  scene.add(box1);
  const box2 = new THREE__namespace.Mesh(geometry, boxMaterial);
  box2.position.set(-5.607, -0.754, -0.758);
  box2.rotation.set(0, 0.994, 0);
  box2.scale.set(1.97, 1.534, 3.955);
  scene.add(box2);
  const box3 = new THREE__namespace.Mesh(geometry, boxMaterial);
  box3.position.set(6.167, 0.857, 7.803);
  box3.rotation.set(0, 0.561, 0);
  box3.scale.set(3.927, 6.285, 3.687);
  scene.add(box3);
  const box4 = new THREE__namespace.Mesh(geometry, boxMaterial);
  box4.position.set(-2.017, 0.018, 6.124);
  box4.rotation.set(0, 0.333, 0);
  box4.scale.set(2.002, 4.566, 2.064);
  scene.add(box4);
  const box5 = new THREE__namespace.Mesh(geometry, boxMaterial);
  box5.position.set(2.291, -0.756, -2.621);
  box5.rotation.set(0, -0.286, 0);
  box5.scale.set(1.546, 1.552, 1.496);
  scene.add(box5);
  const box6 = new THREE__namespace.Mesh(geometry, boxMaterial);
  box6.position.set(-2.193, -0.369, -5.547);
  box6.rotation.set(0, 0.516, 0);
  box6.scale.set(3.875, 3.487, 2.986);
  scene.add(box6);
  const light1 = new THREE__namespace.Mesh(geometry, createAreaLightMaterial(50));
  light1.position.set(-16.116, 14.37, 8.208);
  light1.scale.set(0.1, 2.428, 2.739);
  scene.add(light1);
  const light2 = new THREE__namespace.Mesh(geometry, createAreaLightMaterial(50));
  light2.position.set(-16.109, 18.021, -8.207);
  light2.scale.set(0.1, 2.425, 2.751);
  scene.add(light2);
  const light3 = new THREE__namespace.Mesh(geometry, createAreaLightMaterial(17));
  light3.position.set(14.904, 12.198, -1.832);
  light3.scale.set(0.15, 4.265, 6.331);
  scene.add(light3);
  const light4 = new THREE__namespace.Mesh(geometry, createAreaLightMaterial(43));
  light4.position.set(-0.462, 8.89, 14.52);
  light4.scale.set(4.38, 5.441, 0.088);
  scene.add(light4);
  const light5 = new THREE__namespace.Mesh(geometry, createAreaLightMaterial(20));
  light5.position.set(3.235, 11.486, -12.541);
  light5.scale.set(2.5, 2, 0.1);
  scene.add(light5);
  const light6 = new THREE__namespace.Mesh(geometry, createAreaLightMaterial(100));
  light6.position.set(0, 20, 0);
  light6.scale.set(1, 0.1, 1);
  scene.add(light6);
  function createAreaLightMaterial(intensity) {
    const material = new THREE__namespace.MeshBasicMaterial();
    material.color.setScalar(intensity);
    return material;
  }
  return scene;
}
exports.RoomEnvironment = RoomEnvironment;
//# sourceMappingURL=RoomEnvironment.cjs.map
