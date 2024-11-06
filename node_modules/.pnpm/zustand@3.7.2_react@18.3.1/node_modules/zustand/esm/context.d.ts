import { ReactNode } from 'react';
import { EqualityChecker, State, StateSelector, UseBoundStore } from 'zustand';
/**
 * @deprecated Use `typeof MyContext.useStore` instead.
 */
export declare type UseContextStore<T extends State> = {
    (): T;
    <U>(selector: StateSelector<T, U>, equalityFn?: EqualityChecker<U>): U;
};
declare function createContext<TState extends State, TUseBoundStore extends UseBoundStore<TState> = UseBoundStore<TState>>(): {
    Provider: ({ initialStore, createStore, children, }: {
        /**
         * @deprecated
         */
        initialStore?: TUseBoundStore;
        createStore: () => TUseBoundStore;
        children: ReactNode;
    }) => import("react").FunctionComponentElement<import("react").ProviderProps<TUseBoundStore | undefined>>;
    useStore: UseContextStore<TState>;
    useStoreApi: () => {
        getState: TUseBoundStore['getState'];
        setState: TUseBoundStore['setState'];
        subscribe: TUseBoundStore['subscribe'];
        destroy: TUseBoundStore['destroy'];
    };
};
export default createContext;
