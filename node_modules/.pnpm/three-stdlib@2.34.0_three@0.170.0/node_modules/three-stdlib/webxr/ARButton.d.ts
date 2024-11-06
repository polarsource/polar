/// <reference types="webxr" />
import { WebGLRenderer } from 'three';
declare class ARButton {
    static createButton(renderer: WebGLRenderer, sessionInit?: XRSessionInit): HTMLButtonElement | HTMLAnchorElement;
}
export { ARButton };
