import { ReactThreeFiber } from '@react-three/fiber';
import { Points, ShaderMaterial } from 'three';
import { ForwardRefComponent } from '../helpers/ts-utils';
type Props = {
    radius?: number;
    depth?: number;
    count?: number;
    factor?: number;
    saturation?: number;
    fade?: boolean;
    speed?: number;
};
declare class StarfieldMaterial extends ShaderMaterial {
    constructor();
}
declare global {
    namespace JSX {
        interface IntrinsicElements {
            starfieldMaterial: ReactThreeFiber.MaterialNode<StarfieldMaterial, []>;
        }
    }
}
export declare const Stars: ForwardRefComponent<Props, Points>;
export {};
