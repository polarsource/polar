import { Object3DProps } from '@react-three/fiber';
import { Object3D } from 'three';
import { ForwardRefComponent } from '../helpers/ts-utils';
export interface ScreenSizerProps extends Object3DProps {
    scale?: number;
}
export declare const ScreenSizer: ForwardRefComponent<ScreenSizerProps, Object3D>;
