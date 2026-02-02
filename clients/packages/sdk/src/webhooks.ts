import {
  Webhook,
  WebhookVerificationError as _WebhookVerificationError,
} from "standardwebhooks";

import { WebhookBenefitCreatedPayload$inboundSchema } from "./models/components/webhookbenefitcreatedpayload.js";
import { WebhookBenefitGrantCreatedPayload$inboundSchema } from "./models/components/webhookbenefitgrantcreatedpayload.js";
import { WebhookBenefitGrantRevokedPayload$inboundSchema } from "./models/components/webhookbenefitgrantrevokedpayload.js";
import { WebhookBenefitGrantUpdatedPayload$inboundSchema } from "./models/components/webhookbenefitgrantupdatedpayload.js";
import { WebhookBenefitGrantCycledPayload$inboundSchema } from "./models/components/webhookbenefitgrantcycledpayload.js";
import { WebhookBenefitUpdatedPayload$inboundSchema } from "./models/components/webhookbenefitupdatedpayload.js";
import { WebhookCheckoutCreatedPayload$inboundSchema } from "./models/components/webhookcheckoutcreatedpayload.js";
import { WebhookCheckoutUpdatedPayload$inboundSchema } from "./models/components/webhookcheckoutupdatedpayload.js";
import { WebhookOrderCreatedPayload$inboundSchema } from "./models/components/webhookordercreatedpayload.js";
import { WebhookOrderRefundedPayload$inboundSchema } from "./models/components/webhookorderrefundedpayload.js";
import { WebhookOrderUpdatedPayload$inboundSchema } from "./models/components/webhookorderupdatedpayload.js";
import { WebhookOrderPaidPayload$inboundSchema } from "./models/components/webhookorderpaidpayload.js";
import { WebhookOrganizationUpdatedPayload$inboundSchema } from "./models/components/webhookorganizationupdatedpayload.js";
import { WebhookProductCreatedPayload$inboundSchema } from "./models/components/webhookproductcreatedpayload.js";
import { WebhookProductUpdatedPayload$inboundSchema } from "./models/components/webhookproductupdatedpayload.js";
import { WebhookRefundCreatedPayload$inboundSchema } from "./models/components/webhookrefundcreatedpayload.js";
import { WebhookRefundUpdatedPayload$inboundSchema } from "./models/components/webhookrefundupdatedpayload.js";
import { WebhookSubscriptionActivePayload$inboundSchema } from "./models/components/webhooksubscriptionactivepayload.js";
import { WebhookSubscriptionCanceledPayload$inboundSchema } from "./models/components/webhooksubscriptioncanceledpayload.js";
import { WebhookSubscriptionCreatedPayload$inboundSchema } from "./models/components/webhooksubscriptioncreatedpayload.js";
import { WebhookSubscriptionRevokedPayload$inboundSchema } from "./models/components/webhooksubscriptionrevokedpayload.js";
import { WebhookSubscriptionUncanceledPayload$inboundSchema } from "./models/components/webhooksubscriptionuncanceledpayload.js";
import { WebhookSubscriptionUpdatedPayload$inboundSchema } from "./models/components/webhooksubscriptionupdatedpayload.js";
import { WebhookCustomerCreatedPayload$inboundSchema } from "./models/components/webhookcustomercreatedpayload.js";
import { WebhookCustomerUpdatedPayload$inboundSchema } from "./models/components/webhookcustomerupdatedpayload.js";
import { WebhookCustomerDeletedPayload$inboundSchema } from "./models/components/webhookcustomerdeletedpayload.js";
import { WebhookCustomerStateChangedPayload$inboundSchema } from "./models/components/webhookcustomerstatechangedpayload.js";
import { WebhookCustomerSeatAssignedPayload$inboundSchema } from "./models/components/webhookcustomerseatassignedpayload.js";
import { WebhookCustomerSeatClaimedPayload$inboundSchema } from "./models/components/webhookcustomerseatclaimedpayload.js";
import { WebhookCustomerSeatRevokedPayload$inboundSchema } from "./models/components/webhookcustomerseatrevokedpayload.js";
import { SDKValidationError } from "./models/errors/sdkvalidationerror.js";

class WebhookVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.message = message;
  }
}

