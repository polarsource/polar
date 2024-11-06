import type { IUniform } from 'three';
export type Defines = {
    [key: string]: boolean | number | string;
};
export type Uniforms = {
    [key: string]: IUniform;
};
export interface IShader<U extends Uniforms, D extends Defines | undefined = undefined> {
    defines?: D;
    fragmentShader: string;
    uniforms: U;
    vertexShader: string;
}
