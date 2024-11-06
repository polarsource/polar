import { Vector2, Vector3 } from 'three';
/**
 * Shaders to render 3D volumes using raycasting.
 * The applied techniques are based on similar implementations in the Visvis and Vispy projects.
 * This is not the only approach, therefore it's marked 1.
 */
export declare const VolumeRenderShader1: {
    uniforms: {
        u_size: {
            value: Vector3;
        };
        u_renderstyle: {
            value: number;
        };
        u_renderthreshold: {
            value: number;
        };
        u_clim: {
            value: Vector2;
        };
        u_data: {
            value: null;
        };
        u_cmdata: {
            value: null;
        };
    };
    vertexShader: string;
    fragmentShader: string;
};
