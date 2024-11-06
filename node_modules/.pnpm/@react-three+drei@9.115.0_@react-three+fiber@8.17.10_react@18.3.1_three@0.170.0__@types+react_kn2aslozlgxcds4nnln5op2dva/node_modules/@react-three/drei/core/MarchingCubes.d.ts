import * as THREE from 'three';
import { Color } from 'three';
import { MarchingCubes as MarchingCubesImpl } from 'three-stdlib';
import { ForwardRefComponent } from '../helpers/ts-utils';
export type MarchingCubesProps = {
    resolution?: number;
    maxPolyCount?: number;
    enableUvs?: boolean;
    enableColors?: boolean;
} & JSX.IntrinsicElements['group'];
export declare const MarchingCubes: ForwardRefComponent<MarchingCubesProps, MarchingCubesImpl>;
type MarchingCubeProps = {
    strength?: number;
    subtract?: number;
    color?: Color;
} & JSX.IntrinsicElements['group'];
export declare const MarchingCube: ForwardRefComponent<MarchingCubeProps, THREE.Group>;
type MarchingPlaneProps = {
    planeType?: 'x' | 'y' | 'z';
    strength?: number;
    subtract?: number;
} & JSX.IntrinsicElements['group'];
export declare const MarchingPlane: ForwardRefComponent<MarchingPlaneProps, THREE.Group>;
export {};
