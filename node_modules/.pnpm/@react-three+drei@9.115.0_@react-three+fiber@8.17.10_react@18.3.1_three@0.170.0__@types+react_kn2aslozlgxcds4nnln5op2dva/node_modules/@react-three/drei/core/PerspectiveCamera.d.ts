import * as THREE from 'three';
import * as React from 'react';
import { PerspectiveCamera as PerspectiveCameraImpl } from 'three';
import { ForwardRefComponent } from '../helpers/ts-utils';
type Props = Omit<JSX.IntrinsicElements['perspectiveCamera'], 'children'> & {
    makeDefault?: boolean;
    manual?: boolean;
    children?: React.ReactNode | ((texture: THREE.Texture) => React.ReactNode);
    frames?: number;
    resolution?: number;
    envMap?: THREE.Texture;
};
export declare const PerspectiveCamera: ForwardRefComponent<Props, PerspectiveCameraImpl>;
export {};
