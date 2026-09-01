import { Polar } from "@polar-sh/sdk";
import { createError, sendRedirect } from "h3";
import type { H3Event } from "h3";

export interface CustomerPortalConfig {
	accessToken: string;
	server?: "sandbox" | "production";
	getCustomerId: (event: H3Event) => Promise<string>;
	returnUrl?: string;
}

export const CustomerPortal = ({
	accessToken,
	server,
	getCustomerId,
	returnUrl,
}: CustomerPortalConfig) => {
	return async (event: H3Event) => {
		const retUrl = returnUrl ? new URL(returnUrl) : undefined;

		const customerId = await getCustomerId(event);

		if (!customerId) {
			console.error(
				"Failed to redirect to customer portal, customerId not defined",
			);
			throw createError({
				statusCode: 400,
				message: "customerId not defined",
			});
		}

		try {
			const polar = new Polar({
				accessToken,
				server,
			});

			const result = await polar.customerSessions.create({
				customerId,
				returnUrl: retUrl ? decodeURI(retUrl.toString()) : undefined,
			});

			return sendRedirect(event, result.customerPortalUrl);
		} catch (error) {
			console.error("Failed to redirect to customer portal", error);
			throw createError({
				statusCode: 500,
				statusMessage: (error as Error).message,
				message: (error as Error).message ?? "Internal server error",
			});
		}
	};
};
