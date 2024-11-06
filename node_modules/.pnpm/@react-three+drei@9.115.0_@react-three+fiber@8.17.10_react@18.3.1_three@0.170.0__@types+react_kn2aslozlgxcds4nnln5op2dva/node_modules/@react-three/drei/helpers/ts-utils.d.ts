import { ForwardRefExoticComponent, PropsWithoutRef, RefAttributes } from 'react';
export type NamedArrayTuple<T extends (...args: any) => any> = Parameters<T>;
export type ForwardRefComponent<P, T> = ForwardRefExoticComponent<PropsWithoutRef<P> & RefAttributes<T>>;
