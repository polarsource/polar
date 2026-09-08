import { Polar as PolarSDK } from "@polar-sh/sdk";
import { Context, Data, Effect, Layer, Redacted } from "effect";
import * as OAuth from "./oauth";

export class PolarError extends Data.TaggedError("PolarError")<{
	message: string;
	cause?: unknown;
}> {}

export class Polar extends Context.Service<Polar, PolarImpl>()("Polar") {}

interface PolarImpl {
	getClient: (
		server: OAuth.PolarEnvironment,
	) => Effect.Effect<PolarSDK, PolarError, never>;
	use: <A, E>(
		fn: (client: PolarSDK) => Effect.Effect<A, E> | Promise<A>,
		server?: OAuth.PolarEnvironment,
	) => Effect.Effect<A, PolarError | E, never>;
}

const PolarRequirementsLayer = Layer.mergeAll(OAuth.layer);

export const make = Effect.gen(function* () {
	const oauth = yield* OAuth.OAuth;

	const getClient = (server: OAuth.PolarEnvironment) =>
		Effect.gen(function* () {
			const token = yield* oauth.resolveAccessToken(server);

			const client = new PolarSDK({
				server,
				accessToken: Redacted.value(token.token),
			});

			return client;
		}).pipe(
			Effect.catchTag("OAuthError", (error) =>
				Effect.fail(
					new PolarError({
						message: "Failed to get Polar SDK client",
						cause: error,
					}),
				),
			),
		);

	const use = <A, E>(
		fn: (client: PolarSDK) => Effect.Effect<A, E> | Promise<A>,
		server: OAuth.PolarEnvironment = "production",
	) =>
		Effect.gen(function* () {
			const client = yield* getClient(server);
			const result = fn(client);

			// Handle both Effect and Promise return types
			return yield* Effect.isEffect(result)
				? result
				: Effect.promise(() => result);
		});

	return Polar.of({
		getClient,
		use,
	});
});

export const layer = Layer.effect(Polar, make).pipe(
	Layer.provide(PolarRequirementsLayer),
);
