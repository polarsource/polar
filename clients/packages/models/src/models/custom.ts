import type { ModelDefinition } from "../models";

export const customModels = [
	{
		id: "custom", // custom provider which expects base URL to be set
		name: "Custom Model",
		family: "llmgateway",
		deprecatedAt: undefined,
		deactivatedAt: undefined,
		providers: [
			{
				providerId: "llmgateway",
				modelName: "custom",
				inputPrice: undefined,
				outputPrice: undefined,
				requestPrice: undefined,
				contextSize: undefined,
				streaming: true,
				vision: true,
				tools: true,
			},
		],
		jsonOutput: true,
	}
] as const satisfies ModelDefinition[];