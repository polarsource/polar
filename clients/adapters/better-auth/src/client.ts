import { PolarEmbedCheckout } from "@polar-sh/checkout/embed";
import type { PolarEmbedCheckout as PolarEmbedCheckoutType } from "@polar-sh/checkout/embed";
import type { BetterAuthClientPlugin } from "better-auth";
import type { BetterFetchOption } from "better-auth/client";
import type { CheckoutParams } from "./plugins/checkout";
import type { polar } from "./server";

export type { PolarEmbedCheckoutType as PolarEmbedCheckout };

export const polarClient = () => {
	return {
		id: "polar-client",
		$InferServerPlugin: {} as ReturnType<typeof polar>,
		getActions: ($fetch) => {
			return {
				checkoutEmbed: async (
					data: Omit<CheckoutParams, "redirect" | "embedOrigin">,
					fetchOptions?: BetterFetchOption,
				): Promise<PolarEmbedCheckoutType> => {
					const res = await $fetch("/checkout", {
						method: "POST",
						body: {
							...data,
							redirect: false,
							embedOrigin: window.location.origin,
						},
						...fetchOptions,
					});

					if (res.error) {
						throw new Error(res.error.message);
					}

					const checkout = res.data as { url: string };

					const theme =
						(new URL(checkout.url).searchParams.get("theme") as
							| "light"
							| "dark"
							| undefined) ?? "light";

					return await PolarEmbedCheckout.create(checkout.url, { theme });
				},
			};
		},
	} satisfies BetterAuthClientPlugin;
};
