import { GetState, SetState, State, StoreApi } from '../vanilla';
declare type DeepPartial<T> = {
    [P in keyof T]?: DeepPartial<T[P]>;
};
export declare type StateStorage = {
    getItem: (name: string) => string | null | Promise<string | null>;
    setItem: (name: string, value: string) => void | Promise<void>;
    removeItem?: (name: string) => void | Promise<void>;
};
declare type StorageValue<S> = {
    state: DeepPartial<S>;
    version?: number;
};
export declare type PersistOptions<S, PersistedState extends Partial<S> = Partial<S>> = {
    /** Name of the storage (must be unique) */
    name: string;
    /**
     * A function returning a storage.
     * The storage must fit `window.localStorage`'s api (or an async version of it).
     * For example the storage could be `AsyncStorage` from React Native.
     *
     * @default () => localStorage
     */
    getStorage?: () => StateStorage;
    /**
     * Use a custom serializer.
     * The returned string will be stored in the storage.
     *
     * @default JSON.stringify
     */
    serialize?: (state: StorageValue<S>) => string | Promise<string>;
    /**
     * Use a custom deserializer.
     * Must return an object matching StorageValue<State>
     *
     * @param str The storage's current value.
     * @default JSON.parse
     */
    deserialize?: (str: string) => StorageValue<PersistedState> | Promise<StorageValue<PersistedState>>;
    /**
     * Prevent some items from being stored.
     *
     * @deprecated This options is deprecated and will be removed in the next version. Please use the `partialize` option instead.
     */
    blacklist?: (keyof S)[];
    /**
     * Only store the listed properties.
     *
     * @deprecated This options is deprecated and will be removed in the next version. Please use the `partialize` option instead.
     */
    whitelist?: (keyof S)[];
    /**
     * Filter the persisted value.
     *
     * @params state The state's value
     */
    partialize?: (state: S) => DeepPartial<S>;
    /**
     * A function returning another (optional) function.
     * The main function will be called before the state rehydration.
     * The returned function will be called after the state rehydration or when an error occurred.
     */
    onRehydrateStorage?: (state: S) => ((state?: S, error?: Error) => void) | void;
    /**
     * If the stored state's version mismatch the one specified here, the storage will not be used.
     * This is useful when adding a breaking change to your store.
     */
    version?: number;
    /**
     * A function to perform persisted state migration.
     * This function will be called when persisted state versions mismatch with the one specified here.
     */
    migrate?: (persistedState: any, version: number) => S | Promise<S>;
    /**
     * A function to perform custom hydration merges when combining the stored state with the current one.
     * By default, this function does a shallow merge.
     */
    merge?: (persistedState: any, currentState: S) => S;
};
declare type PersistListener<S> = (state: S) => void;
/**
 * @deprecated Use `Mutate<StoreApi<T>, [["zustand/persist", Partial<T>]]>`.
 * See tests/middlewaresTypes.test.tsx for usage with multiple middlewares.
 */
export declare type StoreApiWithPersist<S extends State> = StoreApi<S> & StorePersist<S, Partial<S>>;
declare module '../vanilla' {
    interface StoreMutators<S, A> {
        'zustand/persist': WithPersist<S, A>;
    }
}
declare type Write<T extends object, U extends object> = Omit<T, keyof U> & U;
declare type Cast<T, U> = T extends U ? T : U;
declare type WithPersist<S, A> = S extends {
    getState: () => infer T;
} ? Write<S, StorePersist<Cast<T, State>, A>> : never;
interface StorePersist<S extends State, Ps> {
    persist: {
        setOptions: (options: Partial<PersistOptions<S, Ps>>) => void;
        clearStorage: () => void;
        rehydrate: () => Promise<void>;
        hasHydrated: () => boolean;
        onHydrate: (fn: PersistListener<S>) => () => void;
        onFinishHydration: (fn: PersistListener<S>) => () => void;
    };
}
export declare const persist: <S extends object, CustomSetState extends SetState<S> = SetState<S>, CustomGetState extends GetState<S> = GetState<S>, CustomStoreApi extends StoreApi<S> = StoreApi<S>>(config: (set: CustomSetState, get: CustomGetState, api: CustomStoreApi) => S, baseOptions: PersistOptions<S, Partial<S>>) => (set: CustomSetState, get: CustomGetState, api: CustomStoreApi & StoreApi<S> & StorePersist<S, Partial<S>>) => S;
export {};
