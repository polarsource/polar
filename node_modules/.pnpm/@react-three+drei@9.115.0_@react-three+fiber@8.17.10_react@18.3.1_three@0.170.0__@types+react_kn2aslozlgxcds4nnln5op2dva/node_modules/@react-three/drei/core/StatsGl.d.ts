import { ForwardRefComponent } from '../helpers/ts-utils';
import * as React from 'react';
import Stats from 'stats-gl';
type Props = Partial<Stats> & {
    id?: string;
    clearStatsGlStyle?: boolean;
    showPanel?: number;
    className?: string;
    parent?: React.RefObject<HTMLElement>;
    ref?: React.RefObject<HTMLElement>;
};
export declare const StatsGl: ForwardRefComponent<Props, HTMLDivElement>;
export {};
