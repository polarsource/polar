declare type Tuple<T = any> = [T] | T[];
declare type Await<T> = T extends Promise<infer V> ? V : never;
declare type Config = {
    lifespan?: number;
    equal?: (a: any, b: any) => boolean;
};
declare const suspend: <Keys extends Tuple<unknown>, Fn extends (...keys: Keys) => Promise<unknown>>(fn: Promise<unknown> | Fn, keys?: Keys | undefined, config?: Config | undefined) => Await<ReturnType<Fn>>;
declare const preload: <Keys extends Tuple<unknown>, Fn extends (...keys: Keys) => Promise<unknown>>(fn: Promise<unknown> | Fn, keys?: Keys | undefined, config?: Config | undefined) => undefined;
declare const peek: <Keys extends Tuple<unknown>>(keys: Keys) => unknown;
declare const clear: <Keys extends Tuple<unknown>>(keys?: Keys | undefined) => void;
export { suspend, clear, preload, peek };
