/**
 * Vignette shader
 * based on PaintEffect postprocess from ro.me
 * http://code.google.com/p/3-dreams-of-black/source/browse/deploy/js/effects/PaintEffect.js
 */
export declare const VignetteShader: {
    uniforms: {
        tDiffuse: {
            value: null;
        };
        offset: {
            value: number;
        };
        darkness: {
            value: number;
        };
    };
    vertexShader: string;
    fragmentShader: string;
};
