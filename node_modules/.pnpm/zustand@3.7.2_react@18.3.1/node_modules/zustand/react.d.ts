import { EqualityChecker, GetState, SetState, State, StateCreator, StateSelector, StoreApi } from './vanilla';
/**
 * @deprecated Please use UseBoundStore instead
 */
export declare type UseStore<T extends State, CustomStoreApi extends StoreApi<T> = StoreApi<T>> = {
    (): T;
    <U>(selector: StateSelector<T, U>, equalityFn?: EqualityChecker<U>): U;
} & CustomStoreApi;
export declare type UseBoundStore<T extends State, CustomStoreApi extends StoreApi<T> = StoreApi<T>> = {
    (): T;
    <U>(selector: StateSelector<T, U>, equalityFn?: EqualityChecker<U>): U;
} & CustomStoreApi;
declare function create<TState extends State, CustomSetState, CustomGetState, CustomStoreApi extends StoreApi<TState>>(createState: StateCreator<TState, CustomSetState, CustomGetState, CustomStoreApi> | CustomStoreApi): UseBoundStore<TState, CustomStoreApi>;
declare function create<TState extends State>(createState: StateCreator<TState, SetState<TState>, GetState<TState>, any> | StoreApi<TState>): UseBoundStore<TState, StoreApi<TState>>;
export default create;
