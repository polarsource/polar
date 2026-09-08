import { Schema } from "effect";

export const TokenScope = Schema.Array(Schema.String);

export const Token = Schema.Struct({
	token: Schema.RedactedFromValue(Schema.String),
	refreshToken: Schema.RedactedFromValue(Schema.String),
	expiresIn: Schema.DurationFromMillis,
	expiresAt: Schema.DateFromString,
	scope: TokenScope,
	server: Schema.Literals(["production", "sandbox"]),
});
export type Token = typeof Token.Type;
export type TokenJSON = typeof Token.Encoded;

export const Tokens = Schema.Struct({
	production: Schema.optional(Token),
	sandbox: Schema.optional(Token),
});
export type Tokens = typeof Tokens.Type;
export type TokensJSON = typeof Tokens.Encoded;
