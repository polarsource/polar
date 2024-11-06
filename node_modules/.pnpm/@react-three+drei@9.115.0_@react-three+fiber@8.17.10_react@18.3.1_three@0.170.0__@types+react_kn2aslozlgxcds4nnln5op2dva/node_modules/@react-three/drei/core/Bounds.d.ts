import * as React from 'react';
import * as THREE from 'three';
export type SizeProps = {
    box: THREE.Box3;
    size: THREE.Vector3;
    center: THREE.Vector3;
    distance: number;
};
export type BoundsApi = {
    getSize: () => SizeProps;
    refresh(object?: THREE.Object3D | THREE.Box3): BoundsApi;
    reset(): BoundsApi;
    moveTo(position: THREE.Vector3 | [number, number, number]): BoundsApi;
    lookAt({ target, up, }: {
        target?: THREE.Vector3 | [number, number, number];
        up?: THREE.Vector3 | [number, number, number];
    }): BoundsApi;
    to({ position, target }: {
        position: [number, number, number];
        target: [number, number, number];
    }): BoundsApi;
    fit(): BoundsApi;
    clip(): BoundsApi;
};
export type BoundsProps = JSX.IntrinsicElements['group'] & {
    maxDuration?: number;
    margin?: number;
    observe?: boolean;
    fit?: boolean;
    clip?: boolean;
    interpolateFunc?: (t: number) => number;
    onFit?: (data: SizeProps) => void;
};
export declare function Bounds({ children, maxDuration, margin, observe, fit, clip, interpolateFunc, onFit, }: BoundsProps): React.JSX.Element;
export declare function useBounds(): BoundsApi;
