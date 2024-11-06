import * as React from 'react';
import * as THREE from 'three';
export declare enum GradientType {
    Linear = "linear",
    Radial = "radial"
}
type Props = {
    stops: Array<number>;
    colors: Array<THREE.ColorRepresentation>;
    attach?: string;
    size?: number;
    width?: number;
    type?: GradientType;
    innerCircleRadius?: number;
    outerCircleRadius?: string | number;
} & Omit<JSX.IntrinsicElements['texture'], 'type'>;
export declare function GradientTexture({ stops, colors, size, width, type, innerCircleRadius, outerCircleRadius, ...props }: Props): React.JSX.Element;
export {};
