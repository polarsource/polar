import { Box3, Matrix4 } from 'three';
import { OrientedBox } from '../../math/OrientedBox.js';
import { ExtendedTriangle } from '../../math/ExtendedTriangle.js';
import { setTriangle } from '../../utils/TriangleUtilities.js';
import { arrayToBox } from '../../utils/ArrayBoxUtilities.js';
import { IS_LEAF, OFFSET, COUNT, BOUNDING_DATA_INDEX } from '../utils/nodeBufferUtils.js';
import { BufferStack } from '../utils/BufferStack.js';

/*****************************************************************/
/* This file is generated from "intersectsGeometry.template.js". */
/*****************************************************************/
/* eslint-disable indent */

const boundingBox = /* @__PURE__ */ new Box3();
const triangle = /* @__PURE__ */ new ExtendedTriangle();
const triangle2 = /* @__PURE__ */ new ExtendedTriangle();
const invertedMat = /* @__PURE__ */ new Matrix4();

const obb = /* @__PURE__ */ new OrientedBox();
const obb2 = /* @__PURE__ */ new OrientedBox();

function intersectsGeometry( bvh, root, otherGeometry, geometryToBvh ) {

	BufferStack.setBuffer( bvh._roots[ root ] );
	const result = _intersectsGeometry( 0, bvh, otherGeometry, geometryToBvh );
	BufferStack.clearBuffer();

	return result;

}

function _intersectsGeometry( nodeIndex32, bvh, otherGeometry, geometryToBvh, cachedObb = null ) {

	const { float32Array, uint16Array, uint32Array } = BufferStack;
	let nodeIndex16 = nodeIndex32 * 2;

	if ( cachedObb === null ) {

		if ( ! otherGeometry.boundingBox ) {

			otherGeometry.computeBoundingBox();

		}

		obb.set( otherGeometry.boundingBox.min, otherGeometry.boundingBox.max, geometryToBvh );
		cachedObb = obb;

	}

	const isLeaf = IS_LEAF( nodeIndex16, uint16Array );
	if ( isLeaf ) {

		const thisGeometry = bvh.geometry;
		const thisIndex = thisGeometry.index;
		const thisPos = thisGeometry.attributes.position;

		const index = otherGeometry.index;
		const pos = otherGeometry.attributes.position;

		const offset = OFFSET( nodeIndex32, uint32Array );
		const count = COUNT( nodeIndex16, uint16Array );

		// get the inverse of the geometry matrix so we can transform our triangles into the
		// geometry space we're trying to test. We assume there are fewer triangles being checked
		// here.
		invertedMat.copy( geometryToBvh ).invert();

		if ( otherGeometry.boundsTree ) {

			// if there's a bounds tree
			arrayToBox( BOUNDING_DATA_INDEX( nodeIndex32 ), float32Array, obb2 );
			obb2.matrix.copy( invertedMat );
			obb2.needsUpdate = true;

			// TODO: use a triangle iteration function here
			const res = otherGeometry.boundsTree.shapecast( {

				intersectsBounds: box => obb2.intersectsBox( box ),

				intersectsTriangle: tri => {

					tri.a.applyMatrix4( geometryToBvh );
					tri.b.applyMatrix4( geometryToBvh );
					tri.c.applyMatrix4( geometryToBvh );
					tri.needsUpdate = true;


					for ( let i = offset * 3, l = ( count + offset ) * 3; i < l; i += 3 ) {

						// this triangle needs to be transformed into the current BVH coordinate frame
						setTriangle( triangle2, i, thisIndex, thisPos );
						triangle2.needsUpdate = true;
						if ( tri.intersectsTriangle( triangle2 ) ) {

							return true;

						}

					}


					return false;

				}

			} );

			return res;

		} else {

			// if we're just dealing with raw geometry

			for ( let i = offset * 3, l = ( count + offset ) * 3; i < l; i += 3 ) {

				// this triangle needs to be transformed into the current BVH coordinate frame
				setTriangle( triangle, i, thisIndex, thisPos );


				triangle.a.applyMatrix4( invertedMat );
				triangle.b.applyMatrix4( invertedMat );
				triangle.c.applyMatrix4( invertedMat );
				triangle.needsUpdate = true;

				for ( let i2 = 0, l2 = index.count; i2 < l2; i2 += 3 ) {

					setTriangle( triangle2, i2, index, pos );
					triangle2.needsUpdate = true;

					if ( triangle.intersectsTriangle( triangle2 ) ) {

						return true;

					}

				}


			}


		}

	} else {

		const left = nodeIndex32 + 8;
		const right = uint32Array[ nodeIndex32 + 6 ];

		arrayToBox( BOUNDING_DATA_INDEX( left ), float32Array, boundingBox );
		const leftIntersection =
			cachedObb.intersectsBox( boundingBox ) &&
			_intersectsGeometry( left, bvh, otherGeometry, geometryToBvh, cachedObb );

		if ( leftIntersection ) return true;

		arrayToBox( BOUNDING_DATA_INDEX( right ), float32Array, boundingBox );
		const rightIntersection =
			cachedObb.intersectsBox( boundingBox ) &&
			_intersectsGeometry( right, bvh, otherGeometry, geometryToBvh, cachedObb );

		if ( rightIntersection ) return true;

		return false;

	}

}

export { intersectsGeometry };
