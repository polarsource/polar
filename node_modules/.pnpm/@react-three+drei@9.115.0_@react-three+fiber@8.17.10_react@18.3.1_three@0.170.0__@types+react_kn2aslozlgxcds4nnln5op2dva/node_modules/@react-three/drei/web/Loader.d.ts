import * as React from 'react';
import { CSSProperties } from 'react';
interface LoaderOptions {
    containerStyles: CSSProperties;
    innerStyles: CSSProperties;
    barStyles: CSSProperties;
    dataStyles: CSSProperties;
    dataInterpolation: (p: number) => string;
    initialState: (active: boolean) => boolean;
}
export declare function Loader({ containerStyles, innerStyles, barStyles, dataStyles, dataInterpolation, initialState, }: Partial<LoaderOptions>): React.JSX.Element | null;
export {};
