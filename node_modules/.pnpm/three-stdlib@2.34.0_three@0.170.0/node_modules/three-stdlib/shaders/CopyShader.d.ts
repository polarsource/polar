/**
 * Full-screen textured quad shader
 */
import type { IUniform, Texture } from 'three';
import type { IShader } from './types';
export type CopyShaderUniforms = {
    opacity: IUniform<number>;
    tDiffuse: IUniform<Texture | null>;
};
export interface ICopyShader extends IShader<CopyShaderUniforms> {
}
export declare const CopyShader: ICopyShader;
