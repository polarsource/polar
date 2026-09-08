export type CamelCase<S extends string> =
	S extends `${infer P1}_${infer P2}${infer P3}`
		? `${Lowercase<P1>}${Uppercase<P2>}${CamelCase<P3>}`
		: Lowercase<S>;

export type KeysToCamelCase<T> = {
	[K in keyof T as CamelCase<string & K>]: T[K];
};

export type CamelToSnakeCase<S extends string> =
	S extends `${infer T}${infer U}`
		? `${T extends Capitalize<T>
				? "_"
				: ""}${Lowercase<T>}${CamelToSnakeCase<U>}`
		: S;

export type KeysToSnakeCase<T> = {
	[K in keyof T as CamelToSnakeCase<string & K>]: T[K];
};
