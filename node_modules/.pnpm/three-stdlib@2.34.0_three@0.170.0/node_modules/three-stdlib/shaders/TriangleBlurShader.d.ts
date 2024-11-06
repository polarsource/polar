import { Vector2 } from 'three';
/**
 * Triangle blur shader
 * based on glfx.js triangle blur shader
 * https://github.com/evanw/glfx.js
 *
 * A basic blur filter, which convolves the image with a
 * pyramid filter. The pyramid filter is separable and is applied as two
 * perpendicular triangle filters.
 */
export declare const TriangleBlurShader: {
    uniforms: {
        texture: {
            value: null;
        };
        delta: {
            value: Vector2;
        };
    };
    vertexShader: string;
    fragmentShader: string;
};
