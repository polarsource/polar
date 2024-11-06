export { MeshBVH } from './core/MeshBVH.js';
export { MeshBVHHelper } from './objects/MeshBVHHelper.js';
export { CENTER, AVERAGE, SAH, NOT_INTERSECTED, INTERSECTED, CONTAINED } from './core/Constants.js';
export { getBVHExtremes, estimateMemoryInBytes, getJSONStructure, validateBounds } from './debug/Debug.js';
export * from './utils/ExtensionUtilities.js';
export { getTriangleHitPointInfo } from './utils/TriangleUtilities.js';
export * from './math/ExtendedTriangle.js';
export * from './math/OrientedBox.js';
export * from './gpu/MeshBVHUniformStruct.js';
export * from './gpu/VertexAttributeTexture.js';
export * from './utils/StaticGeometryGenerator.js';
export * as BVHShaderGLSL from './gpu/BVHShaderGLSL.js';

// backwards compatibility
import * as BVHShaderGLSL from './gpu/BVHShaderGLSL.js';
export const shaderStructs = BVHShaderGLSL.bvh_struct_definitions;
export const shaderDistanceFunction = BVHShaderGLSL.bvh_distance_functions;
export const shaderIntersectFunction = `
	${ BVHShaderGLSL.common_functions }
	${ BVHShaderGLSL.bvh_ray_functions }
`;
