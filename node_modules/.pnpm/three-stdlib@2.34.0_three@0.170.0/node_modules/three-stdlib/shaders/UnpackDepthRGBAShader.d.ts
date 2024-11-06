/**
 * Unpack RGBA depth shader
 * - show RGBA encoded depth as monochrome color
 */
export declare const UnpackDepthRGBAShader: {
    uniforms: {
        tDiffuse: {
            value: null;
        };
        opacity: {
            value: number;
        };
    };
    vertexShader: string;
    fragmentShader: string;
};
