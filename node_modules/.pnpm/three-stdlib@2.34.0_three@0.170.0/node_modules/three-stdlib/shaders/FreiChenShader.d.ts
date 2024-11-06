import { Vector2 } from 'three';
/**
 * Edge Detection Shader using Frei-Chen filter
 * Based on http://rastergrid.com/blog/2011/01/frei-chen-edge-detector
 *
 * aspect: vec2 of (1/width, 1/height)
 */
export declare const FreiChenShader: {
    uniforms: {
        tDiffuse: {
            value: null;
        };
        aspect: {
            value: Vector2;
        };
    };
    vertexShader: string;
    fragmentShader: string;
};
