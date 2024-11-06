import * as THREE from 'three';
import * as React from 'react';
import { ReactThreeFiber } from '@react-three/fiber';
interface MaterialShader {
    vertexShader: string;
    fragmentShader: string;
    defines: {
        [define: string]: string | number | boolean;
    } | undefined;
    uniforms: {
        [uniform: string]: THREE.IUniform;
    };
}
export declare function useBoxProjectedEnv(position?: ReactThreeFiber.Vector3, size?: ReactThreeFiber.Vector3): {
    ref: React.MutableRefObject<THREE.Material>;
    onBeforeCompile: (shader: MaterialShader) => void;
    customProgramCacheKey: () => string;
};
export {};
