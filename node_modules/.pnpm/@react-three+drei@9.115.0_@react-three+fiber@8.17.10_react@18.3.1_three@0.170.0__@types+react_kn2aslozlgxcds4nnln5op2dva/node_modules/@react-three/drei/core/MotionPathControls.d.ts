import * as THREE from 'three';
import * as React from 'react';
type MotionPathProps = JSX.IntrinsicElements['group'] & {
    curves?: THREE.Curve<THREE.Vector3>[];
    debug?: boolean;
    object?: React.MutableRefObject<THREE.Object3D>;
    focus?: [x: number, y: number, z: number] | React.MutableRefObject<THREE.Object3D>;
    offset?: number;
    smooth?: boolean | number;
    eps?: number;
    damping?: number;
    focusDamping?: number;
    maxSpeed?: number;
};
type MotionState = {
    current: number;
    path: THREE.CurvePath<THREE.Vector3>;
    focus: React.MutableRefObject<THREE.Object3D> | [x: number, y: number, z: number] | undefined;
    object: React.MutableRefObject<THREE.Object3D>;
    offset: number;
    point: THREE.Vector3;
    tangent: THREE.Vector3;
    next: THREE.Vector3;
};
export declare function useMotion(): MotionState;
export declare const MotionPathControls: React.ForwardRefExoticComponent<Omit<MotionPathProps, "ref"> & React.RefAttributes<THREE.Group>>;
export {};
