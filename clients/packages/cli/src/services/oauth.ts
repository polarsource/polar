import { createHash, randomBytes } from "node:crypto";
import { createServer, type Server } from "node:http";
import os from "node:os";
import path from "node:path";
import { BunFileSystem } from "@effect/platform-bun";
import type { TokenResponse } from "@polar-sh/sdk/models/components/tokenresponse.js";
import {
	Context,
	Data,
	Effect,
	FileSystem,
	Layer,
	Path,
	Redacted,
	Schema,
} from "effect";
import open from "open";
import { Token, Tokens } from "../schemas/Tokens";
import type { KeysToSnakeCase } from "../types";

export type PolarEnvironment = "production" | "sandbox";

const SANDBOX_CLIENT_ID =
	"polar_ci_AHVAKf9SDOaffma2auRGMXR3H8jg9QBgOfW7s1hYgW9";
const PRODUCTION_CLIENT_ID = "polar_ci_gBnJ_Yv_uSGm5mtoPa2cCA";

const SANDBOX_AUTHORIZATION_URL = "https://sandbox.polar.sh/oauth2/authorize";
const PRODUCTION_AUTHORIZATION_URL = "https://polar.sh/oauth2/authorize";

const SANDBOX_TOKEN_URL = "https://sandbox-api.polar.sh/v1/oauth2/token";
const PRODUCTION_TOKEN_URL = "https://api.polar.sh/v1/oauth2/token";

const config = {
	scopes: [
		"benefits:read",
		"benefits:write",
		"checkout_links:read",
		"checkout_links:write",
		"checkouts:read",
		"checkouts:write",
		"custom_fields:read",
		"custom_fields:write",
		"customer_meters:read",
		"customer_portal:read",
		"customer_portal:write",
		"customer_seats:read",
		"customer_seats:write",
		"customer_sessions:write",
		"customers:read",
		"customers:write",
		"discounts:read",
		"discounts:write",
		"disputes:read",
		"email",
		"events:read",
		"events:write",
		"files:read",
		"files:write",
		"license_keys:read",
		"license_keys:write",
		"member_sessions:write",
		"members:read",
		"members:write",
		"meters:read",
		"meters:write",
		"metrics:read",
		"metrics:write",
		"notification_recipients:read",
		"notification_recipients:write",
		"notifications:read",
		"notifications:write",
		"openid",
		"orders:read",
		"orders:write",
		"organization_access_tokens:read",
		"organization_access_tokens:write",
		"organizations:read",
		"organizations:write",
		"payments:read",
		"payouts:read",
		"payouts:write",
		"products:read",
		"products:write",
		"profile",
		"refunds:read",
		"refunds:write",
		"subscriptions:read",
		"subscriptions:write",
		"transactions:read",
		"transactions:write",
		"user:read",
		"user:write",
		"wallets:read",
		"wallets:write",
		"webhooks:read",
		"webhooks:write",
	],
	redirectUrl: "http://127.0.0.1:3333/oauth/callback",
};

const captureAccessTokenFromHTTPServer = (server: PolarEnvironment) =>
	Effect.gen(function* () {
		const codeVerifier = yield* generateRandomString;
		const codeChallenge = yield* generateHash(codeVerifier);
		const state = yield* generateRandomString;
		const authorizationUrl = yield* buildAuthorizationUrl(
			server,
			state,
			codeChallenge,
		);

		let httpServer: Server | null = null;

		// Close the HTTP server when the effect finalizes
		yield* Effect.addFinalizer(() => {
			if (httpServer !== null) {
				httpServer.close();
				httpServer = null;
			}

			return Effect.logDebug("Temporary HTTP Server Closed");
		});

		const accessToken = yield* Effect.callback<Token, OAuthError>((resume) => {
			httpServer = createServer((request, response) => {
				if (httpServer !== null) {
					// Complete the incoming HTTP request when a login response is received
					response.write("Login completed for the console client ...");
					response.end();

					resume(
						redeemCodeForAccessToken(
							server,
							request.url ?? "",
							state,
							codeVerifier,
						),
					);
				}
			});

			httpServer?.listen(3333, "127.0.0.1", () => {
				open(authorizationUrl);
			});
		});

		return accessToken;
	});

