import * as React from 'react';
import * as THREE from 'three';
type LegacyCanvasSize = {
    height: number;
    width: number;
};
type CanvasSize = LegacyCanvasSize & {
    top: number;
    left: number;
};
export type ContainerProps = {
    visible: boolean;
    scene: THREE.Scene;
    index: number;
    children?: React.ReactNode;
    frames: number;
    rect: React.MutableRefObject<DOMRect>;
    track?: React.MutableRefObject<HTMLElement>;
    canvasSize: LegacyCanvasSize | CanvasSize;
};
export type ViewProps = {
    as?: string;
    id?: string;
    className?: string;
    style?: React.CSSProperties;
    visible?: boolean;
    index?: number;
    frames?: number;
    children?: React.ReactNode;
    track?: React.MutableRefObject<HTMLElement>;
};
export type ViewportProps = {
    Port: () => JSX.Element;
} & React.ForwardRefExoticComponent<ViewProps & React.RefAttributes<HTMLElement | THREE.Group>>;
export declare const View: ViewportProps;
export {};
