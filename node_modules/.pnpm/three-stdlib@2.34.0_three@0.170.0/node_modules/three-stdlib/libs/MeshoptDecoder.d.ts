type API = {
    ready: Promise<void>;
    supported: boolean;
    decodeVertexBuffer: (target: Uint8Array, count: number, size: number, source: Uint8Array, filter?: string) => void;
    decodeIndexBuffer: (target: Uint8Array, count: number, size: number, source: Uint8Array) => void;
    decodeIndexSequence: (target: Uint8Array, count: number, size: number, source: Uint8Array) => void;
    decodeGltfBuffer: (target: Uint8Array, count: number, size: number, source: Uint8Array, mode: string, filter?: string) => void;
};
declare const MeshoptDecoder: () => API | {
    supported: boolean;
};
export { MeshoptDecoder };
