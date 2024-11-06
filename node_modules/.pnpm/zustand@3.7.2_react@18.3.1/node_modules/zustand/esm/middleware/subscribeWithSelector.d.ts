import { EqualityChecker, GetState, SetState, State, StateListener, StateSelector, StateSliceListener, StoreApi } from '../vanilla';
declare module '../vanilla' {
    interface StoreMutators<S, A> {
        ['zustand/subscribeWithSelector']: WithSelectorSubscribe<S>;
    }
}
declare type WithSelectorSubscribe<S> = S extends {
    getState: () => infer T;
} ? Omit<S, 'subscribe'> & StoreSubscribeWithSelector<Extract<T, State>> : never;
interface StoreSubscribeWithSelector<T extends State> {
    subscribe: {
        (listener: (selectedState: T, previousSelectedState: T) => void): () => void;
        <U>(selector: (state: T) => U, listener: (selectedState: U, previousSelectedState: U) => void, options?: {
            equalityFn?: (a: U, b: U) => boolean;
            fireImmediately?: boolean;
        }): () => void;
    };
}
/**
 * @deprecated Use `Mutate<StoreApi<T>, [["zustand/subscribeWithSelector", never]]>`.
 * See tests/middlewaresTypes.test.tsx for usage with multiple middlewares.
 */
export declare type StoreApiWithSubscribeWithSelector<T extends State> = Omit<StoreApi<T>, 'subscribe'> & {
    subscribe: {
        (listener: StateListener<T>): () => void;
        <StateSlice>(selector: StateSelector<T, StateSlice>, listener: StateSliceListener<StateSlice>, options?: {
            equalityFn?: EqualityChecker<StateSlice>;
            fireImmediately?: boolean;
        }): () => void;
    };
};
export declare const subscribeWithSelector: <S extends object, CustomSetState extends SetState<S> = SetState<S>, CustomGetState extends GetState<S> = GetState<S>, CustomStoreApi extends StoreApi<S> = StoreApi<S>>(fn: (set: CustomSetState, get: CustomGetState, api: CustomStoreApi) => S) => (set: CustomSetState, get: CustomGetState, api: Omit<CustomStoreApi, "subscribe"> & Omit<StoreApi<S>, "subscribe"> & {
    subscribe: {
        (listener: StateListener<S>): () => void;
        <StateSlice>(selector: StateSelector<S, StateSlice>, listener: StateSliceListener<StateSlice>, options?: {
            equalityFn?: EqualityChecker<StateSlice>;
            fireImmediately?: boolean;
        } | undefined): () => void;
    };
}) => S;
export {};
