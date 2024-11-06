import { ReactThreeFiber } from '@react-three/fiber';
import { Sky as SkyImpl } from 'three-stdlib';
import { Vector3 } from 'three';
import { ForwardRefComponent } from '../helpers/ts-utils';
type Props = {
    distance?: number;
    sunPosition?: ReactThreeFiber.Vector3;
    inclination?: number;
    azimuth?: number;
    mieCoefficient?: number;
    mieDirectionalG?: number;
    rayleigh?: number;
    turbidity?: number;
};
export declare function calcPosFromAngles(inclination: number, azimuth: number, vector?: Vector3): Vector3;
export declare const Sky: ForwardRefComponent<Props, SkyImpl>;
export {};
