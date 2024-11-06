import { EventDispatcher, OrthographicCamera, PerspectiveCamera } from 'three';
import { ReactThreeFiber } from '@react-three/fiber';
import CameraControlsImpl from 'camera-controls';
import { ForwardRefComponent } from '../helpers/ts-utils';
export type CameraControlsProps = Omit<ReactThreeFiber.Overwrite<ReactThreeFiber.Node<CameraControlsImpl, typeof CameraControlsImpl>, {
    camera?: PerspectiveCamera | OrthographicCamera;
    domElement?: HTMLElement;
    makeDefault?: boolean;
    onStart?: (e?: {
        type: 'controlstart';
    }) => void;
    onEnd?: (e?: {
        type: 'controlend';
    }) => void;
    onChange?: (e?: {
        type: 'update';
    }) => void;
    events?: boolean;
    regress?: boolean;
}>, 'ref' | keyof EventDispatcher>;
export declare const CameraControls: ForwardRefComponent<CameraControlsProps, CameraControlsImpl>;
export type CameraControls = CameraControlsImpl;
