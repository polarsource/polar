import * as THREE from 'three';
import { ForwardRefComponent } from '../helpers/ts-utils';
type MeshTransmissionMaterialType = Omit<JSX.IntrinsicElements['meshPhysicalMaterial'], 'args' | 'roughness' | 'thickness' | 'transmission'> & {
    transmission?: number;
    thickness?: number;
    roughness?: number;
    chromaticAberration?: number;
    anisotropy?: number;
    anisotropicBlur?: number;
    distortion?: number;
    distortionScale?: number;
    temporalDistortion?: number;
    buffer?: THREE.Texture;
    time?: number;
    args?: [samples: number, transmissionSampler: boolean];
};
type MeshTransmissionMaterialProps = Omit<MeshTransmissionMaterialType, 'args'> & {
    transmissionSampler?: boolean;
    backside?: boolean;
    backsideThickness?: number;
    backsideEnvMapIntensity?: number;
    resolution?: number;
    backsideResolution?: number;
    samples?: number;
    background?: THREE.Texture | THREE.Color;
};
declare global {
    namespace JSX {
        interface IntrinsicElements {
            meshTransmissionMaterial: MeshTransmissionMaterialType;
        }
    }
}
export declare const MeshTransmissionMaterial: ForwardRefComponent<MeshTransmissionMaterialProps, JSX.IntrinsicElements['meshTransmissionMaterial']>;
export {};
