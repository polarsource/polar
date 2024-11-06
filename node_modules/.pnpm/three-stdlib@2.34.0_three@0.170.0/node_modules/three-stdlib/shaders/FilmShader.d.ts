/**
 * Film grain & scanlines shader
 *
 * - ported from HLSL to WebGL / GLSL
 * http://www.truevision3d.com/forums/showcase/staticnoise_colorblackwhite_scanline_shaders-t18698.0.html
 *
 * Screen Space Static Postprocessor
 *
 * Produces an analogue noise overlay similar to a film grain / TV static
 *
 * Original implementation and noise algorithm
 * Pat 'Hawthorne' Shearon
 *
 * Optimized scanlines + noise version with intensity scaling
 * Georg 'Leviathan' Steinrohder
 *
 * This version is provided under a Creative Commons Attribution 3.0 License
 * http://creativecommons.org/licenses/by/3.0/
 */
export declare const FilmShader: {
    uniforms: {
        tDiffuse: {
            value: null;
        };
        time: {
            value: number;
        };
        nIntensity: {
            value: number;
        };
        sIntensity: {
            value: number;
        };
        sCount: {
            value: number;
        };
        grayscale: {
            value: number;
        };
    };
    vertexShader: string;
    fragmentShader: string;
};
