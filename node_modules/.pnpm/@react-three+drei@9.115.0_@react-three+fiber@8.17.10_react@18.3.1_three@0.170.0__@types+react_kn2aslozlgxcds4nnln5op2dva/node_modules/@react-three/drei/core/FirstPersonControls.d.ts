import { Object3DNode } from '@react-three/fiber';
import { FirstPersonControls as FirstPersonControlImpl } from 'three-stdlib';
import { ForwardRefComponent } from '../helpers/ts-utils';
export type FirstPersonControlsProps = Object3DNode<FirstPersonControlImpl, typeof FirstPersonControlImpl> & {
    domElement?: HTMLElement;
    makeDefault?: boolean;
};
export declare const FirstPersonControls: ForwardRefComponent<FirstPersonControlsProps, FirstPersonControlImpl>;
