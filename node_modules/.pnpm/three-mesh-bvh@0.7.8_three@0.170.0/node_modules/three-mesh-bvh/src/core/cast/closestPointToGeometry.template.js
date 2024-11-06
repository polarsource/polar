import { Vector3, Matrix4 } from 'three';
import { OrientedBox } from '../../math/OrientedBox.js';
import { setTriangle } from '../../utils/TriangleUtilities.js';
import { getTriCount } from '../build/geometryUtils.js';
import { ExtendedTrianglePool } from '../../utils/ExtendedTrianglePool.js';

const tempMatrix = /* @__PURE__ */ new Matrix4();
const obb = /* @__PURE__ */ new OrientedBox();
const obb2 = /* @__PURE__ */ new OrientedBox();
const temp1 = /* @__PURE__ */ new Vector3();
const temp2 = /* @__PURE__ */ new Vector3();
const temp3 = /* @__PURE__ */ new Vector3();
const temp4 = /* @__PURE__ */ new Vector3();

export function closestPointToGeometry/* @echo INDIRECT_STRING */(
	bvh,
	otherGeometry,
	geometryToBvh,
	target1 = { },
	target2 = { },
	minThreshold = 0,
	maxThreshold = Infinity,
) {

	if ( ! otherGeometry.boundingBox ) {

		otherGeometry.computeBoundingBox();

	}

	obb.set( otherGeometry.boundingBox.min, otherGeometry.boundingBox.max, geometryToBvh );
	obb.needsUpdate = true;

	const geometry = bvh.geometry;
	const pos = geometry.attributes.position;
	const index = geometry.index;
	const otherPos = otherGeometry.attributes.position;
	const otherIndex = otherGeometry.index;
	const triangle = ExtendedTrianglePool.getPrimitive();
	const triangle2 = ExtendedTrianglePool.getPrimitive();

	let tempTarget1 = temp1;
	let tempTargetDest1 = temp2;
	let tempTarget2 = null;
	let tempTargetDest2 = null;

	if ( target2 ) {

		tempTarget2 = temp3;
		tempTargetDest2 = temp4;

	}

	let closestDistance = Infinity;
	let closestDistanceTriIndex = null;
	let closestDistanceOtherTriIndex = null;
	tempMatrix.copy( geometryToBvh ).invert();
	obb2.matrix.copy( tempMatrix );
	bvh.shapecast(
		{

			boundsTraverseOrder: box => {

				return obb.distanceToBox( box );

			},

			intersectsBounds: ( box, isLeaf, score ) => {

				if ( score < closestDistance && score < maxThreshold ) {

					// if we know the triangles of this bounds will be intersected next then
					// save the bounds to use during triangle checks.
					if ( isLeaf ) {

						obb2.min.copy( box.min );
						obb2.max.copy( box.max );
						obb2.needsUpdate = true;

					}

					return true;

				}

				return false;

			},

			intersectsRange: ( offset, count ) => {

				if ( otherGeometry.boundsTree ) {

					// if the other geometry has a bvh then use the accelerated path where we use shapecast to find
					// the closest bounds in the other geometry to check.
					const otherBvh = otherGeometry.boundsTree;
					return otherBvh.shapecast( {
						boundsTraverseOrder: box => {

							return obb2.distanceToBox( box );

						},

						intersectsBounds: ( box, isLeaf, score ) => {

							return score < closestDistance && score < maxThreshold;

						},

						intersectsRange: ( otherOffset, otherCount ) => {

							for ( let i2 = otherOffset, l2 = otherOffset + otherCount; i2 < l2; i2 ++ ) {

								/* @if INDIRECT */

								const ti2 = otherBvh.resolveTriangleIndex( i2 );
								setTriangle( triangle2, 3 * ti2, otherIndex, otherPos );

								/* @else */

								setTriangle( triangle2, 3 * i2, otherIndex, otherPos );

								/* @endif */
								triangle2.a.applyMatrix4( geometryToBvh );
								triangle2.b.applyMatrix4( geometryToBvh );
								triangle2.c.applyMatrix4( geometryToBvh );
								triangle2.needsUpdate = true;

								for ( let i = offset, l = offset + count; i < l; i ++ ) {

									/* @if INDIRECT */

									const ti = bvh.resolveTriangleIndex( i );
									setTriangle( triangle, 3 * ti, index, pos );

									/* @else */

									setTriangle( triangle, 3 * i, index, pos );

									/* @endif */
									triangle.needsUpdate = true;

									const dist = triangle.distanceToTriangle( triangle2, tempTarget1, tempTarget2 );
									if ( dist < closestDistance ) {

										tempTargetDest1.copy( tempTarget1 );

										if ( tempTargetDest2 ) {

											tempTargetDest2.copy( tempTarget2 );

										}

										closestDistance = dist;
										closestDistanceTriIndex = i;
										closestDistanceOtherTriIndex = i2;

									}

									// stop traversal if we find a point that's under the given threshold
									if ( dist < minThreshold ) {

										return true;

									}

								}

							}

						},
					} );

				} else {

					// If no bounds tree then we'll just check every triangle.
					const triCount = getTriCount( otherGeometry );
					for ( let i2 = 0, l2 = triCount; i2 < l2; i2 ++ ) {

						setTriangle( triangle2, 3 * i2, otherIndex, otherPos );
						triangle2.a.applyMatrix4( geometryToBvh );
						triangle2.b.applyMatrix4( geometryToBvh );
						triangle2.c.applyMatrix4( geometryToBvh );
						triangle2.needsUpdate = true;

						for ( let i = offset, l = offset + count; i < l; i ++ ) {

							/* @if INDIRECT */

							const ti = bvh.resolveTriangleIndex( i );
							setTriangle( triangle, 3 * ti, index, pos );

							/* @else */

							setTriangle( triangle, 3 * i, index, pos );

							/* @endif */
							triangle.needsUpdate = true;

							const dist = triangle.distanceToTriangle( triangle2, tempTarget1, tempTarget2 );
							if ( dist < closestDistance ) {

								tempTargetDest1.copy( tempTarget1 );

								if ( tempTargetDest2 ) {

									tempTargetDest2.copy( tempTarget2 );

								}

								closestDistance = dist;
								closestDistanceTriIndex = i;
								closestDistanceOtherTriIndex = i2;

							}

							// stop traversal if we find a point that's under the given threshold
							if ( dist < minThreshold ) {

								return true;

							}

						}

					}

				}

			},

		}

	);

	ExtendedTrianglePool.releasePrimitive( triangle );
	ExtendedTrianglePool.releasePrimitive( triangle2 );

	if ( closestDistance === Infinity ) {

		return null;

	}

	if ( ! target1.point ) {

		target1.point = tempTargetDest1.clone();

	} else {

		target1.point.copy( tempTargetDest1 );

	}

	target1.distance = closestDistance,
	target1.faceIndex = closestDistanceTriIndex;

	if ( target2 ) {

		if ( ! target2.point ) target2.point = tempTargetDest2.clone();
		else target2.point.copy( tempTargetDest2 );
		target2.point.applyMatrix4( tempMatrix );
		tempTargetDest1.applyMatrix4( tempMatrix );
		target2.distance = tempTargetDest1.sub( target2.point ).length();
		target2.faceIndex = closestDistanceOtherTriIndex;

	}

	return target1;

}
