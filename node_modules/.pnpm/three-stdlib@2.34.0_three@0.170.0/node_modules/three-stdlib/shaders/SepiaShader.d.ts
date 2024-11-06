/**
 * Sepia tone shader
 * based on glfx.js sepia shader
 * https://github.com/evanw/glfx.js
 */
export declare const SepiaShader: {
    uniforms: {
        tDiffuse: {
            value: null;
        };
        amount: {
            value: number;
        };
    };
    vertexShader: string;
    fragmentShader: string;
};
