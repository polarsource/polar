/**
 * Depth-of-field shader with bokeh
 * ported from GLSL shader by Martins Upitis
 * http://artmartinsh.blogspot.com/2010/02/glsl-lens-blur-filter-with-bokeh.html
 */
import type { IUniform, Texture } from 'three';
import type { IShader } from './types';
export type BokehShaderDefines = {
    DEPTH_PACKING: number;
    PERSPECTIVE_CAMERA: number;
};
export type BokehShaderUniforms = {
    aperture: IUniform<number>;
    aspect: IUniform<number>;
    farClip: IUniform<number>;
    focus: IUniform<number>;
    maxblur: IUniform<number>;
    nearClip: IUniform<number>;
    tColor: IUniform<Texture | null>;
    tDepth: IUniform<Texture | null>;
};
export interface IBokehShader extends IShader<BokehShaderUniforms, BokehShaderDefines> {
}
export declare const BokehShader: IBokehShader;
