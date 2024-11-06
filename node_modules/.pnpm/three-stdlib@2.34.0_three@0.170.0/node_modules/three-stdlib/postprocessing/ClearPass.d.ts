import { Pass } from './Pass';
import { Color, WebGLRenderer, WebGLRenderTarget } from 'three';
declare class ClearPass extends Pass {
    clearColor: Color | string | number;
    clearAlpha: number;
    private _oldClearColor;
    constructor(clearColor?: Color | string | number, clearAlpha?: number);
    render(renderer: WebGLRenderer, writeBuffer: WebGLRenderTarget, readBuffer: WebGLRenderTarget): void;
}
export { ClearPass };
