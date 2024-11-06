import { Matrix4, Vector2 } from 'three';
/**
 * References:
 * https://lettier.github.io/3d-game-shaders-for-beginners/screen-space-reflection.html
 */
export declare const SSRShader: {
    defines: {
        MAX_STEP: number;
        isPerspectiveCamera: boolean;
        isDistanceAttenuation: boolean;
        isFresnel: boolean;
        isInfiniteThick: boolean;
        isSelective: boolean;
    };
    uniforms: {
        tDiffuse: {
            value: null;
        };
        tNormal: {
            value: null;
        };
        tMetalness: {
            value: null;
        };
        tDepth: {
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
        opacity: {
            value: number;
        };
        maxDistance: {
            value: number;
        };
        cameraRange: {
            value: number;
        };
        surfDist: {
            value: number;
        };
        thickTolerance: {
            value: number;
        };
    };
    vertexShader: string;
    fragmentShader: string;
};
export declare const SSRDepthShader: {
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
export declare const SSRBlurShader: {
    uniforms: {
        tDiffuse: {
            value: null;
        };
        resolution: {
            value: Vector2;
        };
        opacity: {
            value: number;
        };
    };
    vertexShader: string;
    fragmentShader: string;
};
