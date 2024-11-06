import { Matrix4, Vector2 } from 'three';
/**
 * References:
 * http://john-chapman-graphics.blogspot.com/2013/01/ssao-tutorial.html
 * https://learnopengl.com/Advanced-Lighting/SSAO
 * https://github.com/McNopper/OpenGL/blob/master/Example28/shader/ssao.frag.glsl
 */
export declare const SSAOShader: {
    defines: {
        PERSPECTIVE_CAMERA: number;
        KERNEL_SIZE: number;
    };
    uniforms: {
        tDiffuse: {
            value: null;
        };
        tNormal: {
            value: null;
        };
        tDepth: {
            value: null;
        };
        tNoise: {
            value: null;
        };
        kernel: {
            value: null;
        };
        cameraNear: {
            value: null;
        };
        cameraFar: {
            value: null;
        };
        resolution: {
            value: Vector2;
        };
        cameraProjectionMatrix: {
            value: Matrix4;
        };
        cameraInverseProjectionMatrix: {
            value: Matrix4;
        };
        kernelRadius: {
            value: number;
        };
        minDistance: {
            value: number;
        };
        maxDistance: {
            value: number;
        };
    };
    vertexShader: string;
    fragmentShader: string;
};
export declare const SSAODepthShader: {
    defines: {
        PERSPECTIVE_CAMERA: number;
    };
    uniforms: {
        tDepth: {
            value: null;
        };
        cameraNear: {
            value: null;
        };
        cameraFar: {
            value: null;
        };
    };
    vertexShader: string;
    fragmentShader: string;
};
export declare const SSAOBlurShader: {
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
