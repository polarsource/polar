import * as THREE from 'three';
import { Fog, FogExp2, Texture } from 'three';
import * as React from 'react';
export type CubeCameraOptions = {
    resolution?: number;
    near?: number;
    far?: number;
    envMap?: THREE.Texture;
    fog?: Fog | FogExp2;
};
export declare function useCubeCamera({ resolution, near, far, envMap, fog }?: CubeCameraOptions): {
    fbo: THREE.WebGLCubeRenderTarget;
    camera: THREE.CubeCamera;
    update: () => void;
};
type Props = Omit<JSX.IntrinsicElements['group'], 'children'> & {
    children?: (tex: Texture) => React.ReactNode;
    frames?: number;
} & CubeCameraOptions;
export declare function CubeCamera({ children, frames, resolution, near, far, envMap, fog, ...props }: Props): React.JSX.Element;
export {};
