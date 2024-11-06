import { Object3D } from 'three';
declare class XRHandMeshModel {
    controller: Object3D;
    handModel: Object3D;
    bones: Object3D[];
    constructor(handModel: Object3D, controller: Object3D, path: string | undefined, handedness: string, customModelPath?: string);
    updateMesh(): void;
}
export { XRHandMeshModel };