export class OAuthError extends Data.TaggedError("OAuthError")<{
	message: string;
	cause?: unknown;
}> {}

export class OAuth extends Context.Service<OAuth, OAuthImpl>()("OAuth") {}

interface OAuthImpl {
	login: (server: PolarEnvironment) => Effect.Effect<Token, OAuthError, never>;
	logout: () => Effect.Effect<void, OAuthError, never>;
	refresh: (token: Token) => Effect.Effect<Token, OAuthError, never>;
	isAuthenticated: (
		server: PolarEnvironment,
	) => Effect.Effect<boolean, OAuthError, never>;
	getAccessToken: (
		server: PolarEnvironment,
	) => Effect.Effect<Token, OAuthError, never>;
	resolveAccessToken: (
		server: PolarEnvironment,
	) => Effect.Effect<Token, OAuthError, never>;
}

const OAuthRequirementsLayer = Layer.mergeAll(BunFileSystem.layer, Path.layer);

export const make = Effect.gen(function* () {
	const getAccessToken = (server: PolarEnvironment) =>
		Effect.gen(function* () {
			const token = yield* readTokenFile;

			if (!token || !token[server]) {
				return yield* new OAuthError({
					message: "No access token found for the selected server",
				});
			}

			return token[server];
		}).pipe(Effect.provide(OAuthRequirementsLayer));

	const login = (server: PolarEnvironment) =>
		Effect.gen(function* () {
			const token = yield* captureAccessTokenFromHTTPServer(server);
			const savedToken = yield* saveToken(token);

			return savedToken;
		}).pipe(Effect.scoped, Effect.provide(OAuthRequirementsLayer));

	const logout = () =>
		deleteTokenFile.pipe(Effect.provide(OAuthRequirementsLayer));

	const refresh = (token: Token) =>
		Effect.gen(function* () {
			const refreshedToken = yield* refreshAccessToken(token);
			return yield* saveToken(refreshedToken);
		}).pipe(Effect.provide(OAuthRequirementsLayer));

	const isAuthenticated = (server: PolarEnvironment) =>
		Effect.gen(function* () {
			const tokens = yield* readTokenFile;

			if (!tokens) {
				return false;
			}

			const serverToken = tokens[server];

			if (!serverToken) {
				return false;
			}

			const tokenExpired = serverToken.expiresAt < new Date();

			return !tokenExpired;
		}).pipe(Effect.provide(OAuthRequirementsLayer));

	const resolveAccessToken = (server: PolarEnvironment) =>
		Effect.gen(function* () {
			const authenticated = yield* isAuthenticated(server);

			if (!authenticated) {
				return yield* login(server);
			}

			return yield* getAccessToken(server);
		}).pipe(Effect.provide(OAuthRequirementsLayer));

	return OAuth.of({
		login,
		logout,
		refresh,
		isAuthenticated,
		getAccessToken,
		resolveAccessToken,
	});
});

export const layer = Layer.effect(OAuth, make);

const tokenFilePath = Effect.gen(function* () {
	const path = yield* Path.Path;
	return path.join(os.homedir(), ".polar", "tokens.json");
});

const ensureTokenFile = Effect.gen(function* () {
	const fileSystem = yield* FileSystem.FileSystem;
	const filePath = yield* tokenFilePath;

	return yield* Effect.catch(fileSystem.access(filePath), () =>
		fileSystem
			.makeDirectory(path.dirname(filePath), {
				recursive: true,
			})
			.pipe(Effect.andThen(fileSystem.writeFileString(filePath, "{}"))),
	).pipe(
		Effect.mapError(
			(error) =>
				new OAuthError({
					message: "Failed to ensure token file exists",
					cause: error,
				}),
		),
	);
});

