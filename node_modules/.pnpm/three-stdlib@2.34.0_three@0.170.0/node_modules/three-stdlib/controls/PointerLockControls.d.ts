import { Camera, EventDispatcher, Vector3 } from 'three';
declare class PointerLockControls extends EventDispatcher {
    camera: Camera;
    domElement?: HTMLElement;
    isLocked: boolean;
    minPolarAngle: number;
    maxPolarAngle: number;
    pointerSpeed: number;
    constructor(camera: Camera, domElement?: HTMLElement);
    private onMouseMove;
    private onPointerlockChange;
    private onPointerlockError;
    connect: (domElement: HTMLElement) => void;
    disconnect: () => void;
    dispose: () => void;
    getObject: () => Camera;
    private direction;
    getDirection: (v: Vector3) => Vector3;
    moveForward: (distance: number) => void;
    moveRight: (distance: number) => void;
    lock: () => void;
    unlock: () => void;
}
export { PointerLockControls };
