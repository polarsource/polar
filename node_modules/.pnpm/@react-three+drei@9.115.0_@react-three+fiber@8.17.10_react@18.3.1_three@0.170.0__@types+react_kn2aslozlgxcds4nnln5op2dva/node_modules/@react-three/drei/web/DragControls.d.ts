import * as React from 'react';
import * as THREE from 'three';
import { DragConfig } from '@use-gesture/react';
import { ForwardRefComponent } from '../helpers/ts-utils';
export type DragControlsProps = {
    autoTransform?: boolean;
    matrix?: THREE.Matrix4;
    axisLock?: 'x' | 'y' | 'z';
    dragLimits?: [[number, number] | undefined, [number, number] | undefined, [number, number] | undefined];
    onHover?: (hovering: boolean) => void;
    onDragStart?: (origin: THREE.Vector3) => void;
    onDrag?: (localMatrix: THREE.Matrix4, deltaLocalMatrix: THREE.Matrix4, worldMatrix: THREE.Matrix4, deltaWorldMatrix: THREE.Matrix4) => void;
    onDragEnd?: () => void;
    children: React.ReactNode;
    dragConfig?: DragConfig;
};
export declare const DragControls: ForwardRefComponent<DragControlsProps, THREE.Group>;
