import * as React from 'react';
import { Color, Group, Vector3, Material, MeshLambertMaterial, Matrix4 } from 'three';
import { MaterialNode, ReactThreeFiber } from '@react-three/fiber';
declare global {
    namespace JSX {
        interface IntrinsicElements {
            cloudMaterial: MaterialNode<MeshLambertMaterial, typeof MeshLambertMaterial>;
        }
    }
}
type CloudState = {
    uuid: string;
    index: number;
    segments: number;
    dist: number;
    matrix: Matrix4;
    bounds: Vector3;
    position: Vector3;
    volume: number;
    length: number;
    ref: React.MutableRefObject<Group>;
    speed: number;
    growth: number;
    opacity: number;
    fade: number;
    density: number;
    rotation: number;
    rotationFactor: number;
    color: Color;
};
type CloudsProps = JSX.IntrinsicElements['group'] & {
    texture?: string;
    limit?: number;
    range?: number;
    material?: typeof Material;
    frustumCulled?: boolean;
};
type CloudProps = JSX.IntrinsicElements['group'] & {
    seed?: number;
    segments?: number;
    bounds?: ReactThreeFiber.Vector3;
    concentrate?: 'random' | 'inside' | 'outside';
    scale?: ReactThreeFiber.Vector3;
    volume?: number;
    smallestVolume?: number;
    distribute?: (cloud: CloudState, index: number) => {
        point: Vector3;
        volume?: number;
    };
    growth?: number;
    speed?: number;
    fade?: number;
    opacity?: number;
    color?: ReactThreeFiber.Color;
};
export declare const Clouds: React.ForwardRefExoticComponent<Omit<CloudsProps, "ref"> & React.RefAttributes<Group>>;
export declare const CloudInstance: React.ForwardRefExoticComponent<Omit<CloudProps, "ref"> & React.RefAttributes<Group>>;
export declare const Cloud: React.ForwardRefExoticComponent<Omit<CloudProps, "ref"> & React.RefAttributes<Group>>;
export {};
