import * as React from 'react';
import { ColorRepresentation, Mesh, Object3D } from 'three';
import { MeshLineGeometry as MeshLineGeometryImpl } from 'meshline';
import { ForwardRefComponent } from '../helpers/ts-utils';
type Settings = {
    width: number;
    length: number;
    decay: number;
    local: boolean;
    stride: number;
    interval: number;
};
type TrailProps = {
    color?: ColorRepresentation;
    attenuation?: (width: number) => number;
    target?: React.MutableRefObject<Object3D>;
} & Partial<Settings>;
export declare function useTrail(target: Object3D, settings: Partial<Settings>): React.MutableRefObject<Float32Array | undefined>;
export type MeshLineGeometry = Mesh & MeshLineGeometryImpl;
export declare const Trail: ForwardRefComponent<React.PropsWithChildren<TrailProps>, MeshLineGeometry>;
export {};
