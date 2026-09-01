import { handleWebhookPayload } from "@polar-sh/adapter-utils";
import type { Polar } from "@polar-sh/sdk";
import type { WebhookBenefitCreatedPayload } from "@polar-sh/sdk/models/components/webhookbenefitcreatedpayload";
import type { WebhookBenefitGrantCreatedPayload } from "@polar-sh/sdk/models/components/webhookbenefitgrantcreatedpayload";
import type { WebhookBenefitGrantRevokedPayload } from "@polar-sh/sdk/models/components/webhookbenefitgrantrevokedpayload";
import type { WebhookBenefitGrantUpdatedPayload } from "@polar-sh/sdk/models/components/webhookbenefitgrantupdatedpayload";
import type { WebhookBenefitUpdatedPayload } from "@polar-sh/sdk/models/components/webhookbenefitupdatedpayload";
import type { WebhookCheckoutCreatedPayload } from "@polar-sh/sdk/models/components/webhookcheckoutcreatedpayload";
import type { WebhookCheckoutUpdatedPayload } from "@polar-sh/sdk/models/components/webhookcheckoutupdatedpayload";
import type { WebhookCustomerCreatedPayload } from "@polar-sh/sdk/models/components/webhookcustomercreatedpayload";
import type { WebhookCustomerDeletedPayload } from "@polar-sh/sdk/models/components/webhookcustomerdeletedpayload";
import type { WebhookCustomerSeatAssignedPayload } from "@polar-sh/sdk/models/components/webhookcustomerseatassignedpayload";
import type { WebhookCustomerSeatClaimedPayload } from "@polar-sh/sdk/models/components/webhookcustomerseatclaimedpayload";
import type { WebhookCustomerSeatRevokedPayload } from "@polar-sh/sdk/models/components/webhookcustomerseatrevokedpayload";
import type { WebhookCustomerStateChangedPayload } from "@polar-sh/sdk/models/components/webhookcustomerstatechangedpayload";
import type { WebhookCustomerUpdatedPayload } from "@polar-sh/sdk/models/components/webhookcustomerupdatedpayload";
import type { WebhookMemberCreatedPayload } from "@polar-sh/sdk/models/components/webhookmembercreatedpayload";
import type { WebhookMemberDeletedPayload } from "@polar-sh/sdk/models/components/webhookmemberdeletedpayload";
import type { WebhookMemberUpdatedPayload } from "@polar-sh/sdk/models/components/webhookmemberupdatedpayload";
import type { WebhookOrderCreatedPayload } from "@polar-sh/sdk/models/components/webhookordercreatedpayload";
import type { WebhookOrderPaidPayload } from "@polar-sh/sdk/models/components/webhookorderpaidpayload";
import type { WebhookOrderRefundedPayload } from "@polar-sh/sdk/models/components/webhookorderrefundedpayload";
import type { WebhookOrderUpdatedPayload } from "@polar-sh/sdk/models/components/webhookorderupdatedpayload";
import type { WebhookOrganizationUpdatedPayload } from "@polar-sh/sdk/models/components/webhookorganizationupdatedpayload";
import type { WebhookProductCreatedPayload } from "@polar-sh/sdk/models/components/webhookproductcreatedpayload";
import type { WebhookProductUpdatedPayload } from "@polar-sh/sdk/models/components/webhookproductupdatedpayload";
import type { WebhookRefundCreatedPayload } from "@polar-sh/sdk/models/components/webhookrefundcreatedpayload";
import type { WebhookRefundUpdatedPayload } from "@polar-sh/sdk/models/components/webhookrefundupdatedpayload";
import type { WebhookSubscriptionActivePayload } from "@polar-sh/sdk/models/components/webhooksubscriptionactivepayload";
import type { WebhookSubscriptionCanceledPayload } from "@polar-sh/sdk/models/components/webhooksubscriptioncanceledpayload";
import type { WebhookSubscriptionCreatedPayload } from "@polar-sh/sdk/models/components/webhooksubscriptioncreatedpayload";
import type { WebhookSubscriptionRevokedPayload } from "@polar-sh/sdk/models/components/webhooksubscriptionrevokedpayload";
import type { WebhookSubscriptionUncanceledPayload } from "@polar-sh/sdk/models/components/webhooksubscriptionuncanceledpayload";
import type { WebhookSubscriptionUpdatedPayload } from "@polar-sh/sdk/models/components/webhooksubscriptionupdatedpayload";
import { validateEvent } from "@polar-sh/sdk/webhooks";
import { APIError, createAuthEndpoint } from "better-auth/api";
import { DEFAULT_BETTER_AUTH_CREATOR_ROLE } from "../organization/roles";
import {
	MANAGED_SUBSCRIPTION_STATUSES,
	getBetterAuthOrganizationOptions,
	getOrganizationRoster,
	synchronizeOrganizationSeats,
} from "../organization/seats";
import { ensureMemberMirror } from "../organization/sync";
import type { PolarOptions } from "../types";

type WebhookRootOptions = Pick<PolarOptions, "experimental_organizationSync">;

