
import { Vector2, Vector3, Triangle } from 'three';

// sets the vertices of triangle `tri` with the 3 vertices after i
export function setTriangle( tri, i, index, pos ) {

	const ta = tri.a;
	const tb = tri.b;
	const tc = tri.c;

	let i0 = i;
	let i1 = i + 1;
	let i2 = i + 2;
	if ( index ) {

		i0 = index.getX( i0 );
		i1 = index.getX( i1 );
		i2 = index.getX( i2 );

	}

	ta.x = pos.getX( i0 );
	ta.y = pos.getY( i0 );
	ta.z = pos.getZ( i0 );

	tb.x = pos.getX( i1 );
	tb.y = pos.getY( i1 );
	tb.z = pos.getZ( i1 );

	tc.x = pos.getX( i2 );
	tc.y = pos.getY( i2 );
	tc.z = pos.getZ( i2 );

}

const tempV1 = /* @__PURE__ */ new Vector3();
const tempV2 = /* @__PURE__ */ new Vector3();
const tempV3 = /* @__PURE__ */ new Vector3();
const tempUV1 = /* @__PURE__ */ new Vector2();
const tempUV2 = /* @__PURE__ */ new Vector2();
const tempUV3 = /* @__PURE__ */ new Vector2();

export function getTriangleHitPointInfo( point, geometry, triangleIndex, target ) {

	const indices = geometry.getIndex().array;
	const positions = geometry.getAttribute( 'position' );
	const uvs = geometry.getAttribute( 'uv' );

	const a = indices[ triangleIndex * 3 ];
	const b = indices[ triangleIndex * 3 + 1 ];
	const c = indices[ triangleIndex * 3 + 2 ];

	tempV1.fromBufferAttribute( positions, a );
	tempV2.fromBufferAttribute( positions, b );
	tempV3.fromBufferAttribute( positions, c );

	// find the associated material index
	let materialIndex = 0;
	const groups = geometry.groups;
	const firstVertexIndex = triangleIndex * 3;
	for ( let i = 0, l = groups.length; i < l; i ++ ) {

		const group = groups[ i ];
		const { start, count } = group;
		if ( firstVertexIndex >= start && firstVertexIndex < start + count ) {

			materialIndex = group.materialIndex;
			break;

		}

	}

	// extract uvs
	let uv = null;
	if ( uvs ) {

		tempUV1.fromBufferAttribute( uvs, a );
		tempUV2.fromBufferAttribute( uvs, b );
		tempUV3.fromBufferAttribute( uvs, c );

		if ( target && target.uv ) uv = target.uv;
		else uv = new Vector2();

		Triangle.getInterpolation( point, tempV1, tempV2, tempV3, tempUV1, tempUV2, tempUV3, uv );

	}

	// adjust the provided target or create a new one
	if ( target ) {

		if ( ! target.face ) target.face = { };
		target.face.a = a;
		target.face.b = b;
		target.face.c = c;
		target.face.materialIndex = materialIndex;
		if ( ! target.face.normal ) target.face.normal = new Vector3();
		Triangle.getNormal( tempV1, tempV2, tempV3, target.face.normal );

		if ( uv ) target.uv = uv;

		return target;

	} else {

		return {
			face: {
				a: a,
				b: b,
				c: c,
				materialIndex: materialIndex,
				normal: Triangle.getNormal( tempV1, tempV2, tempV3, new Vector3() )
			},
			uv: uv
		};

	}

}
