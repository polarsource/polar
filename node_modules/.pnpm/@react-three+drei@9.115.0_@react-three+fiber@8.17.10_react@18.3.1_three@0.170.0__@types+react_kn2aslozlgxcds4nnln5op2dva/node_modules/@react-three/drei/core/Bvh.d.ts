import * as React from 'react';
import { Mesh, Group } from 'three';
import { SplitStrategy } from 'three-mesh-bvh';
import { ForwardRefComponent } from '../helpers/ts-utils';
export interface BVHOptions {
    strategy?: SplitStrategy;
    verbose?: boolean;
    setBoundingBox?: boolean;
    maxDepth?: number;
    maxLeafTris?: number;
    indirect?: boolean;
}
export type BvhProps = BVHOptions & JSX.IntrinsicElements['group'] & {
    enabled?: boolean;
    firstHitOnly?: boolean;
};
export declare function useBVH(mesh: React.MutableRefObject<Mesh | undefined>, options?: BVHOptions): void;
export declare const Bvh: ForwardRefComponent<BvhProps, Group>;
