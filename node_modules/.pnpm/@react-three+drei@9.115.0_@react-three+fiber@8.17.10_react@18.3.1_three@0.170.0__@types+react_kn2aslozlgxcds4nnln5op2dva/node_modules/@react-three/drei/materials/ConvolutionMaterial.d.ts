import * as THREE from 'three';
export declare class ConvolutionMaterial extends THREE.ShaderMaterial {
    readonly kernel: Float32Array;
    constructor(texelSize?: THREE.Vector2);
    setTexelSize(x: number, y: number): void;
    setResolution(resolution: THREE.Vector2): void;
}
