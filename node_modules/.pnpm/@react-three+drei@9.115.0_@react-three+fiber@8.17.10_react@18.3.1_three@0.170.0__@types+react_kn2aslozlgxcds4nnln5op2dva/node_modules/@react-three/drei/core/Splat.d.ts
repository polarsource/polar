import * as THREE from 'three';
import * as React from 'react';
export type SplatMaterialType = {
    alphaTest?: number;
    alphaHash?: boolean;
    centerAndScaleTexture?: THREE.DataTexture;
    covAndColorTexture?: THREE.DataTexture;
    viewport?: THREE.Vector2;
    focal?: number;
};
export type TargetMesh = THREE.Mesh<THREE.InstancedBufferGeometry, THREE.ShaderMaterial & SplatMaterialType> & {
    ready: boolean;
    sorted: boolean;
    pm: THREE.Matrix4;
    vm1: THREE.Matrix4;
    vm2: THREE.Matrix4;
    viewport: THREE.Vector4;
};
export type SharedState = {
    url: string;
    gl: THREE.WebGLRenderer;
    worker: Worker;
    manager: THREE.LoadingManager;
    stream: ReadableStreamDefaultReader<Uint8Array>;
    loading: boolean;
    loaded: boolean;
    loadedVertexCount: number;
    rowLength: number;
    maxVertexes: number;
    chunkSize: number;
    totalDownloadBytes: number;
    numVertices: number;
    bufferTextureWidth: number;
    bufferTextureHeight: number;
    centerAndScaleData: Float32Array;
    covAndColorData: Uint32Array;
    covAndColorTexture: THREE.DataTexture;
    centerAndScaleTexture: THREE.DataTexture;
    connect(target: TargetMesh): () => void;
    update(target: TargetMesh, camera: THREE.Camera, hashed: boolean): void;
    onProgress?: (event: ProgressEvent) => void;
};
declare global {
    namespace JSX {
        interface IntrinsicElements {
            splatMaterial: SplatMaterialType & JSX.IntrinsicElements['shaderMaterial'];
        }
    }
}
type SplatProps = {
    src: string;
    toneMapped?: boolean;
    alphaTest?: number;
    alphaHash?: boolean;
    chunkSize?: number;
} & JSX.IntrinsicElements['mesh'];
export declare function Splat({ src, toneMapped, alphaTest, alphaHash, chunkSize, ...props }: SplatProps): React.JSX.Element;
export {};
