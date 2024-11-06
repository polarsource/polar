import * as React from 'react';
import { Mesh, Texture } from 'three';
import { MeshReflectorMaterialProps } from '../materials/MeshReflectorMaterial';
import { ForwardRefComponent } from '../helpers/ts-utils';
export type ReflectorProps = Omit<JSX.IntrinsicElements['mesh'], 'args' | 'children'> & Pick<JSX.IntrinsicElements['planeGeometry'], 'args'> & {
    resolution?: number;
    mixBlur?: number;
    mixStrength?: number;
    blur?: [number, number] | number;
    mirror: number;
    minDepthThreshold?: number;
    maxDepthThreshold?: number;
    depthScale?: number;
    depthToBlurRatioBias?: number;
    debug?: number;
    distortionMap?: Texture;
    distortion?: number;
    mixContrast?: number;
    children?: {
        (Component: React.ElementType<JSX.IntrinsicElements['meshReflectorMaterial']>, ComponentProps: MeshReflectorMaterialProps): JSX.Element | null;
    };
};
declare global {
    namespace JSX {
        interface IntrinsicElements {
            meshReflectorMaterial: MeshReflectorMaterialProps;
        }
    }
}
export declare const Reflector: ForwardRefComponent<ReflectorProps, Mesh>;
