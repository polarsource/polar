import { schemas } from '@polar-sh/client'
import { useMemo } from 'react'
import { BenefitEventCard } from './EventCard/BenefitEventCard'
import { LLMInferenceEventCard } from './EventCard/LLMInferenceEventCard'
import { OrderEventCard } from './EventCard/OrderEventCard'
import { SubscriptionEventCard } from './EventCard/SubscriptionEventCard'
import { UserEventCard } from './EventCard/UserEventCard'
import { EventCostBadge } from './EventCostBadge'

export const useEventCard = (event: schemas['Event']) => {
  return useMemo(() => {
    switch (event.source) {
      case 'system':
        switch (event.name) {
          case 'benefit.granted':
          case 'benefit.cycled':
          case 'benefit.updated':
          case 'benefit.revoked':
            return <BenefitEventCard event={event} />
          case 'subscription.cycled':
          case 'subscription.revoked':
          case 'subscription.product_updated':
            return <SubscriptionEventCard event={event} />
          case 'order.paid':
          case 'order.refunded':
            return <OrderEventCard event={event} />
          case 'customer.created':
          case 'customer.deleted':
            return null
          case 'customer.updated':
          default:
            return <UserEventCard event={event} />
        }
      case 'user':
        return <LLMInferenceEventCard event={event} />
      default:
        return <UserEventCard event={event} />
    }
  }, [event])
}

export const isOrderEvent = (
  event: schemas['Event'],
): event is schemas['OrderPaidEvent'] | schemas['OrderRefundedEvent'] => {
  return (
    event.source === 'system' &&
    (event.name === 'order.paid' || event.name === 'order.refunded')
  )
}

export const useEventCostBadge = (event: schemas['Event']) => {
  return useMemo(() => {
    if ('_cost' in event.metadata && event.metadata._cost) {
      return (
        <EventCostBadge
          type={event.name === 'order.paid' ? 'revenue' : 'cost'}
          cost={event.metadata._cost?.amount}
          currency={event.metadata._cost?.currency}
        />
      )
    } else if (isOrderEvent(event)) {
      return (
        <EventCostBadge
          type={event.name === 'order.paid' ? 'revenue' : 'cost'}
          currency={event.metadata.currency ?? 'usd'}
          cost={
            event.name === 'order.paid'
              ? event.metadata.amount
              : event.metadata.refunded_amount
          }
        />
      )
    }

    return <EventCostBadge nonCostEvent />
  }, [event])
}
