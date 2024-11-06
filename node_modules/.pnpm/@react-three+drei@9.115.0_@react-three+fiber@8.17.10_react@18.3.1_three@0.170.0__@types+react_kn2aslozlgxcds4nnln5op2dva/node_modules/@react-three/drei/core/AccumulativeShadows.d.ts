import * as THREE from 'three';
import * as React from 'react';
import { ReactThreeFiber } from '@react-three/fiber';
import { ForwardRefComponent } from '../helpers/ts-utils';
export type AccumulativeShadowsProps = {
    frames?: number;
    blend?: number;
    limit?: number;
    scale?: number;
    temporal?: boolean;
    opacity?: number;
    alphaTest?: number;
    color?: string;
    colorBlend?: number;
    resolution?: number;
    toneMapped?: boolean;
};
interface AccumulativeContext {
    lights: Map<any, any>;
    temporal: boolean;
    frames: number;
    blend: number;
    count: number;
    getMesh: () => THREE.Mesh<THREE.PlaneGeometry, SoftShadowMaterialProps & THREE.ShaderMaterial>;
    reset: () => void;
    update: (frames?: number) => void;
}
interface AccumulativeLightContext {
    update: () => void;
}
type SoftShadowMaterialProps = {
    map: THREE.Texture;
    color?: ReactThreeFiber.Color;
    alphaTest?: number;
    blend?: number;
};
declare global {
    namespace JSX {
        interface IntrinsicElements {
            softShadowMaterial: JSX.IntrinsicElements['shaderMaterial'] & SoftShadowMaterialProps;
        }
    }
}
export declare const accumulativeContext: React.Context<AccumulativeContext>;
export declare const AccumulativeShadows: ForwardRefComponent<JSX.IntrinsicElements['group'] & AccumulativeShadowsProps, AccumulativeContext>;
export type RandomizedLightProps = {
    frames?: number;
    position?: [x: number, y: number, z: number];
    radius?: number;
    amount?: number;
    intensity?: number;
    ambient?: number;
    castShadow?: boolean;
    bias?: number;
    mapSize?: number;
    size?: number;
    near?: number;
    far?: number;
};
export declare const RandomizedLight: ForwardRefComponent<JSX.IntrinsicElements['group'] & RandomizedLightProps, AccumulativeLightContext>;
export {};
