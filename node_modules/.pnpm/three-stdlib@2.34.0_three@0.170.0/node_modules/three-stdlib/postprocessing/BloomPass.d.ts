import { Pass, FullScreenQuad } from './Pass';
import { IUniform, ShaderMaterial, Vector2, WebGLRenderer, WebGLRenderTarget } from 'three';
import { ConvolutionShader } from '../shaders/ConvolutionShader';
declare class BloomPass extends Pass {
    renderTargetX: WebGLRenderTarget;
    renderTargetY: WebGLRenderTarget;
    materialCombine: ShaderMaterial;
    materialConvolution: ShaderMaterial;
    fsQuad: FullScreenQuad;
    combineUniforms: Record<keyof typeof CombineShader['uniforms'], IUniform<any>>;
    convolutionUniforms: Record<keyof typeof ConvolutionShader['uniforms'], IUniform<any>>;
    blurX: Vector2;
    blurY: Vector2;
    constructor(strength?: number, kernelSize?: number, sigma?: number, resolution?: number);
    render(renderer: WebGLRenderer, writeBuffer: WebGLRenderTarget, readBuffer: WebGLRenderTarget, deltaTime: number, maskActive: boolean): void;
}
declare const CombineShader: {
    uniforms: {
        tDiffuse: {
            value: null;
        };
        strength: {
            value: number;
        };
    };
    vertexShader: string;
    fragmentShader: string;
};
export { BloomPass };
