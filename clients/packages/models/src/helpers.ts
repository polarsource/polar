import { models, type ProviderModelMapping } from "./models";
import { providers } from "./providers";

/**
 * Check if a specific model and provider combination supports streaming
 */
export function getModelStreamingSupport(
	modelName: string,
	providerId?: string,
): boolean | null {
	const modelInfo = models.find((m) => m.id === modelName);
	if (!modelInfo) {
		return null;
	}

	// If no specific provider is requested, check if any provider for this model supports streaming
	if (!providerId) {
		return modelInfo.providers.some((provider: ProviderModelMapping) => {
			// Check model-level streaming first, then fall back to provider-level
			if (provider.streaming !== undefined) {
				return provider.streaming;
			}
			// Fall back to provider-level streaming support
			const providerInfo = providers.find((p) => p.id === provider.providerId);
			return providerInfo?.streaming === true;
		});
	}

	// Check specific provider for this model
	const providerMapping = modelInfo.providers.find(
		(p) => p.providerId === providerId,
	);
	if (!providerMapping) {
		return false;
	}

	// Check model-level streaming first, then fall back to provider-level
	if (providerMapping.streaming !== undefined) {
		return providerMapping.streaming;
	}

	// Fall back to provider-level streaming support
	const providerInfo = providers.find((p) => p.id === providerId);
	return providerInfo?.streaming === true;
}