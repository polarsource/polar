import { models } from "./models";

import type { ProviderId } from "./providers";

/**
 * Get the appropriate headers for a given provider API call
 */
export function getProviderHeaders(
	provider: ProviderId,
	token: string,
): Record<string, string> {
	switch (provider) {
		case "anthropic":
			return {
				"x-api-key": token,
				"anthropic-version": "2023-06-01",
				"anthropic-beta": "tools-2024-04-04",
			};
		case "google-ai-studio":
			return {};
		case "google-vertex":
		case "openai":
		case "inference.net":
		case "xai":
		case "groq":
		case "deepseek":
		case "perplexity":
		case "novita":
		case "moonshot":
		case "alibaba":
		case "nebius":
		case "zai":
		case "custom":
		default:
			return {
				Authorization: `Bearer ${token}`,
			};
	}
}

/**
 * Prepares the request body for different providers
 */
export function prepareRequestBody(
	usedProvider: ProviderId,
	usedModel: string,
	messages: any[],
	stream: boolean,
	temperature: number | undefined,
	max_tokens: number | undefined,
	top_p: number | undefined,
	frequency_penalty: number | undefined,
	presence_penalty: number | undefined,
	response_format: any,
	tools?: any[],
	tool_choice?: string | { type: string; function: { name: string } },
	reasoning_effort?: "low" | "medium" | "high",
	supportsReasoning?: boolean,
) {
	const requestBody: any = {
		model: usedModel,
		messages,
		stream: stream,
	};

	// Add tools, tool_choice, and tool_calls if provided
	if (tools && tools.length > 0) {
		requestBody.tools = tools;
	}

	if (tool_choice) {
		requestBody.tool_choice = tool_choice;
	}

	switch (usedProvider) {
		case "openai":
		case "xai":
		case "groq":
		case "deepseek":
		case "perplexity":
		case "novita":
		case "moonshot":
		case "alibaba":
		case "nebius":
		case "zai":
		case "custom": {
			if (stream) {
				requestBody.stream_options = {
					include_usage: true,
				};
			}
			if (response_format) {
				requestBody.response_format = response_format;
			}

			// Add optional parameters if they are provided
			if (temperature !== undefined) {
				requestBody.temperature = temperature;
			}
			if (max_tokens !== undefined) {
				requestBody.max_tokens = max_tokens;
			}
			if (top_p !== undefined) {
				requestBody.top_p = top_p;
			}
			if (frequency_penalty !== undefined) {
				requestBody.frequency_penalty = frequency_penalty;
			}
			if (presence_penalty !== undefined) {
				requestBody.presence_penalty = presence_penalty;
			}
			if (reasoning_effort !== undefined) {
				requestBody.reasoning_effort = reasoning_effort;
			}
			break;
		}
		case "anthropic": {
			// Remove generic tool_choice that was added earlier
			delete requestBody.tool_choice;

			requestBody.max_tokens = max_tokens || 1024; // Set a default if not provided
			requestBody.messages = messages.map((m) => ({
				role:
					m.role === "assistant"
						? "assistant"
						: m.role === "system"
							? "user"
							: "user",
				content: Array.isArray(m.content)
					? m.content.map((i: any) => {
							switch (i.type) {
								// anthropic does not support image URLs, only base64
								// TODO fetch url and provide as base64 instead
								case "image_url":
									return {
										type: "text",
										text: `image URL: ${i.image_url.url}`,
									};
							}
							return i;
						})
					: m.content,
			}));

			// Transform tools from OpenAI format to Anthropic format
			if (tools && tools.length > 0) {
				requestBody.tools = tools.map((tool: any) => ({
					name: tool.function.name,
					description: tool.function.description,
					input_schema: tool.function.parameters,
				}));
			}

			// Handle tool_choice parameter - transform OpenAI format to Anthropic format
			if (tool_choice) {
				if (
					typeof tool_choice === "object" &&
					tool_choice.type === "function"
				) {
					// Transform OpenAI format to Anthropic format
					requestBody.tool_choice = {
						type: "tool",
						name: tool_choice.function.name,
					};
				} else if (tool_choice === "auto") {
					// "auto" is the default behavior for Anthropic, omit it
					// Anthropic doesn't need explicit "auto" tool_choice
				} else if (tool_choice === "none") {
					// "none" should work as-is
					requestBody.tool_choice = tool_choice;
				} else {
					// Other string values (though not standard)
					requestBody.tool_choice = tool_choice;
				}
			}

			// Add optional parameters if they are provided
			if (temperature !== undefined) {
				requestBody.temperature = temperature;
			}
			if (top_p !== undefined) {
				requestBody.top_p = top_p;
			}
			if (frequency_penalty !== undefined) {
				requestBody.frequency_penalty = frequency_penalty;
			}
			if (presence_penalty !== undefined) {
				requestBody.presence_penalty = presence_penalty;
			}
			break;
		}
		case "google-vertex":
		case "google-ai-studio": {
			delete requestBody.model; // Not used in body
			delete requestBody.stream; // Stream is handled via URL parameter
			delete requestBody.messages; // Not used in body for Google providers
			delete requestBody.tool_choice; // Google doesn't support tool_choice parameter

			requestBody.contents = messages.map((m) => ({
				role: m.role === "assistant" ? "model" : "user", // get rid of system role
				parts: Array.isArray(m.content)
					? m.content.map((i: any) => {
							if (i.type === "text") {
								return {
									text: i.text,
								};
							}
							throw new Error(`Not supported content type yet: ${i.type}`);
						})
					: [
							{
								text: m.content,
							},
						],
			}));

			// Transform tools from OpenAI format to Google format
			if (tools && tools.length > 0) {
				requestBody.tools = [
					{
						functionDeclarations: tools.map((tool: any) => ({
							name: tool.function.name,
							description: tool.function.description,
							parameters: tool.function.parameters,
						})),
					},
				];
			}

			requestBody.generationConfig = {};

			// Add optional parameters if they are provided
			if (temperature !== undefined) {
				requestBody.generationConfig.temperature = temperature;
			}
			if (max_tokens !== undefined) {
				requestBody.generationConfig.maxOutputTokens = max_tokens;
			}
			if (top_p !== undefined) {
				requestBody.generationConfig.topP = top_p;
			}

			// Enable thinking/reasoning content exposure for Google models that support reasoning
			if (supportsReasoning) {
				requestBody.generationConfig.thinkingConfig = {
					includeThoughts: true,
				};
			}

			break;
		}
		case "inference.net":
		case "together.ai": {
			if (usedModel.startsWith(`${usedProvider}/`)) {
				requestBody.model = usedModel.substring(usedProvider.length + 1);
			}

			// Add optional parameters if they are provided
			if (temperature !== undefined) {
				requestBody.temperature = temperature;
			}
			if (max_tokens !== undefined) {
				requestBody.max_tokens = max_tokens;
			}
			if (top_p !== undefined) {
				requestBody.top_p = top_p;
			}
			if (frequency_penalty !== undefined) {
				requestBody.frequency_penalty = frequency_penalty;
			}
			if (presence_penalty !== undefined) {
				requestBody.presence_penalty = presence_penalty;
			}
			break;
		}
	}

	return requestBody;
}

