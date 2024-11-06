import { Pass, FullScreenQuad } from './Pass';
import { IUniform, ShaderMaterial, Vector2, WebGLRenderer, WebGLRenderTarget } from 'three';
import { DotScreenShader } from '../shaders/DotScreenShader';
declare class DotScreenPass extends Pass {
    material: ShaderMaterial;
    fsQuad: FullScreenQuad;
    uniforms: Record<keyof typeof DotScreenShader['uniforms'], IUniform<any>>;
    constructor(center?: Vector2, angle?: number, scale?: number);
    render(renderer: WebGLRenderer, writeBuffer: WebGLRenderTarget, readBuffer: WebGLRenderTarget): void;
}
export { DotScreenPass };
