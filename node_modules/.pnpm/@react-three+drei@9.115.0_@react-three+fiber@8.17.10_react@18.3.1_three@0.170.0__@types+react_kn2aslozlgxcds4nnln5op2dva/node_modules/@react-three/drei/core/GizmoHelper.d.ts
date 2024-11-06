import { Vector3 } from 'three';
type GizmoHelperContext = {
    tweenCamera: (direction: Vector3) => void;
};
export declare const useGizmoContext: () => GizmoHelperContext;
export type GizmoHelperProps = JSX.IntrinsicElements['group'] & {
    alignment?: 'top-left' | 'top-right' | 'bottom-right' | 'bottom-left' | 'bottom-center' | 'center-right' | 'center-left' | 'center-center' | 'top-center';
    margin?: [number, number];
    renderPriority?: number;
    autoClear?: boolean;
    onUpdate?: () => void;
    onTarget?: () => Vector3;
};
export declare const GizmoHelper: ({ alignment, margin, renderPriority, onUpdate, onTarget, children, }: GizmoHelperProps) => any;
export {};
