import { Console, Effect } from "effect";
import { Command } from "effect/unstable/cli";
import { environmentPrompt } from "../prompts/environment";
import * as OAuth from "../services/oauth";

export const login = Command.make("login", {}, () =>
	Effect.gen(function* () {
		const environment = yield* environmentPrompt;
		const oauth = yield* OAuth.OAuth;
		yield* oauth.login(environment);
		yield* Console.log(`Successfully logged into Polar ${environment}`);
	}),
);
