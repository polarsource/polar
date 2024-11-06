/**
 * Depth-of-field shader using mipmaps
 * - from Matt Handley @applmak
 * - requires power-of-2 sized render target with enabled mipmaps
 */
export declare const DOFMipMapShader: {
    uniforms: {
        tColor: {
            value: null;
        };
        tDepth: {
            value: null;
        };
        focus: {
            value: number;
        };
        maxblur: {
            value: number;
        };
    };
    vertexShader: string;
    fragmentShader: string;
};
