export declare const ParallaxShader: {
    modes: {
        none: string;
        basic: string;
        steep: string;
        occlusion: string;
        relief: string;
    };
    uniforms: {
        bumpMap: {
            value: null;
        };
        map: {
            value: null;
        };
        parallaxScale: {
            value: null;
        };
        parallaxMinLayers: {
            value: null;
        };
        parallaxMaxLayers: {
            value: null;
        };
    };
    vertexShader: string;
    fragmentShader: string;
};
