import { MeshBasicMaterial, WebGLRenderer, ShaderMaterial, WebGLRenderTarget } from 'three';
import { Pass, FullScreenQuad } from './Pass';
declare class AfterimagePass extends Pass {
    shader: import("../shaders/AfterimageShader").IAfterimageShader;
    uniforms: any;
    textureComp: WebGLRenderTarget;
    textureOld: WebGLRenderTarget;
    shaderMaterial: ShaderMaterial;
    compFsQuad: FullScreenQuad<ShaderMaterial>;
    copyFsQuad: FullScreenQuad<MeshBasicMaterial>;
    constructor(damp?: number, shader?: import("../shaders/AfterimageShader").IAfterimageShader);
    render(renderer: WebGLRenderer, writeBuffer: WebGLRenderTarget, readBuffer: WebGLRenderTarget): void;
    setSize(width: number, height: number): void;
}
export { AfterimagePass };
