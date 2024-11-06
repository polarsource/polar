/// <reference types="webxr" />
import { WebGLRenderer } from 'three';
declare class VRButton {
    static createButton(renderer: WebGLRenderer, sessionInit?: XRSessionInit): HTMLButtonElement | HTMLAnchorElement;
    static xrSessionIsGranted: boolean;
    static registerSessionGrantedListener(): void;
}
export { VRButton };
