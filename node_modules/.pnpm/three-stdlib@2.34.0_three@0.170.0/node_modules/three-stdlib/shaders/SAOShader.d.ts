import { Matrix4, Vector2 } from 'three';
import type { IUniform, Texture } from 'three';
import type { IShader } from './types';
export type SAOShaderDefines = Record<'DEPTH_PACKING' | 'DIFFUSE_TEXTURE' | 'NORMAL_TEXTURE' | 'NUM_RINGS' | 'NUM_SAMPLES' | 'PERSPECTIVE_CAMERA', number>;
export type SAOShaderUniforms = {
    bias: IUniform<number>;
    cameraFar: IUniform<number>;
    cameraInverseProjectionMatrix: IUniform<Matrix4>;
    cameraNear: IUniform<number>;
    cameraProjectionMatrix: IUniform<Matrix4>;
    intensity: IUniform<number>;
    kernelRadius: IUniform<number>;
    minResolution: IUniform<number>;
    randomSeed: IUniform<number>;
    scale: IUniform<number>;
    size: IUniform<Vector2>;
    tDepth: IUniform<Texture | null>;
    tDiffuse: IUniform<Texture | null>;
    tNormal: IUniform<Texture | null>;
};
export interface ISAOShader extends IShader<SAOShaderUniforms, SAOShaderDefines> {
    defines: SAOShaderDefines;
    needsUpdate?: boolean;
}
export declare const SAOShader: ISAOShader;
