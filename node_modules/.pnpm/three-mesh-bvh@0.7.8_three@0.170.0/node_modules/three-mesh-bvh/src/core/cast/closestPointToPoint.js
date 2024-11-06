import { Vector3 } from 'three';

const temp = /* @__PURE__ */ new Vector3();
const temp1 = /* @__PURE__ */ new Vector3();

export function closestPointToPoint(
	bvh,
	point,
	target = { },
	minThreshold = 0,
	maxThreshold = Infinity,
) {

	// early out if under minThreshold
	// skip checking if over maxThreshold
	// set minThreshold = maxThreshold to quickly check if a point is within a threshold
	// returns Infinity if no value found
	const minThresholdSq = minThreshold * minThreshold;
	const maxThresholdSq = maxThreshold * maxThreshold;
	let closestDistanceSq = Infinity;
	let closestDistanceTriIndex = null;
	bvh.shapecast(

		{

			boundsTraverseOrder: box => {

				temp.copy( point ).clamp( box.min, box.max );
				return temp.distanceToSquared( point );

			},

			intersectsBounds: ( box, isLeaf, score ) => {

				return score < closestDistanceSq && score < maxThresholdSq;

			},

			intersectsTriangle: ( tri, triIndex ) => {

				tri.closestPointToPoint( point, temp );
				const distSq = point.distanceToSquared( temp );
				if ( distSq < closestDistanceSq ) {

					temp1.copy( temp );
					closestDistanceSq = distSq;
					closestDistanceTriIndex = triIndex;

				}

				if ( distSq < minThresholdSq ) {

					return true;

				} else {

					return false;

				}

			},

		}

	);

	if ( closestDistanceSq === Infinity ) return null;

	const closestDistance = Math.sqrt( closestDistanceSq );

	if ( ! target.point ) target.point = temp1.clone();
	else target.point.copy( temp1 );
	target.distance = closestDistance,
	target.faceIndex = closestDistanceTriIndex;

	return target;

}
