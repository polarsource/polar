/**
 * Two pass Gaussian blur filter (horizontal and vertical blur shaders)
 * - described in http://www.gamerendering.com/2008/10/11/gaussian-blur-filter-shader/
 *   and used in http://www.cake23.de/traveling-wavefronts-lit-up.html
 *
 * - 9 samples per pass
 * - standard deviation 2.7
 * - "h" and "v" parameters should be set to "1 / width" and "1 / height"
 */
import type { IUniform, Texture } from 'three';
import type { IShader } from './types';
export type VerticalBlurShaderUniforms = {
    tDiffuse: IUniform<Texture | null>;
    v: IUniform<number>;
};
export interface IVerticalBlurShader extends IShader<VerticalBlurShaderUniforms> {
}
export declare const VerticalBlurShader: IVerticalBlurShader;
