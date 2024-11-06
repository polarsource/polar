import { Pass, FullScreenQuad } from './Pass';
import { DataTexture, ShaderMaterial, WebGLRenderTarget, WebGLRenderer, IUniform } from 'three';
import { DigitalGlitch } from '../shaders/DigitalGlitch';
declare class GlitchPass extends Pass {
    material: ShaderMaterial;
    fsQuad: FullScreenQuad;
    goWild: boolean;
    curF: number;
    randX: number;
    uniforms: Record<keyof typeof DigitalGlitch['uniforms'], IUniform<any>>;
    constructor(dt_size?: number);
    render(renderer: WebGLRenderer, writeBuffer: WebGLRenderTarget, readBuffer: WebGLRenderTarget): void;
    generateTrigger(): void;
    generateHeightmap(dt_size: number): DataTexture;
}
export { GlitchPass };
