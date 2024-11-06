import { IS_LEAFNODE_FLAG } from '../Constants.js';

export function refit/* @echo INDIRECT_STRING */( bvh, nodeIndices = null ) {

	if ( nodeIndices && Array.isArray( nodeIndices ) ) {

		nodeIndices = new Set( nodeIndices );

	}

	const geometry = bvh.geometry;
	const indexArr = geometry.index ? geometry.index.array : null;
	const posAttr = geometry.attributes.position;

	let buffer, uint32Array, uint16Array, float32Array;
	let byteOffset = 0;
	const roots = bvh._roots;
	for ( let i = 0, l = roots.length; i < l; i ++ ) {

		buffer = roots[ i ];
		uint32Array = new Uint32Array( buffer );
		uint16Array = new Uint16Array( buffer );
		float32Array = new Float32Array( buffer );

		_traverse( 0, byteOffset );
		byteOffset += buffer.byteLength;

	}

	function _traverse( node32Index, byteOffset, force = false ) {

		const node16Index = node32Index * 2;
		const isLeaf = uint16Array[ node16Index + 15 ] === IS_LEAFNODE_FLAG;
		if ( isLeaf ) {

			const offset = uint32Array[ node32Index + 6 ];
			const count = uint16Array[ node16Index + 14 ];

			let minx = Infinity;
			let miny = Infinity;
			let minz = Infinity;
			let maxx = - Infinity;
			let maxy = - Infinity;
			let maxz = - Infinity;

			/* @if INDIRECT */

			for ( let i = offset, l = offset + count; i < l; i ++ ) {

				const t = 3 * bvh.resolveTriangleIndex( i );
				for ( let j = 0; j < 3; j ++ ) {

					let index = t + j;
					index = indexArr ? indexArr[ index ] : index;

					const x = posAttr.getX( index );
					const y = posAttr.getY( index );
					const z = posAttr.getZ( index );

					if ( x < minx ) minx = x;
					if ( x > maxx ) maxx = x;

					if ( y < miny ) miny = y;
					if ( y > maxy ) maxy = y;

					if ( z < minz ) minz = z;
					if ( z > maxz ) maxz = z;


				}

			}

			/* @else */

			for ( let i = 3 * offset, l = 3 * ( offset + count ); i < l; i ++ ) {

				let index = indexArr[ i ];
				const x = posAttr.getX( index );
				const y = posAttr.getY( index );
				const z = posAttr.getZ( index );

				if ( x < minx ) minx = x;
				if ( x > maxx ) maxx = x;

				if ( y < miny ) miny = y;
				if ( y > maxy ) maxy = y;

				if ( z < minz ) minz = z;
				if ( z > maxz ) maxz = z;

			}

			/* @endif */

			if (
				float32Array[ node32Index + 0 ] !== minx ||
				float32Array[ node32Index + 1 ] !== miny ||
				float32Array[ node32Index + 2 ] !== minz ||

				float32Array[ node32Index + 3 ] !== maxx ||
				float32Array[ node32Index + 4 ] !== maxy ||
				float32Array[ node32Index + 5 ] !== maxz
			) {

				float32Array[ node32Index + 0 ] = minx;
				float32Array[ node32Index + 1 ] = miny;
				float32Array[ node32Index + 2 ] = minz;

				float32Array[ node32Index + 3 ] = maxx;
				float32Array[ node32Index + 4 ] = maxy;
				float32Array[ node32Index + 5 ] = maxz;

				return true;

			} else {

				return false;

			}

		} else {

			const left = node32Index + 8;
			const right = uint32Array[ node32Index + 6 ];

			// the identifying node indices provided by the shapecast function include offsets of all
			// root buffers to guarantee they're unique between roots so offset left and right indices here.
			const offsetLeft = left + byteOffset;
			const offsetRight = right + byteOffset;
			let forceChildren = force;
			let includesLeft = false;
			let includesRight = false;

			if ( nodeIndices ) {

				// if we see that neither the left or right child are included in the set that need to be updated
				// then we assume that all children need to be updated.
				if ( ! forceChildren ) {

					includesLeft = nodeIndices.has( offsetLeft );
					includesRight = nodeIndices.has( offsetRight );
					forceChildren = ! includesLeft && ! includesRight;

				}

			} else {

				includesLeft = true;
				includesRight = true;

			}

			const traverseLeft = forceChildren || includesLeft;
			const traverseRight = forceChildren || includesRight;

			let leftChange = false;
			if ( traverseLeft ) {

				leftChange = _traverse( left, byteOffset, forceChildren );

			}

			let rightChange = false;
			if ( traverseRight ) {

				rightChange = _traverse( right, byteOffset, forceChildren );

			}

			const didChange = leftChange || rightChange;
			if ( didChange ) {

				for ( let i = 0; i < 3; i ++ ) {

					const lefti = left + i;
					const righti = right + i;
					const minLeftValue = float32Array[ lefti ];
					const maxLeftValue = float32Array[ lefti + 3 ];
					const minRightValue = float32Array[ righti ];
					const maxRightValue = float32Array[ righti + 3 ];

					float32Array[ node32Index + i ] = minLeftValue < minRightValue ? minLeftValue : minRightValue;
					float32Array[ node32Index + i + 3 ] = maxLeftValue > maxRightValue ? maxLeftValue : maxRightValue;

				}

			}

			return didChange;

		}

	}

}
