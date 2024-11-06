import { Group } from 'three';
import { ForwardRefComponent } from '../helpers/ts-utils';
export type BillboardProps = {
    follow?: boolean;
    lockX?: boolean;
    lockY?: boolean;
    lockZ?: boolean;
} & JSX.IntrinsicElements['group'];
export declare const Billboard: ForwardRefComponent<BillboardProps, Group>;