const parseEvent = (parsed: any) => {
  try {
    switch (parsed.type) {
      case "customer.created":
        return WebhookCustomerCreatedPayload$inboundSchema.parse(parsed);
      case "customer.updated":
        return WebhookCustomerUpdatedPayload$inboundSchema.parse(parsed);
      case "customer.deleted":
        return WebhookCustomerDeletedPayload$inboundSchema.parse(parsed);
      case "customer.state_changed":
        return WebhookCustomerStateChangedPayload$inboundSchema.parse(parsed);
      case "customer_seat.assigned":
        return WebhookCustomerSeatAssignedPayload$inboundSchema.parse(parsed);
      case "customer_seat.claimed":
        return WebhookCustomerSeatClaimedPayload$inboundSchema.parse(parsed);
      case "customer_seat.revoked":
        return WebhookCustomerSeatRevokedPayload$inboundSchema.parse(parsed);
      case "benefit.created":
        return WebhookBenefitCreatedPayload$inboundSchema.parse(parsed);
      case "benefit_grant.created":
        return WebhookBenefitGrantCreatedPayload$inboundSchema.parse(parsed);
      case "benefit_grant.cycled":
        return WebhookBenefitGrantCycledPayload$inboundSchema.parse(parsed);
      case "benefit_grant.revoked":
        return WebhookBenefitGrantRevokedPayload$inboundSchema.parse(parsed);
      case "benefit_grant.updated":
        return WebhookBenefitGrantUpdatedPayload$inboundSchema.parse(parsed);
      case "benefit.updated":
        return WebhookBenefitUpdatedPayload$inboundSchema.parse(parsed);
      case "checkout.created":
        return WebhookCheckoutCreatedPayload$inboundSchema.parse(parsed);
      case "checkout.updated":
        return WebhookCheckoutUpdatedPayload$inboundSchema.parse(parsed);
      case "order.created":
        return WebhookOrderCreatedPayload$inboundSchema.parse(parsed);
      case "order.paid":
        return WebhookOrderPaidPayload$inboundSchema.parse(parsed);
      case "order.updated":
        return WebhookOrderUpdatedPayload$inboundSchema.parse(parsed);
      case "order.refunded":
        return WebhookOrderRefundedPayload$inboundSchema.parse(parsed);
      case "organization.updated":
        return WebhookOrganizationUpdatedPayload$inboundSchema.parse(parsed);
      case "product.created":
        return WebhookProductCreatedPayload$inboundSchema.parse(parsed);
      case "product.updated":
        return WebhookProductUpdatedPayload$inboundSchema.parse(parsed);
      case "refund.created":
        return WebhookRefundCreatedPayload$inboundSchema.parse(parsed);
      case "refund.updated":
        return WebhookRefundUpdatedPayload$inboundSchema.parse(parsed);
      case "subscription.active":
        return WebhookSubscriptionActivePayload$inboundSchema.parse(parsed);
      case "subscription.canceled":
        return WebhookSubscriptionCanceledPayload$inboundSchema.parse(parsed);
      case "subscription.created":
        return WebhookSubscriptionCreatedPayload$inboundSchema.parse(parsed);
      case "subscription.revoked":
        return WebhookSubscriptionRevokedPayload$inboundSchema.parse(parsed);
      case "subscription.uncanceled":
        return WebhookSubscriptionUncanceledPayload$inboundSchema.parse(parsed);
      case "subscription.updated":
        return WebhookSubscriptionUpdatedPayload$inboundSchema.parse(parsed);
      default:
        throw new SDKValidationError(
          `Unknown event type: ${parsed.type}`,
          parsed.type,
          parsed,
        );
    }
  } catch (error) {
    throw new SDKValidationError("Failed to parse event", error, parsed);
  }
};

const validateEvent = (
  body: string | Buffer,
  headers: Record<string, string>,
  secret: string,
) => {
  const base64Secret = Buffer.from(secret, "utf-8").toString("base64");
  const webhook = new Webhook(base64Secret);
  try {
    const parsed = webhook.verify(body, headers);
    return parseEvent(parsed);
  } catch (error) {
    if (error instanceof _WebhookVerificationError) {
      throw new WebhookVerificationError(error.message);
    }
    throw error;
  }
};

export { validateEvent, WebhookVerificationError };
