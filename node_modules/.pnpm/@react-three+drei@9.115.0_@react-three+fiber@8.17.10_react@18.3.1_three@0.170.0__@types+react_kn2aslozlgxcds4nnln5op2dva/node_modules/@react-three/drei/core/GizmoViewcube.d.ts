import * as React from 'react';
import { ThreeEvent } from '@react-three/fiber';
type GenericProps = {
    font?: string;
    opacity?: number;
    color?: string;
    hoverColor?: string;
    textColor?: string;
    strokeColor?: string;
    onClick?: (e: ThreeEvent<MouseEvent>) => null;
    faces?: string[];
};
export declare const GizmoViewcube: (props: GenericProps) => React.JSX.Element;
export {};
