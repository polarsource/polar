/**
 * Depth-of-field post-process with bokeh shader
 */
import { Pass, FullScreenQuad } from './Pass';
import { MeshDepthMaterial, PerspectiveCamera, Scene, ShaderMaterial, WebGLRenderer, WebGLRenderTarget } from 'three';
type BokehPassParams = {
    focus?: number;
    aspect?: number;
    aperture?: number;
    maxblur?: number;
    width?: number;
    height?: number;
};
declare class BokehPass extends Pass {
    scene: Scene;
    camera: PerspectiveCamera;
    renderTargetDepth: WebGLRenderTarget;
    materialDepth: MeshDepthMaterial;
    materialBokeh: ShaderMaterial;
    fsQuad: FullScreenQuad;
    private _oldClearColor;
    uniforms: any;
    constructor(scene: Scene, camera: PerspectiveCamera, params: BokehPassParams);
    render(renderer: WebGLRenderer, writeBuffer: WebGLRenderTarget, readBuffer: WebGLRenderTarget): void;
}
export { BokehPass };
