export type TypedArray = Int8Array | Uint8Array | Uint8ClampedArray | Int16Array | Uint16Array | Int32Array | Uint32Array | Float32Array | Float64Array;
export type TypedArrayConstructors = Int8Array['constructor'] | Uint8Array['constructor'] | Uint8ClampedArray['constructor'] | Int16Array['constructor'] | Uint16Array['constructor'] | Int32Array['constructor'] | Uint32Array['constructor'] | Float32Array['constructor'] | Float64Array['constructor'];
type LinearEncoding = 3000;
type sRGBEncoding = 3001;
/**
 * Stub for `TextureEncoding` type since it was removed in r162.
 */
export type TextureEncoding = LinearEncoding | sRGBEncoding;
export {};
