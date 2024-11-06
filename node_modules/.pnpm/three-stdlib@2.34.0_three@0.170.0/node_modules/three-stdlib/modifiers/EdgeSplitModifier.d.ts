import { BufferGeometry } from 'three';
declare class EdgeSplitModifier {
    private A;
    private B;
    private C;
    private positions;
    private normals;
    private indexes;
    private pointToIndexMap;
    private splitIndexes;
    private oldNormals;
    constructor();
    private computeNormals;
    private mapPositionsToIndexes;
    private edgeSplitToGroups;
    private edgeSplit;
    modify: (geometry: BufferGeometry, cutOffAngle: number, tryKeepNormals?: boolean) => BufferGeometry;
}
export { EdgeSplitModifier };
