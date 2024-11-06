/// <reference types="webxr" />
import { Object3D, Mesh, Texture, Vector3 } from 'three';
import { XRHandMeshModel } from './XRHandMeshModel';
export interface XRButton extends Object3D {
    onPress(): void;
    onClear(): void;
    isPressed(): boolean;
    whilePressed(): void;
}
declare class OculusHandModel extends Object3D {
    controller: Object3D;
    motionController: XRHandMeshModel | null;
    envMap: Texture | null;
    mesh: Mesh | null;
    xrInputSource: XRInputSource | null;
    constructor(controller: Object3D, leftModelPath?: string, rightModelPath?: string);
    updateMatrixWorld(force?: boolean): void;
    getPointerPosition(): Vector3 | null;
    intersectBoxObject(boxObject: Object3D): boolean;
    checkButton(button: XRButton): void;
    dispose(): void;
}
export { OculusHandModel };
