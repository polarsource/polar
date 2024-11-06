import * as React from 'react';
import { SpringConfig } from '@react-spring/three';
export type PresentationControlProps = {
    snap?: Boolean | SpringConfig;
    global?: boolean;
    cursor?: boolean;
    speed?: number;
    zoom?: number;
    rotation?: [number, number, number];
    polar?: [number, number];
    azimuth?: [number, number];
    config?: any;
    enabled?: boolean;
    children?: React.ReactNode;
    domElement?: HTMLElement;
};
export declare function PresentationControls({ enabled, snap, global, domElement, cursor, children, speed, rotation, zoom, polar, azimuth, config, }: PresentationControlProps): React.JSX.Element;
