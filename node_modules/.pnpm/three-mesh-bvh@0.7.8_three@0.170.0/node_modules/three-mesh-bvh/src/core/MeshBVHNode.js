export class MeshBVHNode {

	constructor() {

		// internal nodes have boundingData, left, right, and splitAxis
		// leaf nodes have offset and count (referring to primitives in the mesh geometry)

		this.boundingData = new Float32Array( 6 );

	}

}
