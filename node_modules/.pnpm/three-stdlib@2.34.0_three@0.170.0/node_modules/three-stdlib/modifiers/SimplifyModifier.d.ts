import { BufferGeometry } from 'three';
/**
 *	Simplification Geometry Modifier
 *    - based on code and technique
 *	  - by Stan Melax in 1998
 *	  - Progressive Mesh type Polygon Reduction Algorithm
 *    - http://www.melax.com/polychop/
 */
declare class SimplifyModifier {
    constructor();
    private computeEdgeCollapseCost;
    private removeVertex;
    private computeEdgeCostAtVertex;
    private removeFace;
    private collapse;
    private minimumCostEdge;
    modify: (geometry: BufferGeometry, count: number) => BufferGeometry;
}
export { SimplifyModifier };
