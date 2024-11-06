import { Object3D } from 'three';
declare class USDZExporter {
    private readonly PRECISION;
    private materials;
    private textures;
    private files;
    constructor();
    parse(scene: Object3D): Promise<Uint8Array>;
    private imageToCanvas;
    private buildHeader;
    private buildUSDFileAsString;
    private buildXform;
    private buildMatrix;
    private buildMatrixRow;
    private buildMeshObject;
    private buildMesh;
    private buildMeshVertexCount;
    private buildMeshVertexIndices;
    private buildVector3Array;
    private buildVector2Array;
    private buildMaterials;
    private buildMaterial;
    private buildTexture;
    private buildColor;
    private buildVector2;
}
export { USDZExporter };
