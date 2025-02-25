'use client'

import revalidate from '@/app/actions'
import AmountLabel from '@/components/Shared/AmountLabel'
import { SubscriptionStatusLabel } from '@/components/Subscriptions/utils'
import {
  useCustomerCancelSubscription,
  useCustomerUncancelSubscription,
} from '@/hooks/queries'
import { Client, schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import ShadowBox from '@polar-sh/ui/components/atoms/ShadowBox'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { InlineModal } from '../Modal/InlineModal'
import CustomerCancellationModal from './CustomerCancellationModal'
import CustomerChangePlanModal from './CustomerChangePlanModal'

const CustomerSubscriptionDetails = ({
  subscription,
  products,
  api,
  onUserSubscriptionUpdate,
}: {
  subscription: schemas['CustomerSubscription']
  products: schemas['CustomerProduct'][]
  api: Client
  onUserSubscriptionUpdate: (
    subscription: schemas['CustomerSubscription'],
  ) => void
}) => {
  const [showChangePlanModal, setShowChangePlanModal] = useState(false)
  const [showCancelModal, setShowCancelModal] = useState(false)

  const cancelSubscription = useCustomerCancelSubscription(api)

  const isCanceled =
    cancelSubscription.isPending ||
    cancelSubscription.isSuccess ||
    !!subscription.ended_at ||
    !!subscription.ends_at

  const organization = subscription.product.organization

  const uncancelSubscription = useCustomerUncancelSubscription(api)

  const primaryAction = useMemo(() => {
    if (
      organization.subscription_settings.allow_customer_updates &&
      !isCanceled
    ) {
      return {
        label: 'Change Plan',
        onClick: () => {
          setShowChangePlanModal(true)
        },
      }
    }

    if (
      isCanceled &&
      subscription.cancel_at_period_end &&
      subscription.current_period_end &&
      new Date(subscription.current_period_end) > new Date()
    ) {
      return {
        label: 'Uncancel',
        loading: uncancelSubscription.isPending,
        onClick: async () => {
          await uncancelSubscription.mutateAsync({ id: subscription.id })
          await revalidate(`customer_portal`)
        },
      }
    }

    return null
  }, [subscription, isCanceled, organization, uncancelSubscription])

  if (!organization) {
    return null
  }

  return (
    <ShadowBox className="flex w-full flex-col gap-y-6 dark:border-transparent">
      <div className="flex flex-row items-start justify-between">
        <div className="flex flex-col gap-y-4">
          <h3 className="truncate text-2xl">{subscription.product.name}</h3>
        </div>
      </div>
      <div className="flex flex-col gap-y-2 text-sm">
        <div className="flex flex-row items-center justify-between">
          <span className="dark:text-polar-500 text-gray-500">Amount</span>
          {subscription.amount && subscription.currency ? (
            <AmountLabel
              amount={subscription.amount}
              currency={subscription.currency}
              interval={subscription.recurring_interval}
            />
          ) : (
            'Free'
          )}
        </div>
        <div className="flex flex-row items-center justify-between">
          <span className="dark:text-polar-500 text-gray-500">Status</span>
          <SubscriptionStatusLabel subscription={subscription} />
        </div>
        {subscription.started_at && (
          <div className="flex flex-row items-center justify-between">
            <span className="dark:text-polar-500 text-gray-500">
              Start Date
            </span>
            <span>
              {new Date(subscription.started_at).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </span>
          </div>
        )}
        {!subscription.ended_at && subscription.current_period_end && (
          <div className="flex flex-row items-center justify-between">
            <span className="dark:text-polar-500 text-gray-500">
              {subscription.cancel_at_period_end
                ? 'Expiry Date'
                : 'Renewal Date'}
            </span>
            <span>
              {new Date(subscription.current_period_end).toLocaleDateString(
                'en-US',
                {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                },
              )}
            </span>
          </div>
        )}
        {subscription.ended_at && (
          <div className="flex flex-row items-center justify-between">
            <span className="dark:text-polar-500 text-gray-500">Expired</span>
            <span>
              {new Date(subscription.ended_at).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        {primaryAction && (
          <Button
            size="lg"
            fullWidth
            onClick={primaryAction.onClick}
            loading={primaryAction.loading}
          >
            {primaryAction.label}
          </Button>
        )}
        <Link
          href={`/${organization.slug}/portal/subscriptions/${subscription.id}`}
        >
          <Button size="lg" variant="ghost" fullWidth>
            View Subscription
          </Button>
        </Link>
        <CustomerCancellationModal
          isShown={showCancelModal}
          hide={() => setShowCancelModal(false)}
          subscription={subscription}
          cancelSubscription={cancelSubscription}
        />
      </div>

      <InlineModal
        isShown={showChangePlanModal}
        hide={() => setShowChangePlanModal(false)}
        modalContent={
          <CustomerChangePlanModal
            api={api}
            organization={organization}
            products={products}
            subscription={subscription}
            hide={() => setShowChangePlanModal(false)}
            onUserSubscriptionUpdate={onUserSubscriptionUpdate}
          />
        }
      />
    </ShadowBox>
  )
}

export default CustomerSubscriptionDetails
