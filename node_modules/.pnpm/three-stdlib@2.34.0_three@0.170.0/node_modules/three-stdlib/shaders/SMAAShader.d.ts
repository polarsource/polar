import { Vector2 } from 'three';
/**
 * WebGL port of Subpixel Morphological Antialiasing (SMAA) v2.8
 * Preset: SMAA 1x Medium (with color edge detection)
 * https://github.com/iryoku/smaa/releases/tag/v2.8
 */
export declare const SMAAEdgesShader: {
    defines: {
        SMAA_THRESHOLD: string;
    };
    uniforms: {
        tDiffuse: {
            value: null;
        };
        resolution: {
            value: Vector2;
        };
    };
    vertexShader: string;
    fragmentShader: string;
};
export declare const SMAAWeightsShader: {
    defines: {
        SMAA_MAX_SEARCH_STEPS: string;
        SMAA_AREATEX_MAX_DISTANCE: string;
        SMAA_AREATEX_PIXEL_SIZE: string;
        SMAA_AREATEX_SUBTEX_SIZE: string;
    };
    uniforms: {
        tDiffuse: {
            value: null;
        };
        tArea: {
            value: null;
        };
        tSearch: {
            value: null;
        };
        resolution: {
            value: Vector2;
        };
    };
    vertexShader: string;
    fragmentShader: string;
};
export declare const SMAABlendShader: {
    uniforms: {
        tDiffuse: {
            value: null;
        };
        tColor: {
            value: null;
        };
        resolution: {
            value: Vector2;
        };
    };
    vertexShader: string;
    fragmentShader: string;
};
