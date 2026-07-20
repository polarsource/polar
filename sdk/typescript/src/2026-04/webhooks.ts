import type {
  Benefit,
  BenefitGrantWebhook,
  Checkout,
  Customer,
  CustomerSeat,
  CustomerState,
  Member,
  Order,
  Organization,
  Product,
  Refund,
  Subscription,
} from "./models";

import { validateWebhook } from "../webhooks";

export {
  PolarWebhookError,
  PolarWebhookUnknownTypeError,
  PolarWebhookVerificationError,
} from "../webhooks";

/**
 * Sent when a new benefit is created.
 *
 * **Discord & Slack support:** Basic
 */
export interface WebhookBenefitCreatedPayload {
  /**
   * type
   */
  type: "benefit.created";
  /**
   * timestamp
   */
  timestamp: string;
  /**
   * data
   */
  data: Benefit;
}
/**
 * Sent when a new benefit grant is created.
 *
 * **Discord & Slack support:** Basic
 */
export interface WebhookBenefitGrantCreatedPayload {
  /**
   * type
   */
  type: "benefit_grant.created";
  /**
   * timestamp
   */
  timestamp: string;
  /**
   * data
   */
  data: BenefitGrantWebhook;
}
/**
 * Sent when a benefit grant is cycled,
 * meaning the related subscription has been renewed for another period.
 *
 * **Discord & Slack support:** Basic
 */
export interface WebhookBenefitGrantCycledPayload {
  /**
   * type
   */
  type: "benefit_grant.cycled";
  /**
   * timestamp
   */
  timestamp: string;
  /**
   * data
   */
  data: BenefitGrantWebhook;
}
/**
 * Sent when a benefit grant is revoked.
 *
 * **Discord & Slack support:** Basic
 */
export interface WebhookBenefitGrantRevokedPayload {
  /**
   * type
   */
  type: "benefit_grant.revoked";
  /**
   * timestamp
   */
  timestamp: string;
  /**
   * data
   */
  data: BenefitGrantWebhook;
}
/**
 * Sent when a benefit grant is updated.
 *
 * **Discord & Slack support:** Basic
 */
export interface WebhookBenefitGrantUpdatedPayload {
  /**
   * type
   */
  type: "benefit_grant.updated";
  /**
   * timestamp
   */
  timestamp: string;
  /**
   * data
   */
  data: BenefitGrantWebhook;
}
/**
 * Sent when a benefit is updated.
 *
 * **Discord & Slack support:** Basic
 */
export interface WebhookBenefitUpdatedPayload {
  /**
   * type
   */
  type: "benefit.updated";
  /**
   * timestamp
   */
  timestamp: string;
  /**
   * data
   */
  data: Benefit;
}
/**
 * Sent when a new checkout is created.
 *
 * **Discord & Slack support:** Basic
 */
export interface WebhookCheckoutCreatedPayload {
  /**
   * type
   */
  type: "checkout.created";
  /**
   * timestamp
   */
  timestamp: string;
  /**
   * data
   */
  data: Checkout;
}
/**
 * Sent when a checkout expires.
 *
 * This event fires when a checkout reaches its expiration time without being completed.
 * Developers can use this to send reminder emails or track checkout abandonment.
 *
 * **Discord & Slack support:** Basic
 */
export interface WebhookCheckoutExpiredPayload {
  /**
   * type
   */
  type: "checkout.expired";
  /**
   * timestamp
   */
  timestamp: string;
  /**
   * data
   */
  data: Checkout;
}
/**
 * Sent when a checkout is updated.
 *
 * **Discord & Slack support:** Basic
 */
export interface WebhookCheckoutUpdatedPayload {
  /**
   * type
   */
  type: "checkout.updated";
  /**
   * timestamp
   */
  timestamp: string;
  /**
   * data
   */
  data: Checkout;
}
/**
 * Sent when a new customer is created.
 *
 * A customer can be created:
 *
 * * After a successful checkout.
 * * Programmatically via the API.
 *
 * **Discord & Slack support:** Basic
 */
export interface WebhookCustomerCreatedPayload {
  /**
   * type
   */
  type: "customer.created";
  /**
   * timestamp
   */
  timestamp: string;
  /**
   * data
   */
  data: Customer;
}
/**
 * Sent when a customer is deleted.
 *
 * **Discord & Slack support:** Basic
 */
export interface WebhookCustomerDeletedPayload {
  /**
   * type
   */
  type: "customer.deleted";
  /**
   * timestamp
   */
  timestamp: string;
  /**
   * data
   */
  data: Customer;
}
/**
 * Sent when a new customer seat is assigned.
 *
 * This event is triggered when a seat is assigned to a customer by the organization.
 * The customer will receive an invitation email to claim the seat.
 */
