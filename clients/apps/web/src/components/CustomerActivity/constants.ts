import {
  CUSTOMER_ACTIVITY_TIMELINE_EVENTS_CONFIG,
  CustomerActivityTimelineEventName,
  CustomerActivityTimelineEventWithPaymentStatusName,
} from './timeline-utils'

export const CUSTOMER_ACTIVITY_TIMELINE = {
  EVENT_NAMES: new Set<CustomerActivityTimelineEventName>(
    getCustomerActivityTimelineEventNames(),
  ),
  EVENTS_WITH_PAYMENT_STATUS:
    new Set<CustomerActivityTimelineEventWithPaymentStatusName>(
      getCustomerActivityTimelineEventsWithPaymentStatus(),
    ),
} as const

export type {
  CustomerActivityTimelineEventName,
  CustomerActivityTimelineEventWithPaymentStatusName,
}

function getCustomerActivityTimelineEventNames(): CustomerActivityTimelineEventName[] {
  return Object.keys(
    CUSTOMER_ACTIVITY_TIMELINE_EVENTS_CONFIG,
  ) as CustomerActivityTimelineEventName[]
}

function getCustomerActivityTimelineEventsWithPaymentStatus(): CustomerActivityTimelineEventWithPaymentStatusName[] {
  return getCustomerActivityTimelineEventNames().filter((eventName) => {
    const eventConfig = CUSTOMER_ACTIVITY_TIMELINE_EVENTS_CONFIG[eventName]

    return (
      'tracksSubscriptionPaymentStatus' in eventConfig &&
      eventConfig.tracksSubscriptionPaymentStatus === true
    )
  }) as CustomerActivityTimelineEventWithPaymentStatusName[]
}
