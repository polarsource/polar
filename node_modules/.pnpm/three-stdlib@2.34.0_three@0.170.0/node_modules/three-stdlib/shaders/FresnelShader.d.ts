/**
 * Based on Nvidia Cg tutorial
 */
export declare const FresnelShader: {
    uniforms: {
        mRefractionRatio: {
            value: number;
        };
        mFresnelBias: {
            value: number;
        };
        mFresnelPower: {
            value: number;
        };
        mFresnelScale: {
            value: number;
        };
        tCube: {
            value: null;
        };
    };
    vertexShader: string;
    fragmentShader: string;
};
