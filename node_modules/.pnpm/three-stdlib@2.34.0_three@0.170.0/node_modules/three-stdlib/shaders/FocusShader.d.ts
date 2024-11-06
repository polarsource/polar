/**
 * Focus shader
 * based on PaintEffect postprocess from ro.me
 * http://code.google.com/p/3-dreams-of-black/source/browse/deploy/js/effects/PaintEffect.js
 */
export declare const FocusShader: {
    uniforms: {
        tDiffuse: {
            value: null;
        };
        screenWidth: {
            value: number;
        };
        screenHeight: {
            value: number;
        };
        sampleDistance: {
            value: number;
        };
        waveFactor: {
            value: number;
        };
    };
    vertexShader: string;
    fragmentShader: string;
};
