import { Vector2 } from 'three';
/**
 * Normal map shader
 * - compute normals from heightmap
 */
export declare const NormalMapShader: {
    uniforms: {
        heightMap: {
            value: null;
        };
        resolution: {
            value: Vector2;
        };
        scale: {
            value: Vector2;
        };
        height: {
            value: number;
        };
    };
    vertexShader: string;
    fragmentShader: string;
};
