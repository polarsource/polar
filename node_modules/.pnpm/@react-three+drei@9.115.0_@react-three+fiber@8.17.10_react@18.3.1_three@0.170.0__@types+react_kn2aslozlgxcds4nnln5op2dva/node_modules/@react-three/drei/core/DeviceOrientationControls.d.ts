import { ReactThreeFiber } from '@react-three/fiber';
import * as THREE from 'three';
import { DeviceOrientationControls as DeviceOrientationControlsImp } from 'three-stdlib';
import { ForwardRefComponent } from '../helpers/ts-utils';
export type DeviceOrientationControlsProps = ReactThreeFiber.Object3DNode<DeviceOrientationControlsImp, typeof DeviceOrientationControlsImp> & {
    camera?: THREE.Camera;
    onChange?: (e?: THREE.Event) => void;
    makeDefault?: boolean;
};
export declare const DeviceOrientationControls: ForwardRefComponent<DeviceOrientationControlsProps, DeviceOrientationControlsImp>;
