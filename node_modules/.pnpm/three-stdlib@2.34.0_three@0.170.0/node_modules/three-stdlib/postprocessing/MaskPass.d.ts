import { Camera, Scene, WebGLRenderer, WebGLRenderTarget } from 'three';
import { Pass } from './Pass';
declare class MaskPass extends Pass {
    scene: Scene;
    camera: Camera;
    inverse: boolean;
    constructor(scene: Scene, camera: Camera);
    render(renderer: WebGLRenderer, writeBuffer: WebGLRenderTarget, readBuffer: WebGLRenderTarget): void;
}
declare class ClearMaskPass extends Pass {
    constructor();
    render(renderer: WebGLRenderer): void;
}
export { MaskPass, ClearMaskPass };
