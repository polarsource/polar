import { Vector2 } from 'three';
/**
 * Sobel Edge Detection (see https://youtu.be/uihBwtPIBxM)
 *
 * As mentioned in the video the Sobel operator expects a grayscale image as input.
 *
 */
export declare const SobelOperatorShader: {
    uniforms: {
        tDiffuse: {
            value: null;
        };
        resolution: {
            value: Vector2;
        };
    };
    vertexShader: string;
    fragmentShader: string;
};
