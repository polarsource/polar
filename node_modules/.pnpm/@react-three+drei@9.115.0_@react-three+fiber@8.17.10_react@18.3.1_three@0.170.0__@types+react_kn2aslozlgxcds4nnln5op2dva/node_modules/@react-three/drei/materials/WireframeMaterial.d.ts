import * as THREE from 'three';
export interface WireframeMaterialProps extends THREE.ShaderMaterialParameters {
    fillOpacity?: number;
    fillMix?: number;
    strokeOpacity?: number;
    thickness?: number;
    colorBackfaces?: boolean;
    dashInvert?: boolean;
    dash?: boolean;
    dashRepeats?: number;
    dashLength?: number;
    squeeze?: boolean;
    squeezeMin?: number;
    squeezeMax?: number;
    stroke?: THREE.ColorRepresentation;
    backfaceStroke?: THREE.ColorRepresentation;
    fill?: THREE.ColorRepresentation;
}
export declare const WireframeMaterialShaders: {
    uniforms: {
        strokeOpacity: number;
        fillOpacity: number;
        fillMix: number;
        thickness: number;
        colorBackfaces: boolean;
        dashInvert: boolean;
        dash: boolean;
        dashRepeats: number;
        dashLength: number;
        squeeze: boolean;
        squeezeMin: number;
        squeezeMax: number;
        stroke: THREE.Color;
        backfaceStroke: THREE.Color;
        fill: THREE.Color;
    };
    vertex: string;
    fragment: string;
};
export declare const WireframeMaterial: typeof THREE.ShaderMaterial & {
    key: string;
};
export declare function setWireframeOverride(material: THREE.Material, uniforms: {
    [key: string]: THREE.IUniform<any>;
}): void;
export declare function useWireframeUniforms(uniforms: {
    [key: string]: THREE.IUniform<any>;
}, props: WireframeMaterialProps): void;
