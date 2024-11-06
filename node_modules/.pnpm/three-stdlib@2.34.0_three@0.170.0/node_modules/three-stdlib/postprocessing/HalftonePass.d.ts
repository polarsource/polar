import { Pass, FullScreenQuad } from './Pass';
import { ShaderMaterial, WebGLRenderer, WebGLRenderTarget } from 'three';
type HalftonePassParams = {
    shape?: number;
    radius?: number;
    rotateR?: number;
    rotateB?: number;
    rotateG?: number;
    scatter?: number;
    blending?: number;
    blendingMode?: number;
    greyscale?: number;
    disable?: number;
};
/**
 * RGB Halftone pass for three.js effects composer. Requires HalftoneShader.
 */
declare class HalftonePass extends Pass {
    material: ShaderMaterial;
    fsQuad: FullScreenQuad;
    uniforms: any;
    constructor(width: number, height: number, params: HalftonePassParams);
    render(renderer: WebGLRenderer, writeBuffer: WebGLRenderTarget, readBuffer: WebGLRenderTarget): void;
    setSize(width: number, height: number): void;
}
export { HalftonePass };
