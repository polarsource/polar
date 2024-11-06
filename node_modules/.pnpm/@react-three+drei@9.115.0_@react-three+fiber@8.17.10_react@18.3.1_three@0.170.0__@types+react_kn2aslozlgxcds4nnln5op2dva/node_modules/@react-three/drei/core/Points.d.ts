import * as THREE from 'three';
import * as React from 'react';
import { ReactThreeFiber } from '@react-three/fiber';
import { ForwardRefComponent } from '../helpers/ts-utils';
declare global {
    namespace JSX {
        interface IntrinsicElements {
            positionPoint: ReactThreeFiber.Object3DNode<PositionPoint, typeof PositionPoint>;
        }
    }
}
type PointsInstancesProps = JSX.IntrinsicElements['points'] & {
    range?: number;
    limit?: number;
};
export declare class PositionPoint extends THREE.Group {
    size: number;
    color: THREE.Color;
    instance: React.MutableRefObject<THREE.Points | undefined>;
    instanceKey: React.MutableRefObject<JSX.IntrinsicElements['positionPoint'] | undefined>;
    constructor();
    get geometry(): THREE.BufferGeometry | undefined;
    raycast(raycaster: THREE.Raycaster, intersects: THREE.Intersection[]): void;
}
export declare const Point: ForwardRefComponent<JSX.IntrinsicElements['positionPoint'], PositionPoint>;
type PointsBuffersProps = JSX.IntrinsicElements['points'] & {
    positions: Float32Array;
    colors?: Float32Array;
    sizes?: Float32Array;
    stride?: 2 | 3;
};
export declare const PointsBuffer: ForwardRefComponent<PointsBuffersProps, THREE.Points>;
export declare const Points: ForwardRefComponent<PointsBuffersProps | PointsInstancesProps, THREE.Points>;
export {};
