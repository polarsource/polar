import { schemas } from '@polar-sh/client'
import { useMemo } from 'react'
import { BenefitEventCard } from './EventCard/BenefitEventCard'
import { SubscriptionEventCard } from './EventCard/SubscriptionEventCard'
import { UserEventCard } from './EventCard/UserEventCard'

export const useEventDisplayName = (event: schemas['Event']) => {
  return useMemo(() => {
    switch (event.name) {
      case 'benefit.granted':
        return 'Benefit Granted'
      case 'benefit.cycled':
        return 'Benefit Cycled'
      case 'benefit.updated':
        return 'Benefit Updated'
      case 'benefit.revoked':
        return 'Benefit Revoked'
      case 'subscription.cycled':
        return 'Subscription Cycled'
      case 'subscription.revoked':
        return 'Subscription Revoked'
      case 'subscription.product_updated':
        return 'Subscription Product Updated'
      default:
        return event.name
    }
  }, [event])
}

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
          default:
            return <UserEventCard event={event} />
        }
      default:
        return <UserEventCard event={event} />
    }
  }, [event])
}
