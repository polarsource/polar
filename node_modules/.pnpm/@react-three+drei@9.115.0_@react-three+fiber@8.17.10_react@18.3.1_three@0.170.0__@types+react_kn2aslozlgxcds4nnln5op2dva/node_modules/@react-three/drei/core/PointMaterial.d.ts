import * as THREE from 'three';
import { PrimitiveProps } from '@react-three/fiber';
import { ForwardRefComponent } from '../helpers/ts-utils';
type PointMaterialType = JSX.IntrinsicElements['pointsMaterial'];
declare global {
    namespace JSX {
        interface IntrinsicElements {
            pointMaterialImpl: PointMaterialType;
        }
    }
}
export declare class PointMaterialImpl extends THREE.PointsMaterial {
    constructor(props: any);
}
export declare const PointMaterial: ForwardRefComponent<Omit<PrimitiveProps, 'object' | 'attach'>, PointMaterialImpl>;
export {};