const writeToTokenFile = (token: Token) =>
	Effect.gen(function* () {
		const fileSystem = yield* FileSystem.FileSystem;
		const filePath = yield* tokenFilePath;

		yield* Effect.logDebug("Writing token to file...");

		const currentTokens = yield* readTokenFile;

		const mergedTokens = Tokens.make({
			...currentTokens,
			[token.server]: token,
		});

		return yield* ensureTokenFile.pipe(
			Effect.andThen(() =>
				Schema.encodeEffect(Tokens)(mergedTokens).pipe(
					Effect.map((encoded) =>
						new TextEncoder().encode(JSON.stringify(encoded)),
					),
					Effect.andThen((encoded) => fileSystem.writeFile(filePath, encoded)),
				),
			),
			Effect.mapError(
				(error) =>
					new OAuthError({
						message: "Failed to write token to file",
						cause: error,
					}),
			),
		);
	});

const readTokenFile = Effect.gen(function* () {
	const fileSystem = yield* FileSystem.FileSystem;
	const filePath = yield* tokenFilePath;

	yield* Effect.logDebug("Reading token file...");

	return yield* ensureTokenFile.pipe(
		Effect.flatMap(() => fileSystem.readFileString(filePath)),
		Effect.flatMap(Schema.decodeEffect(Schema.fromJsonString(Tokens))),
		Effect.mapError(
			(error) =>
				new OAuthError({
					message: "Failed to read token file",
					cause: error,
				}),
		),
	);
});

const saveToken = (token: Token) =>
	Effect.gen(function* () {
		yield* Effect.logDebug("Saving token to file...");

		return yield* writeToTokenFile(token).pipe(Effect.map(() => token));
	});

const deleteTokenFile = Effect.gen(function* () {
	const fileSystem = yield* FileSystem.FileSystem;
	const filePath = yield* tokenFilePath;

	yield* Effect.logDebug("Deleting token file...");

	return yield* fileSystem
		.remove(filePath)
		.pipe(Effect.catch(() => Effect.void));
});

const generateRandomString = Effect.sync(() => randomBytes(48).toString("hex"));

const generateHash = (value: string) =>
	Effect.sync(() => {
		const hash = createHash("sha256").update(value).digest("base64");
		return hash.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
	});

const getClientCredentials = (server: PolarEnvironment) =>
	server === "production"
		? {
				clientId: PRODUCTION_CLIENT_ID,
			}
		: { clientId: SANDBOX_CLIENT_ID };

const buildAuthorizationUrl = (
	mode: PolarEnvironment,
	state: string,
	codeChallenge: string,
) =>
	Effect.sync(() => {
		const baseUrl =
			mode === "production"
				? PRODUCTION_AUTHORIZATION_URL
				: SANDBOX_AUTHORIZATION_URL;
		const { clientId } = getClientCredentials(mode);

		const params = new URLSearchParams({
			client_id: clientId,
			redirect_uri: config.redirectUrl,
			response_type: "code",
			scope: config.scopes.join(" "),
			state,
			code_challenge: codeChallenge,
			code_challenge_method: "S256",
			sub_type: "user",
		});

		const url = `${baseUrl}?${params.toString()}`;

		return url;
	});

const getLoginResult = (
	responseUrl: string,
): Effect.Effect<[string, string], OAuthError, never> =>
	Effect.gen(function* () {
		const url = new URL(responseUrl, config.redirectUrl);
		const code = url.searchParams.get("code");
		const state = url.searchParams.get("state");

		if (!code || !state) {
			return yield* new OAuthError({
				message: "Authorization code or state is missing in the response URL",
			});
		}

		return [code, state];
	});

