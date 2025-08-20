import { alibabaModels } from "./models/alibaba";
import { anthropicModels } from "./models/anthropic";
import { deepseekModels } from "./models/deepseek";
import { googleModels } from "./models/google";
import { customModels } from "./models/custom";
import { metaModels } from "./models/meta";
import { microsoftModels } from "./models/microsoft";
import { mistralModels } from "./models/mistral";
import { moonshotModels } from "./models/moonshot";
import { nousresearchModels } from "./models/nousresearch";
import { openaiModels } from "./models/openai";
import { perplexityModels } from "./models/perplexity";
import { xaiModels } from "./models/xai";
import { zaiModels } from "./models/zai";

import type { providers } from "./providers";

export type Provider = (typeof providers)[number]["id"];

export type Model = (typeof models)[number]["providers"][number]["modelName"];

export interface ProviderModelMapping {
	providerId: (typeof providers)[number]["id"];
	modelName: string;
	/**
	 * Price per input token in USD
	 */
	inputPrice?: number;
	/**
	 * Price per output token in USD
	 */
	outputPrice?: number;
	/**
	 * Price per cached input token in USD
	 */
	cachedInputPrice?: number;
	/**
	 * Price per image input in USD
	 */
	imageInputPrice?: number;
	/**
	 * Price per request in USD
	 */
	requestPrice?: number;
	/**
	 * Maximum context window size in tokens
	 */
	contextSize?: number;
	/**
	 * Maximum output size in tokens
	 */
	maxOutput?: number;
	/**
	 * Whether this specific model supports streaming for this provider
	 */
	streaming: boolean;
	/**
	 * Whether this specific model supports vision (image inputs) for this provider
	 */
	vision?: boolean;
	/**
	 * Whether this model supports reasoning mode
	 */
	reasoning?: boolean;
	/**
	 * Whether this specific model supports tool calling for this provider
	 */
	tools?: boolean;
	/**
	 * List of supported API parameters for this model/provider combination
	 */
	supportedParameters?: string[];
	/**
	 * Test skip/only functionality
	 */
	test?: "skip" | "only";
}

export interface ModelDefinition {
	/**
	 * Unique identifier for the model
	 */
	id: string;
	/**
	 * Human-readable display name for the model
	 */
	name?: string;
	/**
	 * Model family (e.g., 'openai', 'deepseek', 'anthropic')
	 */
	family: string;
	/**
	 * Mappings to provider models
	 */
	providers: ProviderModelMapping[];
	/**
	 * Whether the model supports JSON output mode
	 */
	jsonOutput?: boolean;
	/**
	 * Whether this model is free to use
	 */
	free?: boolean;
	/**
	 * Date when the model will be deprecated (still usable but filtered from selection algorithms)
	 */
	deprecatedAt?: Date;
	/**
	 * Date when the model will be deactivated (returns error when requested)
	 */
	deactivatedAt?: Date;
}

export const models = [
	...customModels,
	...openaiModels,
	...anthropicModels,
	...googleModels,
	...perplexityModels,
	...xaiModels,
	...metaModels,
	...deepseekModels,
	...mistralModels,
	...microsoftModels,
	...moonshotModels,
	...alibabaModels,
	...nousresearchModels,
	...zaiModels,
] as const satisfies ModelDefinition[];