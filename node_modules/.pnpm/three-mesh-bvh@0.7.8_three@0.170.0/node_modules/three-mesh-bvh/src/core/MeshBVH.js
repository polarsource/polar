import { BufferAttribute, Box3, FrontSide } from 'three';
import { CENTER, BYTES_PER_NODE, IS_LEAFNODE_FLAG, SKIP_GENERATION } from './Constants.js';
import { buildPackedTree } from './build/buildTree.js';
import { OrientedBox } from '../math/OrientedBox.js';
import { arrayToBox } from '../utils/ArrayBoxUtilities.js';
import { ExtendedTrianglePool } from '../utils/ExtendedTrianglePool.js';
import { shapecast } from './cast/shapecast.js';
import { closestPointToPoint } from './cast/closestPointToPoint.js';

import { iterateOverTriangles } from './utils/iterationUtils.generated.js';
import { refit } from './cast/refit.generated.js';
import { raycast } from './cast/raycast.generated.js';
import { raycastFirst } from './cast/raycastFirst.generated.js';
import { intersectsGeometry } from './cast/intersectsGeometry.generated.js';
import { closestPointToGeometry } from './cast/closestPointToGeometry.generated.js';

import { iterateOverTriangles_indirect } from './utils/iterationUtils_indirect.generated.js';
import { refit_indirect } from './cast/refit_indirect.generated.js';
import { raycast_indirect } from './cast/raycast_indirect.generated.js';
import { raycastFirst_indirect } from './cast/raycastFirst_indirect.generated.js';
import { intersectsGeometry_indirect } from './cast/intersectsGeometry_indirect.generated.js';
import { closestPointToGeometry_indirect } from './cast/closestPointToGeometry_indirect.generated.js';
import { isSharedArrayBufferSupported } from '../utils/BufferUtils.js';
import { setTriangle } from '../utils/TriangleUtilities.js';
import { bvhcast } from './cast/bvhcast.js';

const obb = /* @__PURE__ */ new OrientedBox();
const tempBox = /* @__PURE__ */ new Box3();
export const DEFAULT_OPTIONS = {
	strategy: CENTER,
	maxDepth: 40,
	maxLeafTris: 10,
	useSharedArrayBuffer: false,
	setBoundingBox: true,
	onProgress: null,
	indirect: false,
	verbose: true,
	range: null
};

export class MeshBVH {

	static serialize( bvh, options = {} ) {

		options = {
			cloneBuffers: true,
			...options,
		};

		const geometry = bvh.geometry;
		const rootData = bvh._roots;
		const indirectBuffer = bvh._indirectBuffer;
		const indexAttribute = geometry.getIndex();
		let result;
		if ( options.cloneBuffers ) {

			result = {
				roots: rootData.map( root => root.slice() ),
				index: indexAttribute ? indexAttribute.array.slice() : null,
				indirectBuffer: indirectBuffer ? indirectBuffer.slice() : null,
			};

		} else {

			result = {
				roots: rootData,
				index: indexAttribute ? indexAttribute.array : null,
				indirectBuffer: indirectBuffer,
			};

		}

		return result;

	}

	static deserialize( data, geometry, options = {} ) {

		options = {
			setIndex: true,
			indirect: Boolean( data.indirectBuffer ),
			...options,
		};

		const { index, roots, indirectBuffer } = data;
		const bvh = new MeshBVH( geometry, { ...options, [ SKIP_GENERATION ]: true } );
		bvh._roots = roots;
		bvh._indirectBuffer = indirectBuffer || null;

		if ( options.setIndex ) {

			const indexAttribute = geometry.getIndex();
			if ( indexAttribute === null ) {

				const newIndex = new BufferAttribute( data.index, 1, false );
				geometry.setIndex( newIndex );

			} else if ( indexAttribute.array !== index ) {

				indexAttribute.array.set( index );
				indexAttribute.needsUpdate = true;

			}

		}

		return bvh;

	}

	get indirect() {

		return ! ! this._indirectBuffer;

	}

	constructor( geometry, options = {} ) {

		if ( ! geometry.isBufferGeometry ) {

			throw new Error( 'MeshBVH: Only BufferGeometries are supported.' );

		} else if ( geometry.index && geometry.index.isInterleavedBufferAttribute ) {

			throw new Error( 'MeshBVH: InterleavedBufferAttribute is not supported for the index attribute.' );

		}

		// default options
		options = Object.assign( {

			...DEFAULT_OPTIONS,

			// undocumented options

			// Whether to skip generating the tree. Used for deserialization.
			[ SKIP_GENERATION ]: false,

		}, options );

		if ( options.useSharedArrayBuffer && ! isSharedArrayBufferSupported() ) {

			throw new Error( 'MeshBVH: SharedArrayBuffer is not available.' );

		}

		// retain references to the geometry so we can use them it without having to
		// take a geometry reference in every function.
		this.geometry = geometry;
		this._roots = null;
		this._indirectBuffer = null;
		if ( ! options[ SKIP_GENERATION ] ) {

			buildPackedTree( this, options );

			if ( ! geometry.boundingBox && options.setBoundingBox ) {

				geometry.boundingBox = this.getBoundingBox( new Box3() );

			}

		}

		this.resolveTriangleIndex = options.indirect ? i => this._indirectBuffer[ i ] : i => i;

	}