export interface WebhooksOptions {
	/**
	 * Webhook Secret
	 */
	secret: string;
	/**
	 * Generic handler for all webhooks
	 */
	onPayload?: (payload: ReturnType<typeof validateEvent>) => Promise<void>;
	/**
	 * Webhook for checkout created
	 */
	onCheckoutCreated?: (payload: WebhookCheckoutCreatedPayload) => Promise<void>;
	/**
	 * Webhook for checkout updated
	 */
	onCheckoutUpdated?: (payload: WebhookCheckoutUpdatedPayload) => Promise<void>;
	/**
	 * Webhook for order created
	 */
	onOrderCreated?: (payload: WebhookOrderCreatedPayload) => Promise<void>;
	/**
	 * Webhook for order refunded
	 */
	onOrderRefunded?: (payload: WebhookOrderRefundedPayload) => Promise<void>;
	/**
	 * Webhook for order paid
	 */
	onOrderPaid?: (payload: WebhookOrderPaidPayload) => Promise<void>;
	/**
	 * Webhook for order updated
	 */
	onOrderUpdated?: (payload: WebhookOrderUpdatedPayload) => Promise<void>;
	/**
	 * Webhook for refund created
	 */
	onRefundCreated?: (payload: WebhookRefundCreatedPayload) => Promise<void>;
	/**
	 * Webhook for refund updated
	 */
	onRefundUpdated?: (payload: WebhookRefundUpdatedPayload) => Promise<void>;
	/**
	 * Webhook for subscription created
	 */
	onSubscriptionCreated?: (
		payload: WebhookSubscriptionCreatedPayload,
	) => Promise<void>;
	/**
	 * Webhook for subscription updated
	 */
	onSubscriptionUpdated?: (
		payload: WebhookSubscriptionUpdatedPayload,
	) => Promise<void>;
	/**
	 * Webhook for subscription active
	 */
	onSubscriptionActive?: (
		payload: WebhookSubscriptionActivePayload,
	) => Promise<void>;
	/**
	 * Webhook for subscription canceled
	 */
	onSubscriptionCanceled?: (
		payload: WebhookSubscriptionCanceledPayload,
	) => Promise<void>;
	/**
	 * Webhook for subscription revoked
	 */
	onSubscriptionRevoked?: (
		payload: WebhookSubscriptionRevokedPayload,
	) => Promise<void>;
	/**
	 * Webhook for subscription uncanceled
	 */
	onSubscriptionUncanceled?: (
		payload: WebhookSubscriptionUncanceledPayload,
	) => Promise<void>;
	/**
	 * Webhook for product created
	 */
	onProductCreated?: (payload: WebhookProductCreatedPayload) => Promise<void>;
	/**
	 * Webhook for product updated
	 */
	onProductUpdated?: (payload: WebhookProductUpdatedPayload) => Promise<void>;
	/**
	 * Webhook for organization updated
	 */
	onOrganizationUpdated?: (
		payload: WebhookOrganizationUpdatedPayload,
	) => Promise<void>;
	/**
	 * Webhook for benefit created
	 */
	onBenefitCreated?: (payload: WebhookBenefitCreatedPayload) => Promise<void>;
	/**
	 * Webhook for benefit updated
	 */
	onBenefitUpdated?: (payload: WebhookBenefitUpdatedPayload) => Promise<void>;
	/**
	 * Webhook for benefit grant created
	 */
	onBenefitGrantCreated?: (
		payload: WebhookBenefitGrantCreatedPayload,
	) => Promise<void>;
	/**
	 * Webhook for benefit grant updated
	 */
	onBenefitGrantUpdated?: (
		payload: WebhookBenefitGrantUpdatedPayload,
	) => Promise<void>;
	/**
	 * Webhook for benefit grant revoked
	 */
	onBenefitGrantRevoked?: (
		payload: WebhookBenefitGrantRevokedPayload,
	) => Promise<void>;
	/**
	 * Webhook for customer created
	 */
	onCustomerCreated?: (payload: WebhookCustomerCreatedPayload) => Promise<void>;
	/**
	 * Webhook for customer updated
	 */
	onCustomerUpdated?: (payload: WebhookCustomerUpdatedPayload) => Promise<void>;
	/**
	 * Webhook for customer deleted
	 */
	onCustomerDeleted?: (payload: WebhookCustomerDeletedPayload) => Promise<void>;
	/**
	 * Webhook for customer state changed
	 */
	onCustomerStateChanged?: (
		payload: WebhookCustomerStateChangedPayload,
	) => Promise<void>;
	/**
	 * Notification that a seat was assigned and its invitation was created.
	 */
	onCustomerSeatAssigned?: (
		payload: WebhookCustomerSeatAssignedPayload,
	) => Promise<void>;
	/**
	 * Notification that a member claimed a seat and can receive its benefits.
	 */
	onCustomerSeatClaimed?: (
		payload: WebhookCustomerSeatClaimedPayload,
	) => Promise<void>;
	/**
	 * Notification that a seat was revoked from a member.
	 */
	onCustomerSeatRevoked?: (
		payload: WebhookCustomerSeatRevokedPayload,
	) => Promise<void>;
	/**
	 * Notification that a Polar member was created.
	 *
	 * Do not mutate Better Auth organization membership from this callback.
	 */
	onMemberCreated?: (payload: WebhookMemberCreatedPayload) => Promise<void>;
	/**
	 * Notification that a Polar member was updated.
	 *
	 * Do not mutate Better Auth organization membership from this callback.
	 */
	onMemberUpdated?: (payload: WebhookMemberUpdatedPayload) => Promise<void>;
	/**
	 * Notification that a Polar member was deleted.
	 *
	 * Do not mutate Better Auth organization membership from this callback.
	 */
	onMemberDeleted?: (payload: WebhookMemberDeletedPayload) => Promise<void>;
}

