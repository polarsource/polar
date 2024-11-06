/**
 * Simple fake tilt-shift effect, modulating two pass Gaussian blur (see above) by vertical position
 *
 * - 9 samples per pass
 * - standard deviation 2.7
 * - "h" and "v" parameters should be set to "1 / width" and "1 / height"
 * - "r" parameter control where "focused" horizontal line lies
 */
export declare const VerticalTiltShiftShader: {
    uniforms: {
        tDiffuse: {
            value: null;
        };
        v: {
            value: number;
        };
        r: {
            value: number;
        };
    };
    vertexShader: string;
    fragmentShader: string;
};
