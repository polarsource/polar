import { MoreVertOutlined } from '@mui/icons-material'
import { SubscriptionSubscriber } from '@polar-sh/sdk'
import Link from 'next/link'
import { api } from 'polarkit'
import { Avatar, Button } from 'polarkit/components/ui/atoms'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from 'polarkit/components/ui/dropdown-menu'
import { useOrganization } from 'polarkit/hooks'
import { useCallback, useState } from 'react'
import { ConfirmModal } from '../Shared/ConfirmModal'

export interface MySubscriptionsProps {
  subscriptions: SubscriptionSubscriber[]
}

export const MySubscriptions = ({ subscriptions }: MySubscriptionsProps) => {
  return (
    <div className="flex flex-col gap-y-6">
      <h3>My Subscriptions</h3>
      <div className="flex flex-col py-2">
        {subscriptions.map((subscription) => (
          <SubscriptionOrganizationItem
            key={subscription.id}
            subscription={subscription}
          />
        ))}
      </div>
    </div>
  )
}

const SubscriptionOrganizationItem = ({
  subscription,
}: {
  subscription: SubscriptionSubscriber
}) => {
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [canceled, setCanceled] = useState(false)
  const { data: organization } = useOrganization(
    subscription.subscription_tier.organization_id ?? '',
  )

  const canUnsubscribe = !canceled && !subscription.cancel_at_period_end
  const isFreeTier = subscription.subscription_tier.type === 'free'

  const cancelSubscription = useCallback(async () => {
    await api.subscriptions.cancelSubscription({ id: subscription.id })
    setShowCancelModal(false)
    setCanceled(true)
  }, [subscription])

  return (
    <div className="group flex flex-row items-center justify-between py-2">
      <Link
        className="flex flex-row items-center gap-x-3"
        href={`/${organization?.name}`}
      >
        <Avatar
          className="h-10 w-10 border-transparent transition-colors duration-300 group-hover:border-blue-200 dark:group-hover:border-blue-400"
          avatar_url={organization?.avatar_url}
          name={organization?.name ?? ''}
        />
        <div className="flex flex-col gap-y-1">
          <span className="w-full truncate text-sm">{organization?.name}</span>
          <span className="dark:text-polar-500 text-xs text-gray-500">
            {subscription.subscription_tier.name}
          </span>
        </div>
      </Link>
      <div className="flex flex-row gap-x-2">
        {canUnsubscribe && (
          <DropdownMenu>
            <DropdownMenuTrigger className="focus:outline-none">
              <Button
                className={
                  'border-none bg-transparent text-[16px] opacity-50 transition-opacity hover:opacity-100 dark:bg-transparent'
                }
                size="icon"
                variant="secondary"
              >
                <MoreVertOutlined fontSize="inherit" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="dark:bg-polar-800 bg-gray-50 shadow-lg"
            >
              <DropdownMenuItem onClick={() => setShowCancelModal(true)} className="cursor-pointer">
                Unsubscribe
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      <ConfirmModal
        isShown={showCancelModal}
        hide={() => setShowCancelModal(false)}
        title={`Unsubscribe from ${subscription.subscription_tier.name}?`}
        description={
          isFreeTier
            ? `You won't have access to your benefits anymore.`
            : `At the end of your billing period, you won't have access to your benefits anymore.`
        }
        destructiveText="Unsubscribe"
        onConfirm={() => cancelSubscription()}
        destructive
      />
    </div>
  )
}
