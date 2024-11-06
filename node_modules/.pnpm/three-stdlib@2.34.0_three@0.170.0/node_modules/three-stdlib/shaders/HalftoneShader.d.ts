/**
 * RGB Halftone shader for three.js.
 *	NOTE:
 * 		Shape (1 = Dot, 2 = Ellipse, 3 = Line, 4 = Square)
 *		Blending Mode (1 = Linear, 2 = Multiply, 3 = Add, 4 = Lighter, 5 = Darker)
 */
export declare const HalftoneShader: {
    uniforms: {
        tDiffuse: {
            value: null;
        };
        shape: {
            value: number;
        };
        radius: {
            value: number;
        };
        rotateR: {
            value: number;
        };
        rotateG: {
            value: number;
        };
        rotateB: {
            value: number;
        };
        scatter: {
            value: number;
        };
        width: {
            value: number;
        };
        height: {
            value: number;
        };
        blending: {
            value: number;
        };
        blendingMode: {
            value: number;
        };
        greyscale: {
            value: boolean;
        };
        disable: {
            value: boolean;
        };
    };
    vertexShader: string;
    fragmentShader: string;
};
