/**
 * Hue and saturation adjustment
 * https://github.com/evanw/glfx.js
 * hue: -1 to 1 (-1 is 180 degrees in the negative direction, 0 is no change, etc.
 * saturation: -1 to 1 (-1 is solid gray, 0 is no change, and 1 is maximum contrast)
 */
export declare const HueSaturationShader: {
    uniforms: {
        tDiffuse: {
            value: null;
        };
        hue: {
            value: number;
        };
        saturation: {
            value: number;
        };
    };
    vertexShader: string;
    fragmentShader: string;
};
