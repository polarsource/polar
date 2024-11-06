import { Vector3, Vector2, Plane, Line3 } from 'three';

export const closestPointLineToLine = ( function () {

	// https://github.com/juj/MathGeoLib/blob/master/src/Geometry/Line.cpp#L56
	const dir1 = new Vector3();
	const dir2 = new Vector3();
	const v02 = new Vector3();
	return function closestPointLineToLine( l1, l2, result ) {

		const v0 = l1.start;
		const v10 = dir1;
		const v2 = l2.start;
		const v32 = dir2;

		v02.subVectors( v0, v2 );
		dir1.subVectors( l1.end, l1.start );
		dir2.subVectors( l2.end, l2.start );

		// float d0232 = v02.Dot(v32);
		const d0232 = v02.dot( v32 );

		// float d3210 = v32.Dot(v10);
		const d3210 = v32.dot( v10 );

		// float d3232 = v32.Dot(v32);
		const d3232 = v32.dot( v32 );

		// float d0210 = v02.Dot(v10);
		const d0210 = v02.dot( v10 );

		// float d1010 = v10.Dot(v10);
		const d1010 = v10.dot( v10 );

		// float denom = d1010*d3232 - d3210*d3210;
		const denom = d1010 * d3232 - d3210 * d3210;

		let d, d2;
		if ( denom !== 0 ) {

			d = ( d0232 * d3210 - d0210 * d3232 ) / denom;

		} else {

			d = 0;

		}

		d2 = ( d0232 + d * d3210 ) / d3232;

		result.x = d;
		result.y = d2;

	};

} )();

export const closestPointsSegmentToSegment = ( function () {

	// https://github.com/juj/MathGeoLib/blob/master/src/Geometry/LineSegment.cpp#L187
	const paramResult = new Vector2();
	const temp1 = new Vector3();
	const temp2 = new Vector3();
	return function closestPointsSegmentToSegment( l1, l2, target1, target2 ) {

		closestPointLineToLine( l1, l2, paramResult );

		let d = paramResult.x;
		let d2 = paramResult.y;
		if ( d >= 0 && d <= 1 && d2 >= 0 && d2 <= 1 ) {

			l1.at( d, target1 );
			l2.at( d2, target2 );

			return;

		} else if ( d >= 0 && d <= 1 ) {

			// Only d2 is out of bounds.
			if ( d2 < 0 ) {

				l2.at( 0, target2 );

			} else {

				l2.at( 1, target2 );

			}

			l1.closestPointToPoint( target2, true, target1 );
			return;

		} else if ( d2 >= 0 && d2 <= 1 ) {

			// Only d is out of bounds.
			if ( d < 0 ) {

				l1.at( 0, target1 );

			} else {

				l1.at( 1, target1 );

			}

			l2.closestPointToPoint( target1, true, target2 );
			return;

		} else {

			// Both u and u2 are out of bounds.
			let p;
			if ( d < 0 ) {

				p = l1.start;

			} else {

				p = l1.end;

			}

			let p2;
			if ( d2 < 0 ) {

				p2 = l2.start;

			} else {

				p2 = l2.end;

			}

			const closestPoint = temp1;
			const closestPoint2 = temp2;
			l1.closestPointToPoint( p2, true, temp1 );
			l2.closestPointToPoint( p, true, temp2 );

			if ( closestPoint.distanceToSquared( p2 ) <= closestPoint2.distanceToSquared( p ) ) {

				target1.copy( closestPoint );
				target2.copy( p2 );
				return;

			} else {

				target1.copy( p );
				target2.copy( closestPoint2 );
				return;

			}

		}

	};

} )();


export const sphereIntersectTriangle = ( function () {

	// https://stackoverflow.com/questions/34043955/detect-collision-between-sphere-and-triangle-in-three-js
	const closestPointTemp = new Vector3();
	const projectedPointTemp = new Vector3();
	const planeTemp = new Plane();
	const lineTemp = new Line3();
	return function sphereIntersectTriangle( sphere, triangle ) {

		const { radius, center } = sphere;
		const { a, b, c } = triangle;

		// phase 1
		lineTemp.start = a;
		lineTemp.end = b;
		const closestPoint1 = lineTemp.closestPointToPoint( center, true, closestPointTemp );
		if ( closestPoint1.distanceTo( center ) <= radius ) return true;

		lineTemp.start = a;
		lineTemp.end = c;
		const closestPoint2 = lineTemp.closestPointToPoint( center, true, closestPointTemp );
		if ( closestPoint2.distanceTo( center ) <= radius ) return true;

		lineTemp.start = b;
		lineTemp.end = c;
		const closestPoint3 = lineTemp.closestPointToPoint( center, true, closestPointTemp );
		if ( closestPoint3.distanceTo( center ) <= radius ) return true;

		// phase 2
		const plane = triangle.getPlane( planeTemp );
		const dp = Math.abs( plane.distanceToPoint( center ) );
		if ( dp <= radius ) {

			const pp = plane.projectPoint( center, projectedPointTemp );
			const cp = triangle.containsPoint( pp );
			if ( cp ) return true;

		}

		return false;

	};

} )();