	refit( nodeIndices = null ) {

		const refitFunc = this.indirect ? refit_indirect : refit;
		return refitFunc( this, nodeIndices );

	}

	traverse( callback, rootIndex = 0 ) {

		const buffer = this._roots[ rootIndex ];
		const uint32Array = new Uint32Array( buffer );
		const uint16Array = new Uint16Array( buffer );
		_traverse( 0 );

		function _traverse( node32Index, depth = 0 ) {

			const node16Index = node32Index * 2;
			const isLeaf = uint16Array[ node16Index + 15 ] === IS_LEAFNODE_FLAG;
			if ( isLeaf ) {

				const offset = uint32Array[ node32Index + 6 ];
				const count = uint16Array[ node16Index + 14 ];
				callback( depth, isLeaf, new Float32Array( buffer, node32Index * 4, 6 ), offset, count );

			} else {

				// TODO: use node functions here
				const left = node32Index + BYTES_PER_NODE / 4;
				const right = uint32Array[ node32Index + 6 ];
				const splitAxis = uint32Array[ node32Index + 7 ];
				const stopTraversal = callback( depth, isLeaf, new Float32Array( buffer, node32Index * 4, 6 ), splitAxis );

				if ( ! stopTraversal ) {

					_traverse( left, depth + 1 );
					_traverse( right, depth + 1 );

				}

			}

		}

	}

	/* Core Cast Functions */
	raycast( ray, materialOrSide = FrontSide, near = 0, far = Infinity ) {

		const roots = this._roots;
		const geometry = this.geometry;
		const intersects = [];
		const isMaterial = materialOrSide.isMaterial;
		const isArrayMaterial = Array.isArray( materialOrSide );

		const groups = geometry.groups;
		const side = isMaterial ? materialOrSide.side : materialOrSide;
		const raycastFunc = this.indirect ? raycast_indirect : raycast;
		for ( let i = 0, l = roots.length; i < l; i ++ ) {

			const materialSide = isArrayMaterial ? materialOrSide[ groups[ i ].materialIndex ].side : side;
			const startCount = intersects.length;

			raycastFunc( this, i, materialSide, ray, intersects, near, far );

			if ( isArrayMaterial ) {

				const materialIndex = groups[ i ].materialIndex;
				for ( let j = startCount, jl = intersects.length; j < jl; j ++ ) {

					intersects[ j ].face.materialIndex = materialIndex;

				}

			}

		}

		return intersects;

	}

	raycastFirst( ray, materialOrSide = FrontSide, near = 0, far = Infinity ) {

		const roots = this._roots;
		const geometry = this.geometry;
		const isMaterial = materialOrSide.isMaterial;
		const isArrayMaterial = Array.isArray( materialOrSide );

		let closestResult = null;

		const groups = geometry.groups;
		const side = isMaterial ? materialOrSide.side : materialOrSide;
		const raycastFirstFunc = this.indirect ? raycastFirst_indirect : raycastFirst;
		for ( let i = 0, l = roots.length; i < l; i ++ ) {

			const materialSide = isArrayMaterial ? materialOrSide[ groups[ i ].materialIndex ].side : side;
			const result = raycastFirstFunc( this, i, materialSide, ray, near, far );
			if ( result != null && ( closestResult == null || result.distance < closestResult.distance ) ) {

				closestResult = result;
				if ( isArrayMaterial ) {

					result.face.materialIndex = groups[ i ].materialIndex;

				}

			}

		}

		return closestResult;

	}

	intersectsGeometry( otherGeometry, geomToMesh ) {

		let result = false;
		const roots = this._roots;
		const intersectsGeometryFunc = this.indirect ? intersectsGeometry_indirect : intersectsGeometry;
		for ( let i = 0, l = roots.length; i < l; i ++ ) {

			result = intersectsGeometryFunc( this, i, otherGeometry, geomToMesh );

			if ( result ) {

				break;

			}

		}

		return result;

	}

	shapecast( callbacks ) {

		const triangle = ExtendedTrianglePool.getPrimitive();
		const iterateFunc = this.indirect ? iterateOverTriangles_indirect : iterateOverTriangles;
		let {
			boundsTraverseOrder,
			intersectsBounds,
			intersectsRange,
			intersectsTriangle,
		} = callbacks;

		// wrap the intersectsRange function
		if ( intersectsRange && intersectsTriangle ) {

			const originalIntersectsRange = intersectsRange;
			intersectsRange = ( offset, count, contained, depth, nodeIndex ) => {

				if ( ! originalIntersectsRange( offset, count, contained, depth, nodeIndex ) ) {

					return iterateFunc( offset, count, this, intersectsTriangle, contained, depth, triangle );

				}

				return true;

			};

		} else if ( ! intersectsRange ) {

			if ( intersectsTriangle ) {

				intersectsRange = ( offset, count, contained, depth ) => {

					return iterateFunc( offset, count, this, intersectsTriangle, contained, depth, triangle );

				};

			} else {

				intersectsRange = ( offset, count, contained ) => {

					return contained;

				};

			}

		}

		// run shapecast
		let result = false;
		let byteOffset = 0;
		const roots = this._roots;
		for ( let i = 0, l = roots.length; i < l; i ++ ) {

			const root = roots[ i ];
			result = shapecast( this, i, intersectsBounds, intersectsRange, boundsTraverseOrder, byteOffset );

			if ( result ) {

				break;

			}

			byteOffset += root.byteLength;

		}

		ExtendedTrianglePool.releasePrimitive( triangle );

		return result;

	}