/**
 * Get the endpoint URL for a provider API call
 */
export function getProviderEndpoint(
	provider: ProviderId,
	baseUrl?: string,
	model?: string,
	token?: string,
	stream?: boolean,
): string {
	let modelName = model;
	if (model && model !== "custom") {
		const modelInfo = models.find((m) => m.id === model);
		if (modelInfo) {
			const providerMapping = modelInfo.providers.find(
				(p) => p.providerId === provider,
			);
			if (providerMapping) {
				modelName = providerMapping.modelName;
			}
		}
	}
	let url: string;

	if (baseUrl) {
		url = baseUrl;
	} else {
		switch (provider) {
			case "llmgateway":
				if (model === "custom" || model === "auto") {
					// For custom model, use a default URL for testing
					url = "https://api.openai.com";
				} else {
					throw new Error(`Provider ${provider} requires a baseUrl`);
				}
				break;
			case "openai":
				url = "https://api.openai.com";
				break;
			case "anthropic":
				url = "https://api.anthropic.com";
				break;
			case "google-vertex":
			case "google-ai-studio":
				url = "https://generativelanguage.googleapis.com";
				break;
			case "inference.net":
				url = "https://api.inference.net";
				break;
			case "together.ai":
				url = "https://api.together.ai";
				break;
			case "cloudrift":
				url = "https://inference.cloudrift.ai";
				break;
			case "mistral":
				url = "https://api.mistral.ai";
				break;
			case "xai":
				url = "https://api.x.ai";
				break;
			case "groq":
				url = "https://api.groq.com/openai";
				break;
			case "deepseek":
				url = "https://api.deepseek.com";
				break;
			case "perplexity":
				url = "https://api.perplexity.ai";
				break;
			case "novita":
				url = "https://api.novita.ai/v3/openai";
				break;
			case "moonshot":
				url = "https://api.moonshot.ai";
				break;
			case "alibaba":
				url = "https://dashscope-intl.aliyuncs.com/compatible-mode";
				break;
			case "nebius":
				url = "https://api.studio.nebius.com";
				break;
			case "zai":
				url = "https://api.z.ai";
				break;
			case "custom":
				if (!baseUrl) {
					throw new Error(`Custom provider requires a baseUrl`);
				}
				url = baseUrl;
				break;
			default:
				throw new Error(`Provider ${provider} requires a baseUrl`);
		}
	}

	switch (provider) {
		case "anthropic":
			return `${url}/v1/messages`;
		case "google-vertex": {
			if (modelName) {
				const endpoint = stream ? "streamGenerateContent" : "generateContent";
				const baseEndpoint = `${url}/v1beta/models/${modelName}:${endpoint}`;
				return stream ? `${baseEndpoint}?alt=sse` : baseEndpoint;
			}
			const endpoint = stream ? "streamGenerateContent" : "generateContent";
			const baseEndpoint = `${url}/v1beta/models/gemini-2.0-flash:${endpoint}`;
			return stream ? `${baseEndpoint}?alt=sse` : baseEndpoint;
		}
		case "google-ai-studio": {
			const endpoint = stream ? "streamGenerateContent" : "generateContent";
			const baseEndpoint = modelName
				? `${url}/v1beta/models/${modelName}:${endpoint}`
				: `${url}/v1beta/models/gemini-2.0-flash:${endpoint}`;
			const queryParams = [];
			if (token) {
				queryParams.push(`key=${token}`);
			}
			if (stream) {
				queryParams.push("alt=sse");
			}
			return queryParams.length > 0
				? `${baseEndpoint}?${queryParams.join("&")}`
				: baseEndpoint;
		}
		case "perplexity":
			return `${url}/chat/completions`;
		case "novita":
			return `${url}/chat/completions`;
		case "zai":
			return `${url}/api/paas/v4/chat/completions`;
		case "inference.net":
		case "openai":
		case "llmgateway":
		case "cloudrift":
		case "xai":
		case "groq":
		case "deepseek":
		case "moonshot":
		case "alibaba":
		case "nebius":
		case "custom":
		default:
			return `${url}/v1/chat/completions`;
	}
}

