import type { WebhookBenefitCreatedPayload } from '@polar-sh/sdk/models/components/webhookbenefitcreatedpayload'
import type { WebhookBenefitGrantCreatedPayload } from '@polar-sh/sdk/models/components/webhookbenefitgrantcreatedpayload'
import type { WebhookBenefitGrantRevokedPayload } from '@polar-sh/sdk/models/components/webhookbenefitgrantrevokedpayload'
import type { WebhookBenefitGrantUpdatedPayload } from '@polar-sh/sdk/models/components/webhookbenefitgrantupdatedpayload'
import type { WebhookBenefitUpdatedPayload } from '@polar-sh/sdk/models/components/webhookbenefitupdatedpayload'
import type { WebhookCheckoutCreatedPayload } from '@polar-sh/sdk/models/components/webhookcheckoutcreatedpayload'
import type { WebhookCheckoutUpdatedPayload } from '@polar-sh/sdk/models/components/webhookcheckoutupdatedpayload'
import type { WebhookCustomerCreatedPayload } from '@polar-sh/sdk/models/components/webhookcustomercreatedpayload'
import type { WebhookCustomerDeletedPayload } from '@polar-sh/sdk/models/components/webhookcustomerdeletedpayload'
import type { WebhookCustomerSeatAssignedPayload } from '@polar-sh/sdk/models/components/webhookcustomerseatassignedpayload'
import type { WebhookCustomerSeatClaimedPayload } from '@polar-sh/sdk/models/components/webhookcustomerseatclaimedpayload'
import type { WebhookCustomerSeatRevokedPayload } from '@polar-sh/sdk/models/components/webhookcustomerseatrevokedpayload'
import type { WebhookCustomerStateChangedPayload } from '@polar-sh/sdk/models/components/webhookcustomerstatechangedpayload'
import type { WebhookCustomerUpdatedPayload } from '@polar-sh/sdk/models/components/webhookcustomerupdatedpayload'
import type { WebhookMemberCreatedPayload } from '@polar-sh/sdk/models/components/webhookmembercreatedpayload'
import type { WebhookMemberDeletedPayload } from '@polar-sh/sdk/models/components/webhookmemberdeletedpayload'
import type { WebhookMemberUpdatedPayload } from '@polar-sh/sdk/models/components/webhookmemberupdatedpayload'
import type { WebhookOrderCreatedPayload } from '@polar-sh/sdk/models/components/webhookordercreatedpayload'
import type { WebhookOrderPaidPayload } from '@polar-sh/sdk/models/components/webhookorderpaidpayload'
import type { WebhookOrderRefundedPayload } from '@polar-sh/sdk/models/components/webhookorderrefundedpayload'
import type { WebhookOrderUpdatedPayload } from '@polar-sh/sdk/models/components/webhookorderupdatedpayload'
import type { WebhookOrganizationUpdatedPayload } from '@polar-sh/sdk/models/components/webhookorganizationupdatedpayload'
import type { WebhookProductCreatedPayload } from '@polar-sh/sdk/models/components/webhookproductcreatedpayload'
import type { WebhookProductUpdatedPayload } from '@polar-sh/sdk/models/components/webhookproductupdatedpayload'
import type { WebhookRefundCreatedPayload } from '@polar-sh/sdk/models/components/webhookrefundcreatedpayload'
import type { WebhookRefundUpdatedPayload } from '@polar-sh/sdk/models/components/webhookrefundupdatedpayload'
import type { WebhookSubscriptionActivePayload } from '@polar-sh/sdk/models/components/webhooksubscriptionactivepayload'
import type { WebhookSubscriptionCanceledPayload } from '@polar-sh/sdk/models/components/webhooksubscriptioncanceledpayload'
import type { WebhookSubscriptionCreatedPayload } from '@polar-sh/sdk/models/components/webhooksubscriptioncreatedpayload'
import type { WebhookSubscriptionRevokedPayload } from '@polar-sh/sdk/models/components/webhooksubscriptionrevokedpayload'
import type { WebhookSubscriptionUncanceledPayload } from '@polar-sh/sdk/models/components/webhooksubscriptionuncanceledpayload'
import type { WebhookSubscriptionUpdatedPayload } from '@polar-sh/sdk/models/components/webhooksubscriptionupdatedpayload'
import type { validateEvent } from '@polar-sh/sdk/webhooks'
import type { Entitlements } from '../entitlement/entitlement'

