import { BufferGeometry } from 'three';
/**
 * Break faces with edges longer than maxEdgeLength
 */
declare class TessellateModifier {
    maxEdgeLength: number;
    maxIterations: number;
    constructor(maxEdgeLength?: number, maxIterations?: number);
    modify: (geometry: BufferGeometry) => BufferGeometry;
}
export { TessellateModifier };
