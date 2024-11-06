import { Object3D } from 'three';
import type { Texture, Group } from 'three';
import { GLTFLoader } from '../loaders/GLTFLoader';
import { MotionController } from '../libs/MotionControllers';
declare class XRControllerModel extends Object3D {
    envMap: Texture | null;
    motionController: MotionController | null;
    constructor();
    setEnvironmentMap(envMap: Texture): XRControllerModel;
    /**
     * Polls data from the XRInputSource and updates the model's components to match
     * the real world data
     */
    updateMatrixWorld(force: boolean): void;
}
declare class XRControllerModelFactory {
    gltfLoader: GLTFLoader;
    path: string;
    private _assetCache;
    constructor(gltfLoader?: GLTFLoader);
    createControllerModel(controller: Group): XRControllerModel;
}
export { XRControllerModelFactory };
