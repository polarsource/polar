import { Vector2 } from 'three';
/**
 * Convolution shader
 * ported from o3d sample to WebGL / GLSL
 * http://o3d.googlecode.com/svn/trunk/samples/convolution.html
 */
import type { IUniform, Texture } from 'three';
import type { IShader } from './types';
export type ConvolutionShaderDefines = {
    KERNEL_SIZE_FLOAT: string;
    KERNEL_SIZE_INT: string;
};
export type ConvolutionShaderUniforms = {
    cKernel: IUniform<number[]>;
    tDiffuse: IUniform<Texture | null>;
    uImageIncrement: IUniform<Vector2>;
};
export interface IConvolutionShader extends IShader<ConvolutionShaderUniforms, ConvolutionShaderDefines> {
    buildKernel: (sigma: number) => number[];
}
export declare const ConvolutionShader: IConvolutionShader;
