import type { BetterAuthClientPlugin } from "better-auth";
import { describe, expect, it } from "vitest";
import { polarClient } from "../client";

describe("polarClient", () => {
	it("should create a client plugin with correct id", () => {
		const plugin = polarClient();

		expect(plugin.id).toBe("polar-client");
	});

	it("should satisfy BetterAuthClientPlugin interface", () => {
		const plugin = polarClient();

		// Check that it has the required properties for BetterAuthClientPlugin
		expect(plugin).toHaveProperty("id");
		expect(plugin).toHaveProperty("$InferServerPlugin");
		expect(typeof plugin.id).toBe("string");
		expect(typeof plugin.$InferServerPlugin).toBe("object");
	});

	it("should have consistent plugin id across multiple calls", () => {
		const plugin1 = polarClient();
		const plugin2 = polarClient();

		expect(plugin1.id).toBe(plugin2.id);
		expect(plugin1.id).toBe("polar-client");
	});

	it("should be a function that returns a plugin object", () => {
		expect(typeof polarClient).toBe("function");

		const plugin = polarClient();
		expect(typeof plugin).toBe("object");
		expect(plugin).not.toBe(null);
	});

	it("should have proper type inference marker", () => {
		const plugin = polarClient();

		// The $InferServerPlugin should be an empty object used for type inference
		expect(plugin.$InferServerPlugin).toEqual({});
	});

	it("should conform to BetterAuthClientPlugin type structure", () => {
		const plugin = polarClient();

		// Type assertion to ensure it matches the expected interface
		const clientPlugin: BetterAuthClientPlugin = plugin;

		expect(clientPlugin.id).toBe("polar-client");
		expect(clientPlugin).toHaveProperty("$InferServerPlugin");
	});
});
