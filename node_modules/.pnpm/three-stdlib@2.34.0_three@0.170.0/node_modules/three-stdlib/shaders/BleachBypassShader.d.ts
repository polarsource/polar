/**
 * Bleach bypass shader [http://en.wikipedia.org/wiki/Bleach_bypass]
 * - based on Nvidia example
 * http://developer.download.nvidia.com/shaderlibrary/webpages/shader_library.html#post_bleach_bypass
 */
import type { IUniform, Texture } from 'three';
import type { IShader } from './types';
export type BleachBypassShaderUniforms = {
    opacity: IUniform<number>;
    tDiffuse: IUniform<Texture | null>;
};
export interface IBleachBypassShader extends IShader<BleachBypassShaderUniforms> {
}
export declare const BleachBypassShader: IBleachBypassShader;
