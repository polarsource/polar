import {
	DataTexture,
	FloatType,
	UnsignedIntType,
	RGBAFormat,
	RGIntegerFormat,
	NearestFilter,
	BufferAttribute,
} from 'three';
import {
	FloatVertexAttributeTexture,
	UIntVertexAttributeTexture,
} from './VertexAttributeTexture.js';
import { BYTES_PER_NODE } from '../core/Constants.js';
import {
	BOUNDING_DATA_INDEX,
	COUNT,
	IS_LEAF,
	RIGHT_NODE,
	OFFSET,
	SPLIT_AXIS,
} from '../core/utils/nodeBufferUtils.js';
import { getIndexArray, getVertexCount } from '../core/build/geometryUtils.js';

export class MeshBVHUniformStruct {

	constructor() {

		this.index = new UIntVertexAttributeTexture();
		this.position = new FloatVertexAttributeTexture();
		this.bvhBounds = new DataTexture();
		this.bvhContents = new DataTexture();
		this._cachedIndexAttr = null;

		this.index.overrideItemSize = 3;

	}

	updateFrom( bvh ) {

		const { geometry } = bvh;
		bvhToTextures( bvh, this.bvhBounds, this.bvhContents );

		this.position.updateFrom( geometry.attributes.position );

		// dereference a new index attribute if we're using indirect storage
		if ( bvh.indirect ) {

			const indirectBuffer = bvh._indirectBuffer;
			if (
				this._cachedIndexAttr === null ||
				this._cachedIndexAttr.count !== indirectBuffer.length
			) {

				if ( geometry.index ) {

					this._cachedIndexAttr = geometry.index.clone();

				} else {

					const array = getIndexArray( getVertexCount( geometry ) );
					this._cachedIndexAttr = new BufferAttribute( array, 1, false );

				}

			}

			dereferenceIndex( geometry, indirectBuffer, this._cachedIndexAttr );
			this.index.updateFrom( this._cachedIndexAttr );

		} else {

			this.index.updateFrom( geometry.index );

		}

	}

	dispose() {

		const { index, position, bvhBounds, bvhContents } = this;

		if ( index ) index.dispose();
		if ( position ) position.dispose();
		if ( bvhBounds ) bvhBounds.dispose();
		if ( bvhContents ) bvhContents.dispose();

	}

}

function dereferenceIndex( geometry, indirectBuffer, target ) {

	const unpacked = target.array;
	const indexArray = geometry.index ? geometry.index.array : null;
	for ( let i = 0, l = indirectBuffer.length; i < l; i ++ ) {

		const i3 = 3 * i;
		const v3 = 3 * indirectBuffer[ i ];
		for ( let c = 0; c < 3; c ++ ) {

			unpacked[ i3 + c ] = indexArray ? indexArray[ v3 + c ] : v3 + c;

		}

	}

}

function bvhToTextures( bvh, boundsTexture, contentsTexture ) {

	const roots = bvh._roots;

	if ( roots.length !== 1 ) {

		throw new Error( 'MeshBVHUniformStruct: Multi-root BVHs not supported.' );

	}

	const root = roots[ 0 ];
	const uint16Array = new Uint16Array( root );
	const uint32Array = new Uint32Array( root );
	const float32Array = new Float32Array( root );

	// Both bounds need two elements per node so compute the height so it's twice as long as
	// the width so we can expand the row by two and still have a square texture
	const nodeCount = root.byteLength / BYTES_PER_NODE;
	const boundsDimension = 2 * Math.ceil( Math.sqrt( nodeCount / 2 ) );
	const boundsArray = new Float32Array( 4 * boundsDimension * boundsDimension );

	const contentsDimension = Math.ceil( Math.sqrt( nodeCount ) );
	const contentsArray = new Uint32Array( 2 * contentsDimension * contentsDimension );

	for ( let i = 0; i < nodeCount; i ++ ) {

		const nodeIndex32 = i * BYTES_PER_NODE / 4;
		const nodeIndex16 = nodeIndex32 * 2;
		const boundsIndex = BOUNDING_DATA_INDEX( nodeIndex32 );
		for ( let b = 0; b < 3; b ++ ) {

			boundsArray[ 8 * i + 0 + b ] = float32Array[ boundsIndex + 0 + b ];
			boundsArray[ 8 * i + 4 + b ] = float32Array[ boundsIndex + 3 + b ];

		}

		if ( IS_LEAF( nodeIndex16, uint16Array ) ) {

			const count = COUNT( nodeIndex16, uint16Array );
			const offset = OFFSET( nodeIndex32, uint32Array );

			const mergedLeafCount = 0xffff0000 | count;
			contentsArray[ i * 2 + 0 ] = mergedLeafCount;
			contentsArray[ i * 2 + 1 ] = offset;

		} else {

			const rightIndex = 4 * RIGHT_NODE( nodeIndex32, uint32Array ) / BYTES_PER_NODE;
			const splitAxis = SPLIT_AXIS( nodeIndex32, uint32Array );

			contentsArray[ i * 2 + 0 ] = splitAxis;
			contentsArray[ i * 2 + 1 ] = rightIndex;

		}

	}

	boundsTexture.image.data = boundsArray;
	boundsTexture.image.width = boundsDimension;
	boundsTexture.image.height = boundsDimension;
	boundsTexture.format = RGBAFormat;
	boundsTexture.type = FloatType;
	boundsTexture.internalFormat = 'RGBA32F';
	boundsTexture.minFilter = NearestFilter;
	boundsTexture.magFilter = NearestFilter;
	boundsTexture.generateMipmaps = false;
	boundsTexture.needsUpdate = true;
	boundsTexture.dispose();

	contentsTexture.image.data = contentsArray;
	contentsTexture.image.width = contentsDimension;
	contentsTexture.image.height = contentsDimension;
	contentsTexture.format = RGIntegerFormat;
	contentsTexture.type = UnsignedIntType;
	contentsTexture.internalFormat = 'RG32UI';
	contentsTexture.minFilter = NearestFilter;
	contentsTexture.magFilter = NearestFilter;
	contentsTexture.generateMipmaps = false;
	contentsTexture.needsUpdate = true;
	contentsTexture.dispose();

}