	bvhcast( otherBvh, matrixToLocal, callbacks ) {

		let {
			intersectsRanges,
			intersectsTriangles,
		} = callbacks;

		const triangle1 = ExtendedTrianglePool.getPrimitive();
		const indexAttr1 = this.geometry.index;
		const positionAttr1 = this.geometry.attributes.position;
		const assignTriangle1 = this.indirect ?
			i1 => {


				const ti = this.resolveTriangleIndex( i1 );
				setTriangle( triangle1, ti * 3, indexAttr1, positionAttr1 );

			} :
			i1 => {

				setTriangle( triangle1, i1 * 3, indexAttr1, positionAttr1 );

			};

		const triangle2 = ExtendedTrianglePool.getPrimitive();
		const indexAttr2 = otherBvh.geometry.index;
		const positionAttr2 = otherBvh.geometry.attributes.position;
		const assignTriangle2 = otherBvh.indirect ?
			i2 => {

				const ti2 = otherBvh.resolveTriangleIndex( i2 );
				setTriangle( triangle2, ti2 * 3, indexAttr2, positionAttr2 );

			} :
			i2 => {

				setTriangle( triangle2, i2 * 3, indexAttr2, positionAttr2 );

			};

		// generate triangle callback if needed
		if ( intersectsTriangles ) {

			const iterateOverDoubleTriangles = ( offset1, count1, offset2, count2, depth1, index1, depth2, index2 ) => {

				for ( let i2 = offset2, l2 = offset2 + count2; i2 < l2; i2 ++ ) {

					assignTriangle2( i2 );

					triangle2.a.applyMatrix4( matrixToLocal );
					triangle2.b.applyMatrix4( matrixToLocal );
					triangle2.c.applyMatrix4( matrixToLocal );
					triangle2.needsUpdate = true;

					for ( let i1 = offset1, l1 = offset1 + count1; i1 < l1; i1 ++ ) {

						assignTriangle1( i1 );

						triangle1.needsUpdate = true;

						if ( intersectsTriangles( triangle1, triangle2, i1, i2, depth1, index1, depth2, index2 ) ) {

							return true;

						}

					}

				}

				return false;

			};

			if ( intersectsRanges ) {

				const originalIntersectsRanges = intersectsRanges;
				intersectsRanges = function ( offset1, count1, offset2, count2, depth1, index1, depth2, index2 ) {

					if ( ! originalIntersectsRanges( offset1, count1, offset2, count2, depth1, index1, depth2, index2 ) ) {

						return iterateOverDoubleTriangles( offset1, count1, offset2, count2, depth1, index1, depth2, index2 );

					}

					return true;

				};

			} else {

				intersectsRanges = iterateOverDoubleTriangles;

			}

		}

		return bvhcast( this, otherBvh, matrixToLocal, intersectsRanges );

	}


	/* Derived Cast Functions */
	intersectsBox( box, boxToMesh ) {

		obb.set( box.min, box.max, boxToMesh );
		obb.needsUpdate = true;

		return this.shapecast(
			{
				intersectsBounds: box => obb.intersectsBox( box ),
				intersectsTriangle: tri => obb.intersectsTriangle( tri )
			}
		);

	}

	intersectsSphere( sphere ) {

		return this.shapecast(
			{
				intersectsBounds: box => sphere.intersectsBox( box ),
				intersectsTriangle: tri => tri.intersectsSphere( sphere )
			}
		);

	}

	closestPointToGeometry( otherGeometry, geometryToBvh, target1 = { }, target2 = { }, minThreshold = 0, maxThreshold = Infinity ) {

		const closestPointToGeometryFunc = this.indirect ? closestPointToGeometry_indirect : closestPointToGeometry;
		return closestPointToGeometryFunc(
			this,
			otherGeometry,
			geometryToBvh,
			target1,
			target2,
			minThreshold,
			maxThreshold,
		);

	}

	closestPointToPoint( point, target = { }, minThreshold = 0, maxThreshold = Infinity ) {

		return closestPointToPoint(
			this,
			point,
			target,
			minThreshold,
			maxThreshold,
		);

	}

	getBoundingBox( target ) {

		target.makeEmpty();

		const roots = this._roots;
		roots.forEach( buffer => {

			arrayToBox( 0, new Float32Array( buffer ), tempBox );
			target.union( tempBox );

		} );

		return target;

	}

}
