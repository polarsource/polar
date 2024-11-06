/**
 * Mirror Shader
 * Copies half the input to the other half
 *
 * side: side of input to mirror (0 = left, 1 = right, 2 = top, 3 = bottom)
 */
export declare const MirrorShader: {
    uniforms: {
        tDiffuse: {
            value: null;
        };
        side: {
            value: number;
        };
    };
    vertexShader: string;
    fragmentShader: string;
};
