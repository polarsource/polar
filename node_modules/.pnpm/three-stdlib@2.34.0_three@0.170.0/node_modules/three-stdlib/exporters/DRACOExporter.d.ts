import { Mesh, Points } from 'three';
declare class DRACOExporter {
    static MESH_EDGEBREAKER_ENCODING: number;
    static MESH_SEQUENTIAL_ENCODING: number;
    static POINT_CLOUD: number;
    static TRIANGULAR_MESH: number;
    static INVALID: number;
    static POSITION: number;
    static NORMAL: number;
    static COLOR: number;
    static TEX_COORD: number;
    static GENERIC: number;
    parse(object: Mesh | Points, options?: {
        decodeSpeed: number;
        encodeSpeed: number;
        encoderMethod: number;
        quantization: number[];
        exportUvs: boolean;
        exportNormals: boolean;
        exportColor: boolean;
    }): Int8Array;
}
export { DRACOExporter };