export interface WebhookCustomerSeatAssignedPayload {
  /**
   * type
   */
  type: "customer_seat.assigned";
  /**
   * timestamp
   */
  timestamp: string;
  /**
   * data
   */
  data: CustomerSeat;
}
/**
 * Sent when a customer seat is claimed.
 *
 * This event is triggered when a customer accepts the seat invitation and claims their access.
 */
export interface WebhookCustomerSeatClaimedPayload {
  /**
   * type
   */
  type: "customer_seat.claimed";
  /**
   * timestamp
   */
  timestamp: string;
  /**
   * data
   */
  data: CustomerSeat;
}
/**
 * Sent when a customer seat is revoked.
 *
 * This event is triggered when access to a seat is revoked, either manually by the organization or automatically when a subscription is canceled.
 */
export interface WebhookCustomerSeatRevokedPayload {
  /**
   * type
   */
  type: "customer_seat.revoked";
  /**
   * timestamp
   */
  timestamp: string;
  /**
   * data
   */
  data: CustomerSeat;
}
/**
 * Sent when a customer state has changed.
 *
 * It's triggered when:
 *
 * * Customer is created, updated or deleted.
 * * A subscription is created or updated.
 * * A benefit is granted or revoked.
 *
 * **Discord & Slack support:** Basic
 */
export interface WebhookCustomerStateChangedPayload {
  /**
   * type
   */
  type: "customer.state_changed";
  /**
   * timestamp
   */
  timestamp: string;
  /**
   * data
   */
  data: CustomerState;
}
/**
 * Sent when a customer is updated.
 *
 * This event is fired when the customer details are updated.
 *
 * If you want to be notified when a customer subscription or benefit state changes, you should listen to the `customer_state_changed` event.
 *
 * **Discord & Slack support:** Basic
 */
export interface WebhookCustomerUpdatedPayload {
  /**
   * type
   */
  type: "customer.updated";
  /**
   * timestamp
   */
  timestamp: string;
  /**
   * data
   */
  data: Customer;
}
/**
 * Sent when a new member is created.
 *
 * A member represents an individual within a customer (team).
 * This event is triggered when a member is added to a customer,
 * either programmatically via the API or when an owner is automatically
 * created for a new customer.
 *
 * **Discord & Slack support:** Basic
 */
export interface WebhookMemberCreatedPayload {
  /**
   * type
   */
  type: "member.created";
  /**
   * timestamp
   */
  timestamp: string;
  /**
   * data
   */
  data: Member;
}
/**
 * Sent when a member is deleted.
 *
 * This event is triggered when a member is removed from a customer.
 * Any active seats assigned to the member will be automatically revoked.
 *
 * **Discord & Slack support:** Basic
 */
export interface WebhookMemberDeletedPayload {
  /**
   * type
   */
  type: "member.deleted";
  /**
   * timestamp
   */
  timestamp: string;
  /**
   * data
   */
  data: Member;
}
/**
 * Sent when a member is updated.
 *
 * This event is triggered when member details are updated,
 * such as their name or role within the customer.
 *
 * **Discord & Slack support:** Basic
 */
export interface WebhookMemberUpdatedPayload {
  /**
   * type
   */
  type: "member.updated";
  /**
   * timestamp
   */
  timestamp: string;
  /**
   * data
   */
  data: Member;
}
/**
 * Sent when a new order is created.
 *
 * A new order is created when:
 *
 * * A customer purchases a one-time product. In this case, `billing_reason` is set to `purchase`.
 * * A customer starts a subscription. In this case, `billing_reason` is set to `subscription_create`.
 * * A subscription is renewed. In this case, `billing_reason` is set to `subscription_cycle`.
 * * A subscription is upgraded or downgraded with an immediate proration invoice. In this case, `billing_reason` is set to `subscription_update`.
 *
 * > [!WARNING]
 * > The order might not be paid yet, so the `status` field might be `pending`.
 *
 * **Discord & Slack support:** Full
 */
export interface WebhookOrderCreatedPayload {
  /**
   * type
   */
  type: "order.created";
  /**
   * timestamp
   */
  timestamp: string;
  /**
   * data
   */
  data: Order;
}
/**
 * Sent when an order is paid.
 *
 * When you receive this event, the order is fully processed and payment has been received.
 *
 * **Discord & Slack support:** Full
 */
export interface WebhookOrderPaidPayload {
  /**
   * type
   */
  type: "order.paid";
  /**
   * timestamp
   */
  timestamp: string;
  /**
   * data
   */
  data: Order;
}
/**
 * Sent when an order is fully or partially refunded.
 *
 * **Discord & Slack support:** Full
 */
