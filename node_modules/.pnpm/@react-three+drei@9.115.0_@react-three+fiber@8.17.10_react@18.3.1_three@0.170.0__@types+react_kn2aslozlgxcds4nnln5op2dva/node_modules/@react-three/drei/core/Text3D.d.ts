import * as React from 'react';
import * as THREE from 'three';
import { MeshProps, Node } from '@react-three/fiber';
import { TextGeometryParameters } from 'three-stdlib';
import { FontData } from './useFont';
import { ForwardRefComponent } from '../helpers/ts-utils';
declare global {
    namespace JSX {
        interface IntrinsicElements {
            renamedTextGeometry: Node<any, any>;
        }
    }
}
type Text3DProps = {
    font: FontData | string;
    bevelSegments?: number;
    smooth?: number;
} & Omit<TextGeometryParameters, 'font'> & MeshProps;
export declare const Text3D: ForwardRefComponent<React.PropsWithChildren<Text3DProps & {
    letterSpacing?: number;
    lineHeight?: number;
}>, THREE.Mesh>;
export {};
