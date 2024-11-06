import { Object3D } from 'three';
export interface STLExporterOptionsBinary {
    binary: true;
}
export interface STLExporterOptionsString {
    binary?: false;
}
export interface STLExporterOptions {
    binary?: boolean;
}
export declare class STLExporter {
    private binary;
    private output;
    private offset;
    private objects;
    private triangles;
    private vA;
    private vB;
    private vC;
    private cb;
    private ab;
    private normal;
    parse(scene: Object3D, options: STLExporterOptionsBinary): DataView;
    parse(scene: Object3D, options?: STLExporterOptionsString): string;
    private writeFace;
    private writeNormal;
    private writeVertex;
}
