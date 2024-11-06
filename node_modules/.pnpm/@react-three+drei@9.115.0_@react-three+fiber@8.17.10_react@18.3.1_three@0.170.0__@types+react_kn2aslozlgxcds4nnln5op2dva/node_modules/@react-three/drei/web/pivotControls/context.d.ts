import * as THREE from 'three';
import * as React from 'react';
export type OnDragStartProps = {
    component: 'Arrow' | 'Slider' | 'Rotator' | 'Sphere';
    axis: 0 | 1 | 2;
    origin: THREE.Vector3;
    directions: THREE.Vector3[];
};
export type PivotContext = {
    onDragStart: (props: OnDragStartProps) => void;
    onDrag: (mdW: THREE.Matrix4) => void;
    onDragEnd: () => void;
    translation: {
        current: [number, number, number];
    };
    translationLimits?: [[number, number] | undefined, [number, number] | undefined, [number, number] | undefined];
    rotationLimits?: [[number, number] | undefined, [number, number] | undefined, [number, number] | undefined];
    scaleLimits?: [[number, number] | undefined, [number, number] | undefined, [number, number] | undefined];
    axisColors: [string | number, string | number, string | number];
    hoveredColor: string | number;
    opacity: number;
    scale: number;
    lineWidth: number;
    fixed: boolean;
    depthTest: boolean;
    userData?: {
        [key: string]: any;
    };
    annotations?: boolean;
    annotationsClass?: string;
};
export declare const context: React.Context<PivotContext>;
