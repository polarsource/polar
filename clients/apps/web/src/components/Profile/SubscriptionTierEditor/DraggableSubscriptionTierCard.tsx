import { FreeTierSubscribe } from '@/components/Organization/FreeTierSubscribe'
import SubscriptionTierCard from '@/components/Subscriptions/SubscriptionTierCard'
import SubscriptionTierSubscribeButton from '@/components/Subscriptions/SubscriptionTierSubscribeButton'
import { useSortable } from '@dnd-kit/sortable'
import {
  Organization,
  SubscriptionTier,
  SubscriptionTierPriceRecurringInterval,
} from '@polar-sh/sdk'
import { twMerge } from 'tailwind-merge'

export interface DraggableSubscriptionTierCardProps {
  organization: Organization
  subscriptionTier: SubscriptionTier
  recurringInterval: SubscriptionTierPriceRecurringInterval
  subscribeButton: boolean
  disabled?: boolean
  className?: string
}

export const DraggableSubscriptionTierCard = ({
  organization,
  subscribeButton,
  subscriptionTier,
  recurringInterval,
  disabled,
  className,
}: DraggableSubscriptionTierCardProps) => {
  const draggable = useSortable({ id: subscriptionTier.id })

  return (
    <SubscriptionTierCard
      className={twMerge('w-full self-stretch md:max-w-[260px]', className)}
      subscriptionTier={subscriptionTier}
      recurringInterval={recurringInterval}
      variant="small"
      draggable={disabled ? undefined : draggable}
    >
      {subscribeButton ? (
        <>
          {subscriptionTier.type === 'free' ? (
            <FreeTierSubscribe
              subscriptionTier={subscriptionTier}
              organization={organization}
            />
          ) : (
            <SubscriptionTierSubscribeButton
              organization={organization}
              subscriptionTier={subscriptionTier}
              recurringInterval={recurringInterval}
              subscribePath="/api/subscribe"
            />
          )}
        </>
      ) : null}
    </SubscriptionTierCard>
  )
}
