import * as React from 'react';
export type FisheyeProps = JSX.IntrinsicElements['mesh'] & {
    zoom?: number;
    segments?: number;
    resolution?: number;
    children: React.ReactNode;
    renderPriority?: number;
};
export declare function Fisheye({ renderPriority, zoom, segments, children, resolution, ...props }: FisheyeProps): React.JSX.Element;
