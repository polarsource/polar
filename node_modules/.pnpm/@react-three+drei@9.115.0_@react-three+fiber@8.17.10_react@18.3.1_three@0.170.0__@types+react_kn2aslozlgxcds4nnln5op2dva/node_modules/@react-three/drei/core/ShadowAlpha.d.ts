import * as React from 'react';
import * as THREE from 'three';
interface ShadowAlphaProps {
    opacity?: number;
    alphaMap?: THREE.Texture | boolean;
}
export declare function ShadowAlpha({ opacity, alphaMap }: ShadowAlphaProps): React.JSX.Element;
export {};
