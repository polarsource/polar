import { OrthographicCamera, PlaneGeometry, Material, Renderer, WebGLRenderer, WebGLRenderTarget } from 'three';
declare class Pass {
    enabled: boolean;
    needsSwap: boolean;
    clear: boolean;
    renderToScreen: boolean;
    setSize(width: number, height: number): void;
    render(renderer: WebGLRenderer, writeBuffer: WebGLRenderTarget, readBuffer: WebGLRenderTarget, deltaTime: number, maskActive?: unknown): void;
    dispose(): void;
}
declare class FullScreenQuad<TMaterial extends Material = Material> {
    camera: OrthographicCamera;
    geometry: PlaneGeometry;
    private mesh;
    constructor(material: TMaterial);
    get material(): TMaterial;
    set material(value: TMaterial);
    dispose(): void;
    render(renderer: Renderer): void;
}
export { Pass, FullScreenQuad };
