import { Color, Vector3 } from 'three';
/**
 * God-rays (crepuscular rays)
 *
 * Similar implementation to the one used by Crytek for CryEngine 2 [Sousa2008].
 * Blurs a mask generated from the depth map along radial lines emanating from the light
 * source. The blur repeatedly applies a blur filter of increasing support but constant
 * sample count to produce a blur filter with large support.
 *
 * My implementation performs 3 passes, similar to the implementation from Sousa. I found
 * just 6 samples per pass produced acceptible results. The blur is applied three times,
 * with decreasing filter support. The result is equivalent to a single pass with
 * 6*6*6 = 216 samples.
 *
 * References:
 *
 * Sousa2008 - Crysis Next Gen Effects, GDC2008, http://www.crytek.com/sites/default/files/GDC08_SousaT_CrysisEffects.ppt
 */
export declare const GodRaysDepthMaskShader: {
    uniforms: {
        tInput: {
            value: null;
        };
    };
    vertexShader: string;
    fragmentShader: string;
};
/**
 * The god-ray generation shader.
 *
 * First pass:
 *
 * The depth map is blurred along radial lines towards the "sun". The
 * output is written to a temporary render target (I used a 1/4 sized
 * target).
 *
 * Pass two & three:
 *
 * The results of the previous pass are re-blurred, each time with a
 * decreased distance between samples.
 */
export declare const GodRaysGenerateShader: {
    uniforms: {
        tInput: {
            value: null;
        };
        fStepSize: {
            value: number;
        };
        vSunPositionScreenSpace: {
            value: Vector3;
        };
    };
    vertexShader: string;
    fragmentShader: string;
};
/**
 * Additively applies god rays from texture tGodRays to a background (tColors).
 * fGodRayIntensity attenuates the god rays.
 */
export declare const GodRaysCombineShader: {
    uniforms: {
        tColors: {
            value: null;
        };
        tGodRays: {
            value: null;
        };
        fGodRayIntensity: {
            value: number;
        };
    };
    vertexShader: string;
    fragmentShader: string;
};
/**
 * A dodgy sun/sky shader. Makes a bright spot at the sun location. Would be
 * cheaper/faster/simpler to implement this as a simple sun sprite.
 */
export declare const GodRaysFakeSunShader: {
    uniforms: {
        vSunPositionScreenSpace: {
            value: Vector3;
        };
        fAspect: {
            value: number;
        };
        sunColor: {
            value: Color;
        };
        bgColor: {
            value: Color;
        };
    };
    vertexShader: string;
    fragmentShader: string;
};