export const webhooks =
	(options: WebhooksOptions) =>
	(polar: Polar, rootOptions?: WebhookRootOptions) => {
		return {
			polarWebhooks: createAuthEndpoint(
				"/polar/webhooks",
				{
					method: "POST",
					metadata: {
						isAction: false,
					},
					cloneRequest: true,
				},
				async (ctx) => {
					const { secret, ...eventHandlers } = options;

					if (!ctx.request?.body) {
						throw new APIError("INTERNAL_SERVER_ERROR");
					}
					const buf = await ctx.request.text();
					let event: ReturnType<typeof validateEvent>;
					try {
						if (!secret) {
							throw new APIError("INTERNAL_SERVER_ERROR", {
								message: "Polar webhook secret not found",
							});
						}

						const headers = {
							"webhook-id": ctx.request.headers.get("webhook-id") as string,
							"webhook-timestamp": ctx.request.headers.get(
								"webhook-timestamp",
							) as string,
							"webhook-signature": ctx.request.headers.get(
								"webhook-signature",
							) as string,
						};

						event = validateEvent(buf, headers, secret);
					} catch (err: unknown) {
						if (err instanceof Error) {
							ctx.context.logger.error(`${err.message}`);
							throw new APIError("BAD_REQUEST", {
								message: `Webhook Error: ${err.message}`,
							});
						}
						throw new APIError("BAD_REQUEST", {
							message: `Webhook Error: ${err}`,
						});
					}

					try {
						const organizationOptions =
							rootOptions?.experimental_organizationSync;
						if (
							organizationOptions?.enabled &&
							organizationOptions.syncSeats &&
							(event.type === "subscription.created" ||
								event.type === "subscription.active") &&
							event.data.customer.type === "team" &&
							event.data.customer.externalId &&
							event.data.seats != null &&
							MANAGED_SUBSCRIPTION_STATUSES.has(event.data.status)
						) {
							const organizationId = event.data.customer.externalId;
							const organization = await ctx.context.adapter.findOne({
								model: "organization",
								where: [{ field: "id", value: organizationId }],
							});
							if (organization) {
								const subscription = await polar.subscriptions.get({
									id: event.data.id,
								});
								if (
									subscription.customer.type === "team" &&
									subscription.customer.externalId === organizationId &&
									subscription.seats != null &&
									MANAGED_SUBSCRIPTION_STATUSES.has(subscription.status)
								) {
									const betterAuthOrganizationOptions =
										getBetterAuthOrganizationOptions(ctx.context);
									const roster = await getOrganizationRoster(
										ctx.context,
										betterAuthOrganizationOptions,
										organizationId,
									);
									const roleOptions = {
										creatorRole:
											betterAuthOrganizationOptions.creatorRole ??
											DEFAULT_BETTER_AUTH_CREATOR_ROLE,
										mapBetterAuthRoleToPolarRole:
											organizationOptions.mapBetterAuthRoleToPolarRole,
									};
									for (const member of roster) {
										await ensureMemberMirror(polar, roleOptions, {
											organizationId,
											user: member.user,
											betterAuthRole: member.role,
										});
									}
									await synchronizeOrganizationSeats({
										authContext: ctx.context,
										client: polar,
										organizationId,
										organizationOptions,
										betterAuthOrganizationOptions,
										subscriptions: [subscription],
									});
								}
							}
						}

						// adapter-utils intentionally remains on SDK 0.47 while this package
						// validates with 0.49. Both versions expose the same webhook event
						// contract here, but their generated OpenEnum brands are nominally
						// incompatible to TypeScript.
						const adapterPayload = event as Parameters<
							typeof handleWebhookPayload
						>[0];
						const adapterConfig = {
							webhookSecret: secret,
							...eventHandlers,
						} as Parameters<typeof handleWebhookPayload>[1];
						await handleWebhookPayload(adapterPayload, adapterConfig);
					} catch (e: unknown) {
						if (e instanceof Error) {
							ctx.context.logger.error(
								`Polar webhook failed. Error: ${e.message}`,
							);
						} else {
							ctx.context.logger.error(`Polar webhook failed. Error: ${e}`);
						}

						throw new APIError("BAD_REQUEST", {
							message: "Webhook error: See server logs for more information.",
						});
					}

					return ctx.json({ received: true });
				},
			),
		};
	};
