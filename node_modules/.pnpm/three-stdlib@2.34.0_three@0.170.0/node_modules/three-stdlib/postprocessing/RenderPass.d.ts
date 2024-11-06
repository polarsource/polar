import { Camera, Color, Material, Scene, WebGLRenderTarget, WebGLRenderer } from 'three';
import { Pass } from './Pass';
declare class RenderPass extends Pass {
    scene: Scene;
    camera: Camera;
    overrideMaterial: Material | undefined;
    clearColor: Color | undefined;
    clearAlpha: number;
    clearDepth: boolean;
    private _oldClearColor;
    constructor(scene: Scene, camera: Camera, overrideMaterial?: Material, clearColor?: Color, clearAlpha?: number);
    render(renderer: WebGLRenderer, writeBuffer: WebGLRenderTarget, readBuffer: WebGLRenderTarget): void;
}
export { RenderPass };
