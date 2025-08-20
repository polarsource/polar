import type { ModelDefinition } from "../models";

export const microsoftModels = [
	{
		id: "phi-4",
		name: "Phi 4",
		family: "microsoft",
		deprecatedAt: undefined,
		deactivatedAt: undefined,
		providers: [
			{
				providerId: "nebius",
				modelName: "microsoft/phi-4",
				inputPrice: 0.1 / 1e6,
				outputPrice: 0.3 / 1e6,
				requestPrice: 0,
				contextSize: 16384,
				maxOutput: undefined,
				streaming: true,
				vision: false,
				tools: false,
			},
		],
		jsonOutput: true,
	},
] as const satisfies ModelDefinition[];