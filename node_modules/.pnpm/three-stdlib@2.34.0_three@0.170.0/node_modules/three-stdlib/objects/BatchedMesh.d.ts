import { Matrix4, Mesh, BufferGeometry, Material, DataTexture, IUniform } from 'three';
declare class BatchedMesh extends Mesh<BufferGeometry, Material> {
    _vertexStarts: number[];
    _vertexCounts: number[];
    _indexStarts: number[];
    _indexCounts: number[];
    _reservedRanges: {
        vertexStart: number;
        vertexCount: number;
        indexStart: number;
        indexCount: number;
    }[];
    _visible: boolean[];
    _active: boolean[];
    _maxGeometryCount: number;
    _maxVertexCount: number;
    _maxIndexCount: number;
    _geometryInitialized: boolean;
    _geometryCount: number;
    _matrices: Matrix4[];
    _matricesTexture: DataTexture | null;
    _customUniforms: Record<string, IUniform>;
    constructor(maxGeometryCount: number, maxVertexCount: number, maxIndexCount?: number, material?: Material);
    _initMatricesTexture(): void;
    _initShader(): void;
    _initializeGeometry(reference: BufferGeometry): void;
    _validateGeometry(geometry: BufferGeometry): void;
    getGeometryCount(): number;
    getVertexCount(): number;
    getIndexCount(): number;
    addGeometry(geometry: BufferGeometry, vertexCount?: number, indexCount?: number): number;
    /**
     * @deprecated use `addGeometry` instead.
     */
    applyGeometry(geometry: BufferGeometry): number;
    setGeometryAt(id: number, geometry: BufferGeometry): number;
    deleteGeometry(geometryId: number): this;
    optimize(): never;
    setMatrixAt(geometryId: number, matrix: Matrix4): this;
    getMatrixAt(geometryId: number, matrix: Matrix4): Matrix4;
    setVisibleAt(geometryId: number, value: boolean): this;
    getVisibleAt(geometryId: number): boolean;
    raycast(): void;
    copy(): never;
    toJSON(): never;
    dispose(): this;
}
export { BatchedMesh };
