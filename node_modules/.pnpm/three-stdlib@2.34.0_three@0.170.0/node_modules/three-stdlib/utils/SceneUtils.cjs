"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const THREE = require("three");
const SceneUtils = {
  createMeshesFromInstancedMesh: function(instancedMesh) {
    const group = new THREE.Group();
    const count = instancedMesh.count;
    const geometry = instancedMesh.geometry;
    const material = instancedMesh.material;
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(geometry, material);
      instancedMesh.getMatrixAt(i, mesh.matrix);
      mesh.matrix.decompose(mesh.position, mesh.quaternion, mesh.scale);
      group.add(mesh);
    }
    group.copy(instancedMesh);
    group.updateMatrixWorld();
    return group;
  },
  createMultiMaterialObject: function(geometry, materials) {
    const group = new THREE.Group();
    for (let i = 0, l = materials.length; i < l; i++) {
      group.add(new THREE.Mesh(geometry, materials[i]));
    }
    return group;
  },
  detach: function(child, parent, scene) {
    console.warn("THREE.SceneUtils: detach() has been deprecated. Use scene.attach( child ) instead.");
    scene.attach(child);
  },
  attach: function(child, scene, parent) {
    console.warn("THREE.SceneUtils: attach() has been deprecated. Use parent.attach( child ) instead.");
    parent.attach(child);
  }
};
exports.SceneUtils = SceneUtils;
//# sourceMappingURL=SceneUtils.cjs.map
