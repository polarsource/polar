import { ShaderMaterial, WebGLRenderer, WebGLRenderTarget } from 'three';
import { Pass, FullScreenQuad } from './Pass';
import { Defines, IShader, Uniforms } from '../shaders/types';
declare class ShaderPass extends Pass {
    textureID: string;
    uniforms: Uniforms;
    material: ShaderMaterial;
    fsQuad: FullScreenQuad;
    constructor(shader: ShaderMaterial | IShader<Uniforms, Defines | undefined>, textureID?: string);
    render(renderer: WebGLRenderer, writeBuffer: WebGLRenderTarget, readBuffer: WebGLRenderTarget): void;
    dispose(): void;
}
export { ShaderPass };
