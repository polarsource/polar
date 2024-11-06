import * as THREE from 'three';
import * as React from 'react';
import { MeshProps } from '@react-three/fiber';
import { ForwardRefComponent } from '../helpers/ts-utils';
export type CloneProps = {
    object: THREE.Object3D | THREE.Object3D[];
    children?: React.ReactNode;
    deep?: boolean | 'materialsOnly' | 'geometriesOnly';
    keys?: string[];
    inject?: MeshProps | React.ReactNode | ((object: THREE.Object3D) => React.ReactNode);
    castShadow?: boolean;
    receiveShadow?: boolean;
    isChild?: boolean;
};
export declare const Clone: ForwardRefComponent<Omit<JSX.IntrinsicElements['group'], 'children'> & CloneProps, THREE.Group>;
