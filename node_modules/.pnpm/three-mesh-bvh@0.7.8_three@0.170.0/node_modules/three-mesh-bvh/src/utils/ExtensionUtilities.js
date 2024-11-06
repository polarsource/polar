import { Ray, Matrix4, Mesh, Vector3, Sphere, REVISION } from 'three';
import { convertRaycastIntersect } from './GeometryRayIntersectUtilities.js';
import { MeshBVH } from '../core/MeshBVH.js';
import * as THREE from 'three';

const BatchedMesh = THREE.BatchedMesh || null; // this is necessary to not break three.js r157-
const IS_REVISION_166 = parseInt( REVISION ) >= 166;
const ray = /* @__PURE__ */ new Ray();
const direction = /* @__PURE__ */ new Vector3();
const tmpInverseMatrix = /* @__PURE__ */ new Matrix4();
const origMeshRaycastFunc = Mesh.prototype.raycast;
const origBatchedRaycastFunc = BatchedMesh !== null ? BatchedMesh.prototype.raycast : null;
const _worldScale = /* @__PURE__ */ new Vector3();
const _mesh = /* @__PURE__ */ new Mesh();
const _batchIntersects = [];

export function acceleratedRaycast( raycaster, intersects ) {

	if ( this.isBatchedMesh ) {

		acceleratedBatchedMeshRaycast.call( this, raycaster, intersects );

	} else {

		acceleratedMeshRaycast.call( this, raycaster, intersects );

	}

}

function acceleratedBatchedMeshRaycast( raycaster, intersects ) {

	if ( this.boundsTrees ) {

		const boundsTrees = this.boundsTrees;
		const drawInfo = this._drawInfo;
		const drawRanges = this._drawRanges;
		const matrixWorld = this.matrixWorld;

		_mesh.material = this.material;
		_mesh.geometry = this.geometry;

		const oldBoundsTree = _mesh.geometry.boundsTree;
		const oldDrawRange = _mesh.geometry.drawRange;

		if ( _mesh.geometry.boundingSphere === null ) {

			_mesh.geometry.boundingSphere = new Sphere();

		}

		// TODO: provide new method to get instances count instead of 'drawInfo.length'
		for ( let i = 0, l = drawInfo.length; i < l; i ++ ) {

			if ( ! this.getVisibleAt( i ) ) {

				continue;

			}

			// TODO: use getGeometryIndex
			const geometryId = drawInfo[ i ].geometryIndex;

			_mesh.geometry.boundsTree = boundsTrees[ geometryId ];

			this.getMatrixAt( i, _mesh.matrixWorld ).premultiply( matrixWorld );

			if ( ! _mesh.geometry.boundsTree ) {

				this.getBoundingBoxAt( geometryId, _mesh.geometry.boundingBox );
				this.getBoundingSphereAt( geometryId, _mesh.geometry.boundingSphere );

				const drawRange = drawRanges[ geometryId ];
				_mesh.geometry.setDrawRange( drawRange.start, drawRange.count );

			}

			_mesh.raycast( raycaster, _batchIntersects );

			for ( let j = 0, l = _batchIntersects.length; j < l; j ++ ) {

				const intersect = _batchIntersects[ j ];
				intersect.object = this;
				intersect.batchId = i;
				intersects.push( intersect );

			}

			_batchIntersects.length = 0;

		}

		_mesh.geometry.boundsTree = oldBoundsTree;
		_mesh.geometry.drawRange = oldDrawRange;
		_mesh.material = null;
		_mesh.geometry = null;

	} else {

		origBatchedRaycastFunc.call( this, raycaster, intersects );

	}

}

function acceleratedMeshRaycast( raycaster, intersects ) {

	if ( this.geometry.boundsTree ) {

		if ( this.material === undefined ) return;

		tmpInverseMatrix.copy( this.matrixWorld ).invert();
		ray.copy( raycaster.ray ).applyMatrix4( tmpInverseMatrix );

		_worldScale.setFromMatrixScale( this.matrixWorld );
		direction.copy( ray.direction ).multiply( _worldScale );

		const scaleFactor = direction.length();
		const near = raycaster.near / scaleFactor;
		const far = raycaster.far / scaleFactor;

		const bvh = this.geometry.boundsTree;
		if ( raycaster.firstHitOnly === true ) {

			const hit = convertRaycastIntersect( bvh.raycastFirst( ray, this.material, near, far ), this, raycaster );
			if ( hit ) {

				intersects.push( hit );

			}

		} else {

			const hits = bvh.raycast( ray, this.material, near, far );
			for ( let i = 0, l = hits.length; i < l; i ++ ) {

				const hit = convertRaycastIntersect( hits[ i ], this, raycaster );
				if ( hit ) {

					intersects.push( hit );

				}

			}

		}

	} else {

		origMeshRaycastFunc.call( this, raycaster, intersects );

	}

}

export function computeBoundsTree( options = {} ) {

	this.boundsTree = new MeshBVH( this, options );
	return this.boundsTree;

}

export function disposeBoundsTree() {

	this.boundsTree = null;

}

export function computeBatchedBoundsTree( index = - 1, options = {} ) {

	if ( ! IS_REVISION_166 ) {

		throw new Error( 'BatchedMesh: Three r166+ is required to compute bounds trees.' );

	}

	if ( options.indirect ) {

		console.warn( '"Indirect" is set to false because it is not supported for BatchedMesh.' );

	}

	options = {
		...options,
		indirect: false,
		range: null
	};

	const drawRanges = this._drawRanges;
	const geometryCount = this._geometryCount;
	if ( ! this.boundsTrees ) {

		this.boundsTrees = new Array( geometryCount ).fill( null );

	}

	const boundsTrees = this.boundsTrees;
	while ( boundsTrees.length < geometryCount ) {

		boundsTrees.push( null );

	}

	if ( index < 0 ) {

		for ( let i = 0; i < geometryCount; i ++ ) {

			options.range = drawRanges[ i ];
			boundsTrees[ i ] = new MeshBVH( this.geometry, options );

		}

		return boundsTrees;

	} else {

		if ( index < drawRanges.length ) {

			options.range = drawRanges[ index ];
			boundsTrees[ index ] = new MeshBVH( this.geometry, options );

		}

		return boundsTrees[ index ] || null;

	}

}

export function disposeBatchedBoundsTree( index = - 1 ) {

	if ( index < 0 ) {

		this.boundsTrees.fill( null );

	} else {

		if ( index < this.boundsTree.length ) {

			this.boundsTrees[ index ] = null;

		}

	}

}
