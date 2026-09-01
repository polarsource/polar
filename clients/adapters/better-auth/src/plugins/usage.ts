import type { Polar } from "@polar-sh/sdk";
import {
	APIError,
	createAuthEndpoint,
	sessionMiddleware,
} from "better-auth/api";
import * as z from "zod/v4";
import { resolveBillingPrincipal } from "../principal";
import type { PolarOptions, Product } from "../types";

export interface UsageOptions {
	/**
	 * Products to use for topping up credits
	 */
	creditProducts?: Product[] | (() => Promise<Product[]>);
}

export const usage =
	(_usageOptions?: UsageOptions) =>
	(
		polar: Polar,
		rootOptions?: Pick<PolarOptions, "experimental_organizationSync">,
	) => {
		return {
			meters: createAuthEndpoint(
				"/usage/meters/list",
				{
					method: "GET",
					use: [sessionMiddleware],
					query: z.object({
						organizationId: z.string().min(1).optional(),
						page: z.coerce.number().optional(),
						limit: z.coerce.number().optional(),
					}),
				},
				async (ctx) => {
					if (!ctx.context.session.user.id) {
						throw new APIError("BAD_REQUEST", {
							message: "User not found",
						});
					}

					const principal = ctx.query?.organizationId
						? await resolveBillingPrincipal({
								context: ctx.context,
								session: ctx.context.session,
								organizationId: ctx.query.organizationId,
								organizationEnabled:
									rootOptions?.experimental_organizationSync?.enabled,
								authorization: "member",
							})
						: undefined;

					try {
						const customerSession = await polar.customerSessions.create({
							externalCustomerId:
								principal?.externalCustomerId ?? ctx.context.session.user.id,
							...(principal?.kind === "team"
								? { externalMemberId: principal.externalMemberId }
								: {}),
						});

						const customerMeters =
							await polar.customerPortal.customerMeters.list(
								{ customerSession: customerSession.token },
								{
									page: ctx.query?.page,
									limit: ctx.query?.limit,
								},
							);

						return ctx.json(customerMeters);
					} catch (e: unknown) {
						if (e instanceof Error) {
							ctx.context.logger.error(
								`Polar meters list failed. Error: ${e.message}`,
							);
						}

						throw new APIError("INTERNAL_SERVER_ERROR", {
							message: "Meters list failed",
						});
					}
				},
			),
			ingestion: createAuthEndpoint(
				"/usage/ingest",
				{
					method: "POST",
					body: z.object({
						organizationId: z.string().min(1).optional(),
						event: z.string(),
						metadata: z.record(
							z.string(),
							z.union([z.string(), z.number(), z.boolean()]),
						),
					}),
					use: [sessionMiddleware],
				},
				async (ctx) => {
					if (!ctx.context.session.user.id) {
						throw new APIError("BAD_REQUEST", {
							message: "User not found",
						});
					}

					const principal = ctx.body.organizationId
						? await resolveBillingPrincipal({
								context: ctx.context,
								session: ctx.context.session,
								organizationId: ctx.body.organizationId,
								organizationEnabled:
									rootOptions?.experimental_organizationSync?.enabled,
								authorization: "member",
							})
						: undefined;

					try {
						const ingestion = await polar.events.ingest({
							events: [
								{
									name: ctx.body.event,
									metadata: ctx.body.metadata,
									externalCustomerId:
										principal?.externalCustomerId ??
										ctx.context.session.user.id,
									...(principal?.kind === "team"
										? { externalMemberId: principal.externalMemberId }
										: {}),
								},
							],
						});

						return ctx.json(ingestion);
					} catch (e: unknown) {
						if (e instanceof Error) {
							ctx.context.logger.error(
								`Polar ingestion failed. Error: ${e.message}`,
							);
						}

						throw new APIError("INTERNAL_SERVER_ERROR", {
							message: "Ingestion failed",
						});
					}
				},
			),
		};
	};
