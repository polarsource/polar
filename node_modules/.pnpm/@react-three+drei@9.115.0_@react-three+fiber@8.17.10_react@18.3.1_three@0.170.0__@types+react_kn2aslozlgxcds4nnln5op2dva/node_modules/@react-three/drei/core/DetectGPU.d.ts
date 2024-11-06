import * as React from 'react';
import { GetGPUTier } from 'detect-gpu';
export declare const useDetectGPU: (props?: GetGPUTier) => import("detect-gpu").TierResult;
type DetectGPUProps = {
    children?: (result: ReturnType<typeof useDetectGPU>) => React.ReactNode;
} & Parameters<typeof useDetectGPU>[0];
export declare function DetectGPU({ children, ...options }: DetectGPUProps): React.JSX.Element;
export {};
