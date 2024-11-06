import { BufferGeometry, Vector3, Side, Material, Ray, Sphere, Matrix4, Color,
  Intersection, Box3, Triangle, Vector2, Raycaster, MeshBasicMaterial, Group,
  LineBasicMaterial, Mesh, DataTexture, BufferAttribute, Line3, Object3D } from 'three';

// Contants
export enum SplitStrategy {}
export const CENTER: SplitStrategy;
export const AVERAGE: SplitStrategy;
export const SAH: SplitStrategy;

export enum ShapecastIntersection {}
export const NOT_INTERSECTED: ShapecastIntersection;
export const INTERSECTED: ShapecastIntersection;
export const CONTAINED: ShapecastIntersection;

// MeshBVH
export interface HitPointInfo {
  point: Vector3;
  distance: number;
  faceIndex: number;
}

export interface MeshBVHOptions {
  strategy?: SplitStrategy;
  maxDepth?: number;
  maxLeafTris?: number;
  setBoundingBox?: boolean;
  useSharedArrayBuffer?: boolean;
  verbose?: boolean;
  onProgress?: ( progress: number ) => void;
  range?: { start: number; count: number };
}

export interface MeshBVHSerializeOptions {
  cloneBuffers?: boolean;
}

export interface MeshBVHDeserializeOptions {
  setIndex?: boolean;
}


export class MeshBVH {

  readonly geometry: BufferGeometry;

  static serialize( bvh: MeshBVH, options?: MeshBVHSerializeOptions ): SerializedBVH;

  static deserialize(
    data: SerializedBVH,
    geometry: BufferGeometry,
    options?: MeshBVHDeserializeOptions
  ): MeshBVH;

  constructor( geometry: BufferGeometry, options?: MeshBVHOptions );

  raycast( ray: Ray, materialOrSide?: Side | Array<Material> | Material, near?: number, far?: number ): Array<Intersection>

  raycastFirst( ray: Ray, materialOrSide?: Side | Array<Material> | Material, near?: number, far?: number ): Intersection;

  intersectsSphere( sphere: Sphere ): boolean;

  intersectsBox( box: Box3, boxToMesh: Matrix4 ): boolean;

  intersectsGeometry( geometry: BufferGeometry, geometryToBvh: Matrix4 ): boolean;

  closestPointToPoint(
    point: Vector3,
    target?: HitPointInfo,
    minThreshold?: number,
    maxThreshold?: number
  ): HitPointInfo | null;

  closestPointToGeometry(
    geometry: BufferGeometry,
    geometryToBvh: Matrix4,
    target1?: HitPointInfo,
    target2?: HitPointInfo,
    minThreshold?: number,
    maxThreshold?: number
  ): HitPointInfo | null;

  // union types to enable at least one of two functions:
  // https://stackoverflow.com/a/60617060/9838891
  shapecast(
    callbacks: {

      intersectsBounds: (
        box: Box3,
        isLeaf: boolean,
        score: number | undefined,
        depth: number,
        nodeIndex: number
      ) => ShapecastIntersection|boolean,

      boundsTraverseOrder?: (
        box: Box3
      ) => number,

    } & ( {

      intersectsRange: (
        triangleOffset: number,
        triangleCount: number,
        contained: boolean,
        depth: number,
        nodeIndex: number,
        box: Box3
      ) => boolean,

    } | {

      intersectsTriangle: (
        triangle: ExtendedTriangle,
        triangleIndex: number,
        contained: boolean,
        depth: number
      ) => boolean|void

    } )
  ): boolean;

  // union types to enable at least one of two functions:
  // https://stackoverflow.com/a/60617060/9838891
  bvhcast(
    otherBVH: MeshBVH,
    matrixToLocal: Matrix4,
    callbacks: ( {

      intersectsRanges: (
        offset1: number,
        count1: number,
        offset2: number,
        count2: number,
        depth1: number,
        index1: number,
        depth2: number,
        index2: number
      ) => boolean

    } | {

      intersectsTriangles: (
        triangle1: ExtendedTriangle,
        triangle2: ExtendedTriangle,
        i1: number,
        i2: number,
        depth1: number,
        index1: number,
        depth2: number,
        index2: number,
      ) => boolean,

    } )
  ): boolean;

  traverse(
    callback: (
      depth: number,
      isLeaf: boolean,
      boundingData: ArrayBuffer,
      offsetOrSplit: number,
      count: number
    ) => void,
    rootIndex?: number
  ): void;

  refit( nodeIndices?: Array<number> | Set<number> ): void;

  getBoundingBox( target: Box3 ): Box3;

}

// SerializedBVH
export class SerializedBVH {

  roots: Array<ArrayBuffer>;
  index: ArrayBufferView;

}

// MeshBVHHelper
export class MeshBVHHelper extends Group {

