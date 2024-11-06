import { Mesh, Scene, WebGLRenderTarget, WebGLRenderer, Camera } from 'three';
import { ConvolutionMaterial } from './ConvolutionMaterial';
export interface BlurPassProps {
    gl: WebGLRenderer;
    resolution: number;
    width?: number;
    height?: number;
    minDepthThreshold?: number;
    maxDepthThreshold?: number;
    depthScale?: number;
    depthToBlurRatioBias?: number;
}
export declare class BlurPass {
    readonly renderTargetA: WebGLRenderTarget;
    readonly renderTargetB: WebGLRenderTarget;
    readonly convolutionMaterial: ConvolutionMaterial;
    readonly scene: Scene;
    readonly camera: Camera;
    readonly screen: Mesh;
    renderToScreen: boolean;
    constructor({ gl, resolution, width, height, minDepthThreshold, maxDepthThreshold, depthScale, depthToBlurRatioBias, }: BlurPassProps);
    render(renderer: any, inputBuffer: any, outputBuffer: any): void;
}
