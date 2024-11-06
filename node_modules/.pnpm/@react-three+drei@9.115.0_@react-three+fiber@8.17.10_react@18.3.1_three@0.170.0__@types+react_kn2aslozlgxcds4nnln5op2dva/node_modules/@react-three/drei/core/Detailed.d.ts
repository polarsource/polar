import * as React from 'react';
import { LOD, Object3D } from 'three';
import { ForwardRefComponent } from '../helpers/ts-utils';
type Props = JSX.IntrinsicElements['lOD'] & {
    children: React.ReactElement<Object3D>[];
    hysteresis?: number;
    distances: number[];
};
export declare const Detailed: ForwardRefComponent<Props, LOD>;
export {};
