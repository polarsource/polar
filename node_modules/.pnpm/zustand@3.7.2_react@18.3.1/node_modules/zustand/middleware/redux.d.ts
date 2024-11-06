import { GetState, SetState, State, StoreApi } from '../vanilla';
declare type DevtoolsType = {
    prefix: string;
    subscribe: (dispatch: any) => () => void;
    unsubscribe: () => void;
    send: (action: string, state: any) => void;
    init: (state: any) => void;
    error: (payload: any) => void;
};
/**
 * @deprecated Use `Mutate<StoreApi<T & { dispatch: (a: A) => A }>, [["zustand/redux", A]]>`.
 * See tests/middlewaresTypes.test.tsx for usage with multiple middlewares.
 */
export declare type StoreApiWithRedux<T extends State, A extends {
    type: unknown;
}> = StoreApi<T & {
    dispatch: (a: A) => A;
}> & {
    dispatch: (a: A) => A;
    dispatchFromDevtools: boolean;
};
declare module '../vanilla' {
    interface StoreMutators<S, A> {
        'zustand/redux': WithRedux<S, A>;
    }
}
interface StoreRedux<A extends Action> {
    dispatch: (a: A) => A;
    dispatchFromDevtools: true;
}
interface Action {
    type: unknown;
}
declare type Write<T extends object, U extends object> = Omit<T, keyof U> & U;
declare type Cast<T, U> = T extends U ? T : U;
declare type WithRedux<S, A> = Write<Cast<S, object>, StoreRedux<Cast<A, Action>>>;
export declare const redux: <S extends object, A extends {
    type: unknown;
}>(reducer: (state: S, action: A) => S, initial: S) => (set: SetState<S & {
    dispatch: (a: A) => A;
}>, get: GetState<S & {
    dispatch: (a: A) => A;
}>, api: StoreApi<S & {
    dispatch: (a: A) => A;
}> & {
    dispatch: (a: A) => A;
    dispatchFromDevtools: boolean;
} & {
    devtools?: DevtoolsType;
}) => S & {
    dispatch: (a: A) => A;
};
export {};
