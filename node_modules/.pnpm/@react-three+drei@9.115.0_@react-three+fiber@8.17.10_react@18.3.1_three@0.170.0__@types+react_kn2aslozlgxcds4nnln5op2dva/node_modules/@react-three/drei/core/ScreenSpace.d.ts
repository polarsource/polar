import { Group } from 'three';
import { ForwardRefComponent } from '../helpers/ts-utils';
export type ScreenSpaceProps = {
    depth?: number;
} & JSX.IntrinsicElements['group'];
export declare const ScreenSpace: ForwardRefComponent<ScreenSpaceProps, Group>;