export interface WebhooksConfig {
  webhookSecret: string
  entitlements?: typeof Entitlements
  onPayload?: (payload: ReturnType<typeof validateEvent>) => Promise<void>
  onCheckoutCreated?: (payload: WebhookCheckoutCreatedPayload) => Promise<void>
  onCheckoutUpdated?: (payload: WebhookCheckoutUpdatedPayload) => Promise<void>
  onOrderCreated?: (payload: WebhookOrderCreatedPayload) => Promise<void>
  onOrderUpdated?: (payload: WebhookOrderUpdatedPayload) => Promise<void>
  onOrderPaid?: (payload: WebhookOrderPaidPayload) => Promise<void>
  onOrderRefunded?: (payload: WebhookOrderRefundedPayload) => Promise<void>
  onRefundCreated?: (payload: WebhookRefundCreatedPayload) => Promise<void>
  onRefundUpdated?: (payload: WebhookRefundUpdatedPayload) => Promise<void>
  onSubscriptionCreated?: (
    payload: WebhookSubscriptionCreatedPayload,
  ) => Promise<void>
  onSubscriptionUpdated?: (
    payload: WebhookSubscriptionUpdatedPayload,
  ) => Promise<void>
  onSubscriptionActive?: (
    payload: WebhookSubscriptionActivePayload,
  ) => Promise<void>
  onSubscriptionCanceled?: (
    payload: WebhookSubscriptionCanceledPayload,
  ) => Promise<void>
  onSubscriptionRevoked?: (
    payload: WebhookSubscriptionRevokedPayload,
  ) => Promise<void>
  onSubscriptionUncanceled?: (
    payload: WebhookSubscriptionUncanceledPayload,
  ) => Promise<void>
  onProductCreated?: (payload: WebhookProductCreatedPayload) => Promise<void>
  onProductUpdated?: (payload: WebhookProductUpdatedPayload) => Promise<void>
  onOrganizationUpdated?: (
    payload: WebhookOrganizationUpdatedPayload,
  ) => Promise<void>
  onBenefitCreated?: (payload: WebhookBenefitCreatedPayload) => Promise<void>
  onBenefitUpdated?: (payload: WebhookBenefitUpdatedPayload) => Promise<void>
  onBenefitGrantCreated?: (
    payload: WebhookBenefitGrantCreatedPayload,
  ) => Promise<void>
  onBenefitGrantUpdated?: (
    payload: WebhookBenefitGrantUpdatedPayload,
  ) => Promise<void>
  onBenefitGrantRevoked?: (
    payload: WebhookBenefitGrantRevokedPayload,
  ) => Promise<void>
  onCustomerCreated?: (payload: WebhookCustomerCreatedPayload) => Promise<void>
  onCustomerUpdated?: (payload: WebhookCustomerUpdatedPayload) => Promise<void>
  onCustomerDeleted?: (payload: WebhookCustomerDeletedPayload) => Promise<void>
  onCustomerStateChanged?: (
    payload: WebhookCustomerStateChangedPayload,
  ) => Promise<void>
  onCustomerSeatAssigned?: (
    payload: WebhookCustomerSeatAssignedPayload,
  ) => Promise<void>
  onCustomerSeatClaimed?: (
    payload: WebhookCustomerSeatClaimedPayload,
  ) => Promise<void>
  onCustomerSeatRevoked?: (
    payload: WebhookCustomerSeatRevokedPayload,
  ) => Promise<void>
  onMemberCreated?: (payload: WebhookMemberCreatedPayload) => Promise<void>
  onMemberUpdated?: (payload: WebhookMemberUpdatedPayload) => Promise<void>
  onMemberDeleted?: (payload: WebhookMemberDeletedPayload) => Promise<void>
}

export const handleWebhookPayload = async (
  payload: ReturnType<typeof validateEvent>,
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
