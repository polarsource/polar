import { Polar } from "@polar-sh/sdk";
import { createError, getValidatedQuery, sendRedirect } from "h3";
import type { H3Event } from "h3";
import { z } from "zod";

export interface CheckoutConfig {
	accessToken?: string;
	successUrl?: string;
	returnUrl?: string;
	includeCheckoutId?: boolean;
	server?: "sandbox" | "production";
	theme?: "light" | "dark";
}

const checkoutQuerySchema = z.object({
	products: z
		.string()
		.transform((value) => value.split(","))
		.pipe(z.string().array()),
	customerId: z.string().nonempty().optional(),
	customerExternalId: z.string().nonempty().optional(),
	customerEmail: z.string().email().optional(),
	customerName: z.string().nonempty().optional(),
	customerBillingAddress: z.string().nonempty().optional(),
	customerTaxId: z.string().nonempty().optional(),
	customerIpAddress: z.string().nonempty().optional(),
	customerMetadata: z.string().nonempty().optional(),
	allowDiscountCodes: z
		.string()
		.toLowerCase()
		.transform((x) => x === "true")
		.pipe(z.boolean())
		.optional(),
	discountId: z.string().nonempty().optional(),
	metadata: z.string().nonempty().optional(),
});

export const Checkout = ({
	accessToken,
	successUrl,
	returnUrl,
	server,
	theme,
	includeCheckoutId = true,
}: CheckoutConfig) => {
	return async (event: H3Event) => {
		const {
			products,
			customerId,
			customerExternalId,
			customerEmail,
			customerName,
			customerBillingAddress,
			customerTaxId,
			customerIpAddress,
			customerMetadata,
			allowDiscountCodes,
			discountId,
			metadata,
		} = await getValidatedQuery(event, checkoutQuerySchema.parse);

		try {
			const success = successUrl ? new URL(successUrl) : undefined;

			if (success && includeCheckoutId) {
				success.searchParams.set("checkoutId", "{CHECKOUT_ID}");
			}

			const retUrl = returnUrl ? new URL(returnUrl) : undefined;

			const polar = new Polar({ accessToken, server });

			const result = await polar.checkouts.create({
				products,
				successUrl: success ? decodeURI(success.toString()) : undefined,
				customerId,
				externalCustomerId: customerExternalId,
				customerEmail,
				customerName,
				customerBillingAddress: customerBillingAddress
					? JSON.parse(customerBillingAddress)
					: undefined,
				customerTaxId,
				customerIpAddress,
				customerMetadata: customerMetadata
					? JSON.parse(customerMetadata)
					: undefined,
				allowDiscountCodes,
				discountId,
				metadata: metadata ? JSON.parse(metadata) : undefined,
				returnUrl: retUrl ? decodeURI(retUrl.toString()) : undefined,
			});

			const redirectUrl = new URL(result.url);

			if (theme) {
				redirectUrl.searchParams.set("theme", theme);
			}

			return sendRedirect(event, redirectUrl.toString());
		} catch (error) {
			console.error("Failed to checkout:", error);
			throw createError({
				statusCode: 500,
				statusMessage: (error as Error).message,
				message: (error as Error).message ?? "Internal server error",
			});
		}
	};
};
