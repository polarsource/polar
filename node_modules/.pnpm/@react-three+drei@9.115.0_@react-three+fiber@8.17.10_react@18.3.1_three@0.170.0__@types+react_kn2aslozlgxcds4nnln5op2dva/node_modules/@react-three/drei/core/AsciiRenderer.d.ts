import * as React from 'react';
type AsciiRendererProps = {
    renderIndex?: number;
    bgColor?: string;
    fgColor?: string;
    characters?: string;
    invert?: boolean;
    color?: boolean;
    resolution?: number;
};
export declare function AsciiRenderer({ renderIndex, bgColor, fgColor, characters, invert, color, resolution, }: AsciiRendererProps): React.JSX.Element;
export {};
