import * as THREE from 'three';
import * as React from 'react';
import { ForwardRefComponent } from '../helpers/ts-utils';
type Props = JSX.IntrinsicElements['texture'] & {
    width?: number;
    height?: number;
    samples?: number;
    stencilBuffer?: boolean;
    depthBuffer?: boolean;
    generateMipmaps?: boolean;
    renderPriority?: number;
    eventPriority?: number;
    frames?: number;
    compute?: (event: any, state: any, previous: any) => false | undefined;
    children: React.ReactNode;
};
export declare const RenderTexture: ForwardRefComponent<Props, THREE.Texture>;
export {};
