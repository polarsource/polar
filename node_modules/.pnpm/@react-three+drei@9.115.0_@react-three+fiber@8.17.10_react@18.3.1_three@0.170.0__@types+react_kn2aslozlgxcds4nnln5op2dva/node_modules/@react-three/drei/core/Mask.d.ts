import * as THREE from 'three';
import { ForwardRefComponent } from '../helpers/ts-utils';
type Props = Omit<JSX.IntrinsicElements['mesh'], 'id'> & {
    id: number;
    colorWrite?: boolean;
    depthWrite?: boolean;
};
export declare const Mask: ForwardRefComponent<Props, THREE.Mesh>;
export declare function useMask(id: number, inverse?: boolean): {
    stencilWrite: boolean;
    stencilRef: number;
    stencilFunc: 514 | 517;
    stencilFail: 7680;
    stencilZFail: 7680;
    stencilZPass: 7680;
};
export {};
