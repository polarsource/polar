import { ReactThreeFiber } from '@react-three/fiber';
import * as THREE from 'three';
import { MapControls as MapControlsImpl } from 'three-stdlib';
import { ForwardRefComponent } from '../helpers/ts-utils';
export type MapControlsProps = ReactThreeFiber.Overwrite<ReactThreeFiber.Object3DNode<MapControlsImpl, typeof MapControlsImpl>, {
    target?: ReactThreeFiber.Vector3;
    camera?: THREE.Camera;
    makeDefault?: boolean;
    onChange?: (e?: THREE.Event) => void;
    onStart?: (e?: THREE.Event) => void;
    onEnd?: (e?: THREE.Event) => void;
    domElement?: HTMLElement;
}>;
export declare const MapControls: ForwardRefComponent<MapControlsProps, MapControlsImpl>;
