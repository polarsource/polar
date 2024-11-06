import * as THREE from 'three';
import * as React from 'react';
export type ResizeProps = JSX.IntrinsicElements['group'] & {
    width?: boolean;
    height?: boolean;
    depth?: boolean;
    box3?: THREE.Box3;
    precise?: boolean;
};
export declare const Resize: React.ForwardRefExoticComponent<Omit<ResizeProps, "ref"> & React.RefAttributes<THREE.Group>>;
