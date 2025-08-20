export interface ProviderDefinition {
	id: string;
	name: string;
	description: string;
	// Whether the provider supports streaming
	streaming?: boolean;
	// Whether the provider supports request cancellation
	cancellation?: boolean;
	// Whether the provider supports JSON output mode
	jsonOutput?: boolean;
	// Color used for UI representation (hex code)
	color?: string;
	// Website URL
	website?: string | null;
	// Announcement text
	announcement?: string | null;
}

export const providers = [
	{
		id: "llmgateway",
		name: "LLM Gateway",
		description:
			"LLMGateway is a framework for building and deploying large language models.",
		streaming: true,
		cancellation: true,
		jsonOutput: true,
		color: "#6366f1",
		website: "https://llmgateway.io",
		announcement: null,
	},
	{
		id: "openai",
		name: "OpenAI",
		description:
			"OpenAI is an AI research and deployment company. Our mission is to ensure that artificial general intelligence benefits all of humanity.",
		streaming: true,
		cancellation: true,
		jsonOutput: true,
		color: "#0ea5e9",
		website: "https://openai.com",
		announcement: null,
	},
	{
		id: "anthropic",
		name: "Anthropic",
		description:
			"Anthropic is a research and deployment company focused on building safe and useful AI.",
		streaming: true,
		cancellation: true,
		color: "#8b5cf6",
		website: "https://anthropic.com",
		announcement: null,
	},
	{
		id: "google-vertex",
		name: "Google Vertex AI",
		description:
			"Google Vertex AI is a platform for building and deploying large language models.",
		streaming: true,
		cancellation: true,
		color: "#d95656",
		website: "https://cloud.google.com/vertex-ai",
		announcement: null,
	},
	{
		id: "google-ai-studio",
		name: "Google AI Studio",
		description:
			"Google AI Studio is a platform for accessing Google's Gemini models.",
		streaming: true,
		cancellation: true,
		color: "#4285f4",
		website: "https://ai.google.com",
		announcement: null,
	},
	{
		id: "inference.net",
		name: "Inference.net",
		description:
			"Inference.net is a platform for running large language models in the cloud.",
		streaming: true,
		cancellation: true,
		color: "#10b981",
		website: "https://inference.net",
		announcement: null,
	},
	{
		id: "together.ai",
		name: "Together AI",
		description:
			"Together AI is a platform for running large language models in the cloud with fast inference.",
		streaming: true,
		cancellation: true,
		jsonOutput: true,
		color: "#ff6b35",
		website: "https://together.ai",
		announcement: null,
	},
	{
		id: "cloudrift",
		name: "CloudRift",
		description:
			"CloudRift is a platform for running large language models in the cloud with fast inference.",
		streaming: true,
		cancellation: true,
		color: "#00d4aa",
		website: "https://www.cloudrift.ai",
		announcement: "DeepSeek & Kimi K2 are 30-50% cheaper than the competition!",
	},
	{
		id: "mistral",
		name: "Mistral AI",
		description: "Mistral AI's large language models",
		streaming: true,
		cancellation: true,
		jsonOutput: true,
		color: "#FF7000",
		website: "https://mistral.ai",
		announcement: null,
	},
	{
		id: "moonshot",
		name: "Moonshot AI",
		description: "Moonshot AI's OpenAI-compatible large language models",
		streaming: true,
		cancellation: true,
		jsonOutput: true,
		color: "#4B9EFF",
		website: "https://moonshot.ai",
		announcement: null,
	},
	{
		id: "novita",
		name: "NovitaAI",
		description: "NovitaAI's OpenAI-compatible large language models",
		streaming: true,
		cancellation: true,
		jsonOutput: true,
		color: "#9333ea",
		website: "https://novita.ai",
		announcement: null,
	},
	{
		id: "xai",
		name: "xAI",
		description: "xAI's Grok large language models",
		streaming: true,
		cancellation: true,
		jsonOutput: true,
		color: "#000000",
		website: "https://x.ai",
		announcement: null,
	},
	{
		id: "groq",
		name: "Groq",
		description: "Groq's ultra-fast LPU inference with various models",
		streaming: true,
		cancellation: true,
		jsonOutput: true,
		color: "#F55036",
		website: "https://groq.com",
		announcement: null,
	},
	{
		id: "deepseek",
		name: "DeepSeek",
		description:
			"DeepSeek's high-performance language models with OpenAI-compatible API",
		streaming: true,
		cancellation: true,
		jsonOutput: true,
		color: "#FF6B00",
		website: "https://deepseek.com",
		announcement: null,
	},
	{
		id: "perplexity",
		name: "Perplexity",
		description:
			"Perplexity's AI models for search and conversation with real-time web access",
		streaming: true,
		cancellation: true,
		jsonOutput: false,
		color: "#20B2AA",
		website: "https://perplexity.ai",
		announcement: null,
	},
	{
		id: "alibaba",
		name: "Alibaba Cloud",
		description:
			"Alibaba Cloud's Qwen large language models with OpenAI-compatible API",
		streaming: true,
		cancellation: true,
		jsonOutput: true,
		color: "#FF6A00",
		website: "https://www.alibabacloud.com",
		announcement: null,
	},
	{
		id: "nebius",
		name: "Nebius AI",
		description:
			"Nebius AI Studio - OpenAI-compatible API for large language models",
		streaming: true,
		cancellation: true,
		jsonOutput: true,
		color: "#3b82f6",
		website: "https://nebius.com",
		announcement: null,
	},
	{
		id: "zai",
		name: "Z AI",
		description: "Z AI's OpenAI-compatible large language models",
		streaming: true,
		cancellation: true,
		jsonOutput: true,
		color: "#22c55e",
		website: "https://z.ai",
		announcement: null,
	},
	{
		id: "custom",
		name: "Custom",
		description: "Custom OpenAI-compatible provider with configurable base URL",
		streaming: true,
		cancellation: true,
		jsonOutput: true,
		color: "#6b7280",
		website: null,
		announcement: null,
	},
] as const satisfies ProviderDefinition[];

export type ProviderId = (typeof providers)[number]["id"];