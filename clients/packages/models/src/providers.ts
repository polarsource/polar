export interface ProviderDefinition {
	id: string;
	name: string;
	description: string;
	streaming?: boolean;
	cancellation?: boolean;
	jsonOutput?: boolean;
	website?: string | null;
}

export const providers = [
	{
		id: "openai",
		name: "OpenAI",
		description:
			"OpenAI is an AI research and deployment company. Our mission is to ensure that artificial general intelligence benefits all of humanity.",
		streaming: true,
		cancellation: true,
		jsonOutput: true,
		website: "https://openai.com",
	},
	{
		id: "anthropic",
		name: "Anthropic",
		description:
			"Anthropic is a research and deployment company focused on building safe and useful AI.",
		streaming: true,
		cancellation: true,
		website: "https://anthropic.com",
	},
	{
		id: "google-vertex",
		name: "Google Vertex AI",
		description:
			"Google Vertex AI is a platform for building and deploying large language models.",
		streaming: true,
		cancellation: true,
		website: "https://cloud.google.com/vertex-ai",
	},
	{
		id: "google-ai-studio",
		name: "Google AI Studio",
		description:
			"Google AI Studio is a platform for accessing Google's Gemini models.",
		streaming: true,
		cancellation: true,
		website: "https://ai.google.com",
	},
	{
		id: "inference.net",
		name: "Inference.net",
		description:
			"Inference.net is a platform for running large language models in the cloud.",
		streaming: true,
		cancellation: true,
		website: "https://inference.net",
	},
	{
		id: "together.ai",
		name: "Together AI",
		description:
			"Together AI is a platform for running large language models in the cloud with fast inference.",
		streaming: true,
		cancellation: true,
		jsonOutput: true,
		website: "https://together.ai",
	},
	{
		id: "cloudrift",
		name: "CloudRift",
		description:
			"CloudRift is a platform for running large language models in the cloud with fast inference.",
		streaming: true,
		cancellation: true,
		website: "https://www.cloudrift.ai",
	},
	{
		id: "mistral",
		name: "Mistral AI",
		description: "Mistral AI's large language models",
		streaming: true,
		cancellation: true,
		jsonOutput: true,
		website: "https://mistral.ai",
	},
	{
		id: "moonshot",
		name: "Moonshot AI",
		description: "Moonshot AI's OpenAI-compatible large language models",
		streaming: true,
		cancellation: true,
		jsonOutput: true,
		website: "https://moonshot.ai",
	},
	{
		id: "novita",
		name: "NovitaAI",
		description: "NovitaAI's OpenAI-compatible large language models",
		streaming: true,
		cancellation: true,
		jsonOutput: true,
		website: "https://novita.ai",
	},
	{
		id: "xai",
		name: "xAI",
		description: "xAI's Grok large language models",
		streaming: true,
		cancellation: true,
		jsonOutput: true,
		website: "https://x.ai",
	},
	{
		id: "groq",
		name: "Groq",
		description: "Groq's ultra-fast LPU inference with various models",
		streaming: true,
		cancellation: true,
		jsonOutput: true,
		website: "https://groq.com",
	},
	{
		id: "deepseek",
		name: "DeepSeek",
		description:
			"DeepSeek's high-performance language models with OpenAI-compatible API",
		streaming: true,
		cancellation: true,
		jsonOutput: true,
		website: "https://deepseek.com",
	},
	{
		id: "perplexity",
		name: "Perplexity",
		description:
			"Perplexity's AI models for search and conversation with real-time web access",
		streaming: true,
		cancellation: true,
		jsonOutput: false,
		website: "https://perplexity.ai",
	},
	{
		id: "alibaba",
		name: "Alibaba Cloud",
		description:
			"Alibaba Cloud's Qwen large language models with OpenAI-compatible API",
		streaming: true,
		cancellation: true,
		jsonOutput: true,
		website: "https://www.alibabacloud.com",
	},
	{
		id: "nebius",
		name: "Nebius AI",
		description:
			"Nebius AI Studio - OpenAI-compatible API for large language models",
		streaming: true,
		cancellation: true,
		jsonOutput: true,
		website: "https://nebius.com",
	},
	{
		id: "zai",
		name: "Z AI",
		description: "Z AI's OpenAI-compatible large language models",
		streaming: true,
		cancellation: true,
		jsonOutput: true,
		website: "https://z.ai",
	},
	{
		id: "custom",
		name: "Custom",
		description: "Custom OpenAI-compatible provider with configurable base URL",
		streaming: true,
		cancellation: true,
		jsonOutput: true,
		website: null,
	},
] as const satisfies ProviderDefinition[];

export type ProviderId = (typeof providers)[number]["id"];