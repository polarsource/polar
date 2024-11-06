import { Vector2 } from 'three';
import type { IUniform, Texture } from 'three';
import type { IShader } from './types';
export type DepthLimitedBlurShaderDefines = {
    DEPTH_PACKING: number;
    KERNEL_RADIUS: number;
    PERSPECTIVE_CAMERA: number;
};
export type DepthLimitedBlurShaderUniforms = {
    cameraFar: IUniform<number>;
    cameraNear: IUniform<number>;
    depthCutoff: IUniform<number>;
    sampleUvOffsets: IUniform<Vector2[]>;
    sampleWeights: IUniform<number[]>;
    size: IUniform<Vector2>;
    tDepth: IUniform<Texture | null>;
    tDiffuse: IUniform<Texture | null>;
};
export interface IDepthLimitedBlurShader extends IShader<DepthLimitedBlurShaderUniforms, DepthLimitedBlurShaderDefines> {
    defines: DepthLimitedBlurShaderDefines;
    needsUpdate?: boolean;
}
export declare const DepthLimitedBlurShader: IDepthLimitedBlurShader;
export declare const BlurShaderUtils: {
    createSampleWeights: (kernelRadius: number, stdDev: number) => number[];
    createSampleOffsets: (kernelRadius: number, uvIncrement: Vector2) => Vector2[];
    configure: (shader: IDepthLimitedBlurShader, kernelRadius: number, stdDev: number, uvIncrement: Vector2) => void;
};
