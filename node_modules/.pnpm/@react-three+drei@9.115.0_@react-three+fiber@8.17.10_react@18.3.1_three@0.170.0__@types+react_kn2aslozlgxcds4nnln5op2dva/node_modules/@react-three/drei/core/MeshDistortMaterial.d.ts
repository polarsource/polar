import { IUniform, MeshPhysicalMaterial, MeshPhysicalMaterialParameters } from 'three';
import { ForwardRefComponent } from '../helpers/ts-utils';
type DistortMaterialType = JSX.IntrinsicElements['meshPhysicalMaterial'] & {
    time?: number;
    distort?: number;
    radius?: number;
};
type Props = DistortMaterialType & {
    speed?: number;
    factor?: number;
};
declare global {
    namespace JSX {
        interface IntrinsicElements {
            distortMaterialImpl: DistortMaterialType;
        }
    }
}
interface Uniform<T> {
    value: T;
}
declare class DistortMaterialImpl extends MeshPhysicalMaterial {
    _time: Uniform<number>;
    _distort: Uniform<number>;
    _radius: Uniform<number>;
    constructor(parameters?: MeshPhysicalMaterialParameters);
    onBeforeCompile(shader: {
        vertexShader: string;
        uniforms: {
            [uniform: string]: IUniform;
        };
    }): void;
    get time(): number;
    set time(v: number);
    get distort(): number;
    set distort(v: number);
    get radius(): number;
    set radius(v: number);
}
export declare const MeshDistortMaterial: ForwardRefComponent<Props, DistortMaterialImpl>;
export {};
