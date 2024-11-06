import { Vector2 } from 'three';
/**
 * Dot screen shader
 * based on glfx.js sepia shader
 * https://github.com/evanw/glfx.js
 */
export declare const DotScreenShader: {
    uniforms: {
        tDiffuse: {
            value: null;
        };
        tSize: {
            value: Vector2;
        };
        center: {
            value: Vector2;
        };
        angle: {
            value: number;
        };
        scale: {
            value: number;
        };
    };
    vertexShader: string;
    fragmentShader: string;
};
