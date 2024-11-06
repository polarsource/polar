import * as THREE from 'three';
export declare const setUpdateRange: (attribute: THREE.BufferAttribute, updateRange: {
    offset: number;
    count: number;
}) => void;
export declare const LinearEncoding = 3000;
export declare const sRGBEncoding = 3001;
export type TextureEncoding = typeof LinearEncoding | typeof sRGBEncoding;
