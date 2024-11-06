import { ReactThreeFiber } from '@react-three/fiber';
import * as THREE from 'three';
import { TrackballControls as TrackballControlsImpl } from 'three-stdlib';
import { ForwardRefComponent } from '../helpers/ts-utils';
export type TrackballControlsProps = ReactThreeFiber.Overwrite<ReactThreeFiber.Object3DNode<TrackballControlsImpl, typeof TrackballControlsImpl>, {
    target?: ReactThreeFiber.Vector3;
    camera?: THREE.Camera;
    domElement?: HTMLElement;
    regress?: boolean;
    makeDefault?: boolean;
    onChange?: (e?: THREE.Event) => void;
    onStart?: (e?: THREE.Event) => void;
    onEnd?: (e?: THREE.Event) => void;
}>;
export declare const TrackballControls: ForwardRefComponent<TrackballControlsProps, TrackballControlsImpl>;
