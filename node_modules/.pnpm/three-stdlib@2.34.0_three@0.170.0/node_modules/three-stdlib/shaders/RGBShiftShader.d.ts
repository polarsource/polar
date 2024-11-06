/**
 * RGB Shift Shader
 * Shifts red and blue channels from center in opposite directions
 * Ported from http://kriss.cx/tom/2009/05/rgb-shift/
 * by Tom Butterworth / http://kriss.cx/tom/
 *
 * amount: shift distance (1 is width of input)
 * angle: shift angle in radians
 */
export declare const RGBShiftShader: {
    uniforms: {
        tDiffuse: {
            value: null;
        };
        amount: {
            value: number;
        };
        angle: {
            value: number;
        };
    };
    vertexShader: string;
    fragmentShader: string;
};