export interface WebhookOrderRefundedPayload {
  /**
   * type
   */
  type: "order.refunded";
  /**
   * timestamp
   */
  timestamp: string;
  /**
   * data
   */
  data: Order;
}
/**
 * Sent when an order is updated.
 *
 * An order is updated when:
 *
 * * Its status changes, e.g. from `pending` to `paid`.
 * * It's refunded, partially or fully.
 *
 * **Discord & Slack support:** Full
 */
export interface WebhookOrderUpdatedPayload {
  /**
   * type
   */
  type: "order.updated";
  /**
   * timestamp
   */
  timestamp: string;
  /**
   * data
   */
  data: Order;
}
/**
 * Sent when a organization is updated.
 *
 * **Discord & Slack support:** Basic
 */
export interface WebhookOrganizationUpdatedPayload {
  /**
   * type
   */
  type: "organization.updated";
  /**
   * timestamp
   */
  timestamp: string;
  /**
   * data
   */
  data: Organization;
}
/**
 * Sent when a new product is created.
 *
 * **Discord & Slack support:** Basic
 */
export interface WebhookProductCreatedPayload {
  /**
   * type
   */
  type: "product.created";
  /**
   * timestamp
   */
  timestamp: string;
  /**
   * data
   */
  data: Product;
}
/**
 * Sent when a product is updated.
 *
 * **Discord & Slack support:** Basic
 */
export interface WebhookProductUpdatedPayload {
  /**
   * type
   */
  type: "product.updated";
  /**
   * timestamp
   */
  timestamp: string;
  /**
   * data
   */
  data: Product;
}
/**
 * Sent when a refund is created regardless of status.
 *
 * **Discord & Slack support:** Full
 */
export interface WebhookRefundCreatedPayload {
  /**
   * type
   */
  type: "refund.created";
  /**
   * timestamp
   */
  timestamp: string;
  /**
   * data
   */
  data: Refund;
}
/**
 * Sent when a refund is updated.
 *
 * **Discord & Slack support:** Full
 */
export interface WebhookRefundUpdatedPayload {
  /**
   * type
   */
  type: "refund.updated";
  /**
   * timestamp
   */
  timestamp: string;
  /**
   * data
   */
  data: Refund;
}
/**
 * Sent when a subscription becomes active,
 * whether because it's a new paid subscription or because payment was recovered.
 *
 * **Discord & Slack support:** Full
 */
export interface WebhookSubscriptionActivePayload {
  /**
   * type
   */
  type: "subscription.active";
  /**
   * timestamp
   */
  timestamp: string;
  /**
   * data
   */
  data: Subscription;
}
/**
 * Sent when a subscription is canceled.
 * Customers might still have access until the end of the current period.
 *
 * **Discord & Slack support:** Full
 */
export interface WebhookSubscriptionCanceledPayload {
  /**
   * type
   */
  type: "subscription.canceled";
  /**
   * timestamp
   */
  timestamp: string;
  /**
   * data
   */
  data: Subscription;
}
/**
 * Sent when a new subscription is created.
 *
 * When this event occurs, the subscription `status` might not be `active` yet, as we can still have to wait for the first payment to be processed.
 *
 * **Discord & Slack support:** Full
 */
export interface WebhookSubscriptionCreatedPayload {
  /**
   * type
   */
  type: "subscription.created";
  /**
   * timestamp
   */
  timestamp: string;
  /**
   * data
   */
  data: Subscription;
}
/**
 * Sent when a subscription payment fails and the subscription enters `past_due` status.
 *
 * This is a recoverable state - the customer can update their payment method to restore the subscription.
 * Benefits may be revoked depending on the organization's grace period settings.
 *
 * If payment retries are exhausted, a `subscription.revoked` event will be sent.
 *
 * **Discord & Slack support:** Full
 */
export interface WebhookSubscriptionPastDuePayload {
  /**
   * type
   */
  type: "subscription.past_due";
  /**
   * timestamp
   */
  timestamp: string;
  /**
   * data
   */
  data: Subscription;
}
/**
 * Sent when a subscription is paused and the customer temporarily loses access.
 *
 * No order is created while paused. The subscription resumes either on its
 * scheduled resume date or when resumed manually, starting a new billing period.
 *
 * **Discord & Slack support:** Full
 */
export interface WebhookSubscriptionPausedPayload {
  /**
   * type
   */
  type: "subscription.paused";
  /**
   * timestamp
   */
  timestamp: string;
  /**
   * data
   */
  data: Subscription;
}
/**
 * Sent when a paused subscription resumes, restoring the customer's access.
 *
 * Resuming starts a new billing period and charges the customer immediately.
 *
 * **Discord & Slack support:** Full
 */
export interface WebhookSubscriptionResumedPayload {
  /**
   * type
   */
  type: "subscription.resumed";
  /**
   * timestamp
   */
  timestamp: string;
  /**
   * data
   */
  data: Subscription;
}
/**
 * Sent when a subscription is revoked and the user loses access immediately.
 * Happens when the subscription is canceled or payment retries are exhausted (status becomes `unpaid`).
 *
 * For payment failures that can still be recovered, see `subscription.past_due`.
 *
 * **Discord & Slack support:** Full
 */
