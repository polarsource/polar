import { Mesh, ShaderMaterial, Vector3 } from 'three';
/**
 * Based on "A Practical Analytic Model for Daylight"
 * aka The Preetham Model, the de facto standard analytic skydome model
 * https://www.researchgate.net/publication/220720443_A_Practical_Analytic_Model_for_Daylight
 *
 * First implemented by Simon Wallner
 * http://www.simonwallner.at/projects/atmospheric-scattering
 *
 * Improved by Martin Upitis
 * http://blenderartists.org/forum/showthread.php?245954-preethams-sky-impementation-HDR
 *
 * Three.js integration by zz85 http://twitter.com/blurspline
 */
declare class Sky extends Mesh {
    constructor();
    static SkyShader: {
        uniforms: {
            turbidity: {
                value: number;
            };
            rayleigh: {
                value: number;
            };
            mieCoefficient: {
                value: number;
            };
            mieDirectionalG: {
                value: number;
            };
            sunPosition: {
                value: Vector3;
            };
            up: {
                value: Vector3;
            };
        };
        vertexShader: string;
        fragmentShader: string;
    };
    static material: ShaderMaterial;
}
export { Sky };
