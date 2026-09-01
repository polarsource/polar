import {
	addServerImportsDir,
	createResolver,
	defineNuxtModule,
} from "@nuxt/kit";

// Module options TypeScript interface definition
export type ModuleOptions = Record<string, unknown>;

export default defineNuxtModule<ModuleOptions>({
	meta: {
		name: "@polar-sh/nuxt",
		configKey: "polar",
	},
	// Default configuration options of the Nuxt module
	defaults: {},
	setup(_options, _nuxt) {
		const resolver = createResolver(import.meta.url);

		addServerImportsDir(resolver.resolve("./runtime/server"));
	},
});
