import * as THREE from 'three';
import * as React from 'react';
import { ReactThreeFiber } from '@react-three/fiber';
import { MeshRefractionMaterial as MeshRefractionMaterial_ } from '../materials/MeshRefractionMaterial';
declare global {
    namespace JSX {
        interface IntrinsicElements {
            meshRefractionMaterial: typeof MeshRefractionMaterial_;
        }
    }
}
type MeshRefractionMaterialProps = JSX.IntrinsicElements['shaderMaterial'] & {
    envMap: THREE.CubeTexture | THREE.Texture;
    bounces?: number;
    ior?: number;
    fresnel?: number;
    aberrationStrength?: number;
    color?: ReactThreeFiber.Color;
    fastChroma?: boolean;
};
export declare function MeshRefractionMaterial({ aberrationStrength, fastChroma, envMap, ...props }: MeshRefractionMaterialProps): React.JSX.Element;
export {};
