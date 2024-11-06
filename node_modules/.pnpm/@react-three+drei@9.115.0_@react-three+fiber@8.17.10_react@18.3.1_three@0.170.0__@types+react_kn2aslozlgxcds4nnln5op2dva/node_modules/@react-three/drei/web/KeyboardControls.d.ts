import * as React from 'react';
import { StoreApi } from 'zustand';
type State = object;
type StateSelector<T extends State, U> = (state: T) => U;
type EqualityChecker<T> = (state: T, newState: T) => boolean;
type StateListener<T> = (state: T, previousState: T) => void;
type StoreApiWithSubscribeWithSelector<T extends State> = Omit<StoreApi<T>, 'subscribe'> & {
    subscribe: {
        (listener: StateListener<T>): () => void;
        <StateSlice>(selector: StateSelector<T, StateSlice>, listener: StateListener<StateSlice>, options?: {
            equalityFn?: EqualityChecker<StateSlice>;
            fireImmediately?: boolean;
        }): () => void;
    };
};
type KeyboardControlsState<T extends string = string> = {
    [K in T]: boolean;
};
export type KeyboardControlsEntry<T extends string = string> = {
    name: T;
    keys: string[];
    up?: boolean;
};
type KeyboardControlsProps = {
    map: KeyboardControlsEntry[];
    children: React.ReactNode;
    onChange?: (name: string, pressed: boolean, state: KeyboardControlsState) => void;
    domElement?: HTMLElement;
};
export declare function KeyboardControls({ map, children, onChange, domElement }: KeyboardControlsProps): React.JSX.Element;
type Selector<T extends string = string> = (state: KeyboardControlsState<T>) => boolean;
export declare function useKeyboardControls<T extends string = string>(): [
    StoreApiWithSubscribeWithSelector<KeyboardControlsState<T>>['subscribe'],
    StoreApiWithSubscribeWithSelector<KeyboardControlsState<T>>['getState']
];
export declare function useKeyboardControls<T extends string = string>(sel: Selector<T>): ReturnType<Selector<T>>;
export {};
