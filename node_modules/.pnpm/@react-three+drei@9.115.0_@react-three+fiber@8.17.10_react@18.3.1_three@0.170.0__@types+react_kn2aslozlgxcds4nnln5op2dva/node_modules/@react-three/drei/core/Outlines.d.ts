import * as React from 'react';
import { ReactThreeFiber } from '@react-three/fiber';
type OutlinesProps = JSX.IntrinsicElements['group'] & {
    color?: ReactThreeFiber.Color;
    screenspace?: boolean;
    opacity?: number;
    transparent?: boolean;
    thickness?: number;
    angle?: number;
    toneMapped?: boolean;
    polygonOffset?: boolean;
    polygonOffsetFactor?: number;
    renderOrder?: number;
};
export declare function Outlines({ color, opacity, transparent, screenspace, toneMapped, polygonOffset, polygonOffsetFactor, renderOrder, thickness, angle, ...props }: OutlinesProps): React.JSX.Element;
export {};