/**
 * Get the cheapest model for a given provider based on input + output pricing
 */
export function getCheapestModelForProvider(
	provider: ProviderId,
): string | null {
	const availableModels = models
		.filter((model) => model.providers.some((p) => p.providerId === provider))
		.filter((model) => !model.deprecatedAt || new Date() <= model.deprecatedAt)
		.map((model) => ({
			model: model.id,
			provider: model.providers.find((p) => p.providerId === provider)!,
		}))
		.filter(
			({ provider: providerInfo }) =>
				providerInfo.inputPrice !== undefined &&
				providerInfo.outputPrice !== undefined,
		);

	if (availableModels.length === 0) {
		return null;
	}

	let cheapestModel = availableModels[0].provider.modelName;
	let lowestPrice = Number.MAX_VALUE;

	for (const { provider: providerInfo } of availableModels) {
		const totalPrice =
			(providerInfo.inputPrice! + providerInfo.outputPrice!) / 2;
		if (totalPrice < lowestPrice) {
			lowestPrice = totalPrice;
			cheapestModel = providerInfo.modelName;
		}
	}

	return cheapestModel;
}

/**
 * Get the cheapest provider and model from a list of available model providers
 */
export function getCheapestFromAvailableProviders<
	T extends { providerId: string; modelName: string },
