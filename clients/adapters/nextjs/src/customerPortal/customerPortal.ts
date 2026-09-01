import { Polar } from "@polar-sh/sdk";
import { type NextRequest, NextResponse } from "next/server";

interface CustomerPortalBaseConfig {
	accessToken: string;
	server: "sandbox" | "production";
	returnUrl?: string;
}

interface CustomerPortalCustomerIdConfig extends CustomerPortalBaseConfig {
	getCustomerId: (req: NextRequest) => Promise<string>;
	getExternalCustomerId?: never;
}

interface CustomerPortalExternalCustomerIdConfig
	extends CustomerPortalBaseConfig {
	getCustomerId?: never;
	getExternalCustomerId: (req: NextRequest) => Promise<string>;
}

function configIsExternalCustomerIdConfig(
	config: CustomerPortalConfig,
): config is CustomerPortalExternalCustomerIdConfig {
	return typeof config.getExternalCustomerId === "function";
}

export type CustomerPortalConfig =
	| CustomerPortalCustomerIdConfig
	| CustomerPortalExternalCustomerIdConfig;

export const CustomerPortal = (config: CustomerPortalConfig) => {
	const { accessToken, server, returnUrl } = config;

	const polar = new Polar({
		accessToken,
		server,
	});

	return async (req: NextRequest) => {
		const decodedReturnUrl = returnUrl
			? decodeURI(new URL(returnUrl).toString())
			: undefined;

		if (configIsExternalCustomerIdConfig(config)) {
			const externalCustomerId = await config.getExternalCustomerId(req);

			if (!externalCustomerId) {
				return NextResponse.json(
					{ error: "externalCustomerId not defined" },
					{ status: 400 },
				);
			}

			try {
				const { customerPortalUrl } = await polar.customerSessions.create({
					returnUrl: decodedReturnUrl,
					externalCustomerId,
				});

				return NextResponse.redirect(customerPortalUrl);
			} catch (error) {
				console.error(error);
				return NextResponse.error();
			}
		}

		const customerId = await config.getCustomerId(req);

		if (!customerId) {
			return NextResponse.json(
				{ error: "customerId not defined" },
				{ status: 400 },
			);
		}

		try {
			const { customerPortalUrl } = await polar.customerSessions.create({
				returnUrl: decodedReturnUrl,
				customerId,
			});

			return NextResponse.redirect(customerPortalUrl);
		} catch (error) {
			console.error(error);
			return NextResponse.error();
		}
	};
};
