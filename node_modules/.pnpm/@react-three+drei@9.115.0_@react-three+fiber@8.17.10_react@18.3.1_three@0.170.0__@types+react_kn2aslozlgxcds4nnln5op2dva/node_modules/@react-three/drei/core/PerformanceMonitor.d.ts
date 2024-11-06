import * as React from 'react';
type PerformanceMonitorHookApi = {
    onIncline: (api: PerformanceMonitorApi) => void;
    onDecline: (api: PerformanceMonitorApi) => void;
    onChange: (api: PerformanceMonitorApi) => void;
    onFallback: (api: PerformanceMonitorApi) => void;
};
export type PerformanceMonitorApi = {
    fps: number;
    factor: number;
    refreshrate: number;
    frames: number[];
    averages: number[];
    index: number;
    flipped: number;
    fallback: boolean;
    subscriptions: Map<Symbol, Partial<PerformanceMonitorHookApi>>;
    subscribe: (ref: React.MutableRefObject<Partial<PerformanceMonitorHookApi>>) => () => void;
};
type PerformanceMonitorProps = {
    ms?: number;
    iterations?: number;
    threshold?: number;
    bounds?: (refreshrate: number) => [lower: number, upper: number];
    flipflops?: number;
    factor?: number;
    step?: number;
    onIncline?: (api: PerformanceMonitorApi) => void;
    onDecline?: (api: PerformanceMonitorApi) => void;
    onChange?: (api: PerformanceMonitorApi) => void;
    onFallback?: (api: PerformanceMonitorApi) => void;
    children?: React.ReactNode;
};
export declare function PerformanceMonitor({ iterations, ms, threshold, step, factor: _factor, flipflops, bounds, onIncline, onDecline, onChange, onFallback, children, }: PerformanceMonitorProps): React.JSX.Element;
export declare function usePerformanceMonitor({ onIncline, onDecline, onChange, onFallback, }: Partial<PerformanceMonitorHookApi>): void;
export {};
