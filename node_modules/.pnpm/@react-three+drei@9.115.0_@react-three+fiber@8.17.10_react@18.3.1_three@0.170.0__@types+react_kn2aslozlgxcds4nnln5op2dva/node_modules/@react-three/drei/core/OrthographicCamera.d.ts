import * as THREE from 'three';
import * as React from 'react';
import { OrthographicCamera as OrthographicCameraImpl } from 'three';
import { ForwardRefComponent } from '../helpers/ts-utils';
type Props = Omit<JSX.IntrinsicElements['orthographicCamera'], 'children'> & {
    makeDefault?: boolean;
    manual?: boolean;
    children?: React.ReactNode | ((texture: THREE.Texture) => React.ReactNode);
    frames?: number;
    resolution?: number;
    envMap?: THREE.Texture;
};
export declare const OrthographicCamera: ForwardRefComponent<Props, OrthographicCameraImpl>;
export {};
