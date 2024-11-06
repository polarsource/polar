import { IUniform, Texture, Vector2 } from 'three';
export interface BokehShader2Uniforms {
    textureWidth: IUniform<number>;
    textureHeight: IUniform<number>;
    focalDepth: IUniform<number>;
    focalLength: IUniform<number>;
    fstop: IUniform<number>;
    tColor: IUniform<Texture | null>;
    tDepth: IUniform<Texture | null>;
    maxblur: IUniform<number>;
    showFocus: IUniform<number>;
    manualdof: IUniform<number>;
    vignetting: IUniform<number>;
    depthblur: IUniform<number>;
    threshold: IUniform<number>;
    gain: IUniform<number>;
    bias: IUniform<number>;
    fringe: IUniform<number>;
    znear: IUniform<number>;
    zfar: IUniform<number>;
    noise: IUniform<number>;
    dithering: IUniform<number>;
    pentagon: IUniform<number>;
    shaderFocus: IUniform<number>;
    focusCoords: IUniform<Vector2>;
}
/**
 * Depth-of-field shader with bokeh
 * ported from GLSL shader by Martins Upitis
 * http://blenderartists.org/forum/showthread.php?237488-GLSL-depth-of-field-with-bokeh-v2-4-(update)
 *
 * Requires #define RINGS and SAMPLES integers
 */
export declare const BokehShader2: {
    uniforms: BokehShader2Uniforms;
    vertexShader: string;
    fragmentShader: string;
};
export declare const BokehDepthShader: {
    uniforms: {
        mNear: {
            value: number;
        };
        mFar: {
            value: number;
        };
    };
    vertexShader: string;
    fragmentShader: string;
};
