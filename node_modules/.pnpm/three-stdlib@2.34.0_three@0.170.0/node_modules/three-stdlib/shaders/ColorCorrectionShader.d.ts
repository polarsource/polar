import { Vector3 } from 'three';
/**
 * Color correction
 */
export declare const ColorCorrectionShader: {
    uniforms: {
        tDiffuse: {
            value: null;
        };
        powRGB: {
            value: Vector3;
        };
        mulRGB: {
            value: Vector3;
        };
        addRGB: {
            value: Vector3;
        };
    };
    vertexShader: string;
    fragmentShader: string;
};
