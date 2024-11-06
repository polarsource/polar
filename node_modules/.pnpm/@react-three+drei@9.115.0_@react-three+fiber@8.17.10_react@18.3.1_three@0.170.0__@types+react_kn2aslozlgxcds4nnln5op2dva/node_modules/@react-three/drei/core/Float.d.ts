import * as React from 'react';
import * as THREE from 'three';
import { ForwardRefComponent } from '../helpers/ts-utils';
export type FloatProps = JSX.IntrinsicElements['group'] & {
    enabled?: boolean;
    speed?: number;
    rotationIntensity?: number;
    floatIntensity?: number;
    children?: React.ReactNode;
    floatingRange?: [number?, number?];
    autoInvalidate?: boolean;
};
export declare const Float: ForwardRefComponent<FloatProps, THREE.Group>;
