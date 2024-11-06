/**
 * Blend two textures
 */
export declare const BlendShader: {
    uniforms: {
        tDiffuse1: {
            value: null;
        };
        tDiffuse2: {
            value: null;
        };
        mixRatio: {
            value: number;
        };
        opacity: {
            value: number;
        };
    };
    vertexShader: string;
    fragmentShader: string;
};
