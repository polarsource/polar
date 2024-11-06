import { Camera, EventDispatcher } from 'three';
/**
 * W3C Device Orientation control (http://w3c.github.io/deviceorientation/spec-source-orientation.html)
 */
declare class DeviceOrientationControls extends EventDispatcher {
    object: Camera;
    private changeEvent;
    private EPS;
    enabled: boolean;
    deviceOrientation: Partial<DeviceOrientationEvent>;
    screenOrientation: string | number;
    alphaOffset: number;
    constructor(object: Camera);
    private onDeviceOrientationChangeEvent;
    private onScreenOrientationChangeEvent;
    private zee;
    private euler;
    private q0;
    private q1;
    private setObjectQuaternion;
    connect: () => void;
    disconnect: () => void;
    private lastQuaternion;
    update: () => void;
    dispose: () => void;
}
export { DeviceOrientationControls };
