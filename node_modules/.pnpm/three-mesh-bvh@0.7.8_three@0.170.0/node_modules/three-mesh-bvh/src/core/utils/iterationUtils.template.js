/* eslint-disable indent */
import { intersectTri } from '../../utils/ThreeRayIntersectUtilities.js';
import { setTriangle } from '../../utils/TriangleUtilities.js';

export function intersectTris/* @echo INDIRECT_STRING */( bvh, side, ray, offset, count, intersections, near, far ) {

	const { geometry, _indirectBuffer } = bvh;
	for ( let i = offset, end = offset + count; i < end; i ++ ) {

		/* @if INDIRECT */

		let vi = _indirectBuffer ? _indirectBuffer[ i ] : i;
		intersectTri( geometry, side, ray, vi, intersections, near, far );

		/* @else */

		intersectTri( geometry, side, ray, i, intersections, near, far );

		/* @endif */

	}

}

export function intersectClosestTri/* @echo INDIRECT_STRING */( bvh, side, ray, offset, count, near, far ) {

	const { geometry, _indirectBuffer } = bvh;
	let dist = Infinity;
	let res = null;
	for ( let i = offset, end = offset + count; i < end; i ++ ) {

		let intersection;
		/* @if INDIRECT */

		intersection = intersectTri( geometry, side, ray, _indirectBuffer ? _indirectBuffer[ i ] : i, null, near, far );

		/* @else */

		intersection = intersectTri( geometry, side, ray, i, null, near, far );

		/* @endif */

		if ( intersection && intersection.distance < dist ) {

			res = intersection;
			dist = intersection.distance;

		}

	}

	return res;

}

export function iterateOverTriangles/* @echo INDIRECT_STRING */(
	offset,
	count,
	bvh,
	intersectsTriangleFunc,
	contained,
	depth,
	triangle
) {

	const { geometry } = bvh;
	const { index } = geometry;
	const pos = geometry.attributes.position;
	for ( let i = offset, l = count + offset; i < l; i ++ ) {

		let tri;
		/* @if INDIRECT */

		tri = bvh.resolveTriangleIndex( i );

		/* @else */

		tri = i;

		/* @endif */
		setTriangle( triangle, tri * 3, index, pos );
		triangle.needsUpdate = true;

		if ( intersectsTriangleFunc( triangle, tri, contained, depth ) ) {

			return true;

		}

	}

	return false;

}
