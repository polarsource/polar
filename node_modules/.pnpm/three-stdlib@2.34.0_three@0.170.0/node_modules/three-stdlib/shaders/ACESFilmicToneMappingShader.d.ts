/**
 * ACES Filmic Tone Mapping Shader by Stephen Hill
 * source: https://github.com/selfshadow/ltc_code/blob/master/webgl/shaders/ltc/ltc_blit.fs
 *
 * this implementation of ACES is modified to accommodate a brighter viewing environment.
 * the scale factor of 1/0.6 is subjective. see discussion in #19621.
 */
import type { IUniform, Texture } from 'three';
import type { IShader } from './types';
export type ACESFilmicToneMappingShaderUniforms = {
    exposure: IUniform<number>;
    tDiffuse: IUniform<Texture | null>;
};
export interface IACESFilmicToneMappingShader extends IShader<ACESFilmicToneMappingShaderUniforms> {
}
export declare const ACESFilmicToneMappingShader: IACESFilmicToneMappingShader;
