import { Vector3 } from 'three';
import { IS_LEAF, OFFSET, COUNT, LEFT_NODE, RIGHT_NODE } from '../utils/nodeBufferUtils.js';
import { BufferStack } from '../utils/BufferStack.js';
import { ExtendedTrianglePool } from '../../utils/ExtendedTrianglePool.js';
import { setTriangle } from '../../utils/TriangleUtilities.js';
import { closestDistanceSquaredPointToBox } from '../utils/distanceUtils.js';

/******************************************************************/
/* This file is generated from "closestPointToPoint.template.js". */
/******************************************************************/

const temp = /* @__PURE__ */ new Vector3();
const temp1 = /* @__PURE__ */ new Vector3();

function closestPointToPoint(
	bvh,
	root,
	point,
	target,
	minThreshold,
	maxThreshold
) {

	const minThresholdSq = minThreshold * minThreshold;
	const maxThresholdSq = maxThreshold * maxThreshold;
	let closestDistanceSq = Infinity;
	let closestDistanceTriIndex = null;

	const { geometry } = bvh;
	const { index } = geometry;
	const pos = geometry.attributes.position;
	const triangle = ExtendedTrianglePool.getPrimitive();

	BufferStack.setBuffer( bvh._roots[ root ] );
	const { float32Array, uint16Array, uint32Array } = BufferStack;
	_closestPointToPoint( root );
	BufferStack.clearBuffer();

	if ( closestDistanceSq === Infinity ) return null;

	const closestDistance = Math.sqrt( closestDistanceSq );

	if ( ! target.point ) target.point = temp1.clone();
	else target.point.copy( temp1 );
	target.distance = closestDistance;
	target.faceIndex = closestDistanceTriIndex;

	return target;


	// early out if under minThreshold
	// skip checking if over maxThreshold
	// set minThreshold = maxThreshold to quickly check if a point is within a threshold
	// returns Infinity if no value found
	function _closestPointToPoint( nodeIndex32 ) {

		const nodeIndex16 = nodeIndex32 * 2;
		const isLeaf = IS_LEAF( nodeIndex16, uint16Array );
		if ( isLeaf ) {

			const offset = OFFSET( nodeIndex32, uint32Array );
			const count = COUNT( nodeIndex16, uint16Array );

			for ( let i = offset, l = count + offset; i < l; i ++ ) {


				setTriangle( triangle, i * 3, index, pos );


				triangle.needsUpdate = true;

				triangle.closestPointToPoint( point, temp );
				const distSq = point.distanceToSquared( temp );
				if ( distSq < closestDistanceSq ) {

					temp1.copy( temp );
					closestDistanceSq = distSq;
					closestDistanceTriIndex = i;

					if ( distSq < minThresholdSq ) return true;

				}

			}

			return;

		}

		const leftIndex = LEFT_NODE( nodeIndex32 );
		const rightIndex = RIGHT_NODE( nodeIndex32, uint32Array );

		const leftDistance = closestDistanceSquaredPointToBox( leftIndex, float32Array, point );
		const rightDistance = closestDistanceSquaredPointToBox( rightIndex, float32Array, point );

		if ( leftDistance <= rightDistance ) {

			if ( leftDistance < closestDistanceSq && leftDistance < maxThresholdSq ) {

				if ( _closestPointToPoint( leftIndex ) ) return true;
				if ( rightDistance < closestDistanceSq ) return _closestPointToPoint( rightIndex );

			}

		} else if ( rightDistance < closestDistanceSq && rightDistance < maxThresholdSq ) {

			if ( _closestPointToPoint( rightIndex ) ) return true;
			if ( leftDistance < closestDistanceSq ) return _closestPointToPoint( leftIndex );

		}

	}

}

export { closestPointToPoint };
