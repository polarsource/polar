import * as THREE from 'three';
import * as React from 'react';
import { ReactThreeFiber } from '@react-three/fiber';
export type PortalMaterialType = {
    resolution: ReactThreeFiber.Vector2;
    blur: number;
    blend: number;
    size?: number;
    sdf?: THREE.Texture;
    map?: THREE.Texture;
} & JSX.IntrinsicElements['shaderMaterial'];
declare global {
    namespace JSX {
        interface IntrinsicElements {
            portalMaterialImpl: PortalMaterialType;
        }
    }
}
export type PortalProps = JSX.IntrinsicElements['shaderMaterial'] & {
    blend?: number;
    blur?: number;
    resolution?: number;
    worldUnits?: boolean;
    eventPriority?: number;
    renderPriority?: number;
    events?: boolean;
};
export declare const MeshPortalMaterial: React.ForwardRefExoticComponent<Omit<PortalProps, "ref"> & React.RefAttributes<PortalMaterialType>>;
