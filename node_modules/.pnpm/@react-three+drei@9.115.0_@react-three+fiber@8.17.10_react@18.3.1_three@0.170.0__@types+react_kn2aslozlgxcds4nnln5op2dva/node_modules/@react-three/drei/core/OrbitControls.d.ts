import { ReactThreeFiber } from '@react-three/fiber';
import type { Camera, Event } from 'three';
import { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { ForwardRefComponent } from '../helpers/ts-utils';
export type OrbitControlsChangeEvent = Event & {
    target: EventTarget & {
        object: Camera;
    };
};
export type OrbitControlsProps = Omit<ReactThreeFiber.Overwrite<ReactThreeFiber.Object3DNode<OrbitControlsImpl, typeof OrbitControlsImpl>, {
    camera?: Camera;
    domElement?: HTMLElement;
    enableDamping?: boolean;
    makeDefault?: boolean;
    onChange?: (e?: OrbitControlsChangeEvent) => void;
    onEnd?: (e?: Event) => void;
    onStart?: (e?: Event) => void;
    regress?: boolean;
    target?: ReactThreeFiber.Vector3;
    keyEvents?: boolean | HTMLElement;
}>, 'ref'>;
export declare const OrbitControls: ForwardRefComponent<OrbitControlsProps, OrbitControlsImpl>;