>(availableModelProviders: T[], modelWithPricing: any): T | null {
	if (availableModelProviders.length === 0) {
		return null;
	}

	let cheapestProvider = availableModelProviders[0];
	let lowestPrice = Number.MAX_VALUE;

	for (const provider of availableModelProviders) {
		const providerInfo = modelWithPricing.providers.find(
			(p: any) => p.providerId === provider.providerId,
		);
		const totalPrice =
			((providerInfo?.inputPrice || 0) + (providerInfo?.outputPrice || 0)) / 2;

		if (totalPrice < lowestPrice) {
			lowestPrice = totalPrice;
			cheapestProvider = provider;
		}
	}

	return cheapestProvider;
}

/**
 * Validate a provider API key by making a minimal request
 */
export async function validateProviderKey(
	provider: ProviderId,
	token: string,
	baseUrl?: string,
	skipValidation = false,
): Promise<{ valid: boolean; error?: string; statusCode?: number }> {
	// Skip validation if requested (e.g. in test environment)
	if (skipValidation) {
		return { valid: true };
	}

	// Skip validation for custom providers since they don't have predefined models
	if (provider === "custom") {
		return { valid: true };
	}

	try {
		const endpoint = getProviderEndpoint(
			provider,
			baseUrl,
			undefined,
			provider === "google-ai-studio" ? token : undefined,
			false, // validation doesn't need streaming
		);

		// Use prepareRequestBody to create the validation payload
		const systemMessage = {
			role: "system",
			content: "You are a helpful assistant.",
		};
		const minimalMessage = { role: "user", content: "Hello" };
		const messages = [systemMessage, minimalMessage];

		const validationModel = getCheapestModelForProvider(provider);

		console.log("using validationModel", provider, validationModel);

		if (!validationModel) {
			throw new Error(
				`No model with pricing information found for provider ${provider}`,
			);
		}

		// Find the model definition and check if max_tokens is supported
		const modelDef = models.find((m) =>
			m.providers.some(
				(p) => p.providerId === provider && p.modelName === validationModel,
			),
		);
		const providerMapping = modelDef?.providers.find(
			(p) => p.providerId === provider && p.modelName === validationModel,
		);
		const supportedParameters = (providerMapping as any)
			?.supportedParameters as string[] | undefined;
		const supportsMaxTokens =
			supportedParameters?.includes("max_tokens") ?? true;

		const payload = prepareRequestBody(
			provider,
			validationModel,
			messages,
			false, // stream
			undefined, // temperature
			supportsMaxTokens ? 1 : undefined, // max_tokens - minimal for validation, undefined if not supported
			undefined, // top_p
			undefined, // frequency_penalty
			undefined, // presence_penalty
			undefined, // response_format
			undefined, // tools
			undefined, // tool_choice
			undefined, // reasoning_effort
			false, // supportsReasoning - disable for validation
		);

		const headers = getProviderHeaders(provider, token);
		headers["Content-Type"] = "application/json";

		const response = await fetch(endpoint, {
			method: "POST",
			headers,
			body: JSON.stringify(payload),
		});

		if (!response.ok) {
			const errorText = await response.text();
			let errorMessage = `Error from provider: ${response.status} ${response.statusText}`;

			try {
				const errorJson = JSON.parse(errorText);
				if (errorJson.error?.message) {
					errorMessage = errorJson.error.message;
				} else if (errorJson.message) {
					errorMessage = errorJson.message;
				}
			} catch (_err) {}

			if (response.status === 401) {
				return {
					valid: false,
					statusCode: response.status,
				};
			}

			return { valid: false, error: errorMessage, statusCode: response.status };
		}

		return { valid: true };
	} catch (error) {
		return {
			valid: false,
			error: error instanceof Error ? error.message : "Unknown error occurred",
		};
	}
}