import * as React from 'react';
import * as THREE from 'three';
import { MaterialNode } from '@react-three/fiber';
import { WireframeMaterialProps } from '../materials/WireframeMaterial';
declare global {
    namespace JSX {
        interface IntrinsicElements {
            meshWireframeMaterial: MaterialNode<THREE.ShaderMaterial, WireframeMaterialProps>;
        }
    }
}
interface WireframeProps {
    geometry?: THREE.BufferGeometry | React.RefObject<THREE.BufferGeometry>;
    simplify?: boolean;
}
export declare function Wireframe({ geometry: customGeometry, ...props }: WireframeProps & WireframeMaterialProps): React.JSX.Element;
export {};
