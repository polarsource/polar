import {
	type WebhooksConfig,
	handleWebhookPayload,
} from "@polar-sh/adapter-utils";
import {
	WebhookVerificationError,
	validateEvent,
} from "@polar-sh/sdk/webhooks";
import { type NextRequest, NextResponse } from "next/server";

export {
	type EntitlementContext,
	type EntitlementHandler,
	type EntitlementProperties,
	EntitlementStrategy,
	Entitlements,
} from "@polar-sh/adapter-utils";

export const Webhooks = ({
	webhookSecret,
	entitlements,
	onPayload,
	...eventHandlers
}: WebhooksConfig) => {
	return async (request: NextRequest) => {
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
				return NextResponse.json({ received: false }, { status: 403 });
			}

			throw error;
		}

		await handleWebhookPayload(webhookPayload, {
			webhookSecret,
			entitlements,
			onPayload,
			...eventHandlers,
		});

		return NextResponse.json({ received: true });
	};
};
