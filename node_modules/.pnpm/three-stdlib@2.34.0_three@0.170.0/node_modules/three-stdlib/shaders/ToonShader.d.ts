import { Color, Vector3 } from 'three';
/**
 * Currently contains:
 *
 *	toon1
 *	toon2
 *	hatching
 *	dotted
 */
export declare const ToonShader1: {
    uniforms: {
        uDirLightPos: {
            value: Vector3;
        };
        uDirLightColor: {
            value: Color;
        };
        uAmbientLightColor: {
            value: Color;
        };
        uBaseColor: {
            value: Color;
        };
    };
    vertexShader: string;
    fragmentShader: string;
};
export declare const ToonShader2: {
    uniforms: {
        uDirLightPos: {
            value: Vector3;
        };
        uDirLightColor: {
            value: Color;
        };
        uAmbientLightColor: {
            value: Color;
        };
        uBaseColor: {
            value: Color;
        };
        uLineColor1: {
            value: Color;
        };
        uLineColor2: {
            value: Color;
        };
        uLineColor3: {
            value: Color;
        };
        uLineColor4: {
            value: Color;
        };
    };
    vertexShader: string;
    fragmentShader: string;
};
export declare const ToonShaderHatching: {
    uniforms: {
        uDirLightPos: {
            value: Vector3;
        };
        uDirLightColor: {
            value: Color;
        };
        uAmbientLightColor: {
            value: Color;
        };
        uBaseColor: {
            value: Color;
        };
        uLineColor1: {
            value: Color;
        };
        uLineColor2: {
            value: Color;
        };
        uLineColor3: {
            value: Color;
        };
        uLineColor4: {
            value: Color;
        };
    };
    vertexShader: string;
    fragmentShader: string;
};
export declare const ToonShaderDotted: {
    uniforms: {
        uDirLightPos: {
            value: Vector3;
        };
        uDirLightColor: {
            value: Color;
        };
        uAmbientLightColor: {
            value: Color;
        };
        uBaseColor: {
            value: Color;
        };
        uLineColor1: {
            value: Color;
        };
    };
    vertexShader: string;
    fragmentShader: string;
};
