import { buildCustomerDashboardPath } from '@/utils/customer'
import { schemas } from '@polar-sh/client'

const asId = (value: unknown): string | undefined =>
  typeof value === 'string' && value.length > 0 ? value : undefined

const resolveResourcePath = (
  event: schemas['SystemEvent'],
  organizationSlug: string,
): string | undefined => {
  const base = `/dashboard/${organizationSlug}`
  const metadata = event.metadata as Record<string, unknown>

  switch (event.name.split('.')[0]) {
    case 'subscription': {
      const id = asId(metadata.subscription_id)
      return id && `${base}/sales/subscriptions/${id}`
    }
    case 'order': {
      const id = asId(metadata.order_id)
      return id && `${base}/sales/${id}`
    }
    case 'checkout': {
      const id = asId(metadata.checkout_id)
      return id && `${base}/sales/checkouts/${id}`
    }
    case 'customer': {
      if (event.name === 'customer.deleted') {
        return undefined
      }
      if (event.customer) {
        return buildCustomerDashboardPath(organizationSlug, event.customer)
      }
      const id = asId(metadata.customer_id)
      return id && `${base}/customers/${id}`
    }
    case 'benefit': {
      const id = asId(metadata.benefit_id)
      return id && `${base}/products/benefits/${id}`
    }
    case 'meter': {
      const id = asId(metadata.meter_id)
      return id && `${base}/products/meters/${id}`
    }
    case 'balance': {
      const disputeId = asId(metadata.dispute_id)
      if (disputeId) {
        return `${base}/sales/disputes/${disputeId}`
      }
      const orderId = asId(metadata.order_id)
      return orderId && `${base}/sales/${orderId}`
    }
  }

  return undefined
}

export const resolveTimelineEventHref = (
  event: schemas['Event'],
  organizationSlug: string,
): string => {
  const fallback = `/dashboard/${organizationSlug}/analytics/events/${event.id}`
  if (event.source !== 'system') {
    return fallback
  }
  return resolveResourcePath(event, organizationSlug) ?? fallback
}
