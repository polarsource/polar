/**
 * Kaleidoscope Shader
 * Radial reflection around center point
 * Ported from: http://pixelshaders.com/editor/
 * by Toby Schachman / http://tobyschachman.com/
 *
 * sides: number of reflections
 * angle: initial angle in radians
 */
export declare const KaleidoShader: {
    uniforms: {
        tDiffuse: {
            value: null;
        };
        sides: {
            value: number;
        };
        angle: {
            value: number;
        };
    };
    vertexShader: string;
    fragmentShader: string;
};
