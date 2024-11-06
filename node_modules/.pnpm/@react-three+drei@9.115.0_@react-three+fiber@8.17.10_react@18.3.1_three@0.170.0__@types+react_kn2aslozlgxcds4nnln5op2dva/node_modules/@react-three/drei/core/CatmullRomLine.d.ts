import { Line2 } from 'three-stdlib';
import { LineProps } from './Line';
import { ForwardRefComponent } from '../helpers/ts-utils';
type Props = Omit<LineProps, 'ref'> & {
    closed?: boolean;
    curveType?: 'centripetal' | 'chordal' | 'catmullrom';
    tension?: number;
    segments?: number;
};
export declare const CatmullRomLine: ForwardRefComponent<Props, Line2>;
export {};
