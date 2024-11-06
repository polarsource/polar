import * as THREE from 'three';
import * as React from 'react';
import { ReactThreeFiber } from '@react-three/fiber';
import { ForwardRefComponent } from '../helpers/ts-utils';
type CausticsProps = JSX.IntrinsicElements['group'] & {
    frames?: number;
    debug?: boolean;
    causticsOnly: boolean;
    backside: boolean;
    ior?: number;
    backsideIOR?: number;
    worldRadius?: number;
    intensity?: number;
    color?: ReactThreeFiber.Color;
    resolution?: number;
    lightSource?: [x: number, y: number, z: number] | React.MutableRefObject<THREE.Object3D>;
};
declare global {
    namespace JSX {
        interface IntrinsicElements {
            causticsProjectionMaterial: ReactThreeFiber.MeshNormalMaterialProps & {
                viewMatrix?: {
                    value: THREE.Matrix4;
                };
                color?: ReactThreeFiber.Color;
                causticsTexture?: THREE.Texture;
                causticsTextureB?: THREE.Texture;
                lightProjMatrix?: THREE.Matrix4;
                lightViewMatrix?: THREE.Matrix4;
            };
        }
    }
}
export declare const Caustics: ForwardRefComponent<CausticsProps, THREE.Group>;
export {};
