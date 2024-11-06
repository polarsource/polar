import { ShaderMaterial } from 'three';
import { ReactThreeFiber } from '@react-three/fiber';
import { ForwardRefComponent } from '../helpers/ts-utils';
declare global {
    namespace JSX {
        interface IntrinsicElements {
            discardMaterialImpl: ReactThreeFiber.ShaderMaterialProps;
        }
    }
}
export declare const MeshDiscardMaterial: ForwardRefComponent<JSX.IntrinsicElements['shaderMaterial'], ShaderMaterial>;
