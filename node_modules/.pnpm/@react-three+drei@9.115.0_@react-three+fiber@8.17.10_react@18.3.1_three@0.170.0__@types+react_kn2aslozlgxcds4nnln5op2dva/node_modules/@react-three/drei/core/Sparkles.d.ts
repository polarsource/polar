import * as THREE from 'three';
import { PointsProps, Node } from '@react-three/fiber';
import { ForwardRefComponent } from '../helpers/ts-utils';
interface Props {
    count?: number;
    speed?: number | Float32Array;
    opacity?: number | Float32Array;
    color?: THREE.ColorRepresentation | Float32Array;
    size?: number | Float32Array;
    scale?: number | [number, number, number] | THREE.Vector3;
    noise?: number | [number, number, number] | THREE.Vector3 | Float32Array;
}
declare global {
    namespace JSX {
        interface IntrinsicElements {
            sparklesImplMaterial: Node<any, any>;
        }
    }
}
export declare const Sparkles: ForwardRefComponent<Props & PointsProps, THREE.Points>;
export {};
