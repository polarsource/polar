import { Clock, WebGLRenderer, WebGLRenderTarget } from 'three';
import { Pass } from './Pass';
declare class EffectComposer<TRenderTarget extends WebGLRenderTarget = WebGLRenderTarget> {
    renderer: WebGLRenderer;
    private _pixelRatio;
    private _width;
    private _height;
    renderTarget1: WebGLRenderTarget;
    renderTarget2: WebGLRenderTarget;
    writeBuffer: WebGLRenderTarget;
    readBuffer: WebGLRenderTarget;
    renderToScreen: boolean;
    passes: Pass[];
    copyPass: Pass;
    clock: Clock;
    constructor(renderer: WebGLRenderer, renderTarget?: TRenderTarget);
    swapBuffers(): void;
    addPass(pass: Pass): void;
    insertPass(pass: Pass, index: number): void;
    removePass(pass: Pass): void;
    isLastEnabledPass(passIndex: number): boolean;
    render(deltaTime?: number): void;
    reset(renderTarget: WebGLRenderTarget): void;
    setSize(width: number, height: number): void;
    setPixelRatio(pixelRatio: number): void;
    dispose(): void;
}
export { EffectComposer };