const refreshAccessToken = (token: Token) =>
	Effect.gen(function* () {
		const refreshToken = token.refreshToken;

		if (!refreshToken) {
			return yield* new OAuthError({
				message: "No refresh token found",
			});
		}
		const { clientId } = getClientCredentials(token.server);
		const params = new URLSearchParams({
			grant_type: "refresh_token",
			client_id: clientId,
			refresh_token: Redacted.value(refreshToken),
			scope: config.scopes.join(" "),
		});

		const response = yield* Effect.tryPromise({
			try: () =>
				fetch(
					token.server === "production"
						? PRODUCTION_TOKEN_URL
						: SANDBOX_TOKEN_URL,
					{
						method: "POST",
						headers: {
							"Content-Type": "application/x-www-form-urlencoded",
						},
						body: params.toString(),
					},
				),
			catch: (error) =>
				new OAuthError({
					message: "Failed to refresh access token",
					cause: error,
				}),
		});

		if (response.status >= 400) {
			const details = yield* Effect.tryPromise({
				try: () => response.text(),
				catch: (error) =>
					new OAuthError({
						message: "Failed to get response text",
						cause: error,
					}),
			});

			return yield* new OAuthError({
				message: `Problem encountered refreshing the access token: ${response.status}, ${details}`,
			});
		}

		const data = yield* Effect.tryPromise({
			try: () => response.json() as Promise<KeysToSnakeCase<TokenResponse>>,
			catch: (error) =>
				new OAuthError({
					message: "Failed to redeem code for access token",
					cause: error,
				}),
		});

		return yield* Schema.decodeUnknownEffect(Token)({
			token: data.access_token,
			refreshToken: data.refresh_token,
			expiresIn: data.expires_in,
			expiresAt: new Date(Date.now() + data.expires_in).toISOString(),
			scope: data.scope.split(" "),
			server: token.server,
		}).pipe(
			Effect.catchTag("SchemaError", (error) =>
				Effect.fail(
					new OAuthError({
						message: "Failed to parse token response into a Token Schema",
						cause: error,
					}),
				),
			),
		);
	});

const redeemCodeForAccessToken = (
	server: PolarEnvironment,
	responseUrl: string,
	requestState: string,
	codeVerifier: string,
) =>
	Effect.gen(function* () {
		const [code, responseState] = yield* getLoginResult(responseUrl);

		if (responseState !== requestState) {
			throw new Error("An invalid authorization response state was received");
		}

		const { clientId } = getClientCredentials(server);
		const params = new URLSearchParams({
			grant_type: "authorization_code",
			client_id: clientId,
			redirect_uri: config.redirectUrl,
			code,
			code_verifier: codeVerifier,
		});

		const response = yield* Effect.tryPromise({
			try: () =>
				fetch(
					server === "production" ? PRODUCTION_TOKEN_URL : SANDBOX_TOKEN_URL,
					{
						method: "POST",
						headers: {
							"Content-Type": "application/x-www-form-urlencoded",
						},
						body: params.toString(),
					},
				),
			catch: (error) =>
				new OAuthError({
					message: "Failed to redeem code for access token",
					cause: error,
				}),
		});

		if (response.status >= 400) {
			const details = yield* Effect.tryPromise({
				try: () => response.text(),
				catch: (error) =>
					new OAuthError({
						message: "Failed to get response text",
						cause: error,
					}),
			});

			return yield* new OAuthError({
				message: `Problem encountered redeeming the code for tokens: ${response.status}, ${details}`,
			});
		}

		const data = yield* Effect.tryPromise({
			try: () => response.json() as Promise<KeysToSnakeCase<TokenResponse>>,
			catch: (error) =>
				new OAuthError({
					message: "Failed to redeem code for access token",
					cause: error,
				}),
		});

		return yield* Schema.decodeUnknownEffect(Token)({
			token: data.access_token,
			refreshToken: data.refresh_token,
			expiresIn: data.expires_in,
			expiresAt: new Date(Date.now() + data.expires_in).toISOString(),
			scope: data.scope.split(" "),
			server,
		}).pipe(
			Effect.catchTag("SchemaError", (error) =>
				Effect.fail(
					new OAuthError({
						message: "Failed to parse token response into a Token Schema",
						cause: error,
					}),
				),
			),
		);
	});
