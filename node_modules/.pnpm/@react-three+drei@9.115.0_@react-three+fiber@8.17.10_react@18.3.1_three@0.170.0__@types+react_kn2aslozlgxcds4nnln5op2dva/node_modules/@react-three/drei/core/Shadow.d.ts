import { Mesh, Color, type PlaneGeometry, type MeshBasicMaterial } from 'three';
import { ForwardRefComponent } from '../helpers/ts-utils';
type Props = JSX.IntrinsicElements['mesh'] & {
    colorStop?: number;
    fog?: boolean;
    color?: Color | number | string;
    opacity?: number;
    depthWrite?: boolean;
};
export type ShadowType = Mesh<PlaneGeometry, MeshBasicMaterial>;
export declare const Shadow: ForwardRefComponent<Props, ShadowType>;
export {};
