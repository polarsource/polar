import * as THREE from 'three';
import * as React from 'react';
import { ForwardRefComponent } from '../helpers/ts-utils';
export type ScrollControlsProps = {
    eps?: number;
    horizontal?: boolean;
    infinite?: boolean;
    pages?: number;
    distance?: number;
    damping?: number;
    maxSpeed?: number;
    prepend?: boolean;
    enabled?: boolean;
    style?: React.CSSProperties;
    children: React.ReactNode;
};
export type ScrollControlsState = {
    el: HTMLDivElement;
    eps: number;
    fill: HTMLDivElement;
    fixed: HTMLDivElement;
    horizontal: boolean | undefined;
    damping: number;
    offset: number;
    delta: number;
    pages: number;
    range(from: number, distance: number, margin?: number): number;
    curve(from: number, distance: number, margin?: number): number;
    visible(from: number, distance: number, margin?: number): boolean;
};
export declare function useScroll(): ScrollControlsState;
export declare function ScrollControls({ eps, enabled, infinite, horizontal, pages, distance, damping, maxSpeed, prepend, style, children, }: ScrollControlsProps): React.JSX.Element;
interface ScrollPropsWithFalseHtml {
    children?: React.ReactNode;
    html?: false;
    style?: never;
}
interface ScrollPropsWithTrueHtml {
    children?: React.ReactNode;
    html: true;
    style?: React.CSSProperties;
}
type ScrollProps = ScrollPropsWithFalseHtml | ScrollPropsWithTrueHtml;
export declare const Scroll: ForwardRefComponent<ScrollProps, THREE.Group & HTMLDivElement>;
export {};
