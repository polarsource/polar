import type { webhooks } from '@polar-sh/sdk/2026-04'
import type { Entitlements } from '../entitlement/entitlement'

export interface WebhooksConfig {
  webhookSecret: string
  entitlements?: typeof Entitlements
  onPayload?: (payload: webhooks.WebhookPayload) => Promise<void>
  onCheckoutCreated?: (
    payload: webhooks.WebhookCheckoutCreatedPayload,
  ) => Promise<void>
  onCheckoutExpired?: (
    payload: webhooks.WebhookCheckoutExpiredPayload,
  ) => Promise<void>
  onCheckoutUpdated?: (
    payload: webhooks.WebhookCheckoutUpdatedPayload,
  ) => Promise<void>
  onOrderCreated?: (
    payload: webhooks.WebhookOrderCreatedPayload,
  ) => Promise<void>
  onOrderUpdated?: (
    payload: webhooks.WebhookOrderUpdatedPayload,
  ) => Promise<void>
  onOrderPaid?: (payload: webhooks.WebhookOrderPaidPayload) => Promise<void>
  onOrderRefunded?: (
    payload: webhooks.WebhookOrderRefundedPayload,
  ) => Promise<void>
  onRefundCreated?: (
    payload: webhooks.WebhookRefundCreatedPayload,
  ) => Promise<void>
  onRefundUpdated?: (
    payload: webhooks.WebhookRefundUpdatedPayload,
  ) => Promise<void>
  onSubscriptionCreated?: (
    payload: webhooks.WebhookSubscriptionCreatedPayload,
  ) => Promise<void>
  onSubscriptionUpdated?: (
    payload: webhooks.WebhookSubscriptionUpdatedPayload,
  ) => Promise<void>
  onSubscriptionActive?: (
    payload: webhooks.WebhookSubscriptionActivePayload,
  ) => Promise<void>
  onSubscriptionCanceled?: (
    payload: webhooks.WebhookSubscriptionCanceledPayload,
  ) => Promise<void>
  onSubscriptionCycled?: (
    payload: webhooks.WebhookSubscriptionCycledPayload,
  ) => Promise<void>
  onSubscriptionPastDue?: (
    payload: webhooks.WebhookSubscriptionPastDuePayload,
  ) => Promise<void>
  onSubscriptionPaused?: (
    payload: webhooks.WebhookSubscriptionPausedPayload,
  ) => Promise<void>
  onSubscriptionResumed?: (
    payload: webhooks.WebhookSubscriptionResumedPayload,
  ) => Promise<void>
  onSubscriptionRevoked?: (
    payload: webhooks.WebhookSubscriptionRevokedPayload,
  ) => Promise<void>
  onSubscriptionUncanceled?: (
    payload: webhooks.WebhookSubscriptionUncanceledPayload,
  ) => Promise<void>
  onProductCreated?: (
    payload: webhooks.WebhookProductCreatedPayload,
  ) => Promise<void>
  onProductUpdated?: (
    payload: webhooks.WebhookProductUpdatedPayload,
  ) => Promise<void>
  onOrganizationUpdated?: (
    payload: webhooks.WebhookOrganizationUpdatedPayload,
  ) => Promise<void>
  onBenefitCreated?: (
    payload: webhooks.WebhookBenefitCreatedPayload,
  ) => Promise<void>
  onBenefitUpdated?: (
    payload: webhooks.WebhookBenefitUpdatedPayload,
  ) => Promise<void>
  onBenefitGrantCreated?: (
    payload: webhooks.WebhookBenefitGrantCreatedPayload,
  ) => Promise<void>
  onBenefitGrantCycled?: (
    payload: webhooks.WebhookBenefitGrantCycledPayload,
  ) => Promise<void>
  onBenefitGrantUpdated?: (
    payload: webhooks.WebhookBenefitGrantUpdatedPayload,
  ) => Promise<void>
  onBenefitGrantRevoked?: (
    payload: webhooks.WebhookBenefitGrantRevokedPayload,
  ) => Promise<void>
  onCustomerCreated?: (
    payload: webhooks.WebhookCustomerCreatedPayload,
  ) => Promise<void>
  onCustomerUpdated?: (
    payload: webhooks.WebhookCustomerUpdatedPayload,
  ) => Promise<void>
  onCustomerDeleted?: (
    payload: webhooks.WebhookCustomerDeletedPayload,
  ) => Promise<void>
  onCustomerStateChanged?: (
    payload: webhooks.WebhookCustomerStateChangedPayload,
  ) => Promise<void>
  onCustomerSeatAssigned?: (
    payload: webhooks.WebhookCustomerSeatAssignedPayload,
  ) => Promise<void>
  onCustomerSeatClaimed?: (
    payload: webhooks.WebhookCustomerSeatClaimedPayload,
  ) => Promise<void>
  onCustomerSeatRevoked?: (
    payload: webhooks.WebhookCustomerSeatRevokedPayload,
  ) => Promise<void>
  onDiscountCreated?: (
    payload: webhooks.WebhookDiscountCreatedPayload,
  ) => Promise<void>
  onDiscountUpdated?: (
    payload: webhooks.WebhookDiscountUpdatedPayload,
  ) => Promise<void>
  onDiscountDeleted?: (
    payload: webhooks.WebhookDiscountDeletedPayload,
  ) => Promise<void>
  onMemberCreated?: (
    payload: webhooks.WebhookMemberCreatedPayload,
  ) => Promise<void>
  onMemberUpdated?: (
    payload: webhooks.WebhookMemberUpdatedPayload,
  ) => Promise<void>
  onMemberDeleted?: (
    payload: webhooks.WebhookMemberDeletedPayload,
  ) => Promise<void>
}

