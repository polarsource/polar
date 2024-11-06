import * as React from 'react';
import { Object3D } from 'three';
import { Falsey } from 'utility-types';
type HelperType = Object3D & {
    update: () => void;
    dispose: () => void;
};
type HelperConstructor = new (...args: any[]) => any;
type HelperArgs<T> = T extends [infer _, ...infer R] ? R : never;
export declare function useHelper<T extends HelperConstructor>(object3D: React.MutableRefObject<Object3D> | Falsey, helperConstructor: T, ...args: HelperArgs<ConstructorParameters<T>>): React.MutableRefObject<HelperType | undefined>;
export type HelperProps<T extends HelperConstructor> = {
    type: T;
    args?: HelperArgs<ConstructorParameters<T>>;
};
export declare const Helper: <T extends HelperConstructor>({ type: helperConstructor, args, }: HelperProps<T>) => React.JSX.Element;
export {};
