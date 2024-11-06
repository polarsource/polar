import { GetState, SetState, StoreApi } from '../vanilla';
import { NamedSet } from './devtools';
declare type Combine<T, U> = Omit<T, keyof U> & U;
export declare const combine: <PrimaryState extends object, SecondaryState extends object>(initialState: PrimaryState, create: (set: SetState<PrimaryState> & NamedSet<PrimaryState>, get: GetState<PrimaryState>, api: StoreApi<PrimaryState>) => SecondaryState) => (set: SetState<Combine<PrimaryState, SecondaryState>>, get: GetState<Combine<PrimaryState, SecondaryState>>, api: StoreApi<Combine<PrimaryState, SecondaryState>>) => Combine<PrimaryState, SecondaryState>;
export {};
