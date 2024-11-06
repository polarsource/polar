// converts the given BVH raycast intersection to align with the three.js raycast
// structure (include object, world space distance and point).
export function convertRaycastIntersect( hit, object, raycaster ) {

	if ( hit === null ) {

		return null;

	}

	hit.point.applyMatrix4( object.matrixWorld );
	hit.distance = hit.point.distanceTo( raycaster.ray.origin );
	hit.object = object;

	return hit;

}
