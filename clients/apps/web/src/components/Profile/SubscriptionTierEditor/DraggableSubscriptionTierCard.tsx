import { FreeTierSubscribe } from '@/components/Organization/FreeTierSubscribe'
import SubscriptionTierCard from '@/components/Subscriptions/SubscriptionTierCard'
import SubscriptionTierSubscribeButton from '@/components/Subscriptions/SubscriptionTierSubscribeButton'
import { useSortable } from '@dnd-kit/sortable'
import { Organization, SubscriptionTier } from '@polar-sh/sdk'
import { twMerge } from 'tailwind-merge'

export interface DraggableSubscriptionTierCardProps {
  organization: Organization
  subscriptionTier: SubscriptionTier
  subscribeButton: boolean
  disabled?: boolean
  className?: string
}

export const DraggableSubscriptionTierCard = ({
  organization,
  subscribeButton,
  subscriptionTier,
  disabled,
  className,
}: DraggableSubscriptionTierCardProps) => {
  const draggable = useSortable({ id: subscriptionTier.id })

  return (
    <SubscriptionTierCard
      className={twMerge('w-full self-stretch md:max-w-[260px]', className)}
      subscriptionTier={subscriptionTier}
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
              subscribePath="/api/subscribe"
            />
          )}
        </>
      ) : null}
    </SubscriptionTierCard>
  )
}
