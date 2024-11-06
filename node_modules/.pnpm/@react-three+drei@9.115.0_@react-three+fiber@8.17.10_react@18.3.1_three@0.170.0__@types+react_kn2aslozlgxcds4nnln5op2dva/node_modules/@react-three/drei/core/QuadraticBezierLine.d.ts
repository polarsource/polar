import { Vector3 } from 'three';
import { Line2 } from 'three-stdlib';
import { LineProps } from './Line';
import { Object3DNode } from '@react-three/fiber';
import { ForwardRefComponent } from '../helpers/ts-utils';
type Props = Omit<LineProps, 'points' | 'ref'> & {
    start: Vector3 | [number, number, number];
    end: Vector3 | [number, number, number];
    mid?: Vector3 | [number, number, number];
    segments?: number;
};
export type Line2Props = Object3DNode<Line2, typeof Line2> & {
    setPoints: (start: Vector3 | [number, number, number], end: Vector3 | [number, number, number], mid: Vector3 | [number, number, number]) => void;
};
export declare const QuadraticBezierLine: ForwardRefComponent<Props, Line2Props>;
export {};
