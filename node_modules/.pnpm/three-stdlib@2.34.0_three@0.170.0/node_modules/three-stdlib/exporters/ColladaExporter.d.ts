import { Object3D } from 'three';
/**
 * https://github.com/gkjohnson/collada-exporter-js
 *
 * Usage:
 *  const exporter = new ColladaExporter();
 *
 *  const data = exporter.parse(mesh);
 *
 * Format Definition:
 *  https://www.khronos.org/collada/
 */
export interface ColladaExporterOptions {
    author?: string;
    textureDirectory?: string;
    version?: string;
}
export interface ColladaExporterResult {
    data: string;
    textures: object[];
}
declare class ColladaExporter {
    private options;
    private geometryInfo;
    private materialMap;
    private imageMap;
    private textures;
    private libraryImages;
    private libraryGeometries;
    private libraryEffects;
    private libraryMaterials;
    private canvas;
    private ctx;
    private transMat;
    private getFuncs;
    constructor();
    parse(object: Object3D, onDone: (res: ColladaExporterResult) => void, options?: ColladaExporterOptions): ColladaExporterResult | null;
    private format;
    private base64ToBuffer;
    private imageToData;
    private attrBufferToArray;
    private subArray;
    private getAttribute;
    private getTransform;
    private processGeometry;
    private processTexture;
    private processMaterial;
    private processObject;
}
export { ColladaExporter };
