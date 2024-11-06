import * as THREE from 'three';
import { ForwardRefComponent } from '../helpers/ts-utils';
export type ContactShadowsProps = {
    opacity?: number;
    width?: number;
    height?: number;
    blur?: number;
    near?: number;
    far?: number;
    smooth?: boolean;
    resolution?: number;
    frames?: number;
    scale?: number | [x: number, y: number];
    color?: THREE.ColorRepresentation;
    depthWrite?: boolean;
};
export declare const ContactShadows: ForwardRefComponent<Omit<JSX.IntrinsicElements['group'], 'scale'> & ContactShadowsProps, THREE.Group>;
