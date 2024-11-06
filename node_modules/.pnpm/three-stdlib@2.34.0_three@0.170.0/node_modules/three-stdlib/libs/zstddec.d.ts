/**
 * ZSTD (Zstandard) decoder.
 */
export declare class ZSTDDecoder {
    init(): Promise<void>;
    _init(result: WebAssembly.WebAssemblyInstantiatedSource): void;
    decode(array: Uint8Array, uncompressedSize?: number): Uint8Array;
}
