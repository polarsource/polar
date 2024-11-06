import { Texture } from 'three';
import { MeshReflectorMaterialProps, MeshReflectorMaterial as MeshReflectorMaterialImpl } from '../materials/MeshReflectorMaterial';
import { ForwardRefComponent } from '../helpers/ts-utils';
type Props = JSX.IntrinsicElements['meshStandardMaterial'] & {
    resolution?: number;
    mixBlur?: number;
    mixStrength?: number;
    blur?: [number, number] | number;
    mirror: number;
    minDepthThreshold?: number;
    maxDepthThreshold?: number;
    depthScale?: number;
    depthToBlurRatioBias?: number;
    distortionMap?: Texture;
    distortion?: number;
    mixContrast?: number;
    reflectorOffset?: number;
};
declare global {
    namespace JSX {
        interface IntrinsicElements {
            meshReflectorMaterialImpl: MeshReflectorMaterialProps;
        }
    }
}
export declare const MeshReflectorMaterial: ForwardRefComponent<Props, MeshReflectorMaterialImpl>;
export {};
