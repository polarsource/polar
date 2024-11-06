import { Vector2 } from 'three';
/**
 * NVIDIA FXAA by Timothy Lottes
 * http://timothylottes.blogspot.com/2011/06/fxaa3-source-released.html
 * - WebGL port by @supereggbert
 * http://www.glge.org/demos/fxaa/
 */
export declare const FXAAShader: {
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
