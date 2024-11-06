import { Object3D } from 'three';
declare class OBJExporter {
    private output;
    private indexVertex;
    private indexVertexUvs;
    private indexNormals;
    private vertex;
    private color;
    private normal;
    private uv;
    private face;
    constructor();
    parse(object: Object3D): string;
    private parseMesh;
    private parseLine;
    private parsePoints;
}
export { OBJExporter };