export const handleWebhookPayload = async (
  payload: webhooks.WebhookPayload,
  {
    webhookSecret: _webhookSecret,
    entitlements,
    onPayload,
    ...eventHandlers
  }: WebhooksConfig,
) => {
  const promises: Promise<void>[] = []

  if (onPayload) {
    promises.push(onPayload(payload))
  }

  switch (payload.type) {
    case 'checkout.created':
      if (eventHandlers.onCheckoutCreated) {
        promises.push(eventHandlers.onCheckoutCreated(payload))
      }
      break
    case 'checkout.expired':
      if (eventHandlers.onCheckoutExpired) {
        promises.push(eventHandlers.onCheckoutExpired(payload))
      }
      break
    case 'checkout.updated':
      if (eventHandlers.onCheckoutUpdated) {
        promises.push(eventHandlers.onCheckoutUpdated(payload))
      }
      break
    case 'order.created':
      if (eventHandlers.onOrderCreated) {
        promises.push(eventHandlers.onOrderCreated(payload))
      }
      break
    case 'order.updated':
      if (eventHandlers.onOrderUpdated) {
        promises.push(eventHandlers.onOrderUpdated(payload))
      }
      break
    case 'order.paid':
      if (eventHandlers.onOrderPaid) {
        promises.push(eventHandlers.onOrderPaid(payload))
      }
      break
    case 'subscription.created':
      if (eventHandlers.onSubscriptionCreated) {
        promises.push(eventHandlers.onSubscriptionCreated(payload))
      }
      break
    case 'subscription.updated':
      if (eventHandlers.onSubscriptionUpdated) {
        promises.push(eventHandlers.onSubscriptionUpdated(payload))
      }
      break
    case 'subscription.active':
      if (eventHandlers.onSubscriptionActive) {
        promises.push(eventHandlers.onSubscriptionActive(payload))
      }
      break
    case 'subscription.canceled':
      if (eventHandlers.onSubscriptionCanceled) {
        promises.push(eventHandlers.onSubscriptionCanceled(payload))
      }
      break
    case 'subscription.cycled':
      if (eventHandlers.onSubscriptionCycled) {
        promises.push(eventHandlers.onSubscriptionCycled(payload))
      }
      break
    case 'subscription.past_due':
      if (eventHandlers.onSubscriptionPastDue) {
        promises.push(eventHandlers.onSubscriptionPastDue(payload))
      }
      break
    case 'subscription.paused':
      if (eventHandlers.onSubscriptionPaused) {
        promises.push(eventHandlers.onSubscriptionPaused(payload))
      }
      break
    case 'subscription.resumed':
      if (eventHandlers.onSubscriptionResumed) {
        promises.push(eventHandlers.onSubscriptionResumed(payload))
      }
      break
    case 'subscription.uncanceled':
      if (eventHandlers.onSubscriptionUncanceled) {
        promises.push(eventHandlers.onSubscriptionUncanceled(payload))
      }
      break
    case 'subscription.revoked':
      if (eventHandlers.onSubscriptionRevoked) {
        promises.push(eventHandlers.onSubscriptionRevoked(payload))
      }
      break
    case 'product.created':
      if (eventHandlers.onProductCreated) {
        promises.push(eventHandlers.onProductCreated(payload))
      }
      break
    case 'product.updated':
      if (eventHandlers.onProductUpdated) {
        promises.push(eventHandlers.onProductUpdated(payload))
      }
      break
    case 'organization.updated':
      if (eventHandlers.onOrganizationUpdated) {
        promises.push(eventHandlers.onOrganizationUpdated(payload))
      }
      break
    case 'benefit.created':
      if (eventHandlers.onBenefitCreated) {
        promises.push(eventHandlers.onBenefitCreated(payload))
      }
      break
    case 'benefit.updated':
      if (eventHandlers.onBenefitUpdated) {
        promises.push(eventHandlers.onBenefitUpdated(payload))
      }
      break
    case 'benefit_grant.created':
      if (eventHandlers.onBenefitGrantCreated) {
        promises.push(eventHandlers.onBenefitGrantCreated(payload))
      }
      break
    case 'benefit_grant.cycled':
      if (eventHandlers.onBenefitGrantCycled) {
        promises.push(eventHandlers.onBenefitGrantCycled(payload))
      }
      break
    case 'benefit_grant.updated':
      if (eventHandlers.onBenefitGrantUpdated) {
        promises.push(eventHandlers.onBenefitGrantUpdated(payload))
      }
      break
    case 'benefit_grant.revoked':
      if (eventHandlers.onBenefitGrantRevoked) {
        promises.push(eventHandlers.onBenefitGrantRevoked(payload))
      }
      break
    case 'customer.created':
      if (eventHandlers.onCustomerCreated) {
        promises.push(eventHandlers.onCustomerCreated(payload))
      }
      break
    case 'customer.updated':
      if (eventHandlers.onCustomerUpdated) {
        promises.push(eventHandlers.onCustomerUpdated(payload))
      }
      break
    case 'customer.deleted':
      if (eventHandlers.onCustomerDeleted) {
        promises.push(eventHandlers.onCustomerDeleted(payload))
      }
      break
    case 'customer.state_changed':
      if (eventHandlers.onCustomerStateChanged) {
        promises.push(eventHandlers.onCustomerStateChanged(payload))
      }
      break
    case 'customer_seat.assigned':
      if (eventHandlers.onCustomerSeatAssigned) {
        promises.push(eventHandlers.onCustomerSeatAssigned(payload))
      }
      break
    case 'customer_seat.claimed':
      if (eventHandlers.onCustomerSeatClaimed) {
        promises.push(eventHandlers.onCustomerSeatClaimed(payload))
      }
      break
    case 'customer_seat.revoked':
      if (eventHandlers.onCustomerSeatRevoked) {
        promises.push(eventHandlers.onCustomerSeatRevoked(payload))
      }
      break
    case 'discount.created':
      if (eventHandlers.onDiscountCreated) {
        promises.push(eventHandlers.onDiscountCreated(payload))
      }
      break
    case 'discount.updated':
      if (eventHandlers.onDiscountUpdated) {
        promises.push(eventHandlers.onDiscountUpdated(payload))
      }
      break
    case 'discount.deleted':
      if (eventHandlers.onDiscountDeleted) {
        promises.push(eventHandlers.onDiscountDeleted(payload))
      }
      break
    case 'member.created':
      if (eventHandlers.onMemberCreated) {
        promises.push(eventHandlers.onMemberCreated(payload))
      }
      break
    case 'member.updated':
      if (eventHandlers.onMemberUpdated) {
        promises.push(eventHandlers.onMemberUpdated(payload))
      }
      break
    case 'member.deleted':
      if (eventHandlers.onMemberDeleted) {
        promises.push(eventHandlers.onMemberDeleted(payload))
      }
      break
    case 'order.refunded':
      if (eventHandlers.onOrderRefunded) {
        promises.push(eventHandlers.onOrderRefunded(payload))
      }
      break
    case 'refund.created':
      if (eventHandlers.onRefundCreated) {
        promises.push(eventHandlers.onRefundCreated(payload))
      }
      break
    case 'refund.updated':
      if (eventHandlers.onRefundUpdated) {
        promises.push(eventHandlers.onRefundUpdated(payload))
      }
      break
  }

  switch (payload.type) {
    case 'benefit_grant.created':
    case 'benefit_grant.revoked':
      if (entitlements) {
        for (const handler of entitlements.handlers) {
          promises.push(handler(payload))
        }
      }
  }

  return Promise.all(promises)
}
