import * as React from 'react';
import * as THREE from 'three';
export type CycleRaycastProps = {
    onChanged?: (hits: THREE.Intersection[], cycle: number) => null;
    preventDefault?: boolean;
    scroll?: boolean;
    keyCode?: number;
    portal?: React.MutableRefObject<HTMLElement>;
};
export declare function CycleRaycast({ onChanged, portal, preventDefault, scroll, keyCode, }: CycleRaycastProps): null;
