import { Mesh } from 'three';
import { ForwardRefComponent, NamedArrayTuple } from '../helpers/ts-utils';
type Props = {
    args?: NamedArrayTuple<(width?: number, height?: number, depth?: number) => void>;
    radius?: number;
    smoothness?: number;
    bevelSegments?: number;
    steps?: number;
    creaseAngle?: number;
} & Omit<JSX.IntrinsicElements['mesh'], 'args'>;
export declare const RoundedBox: ForwardRefComponent<Props, Mesh>;
export {};
