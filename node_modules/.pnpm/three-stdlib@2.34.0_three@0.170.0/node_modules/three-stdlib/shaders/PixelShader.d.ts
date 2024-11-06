/**
 * Pixelation shader
 */
export declare const PixelShader: {
    uniforms: {
        tDiffuse: {
            value: null;
        };
        resolution: {
            value: null;
        };
        pixelSize: {
            value: number;
        };
    };
    vertexShader: string;
    fragmentShader: string;
};