export interface WebhookSubscriptionRevokedPayload {
  /**
   * type
   */
  type: "subscription.revoked";
  /**
   * timestamp
   */
  timestamp: string;
  /**
   * data
   */
  data: Subscription;
}
/**
 * Sent when a customer revokes a pending cancellation.
 *
 * When a customer cancels with "at period end", they retain access until the
 * subscription would renew. During this time, they can change their mind and
 * undo the cancellation. This event is triggered when they do so.
 *
 * **Discord & Slack support:** Full
 */
export interface WebhookSubscriptionUncanceledPayload {
  /**
   * type
   */
  type: "subscription.uncanceled";
  /**
   * timestamp
   */
  timestamp: string;
  /**
   * data
   */
  data: Subscription;
}
/**
 * Sent when a subscription is updated. This event fires for all changes to the subscription, including renewals.
 *
 * If you want more specific events, you can listen to `subscription.active`, `subscription.canceled`, `subscription.past_due`, and `subscription.revoked`.
 *
 * To listen specifically for renewals, you can listen to `order.created` events and check the `billing_reason` field.
 *
 * **Discord & Slack support:** On cancellation, past due, and revocation. Renewals are skipped.
 */
export interface WebhookSubscriptionUpdatedPayload {
  /**
   * type
   */
  type: "subscription.updated";
  /**
   * timestamp
   */
  timestamp: string;
  /**
   * data
   */
  data: Subscription;
}
export type WebhookPayload =
  | WebhookBenefitCreatedPayload
  | WebhookBenefitGrantCreatedPayload
  | WebhookBenefitGrantCycledPayload
  | WebhookBenefitGrantRevokedPayload
  | WebhookBenefitGrantUpdatedPayload
  | WebhookBenefitUpdatedPayload
  | WebhookCheckoutCreatedPayload
  | WebhookCheckoutExpiredPayload
  | WebhookCheckoutUpdatedPayload
  | WebhookCustomerCreatedPayload
  | WebhookCustomerDeletedPayload
  | WebhookCustomerSeatAssignedPayload
  | WebhookCustomerSeatClaimedPayload
  | WebhookCustomerSeatRevokedPayload
  | WebhookCustomerStateChangedPayload
  | WebhookCustomerUpdatedPayload
  | WebhookMemberCreatedPayload
  | WebhookMemberDeletedPayload
  | WebhookMemberUpdatedPayload
  | WebhookOrderCreatedPayload
  | WebhookOrderPaidPayload
  | WebhookOrderRefundedPayload
  | WebhookOrderUpdatedPayload
  | WebhookOrganizationUpdatedPayload
  | WebhookProductCreatedPayload
  | WebhookProductUpdatedPayload
  | WebhookRefundCreatedPayload
  | WebhookRefundUpdatedPayload
  | WebhookSubscriptionActivePayload
  | WebhookSubscriptionCanceledPayload
  | WebhookSubscriptionCreatedPayload
  | WebhookSubscriptionPastDuePayload
  | WebhookSubscriptionPausedPayload
  | WebhookSubscriptionResumedPayload
  | WebhookSubscriptionRevokedPayload
  | WebhookSubscriptionUncanceledPayload
  | WebhookSubscriptionUpdatedPayload;

const knownEventTypes = new Set<string>([
  "benefit.created",
  "benefit.updated",
  "benefit_grant.created",
  "benefit_grant.cycled",
  "benefit_grant.revoked",
  "benefit_grant.updated",
  "checkout.created",
  "checkout.expired",
  "checkout.updated",
  "customer.created",
  "customer.deleted",
  "customer.state_changed",
  "customer.updated",
  "customer_seat.assigned",
  "customer_seat.claimed",
  "customer_seat.revoked",
  "member.created",
  "member.deleted",
  "member.updated",
  "order.created",
  "order.paid",
  "order.refunded",
  "order.updated",
  "organization.updated",
  "product.created",
  "product.updated",
  "refund.created",
  "refund.updated",
  "subscription.active",
  "subscription.canceled",
  "subscription.created",
  "subscription.past_due",
  "subscription.paused",
  "subscription.resumed",
  "subscription.revoked",
  "subscription.uncanceled",
  "subscription.updated",
]);

/**
 * Verify a raw Polar webhook request and return its typed payload.
 */
export const validateEvent = (
  body: string | Uint8Array,
  headers: Record<string, string>,
  secret: string,
): Promise<WebhookPayload> => {
  return validateWebhook<WebhookPayload>(body, headers, secret, knownEventTypes);
};
