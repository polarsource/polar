import {
	type WebhooksConfig,
	handleWebhookPayload,
} from "@polar-sh/adapter-utils";
import {
	WebhookVerificationError,
	validateEvent,
} from "@polar-sh/sdk/webhooks";
// @ts-expect-error - TODO: fix this
import type { StartAPIMethodCallback } from "@tanstack/react-start/api";

export {
	EntitlementStrategy,
	Entitlements,
	type EntitlementContext,
	type EntitlementHandler,
	type EntitlementProperties,
} from "@polar-sh/adapter-utils";

export const Webhooks = <TPath extends string = string>({
	webhookSecret,
	entitlements,
	onPayload,
	...eventHandlers
}: WebhooksConfig): StartAPIMethodCallback<TPath> => {
	// @ts-expect-error - TODO: fix this
	return async ({ request }) => {
		const requestBody = await request.text();

		const webhookHeaders = {
			"webhook-id": request.headers.get("webhook-id") ?? "",
			"webhook-timestamp": request.headers.get("webhook-timestamp") ?? "",
			"webhook-signature": request.headers.get("webhook-signature") ?? "",
		};

		let webhookPayload: ReturnType<typeof validateEvent>;
		try {
			webhookPayload = validateEvent(
				requestBody,
				webhookHeaders,
				webhookSecret,
			);
		} catch (error) {
			if (error instanceof WebhookVerificationError) {
				return Response.json({ received: false }, { status: 403 });
			}

			throw error;
		}

		await handleWebhookPayload(webhookPayload, {
			webhookSecret,
			entitlements,
			onPayload,
			...eventHandlers,
		});

		return Response.json({ received: true });
	};
};
