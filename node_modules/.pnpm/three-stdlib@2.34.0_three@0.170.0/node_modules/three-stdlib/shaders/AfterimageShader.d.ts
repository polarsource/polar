/**
 * Afterimage shader
 * I created this effect inspired by a demo on codepen:
 * https://codepen.io/brunoimbrizi/pen/MoRJaN?page=1&
 */
import type { IUniform, Texture } from 'three';
import type { IShader } from './types';
export type AfterimageShaderUniforms = {
    damp: IUniform<number>;
    tNew: IUniform<Texture | null>;
    tOld: IUniform<Texture | null>;
};
export interface IAfterimageShader extends IShader<AfterimageShaderUniforms> {
}
export declare const AfterimageShader: IAfterimageShader;
