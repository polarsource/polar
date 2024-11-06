import * as THREE from 'three';
import { ForwardRefComponent } from '../helpers/ts-utils';
export type GridMaterialType = {
    cellSize?: number;
    cellThickness?: number;
    cellColor?: THREE.ColorRepresentation;
    sectionSize?: number;
    sectionThickness?: number;
    sectionColor?: THREE.ColorRepresentation;
    followCamera?: boolean;
    infiniteGrid?: boolean;
    fadeDistance?: number;
    fadeStrength?: number;
    fadeFrom?: number;
    side?: THREE.Side;
};
export type GridProps = GridMaterialType & {
    args?: ConstructorParameters<typeof THREE.PlaneGeometry>;
};
declare global {
    namespace JSX {
        interface IntrinsicElements {
            gridMaterial: JSX.IntrinsicElements['shaderMaterial'] & GridMaterialType;
        }
    }
}
export declare const Grid: ForwardRefComponent<Omit<JSX.IntrinsicElements['mesh'], 'args'> & GridProps, THREE.Mesh>;
