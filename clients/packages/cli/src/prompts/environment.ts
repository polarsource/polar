import { Prompt } from "effect/unstable/cli";
import type { PolarEnvironment } from "../services/oauth";

export const environmentPrompt = Prompt.select<PolarEnvironment>({
	message: "Select Environment",
	choices: [
		{ value: "sandbox", title: "Sandbox" },
		{ value: "production", title: "Production" },
	],
});
