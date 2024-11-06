import { GetState, PartialState, SetState, State, StoreApi } from '../vanilla';
declare module '../vanilla' {
    interface StoreMutators<S, A> {
        'zustand/devtools': WithDevtools<S>;
    }
}
declare type Write<T extends object, U extends object> = Omit<T, keyof U> & U;
declare type Cast<T, U> = T extends U ? T : U;
declare type WithDevtools<S> = Write<Cast<S, object>, StoreSetStateWithAction<S>> & {
    /**
     * @deprecated `devtools` property on the store is deprecated
     * it will be removed in the next major.
     * You shouldn't interact with the extension directly. But in case you still want to
     * you can patch `window.__REDUX_DEVTOOLS_EXTENSION__` directly
     */
    devtools?: DevtoolsType;
};
declare type StoreSetStateWithAction<S> = S extends {
    getState: () => infer T;
} ? S & {
    setState: NamedSet<Cast<T, object>>;
} : never;
interface DevtoolsOptions {
    name?: string;
    anonymousActionType?: string;
    serialize?: boolean | {
        date?: boolean;
        regex?: boolean;
        undefined?: boolean;
        nan?: boolean;
        infinity?: boolean;
        error?: boolean;
        symbol?: boolean;
        map?: boolean;
        set?: boolean;
        /**
         * @deprecated serialize.options is deprecated, just use serialize
         */
        options: boolean | {
            date?: boolean;
            regex?: boolean;
            undefined?: boolean;
            nan?: boolean;
            infinity?: boolean;
            error?: boolean;
            symbol?: boolean;
            map?: boolean;
            set?: boolean;
        };
    };
}
declare type DevtoolsType = {
    /**
     * @deprecated along with `api.devtools`, `api.devtools.prefix` is deprecated.
     * We no longer prefix the actions/names, because the `name` option already
     * creates a separate instance of devtools for each store.
     */
    prefix: string;
    subscribe: (dispatch: any) => () => void;
    unsubscribe: () => void;
    send: {
        (action: string | {
            type: unknown;
        }, state: any): void;
        (action: null, liftedState: any): void;
    };
    init: (state: any) => void;
    error: (payload: any) => void;
};
export declare type NamedSet<T extends State> = {
    <K1 extends keyof T, K2 extends keyof T = K1, K3 extends keyof T = K2, K4 extends keyof T = K3>(partial: PartialState<T, K1, K2, K3, K4>, replace?: boolean, name?: string | {
        type: unknown;
    }): void;
};
/**
 * @deprecated Use `Mutate<StoreApi<T>, [["zustand/devtools", never]]>`.
 * See tests/middlewaresTypes.test.tsx for usage with multiple middlewares.
 */
export declare type StoreApiWithDevtools<T extends State> = StoreApi<T> & {
    setState: NamedSet<T>;
    /**
     * @deprecated `devtools` property on the store is deprecated
     * it will be removed in the next major.
     * You shouldn't interact with the extension directly. But in case you still want to
     * you can patch `window.__REDUX_DEVTOOLS_EXTENSION__` directly
     */
    devtools?: DevtoolsType;
};
export declare function devtools<S extends State, CustomSetState extends SetState<S>, CustomGetState extends GetState<S>, CustomStoreApi extends StoreApi<S>>(fn: (set: NamedSet<S>, get: CustomGetState, api: CustomStoreApi) => S): (set: CustomSetState, get: CustomGetState, api: CustomStoreApi & StoreApiWithDevtools<S> & {
    dispatch?: unknown;
    dispatchFromDevtools?: boolean;
}) => S;
/**
 * @deprecated Passing `name` as directly will be not allowed in next major.
 * Pass the `name` in an object `{ name: ... }` instead
 */
export declare function devtools<S extends State, CustomSetState extends SetState<S> = SetState<S>, CustomGetState extends GetState<S> = GetState<S>, CustomStoreApi extends StoreApi<S> = StoreApi<S>>(fn: (set: NamedSet<S>, get: CustomGetState, api: CustomStoreApi) => S, options?: string): (set: CustomSetState, get: CustomGetState, api: CustomStoreApi & StoreApiWithDevtools<S> & {
    dispatch?: unknown;
    dispatchFromDevtools?: boolean;
}) => S;
export declare function devtools<S extends State, CustomSetState extends SetState<S>, CustomGetState extends GetState<S>, CustomStoreApi extends StoreApi<S>>(fn: (set: NamedSet<S>, get: CustomGetState, api: CustomStoreApi) => S, options?: DevtoolsOptions): (set: CustomSetState, get: CustomGetState, api: CustomStoreApi & StoreApiWithDevtools<S> & {
    dispatch?: unknown;
    dispatchFromDevtools?: boolean;
}) => S;
export {};
