import { Color } from 'three';
/**
 * Luminosity
 * http://en.wikipedia.org/wiki/Luminosity
 */
export declare const LuminosityHighPassShader: {
    shaderID: string;
    uniforms: {
        tDiffuse: {
            value: null;
        };
        luminosityThreshold: {
            value: number;
        };
        smoothWidth: {
            value: number;
        };
        defaultColor: {
            value: Color;
        };
        defaultOpacity: {
            value: number;
        };
    };
    vertexShader: string;
    fragmentShader: string;
};
