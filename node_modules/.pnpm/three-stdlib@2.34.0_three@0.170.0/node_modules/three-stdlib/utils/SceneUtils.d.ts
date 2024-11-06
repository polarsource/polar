import { Group } from 'three';
import type { BufferGeometry, InstancedMesh, Material, Object3D, Scene } from 'three';
declare const SceneUtils: {
    createMeshesFromInstancedMesh: (instancedMesh: InstancedMesh) => Group;
    createMultiMaterialObject: (geometry: BufferGeometry, materials: Material[]) => Group;
    detach: (child: Object3D, parent: Object3D, scene: Scene) => void;
    attach: (child: Object3D, scene: Scene, parent: Object3D) => void;
};
export { SceneUtils };
