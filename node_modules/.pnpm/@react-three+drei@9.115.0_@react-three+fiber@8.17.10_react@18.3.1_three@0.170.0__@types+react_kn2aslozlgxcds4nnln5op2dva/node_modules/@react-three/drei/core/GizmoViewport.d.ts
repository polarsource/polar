import * as React from 'react';
import { ThreeEvent } from '@react-three/fiber';
type GizmoViewportProps = JSX.IntrinsicElements['group'] & {
    axisColors?: [string, string, string];
    axisScale?: [number, number, number];
    labels?: [string, string, string];
    axisHeadScale?: number;
    labelColor?: string;
    hideNegativeAxes?: boolean;
    hideAxisHeads?: boolean;
    disabled?: boolean;
    font?: string;
    onClick?: (e: ThreeEvent<MouseEvent>) => null;
};
export declare const GizmoViewport: ({ hideNegativeAxes, hideAxisHeads, disabled, font, axisColors, axisHeadScale, axisScale, labels, labelColor, onClick, ...props }: GizmoViewportProps) => React.JSX.Element;
export {};
