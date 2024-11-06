import { Pass, FullScreenQuad } from './Pass';
import { IUniform, ShaderMaterial, WebGLRenderer, WebGLRenderTarget } from 'three';
import { FilmShader } from '../shaders/FilmShader';
declare class FilmPass extends Pass {
    material: ShaderMaterial;
    fsQuad: FullScreenQuad;
    uniforms: Record<keyof typeof FilmShader['uniforms'], IUniform<any>>;
    constructor(noiseIntensity?: number, scanlinesIntensity?: number, scanlinesCount?: number, grayscale?: boolean);
    render(renderer: WebGLRenderer, writeBuffer: WebGLRenderTarget, readBuffer: WebGLRenderTarget, deltaTime: number): void;
}
export { FilmPass };
