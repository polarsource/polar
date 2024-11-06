import { MeshBasicMaterialProps, MeshProps, Object3DProps } from '@react-three/fiber';
import { Object3D } from 'three';
import { ForwardRefComponent } from '../helpers/ts-utils';
export interface SvgProps extends Omit<Object3DProps, 'ref'> {
    src: string;
    skipFill?: boolean;
    skipStrokes?: boolean;
    fillMaterial?: MeshBasicMaterialProps;
    strokeMaterial?: MeshBasicMaterialProps;
    fillMeshProps?: MeshProps;
    strokeMeshProps?: MeshProps;
}
export declare const Svg: ForwardRefComponent<SvgProps, Object3D>;