  opacity: number;
  depth: number;
  displayParents: boolean;
  displayEdges: boolean;
  edgeMaterial: LineBasicMaterial;
  meshMaterial: MeshBasicMaterial;

  constructor( mesh: Mesh, depth?: number );

  update(): void;

  get color(): Color;

}

// THREE.js Extensions

export function computeBoundsTree( options?: MeshBVHOptions ): MeshBVH;

export function disposeBoundsTree(): void;

export function computeBatchedBoundsTree( index?: Number, options?: MeshBVHOptions ): MeshBVH | MeshBVH[];

export function disposeBatchedBoundsTree( index?: Number ): void;

export function acceleratedRaycast(
  raycaster: Raycaster,
  intersects: Array<Intersection>
): void;

declare module 'three' {
  export interface BufferGeometry {
    boundsTree?: MeshBVH;
    computeBoundsTree: typeof computeBoundsTree;
    disposeBoundsTree: typeof disposeBoundsTree;
  }

  export interface BatchedMesh {
    boundsTrees?: Array<MeshBVH | null>;
    computeBoundsTree: typeof computeBatchedBoundsTree;
    disposeBoundsTree: typeof disposeBatchedBoundsTree;
  }

  export interface Raycaster {
    firstHitOnly?: boolean;
  }
}

// GenerateMeshBVHWorker
// export class GenerateMeshBVHWorker {

//   running: boolean;

//   generate( geometry: BufferGeometry, options?: MeshBVHOptions ): Promise<MeshBVH>;

//   terminate(): boolean;

// }

// Debug functions
export function estimateMemoryInBytes( bvh: MeshBVH ): number;

export interface ExtremeInfo {
  nodeCount: number;
  leafNodeCount: number;
  surfaceAreaScore: number;
  depth: {min: number, max: number};
  tris: {min: number, max: number};
  splits: [number, number, number];
}

export function getBVHExtremes( bvh :MeshBVH ): Array<ExtremeInfo>;

export function validateBounds( bvh: MeshBVH ): boolean;

export interface TreeNode {
  bounds: Box3;
  count: number;
  offset: number;
  left?: TreeNode;
  right?: TreeNode;
}

export function getJSONStructure( bvh: MeshBVH ): TreeNode;

// Triangle Utilities
export interface HitTriangleInfo {
  face: {
    a: number,
    b: number,
    c: number,
    materialIndex: number,
    normal: Vector3
  },
  uv: Vector2
}

export function getTriangleHitPointInfo(
  point: Vector3,
  geometry : BufferGeometry,
  triangleIndex: number,
  target?: HitTriangleInfo
): HitTriangleInfo

// Shader Utilities
declare class VertexAttributeTexture extends DataTexture {

  overrideItemSize: number | null;
  updateFrom( attribute: BufferAttribute ): void;

}

export class FloatVertexAttributeTexture extends VertexAttributeTexture {}
export class UIntVertexAttributeTexture extends VertexAttributeTexture {}
export class IntVertexAttributeTexture extends VertexAttributeTexture {}

export class MeshBVHUniformStruct {

  updateFrom( bvh: MeshBVH ): void;
  dispose(): void;

}

export const BVHShaderGLSL: {
	bvh_distance_functions: string;
	bvh_ray_functions: string;
	bvh_struct_definitions: string;
	common_functions: string;
};

// backwards compatibility
export const shaderStructs: string;
export const shaderDistanceFunction: string;
export const shaderIntersectFunction: string;

// Math classes
export class ExtendedTriangle extends Triangle {

  needsUpdate : boolean;

  intersectsTriangle( other : Triangle, target? : Line3 ) : boolean;
  intersectsSphere( sphere : Sphere ) : boolean;
  closestPointToSegment( segment : Line3, target1? : Vector3, target2? : Vector3 ) : number;
  distanceToPoint( point : Vector3 ) : number;
  distanceToTriangle( tri : Triangle ) : number;

}

export class OrientedBox {

  min: Vector3;
  max: Vector3;
  matrix : Matrix4;
  needsUpdate : boolean;

  constructor( min : Vector3, max : Vector3 );
  set( min : Vector3, max : Vector3, matrix : Matrix4 ) : OrientedBox;
  intersectsBox( box : Box3 ) : boolean;
  intersectsTriangle( tri : Triangle ) : boolean;
  closestPointToPoint( point : Vector3, target? : Vector3 ) : number;
  distanceToPoint( point : Vector3 ) : number;
  distanceToBox( box : Box3, threshold? : number, target1? : Vector3, target2? : Vector3 ) : number;

}

export class StaticGeometryGenerator {

  useGroups : boolean;
  attributes : Array<string>;
  applyWorldTransforms : boolean;

  constructor( objects : Array<Object3D> | Object3D );
  getMaterials() : Array<Material>;
  generate( target? : BufferGeometry ) : BufferGeometry;

}
