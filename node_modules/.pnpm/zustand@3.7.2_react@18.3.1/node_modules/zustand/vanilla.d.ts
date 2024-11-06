export declare type State = object;
/**
 * @deprecated Use the builtin `Partial<T>` instead of `PartialState<T>`.
 * Additionally turn on `--exactOptionalPropertyTypes` tsc flag.
 * `PartialState` will be removed in next major
 */
export declare type PartialState<T extends State, K1 extends keyof T = keyof T, K2 extends keyof T = K1, K3 extends keyof T = K2, K4 extends keyof T = K3> = (Pick<T, K1> | Pick<T, K2> | Pick<T, K3> | Pick<T, K4> | T) | ((state: T) => Pick<T, K1> | Pick<T, K2> | Pick<T, K3> | Pick<T, K4> | T);
export declare type StateSelector<T extends State, U> = (state: T) => U;
export declare type EqualityChecker<T> = (state: T, newState: T) => boolean;
export declare type StateListener<T> = (state: T, previousState: T) => void;
/**
 * @deprecated Use `StateListener<T>` instead of `StateSliceListener<T>`.
 */
export declare type StateSliceListener<T> = (slice: T, previousSlice: T) => void;
export declare type Subscribe<T extends State> = {
    (listener: StateListener<T>): () => void;
    /**
     * @deprecated Please use `subscribeWithSelector` middleware
     */
    <StateSlice>(listener: StateSliceListener<StateSlice>, selector?: StateSelector<T, StateSlice>, equalityFn?: EqualityChecker<StateSlice>): () => void;
};
export declare type SetState<T extends State> = {
    <K1 extends keyof T, K2 extends keyof T = K1, K3 extends keyof T = K2, K4 extends keyof T = K3>(partial: PartialState<T, K1, K2, K3, K4>, replace?: boolean): void;
};
export declare type GetState<T extends State> = () => T;
export declare type Destroy = () => void;
export declare type StoreApi<T extends State> = {
    setState: SetState<T>;
    getState: GetState<T>;
    subscribe: Subscribe<T>;
    destroy: Destroy;
};
export declare type StateCreator<T extends State, CustomSetState = SetState<T>, CustomGetState = GetState<T>, CustomStoreApi extends StoreApi<T> = StoreApi<T>> = (set: CustomSetState, get: CustomGetState, api: CustomStoreApi) => T;
declare function createStore<TState extends State, CustomSetState, CustomGetState, CustomStoreApi extends StoreApi<TState>>(createState: StateCreator<TState, CustomSetState, CustomGetState, CustomStoreApi>): CustomStoreApi;
declare function createStore<TState extends State>(createState: StateCreator<TState, SetState<TState>, GetState<TState>, any>): StoreApi<TState>;
export default createStore;
export interface StoreMutators<S, A> {
}
export declare type StoreMutatorIdentifier = keyof StoreMutators<unknown, unknown>;
export declare type Mutate<S, Ms> = Ms extends [] ? S : Ms extends [[infer Mi, infer Ma], ...infer Mrs] ? Mutate<StoreMutators<S, Ma>[Mi & StoreMutatorIdentifier], Mrs> : never;
