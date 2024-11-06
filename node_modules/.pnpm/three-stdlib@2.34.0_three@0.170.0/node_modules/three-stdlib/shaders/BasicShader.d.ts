/**
 * Simple test shader
 */
import type { IShader } from './types';
export type BasicShaderUniforms = {};
export interface IBasicShader extends IShader<BasicShaderUniforms> {
}
export declare const BasicShader: IBasicShader;
