import { BufferAttribute, BufferGeometry, Float32BufferAttribute, InterleavedBufferAttribute, Mesh, Line, Points } from 'three';
/**
 * @param  {Array<BufferGeometry>} geometries
 * @param  {Boolean} useGroups
 * @return {BufferGeometry}
 */
export declare const mergeBufferGeometries: (geometries: BufferGeometry[], useGroups?: boolean) => BufferGeometry | null;
/**
 * @param {Array<BufferAttribute>} attributes
 * @return {BufferAttribute}
 */
export declare const mergeBufferAttributes: (attributes: BufferAttribute[]) => BufferAttribute | null | undefined;
/**
 * @param {Array<BufferAttribute>} attributes
 * @return {Array<InterleavedBufferAttribute>}
 */
export declare const interleaveAttributes: (attributes: BufferAttribute[]) => InterleavedBufferAttribute[] | null;
/**
 * @param {Array<BufferGeometry>} geometry
 * @return {number}
 */
export declare function estimateBytesUsed(geometry: BufferGeometry): number;
/**
 * @param {BufferGeometry} geometry
 * @param {number} tolerance
 * @return {BufferGeometry>}
 */
export declare function mergeVertices(geometry: BufferGeometry, tolerance?: number): BufferGeometry;
/**
 * @param {BufferGeometry} geometry
 * @param {number} drawMode
 * @return {BufferGeometry}
 */
export declare function toTrianglesDrawMode(geometry: BufferGeometry, drawMode: number): BufferGeometry;
/**
 * Calculates the morphed attributes of a morphed/skinned BufferGeometry.
 * Helpful for Raytracing or Decals.
 * @param {Mesh | Line | Points} object An instance of Mesh, Line or Points.
 * @return {Object} An Object with original position/normal attributes and morphed ones.
 */
export type ComputedMorphedAttribute = {
    positionAttribute: BufferAttribute | InterleavedBufferAttribute;
    normalAttribute: BufferAttribute | InterleavedBufferAttribute;
    morphedPositionAttribute: Float32BufferAttribute;
    morphedNormalAttribute: Float32BufferAttribute;
};
export declare function computeMorphedAttributes(object: Mesh | Line | Points): ComputedMorphedAttribute | null;
/**
 * Modifies the supplied geometry if it is non-indexed, otherwise creates a new,
 * non-indexed geometry. Returns the geometry with smooth normals everywhere except
 * faces that meet at an angle greater than the crease angle.
 *
 * Backwards compatible with code such as @react-three/drei's `<RoundedBox>`
 * which uses this method to operate on the original geometry.
 *
 * As of this writing, BufferGeometry.toNonIndexed() warns if the geometry is
 * non-indexed and returns `this`, i.e. the same geometry on which it was called:
 * `BufferGeometry is already non-indexed.`
 *
 * @param geometry
 * @param creaseAngle
 */
export declare function toCreasedNormals(geometry: BufferGeometry, creaseAngle?: number): BufferGeometry;
